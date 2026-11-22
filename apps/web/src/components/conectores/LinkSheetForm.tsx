'use client';

import { Button, Field, Input } from '@team27/ui';
import { useState } from 'react';

export function LinkSheetForm({
  busy,
  onSubmit,
}: {
  readonly busy: boolean;
  readonly onSubmit: (url: string) => Promise<boolean>;
}) {
  const [url, setUrl] = useState('');

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-dashed border-axis p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!url.trim()) return;
        void onSubmit(url.trim()).then((linked) => {
          if (linked) setUrl('');
        });
      }}
    >
      <Field
        label="Vincular una planilla"
        hint="Pega el link de una planilla de Google Sheets a la que tenga acceso tu cuenta."
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
        <Button type="submit" disabled={busy || !url.trim()}>
          {busy ? 'Vinculando…' : 'Vincular'}
        </Button>
      </div>
    </form>
  );
}
