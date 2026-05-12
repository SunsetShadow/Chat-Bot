import { encodingForModel } from 'js-tiktoken';

// 常见模型的 context window 大小
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'qwen-max': 32000,
  'qwen-plus': 131072,
  'qwen-turbo': 131072,
  'deepseek-chat': 65536,
  'deepseek-reasoner': 65536,
};

const DEFAULT_CONTEXT_WINDOW = 128000;

export interface TokenBudget {
  contextWindow: number;
  systemTokens: number;
  historyTokens: number;
  outputTokens: number;
}

export class TokenBudgetManager {
  private encoder: ReturnType<typeof encodingForModel> | null = null;

  private getEncoder(): ReturnType<typeof encodingForModel> | null {
    if (!this.encoder) {
      try {
        this.encoder = encodingForModel('gpt-4o');
      } catch {
        return null;
      }
    }
    return this.encoder;
  }

  countTokens(text: string): number {
    if (!text) return 0;
    const encoder = this.getEncoder();
    if (encoder) {
      return encoder.encode(text).length;
    }
    return Math.ceil(text.length / 3);
  }

  getContextWindow(modelName: string): number {
    if (MODEL_CONTEXT_WINDOWS[modelName]) {
      return MODEL_CONTEXT_WINDOWS[modelName];
    }
    for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
      if (modelName.startsWith(key)) return value;
    }
    return DEFAULT_CONTEXT_WINDOW;
  }

  allocate(modelName: string, systemPrompt: string): TokenBudget {
    const contextWindow = this.getContextWindow(modelName);
    const systemTokens = this.countTokens(systemPrompt);
    const historyTokens = Math.floor(contextWindow * 0.5);
    const outputTokens = Math.floor(contextWindow * 0.2);

    return { contextWindow, systemTokens, historyTokens, outputTokens };
  }

  slidingWindow(
    messages: { role: string; content: string }[],
    budget: number,
  ): { role: string; content: string }[] {
    let totalTokens = 0;
    const kept: { role: string; content: string }[] = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = this.countTokens(messages[i].content);
      if (totalTokens + msgTokens > budget) break;
      totalTokens += msgTokens;
      kept.unshift(messages[i]);
    }

    return kept;
  }
}
