using static Team27.Minuta.Core.Tests.Support;

namespace Team27.Minuta.Core.Tests;

public class MinuteBuilderTests
{
    private readonly MinuteBuilder builder = new(Catalog.Default);

    [Fact]
    public void NoChangeReturnsNull()
    {
        var snapshot = Snapshot(("losa-n3", Subject(new() { ["espesor_cm"] = 15 }, Element(1))));
        Assert.Null(builder.Build(snapshot, snapshot, Context()));
        Assert.Null(builder.Build(ModelSnapshot.Empty, ModelSnapshot.Empty, Context()));
    }

    [Fact]
    public void ReportsChangeWithUnitAndElements()
    {
        var minute = SampleMinute();
        var change = Assert.Single(minute.Changes);
        Assert.Equal("losa-n3", change.SubjectId);
        Assert.Equal("espesor_cm", change.Attribute);
        Assert.Equal(15, change.Before);
        Assert.Equal(20, change.After);
        Assert.Equal("cm", change.Unit);
        Assert.Equal(1, Assert.Single(change.Elements).Id);
        Assert.Equal(7, minute.Model.SaveNumber);
    }

    [Fact]
    public void IgnoresRoundingNoise()
    {
        var before = Snapshot(("losa-n3", Subject(new() { ["espesor_cm"] = 15 }, Element(1))));
        var after = Snapshot(("losa-n3", Subject(new() { ["espesor_cm"] = 15.0000000001 }, Element(1))));
        Assert.Null(builder.Build(before, after, Context()));
    }

    [Fact]
    public void UnknownAttributeRoundsToTwoDecimals()
    {
        var before = Snapshot(("losa-n3", Subject(new() { ["otro"] = 1.001 }, Element(1))));
        var after = Snapshot(("losa-n3", Subject(new() { ["otro"] = 1.004 }, Element(1))));
        Assert.Null(builder.Build(before, after, Context()));
        var changed = Snapshot(("losa-n3", Subject(new() { ["otro"] = 1.02 }, Element(1))));
        var change = Assert.Single(builder.Build(before, changed, Context())!.Changes);
        Assert.Null(change.Unit);
    }

    [Fact]
    public void NewlyTrackedHasNullBefore()
    {
        var after = Snapshot(("losa-n3", Subject(new() { ["espesor_cm"] = 20 }, Element(1))));
        var change = Assert.Single(builder.Build(ModelSnapshot.Empty, after, Context())!.Changes);
        Assert.Null(change.Before);
        Assert.Equal(20, change.After);
        Assert.Single(change.Elements);
    }

    [Fact]
    public void RemovedHasNullAfterAndBeforeElements()
    {
        var before = Snapshot(("losa-n3", Subject(new() { ["espesor_cm"] = 15 }, Element(9))));
        var change = Assert.Single(builder.Build(before, ModelSnapshot.Empty, Context())!.Changes);
        Assert.Equal(15, change.Before);
        Assert.Null(change.After);
        Assert.Equal(9, Assert.Single(change.Elements).Id);
    }

    [Fact]
    public void OrdersCatalogSubjectsFirstThenUnknownAlphabetically()
    {
        var after = Snapshot(
            ("zeta", Subject(new() { ["espesor_cm"] = 1 })),
            ("ventanas-norte", Subject(new() { ["cantidad"] = 24, ["ancho_cm"] = 120 })),
            ("alfa", Subject(new() { ["espesor_cm"] = 1 })),
            ("losa-n2", Subject(new() { ["espesor_cm"] = 15 })));
        var changes = builder.Build(ModelSnapshot.Empty, after, Context())!.Changes;
        Assert.Equal(
            ["losa-n2/espesor_cm", "ventanas-norte/ancho_cm", "ventanas-norte/cantidad", "alfa/espesor_cm", "zeta/espesor_cm"],
            changes.Select(c => $"{c.SubjectId}/{c.Attribute}").ToArray());
    }

    [Fact]
    public void ElementsAreOrderedById()
    {
        var after = Snapshot(("losa-n3", Subject(new() { ["espesor_cm"] = 20 }, Element(5), Element(2))));
        var change = Assert.Single(builder.Build(ModelSnapshot.Empty, after, Context())!.Changes);
        Assert.Equal([2L, 5L], change.Elements.Select(e => e.Id).ToArray());
    }

    [Fact]
    public void CustomSubjectsChangeTheOrder()
    {
        var custom = new MinuteBuilder(new Catalog([new SubjectInfo("b", "B"), new SubjectInfo("a", "A")]));
        var after = Snapshot(("a", Subject(new() { ["espesor_cm"] = 1 })), ("b", Subject(new() { ["espesor_cm"] = 1 })));
        var ids = custom.Build(ModelSnapshot.Empty, after, Context())!.Changes.Select(c => c.SubjectId).ToArray();
        Assert.Equal(["b", "a"], ids);
    }

    [Fact]
    public void CapsTheLimitsOfTheContract()
    {
        var values = Enumerable.Range(0, 300).ToDictionary(i => $"s{i:000}", i => Subject(new() { ["espesor_cm"] = i + 1 }));
        var after = new ModelSnapshot(values);
        var minute = builder.Build(ModelSnapshot.Empty, after, Context())!;
        Assert.Equal(MinuteBuilder.MaxChanges, minute.Changes.Count);
    }
}
