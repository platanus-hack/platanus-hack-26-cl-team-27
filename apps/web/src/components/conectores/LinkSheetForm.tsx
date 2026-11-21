'use client';

import { Button, Field, Input, Select } from '@team27/ui';
import { useState } from 'react';

import type { LinkableDocument } from '@/lib/integrations-api';

export function LinkSheetForm({
  documents,
  busy,
  onSubmit,
}: {
  readonly documents: readonly LinkableDocument[];
  readonly busy: boolean;
  readonly onSubmit: (input: { documentId: string; url: string }) => void;
}) {
  const [documentId, setDocumentId] = useState(documents[0]?.id ?? '');
  const [url, setUrl] = useState('');
  const selected = documents.some((document) => document.id === documentId)
    ? documentId
    : (documents[0]?.id ?? '');

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-dashed border-axis p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (selected && url.trim()) {
          onSubmit({ documentId: selected, url: url.trim() });
        }
      }}
    >
      <p className="text-sm font-medium text-ink">Vincular una planilla</p>
      <Field label="Documento de la obra">
        <Select
          value={selected}
          onChange={(event) => setDocumentId(event.target.value)}
        >
          {documents.map((document) => (
            <option key={document.id} value={document.id}>
              {document.name} · {document.spaceName}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Link de la planilla"
        hint="La primera hoja necesita una fila con «Código», «Precio unitario» y «Unidad»."
      >
        <Input
          type="url"
          inputMode="url"
          placeholder="https://docs.google.com/spreadsheets/d/…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </Field>
      <div>
        <Button type="submit" disabled={busy || !selected || !url.trim()}>
          {busy ? 'Leyendo la planilla…' : 'Vincular y leer'}
        </Button>
      </div>
    </form>
  );
}
