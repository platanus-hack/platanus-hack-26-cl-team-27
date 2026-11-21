using static Team27.Minuta.Core.Tests.Support;

namespace Team27.Minuta.Core.Tests;

public class MinuteTextTests
{
    private static string Line(Change change) => MinuteText.Line(Catalog.Default, change);

    private static Change C(string subject, string attribute, double? before, double? after, string? unit = "cm") =>
        new(subject, attribute, before, after, unit, []);

    [Fact]
    public void ChangedValue() =>
        Assert.Equal("Losa nivel 3 · Espesor: 15 cm → 20 cm", Line(C("losa-n3", "espesor_cm", 15, 20)));

    [Fact]
    public void NewlyTracked() =>
        Assert.Equal("Losa nivel 3 · Espesor: 20 cm (recién vinculado)", Line(C("losa-n3", "espesor_cm", null, 20)));

    [Fact]
    public void Removed() =>
        Assert.Equal(
            "Losa nivel 3 · Espesor: ya no está en el modelo (era 15 cm)",
            Line(C("losa-n3", "espesor_cm", 15, null)));

    [Fact]
    public void DecimalsUseCommaAndTrimZeros()
    {
        Assert.Equal(
            "Shaft de instalaciones S1 · Distancia al eje A: 6 m → 8,5 m",
            Line(C("shaft-s1", "posicion_m", 6, 8.5, "m")));
        Assert.Equal("Losa nivel 2 · Espesor: 15 cm → 17,5 cm", Line(C("losa-n2", "espesor_cm", 15, 17.5)));
        Assert.Equal(
            "Ventanas fachada norte · Cantidad: 24 → 25",
            Line(C("ventanas-norte", "cantidad", 24, 25, null)));
    }

    [Fact]
    public void UnknownSubjectShowsRawKey()
    {
        var line = Line(C("torre-z", "espesor_cm", 1, 2));
        Assert.StartsWith("torre-z (no es parte del proyecto) · Espesor", line);
    }

    [Fact]
    public void MoneyUsesChileanGrouping()
    {
        Assert.Equal("+$3.636.500", MinuteText.Money(3636500));
        Assert.Equal("-$1.998.000", MinuteText.Money(-1998000));
        Assert.Equal("sin costo extra", MinuteText.Cost(0));
    }

    [Fact]
    public void DelayIsSingularOrPlural()
    {
        Assert.Equal("+1 día", MinuteText.Delay(1));
        Assert.Equal("+2 días", MinuteText.Delay(2));
        Assert.Equal("sin atraso", MinuteText.Delay(0));
    }

    [Fact]
    public void LabelAndHeading()
    {
        var saved = SampleMinute(saveNumber: 42);
        Assert.Equal("guardado 42", MinuteText.Label(saved));
        Assert.Equal("La minuta del guardado 42", MinuteText.Heading(saved));
        var manual = saved with { Trigger = MinuteTrigger.Manual };
        Assert.Equal("minuta 6f1c2b9e", MinuteText.Label(manual));
        Assert.Equal("La minuta 6f1c2b9e", MinuteText.Heading(manual));
        var noNumber = saved with { Model = saved.Model with { SaveNumber = null } };
        Assert.Equal("minuta 6f1c2b9e", MinuteText.Label(noNumber));
    }

    [Fact]
    public void TruncatesLongLists()
    {
        var lines = Enumerable.Range(1, 8).Select(i => $"l{i}").ToList();
        Assert.Equal("l1\nl2\ny 6 más", MinuteText.Truncate(lines, 2));
        Assert.Equal("l1\nl2", MinuteText.Truncate(lines.Take(2).ToList(), 2));
    }
}
