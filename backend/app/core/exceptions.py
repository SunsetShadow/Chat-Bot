from fastapi import HTTPException, status


class AppException(Exception):
    """应用基础异常"""

    def __init__(self, message: str, code: str = "UNKNOWN_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class LLMException(AppException):
    """LLM 服务异常"""

    def __init__(self, message: str, code: str = "LLM_ERROR"):
        super().__init__(message, code)


class SessionNotFoundException(AppException):
    """会话不存在异常"""

    def __init__(self, session_id: str):
        super().__init__(f"Session {session_id} not found", "SESSION_NOT_FOUND")


class ValidationException(AppException):
    """验证异常"""

    def __init__(self, message: str):
        super().__init__(message, "VALIDATION_ERROR")


class RateLimitException(AppException):
    """速率限制异常"""

    def __init__(self, message: str = "请求过于频繁，请稍后再试"):
        super().__init__(message, "RATE_LIMIT_EXCEEDED")


def raise_not_found(resource: str, resource_id: str):
    """抛出 404 异常"""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"message": f"{resource} with id {resource_id} not found", "code": "NOT_FOUND"},
    )


def raise_bad_request(message: str, code: str = "BAD_REQUEST"):
    """抛出 400 异常"""
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"message": message, "code": code},
    )


def raise_internal_error(message: str = "Internal server error"):
    """抛出 500 异常"""
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={"message": message, "code": "INTERNAL_ERROR"},
    )
