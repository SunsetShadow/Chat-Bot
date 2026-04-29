import type { AvatarModelConfig } from "@/types/avatar";
import { haruConfig } from "./haru";

const modelRegistry: Map<string, AvatarModelConfig> = new Map();

function registerModel(config: AvatarModelConfig): void {
  modelRegistry.set(config.id, config);
}

export function getModelConfig(id: string): AvatarModelConfig | undefined {
  return modelRegistry.get(id);
}

export function getAllModelIds(): string[] {
  return Array.from(modelRegistry.keys());
}

registerModel(haruConfig);
