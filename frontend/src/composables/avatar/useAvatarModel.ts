import { ref, type ComponentPublicInstance } from "vue";
import type { AvatarModelConfig } from "@/types/avatar";

export function useAvatarModel(config: AvatarModelConfig) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avatarRef = ref<any>(null);

  const paramValues = ref<Record<string, number>>({});

  function setAvatarRef(el: ComponentPublicInstance | null | Element) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    avatarRef.value = el && "$el" in el ? el : null;
  }

  function getCoreModel() {
    // Live2DAvatar exposes coreModel via defineExpose
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return avatarRef.value?.coreModel;
  }

  function getInternalModel() {
    return avatarRef.value?.model;
  }

  function setParam(
    paramKey: keyof AvatarModelConfig["params"],
    value: number,
  ): void {
    const paramId = config.params[paramKey];
    if (!paramId) return;
    try {
      getCoreModel()?.setParameterValueById(paramId, value);
      paramValues.value[paramId] = value;
    } catch {
      // coreModel may be unavailable during model transitions
    }
  }

  function getParam(paramKey: keyof AvatarModelConfig["params"]): number {
    const paramId = config.params[paramKey];
    if (!paramId) return 0;
    try {
      return getCoreModel()?.getParameterValueById(paramId) ?? 0;
    } catch {
      return paramValues.value[paramId] ?? 0;
    }
  }

  function setExpression(emotion: string): void {
    const idx = config.expressions[emotion as keyof typeof config.expressions];
    if (idx === undefined) return;
    try {
      getInternalModel()?.expression(idx);
    } catch {
      // expression index may be out of range
    }
  }

  function setExpressionIndex(index: number): void {
    try {
      getInternalModel()?.expression(index);
    } catch {
      // ignore
    }
  }

  function playMotion(group: string, index?: number): void {
    try {
      getInternalModel()?.motion(group, index ?? 0);
    } catch {
      // motion group/index may not exist
    }
  }

  function playRandomIdleMotion(): void {
    const { idle } = config.motions;
    const indices =
      idle.availableIndices ?? Array.from({ length: idle.count }, (_, i) => i);
    const idx = indices[Math.floor(Math.random() * indices.length)];
    playMotion("Idle", idx);
  }

  return {
    avatarRef,
    setAvatarRef,
    config,
    setParam,
    getParam,
    setExpression,
    setExpressionIndex,
    playMotion,
    playRandomIdleMotion,
  };
}
