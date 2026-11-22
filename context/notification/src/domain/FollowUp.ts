import type { NoticeMemo, RenderedNotice } from './Notice.ts';

export interface FollowUpSettings {
  readonly reminderAfterMs: number;
  readonly escalateAfterReminders: number;
}

export const DEFAULT_FOLLOW_UP: FollowUpSettings = {
  reminderAfterMs: 24 * 60 * 60_000,
  escalateAfterReminders: 2,
};

export interface FollowUpState {
  readonly lastContactAt: Date;
  readonly reminders: number;
  readonly escalated: boolean;
}

export type FollowUpStep = 'wait' | 'remind' | 'escalate';

export const followUpStep = (
  state: FollowUpState,
  now: Date,
  settings: FollowUpSettings,
): FollowUpStep => {
  if (
    now.getTime() - state.lastContactAt.getTime() <
    settings.reminderAfterMs
  ) {
    return 'wait';
  }
  if (state.reminders < settings.escalateAfterReminders) return 'remind';
  return state.escalated ? 'wait' : 'escalate';
};

const REMINDER = 'Recordatorio: todavía falta tu respuesta.';

export const asReminder = (rendered: RenderedNotice): RenderedNotice => ({
  subject: `Recordatorio: ${rendered.subject}`,
  text: `${REMINDER}\n\n${rendered.text}`,
  html:
    rendered.html === null
      ? null
      : `<p><strong>${REMINDER}</strong></p>${rendered.html}`,
});

export const ANSWER_KINDS = [
  'reviewed',
  'issue',
  'not_affected',
  'se_tocan',
  'no_se_tocan',
] as const;

export type AnswerKind = (typeof ANSWER_KINDS)[number];

const ANSWER_VERB: Readonly<Record<AnswerKind, string>> = {
  reviewed: 'confirmó',
  issue: 'objetó',
  not_affected: 'dice que no le afecta',
  se_tocan: 'dice que se tocan',
  no_se_tocan: 'dice que no se tocan',
};

const ANSWER_NEXT: Readonly<Record<AnswerKind, string | null>> = {
  reviewed: null,
  issue: 'Lo vigente no cambia. Reabre con la observación o retira el cambio.',
  not_affected: 'Ya no cuenta entre quienes tienen que responder.',
  se_tocan: 'Es un choque real: el cambio queda bloqueado hasta resolverlo.',
  no_se_tocan: null,
};

export interface AnswerProgress {
  readonly approved: number;
  readonly required: number;
  readonly missing: readonly string[];
}

export interface AnswerToTell {
  readonly by: string;
  readonly role: string;
  readonly answer: AnswerKind;
  readonly note: string | null;
  readonly about: string;
  readonly progress?: AnswerProgress | null;
}

const who = (name: string, role: string): string =>
  role ? `${name} (${role})` : name;

const progressLine = (progress: AnswerProgress): string => {
  const count = `Van ${progress.approved} de ${progress.required} confirmaciones.`;
  if (progress.missing.length === 0) return count;
  return `${count} Falta ${progress.missing.join(', ')}.`;
};

export const answerMemo = (answer: AnswerToTell): NoticeMemo => {
  const verb = ANSWER_VERB[answer.answer];
  const next = ANSWER_NEXT[answer.answer];
  return {
    subject: `${answer.answer === 'issue' ? 'Objeción: ' : ''}${answer.by} ${verb} · ${answer.about}`,
    why: 'Te avisamos porque el cambio es tuyo.',
    lines: [
      `${who(answer.by, answer.role)} ${verb}.`,
      ...(answer.note ? [`Su nota: «${answer.note}»`] : []),
      ...(answer.progress ? [progressLine(answer.progress)] : []),
      ...(next ? [next] : []),
    ],
    ask: 'Mira el seguimiento',
  };
};

export interface PendingPerson {
  readonly name: string;
  readonly role: string;
  readonly reminders: number;
}

export const escalationMemo = (
  about: string,
  pending: readonly PendingPerson[],
): NoticeMemo => ({
  subject: `Sin respuesta: ${about}`,
  why: 'Te avisamos porque este cambio sigue esperando respuestas.',
  lines: [
    ...pending.map(
      (person) =>
        `${who(person.name, person.role)} no ha respondido, con ${person.reminders === 1 ? '1 recordatorio' : `${person.reminders} recordatorios`}.`,
    ),
    'Háblale directo o revisa si le corresponde responder.',
  ],
  ask: 'Mira el seguimiento',
});
