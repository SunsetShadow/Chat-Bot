<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef } from "vue";
import { Application, Ticker } from "pixi.js";

const props = withDefaults(
  defineProps<{
    modelUrl: string;
    width?: number;
    height?: number;
  }>(),
  { width: 400, height: 600 },
);

const emit = defineEmits<{
  loaded: [];
  error: [msg: string];
  click: [];
}>();

const canvasRef = ref<HTMLCanvasElement>();
const app = shallowRef<Application>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pixi-live2d-display has no type definitions
const model = shallowRef<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const coreModel = shallowRef<any>();
const loading = ref(true);
const errorMsg = ref("");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Live2DModelCtor: any = null;

onMounted(async () => {
  if (!canvasRef.value) return;
  try {
    if (!Live2DModelCtor) {
      const mod = await import("pixi-live2d-display/dist/cubism4");
      Live2DModelCtor = mod.Live2DModel;
      Live2DModelCtor.registerTicker(Ticker);
    }

    const pixiApp = new Application({
      view: canvasRef.value,
      width: props.width,
      height: props.height,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    app.value = pixiApp;

    const m = await Live2DModelCtor.from(props.modelUrl, {
      autoInteract: true,
    });
    model.value = m;
    coreModel.value = m.internalModel?.coreModel;

    fitModel(m);

    m.interactive = true;
    m.on("hit", () => {
      emit("click");
    });

    pixiApp.stage.addChild(m);
    // 等一帧确保 PixiJS 渲染后再居中
    requestAnimationFrame(() => fitModel(m));
    loading.value = false;
    emit("loaded");
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
    loading.value = false;
    emit("error", errorMsg.value);
    console.error("[Live2DAvatar] load error:", e);
  }
});

onUnmounted(() => {
  model.value?.destroy();
  app.value?.destroy(true);
});

// 响应容器尺寸变化，重设画布并居中模型
watch([() => props.width, () => props.height], ([w, h]) => {
  if (!app.value || !model.value || w <= 0 || h <= 0) return;
  app.value.renderer.resize(w, h);
  fitModel(model.value);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fitModel(m: any) {
  if (!m || !m.parent) return;
  // pixi-live2d-display 模型内部 origin 不在左上角，用 getBounds 获取真实视觉边界
  m.scale.set(1);
  m.position.set(0, 0);
  m.updateTransform();
  const bounds = m.getBounds();
  if (bounds.width <= 0 || bounds.height <= 0) return;

  const scale = Math.min(props.width / bounds.width, props.height / bounds.height);
  m.scale.set(scale);
  m.x = (props.width - bounds.width * scale) / 2 - bounds.x * scale;
  m.y = (props.height - bounds.height * scale) / 2 - bounds.y * scale;
  m.updateTransform();
}

function setExpression(index: number) {
  try {
    model.value?.expression(index);
  } catch {
    // expression index may be out of range for the model
  }
}

function startMotion(group: string, index: number) {
  try {
    model.value?.motion(group, index);
  } catch {
    // motion group/index may not exist for the model
  }
}

function tap() {
  try {
    model.value?.tap(props.width / 2, props.height / 2);
  } catch {
    // ignore tap errors
  }
}

function setParam(paramId: string, value: number): void {
  try {
    coreModel.value?.setParameterValueById(paramId, value);
  } catch {
    // coreModel may be unavailable during model transitions
  }
}

defineExpose({
  setExpression,
  startMotion,
  tap,
  setParam,
  get model() { return model.value; },
  get coreModel() { return coreModel.value; },
});
</script>

<template>
  <div
    class="live2d-avatar"
    :style="{ width: width + 'px', height: height + 'px' }"
  >
    <canvas ref="canvasRef" />
    <div v-if="loading" class="loading-overlay">
      <NSpin size="small" />
      <span class="loading-text">加载模型中...</span>
    </div>
    <div v-if="errorMsg" class="error-overlay">
      <NText type="error" :depth="2" style="font-size: 12px">
        {{ errorMsg }}
      </NText>
    </div>
  </div>
</template>

<style scoped>
.live2d-avatar {
  position: relative;
  overflow: hidden;
}

.live2d-avatar canvas {
  display: block;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.loading-overlay {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  border-radius: 12px;
}

.loading-text {
  font-size: 12px;
  color: #ccc;
}
</style>
