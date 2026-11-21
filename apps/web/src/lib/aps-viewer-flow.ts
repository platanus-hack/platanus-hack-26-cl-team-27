import type { Discipline, ViewerModel } from './aps-api';
import {
  createViewerControls,
  globals,
  initializeViewer,
  loadDocument,
  pick3dView,
  type AccessToken,
  type AutodeskViewing,
  type ElementProperties,
  type ElementRef,
  type HighlightColor,
  type Viewer3D,
  type ViewerControls,
  type ViewerModelHandle,
} from './aps-viewer';

export type Vec3 = readonly [number, number, number];

export interface Box3M {
  readonly min: Vec3;
  readonly max: Vec3;
}

export interface Delta {
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
}

export interface AxisMap {
  readonly x: Vec3;
  readonly y: Vec3;
  readonly z: Vec3;
}

export const DEFAULT_AXES: AxisMap = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

export const axesRotatedBy = (degrees: number): AxisMap => {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: [cos, sin, 0], y: [-sin, cos, 0], z: [0, 0, 1] };
};

export const CASE_FILES: Readonly<Partial<Record<Discipline, string>>> = {
  structural: 'caso-estructura',
  electrical: 'caso-electrico',
};

export const CASE_ELEMENT_DISCIPLINE: Readonly<Record<string, Discipline>> = {
  'P-12': 'structural',
  'E-B-03': 'electrical',
};

export const selectCaseModels = (
  models: readonly ViewerModel[],
): ViewerModel[] => {
  const found: ViewerModel[] = [];
  for (const [discipline, prefix] of Object.entries(CASE_FILES)) {
    const model = models.find(
      (candidate) =>
        candidate.discipline === discipline &&
        candidate.file.toLowerCase().startsWith(prefix),
    );
    if (model) found.push(model);
  }
  return found;
};

export const metersPerUnit = (
  unitString: string | null | undefined,
  unitScale?: number | null,
): number => {
  if (unitScale && Number.isFinite(unitScale) && unitScale > 0) {
    return unitScale;
  }
  const unit = (unitString ?? '').toLowerCase();
  if (unit.includes('ft') || unit.includes('feet') || unit.includes('foot')) {
    return 0.3048;
  }
  if (unit === 'in' || unit.includes('inch')) return 0.0254;
  if (unit === 'mm' || unit.includes('millimet')) return 0.001;
  if (unit === 'cm' || unit.includes('centimet')) return 0.01;
  return 1;
};

export const metersToUnits = (meters: number, perUnit: number): number =>
  meters / perUnit;

export const unitsToMeters = (units: number, perUnit: number): number =>
  units * perUnit;

export const rotateDelta = (
  delta: Delta,
  axes: AxisMap = DEFAULT_AXES,
): Vec3 => [
  delta.dx * axes.x[0] + delta.dy * axes.y[0] + delta.dz * axes.z[0],
  delta.dx * axes.x[1] + delta.dy * axes.y[1] + delta.dz * axes.z[1],
  delta.dx * axes.x[2] + delta.dy * axes.y[2] + delta.dz * axes.z[2],
];

export const deltaToViewerUnits = (
  delta: Delta,
  perUnit: number,
  axes: AxisMap = DEFAULT_AXES,
): Vec3 => {
  const [x, y, z] = rotateDelta(delta, axes);
  return [
    metersToUnits(x, perUnit),
    metersToUnits(y, perUnit),
    metersToUnits(z, perUnit),
  ];
};

export const unionBoxes = (boxes: readonly Box3M[]): Box3M | null => {
  const [first, ...rest] = boxes;
  if (!first) return null;
  let min = [...first.min] as [number, number, number];
  let max = [...first.max] as [number, number, number];
  for (const box of rest) {
    min = min.map((value, i) => Math.min(value, box.min[i] ?? value)) as [
      number,
      number,
      number,
    ];
    max = max.map((value, i) => Math.max(value, box.max[i] ?? value)) as [
      number,
      number,
      number,
    ];
  }
  return { min, max };
};

export const toWorldMeters = (
  viewerBox: Box3M,
  globalOffset: { x: number; y: number; z: number } | undefined,
  perUnit: number,
): Box3M => {
  const offset: Vec3 = globalOffset
    ? [globalOffset.x, globalOffset.y, globalOffset.z]
    : [0, 0, 0];
  const convert = (point: Vec3): Vec3 => [
    unitsToMeters(point[0] + offset[0], perUnit),
    unitsToMeters(point[1] + offset[1], perUnit),
    unitsToMeters(point[2] + offset[2], perUnit),
  ];
  return { min: convert(viewerBox.min), max: convert(viewerBox.max) };
};

export const shiftBox = (box: Box3M, delta: Delta): Box3M => ({
  min: [box.min[0] + delta.dx, box.min[1] + delta.dy, box.min[2] + delta.dz],
  max: [box.max[0] + delta.dx, box.max[1] + delta.dy, box.max[2] + delta.dz],
});

export const ZERO_DELTA: Delta = { dx: 0, dy: 0, dz: 0 };

export const sameDelta = (a: Delta, b: Delta, tolerance = 1e-9): boolean =>
  Math.abs(a.dx - b.dx) <= tolerance &&
  Math.abs(a.dy - b.dy) <= tolerance &&
  Math.abs(a.dz - b.dz) <= tolerance;

export const lerpDelta = (from: Delta, to: Delta, t: number): Delta => ({
  dx: from.dx + (to.dx - from.dx) * t,
  dy: from.dy + (to.dy - from.dy) * t,
  dz: from.dz + (to.dz - from.dz) * t,
});

export const easeInOut = (t: number): number =>
  t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

export interface CaseFlowState {
  readonly change: null | {
    readonly elementId: string;
    readonly delta: Delta;
  };
  readonly clash: null | {
    readonly status: 'detectada' | 'resuelta';
    readonly a?: string;
    readonly b?: string;
  };
  readonly proposal: null | {
    readonly elementId: string;
    readonly delta: Delta;
    readonly status:
      'propuesta' | 'aceptada' | 'aplicada' | 'resuelta' | 'rechazada';
  };
}

export type CaseTone = 'clash' | 'fix';

export interface ScenePlan {
  readonly moves: Readonly<Record<string, Delta>>;
  readonly tones: Readonly<Record<string, CaseTone>>;
}

export const APPLIED_STATUSES: readonly string[] = ['aplicada', 'resuelta'];

export const EMPTY_PLAN: ScenePlan = { moves: {}, tones: {} };

export const planScene = (flow: CaseFlowState | null): ScenePlan => {
  if (!flow) return EMPTY_PLAN;
  const moves: Record<string, Delta> = {};
  const tones: Record<string, CaseTone> = {};
  if (flow.change) moves[flow.change.elementId] = flow.change.delta;
  const applied =
    flow.proposal !== null && APPLIED_STATUSES.includes(flow.proposal.status);
  if (flow.proposal && applied) {
    moves[flow.proposal.elementId] = flow.proposal.delta;
    tones[flow.proposal.elementId] = 'fix';
  }
  if (flow.clash?.status === 'detectada' && !applied) {
    tones[flow.clash.a ?? 'P-12'] = 'clash';
    tones[flow.clash.b ?? 'E-B-03'] = 'clash';
  }
  return { moves, tones };
};

export const TONE_COLORS: Readonly<Record<CaseTone, HighlightColor>> = {
  clash: { r: 0.9, g: 0.15, b: 0.15, a: 1 },
  fix: { r: 0.15, g: 0.7, b: 0.3, a: 1 },
};

export const matchesMark = (
  properties: ElementProperties,
  mark: string,
): boolean => {
  const wanted = mark.trim().toLowerCase();
  return properties.properties.some(
    (property) =>
      ['mark', 'marca'].includes(property.displayName.trim().toLowerCase()) &&
      String(property.displayValue ?? '')
        .trim()
        .toLowerCase() === wanted,
  );
};

interface FragmentListLike {
  getWorldBounds(fragId: number, box: BoxLike): void;
  updateAnimTransform(
    fragId: number,
    scale?: unknown,
    rotation?: unknown,
    translation?: unknown,
  ): void;
}

interface InstanceTreeLike {
  enumNodeFragments(
    dbId: number,
    callback: (fragId: number) => void,
    recursive?: boolean,
  ): void;
}

interface BoxLike {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

interface FlowModel extends ViewerModelHandle {
  getInstanceTree(): InstanceTreeLike | null;
  getObjectTree(
    onSuccess: (tree: InstanceTreeLike) => void,
    onError: (error: unknown) => void,
  ): void;
  getFragmentList(): FragmentListLike;
  getUnitString?(): string;
  getUnitScale?(): number;
  search(
    text: string,
    onSuccess: (dbIds: number[]) => void,
    onError: (error: unknown) => void,
    attributeNames?: string[],
  ): void;
}

interface FlowViewer extends Viewer3D {
  impl: { sceneUpdated(force?: boolean): void };
}

interface FlowGlobals {
  THREE?: {
    Box3: new () => BoxLike;
    Vector3: new (x: number, y: number, z: number) => unknown;
  };
}

const three = () => (globals() as FlowGlobals).THREE;

const asFlowModel = (handle: ViewerModelHandle): FlowModel =>
  handle as FlowModel;

const treeOf = (model: FlowModel): Promise<InstanceTreeLike> => {
  const ready = model.getInstanceTree();
  if (ready) return Promise.resolve(ready);
  return new Promise((resolve, reject) => model.getObjectTree(resolve, reject));
};

export const modelScale = (handle: ViewerModelHandle): number => {
  const model = asFlowModel(handle);
  return metersPerUnit(model.getUnitString?.(), model.getUnitScale?.());
};

export const findByMark = async (
  handle: ViewerModelHandle,
  mark: string,
): Promise<number | null> => {
  const model = asFlowModel(handle);
  const candidates = await new Promise<number[]>((resolve, reject) =>
    model.search(mark, resolve, reject, ['Mark', 'Marca']),
  );
  const checked: number[] = [];
  for (const dbId of candidates.slice(0, 25)) {
    const properties = await new Promise<ElementProperties>((resolve, reject) =>
      model.getProperties(dbId, resolve, reject),
    );
    if (matchesMark(properties, mark)) checked.push(dbId);
  }
  return (
    checked[0] ?? (candidates.length === 1 ? (candidates[0] ?? null) : null)
  );
};

export const getWorldBoundsMeters = async (
  handle: ViewerModelHandle,
  dbId: number,
): Promise<Box3M | null> => {
  const THREE = three();
  if (!THREE) return null;
  const model = asFlowModel(handle);
  const tree = await treeOf(model);
  const fragments = model.getFragmentList();
  const boxes: Box3M[] = [];
  const scratch = new THREE.Box3();
  tree.enumNodeFragments(
    dbId,
    (fragId) => {
      fragments.getWorldBounds(fragId, scratch);
      boxes.push({
        min: [scratch.min.x, scratch.min.y, scratch.min.z],
        max: [scratch.max.x, scratch.max.y, scratch.max.z],
      });
    },
    true,
  );
  const merged = unionBoxes(boxes);
  if (!merged) return null;
  return toWorldMeters(
    merged,
    handle.getData().globalOffset,
    modelScale(handle),
  );
};

export const translateElement = async (
  viewer: Viewer3D,
  handle: ViewerModelHandle,
  dbId: number,
  deltaMeters: Delta,
  axes: AxisMap = DEFAULT_AXES,
): Promise<void> => {
  const THREE = three();
  if (!THREE) return;
  const model = asFlowModel(handle);
  const tree = await treeOf(model);
  const fragments = model.getFragmentList();
  const [x, y, z] = deltaToViewerUnits(deltaMeters, modelScale(handle), axes);
  const translation = new THREE.Vector3(x, y, z);
  tree.enumNodeFragments(
    dbId,
    (fragId) =>
      fragments.updateAnimTransform(fragId, undefined, undefined, translation),
    true,
  );
  (viewer as FlowViewer).impl.sceneUpdated(true);
};

export const resetTranslation = async (
  viewer: Viewer3D,
  handle: ViewerModelHandle,
  dbId: number,
): Promise<void> => {
  const model = asFlowModel(handle);
  const tree = await treeOf(model);
  const fragments = model.getFragmentList();
  tree.enumNodeFragments(
    dbId,
    (fragId) => fragments.updateAnimTransform(fragId),
    true,
  );
  (viewer as FlowViewer).impl.sceneUpdated(true);
};

export const tween = (
  from: Delta,
  to: Delta,
  durationMs: number,
  onFrame: (value: Delta) => void,
): (() => void) => {
  const start = performance.now();
  let frame = 0;
  const step = (now: number) => {
    const t = durationMs <= 0 ? 1 : (now - start) / durationMs;
    onFrame(lerpDelta(from, to, easeInOut(t)));
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
};

export interface CaseScene {
  readonly viewer: Viewer3D;
  readonly controls: ViewerControls;
  readonly handles: ReadonlyMap<Discipline, ViewerModelHandle>;
  readonly dispose: () => void;
  apply(plan: ScenePlan): Promise<void>;
}

export interface CaseSceneOptions {
  readonly externalIds?: Readonly<Record<string, string>>;
  readonly axes?: AxisMap;
  readonly slideMs?: number;
  readonly geometryTimeoutMs?: number;
}

const GEOMETRY_EVENT = 'geometryLoaded';

const waitForGeometry = (
  viewer: Viewer3D,
  models: number,
  timeoutMs: number,
): { readonly done: Promise<void>; readonly stop: () => void } => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let loaded = 0;
  let finish: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    finish = resolve;
    timer = setTimeout(resolve, timeoutMs);
  });
  const onLoaded = () => {
    loaded += 1;
    if (loaded >= models) finish();
  };
  viewer.addEventListener(GEOMETRY_EVENT, onLoaded);
  return {
    done,
    stop: () => {
      clearTimeout(timer);
      viewer.removeEventListener?.(GEOMETRY_EVENT, onLoaded);
    },
  };
};

export const createCaseScene = async (
  container: HTMLElement,
  models: readonly ViewerModel[],
  getToken: () => Promise<AccessToken>,
  options: CaseSceneOptions = {},
  isCancelled: () => boolean = () => false,
): Promise<CaseScene | null> => {
  const viewing: AutodeskViewing = await initializeViewer(getToken);
  if (isCancelled()) return null;
  const viewer = new viewing.GuiViewer3D(container);
  if (viewer.start() > 0) throw new Error('Tu navegador no soporta WebGL.');
  const handles = new Map<Discipline, ViewerModelHandle>();
  const geometry = waitForGeometry(
    viewer,
    models.length,
    options.geometryTimeoutMs ?? 20000,
  );
  let globalOffset: { x: number; y: number; z: number } | undefined;
  const ordered = [...models].sort(
    (a, b) =>
      Number(b.discipline === 'structural') -
      Number(a.discipline === 'structural'),
  );
  for (const model of ordered) {
    const doc = await loadDocument(viewing, model.urn);
    if (isCancelled()) {
      geometry.stop();
      viewer.finish();
      return null;
    }
    const view = pick3dView(
      doc.getRoot().search({ type: 'geometry', role: '3d' }),
    );
    if (!view) throw new Error(`el modelo ${model.file} no trae vista 3D`);
    const handle = await viewer.loadDocumentNode(doc, view, {
      keepCurrentModels: true,
      applyRefPoint: true,
      ...(globalOffset ? { globalOffset } : {}),
    });
    globalOffset ??= handle.getData().globalOffset;
    handles.set(model.discipline, handle);
  }
  await geometry.done;
  geometry.stop();
  if (isCancelled()) {
    viewer.finish();
    return null;
  }

  const controls = createViewerControls(viewer, handles, () =>
    Promise.resolve(),
  );
  const resolved = new Map<string, Promise<ElementRef | null>>();
  const current = new Map<string, Delta>();
  const shown = new Map<string, Delta>();
  const running = new Map<string, () => void>();
  let queue: Promise<void> = Promise.resolve();
  let fitted = false;

  const resolveElement = (id: string): Promise<ElementRef | null> => {
    const known = resolved.get(id);
    if (known) return known;
    const discipline = CASE_ELEMENT_DISCIPLINE[id];
    const handle = discipline ? handles.get(discipline) : undefined;
    const externalId = options.externalIds?.[id];
    const promise = (async (): Promise<ElementRef | null> => {
      if (!discipline || !handle) return null;
      if (externalId) {
        const refs = await controls.resolveExternalIds([externalId]);
        const ref = refs.find(
          (candidate) => candidate.discipline === discipline,
        );
        if (ref) return ref;
      }
      const dbId = await findByMark(handle, id).catch(() => null);
      return dbId === null ? null : { discipline, dbId };
    })();
    resolved.set(id, promise);
    return promise;
  };

  const moveTo = async (id: string, target: Delta) => {
    const ref = await resolveElement(id);
    if (!ref) return;
    const handle = handles.get(ref.discipline);
    if (!handle) return;
    running.get(id)?.();
    const from = shown.get(id) ?? ZERO_DELTA;
    current.set(id, target);
    const write = (value: Delta) => {
      shown.set(id, value);
      void translateElement(viewer, handle, ref.dbId, value, options.axes);
    };
    running.set(id, tween(from, target, options.slideMs ?? 900, write));
  };

  const applyNow = async (plan: ScenePlan) => {
    const ids = new Set([...Object.keys(plan.moves), ...current.keys()]);
    for (const id of ids) {
      const target = plan.moves[id] ?? ZERO_DELTA;
      const from = current.get(id) ?? ZERO_DELTA;
      if (!sameDelta(from, target)) await moveTo(id, target);
    }
    controls.clearHighlights();
    const toned: ElementRef[] = [];
    for (const tone of ['clash', 'fix'] as const) {
      const refs: ElementRef[] = [];
      for (const [id, wanted] of Object.entries(plan.tones)) {
        if (wanted !== tone) continue;
        const ref = await resolveElement(id);
        if (ref) refs.push(ref);
      }
      if (refs.length > 0) controls.highlight(refs, TONE_COLORS[tone]);
      if (tone === 'clash') toned.push(...refs);
    }
    if (!fitted && toned.length > 0) {
      fitted = true;
      controls.fitTo(toned);
    }
  };

  const apply = (plan: ScenePlan): Promise<void> => {
    queue = queue.then(() => applyNow(plan)).catch(() => undefined);
    return queue;
  };

  return {
    viewer,
    controls,
    handles,
    apply,
    dispose: () => {
      for (const cancel of running.values()) cancel();
      viewer.finish();
    },
  };
};
