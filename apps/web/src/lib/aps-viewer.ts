import type { Discipline } from './aps-api';

export const VIEWER_SCRIPT =
  'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';
export const VIEWER_STYLE =
  'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';

export interface ViewerModelHandle {
  getData(): { globalOffset?: { x: number; y: number; z: number } };
  getProperties(
    dbId: number,
    onSuccess: (result: ElementProperties) => void,
    onError: (error: unknown) => void,
  ): void;
  getExternalIdMapping(
    onSuccess: (mapping: Record<string, number>) => void,
    onError: (error: unknown) => void,
  ): void;
}

export interface ElementProperties {
  readonly dbId: number;
  readonly externalId?: string;
  readonly name?: string;
  readonly properties: readonly {
    readonly displayName: string;
    readonly displayValue: string | number | boolean | null;
    readonly displayCategory?: string;
    readonly units?: string | null;
  }[];
}

interface AggregateEntry {
  readonly model: ViewerModelHandle;
  readonly ids: number[];
}

export interface ViewableNode {
  readonly data: { readonly name?: string; readonly isMasterView?: boolean };
}

interface ViewerDocument {
  getRoot(): {
    search(filter: { type: string; role: string }): ViewableNode[];
  };
}

export const pick3dView = (
  nodes: readonly ViewableNode[],
): ViewableNode | null =>
  nodes.findLast((node) => node.data.isMasterView) ??
  nodes.find((node) => node.data.name === '{3D}') ??
  nodes[0] ??
  null;

export interface Viewer3D {
  start(): number;
  finish(): void;
  loadDocumentNode(
    doc: ViewerDocument,
    node: unknown,
    options: Record<string, unknown>,
  ): Promise<ViewerModelHandle>;
  showModel(model: ViewerModelHandle, preserveTools: boolean): boolean;
  hideModel(model: ViewerModelHandle): boolean;
  setAggregateSelection(selection: AggregateEntry[]): void;
  setAggregateIsolation(isolation: AggregateEntry[]): void;
  clearSelection(): void;
  showAll(): void;
  fitToView(ids?: number[] | null, model?: ViewerModelHandle): void;
  setThemingColor(
    dbId: number,
    color: unknown,
    model: ViewerModelHandle,
    recursive?: boolean,
  ): void;
  clearThemingColors(model: ViewerModelHandle): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
}

export interface AutodeskViewing {
  Initializer(options: Record<string, unknown>, onReady: () => void): void;
  GuiViewer3D: new (container: HTMLElement) => Viewer3D;
  Document: {
    load(
      urn: string,
      onSuccess: (doc: ViewerDocument) => void,
      onError: (code: number, message: string) => void,
    ): void;
  };
  AGGREGATE_SELECTION_CHANGED_EVENT: string;
}

export interface ViewerGlobals {
  Autodesk?: { Viewing: AutodeskViewing };
  THREE?: {
    Vector4: new (x: number, y: number, z: number, w: number) => unknown;
  };
}

export const globals = (): ViewerGlobals => window as unknown as ViewerGlobals;

let loading: Promise<AutodeskViewing> | null = null;

export const loadViewerLibrary = (): Promise<AutodeskViewing> => {
  const existing = globals().Autodesk?.Viewing;
  if (existing) return Promise.resolve(existing);
  loading ??= new Promise<AutodeskViewing>((resolve, reject) => {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = VIEWER_STYLE;
    document.head.append(style);
    const script = document.createElement('script');
    script.src = VIEWER_SCRIPT;
    script.async = true;
    script.onload = () => {
      const viewing = globals().Autodesk?.Viewing;
      if (viewing) resolve(viewing);
      else reject(new Error('El visor de APS no se cargó'));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('No se pudo descargar el visor de APS'));
    };
    document.head.append(script);
  });
  return loading;
};

export interface AccessToken {
  readonly access_token: string;
  readonly expires_in: number;
}

let initializing: Promise<AutodeskViewing> | null = null;

export const initializeViewer = (
  getToken: () => Promise<AccessToken>,
): Promise<AutodeskViewing> => {
  initializing ??= loadViewerLibrary().then(
    (viewing) =>
      new Promise<AutodeskViewing>((resolve) =>
        viewing.Initializer(
          {
            env: 'AutodeskProduction2',
            api: 'streamingV2',
            getAccessToken: (
              done: (token: string, expiresIn: number) => void,
            ) => {
              getToken().then(
                (token) => done(token.access_token, token.expires_in),
                () => done('', 0),
              );
            },
          },
          () => resolve(viewing),
        ),
      ),
  );
  initializing.catch(() => {
    initializing = null;
  });
  return initializing;
};

export const loadDocument = (
  viewing: AutodeskViewing,
  urn: string,
): Promise<ViewerDocument> =>
  new Promise((resolve, reject) => {
    viewing.Document.load(`urn:${urn}`, resolve, (code, message) =>
      reject(new Error(`Document.load ${code}: ${message}`)),
    );
  });

export interface ElementRef {
  readonly discipline: Discipline;
  readonly dbId: number;
}

export interface HighlightColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a?: number;
}

export const PRIMARY_DISCIPLINE: Discipline = 'architectural';

export const primaryDiscipline = (
  disciplines: readonly Discipline[],
): Discipline | null =>
  disciplines.includes(PRIMARY_DISCIPLINE)
    ? PRIMARY_DISCIPLINE
    : (disciplines[0] ?? null);

export interface ViewerControls {
  readonly disciplines: readonly Discipline[];
  ensureLoaded(discipline: Discipline): Promise<void>;
  setDisciplineVisible(discipline: Discipline, visible: boolean): void;
  resolveExternalIds(externalIds: readonly string[]): Promise<ElementRef[]>;
  getProperties(element: ElementRef): Promise<ElementProperties>;
  select(elements: readonly ElementRef[]): void;
  isolate(elements: readonly ElementRef[]): void;
  highlight(elements: readonly ElementRef[], color: HighlightColor): void;
  clearHighlights(): void;
  fitTo(elements: readonly ElementRef[]): void;
  reset(): void;
}

export const groupByDiscipline = (
  elements: readonly ElementRef[],
): Map<Discipline, number[]> => {
  const groups = new Map<Discipline, number[]>();
  for (const { discipline, dbId } of elements) {
    const ids = groups.get(discipline) ?? [];
    ids.push(dbId);
    groups.set(discipline, ids);
  }
  return groups;
};

export const createViewerControls = (
  viewer: Viewer3D,
  models: ReadonlyMap<Discipline, ViewerModelHandle>,
  ensureLoaded: (discipline: Discipline) => Promise<void>,
): ViewerControls => {
  const externalIdCache = new Map<
    Discipline,
    Promise<Record<string, number>>
  >();
  const modelOf = (discipline: Discipline): ViewerModelHandle => {
    const model = models.get(discipline);
    if (!model) throw new Error(`No hay modelo cargado de ${discipline}`);
    return model;
  };
  const aggregate = (elements: readonly ElementRef[]): AggregateEntry[] =>
    [...groupByDiscipline(elements)].map(([discipline, ids]) => ({
      model: modelOf(discipline),
      ids,
    }));
  const mappingOf = (discipline: Discipline) => {
    let mapping = externalIdCache.get(discipline);
    if (!mapping) {
      mapping = new Promise((resolve, reject) =>
        modelOf(discipline).getExternalIdMapping(resolve, reject),
      );
      externalIdCache.set(discipline, mapping);
    }
    return mapping;
  };

  return {
    get disciplines() {
      return [...models.keys()];
    },
    ensureLoaded,
    setDisciplineVisible(discipline, visible) {
      const model = modelOf(discipline);
      if (visible) viewer.showModel(model, true);
      else viewer.hideModel(model);
    },
    async resolveExternalIds(externalIds) {
      const found: ElementRef[] = [];
      for (const discipline of models.keys()) {
        const mapping = await mappingOf(discipline);
        for (const externalId of externalIds) {
          const dbId = mapping[externalId];
          if (dbId !== undefined) found.push({ discipline, dbId });
        }
      }
      return found;
    },
    getProperties({ discipline, dbId }) {
      return new Promise((resolve, reject) =>
        modelOf(discipline).getProperties(dbId, resolve, reject),
      );
    },
    select(elements) {
      if (elements.length === 0) viewer.clearSelection();
      else viewer.setAggregateSelection(aggregate(elements));
    },
    isolate(elements) {
      if (elements.length === 0) viewer.showAll();
      else viewer.setAggregateIsolation(aggregate(elements));
    },
    highlight(elements, { r, g, b, a = 1 }) {
      const Vector4 = globals().THREE?.Vector4;
      if (!Vector4) return;
      const color = new Vector4(r, g, b, a);
      for (const { discipline, dbId } of elements) {
        viewer.setThemingColor(dbId, color, modelOf(discipline), true);
      }
    },
    clearHighlights() {
      for (const model of models.values()) viewer.clearThemingColors(model);
    },
    fitTo(elements) {
      for (const { model, ids } of aggregate(elements)) {
        viewer.fitToView(ids, model);
      }
    },
    reset() {
      viewer.clearSelection();
      viewer.showAll();
      for (const model of models.values()) viewer.clearThemingColors(model);
    },
  };
};

export const selectionFromEvent = (
  event: unknown,
  models: ReadonlyMap<Discipline, ViewerModelHandle>,
): ElementRef[] => {
  const selections =
    (
      event as {
        selections?: { model: ViewerModelHandle; dbIdArray: number[] }[];
      }
    ).selections ?? [];
  const refs: ElementRef[] = [];
  for (const { model, dbIdArray } of selections) {
    for (const [discipline, candidate] of models) {
      if (candidate !== model) continue;
      for (const dbId of dbIdArray) refs.push({ discipline, dbId });
    }
  }
  return refs;
};
