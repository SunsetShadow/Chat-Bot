# 安全规范

## 输入验证

### 消息内容验证

| 规则 | 说明 |
|------|------|
| 长度限制 | 1-10000 字符 |
| 空白检查 | 不允许纯空白 |
| 特殊字符 | 过滤控制字符 |
| 重复内容 | 检测异常重复 |

## Prompt 注入防护

### 检测模式

- `ignore (previous|all) instructions`
- `disregard (all|previous) (rules|instructions)`
- `you are now`
- `act as`
- `pretend (to be|you are)`
- `system:`
- `[INST]`
- `<<<`

### 防护措施

1. **用户输入隔离**：用户内容不直接拼接到系统提示词
2. **角色标记**：明确区分用户输入和系统指令
3. **内容过滤**：检测并拦截可疑模式

## 敏感信息保护

### 不应存储的内容

- 密码、密钥、Token
- 信用卡号、身份证号
- 私密地址、电话号码
- 其他 PII 信息

### 敏感信息检测

| 类型 | 正则模式 | 处理方式 |
|------|---------|---------|
| 信用卡 | `\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}` | 脱敏 |
| 手机号 | `1[3-9]\d{9}` | 脱敏 |
| 身份证 | `\d{17}[\dXx]` | 脱敏 |
| API Key | `[a-zA-Z0-9]{32,}` | 警告 |

## API 安全

### 速率限制

| 端点 | 限制 |
|------|------|
| 聊天 | 20 次/分钟 |
| Agent | 30 次/分钟 |
| 记忆 | 60 次/分钟 |

### 请求验证

- 验证 Content-Type
- 检查请求体大小
- 验证必需字段

## 安全头配置

| 头 | 值 |
|------|------|
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| X-XSS-Protection | 1; mode=block |
| Content-Security-Policy | default-src 'self' |

## 约束

1. 所有用户输入必须经过验证和清理（class-validator + ValidationPipe）
2. 敏感信息不得存储到记忆系统
3. Prompt 注入检测必须启用
4. API 必须配置速率限制（NestJS Middleware）
5. 错误信息不暴露内部实现细节（全局异常过滤器）
