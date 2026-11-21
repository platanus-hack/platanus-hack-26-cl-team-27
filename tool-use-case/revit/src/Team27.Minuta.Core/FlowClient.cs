using System.Net;
using System.Text;
using System.Text.Json;

namespace Team27.Minuta.Core;

public abstract record FlowSendOutcome
{
    public sealed record Sent : FlowSendOutcome;

    public sealed record Rejected(string Code, string Message) : FlowSendOutcome;

    public sealed record Failed(string Reason) : FlowSendOutcome;
}

public interface IFlowApi
{
    Task<FlowSendOutcome> PostMinuteAsync(FlowMinute minute, string seat, CancellationToken cancellationToken = default);

    Task<FlowState?> GetStateAsync(string seat, CancellationToken cancellationToken = default);
}

public sealed class FlowClient : IFlowApi
{
    public const string MinutesRoute = "/flow/minutes";
    public const string StateRoute = "/flow";

    private readonly HttpClient http;
    private readonly Settings settings;

    public FlowClient(HttpClient http, Settings settings)
    {
        this.http = http;
        this.settings = settings;
    }

    public async Task<FlowSendOutcome> PostMinuteAsync(FlowMinute minute, string seat, CancellationToken cancellationToken = default)
    {
        using var request = Build(HttpMethod.Post, MinutesRoute, seat);
        request.Content = new StringContent(FlowJson.Serialize(minute), Encoding.UTF8, "application/json");
        request.Headers.TryAddWithoutValidation("x-action-id", minute.MinuteId);
        using var timeout = Timeout(cancellationToken);
        try
        {
            using var response = await http.SendAsync(request, timeout.Token).ConfigureAwait(false);
            var body = await response.Content.ReadAsStringAsync(timeout.Token).ConfigureAwait(false);
            return Interpret(response.StatusCode, body);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new FlowSendOutcome.Failed($"la API no respondió en {settings.TimeoutSeconds} s ({settings.ApiUrl})");
        }
        catch (HttpRequestException)
        {
            return new FlowSendOutcome.Failed($"no pudimos conectar con la API en {settings.ApiUrl}");
        }
    }

    public async Task<FlowState?> GetStateAsync(string seat, CancellationToken cancellationToken = default)
    {
        using var request = Build(HttpMethod.Get, StateRoute, seat);
        using var timeout = Timeout(cancellationToken);
        try
        {
            using var response = await http.SendAsync(request, timeout.Token).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }
            var body = await response.Content.ReadAsStringAsync(timeout.Token).ConfigureAwait(false);
            return FlowStateParser.Parse(body);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return null;
        }
        catch (HttpRequestException)
        {
            return null;
        }
    }

    private HttpRequestMessage Build(HttpMethod method, string route, string seat)
    {
        var request = new HttpRequestMessage(method, settings.ApiUrl.TrimEnd('/') + route);
        if (!string.IsNullOrEmpty(settings.PresenterKey))
        {
            request.Headers.TryAddWithoutValidation("x-presenter-key", settings.PresenterKey);
        }
        request.Headers.TryAddWithoutValidation("x-act-as", seat);
        return request;
    }

    private CancellationTokenSource Timeout(CancellationToken cancellationToken)
    {
        var source = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        source.CancelAfter(TimeSpan.FromSeconds(settings.TimeoutSeconds));
        return source;
    }

    private static FlowSendOutcome Interpret(HttpStatusCode status, string body)
    {
        var code = (int)status;
        if (code is >= 200 and < 300)
        {
            return new FlowSendOutcome.Sent();
        }
        switch (code)
        {
            case 401:
                return new FlowSendOutcome.Failed("la API no reconoce la clave del presentador: revisa presenterKey en minuta.config.json");
            case 404:
                return new FlowSendOutcome.Failed("la API no tiene la ruta del flujo: actualiza la API o revisa apiUrl en minuta.config.json");
            case 408 or 429 or >= 500:
                return new FlowSendOutcome.Failed($"la API respondió {code}; se reintenta");
        }
        var (errorCode, message) = ReadError(body);
        var fallback = code switch
        {
            403 => "El asiento configurado para este modelo no es el dueño del elemento que moviste.",
            409 => "Ya hay un cambio del caso abierto: reinicia el caso desde la sala.",
            _ => $"La API rechazó la minuta ({code}).",
        };
        return new FlowSendOutcome.Rejected(errorCode ?? $"http_{code}", string.IsNullOrWhiteSpace(message) ? fallback : message);
    }

    private static (string? Code, string? Message) ReadError(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return (null, null);
            }
            var code = ReceiptParser.NullableText(root, "code");
            var message = ReceiptParser.NullableText(root, "message");
            if (message is null && root.TryGetProperty("message", out var list) && list.ValueKind == JsonValueKind.Array)
            {
                message = string.Join("; ", list.EnumerateArray().Select(m => m.ToString()));
            }
            return (code, message);
        }
        catch (JsonException)
        {
            return (null, null);
        }
    }
}

public sealed record FlowDispatch(FlowMinute Minute, string Seat, FlowSendOutcome Outcome);

public sealed class FlowDispatcher
{
    private readonly IFlowApi api;
    private readonly Action<FlowDispatch> report;
    private readonly Log log;
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly List<(FlowMinute Minute, string Seat)> pending = [];

    public FlowDispatcher(IFlowApi api, Action<FlowDispatch> report, Log log)
    {
        this.api = api;
        this.report = report;
        this.log = log;
    }

    public int PendingCount
    {
        get
        {
            lock (pending)
            {
                return pending.Count;
            }
        }
    }

    public async Task SubmitAsync(FlowMinute minute, string seat)
    {
        lock (pending)
        {
            if (!pending.Any(p => p.Minute.MinuteId == minute.MinuteId))
            {
                pending.Add((minute, seat));
            }
        }
        await FlushAsync().ConfigureAwait(false);
    }

    public async Task FlushAsync()
    {
        if (!await gate.WaitAsync(0).ConfigureAwait(false))
        {
            return;
        }
        try
        {
            while (true)
            {
                (FlowMinute Minute, string Seat) next;
                lock (pending)
                {
                    if (pending.Count == 0)
                    {
                        return;
                    }
                    next = pending[0];
                }
                var outcome = await api.PostMinuteAsync(next.Minute, next.Seat).ConfigureAwait(false);
                if (outcome is FlowSendOutcome.Failed failed)
                {
                    log.Error($"Minuta del flujo {next.Minute.MinuteId} pendiente: {failed.Reason}");
                    return;
                }
                lock (pending)
                {
                    pending.RemoveAt(0);
                }
                report(new FlowDispatch(next.Minute, next.Seat, outcome));
            }
        }
        finally
        {
            gate.Release();
        }
    }
}
