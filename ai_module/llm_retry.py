"""Retry helpers for Vertex/Gemini rate limits and transient failures."""

from __future__ import annotations

import logging
import os
import random
import time
from typing import Callable, TypeVar

logger = logging.getLogger("ai_module.retry")

T = TypeVar("T")

# Markers that indicate a token / rate-limit / quota error (429-class)
CONTEXT_LIMIT_MARKERS = (
    "resource exhausted",
    "resource_exhausted",
    "quota exceeded",
    "quota",
    "rate limit",
    "rate_limit",
    "429",
    "too many requests",
    "context window",
    "context_length_exceeded",
    "context length",
    "max_tokens",
    "token limit",
    "input too long",
    "exceeds the limit",
    "request too large",
    "payload too large",
    "exhausted",
    "capacity",
    "overloaded",
)

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


def is_context_limit_error(exc: BaseException) -> bool:
    """Return True specifically for 429 / context-window / quota errors.

    These errors benefit from history compaction before a retry, rather
    than just a sleep-and-retry.
    """
    message = str(exc).lower()
    if any(marker in message for marker in CONTEXT_LIMIT_MARKERS):
        return True
    name = type(exc).__name__.lower()
    if any(fragment in name for fragment in ("resourceexhausted", "toomanyrequests", "contextlength")):
        return True
    cause = getattr(exc, "__cause__", None)
    if cause is not None and cause is not exc:
        return is_context_limit_error(cause)
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
    """Call *fn* with exponential-backoff retries on transient LLM errors.

    Parameters
    ----------
    fn:
        Zero-argument callable to invoke (typically ``llm.invoke(history)``).
    label:
        Human-readable label for log messages.
    on_retry:
        Called before each sleep: ``(attempt, max_attempts, wait_secs, exc)``.
    on_context_error:
        Called when a **429 / context-limit** error is detected, *before* the
        sleep.  Signature: ``(attempt, exc) -> compacted: bool``.  If it
        returns True the history was compacted and the retry should succeed
        with a smaller payload.  The sleep is still applied afterwards.
    """
    max_attempts, base_delay, max_delay = retry_settings()
    last_exc: BaseException | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except Exception as exc:
            last_exc = exc
            if attempt >= max_attempts or not is_retryable_error(exc):
                raise

            # ── 429 / context-limit → compact history first ───────────────
            if is_context_limit_error(exc) and on_context_error is not None:
                try:
                    compacted = on_context_error(attempt, exc)
                    if compacted:
                        logger.info(
                            "[%s] context compacted before retry attempt %s/%s",
                            label, attempt + 1, max_attempts,
                        )
                except Exception as cb_exc:
                    logger.warning("[%s] on_context_error callback raised: %s", label, cb_exc)

            wait = min(max_delay, base_delay * (2 ** (attempt - 1)))
            wait += random.uniform(0, min(1.0, wait * 0.25))
            logger.warning(
                "[%s] retryable error attempt %s/%s: %s — sleeping %.1fs",
                label,
                attempt,
                max_attempts,
                exc,
                wait,
            )
            if on_retry is not None:
                on_retry(attempt, max_attempts, wait, exc)
            time.sleep(wait)

    if last_exc is not None:
        raise last_exc
    raise RuntimeError(f"{label} retry failed without exception")
