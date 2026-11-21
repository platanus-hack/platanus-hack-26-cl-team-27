import type { ReactNode } from 'react';

export default function AsientoLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-plane sm:border-x sm:border-hairline">
      {children}
    </main>
  );
}
