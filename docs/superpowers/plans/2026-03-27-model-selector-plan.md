# Model Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-step.

**Goal:** 在用户输入框上方添加模型切换功能

**Architecture:** 前后端协同，后端提供 /models API，前端使用 Pinia store 管理状态

**Tech Stack:** Vue 3 + Naive UI + Pinia + FastAPI

---

## File Structure

| 文件 | 变更 | 说明 |
|------|------|------|
| `backend/app/api/v1/model.py` | 已创建 | 模型列表 API |
| `backend/app/api/v1/router.py` | 已修改 | 注册路由 |
| `frontend/src/stores/model.ts` | 已创建 | 模型状态管理 |
| `frontend/src/components/chat/ModelSelector.vue` | 已创建 | 选择器组件 |
| `frontend/src/components/chat/MessageInput.vue` | 已修改 | 集成选择器 |
| `frontend/src/composables/useChatStream.ts` | 已修改 | 传递 model 参数 |

---

## Task 1: 验证后端 API

**Files:** 无需修改，仅验证

- [ ] **Step 1: 启动后端服务**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/backend && uv run fastapi dev app/main.py`

- [ ] **Step 2: 测试 API 端点**

Run: `curl http://localhost:8000/api/v1/models`
Expected: 返回包含 models 数组的 JSON

---

## Task 2: 验证前端构建

**Files:** 无需修改，仅验证

- [ ] **Step 1: 运行类型检查**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm build`
Expected: 构建成功，无错误

- [ ] **Step 2: 运行 lint 检查**

Run: `pnpm lint`
Expected: 0 errors

---

## Task 3: 更新 components.d.ts

**Files:**
- Modify: `frontend/src/components.d.ts`

- [ ] **Step 1: 添加 ModelSelector 组件声明**

在 `components.d.ts` 中添加：
```typescript
ModelSelector: typeof import('./components/chat/ModelSelector.vue')['default']
```

- [ ] **Step 2: 验证构建**

Run: `pnpm build`
Expected: 无错误

---

## Task 4: 浏览器验证

**Files:** 无文件变更，仅验证

- [ ] **Step 1: 启动开发服务器**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot && ./dev.sh`

- [ ] **Step 2: 验证功能**

打开 http://localhost:3000，检查：
1. 输入框上方显示模型选择器
2. 点击选择器展开模型列表
3. 选择不同模型后名称更新
4. 切换主题后样式正常

---

## Self-Review

**1. Spec coverage:**
- [x] 后端 /models API - Task 1
- [x] 前端 model store - Task 2
- [x] ModelSelector 组件 - Task 2
- [x] MessageInput 集成 - Task 2
- [x] model 参数传递 - Task 2
- [x] 浏览器验证 - Task 4

**2. Placeholder scan:** 无 TBD/TODO

**3. Type consistency:** Model 接口在前后端定义一致
