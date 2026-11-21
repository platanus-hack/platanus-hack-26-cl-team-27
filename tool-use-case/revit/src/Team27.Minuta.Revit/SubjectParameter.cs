using System.IO;
using Autodesk.Revit.DB;

namespace Team27.Minuta.Revit;

internal static class SubjectParameter
{
    public static readonly Guid Id = new("8f3c2a71-4d6e-4b9a-9c2e-5a7d1f0b3e64");

    private const string GroupName = "Team 27";
    private const string Description = "Clave del elemento en la obra: losa-n3, shaft-s1, ventanas-norte…";

    public static string? Read(Element element, string name)
    {
        var parameter = Find(element, name);
        if (parameter is null || parameter.StorageType != StorageType.String)
        {
            return null;
        }
        var value = parameter.AsString();
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();
    }

    public static Parameter? Writable(Element element, string name)
    {
        var parameter = Find(element, name);
        return parameter is { IsReadOnly: false, StorageType: StorageType.String } ? parameter : null;
    }

    public static void EnsureBound(Document document, IEnumerable<BuiltInCategory> categories, string name)
    {
        var application = document.Application;
        var wanted = categories
            .Select(category => Category.GetCategory(document, category))
            .Where(category => category is { AllowsBoundParameters: true })
            .ToList();
        if (wanted.Count == 0)
        {
            return;
        }
        var (definition, binding) = FindBinding(document, name);
        if (definition is not null && binding is ElementBinding existing)
        {
            var set = existing.Categories;
            var missing = wanted.Where(category => !set.Contains(category)).ToList();
            if (missing.Count == 0)
            {
                return;
            }
            foreach (var category in missing)
            {
                set.Insert(category);
            }
            ElementBinding updated = existing is TypeBinding
                ? application.Create.NewTypeBinding(set)
                : application.Create.NewInstanceBinding(set);
            document.ParameterBindings.ReInsert(definition, updated, GroupTypeId.IdentityData);
            return;
        }
        var categorySet = application.Create.NewCategorySet();
        foreach (var category in wanted)
        {
            categorySet.Insert(category);
        }
        var original = application.SharedParametersFilename;
        var temporary = Path.Combine(Path.GetTempPath(), $"team27-minuta-{Guid.NewGuid():N}.txt");
        File.WriteAllText(temporary, string.Empty);
        try
        {
            application.SharedParametersFilename = temporary;
            var file = application.OpenSharedParameterFile()
                ?? throw new InvalidOperationException("Revit no pudo abrir el archivo temporal de parámetros compartidos");
            var group = file.Groups.get_Item(GroupName) ?? file.Groups.Create(GroupName);
            var options = new ExternalDefinitionCreationOptions(name, SpecTypeId.String.Text)
            {
                GUID = Id,
                Description = Description,
                UserModifiable = true,
                Visible = true,
            };
            var created = group.Definitions.Create(options);
            document.ParameterBindings.Insert(created, application.Create.NewInstanceBinding(categorySet), GroupTypeId.IdentityData);
        }
        finally
        {
            application.SharedParametersFilename = original ?? string.Empty;
            TryDelete(temporary);
        }
    }

    private static Parameter? Find(Element element, string name) =>
        element.get_Parameter(Id) ?? element.LookupParameter(name);

    private static (Definition? Definition, Binding? Binding) FindBinding(Document document, string name)
    {
        var iterator = document.ParameterBindings.ForwardIterator();
        iterator.Reset();
        while (iterator.MoveNext())
        {
            var definition = iterator.Key;
            var matches = definition is ExternalDefinition external
                ? external.GUID == Id || external.Name == name
                : definition?.Name == name;
            if (matches)
            {
                return (definition, iterator.Current as Binding);
            }
        }
        return (null, null);
    }

    private static void TryDelete(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }
}
