using Autodesk.Revit.DB;
using Team27.Minuta.Core;

namespace Team27.Minuta.Revit;

internal sealed class ChangeTracker
{
    private const int MaxOperations = 20;

    private sealed class DocumentState
    {
        public DocumentState(ModelSnapshot baseline)
        {
            Baseline = baseline;
        }

        public ModelSnapshot Baseline { get; set; }

        public List<string> Operations { get; } = [];
    }

    private readonly Dictionary<Document, DocumentState> states = new();
    private readonly SnapshotReader reader;
    private readonly MinuteBuilder builder;
    private readonly string revitVersion;
    private readonly AddinInfo addin;

    public ChangeTracker(SnapshotReader reader, MinuteBuilder builder, string revitVersion, AddinInfo addin)
    {
        this.reader = reader;
        this.builder = builder;
        this.revitVersion = revitVersion;
        this.addin = addin;
    }

    public static bool IsTracked(Document document) => !document.IsFamilyDocument && !document.IsLinked;

    public void Start(Document document)
    {
        if (IsTracked(document))
        {
            states[document] = new DocumentState(reader.Read(document));
        }
    }

    public void Record(Document document, IEnumerable<string> transactionNames)
    {
        if (!states.TryGetValue(document, out var state))
        {
            return;
        }
        foreach (var name in transactionNames)
        {
            if (state.Operations.Count >= MaxOperations)
            {
                return;
            }
            if (!string.IsNullOrWhiteSpace(name) && !state.Operations.Contains(name))
            {
                state.Operations.Add(name.Trim());
            }
        }
    }

    public void Forget(Document document) => states.Remove(document);

    public ModelSnapshot Read(Document document) => reader.Read(document);

    public Minute? Preview(Document document)
    {
        var current = reader.Read(document);
        if (!states.TryGetValue(document, out var state))
        {
            return null;
        }
        return builder.Build(state.Baseline, current, Context(document, MinuteTrigger.Save, null, null, state.Operations));
    }

    public Minute? TakeMinute(Document document, string trigger)
    {
        var current = reader.Read(document);
        if (!states.TryGetValue(document, out var state))
        {
            states[document] = new DocumentState(current);
            return null;
        }
        var (saveNumber, versionGuid) = VersionOf(document);
        var minute = builder.Build(state.Baseline, current, Context(document, trigger, saveNumber, versionGuid, state.Operations));
        state.Baseline = current;
        state.Operations.Clear();
        return minute;
    }

    public Minute? FullState(Document document) =>
        builder.Build(ModelSnapshot.Empty, reader.Read(document), Context(document, MinuteTrigger.Manual, null, null, []));

    private MinuteContext Context(
        Document document,
        string trigger,
        int? saveNumber,
        string? versionGuid,
        IReadOnlyList<string> operations) =>
        new(
            Guid.NewGuid().ToString(),
            trigger,
            DateTimeOffset.UtcNow,
            TitleOf(document),
            saveNumber,
            versionGuid,
            revitVersion,
            addin,
            operations.ToList());

    private static string TitleOf(Document document)
    {
        var title = document.Title ?? "";
        return title.EndsWith(".rvt", StringComparison.OrdinalIgnoreCase) ? title[..^4] : title;
    }

    private static (int? SaveNumber, string? VersionGuid) VersionOf(Document document)
    {
        try
        {
            using var version = Document.GetDocumentVersion(document);
            return version is null ? (null, null) : (version.NumberOfSaves, version.VersionGUID.ToString());
        }
        catch (Exception)
        {
            return (null, null);
        }
    }
}
