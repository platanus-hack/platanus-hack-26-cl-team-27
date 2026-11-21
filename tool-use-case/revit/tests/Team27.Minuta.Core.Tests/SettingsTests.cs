using static Team27.Minuta.Core.Tests.Support;

namespace Team27.Minuta.Core.Tests;

public class SettingsTests
{
    [Fact]
    public void MissingFileGivesDefaults()
    {
        var settings = Settings.Load(Path.Combine(TempDir(), "no-existe.json"));
        Assert.Equal("http://localhost:3001/api", settings.ApiUrl);
        Assert.Equal("http://localhost:3000", settings.WebUrl);
        Assert.Equal("sala-los-aromos", settings.PresenterKey);
        Assert.Equal("Clave obra", settings.SubjectParameter);
        Assert.Equal("A", settings.GridName);
        Assert.True(settings.SendOnSave);
        Assert.False(settings.ConfirmBeforeSend);
        Assert.True(settings.ShowResult);
        Assert.Equal(10, settings.TimeoutSeconds);
        Assert.Contains("OST_ShaftOpening", settings.Categories);
        Assert.Null(settings.Subjects);
    }

    [Fact]
    public void AcceptsCommentsTrailingCommasAndUnknownKeys()
    {
        var settings = Settings.Parse("""
            {
              // la API
              "apiUrl": "https://api.example.cl/api/",
              /* sala */
              "presenterKey": "otra",
              "confirmBeforeSend": true,
              "timeoutSeconds": 30,
              "categories": ["OST_Floors",],
              "desconocida": 1,
              "subjects": [{ "id": "Losa-X", "name": "Losa X" },],
            }
            """);
        Assert.Equal("https://api.example.cl/api", settings.ApiUrl);
        Assert.Equal("otra", settings.PresenterKey);
        Assert.True(settings.ConfirmBeforeSend);
        Assert.Equal(30, settings.TimeoutSeconds);
        Assert.Equal(["OST_Floors"], settings.Categories.ToArray());
        Assert.Equal(new SubjectInfo("losa-x", "Losa X"), Assert.Single(settings.Subjects!));
    }

    [Fact]
    public void LoadsFromDisk()
    {
        var path = Path.Combine(TempDir(), Settings.FileName);
        File.WriteAllText(path, """{"gridName":"B"}""");
        Assert.Equal("B", Settings.Load(path).GridName);
    }

    [Theory]
    [InlineData("""{"apiUrl":"localhost"}""", "apiUrl")]
    [InlineData("""{"apiUrl":"ftp://x"}""", "apiUrl")]
    [InlineData("""{"webUrl":"no"}""", "webUrl")]
    [InlineData("""{"timeoutSeconds":0}""", "timeoutSeconds")]
    [InlineData("""{"timeoutSeconds":121}""", "timeoutSeconds")]
    [InlineData("""{"categories":[]}""", "categories")]
    [InlineData("""{"subjects":[{"id":"x"}]}""", "subjects")]
    [InlineData("""{"gridName":" "}""", "gridName")]
    [InlineData("""{"timeoutSeconds":"diez"}""", "JSON")]
    [InlineData("{ no", "JSON")]
    public void InvalidValuesThrowSpanishMessage(string json, string fragment)
    {
        var ex = Assert.Throws<SettingsException>(() => Settings.Parse(json));
        Assert.Contains(fragment, ex.Message);
    }
}
