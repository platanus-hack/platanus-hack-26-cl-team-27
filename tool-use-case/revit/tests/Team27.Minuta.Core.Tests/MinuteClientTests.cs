using System.Net;
using System.Text;
using static Team27.Minuta.Core.Tests.Support;

namespace Team27.Minuta.Core.Tests;

public class MinuteClientTests
{
    private sealed class FakeHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond;

        public FakeHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond)
        {
            this.respond = respond;
        }

        public HttpRequestMessage? Last { get; private set; }

        public string? LastBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Last = request;
            LastBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return await respond(request, cancellationToken);
        }
    }

    private static FakeHandler Responding(HttpStatusCode status, string body) =>
        new((_, _) => Task.FromResult(new HttpResponseMessage(status)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        }));

    private static MinuteClient Client(FakeHandler handler, Settings? settings = null) =>
        new(new HttpClient(handler), settings ?? new Settings());

    [Fact]
    public async Task SentOn201()
    {
        var handler = Responding(HttpStatusCode.Created, File.ReadAllText(ContractFile("receipt.example.json")));
        var outcome = await Client(handler).SendAsync(SampleMinute());
        var sent = Assert.IsType<SendOutcome.Sent>(outcome);
        Assert.Equal("modelo-revit", sent.Receipt.DocumentId);
    }

    [Fact]
    public async Task SendsUrlHeadersAndBody()
    {
        var handler = Responding(HttpStatusCode.Created, "{}");
        var minute = SampleMinute();
        await Client(handler).SendAsync(minute);
        Assert.Equal("http://localhost:3001/api/integrations/revit/minutes", handler.Last!.RequestUri!.ToString());
        Assert.Equal(HttpMethod.Post, handler.Last.Method);
        Assert.Equal("sala-los-aromos", handler.Last.Headers.GetValues("x-presenter-key").Single());
        Assert.Equal(minute.MinuteId, handler.Last.Headers.GetValues("x-action-id").Single());
        Assert.Equal(MinuteJson.Serialize(minute), handler.LastBody);
        Assert.Equal("application/json", handler.Last.Content!.Headers.ContentType!.MediaType);
    }

    [Theory]
    [InlineData("http://localhost:3001/api/")]
    [InlineData("http://localhost:3001/api")]
    public async Task ToleratesTrailingSlash(string apiUrl)
    {
        var handler = Responding(HttpStatusCode.Created, "{}");
        await Client(handler, new Settings { ApiUrl = apiUrl }).SendAsync(SampleMinute());
        Assert.Equal("http://localhost:3001/api/integrations/revit/minutes", handler.Last!.RequestUri!.ToString());
    }

    [Fact]
    public async Task OmitsPresenterKeyWhenEmpty()
    {
        var handler = Responding(HttpStatusCode.Created, "{}");
        await Client(handler, new Settings { PresenterKey = "" }).SendAsync(SampleMinute());
        Assert.False(handler.Last!.Headers.Contains("x-presenter-key"));
        Assert.True(handler.Last.Headers.Contains("x-action-id"));
    }

    [Fact]
    public async Task AlreadyRegisteredOn409AlreadyIngested()
    {
        var handler = Responding(HttpStatusCode.Conflict, """{"code":"already_ingested","message":"ya está"}""");
        Assert.IsType<SendOutcome.AlreadyRegistered>(await Client(handler).SendAsync(SampleMinute()));
    }

    [Fact]
    public async Task RejectedOnOtherConflict()
    {
        var handler = Responding(HttpStatusCode.Conflict, """{"code":"otro","message":"no"}""");
        var rejected = Assert.IsType<SendOutcome.Rejected>(await Client(handler).SendAsync(SampleMinute()));
        Assert.Equal("otro", rejected.Code);
    }

    [Fact]
    public async Task RejectedOn422WithIgnored()
    {
        var handler = Responding(
            HttpStatusCode.UnprocessableEntity,
            """{"code":"minute_empty","message":"Nada aplica","ignored":[{"subjectId":"x","attribute":"espesor_cm","reason":"no es del proyecto"}]}""");
        var rejected = Assert.IsType<SendOutcome.Rejected>(await Client(handler).SendAsync(SampleMinute()));
        Assert.Equal("minute_empty", rejected.Code);
        Assert.Equal("Nada aplica", rejected.Message);
        Assert.Equal("no es del proyecto", Assert.Single(rejected.Ignored).Reason);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "schema")]
    [InlineData(HttpStatusCode.Forbidden, "not_your_document")]
    public async Task RejectedOn400And403(HttpStatusCode status, string code)
    {
        var handler = Responding(status, $$"""{"code":"{{code}}","message":"m"}""");
        var rejected = Assert.IsType<SendOutcome.Rejected>(await Client(handler).SendAsync(SampleMinute()));
        Assert.Equal(code, rejected.Code);
    }

    [Fact]
    public async Task RejectedWithoutBodyUsesStatusCode()
    {
        var handler = Responding(HttpStatusCode.BadRequest, "");
        var rejected = Assert.IsType<SendOutcome.Rejected>(await Client(handler).SendAsync(SampleMinute()));
        Assert.Equal("http_400", rejected.Code);
        Assert.False(string.IsNullOrWhiteSpace(rejected.Message));
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, "presenterKey")]
    [InlineData(HttpStatusCode.NotFound, "ruta")]
    [InlineData(HttpStatusCode.RequestTimeout, "tardó")]
    [InlineData((HttpStatusCode)429, "esperar")]
    [InlineData(HttpStatusCode.InternalServerError, "500")]
    [InlineData(HttpStatusCode.BadGateway, "502")]
    public async Task FailedOnTransientStatus(HttpStatusCode status, string fragment)
    {
        var handler = Responding(status, "{}");
        var failed = Assert.IsType<SendOutcome.Failed>(await Client(handler).SendAsync(SampleMinute()));
        Assert.Contains(fragment, failed.Reason);
    }

    [Fact]
    public async Task FailedOnNetworkError()
    {
        var handler = new FakeHandler((_, _) => throw new HttpRequestException("boom"));
        var failed = Assert.IsType<SendOutcome.Failed>(await Client(handler).SendAsync(SampleMinute()));
        Assert.Contains("no pudimos conectar con la API en http://localhost:3001/api", failed.Reason);
    }

    [Fact]
    public async Task FailedOnTimeout()
    {
        var handler = new FakeHandler(async (_, token) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(30), token);
            return new HttpResponseMessage(HttpStatusCode.Created);
        });
        var client = Client(handler, new Settings { TimeoutSeconds = 1 });
        var failed = Assert.IsType<SendOutcome.Failed>(await client.SendAsync(SampleMinute()));
        Assert.Contains("no respondió en 1 s", failed.Reason);
    }

    [Fact]
    public async Task CallerCancellationPropagates()
    {
        var handler = new FakeHandler(async (_, token) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(30), token);
            return new HttpResponseMessage(HttpStatusCode.Created);
        });
        using var source = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => Client(handler).SendAsync(SampleMinute(), source.Token));
    }
}
