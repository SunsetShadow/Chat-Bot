<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { getSkills, refreshSkills, deleteSkill, getSettings, updateSetting } from "@/api/chat";
import {
  getPendingApprovals,
  approveSkill,
  rejectSkill,
} from "@/api/skill-approval";
import type { SkillInfo, SkillApproval } from "@/types";
import DirectoryBrowser from "@/components/settings/DirectoryBrowser.vue";
import {
  NIcon,
  NSpin,
  NInput,
  useMessage,
  useDialog,
} from "naive-ui";
import {
  ChevronBackOutline,
  ExtensionPuzzleOutline,
  RefreshOutline,
  TrashOutline,
  FolderOpenOutline,
  AddOutline,
  SaveOutline,
  SearchOutline,
  InformationCircleOutline,
  SettingsOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
  TimeOutline,
} from "@vicons/ionicons5";

defineProps<{ embedded?: boolean }>();

const router = useRouter();
const message = useMessage();
const dialog = useDialog();

const skills = ref<SkillInfo[]>([]);
const loading = ref(false);
const searchQuery = ref("");
const showSettings = ref(false);

// Skills 目录配置
const skillsDirs = ref<string[]>([""]);
const showBrowser = ref(false);
const browseIndex = ref(0);
const saving = ref(false);
const saved = ref(false);

const activeTab = ref<"skills" | "approvals">("skills");
const approvals = ref<SkillApproval[]>([]);
const loadingApprovals = ref(false);

onMounted(async () => {
  await Promise.all([loadSkills(), loadSettings()]);
});

async function loadSkills() {
  loading.value = true;
  try {
    skills.value = await getSkills();
  } catch {
    skills.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadSettings() {
  try {
    const settings = await getSettings();
    const s = settings.find((s) => s.key === "skills_dirs");
    if (s?.value) {
      skillsDirs.value = s.value.split(",").filter(Boolean);
      if (skillsDirs.value.length === 0) skillsDirs.value = [""];
    }
  } catch {
    // default
  }
}

async function handleRefresh() {
  loading.value = true;
  try {
    await refreshSkills();
    await loadSkills();
    message.success("已刷新");
  } catch {
    message.error("刷新失败");
  } finally {
    loading.value = false;
  }
}

function handleDelete(skill: SkillInfo) {
  dialog.warning({
    title: "删除技能",
    content: `确定要删除 "${skill.name}" 吗？将移除对应的文件目录。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await deleteSkill(skill.id);
        await loadSkills();
        message.success("已删除");
      } catch {
        message.error("删除失败");
      }
    },
  });
}

async function saveDirs() {
  saving.value = true;
  saved.value = false;
  try {
    const value = skillsDirs.value.map((d) => d.trim()).filter(Boolean).join(",");
    await updateSetting("skills_dirs", value);
    saved.value = true;
    setTimeout(() => (saved.value = false), 2000);
    message.success("目录已保存");
  } catch {
    message.error("保存失败");
  } finally {
    saving.value = false;
  }
}

function addDir() {
  skillsDirs.value.push("");
}

function removeDir(index: number) {
  if (skillsDirs.value.length <= 1) return;
  skillsDirs.value.splice(index, 1);
}

function openBrowser(index: number) {
  browseIndex.value = index;
  showBrowser.value = true;
}

function handleBrowseSelect(path: string) {
  skillsDirs.value[browseIndex.value] = path;
}

async function loadApprovals() {
  loadingApprovals.value = true;
  try {
    approvals.value = await getPendingApprovals();
  } catch {
    approvals.value = [];
  } finally {
    loadingApprovals.value = false;
  }
}

async function handleApprove(approval: SkillApproval) {
  try {
    await approveSkill(approval.id);
    await Promise.all([loadApprovals(), loadSkills()]);
    message.success(`"${approval.skillName}" 已通过`);
  } catch {
    message.error("审批失败");
  }
}

async function handleReject(approval: SkillApproval) {
  dialog.warning({
    title: "拒绝 Skill",
    content: `确定要拒绝 "${approval.skillName}" 吗？`,
    positiveText: "拒绝",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await rejectSkill(approval.id);
        await loadApprovals();
        message.success(`"${approval.skillName}" 已拒绝`);
      } catch {
        message.error("操作失败");
      }
    },
  });
}

function switchTab(tab: "skills" | "approvals") {
  activeTab.value = tab;
  if (tab === "approvals") loadApprovals();
}

const filteredSkills = computed(() => {
  if (!searchQuery.value) return skills.value;
  const q = searchQuery.value.toLowerCase();
  return skills.value.filter(
    (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
  );
});

function goBack() {
  router.push("/");
}
</script>

<template>
  <div :class="embedded ? 'skills-embedded' : 'skills-view'">
    <div :class="embedded ? '' : 'skills-content'">
      <div :class="embedded ? '' : 'skills-shell glass-card'">
        <!-- 顶栏（embedded 模式简化） -->
        <div class="top-bar">
          <button v-if="!embedded" class="back-btn" @click="goBack">
            <NIcon :component="ChevronBackOutline" :size="18" />
            <span>返回</span>
          </button>
          <div v-if="!embedded" class="top-title">
            <NIcon :component="ExtensionPuzzleOutline" :size="16" />
            <span>技能管理</span>
          </div>
          <div class="top-actions">
            <NInput
              v-model:value="searchQuery"
              placeholder="搜索..."
              clearable
              size="small"
              class="search-input"
            >
              <template #prefix>
                <NIcon :component="SearchOutline" :size="14" />
              </template>
            </NInput>
            <button class="icon-btn" :class="{ active: showSettings }" title="目录设置" @click="showSettings = !showSettings">
              <NIcon :component="SettingsOutline" :size="14" />
            </button>
            <button class="btn-secondary btn-sm" :disabled="loading" @click="handleRefresh">
              <NIcon :component="RefreshOutline" :size="14" />
              <span>刷新</span>
            </button>
          </div>
        </div>

        <!-- Tab 切换 -->
        <div class="tab-bar">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'skills' }"
            @click="switchTab('skills')"
          >
            <NIcon :component="ExtensionPuzzleOutline" :size="14" />
            <span>全部技能</span>
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'approvals' }"
            @click="switchTab('approvals')"
          >
            <NIcon :component="TimeOutline" :size="14" />
            <span>待审批</span>
            <span v-if="approvals.length" class="tab-badge">{{ approvals.length }}</span>
          </button>
        </div>

        <!-- 技能管理 Tab -->
        <div v-if="activeTab === 'skills'">
          <!-- 说明 -->
          <div class="info-banner">
            <NIcon :component="InformationCircleOutline" :size="16" />
            <span>
              Skills 是基于
              <a href="https://agentskills.io/specification" target="_blank">Agent Skills 标准</a>
              的模块化能力包。Agent 通过 <code>lookup_skill</code> 按需加载。
              <template v-if="!showSettings">
                点击 <NIcon :component="SettingsOutline" :size="12" style="vertical-align: middle" /> 配置目录。
              </template>
            </span>
          </div>

          <!-- 目录配置（可折叠） -->
          <div v-if="showSettings" class="config-section">
            <div class="path-list">
              <div v-for="(dir, index) in skillsDirs" :key="index" class="path-row">
                <NInput v-model:value="skillsDirs[index]" placeholder="如 ~/.aniclaw/skills" size="small" />
                <button class="icon-btn" title="浏览" @click="openBrowser(index)">
                  <NIcon :component="FolderOpenOutline" :size="16" />
                </button>
                <button class="icon-btn danger" title="删除" :disabled="skillsDirs.length <= 1" @click="removeDir(index)">
                  <NIcon :component="TrashOutline" :size="16" />
                </button>
              </div>
            </div>
            <div class="path-actions">
              <button class="btn-secondary btn-sm" @click="addDir">
                <NIcon :component="AddOutline" :size="14" />
                <span>添加</span>
              </button>
              <div class="save-area">
                <span v-if="saved" class="save-hint">已保存</span>
                <button class="btn-primary btn-sm" :disabled="saving" @click="saveDirs">
                  <NIcon :component="SaveOutline" :size="14" />
                  <span>{{ saving ? "保存中..." : "保存" }}</span>
                </button>
              </div>
            </div>
            <p class="install-hint">
              使用 <code>npx skills add &lt;owner/repo@skill&gt; -g</code> 安装，
              或浏览 <a href="https://skills.sh/" target="_blank">skills.sh</a>
            </p>
            <div class="section-divider"></div>
          </div>

          <!-- 技能列表 -->
          <NSpin :show="loading">
            <div v-if="filteredSkills.length > 0" class="skill-grid">
              <div v-for="skill in filteredSkills" :key="skill.id" class="skill-card">
                <div class="skill-card-header">
                  <span class="skill-name">{{ skill.name }}</span>
                  <span v-if="skill.license" class="skill-badge">{{ skill.license }}</span>
                </div>
                <p class="skill-desc">{{ skill.description }}</p>
                <div class="skill-card-actions">
                  <button class="icon-btn danger" title="删除" @click="handleDelete(skill)">
                    <NIcon :component="TrashOutline" :size="14" />
                  </button>
                </div>
              </div>
            </div>

            <div v-else-if="!loading" class="empty-state">
              <NIcon :component="ExtensionPuzzleOutline" :size="48" />
              <p>暂无技能</p>
              <span>配置目录后点击「刷新」</span>
            </div>
          </NSpin>

          <!-- 目录浏览器 -->
          <DirectoryBrowser
            :show="showBrowser"
            :initial-path="skillsDirs[browseIndex] || undefined"
            @update:show="showBrowser = $event"
            @select="handleBrowseSelect"
          />
        </div>

        <!-- 审批列表 -->
        <div v-if="activeTab === 'approvals'" class="approval-section">
          <NSpin :show="loadingApprovals">
            <div v-if="approvals.length === 0" class="empty-state">
              <NIcon :component="TimeOutline" :size="48" />
              <p>暂无待审批</p>
              <span>Agent 创建的 Skill 会在这里等待审批</span>
            </div>
            <div v-else class="approval-cards">
              <div v-for="approval in approvals" :key="approval.id" class="approval-card">
                <div class="approval-header">
                  <span class="skill-name">{{ approval.skillName }}</span>
                  <span class="approval-type-badge">{{ approval.type === 'create' ? '新建' : '更新' }}</span>
                </div>
                <p class="approval-desc">
                  {{ approval.contentSnapshot.match(/^description:\s*(.+)$/m)?.[1] || '无描述' }}
                </p>
                <div class="approval-meta">
                  <span v-if="approval.patchDescription" class="patch-desc">{{ approval.patchDescription }}</span>
                  <span class="approval-time">{{ new Date(approval.submittedAt).toLocaleString() }}</span>
                </div>
                <div class="approval-actions">
                  <button class="btn-approve" @click="handleApprove(approval)">
                    <NIcon :component="CheckmarkCircleOutline" :size="14" />
                    <span>通过</span>
                  </button>
                  <button class="btn-reject" @click="handleReject(approval)">
                    <NIcon :component="CloseCircleOutline" :size="14" />
                    <span>拒绝</span>
                  </button>
                </div>
              </div>
            </div>
          </NSpin>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skills-embedded {
  overflow-y: auto;
}

.skills-embedded .top-bar {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 12px;
}

.skills-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.skills-content {
  flex: 1;
  overflow: hidden;
}

.skills-shell {
  height: 100%;
  padding: 24px;
  overflow-y: auto;
}

/* Top bar */
.top-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.back-btn:hover {
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.top-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.top-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  width: 180px;
}

/* Info banner */
.info-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
}

.info-banner a { color: var(--color-primary); text-decoration: none; }
.info-banner a:hover { text-decoration: underline; }
.info-banner code {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 4px;
  background: var(--bg-secondary);
  border-radius: 3px;
}

/* Config section */
.config-section {
  margin-bottom: 16px;
}

.section-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 16px 0;
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

.path-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.save-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.save-hint {
  font-size: 11px;
  color: var(--neon-green);
  font-family: var(--font-mono);
}

.install-hint {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 10px 0 0;
}

.install-hint code {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 4px;
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.install-hint a { color: var(--color-primary); text-decoration: none; }
.install-hint a:hover { text-decoration: underline; }

/* Skill grid */
.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

.skill-card {
  padding: 12px 14px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  position: relative;
}

.skill-card:hover {
  border-color: var(--border-color);
}

.skill-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.skill-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.skill-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: auto;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
}

.skill-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.skill-card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.skill-card:hover .skill-card-actions {
  opacity: 1;
}

/* Empty */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}

.empty-state p {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 12px 0 4px;
}

/* Buttons */
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

.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 7px 14px; font-size: 12px; }

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.icon-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.icon-btn.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.icon-btn.danger:hover {
  border-color: var(--neon-pink);
  color: var(--neon-pink);
  background: rgba(247, 37, 133, 0.05);
}

.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* Tab bar */
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.tab-btn.active {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.tab-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
  min-width: 16px;
  text-align: center;
  line-height: 16px;
}

/* Approval */
.approval-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.approval-card {
  padding: 14px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.approval-card:hover {
  border-color: var(--border-color);
}

.approval-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.approval-type-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  border: 1px solid var(--border-subtle);
}

.approval-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

.approval-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0;
  font-size: 11px;
  color: var(--text-muted);
}

.patch-desc {
  color: var(--text-secondary);
  font-size: 12px;
}

.approval-time {
  font-family: var(--font-mono);
}

.approval-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.btn-approve {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #10b981;
  border-radius: var(--radius-sm);
  color: #10b981;
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-approve:hover {
  background: rgba(16, 185, 129, 0.1);
}

.btn-reject {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #f72585;
  border-radius: var(--radius-sm);
  color: #f72585;
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-reject:hover {
  background: rgba(247, 37, 133, 0.1);
}
</style>
