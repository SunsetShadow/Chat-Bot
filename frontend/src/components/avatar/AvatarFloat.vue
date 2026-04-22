<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
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
const FLOAT_WIDTH = 240;
const FLOAT_HEIGHT = 340;
const SIDE_WIDTH = 280;

const avatarRef = ref<InstanceType<typeof Live2DAvatar>>();
const { avatarAction, isLoading: isStreaming } = useAIChat();
const { layoutMode, setLayout, setVisible } = useAvatarLayout();
const { ttsAudioLevel, ttsStatus } = useVoice();

// 悬浮窗位置（仅 float 模式使用）
const posX = ref(window.innerWidth - FLOAT_WIDTH - 20);
const posY = ref(80);
const isDragging = ref(false);
const isMinimized = ref(false);

// 布局切换图标
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
    float: "侧栏模式",
    side: "全屏模式",
    fullscreen: "悬浮模式",
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
}

// Avatar 尺寸根据布局模式计算
const avatarSize = computed(() => {
  const map: Record<AvatarLayoutMode, { width: number; height: number }> = {
    float: { width: FLOAT_WIDTH, height: FLOAT_HEIGHT - 32 },
    side: { width: SIDE_WIDTH, height: 0 },
    fullscreen: { width: 0, height: 0 },
  };
  return map[layoutMode.value];
});

// 拖拽逻辑（仅 float 模式）
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
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  posX.value = Math.max(
    0,
    Math.min(window.innerWidth - FLOAT_WIDTH, posStartX + dx),
  );
  posY.value = Math.max(
    0,
    Math.min(window.innerHeight - FLOAT_HEIGHT, posStartY + dy),
  );
}

function onDragEnd() {
  isDragging.value = false;
  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup", onDragEnd);
}

// TTS 口型同步音量
const avatarVolume = computed(() => {
  return ttsStatus.value === "speaking" ? ttsAudioLevel.value : 0;
});

// 消费 avatarAction 驱动表情/动作
watch(avatarAction, (action: AvatarActionPayload | null) => {
  if (!action || !avatarRef.value) return;
  if (action.action === "expression" && action.emotion) {
    const index = HARU_EMOTION_MAP[action.emotion];
    if (index !== undefined) {
      avatarRef.value.setExpression(index);
    }
  }
  if (action.action === "motion" && action.group) {
    avatarRef.value.startMotion(action.group, action.index ?? 0);
  }
});

// 流式回复结束后回到 neutral
watch(isStreaming, (streaming) => {
  if (!streaming && avatarRef.value) {
    avatarRef.value.setExpression(HARU_EMOTION_MAP.neutral);
  }
});

function closeAvatar() {
  setVisible(false);
}

onMounted(() => {
  posX.value = Math.min(posX.value, window.innerWidth - FLOAT_WIDTH - 20);
});

onUnmounted(() => {
  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup", onDragEnd);
});
</script>

<template>
  <!-- 最小化状态（仅 float 模式） -->
  <div
    v-if="isMinimized && layoutMode === 'float'"
    class="avatar-mini"
    :style="{ left: posX + 'px', top: posY + 'px' }"
    @click="isMinimized = false"
  >
    <div class="avatar-mini-inner">🎭</div>
  </div>

  <!-- 全屏模式：覆盖聊天区域 -->
  <div v-else-if="layoutMode === 'fullscreen'" class="avatar-fullscreen">
    <div class="fullscreen-header">
      <span class="float-title">Avatar</span>
      <div class="float-actions">
        <button
          class="layout-btn"
          :title="layoutLabel"
          @click.stop="cycleLayout"
        >
          <NIcon :component="layoutIcon" :size="14" />
          <span>{{ layoutLabel }}</span>
        </button>
        <button class="float-btn" title="关闭" @click.stop="closeAvatar">
          <NIcon :component="CloseOutline" :size="14" />
        </button>
      </div>
    </div>
    <div class="fullscreen-body">
      <Live2DAvatar
        ref="avatarRef"
        :model-url="MODEL_URL"
        :width="avatarSize.width"
        :height="avatarSize.height"
        :volume="avatarVolume"
      />
    </div>
  </div>

  <!-- 侧栏模式：固定右侧 -->
  <div v-else-if="layoutMode === 'side'" class="avatar-side">
    <div class="side-header">
      <span class="float-title">Avatar</span>
      <div class="float-actions">
        <button
          class="layout-btn"
          :title="layoutLabel"
          @click.stop="cycleLayout"
        >
          <NIcon :component="layoutIcon" :size="14" />
          <span>{{ layoutLabel }}</span>
        </button>
        <button class="float-btn" title="关闭" @click.stop="closeAvatar">
          <NIcon :component="CloseOutline" :size="14" />
        </button>
      </div>
    </div>
    <div class="side-body">
      <Live2DAvatar
        ref="avatarRef"
        :model-url="MODEL_URL"
        :width="avatarSize.width"
        :height="avatarSize.height"
        :volume="avatarVolume"
      />
    </div>
  </div>

  <!-- 悬浮窗模式（默认） -->
  <div
    v-else
    class="avatar-float"
    :class="{ 'is-dragging': isDragging }"
    :style="{
      left: posX + 'px',
      top: posY + 'px',
      width: FLOAT_WIDTH + 'px',
      height: FLOAT_HEIGHT + 'px',
    }"
  >
    <div class="float-header" @mousedown="onDragStart">
      <span class="float-title">Avatar</span>
      <div class="float-actions">
        <button
          class="layout-btn"
          :title="layoutLabel"
          @click.stop="cycleLayout"
        >
          <NIcon :component="layoutIcon" :size="14" />
          <span>{{ layoutLabel }}</span>
        </button>
        <button
          class="float-btn"
          title="最小化"
          @click.stop="isMinimized = true"
        >
          <NIcon :component="RemoveOutline" :size="14" />
        </button>
        <button class="float-btn" title="关闭" @click.stop="closeAvatar">
          <NIcon :component="CloseOutline" :size="14" />
        </button>
      </div>
    </div>
    <div class="float-body">
      <Live2DAvatar
        ref="avatarRef"
        :model-url="MODEL_URL"
        :width="avatarSize.width"
        :height="avatarSize.height"
        :volume="avatarVolume"
      />
    </div>
  </div>
</template>

<style scoped>
/* --- 悬浮窗模式 --- */
.avatar-float {
  position: fixed;
  z-index: 1000;
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: box-shadow 0.2s;
  user-select: none;
}

.avatar-float.is-dragging {
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
  cursor: grabbing;
}

/* --- 侧栏模式 --- */
.avatar-side {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: SIDE_WIDTH;
  z-index: 1000;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  user-select: none;
}

.side-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 8px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.side-body {
  flex: 1;
  overflow: hidden;
}

/* --- 全屏模式 --- */
.avatar-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  user-select: none;
}

.fullscreen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.fullscreen-body {
  flex: 1;
  overflow: hidden;
}

/* --- 共用组件 --- */
.float-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 8px;
  background: var(--bg-tertiary);
  cursor: grab;
  border-bottom: 1px solid var(--border-color);
}

.float-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.float-actions {
  display: flex;
  gap: 4px;
}

.float-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.float-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.layout-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}

.layout-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.float-body {
  flex: 1;
  overflow: hidden;
}

/* --- 最小化圆圈 --- */
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
