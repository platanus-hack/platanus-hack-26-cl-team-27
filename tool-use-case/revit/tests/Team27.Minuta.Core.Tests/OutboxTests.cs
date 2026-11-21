using static Team27.Minuta.Core.Tests.Support;

namespace Team27.Minuta.Core.Tests;

public class OutboxTests : IDisposable
{
    private readonly string root = TempDir();

    public void Dispose() => Directory.Delete(root, true);

    [Fact]
    public void SavesWithTimestampAndShortIdName()
    {
        var outbox = new Outbox(root);
        var item = outbox.Save(SampleMinute());
        Assert.Equal("20261121-173205-6f1c2b9e.json", Path.GetFileName(item.Path));
        Assert.Equal(Path.Combine(root, "pendientes"), Path.GetDirectoryName(item.Path));
        Assert.Empty(Directory.GetFiles(outbox.PendingPath, "*.tmp"));
    }

    [Fact]
    public void PendingIsChronological()
    {
        var outbox = new Outbox(root);
        var later = SampleMinute("bbbbbbbb-0000-4000-8000-000000000000", 2) with { CreatedAt = new DateTimeOffset(2026, 11, 21, 18, 0, 0, TimeSpan.Zero) };
        var earlier = SampleMinute("aaaaaaaa-0000-4000-8000-000000000000", 1);
        outbox.Save(later);
        outbox.Save(earlier);
        Assert.Equal(
            ["aaaaaaaa-0000-4000-8000-000000000000", "bbbbbbbb-0000-4000-8000-000000000000"],
            outbox.Pending().Select(p => p.Minute.MinuteId).ToArray());
    }

    [Fact]
    public void MarkSentMovesFileAndWritesReceipt()
    {
        var outbox = new Outbox(root);
        var item = outbox.Save(SampleMinute());
        var receipt = ReceiptParser.Parse(File.ReadAllText(ContractFile("receipt.example.json")));
        var target = outbox.MarkSent(item, receipt);
        Assert.False(File.Exists(item.Path));
        Assert.True(File.Exists(target));
        Assert.Equal(Path.Combine(root, "enviadas"), Path.GetDirectoryName(target));
        Assert.True(File.Exists(Path.Combine(root, "enviadas", "20261121-173205-6f1c2b9e.recibo.json")));
        Assert.Empty(outbox.Pending());
    }

    [Fact]
    public void MarkRejectedMovesFileAndWritesError()
    {
        var outbox = new Outbox(root);
        var item = outbox.Save(SampleMinute());
        outbox.MarkRejected(item, "minute_empty", "Nada aplica", [new IgnoredChange("x", "y", "z")]);
        var error = File.ReadAllText(Path.Combine(root, "rechazadas", "20261121-173205-6f1c2b9e.error.json"));
        Assert.Contains("minute_empty", error);
        Assert.Contains("Nada aplica", error);
        Assert.Equal(0, outbox.PendingCount());
    }

    [Fact]
    public void CorruptFilesAreQuarantined()
    {
        var outbox = new Outbox(root);
        Directory.CreateDirectory(outbox.PendingPath);
        File.WriteAllText(Path.Combine(outbox.PendingPath, "20260101-000000-roto.json"), "{ no");
        Assert.Empty(outbox.Pending());
        Assert.True(File.Exists(Path.Combine(outbox.RejectedPath, "20260101-000000-roto.json")));
    }

    [Fact]
    public void ConcurrentSavesAreSafe()
    {
        var outbox = new Outbox(root);
        Parallel.For(0, 20, i => outbox.Save(SampleMinute($"{i:00000000}-0000-4000-8000-000000000000", i)));
        Assert.Equal(20, outbox.Pending().Count);
    }
}
