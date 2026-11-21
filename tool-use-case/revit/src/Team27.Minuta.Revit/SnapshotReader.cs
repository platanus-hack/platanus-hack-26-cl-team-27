using Autodesk.Revit.DB;
using Team27.Minuta.Core;
using Settings = Team27.Minuta.Core.Settings;

namespace Team27.Minuta.Revit;

internal sealed class SnapshotReader
{
    private static readonly BuiltInParameter[] ThicknessParameters =
    [
        BuiltInParameter.FLOOR_ATTR_THICKNESS_PARAM,
        BuiltInParameter.ROOF_ATTR_THICKNESS_PARAM,
    ];

    private static readonly BuiltInParameter[] WidthParameters =
    [
        BuiltInParameter.WINDOW_WIDTH,
        BuiltInParameter.DOOR_WIDTH,
        BuiltInParameter.FAMILY_WIDTH_PARAM,
    ];

    private static readonly BuiltInParameter[] HeightParameters =
    [
        BuiltInParameter.WINDOW_HEIGHT,
        BuiltInParameter.DOOR_HEIGHT,
        BuiltInParameter.FAMILY_HEIGHT_PARAM,
    ];

    private static readonly string[] ThicknessNames = ["Espesor", "Grosor", "Thickness"];
    private static readonly string[] WidthNames = ["Ancho", "Anchura", "Width"];
    private static readonly string[] HeightNames = ["Alto", "Altura", "Height"];
    private static readonly string[] PositionNames = ["Distancia eje A", "Distancia al eje A", "Posición", "Posicion"];

    private readonly Settings settings;
    private readonly Catalog catalog;
    private readonly IReadOnlyList<BuiltInCategory> categories;
    private readonly Log log;

    public SnapshotReader(Settings settings, Catalog catalog, IReadOnlyList<BuiltInCategory> categories, Log log)
    {
        this.settings = settings;
        this.catalog = catalog;
        this.categories = categories;
        this.log = log;
    }

    public ModelSnapshot Read(Document document)
    {
        if (categories.Count == 0)
        {
            return ModelSnapshot.Empty;
        }
        var groups = new Dictionary<string, List<Element>>(StringComparer.Ordinal);
        using (var collector = new FilteredElementCollector(document)
                   .WherePasses(new ElementMulticategoryFilter(categories.ToList()))
                   .WhereElementIsNotElementType())
        {
            foreach (var element in collector)
            {
                var key = SubjectParameter.Read(element, settings.SubjectParameter);
                if (key is null)
                {
                    continue;
                }
                if (!groups.TryGetValue(key, out var members))
                {
                    members = [];
                    groups[key] = members;
                }
                members.Add(element);
            }
        }
        var grid = FindGrid(document, settings.GridName);
        var subjects = new Dictionary<string, SubjectSnapshot>(StringComparer.Ordinal);
        foreach (var (key, members) in groups)
        {
            subjects[key] = ReadSubject(document, members, grid);
        }
        return new ModelSnapshot(subjects);
    }

    private SubjectSnapshot ReadSubject(Document document, List<Element> members, Line? grid)
    {
        var samples = new Dictionary<string, List<(long Id, double Value)>>(StringComparer.Ordinal);
        foreach (var element in members)
        {
            foreach (var (attribute, value) in ReadValues(document, element, grid))
            {
                if (!samples.TryGetValue(attribute, out var list))
                {
                    list = [];
                    samples[attribute] = list;
                }
                list.Add((element.Id.Value, catalog.Round(attribute, value)));
            }
        }
        var values = new Dictionary<string, double>(StringComparer.Ordinal);
        foreach (var (attribute, list) in samples)
        {
            values[attribute] = MostFrequent(list);
        }
        var countable = members.Count(element => RevitCategories.IsCountable(RevitCategories.Of(element)));
        if (countable > 0)
        {
            values["cantidad"] = countable;
        }
        var infos = members
            .Select(element => Info(document, element))
            .OrderBy(info => info.Id)
            .ToList();
        return new SubjectSnapshot(values, infos);
    }

    private IEnumerable<(string Attribute, double Value)> ReadValues(Document document, Element element, Line? grid)
    {
        var category = RevitCategories.Of(element);
        var type = document.GetElement(element.GetTypeId());

        var thickness = BuiltIn(element, type, ThicknessParameters, UnitTypeId.Centimeters)
            ?? Named(element, type, ThicknessNames, UnitTypeId.Centimeters);
        if (thickness is { } t)
        {
            yield return ("espesor_cm", t);
        }

        var width = BuiltIn(element, type, WidthParameters, UnitTypeId.Centimeters)
            ?? Named(element, type, WidthNames, UnitTypeId.Centimeters)
            ?? (category == BuiltInCategory.OST_ShaftOpening ? PlanWidth(element) : null);
        if (width is { } w)
        {
            yield return ("ancho_cm", w);
        }

        var height = BuiltIn(element, type, HeightParameters, UnitTypeId.Centimeters)
            ?? Named(element, type, HeightNames, UnitTypeId.Centimeters);
        if (height is { } h)
        {
            yield return ("alto_cm", h);
        }

        var position = Named(element, type, PositionNames, UnitTypeId.Meters)
            ?? (RevitCategories.MeasuresFromGrid(category) && grid is not null ? DistanceToGrid(element, grid) : null);
        if (position is { } p)
        {
            yield return ("posicion_m", p);
        }
    }

    private static double? BuiltIn(Element element, Element? type, BuiltInParameter[] parameters, ForgeTypeId unit)
    {
        foreach (var parameter in parameters)
        {
            var value = Number(element.get_Parameter(parameter), unit) ?? Number(type?.get_Parameter(parameter), unit);
            if (value is not null)
            {
                return value;
            }
        }
        return null;
    }

    private static double? Named(Element element, Element? type, string[] names, ForgeTypeId unit)
    {
        foreach (var name in names)
        {
            var value = Number(element.LookupParameter(name), unit) ?? Number(type?.LookupParameter(name), unit);
            if (value is not null)
            {
                return value;
            }
        }
        return null;
    }

    private static double? Number(Parameter? parameter, ForgeTypeId unit)
    {
        if (parameter is null || !parameter.HasValue)
        {
            return null;
        }
        switch (parameter.StorageType)
        {
            case StorageType.Double:
                var raw = parameter.AsDouble();
                return parameter.Definition?.GetDataType() == SpecTypeId.Length
                    ? UnitUtils.ConvertFromInternalUnits(raw, unit)
                    : raw;
            case StorageType.Integer:
                return parameter.AsInteger();
            default:
                return null;
        }
    }

    private static double? PlanWidth(Element element)
    {
        var box = element.get_BoundingBox(null);
        if (box is null)
        {
            return null;
        }
        var narrow = Math.Min(box.Max.X - box.Min.X, box.Max.Y - box.Min.Y);
        return narrow > 0 ? UnitUtils.ConvertFromInternalUnits(narrow, UnitTypeId.Centimeters) : null;
    }

    private static double? DistanceToGrid(Element element, Line grid)
    {
        var point = ReferencePoint(element);
        if (point is null)
        {
            return null;
        }
        var origin = grid.GetEndPoint(0);
        var end = grid.GetEndPoint(1);
        var dx = end.X - origin.X;
        var dy = end.Y - origin.Y;
        var length = Math.Sqrt(dx * dx + dy * dy);
        if (length < 1e-9)
        {
            return null;
        }
        var cross = Math.Abs(dx * (point.Y - origin.Y) - dy * (point.X - origin.X)) / length;
        return UnitUtils.ConvertFromInternalUnits(cross, UnitTypeId.Meters);
    }

    private static XYZ? ReferencePoint(Element element)
    {
        switch (element.Location)
        {
            case LocationPoint located:
                return located.Point;
            case LocationCurve curve:
                return curve.Curve.Evaluate(0.5, true);
        }
        var box = element.get_BoundingBox(null);
        return box is null ? null : (box.Min + box.Max) * 0.5;
    }

    private Line? FindGrid(Document document, string name)
    {
        using var collector = new FilteredElementCollector(document).OfClass(typeof(Grid));
        foreach (var grid in collector.Cast<Grid>())
        {
            if (!string.Equals(grid.Name?.Trim(), name.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            if (grid.Curve is Line line)
            {
                return line;
            }
            log.Info($"El eje «{name}» es curvo: la distancia al eje solo se mide contra ejes rectos");
            return null;
        }
        return null;
    }

    private static double MostFrequent(List<(long Id, double Value)> samples) =>
        samples
            .GroupBy(sample => sample.Value)
            .OrderByDescending(group => group.Count())
            .ThenBy(group => group.Min(sample => sample.Id))
            .First()
            .Key;

    private static ElementInfo Info(Document document, Element element)
    {
        string? level = null;
        if (element.LevelId != ElementId.InvalidElementId && document.GetElement(element.LevelId) is Level found)
        {
            level = found.Name;
        }
        return new ElementInfo(element.Id.Value, element.UniqueId, element.Category?.Name, element.Name, level);
    }
}
