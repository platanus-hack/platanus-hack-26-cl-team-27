import { Api, ApiError, isSeatHeld, type RoomView } from '../load/api.ts';
import { ingestRevision, seedLake } from '../load/index.ts';
import {
  CARGA_INICIAL,
  isDone,
  nextPaso,
  PASOS,
  unmetRequirement,
  type Paso,
} from '../guion.ts';
import { Players } from '../players/players.ts';
import { SCENE_PAUSE_MS, scaled } from '../players/plan.ts';
import type { Extracted } from '../types.ts';
import { personName } from '../vocabulary.ts';
import {
  describeExtraction,
  describeLoad,
  describeProposalState,
  describeTotals,
  describeUpToDate,
  plural,
} from './format.ts';

export type Interrupt = 'saltar' | 'reabrir' | 'salir';

export interface SessionDeps {
  readonly api: Api;
  readonly items: ReadonlyMap<string, Extracted>;
  readonly players: Players;
  readonly out: (line: string) => void;
  readonly sleep: (ms: number) => Promise<void>;
  readonly interrupt?: () => Interrupt | null;
  readonly pollMs?: number;
}

export type StepOutcome =
  'cargado' | 'bloqueado' | 'ya-estaba' | 'fallido' | 'salir';

const QUIET_EVENTS: ReadonlySet<string> = new Set([
  'seat.claimed',
  'seat.released',
  'autoplay.changed',
  'scene.started',
]);

export class Session {
  private readonly deps: SessionDeps;

  constructor(deps: SessionDeps) {
    this.deps = deps;
  }

  private say(line = ''): void {
    this.deps.out(line);
  }

  async revisionsInLake(): Promise<Set<string>> {
    const view = await this.deps.api.spaces();
    const have = new Set<string>();
    for (const space of view.spaces) {
      for (const document of space.documents) {
        for (const revision of document.revisions) {
          have.add(`${document.id}|${revision.label}`);
        }
      }
    }
    return have;
  }

  private hasIn(have: ReadonlySet<string>) {
    return (documentId: string, label: string): boolean =>
      have.has(`${documentId}|${label}`);
  }

  async lakeIsEmpty(room?: RoomView): Promise<boolean> {
    const view = room ?? (await this.deps.api.room());
    if (view.lake) return view.lake.empty;
    return view.counters.documents === 0;
  }

  async cargaInicial(): Promise<boolean> {
    const files = CARGA_INICIAL.map((path) => this.item(path));
    this.say(
      `Carga inicial: ${plural(files.length, 'documento', 'documentos')} del lago.`,
    );
    for (const item of files) {
      this.say(
        `  ${describeExtraction(item.file.relativePath, item.revision)}`,
      );
    }
    try {
      await seedLake(
        this.deps.api,
        files.map((item) => item.revision),
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === 'lake_not_empty') {
        this.say(
          'El lago ya tiene datos. Para volver a empezar usa «pnpm etl reiniciar».',
        );
        return false;
      }
      throw error;
    }
    this.say(
      'Lo vigente quedó confirmado, con la procedencia de cada documento.',
    );
    return true;
  }

  async reiniciar(): Promise<void> {
    this.deps.players.stop();
    const { epoch } = await this.deps.api.reset();
    this.say(`Sala reiniciada (época ${epoch}).`);
    await this.deps.players.poll();
    await this.cargaInicial();
  }

  private item(path: string): Extracted {
    const found = this.deps.items.get(path);
    if (found === undefined) throw new Error(`No encuentro ${path} en el lago`);
    return found;
  }

  async runPaso(paso: Paso): Promise<StepOutcome> {
    const have = await this.revisionsInLake();
    const has = this.hasIn(have);
    this.say(`Paso ${paso.id} · ${paso.title}`);
    this.say(`  ${paso.hint}`);
    const unmet = unmetRequirement(paso, has);
    if (unmet) {
      this.say(
        `  Antes hay que cargar ${unmet.documentId} ${unmet.label}. Sigue el orden del guion.`,
      );
      return 'bloqueado';
    }
    if (isDone(paso, has, this.deps.items)) {
      this.say('  Ya está cargado en la sala.');
      return 'ya-estaba';
    }
    const first = await this.deps.players.poll();
    for (const note of first.notes) this.say(`  ${note}`);
    for (const path of paso.files) {
      const item = this.item(path);
      if (has(item.revision.documentId, item.revision.label)) {
        this.say(`  ${path} ya estaba cargado.`);
        continue;
      }
      this.say(`  ${describeExtraction(path, item.revision)}`);
      try {
        const response = await ingestRevision(this.deps.api, item.revision);
        for (const line of describeLoad(response)) this.say(`  ${line}`);
      } catch (error) {
        if (isSeatHeld(error)) {
          this.say(
            `  ${personName(item.revision.authorId)} la juega una persona: el ETL no sube documentos por ella.`,
          );
          return 'fallido';
        }
        if (error instanceof ApiError && error.code === 'already_ingested') {
          this.say(`  ${path} ya estaba cargado.`);
          continue;
        }
        if (error instanceof ApiError) {
          this.say(`  La API rechazó ${path}: ${error.message}`);
          return 'fallido';
        }
        throw error;
      }
    }
    const settled = await this.settle();
    if (settled === 'listo') {
      this.say(`  ${describeUpToDate(await this.deps.api.room())}`);
    }
    return settled === 'salir' ? 'salir' : 'cargado';
  }

  async settle(): Promise<'listo' | 'saltado' | 'salir'> {
    const pollMs = this.deps.pollMs ?? 600;
    for (;;) {
      const result = await this.deps.players.poll();
      for (const event of result.events) {
        if (!QUIET_EVENTS.has(event.kind)) this.say(`  · ${event.message}`);
      }
      for (const note of result.notes) this.say(`  ${note}`);
      if (
        !this.deps.players.hasActive(result.proposals) &&
        !this.deps.players.hasPendingWork()
      ) {
        return 'listo';
      }
      const interrupt = this.deps.interrupt?.() ?? null;
      if (interrupt === 'salir') return 'salir';
      if (interrupt === 'saltar') return 'saltado';
      if (interrupt === 'reabrir') {
        const count = await this.deps.players.reopenDisputed();
        this.say(
          count === 0
            ? '  No hay disputas que reabrir.'
            : `  Reabrí ${plural(count, 'propuesta', 'propuestas')}.`,
        );
      }
      await this.deps.sleep(pollMs);
    }
  }

  async reabrir(): Promise<void> {
    const count = await this.deps.players.reopenDisputed();
    this.say(
      count === 0
        ? 'No hay disputas que reabrir.'
        : `Reabrí ${plural(count, 'propuesta', 'propuestas')}.`,
    );
  }

  async nextPaso(): Promise<Paso | null> {
    return nextPaso(this.hasIn(await this.revisionsInLake()), this.deps.items);
  }

  async cierre(): Promise<void> {
    const room = await this.deps.api.room();
    this.say(`Obra consensuada: ${describeTotals(room)}.`);
  }

  async ensureSeeded(): Promise<void> {
    if (await this.lakeIsEmpty()) await this.cargaInicial();
  }

  async runAuto(speed: number): Promise<StepOutcome> {
    for (;;) {
      const paso = await this.nextPaso();
      if (paso === null) break;
      const outcome = await this.runPaso(paso);
      if (
        outcome === 'salir' ||
        outcome === 'fallido' ||
        outcome === 'bloqueado'
      ) {
        return outcome;
      }
      this.say();
      await this.deps.sleep(scaled(SCENE_PAUSE_MS, speed));
    }
    await this.cierre();
    return 'cargado';
  }

  async estado(): Promise<void> {
    const room = await this.deps.api.room();
    const empty = await this.lakeIsEmpty(room);
    this.say(`Sala de la obra · época ${room.epoch}`);
    if (empty) {
      this.say(
        'El lago está vacío: falta la carga inicial («pnpm etl reiniciar» o «pnpm etl»).',
      );
      return;
    }
    this.say(`  ${describeTotals(room)}`);
    this.say(
      `  ${plural(room.counters.openProposals, 'propuesta abierta', 'propuestas abiertas')} · ${plural(room.counters.openDiscrepancies, 'discrepancia abierta', 'discrepancias abiertas')} · ${plural(room.counters.stale, 'documento desfasado', 'documentos desfasados')}`,
    );
    const humans = room.cast
      .filter(
        (member) => member.occupied === true || member.occupant === 'human',
      )
      .map((member) => member.name);
    this.say(
      `  Asientos con persona: ${humans.length > 0 ? humans.join(', ') : 'ninguno, juegan los jugadores simulados'}`,
    );
    const has = this.hasIn(await this.revisionsInLake());
    this.say('Guion:');
    for (const paso of PASOS) {
      const state = isDone(paso, has, this.deps.items) ? 'listo' : 'pendiente';
      this.say(`  ${paso.id} · ${paso.title} · ${state}`);
    }
    const proposals = await this.deps.api.proposals();
    const active = proposals.filter(
      (proposal) =>
        proposal.status === 'open' || proposal.status === 'disputed',
    );
    if (active.length > 0) {
      this.say('Propuestas abiertas:');
      for (const proposal of active)
        this.say(`  ${describeProposalState(proposal)}`);
    }
  }
}
