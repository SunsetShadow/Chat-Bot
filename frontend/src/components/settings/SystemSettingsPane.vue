<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getSettings, updateSetting } from "@/api/chat";
import DirectoryBrowser from "./DirectoryBrowser.vue";
import {
  ShieldCheckmarkOutline,
  AddOutline,
  TrashOutline,
  FolderOpenOutline,
  SaveOutline,
} from "@vicons/ionicons5";

const sandboxDirs = ref<string[]>([""]);
const loading = ref(false);
const saving = ref(false);
const showBrowser = ref(false);
const browseTargetIndex = ref(0);
const saved = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    const settings = await getSettings();
    const sandboxSetting = settings.find(
      (s) => s.key === "sandbox_allowed_dirs",
    );
    if (sandboxSetting?.value) {
      sandboxDirs.value = sandboxSetting.value.split(",").filter(Boolean);
      if (sandboxDirs.value.length === 0) sandboxDirs.value = [""];
    }
  } catch {
    // 使用默认值
  } finally {
    loading.value = false;
  }
});

function addPath() {
  sandboxDirs.value.push("");
}

function removePath(index: number) {
  if (sandboxDirs.value.length <= 1) return;
  sandboxDirs.value.splice(index, 1);
}

function openBrowser(index: number) {
  browseTargetIndex.value = index;
  showBrowser.value = true;
}

function handleSelect(path: string) {
  sandboxDirs.value[browseTargetIndex.value] = path;
}

async function save() {
  saving.value = true;
  saved.value = false;
  try {
    const value = sandboxDirs.value.map((d) => d.trim()).filter(Boolean).join(",");
    await updateSetting("sandbox_allowed_dirs", value);
    saved.value = true;
    setTimeout(() => (saved.value = false), 2000);
  } catch (error) {
    console.error("保存设置失败:", error);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="system-settings-pane">
    <!-- 沙箱路径配置 -->
    <div class="section-header">
      <div class="section-title">
        <div class="section-icon-wrap">
          <NIcon :component="ShieldCheckmarkOutline" :size="18" />
        </div>
        <div>
          <span class="title-mono">SANDBOX</span>
          <h3>路径沙箱</h3>
        </div>
      </div>
    </div>

    <p class="section-desc">
      限制工具可访问的目录范围。Agent 的文件读写、命令执行等操作仅允许在以下目录中进行。
    </p>

    <NSpin :show="loading">
      <div class="path-list">
        <div
          v-for="(dir, index) in sandboxDirs"
          :key="index"
          class="path-row"
        >
          <NInput
            v-model:value="sandboxDirs[index]"
            placeholder="输入目录路径，如 /app/data"
            class="path-input"
          />
          <button class="row-action-btn browse" title="浏览" @click="openBrowser(index)">
            <NIcon :component="FolderOpenOutline" :size="16" />
          </button>
          <button
            class="row-action-btn delete"
            title="删除"
            :disabled="sandboxDirs.length <= 1"
            @click="removePath(index)"
          >
            <NIcon :component="TrashOutline" :size="16" />
          </button>
        </div>
      </div>
    </NSpin>

    <div class="action-bar">
      <button class="btn-secondary btn-sm" @click="addPath">
        <NIcon :component="AddOutline" :size="14" />
        <span>添加路径</span>
      </button>
      <div class="save-area">
        <span v-if="saved" class="save-hint">已保存</span>
        <button class="btn-primary btn-sm" :disabled="saving" @click="save">
          <NIcon :component="SaveOutline" :size="14" />
          <span>{{ saving ? "保存中..." : "保存设置" }}</span>
        </button>
      </div>
    </div>

    <!-- 目录浏览器 -->
    <DirectoryBrowser
      :show="showBrowser"
      :initial-path="sandboxDirs[browseTargetIndex] || undefined"
      @update:show="showBrowser = $event"
      @select="handleSelect"
    />
  </div>
</template>

<style scoped>
.system-settings-pane {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: -8px 0 0;
}

.path-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.path-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.path-input {
  flex: 1;
}

.row-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.row-action-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.row-action-btn.delete:hover {
  border-color: var(--neon-pink);
  color: var(--neon-pink);
}

.row-action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.save-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.save-hint {
  font-size: 12px;
  color: var(--neon-green);
  font-family: var(--font-mono);
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-secondary:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 7px 14px;
  font-size: 12px;
}
</style>
