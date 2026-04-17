import { Injectable } from '@nestjs/common';

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  available: boolean;
}

const AVAILABLE_MODELS: ModelInfo[] = [
  { id: 'qwen3.6-plus', name: 'Qwen3.6 Plus', provider: 'qwen', available: true },
  { id: 'qwen3.5-plus', name: 'Qwen3.5 Plus', provider: 'qwen', available: true },
  { id: 'qwen3.5-flash', name: 'Qwen3.5 Flash', provider: 'qwen', available: true },
  { id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'moonshot', available: false },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'deepseek', available: false },
  { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'deepseek', available: false },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', available: false },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'anthropic', available: false },
];

@Injectable()
export class ModelService {
  findAll(): ModelInfo[] {
    return AVAILABLE_MODELS;
  }
}
