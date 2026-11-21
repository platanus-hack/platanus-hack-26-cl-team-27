namespace Team27.Minuta.Core;

public sealed class AppliedLedger
{
    private readonly object gate = new();
    private readonly Dictionary<string, HashSet<string>> byDocument = new(StringComparer.Ordinal);

    public bool Contains(string documentKey, string proposalId)
    {
        lock (gate)
        {
            return byDocument.TryGetValue(documentKey, out var set) && set.Contains(proposalId);
        }
    }

    public void Add(string documentKey, string proposalId)
    {
        lock (gate)
        {
            if (!byDocument.TryGetValue(documentKey, out var set))
            {
                set = new HashSet<string>(StringComparer.Ordinal);
                byDocument[documentKey] = set;
            }
            set.Add(proposalId);
        }
    }

    public void Forget(string documentKey)
    {
        lock (gate)
        {
            byDocument.Remove(documentKey);
        }
    }
}

public static class FlowPlanner
{
    public static readonly IReadOnlySet<string> ApplicableStatuses =
        new HashSet<string>(StringComparer.Ordinal) { "aceptada", "aplicada", "resuelta" };

    public static bool ShouldApply(FlowProposal? proposal, string documentKey, AppliedLedger ledger) =>
        proposal is not null
        && ApplicableStatuses.Contains(proposal.Status)
        && !proposal.Delta.IsZero
        && !ledger.Contains(documentKey, proposal.Id);

    public static Delta ToFeet(Delta meters) =>
        new(Units.MetersToFeet(meters.Dx), Units.MetersToFeet(meters.Dy), Units.MetersToFeet(meters.Dz));

    public static string Notice(FlowProposal proposal) =>
        string.IsNullOrWhiteSpace(proposal.DecidedByName)
            ? "Vigente aplicó la propuesta aceptada"
            : $"Vigente aplicó la propuesta aceptada por {proposal.DecidedByName}";
}
