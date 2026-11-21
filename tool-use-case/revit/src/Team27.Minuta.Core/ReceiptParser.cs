using System.Text.Json;

namespace Team27.Minuta.Core;

public static class ReceiptParser
{
    public static Receipt Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Receipt.Empty;
        }
        try
        {
            using var document = JsonDocument.Parse(json, new JsonDocumentOptions { AllowTrailingCommas = true });
            return document.RootElement.ValueKind == JsonValueKind.Object ? Read(document.RootElement) : Receipt.Empty;
        }
        catch (JsonException)
        {
            return Receipt.Empty;
        }
    }

    private static Receipt Read(JsonElement root) => new(
        Text(root, "minuteId"),
        Text(root, "revisionId"),
        Text(root, "documentId"),
        Text(root, "label"),
        Text(root, "title"),
        List(root, "claims", c => new ReceiptClaim(Text(c, "subjectId"), Text(c, "attribute"), Number(c, "value"), Text(c, "outcome"))),
        List(root, "proposals", ReadProposal),
        List(root, "discrepancies", d => new ReceiptDiscrepancy(Text(d, "id"), Text(d, "ownerId"))),
        Strings(root, "backed"),
        List(root, "stale", s => new ReceiptStale(Text(s, "revisionId"), Text(s, "subjectId"), Text(s, "attribute"))),
        ReadIgnored(root, "ignored"),
        Text(root, "summary"));

    public static IReadOnlyList<IgnoredChange> ReadIgnored(JsonElement root, string name) =>
        List(root, name, i => new IgnoredChange(Text(i, "subjectId"), Text(i, "attribute"), Text(i, "reason")));

    private static ReceiptProposal ReadProposal(JsonElement p) => new(
        Text(p, "id"),
        Text(p, "changeId"),
        Text(p, "title"),
        Number(p, "costDelta") ?? 0,
        (int)(Number(p, "delayDays") ?? 0),
        List(p, "reviewers", r => new Reviewer(Text(r, "id"), Text(r, "name"))),
        List(p, "filtered", f => new FilteredStakeholder(Text(f, "stakeholderId"), Text(f, "name"), Text(f, "reason"))),
        NullableText(p, "link"));

    public static string Text(JsonElement element, string name) => NullableText(element, name) ?? "";

    public static string? NullableText(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static double? Number(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.Number
            ? value.GetDouble()
            : null;

    private static IReadOnlyList<string> Strings(JsonElement element, string name)
    {
        var result = new List<string>();
        if (element.TryGetProperty(name, out var array) && array.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in array.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                {
                    result.Add(item.GetString() ?? "");
                }
            }
        }
        return result;
    }

    private static IReadOnlyList<T> List<T>(JsonElement element, string name, Func<JsonElement, T> read)
    {
        var result = new List<T>();
        if (element.ValueKind == JsonValueKind.Object
            && element.TryGetProperty(name, out var array)
            && array.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in array.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Object)
                {
                    result.Add(read(item));
                }
            }
        }
        return result;
    }
}
