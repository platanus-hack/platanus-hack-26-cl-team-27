'use client';

import { cx } from '@team27/ui';
import {
  Bell,
  Box,
  ChevronDown,
  FolderKanban,
  History,
  Mail,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useResource } from '@/hooks/use-resource';
import { getProjects } from '@/lib/accounts-api';
import { getEvents, type ProjectEvent } from '@/lib/events-api';
import { projectPage } from '@/lib/project-paths';

const POLL_MS = 5_000;

const projectFrom = (pathname: string): string | null => {
  const match = /^\/proyectos\/([^/]+)/.exec(pathname);
  return match && match[1] !== 'nuevo' ? decodeURIComponent(match[1]!) : null;
};

const seenKey = (projectId: string) => `vigente:visto:${projectId}`;

const readSeen = (projectId: string): number => {
  try {
    return Number(localStorage.getItem(seenKey(projectId)) ?? 0);
  } catch {
    return 0;
  }
};

const EVENT_ICON: Record<string, typeof Bell> = {
  'revision.received': Box,
  'notice.sent': Mail,
};

const ago = (at: string): string => {
  const seconds = Math.max(0, (Date.now() - new Date(at).getTime()) / 1000);
  if (seconds < 60) return 'ahora';
  if (seconds < 3600) return `hace ${Math.round(seconds / 60)} min`;
  return `hace ${Math.round(seconds / 3600)} h`;
};

function NotificationBell({ projectId }: { readonly projectId: string }) {
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [seen, setSeen] = useState(0);
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const cursor = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeen(readSeen(projectId));
    setEvents([]);
    cursor.current = null;
    let stopped = false;
    const tick = async () => {
      try {
        if (cursor.current === null) {
          const head = await getEvents(projectId, null);
          const start = Math.max(0, head.cursor - 12);
          const first = await getEvents(projectId, start);
          cursor.current = first.cursor;
          if (!stopped) setEvents([...first.events].reverse());
          return;
        }
        const next = await getEvents(projectId, cursor.current);
        cursor.current = next.cursor;
        if (!stopped && next.events.length > 0) {
          setEvents((previous) =>
            [...[...next.events].reverse(), ...previous].slice(0, 30),
          );
          setPulse(true);
          setTimeout(() => setPulse(false), 1500);
        }
      } catch {
        return;
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const unread = events.filter((event) => event.seq > seen).length;
  const markSeen = () => {
    const top = events[0]?.seq ?? 0;
    setSeen(top);
    try {
      localStorage.setItem(seenKey(projectId), String(top));
    } catch {
      return;
    }
  };

  return (
    <div ref={box} className="relative flex items-center">
      <button
        type="button"
        aria-label={`Notificaciones${unread > 0 ? `, ${unread} nuevas` : ''}`}
        onClick={() => {
          setOpen((value) => !value);
          markSeen();
        }}
        className={cx(
          'relative flex size-9 items-center justify-center rounded-full border border-hairline bg-surface text-ink-2 transition hover:text-ink',
          pulse && 'animate-pulse text-accent-text',
        )}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-11 right-0 z-40 w-[22rem] max-w-[90vw] overflow-hidden rounded-xl border border-hairline bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <span className="text-sm font-semibold text-ink">En vivo</span>
            <Link
              href={projectPage(projectId, '/avisos') as Route}
              className="flex items-center gap-1 text-xs font-medium text-accent-text"
              onClick={() => setOpen(false)}
            >
              <History className="size-3.5" />
              Historial de avisos
            </Link>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {events.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-2">
                Todavía no pasa nada en este proyecto.
              </li>
            )}
            {events.map((event) => {
              const EventIcon = EVENT_ICON[event.kind] ?? Bell;
              return (
                <li
                  key={event.seq}
                  className={cx(
                    'flex gap-3 border-b border-hairline px-4 py-3 last:border-0',
                    event.seq > seen && 'bg-accent-soft/40',
                  )}
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent-text">
                    <EventIcon className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug text-ink">
                      {event.message}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-3">{ago(event.at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProjectSwitcher({ projectId }: { readonly projectId: string | null }) {
  const projects = useResource(getProjects, 'projects');
  const list = projects.data?.projects ?? [];
  const current = list.find((project) => project.id === projectId);
  const [open, setOpen] = useState(false);
  if (list.length === 0) return null;
  return (
    <div className="relative hidden items-center sm:flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 max-w-56 items-center gap-2 rounded-full border border-hairline bg-surface px-3 text-sm text-ink transition hover:border-ink-3"
      >
        <FolderKanban className="size-4 shrink-0 text-accent-text" />
        <span className="truncate">
          {current?.name ?? 'Elige un proyecto'}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
      </button>
      {open && (
        <ul className="absolute top-11 left-0 z-40 w-64 overflow-hidden rounded-xl border border-hairline bg-surface py-1 shadow-xl">
          {list.map((project) => (
            <li key={project.id}>
              <Link
                href={projectPage(project.id) as Route}
                onClick={() => setOpen(false)}
                className={cx(
                  'flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2',
                  project.id === projectId && 'font-semibold text-accent-text',
                )}
              >
                <FolderKanban className="size-4 text-ink-3" />
                <span className="truncate">{project.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HeaderTools() {
  const pathname = usePathname();
  const fromPath = projectFrom(pathname);
  const projects = useResource(getProjects, 'projects');
  const projectId = fromPath ?? projects.data?.projects[0]?.id ?? null;
  return (
    <div className="flex items-center gap-2">
      <ProjectSwitcher projectId={fromPath} />
      {projectId && <NotificationBell projectId={projectId} />}
    </div>
  );
}
