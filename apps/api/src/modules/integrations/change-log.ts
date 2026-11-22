import type { Logger } from '@nestjs/common';
import type {
  CellChange,
  ChangeListener,
  SheetChange,
} from '@team27/context-integrations';

export const LOGGED_CELLS = 10;

const shown = (value: CellChange['before']): string =>
  value === null ? '(vacía)' : JSON.stringify(value);

export const describeChange = (change: SheetChange): string => {
  const title = `«${change.source.title}» cambió`;
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
