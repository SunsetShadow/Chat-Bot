import { ref } from "vue";
import { recognizeSpeech } from "@/api/speech";

export type TtsStatus = "idle" | "connecting" | "ready" | "speaking" | "error";

export function useVoice() {
  // Callback
  let onRecognized: ((text: string) => void) | null = null;

  // ASR state
  const isRecording = ref(false);
  const isRecognizing = ref(false);
  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;

  // TTS state
  const ttsStatus = ref<TtsStatus>("idle");
  const ttsSessionId = ref<string | null>(null);
  let ttsWs: WebSocket | null = null;
  let audioEl: HTMLAudioElement | null = null;
  let ttsMediaSource: MediaSource | null = null;
  let ttsSourceBuffer: SourceBuffer | null = null;
  let ttsPendingBuffers: ArrayBuffer[] = [];
  let ttsStreamFinal = false;

  // --- ASR ---

  async function startRecording(): Promise<void> {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const preferredMimeType = "audio/ogg; codecs=opus";
      const mimeType = MediaRecorder.isTypeSupported(preferredMimeType)
        ? preferredMimeType
        : MediaRecorder.isTypeSupported("audio/webm; codecs=opus")
          ? "audio/webm; codecs=opus"
          : "";

      mediaRecorder = mimeType
        ? new MediaRecorder(mediaStream, { mimeType })
        : new MediaRecorder(mediaStream);

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        cleanupStream();
        const blob = new Blob(chunks, {
          type: mediaRecorder?.mimeType || "audio/webm",
        });
        isRecording.value = false;
        isRecognizing.value = true;
        try {
          const text = await recognizeSpeech(blob);
          onRecognized?.(text);
        } catch (err) {
          console.error("ASR recognition failed:", err);
          onRecognized?.("");
        } finally {
          isRecognizing.value = false;
        }
      };

      mediaRecorder.start(250);
      isRecording.value = true;
    } catch (err) {
      console.error("Failed to start recording:", err);
      cleanupStream();
    }
  }

  function stopRecording(): void {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }

  function cleanupStream(): void {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
  }

  // --- TTS ---

  async function connectTts(): Promise<string | null> {
    if (ttsWs && ttsWs.readyState === WebSocket.OPEN) {
      return ttsSessionId.value;
    }

    ttsStatus.value = "connecting";

    try {
      const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${location.host}/api/v1/speech/tts/ws`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("TTS connection timeout"));
        }, 10000);

        ws.onmessage = (event) => {
          if (typeof event.data === "string") {
            try {
              const msg = JSON.parse(event.data) as Record<string, unknown>;
              if (msg.type === "session") {
                ttsSessionId.value = msg.sessionId as string;
                resolve();
              } else {
                handleTtsControlMessage(msg);
              }
            } catch {
              /* ignore parse errors */
            }
          } else if (event.data instanceof ArrayBuffer) {
            ttsPendingBuffers.push(event.data);
            flushTtsBufferQueue();
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          ttsStatus.value = "error";
          reject(new Error("TTS WebSocket connection failed"));
        };

        ws.onclose = () => {
          if (ttsStatus.value !== "error") {
            ttsStatus.value = "idle";
          }
          ttsWs = null;
        };
      });

      ttsWs = ws;
      ttsStatus.value = "ready";
      return ttsSessionId.value;
    } catch (err) {
      console.error("TTS connection failed:", err);
      ttsStatus.value = "error";
      return null;
    }
  }

  function disconnectTts(): void {
    if (ttsWs) {
      ttsWs.close();
      ttsWs = null;
    }
    ttsSessionId.value = null;
    ttsStatus.value = "idle";
    cleanupAudioPlayback();
  }

  // --- Audio Playback ---

  function handleTtsControlMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case "tts_started":
        prepareStreamingAudio();
        ttsStatus.value = "speaking";
        break;
      case "tts_final":
        ttsStreamFinal = true;
        flushTtsBufferQueue();
        break;
      case "tts_error":
        ttsStatus.value = "error";
        console.error("TTS error:", msg.message);
        break;
      case "tts_closed":
        cleanupAudioPlayback();
        ttsStatus.value = "idle";
        break;
    }
  }

  function prepareStreamingAudio(): void {
    cleanupAudioPlayback();
    ttsPendingBuffers = [];
    ttsStreamFinal = false;

    audioEl = new Audio();
    ttsMediaSource = new MediaSource();
    audioEl.src = URL.createObjectURL(ttsMediaSource);

    ttsMediaSource.addEventListener("sourceopen", () => {
      if (!ttsMediaSource) return;
      ttsSourceBuffer = ttsMediaSource.addSourceBuffer("audio/mpeg");
      ttsSourceBuffer.mode = "sequence";
      ttsSourceBuffer.addEventListener("updateend", flushTtsBufferQueue);
    });
  }

  function flushTtsBufferQueue(): void {
    if (!ttsSourceBuffer || ttsSourceBuffer.updating) return;

    if (ttsPendingBuffers.length > 0) {
      const next = ttsPendingBuffers.shift()!;
      try {
        ttsSourceBuffer.appendBuffer(next);
        audioEl?.play().catch(() => {});
      } catch {
        ttsPendingBuffers.unshift(next);
      }
      return;
    }

    if (
      ttsStreamFinal &&
      ttsMediaSource &&
      ttsMediaSource.readyState === "open"
    ) {
      try {
        ttsMediaSource.endOfStream();
      } catch {
        /* already ended */
      }
      ttsStatus.value = "ready";
    }
  }

  function cleanupAudioPlayback(): void {
    if (audioEl) {
      audioEl.pause();
      audioEl.src = "";
      audioEl = null;
    }
    ttsMediaSource = null;
    ttsSourceBuffer = null;
    ttsPendingBuffers = [];
    ttsStreamFinal = false;
  }

  // --- Lifecycle ---

  function dispose(): void {
    stopRecording();
    cleanupStream();
    disconnectTts();
  }

  return {
    isRecording,
    isRecognizing,
    startRecording,
    stopRecording,
    ttsStatus,
    ttsSessionId,
    connectTts,
    disconnectTts,
    dispose,
    setOnRecognized(cb: (text: string) => void) {
      onRecognized = cb;
    },
  };
}
