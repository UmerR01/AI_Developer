from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from ai_module.brief_policy import finalize_local_review, has_stack_mentioned

KEYWORD_SETS = {
    "requirements": ("requirement", "requirements", "scope", "scope:", "deliverable", "deliverables"),
    "stack": (
        "tech stack",
        "stack",
        "react",
        "next.js",
        "django",
        "graphql",
        "typescript",
        "python",
        "tailwind",
    ),
}


@dataclass(frozen=True)
class BriefAnalysis:
    needs_session: bool
    missing_sections: list[str]
    questions: list[str]
    word_count: int
    read_time_minutes: int


def _normalized_text(value: str | None) -> str:
    return (value or "").strip()


def _contains_any(text: str, needles: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(needle in lowered for needle in needles)


def analyze_project_brief(
    description: str,
    document_text: str | None = None,
    repository_url: str | None = None,
    session_answers: list[dict] | None = None,
) -> BriefAnalysis:
    parts = [_normalized_text(description), _normalized_text(document_text)]
    if session_answers:
        for ans in session_answers:
            parts.append(_normalized_text(str(ans.get("answer", ""))))
            parts.append(_normalized_text(str(ans.get("question", ""))))

    combined = "\n".join(part for part in parts if part)
    words = [word for word in combined.split() if word]
    word_count = len(words)
    read_time_minutes = max(1, (word_count + 179) // 180)

    missing_sections: list[str] = []
    questions: list[str] = []

    if word_count < 60:
        missing_sections.append("requirements")
        questions.append("What should this project deliver in its first local version?")

    if not has_stack_mentioned(combined):
        missing_sections.append("stack")
        questions.append("Which frontend and backend stack should we use for this local project?")

    needs_session = bool(missing_sections)
    session_count = len(session_answers or [])
    needs_session, questions = finalize_local_review(
        needs_session=needs_session,
        questions=questions,
        combined_text=combined,
        session_answer_count=session_count,
    )

    return BriefAnalysis(
        needs_session=needs_session,
        missing_sections=missing_sections if needs_session else [],
        questions=questions,
        word_count=word_count,
        read_time_minutes=read_time_minutes,
    )


def compile_project_brief(
    *,
    name: str,
    description: str,
    source_type: str | None = None,
    repository_url: str | None = None,
    session_answers: list[dict] | None = None,
    revision_notes: str | None = None,
) -> str:
    sections: list[str] = [f"# {name.strip()}"]

    clean_description = _normalized_text(description)
    if clean_description:
        sections.append("## Project Overview")
        sections.append(clean_description)

    if source_type or repository_url:
        sections.append("## Source Connection (reference only)")
        source_lines = [f"- Source: {source_type or 'local'}"]
        if repository_url:
            source_lines.append(f"- Reference repository: {repository_url}")
        sections.extend(source_lines)

    if session_answers:
        sections.append("## AI Session Answers")
        for index, answer in enumerate(session_answers, start=1):
            question = _normalized_text(str(answer.get("question", "")))
            response = _normalized_text(str(answer.get("answer", "")))
            sections.append(f"### Question {index}")
            if question:
                sections.append(f"**Q:** {question}")
            if response:
                sections.append(f"**A:** {response}")

    if revision_notes:
        sections.append("## Revision Notes")
        sections.append(revision_notes.strip())

    sections.append("## Local Development Notes")
    sections.append("- Build and run on the local developer machine.")
    sections.append("- No deployment or hosting setup required for this phase.")

    return "\n\n".join(sections).strip() + "\n"
