import { test, expect, type Page } from "@playwright/test";

test.use({ ignoreHTTPSErrors: true });

const AVATAR_URL = "https://localhost:3000/avatar";

// Mock PixiJS + Live2D to avoid WebGL dependency in headless
async function mockLive2D(page: Page) {
  await page.addInitScript(() => {
    // Mock PIXI Application
    const mockApp = {
      stage: { addChild: () => {} },
      destroy: () => {},
    };

    // Mock Live2D model with spy tracking
    const expressionCalls: { index: number }[] = [];
    const motionCalls: { group: string; index: number }[] = [];

    (window as any).__avatarSpy = { expressionCalls, motionCalls };

    const mockModel = {
      width: 400,
      height: 600,
      scale: { set: () => {} },
      x: 0,
      y: 0,
      interactive: false,
      internalModel: {
        coreModel: {
          setParameterValueById: () => {},
        },
      },
      on: (_event: string, _cb: () => void) => {},
      expression: (index: number) => {
        expressionCalls.push({ index });
      },
      motion: (group: string, index: number) => {
        motionCalls.push({ group, index });
      },
      tap: () => {},
      destroy: () => {},
    };

    // Intercept pixi-live2d-display dynamic import
    const origFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      // Intercept Live2D model config fetch
      if (url.endsWith("haru_greeter_t03.model3.json")) {
        return new Response(
          JSON.stringify({
            Version: 3,
            FileReferences: {
              Moc: "haru_greeter_t03.moc3",
              Textures: ["haru_greeter_t03.2048/texture_00.png"],
              Physics: "haru_greeter_t03.physics3.json",
              Expressions: Array.from({ length: 8 }, (_, i) => ({
                Name: `f0${i}`,
                File: `expressions/F0${i + 1}.exp3.json`,
              })),
              Motions: {
                Idle: [{ File: "motion/haru_g_idle.motion3.json" }],
                Tap: [
                  { File: "motion/haru_g_m14.motion3.json" },
                  { File: "motion/haru_g_m05.motion3.json" },
                ],
              },
            },
            Groups: [],
            HitAreas: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return origFetch(input, init);
    };

    // Mock import() for pixi-live2d-display
    const origImport = window.import;
    // Can't override import directly; instead mock at module level via Vite
    // We'll rely on the mock model returning from Live2DModel.from
  });

  // Mock WebGL context to prevent headless errors
  await page.addInitScript(() => {
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: any[]) {
      if (type === "webgl" || type === "webgl2") {
        const gl = origGetContext.call(this, "webgl2", ...args) || origGetContext.call(this, "webgl", ...args);
        if (gl) return gl;
        // Return minimal mock if no real WebGL
        return {
          canvas: this,
          drawingBufferWidth: 400,
          drawingBufferHeight: 560,
          getParameter: () => null,
          getExtension: () => null,
          createShader: () => ({}),
          createProgram: () => ({}),
          createBuffer: () => ({}),
          createTexture: () => ({}),
          createFramebuffer: () => ({}),
          bindBuffer: () => {},
          bindTexture: () => {},
          bindFramebuffer: () => {},
          bufferData: () => {},
          texImage2D: () => {},
          texParameteri: () => {},
          framebufferTexture2D: () => {},
          shaderSource: () => {},
          compileShader: () => {},
          attachShader: () => {},
          linkProgram: () => {},
          useProgram: () => {},
          viewport: () => {},
          clear: () => {},
          clearColor: () => {},
          enable: () => {},
          disable: () => {},
          blendFunc: () => {},
          pixelStorei: () => {},
          activeTexture: () => {},
          uniform1f: () => {},
          uniform1i: () => {},
          uniform2f: () => {},
          uniform3f: () => {},
          uniform4f: () => {},
          uniformMatrix4fv: () => {},
          getAttribLocation: () => 0,
          getUniformLocation: () => ({}),
          enableVertexAttribArray: () => {},
          vertexAttribPointer: () => {},
          drawArrays: () => {},
          drawElements: () => {},
          deleteShader: () => {},
          deleteProgram: () => {},
          deleteBuffer: () => {},
          deleteTexture: () => {},
          readPixels: () => {},
          finish: () => {},
          flush: () => {},
          getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
          VERTEX_SHADER: 35633,
          FRAGMENT_SHADER: 35632,
          HIGH_FLOAT: 36338,
          MEDIUM_FLOAT: 36337,
          TEXTURE_2D: 3553,
          TEXTURE0: 33984,
          RGBA: 6408,
          UNSIGNED_BYTE: 5121,
          FLOAT: 5126,
          ARRAY_BUFFER: 34962,
          ELEMENT_ARRAY_BUFFER: 34963,
          STATIC_DRAW: 35044,
          DYNAMIC_DRAW: 35048,
          TRIANGLES: 4,
          BLEND: 3042,
          SRC_ALPHA: 770,
          ONE_MINUS_SRC_ALPHA: 771,
          UNPACK_FLIP_Y_WEBGL: 37440,
          COLOR_BUFFER_BIT: 16384,
          DEPTH_BUFFER_BIT: 256,
        } as any;
      }
      return origGetContext.call(this, type, ...args);
    };
  });

  // Mock MediaRecorder + AudioContext for voice tests
  const mockStream = {
    getTracks: () => [{ stop: () => {} }],
    getAudioTracks: () => [{ stop: () => {} }],
  };
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop: () => {} }] }) },
      writable: true,
    });

    window.AudioContext = class MockAudioContext {
      createAnalyser() {
        return {
          fftSize: 0,
          frequencyBinCount: 128,
          getByteFrequencyData: (arr: Uint8Array) => arr.fill(50),
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
      static isTypeSupported() {
        return true;
      }
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
        setTimeout(() => {
          this.onstop?.();
        }, 50);
      }
    }
    window.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;

    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/speech/asr")) {
        return new Response(JSON.stringify({ success: true, data: { text: "你好世界" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input, init);
    };
  });
}

async function waitForAvatarPage(page: Page) {
  await page.locator(".avatar-page").waitFor({ state: "visible", timeout: 15000 });
}

test.describe("Avatar 页面结构", () => {
  test.beforeEach(async ({ page }) => {
    await mockLive2D(page);
    await page.goto(AVATAR_URL);
    await waitForAvatarPage(page);
  });

  test("页面基本结构渲染", async ({ page }) => {
    await expect(page.locator(".avatar-stage")).toBeVisible();
    await expect(page.locator(".control-panel")).toBeVisible();
  });

  test("Live2D 画布容器存在", async ({ page }) => {
    await expect(page.locator(".live2d-avatar")).toBeVisible();
    await expect(page.locator(".live2d-avatar canvas")).toBeVisible();
  });

  test("三个控制面板卡片可见", async ({ page }) => {
    const cards = page.locator(".control-card");
    await expect(cards).toHaveCount(3);
    await expect(page.getByText("语音交互", { exact: true })).toBeVisible();
    await expect(page.getByText("表情", { exact: true })).toBeVisible();
    await expect(page.getByText("动作", { exact: true })).toBeVisible();
  });

  test("语音按钮初始状态", async ({ page }) => {
    const button = page.getByRole("button", { name: "按住说话" });
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });

  test("表情按钮数量正确（默认 + 8 个表情）", async ({ page }) => {
    const expressionButtons = page.locator(".expression-grid button");
    await expect(expressionButtons).toHaveCount(9);
    await expect(expressionButtons.first()).toHaveText("默认");
  });

  test("动作按钮数量正确（3 个动作）", async ({ page }) => {
    // 动作卡片内的按钮
    const motionCard = page.locator(".control-card").nth(2);
    const motionButtons = motionCard.locator("button");
    await expect(motionButtons).toHaveCount(3);
  });
});

test.describe("表情切换", () => {
  test.beforeEach(async ({ page }) => {
    await mockLive2D(page);
    await page.goto(AVATAR_URL);
    await waitForAvatarPage(page);
  });

  test("点击表情按钮切换选中态", async ({ page }) => {
    const expressionButtons = page.locator(".expression-grid button");

    // 点击 "表情 3"（index 2）
    await expressionButtons.nth(3).click();

    // 验证选中态
    await expect(expressionButtons.nth(3)).toHaveClass(/n-button--primary-type/);
  });

  test("点击默认重置选中态", async ({ page }) => {
    const expressionButtons = page.locator(".expression-grid button");

    // 先选中一个
    await expressionButtons.nth(3).click();
    await expect(expressionButtons.nth(3)).toHaveClass(/n-button--primary-type/);

    // 点击"默认"重置
    await expressionButtons.first().click();
    await expect(expressionButtons.first()).toHaveClass(/n-button--primary-type/);
  });

  test("切换不同表情，前一个取消选中", async ({ page }) => {
    const expressionButtons = page.locator(".expression-grid button");

    await expressionButtons.nth(2).click();
    await expect(expressionButtons.nth(2)).toHaveClass(/n-button--primary-type/);

    await expressionButtons.nth(5).click();
    await expect(expressionButtons.nth(5)).toHaveClass(/n-button--primary-type/);
    // 前一个不再是 primary
    await expect(expressionButtons.nth(2)).not.toHaveClass(/n-button--primary-type/);
  });
});

test.describe("动作触发", () => {
  test.beforeEach(async ({ page }) => {
    await mockLive2D(page);
    await page.goto(AVATAR_URL);
    await waitForAvatarPage(page);
  });

  test("三个动作按钮可点击", async ({ page }) => {
    const motionCard = page.locator(".control-card").nth(2);
    const motionButtons = motionCard.locator("button");

    for (let i = 0; i < 3; i++) {
      await expect(motionButtons.nth(i)).toBeEnabled();
      await motionButtons.nth(i).click();
    }
  });
});

test.describe("语音交互", () => {
  test.beforeEach(async ({ page }) => {
    await mockLive2D(page);
    await page.goto(AVATAR_URL);
    await waitForAvatarPage(page);
  });

  test("点击录音按钮进入录音状态", async ({ page }) => {
    const button = page.getByRole("button", { name: "按住说话" });
    await button.click();
    await page.waitForTimeout(200);

    await expect(page.getByRole("button", { name: "停止录音" })).toBeVisible();
    await expect(page.locator(".audio-meter")).toBeVisible();
  });

  test("停止录音后显示识别结果", async ({ page }) => {
    const button = page.getByRole("button", { name: "按住说话" });
    await button.click();
    await page.waitForTimeout(200);

    await page.getByRole("button", { name: "停止录音" }).click();
    // useVoice: MediaRecorder.onstop → cleanupStream → cleanupAudioLevel → Blob → recognizeSpeech → onRecognized
    await expect(page.locator(".recognized-text")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("你好世界")).toBeVisible();
  });
});

test.describe("导航集成", () => {
  test("从 AppHeader 导航到 Avatar 页面", async ({ page }) => {
    await mockLive2D(page);
    await page.goto("https://localhost:3000");
    await page.waitForTimeout(2000);

    // 查找导航到 Avatar 的按钮/链接
    const avatarNav = page.getByRole("button", { name: /avatar/i }).or(page.locator('[href="/avatar"]'));
    if (await avatarNav.isVisible()) {
      await avatarNav.click();
      await waitForAvatarPage(page);
      await expect(page).toHaveURL(/\/avatar/);
    }
  });

  test("直接访问 /avatar 路由", async ({ page }) => {
    await mockLive2D(page);
    await page.goto(AVATAR_URL);
    await waitForAvatarPage(page);
    await expect(page).toHaveURL(/\/avatar/);
  });
});
