import type { ReactNode } from 'react';

export default function SalaLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <main className="min-h-dvh w-full">{children}</main>;
}
