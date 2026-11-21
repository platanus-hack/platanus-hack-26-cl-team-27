using System.Globalization;

namespace Team27.Minuta.Core;

public static class MinuteText
{
    private static readonly NumberFormatInfo Chile = new()
    {
        NumberDecimalSeparator = ",",
        NumberGroupSeparator = ".",
        NegativeSign = "-",
    };

    public static string Number(double value, int decimals)
    {
        var format = decimals > 0 ? "0." + new string('#', decimals) : "0";
        var text = Math.Round(value, decimals, MidpointRounding.AwayFromZero).ToString(format, Chile);
        return text == "-0" ? "0" : text;
    }

    public static string Money(double amount)
    {
        var rounded = Math.Round(Math.Abs(amount), 0, MidpointRounding.AwayFromZero);
        var sign = amount < 0 ? "-" : "+";
        return sign + "$" + rounded.ToString("#,##0", Chile);
    }

    public static string Cost(double amount) => amount == 0 ? "sin costo extra" : Money(amount);

    public static string Delay(int days)
    {
        if (days == 0)
        {
            return "sin atraso";
        }
        var sign = days > 0 ? "+" : "-";
        var abs = Math.Abs(days);
        return $"{sign}{abs} {(abs == 1 ? "día" : "días")}";
    }

    public static string Value(Catalog catalog, string attribute, double value)
    {
        var text = Number(value, catalog.Decimals(attribute));
        var unit = catalog.Unit(attribute);
        return unit is null ? text : $"{text} {unit}";
    }

    public static string SubjectLabel(Catalog catalog, string subjectId) =>
        catalog.SubjectName(subjectId) ?? $"{subjectId} (no es parte del proyecto)";

    public static string AttributeLabel(Catalog catalog, string attribute) =>
        catalog.Attribute(attribute)?.Name ?? attribute;

    public static string Line(Catalog catalog, Change change)
    {
        var head = $"{SubjectLabel(catalog, change.SubjectId)} · {AttributeLabel(catalog, change.Attribute)}";
        if (change.Before is null && change.After is { } added)
        {
            return $"{head}: {Value(catalog, change.Attribute, added)} (recién vinculado)";
        }
        if (change.After is null && change.Before is { } removed)
        {
            return $"{head}: ya no está en el modelo (era {Value(catalog, change.Attribute, removed)})";
        }
        if (change.Before is { } from && change.After is { } to)
        {
            return $"{head}: {Value(catalog, change.Attribute, from)} → {Value(catalog, change.Attribute, to)}";
        }
        return head;
    }

    public static IReadOnlyList<string> Lines(Catalog catalog, Minute minute) =>
        minute.Changes.Select(c => Line(catalog, c)).ToList();

    public static string Label(Minute minute)
    {
        var saved = minute.Trigger is MinuteTrigger.Save or MinuteTrigger.Sync && minute.Model.SaveNumber is not null;
        if (saved)
        {
            return $"guardado {minute.Model.SaveNumber}";
        }
        var id = minute.MinuteId;
        return $"minuta {(id.Length > 8 ? id[..8] : id)}";
    }

    public static string Heading(Minute minute)
    {
        var label = Label(minute);
        return label.StartsWith("guardado", StringComparison.Ordinal) ? $"La minuta del {label}" : $"La {label}";
    }

    public static string Truncate(IReadOnlyList<string> lines, int max)
    {
        if (lines.Count <= max)
        {
            return string.Join("\n", lines);
        }
        var shown = lines.Take(max).ToList();
        shown.Add($"y {lines.Count - max} más");
        return string.Join("\n", shown);
    }
}
