namespace Team27.Minuta.Core;

public sealed class Log
{
    private readonly object gate = new();
    private readonly string path;

    public Log(string path)
    {
        this.path = path;
    }

    public static string DefaultRoot => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Team27",
        "Minuta");

    public static Log Default { get; } = new(Path.Combine(DefaultRoot, "minuta.log"));

    public void Info(string message) => Write("INFO", message);

    public void Error(string message, Exception? exception = null) =>
        Write("ERROR", exception is null ? message : $"{message}: {exception}");

    private void Write(string level, string message)
    {
        try
        {
            lock (gate)
            {
                var directory = System.IO.Path.GetDirectoryName(path);
                if (!string.IsNullOrEmpty(directory))
                {
                    Directory.CreateDirectory(directory);
                }
                File.AppendAllText(path, $"{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss} {level} {message}{Environment.NewLine}");
            }
        }
        catch (Exception)
        {
        }
    }
}
