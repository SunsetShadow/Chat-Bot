<script setup lang="ts">
import { ref, watch } from "vue";
import { browseDirectory } from "@/api/chat";
import {
  FolderOpenOutline,
  ArrowBackOutline,
  CheckmarkOutline,
  CloseOutline,
} from "@vicons/ionicons5";

const props = defineProps<{
  show: boolean;
  initialPath?: string;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "select", path: string): void;
}>();

const currentPath = ref(props.initialPath || "/");
const directories = ref<string[]>([]);
const parentPath = ref<string | null>(null);
const loading = ref(false);

async function loadDir(dirPath?: string) {
  loading.value = true;
  try {
    const result = await browseDirectory(dirPath || currentPath.value);
    currentPath.value = result.currentPath;
    directories.value = result.directories;
    parentPath.value = result.parentPath;
  } catch {
    directories.value = [];
    parentPath.value = null;
  } finally {
    loading.value = false;
  }
}

function goUp() {
  if (parentPath.value) {
    loadDir(parentPath.value);
  }
}

function enterDir(dir: string) {
  loadDir(`${currentPath.value}/${dir}`);
}

function select() {
  emit("select", currentPath.value);
  emit("update:show", false);
}

function close() {
  emit("update:show", false);
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      loadDir(props.initialPath || undefined);
    }
  },
);
</script>

<template>
  <NDrawer
    :show="show"
    :width="360"
    placement="right"
    @update:show="emit('update:show', $event)"
  >
    <NDrawerContent title="浏览目录" :native-scrollbar="false">
      <div class="directory-browser">
        <!-- 当前路径 -->
        <div class="current-path">
          <code>{{ currentPath }}</code>
        </div>

        <!-- 导航栏 -->
        <div class="nav-bar">
          <button
            class="nav-btn"
            :disabled="!parentPath"
            @click="goUp"
          >
            <NIcon :component="ArrowBackOutline" :size="16" />
            <span>上级目录</span>
          </button>
          <button class="nav-btn primary" @click="select">
            <NIcon :component="CheckmarkOutline" :size="16" />
            <span>选择此目录</span>
          </button>
        </div>

        <!-- 目录列表 -->
        <NSpin :show="loading">
          <div class="dir-list">
            <div
              v-for="dir in directories"
              :key="dir"
              class="dir-item"
              @click="enterDir(dir)"
            >
              <NIcon :component="FolderOpenOutline" :size="20" />
              <span class="dir-name">{{ dir }}</span>
            </div>
            <div v-if="!loading && directories.length === 0" class="empty">
              此目录下没有子目录
            </div>
          </div>
        </NSpin>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.directory-browser {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.current-path {
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
}

.nav-bar {
  display: flex;
  gap: 8px;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nav-btn:not(:disabled):hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.nav-btn.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
  margin-left: auto;
}

.nav-btn.primary:hover {
  opacity: 0.9;
}

.dir-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 400px;
  overflow-y: auto;
}

.dir-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.dir-item:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.dir-name {
  font-size: 14px;
}

.empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
