<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import Live2DAvatar from "./Live2DAvatar.vue";
import { useAIChat } from "@/composables/useAIChat";
import { useAvatarLayout } from "@/composables/useAvatarLayout";
import { useVoice } from "@/composables/useVoice";
import { HARU_EMOTION_MAP } from "@/config/emotion-map";
import type { AvatarActionPayload, AvatarLayoutMode } from "@/types/avatar";
import { NIcon } from "naive-ui";
import {
  CloseOutline,
  RemoveOutline,
  ContractOutline,
  ExpandOutline,
  TabletLandscapeOutline,
} from "@vicons/ionicons5";

const MODEL_URL = "/live2d/haru_greeter_t03.model3.json";
const FLOAT_SIZE = 280;

const avatarRef = ref<InstanceType<typeof Live2DAvatar>>();
const bodyRef = ref<HTMLElement>();
const { avatarAction, isLoading: isStreaming } = useAIChat();
const { layoutMode, setLayout, setVisible } = useAvatarLayout();
const { ttsAudioLevel, ttsStatus } = useVoice();

// 悬浮窗位置（仅 float 模式）
const posX = ref(window.innerWidth - FLOAT_SIZE - 20);
const posY = ref(80);
const isDragging = ref(false);
const isMinimized = ref(false);

// 动态画布尺寸（side/fullscreen 用 ResizeObserver）
const canvasW = ref(FLOAT_SIZE);
const canvasH = ref(FLOAT_SIZE - 36);

// 布局切换
const layoutIcon = computed(() => {
  const map: Record<AvatarLayoutMode, typeof TabletLandscapeOutline> = {
    float: TabletLandscapeOutline,
    side: ExpandOutline,
    fullscreen: ContractOutline,
  };
  return map[layoutMode.value];
});

const layoutLabel = computed(() => {
  const map: Record<AvatarLayoutMode, string> = {
    float: "侧栏",
    side: "全屏",
    fullscreen: "悬浮",
  };
  return map[layoutMode.value];
});

function cycleLayout() {
  const next: AvatarLayoutMode =
    layoutMode.value === "float"
      ? "side"
      : layoutMode.value === "side"
        ? "fullscreen"
        : "float";
  setLayout(next);
  isMinimized.value = false;
}

// 布局变化时重新测量容器并更新画布尺寸
watch(layoutMode, async () => {
  // 重置旧 observer
  if (resizeObserver) resizeObserver.disconnect();

  if (layoutMode.value === "float") {
    canvasW.value = FLOAT_SIZE;
    canvasH.value = FLOAT_SIZE - 36;
    return;
  }
  await nextTick();
  measureBody();
  // attach observer 到新 body
  if (bodyRef.value && resizeObserver) {
    resizeObserver.observe(bodyRef.value);
  }
});

let resizeObserver: ResizeObserver | null = null;

function measureBody() {
  if (!bodyRef.value) return;
  const rect = bodyRef.value.getBoundingClientRect();
  canvasW.value = Math.floor(rect.width);
  canvasH.value = Math.floor(rect.height);
}

function setupResizeObserver() {
  if (resizeObserver) resizeObserver.disconnect();
  resizeObserver = new ResizeObserver(() => {
    if (layoutMode.value !== "float") measureBody();
  });
}

// 拖拽（仅 float）
let dragStartX = 0;
let dragStartY = 0;
let posStartX = 0;
let posStartY = 0;

function onDragStart(e: MouseEvent) {
  if (layoutMode.value !== "float") return;
  isDragging.value = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  posStartX = posX.value;
  posStartY = posY.value;
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragEnd);
}

function onDragMove(e: MouseEvent) {
  if (!isDragging.value) return;
  posX.value = Math.max(
    0,
    Math.min(
      window.innerWidth - FLOAT_SIZE,
      posStartX + e.clientX - dragStartX,
    ),
  );
  posY.value = Math.max(
    0,
    Math.min(
      window.innerHeight - FLOAT_SIZE,
      posStartY + e.clientY - dragStartY,
    ),
  );
}

function onDragEnd() {
  isDragging.value = false;
  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup", onDragEnd);
}

// TTS 口型同步
const avatarVolume = computed(() =>
  ttsStatus.value === "speaking" ? ttsAudioLevel.value : 0,
);

// 驱动表情/动作
watch(avatarAction, (action: AvatarActionPayload | null) => {
  if (!action || !avatarRef.value) return;
  if (action.action === "expression" && action.emotion) {
    const idx = HARU_EMOTION_MAP[action.emotion];
    if (idx !== undefined) avatarRef.value.setExpression(idx);
  }
  if (action.action === "motion" && action.group) {
    avatarRef.value.startMotion(action.group, action.index ?? 0);
  }
});

// 流式结束后回到 neutral
watch(isStreaming, (s) => {
  if (!s && avatarRef.value) {
    avatarRef.value.setExpression(HARU_EMOTION_MAP.neutral);
  }
});

function closeAvatar() {
  setVisible(false);
}

onMounted(() => {
  posX.value = Math.min(posX.value, window.innerWidth - FLOAT_SIZE - 20);
  setupResizeObserver();
  // 延迟一帧等 DOM 渲染后 attach observer
  nextTick(() => {
    if (bodyRef.value && resizeObserver) {
      resizeObserver.observe(bodyRef.value);
    }
  });
});

onUnmounted(() => {
  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup", onDragEnd);
  resizeObserver?.disconnect();
});
</script>

<template>
  <!-- 最小化圆圈 -->
  <div
    v-if="isMinimized && layoutMode === 'float'"
    class="avatar-mini"
    :style="{ left: posX + 'px', top: posY + 'px' }"
    @click="isMinimized = false"
  >
    <div class="avatar-mini-inner">🎭</div>
  </div>

  <!-- 全屏模式：Avatar 占上半屏 -->
  <div v-else-if="layoutMode === 'fullscreen'" class="avatar-fullscreen">
    <div class="fs-header">
      <span class="header-title">Avatar</span>
      <div class="header-actions">
        <button class="layout-btn" @click.stop="cycleLayout">
          <NIcon :component="layoutIcon" :size="14" />
          <span>{{ layoutLabel }}</span>
        </button>
        <button class="icon-btn" title="关闭" @click.stop="closeAvatar">
          <NIcon :component="CloseOutline" :size="16" />
        </button>
      </div>
    </div>
    <div ref="bodyRef" class="fs-body">
      <Live2DAvatar
        ref="avatarRef"
        :model-url="MODEL_URL"
        :width="canvasW"
        :height="canvasH"
        :volume="avatarVolume"
      />
    </div>
  </div>

  <!-- 侧栏模式：左侧，宽屏 -->
  <div v-else-if="layoutMode === 'side'" class="avatar-side">
    <div class="side-header">
      <span class="header-title">Avatar</span>
      <div class="header-actions">
        <button class="layout-btn" @click.stop="cycleLayout">
          <NIcon :component="layoutIcon" :size="14" />
          <span>{{ layoutLabel }}</span>
        </button>
        <button class="icon-btn" title="关闭" @click.stop="closeAvatar">
          <NIcon :component="CloseOutline" :size="16" />
        </button>
      </div>
    </div>
    <div ref="bodyRef" class="side-body">
      <Live2DAvatar
        ref="avatarRef"
        :model-url="MODEL_URL"
        :width="canvasW"
        :height="canvasH"
        :volume="avatarVolume"
      />
    </div>
  </div>

  <!-- 悬浮窗模式（默认） -->
  <div
    v-else
    class="avatar-float"
    :class="{ dragging: isDragging }"
    :style="{
      left: posX + 'px',
      top: posY + 'px',
      width: FLOAT_SIZE + 'px',
      height: FLOAT_SIZE + 'px',
    }"
  >
    <div class="float-header" @mousedown="onDragStart">
      <span class="header-title">Avatar</span>
      <div class="header-actions">
        <button class="layout-btn" @click.stop="cycleLayout">
          <NIcon :component="layoutIcon" :size="14" />
          <span>{{ layoutLabel }}</span>
        </button>
        <button
          class="icon-btn"
          title="最小化"
          @click.stop="isMinimized = true"
        >
          <NIcon :component="RemoveOutline" :size="14" />
        </button>
        <button class="icon-btn" title="关闭" @click.stop="closeAvatar">
          <NIcon :component="CloseOutline" :size="14" />
        </button>
      </div>
    </div>
    <div class="float-body">
      <Live2DAvatar
        ref="avatarRef"
        :model-url="MODEL_URL"
        :width="canvasW"
        :height="canvasH"
        :volume="avatarVolume"
      />
    </div>
  </div>
</template>

<style scoped>
/* ===== 悬浮窗 ===== */
.avatar-float {
  position: fixed;
  z-index: 1000;
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  user-select: none;
  transition: box-shadow 0.2s;
}

.avatar-float.dragging {
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
}

.float-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 10px;
  background: var(--bg-tertiary);
  cursor: grab;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.float-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== 侧栏模式：左侧，占屏幕 40% ===== */
.avatar-side {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 40vw;
  min-width: 320px;
  max-width: 600px;
  z-index: 1000;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  user-select: none;
}

.side-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.side-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== 全屏模式：Avatar 占上半屏 ===== */
.avatar-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  user-select: none;
}

.fs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.fs-body {
  height: 50vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border-color);
}

/* ===== 共用 ===== */
.header-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.layout-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
  white-space: nowrap;
}

.layout-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* ===== 最小化圆圈 ===== */
.avatar-mini {
  position: fixed;
  z-index: 1000;
  cursor: pointer;
}

.avatar-mini-inner {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: all 0.2s;
}

.avatar-mini-inner:hover {
  transform: scale(1.1);
  border-color: var(--color-primary);
}
</style>
