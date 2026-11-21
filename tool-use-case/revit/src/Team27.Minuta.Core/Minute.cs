namespace Team27.Minuta.Core;

public static class MinuteTrigger
{
    public const string Save = "save";
    public const string Sync = "sync";
    public const string Manual = "manual";
}

public sealed record ModelInfo(string Title, int? SaveNumber, string? VersionGuid, string? RevitVersion);

public sealed record AddinInfo(string Name, string Version);

public sealed record Change(
    string SubjectId,
    string Attribute,
    double? Before,
    double? After,
    string? Unit,
    IReadOnlyList<ElementInfo> Elements);

public sealed record Minute(
    string MinuteId,
    string Trigger,
    DateTimeOffset CreatedAt,
    ModelInfo Model,
    AddinInfo Addin,
    IReadOnlyList<Change> Changes,
    IReadOnlyList<string> Operations);
