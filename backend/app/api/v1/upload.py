"""文件上传 API 端点"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

from app.services.upload_service import get_upload_service

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("")
async def upload_file(file: UploadFile = File(...)):
    """
    上传单个文件

    支持的文件类型：
    - 图片: PNG, JPG, JPEG, GIF, WebP
    - 文档: PDF, TXT, MD

    最大文件大小: 10MB
    """
    upload_service = get_upload_service()
    result = await upload_service.upload_file(file)
    return result


@router.get("/{file_id}")
async def get_file(file_id: str):
    """获取上传的文件"""
    upload_service = get_upload_service()
    file_path = upload_service.get_file_path(file_id)

    if not file_path:
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type="application/octet-stream"
    )


@router.delete("/{file_id}")
async def delete_file(file_id: str):
    """删除上传的文件"""
    upload_service = get_upload_service()
    success = upload_service.delete_file(file_id)

    if not success:
        raise HTTPException(status_code=404, detail="文件不存在")

    return {"success": True, "message": "文件已删除"}
