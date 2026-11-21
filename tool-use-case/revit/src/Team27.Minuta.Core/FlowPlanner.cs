namespace Team27.Minuta.Core;

public sealed class AppliedLedger
{
    private readonly object gate = new();
    private readonly Dictionary<string, HashSet<string>> byDocument = new(StringComparer.Ordinal);
    private readonly string? path;

    public AppliedLedger(string? path = null)
    {
        this.path = path;
        if (path is null || !File.Exists(path))
        {
            return;
        }
        try
        {
            foreach (var line in File.ReadAllLines(path))
            {
                var parts = line.Split('\t');
                if (parts.Length == 2 && parts[0].Length > 0 && parts[1].Length > 0)
                {
                    Insert(parts[0], parts[1]);
                }
            }
        }
        catch (IOException)
        {
        }
    }

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
            if (!Insert(documentKey, proposalId) || path is null)
            {
                return;
            }
            try
            {
                var directory = Path.GetDirectoryName(path);
                if (!string.IsNullOrEmpty(directory))
                {
                    Directory.CreateDirectory(directory);
                }
                File.AppendAllText(path, $"{documentKey}\t{proposalId}{Environment.NewLine}");
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
        }
    }

    private bool Insert(string documentKey, string proposalId)
    {
        if (!byDocument.TryGetValue(documentKey, out var set))
        {
            set = new HashSet<string>(StringComparer.Ordinal);
            byDocument[documentKey] = set;
        }
        return set.Add(proposalId);
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
