namespace Team27.Minuta.Core;

public sealed record MinuteContext(
    string MinuteId,
    string Trigger,
    DateTimeOffset CreatedAt,
    string ModelTitle,
    int? SaveNumber,
    string? VersionGuid,
    string? RevitVersion,
    AddinInfo Addin,
    IReadOnlyList<string> Operations);

public sealed class MinuteBuilder
{
    public const int MaxChanges = 200;
    public const int MaxElements = 500;
    public const int MaxOperations = 100;
    public const int MaxTitle = 200;

    private readonly Catalog catalog;

    public MinuteBuilder(Catalog catalog)
    {
        this.catalog = catalog;
    }

    public Minute? Build(ModelSnapshot before, ModelSnapshot after, MinuteContext context)
    {
        var changes = new List<Change>();
        var subjectIds = catalog.OrderSubjects(before.Subjects.Keys.Concat(after.Subjects.Keys));
        foreach (var subjectId in subjectIds)
        {
            before.Subjects.TryGetValue(subjectId, out var beforeSubject);
            after.Subjects.TryGetValue(subjectId, out var afterSubject);
            var attributeIds = catalog.OrderAttributes(
                (beforeSubject?.Values.Keys ?? Enumerable.Empty<string>())
                .Concat(afterSubject?.Values.Keys ?? Enumerable.Empty<string>()));
            foreach (var attribute in attributeIds)
            {
                double? previous = beforeSubject is not null && beforeSubject.Values.TryGetValue(attribute, out var b)
                    ? catalog.Round(attribute, b)
                    : null;
                double? current = afterSubject is not null && afterSubject.Values.TryGetValue(attribute, out var a)
                    ? catalog.Round(attribute, a)
                    : null;
                if (previous == current)
                {
                    continue;
                }
                var side = current is not null ? afterSubject : beforeSubject;
                var elements = (side?.Elements ?? [])
                    .OrderBy(e => e.Id)
                    .Take(MaxElements)
                    .ToList();
                changes.Add(new Change(subjectId, attribute, previous, current, catalog.Unit(attribute), elements));
            }
        }
        if (changes.Count == 0)
        {
            return null;
        }
        var title = string.IsNullOrWhiteSpace(context.ModelTitle) ? "Modelo sin título" : context.ModelTitle.Trim();
        if (title.Length > MaxTitle)
        {
            title = title[..MaxTitle];
        }
        return new Minute(
            context.MinuteId,
            context.Trigger,
            context.CreatedAt,
            new ModelInfo(title, context.SaveNumber, context.VersionGuid, context.RevitVersion),
            context.Addin,
            changes.Take(MaxChanges).ToList(),
            context.Operations.Take(MaxOperations).ToList());
    }
}
