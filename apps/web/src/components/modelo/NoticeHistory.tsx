'use client';

import { cx, PageHeader } from '@team27/ui';
import {
  Bot,
  Box,
  CircleAlert,
  CircleCheck,
  Clock,
  Hash,
  Mail,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import { getHistory, type HistoryNotice } from '@/lib/model-api';
import { projectPage } from '@/lib/project-paths';

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageCircle,
  slack: Hash,
};

const KIND_LABEL: Record<string, string> = {
  change: 'Aviso de cambio',
  conflict: 'Choque',
  answer: 'Respuesta',
  escalation: 'Escalamiento',
  closing: 'Cambio coordinado',
};

const STATUS: Record<string, { label: string; tone: string; Icon: typeof Mail }> = {
  sent: { label: 'Enviado', tone: 'text-emerald-700 bg-emerald-50', Icon: CircleCheck },
  pending: { label: 'En cola', tone: 'text-amber-700 bg-amber-50', Icon: Clock },
  failed: { label: 'Falló', tone: 'text-red-700 bg-red-50', Icon: CircleAlert },
  skipped: { label: 'Sin canal', tone: 'text-ink-2 bg-surface-2', Icon: CircleAlert },
};

const when = (at: string) =>
  new Date(at).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

function Preview({ notice }: { readonly notice: HistoryNotice }) {
  if (!notice.html) {
    return (
      <pre className="p-5 text-sm whitespace-pre-wrap text-ink">{notice.text}</pre>
    );
  }
  return (
    <iframe
      title={notice.subject}
      srcDoc={notice.html}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      className="h-[70vh] w-full border-0 bg-[#f3f5f9]"
    />
  );
}

export function NoticeHistory({ projectId }: { readonly projectId: string }) {
  const [person, setPerson] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const history = useResource(
    (signal) => getHistory(projectId, person, signal),
    `history:${projectId}:${person ?? 'all'}:${tick}`,
  );

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 10_000);
    return () => clearInterval(timer);
  }, []);

  if (history.error) return <LoadError message={history.error} />;
  if (!history.data) return <Loading />;
  const { people, notices } = history.data;
  const open = notices.find((item) => item.id === selected) ?? notices[0] ?? null;
  const total = people.reduce((sum, item) => sum + item.count, 0);

  return (
    <>
      <PageHeader
        title="Historial de avisos"
        description="Cada aviso que Vigente mandó, a quién, por qué canal y cómo se vio el correo."
        actions={
          <button
            type="button"
            onClick={() => setTick((value) => value + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-sm font-medium text-ink hover:border-ink-3"
          >
            <RefreshCw className="size-4" />
            Actualizar
          </button>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,22rem)_minmax(0,1fr)]">
        <aside className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface p-2">
          <button
            type="button"
            onClick={() => {
              setPerson(null);
              setSelected(null);
            }}
            className={cx(
              'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
              person === null ? 'bg-surface-2 font-semibold text-ink' : 'text-ink-2 hover:bg-surface-2',
            )}
          >
            <span className="flex items-center gap-2">
              <Users className="size-4" />
              Todo el equipo
            </span>
            <span className="text-xs text-ink-3">{total}</span>
          </button>
          {people.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setPerson(item.id);
                setSelected(null);
              }}
              className={cx(
                'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm',
                person === item.id ? 'bg-surface-2 font-semibold text-ink' : 'text-ink-2 hover:bg-surface-2',
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-text">
                  {initials(item.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{item.name}</span>
                  <span className="block truncate text-[11px] font-normal text-ink-3">
                    {item.role}
                  </span>
                </span>
              </span>
              <span className="text-xs text-ink-3">{item.count}</span>
            </button>
          ))}
        </aside>
        <section className="flex max-h-[75vh] flex-col overflow-y-auto rounded-xl border border-hairline bg-surface">
          {notices.length === 0 && (
            <p className="p-6 text-center text-sm text-ink-2">
              Todavía no hay avisos. Cambia el modelo 3D para generar uno.
            </p>
          )}
          {notices.map((item) => {
            const ChannelIcon = CHANNEL_ICON[item.channel] ?? Mail;
            const status = STATUS[item.delivery?.status ?? 'pending'] ?? STATUS.pending!;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={cx(
                  'flex flex-col gap-1.5 border-b border-hairline px-4 py-3 text-left transition last:border-0',
                  open?.id === item.id ? 'bg-accent-soft/50' : 'hover:bg-surface-2',
                )}
              >
                <span className="flex items-center justify-between gap-2 text-xs text-ink-3">
                  <span className="flex items-center gap-1.5">
                    <ChannelIcon className="size-3.5" />
                    {item.name}
                  </span>
                  <span>{when(item.sentAt)}</span>
                </span>
                <span className="line-clamp-2 text-sm font-medium text-ink">
                  {item.subject}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2">
                    {KIND_LABEL[item.kind] ?? item.kind}
                  </span>
                  <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]', status.tone)}>
                    <status.Icon className="size-3" />
                    {status.label}
                  </span>
                  {item.aiAdded && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">
                      <Sparkles className="size-3" />
                      Sumado por IA
                    </span>
                  )}
                  {item.whyBy && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">
                      <Bot className="size-3" />
                      {item.whyBy}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </section>
        <section className="overflow-hidden rounded-xl border border-hairline bg-surface">
          {open ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{open.subject}</p>
                  <p className="text-xs text-ink-3">
                    Para {open.name}
                    {open.role ? ` · ${open.role}` : ''}
                    {open.delivery?.reason ? ` · ${open.delivery.reason}` : ''}
                  </p>
                </div>
                <Link
                  href={projectPage(projectId, `/cambios/${open.changeId}`) as Route}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent-text"
                >
                  <Box className="size-3.5" />
                  Ver el cambio
                </Link>
              </header>
              <Preview notice={open} />
            </>
          ) : (
            <p className="p-6 text-sm text-ink-2">Elige un aviso para ver el correo.</p>
          )}
        </section>
      </div>
    </>
  );
}
