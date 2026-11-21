import Link from 'next/link';
import type { Route } from 'next';

import { valuePath } from '@/lib/provenance-api';

export function ValueLink({
  subjectId,
  attribute,
  children,
}: {
  readonly subjectId: string;
  readonly attribute: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Link
      href={valuePath(subjectId, attribute) as Route}
      className="font-medium text-accent-text underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  );
}
