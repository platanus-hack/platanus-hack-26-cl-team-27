'use client';

import { Button, Card, Field, Input, Notice } from '@team27/ui';
import { useState } from 'react';

export function KeyGate({
  onSubmit,
  message,
}: {
  readonly onSubmit: (key: string) => void;
  readonly message: string | null;
}) {
  const [value, setValue] = useState('');
  return (
    <Card
      title="Clave del presentador"
      description="La pedimos una vez por pestaña."
    >
      <form
        className="flex max-w-sm flex-col gap-3"
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
    </Card>
  );
}
