# Spec Delta: Code Quality

**Change ID**: `fix-code-review-issues`
**Capability**: `code-quality`

---

## MODIFIED Requirements

### Requirement: 服务单例化
所有服务提供者函数 SHALL 使用 `@lru_cache` 装饰器确保单例模式。

#### Scenario: 服务实例一致性
GIVEN FastAPI 应用启动
WHEN 多次调用 `get_chat_service()`
THEN 返回同一个 ChatService 实例
AND 会话数据在请求间保持一致

### Requirement: CORS 安全配置
CORS 配置 SHALL 使用具体的允许域名，而非通配符。

#### Scenario: 开发环境 CORS
GIVEN 环境变量 CORS_ORIGINS 未设置
WHEN 应用启动
THEN 默认允许 `http://localhost:3000`

#### Scenario: 生产环境 CORS
GIVEN 环境变量 CORS_ORIGINS 设置为 `https://example.com,https://api.example.com`
WHEN 应用启动
THEN 仅允许指定域名跨域访问

### Requirement: 前端 API 配置统一
API 基础 URL SHALL 只定义一次并在各模块间共享。

#### Scenario: API_BASE_URL 导入
GIVEN 前端项目结构
WHEN chat.ts 需要访问 API
THEN 从 request.ts 导入 API_BASE_URL
AND 不存在重复定义

### Requirement: 会话 ID 一致性
前端 SHALL 使用后端返回的会话 ID，而非自行创建。

#### Scenario: 新会话创建
GIVEN 用户发送第一条消息
WHEN 后端返回 message_start 事件
THEN 前端使用事件中的 session_id
AND 不在前端重复创建会话

### Requirement: 异常日志记录
所有被捕获的异常 SHALL 记录日志，而非静默忽略。

#### Scenario: Agent 加载失败
GIVEN 系统构建提示词时 Agent 不存在
WHEN 异常被捕获
THEN 记录 warning 级别日志
AND 继续执行后续逻辑

### Requirement: SSE 事件唯一性
流式响应中的完成事件 SHALL 只发送一次。

#### Scenario: 消息完成事件
GIVEN LLM 流式响应结束
WHEN 收到 finish_reason
THEN 发送一次 message_done 事件
AND 不重复发送

---

## REMOVED Requirements

### Requirement: 重复的方法定义
`memory_service.py` 中的 `extract_memory_from_conversation` 方法 SHALL 只定义一次。
