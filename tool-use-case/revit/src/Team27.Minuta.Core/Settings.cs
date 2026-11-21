using System.Text.Json;

namespace Team27.Minuta.Core;

public sealed class SettingsException : Exception
{
    public SettingsException(string message) : base(message)
    {
    }

    public SettingsException(string message, Exception inner) : base(message, inner)
    {
    }
}

public sealed record Settings
{
    public const string FileName = "minuta.config.json";

    public string ApiUrl { get; init; } = "http://localhost:3001/api";
    public string WebUrl { get; init; } = "http://localhost:3000";
    public string PresenterKey { get; init; } = "sala-los-aromos";
    public string SubjectParameter { get; init; } = "Clave obra";
    public string GridName { get; init; } = "A";
    public bool SendOnSave { get; init; } = true;
    public bool ConfirmBeforeSend { get; init; }
    public bool ShowResult { get; init; } = true;
    public int TimeoutSeconds { get; init; } = 10;

    public IReadOnlyList<string> Categories { get; init; } =
    [
        "OST_Floors",
        "OST_Roofs",
        "OST_Windows",
        "OST_Doors",
        "OST_ShaftOpening",
        "OST_GenericModel",
    ];

    public IReadOnlyList<SubjectInfo>? Subjects { get; init; }

    public FlowSettings Flow { get; init; } = new();

    public static Settings Load(string path)
    {
        if (!File.Exists(path))
        {
            return new Settings();
        }
        string text;
        try
        {
            text = File.ReadAllText(path);
        }
        catch (IOException ex)
        {
            throw new SettingsException($"No pudimos leer {path}: {ex.Message}", ex);
        }
        return Parse(text);
    }

    public static Settings Parse(string json)
    {
        var defaults = new Settings();
        if (string.IsNullOrWhiteSpace(json))
        {
            return defaults;
        }
        Raw? raw;
        try
        {
            raw = JsonSerializer.Deserialize<Raw>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                ReadCommentHandling = JsonCommentHandling.Skip,
                AllowTrailingCommas = true,
            });
        }
        catch (JsonException ex)
        {
            throw new SettingsException($"{FileName} no es un JSON válido: {ex.Message}", ex);
        }
        if (raw is null)
        {
            return defaults;
        }
        var settings = defaults with
        {
            ApiUrl = Url(raw.ApiUrl, "apiUrl", defaults.ApiUrl),
            WebUrl = Url(raw.WebUrl, "webUrl", defaults.WebUrl),
            PresenterKey = raw.PresenterKey?.Trim() ?? defaults.PresenterKey,
            SubjectParameter = Required(raw.SubjectParameter, "subjectParameter", defaults.SubjectParameter),
            GridName = Required(raw.GridName, "gridName", defaults.GridName),
            SendOnSave = raw.SendOnSave ?? defaults.SendOnSave,
            ConfirmBeforeSend = raw.ConfirmBeforeSend ?? defaults.ConfirmBeforeSend,
            ShowResult = raw.ShowResult ?? defaults.ShowResult,
            TimeoutSeconds = Timeout(raw.TimeoutSeconds, defaults.TimeoutSeconds),
            Categories = ParseCategories(raw.Categories, defaults.Categories),
            Subjects = ParseSubjects(raw.Subjects),
            Flow = ParseFlow(raw.Flow),
        };
        return settings;
    }

    private static string Url(string? value, string name, string fallback)
    {
        if (value is null)
        {
            return fallback;
        }
        var trimmed = value.Trim();
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
        {
            throw new SettingsException($"{name} debe ser una dirección http o https, por ejemplo {fallback}.");
        }
        return trimmed.TrimEnd('/');
    }

    private static string Required(string? value, string name, string fallback)
    {
        if (value is null)
        {
            return fallback;
        }
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new SettingsException($"{name} no puede estar vacío.");
        }
        return value.Trim();
    }

    private static int Timeout(int? value, int fallback)
    {
        if (value is null)
        {
            return fallback;
        }
        if (value is < 1 or > 120)
        {
            throw new SettingsException("timeoutSeconds debe estar entre 1 y 120 segundos.");
        }
        return value.Value;
    }

    private static IReadOnlyList<string> ParseCategories(List<string>? value, IReadOnlyList<string> fallback)
    {
        if (value is null)
        {
            return fallback;
        }
        var cleaned = value.Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim()).Distinct().ToList();
        if (cleaned.Count == 0)
        {
            throw new SettingsException("categories necesita al menos una categoría, por ejemplo OST_Floors.");
        }
        return cleaned;
    }

    private static IReadOnlyList<SubjectInfo>? ParseSubjects(List<RawSubject>? value)
    {
        if (value is null || value.Count == 0)
        {
            return null;
        }
        var result = new List<SubjectInfo>();
        foreach (var item in value)
        {
            if (string.IsNullOrWhiteSpace(item.Id) || string.IsNullOrWhiteSpace(item.Name))
            {
                throw new SettingsException("Cada elemento de subjects necesita id y name.");
            }
            result.Add(new SubjectInfo(item.Id.Trim().ToLowerInvariant(), item.Name.Trim()));
        }
        return result;
    }

    private static FlowSettings ParseFlow(RawFlow? value)
    {
        if (value is null)
        {
            return new FlowSettings();
        }
        var defaults = new FlowSettings();
        var pollSeconds = value.PollSeconds ?? defaults.PollSeconds;
        if (pollSeconds is < 1 or > 60)
        {
            throw new SettingsException("flow.pollSeconds debe estar entre 1 y 60 segundos.");
        }
        var models = new List<FlowModelSetting>();
        foreach (var item in value.Models ?? [])
        {
            if (string.IsNullOrWhiteSpace(item.TitleContains) || string.IsNullOrWhiteSpace(item.Seat))
            {
                throw new SettingsException("Cada elemento de flow.models necesita titleContains y seat.");
            }
            models.Add(new FlowModelSetting(
                item.TitleContains.Trim(),
                item.Seat.Trim(),
                string.IsNullOrWhiteSpace(item.Discipline) ? "estructura" : item.Discipline.Trim(),
                string.IsNullOrWhiteSpace(item.Reason) ? null : item.Reason.Trim(),
                item.Sends ?? true,
                item.Applies ?? true));
        }
        return new FlowSettings
        {
            Enabled = value.Enabled ?? defaults.Enabled,
            PollSeconds = pollSeconds,
            Models = value.Models is null ? defaults.Models : models,
        };
    }

    private sealed class RawFlow
    {
        public bool? Enabled { get; set; }
        public int? PollSeconds { get; set; }
        public List<RawFlowModel>? Models { get; set; }
    }

    private sealed class RawFlowModel
    {
        public string? TitleContains { get; set; }
        public string? Seat { get; set; }
        public string? Discipline { get; set; }
        public string? Reason { get; set; }
        public bool? Sends { get; set; }
        public bool? Applies { get; set; }
    }

    private sealed class Raw
    {
        public string? ApiUrl { get; set; }
        public string? WebUrl { get; set; }
        public string? PresenterKey { get; set; }
        public string? SubjectParameter { get; set; }
        public string? GridName { get; set; }
        public bool? SendOnSave { get; set; }
        public bool? ConfirmBeforeSend { get; set; }
        public bool? ShowResult { get; set; }
        public int? TimeoutSeconds { get; set; }
        public List<string>? Categories { get; set; }
        public List<RawSubject>? Subjects { get; set; }
        public RawFlow? Flow { get; set; }
    }

    private sealed class RawSubject
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
    }
}
