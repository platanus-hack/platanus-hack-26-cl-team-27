using Team27.Minuta.Core;

namespace Team27.Minuta.Core.Tests;

internal static class Support
{
    public static string ContractFile(string name)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, "contract", name);
            if (File.Exists(candidate))
            {
                return candidate;
            }
            directory = directory.Parent;
        }
        throw new FileNotFoundException($"No encontramos contract/{name}");
    }

    public static ElementInfo Element(long id, string? name = "Elemento") =>
        new(id, $"uid-{id}", "Suelos", name, "Nivel 1");

    public static SubjectSnapshot Subject(Dictionary<string, double> values, params ElementInfo[] elements) =>
        new(values, elements);

    public static ModelSnapshot Snapshot(params (string Id, SubjectSnapshot Subject)[] subjects) =>
        new(subjects.ToDictionary(s => s.Id, s => s.Subject));

    public static MinuteContext Context(string trigger = MinuteTrigger.Save, int? saveNumber = 7, string id = "6f1c2b9e-3d4a-4f8b-9c1e-2a7d5b8e0f31") =>
        new(
            id,
            trigger,
            new DateTimeOffset(2026, 11, 21, 17, 32, 5, TimeSpan.Zero),
            "LosAromos_ARQ",
            saveNumber,
            "0f4e5d6c-7b8a-4c9d-8e1f-2a3b4c5d6e7f",
            "2026",
            new AddinInfo("Team27.Minuta", "1.0.0"),
            ["Modificar tipo de suelo"]);

    public static Minute SampleMinute(string id = "6f1c2b9e-3d4a-4f8b-9c1e-2a7d5b8e0f31", int saveNumber = 7)
    {
        var before = Snapshot(("losa-n3", Subject(new() { ["espesor_cm"] = 15 }, Element(1))));
        var after = Snapshot(("losa-n3", Subject(new() { ["espesor_cm"] = 20 }, Element(1))));
        return new MinuteBuilder(Catalog.Default).Build(before, after, Context(saveNumber: saveNumber, id: id))!;
    }

    public static string TempDir()
    {
        var path = Path.Combine(Path.GetTempPath(), "minuta-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return path;
    }
}
