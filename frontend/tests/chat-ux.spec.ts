import { test, expect, type Page } from "@playwright/test";

test.use({ ignoreHTTPSErrors: true });

const CHAT_URL = "https://localhost:3000";

async function mockChatAPI(page: Page, responseText = "这是一条测试回复消息。") {
  await page.route("**/api/v1/chat/completions", async (route) => {
    const sid = `test-session-${Date.now()}`;
    const mid = `msg-${Date.now()}`;
    const startData = JSON.stringify({ session_id: sid, message_id: mid, role: "assistant" });
    const contentData = JSON.stringify({ session_id: sid, message_id: mid, content: responseText });
    const doneData = JSON.stringify({ session_id: sid, message_id: mid, finish_reason: "stop" });
    const endData = JSON.stringify({ session_id: sid });
    const sseBody = [
      `event: message_start\ndata: ${startData}\n\n`,
      `event: content_delta\ndata: ${contentData}\n\n`,
      `event: message_done\ndata: ${doneData}\n\n`,
      `event: done\ndata: ${endData}\n\n`,
    ].join("");
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      body: sseBody,
    });
  });
}

async function mockRecordingAPI(page: Page) {
  await page.addInitScript(() => {
    const mockStream = {
      getTracks: () => [{ stop: () => {} }],
      getAudioTracks: () => [{ stop: () => {} }],
    };
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: () => Promise.resolve(mockStream) },
      writable: true,
    });
    window.AudioContext = class MockAudioContext {
      createAnalyser() {
        return { fftSize: 0, frequencyBinCount: 128, getByteFrequencyData: (a: Uint8Array) => a.fill(0), connect() {}, disconnect() {} } as unknown as AnalyserNode;
      }
      createMediaStreamSource() { return { connect() {}, disconnect() {} } as unknown as MediaStreamAudioSourceNode; }
      close() {}
    } as unknown as typeof AudioContext;
    class MockMediaRecorder {
      static isTypeSupported() { return true; }
      mimeType = "audio/webm";
      state: "inactive" | "recording" = "inactive";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() { this.state = "recording"; setTimeout(() => { this.ondataavailable?.({ data: new Blob([], { type: "audio/webm" }) }); }, 100); }
      stop() { this.state = "inactive"; setTimeout(() => { this.onstop?.(); }, 50); }
    }
    window.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;
    const orig = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/speech/asr")) return new Response(JSON.stringify({ text: "测试" }), { status: 200, headers: { "Content-Type": "application/json" } });
      return orig(input, init);
    };
  });
}

async function waitForChatInput(page: Page) {
  await page.locator(".message-input-container").waitFor({ state: "visible", timeout: 15000 });
}

async function waitTextareaEnabled(page: Page) {
  await page.locator(".main-textarea:not([disabled])").waitFor({ state: "visible", timeout: 15000 });
}

async function sendMessageAndWait(page: Page, text: string) {
  const textarea = page.locator(".main-textarea");
  await waitTextareaEnabled(page);
  await textarea.fill(text);
  await page.keyboard.press("Enter");
  await waitTextareaEnabled(page);
  await page.waitForTimeout(500);
}

// 通过 JS 注入消息到 Vue 响应式系统，绕过后端依赖
async function injectMessages(page: Page, count: number) {
  await page.evaluate((n: number) => {
    const msgs = Array.from({ length: n }, (_, i) => ({
      id: `test-${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      parts: [{ type: "text", text: `消息 ${i} - 这是一段测试消息，用来产生足够的高度和内容来使页面产生滚动行为。`.repeat(3) }],
    }));
    // 通过 Vue app 实例更新 Pinia store
    const app = document.querySelector("#app")?.__vue_app__;
    if (app) {
      const pinia = app.config.globalProperties.$pinia;
      const store = pinia._s.get("chat");
      if (store) {
        // 直接访问 AI SDK chat 实例的 messages 不太方便，
        // 改为通过 DOM 注入来模拟
      }
    }
    // 直接在 message list 容器中注入 HTML
    const container = document.querySelector(".h-full.overflow-y-auto .flex.flex-col");
    if (container) {
      for (let i = 0; i < n; i++) {
        const div = document.createElement("div");
        div.className = "flex gap-3 mb-4 animate-fadeInUp";
        div.style.animation = "fadeInUp 0.3s ease-out forwards";
        div.style.opacity = "1";
        div.innerHTML = `
          <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
            i % 2 === 0
              ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
          }">
            ${i % 2 === 0 ? "U" : "AI"}
          </div>
          <div class="flex-1 min-w-0 max-w-[85%]">
            <div class="px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              i % 2 === 0
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
            }">
              消息 ${i} - 这是一段测试消息，用来产生足够的高度和内容来使页面产生滚动行为。需要更多文字来让容器出现滚动。
            </div>
          </div>`;
        container.appendChild(div);
      }
    }
  }, count);
}

// ============================================================
// 1. 滚动到底部 + 条件自动滚动
// ============================================================
// 用于产生足够滚动高度的长响应
const LONG_RESPONSE = Array.from({ length: 60 }, (_, i) =>
  `这是第 ${i + 1} 行测试回复内容，用来产生足够的滚动高度来测试滚动到底部按钮功能。`
).join("\n");

test.describe("滚动到底部按钮 + 条件自动滚动", () => {
  test.beforeEach(async ({ page }) => {
    await mockRecordingAPI(page);
    await mockChatAPI(page, LONG_RESPONSE);
    await page.goto(CHAT_URL);
    await waitForChatInput(page);
  });

  test("初始状态不显示滚动到底部按钮", async ({ page }) => {
    await expect(page.locator(".scroll-to-bottom-btn")).not.toBeVisible();
  });

  test("有消息且在底部时不显示按钮", async ({ page }) => {
    await sendMessageAndWait(page, "hello");
    await expect(page.locator(".scroll-to-bottom-btn")).not.toBeVisible();
  });

  test("向上滚动后显示滚动到底部按钮", async ({ page }) => {
    await sendMessageAndWait(page, "hello");

    // 确认有足够滚动高度
    const msgList = page.locator(".h-full.overflow-y-auto");
    const hasScroll = await msgList.evaluate((el: HTMLElement) => el.scrollHeight > el.clientHeight + 100);
    expect(hasScroll).toBeTruthy();

    await msgList.evaluate((el: HTMLElement) => el.scrollTo({ top: 0 }));
    await page.waitForTimeout(500);

    await expect(page.locator(".scroll-to-bottom-btn")).toBeVisible({ timeout: 5000 });
  });

  test("点击滚动到底部按钮回到底部", async ({ page }) => {
    await sendMessageAndWait(page, "hello");

    const msgList = page.locator(".h-full.overflow-y-auto");
    await msgList.evaluate((el: HTMLElement) => el.scrollTo({ top: 0 }));
    await page.waitForTimeout(500);

    const btn = page.locator(".scroll-to-bottom-btn");
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(500);

    await expect(page.locator(".scroll-to-bottom-btn")).not.toBeVisible({ timeout: 2000 });
  });
});

// ============================================================
// 2. Textarea 自动增高
// ============================================================
test.describe("Textarea 自动增高", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_URL);
    await waitForChatInput(page);
  });

  test("输入多行文本后 textarea 高度增长", async ({ page }) => {
    const textarea = page.locator(".main-textarea");
    await textarea.click();
    const initialHeight = await textarea.evaluate((el: HTMLTextAreaElement) => el.offsetHeight);
    await textarea.fill("line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8");
    await page.waitForTimeout(200);
    const newHeight = await textarea.evaluate((el: HTMLTextAreaElement) => el.offsetHeight);
    expect(newHeight).toBeGreaterThan(initialHeight);
  });

  test("清空文本后 textarea 恢复初始高度", async ({ page }) => {
    const textarea = page.locator(".main-textarea");
    await textarea.click();
    const initialHeight = await textarea.evaluate((el: HTMLTextAreaElement) => el.offsetHeight);
    await textarea.fill("line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8");
    await page.waitForTimeout(200);
    await textarea.fill("");
    await page.waitForTimeout(200);
    const finalHeight = await textarea.evaluate((el: HTMLTextAreaElement) => el.offsetHeight);
    // 允许 2px 浮动
    expect(Math.abs(finalHeight - initialHeight)).toBeLessThanOrEqual(2);
  });

  test("textarea 不超过 max-height 160px", async ({ page }) => {
    const textarea = page.locator(".main-textarea");
    await textarea.click();
    const manyLines = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n");
    await textarea.fill(manyLines);
    await page.waitForTimeout(200);
    const height = await textarea.evaluate((el: HTMLTextAreaElement) => el.offsetHeight);
    expect(height).toBeLessThanOrEqual(162);
  });
});

// ============================================================
// 3. 移动端侧边栏抽屉
// ============================================================
test.describe("移动端侧边栏抽屉", () => {
  test("桌面端侧边栏可见，汉堡按钮不可见", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(CHAT_URL);
    await waitForChatInput(page);

    // 侧边栏中的 SessionList 可见
    await expect(page.locator("aside").locator("text=Conversations")).toBeVisible({ timeout: 5000 });

    // 汉堡按钮有 md:hidden 所以桌面端不显示
    const hamburger = page.locator("button.flex.md\\:hidden");
    await expect(hamburger).not.toBeVisible();
  });

  test("移动端侧边栏不可见，汉堡按钮可见", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(CHAT_URL);
    await waitForChatInput(page);

    // aside 有 hidden md:flex 所以移动端不可见
    const aside = page.locator("aside.hidden");
    await expect(aside).not.toBeVisible();

    const hamburger = page.locator("button.flex.md\\:hidden");
    await expect(hamburger).toBeVisible();
  });

  test("移动端点击汉堡按钮打开抽屉", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(CHAT_URL);
    await waitForChatInput(page);

    await page.locator("button.flex.md\\:hidden").click();

    // 抽屉出现（n-drawer）
    const drawer = page.locator(".n-drawer");
    await expect(drawer).toBeVisible({ timeout: 3000 });
    // 抽屉内包含新对话按钮
    await expect(drawer.locator("button:has-text('新对话')")).toBeVisible();
  });

  test("移动端选择会话后抽屉关闭", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(CHAT_URL);
    await waitForChatInput(page);

    await page.locator("button.flex.md\\:hidden").click();
    const drawer = page.locator(".n-drawer");
    await expect(drawer).toBeVisible({ timeout: 3000 });

    // 点击新对话
    await drawer.locator("button:has-text('新对话')").click();
    await page.waitForTimeout(500);

    await expect(drawer).not.toBeVisible({ timeout: 3000 });
  });
});

// ============================================================
// 4. 会话搜索
// ============================================================
test.describe("会话搜索", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(CHAT_URL);
    await waitForChatInput(page);
    await page.waitForTimeout(2000);
  });

  test("搜索框可见", async ({ page }) => {
    await expect(page.locator("input[placeholder='搜索会话...']")).toBeVisible();
  });

  test("输入搜索词过滤会话列表", async ({ page }) => {
    const titles = await page.locator("aside").locator(".text-sm.font-medium").allTextContents();
    if (titles.length === 0) return;

    const searchQuery = titles[0].substring(0, 3);
    await page.locator("input[placeholder='搜索会话...']").fill(searchQuery);
    await page.waitForTimeout(300);

    const visible = await page.locator("aside").locator(".text-sm.font-medium").count();
    expect(visible).toBeGreaterThanOrEqual(1);
  });

  test("搜索无匹配显示提示", async ({ page }) => {
    await page.locator("input[placeholder='搜索会话...']").fill("zzzzz_nonexistent_session_xyz");
    await page.waitForTimeout(300);
    await expect(page.locator("aside").locator("text=未找到匹配的会话")).toBeVisible();
  });

  test("清空搜索恢复全部会话", async ({ page }) => {
    const searchInput = page.locator("input[placeholder='搜索会话...']");
    await searchInput.fill("zzzzz_nonexistent");
    await page.waitForTimeout(300);
    await searchInput.fill("");
    await page.waitForTimeout(300);
    await expect(page.locator("aside").locator("text=未找到匹配的会话")).not.toBeVisible();
  });
});

// ============================================================
// 5. 空状态卡片
// ============================================================
test.describe("空状态卡片可操作", () => {
  test("Agent 角色卡片可点击跳转", async ({ page }) => {
    await page.goto(CHAT_URL);
    await waitForChatInput(page);
    await expect(page.locator("text=多种 Agent 角色")).toBeVisible();
    await page.locator("text=多种 Agent 角色").click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/agentconfig/, { timeout: 5000 });
  });

  test("其他卡片不触发跳转", async ({ page }) => {
    await page.goto(CHAT_URL);
    await waitForChatInput(page);
    const urlBefore = page.url();
    await page.locator("text=支持流式响应").click();
    await page.waitForTimeout(500);
    expect(page.url()).toBe(urlBefore);
  });
});

// ============================================================
// 现有功能回归
// ============================================================
test.describe("现有功能回归", () => {
  test.beforeEach(async ({ page }) => {
    await mockRecordingAPI(page);
    await page.goto(CHAT_URL);
    await waitForChatInput(page);
  });

  test("Enter 发送消息", async ({ page }) => {
    const textarea = page.locator(".main-textarea");
    await textarea.click();
    await textarea.fill("test message");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    await expect(textarea).toHaveValue("");
  });

  test("Shift+Enter 换行", async ({ page }) => {
    const textarea = page.locator(".main-textarea");
    await textarea.click();
    await textarea.fill("line1");
    await page.keyboard.press("Shift+Enter");
    const value = await textarea.inputValue();
    expect(value).toContain("\n");
  });

  test("Alt+Space 长按录音", async ({ page }) => {
    await page.keyboard.down("Alt");
    await page.keyboard.down("Space");
    await page.waitForTimeout(500);
    await expect(page.locator(".recording-panel")).toBeVisible();
    await page.keyboard.up("Space");
    await page.keyboard.up("Alt");
    await page.waitForTimeout(500);
    await expect(page.locator(".recording-panel")).not.toBeVisible();
  });

  test("ESC 取消录音", async ({ page }) => {
    await page.getByRole("button", { name: /语音/ }).click();
    await expect(page.locator(".recording-panel")).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await expect(page.locator(".recording-panel")).not.toBeVisible();
  });

  test("语音按钮点击录音", async ({ page }) => {
    await page.getByRole("button", { name: /语音/ }).click();
    await expect(page.locator(".recording-panel")).toBeVisible({ timeout: 3000 });
  });

  test("录音面板显示计时器和波形", async ({ page }) => {
    await page.getByRole("button", { name: /语音/ }).click();
    await expect(page.locator(".recording-panel")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".recording-timer")).toBeVisible();
    await expect(page.locator(".wave-bar").first()).toBeVisible();
  });

  test("底部功能按钮全部可见", async ({ page }) => {
    await expect(page.getByRole("button", { name: /附件/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /联网/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /思考/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /朗读/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /语音/ })).toBeVisible();
  });

  test("textarea 中 Space 正常输入空格", async ({ page }) => {
    const textarea = page.locator(".main-textarea");
    await textarea.click();
    await page.keyboard.press("Space");
    await expect(textarea).toHaveValue(" ");
  });

  test("语音按钮显示快捷键 badge", async ({ page }) => {
    const badge = page.locator(".shortcut-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText("⌥Space");
  });

  test("新建会话按钮可见", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator("aside").locator("button:has-text('新对话')")).toBeVisible({ timeout: 5000 });
  });

  test("模型选择器可见", async ({ page }) => {
    await expect(page.locator(".model-selector-bar")).toBeVisible();
  });

  test("顶部工具栏可见", async ({ page }) => {
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByRole("button", { name: /设置/ })).toBeVisible();
  });
});
