import type {
  IngestProposal,
  IngestResponse,
  ProposalHunk,
  ProposalView,
  RoomView,
} from '../load/api.ts';
import type { Revision } from '../types.ts';
import { claimsOf, isTextChunk } from '../load/index.ts';
import {
  ATTRIBUTE_UNITS,
  attributeLabel,
  documentTitle,
  NOTIFIABLE_PEOPLE,
  personName,
  subjectLabel,
} from '../vocabulary.ts';

const decimals = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

export const quantity = (value: number | string, attribute: string): string => {
  const text = typeof value === 'number' ? decimals.format(value) : value;
  const unit = ATTRIBUTE_UNITS[attribute];
  return unit ? `${text} ${unit}` : text;
};

export const money = (amount: number): string => {
  const digits = String(Math.round(Math.abs(amount)));
  let grouped = '';
  for (let index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 === 0) grouped += '.';
    grouped += digits.charAt(index);
  }
  return grouped;
};

export const signedMoney = (amount: number): string =>
  `${amount < 0 ? '-' : '+'}$${money(amount)}`;

export const signedDays = (days: number): string =>
  `${days < 0 ? '-' : '+'}${Math.abs(days)} ${Math.abs(days) === 1 ? 'día' : 'días'}`;

export const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export const describeExtraction = (
  path: string,
  revision: Revision,
): string => {
  const texts = revision.chunks.filter(isTextChunk).length;
  const claims = claimsOf(revision).length;
  const parts: string[] = [];
  if (claims > 0 || texts === 0) parts.push(plural(claims, 'hecho', 'hechos'));
  if (texts > 0) {
    parts.push(
      `${plural(texts, 'fragmento de texto', 'fragmentos de texto')} para que la API los lea`,
    );
  }
  return `Extraje ${path}: ${revision.documentId} ${revision.label}, ${parts.join(' y ')}.`;
};

const firstName = (id: string): string => personName(id).split(' ')[0] ?? id;

const hunkValue = (
  hunk: ProposalHunk,
  side: 'before' | 'after',
): number | string | null => {
  const value =
    side === 'before' ? (hunk.before ?? hunk.from) : (hunk.after ?? hunk.to);
  return value ?? null;
};

const isChangedHunk = (hunk: ProposalHunk): boolean => hunk.changed !== false;

export const describeProposal = (proposal: IngestProposal): string => {
  const hunks = proposal.hunks ?? [];
  const changes = hunks.filter(isChangedHunk).length;
  const unchanged =
    proposal.unchanged ??
    proposal.unchangedCount ??
    hunks.filter((hunk) => !isChangedHunk(hunk)).length;
  const parts: string[] = [];
  if (hunks.length > 0 || unchanged > 0) {
    parts.push(
      `${plural(changes, 'cambio', 'cambios')}, ${unchanged} sin cambio`,
    );
  }
  parts.push(
    `${proposal.reviewers.length} de ${NOTIFIABLE_PEOPLE.length} avisados`,
  );
  if (proposal.costDelta !== 0) parts.push(signedMoney(proposal.costDelta));
  if (proposal.delayDays !== 0) parts.push(signedDays(proposal.delayDays));
  if (proposal.blockedByOverlap ?? proposal.waitingOverlap) {
    parts.push('bloqueado por solapamiento');
  }
  const name =
    proposal.documentId !== undefined && proposal.label !== undefined
      ? `${documentTitle(proposal.documentId)} ${proposal.label}${proposal.authorId ? ` (${firstName(proposal.authorId)})` : ''}`
      : proposal.title;
  return `PR · ${name} · ${parts.join(' · ')}`;
};

export const describeHunk = (hunk: ProposalHunk): string => {
  const subject = subjectLabel(hunk.subjectId);
  const attribute = hunk.attribute ? `, ${attributeLabel(hunk.attribute)}` : '';
  const before = hunkValue(hunk, 'before');
  const after = hunkValue(hunk, 'after');
  const show = (value: number | string | null): string =>
    value === null ? '—' : quantity(value, hunk.attribute ?? '');
  const locator = hunk.locator ?? hunk.chunkLocator;
  return `${subject}${attribute}: ${show(before)} → ${show(after)}${locator ? ` · ${locator}` : ''}`;
};

export const describeLoad = (response: IngestResponse): string[] => {
  const lines: string[] = [];
  for (const proposal of response.proposals) {
    lines.push(describeProposal(proposal));
    for (const hunk of (proposal.hunks ?? []).filter(isChangedHunk)) {
      lines.push(`  ${describeHunk(hunk)}`);
    }
    for (const filtered of proposal.filtered) {
      lines.push(
        `  Sin aviso para ${personName(filtered.stakeholderId)}: ${filtered.reason}`,
      );
    }
  }
  if (response.discrepancies.length > 0) {
    const facts = response.claims
      .filter((claim) => claim.outcome === 'discrepancy')
      .map(
        (claim) =>
          `${subjectLabel(claim.subjectId)}, ${attributeLabel(claim.attribute)} ${quantity(claim.value, claim.attribute)}`,
      );
    for (const discrepancy of response.discrepancies) {
      lines.push(
        `Discrepancia para ${personName(discrepancy.ownerId)}: ${facts.join('; ') || 'un hecho no coincide con lo vigente'}`,
      );
    }
  }
  if (response.backed.length > 0) {
    lines.push(
      `Respaldo: este documento respalda ${plural(response.backed.length, 'discrepancia', 'discrepancias')}.`,
    );
  }
  if (lines.length === 0) {
    lines.push('Sin cambios: todo coincide con lo vigente.');
  }
  return lines;
};

export const describeProposalState = (proposal: ProposalView): string => {
  const approved = proposal.reviewers.filter(
    (reviewer) => reviewer.decision === 'approve',
  ).length;
  return `${proposal.title} · ${proposal.status} · ${approved} de ${proposal.reviewers.length} aprobaron`;
};

export const describeUpToDate = (room: RoomView): string =>
  `Documentos al día: ${room.counters.upToDate} de ${room.counters.documents}.`;

export const describeTotals = (room: RoomView): string =>
  `versión ${room.projectVersion} del proyecto · ${signedMoney(room.totals.costDelta)} · ${signedDays(room.totals.delayDays)} · plazo de ${room.totals.projectDays} días`;
