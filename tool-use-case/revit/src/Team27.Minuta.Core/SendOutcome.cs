namespace Team27.Minuta.Core;

public abstract record SendOutcome
{
    public sealed record Sent(Receipt Receipt) : SendOutcome;

    public sealed record AlreadyRegistered : SendOutcome;

    public sealed record Rejected(string Code, string Message, IReadOnlyList<IgnoredChange> Ignored) : SendOutcome;

    public sealed record Failed(string Reason) : SendOutcome;
}

public interface IMinuteSender
{
    Task<SendOutcome> SendAsync(Minute minute, CancellationToken cancellationToken = default);
}
