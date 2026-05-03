import type { Workflow } from '@provenance/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Generation {
  id: string;
  createdAt: number;
  text: string;
  parentIds: string[];
}

export async function fetchLineage(projectId: string, nodeId: string): Promise<Generation[]> {
  try {
    const res = await fetch(`${API_URL}/projects/${projectId}/lineage/${nodeId}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { generations: Generation[] };
    return data.generations;
  } catch {
    return [];
  }
}

export async function fetchLineageSnapshot(
  projectId: string,
  entryId: string,
): Promise<Workflow | null> {
  try {
    const res = await fetch(
      `${API_URL}/projects/${projectId}/lineage-entry/${entryId}/snapshot`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { workflow: Workflow };
    return data.workflow;
  } catch {
    return null;
  }
}
