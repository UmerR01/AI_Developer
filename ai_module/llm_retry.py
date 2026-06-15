"""Retry helpers for Vertex/Gemini rate limits and transient failures."""

from __future__ import annotations

import logging
import os
import random
import time
from typing import Callable, TypeVar

logger = logging.getLogger("ai_module.retry")

T = TypeVar("T")

RETRYABLE_MARKERS = (
    "resource exhausted",
    "resource_exhausted",
    "quota exceeded",
    "quota",
    "rate limit",
    "rate_limit",
    "429",
    "too many requests",
    "503",
    "502",
    "504",
    "deadline exceeded",
    "timeout",
    "temporarily unavailable",
    "unavailable",
    "overloaded",
    "capacity",
    "exhausted",
)

RETRYABLE_EXCEPTION_NAMES = (
    "resourceexhausted",
    "toomanyrequests",
    "serviceunavailable",
    "internalservererror",
    "deadlineexceeded",
    "aborted",
)

CONTEXT_LIMIT_MARKERS = (
    "context window",
    "context_window",
    "context length",
    "context_length",
    "token limit",
    "token_limit",
    "maximum context",
    "input too long",
    "prompt too long",
    "exceeds the maximum",
    "400",
    "invalidargument",
    "input_tokens_limit",
    "tokens limit",
)


def is_context_limit_error(exc: BaseException) -> bool:
    """Return True if *exc* looks like a context/token-window limit error."""
    message = str(exc).lower()
    if any(marker in message for marker in CONTEXT_LIMIT_MARKERS):
        return True
    cause = getattr(exc, "__cause__", None)
    if cause is not None and cause is not exc:
        return is_context_limit_error(cause)
    return False


def is_retryable_error(exc: BaseException) -> bool:
    message = str(exc).lower()
    if any(marker in message for marker in RETRYABLE_MARKERS):
        return True
    name = type(exc).__name__.lower()
    if any(fragment in name for fragment in RETRYABLE_EXCEPTION_NAMES):
        return True
    cause = getattr(exc, "__cause__", None)
    if cause is not None and cause is not exc:
        return is_retryable_error(cause)
    return False


def retry_settings() -> tuple[int, float, float]:
    attempts = max(1, int(os.getenv("AI_LLM_RETRY_ATTEMPTS", "4")))
    base_delay = max(0.5, float(os.getenv("AI_LLM_RETRY_BASE_SECONDS", "2")))
    max_delay = max(base_delay, float(os.getenv("AI_LLM_RETRY_MAX_SECONDS", "30")))
    return attempts, base_delay, max_delay


def invoke_with_retry(
    fn: Callable[[], T],
    *,
    label: str = "llm",
    on_retry: Callable[[int, int, float, BaseException], None] | None = None,
    on_context_error: Callable[[int, BaseException], bool] | None = None,
) -> T:
    """
    Retry *fn* on transient/rate-limit errors indefinitely until success.

    Parameters
    ----------
    on_retry:
        Called before each retry sleep with (attempt, max_attempts, wait_seconds, exc).
    on_context_error:
        Called when a context-limit error is detected with (attempt, exc).
        Should return True if compaction was performed (triggers an immediate
        retry without sleeping), or False to fall through to normal retry logic.
    """
    _, base_delay, max_delay = retry_settings()
    last_exc: BaseException | None = None
    attempt = 0

    while True:
        attempt += 1
        try:
            return fn()
        except Exception as exc:
            last_exc = exc
            # Context-limit errors: try compacting history, then retry immediately
            if on_context_error is not None and is_context_limit_error(exc):
                compacted = on_context_error(attempt, exc)
                if compacted:
                    logger.warning(
                        "[%s] context-limit error attempt %s — history compacted, retrying now: %s",
                        label, attempt, exc,
                    )
                    continue  # retry immediately, no sleep
            if not is_retryable_error(exc):
                raise
            wait = min(max_delay, base_delay * (2 ** (attempt - 1)))
            wait += random.uniform(0, min(1.0, wait * 0.25))
            logger.warning(
                "[%s] retryable error attempt %s: %s — sleeping %.1fs",
                label,
                attempt,
                exc,
                wait,
            )
            if on_retry is not None:
                on_retry(attempt, 999999, wait, exc)
            time.sleep(wait)
