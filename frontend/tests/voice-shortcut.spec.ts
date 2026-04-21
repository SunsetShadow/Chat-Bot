import { test, expect, type Page } from "@playwright/test";

test.use({ ignoreHTTPSErrors: true });

const CHAT_URL = "https://localhost:3000";

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
        return {
          fftSize: 0,
          frequencyBinCount: 128,
          getByteFrequencyData: (arr: Uint8Array) => arr.fill(0),
          connect: () => {},
          disconnect: () => {},
        } as unknown as AnalyserNode;
      }
      createMediaStreamSource() {
        return { connect: () => {}, disconnect: () => {} } as unknown as MediaStreamAudioSourceNode;
      }
      close() {}
    } as unknown as typeof AudioContext;

    class MockMediaRecorder {
      static isTypeSupported() { return true; }
      mimeType = "audio/webm";
      state: "inactive" | "recording" = "inactive";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
        setTimeout(() => {
          this.ondataavailable?.({ data: new Blob([], { type: "audio/webm" }) });
        }, 100);
      }
      stop() {
        this.state = "inactive";
        setTimeout(() => { this.onstop?.(); }, 50);
      }
    }

    window.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;

    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/speech/asr")) {
        return new Response(JSON.stringify({ text: "测试语音识别结果" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input, init);
    };
  });
}

async function waitForChatInput(page: Page) {
  await page.locator(".message-input-container").waitFor({ state: "visible", timeout: 15000 });
}

test.describe("语音快捷键 — Alt+Space 长按录音", () => {
  test.beforeEach(async ({ page }) => {
    await mockRecordingAPI(page);
    await page.goto(CHAT_URL);
    await waitForChatInput(page);
  });

  test("语音按钮上显示快捷键 badge", async ({ page }) => {
    const badge = page.locator(".shortcut-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText("⌥Space");
  });

  test("录音/识别中 badge 隐藏", async ({ page }) => {
    const voiceButton = page.getByRole("button", { name: /语音/ });
    await voiceButton.click();
    await expect(page.locator(".recording-panel")).toBeVisible({ timeout: 3000 });

    // 录音中 badge 不可见
    await expect(page.locator(".shortcut-badge")).not.toBeVisible();
  });

  test("Alt+Space 长按触发录音，松手停止", async ({ page }) => {
    await page.keyboard.down("Alt");
    await page.keyboard.down("Space");
    await page.waitForTimeout(500);

    await expect(page.locator(".recording-panel")).toBeVisible();
    await expect(page.locator(".recording-dot")).toBeVisible();

    await page.keyboard.up("Space");
    await page.keyboard.up("Alt");
    await page.waitForTimeout(500);

    await expect(page.locator(".recording-panel")).not.toBeVisible();
  });

  test("Alt+Space 在 textarea 聚焦时也能触发录音", async ({ page }) => {
    await page.locator(".main-textarea").click();

    await page.keyboard.down("Alt");
    await page.keyboard.down("Space");
    await page.waitForTimeout(500);

    await expect(page.locator(".recording-panel")).toBeVisible();

    await page.keyboard.up("Space");
    await page.keyboard.up("Alt");
  });

  test("短按 Alt+Space（< 200ms）视为误触并提示", async ({ page }) => {
    await page.keyboard.down("Alt");
    await page.keyboard.down("Space");
    await page.waitForTimeout(50);
    await page.keyboard.up("Space");
    await page.keyboard.up("Alt");

    await page.waitForTimeout(300);

    await expect(page.locator(".recording-panel")).not.toBeVisible();
    // 应出现误触提示
    await expect(page.locator("text=按住时间过短")).toBeVisible();
  });

  test("ESC 取消录音", async ({ page }) => {
    // 先开始录音（点击按钮）
    const voiceButton = page.getByRole("button", { name: /语音/ });
    await voiceButton.click();
    await expect(page.locator(".recording-panel")).toBeVisible({ timeout: 3000 });

    // ESC 取消
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    await expect(page.locator(".recording-panel")).not.toBeVisible();
  });

  test("单独 Space 不触发录音", async ({ page }) => {
    await page.locator("body").click();

    await page.keyboard.down("Space");
    await page.waitForTimeout(500);

    await expect(page.locator(".recording-panel")).not.toBeVisible();
    await page.keyboard.up("Space");
  });
});

test.describe("现有功能不受影响", () => {
  test.beforeEach(async ({ page }) => {
    await mockRecordingAPI(page);
    await page.goto(CHAT_URL);
    await waitForChatInput(page);
  });

  test("Enter 键仍然可以发送消息", async ({ page }) => {
    const textarea = page.locator(".main-textarea");
    await textarea.click();
    await textarea.fill("test message");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    await expect(textarea).toHaveValue("");
  });

  test("Shift+Enter 输入换行而非发送", async ({ page }) => {
    const textarea = page.locator(".main-textarea");
    await textarea.click();
    await textarea.fill("line1");
    await page.keyboard.press("Shift+Enter");
    const value = await textarea.inputValue();
    expect(value).toContain("\n");
  });

  test("语音按钮点击仍然可以触发录音", async ({ page }) => {
    const voiceButton = page.getByRole("button", { name: /语音/ });
    await voiceButton.click();
    await expect(page.locator(".recording-panel")).toBeVisible({ timeout: 3000 });
  });

  test("录音面板显示计时器和波形", async ({ page }) => {
    const voiceButton = page.getByRole("button", { name: /语音/ });
    await voiceButton.click();
    await expect(page.locator(".recording-panel")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".recording-timer")).toBeVisible();
    await expect(page.locator(".wave-bar").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /停止/ })).toBeVisible();
  });

  test("底部功能按钮可用", async ({ page }) => {
    await expect(page.getByRole("button", { name: /附件/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /联网/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /思考/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /朗读/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /语音/ })).toBeVisible();
  });

  test("textarea 聚焦时 Space 正常输入空格", async ({ page }) => {
    const textarea = page.locator(".main-textarea");
    await textarea.click();
    await page.keyboard.press("Space");
    await expect(textarea).toHaveValue(" ");
  });
});
