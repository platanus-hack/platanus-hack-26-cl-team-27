import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

import type { NoticeVisual, VisualFocus } from '@team27/context-notification';
import { Logger } from '@nestjs/common';
import * as WebIFC from 'web-ifc';

export const MODEL_FILES = {
  architecture: 'Ifc2x3_Duplex_Architecture.ifc',
  plumbing: 'Ifc2x3_Duplex_Plumbing.ifc',
} as const;

export const IMAGE_WIDTH = 900;
export const IMAGE_HEIGHT = 560;
const SCALE = 2;
const AZIMUTH = (-35 * Math.PI) / 180;
const ELEVATION = (30 * Math.PI) / 180;
const GHOST = 0.28;
const BACKGROUND: Rgb = [255, 255, 255];
const CONTEXT: Rgb = [214, 219, 226];

type Rgb = readonly [number, number, number];

export type PartKind = 'walls' | 'structure' | 'pipes' | 'other';

export interface ModelPart {
  readonly kind: PartKind;
  readonly triangles: Float32Array;
}

const WALLS = new Set<number>([
  WebIFC.IFCWALL,
  WebIFC.IFCWALLSTANDARDCASE,
  WebIFC.IFCCURTAINWALL,
  WebIFC.IFCWINDOW,
  WebIFC.IFCDOOR,
]);

const STRUCTURE = new Set<number>([
  WebIFC.IFCSLAB,
  WebIFC.IFCBEAM,
  WebIFC.IFCCOLUMN,
  WebIFC.IFCROOF,
  WebIFC.IFCSTAIR,
  WebIFC.IFCSTAIRFLIGHT,
  WebIFC.IFCFOOTING,
]);

const SKIPPED = new Set<number>([
  WebIFC.IFCSPACE,
  WebIFC.IFCOPENINGELEMENT,
  WebIFC.IFCSITE,
  WebIFC.IFCDISTRIBUTIONPORT,
  WebIFC.IFCROOF,
  WebIFC.IFCCOVERING,
]);

const FOCUS_KIND: Readonly<Record<VisualFocus, PartKind>> = {
  muros: 'walls',
  losa: 'structure',
  canerias: 'pipes',
};

export const modelDirectory = (
  candidates: readonly string[] = [
    join(process.cwd(), 'assets', 'model'),
    join(process.cwd(), 'apps', 'api', 'assets', 'model'),
  ],
): string | null =>
  candidates.find((dir) => existsSync(join(dir, MODEL_FILES.architecture))) ??
  null;

const applyMatrix = (m: ArrayLike<number>, x: number, y: number, z: number) =>
  [
    m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
    m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
    m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
  ] as const;

export const loadParts = async (
  dir: string,
  files: typeof MODEL_FILES = MODEL_FILES,
): Promise<ModelPart[]> => {
  const api = new WebIFC.IfcAPI();
  await api.Init();
  api.SetLogLevel(WebIFC.LogLevel.LOG_LEVEL_OFF);
  const parts: ModelPart[] = [];
  for (const [origin, file] of Object.entries(files)) {
    const modelId = api.OpenModel(
      new Uint8Array(readFileSync(join(dir, file))),
    );
    api.StreamAllMeshes(modelId, (mesh) => {
      const type = api.GetLineType(modelId, mesh.expressID);
      if (SKIPPED.has(type)) return;
      const kind: PartKind =
        origin === 'plumbing'
          ? 'pipes'
          : WALLS.has(type)
            ? 'walls'
            : STRUCTURE.has(type)
              ? 'structure'
              : 'other';
      const triangles: number[] = [];
      for (let g = 0; g < mesh.geometries.size(); g += 1) {
        const placed = mesh.geometries.get(g);
        const geometry = api.GetGeometry(modelId, placed.geometryExpressID);
        const vertices = api.GetVertexArray(
          geometry.GetVertexData(),
          geometry.GetVertexDataSize(),
        );
        const indices = api.GetIndexArray(
          geometry.GetIndexData(),
          geometry.GetIndexDataSize(),
        );
        for (const index of indices) {
          const at = index * 6;
          triangles.push(
            ...applyMatrix(
              placed.flatTransformation,
              vertices[at]!,
              vertices[at + 1]!,
              vertices[at + 2]!,
            ),
          );
        }
        geometry.delete();
      }
      if (triangles.length > 0) {
        parts.push({ kind, triangles: new Float32Array(triangles) });
      }
    });
    api.CloseModel(modelId);
  }
  return parts;
};

const hexToRgb = (hex: string): Rgb => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

interface Layer {
  readonly depth: Float32Array;
  readonly color: Uint8ClampedArray;
}

const layer = (size: number): Layer => ({
  depth: new Float32Array(size).fill(-Infinity),
  color: new Uint8ClampedArray(size * 3),
});

interface Camera {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

const project = (x: number, y: number, z: number) => {
  const x1 = x * Math.cos(AZIMUTH) + z * Math.sin(AZIMUTH);
  const z1 = -x * Math.sin(AZIMUTH) + z * Math.cos(AZIMUTH);
  const y2 = y * Math.cos(ELEVATION) - z1 * Math.sin(ELEVATION);
  const z2 = y * Math.sin(ELEVATION) + z1 * Math.cos(ELEVATION);
  return [x1, -y2, z2] as const;
};

const cameraFor = (
  parts: readonly ModelPart[],
  width: number,
  height: number,
): Camera => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const part of parts) {
    const t = part.triangles;
    for (let i = 0; i < t.length; i += 3) {
      const [px, py] = project(t[i]!, t[i + 1]!, t[i + 2]!);
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  const scale = Math.min(
    (width * 0.9) / (maxX - minX || 1),
    (height * 0.9) / (maxY - minY || 1),
  );
  return {
    scale,
    offsetX: width / 2 - ((minX + maxX) / 2) * scale,
    offsetY: height / 2 - ((minY + maxY) / 2) * scale,
  };
};

const rasterize = (
  target: Layer,
  triangles: Float32Array,
  base: Rgb,
  camera: Camera,
  width: number,
  height: number,
): void => {
  const p = new Float64Array(9);
  const q = new Float64Array(9);
  for (let i = 0; i < triangles.length; i += 9) {
    for (let v = 0; v < 3; v += 1) {
      const [x, y, z] = project(
        triangles[i + v * 3]!,
        triangles[i + v * 3 + 1]!,
        triangles[i + v * 3 + 2]!,
      );
      q[v * 3] = x;
      q[v * 3 + 1] = y;
      q[v * 3 + 2] = z;
      p[v * 3] = x * camera.scale + camera.offsetX;
      p[v * 3 + 1] = y * camera.scale + camera.offsetY;
      p[v * 3 + 2] = z;
    }
    const ux = q[3]! - q[0]!;
    const uy = q[4]! - q[1]!;
    const uz = q[5]! - q[2]!;
    const vx = q[6]! - q[0]!;
    const vy = q[7]! - q[1]!;
    const vz = q[8]! - q[2]!;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    if (nz < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const light = Math.max(0, nx * 0.45 + ny * -0.55 + nz * 0.7);
    const shade = 0.5 + 0.5 * light;
    const ax = p[3]! - p[0]!;
    const ay = p[4]! - p[1]!;
    const bx = p[6]! - p[0]!;
    const by = p[7]! - p[1]!;
    const r = base[0] * shade;
    const g = base[1] * shade;
    const b = base[2] * shade;
    const area = ax * by - ay * bx;
    if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(p[0]!, p[3]!, p[6]!)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(p[0]!, p[3]!, p[6]!)));
    const minY = Math.max(0, Math.floor(Math.min(p[1]!, p[4]!, p[7]!)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(p[1]!, p[4]!, p[7]!)));
    for (let y = minY; y <= maxY; y += 1) {
      const cy = y + 0.5;
      for (let x = minX; x <= maxX; x += 1) {
        const cx = x + 0.5;
        const w0 =
          ((p[3]! - cx) * (p[7]! - cy) - (p[4]! - cy) * (p[6]! - cx)) / area;
        const w1 =
          ((p[6]! - cx) * (p[1]! - cy) - (p[7]! - cy) * (p[0]! - cx)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const depth = w0 * p[2]! + w1 * p[5]! + w2 * p[8]!;
        const at = y * width + x;
        if (depth <= target.depth[at]!) continue;
        target.depth[at] = depth;
        target.color[at * 3] = r;
        target.color[at * 3 + 1] = g;
        target.color[at * 3 + 2] = b;
      }
    }
  }
};

export const MAX_SHIFT_M = 6;

const lighten = (rgb: Rgb, amount: number): Rgb => [
  rgb[0] + (255 - rgb[0]) * amount,
  rgb[1] + (255 - rgb[1]) * amount,
  rgb[2] + (255 - rgb[2]) * amount,
];

const longAxis = (parts: readonly ModelPart[]): 0 | 2 => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const part of parts) {
    const t = part.triangles;
    for (let i = 0; i < t.length; i += 3) {
      minX = Math.min(minX, t[i]!);
      maxX = Math.max(maxX, t[i]!);
      minZ = Math.min(minZ, t[i + 2]!);
      maxZ = Math.max(maxZ, t[i + 2]!);
    }
  }
  return maxX - minX >= maxZ - minZ ? 0 : 2;
};

const shifted = (
  triangles: Float32Array,
  axis: 0 | 2,
  meters: number,
): Float32Array => {
  const out = new Float32Array(triangles);
  for (let i = axis; i < out.length; i += 3) out[i] = out[i]! + meters;
  return out;
};

export const renderParts = (
  parts: readonly ModelPart[],
  focus: VisualFocus,
  color: string,
  width = IMAGE_WIDTH,
  height = IMAGE_HEIGHT,
  shift = 0,
): Uint8Array => {
  const move = Math.max(-MAX_SHIFT_M, Math.min(MAX_SHIFT_M, shift));
  const w = width * SCALE;
  const h = height * SCALE;
  const camera = cameraFor(
    parts.filter((part) => part.kind !== 'pipes'),
    w,
    h,
  );
  const hot = layer(w * h);
  const context = layer(w * h);
  const kind = FOCUS_KIND[focus];
  const highlight = hexToRgb(color);
  const axis = longAxis(parts.filter((part) => part.kind !== 'pipes'));
  for (const part of parts) {
    if (part.kind === kind) {
      if (move !== 0) {
        rasterize(hot, part.triangles, lighten(highlight, 0.72), camera, w, h);
        rasterize(hot, shifted(part.triangles, axis, move), highlight, camera, w, h);
      } else {
        rasterize(hot, part.triangles, highlight, camera, w, h);
      }
    } else if (part.kind !== 'pipes') {
      rasterize(context, part.triangles, CONTEXT, camera, w, h);
    }
  }
  const full = new Uint8ClampedArray(w * h * 3);
  for (let at = 0; at < w * h; at += 1) {
    const hasHot = hot.depth[at]! > -Infinity;
    const hasContext = context.depth[at]! > -Infinity;
    const under: Rgb = hasHot
      ? [hot.color[at * 3]!, hot.color[at * 3 + 1]!, hot.color[at * 3 + 2]!]
      : BACKGROUND;
    let out: Rgb = under;
    if (hasContext && (!hasHot || context.depth[at]! > hot.depth[at]!)) {
      const alpha = hasHot ? GHOST : 1;
      out = [
        under[0] * (1 - alpha) + context.color[at * 3]! * alpha,
        under[1] * (1 - alpha) + context.color[at * 3 + 1]! * alpha,
        under[2] * (1 - alpha) + context.color[at * 3 + 2]! * alpha,
      ];
    }
    full[at * 3] = out[0];
    full[at * 3 + 1] = out[1];
    full[at * 3 + 2] = out[2];
  }
  const nearest = new Float32Array(w * h);
  for (let at = 0; at < w * h; at += 1) {
    nearest[at] = Math.max(hot.depth[at]!, context.depth[at]!);
  }
  const edged = new Uint8ClampedArray(full);
  for (let y = 0; y < h - 1; y += 1) {
    for (let x = 0; x < w - 1; x += 1) {
      const at = y * w + x;
      let edge = false;
      for (const other of [at + 1, at + w]) {
        const a = nearest[at]!;
        const b = nearest[other]!;
        if ((a === -Infinity) !== (b === -Infinity)) edge = true;
        else if (a !== -Infinity && Math.abs(a - b) > 0.25) edge = true;
        else {
          const diff =
            Math.abs(full[at * 3]! - full[other * 3]!) +
            Math.abs(full[at * 3 + 1]! - full[other * 3 + 1]!) +
            Math.abs(full[at * 3 + 2]! - full[other * 3 + 2]!);
          if (diff > 24) edge = true;
        }
      }
      if (edge) {
        edged[at * 3] = full[at * 3]! * 0.55;
        edged[at * 3 + 1] = full[at * 3 + 1]! * 0.55;
        edged[at * 3 + 2] = full[at * 3 + 2]! * 0.55;
      }
    }
  }
  full.set(edged);
  const pixels = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        for (let dy = 0; dy < SCALE; dy += 1) {
          for (let dx = 0; dx < SCALE; dx += 1) {
            sum += full[((y * SCALE + dy) * w + x * SCALE + dx) * 3 + c]!;
          }
        }
        pixels[(y * width + x) * 3 + c] = sum / (SCALE * SCALE);
      }
    }
  }
  return encodePng(pixels, width, height);
};

const chunk = (type: string, data: Uint8Array): Buffer => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, tail]);
};

export const encodePng = (
  rgb: Uint8Array,
  width: number,
  height: number,
): Uint8Array => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(
      raw,
      y * (width * 3 + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
};

export class ModelImager {
  private readonly logger = new Logger('Vista del modelo');
  private readonly dir: string | null;
  private parts: Promise<ModelPart[] | null> | null = null;
  private readonly images = new Map<string, Promise<Uint8Array | null>>();

  constructor(dir: string | null = modelDirectory()) {
    this.dir = dir;
  }

  image(visual: NoticeVisual, shift = 0): Promise<Uint8Array | null> {
    const move = Math.round(shift * 2) / 2;
    const key = `${visual.focus}/${visual.color}/${move}`;
    const cached = this.images.get(key);
    if (cached) return cached;
    if (this.images.size > 120) this.images.clear();
    const started = this.load().then((parts) =>
      parts
        ? renderParts(
            parts,
            visual.focus,
            visual.color,
            IMAGE_WIDTH,
            IMAGE_HEIGHT,
            move,
          )
        : null,
    );
    this.images.set(key, started);
    return started;
  }

  private load(): Promise<ModelPart[] | null> {
    if (this.parts) return this.parts;
    const dir = this.dir;
    this.parts =
      dir === null
        ? Promise.resolve(null)
        : loadParts(dir).catch((error: unknown) => {
            this.logger.warn(
              `No pude leer el modelo: ${error instanceof Error ? error.message : String(error)}`,
            );
            return null;
          });
    return this.parts;
  }
}

let shared: ModelImager | null = null;

export const modelImager = (): ModelImager => {
  shared ??= new ModelImager();
  return shared;
};
