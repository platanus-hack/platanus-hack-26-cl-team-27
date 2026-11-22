import {
  AutodeskEventError,
  parseAutodeskWebhook,
} from '../../src/domain/autodesk/AutodeskChange.ts';
import {
  AUTODESK_EVENTS,
  defineAutodeskEvent,
} from '../../src/domain/autodesk/AutodeskEvent.ts';

const LINEAGE = 'urn:adsk.wipprod:dm.lineage:hC6k4hndRWaeIVhIjvHu8w';

const versionAdded = {
  version: '1.0',
  resourceUrn: LINEAGE,
  hook: {
    hookId: 'hook-1',
    system: 'data',
    event: 'dm.version.added',
    createdDate: '2026-11-21T10:00:00.000+0000',
  },
  payload: {
    ext: 'rvt',
    name: 'LosAromos_ARQ.rvt',
    lineageUrn: LINEAGE,
    source: 'urn:adsk.wipprod:fs.file:vf.hC6k4hndRWaeIVhIjvHu8w?version=8',
    version: '8',
    modifiedTime: '2026-11-21T20:15:03+0000',
    parentFolderUrn: 'urn:adsk.wipprod:fs.folder:co.folder',
    project: 'b.project-1',
    user_info: { id: 'AUTODESK-USER-1' },
  },
};

describe('defineAutodeskEvent', () => {
  it('clasifica todos los eventos del catálogo', () => {
    for (const [event, definition] of Object.entries(AUTODESK_EVENTS)) {
      expect(defineAutodeskEvent(event)).toBe(definition);
      expect(definition.kind).not.toBe('unknown');
    }
  });

  it('agrupa los eventos de Cost Management', () => {
    expect(defineAutodeskEvent('budget.updated-1.0').kind).toBe('cost.changed');
    expect(
      defineAutodeskEvent('algo-nuevo-1.0', 'autodesk.construction.cost').kind,
    ).toBe('cost.changed');
  });

  it('un evento nuevo no se pierde: queda como desconocido', () => {
    expect(defineAutodeskEvent('dm.algo.raro').kind).toBe('unknown');
  });
});

describe('parseAutodeskWebhook', () => {
  it('una versión nueva de un .rvt es un modelo que pide el diff por elemento', () => {
    const change = parseAutodeskWebhook(versionAdded);

    expect(change).toMatchObject({
      kind: 'version.added',
      event: 'dm.version.added',
      source: 'data_management',
      hookId: 'hook-1',
      occurredAt: '2026-11-21T20:15:03.000Z',
      actorId: 'AUTODESK-USER-1',
      needsElementDiff: true,
      dedupeKey: `dm.version.added|${LINEAGE}|v8`,
    });
    expect(change.resource).toEqual({
      kind: 'model',
      urn: 'urn:adsk.wipprod:fs.file:vf.hC6k4hndRWaeIVhIjvHu8w?version=8',
      lineageUrn: LINEAGE,
      name: 'LosAromos_ARQ.rvt',
      extension: 'rvt',
      version: 8,
      parentFolderUrn: 'urn:adsk.wipprod:fs.folder:co.folder',
      projectId: 'b.project-1',
    });
  });

  it('saca la versión del source cuando no viene aparte', () => {
    const change = parseAutodeskWebhook({
      ...versionAdded,
      payload: { ...versionAdded.payload, version: undefined },
    });
    expect(change.resource.version).toBe(8);
  });

  it('un PDF nuevo es un archivo y no pide el diff', () => {
    const change = parseAutodeskWebhook({
      ...versionAdded,
      payload: { ...versionAdded.payload, ext: 'pdf', name: 'E-102_revC.pdf' },
    });
    expect(change.resource.kind).toBe('file');
    expect(change.needsElementDiff).toBe(false);
  });

  it('el mismo evento repetido da la misma llave para descartar duplicados', () => {
    expect(parseAutodeskWebhook(versionAdded).dedupeKey).toBe(
      parseAutodeskWebhook(structuredClone(versionAdded)).dedupeKey,
    );
  });

  it('un bloqueo del archivo no pide el diff', () => {
    const change = parseAutodeskWebhook({
      ...versionAdded,
      hook: { ...versionAdded.hook, event: 'dm.lineage.reserved' },
    });
    expect(change.kind).toBe('item.locked');
    expect(change.needsElementDiff).toBe(false);
  });

  it('una sincronización de Revit en la nube pide el diff', () => {
    const change = parseAutodeskWebhook({
      hook: { hookId: 'hook-2', system: 'adsk.c4r', event: 'model.sync' },
      payload: { name: 'LosAromos_EST.rvt', modifiedTime: 1795290000000 },
    });
    expect(change).toMatchObject({
      kind: 'model.synced',
      source: 'revit_cloud',
      needsElementDiff: true,
      occurredAt: new Date(1795290000000).toISOString(),
    });
    expect(change.resource.kind).toBe('model');
  });

  it('una incidencia de ACC es una incidencia', () => {
    const change = parseAutodeskWebhook({
      hook: {
        hookId: 'hook-3',
        system: 'autodesk.construction.issues',
        event: 'issue.updated-1.0',
      },
      payload: {
        id: 'issue-42',
        title: 'Choque P-12 con bandeja',
        updatedAt: '2026-11-21T21:00:00Z',
        updatedBy: 'AUTODESK-USER-2',
      },
    });
    expect(change).toMatchObject({
      kind: 'issue.updated',
      source: 'acc_issues',
      actorId: 'AUTODESK-USER-2',
      needsElementDiff: false,
    });
    expect(change.resource).toMatchObject({
      kind: 'issue',
      urn: 'issue-42',
      name: 'Choque P-12 con bandeja',
    });
  });

  it('rechaza un cuerpo que no es un webhook', () => {
    expect(() => parseAutodeskWebhook('hola')).toThrow(AutodeskEventError);
    expect(() => parseAutodeskWebhook({ hook: {} })).toThrow(
      'El webhook no dice qué evento es',
    );
  });
});
