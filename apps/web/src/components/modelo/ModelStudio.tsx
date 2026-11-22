'use client';

import { cx, PageHeader } from '@team27/ui';
import {
  ArrowRight,
  Box,
  CircleCheck,
  CloudUpload,
  History,
  Loader,
  RotateCcw,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import { describeError } from '@/lib/http';
import {
  getModel,
  type ModelChangeResult,
  type ModelOption,
  modelImage,
  postModelChange,
} from '@/lib/model-api';
import { projectPage } from '@/lib/project-paths';

const numberFormat = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

const formatValue = (value: number | string | null, unit: string | null) =>
  value === null
    ? '—'
    : `${typeof value === 'number' ? numberFormat.format(value) : value}${unit ? ` ${unit}` : ''}`;

const optionKey = (option: ModelOption) => `${option.subject}/${option.attribute}`;

export function ModelStudio({ projectId }: { readonly projectId: string }) {
  const [version, setVersion] = useState(0);
  const model = useResource(
    (signal) => getModel(projectId, signal),
    `model:${projectId}:${version}`,
  );
  const [roleId, setRoleId] = useState<string | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ModelChangeResult[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);

  const roles = model.data?.roles ?? [];
  const role = roles.find((item) => item.id === roleId) ?? roles[0] ?? null;
  const option =
    role?.options.find((item) => optionKey(item) === optionId) ??
    role?.options[0] ??
    null;
  const current = typeof option?.current === 'number' ? option.current : null;

  useEffect(() => {
    if (!option) return;
    setValue(
      current ?? Number(((option.min + option.max) / 2).toFixed(2)),
    );
  }, [option, current]);

  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShown(
        value !== null && current !== null && option?.unit === 'm'
          ? Math.round((value - current) * 2) / 2
          : 0,
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [value, current, option?.unit]);
  const imageUrl = modelImage(
    projectId,
    role?.id ?? '',
    option ? { subject: option.subject, unit: option.unit } : undefined,
    shown,
  );
  useEffect(() => setImageLoaded(false), [imageUrl]);

  const delta = useMemo(
    () => (value !== null && current !== null ? value - current : null),
    [value, current],
  );

  if (model.error) return <LoadError message={model.error} />;
  if (!model.data) return <Loading />;
  if (!role || !option) {
    return (
      <>
        <PageHeader title="Modelo 3D" />
        <LoadError message="Este proyecto no tiene los planos que el modelo necesita." />
      </>
    );
  }

  const apply = async () => {
    if (value === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postModelChange(projectId, {
        role: role.id,
        subject: option.subject,
        attribute: option.attribute,
        value,
      });
      setResults((previous) => [result, ...previous].slice(0, 6));
      setVersion((previous) => previous + 1);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Modelo 3D"
        description="Cambia el modelo como en Autodesk: cada cambio entra como una versión nueva y Vigente avisa a quien afecta."
        actions={
          <Link
            href={projectPage(projectId, '/avisos') as Route}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-sm font-medium text-ink hover:border-ink-3"
          >
            <History className="size-4" />
            Ver los avisos
          </Link>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {roles.map((item) => {
          const active = item.id === role.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setRoleId(item.id);
                setOptionId(null);
                setError(null);
              }}
              className={cx(
                'flex items-start gap-3 rounded-xl border p-3 text-left transition',
                active
                  ? 'border-transparent shadow-md ring-2'
                  : 'border-hairline bg-surface hover:border-ink-3',
              )}
              style={
                active
                  ? { background: `${item.color}14`, ['--tw-ring-color' as string]: item.color }
                  : undefined
              }
            >
              <span className="text-2xl leading-none">{item.emoji}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">
                  {item.name}
                </span>
                <span className="block text-xs text-ink-2">{item.summary}</span>
                <span className="mt-1 block truncate text-[11px] text-ink-3">
                  {item.document} · {item.owner}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-xl border border-hairline bg-white">
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-ink shadow-sm">
            <Box className="size-3.5" style={{ color: role.color }} />
            Duplex · en color lo que toca {role.name.toLowerCase()}
          </div>
          {shown !== 0 && (
            <div className="absolute right-3 bottom-3 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow-sm" style={{ color: role.color }}>
              Vista previa: se mueve {shown > 0 ? '+' : '−'}
              {Math.abs(shown)} m · en claro, donde está hoy
            </div>
          )}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-2">
              <Loader className="mr-2 size-4 animate-spin" />
              Dibujando el modelo…
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Modelo 3D con ${role.name} en color`}
            onLoad={() => setImageLoaded(true)}
            className={cx(
              'block aspect-[900/560] w-full object-contain transition-opacity duration-500',
              imageLoaded ? 'opacity-100' : 'opacity-40',
            )}
          />
        </section>
        <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-5">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
              Elemento
            </span>
            <div className="flex flex-col gap-1.5">
              {role.options.map((item) => (
                <button
                  key={optionKey(item)}
                  type="button"
                  onClick={() => setOptionId(optionKey(item))}
                  className={cx(
                    'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition',
                    optionKey(item) === optionKey(option)
                      ? 'border-ink bg-surface-2 font-medium text-ink'
                      : 'border-hairline text-ink-2 hover:border-ink-3',
                  )}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-ink-3">
                    {formatValue(item.current, item.unit)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                Nuevo valor
              </span>
              {delta !== null && delta !== 0 && (
                <span
                  className={cx(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    delta > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700',
                  )}
                >
                  {delta > 0 ? '+' : '−'}
                  {formatValue(Math.abs(delta), option.unit)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-3 line-through">
                {formatValue(current, option.unit)}
              </span>
              <ArrowRight className="size-4 text-ink-3" />
              <span className="text-2xl font-bold" style={{ color: role.color }}>
                {formatValue(value, option.unit)}
              </span>
            </div>
            <input
              type="range"
              min={option.min}
              max={option.max}
              step={option.step}
              value={value ?? option.min}
              onChange={(event) => setValue(Number(event.target.value))}
              className="w-full"
              style={{ accentColor: role.color }}
            />
            <div className="flex justify-between text-[11px] text-ink-3">
              <span>{formatValue(option.min, option.unit)}</span>
              <button
                type="button"
                onClick={() => current !== null && setValue(current)}
                className="inline-flex items-center gap-1 hover:text-ink"
              >
                <RotateCcw className="size-3" />
                Volver al vigente
              </button>
              <span>{formatValue(option.max, option.unit)}</span>
            </div>
          </div>
          <button
            type="button"
            disabled={busy || delta === 0 || value === null}
            onClick={() => void apply()}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50"
            style={{ background: role.color }}
          >
            {busy ? (
              <Loader className="size-4 animate-spin" />
            ) : (
              <CloudUpload className="size-4" />
            )}
            {busy ? 'Subiendo la versión…' : 'Publicar versión en Autodesk'}
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {results.length > 0 && (
            <ul className="flex flex-col gap-2 border-t border-hairline pt-3">
              {results.map((result) => (
                <li key={result.label} className="flex items-start gap-2 text-sm">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{result.label}</span>
                    <span className="block text-xs text-ink-2">
                      {result.changed
                        ? `${result.title ?? 'Cambio detectado'}. Avisos en camino.`
                        : 'Sin diferencia con lo vigente: no hubo avisos.'}
                    </span>
                    {result.changeId && (
                      <Link
                        href={projectPage(projectId, `/cambios/${result.changeId}`) as Route}
                        className="text-xs font-medium text-accent-text"
                      >
                        Ver el cambio
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
