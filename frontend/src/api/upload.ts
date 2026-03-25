import { API_BASE_URL } from "./request";

export interface UploadResponse {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  url: string;
}

/**
 * 上传文件
 */
export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message ||
        errorData.message ||
        `HTTP ${response.status}`,
    );
  }

  return response.json();
}

/**
 * 删除文件
 */
export async function deleteFile(fileId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/upload/${fileId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message ||
        errorData.message ||
        `HTTP ${response.status}`,
    );
  }
}
