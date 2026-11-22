import type { ReactNode } from 'react';

export default function SiteTemplate({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <div className="animate-rise">{children}</div>;
}
