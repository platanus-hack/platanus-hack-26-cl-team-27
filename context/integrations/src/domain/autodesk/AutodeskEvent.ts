export type AutodeskSource =
  | 'data_management'
  | 'model_derivative'
  | 'revit_cloud'
  | 'acc_issues'
  | 'acc_cost'
  | 'unknown';

export type AutodeskResourceKind =
  'file' | 'folder' | 'model' | 'issue' | 'budget' | 'operation' | 'unknown';

export type AutodeskChangeKind =
  | 'version.added'
  | 'version.modified'
  | 'version.deleted'
  | 'version.moved'
  | 'version.copied'
  | 'item.updated'
  | 'item.locked'
  | 'item.unlocked'
  | 'folder.added'
  | 'folder.modified'
  | 'folder.deleted'
  | 'folder.purged'
  | 'folder.moved'
  | 'folder.copied'
  | 'operation.started'
  | 'operation.completed'
  | 'derivative.ready'
  | 'derivative.updated'
  | 'model.synced'
  | 'model.published'
  | 'issue.created'
  | 'issue.updated'
  | 'issue.deleted'
  | 'issue.restored'
  | 'issue.unlinked'
  | 'cost.changed'
  | 'unknown';

export interface AutodeskEventDefinition {
  readonly kind: AutodeskChangeKind;
  readonly source: AutodeskSource;
  readonly resource: AutodeskResourceKind;
  readonly description: string;
}

const definition = (
  kind: AutodeskChangeKind,
  source: AutodeskSource,
  resource: AutodeskResourceKind,
  description: string,
): AutodeskEventDefinition => ({ kind, source, resource, description });

export const AUTODESK_EVENTS: Readonly<
  Record<string, AutodeskEventDefinition>
> = {
  'dm.version.added': definition(
    'version.added',
    'data_management',
    'file',
    'Se subió un archivo o una versión nueva',
  ),
  'dm.version.modified': definition(
    'version.modified',
    'data_management',
    'file',
    'Cambiaron los datos de una versión (nombre, atributos, metadatos)',
  ),
  'dm.version.deleted': definition(
    'version.deleted',
    'data_management',
    'file',
    'Se borró una versión o el archivo',
  ),
  'dm.version.moved': definition(
    'version.moved',
    'data_management',
    'file',
    'El archivo llegó a esta carpeta desde otra',
  ),
  'dm.version.moved.out': definition(
    'version.moved',
    'data_management',
    'file',
    'El archivo salió de esta carpeta hacia otra',
  ),
  'dm.version.copied': definition(
    'version.copied',
    'data_management',
    'file',
    'Se copió un archivo a esta carpeta',
  ),
  'dm.version.copied.out': definition(
    'version.copied',
    'data_management',
    'file',
    'Se copió un archivo de esta carpeta a otra',
  ),
  'dm.lineage.updated': definition(
    'item.updated',
    'data_management',
    'file',
    'Cambiaron los datos del archivo (todas sus versiones)',
  ),
  'dm.lineage.reserved': definition(
    'item.locked',
    'data_management',
    'file',
    'Alguien bloqueó el archivo para editarlo',
  ),
  'dm.lineage.unreserved': definition(
    'item.unlocked',
    'data_management',
    'file',
    'Se liberó el bloqueo del archivo',
  ),
  'dm.folder.added': definition(
    'folder.added',
    'data_management',
    'folder',
    'Se creó una carpeta',
  ),
  'dm.folder.modified': definition(
    'folder.modified',
    'data_management',
    'folder',
    'Cambiaron los datos de una carpeta',
  ),
  'dm.folder.deleted': definition(
    'folder.deleted',
    'data_management',
    'folder',
    'Se borró una carpeta',
  ),
  'dm.folder.purged': definition(
    'folder.purged',
    'data_management',
    'folder',
    'Se eliminó para siempre una carpeta',
  ),
  'dm.folder.moved': definition(
    'folder.moved',
    'data_management',
    'folder',
    'Una carpeta llegó aquí desde otra',
  ),
  'dm.folder.moved.out': definition(
    'folder.moved',
    'data_management',
    'folder',
    'Una carpeta salió de aquí hacia otra',
  ),
  'dm.folder.copied': definition(
    'folder.copied',
    'data_management',
    'folder',
    'Se copió una carpeta aquí',
  ),
  'dm.folder.copied.out': definition(
    'folder.copied',
    'data_management',
    'folder',
    'Se copió una carpeta de aquí a otra',
  ),
  'dm.operation.started': definition(
    'operation.started',
    'data_management',
    'operation',
    'Empezó una operación larga (copia o movimiento de muchos archivos)',
  ),
  'dm.operation.completed': definition(
    'operation.completed',
    'data_management',
    'operation',
    'Terminó una operación larga',
  ),
  'extraction.finished': definition(
    'derivative.ready',
    'model_derivative',
    'model',
    'Autodesk terminó de procesar el modelo (visor y propiedades)',
  ),
  'extraction.updated': definition(
    'derivative.updated',
    'model_derivative',
    'model',
    'Avanzó el procesamiento del modelo',
  ),
  'model.sync': definition(
    'model.synced',
    'revit_cloud',
    'model',
    'Alguien sincronizó el modelo de Revit en la nube',
  ),
  'model.publish': definition(
    'model.published',
    'revit_cloud',
    'model',
    'Se publicó el modelo de Revit en la nube',
  ),
  'issue.created-1.0': definition(
    'issue.created',
    'acc_issues',
    'issue',
    'Se creó una incidencia',
  ),
  'issue.updated-1.0': definition(
    'issue.updated',
    'acc_issues',
    'issue',
    'Cambió una incidencia (estado, responsable, fecha, campos)',
  ),
  'issue.deleted-1.0': definition(
    'issue.deleted',
    'acc_issues',
    'issue',
    'Se borró una incidencia',
  ),
  'issue.restored-1.0': definition(
    'issue.restored',
    'acc_issues',
    'issue',
    'Se restauró una incidencia borrada',
  ),
  'issue.unlinked-1.0': definition(
    'issue.unlinked',
    'acc_issues',
    'issue',
    'Se desvinculó una incidencia de su documento',
  ),
};

const COST_PREFIXES = [
  'budget.',
  'contract.',
  'cost.',
  'changeorder.',
  'expense.',
  'payment.',
];

const UNKNOWN: AutodeskEventDefinition = definition(
  'unknown',
  'unknown',
  'unknown',
  'Evento de Autodesk que Vigente todavía no clasifica',
);

const COST: AutodeskEventDefinition = definition(
  'cost.changed',
  'acc_cost',
  'budget',
  'Cambió algo en Cost Management (presupuesto, contrato, orden de cambio, gasto o pago)',
);

export const defineAutodeskEvent = (
  event: string,
  system?: string | null,
): AutodeskEventDefinition => {
  const known = AUTODESK_EVENTS[event];
  if (known) return known;
  const lower = event.toLowerCase();
  if (
    system === 'autodesk.construction.cost' ||
    COST_PREFIXES.some((prefix) => lower.startsWith(prefix))
  ) {
    return COST;
  }
  return UNKNOWN;
};

export const MODEL_EXTENSIONS: readonly string[] = ['rvt', 'nwd', 'nwc', 'ifc'];

export const ELEMENT_DIFF_KINDS: readonly AutodeskChangeKind[] = [
  'version.added',
  'model.synced',
  'model.published',
  'derivative.ready',
];
