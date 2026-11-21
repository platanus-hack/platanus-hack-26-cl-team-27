using System.Text.Json;

namespace Team27.Minuta.Core;

public sealed record FlowProposal(
    string Id,
    string ElementId,
    string Status,
    Delta Delta,
    string? DecidedBy,
    string? DecidedByName);

public sealed record FlowState(FlowProposal? Proposal);

public static class FlowStateParser
{
    public static FlowState? Parse(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return null;
            }
            if (!root.TryGetProperty("proposal", out var proposal) || proposal.ValueKind != JsonValueKind.Object)
            {
                return new FlowState(null);
            }
            var id = Text(proposal, "id");
            var elementId = Text(proposal, "elementId");
            var status = Text(proposal, "status");
            var delta = ReadDelta(proposal);
            if (id is null || elementId is null || status is null || delta is null)
            {
                return new FlowState(null);
            }
            return new FlowState(new FlowProposal(id, elementId, status, delta, Text(proposal, "decidedBy"), Text(proposal, "decidedByName")));
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? Text(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString())
            ? value.GetString()
            : null;

    private static Delta? ReadDelta(JsonElement proposal)
    {
        if (!proposal.TryGetProperty("delta", out var delta) || delta.ValueKind != JsonValueKind.Object)
        {
            return null;
        }
        return new Delta(Number(delta, "dx"), Number(delta, "dy"), Number(delta, "dz"));
    }

    private static double Number(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number ? value.GetDouble() : 0;
}
