using System.Text.Json.Serialization;

namespace Team27.Minuta.Core;

public sealed record Delta(double Dx, double Dy, double Dz)
{
    [JsonIgnore]
    public bool IsZero => Dx == 0 && Dy == 0 && Dz == 0;
}

public sealed record ColumnPosition(string Mark, long ElementId, double X, double Y, double Z);

public sealed class ColumnSnapshot
{
    public static readonly ColumnSnapshot Empty = new(new Dictionary<string, ColumnPosition>());

    public ColumnSnapshot(IReadOnlyDictionary<string, ColumnPosition> columns)
    {
        Columns = columns;
    }

    public IReadOnlyDictionary<string, ColumnPosition> Columns { get; }

    public static ColumnSnapshot From(IEnumerable<ColumnPosition> positions)
    {
        var map = new Dictionary<string, ColumnPosition>(StringComparer.Ordinal);
        foreach (var position in positions)
        {
            var mark = position.Mark.Trim();
            if (mark.Length > 0 && !map.ContainsKey(mark))
            {
                map[mark] = position with { Mark = mark };
            }
        }
        return new ColumnSnapshot(map);
    }

    public ColumnSnapshot With(ColumnPosition position)
    {
        var map = new Dictionary<string, ColumnPosition>(Columns, StringComparer.Ordinal)
        {
            [position.Mark] = position,
        };
        return new ColumnSnapshot(map);
    }
}

public sealed record FlowChange(string ElementId, string Attribute, Delta Delta, string? Reason);

public static class ColumnDiff
{
    public const string LocationAttribute = "location";

    public static IReadOnlyList<FlowChange> Between(ColumnSnapshot before, ColumnSnapshot after, string? reason = null)
    {
        var changes = new List<FlowChange>();
        foreach (var mark in after.Columns.Keys.OrderBy(m => m, StringComparer.Ordinal))
        {
            if (!before.Columns.TryGetValue(mark, out var previous))
            {
                continue;
            }
            var current = after.Columns[mark];
            var delta = new Delta(
                Units.RoundMillimeters(Units.FeetToMeters(current.X - previous.X)),
                Units.RoundMillimeters(Units.FeetToMeters(current.Y - previous.Y)),
                Units.RoundMillimeters(Units.FeetToMeters(current.Z - previous.Z)));
            if (!delta.IsZero)
            {
                changes.Add(new FlowChange(mark, LocationAttribute, delta, reason));
            }
        }
        return changes;
    }
}
