using Autodesk.Revit.DB;
using Team27.Minuta.Core;

namespace Team27.Minuta.Revit;

internal static class ColumnReader
{
    public static ColumnSnapshot Read(Document document)
    {
        var positions = new List<ColumnPosition>();
        using var collector = new FilteredElementCollector(document);
        foreach (var element in collector.OfCategory(BuiltInCategory.OST_StructuralColumns).WhereElementIsNotElementType())
        {
            var mark = element.get_Parameter(BuiltInParameter.ALL_MODEL_MARK)?.AsString();
            if (string.IsNullOrWhiteSpace(mark) || element.Location is not LocationPoint location)
            {
                continue;
            }
            var point = location.Point;
            positions.Add(new ColumnPosition(mark, element.Id.Value, point.X, point.Y, point.Z));
        }
        return ColumnSnapshot.From(positions);
    }

    public static IReadOnlyList<Element> FindByMark(Document document, string mark)
    {
        var rule = ParameterFilterRuleFactory.CreateEqualsRule(new ElementId(BuiltInParameter.ALL_MODEL_MARK), mark);
        using var collector = new FilteredElementCollector(document);
        return collector
            .WherePasses(new ElementParameterFilter(rule))
            .WhereElementIsNotElementType()
            .ToList();
    }
}
