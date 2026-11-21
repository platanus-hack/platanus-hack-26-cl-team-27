using System.Text.Json.Nodes;
using static Team27.Minuta.Core.Tests.Support;

namespace Team27.Minuta.Core.Tests;

public class JsonTests
{
    private static Minute ExampleMinute() => new(
        "6f1c2b9e-3d4a-4f8b-9c1e-2a7d5b8e0f31",
        MinuteTrigger.Save,
        new DateTimeOffset(2026, 11, 21, 17, 32, 5, TimeSpan.Zero),
        new ModelInfo("LosAromos_ARQ", 42, "0f4e5d6c-7b8a-4c9d-8e1f-2a3b4c5d6e7f", "2026"),
        new AddinInfo("Team27.Minuta", "1.0.0"),
        [
            new Change("losa-n3", "espesor_cm", 15, 20, "cm",
                [new ElementInfo(312456, "8d2f6a1c-5b3e-4c7a-9f0d-1e2b3c4d5e6f-0004c488", "Suelos", "Losa H30 20 cm", "Nivel 3")]),
            new Change("ventanas-norte", "ancho_cm", 120, 150, "cm",
            [
                new ElementInfo(401101, "3c9a7e2b-1f4d-4b6a-8e5c-7d2f1a0b9c8e-00061ecd", "Ventanas", "Ventana PVC termopanel 150 x 150", "Nivel 2"),
                new ElementInfo(401102, "3c9a7e2b-1f4d-4b6a-8e5c-7d2f1a0b9c8e-00061ece", "Ventanas", "Ventana PVC termopanel 150 x 150", "Nivel 2"),
            ]),
        ],
        ["Modificar tipo de suelo", "Modificar tipo de ventana"]);

    [Fact]
    public void SerializesLikeTheContractExample()
    {
        var expected = JsonNode.Parse(File.ReadAllText(ContractFile("minuta.example.json")));
        var actual = JsonNode.Parse(MinuteJson.Serialize(ExampleMinute()));
        Assert.True(JsonNode.DeepEquals(expected, actual), actual!.ToJsonString());
    }

    [Fact]
    public void WritesCreatedAtAsUtcWithZ()
    {
        var local = ExampleMinute() with { CreatedAt = new DateTimeOffset(2026, 11, 21, 14, 32, 5, TimeSpan.FromHours(-3)) };
        var node = JsonNode.Parse(MinuteJson.Serialize(local))!;
        Assert.Equal("2026-11-21T17:32:05Z", (string)node["createdAt"]!);
        var fractional = ExampleMinute() with { CreatedAt = new DateTimeOffset(2026, 11, 21, 17, 32, 5, 250, TimeSpan.Zero) };
        Assert.Equal("2026-11-21T17:32:05.25Z", (string)JsonNode.Parse(MinuteJson.Serialize(fractional))!["createdAt"]!);
    }

    [Fact]
    public void WritesNullsExplicitly()
    {
        var minute = ExampleMinute() with { Model = new ModelInfo("T", null, null, null) };
        var model = JsonNode.Parse(MinuteJson.Serialize(minute))!["model"]!.AsObject();
        Assert.True(model.ContainsKey("saveNumber") && model["saveNumber"] is null);
        Assert.True(model.ContainsKey("versionGuid"));
        Assert.True(model.ContainsKey("revitVersion"));
    }

    [Fact]
    public void RoundTrips()
    {
        var original = ExampleMinute();
        var copy = MinuteJson.Deserialize(MinuteJson.Serialize(original))!;
        Assert.Equal(original.MinuteId, copy.MinuteId);
        Assert.Equal(original.CreatedAt, copy.CreatedAt);
        Assert.Equal(original.Model, copy.Model);
        Assert.Equal(original.Operations, copy.Operations);
        Assert.Equal(original.Changes.Count, copy.Changes.Count);
        Assert.Equal(original.Changes[1].Elements, copy.Changes[1].Elements);
        Assert.Equal(original.Changes[0].Before, copy.Changes[0].Before);
    }
}
