using static Team27.Minuta.Core.Tests.Support;

namespace Team27.Minuta.Core.Tests;

public class ReceiptTests
{
    [Fact]
    public void ParsesTheContractExample()
    {
        var receipt = ReceiptParser.Parse(File.ReadAllText(ContractFile("receipt.example.json")));
        Assert.Equal("modelo-revit", receipt.DocumentId);
        Assert.Equal("guardado 42", receipt.Label);
        Assert.Equal(2, receipt.Claims.Count);
        Assert.Equal("change", receipt.Claims[0].Outcome);
        Assert.Equal(20, receipt.Claims[0].Value);
        Assert.Equal(2, receipt.Proposals.Count);
        var first = receipt.Proposals[0];
        Assert.Equal(3636500, first.CostDelta);
        Assert.Equal(1, first.DelayDays);
        Assert.Equal(4, first.Reviewers.Count);
        Assert.Equal("Paula Rojas", first.Reviewers[0].Name);
        Assert.Equal($"/cambios/{first.ChangeId}", first.Link);
        Assert.Equal("marcos-fuentes", Assert.Single(receipt.Proposals[1].Filtered).StakeholderId);
        Assert.Empty(receipt.Discrepancies);
        Assert.Contains("2 cambios", receipt.Summary);
    }

    [Fact]
    public void IgnoresUnknownFieldsAndDefaultsMissingLists()
    {
        var receipt = ReceiptParser.Parse("""{"minuteId":"x","extra":{"a":1},"summary":"ok"}""");
        Assert.Equal("x", receipt.MinuteId);
        Assert.Equal("ok", receipt.Summary);
        Assert.Empty(receipt.Claims);
        Assert.Empty(receipt.Proposals);
        Assert.Empty(receipt.Backed);
        Assert.Empty(receipt.Stale);
        Assert.Empty(receipt.Ignored);
    }

    [Fact]
    public void NullLinkAndGarbageAreTolerated()
    {
        var receipt = ReceiptParser.Parse("""{"proposals":[{"id":"p","title":"t","link":null,"reviewers":null}]}""");
        Assert.Null(receipt.Proposals[0].Link);
        Assert.Empty(receipt.Proposals[0].Reviewers);
        Assert.Equal(Receipt.Empty, ReceiptParser.Parse("no es json"));
        Assert.Equal(Receipt.Empty, ReceiptParser.Parse(""));
        Assert.Equal(Receipt.Empty, ReceiptParser.Parse("[1]"));
    }
}
