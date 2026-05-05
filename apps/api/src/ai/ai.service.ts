import { Injectable, Logger } from '@nestjs/common';
import type {
  AiGenerationInput,
  AiGenerationOutput,
  AiModelDescriptor,
  Workflow,
  WorkflowNode,
} from '@provenance/shared';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async generate(
    model: AiModelDescriptor,
    input: AiGenerationInput,
    upstreamNodes: WorkflowNode[],
  ): Promise<AiGenerationOutput> {
    this.logger.log(`mock generate: model=${model.provider}/${model.model}`);

    // Simulate latency
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));

    const promptSnippet = input.prompt.slice(0, 80);
    const nodeContext = upstreamNodes
      .map((n) => (n.data as { prompt?: string }).prompt ?? '')
      .filter(Boolean)
      .join(' + ');

    const styleContext = '';

    const parts = [
      `[Mock generation]`,
      nodeContext ? `Prompt: "${nodeContext}"` : `Prompt: "${promptSnippet}"`,
      styleContext ? `Style: ${styleContext}` : null,
      `Model: ${model.provider}/${model.model}`,
      `Generated at ${new Date().toLocaleTimeString()}`,
    ].filter(Boolean);

    return {
      text: parts.join('\n'),
      raw: { mock: true, timestamp: Date.now() },
      usage: { inputTokens: 42, outputTokens: 128 },
      finishReason: 'end_turn',
      resolvedModel: { provider: 'mock', model: 'mock-v1' },
      fallback: {
        requested: model,
        reason: 'No API key configured — using mock generation',
      },
    };
  }
}
