"""
安全中间件 - 输入验证、速率限制、安全头
"""

import re
import time
from collections import defaultdict
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.exceptions import RateLimitException, ValidationException


class SecurityMiddleware(BaseHTTPMiddleware):
    """安全中间件"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 添加安全头
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        return response


class RateLimiter:
    """速率限制器"""

    def __init__(
        self,
        window_ms: int = 60000,
        max_requests: int = 20,
    ):
        self.window_ms = window_ms
        self.max_requests = max_requests
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> bool:
        """检查是否超过限制"""
        now = time.time() * 1000
        window_start = now - self.window_ms

        # 清理过期记录
        self._requests[key] = [
            t for t in self._requests[key] if t > window_start
        ]

        if len(self._requests[key]) >= self.max_requests:
            return False

        self._requests[key].append(now)
        return True

    def get_remaining(self, key: str) -> int:
        """获取剩余请求数"""
        now = time.time() * 1000
        window_start = now - self.window_ms
        count = len([t for t in self._requests[key] if t > window_start])
        return max(0, self.max_requests - count)


# 速率限制器实例
chat_limiter = RateLimiter(window_ms=60000, max_requests=20)
agent_limiter = RateLimiter(window_ms=60000, max_requests=30)
memory_limiter = RateLimiter(window_ms=60000, max_requests=60)


class InputValidator:
    """输入验证器"""

    # Prompt 注入检测模式
    INJECTION_PATTERNS = [
        re.compile(r"ignore\s+(previous|all)\s+instructions?", re.IGNORECASE),
        re.compile(r"disregard\s+(all|previous)\s+(rules|instructions)", re.IGNORECASE),
        re.compile(r"you\s+are\s+now", re.IGNORECASE),
        re.compile(r"act\s+as", re.IGNORECASE),
        re.compile(r"pretend\s+(to\s+be|you\s+are)", re.IGNORECASE),
        re.compile(r"system:", re.IGNORECASE),
        re.compile(r"\[INST\]", re.IGNORECASE),
        re.compile(r"<<<", re.IGNORECASE),
    ]

    # 敏感信息检测模式
    SENSITIVE_PATTERNS = [
        (re.compile(r"\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}"), "credit_card"),
        (re.compile(r"1[3-9]\d{9}"), "phone"),
        (re.compile(r"\d{17}[\dXx]"), "id_card"),
    ]

    @classmethod
    def validate_message(cls, content: str) -> tuple[bool, str]:
        """
        验证消息内容

        Returns:
            (is_valid, error_message)
        """
        # 长度检查
        if not content or not content.strip():
            return False, "消息内容不能为空"

        if len(content) > 10000:
            return False, "消息内容过长（最大 10000 字符）"

        # 检测敏感信息
        for pattern, info_type in cls.SENSITIVE_PATTERNS:
            if pattern.search(content):
                return False, f"消息包含敏感信息（{info_type}），请勿分享"

        return True, ""

    @classmethod
    def detect_injection(cls, content: str) -> bool:
        """检测 Prompt 注入"""
        for pattern in cls.INJECTION_PATTERNS:
            if pattern.search(content):
                return True
        return False

    @classmethod
    def sanitize_input(cls, content: str) -> str:
        """清理输入内容"""
        # 移除控制字符
        content = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", content)
        return content.strip()


def validate_chat_input(content: str) -> None:
    """验证聊天输入"""
    is_valid, error = InputValidator.validate_message(content)
    if not is_valid:
        raise ValidationException(error)

    # 警告但不阻止（可以记录日志）
    if InputValidator.detect_injection(content):
        # 可以选择记录日志或返回警告
        pass


def check_rate_limit(limiter: RateLimiter, key: str) -> None:
    """检查速率限制"""
    if not limiter.check(key):
        raise RateLimitException("请求过于频繁，请稍后再试")
