using System.Globalization;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Autodesk.Revit.UI;
using Team27.Minuta.Core;

namespace Team27.Minuta.Revit;

internal static class Ribbon
{
    public const string Tab = "Team 27";
    public const string Panel = "Minuta de cambios";

    private static readonly Color Accent = Color.FromRgb(0x12, 0xB8, 0x86);
    private static readonly Color Neutral = Color.FromRgb(0x1C, 0x7E, 0xD6);

    public static void Build(UIControlledApplication application, Log log)
    {
        try
        {
            application.CreateRibbonTab(Tab);
        }
        catch (Autodesk.Revit.Exceptions.ArgumentException)
        {
        }
        var panel = application.GetRibbonPanels(Tab).FirstOrDefault(existing => existing.Name == Panel)
            ?? application.CreateRibbonPanel(Tab, Panel);
        Add(panel, log, typeof(LinkCommand), "Vincular", "V", Accent,
            "Asocia los elementos seleccionados a un elemento de la obra (losa, shaft, ventanas) con el parámetro «Clave obra».");
        Add(panel, log, typeof(PreviewCommand), "Minuta\npendiente", "M", Neutral,
            "Muestra lo que enviará el próximo guardado: los valores de la obra que cambiaron desde el último.");
        Add(panel, log, typeof(SendPendingCommand), "Enviar\npendientes", "E", Neutral,
            "Reintenta las minutas que no llegaron a la API.");
        Add(panel, log, typeof(PublishStateCommand), "Publicar\nestado", "P", Neutral,
            "Envía todos los valores vinculados del modelo; la obra abre propuestas donde difieran de lo vigente.");
    }

    private static void Add(RibbonPanel panel, Log log, Type command, string text, string glyph, Color color, string tooltip)
    {
        var data = new PushButtonData(command.Name, text, command.Assembly.Location, command.FullName)
        {
            ToolTip = tooltip,
        };
        try
        {
            data.LargeImage = Icon(glyph, color, 32);
            data.Image = Icon(glyph, color, 16);
        }
        catch (Exception ex)
        {
            log.Error("No pudimos dibujar los íconos de la cinta", ex);
        }
        panel.AddItem(data);
    }

    private static BitmapSource Icon(string glyph, Color color, int size)
    {
        var visual = new DrawingVisual();
        using (var context = visual.RenderOpen())
        {
            var radius = size * 0.22;
            context.DrawRoundedRectangle(new SolidColorBrush(color), null, new Rect(0, 0, size, size), radius, radius);
            var text = new FormattedText(
                glyph,
                CultureInfo.InvariantCulture,
                FlowDirection.LeftToRight,
                new Typeface(new FontFamily("Segoe UI"), FontStyles.Normal, FontWeights.Bold, FontStretches.Normal),
                size * 0.62,
                Brushes.White,
                1.0);
            context.DrawText(text, new Point((size - text.Width) / 2, (size - text.Height) / 2));
        }
        var bitmap = new RenderTargetBitmap(size, size, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(visual);
        bitmap.Freeze();
        return bitmap;
    }
}
