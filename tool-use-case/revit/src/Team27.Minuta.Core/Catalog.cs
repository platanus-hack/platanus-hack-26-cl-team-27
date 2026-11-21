namespace Team27.Minuta.Core;

public sealed record SubjectInfo(string Id, string Name);

public sealed record AttributeInfo(string Id, string Name, string? Unit, int Decimals);

public sealed class Catalog
{
    public const int UnknownDecimals = 2;

    public static readonly IReadOnlyList<SubjectInfo> DefaultSubjects =
    [
        new("losa-n2", "Losa nivel 2"),
        new("losa-n3", "Losa nivel 3"),
        new("losa-n4", "Losa nivel 4"),
        new("losa-n5", "Losa nivel 5"),
        new("losa-cubierta", "Losa de cubierta"),
        new("shaft-s1", "Shaft de instalaciones S1"),
        new("ventanas-norte", "Ventanas fachada norte"),
    ];

    public static readonly IReadOnlyList<AttributeInfo> Attributes =
    [
        new("espesor_cm", "Espesor", "cm", 1),
        new("ancho_cm", "Ancho", "cm", 1),
        new("alto_cm", "Alto", "cm", 1),
        new("posicion_m", "Distancia al eje A", "m", 2),
        new("cantidad", "Cantidad", null, 0),
    ];

    public static readonly Catalog Default = new(null);

    private readonly Dictionary<string, int> subjectOrder;
    private readonly Dictionary<string, SubjectInfo> subjects;
    private readonly Dictionary<string, int> attributeOrder;
    private readonly Dictionary<string, AttributeInfo> attributes;

    public Catalog(IEnumerable<SubjectInfo>? subjectsOverride)
    {
        Subjects = (subjectsOverride?.ToList() is { Count: > 0 } custom ? custom : DefaultSubjects.ToList());
        subjects = new Dictionary<string, SubjectInfo>(StringComparer.Ordinal);
        subjectOrder = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var subject in Subjects)
        {
            if (subjects.TryAdd(subject.Id, subject))
            {
                subjectOrder[subject.Id] = subjectOrder.Count;
            }
        }
        attributes = Attributes.ToDictionary(a => a.Id, StringComparer.Ordinal);
        attributeOrder = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var attribute in Attributes)
        {
            attributeOrder[attribute.Id] = attributeOrder.Count;
        }
    }

    public IReadOnlyList<SubjectInfo> Subjects { get; }

    public bool IsKnownSubject(string subjectId) => subjects.ContainsKey(subjectId);

    public string? SubjectName(string subjectId) => subjects.TryGetValue(subjectId, out var s) ? s.Name : null;

    public AttributeInfo? Attribute(string attributeId) =>
        attributes.TryGetValue(attributeId, out var a) ? a : null;

    public int Decimals(string attributeId) => Attribute(attributeId)?.Decimals ?? UnknownDecimals;

    public string? Unit(string attributeId) => Attribute(attributeId)?.Unit;

    public double Round(string attributeId, double value)
    {
        var rounded = Math.Round(value, Decimals(attributeId), MidpointRounding.AwayFromZero);
        return rounded == 0 ? 0 : rounded;
    }

    public IEnumerable<string> OrderSubjects(IEnumerable<string> ids) =>
        ids.Distinct(StringComparer.Ordinal)
            .OrderBy(id => subjectOrder.TryGetValue(id, out var i) ? i : int.MaxValue)
            .ThenBy(id => id, StringComparer.Ordinal);

    public IEnumerable<string> OrderAttributes(IEnumerable<string> ids) =>
        ids.Distinct(StringComparer.Ordinal)
            .OrderBy(id => attributeOrder.TryGetValue(id, out var i) ? i : int.MaxValue)
            .ThenBy(id => id, StringComparer.Ordinal);
}
