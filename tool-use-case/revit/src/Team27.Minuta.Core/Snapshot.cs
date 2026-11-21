namespace Team27.Minuta.Core;

public sealed record ElementInfo(long Id, string UniqueId, string? Category, string? Name, string? Level);

public sealed class SubjectSnapshot
{
    public SubjectSnapshot(IReadOnlyDictionary<string, double> values, IReadOnlyList<ElementInfo> elements)
    {
        Values = values;
        Elements = elements;
    }

    public IReadOnlyDictionary<string, double> Values { get; }

    public IReadOnlyList<ElementInfo> Elements { get; }
}

public sealed class ModelSnapshot
{
    public static readonly ModelSnapshot Empty = new(new Dictionary<string, SubjectSnapshot>());

    public ModelSnapshot(IReadOnlyDictionary<string, SubjectSnapshot> subjects)
    {
        Subjects = subjects;
    }

    public IReadOnlyDictionary<string, SubjectSnapshot> Subjects { get; }

    public int ValueCount => Subjects.Values.Sum(s => s.Values.Count);
}
