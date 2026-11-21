using static Team27.Minuta.Core.Tests.Support;

namespace Team27.Minuta.Core.Tests;

public class MinuteDispatcherTests : IDisposable
{
    private sealed class FakeSender : IMinuteSender
    {
        private readonly Func<Minute, SendOutcome> decide;

        public FakeSender(Func<Minute, SendOutcome> decide)
        {
            this.decide = decide;
        }

        public List<string> Sent { get; } = [];

        public Action<Minute>? OnSend { get; set; }

        public async Task<SendOutcome> SendAsync(Minute minute, CancellationToken cancellationToken = default)
        {
            lock (Sent)
            {
                Sent.Add(minute.MinuteId);
            }
            OnSend?.Invoke(minute);
            await Task.Yield();
            return decide(minute);
        }
    }

    private readonly string root = TempDir();
    private readonly Outbox outbox;
    private readonly List<DispatchResult> results = [];

    public MinuteDispatcherTests()
    {
        outbox = new Outbox(root);
    }

    public void Dispose() => Directory.Delete(root, true);

    private static string Id(int n) => $"{n:00000000}-0000-4000-8000-000000000000";

    private static Minute At(int n) =>
        SampleMinute(Id(n), n) with { CreatedAt = new DateTimeOffset(2026, 11, 21, 10, 0, n, TimeSpan.Zero) };

    private MinuteDispatcher Dispatcher(FakeSender sender) =>
        new(outbox, sender, r =>
        {
            lock (results)
            {
                results.Add(r);
            }
        });

    private static SendOutcome Ok() => new SendOutcome.Sent(Receipt.Empty);

    [Fact]
    public async Task SendsInOrderAndMovesToSent()
    {
        var sender = new FakeSender(_ => Ok());
        var dispatcher = Dispatcher(sender);
        outbox.Save(At(2));
        outbox.Save(At(1));
        await dispatcher.Flush();
        Assert.Equal([Id(1), Id(2)], sender.Sent.ToArray());
        Assert.Equal(0, outbox.PendingCount());
        Assert.Equal(2, Directory.GetFiles(outbox.SentPath, "*.recibo.json").Length);
        Assert.Equal(2, results.Count);
    }

    [Fact]
    public async Task StopsOnFailedAndResumesOnFlush()
    {
        var fail = true;
        var sender = new FakeSender(m => fail && m.MinuteId == Id(2) ? new SendOutcome.Failed("sin red") : Ok());
        var dispatcher = Dispatcher(sender);
        outbox.Save(At(1));
        outbox.Save(At(2));
        outbox.Save(At(3));
        await dispatcher.Flush();
        Assert.Equal([Id(1), Id(2)], sender.Sent.ToArray());
        Assert.Equal(2, outbox.PendingCount());
        Assert.IsType<SendOutcome.Failed>(results.Last().Outcome);

        fail = false;
        await dispatcher.Flush();
        Assert.Equal(0, outbox.PendingCount());
        Assert.Equal([Id(1), Id(2), Id(2), Id(3)], sender.Sent.ToArray());
    }

    [Fact]
    public async Task RejectedContinuesWithTheNext()
    {
        var sender = new FakeSender(m => m.MinuteId == Id(1)
            ? new SendOutcome.Rejected("minute_empty", "nada", [])
            : Ok());
        var dispatcher = Dispatcher(sender);
        outbox.Save(At(1));
        outbox.Save(At(2));
        await dispatcher.Flush();
        Assert.Equal([Id(1), Id(2)], sender.Sent.ToArray());
        Assert.Single(Directory.GetFiles(outbox.RejectedPath, "*.error.json"));
        Assert.Equal(0, outbox.PendingCount());
    }

    [Fact]
    public async Task AlreadyRegisteredMovesToSent()
    {
        var sender = new FakeSender(_ => new SendOutcome.AlreadyRegistered());
        var dispatcher = Dispatcher(sender);
        await dispatcher.Enqueue(At(1));
        Assert.Equal(0, outbox.PendingCount());
        Assert.Single(Directory.GetFiles(outbox.SentPath, "*.json"));
    }

    [Fact]
    public async Task EnqueueDuringDrainIsSentInTheSameRun()
    {
        MinuteDispatcher? dispatcher = null;
        var sender = new FakeSender(_ => Ok());
        var enqueued = false;
        sender.OnSend = m =>
        {
            if (!enqueued)
            {
                enqueued = true;
                dispatcher!.Enqueue(At(2));
            }
        };
        dispatcher = Dispatcher(sender);
        await dispatcher.Enqueue(At(1));
        Assert.Equal([Id(1), Id(2)], sender.Sent.ToArray());
        Assert.Equal(0, outbox.PendingCount());
    }

    [Fact]
    public async Task DrainsDoNotOverlap()
    {
        var concurrent = 0;
        var peak = 0;
        var sender = new FakeSender(_ => Ok());
        sender.OnSend = _ =>
        {
            var now = Interlocked.Increment(ref concurrent);
            peak = Math.Max(peak, now);
            Thread.Sleep(20);
            Interlocked.Decrement(ref concurrent);
        };
        var dispatcher = Dispatcher(sender);
        var tasks = Enumerable.Range(1, 6).Select(i => Task.Run(() => dispatcher.Enqueue(At(i)))).ToArray();
        await Task.WhenAll(tasks);
        await dispatcher.Flush();
        Assert.Equal(1, peak);
        Assert.Equal(0, outbox.PendingCount());
        Assert.Equal(6, sender.Sent.Count);
    }

    [Fact]
    public async Task SenderExceptionBecomesFailed()
    {
        var sender = new FakeSender(_ => throw new InvalidOperationException("kaboom"));
        var dispatcher = Dispatcher(sender);
        await dispatcher.Enqueue(At(1));
        Assert.Equal(1, outbox.PendingCount());
        Assert.Contains("kaboom", Assert.IsType<SendOutcome.Failed>(results.Single().Outcome).Reason);
    }
}
