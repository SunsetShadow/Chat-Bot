# 安全规范

## 已实现

### 输入验证

- 使用 class-validator 装饰器 + NestJS ValidationPipe 全局验证
- 必填字段检查（`@IsNotEmpty`）
- 类型检查（`@IsString`、`@IsBoolean`、`@IsArray` 等）
- 枚举值验证（`@IsEnum`）

### 安全头配置

通过 `SecurityMiddleware` 全局设置：

| 头 | 值 |
|------|------|
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| X-XSS-Protection | 1; mode=block |
| Content-Security-Policy | default-src 'self'; ... |

### 错误处理

- 全局异常过滤器，错误信息不暴露内部实现细节

### 路径沙箱

通过 `PathSandbox`（`base/path-sandbox.ts`）限制工具可访问的目录范围：

- 文件工具（`read_file`、`write_file`、`list_directory`、`search_files`）和命令工具（`execute_command`）的路径参数均受沙箱校验
- 黑名单前缀：`/etc`、`/usr`、`/bin`、`/sbin`、`/boot`、`/proc`、`/sys`、`/dev`、`/System`、`/Library`
- 黑名单文件名：`.env`、`id_rsa`、`id_ed25519`、`*.pem`、`*.key`、`credentials`、`secret` 等
- 白名单通过设置中心 UI 配置，存储在数据库 `settings` 表 `sandbox_allowed_dirs` 键
- 每次工具执行时校验（非启动时缓存），校验失败抛出友好错误信息

## 已定义但未应用

以下中间件已编写但未注册到路由：

### 速率限制

| 端点 | 限制 | 状态 |
|------|------|------|
| 聊天 | 20 次/分钟 | 中间件已定义，未注册 |
| Agent | 30 次/分钟 | 中间件已定义，未注册 |
| 记忆 | 60 次/分钟 | 中间件已定义，未注册 |

## 待实现

### 消息内容验证

| 规则 | 说明 | 状态 |
|------|------|------|
| 长度限制 | 1-10000 字符 | 未实现（无 `@MaxLength`） |
| 空白检查 | 不允许纯空白 | 已实现（`@IsNotEmpty`） |
| 特殊字符 | 过滤控制字符 | 未实现 |
| 重复内容 | 检测异常重复 | 未实现 |

### Prompt 注入防护

> 当前用户输入直接传递给 LLM，无注入检测。

待实现措施：
1. 用户内容不直接拼接到系统提示词
2. 明确区分用户输入和系统指令
3. 检测并拦截可疑模式（`ignore previous instructions` 等）

### 敏感信息保护

> 当前记忆系统无敏感信息过滤。

待实现：
- 密码、密钥、Token 不应存储
- 信用卡号、身份证号脱敏
- PII 信息检测

## 约束

1. 所有用户输入必须经过 ValidationPipe 验证（已实现）
2. 错误信息不暴露内部实现细节（已实现）
3. 敏感信息不得存储到记忆系统（待实现）
4. API 必须配置速率限制（中间件已定义，待注册）
5. Prompt 注入检测必须启用（待实现）
6. 文件和命令工具必须通过路径沙箱校验（已实现）
