using System.Collections.Concurrent;
using Autodesk.Revit.UI;
using Team27.Minuta.Core;

namespace Team27.Minuta.Revit;

internal sealed class UiQueue : IExternalEventHandler, IDisposable
{
    private readonly ConcurrentQueue<Action<UIApplication>> actions = new();
    private readonly Log log;
    private ExternalEvent? externalEvent;

    public UiQueue(Log log)
    {
        this.log = log;
    }

    public void Attach()
    {
        externalEvent = ExternalEvent.Create(this);
    }

    public void Post(Action<UIApplication> action)
    {
        actions.Enqueue(action);
        var request = externalEvent?.Raise();
        if (request is ExternalEventRequest.Denied or ExternalEventRequest.TimedOut)
        {
            log.Error($"Revit no aceptó mostrar el resultado ({request})");
        }
    }

    public void Execute(UIApplication app)
    {
        while (actions.TryDequeue(out var action))
        {
            try
            {
                action(app);
            }
            catch (Exception ex)
            {
                log.Error("Falló una acción en la interfaz de Revit", ex);
            }
        }
    }

    public string GetName() => "Team 27 · Minuta de cambios";

    public void Dispose()
    {
        externalEvent?.Dispose();
        externalEvent = null;
    }
}
