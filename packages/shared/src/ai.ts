export type AiProviderId = 'anthropic' | 'gemini' | 'mock';

export interface AiModelDescriptor {
  provider: AiProviderId;
  model: string;
}

export interface AiGenerationInput {
  prompt: string;
  system?: string;
  params?: Record<string, unknown>;
}

export interface AiGenerationOutput {
  text: string;
  raw: unknown;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  finishReason?: string;
  resolvedModel: AiModelDescriptor;
  fallback?: {
    requested: AiModelDescriptor;
    reason: string;
  };
}

export const DEFAULT_MODEL: AiModelDescriptor = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
};
