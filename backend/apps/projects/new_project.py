from __future__ import annotations

from dataclasses import dataclass
from textwrap import dedent


KEYWORD_SETS = {
    "requirements": ("requirement", "requirements", "scope", "scope:", "deliverable", "deliverables"),
    "stack": ("tech stack", "stack", "react", "next.js", "django", "graphql", "typescript", "python", "tailwind"),
    "workflow": ("timeline", "milestone", "phase", "acceptance", "review", "qa", "approval"),
    "integration": ("github", "repository", "repo", "sync", "integration", "clone", "token"),
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
    parts = [ _normalized_text(description), _normalized_text(document_text) ]
    # include any session answer text to allow the analyzer to consider user-provided details
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

    if word_count < 80:
        missing_sections.append("requirements")
        questions.append("What should this project deliver in its first release?")

    if not _contains_any(combined, KEYWORD_SETS["stack"]):
        missing_sections.append("stack")
        questions.append("Which frontend, backend, or tooling stack should the AI Agent treat as the target implementation?")

    if not _contains_any(combined, KEYWORD_SETS["workflow"]):
        missing_sections.append("workflow")
        questions.append("Are you planning to deploy this? If so, provide the hosting details.")

    # Integration guidance: if a repository URL was provided, ask only whether to connect and start immediately (yes/no).
    if repository_url:
        # repository is known — ask for a connect/start confirmation rather than requesting repo details
        if not _contains_any(combined, KEYWORD_SETS["integration"]):
            missing_sections.append("integration")
            questions.append("Connect and start working immediately?")
    else:
        if not _contains_any(combined, KEYWORD_SETS["integration"]):
            missing_sections.append("integration")
            questions.append("Should the project connect to GitHub immediately, and if so what repository or access method should be used?")

    needs_session = bool(missing_sections)

    if not questions:
        questions.append("Is there any extra constraint or scope note the AI Agent should respect?")

    return BriefAnalysis(
        needs_session=needs_session,
        missing_sections=missing_sections,
        questions=questions[:3],
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
        sections.append("## Source Connection")
        source_lines = [f"- Source: {source_type or 'unknown'}"]
        if repository_url:
            source_lines.append(f"- Repository: {repository_url}")
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

    sections.append("## Delivery Intent")
    sections.append("Start with the approved brief and transition into development immediately after approval.")

    return "\n\n".join(sections).strip() + "\n"
