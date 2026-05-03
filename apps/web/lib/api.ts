import type { LineageRecord, Workflow } from '@provenance/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Legacy per-op generation type (kept for backwards compat)
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

// Bit 6: lineage records (upstream subgraph snapshots from generation)
export async function fetchLineages(
  projectId: string,
  outputNodeId: string,
): Promise<LineageRecord[]> {
  try {
    const res = await fetch(
      `${API_URL}/projects/${projectId}/lineages/${outputNodeId}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { lineages: LineageRecord[] };
    return data.lineages;
  } catch {
    return [];
  }
}

export async function fetchLineageRecord(
  projectId: string,
  lineageId: string,
): Promise<LineageRecord | null> {
  try {
    const res = await fetch(
      `${API_URL}/projects/${projectId}/lineage-record/${lineageId}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as LineageRecord;
  } catch {
    return null;
  }
}
