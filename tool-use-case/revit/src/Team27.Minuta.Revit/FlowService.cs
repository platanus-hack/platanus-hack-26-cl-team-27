using System.Collections.Concurrent;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Team27.Minuta.Core;
using Settings = Team27.Minuta.Core.Settings;

namespace Team27.Minuta.Revit;

internal sealed class FlowService : IDisposable
{
    public const string TransactionName = "Vigente: propuesta aceptada";

    private readonly Settings settings;
    private readonly IFlowApi api;
    private readonly FlowDispatcher dispatcher;
    private readonly UiQueue ui;
    private readonly Log log;
    private readonly AppliedLedger ledger = new(System.IO.Path.Combine(Log.DefaultRoot, "flow-applied.txt"));
    private readonly HashSet<(string Document, string Proposal)> failed = new();
    private readonly Dictionary<Document, ColumnSnapshot> baselines = new();
    private readonly ConcurrentDictionary<string, string> applySeats = new();
    private Timer? timer;
    private int polling;

    public FlowService(Settings settings, IFlowApi api, UiQueue ui, Log log)
    {
        this.settings = settings;
        this.api = api;
        this.ui = ui;
        this.log = log;
        dispatcher = new FlowDispatcher(api, result => ui.Post(_ => ShowSendResult(result)), log);
    }

    private bool Enabled => settings.Flow.Enabled;

    public void StartPolling()
    {
        if (!Enabled)
        {
            return;
        }
        var period = TimeSpan.FromSeconds(settings.Flow.PollSeconds);
        timer = new Timer(_ => _ = Poll(), null, period, period);
    }

    public void Start(Document document)
    {
        if (!Enabled || settings.Flow.Find(document.Title) is not { } model)
        {
            return;
        }
        baselines[document] = ColumnReader.Read(document);
        if (model.Applies)
        {
            applySeats[Key(document)] = model.Seat;
        }
        log.Info($"Flujo: «{document.Title}» como {model.Seat} ({model.Discipline}); envía={model.Sends}, aplica={model.Applies}");
    }

    public void Forget(Document document)
    {
        baselines.Remove(document);
        applySeats.TryRemove(Key(document), out _);
    }

    public void Saved(Document document)
    {
        if (!Enabled || settings.Flow.Find(document.Title) is not { Sends: true } model || !baselines.TryGetValue(document, out var before))
        {
            return;
        }
        var current = ColumnReader.Read(document);
        var changes = ColumnDiff.Between(before, current, model.Reason);
        baselines[document] = current;
        if (changes.Count == 0)
        {
            _ = dispatcher.FlushAsync();
            return;
        }
        foreach (var change in changes)
        {
            var minute = FlowMinute.Create(Guid.NewGuid().ToString(), Title(document), model.Discipline, [change]);
            if (minute is null)
            {
                continue;
            }
            log.Info($"Flujo: minuta {minute.MinuteId} con {FlowText.Moved(change)}");
            _ = dispatcher.SubmitAsync(minute, model.Seat);
        }
    }

    public void CheckNow()
    {
        ui.Post(_ => failed.Clear());
        _ = Poll();
    }

    private async Task Poll()
    {
        if (Interlocked.Exchange(ref polling, 1) == 1)
        {
            return;
        }
        try
        {
            await dispatcher.FlushAsync().ConfigureAwait(false);
            foreach (var seat in applySeats.Values.Distinct())
            {
                var state = await api.GetStateAsync(seat).ConfigureAwait(false);
                var proposal = state?.Proposal;
                if (proposal is null || !applySeats.Any(entry => entry.Value == seat && FlowPlanner.ShouldApply(proposal, entry.Key, ledger)))
                {
                    continue;
                }
                ui.Post(app => Apply(app, proposal, seat));
            }
        }
        catch (Exception ex)
        {
            log.Error("Falló la consulta del flujo", ex);
        }
        finally
        {
            Interlocked.Exchange(ref polling, 0);
        }
    }

    private void Apply(UIApplication app, FlowProposal proposal, string seat)
    {
        foreach (Document document in app.Application.Documents)
        {
            var key = Key(document);
            if (!applySeats.TryGetValue(key, out var documentSeat) || documentSeat != seat || !FlowPlanner.ShouldApply(proposal, key, ledger))
            {
                continue;
            }
            if (failed.Contains((key, proposal.Id)))
            {
                continue;
            }
            if (ApplyTo(document, proposal))
            {
                ledger.Add(key, proposal.Id);
            }
            else
            {
                failed.Add((key, proposal.Id));
            }
        }
    }

    private bool ApplyTo(Document document, FlowProposal proposal)
    {
        var targets = ColumnReader.FindByMark(document, proposal.ElementId);
        if (targets.Count == 0)
        {
            log.Info($"Flujo: «{document.Title}» no tiene un elemento con Marca {proposal.ElementId}; la propuesta {proposal.Id} no se aplica ahí");
            Dialogs.Show(
                $"Vigente no encontró {proposal.ElementId} en este modelo",
                $"La propuesta aceptada mueve el elemento con Marca {proposal.ElementId}, pero «{document.Title}» no tiene ninguno. Revisa el parámetro Marca del elemento y pulsa Aplicar propuesta.");
            return false;
        }
        var feet = FlowPlanner.ToFeet(proposal.Delta);
        var translation = new XYZ(feet.Dx, feet.Dy, feet.Dz);
        try
        {
            using var transaction = new Transaction(document, TransactionName);
            transaction.Start();
            ElementTransformUtils.MoveElements(document, targets.Select(e => e.Id).ToList(), translation);
            transaction.Commit();
        }
        catch (Exception ex)
        {
            log.Error($"No pudimos aplicar la propuesta {proposal.Id}", ex);
            Dialogs.Show(
                $"Vigente no pudo mover {proposal.ElementId}",
                $"Revit rechazó el movimiento: {ex.Message}\n\nSi el elemento está fijado, suéltalo y mueve {proposal.ElementId} a mano.");
            return false;
        }
        Rebase(document, proposal.ElementId);
        log.Info($"Flujo: propuesta {proposal.Id} aplicada en «{document.Title}»: {FlowText.Moved(proposal.ElementId, proposal.Delta)}");
        Dialogs.Show(
            FlowPlanner.Notice(proposal),
            $"{FlowText.Moved(proposal.ElementId, proposal.Delta)} en «{document.Title}». Guarda el modelo para dejarlo así.");
        return true;
    }

    private void Rebase(Document document, string mark)
    {
        if (!baselines.TryGetValue(document, out var baseline))
        {
            return;
        }
        if (ColumnReader.Read(document).Columns.TryGetValue(mark, out var position))
        {
            baselines[document] = baseline.With(position);
        }
    }

    private void ShowSendResult(FlowDispatch result)
    {
        var what = string.Join("; ", result.Minute.Changes.Select(FlowText.Moved));
        switch (result.Outcome)
        {
            case FlowSendOutcome.Sent:
                Dialogs.Show("Vigente recibió tu cambio", $"{what}. Avisamos a los equipos que afecta.");
                break;
            case FlowSendOutcome.Rejected rejected:
                Dialogs.Show("Vigente no aceptó tu cambio", $"{rejected.Message}\n\n{what}");
                break;
        }
    }

    private static string Key(Document document) =>
        document.Title;

    private static string Title(Document document)
    {
        var title = document.Title ?? "";
        return title.EndsWith(".rvt", StringComparison.OrdinalIgnoreCase) ? title[..^4] : title;
    }

    public void Dispose()
    {
        timer?.Dispose();
        timer = null;
    }
}
