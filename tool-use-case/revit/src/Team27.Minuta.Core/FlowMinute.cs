using System.Text.Json;
using System.Text.Json.Serialization;

namespace Team27.Minuta.Core;

public sealed record FlowModel(string Title, string Discipline);

public sealed record FlowMinute(
    string MinuteId,
    string Source,
    FlowModel Model,
    IReadOnlyList<FlowChange> Changes)
{
    public const string RevitSource = "revit";
    public const string DefaultReason = "Cambio de ubicación hecho en Revit";

    public static FlowMinute? Create(string minuteId, string title, string discipline, IReadOnlyList<FlowChange> changes)
    {
        if (changes.Count == 0)
        {
            return null;
        }
        var clean = string.IsNullOrWhiteSpace(title) ? "Modelo sin título" : title.Trim();
        var complete = changes
            .Select(c => string.IsNullOrWhiteSpace(c.Reason) ? c with { Reason = DefaultReason } : c)
            .ToList();
        return new FlowMinute(minuteId, RevitSource, new FlowModel(clean, discipline), complete);
    }
}

public static class FlowJson
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static string Serialize(FlowMinute minute) => JsonSerializer.Serialize(minute, Options);

    public static FlowMinute? Deserialize(string json) => JsonSerializer.Deserialize<FlowMinute>(json, Options);
}
