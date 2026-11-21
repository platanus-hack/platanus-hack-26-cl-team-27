namespace Team27.Minuta.Core;

public sealed record DispatchResult(PendingMinute Item, SendOutcome Outcome);

public sealed class MinuteDispatcher
{
    private readonly Outbox outbox;
    private readonly IMinuteSender sender;
    private readonly Action<DispatchResult> report;
    private readonly Log? log;
    private readonly object gate = new();
    private bool running;
    private bool rerun;
    private Task current = Task.CompletedTask;

    public MinuteDispatcher(Outbox outbox, IMinuteSender sender, Action<DispatchResult> report, Log? log = null)
    {
        this.outbox = outbox;
        this.sender = sender;
        this.report = report;
        this.log = log;
    }

    public int PendingCount => outbox.PendingCount();

    public Task Enqueue(Minute minute)
    {
        outbox.Save(minute);
        return Flush();
    }

    public Task Flush()
    {
        lock (gate)
        {
            if (running)
            {
                rerun = true;
                return current;
            }
            running = true;
            rerun = false;
            current = Task.Run(Loop);
            return current;
        }
    }

    private async Task Loop()
    {
        while (true)
        {
            try
            {
                await DrainOnce().ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                log?.Error("El envío de minutas falló", ex);
            }
            lock (gate)
            {
                if (!rerun)
                {
                    running = false;
                    return;
                }
                rerun = false;
            }
        }
    }

    private async Task DrainOnce()
    {
        foreach (var item in outbox.Pending())
        {
            SendOutcome outcome;
            try
            {
                outcome = await sender.SendAsync(item.Minute).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                outcome = new SendOutcome.Failed(ex.Message);
            }
            switch (outcome)
            {
                case SendOutcome.Sent sent:
                    outbox.MarkSent(item, sent.Receipt);
                    break;
                case SendOutcome.AlreadyRegistered:
                    outbox.MarkSent(item, null);
                    break;
                case SendOutcome.Rejected rejected:
                    outbox.MarkRejected(item, rejected.Code, rejected.Message, rejected.Ignored);
                    break;
            }
            Report(new DispatchResult(item, outcome));
            if (outcome is SendOutcome.Failed)
            {
                return;
            }
        }
    }

    private void Report(DispatchResult result)
    {
        try
        {
            report(result);
        }
        catch (Exception ex)
        {
            log?.Error("El aviso de resultado falló", ex);
        }
    }
}
