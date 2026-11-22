import type { Logger } from '@nestjs/common';
import {
  type AutodeskChange,
  type AutodeskChangeListener,
  type CellChange,
  type ChangeListener,
  editorLabel,
  type SheetChange,
} from '@team27/context-integrations';

export const LOGGED_CELLS = 10;

const shown = (value: CellChange['before']): string =>
  value === null ? '(vacía)' : JSON.stringify(value);

export const describeChange = (change: SheetChange): string => {
  const by = editorLabel(change.by);
  const title = `«${change.source.title}» cambió${by === null ? '' : ` (${by})`}`;
  if (change.cells === null) {
    return `${title}; no tenemos la revisión anterior para el detalle`;
  }
  const count = change.cells.length;
  const cells = change.cells
    .slice(0, LOGGED_CELLS)
    .map(
      (cell) => `${cell.locator}: ${shown(cell.before)} → ${shown(cell.after)}`,
    )
    .join('; ');
  const rest = count > LOGGED_CELLS ? ` y ${count - LOGGED_CELLS} más` : '';
  return `${title}: ${count === 1 ? '1 celda' : `${count} celdas`}. ${cells}${rest}`;
};

export class LoggingChangeListener implements ChangeListener {
  private readonly logger: Pick<Logger, 'log'>;

  constructor(logger: Pick<Logger, 'log'>) {
    this.logger = logger;
  }

  changed(change: SheetChange): Promise<void> {
    this.logger.log(describeChange(change));
    return Promise.resolve();
  }
}

export const ELEMENT_DIFF_PENDING = 'el diff por elemento queda pendiente';

const autodeskKind = (change: AutodeskChange): string =>
  change.kind === 'unknown' ? `${change.event} (sin clasificar)` : change.kind;

export const describeAutodeskChange = (change: AutodeskChange): string => {
  const { resource } = change;
  const target =
    resource.name !== null
      ? ` «${resource.name}»`
      : resource.urn !== null
        ? ` ${resource.urn}`
        : '';
  const version = resource.version === null ? '' : ` (v${resource.version})`;
  const actor = change.actorId === null ? '' : ` por ${change.actorId}`;
  const place = [resource.projectId, resource.parentFolderUrn].filter(
    (part): part is string => part !== null,
  );
  const where = place.length === 0 ? '' : ` en ${place.join(' / ')}`;
  const diff = change.needsElementDiff ? `; ${ELEMENT_DIFF_PENDING}` : '';
  return `Autodesk: ${autodeskKind(change)}${target}${version}${actor}${where}${diff}`;
};

export class LoggingAutodeskListener implements AutodeskChangeListener {
  private readonly logger: Pick<Logger, 'log'>;

  constructor(logger: Pick<Logger, 'log'>) {
    this.logger = logger;
  }

  changed(change: AutodeskChange): Promise<void> {
    this.logger.log(describeAutodeskChange(change));
    return Promise.resolve();
  }
}
