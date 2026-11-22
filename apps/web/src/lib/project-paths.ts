export const projectApi = (projectId: string, path: string): string =>
  `/api/projects/${encodeURIComponent(projectId)}${path}`;

export const projectPage = (projectId: string, path = ''): string =>
  `/proyectos/${encodeURIComponent(projectId)}${path}`;
