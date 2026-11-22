import { cx } from '@team27/ui';

import { Avatar } from '@/components/common/Avatar';
import { Icon, type IconName } from '@/components/common/Icon';
import { RelativeTime } from '@/components/common/RelativeTime';
import type {
  FollowUp,
  FollowUpAnswer,
  FollowUpPerson,
  NoticeChannel,
  NoticeDelivery,
} from '@/lib/changes-api';

const sentBy: Record<NoticeChannel, string> = {
  email: 'correo',
  whatsapp: 'WhatsApp',
  slack: 'Slack',
};

export const deliveryText = (delivery: NoticeDelivery | null): string => {
  if (!delivery) return 'Notificador: este aviso no tiene envío.';
  const channel = sentBy[delivery.channel];
  if (delivery.status === 'sent') {
    return `Notificador: enviado por ${channel}.${delivery.reason ? ` ${delivery.reason}.` : ''}`;
  }
  if (delivery.status === 'skipped') {
    return `Notificador: no se envió. ${delivery.reason ?? 'Sin motivo registrado'}.`;
  }
  if (delivery.status === 'failed') {
    return `Notificador: falló el envío por ${channel}. ${delivery.reason ?? ''}`;
  }
  return `Notificador: en cola para salir por ${channel}.`;
};

export const deliveryIcon = (
  delivery: NoticeDelivery | null,
): { readonly icon: IconName; readonly className: string } => {
  if (!delivery) return { icon: 'minus', className: 'text-ink-3' };
  if (delivery.status === 'sent')
    return { icon: 'send', className: 'text-good' };
  if (delivery.status === 'failed')
    return { icon: 'alert', className: 'text-critical' };
  if (delivery.status === 'skipped')
    return { icon: 'ban', className: 'text-ink-3' };
  return { icon: 'hourglass', className: 'text-warning' };
};

const ANSWER_ICON: Record<FollowUpAnswer, IconName> = {
  reviewed: 'userCheck',
  issue: 'alert',
  not_affected: 'ban',
  se_tocan: 'conflict',
  no_se_tocan: 'check',
};

const iconOf = (person: FollowUpPerson): IconName =>
  person.answer
    ? ANSWER_ICON[person.answer]
    : person.awaiting
      ? 'hourglass'
      : 'minus';

const NOTICE_ICON = {
  answer: 'chat',
  escalation: 'flag',
  closing: 'handshake',
} as const satisfies Record<string, IconName>;

const ANSWER_TEXT: Record<FollowUpAnswer, string> = {
  reviewed: 'Confirmó',
  issue: 'Objetó',
  not_affected: 'Dice que no le afecta',
  se_tocan: 'Dice que se tocan',
  no_se_tocan: 'Dice que no se tocan',
};

const stateOf = (person: FollowUpPerson): string => {
  if (person.answer) return ANSWER_TEXT[person.answer];
  return person.awaiting
    ? 'Falta su respuesta'
    : 'Ya no hace falta su respuesta';
};

const toneOf = (person: FollowUpPerson): string => {
  if (person.answer === 'issue' || person.answer === 'se_tocan') {
    return 'text-critical-text';
  }
  if (person.answer === 'reviewed' || person.answer === 'no_se_tocan') {
    return 'text-good-text';
  }
  return 'text-ink-2';
};

const DEFAULT_NOTE = 'Dijo que no le afecta';

const NOTICE_KIND = {
  answer: 'Respuesta',
  escalation: 'Escalamiento',
  closing: 'Cierre',
} as const;

export function ChangeFollowUp({ followUp }: { readonly followUp: FollowUp }) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      <ul className="stagger flex flex-col">
        {followUp.people.map((person) => (
          <li
            key={`${person.about}/${person.stakeholderId}`}
            className="flex gap-3 border-b border-hairline py-2.5 last:border-0"
          >
            <Avatar
              name={person.name}
              size="sm"
              decision={
                person.answer === 'reviewed' || person.answer === 'no_se_tocan'
                  ? 'approve'
                  : person.answer === 'issue' || person.answer === 'se_tocan'
                    ? 'dispute'
                    : person.awaiting
                      ? null
                      : undefined
              }
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-medium text-ink">
                  {person.name}{' '}
                  <span className="font-normal text-ink-2">
                    · {person.role}
                    {person.about === 'conflict' ? ' · valida el choque' : ''}
                  </span>
                </p>
                <RelativeTime
                  at={person.answeredAt}
                  className="text-xs text-ink-2"
                />
              </div>
              <p className={cx('flex items-center gap-1.5', toneOf(person))}>
                <Icon name={iconOf(person)} />
                {stateOf(person)}
              </p>
              {person.note && person.note !== DEFAULT_NOTE && (
                <p className="text-ink">«{person.note}»</p>
              )}
              {person.reminders > 0 && (
                <p className="flex flex-wrap items-center gap-x-1.5 text-ink-2">
                  <Icon name="bellRing" className="text-warning" />
                  {person.reminders === 1
                    ? 'Le recordamos 1 vez'
                    : `Le recordamos ${person.reminders} veces`}
                  {person.lastReminderAt && (
                    <>
                      , la última <RelativeTime at={person.lastReminderAt} />
                    </>
                  )}
                  .
                </p>
              )}
              {person.escalatedAt && (
                <p className="flex items-center gap-1.5 text-critical-text">
                  <Icon name="flag" />
                  Escalado al autor y a la administración del proyecto.
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {followUp.authorNotices.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">
            Avisos al autor{' '}
            <span className="font-normal text-ink-2">
              · cada respuesta, escalamiento y cierre
            </span>
          </h4>
          <ul className="flex flex-col gap-3">
            {followUp.authorNotices.map((notice) => (
              <li
                key={notice.id}
                className="rounded-lg border border-hairline p-4"
              >
                <p className="flex flex-wrap items-center gap-x-1.5 font-medium text-ink">
                  <Icon
                    name={NOTICE_ICON[notice.kind]}
                    className="text-accent-text"
                  />
                  {notice.subject}{' '}
                  <span className="font-normal text-ink-2">
                    · {NOTICE_KIND[notice.kind]} para{' '}
                    {notice.toName ?? notice.to}
                  </span>
                </p>
                {notice.lines.map((line) => (
                  <p key={line} className="text-ink-2">
                    {line}
                  </p>
                ))}
                <p className="mt-2 flex items-start gap-1.5 border-t border-hairline pt-2 text-ink-2">
                  <Icon
                    name={deliveryIcon(notice.delivery).icon}
                    className={cx(
                      'mt-0.5',
                      deliveryIcon(notice.delivery).className,
                    )}
                  />
                  {deliveryText(notice.delivery)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
