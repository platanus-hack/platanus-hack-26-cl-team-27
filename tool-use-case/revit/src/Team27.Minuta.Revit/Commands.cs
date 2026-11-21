using System.Windows.Interop;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Autodesk.Revit.UI.Selection;
using Team27.Minuta.Core;

namespace Team27.Minuta.Revit;

internal static class CommandContext
{
    public static bool TryGet(ExternalCommandData data, ref string message, out App app, out UIDocument uiDocument)
    {
        app = App.Current!;
        uiDocument = data.Application.ActiveUIDocument;
        if (App.Current is null)
        {
            message = "El add-in Minuta de cambios no está iniciado: revisa minuta.log.";
            return false;
        }
        if (uiDocument is null || uiDocument.Document.IsFamilyDocument)
        {
            message = "Abre un modelo de proyecto para usar la minuta de cambios.";
            return false;
        }
        return true;
    }
}

[Transaction(TransactionMode.Manual)]
public sealed class LinkCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        if (!CommandContext.TryGet(commandData, ref message, out var app, out var uiDocument))
        {
            return Result.Failed;
        }
        var document = uiDocument.Document;
        var ids = uiDocument.Selection.GetElementIds().ToList();
        if (ids.Count == 0)
        {
            try
            {
                ids = uiDocument.Selection
                    .PickObjects(ObjectType.Element, "Selecciona los elementos que quieres vincular y pulsa Terminar")
                    .Select(reference => reference.ElementId)
                    .ToList();
            }
            catch (Autodesk.Revit.Exceptions.OperationCanceledException)
            {
                return Result.Cancelled;
            }
        }
        var targets = ids
            .Select(document.GetElement)
            .Where(element => element is not null and not ElementType)
            .ToList();
        if (targets.Count == 0)
        {
            Dialogs.Show("No hay elementos para vincular", "Selecciona losas, ventanas, puertas, shafts o modelos genéricos del proyecto.");
            return Result.Cancelled;
        }

        var picker = new SubjectPicker(app.Catalog.Subjects, targets.Count);
        _ = new WindowInteropHelper(picker) { Owner = commandData.Application.MainWindowHandle };
        if (picker.ShowDialog() != true || picker.SelectedKey is null)
        {
            return Result.Cancelled;
        }
        var key = picker.SelectedKey;

        var linked = 0;
        var skipped = 0;
        using (var transaction = new Transaction(document, key.Length == 0 ? "Quitar el vínculo con la obra" : "Vincular a la obra"))
        {
            transaction.Start();
            SubjectParameter.EnsureBound(document, app.Categories, app.Settings.SubjectParameter);
            document.Regenerate();
            foreach (var element in targets)
            {
                var parameter = SubjectParameter.Writable(element, app.Settings.SubjectParameter);
                if (parameter is null)
                {
                    skipped++;
                    continue;
                }
                parameter.Set(key);
                linked++;
            }
            if (linked == 0)
            {
                transaction.RollBack();
            }
            else
            {
                transaction.Commit();
            }
        }

        var subject = app.Catalog.SubjectName(key) ?? key;
        var done = key.Length == 0
            ? $"Quitaste el vínculo de {Dialogs.Count(linked, "elemento", "elementos")}."
            : $"Vinculaste {Dialogs.Count(linked, "elemento", "elementos")} a {subject}. Entran en la minuta del próximo guardado.";
        var note = skipped == 0
            ? ""
            : $"\n\n{Dialogs.Count(skipped, "elemento no se pudo vincular", "elementos no se pudieron vincular")}: su categoría no está en «categories» de minuta.config.json o no admite parámetros.";
        Dialogs.Show(linked == 0 ? "No se vinculó ningún elemento" : "Listo", done + note);
        return Result.Succeeded;
    }
}

[Transaction(TransactionMode.ReadOnly)]
public sealed class PreviewCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        if (!CommandContext.TryGet(commandData, ref message, out var app, out var uiDocument))
        {
            return Result.Failed;
        }
        Dialogs.ShowPreview(app, app.Tracker.Preview(uiDocument.Document));
        return Result.Succeeded;
    }
}

[Transaction(TransactionMode.ReadOnly)]
public sealed class SendPendingCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        var app = App.Current;
        if (app is null)
        {
            message = "El add-in Minuta de cambios no está iniciado: revisa minuta.log.";
            return Result.Failed;
        }
        var pending = app.Dispatcher.PendingCount;
        if (pending == 0)
        {
            Dialogs.Show("No hay minutas pendientes", "Todas las minutas ya llegaron a la obra.");
            return Result.Succeeded;
        }
        _ = app.Dispatcher.Flush();
        Dialogs.Show(
            $"Enviando {Dialogs.Count(pending, "minuta pendiente", "minutas pendientes")}",
            "Te avisamos cuando la API responda.",
            app.Outbox.PendingPath);
        return Result.Succeeded;
    }
}

[Transaction(TransactionMode.ReadOnly)]
public sealed class PublishStateCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        if (!CommandContext.TryGet(commandData, ref message, out var app, out var uiDocument))
        {
            return Result.Failed;
        }
        var minute = app.Tracker.FullState(uiDocument.Document);
        if (minute is null)
        {
            Dialogs.Show("No hay elementos vinculados", "Usa «Vincular» para asociar losas, ventanas o shafts a la obra.");
            return Result.Cancelled;
        }
        var subjects = minute.Changes.Select(change => change.SubjectId).Distinct().Count();
        var accepted = Dialogs.Ask(
            $"¿Publicas el estado completo del modelo?",
            $"Se envían {Dialogs.Count(minute.Changes.Count, "valor", "valores")} de {Dialogs.Count(subjects, "elemento", "elementos")} de la obra. La obra los compara con lo vigente y abre propuestas donde difieran.\n\n{MinuteText.Truncate(MinuteText.Lines(app.Catalog, minute), 8)}",
            "Publicar estado");
        if (!accepted)
        {
            return Result.Cancelled;
        }
        _ = app.Dispatcher.Enqueue(minute);
        return Result.Succeeded;
    }
}
