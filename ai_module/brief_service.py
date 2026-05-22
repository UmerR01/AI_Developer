"""Text-only project brief review for the AI Developer onboarding flow."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

logger = logging.getLogger("ai_module.brief")

try:
    from .brief_policy import finalize_local_review, has_stack_mentioned
    from .llm_retry import invoke_with_retry
    from .text_llm import credentials_available, get_text_llm
except ImportError:  # running with ai_module on sys.path
    from brief_policy import finalize_local_review, has_stack_mentioned
    from llm_retry import invoke_with_retry
    from text_llm import credentials_available, get_text_llm

BRIEF_SYSTEM = """You are a senior product engineer reviewing a project brief before AI-assisted local development.

Context:
- Projects run locally on the developer machine (no production deployment setup required).
- GitHub/repository URL may be provided for reference only — never ask about Git access, tokens, or syncing.
- Do NOT ask about deployment, hosting, CI/CD, cloud providers, or infrastructure.

Tasks:
1. Check if there is enough detail to start coding locally (scope + tech stack).
2. Ask at most ONE question, only if tech stack is genuinely missing from the description and answers.
3. Otherwise set needs_session=false and write the full README-style brief immediately.

Rules:
- Forbidden question topics: GitHub, git hosting, deployment, hosting platform, DevOps, CI/CD, cloud.
- If the user already answered a session question, do NOT ask more questions unless stack is still completely unknown.
- When needs_session is true, refined_brief MUST be an empty string.
- When needs_session is false, refined_brief must be markdown with: Project Overview, Tech Stack, Requirements, Local Development Notes.
- Maximum 1 question in the questions array."""


class BriefReviewSchema(BaseModel):
    needs_session: bool = Field(description="True when more user answers are required before building.")
    missing_sections: list[str] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)
    refined_brief: str = Field(default="", description="Empty when needs_session is true.")


@dataclass(frozen=True)
class BriefReviewResult:
    needs_session: bool
    missing_sections: list[str]
    questions: list[str]
    refined_brief: str
    word_count: int
    read_time_minutes: int


def _word_stats(text: str) -> tuple[int, int]:
    words = [word for word in text.split() if word]
    word_count = len(words)
    read_time = max(1, (word_count + 179) // 180)
    return word_count, read_time


def _extract_json(raw: str) -> dict[str, Any]:
    cleaned = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fence:
        cleaned = fence.group(1).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


def _compile_fallback_brief(
    *,
    name: str,
    description: str,
    document_text: str | None,
    repository_url: str | None,
    session_answers: list[dict] | None,
) -> str:
    sections = [f"# {name.strip()}", "## Project Overview", description.strip()]
    if document_text and document_text.strip():
        sections.append("## Source Document")
        sections.append(document_text.strip())
    if has_stack_mentioned(description + (document_text or "")):
        sections.append("## Tech Stack")
        sections.append("See overview — build with the stack described above.")
    else:
        sections.append("## Tech Stack")
        sections.append("To be confirmed during local implementation.")
    if session_answers:
        sections.append("## Clarifications")
        for item in session_answers:
            q = str(item.get("question", "")).strip()
            a = str(item.get("answer", "")).strip()
            if q:
                sections.append(f"- **Q:** {q}")
            if a:
                sections.append(f"  **A:** {a}")
    sections.append("## Local Development Notes")
    sections.append("- Run and test on the local machine.")
    sections.append("- No deployment or hosting steps required for this phase.")
    if repository_url:
        sections.append(f"- Reference repo: {repository_url.strip()}")
    return "\n\n".join(sections).strip() + "\n"


def _build_user_payload(
    *,
    name: str,
    description: str,
    document_text: str | None,
    repository_url: str | None,
    session_answers: list[dict] | None,
) -> str:
    parts = [
        f"Project name: {name.strip()}",
        f"Description:\n{description.strip()}",
    ]
    if document_text and document_text.strip():
        parts.append(f"Uploaded document text:\n{document_text.strip()}")
    if repository_url and repository_url.strip():
        parts.append(
            f"Reference repository (optional, local dev only — do not ask about Git setup): {repository_url.strip()}"
        )
    parts.append("Environment: local development on the developer machine. No deployment or hosting questions.")
    if session_answers:
        parts.append("Session answers:")
        for index, item in enumerate(session_answers, start=1):
            question = str(item.get("question", "")).strip()
            answer = str(item.get("answer", "")).strip()
            parts.append(f"{index}. Q: {question}\n   A: {answer}")
    return "\n\n".join(parts)


def review_project_brief(
    *,
    name: str,
    description: str,
    document_text: str | None = None,
    repository_url: str | None = None,
    session_answers: list[dict] | None = None,
) -> BriefReviewResult:
    if not credentials_available():
        raise RuntimeError("Google credentials are not configured for AI brief review.")

    combined = "\n".join(
        part
        for part in [
            description.strip(),
            (document_text or "").strip(),
            *(str(a.get("answer", "")) for a in (session_answers or [])),
        ]
        if part
    )
    word_count, read_time = _word_stats(combined)
    doc_chars = len((document_text or "").strip())
    logger.info(
        "[brief-review] start name=%r desc_chars=%s doc_chars=%s answers=%s",
        name,
        len(description),
        doc_chars,
        len(session_answers or []),
    )

    user_payload = _build_user_payload(
        name=name,
        description=description,
        document_text=document_text,
        repository_url=repository_url,
        session_answers=session_answers,
    )
    if doc_chars:
        logger.debug("[brief-review] document preview: %s", (document_text or "")[:240].replace("\n", " "))

    llm = get_text_llm()
    messages = [
        SystemMessage(content=BRIEF_SYSTEM),
        HumanMessage(content=user_payload),
    ]
    try:
        structured_llm = llm.with_structured_output(BriefReviewSchema)
        parsed_model = invoke_with_retry(
            lambda: structured_llm.invoke(messages),
            label="brief-review-structured",
        )
        needs_session = parsed_model.needs_session
        missing_sections = list(parsed_model.missing_sections)
        questions = [q.strip() for q in parsed_model.questions if q.strip()][:3]
        refined_brief = (parsed_model.refined_brief or "").strip()
        logger.info(
            "[brief-review] structured OK needs_session=%s questions=%s brief_chars=%s",
            needs_session,
            len(questions),
            len(refined_brief),
        )
    except Exception as structured_exc:
        logger.warning("[brief-review] structured output failed (%s), trying JSON fallback", structured_exc)
        response = invoke_with_retry(
            lambda: llm.invoke(
                [
                    SystemMessage(content=BRIEF_SYSTEM + "\nRespond with ONLY valid JSON matching BriefReviewSchema."),
                    HumanMessage(content=user_payload),
                ]
            ),
            label="brief-review-json-fallback",
        )
        content = response.content
        if isinstance(content, list):
            text = "".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in content
            )
        else:
            text = str(content)
        parsed = _extract_json(text)
        needs_session = bool(parsed.get("needs_session", False))
        missing_sections = [str(item) for item in parsed.get("missing_sections", []) if item]
        questions = [str(item).strip() for item in parsed.get("questions", []) if str(item).strip()][:3]
        refined_brief = str(parsed.get("refined_brief", "")).strip()
        logger.info(
            "[brief-review] JSON fallback OK needs_session=%s questions=%s brief_chars=%s",
            needs_session,
            len(questions),
            len(refined_brief),
        )

    session_count = len(session_answers or [])
    needs_session, questions = finalize_local_review(
        needs_session=needs_session,
        questions=questions,
        combined_text=combined,
        session_answer_count=session_count,
    )

    if needs_session and not questions and not has_stack_mentioned(combined):
        needs_session = True
        questions = ["Which frontend and backend stack should we use for this local project?"]

    if not needs_session and not refined_brief:
        refined_brief = _compile_fallback_brief(
            name=name,
            description=description,
            document_text=document_text,
            repository_url=repository_url,
            session_answers=session_answers,
        )

    if refined_brief:
        word_count, read_time = _word_stats(refined_brief)

    logger.info(
        "[brief-review] final needs_session=%s questions=%s",
        needs_session,
        questions,
    )

    return BriefReviewResult(
        needs_session=needs_session,
        missing_sections=missing_sections,
        questions=questions,
        refined_brief=refined_brief,
        word_count=word_count,
        read_time_minutes=read_time,
    )
