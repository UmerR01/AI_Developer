"""Shared rules for project brief Q&A in local development mode."""

from __future__ import annotations

FORBIDDEN_QUESTION_MARKERS = (
    "github",
    "gitlab",
    "bitbucket",
    "repository",
    "repo url",
    "deploy",
    "deployment",
    "hosting",
    "hosted",
    "vercel",
    "netlify",
    "aws",
    "azure",
    "gcp",
    "cloud",
    "ci/cd",
    "pipeline",
    "docker hub",
    "kubernetes",
    "production environment",
    "connect to git",
    "clone",
    "access token",
    "remote repo",
)

STACK_MARKERS = (
    "tech stack",
    "stack",
    "react",
    "next.js",
    "nextjs",
    "django",
    "graphql",
    "typescript",
    "python",
    "tailwind",
    "vue",
    "angular",
    "fastapi",
    "flask",
    "node",
    "postgres",
    "postgresql",
)


def has_stack_mentioned(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in STACK_MARKERS)


def filter_local_questions(questions: list[str]) -> list[str]:
    """Drop GitHub/deployment/hosting questions — local dev only for now."""
    kept: list[str] = []
    for question in questions:
        lower = question.strip().lower()
        if not lower:
            continue
        if any(marker in lower for marker in FORBIDDEN_QUESTION_MARKERS):
            continue
        kept.append(question.strip())
    return kept[:3]


def finalize_local_review(
    *,
    needs_session: bool,
    questions: list[str],
    combined_text: str,
    session_answer_count: int,
) -> tuple[bool, list[str]]:
    """
    Decide if more Q&A is needed after filtering forbidden topics.
    After the user has answered at least one question, prefer finishing the brief.
    """
    questions = filter_local_questions(questions)

    if session_answer_count > 0:
        if has_stack_mentioned(combined_text):
            return False, []
        if questions:
            return True, questions[:1]
        return False, []

    if not needs_session:
        return False, questions

    if has_stack_mentioned(combined_text):
        return False, []

    if questions:
        return True, questions[:1]

    return True, ["Which frontend and backend stack should we use for this local project?"]
