export interface LLMResponse {
  content: string;
  finish_reason: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamChunk {
  content: string;
  finish_reason: string | null;
}

export abstract class BaseLLMProvider {
  abstract chat(messages: any[], systemPrompt?: string): Promise<LLMResponse>;
  abstract chatStream(messages: any[], systemPrompt?: string): AsyncGenerator<StreamChunk>;
}
