using System.Diagnostics;
using Autodesk.Revit.UI;
using Team27.Minuta.Core;

namespace Team27.Minuta.Revit;

internal static class Dialogs
{
    private const string Title = "Minuta de cambios";
    private const int MaxLines = 8;

    private static readonly (TaskDialogCommandLinkId Id, TaskDialogResult Result)[] Links =
    [
        (TaskDialogCommandLinkId.CommandLink1, TaskDialogResult.CommandLink1),
        (TaskDialogCommandLinkId.CommandLink2, TaskDialogResult.CommandLink2),
        (TaskDialogCommandLinkId.CommandLink3, TaskDialogResult.CommandLink3),
        (TaskDialogCommandLinkId.CommandLink4, TaskDialogResult.CommandLink4),
    ];

    public static void ShowResult(App app, DispatchResult result)
    {
        var minute = result.Item.Minute;
        var heading = MinuteText.Heading(minute);
        switch (result.Outcome)
        {
            case SendOutcome.Sent sent when app.Settings.ShowResult:
                ShowSent(app, minute, sent.Receipt);
                break;
            case SendOutcome.AlreadyRegistered when app.Settings.ShowResult:
                Show($"{heading} ya estaba en la obra", "La API ya tenía esta revisión del modelo, así que no la volvimos a registrar.");
                break;
            case SendOutcome.Rejected rejected:
                Show(
                    $"La obra rechazó {Lower(heading)}",
                    Join(rejected.Message, IgnoredLines(app.Catalog, rejected.Ignored), Changes(app.Catalog, minute)),
                    $"Quedó en {app.Outbox.RejectedPath}");
                break;
            case SendOutcome.Failed failed:
                Show(
                    $"No pudimos enviar {Lower(heading)}",
                    Join(Capitalize(failed.Reason) + ".", "Queda pendiente: se reintenta en el próximo guardado o con «Enviar pendientes»."),
                    $"Minutas pendientes en {app.Outbox.PendingPath}");
                break;
        }
    }

    public static bool Confirm(App app, Minute minute)
    {
        var dialog = new TaskDialog(Title)
        {
            MainInstruction = $"¿Envías {Lower(MinuteText.Heading(minute))} a la obra?",
            MainContent = Changes(app.Catalog, minute),
            CommonButtons = TaskDialogCommonButtons.None,
        };
        dialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Enviar ahora", "La obra abre las propuestas y avisa a los afectados.");
        dialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Más tarde", "Queda pendiente hasta «Enviar pendientes» o el próximo guardado.");
        return dialog.Show() == TaskDialogResult.CommandLink1;
    }

    public static void ShowPreview(App app, Minute? minute)
    {
        if (minute is null)
        {
            Show("No hay cambios desde el último guardado", "Los elementos vinculados a la obra tienen los mismos valores que en el último guardado.", Pending(app));
            return;
        }
        Show(
            $"El próximo guardado envía {Count(minute.Changes.Count, "cambio", "cambios")}",
            Changes(app.Catalog, minute),
            Pending(app));
    }

    public static void ShowSettingsError(string error) =>
        Show("Revisa minuta.config.json", Join(error, "Mientras tanto usamos la configuración por defecto."));

    public static void Show(string instruction, string content, string? footer = null)
    {
        var dialog = new TaskDialog(Title)
        {
            MainInstruction = instruction,
            MainContent = content,
            CommonButtons = TaskDialogCommonButtons.Close,
        };
        if (footer is not null)
        {
            dialog.FooterText = footer;
        }
        dialog.Show();
    }

    public static bool Ask(string instruction, string content, string accept)
    {
        var dialog = new TaskDialog(Title)
        {
            MainInstruction = instruction,
            MainContent = content,
            CommonButtons = TaskDialogCommonButtons.Cancel,
        };
        dialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, accept);
        return dialog.Show() == TaskDialogResult.CommandLink1;
    }

    public static string Count(int count, string one, string many) => $"{count} {(count == 1 ? one : many)}";

    public static string People(IEnumerable<string> names)
    {
        var list = names.Where(name => !string.IsNullOrWhiteSpace(name)).ToList();
        return list.Count switch
        {
            0 => "nadie",
            1 => list[0],
            _ => string.Join(", ", list.Take(list.Count - 1)) + " y " + list[^1],
        };
    }

    private static void ShowSent(App app, Minute minute, Receipt receipt)
    {
        var lines = new List<string> { Changes(app.Catalog, minute) };
        if (!string.IsNullOrWhiteSpace(receipt.Summary))
        {
            lines.Add(receipt.Summary);
        }
        foreach (var proposal in receipt.Proposals)
        {
            var notified = proposal.Reviewers.Count == 0
                ? "no hay a quién avisar"
                : $"avisamos a {People(proposal.Reviewers.Select(reviewer => reviewer.Name))}";
            lines.Add($"{proposal.Title}\n{MinuteText.Cost(proposal.CostDelta)} · {MinuteText.Delay(proposal.DelayDays)} · {notified}");
        }
        var ignored = IgnoredLines(app.Catalog, receipt.Ignored);
        if (ignored.Length > 0)
        {
            lines.Add(ignored);
        }
        var dialog = new TaskDialog(Title)
        {
            MainInstruction = $"{MinuteText.Heading(minute)} llegó a la obra",
            MainContent = string.Join("\n\n", lines),
            CommonButtons = TaskDialogCommonButtons.Close,
        };
        var targets = new Dictionary<TaskDialogResult, string>();
        var linked = receipt.Proposals.Where(proposal => !string.IsNullOrEmpty(proposal.Link)).Take(Links.Length).ToList();
        for (var index = 0; index < linked.Count; index++)
        {
            var url = app.Settings.WebUrl.TrimEnd('/') + linked[index].Link;
            dialog.AddCommandLink(Links[index].Id, linked.Count == 1 ? "Abrir la propuesta en la sala" : $"Abrir «{linked[index].Title}»", url);
            targets[Links[index].Result] = url;
        }
        var choice = dialog.Show();
        if (targets.TryGetValue(choice, out var target))
        {
            Open(target, app.Log);
        }
    }

    private static string Changes(Catalog catalog, Minute minute) =>
        MinuteText.Truncate(MinuteText.Lines(catalog, minute), MaxLines);

    private static string IgnoredLines(Catalog catalog, IReadOnlyList<IgnoredChange> ignored)
    {
        if (ignored.Count == 0)
        {
            return "";
        }
        var lines = ignored
            .Select(item => $"{MinuteText.SubjectLabel(catalog, item.SubjectId)} · {MinuteText.AttributeLabel(catalog, item.Attribute)}: {item.Reason}")
            .ToList();
        return "No entraron:\n" + MinuteText.Truncate(lines, MaxLines);
    }

    private static string Pending(App app)
    {
        var pending = app.Dispatcher.PendingCount;
        return pending == 0 ? "No hay minutas pendientes de envío." : $"{Count(pending, "minuta pendiente", "minutas pendientes")} de envío.";
    }

    private static string Join(params string[] parts) =>
        string.Join("\n\n", parts.Where(part => !string.IsNullOrWhiteSpace(part)));

    private static string Lower(string text) => text.Length == 0 ? text : char.ToLowerInvariant(text[0]) + text[1..];

    private static string Capitalize(string text) => text.Length == 0 ? text : char.ToUpperInvariant(text[0]) + text[1..];

    private static void Open(string url, Log log)
    {
        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            log.Error($"No pudimos abrir {url}", ex);
        }
    }
}
