using System.IO;
using System.Net.Http;
using Autodesk.Revit.ApplicationServices;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Events;
using Autodesk.Revit.UI;
using Team27.Minuta.Core;
using Settings = Team27.Minuta.Core.Settings;

namespace Team27.Minuta.Revit;

public sealed class App : IExternalApplication
{
    public static App? Current { get; private set; }

    internal Settings Settings { get; private set; } = new();

    internal Catalog Catalog { get; private set; } = Catalog.Default;

    internal IReadOnlyList<BuiltInCategory> Categories { get; private set; } = [];

    internal Log Log { get; } = Log.Default;

    internal Outbox Outbox { get; private set; } = new(Outbox.DefaultRoot);

    internal MinuteDispatcher Dispatcher { get; private set; } = null!;

    internal ChangeTracker Tracker { get; private set; } = null!;

    internal UiQueue Ui { get; private set; } = null!;

    internal FlowService Flow { get; private set; } = null!;

    private string? settingsError;
    private HttpClient? http;
    private ControlledApplication? controlled;

    public Result OnStartup(UIControlledApplication application)
    {
        try
        {
            Current = this;
            LoadSettings();
            Catalog = new Catalog(Settings.Subjects);
            Categories = RevitCategories.Parse(Settings.Categories, Log);
            http = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
            Ui = new UiQueue(Log);
            Ui.Attach();
            Dispatcher = new MinuteDispatcher(
                Outbox,
                new MinuteClient(http, Settings),
                result => Ui.Post(_ => Dialogs.ShowResult(this, result)),
                Log);
            Flow = new FlowService(Settings, new FlowClient(http, Settings), Ui, Log);
            var addin = new AddinInfo("Team27.Minuta", AddinVersion());
            Tracker = new ChangeTracker(
                new SnapshotReader(Settings, Catalog, Categories, Log),
                new MinuteBuilder(Catalog),
                application.ControlledApplication.VersionNumber,
                addin);
            controlled = application.ControlledApplication;
            controlled.DocumentOpened += OnDocumentOpened;
            controlled.DocumentCreated += OnDocumentCreated;
            controlled.DocumentChanged += OnDocumentChanged;
            controlled.DocumentSaved += OnDocumentSaved;
            controlled.DocumentSavedAs += OnDocumentSavedAs;
            controlled.DocumentSynchronizedWithCentral += OnDocumentSynchronized;
            controlled.DocumentClosing += OnDocumentClosing;
            Flow.StartPolling();
            Ribbon.Build(application, Log);
            Log.Info($"Add-in iniciado en Revit {application.ControlledApplication.VersionNumber}; API en {Settings.ApiUrl}");
            return Result.Succeeded;
        }
        catch (Exception ex)
        {
            Log.Error("El add-in no pudo iniciar", ex);
            return Result.Failed;
        }
    }

    public Result OnShutdown(UIControlledApplication application)
    {
        if (controlled is not null)
        {
            controlled.DocumentOpened -= OnDocumentOpened;
            controlled.DocumentCreated -= OnDocumentCreated;
            controlled.DocumentChanged -= OnDocumentChanged;
            controlled.DocumentSaved -= OnDocumentSaved;
            controlled.DocumentSavedAs -= OnDocumentSavedAs;
            controlled.DocumentSynchronizedWithCentral -= OnDocumentSynchronized;
            controlled.DocumentClosing -= OnDocumentClosing;
        }
        Flow?.Dispose();
        Ui?.Dispose();
        http?.Dispose();
        Current = null;
        return Result.Succeeded;
    }

    internal void Send(Minute minute)
    {
        if (Settings.SendOnSave)
        {
            _ = Dispatcher.Enqueue(minute);
        }
        else
        {
            Outbox.Save(minute);
        }
    }

    private void LoadSettings()
    {
        var folder = Path.GetDirectoryName(typeof(App).Assembly.Location) ?? AppContext.BaseDirectory;
        var path = Path.Combine(folder, Settings.FileName);
        try
        {
            Settings = Settings.Load(path);
        }
        catch (SettingsException ex)
        {
            settingsError = ex.Message;
            Settings = new Settings();
            Log.Error($"No pudimos leer {path}", ex);
        }
    }

    private static string AddinVersion()
    {
        var version = typeof(App).Assembly.GetName().Version;
        return version is null ? "1.0.0" : $"{version.Major}.{version.Minor}.{version.Build}";
    }

    private void OnDocumentOpened(object? sender, DocumentOpenedEventArgs e) =>
        Guard("abrir el modelo", () =>
        {
            if (e.Status == RevitAPIEventStatus.Succeeded)
            {
                Tracker.Start(e.Document);
                Flow.Start(e.Document);
            }
        });

    private void OnDocumentCreated(object? sender, DocumentCreatedEventArgs e) =>
        Guard("crear el modelo", () =>
        {
            if (e.Status == RevitAPIEventStatus.Succeeded)
            {
                Tracker.Start(e.Document);
                Flow.Start(e.Document);
            }
        });

    private void OnDocumentChanged(object? sender, DocumentChangedEventArgs e) =>
        Guard("registrar la operación", () => Tracker.Record(e.GetDocument(), e.GetTransactionNames()));

    private void OnDocumentSaved(object? sender, DocumentSavedEventArgs e) =>
        Guard("armar la minuta", () => Saved(e.Document, e.Status, MinuteTrigger.Save));

    private void OnDocumentSavedAs(object? sender, DocumentSavedAsEventArgs e) =>
        Guard("armar la minuta", () => Saved(e.Document, e.Status, MinuteTrigger.Save));

    private void OnDocumentSynchronized(object? sender, DocumentSynchronizedWithCentralEventArgs e) =>
        Guard("armar la minuta", () => Saved(e.Document, e.Status, MinuteTrigger.Sync));

    private void OnDocumentClosing(object? sender, DocumentClosingEventArgs e) =>
        Guard("cerrar el modelo", () =>
        {
            Tracker.Forget(e.Document);
            Flow.Forget(e.Document);
        });

    private void Saved(Document document, RevitAPIEventStatus status, string trigger)
    {
        if (status != RevitAPIEventStatus.Succeeded || !ChangeTracker.IsTracked(document))
        {
            return;
        }
        WarnSettingsOnce();
        Guard("armar la minuta del flujo", () => Flow.Saved(document));
        var minute = Tracker.TakeMinute(document, trigger);
        if (minute is null)
        {
            if (Settings.SendOnSave && Dispatcher.PendingCount > 0)
            {
                _ = Dispatcher.Flush();
            }
            return;
        }
        Log.Info($"Minuta {minute.MinuteId} con {minute.Changes.Count} cambios ({MinuteText.Label(minute)})");
        if (Settings.ConfirmBeforeSend && Settings.SendOnSave)
        {
            Ui.Post(ui =>
            {
                if (Dialogs.Confirm(this, minute))
                {
                    _ = Dispatcher.Enqueue(minute);
                }
                else
                {
                    Outbox.Save(minute);
                }
            });
            return;
        }
        Send(minute);
    }

    private void WarnSettingsOnce()
    {
        var error = settingsError;
        if (error is null)
        {
            return;
        }
        settingsError = null;
        Ui.Post(_ => Dialogs.ShowSettingsError(error));
    }

    private void Guard(string action, Action work)
    {
        try
        {
            work();
        }
        catch (Exception ex)
        {
            Log.Error($"Falló {action}", ex);
        }
    }
}
