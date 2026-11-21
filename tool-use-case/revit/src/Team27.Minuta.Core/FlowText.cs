using System.Globalization;

namespace Team27.Minuta.Core;

public static class FlowText
{
    public static string Meters(double value) =>
        Math.Abs(value).ToString("0.00", CultureInfo.InvariantCulture).Replace('.', ',');

    public static string Movement(Delta delta)
    {
        var parts = new List<string>();
        Axis(parts, delta.Dx, "este", "oeste");
        Axis(parts, delta.Dy, "norte", "sur");
        Axis(parts, delta.Dz, "arriba", "abajo");
        return parts.Count == 0 ? "sin movimiento" : string.Join(" y ", parts);
    }

    public static string Moved(FlowChange change) => $"{change.ElementId} se movió {Movement(change.Delta)}";

    public static string Moved(string elementId, Delta delta) => $"{elementId} se movió {Movement(delta)}";

    private static void Axis(List<string> parts, double value, string positive, string negative)
    {
        if (value != 0)
        {
            parts.Add($"{Meters(value)} m al {(value > 0 ? positive : negative)}".Replace("al arriba", "hacia arriba").Replace("al abajo", "hacia abajo"));
        }
    }
}
