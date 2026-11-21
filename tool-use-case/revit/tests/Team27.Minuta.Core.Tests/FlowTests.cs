using System.Text.Json;
using static Team27.Minuta.Core.Tests.Support;

namespace Team27.Minuta.Core.Tests;

public class FlowTests
{
    private const double Feet = 1 / 0.3048;

    private static ColumnSnapshot Columns(params (string Mark, double X, double Y, double Z)[] items) =>
        ColumnSnapshot.From(items.Select((c, i) => new ColumnPosition(c.Mark, i + 1, c.X, c.Y, c.Z)));

    [Fact]
    public void ConvertsFeetAndMeters()
    {
        Assert.Equal(0.3048, Units.FeetToMeters(1), 9);
        Assert.Equal(1.0, Units.MetersToFeet(0.3048), 9);
        Assert.Equal(0.4, Units.RoundMillimeters(Units.FeetToMeters(0.4 * Feet)));
    }

    [Fact]
    public void ReportsMovedColumnInMetersByMark()
    {
        var before = Columns(("P-12", 30 * Feet, 6 * Feet, 0), ("P-13", 36 * Feet, 6 * Feet, 0));
        var after = Columns(("P-12", 30 * Feet, 6.4 * Feet, 0), ("P-13", 36 * Feet, 6 * Feet, 0));
        var change = Assert.Single(ColumnDiff.Between(before, after, "Alinear"));
        Assert.Equal("P-12", change.ElementId);
        Assert.Equal("location", change.Attribute);
        Assert.Equal(new Delta(0, 0.4, 0), change.Delta);
        Assert.Equal("Alinear", change.Reason);
    }

    [Fact]
    public void ConvertsTheDeltaFromFeetNotJustCopiesIt()
    {
        var before = Columns(("P-12", 0, 0, 0));
        var after = Columns(("P-12", 0, 0.4 / 0.3048, 0));
        Assert.Equal(0.4, Assert.Single(ColumnDiff.Between(before, after)).Delta.Dy);
    }

    [Fact]
    public void IgnoresSubMillimeterNoiseNewColumnsAndRemovedOnes()
    {
        var before = Columns(("P-12", 10, 10, 0), ("P-99", 1, 1, 0));
        var after = Columns(("P-12", 10 + 1e-6, 10, 0), ("P-50", 5, 5, 0));
        Assert.Empty(ColumnDiff.Between(before, after));
    }

    [Fact]
    public void SnapshotSkipsUnmarkedAndKeepsFirstDuplicate()
    {
        var snapshot = ColumnSnapshot.From(
        [
            new ColumnPosition(" ", 1, 0, 0, 0),
            new ColumnPosition("P-1 ", 2, 1, 0, 0),
            new ColumnPosition("P-1", 3, 9, 0, 0),
        ]);
        Assert.Equal(2, Assert.Single(snapshot.Columns).Value.ElementId);
    }

    [Fact]
    public void RebasingOneMarkSilencesTheNextDiff()
    {
        var before = Columns(("E-B-03", 0, 0, 0));
        var moved = new ColumnPosition("E-B-03", 1, 0, 0.4 / 0.3048, 0);
        var rebased = before.With(moved);
        Assert.Empty(ColumnDiff.Between(rebased, Columns(("E-B-03", 0, 0.4 / 0.3048, 0))));
    }

    [Fact]
    public void BuildsTheContractBody()
    {
        var change = new FlowChange("P-12", "location", new Delta(0, 0.4, 0), "Alinear con el muro de corte M-6 y bajar la torsión");
        var minute = FlowMinute.Create("6f1c2b9e-3d4a-4f8b-9c1e-2a7d5b8e0f31", " LosAromos_EST ", "estructura", [change])!;
        var expected = JsonDocument.Parse(File.ReadAllText(ContractFile("flow-minute.example.json")));
        var actual = JsonDocument.Parse(FlowJson.Serialize(minute));
        Assert.Equal(Canonical(expected.RootElement), Canonical(actual.RootElement));
    }

    [Fact]
    public void FillsAReasonWhenThereIsNone()
    {
        var minute = FlowMinute.Create("id", "M", "estructura", [new FlowChange("P-12", "location", new Delta(0, 0.4, 0), null)])!;
        var change = JsonDocument.Parse(FlowJson.Serialize(minute)).RootElement.GetProperty("changes")[0];
        Assert.Equal(FlowMinute.DefaultReason, change.GetProperty("reason").GetString());
    }

    [Fact]
    public void LedgerSurvivesARestart()
    {
        var path = Path.Combine(Path.GetTempPath(), $"flow-applied-{Guid.NewGuid():N}.txt");
        try
        {
            new AppliedLedger(path).Add("ELEC", "p1");
            var reopened = new AppliedLedger(path);
            Assert.True(reopened.Contains("ELEC", "p1"));
            Assert.False(reopened.Contains("ELEC", "p2"));
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void NoChangesNoMinute() => Assert.Null(FlowMinute.Create("id", "M", "estructura", []));

    [Fact]
    public void ParsesTheProposalFromTheState()
    {
        var state = FlowStateParser.Parse(File.ReadAllText(ContractFile("flow-state.example.json")))!;
        var proposal = state.Proposal!;
        Assert.Equal("prop-1", proposal.Id);
        Assert.Equal("E-B-03", proposal.ElementId);
        Assert.Equal(new Delta(0, 0.4, 0), proposal.Delta);
        Assert.Equal("Camila Vera", proposal.DecidedByName);
    }

    [Theory]
    [InlineData("""{"proposal":null}""")]
    [InlineData("""{}""")]
    [InlineData("""{"proposal":{"id":"p","status":"aceptada"}}""")]
    public void StateWithoutUsableProposalHasNone(string json) => Assert.Null(FlowStateParser.Parse(json)!.Proposal);

    [Fact]
    public void GarbageIsNotAState()
    {
        Assert.Null(FlowStateParser.Parse("no"));
        Assert.Null(FlowStateParser.Parse("[]"));
    }

    [Theory]
    [InlineData("propuesta", false)]
    [InlineData("rechazada", false)]
    [InlineData("aceptada", true)]
    [InlineData("aplicada", true)]
    [InlineData("resuelta", true)]
    public void AppliesOnlyDecidedProposals(string status, bool expected)
    {
        var proposal = new FlowProposal("p1", "E-B-03", status, new Delta(0, 0.4, 0), null, null);
        Assert.Equal(expected, FlowPlanner.ShouldApply(proposal, "ELEC", new AppliedLedger()));
    }

    [Fact]
    public void AppliesEachProposalOncePerDocument()
    {
        var ledger = new AppliedLedger();
        var proposal = new FlowProposal("p1", "E-B-03", "aceptada", new Delta(0, 0.4, 0), null, null);
        Assert.True(FlowPlanner.ShouldApply(proposal, "ELEC", ledger));
        ledger.Add("ELEC", "p1");
        Assert.False(FlowPlanner.ShouldApply(proposal, "ELEC", ledger));
        Assert.True(FlowPlanner.ShouldApply(proposal, "OTRO", ledger));
        Assert.True(FlowPlanner.ShouldApply(proposal with { Id = "p2" }, "ELEC", ledger));
        ledger.Forget("ELEC");
        Assert.True(FlowPlanner.ShouldApply(proposal, "ELEC", ledger));
    }

    [Fact]
    public void NeverAppliesNothingOrAZeroMove()
    {
        Assert.False(FlowPlanner.ShouldApply(null, "ELEC", new AppliedLedger()));
        Assert.False(FlowPlanner.ShouldApply(new FlowProposal("p", "E", "aceptada", new Delta(0, 0, 0), null, null), "ELEC", new AppliedLedger()));
    }

    [Fact]
    public void ConvertsTheProposalToFeetForRevit()
    {
        var feet = FlowPlanner.ToFeet(new Delta(0, 0.4, 0));
        Assert.Equal(0, feet.Dx);
        Assert.Equal(0.4 / 0.3048, feet.Dy, 9);
    }

    [Fact]
    public void WritesTheNoticesInSpanish()
    {
        var proposal = new FlowProposal("p", "E-B-03", "aceptada", new Delta(0, 0.4, 0), "camila-vera", "Camila Vera");
        Assert.Equal("Vigente aplicó la propuesta aceptada por Camila Vera", FlowPlanner.Notice(proposal));
        Assert.Equal("Vigente aplicó la propuesta aceptada", FlowPlanner.Notice(proposal with { DecidedByName = null }));
        Assert.Equal("P-12 se movió 0,40 m al norte", FlowText.Moved("P-12", new Delta(0, 0.4, 0)));
        Assert.Equal("X se movió 1,50 m al oeste y 0,20 m hacia abajo", FlowText.Moved("X", new Delta(-1.5, 0, -0.2)));
    }

    [Fact]
    public void FindsTheModelBySeatConfiguration()
    {
        var flow = Settings.Parse("{}").Flow;
        Assert.Equal("paula-rojas", flow.Find("LosAromos_EST")!.Seat);
        Assert.Equal("camila-vera", flow.Find("losaromos_elec")!.Seat);
        Assert.Null(flow.Find("Westin"));
        Assert.Null(flow.Find(null));
    }

    [Fact]
    public void ParsesFlowSettings()
    {
        var flow = Settings.Parse("""
            { "flow": { "pollSeconds": 5, "models": [ { "titleContains": "ARQ", "seat": "fernanda-lagos", "discipline": "arquitectura", "sends": false } ] } }
            """).Flow;
        Assert.Equal(5, flow.PollSeconds);
        var model = Assert.Single(flow.Models);
        Assert.Equal(new FlowModelSetting("ARQ", "fernanda-lagos", "arquitectura", null, false, true), model);
    }

    [Theory]
    [InlineData("""{"flow":{"pollSeconds":0}}""", "pollSeconds")]
    [InlineData("""{"flow":{"models":[{"seat":"x"}]}}""", "titleContains")]
    public void InvalidFlowSettingsThrow(string json, string fragment) =>
        Assert.Contains(fragment, Assert.Throws<SettingsException>(() => Settings.Parse(json)).Message);

    private sealed class FakeApi : IFlowApi
    {
        public List<(string Id, string Seat)> Posts { get; } = [];
        public Queue<FlowSendOutcome> Outcomes { get; } = new();

        public Task<FlowSendOutcome> PostMinuteAsync(FlowMinute minute, string seat, CancellationToken cancellationToken = default)
        {
            Posts.Add((minute.MinuteId, seat));
            return Task.FromResult(Outcomes.Count > 0 ? Outcomes.Dequeue() : new FlowSendOutcome.Sent());
        }

        public Task<FlowState?> GetStateAsync(string seat, CancellationToken cancellationToken = default) =>
            Task.FromResult<FlowState?>(null);
    }

    private static FlowMinute Minute(string id) =>
        FlowMinute.Create(id, "M", "estructura", [new FlowChange("P-12", "location", new Delta(0, 0.4, 0), null)])!;

    [Fact]
    public async Task RetriesAFailedMinuteWithTheSameIdAndReportsOnce()
    {
        var api = new FakeApi();
        api.Outcomes.Enqueue(new FlowSendOutcome.Failed("sin red"));
        var reports = new List<FlowDispatch>();
        var dispatcher = new FlowDispatcher(api, reports.Add, new Log(Path.Combine(TempDir(), "log")));
        await dispatcher.SubmitAsync(Minute("a"), "paula-rojas");
        Assert.Equal(1, dispatcher.PendingCount);
        Assert.Empty(reports);
        await dispatcher.FlushAsync();
        Assert.Equal(0, dispatcher.PendingCount);
        Assert.Equal([("a", "paula-rojas"), ("a", "paula-rojas")], api.Posts);
        Assert.Single(reports);
    }

    [Fact]
    public async Task RejectedMinutesAreReportedAndNotRetried()
    {
        var api = new FakeApi();
        api.Outcomes.Enqueue(new FlowSendOutcome.Rejected("http_403", "no eres el dueño"));
        var reports = new List<FlowDispatch>();
        var dispatcher = new FlowDispatcher(api, reports.Add, new Log(Path.Combine(TempDir(), "log")));
        await dispatcher.SubmitAsync(Minute("a"), "camila-vera");
        await dispatcher.FlushAsync();
        Assert.Single(api.Posts);
        Assert.IsType<FlowSendOutcome.Rejected>(Assert.Single(reports).Outcome);
    }

    private static string Canonical(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.Object => "{" + string.Join(",", element.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal).Select(p => $"\"{p.Name}\":{Canonical(p.Value)}")) + "}",
        JsonValueKind.Array => "[" + string.Join(",", element.EnumerateArray().Select(Canonical)) + "]",
        JsonValueKind.Number => element.GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture),
        _ => element.GetRawText(),
    };
}
