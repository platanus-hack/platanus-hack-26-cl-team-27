using System.Net;
using System.Text;
using System.Text.Json;

namespace Team27.Minuta.Core;

public sealed class MinuteClient : IMinuteSender
{
    public const string Route = "/integrations/revit/minutes";

    private readonly HttpClient http;
    private readonly Settings settings;

    public MinuteClient(HttpClient http, Settings settings)
    {
        this.http = http;
        this.settings = settings;
    }

    public async Task<SendOutcome> SendAsync(Minute minute, CancellationToken cancellationToken = default)
    {
        var url = settings.ApiUrl.TrimEnd('/') + Route;
        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(MinuteJson.Serialize(minute), Encoding.UTF8, "application/json"),
        };
        if (!string.IsNullOrEmpty(settings.PresenterKey))
        {
            request.Headers.TryAddWithoutValidation("x-presenter-key", settings.PresenterKey);
        }
        request.Headers.TryAddWithoutValidation("x-action-id", minute.MinuteId);

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(settings.TimeoutSeconds));
        try
        {
            using var response = await http.SendAsync(request, timeout.Token).ConfigureAwait(false);
            var body = await response.Content.ReadAsStringAsync(timeout.Token).ConfigureAwait(false);
            return Interpret(response.StatusCode, body);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new SendOutcome.Failed($"la API no respondió en {settings.TimeoutSeconds} s ({settings.ApiUrl})");
        }
        catch (HttpRequestException)
        {
            return new SendOutcome.Failed($"no pudimos conectar con la API en {settings.ApiUrl}");
        }
    }

    private static SendOutcome Interpret(HttpStatusCode status, string body)
    {
        var code = (int)status;
        if (code is >= 200 and < 300)
        {
            return new SendOutcome.Sent(ReceiptParser.Parse(body));
        }
        var error = ReadError(body);
        if (status == HttpStatusCode.Conflict && error.Code == "already_ingested")
        {
            return new SendOutcome.AlreadyRegistered();
        }
        switch (code)
        {
            case 401:
                return new SendOutcome.Failed("la API no reconoce la clave del presentador: revisa presenterKey en minuta.config.json");
            case 404:
                return new SendOutcome.Failed("la API no tiene la ruta de minutas: actualiza la API o revisa apiUrl en minuta.config.json");
            case 408:
                return new SendOutcome.Failed("la API tardó demasiado en responder");
            case 429:
                return new SendOutcome.Failed("la API pidió esperar: hay demasiadas solicitudes");
            case >= 500:
                return new SendOutcome.Failed($"la API respondió con un error {code}; se reintenta más tarde");
        }
        var message = string.IsNullOrWhiteSpace(error.Message) ? $"La API rechazó la minuta ({code})." : error.Message;
        return new SendOutcome.Rejected(error.Code ?? $"http_{code}", message, error.Ignored);
    }

    private static (string? Code, string? Message, IReadOnlyList<IgnoredChange> Ignored) ReadError(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return (null, null, []);
            }
            var code = ReceiptParser.NullableText(root, "code");
            var message = ReceiptParser.NullableText(root, "message");
            if (message is null
                && root.TryGetProperty("message", out var list)
                && list.ValueKind == JsonValueKind.Array)
            {
                message = string.Join("; ", list.EnumerateArray().Select(m => m.ToString()));
            }
            return (code, message, ReceiptParser.ReadIgnored(root, "ignored"));
        }
        catch (JsonException)
        {
            return (null, null, []);
        }
    }
}
