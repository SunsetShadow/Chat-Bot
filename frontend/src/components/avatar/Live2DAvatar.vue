<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef } from "vue";
import { Application, Ticker } from "pixi.js";

const props = withDefaults(
  defineProps<{
    modelUrl: string;
    width?: number;
    height?: number;
    volume?: number;
  }>(),
  { width: 400, height: 600, volume: 0 },
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

watch(
  () => props.volume,
  (v) => {
    try {
      coreModel.value?.setParameterValueById("ParamMouthOpenY", v);
    } catch {
      // coreModel may be unavailable during model transitions
    }
  },
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fitModel(m: any) {
  const scale = Math.min(props.width / m.width, props.height / m.height);
  m.scale.set(scale);
  m.x = (props.width - m.width * scale) / 2;
  m.y = (props.height - m.height * scale) / 2;
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

defineExpose({ setExpression, startMotion, tap });
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
  border-radius: 12px;
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
