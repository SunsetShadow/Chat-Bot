<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useMessage } from "naive-ui";

const message = useMessage();
const count = ref(0);
const isVisible = ref(false);
const typedText = ref("");
const fullText = "AI 聊天助手";

const features = [
  {
    title: "流式响应",
    desc: "SSE 实时流式输出，打字机效果呈现",
    icon: "stream",
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    title: "多轮对话",
    desc: "智能上下文记忆，自然连续交流",
    icon: "chat",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    title: "会话管理",
    desc: "完整历史记录，随时回顾延续",
    icon: "history",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    title: "极速响应",
    desc: "Vue 3 + FastAPI 高性能架构",
    icon: "bolt",
    gradient: "from-orange-500 to-amber-500",
  },
];

const handleCount = () => {
  count.value++;
  message.success(`已交互 ${count.value} 次`);
};

const handleStart = () => {
  message.loading("正在初始化 AI 模型...", { duration: 2000 });
};

// 打字机效果
onMounted(() => {
  isVisible.value = true;
  let index = 0;
  const timer = setInterval(() => {
    if (index < fullText.length) {
      typedText.value += fullText[index];
      index++;
    } else {
      clearInterval(timer);
    }
  }, 150);
});
</script>

<template>
  <div class="welcome-container">
    <!-- 流动背景 -->
    <div class="bg-canvas">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
      <div class="gradient-orb orb-3"></div>
      <div class="grid-pattern"></div>
    </div>

    <!-- 主内容 -->
    <div class="content-wrapper">
      <!-- Hero 区域 -->
      <div class="hero-section" :class="{ visible: isVisible }">
        <!-- Logo -->
        <div class="logo-container">
          <div class="logo-ring"></div>
          <div class="logo-core">
            <svg viewBox="0 0 24 24" fill="none" class="logo-icon">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div class="logo-pulse"></div>
        </div>

        <!-- 标题 -->
        <h1 class="hero-title">
          <span class="title-gradient">Chat Bot</span>
          <span class="title-cursor">|</span>
        </h1>
        <p class="hero-subtitle">
          <span class="typed-text">{{ typedText }}</span>
          <span class="typing-cursor">_</span>
        </p>

        <!-- SSE 流式提示 -->
        <div class="stream-badge">
          <div class="stream-dots"><span></span><span></span><span></span></div>
          <span>支持 SSE 流式响应</span>
        </div>
      </div>

      <!-- 功能卡片 -->
      <div class="features-grid">
        <n-card
          v-for="(feature, index) in features"
          :key="feature.title"
          class="feature-card"
          :style="{ animationDelay: `${index * 0.1}s` }"
          :bordered="false"
        >
          <div class="feature-content">
            <div :class="['feature-icon', feature.gradient]">
              <svg
                v-if="feature.icon === 'stream'"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M4 6h16M4 12h16M4 18h10"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              <svg
                v-else-if="feature.icon === 'chat'"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <svg
                v-else-if="feature.icon === 'history'"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none">
                <path
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <h3 class="feature-title">{{ feature.title }}</h3>
            <p class="feature-desc">{{ feature.desc }}</p>
          </div>
        </n-card>
      </div>

      <!-- 快速开始 -->
      <div class="action-section">
        <div class="action-buttons">
          <n-button
            type="primary"
            size="large"
            class="btn-primary"
            @click="handleStart"
          >
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" class="btn-icon">
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </template>
            开始对话
          </n-button>
          <n-button size="large" class="btn-secondary" @click="handleCount">
            查看文档
          </n-button>
          <n-button
            size="large"
            class="btn-ghost"
            @click="message.info('API 接口文档 /docs')"
          >
            API 接口
          </n-button>
        </div>

        <!-- 统计信息 -->
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-value">80+</span>
            <span class="stat-label">组件</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value">SSE</span>
            <span class="stat-label">流式</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value">TS</span>
            <span class="stat-label">类型安全</span>
          </div>
        </div>
      </div>

      <!-- 版本信息 -->
      <div class="version-info">
        <span>v1.0.0</span>
        <span class="dot">•</span>
        <span>Vue 3 + Naive UI + FastAPI</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 容器 */
.welcome-container {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background: #050508;
}

/* 流动背景 */
.bg-canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  animation: float 20s ease-in-out infinite;
}

.orb-1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, #0891b2 0%, transparent 70%);
  top: -200px;
  left: -100px;
  animation-delay: 0s;
}

.orb-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #7c3aed 0%, transparent 70%);
  bottom: -150px;
  right: -100px;
  animation-delay: -7s;
}

.orb-3 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #059669 0%, transparent 70%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -14s;
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(50px, -50px) scale(1.1);
  }
  50% {
    transform: translate(-30px, 30px) scale(0.9);
  }
  75% {
    transform: translate(-50px, -30px) scale(1.05);
  }
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 60px 60px;
}

/* 内容 */
.content-wrapper {
  position: relative;
  z-index: 1;
  max-width: 900px;
  margin: 0 auto;
  padding: 60px 24px;
}

/* Hero */
.hero-section {
  text-align: center;
  margin-bottom: 60px;
  opacity: 0;
  transform: translateY(30px);
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.hero-section.visible {
  opacity: 1;
  transform: translateY(0);
}

.logo-container {
  position: relative;
  width: 100px;
  height: 100px;
  margin: 0 auto 32px;
}

.logo-ring {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(6, 182, 212, 0.3);
  border-radius: 50%;
  animation: spin 10s linear infinite;
}

.logo-ring::before {
  content: "";
  position: absolute;
  top: -4px;
  left: 50%;
  width: 8px;
  height: 8px;
  background: #06b6d4;
  border-radius: 50%;
  box-shadow: 0 0 20px #06b6d4;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.logo-core {
  position: absolute;
  inset: 15px;
  background: linear-gradient(135deg, #0891b2, #7c3aed);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-icon {
  width: 32px;
  height: 32px;
  color: white;
}

.logo-pulse {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(6, 182, 212, 0.5);
  border-radius: 50%;
  animation: pulse-ring 2s ease-out infinite;
}

@keyframes pulse-ring {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.hero-title {
  font-size: 4rem;
  font-weight: 800;
  margin-bottom: 12px;
  letter-spacing: -0.02em;
  line-height: 1;
}

.title-gradient {
  background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.title-cursor {
  color: #06b6d4;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.hero-subtitle {
  font-size: 1.5rem;
  color: #94a3b8;
  margin-bottom: 24px;
  font-weight: 300;
}

.typing-cursor {
  color: #06b6d4;
  animation: blink 1s step-end infinite;
}

.stream-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px;
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 100px;
  color: #06b6d4;
  font-size: 0.875rem;
  font-weight: 500;
}

.stream-dots {
  display: flex;
  gap: 4px;
}

.stream-dots span {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  animation: stream-pulse 1.5s ease-in-out infinite;
}

.stream-dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.stream-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes stream-pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

/* 功能卡片 */
.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 48px;
}

.feature-card {
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  border-radius: 16px !important;
  backdrop-filter: blur(10px);
  opacity: 0;
  transform: translateY(20px);
  animation: card-in 0.6s ease forwards;
}

@keyframes card-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.feature-card:hover {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  transform: translateY(-4px);
  transition: all 0.3s ease;
}

.feature-content {
  padding: 8px;
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.feature-icon svg {
  width: 24px;
  height: 24px;
  color: white;
}

.feature-icon.from-cyan-500 {
  background: linear-gradient(135deg, #06b6d4, #0284c7);
}
.feature-icon.from-violet-500 {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}
.feature-icon.from-emerald-500 {
  background: linear-gradient(135deg, #10b981, #059669);
}
.feature-icon.from-orange-500 {
  background: linear-gradient(135deg, #f97316, #ea580c);
}

.feature-title {
  color: #f1f5f9;
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.feature-desc {
  color: #64748b;
  font-size: 0.875rem;
  line-height: 1.5;
}

/* 操作区域 */
.action-section {
  text-align: center;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 40px;
  flex-wrap: wrap;
}

.btn-primary {
  background: linear-gradient(135deg, #06b6d4, #0891b2) !important;
  border: none !important;
  padding: 0 32px !important;
  height: 48px !important;
  font-weight: 600 !important;
  border-radius: 12px !important;
  box-shadow: 0 4px 24px rgba(6, 182, 212, 0.3) !important;
}

.btn-primary:hover {
  box-shadow: 0 8px 32px rgba(6, 182, 212, 0.4) !important;
  transform: translateY(-2px);
}

.btn-icon {
  width: 18px;
  height: 18px;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: #e2e8f0 !important;
  padding: 0 24px !important;
  height: 48px !important;
  border-radius: 12px !important;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

.btn-ghost {
  background: transparent !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  color: #64748b !important;
  padding: 0 24px !important;
  height: 48px !important;
  border-radius: 12px !important;
}

.btn-ghost:hover {
  color: #94a3b8 !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

/* 统计 */
.stats-row {
  display: inline-flex;
  align-items: center;
  gap: 24px;
  padding: 16px 32px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 100px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f1f5f9;
}

.stat-label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
}

/* 版本 */
.version-info {
  text-align: center;
  margin-top: 48px;
  color: #475569;
  font-size: 0.875rem;
}

.dot {
  margin: 0 8px;
}

/* 响应式 */
@media (max-width: 640px) {
  .hero-title {
    font-size: 2.5rem;
  }

  .hero-subtitle {
    font-size: 1.125rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
    align-items: center;
  }

  .action-buttons .n-button {
    width: 100%;
    max-width: 280px;
  }

  .stats-row {
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px 24px;
  }

  .stat-divider {
    display: none;
  }
}
</style>
