# Proposal: 前端 ESLint 支持

**Change ID**: `add-eslint-support`
**Created**: 2026-03-23
**Status**: Draft

## Why

前端项目目前缺乏代码质量检查工具，存在以下问题：
- 没有统一的代码风格规范
- 无法自动检测潜在的代码错误
- 团队协作时代码风格可能不一致
- TypeScript 类型检查与 ESLint 检查分离，缺少 Vue 特定规则

## What Changes

1. 安装 ESLint 9 及相关插件（Vue、TypeScript、Prettier 集成）
2. 配置 `eslint.config.js`（ESLint 9 扁平化配置）
3. 添加 npm scripts：`lint` 和 `lint:fix`
4. 配置 VS Code ESLint 集成（.vscode/settings.json）
5. 修复现有代码中的 lint 问题

## Impact

### 影响的规范
- 新增：`code-quality` 规范

### 影响的代码
- `frontend/package.json` - 新增依赖和脚本
- `frontend/eslint.config.js` - 新配置文件
- `frontend/.vscode/settings.json` - 编辑器集成
- `frontend/src/**/*.vue` - 可能需要修复 lint 问题
- `frontend/src/**/*.ts` - 可能需要修复 lint 问题

### 影响的 API
- 无

### 影响的用户
- 开发者：需要运行 `pnpm lint` 检查代码
- CI/CD：后续可集成 lint 检查

## Dependencies

- ESLint 9.x（扁平化配置）
- `@eslint/js` - ESLint JavaScript 规则
- `typescript-eslint` - TypeScript 支持
- `eslint-plugin-vue` - Vue 单文件组件支持
- `@vue/eslint-config-typescript` - Vue + TypeScript 官方配置
- `@vue/eslint-config-prettier` - 禁用与 Prettier 冲突的规则

## Risks

- 低风险：纯新增功能，不影响现有代码行为
- 首次运行可能发现较多 lint 问题需要修复
