'use client';

import { RouteError } from '@/components/common/RouteError';

export default function Error({
  error,
  retry,
}: {
  readonly error: unknown;
  readonly retry: () => void;
}) {
  return <RouteError error={error} retry={retry} />;
}
