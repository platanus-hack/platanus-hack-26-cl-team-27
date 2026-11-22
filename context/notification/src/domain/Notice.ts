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

export interface NoticeDiff {
  readonly label: string;
  readonly before: string | null;
  readonly after: string | null;
}

export interface NoticeSuggestion {
  readonly probability: number;
  readonly reason: string;
  readonly evidence: string;
  readonly model: string;
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
  readonly why?: string | null;
  readonly whyBy?: string | null;
  readonly diffs?: readonly NoticeDiff[];
  readonly suggested?: NoticeSuggestion;
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
  readonly whyBy?: string | null;
  readonly diffs?: readonly NoticeDiff[];
  readonly suggested?: NoticeSuggestion | null;
}

export const VISUAL_FOCUSES = ['muros', 'losa', 'canerias'] as const;

export type VisualFocus = (typeof VISUAL_FOCUSES)[number];

export interface NoticeVisual {
  readonly focus: VisualFocus;
  readonly color: string;
  readonly caption: string;
}

export const VISUAL_CID = 'vista-modelo@vigente';

export const VISUAL_START = '<!--vista-->';

export const VISUAL_END = '<!--/vista-->';

export interface RenderedNotice {
  readonly subject: string;
  readonly text: string;
  readonly html: string | null;
  readonly visual?: NoticeVisual | null;
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

const ROLE_COLOR: Readonly<Record<NoticeRole, string>> = {
  ingenieria: '#256abf',
  costos: '#d92d20',
  planificacion: '#7a5af8',
};

const FOCUS_WORDS: readonly (readonly [VisualFocus, RegExp])[] = [
  [
    'canerias',
    /shaft|cañer|caner|tuber|sanitari|colector|agua|desag|alcantar|ducto|instalaci/,
  ],
  ['losa', /losa|viga|column|pilar|fundaci|estructur|radier|escaler|techumbre/],
];

const FOCUS_CAPTION: Readonly<Record<VisualFocus, string>> = {
  muros: 'muros, puertas y ventanas',
  losa: 'losas, vigas y columnas',
  canerias: 'cañerías y artefactos sanitarios',
};

export const visualOf = (notice: Notice, role: NoticeRole): NoticeVisual => {
  const text = plain(
    [
      notice.title,
      ...(notice.diffs ?? []).map((diff) => diff.label),
      ...notice.findings.map((finding) => finding.summary),
    ].join(' '),
  );
  const focus =
    FOCUS_WORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'muros';
  return {
    focus,
    color: ROLE_COLOR[role],
    caption: `En color, ${FOCUS_CAPTION[focus]} que toca este cambio; el resto del modelo en gris.`,
  };
};

const visualBlock = (visual: NoticeVisual): string =>
  [
    VISUAL_START,
    `<p style="margin:24px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5b6678;">&#127959;&#65039; En el modelo 3D</p>`,
    `<img src="cid:${VISUAL_CID}" width="552" alt="Vista del modelo con lo que cambia en color" style="display:block;width:100%;max-width:552px;height:auto;border:1px solid #e3e8f0;border-radius:10px;">`,
    `<p style="margin:6px 0 0;font-size:12px;color:#5b6678;">${escapeHtml(visual.caption)}</p>`,
    VISUAL_END,
  ].join('');

const BLUE = '#256abf';
const INK = '#1b2433';
const MUTED = '#5b6678';
const LINE = '#e3e8f0';
const UP = '#b42318';
const UP_BG = '#fdecea';
const DOWN = '#067647';
const DOWN_BG = '#e7f6ec';
const AI = '#6941c6';
const AI_BG = '#f4f0ff';
const WARN = '#93370d';
const WARN_BG = '#fff4e5';

const FONT =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

const percent = (value: number): string =>
  `${Math.round(Math.min(Math.max(value, 0), 1) * 100)} %`;

const shown = (value: string | null): string =>
  value === null || value.trim() === '' ? '—' : value;

const LABEL_STYLE = `margin:24px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};`;

const diffRow = (diff: NoticeDiff, index: number): string => {
  const border = index > 0 ? `border-top:1px solid ${LINE};` : '';
  return [
    '<tr>',
    `<td style="padding:12px 14px;${border}font-size:14px;color:${INK};">${escapeHtml(diff.label)}</td>`,
    `<td align="right" style="padding:12px 14px;${border}white-space:nowrap;font-size:14px;">`,
    `<span style="display:inline-block;padding:3px 8px;border-radius:6px;background:${UP_BG};color:${UP};text-decoration:line-through;">${escapeHtml(shown(diff.before))}</span>`,
    `<span style="color:${MUTED};padding:0 8px;">&rarr;</span>`,
    `<span style="display:inline-block;padding:3px 8px;border-radius:6px;background:${DOWN_BG};color:${DOWN};font-weight:600;">${escapeHtml(shown(diff.after))}</span>`,
    '</td></tr>',
  ].join('');
};

const diffTable = (diffs: readonly NoticeDiff[]): string =>
  diffs.length === 0
    ? ''
    : [
        `<p style="${LABEL_STYLE}">&#128260; Qué cambió</p>`,
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:10px;border-collapse:separate;">`,
        diffs.map(diffRow).join(''),
        '</table>',
      ].join('');

const tile = (label: string, value: string, worse: boolean): string =>
  [
    '<td width="50%" style="padding:6px;">',
    `<div style="border-radius:10px;padding:14px 16px;background:${worse ? UP_BG : DOWN_BG};">`,
    `<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</div>`,
    `<div style="font-size:24px;font-weight:700;color:${worse ? UP : DOWN};margin-top:4px;">${escapeHtml(value)}</div>`,
    '</div></td>',
  ].join('');

const impactTiles = (impact: NoticeImpact | null | undefined): string => {
  if (!impact || (impact.costDelta === 0 && impact.delayDays === 0)) return '';
  const tiles = [
    ...(impact.costDelta !== 0
      ? [tile('💰 Costo', signedMoney(impact.costDelta), impact.costDelta > 0)]
      : []),
    ...(impact.delayDays !== 0
      ? [tile('📅 Plazo', signedDays(impact.delayDays), impact.delayDays > 0)]
      : []),
  ];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>${tiles.join('')}</tr></table>`;
};

const aiBadge = (text: string): string =>
  `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${AI};color:#ffffff;font-size:12px;font-weight:600;">&#129302; ${escapeHtml(text)}</span>`;

const suggestionBlock = (suggested: NoticeSuggestion): string =>
  [
    `<div style="margin-top:20px;border-radius:10px;padding:16px;background:${AI_BG};border:1px solid #d9ccff;">`,
    aiBadge(
      `${suggested.model} · ${percent(suggested.probability)} de probabilidad`,
    ),
    `<p style="margin:10px 0 0;font-size:15px;color:${INK};">&#128269; Las reglas no te marcaron, pero ${escapeHtml(suggested.model)} leyó el cambio y cree que te toca.</p>`,
    `<p style="margin:8px 0 0;font-size:14px;color:${MUTED};">${escapeHtml(suggested.reason)}</p>`,
    suggested.evidence.trim()
      ? `<p style="margin:8px 0 0;font-size:13px;color:${MUTED};font-style:italic;">${escapeHtml(suggested.evidence)}</p>`
      : '',
    '</div>',
  ].join('');

const whyBlock = (why: string, whyBy: string | null | undefined): string =>
  [
    `<div style="margin-top:20px;border-left:4px solid ${whyBy ? AI : BLUE};padding:4px 0 4px 14px;">`,
    whyBy
      ? `<div style="margin-bottom:6px;">${aiBadge(`Escrito por ${whyBy}`)}</div>`
      : '',
    `<p style="margin:0;font-size:16px;line-height:1.5;color:${INK};">&#128161; ${escapeHtml(why)}</p>`,
    '</div>',
  ].join('');

const TOPIC_ICON: Readonly<Record<FindingTopic, string>> = {
  dependency: '&#128295;',
  cost: '&#128176;',
  schedule: '&#9201;&#65039;',
};

const findingCard = (finding: NoticeFinding): string =>
  [
    `<div style="border:1px solid ${LINE};border-radius:10px;padding:14px 16px;margin-bottom:10px;">`,
    `<p style="margin:0;font-size:15px;font-weight:600;color:${INK};">${TOPIC_ICON[topicOf(finding)]} ${escapeHtml(finding.summary)}</p>`,
    finding.details.length > 0
      ? `<ul style="margin:8px 0 0;padding-left:18px;color:${MUTED};font-size:14px;">${finding.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>`
      : '',
    `<p style="margin:10px 0 0;font-size:14px;color:${BLUE};">&#128073; <strong>Qué hacer:</strong> ${escapeHtml(finding.action)}</p>`,
    '</div>',
  ].join('');

const findingCards = (findings: readonly NoticeFinding[]): string =>
  findings.length === 0
    ? ''
    : `<p style="${LABEL_STYLE}">&#9989; Lo que te toca</p>${findings.map(findingCard).join('')}`;

const clashBlock = (clashes: readonly string[]): string =>
  clashes.length === 0
    ? ''
    : `<div style="margin-top:16px;border-radius:10px;padding:14px 16px;background:${WARN_BG};color:${WARN};font-size:14px;"><strong>&#9888;&#65039; Puede chocar</strong>${clashes.map((line) => `<p style="margin:6px 0 0;">${escapeHtml(line)}</p>`).join('')}</div>`;

const emailFrame = (
  label: string,
  body: string,
  url: string,
  ask: string,
): string =>
  [
    '<!doctype html><html><body style="margin:0;padding:0;background:#f3f5f9;">',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9;${FONT}"><tr><td align="center" style="padding:24px 12px;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${LINE};">`,
    `<tr><td style="background:${BLUE};padding:18px 24px;color:#ffffff;">`,
    '<span style="font-size:18px;font-weight:700;letter-spacing:.02em;">&#128208; Vigente</span>',
    `<span style="float:right;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;padding-top:4px;">&#128276; ${escapeHtml(label)}</span>`,
    '</td></tr>',
    `<tr><td style="padding:24px;">${body}`,
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr>',
    `<td style="border-radius:8px;background:${BLUE};"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(ask)} &rarr;</a></td>`,
    '</tr></table></td></tr>',
    `<tr><td style="padding:14px 24px;border-top:1px solid ${LINE};font-size:12px;color:${MUTED};">Vigente avisa a cada equipo cuando un cambio del proyecto lo afecta.</td></tr>`,
    '</table></td></tr></table></body></html>',
  ].join('');

const emailOf = (
  notice: Notice,
  parts: Parts,
  visual: NoticeVisual,
): RenderedNotice => {
  const extras = [...(parts.impact ? [parts.impact] : []), ...parts.clashes];
  const suggested = notice.suggested ?? null;
  const diffs = notice.diffs ?? [];
  const text = [
    ...(parts.greeting ? [`Hola ${parts.greeting}:`, ''] : []),
    notice.title,
    parts.why,
    ...(suggested
      ? [
          '',
          `${suggested.model} cree que este cambio te afecta (${percent(suggested.probability)}): ${suggested.reason}`,
        ]
      : []),
    ...(diffs.length > 0
      ? [
          '',
          ...diffs.map(
            (diff) =>
              `${diff.label}: ${shown(diff.before)} → ${shown(diff.after)}`,
          ),
        ]
      : []),
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
  const body = [
    parts.greeting
      ? `<p style="margin:0 0 6px;font-size:15px;color:${MUTED};">Hola ${escapeHtml(parts.greeting)}:</p>`
      : '',
    `<h1 style="margin:0;font-size:22px;line-height:1.3;color:${INK};">${escapeHtml(notice.title)}</h1>`,
    suggested ? suggestionBlock(suggested) : '',
    whyBlock(parts.why, notice.whyBy),
    impactTiles(notice.impact),
    visualBlock(visual),
    diffTable(diffs),
    findingCards(parts.findings),
    clashBlock(parts.clashes),
  ].join('');
  return {
    subject: parts.subject,
    text,
    html: emailFrame(
      suggested ? 'Detectado por IA' : 'Aviso de cambio',
      body,
      notice.url,
      'Revisa el cambio y responde',
    ),
    visual,
  };
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
  return emailOf(notice, parts, visualOf(notice, role));
};
