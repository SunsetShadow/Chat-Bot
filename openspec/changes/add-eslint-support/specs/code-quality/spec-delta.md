# Spec Delta: Code Quality

**Change ID**: `add-eslint-support`
**Capability**: `code-quality`

---

## ADDED Requirements

### Requirement: ESLint 代码检查
系统 SHALL 使用 ESLint 对所有 Vue 和 TypeScript 文件进行静态代码分析。

#### Scenario: 运行 lint 检查
GIVEN 开发者在 frontend 目录下
WHEN 执行 `pnpm lint`
THEN 系统检查所有 `.vue`、`.ts`、`.js` 文件
AND 输出所有 lint 错误和警告
AND 返回非零退出码（如有错误）

#### Scenario: 自动修复 lint 问题
GIVEN 存在可自动修复的 lint 问题
WHEN 执行 `pnpm lint:fix`
THEN 系统自动修复所有可修复的问题
AND 输出修复结果

### Requirement: Vue 3 + TypeScript 规则集
系统 SHALL 使用官方 Vue 3 和 TypeScript ESLint 规则。

#### Scenario: Vue 单文件组件检查
GIVEN 一个 `.vue` 文件
WHEN ESLint 分析该文件
THEN 应用 `eslint-plugin-vue` 的 Vue 3 规则
AND 检查 `<template>`、`<script>`、`<style>` 块

#### Scenario: TypeScript 类型感知检查
GIVEN 一个 `.ts` 或 `.vue` 文件
WHEN ESLint 分析该文件
THEN 应用 `typescript-eslint` 的推荐规则
AND 使用项目 tsconfig 进行类型感知分析

### Requirement: 编辑器集成
系统 SHALL 支持 VS Code ESLint 扩展实时检查。

#### Scenario: VS Code 实时 lint
GIVEN VS Code 安装了 ESLint 扩展
WHEN 开发者打开 `.vue` 或 `.ts` 文件
THEN 编辑器实时显示 lint 错误和警告
AND 支持快速修复建议

### Requirement: Prettier 兼容
系统 SHALL 禁用与 Prettier 冲突的 ESLint 规则。

#### Scenario: 规则不冲突
GIVEN 项目同时使用 ESLint 和 Prettier
WHEN 格式化代码
THEN ESLint 不报告与格式相关的错误
AND Prettier 负责代码格式化
