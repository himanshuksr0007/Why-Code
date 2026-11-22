"""The prompt sent to the answer model for live ``/ask`` answers.

Everything the model is told lives here, in three parts:

1. ``SYSTEM_PROMPT`` – who the model is and the non-negotiable evidence
   rules (cite only fetched evidence, never invent, refuse when unsupported).
2. A *reader-friendly layout* chosen from the question's intent, which
   DistilBERT detects (``app.nlp.intent``). A "why" question gets a short
   answer then the reasons; a "who" question leads with the people; a
   "where" question leads with file paths. Plain words first, jargon
   explained, short paragraphs.
3. ``ANSWER_SCHEMA`` – the JSON shape the reply must match.

The friendly layout only governs *presentation*. The evidence rules are
repeated after the layout so that "be friendly" can never be read as
permission to drop a citation. Validation of every citation still happens in
code afterwards (``LiveService.answer_question``).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.nlp.intent import IntentResult, QuestionIntent

SYSTEM_PROMPT = """You are Why-Code, a friendly senior engineer who explains why a codebase \
is the way it is.

You work only from the evidence you are given (source files, pull requests, issues and \
recorded decisions). You never use outside knowledge about the project, and you never \
guess. When the evidence does not answer the question, you say so plainly and say what \
is missing.

How you write:
- Lead with the direct answer in one or two plain sentences, then the detail.
- Write for a developer who is new to this codebase: explain any project-specific term \
the first time you use it.
- Prefer short paragraphs and bullet points over long blocks of text.
- Be warm and direct, not salesy. No filler such as "Great question!".
- Never pretend certainty: if evidence is thin or conflicting, say so.

You always reply with ONLY one valid JSON object that matches the schema."""


# Evidence rules. Deliberately identical in substance to the previous inline
# prompt so the citation validator's expectations do not change.
EVIDENCE_RULES = (
    "- Every factual sentence ends with at least one inline citation like [E1].",
    "- Cite only aliases listed above. Never invent files, PR numbers, people, dates or quotes.",
    "- A decision marked 'background' was mined but not confirmed: say so if you rely on it.",
    "- If the evidence does not answer the question, set answer_status to "
    '"insufficient_evidence" and, in one or two friendly sentences, say what evidence is '
    "missing and what the reader could check instead.",
    "- 'citations' lists the E-aliases you used; 'decision_refs' the D-aliases you relied on.",
)

FORMAT_RULES = (
    "- Format 'answer' as GitHub Markdown (bold labels, lists, `code`); no HTML, no tables.",
    "- Put file paths, function names and config keys in `backticks`.",
    "- Do not repeat the question back. Do not end with a generic offer of further help.",
)


@dataclass(frozen=True)
class Layout:
    """How the answer should be organised for one kind of question."""

    goal: str
    sections: tuple[str, ...]


LAYOUTS: dict[QuestionIntent, Layout] = {
    QuestionIntent.RATIONALE: Layout(
        goal="The reader wants to understand the reason behind a design choice.",
        sections=(
            "**In short:** one or two sentences giving the main reason.",
            "**Why:** 2-4 bullets, each one reason with its citation.",
            "**Trade-offs:** what this choice costs or rules out, if the evidence says so.",
            "**Where to look:** the files, PRs or decisions to read next.",
        ),
    ),
    QuestionIntent.HISTORY: Layout(
        goal="The reader wants to know how this changed over time.",
        sections=(
            "**In short:** what the situation is now, in one sentence.",
            "**What happened:** a short timeline, oldest first, one bullet per change "
            "with its PR, commit or date when the evidence gives one.",
            "**Is it still true?:** whether the decision is still in force, reverted or "
            "superseded, based on the recorded state.",
        ),
    ),
    QuestionIntent.OWNERSHIP: Layout(
        goal="The reader wants to know which people are involved.",
        sections=(
            "**In short:** who, in one sentence, using only names that appear in the evidence.",
            "**Their involvement:** one bullet per person: what they authored, reviewed or "
            "decided, with citations.",
            "**Who to ask:** the most relevant person to contact, and why, "
            "if evidence supports it.",
        ),
    ),
    QuestionIntent.BEHAVIOUR: Layout(
        goal="The reader wants to understand how something works.",
        sections=(
            "**In short:** what it does, in one or two plain sentences.",
            "**How it works:** numbered steps in the order the code runs.",
            "**Why it is built this way:** the design reason, if the evidence gives one.",
        ),
    ),
    QuestionIntent.LOCATION: Layout(
        goal="The reader wants to find something in the codebase.",
        sections=(
            "**In short:** the main file or module, in `backticks`.",
            "**Where things live:** one bullet per relevant file with what it is responsible for.",
            "**Start reading at:** the single best entry point.",
        ),
    ),
    QuestionIntent.COMPARISON: Layout(
        goal="The reader wants to know why one option was chosen over another.",
        sections=(
            "**In short:** which option was chosen and the deciding reason.",
            "**The options:** one bullet per option with what the evidence says "
            "for and against it.",
            "**Why this one won:** the deciding factor, with citations.",
        ),
    ),
    QuestionIntent.GENERAL: Layout(
        goal="Answer the question as clearly as the evidence allows.",
        sections=(
            "**In short:** the direct answer in one or two sentences.",
            "**Details:** supporting points as short bullets.",
        ),
    ),
}


ANSWER_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "answer_status": {"type": "string", "enum": ["answered", "insufficient_evidence"]},
        "answer": {"type": "string"},
        "citations": {"type": "array", "items": {"type": "string"}},
        "decision_refs": {"type": "array", "items": {"type": "string"}},
        "caveats": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer_status", "answer", "citations", "caveats"],
}
SCHEMA_NAME = "LiveAskResponse"


@dataclass(frozen=True)
class AnswerPrompt:
    system: str
    user: str
    schema: dict[str, Any]
    schema_name: str
    intent: IntentResult


def layout_for(intent: IntentResult) -> Layout:
    return LAYOUTS.get(intent.intent, LAYOUTS[QuestionIntent.GENERAL])


def build_answer_prompt(
    *, question: str, context_block: str, intent: IntentResult
) -> AnswerPrompt:
    """Assemble the full prompt for one live answer.

    ``context_block`` is the evidence text the caller fetched (with its
    ``[E#]`` and ``[D#]`` aliases); it is passed through unchanged.
    """

    layout = layout_for(intent)
    lines = [
        context_block.rstrip(),
        "",
        f"Question: {question.strip()}",
        "",
        "Answer using ONLY the evidence above.",
        "",
        f"What the reader needs: {layout.goal}",
        "Organise 'answer' like this (skip any section the evidence cannot support, "
        "rather than filling it with guesses):",
        *(f"{i}. {section}" for i, section in enumerate(layout.sections, start=1)),
        "",
        "Formatting:",
        *FORMAT_RULES,
        "",
        "Evidence rules (these override everything above):",
        *EVIDENCE_RULES,
        "",
        "Return strictly valid JSON.",
    ]
    return AnswerPrompt(
        system=SYSTEM_PROMPT,
        user="\n".join(lines),
        schema=ANSWER_SCHEMA,
        schema_name=SCHEMA_NAME,
        intent=intent,
    )


__all__ = [
    "ANSWER_SCHEMA",
    "AnswerPrompt",
    "EVIDENCE_RULES",
    "LAYOUTS",
    "SYSTEM_PROMPT",
    "build_answer_prompt",
    "layout_for",
]
