import { cx } from '@team27/ui';

import {
  AXIS_5_X,
  AXIS_6_X,
  AXIS_B_Y,
  boxToRect,
  intersectBoxes,
  isApplied,
  lengthToSvg,
  originalBox,
  PLAN,
  rectFromRange,
  slideOffset,
  toSvgX,
  toSvgY,
  TRAY_BASE_Y,
  trayBox,
} from '@/lib/case-plan';
import type { FlowState } from '@/lib/flow-api';

const LABEL = 'text-[26px] font-medium';

function AxisBubble({
  x,
  y,
  text,
}: {
  readonly x: number;
  readonly y: number;
  readonly text: string;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r={20} className="fill-surface stroke-axis" />
      <text
        x={x}
        y={y + 9}
        textAnchor="middle"
        className="fill-ink text-[26px] font-semibold"
      >
        {text}
      </text>
    </g>
  );
}

export function CasePlan({
  flow,
  showProposal = true,
  className,
}: {
  readonly flow: FlowState;
  readonly showProposal?: boolean;
  readonly className?: string;
}) {
  const { elements, change, clash, proposal } = flow;
  const pillar = elements.find((element) => element.id === 'P-12') ?? null;
  const tray = trayBox(elements);
  const applied = isApplied(proposal);
  const dy = proposal?.delta.dy ?? 0;
  const segment = proposal?.segment ?? { fromX: 26.5, toX: 32 };
  const trayLeft = rectFromRange(
    tray.min[0],
    segment.fromX,
    TRAY_BASE_Y[0],
    TRAY_BASE_Y[1],
  );
  const trayMoving = rectFromRange(
    segment.fromX,
    Math.min(segment.toX, tray.max[0]),
    TRAY_BASE_Y[0],
    TRAY_BASE_Y[1],
  );
  const offset = slideOffset(dy, applied);
  const hit =
    clash?.status === 'detectada' && pillar
      ? intersectBoxes(pillar.box, tray)
      : null;
  const ghostVisible =
    showProposal && proposal?.status === 'propuesta' && dy !== 0;
  const previous =
    pillar && change ? originalBox(pillar.box, change.delta.dy) : null;
  const connectorX = toSvgX(segment.fromX);
  const connectorY0 = trayMoving.y + trayMoving.height / 2;
  const connectorY1 = connectorY0 - lengthToSvg(dy);
  const summary = hit
    ? 'Plano del eje B-6: el pilar P-12 pisa la bandeja E-B-03.'
    : applied
      ? 'Plano del eje B-6: la bandeja E-B-03 quedó desplazada y libre del pilar P-12.'
      : 'Plano del eje B-6: pilar P-12 y bandeja E-B-03 sin choque.';

  return (
    <svg
      viewBox={`0 0 ${PLAN.width} ${PLAN.height}`}
      role="img"
      aria-label={summary}
      className={cx('block h-auto w-full', className)}
    >
      <defs>
        <pattern
          id="clash-hatch"
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect
            width="12"
            height="12"
            fill="var(--color-critical)"
            opacity="0.18"
          />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="12"
            stroke="var(--color-critical)"
            strokeWidth="5"
          />
        </pattern>
      </defs>
      <rect
        width={PLAN.width}
        height={PLAN.height}
        rx="16"
        className="fill-surface-2"
      />

      <line
        x1={toSvgX(AXIS_5_X)}
        x2={toSvgX(AXIS_5_X)}
        y1={50}
        y2={PLAN.height - 14}
        className="stroke-axis"
        strokeWidth="2"
        strokeDasharray="14 8"
      />
      <line
        x1={toSvgX(AXIS_6_X)}
        x2={toSvgX(AXIS_6_X)}
        y1={50}
        y2={PLAN.height - 14}
        className="stroke-axis"
        strokeWidth="2"
        strokeDasharray="14 8"
      />
      <line
        x1={70}
        x2={PLAN.width - 14}
        y1={toSvgY(AXIS_B_Y)}
        y2={toSvgY(AXIS_B_Y)}
        className="stroke-axis"
        strokeWidth="2"
        strokeDasharray="14 8"
      />
      <AxisBubble x={toSvgX(AXIS_5_X)} y={30} text="5" />
      <AxisBubble x={toSvgX(AXIS_6_X)} y={30} text="6" />
      <AxisBubble x={34} y={toSvgY(AXIS_B_Y)} text="B" />

      <g>
        <rect
          x={0}
          y={toSvgY(6.6)}
          width={74}
          height={lengthToSvg(0.2)}
          className="fill-series-3"
          opacity="0.75"
        />
        <text x={84} y={toSvgY(6.6) + 16} className={cx(LABEL, 'fill-ink-2')}>
          <tspan className="text-[22px]">Colector B2</tspan>
        </text>
        <text x={84} y={toSvgY(6.6) + 40} className="fill-ink-3 text-[20px]">
          a 24 m, sin choque
        </text>
      </g>

      {previous && (
        <rect
          {...boxToRect(previous)}
          rx="4"
          className="fill-none stroke-ink-3"
          strokeWidth="3"
          strokeDasharray="8 6"
        />
      )}

      <g>
        <rect {...trayLeft} className="fill-series-1" rx="3" opacity="0.9" />
        <g
          className="motion-reduce:transition-none"
          style={{
            transform: `translateY(${offset}px)`,
            transition: 'transform 1100ms cubic-bezier(0.45, 0, 0.2, 1)',
          }}
        >
          <rect
            {...trayMoving}
            className="fill-series-1"
            rx="3"
            opacity="0.9"
          />
        </g>
      </g>

      {ghostVisible && (
        <g>
          <rect
            {...trayMoving}
            y={trayMoving.y - lengthToSvg(dy)}
            rx="3"
            className="fill-good/30 stroke-good"
            strokeWidth="4"
            strokeDasharray="10 6"
          />
          <line
            x1={connectorX}
            x2={connectorX}
            y1={connectorY0}
            y2={connectorY1}
            className="stroke-good"
            strokeWidth="4"
            strokeDasharray="6 6"
          />
          <text
            x={trayMoving.x + trayMoving.width / 2}
            y={trayMoving.y - lengthToSvg(dy) - 14}
            textAnchor="middle"
            className={cx(LABEL, 'fill-good-text')}
          >
            Propuesta: +{Math.round(dy * 100)} cm al norte
          </text>
        </g>
      )}

      {pillar && (
        <rect
          {...boxToRect(pillar.box)}
          rx="3"
          className="fill-ink stroke-surface"
          strokeWidth="3"
        />
      )}

      {hit && (
        <g>
          <rect
            {...boxToRect(hit)}
            fill="url(#clash-hatch)"
            className="stroke-critical"
            strokeWidth="3"
          />
          <text
            x={toSvgX(hit.max[0]) + 12}
            y={toSvgY(hit.max[1]) + 8}
            className={cx(LABEL, 'fill-critical-text')}
          >
            Choque {Math.round((hit.max[1] - hit.min[1]) * 100)} cm
          </text>
        </g>
      )}

      {pillar && (
        <text
          x={boxToRect(pillar.box).x + boxToRect(pillar.box).width / 2}
          y={boxToRect(pillar.box).y + boxToRect(pillar.box).height + 34}
          textAnchor="middle"
          className={cx(LABEL, 'fill-ink')}
        >
          P-12
        </text>
      )}
      <text
        x={toSvgX(segment.fromX) + 8}
        y={trayMoving.y + trayMoving.height + 36 + offset}
        className={cx(LABEL, 'fill-ink-2')}
        style={{ transition: 'y 1100ms cubic-bezier(0.45, 0, 0.2, 1)' }}
      >
        Bandeja E-B-03
      </text>
    </svg>
  );
}
