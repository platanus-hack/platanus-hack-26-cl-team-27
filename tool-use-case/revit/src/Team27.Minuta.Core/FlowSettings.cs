namespace Team27.Minuta.Core;

public sealed record FlowModelSetting(
    string TitleContains,
    string Seat,
    string Discipline,
    string? Reason,
    bool Sends,
    bool Applies);

public sealed record FlowSettings
{
    public bool Enabled { get; init; } = true;

    public int PollSeconds { get; init; } = 2;

    public IReadOnlyList<FlowModelSetting> Models { get; init; } =
    [
        new("_EST", "paula-rojas", "estructura", "Alinear con el muro de corte M-6 y bajar la torsión", true, false),
        new("_ELEC", "camila-vera", "electricas", null, false, true),
    ];

    public FlowModelSetting? Find(string? title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return null;
        }
        return Models.FirstOrDefault(m => title.Contains(m.TitleContains, StringComparison.OrdinalIgnoreCase));
    }
}
