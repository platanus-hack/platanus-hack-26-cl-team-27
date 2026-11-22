import type { Channel } from './Stakeholder.ts';

export const FINDING_TOPICS = ['dependency', 'cost', 'schedule'] as const;

export type FindingTopic = (typeof FINDING_TOPICS)[number];

export const NOTICE_ROLES = ['costos', 'planificacion', 'ingenieria'] as const;

export type NoticeRole = (typeof NOTICE_ROLES)[number];

export interface NoticeFinding {
  readonly summary: string;
  readonly details: readonly string[];
  readonly action: string;
  readonly topic?: FindingTopic;
}

export interface NoticeImpact {
  readonly costDelta: number;
  readonly delayDays: number;
}

export interface NoticeClash {
  readonly with: string;
  readonly question: string | null;
  readonly combined: NoticeImpact | null;
}

export const NOTICE_KINDS = [
  'change',
  'conflict',
  'answer',
  'escalation',
  'closing',
] as const;

export type NoticeKind = (typeof NOTICE_KINDS)[number];

export const CONFLICT_PARTS = ['author', 'affected'] as const;

export type ConflictPart = (typeof CONFLICT_PARTS)[number];

export interface NoticeConflict {
  readonly overlapId: string;
  readonly first: string;
  readonly firstSource: string;
  readonly second: string;
  readonly secondSource: string;
  readonly area: string | null;
  readonly question: string;
  readonly combined: NoticeImpact | null;
  readonly part: ConflictPart;
  readonly votes: boolean;
}

export interface NoticeMemo {
  readonly subject: string;
  readonly why: string;
  readonly lines: readonly string[];
  readonly ask: string;
}

export interface NoticeContext {
  readonly kind?: NoticeKind;
  readonly role: string;
  readonly recipientName: string;
  readonly impact: NoticeImpact | null;
  readonly clashes: readonly NoticeClash[];
  readonly conflict?: NoticeConflict;
  readonly memo?: NoticeMemo;
  readonly escalatedAt?: string;
}

export const noticeKindOf = (
  context: Pick<NoticeContext, 'kind'> | null | undefined,
): NoticeKind => context?.kind ?? 'change';

export interface Notice {
  readonly title: string;
  readonly findings: readonly NoticeFinding[];
  readonly url: string;
  readonly recipientName?: string | null;
  readonly impact?: NoticeImpact | null;
  readonly clashes?: readonly NoticeClash[];
  readonly why?: string | null;
  readonly conflict?: NoticeConflict | null;
  readonly memo?: NoticeMemo | null;
}

export interface RenderedNotice {
  readonly subject: string;
  readonly text: string;
  readonly html: string | null;
}

export const WHATSAPP_MAX_LENGTH = 600;

export const SLACK_MAX_LENGTH = 1500;

const MINUS = '−';

const moneyFormat = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 2,
});

const sign = (value: number): string => (value > 0 ? '+' : MINUS);

const signedMoney = (value: number): string =>
  `${sign(value)}${moneyFormat.format(Math.abs(value))}`;

const signedDays = (days: number): string =>
  `${sign(days)}${numberFormat.format(Math.abs(days))} ${Math.abs(days) === 1 ? 'día' : 'días'}`;

const plain = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export const topicOf = (finding: NoticeFinding): FindingTopic => {
  if (finding.topic) return finding.topic;
  if (finding.summary.startsWith('El presupuesto ')) return 'cost';
  if (finding.summary.startsWith('La entrega ')) return 'schedule';
  return 'dependency';
};

export const noticeRoleOf = (
  role: string,
  findings: readonly NoticeFinding[] = [],
): NoticeRole => {
  const text = plain(role);
  if (/cost|presupuest/.test(text)) return 'costos';
  if (/planific|plazo|programa/.test(text)) return 'planificacion';
  const topics = findings.map(topicOf);
  if (topics.includes('dependency')) return 'ingenieria';
  if (topics.includes('cost')) return 'costos';
  if (topics.includes('schedule')) return 'planificacion';
  return 'ingenieria';
};

const TOPIC_ORDER: Readonly<Record<NoticeRole, readonly FindingTopic[]>> = {
  costos: ['cost', 'schedule', 'dependency'],
  planificacion: ['schedule', 'cost', 'dependency'],
  ingenieria: ['dependency', 'schedule', 'cost'],
};

const ordered = (
  findings: readonly NoticeFinding[],
  role: NoticeRole,
): NoticeFinding[] => {
  const order = TOPIC_ORDER[role];
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort(
      (a, b) =>
        order.indexOf(topicOf(a.finding)) - order.indexOf(topicOf(b.finding)) ||
        a.index - b.index,
    )
    .map((item) => item.finding);
};

const FALLBACK_WHY: Readonly<Record<FindingTopic, string>> = {
  cost: 'Te avisamos porque llevas el presupuesto y este cambio lo mueve.',
  schedule:
    'Te avisamos porque llevas el plazo y este cambio mueve la entrega.',
  dependency: 'Te avisamos porque tu trabajo depende de lo que cambió.',
};

const ROLE_TOPIC: Readonly<Record<NoticeRole, FindingTopic>> = {
  costos: 'cost',
  planificacion: 'schedule',
  ingenieria: 'dependency',
};

export const fallbackWhy = (
  findings: readonly NoticeFinding[],
  role: NoticeRole,
): string => {
  const [first] = ordered(findings, role);
  return FALLBACK_WHY[first ? topicOf(first) : ROLE_TOPIC[role]];
};

const figures = (impact: NoticeImpact, role: NoticeRole): string | null => {
  const cost =
    impact.costDelta === 0 ? null : `costo ${signedMoney(impact.costDelta)}`;
  const delay =
    impact.delayDays === 0 ? null : `plazo ${signedDays(impact.delayDays)}`;
  const parts = (
    role === 'planificacion' ? [delay, cost] : [cost, delay]
  ).filter((part) => part !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
};

const impactLine = (
  impact: NoticeImpact | null | undefined,
  role: NoticeRole,
): string | null => {
  const text = impact ? figures(impact, role) : null;
  return text ? `Impacto del cambio: ${text}` : null;
};

const clashLines = (
  clashes: readonly NoticeClash[],
  role: NoticeRole,
): string[] =>
  clashes.map((clash) => {
    const together = clash.combined ? figures(clash.combined, role) : null;
    return [
      `Puede chocar con ${clash.with}.`,
      ...(clash.question ? [clash.question] : []),
      ...(together ? [`Los dos juntos: ${together}.`] : []),
    ].join(' ');
  });

const subjectOf = (notice: Notice, role: NoticeRole): string => {
  const impact = notice.impact;
  if (role === 'costos' && impact && impact.costDelta !== 0) {
    return `Costo ${signedMoney(impact.costDelta)} · ${notice.title}`;
  }
  if (role === 'planificacion' && impact && impact.delayDays !== 0) {
    return `Plazo ${signedDays(impact.delayDays)} · ${notice.title}`;
  }
  return notice.title;
};

const firstName = (name: string | null | undefined): string | null =>
  name?.trim().split(/\s+/)[0] || null;

const clip = (text: string, max: number, keep: string): string => {
  if (text.length <= max) return text;
  const head = text.slice(0, text.length - keep.length).trimEnd();
  const room = Math.max(max - keep.length - 2, 0);
  return `${head.slice(0, room).trimEnd()}…\n${keep}`;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

interface Parts {
  readonly subject: string;
  readonly greeting: string | null;
  readonly why: string;
  readonly findings: readonly NoticeFinding[];
  readonly impact: string | null;
  readonly clashes: readonly string[];
}

const emailOf = (notice: Notice, parts: Parts): RenderedNotice => {
  const extras = [...(parts.impact ? [parts.impact] : []), ...parts.clashes];
  const text = [
    ...(parts.greeting ? [`Hola ${parts.greeting}:`, ''] : []),
    notice.title,
    parts.why,
    '',
    ...parts.findings.flatMap((finding) => [
      `• ${finding.summary}`,
      ...finding.details.map((detail) => `  - ${detail}`),
      `  Qué hacer: ${finding.action}`,
      '',
    ]),
    ...extras,
    ...(extras.length > 0 ? [''] : []),
    `Revisa el cambio y responde: ${notice.url}`,
  ].join('\n');
  const findings = parts.findings
    .map(
      (finding) =>
        `<li><p><strong>${escapeHtml(finding.summary)}</strong></p>${
          finding.details.length > 0
            ? `<ul>${finding.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>`
            : ''
        }<p>Qué hacer: ${escapeHtml(finding.action)}</p></li>`,
    )
    .join('');
  const html = [
    parts.greeting ? `<p>Hola ${escapeHtml(parts.greeting)}:</p>` : '',
    `<h2>${escapeHtml(notice.title)}</h2>`,
    `<p>${escapeHtml(parts.why)}</p>`,
    `<ul>${findings}</ul>`,
    extras.map((line) => `<p>${escapeHtml(line)}</p>`).join(''),
    `<p><a href="${escapeHtml(notice.url)}">Revisa el cambio y responde</a></p>`,
  ].join('');
  return { subject: parts.subject, text, html };
};

const whatsappOf = (notice: Notice, parts: Parts): RenderedNotice => {
  const [first, ...rest] = parts.findings;
  const more =
    rest.length === 0
      ? null
      : rest.length === 1
        ? 'Y 1 punto más en el detalle.'
        : `Y ${rest.length} puntos más en el detalle.`;
  const text = [
    notice.title,
    ...(first ? [`${first.summary}. ${first.action}`] : []),
    ...(more ? [more] : []),
    ...(parts.impact ? [parts.impact] : []),
    ...parts.clashes,
  ].join('\n');
  return {
    subject: parts.subject,
    text: clip(`${text}\n${notice.url}`, WHATSAPP_MAX_LENGTH, notice.url),
    html: null,
  };
};

const slackOf = (notice: Notice, parts: Parts): RenderedNotice => {
  const link = `<${notice.url}|Revisa el cambio y responde>`;
  const text = [
    `*${notice.title}*`,
    `_${parts.why}_`,
    ...parts.findings.map(
      (finding) => `• *${finding.summary}*: ${finding.action}`,
    ),
    ...(parts.impact ? [parts.impact] : []),
    ...parts.clashes,
  ].join('\n');
  return {
    subject: parts.subject,
    text: clip(`${text}\n${link}`, SLACK_MAX_LENGTH, link),
    html: null,
  };
};

const CONFLICT_WHY: Readonly<Record<ConflictPart, string>> = {
  author: 'Te avisamos porque uno de los dos cambios es tuyo.',
  affected: 'Te avisamos porque uno de los dos cambios te afecta.',
};

export const conflictTitle = (
  conflict: Pick<NoticeConflict, 'first' | 'second'>,
): string =>
  conflict.first === conflict.second
    ? `Choque en ${conflict.first}`
    : `Choque: ${conflict.first} y ${conflict.second}`;

const conflictWhat = (conflict: NoticeConflict): string =>
  conflict.first === conflict.second
    ? `${conflict.firstSource} y ${conflict.secondSource} cambian datos distintos de ${conflict.first}`
    : `${conflict.first} (${conflict.firstSource}) con ${conflict.second} (${conflict.secondSource})`;

const conflictOf = (
  notice: Notice,
  conflict: NoticeConflict,
  role: NoticeRole,
  channel: Channel,
): RenderedNotice => {
  const subject = conflictTitle(conflict);
  const why = CONFLICT_WHY[conflict.part];
  const what = conflictWhat(conflict);
  const together = conflict.combined ? figures(conflict.combined, role) : null;
  const impact = together
    ? `Los dos juntos: ${together}`
    : impactLine(notice.impact, role);
  const ask = conflict.votes
    ? 'Responde si se tocan o no se tocan'
    : 'Mira el choque';
  if (channel === 'whatsapp') {
    const text = [
      subject,
      `${what}${conflict.area ? `, en ${conflict.area}` : ''}.`,
      conflict.question,
      ...(impact ? [impact] : []),
      `${ask}:`,
    ].join('\n');
    return {
      subject,
      text: clip(`${text}\n${notice.url}`, WHATSAPP_MAX_LENGTH, notice.url),
      html: null,
    };
  }
  if (channel === 'slack') {
    const link = `<${notice.url}|${ask}>`;
    const text = [
      `*${subject}*`,
      `_${why}_`,
      `• *Qué choca:* ${what}`,
      ...(conflict.area ? [`• *Dónde:* ${conflict.area}`] : []),
      `• ${conflict.question}`,
      ...(impact ? [impact] : []),
    ].join('\n');
    return {
      subject,
      text: clip(`${text}\n${link}`, SLACK_MAX_LENGTH, link),
      html: null,
    };
  }
  const greeting = firstName(notice.recipientName);
  const points = [
    `Qué choca: ${what}`,
    ...(conflict.area ? [`Dónde: ${conflict.area}`] : []),
    conflict.question,
  ];
  const text = [
    ...(greeting ? [`Hola ${greeting}:`, ''] : []),
    subject,
    why,
    '',
    ...points.map((point) => `• ${point}`),
    '',
    ...(impact ? [impact, ''] : []),
    `${ask}: ${notice.url}`,
  ].join('\n');
  const html = [
    greeting ? `<p>Hola ${escapeHtml(greeting)}:</p>` : '',
    `<h2>${escapeHtml(subject)}</h2>`,
    `<p>${escapeHtml(why)}</p>`,
    `<ul>${points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>`,
    impact ? `<p>${escapeHtml(impact)}</p>` : '',
    `<p><a href="${escapeHtml(notice.url)}">${escapeHtml(ask)}</a></p>`,
  ].join('');
  return { subject, text, html };
};

const memoOf = (
  notice: Notice,
  memo: NoticeMemo,
  role: NoticeRole,
  channel: Channel,
): RenderedNotice => {
  const { subject } = memo;
  const impact = impactLine(notice.impact, role);
  if (channel === 'whatsapp') {
    const text = [
      subject,
      ...memo.lines,
      ...(impact ? [impact] : []),
      `${memo.ask}:`,
    ].join('\n');
    return {
      subject,
      text: clip(`${text}\n${notice.url}`, WHATSAPP_MAX_LENGTH, notice.url),
      html: null,
    };
  }
  if (channel === 'slack') {
    const link = `<${notice.url}|${memo.ask}>`;
    const text = [
      `*${subject}*`,
      `_${memo.why}_`,
      ...memo.lines.map((line) => `• ${line}`),
      ...(impact ? [impact] : []),
    ].join('\n');
    return {
      subject,
      text: clip(`${text}\n${link}`, SLACK_MAX_LENGTH, link),
      html: null,
    };
  }
  const greeting = firstName(notice.recipientName);
  const text = [
    ...(greeting ? [`Hola ${greeting}:`, ''] : []),
    subject,
    memo.why,
    '',
    ...memo.lines.map((line) => `• ${line}`),
    '',
    ...(impact ? [impact, ''] : []),
    `${memo.ask}: ${notice.url}`,
  ].join('\n');
  const html = [
    greeting ? `<p>Hola ${escapeHtml(greeting)}:</p>` : '',
    `<h2>${escapeHtml(subject)}</h2>`,
    `<p>${escapeHtml(memo.why)}</p>`,
    `<ul>${memo.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
    impact ? `<p>${escapeHtml(impact)}</p>` : '',
    `<p><a href="${escapeHtml(notice.url)}">${escapeHtml(memo.ask)}</a></p>`,
  ].join('');
  return { subject, text, html };
};

export const renderNotice = (
  notice: Notice,
  role: NoticeRole,
  channel: Channel,
): RenderedNotice => {
  if (notice.memo) return memoOf(notice, notice.memo, role, channel);
  if (notice.conflict) {
    return conflictOf(notice, notice.conflict, role, channel);
  }
  const findings = ordered(notice.findings, role);
  const parts: Parts = {
    subject: subjectOf(notice, role),
    greeting: firstName(notice.recipientName),
    why: notice.why?.trim() || fallbackWhy(findings, role),
    findings,
    impact: impactLine(notice.impact, role),
    clashes: clashLines(notice.clashes ?? [], role),
  };
  if (channel === 'whatsapp') return whatsappOf(notice, parts);
  if (channel === 'slack') return slackOf(notice, parts);
  return emailOf(notice, parts);
};
