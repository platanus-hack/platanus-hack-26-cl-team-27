'use client';

import { createContext, type ReactNode, use } from 'react';

const ProjectContext = createContext<string | null>(null);

export function ProjectProvider({
  projectId,
  children,
}: {
  readonly projectId: string;
  readonly children: ReactNode;
}) {
  return <ProjectContext value={projectId}>{children}</ProjectContext>;
}

export const useProjectId = (): string => {
  const projectId = use(ProjectContext);
  if (projectId === null) throw new Error('useProjectId sin ProjectProvider');
  return projectId;
};
