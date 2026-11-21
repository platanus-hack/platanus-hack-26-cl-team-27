import type { IngestResponse, ProposalView, RoomView } from '../load/api.ts';
import type { Revision } from '../types.ts';
import {
  ATTRIBUTE_UNITS,
  attributeLabel,
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

export const describeExtraction = (path: string, revision: Revision): string =>
  `Extraje ${path}: ${revision.documentId} ${revision.label}, ${plural(revision.claims.length, 'hecho', 'hechos')}.`;

export const describeProposal = (
  proposal: IngestResponse['proposals'][number],
): string => {
  const parts = [
    `${proposal.reviewers.length} de ${NOTIFIABLE_PEOPLE.length} avisados`,
  ];
  if (proposal.costDelta !== 0) parts.push(signedMoney(proposal.costDelta));
  if (proposal.delayDays !== 0) parts.push(signedDays(proposal.delayDays));
  return `Propuesta: ${proposal.title} · ${parts.join(' · ')}`;
};

export const describeLoad = (response: IngestResponse): string[] => {
  const lines: string[] = [];
  for (const proposal of response.proposals) {
    lines.push(describeProposal(proposal));
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
