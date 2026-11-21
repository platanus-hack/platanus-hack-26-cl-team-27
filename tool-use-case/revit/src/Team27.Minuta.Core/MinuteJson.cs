using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Team27.Minuta.Core;

public static class MinuteJson
{
    private sealed class UtcDateConverter : JsonConverter<DateTimeOffset>
    {
        public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            DateTimeOffset.Parse(
                reader.GetString() ?? "",
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal);

        public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options) =>
            writer.WriteStringValue(value.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'", CultureInfo.InvariantCulture));
    }

    private static readonly JsonSerializerOptions Options = Create(false);
    private static readonly JsonSerializerOptions IndentedOptions = Create(true);

    private static JsonSerializerOptions Create(bool indented)
    {
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.Never,
            WriteIndented = indented,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        };
        options.Converters.Add(new UtcDateConverter());
        return options;
    }

    public static string Serialize(Minute minute, bool indented = false) =>
        JsonSerializer.Serialize(minute, indented ? IndentedOptions : Options);

    public static Minute? Deserialize(string json) => JsonSerializer.Deserialize<Minute>(json, Options);

    public static string Serialize(Receipt receipt) => JsonSerializer.Serialize(receipt, IndentedOptions);

    public static string SerializeObject(object value) => JsonSerializer.Serialize(value, IndentedOptions);
}
