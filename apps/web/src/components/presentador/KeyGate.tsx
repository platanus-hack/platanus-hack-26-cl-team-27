'use client';

import { Button, Field, Input, Notice } from '@team27/ui';
import { useState } from 'react';

export function KeyGate({
  onSubmit,
  message,
  title = 'Sala de Fernanda',
}: {
  readonly onSubmit: (key: string) => void;
  readonly message: string | null;
  readonly title?: string;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-1 text-sm text-ink-2">
        Ingresa la clave del presentador. La pedimos una vez por pestaña.
      </p>
      <form
        className="mt-5 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <Field label="Clave">
          <Input
            type="password"
            value={value}
            autoComplete="off"
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        {message && <Notice tone="error">{message}</Notice>}
        <Button type="submit" disabled={!value.trim()}>
          Entrar
        </Button>
      </form>
    </div>
  );
}
