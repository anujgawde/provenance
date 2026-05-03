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
