'use client';

import { Button } from '@team27/ui';
import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useRef, useState } from 'react';

import { Loading, LoadError } from '@/components/common/LoadState';
import { ProvenanceChain } from '@/components/valor/ProvenanceChain';
import { describeError, isAbort } from '@/lib/http';
import {
  getProvenance,
  valuePath,
  type ProvenanceResponse,
} from '@/lib/provenance-api';

import type { ValueRef } from './BaselineBoard';

export function ProvenanceDrawer({
  value,
  refreshKey,
  onClose,
}: {
  readonly value: ValueRef;
  readonly refreshKey: number;
  readonly onClose: () => void;
}) {
  const [state, setState] = useState<{
    key: string;
    data: ProvenanceResponse | null;
    error: string | null;
  }>({ key: '', data: null, error: null });
  const panelRef = useRef<HTMLElement>(null);
  const key = `${value.subjectId}/${value.attribute}`;

  useEffect(() => {
    const controller = new AbortController();
    getProvenance(value.subjectId, value.attribute, controller.signal)
      .then((data) => setState({ key, data, error: null }))
      .catch((error: unknown) => {
        if (!isAbort(error))
          setState({ key, data: null, error: describeError(error) });
      });
    return () => controller.abort();
  }, [value.subjectId, value.attribute, key, refreshKey]);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ready = state.key === key;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="¿De dónde salió este valor?"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="relative flex h-full outline-none w-full max-w-2xl flex-col gap-4 overflow-y-auto bg-plane p-6 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4">
          <h2 className="text-3xl font-semibold text-ink">
            ¿De dónde salió este valor?
          </h2>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </header>
        {!ready && <Loading />}
        {ready && state.error && <LoadError message={state.error} />}
        {ready && state.data && (
          <ProvenanceChain provenance={state.data} large />
        )}
        <Link
          href={valuePath(value.subjectId, value.attribute) as Route}
          className="text-lg font-medium text-accent-text hover:underline"
        >
          Abrir la página completa
        </Link>
      </aside>
    </div>
  );
}
