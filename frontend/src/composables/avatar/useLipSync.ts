import { ref, onUnmounted } from "vue";

/** Phase 1: 音量驱动口型同步（优化版） */
export function useLipSync() {
  const mouthOpenY = ref(0);
  const isEnabled = ref(true);

  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let rafId = 0;
  let levelData: Uint8Array | null = null;

  let smoothedValue = 0;
  const SMOOTH_UP = 0.4;
  const SMOOTH_DOWN = 0.15;
  const NOISE_GATE = 0.05;
  const SCALE_FACTOR = 3.0;
  const JITTER_AMOUNT = 0.02;

  function connectAudioElement(audioEl: HTMLAudioElement): void {
    disconnect();
    try {
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(audioEl);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      startLoop();
    } catch {
      // createMediaElementSource can only be called once
    }
  }

  function startLoop(): void {
    if (!analyser) return;
    if (!levelData || levelData.length !== analyser.frequencyBinCount) {
      levelData = new Uint8Array(analyser.frequencyBinCount);
    }
    update();
  }

  function update(): void {
    if (!analyser || !levelData) return;
    analyser.getByteFrequencyData(levelData);

    let sum = 0;
    for (let i = 0; i < levelData.length; i++) sum += levelData[i];
    const raw = (sum / levelData.length / 255) * SCALE_FACTOR;

    const gated = raw < NOISE_GATE ? 0 : raw;

    const alpha = gated > smoothedValue ? SMOOTH_UP : SMOOTH_DOWN;
    smoothedValue += (gated - smoothedValue) * alpha;

    const jitter =
      smoothedValue > NOISE_GATE ? (Math.random() - 0.5) * JITTER_AMOUNT : 0;

    mouthOpenY.value = isEnabled.value
      ? Math.max(0, Math.min(1, smoothedValue + jitter))
      : 0;

    rafId = requestAnimationFrame(update);
  }

  function disconnect(): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    analyser = null;
    levelData = null;
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    smoothedValue = 0;
    mouthOpenY.value = 0;
  }

  function setEnabled(v: boolean): void {
    isEnabled.value = v;
    if (!v) mouthOpenY.value = 0;
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    mouthOpenY,
    isEnabled,
    connectAudioElement,
    disconnect,
    setEnabled,
  };
}
