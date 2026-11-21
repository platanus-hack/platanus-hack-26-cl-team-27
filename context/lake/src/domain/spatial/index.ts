export {
  AXES,
  EPSILON,
  axisIndex,
  centerOn,
  gapBetween,
  makeBox,
  overlapOn,
  round,
  translate,
} from './Box.ts';
export type { Axis, Box, Vec3 } from './Box.ts';
export { detectClashes } from './clash.ts';
export type { Clash, ClearanceRule, SpatialElement } from './clash.ts';
export { proposeFix } from './fix.ts';
export type { Fix, FixCheck, FixInput } from './fix.ts';
export { canAdvance } from './FlowProposal.ts';
export type { FlowProposalStatus } from './FlowProposal.ts';
export { decodeBox, encodeBox, roundBox } from './boxText.ts';
