import { API_BASE_URL } from "./request";

/**
 * ASR 语音识别：上传音频文件，返回识别文本
 */
export async function recognizeSpeech(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "record.ogg");

  const response = await fetch(`${API_BASE_URL}/api/v1/speech/asr`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as Record<string, string>).message ||
        `HTTP ${response.status}`,
    );
  }

  const result = (await response.json()) as {
    success: boolean;
    data: { text: string };
  };
  return result.data?.text || "";
}
