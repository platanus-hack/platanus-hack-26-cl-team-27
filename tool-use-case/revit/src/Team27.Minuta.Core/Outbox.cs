using System.Globalization;

namespace Team27.Minuta.Core;

public sealed record PendingMinute(string Path, Minute Minute);

public sealed class Outbox
{
    public const string PendingFolder = "pendientes";
    public const string SentFolder = "enviadas";
    public const string RejectedFolder = "rechazadas";

    private readonly object gate = new();

    public Outbox(string root)
    {
        Root = root;
    }

    public static string DefaultRoot => System.IO.Path.Combine(Log.DefaultRoot, "minutas");

    public string Root { get; }

    public string PendingPath => System.IO.Path.Combine(Root, PendingFolder);

    public string SentPath => System.IO.Path.Combine(Root, SentFolder);

    public string RejectedPath => System.IO.Path.Combine(Root, RejectedFolder);

    public PendingMinute Save(Minute minute)
    {
        lock (gate)
        {
            Directory.CreateDirectory(PendingPath);
            var id = minute.MinuteId.Length > 8 ? minute.MinuteId[..8] : minute.MinuteId;
            var stamp = minute.CreatedAt.UtcDateTime.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture);
            var path = System.IO.Path.Combine(PendingPath, $"{stamp}-{id}.json");
            WriteAtomic(path, MinuteJson.Serialize(minute, indented: true));
            return new PendingMinute(path, minute);
        }
    }

    public IReadOnlyList<PendingMinute> Pending()
    {
        lock (gate)
        {
            if (!Directory.Exists(PendingPath))
            {
                return [];
            }
            var result = new List<PendingMinute>();
            var files = Directory.GetFiles(PendingPath, "*.json").OrderBy(f => f, StringComparer.Ordinal);
            foreach (var file in files)
            {
                Minute? minute = null;
                string? failure = null;
                try
                {
                    minute = MinuteJson.Deserialize(File.ReadAllText(file));
                }
                catch (Exception ex) when (ex is System.Text.Json.JsonException or IOException)
                {
                    failure = ex.Message;
                }
                if (minute is not null)
                {
                    result.Add(new PendingMinute(file, minute));
                }
                else if (failure is not null)
                {
                    Quarantine(file, failure);
                }
            }
            return result;
        }
    }

    public int PendingCount()
    {
        lock (gate)
        {
            return Directory.Exists(PendingPath) ? Directory.GetFiles(PendingPath, "*.json").Length : 0;
        }
    }

    public string MarkSent(PendingMinute item, Receipt? receipt)
    {
        lock (gate)
        {
            var target = MoveTo(item.Path, SentPath);
            if (receipt is not null)
            {
                WriteAtomic(Sibling(target, ".recibo.json"), MinuteJson.Serialize(receipt));
            }
            return target;
        }
    }

    public string MarkRejected(PendingMinute item, string code, string message, IReadOnlyList<IgnoredChange> ignored)
    {
        lock (gate)
        {
            var target = MoveTo(item.Path, RejectedPath);
            WriteAtomic(Sibling(target, ".error.json"), MinuteJson.SerializeObject(new { code, message, ignored }));
            return target;
        }
    }

    private void Quarantine(string file, string failure)
    {
        try
        {
            var target = MoveTo(file, RejectedPath);
            WriteAtomic(Sibling(target, ".error.json"), MinuteJson.SerializeObject(new { code = "unreadable", message = failure }));
        }
        catch (IOException)
        {
        }
    }

    private static string Sibling(string file, string suffix) =>
        System.IO.Path.Combine(
            System.IO.Path.GetDirectoryName(file)!,
            System.IO.Path.GetFileNameWithoutExtension(file) + suffix);

    private static string MoveTo(string file, string folder)
    {
        Directory.CreateDirectory(folder);
        var target = System.IO.Path.Combine(folder, System.IO.Path.GetFileName(file));
        File.Move(file, target, overwrite: true);
        return target;
    }

    private static void WriteAtomic(string path, string content)
    {
        var temp = path + "." + Guid.NewGuid().ToString("N")[..8] + ".tmp";
        File.WriteAllText(temp, content);
        File.Move(temp, path, overwrite: true);
    }
}
