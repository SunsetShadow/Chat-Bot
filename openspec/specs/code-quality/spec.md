# 代码质量规范

## 概述

本规范定义 Chat Bot 项目的代码质量标准，基于 Martin Fowler 重构原则和 Robert C. Martin (Uncle Bob) Clean Code 原则。

## 核心原则

### 1. Clean Code 原则 (Uncle Bob)

#### 命名规范

**有意义的命名**
- 名称应表达意图，而非实现
- 避免误导性名称
- 使用可搜索的名称
- 类名应为名词，方法名应为动词

```typescript
// Bad
const d = new Date()
const x = users.filter(u => u.a)

// Good
const registrationDate = new Date()
const activeUsers = users.filter(user => user.isActive)
```

**前端命名约定**
```typescript
// 组件：PascalCase
ChatView.vue
MessageItem.vue

// Composables：use 前缀
useChatStream.ts
useAgent.ts

// 变量/函数：camelCase
const messageList = ref([])
function sendMessage() {}

// 常量：UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3
const API_BASE_URL = '/api/v1'
```

**后端命名约定**
```python
# 类：PascalCase
class ChatService:
    pass

# 函数/变量：snake_case
def get_chat_messages():
    pass

# 常量：UPPER_SNAKE_CASE
MAX_RETRY_COUNT = 3
```

#### 函数规范

**单一职责**
- 每个函数只做一件事
- 函数名应描述其唯一职责

```typescript
// Bad
function processUser(user: User) {
  validateUser(user)
  saveToDatabase(user)
  sendEmail(user)
}

// Good
function validateAndCreateUser(user: User) {
  validateUser(user)
  return createUser(user)
}
```

**函数长度**
- 理想长度：4-10 行
- 最大不超过 20 行
- 超过时应考虑拆分

**参数数量**
- 理想：0-2 个参数
- 最多不超过 3 个
- 超过时使用配置对象

```typescript
// Bad
function createMessage(content, sender, receiver, timestamp, type, priority) {}

// Good
interface MessageOptions {
  content: string
  sender: string
  receiver: string
  timestamp?: Date
  type?: MessageType
}

function createMessage(options: MessageOptions) {}
```

**避免副作用**
- 函数应无副作用或副作用明确
- 避免修改输入参数

```typescript
// Bad
function addMessage(messages: Message[], newMessage: Message) {
  messages.push(newMessage) // 修改了输入参数
}

// Good
function addMessage(messages: Message[], newMessage: Message): Message[] {
  return [...messages, newMessage] // 返回新数组
}
```

#### 注释规范

**好注释**
- 解释意图的注释
- 对复杂算法的说明
- TODO 注释（需跟进处理）
- 公共 API 的文档注释

**避免的注释**
- 多余的注释（代码已足够清晰）
- 误导性注释
- 注释掉的代码

```typescript
// Bad
// 循环遍历用户
for (const user of users) {}

// Good
// 使用批量处理避免 API 速率限制
const BATCH_SIZE = 10
for (let i = 0; i < users.length; i += BATCH_SIZE) {}
```

### 2. 重构原则 (Martin Fowler)

#### 代码异味识别

**需要重构的信号**

| 异味类型 | 描述 | 解决方案 |
|---------|------|---------|
| 重复代码 | 相同逻辑出现多次 | 提取方法/类 |
| 过长函数 | 函数超过 20 行 | 拆分为小函数 |
| 过大类 | 类承担过多职责 | 提取职责到新类 |
| 过长参数列表 | 参数超过 3 个 | 使用配置对象 |
| 发散式变化 | 一个类因多种原因变化 | 拆分类 |
| 霰弹式修改 | 一个变化导致多处修改 | 合并相关逻辑 |
| 依恋情结 | 方法过度访问其他类数据 | 移动方法到数据所在类 |

#### 常用重构手法

**提取方法 (Extract Method)**
```typescript
// Before
function printOwing(invoice: Invoice) {
  printBanner()
  let outstanding = 0
  for (const order of invoice.orders) {
    outstanding += order.amount
  }
  console.log(`name: ${invoice.customer}`)
  console.log(`amount: ${outstanding}`)
}

// After
function printOwing(invoice: Invoice) {
  printBanner()
  const outstanding = calculateOutstanding(invoice)
  printDetails(invoice, outstanding)
}
```

**用多态替代条件**
```typescript
// Before
function calculatePay(employee: Employee) {
  switch (employee.type) {
    case 'ENGINEER':
      return employee.monthlySalary
    case 'SALESMAN':
      return employee.monthlySalary + employee.commission
    case 'MANAGER':
      return employee.monthlySalary + employee.bonus
  }
}

// After
interface Employee {
  calculatePay(): number
}

class Engineer implements Employee {
  calculatePay() { return this.monthlySalary }
}

class Salesman implements Employee {
  calculatePay() { return this.monthlySalary + this.commission }
}
```

**分解条件表达式**
```typescript
// Before
if (date.before(SUMMER_START) || date.after(SUMMER_END)) {
  charge = quantity * winterRate + winterServiceCharge
} else {
  charge = quantity * summerRate
}

// After
if (isSummer(date)) {
  charge = summerCharge(quantity)
} else {
  charge = winterCharge(quantity)
}
```

### 3. SOLID 原则

#### 单一职责原则 (SRP)

```typescript
// Bad: 一个组件做太多事
const UserCard = ({ user }) => {
  const [isEditing, setIsEditing] = useState(false)
  // 渲染逻辑 + 编辑逻辑 + API 调用
}

// Good: 职责分离
const UserCard = ({ user }) => {
  // 只负责展示
}

const useUserEdit = (userId: string) => {
  // 只负责编辑逻辑
}
```

#### 开闭原则 (OCP)

```typescript
// 使用策略模式扩展行为
interface MessageFormatter {
  format(message: string): string
}

class MarkdownFormatter implements MessageFormatter {
  format(message: string) { return markdownToHtml(message) }
}

class PlainTextFormatter implements MessageFormatter {
  format(message: string) { return message }
}

// 添加新格式无需修改现有代码
class CodeBlockFormatter implements MessageFormatter {
  format(message: string) { return `<code>${message}</code>` }
}
```

#### 里氏替换原则 (LSP)

```typescript
// 子类应能替换父类而不影响正确性
class Bird {
  move(): void {}
}

class Sparrow extends Bird {
  move() { this.fly() }
}

class Penguin extends Bird {
  move() { this.walk() } // 企鹅不会飞，但可以移动
}
```

#### 接口隔离原则 (ISP)

```typescript
// Bad: 臃肿的接口
interface Worker {
  work(): void
  eat(): void
  sleep(): void
}

// Good: 接口分离
interface Workable {
  work(): void
}

interface Feedable {
  eat(): void
}

class Robot implements Workable {
  work() { /* ... */ }
  // 机器人不需要 eat
}
```

#### 依赖倒置原则 (DIP)

```typescript
// 依赖抽象，不依赖具体实现
interface LLMProvider {
  generate(prompt: string): Promise<string>
}

class ChatService {
  constructor(private llmProvider: LLMProvider) {}

  async chat(message: string) {
    return this.llmProvider.generate(message)
  }
}
```

## 前端规范

### Vue 组件结构

```vue
<script setup lang="ts">
// 1. 导入
import { ref, computed, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'

// 2. Props/Emits 定义
const props = defineProps<{
  messageId: string
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()

// 3. 响应式状态
const isLoading = ref(false)
const chatStore = useChatStore()

// 4. 计算属性
const message = computed(() => chatStore.getMessage(props.messageId))

// 5. 方法
async function handleDelete() {
  isLoading.value = true
  try {
    emit('delete', props.messageId)
  } finally {
    isLoading.value = false
  }
}

// 6. 生命周期钩子
onMounted(() => {
  // 初始化逻辑
})
</script>

<template>
  <div class="message-item">
    <!-- 模板内容 -->
  </div>
</template>

<style scoped>
/* 样式 */
</style>
```

### Composables 规范

```typescript
// composables/useChatStream.ts
export function useChatStream(conversationId: Ref<string>) {
  // 状态
  const messages = ref<Message[]>([])
  const isConnected = ref(false)

  // 方法
  function connect() { /* ... */ }
  function disconnect() { /* ... */ }

  // 副作用
  watch(conversationId, () => {
    disconnect()
    connect()
  })

  // 清理
  onUnmounted(() => {
    disconnect()
  })

  return {
    messages: readonly(messages),
    isConnected: readonly(isConnected),
    connect,
    disconnect
  }
}
```

### Store 规范

```typescript
// stores/chat.ts
export const useChatStore = defineStore('chat', () => {
  // State
  const conversations = ref<Map<string, Conversation>>(new Map())
  const activeId = ref<string | null>(null)

  // Getters
  const activeConversation = computed(() => {
    if (!activeId.value) return null
    return conversations.value.get(activeId.value)
  })

  // Actions
  async function sendMessage(content: string) {
    // 调用 API，不在此处直接 fetch
    const response = await chatApi.sendMessage(activeId.value!, content)
    // 更新状态
  }

  return {
    // State (只读暴露)
    conversations: readonly(conversations),
    activeId: readonly(activeId),
    // Getters
    activeConversation,
    // Actions
    sendMessage,
    setActiveConversation
  }
})
```

## 后端规范

### Service 层规范

```python
# services/chat_service.py
class ChatService:
    """聊天服务，处理消息相关业务逻辑"""

    def __init__(
        self,
        chat_repo: ChatRepository,
        llm_provider: BaseLLMProvider
    ):
        self._chat_repo = chat_repo
        self._llm_provider = llm_provider

    async def process_message(
        self,
        conversation_id: str,
        content: str,
        agent: Agent | None = None
    ) -> AsyncGenerator[str, None]:
        """处理用户消息并返回 AI 响应流"""
        # 1. 保存用户消息
        await self._chat_repo.add_message(
            conversation_id=conversation_id,
            role="user",
            content=content
        )

        # 2. 构建系统提示词
        system_prompt = self._build_system_prompt(agent)

        # 3. 调用 LLM
        async for chunk in self._llm_provider.stream_generate(
            messages=await self._chat_repo.get_messages(conversation_id),
            system_prompt=system_prompt
        ):
            yield chunk
```

### API 路由规范

```python
# api/v1/chat.py
router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/conversations/{id}/messages")
async def send_message(
    id: str,
    request: SendMessageRequest,
    chat_service: ChatService = Depends(get_chat_service)
):
    """发送消息到指定会话"""
    async def generate():
        async for chunk in chat_service.process_message(
            conversation_id=id,
            content=request.content
        ):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )
```

### Repository 层规范

```python
# repositories/chat_repository.py
class ChatRepository:
    """聊天数据访问层"""

    def __init__(self, db: Session):
        self._db = db

    async def get_messages(
        self,
        conversation_id: str,
        limit: int = 50
    ) -> list[ChatMessage]:
        """获取会话消息列表"""
        return (
            self._db.query(ChatMessage)
            .filter(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
            .all()
        )
```

## 错误处理规范

### 前端错误处理

```typescript
// API 层统一错误处理
export async function apiCall<T>(
  fn: () => Promise<T>
): Promise<Result<T, ApiError>> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (error) {
    if (error instanceof AxiosError) {
      return {
        ok: false,
        error: {
          code: error.response?.data?.code || 'UNKNOWN',
          message: error.response?.data?.message || error.message
        }
      }
    }
    throw error // 非预期错误继续抛出
  }
}
```

### 后端错误处理

```python
# 使用自定义异常
class ChatBotError(Exception):
    """基础业务异常"""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message

class NotFoundError(ChatBotError):
    """资源未找到"""
    def __init__(self, resource: str, id: str):
        super().__init__(
            code="NOT_FOUND",
            message=f"{resource} with id '{id}' not found"
        )

# 全局异常处理
@app.exception_handler(ChatBotError)
async def chatbot_error_handler(request: Request, exc: ChatBotError):
    return JSONResponse(
        status_code=400,
        content={"code": exc.code, "message": exc.message}
    )
```

## 代码审查清单

### 提交前自查

- [ ] 代码是否通过 linter 检查
- [ ] 函数是否遵循单一职责
- [ ] 命名是否清晰表达意图
- [ ] 是否存在重复代码
- [ ] 是否有适当的错误处理
- [ ] 是否有必要的注释
- [ ] 是否遵循项目目录结构

### 审查重点

| 类别 | 检查项 |
|-----|--------|
| 可读性 | 命名清晰、代码格式一致、注释恰当 |
| 可维护性 | 函数长度适中、职责清晰、低耦合 |
| 可测试性 | 依赖可注入、纯函数优先、副作用明确 |
| 性能 | 无不必要计算、合理使用缓存、避免内存泄漏 |
| 安全性 | 输入验证、敏感信息保护、无 SQL 注入风险 |

## 约束

1. 所有代码必须通过 ESLint/Ruff 检查
2. 函数长度不超过 30 行（复杂算法除外）
3. 公共 API 必须有类型注解
4. 避免深层嵌套（最多 3 层）
5. 使用早期返回减少嵌套

## 参考资料

- [Clean Code - Robert C. Martin](https://www.oreilly.com/library/view/clean-code-a/9780136083238/)
- [Refactoring - Martin Fowler](https://refactoring.com/)
- [Vue 3 风格指南](https://vuejs.org/style-guide/)
- [Python PEP 8](https://peps.python.org/pep-0008/)
