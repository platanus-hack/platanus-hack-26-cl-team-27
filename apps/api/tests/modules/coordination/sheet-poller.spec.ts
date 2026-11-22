import {
  changedPrices,
  parseCsv,
  readPrices,
} from '../../../src/modules/coordination/sheet-poller.ts';

describe('SheetPoller', () => {
  it('lee los precios de la planilla y detecta cuál cambió', () => {
    const rows = parseCsv(
      '"Código","Descripción","Precio unitario"\n"03.02","Hormigón H30","$145,000"\n"03.03","Acero","$1,350"\n"06.01","Ventanas","$185,000"',
    );
    const before = readPrices(rows);
    expect(before.get('03.02')).toBe(145000);
    const after = new Map(before).set('03.02', 160000);
    expect(changedPrices(after, before)).toEqual(['03.02']);
  });
});
