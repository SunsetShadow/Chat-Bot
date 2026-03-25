"""文件上传服务"""

import os
import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException

from app.core.config import settings


class UploadService:
    """文件上传服务"""

    def __init__(self):
        self.upload_dir = Path(settings.upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

        # 合并所有允许的文件类型
        self.allowed_types = settings.allowed_image_types + settings.allowed_doc_types

    def _validate_file_type(self, content_type: str) -> str:
        """验证文件类型，返回文件类别"""
        if content_type in settings.allowed_image_types:
            return "image"
        elif content_type in settings.allowed_doc_types:
            return "document"
        else:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型: {content_type}"
            )

    def _validate_file_size(self, size: int) -> None:
        """验证文件大小"""
        if size > settings.max_file_size:
            max_mb = settings.max_file_size / (1024 * 1024)
            raise HTTPException(
                status_code=400,
                detail=f"文件大小超过限制（最大 {max_mb:.0f}MB）"
            )

    def _generate_file_id(self) -> str:
        """生成唯一文件 ID"""
        return f"att_{uuid.uuid4().hex[:12]}"

    async def upload_file(self, file: UploadFile) -> dict:
        """
        上传单个文件

        Returns:
            包含文件信息的字典
        """
        # 验证文件类型
        file_type = self._validate_file_type(file.content_type or "")

        # 读取文件内容
        content = await file.read()
        file_size = len(content)

        # 验证文件大小
        self._validate_file_size(file_size)

        # 生成文件 ID 和保存路径
        file_id = self._generate_file_id()
        file_ext = Path(file.filename or "unknown").suffix
        saved_filename = f"{file_id}{file_ext}"
        file_path = self.upload_dir / saved_filename

        # 保存文件
        with open(file_path, "wb") as f:
            f.write(content)

        return {
            "id": file_id,
            "filename": file.filename,
            "type": file_type,
            "url": f"/api/v1/upload/{file_id}",
            "size": file_size,
            "content_type": file.content_type,
        }

    def get_file_path(self, file_id: str) -> Path | None:
        """获取文件路径"""
        # 查找匹配的文件
        for file_path in self.upload_dir.iterdir():
            if file_path.stem == file_id:
                return file_path
        return None

    def delete_file(self, file_id: str) -> bool:
        """删除文件"""
        file_path = self.get_file_path(file_id)
        if file_path and file_path.exists():
            file_path.unlink()
            return True
        return False


# 全局实例
upload_service = UploadService()


def get_upload_service() -> UploadService:
    """获取上传服务实例"""
    return upload_service
