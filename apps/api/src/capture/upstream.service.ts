import { Injectable } from '@nestjs/common';
import type { Workflow, WorkflowNode } from '@provenance/shared';

@Injectable()
export class UpstreamService {
  immediateParents(workflow: Workflow, nodeId: string): string[] {
    return workflow.edges.filter((e) => e.target === nodeId).map((e) => e.source);
  }

  ancestorIds(workflow: Workflow, nodeId: string): string[] {
    const visited = new Set<string>();
    const queue: string[] = [nodeId];
    while (queue.length) {
      const current = queue.shift()!;
      for (const parent of this.immediateParents(workflow, current)) {
        if (visited.has(parent)) continue;
        visited.add(parent);
        queue.push(parent);
      }
    }
    return Array.from(visited);
  }

  upstreamSubgraph(workflow: Workflow, nodeId: string): Workflow {
    const ancestors = new Set(this.ancestorIds(workflow, nodeId));
    ancestors.add(nodeId);
    const nodes: WorkflowNode[] = workflow.nodes.filter((n) => ancestors.has(n.id));
    const edges = workflow.edges.filter(
      (e) => ancestors.has(e.source) && ancestors.has(e.target),
    );
    return { nodes, edges };
  }
}
