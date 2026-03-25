import { ref } from "vue";
import { uploadFile } from "@/api/upload";
import type { Attachment } from "@/types";

export interface UploadResult {
  id: string;
  filename: string;
  type: "image" | "document";
  url: string;
}

export interface FileUploadOptions {
  maxFiles?: number;
  allowedTypes?: string[];
}

/**
 * 文件上传 composable
 */
export function useFileUpload(options: FileUploadOptions = {}) {
  const { maxFiles = 5 } = options;

  const isUploading = ref(false);
  const uploadProgress = ref(0);
  const error = ref<string | null>(null);
  const attachments = ref<Attachment[]>([]);

  /**
   * 判断文件类型
   */
  function getFileType(mimeType: string): "image" | "document" {
    if (mimeType.startsWith("image/")) {
      return "image";
    }
    return "document";
  }

  /**
   * 上传单个文件
   */
  async function upload(file: File): Promise<UploadResult | null> {
    if (attachments.value.length >= maxFiles) {
      error.value = `最多上传 ${maxFiles} 个附件`;
      return null;
    }

    isUploading.value = true;
    error.value = null;

    try {
      const response = await uploadFile(file);

      const result: UploadResult = {
        id: response.id,
        filename: response.filename,
        type: getFileType(file.type),
        url: response.url,
      };

      attachments.value.push({
        id: result.id,
        filename: result.filename,
        type: result.type,
        url: result.url,
        size: file.size,
      });

      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "上传失败";
      return null;
    } finally {
      isUploading.value = false;
      uploadProgress.value = 0;
    }
  }

  /**
   * 批量上传文件
   */
  async function uploadMultiple(files: FileList | File[]): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const file of Array.from(files)) {
      if (attachments.value.length >= maxFiles) {
        error.value = `最多上传 ${maxFiles} 个附件`;
        break;
      }

      const result = await upload(file);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * 移除附件
   */
  function remove(id: string) {
    const index = attachments.value.findIndex((a) => a.id === id);
    if (index !== -1) {
      attachments.value.splice(index, 1);
    }
  }

  /**
   * 清空所有附件
   */
  function clear() {
    attachments.value = [];
    error.value = null;
  }

  /**
   * 获取附件 ID 列表
   */
  function getAttachmentIds(): string[] {
    return attachments.value.map((a) => a.id);
  }

  return {
    isUploading,
    uploadProgress,
    error,
    attachments,
    upload,
    uploadMultiple,
    remove,
    clear,
    getAttachmentIds,
  };
}
