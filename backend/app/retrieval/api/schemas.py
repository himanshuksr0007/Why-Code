"""HTTP request/response schemas for the answer service."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.retrieval.models import (
    AskMode,
    AskParameters,
    AskResponse,
    NearestCandidate,
)


class AskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=2000)
    repo: str | None = None
    # Ask mode: "why" explains from the evidence; "plan" additionally
    # returns a structured plan built from the answer's retrieval.
    mode: AskMode = AskMode.WHY
    # Model selection: an anonymous client id plus the id of one of its
    # custom models (see app.models). Absent/"default" = the server model.
    client_id: str | None = Field(default=None, max_length=80)
    model_id: str | None = Field(default=None, max_length=80)
    max_evidence_items: int = Field(default=8, ge=1, le=20)
    max_answer_tokens: int = Field(default=700, ge=100, le=4000)
    include_graph_path: bool = True
    include_evidence: bool = True

    @field_validator("question")
    @classmethod
    def _question_clean(cls, value: str) -> str:
        value = " ".join(value.split()).strip()
        if not value:
            raise ValueError("question must not be blank")
        return value

    def parameters(self) -> AskParameters:
        return AskParameters(
            question=self.question,
            repo=self.repo,
            max_evidence_items=self.max_evidence_items,
            max_answer_tokens=self.max_answer_tokens,
            include_graph_path=self.include_graph_path,
            include_evidence=self.include_evidence,
            mode=self.mode,
        )


class EvidenceDetail(BaseModel):
    evidence_id: str
    kind: str
    record_type: str | None = None
    source_type: str | None = None
    url: str | None = None
    excerpt: str = ""
    author: str | None = None
    created_at: str | None = None
    pr_number: int | None = None
    issue_number: int | None = None
    commit_sha: str | None = None
    path: str | None = None
    start_line: int | None = None
    end_line: int | None = None


class EntityHistoryResponse(BaseModel):
    entity_id: str
    decisions: list[NearestCandidate] = Field(default_factory=list)


class FeedbackVerdict(StrEnum):
    HELPFUL = "helpful"
    WRONG = "wrong"
    MISSING_EVIDENCE = "missing_evidence"


class FeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=2000)
    verdict: FeedbackVerdict
    comment: str = Field(default="", max_length=4000)
    decision_ids: list[str] = Field(default_factory=list)
    answer_id: str | None = None


class FeedbackResponse(BaseModel):
    feedback_id: str
    status: str = "recorded"


__all__ = [
    "AskRequest",
    "AskResponse",
    "EntityHistoryResponse",
    "EvidenceDetail",
    "FeedbackRequest",
    "FeedbackResponse",
    "FeedbackVerdict",
]
