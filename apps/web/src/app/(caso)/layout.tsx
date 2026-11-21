import type { ReactNode } from 'react';

export default function CasoLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <main className="min-h-dvh w-full bg-plane">{children}</main>;
}
