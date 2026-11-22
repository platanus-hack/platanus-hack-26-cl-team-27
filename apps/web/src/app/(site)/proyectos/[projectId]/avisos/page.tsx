import type { Metadata } from 'next';

import { SessionGate } from '@/components/cuenta/SessionGate';
import { NoticeHistory } from '@/components/modelo/NoticeHistory';
import { projectPage } from '@/lib/project-paths';

export const metadata: Metadata = { title: 'Avisos' };

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <SessionGate title="Avisos" returnTo={projectPage(projectId, '/avisos')}>
      {() => <NoticeHistory projectId={projectId} />}
    </SessionGate>
  );
}
