namespace Team27.Minuta.Core;

public sealed record ReceiptClaim(string SubjectId, string Attribute, double? Value, string Outcome);

public sealed record Reviewer(string Id, string Name);

public sealed record FilteredStakeholder(string StakeholderId, string Name, string Reason);

public sealed record ReceiptProposal(
    string Id,
    string ChangeId,
    string Title,
    double CostDelta,
    int DelayDays,
    IReadOnlyList<Reviewer> Reviewers,
    IReadOnlyList<FilteredStakeholder> Filtered,
    string? Link);

public sealed record ReceiptDiscrepancy(string Id, string OwnerId);

public sealed record ReceiptStale(string RevisionId, string SubjectId, string Attribute);

public sealed record IgnoredChange(string SubjectId, string Attribute, string Reason);

public sealed record Receipt(
    string MinuteId,
    string RevisionId,
    string DocumentId,
    string Label,
    string Title,
    IReadOnlyList<ReceiptClaim> Claims,
    IReadOnlyList<ReceiptProposal> Proposals,
    IReadOnlyList<ReceiptDiscrepancy> Discrepancies,
    IReadOnlyList<string> Backed,
    IReadOnlyList<ReceiptStale> Stale,
    IReadOnlyList<IgnoredChange> Ignored,
    string Summary)
{
    public static readonly Receipt Empty = new("", "", "", "", "", [], [], [], [], [], [], "");
}
