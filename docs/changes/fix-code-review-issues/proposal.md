# Proposal: 修复代码审查问题

**Change ID**: `fix-code-review-issues`
**Created**: 2026-03-23
**Status**: Draft

## Why

代码审查发现了 7 个已验证存在的问题，包括：
- 1 个 Critical：重复定义导致潜在 bug
- 3 个 High：服务实例化、安全配置、代码重复
- 3 个 Medium：逻辑错误、异常处理、状态管理

## What Changes

### P0 - Critical (必须修复)

1. **memory_service.py 重复定义**
   - 删除第 154-198 行的重复 `extract_memory_from_conversation` 方法

### P1 - High (强烈建议)

2. **服务依赖注入单例化**
   - 为 `get_chat_service()` 等函数添加 `@lru_cache` 装饰器
   - 确保服务实例在整个应用生命周期内保持单例

3. **CORS 安全配置**
   - 将 `cors_origins` 默认值改为具体域名
   - 支持通过环境变量配置

4. **API_BASE_URL 统一**
   - 删除 `chat.ts` 中的重复定义
   - 从 `request.ts` 导出并复用

### P2 - Medium (建议修复)

5. **会话创建逻辑修正**
   - 使用后端返回的 `session_id`，不在前端重复创建

6. **添加日志记录**
   - 为静默吞掉的异常添加 `logger.warning()`

7. **chunk 逻辑修复**
   - 使用标志变量避免重复发送完成事件

## Impact

### 影响的代码
- `backend/app/services/memory_service.py` - 删除重复代码
- `backend/app/services/*.py` - 添加 lru_cache
- `backend/app/core/config.py` - CORS 配置
- `frontend/src/api/chat.ts` - 删除重复定义
- `frontend/src/composables/useChatStream.ts` - 会话逻辑

### 影响的 API
- 无 API 变更

### 影响的用户
- 开发者：更清晰的错误日志
- 运维：更安全的 CORS 配置

## Risks

- 低风险：主要是代码清理和 bug 修复
- 需要验证服务单例化后的行为符合预期
