from typing import AsyncIterator

from fastapi.responses import StreamingResponse


class SSEStreamingResponse(StreamingResponse):
    """
    SSE 流式响应类

    自动设置正确的媒体类型和 SSE 相关响应头
    """

    media_type = "text/event-stream"

    def __init__(self, content: AsyncIterator[str], **kwargs):
        """
        初始化 SSE 响应

        Args:
            content: SSE 事件字符串的异步迭代器
            **kwargs: 传递给 StreamingResponse 的其他参数
        """
        headers = kwargs.pop("headers", {}) or {}
        headers.update(
            {
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
            }
        )
        super().__init__(
            content=content,
            media_type=self.media_type,
            headers=headers,
            **kwargs,
        )


def sse_format(event: str, data: str) -> str:
    """
    格式化 SSE 事件

    Args:
        event: 事件类型
        data: 事件数据

    Returns:
        SSE 格式的字符串
    """
    return f"event: {event}\ndata: {data}\n\n"


def sse_comment(comment: str) -> str:
    """
    创建 SSE 注释（用于保持连接）

    Args:
        comment: 注释内容

    Returns:
        SSE 注释字符串
    """
    return f": {comment}\n\n"
