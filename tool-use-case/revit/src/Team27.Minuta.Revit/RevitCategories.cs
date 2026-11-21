using Autodesk.Revit.DB;
using Team27.Minuta.Core;

namespace Team27.Minuta.Revit;

internal static class RevitCategories
{
    public static IReadOnlyList<BuiltInCategory> Parse(IEnumerable<string> names, Log log)
    {
        var result = new List<BuiltInCategory>();
        foreach (var name in names)
        {
            if (!Enum.TryParse<BuiltInCategory>(name, ignoreCase: true, out var category) || !Enum.IsDefined(category))
            {
                log.Error($"La categoría «{name}» de minuta.config.json no existe en esta versión de Revit");
                continue;
            }
            if (!result.Contains(category))
            {
                result.Add(category);
            }
        }
        return result;
    }

    public static BuiltInCategory? Of(Element element)
    {
        var category = element.Category?.BuiltInCategory;
        return category is null or BuiltInCategory.INVALID ? null : category;
    }

    public static bool IsCountable(BuiltInCategory? category) =>
        category is BuiltInCategory.OST_Windows or BuiltInCategory.OST_Doors;

    public static bool MeasuresFromGrid(BuiltInCategory? category) =>
        category is BuiltInCategory.OST_ShaftOpening or BuiltInCategory.OST_GenericModel;
}
