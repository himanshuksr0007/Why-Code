"""API shapes for the models endpoints. A plaintext API key appears in
exactly one place in this module: the create request. No response shape
carries a key, encrypted or otherwise — responses expose only the last
four characters as a hint so a user can recognise their own key."""

from __future__ import annotations

from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


class CustomModelCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_id: str = Field(min_length=8, max_length=80)
    name: str = Field(min_length=1, max_length=60)
    model: str = Field(min_length=1, max_length=120)
    endpoint: str = Field(min_length=1, max_length=500)
    api_key: str = Field(min_length=1, max_length=512, repr=False)
    context_tokens: int = Field(default=128_000, ge=1_000, le=2_000_000)

    @field_validator("name", "model", "client_id")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()

    @field_validator("endpoint")
    @classmethod
    def _endpoint_rules(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("endpoint must be an http(s) URL")
        if parsed.username or parsed.password:
            raise ValueError("endpoint must not embed credentials")
        if parsed.scheme == "http" and parsed.hostname not in _LOCAL_HOSTS:
            raise ValueError(
                "endpoint must use https (http is allowed only for localhost)"
            )
        return value


class CustomModelView(BaseModel):
    id: str
    name: str
    model: str
    endpoint: str
    context_tokens: int
    key_hint: str
    created_at: str
    custom: bool = True


class DefaultModelView(BaseModel):
    id: str = "default"
    name: str
    model: str
    endpoint: str
    context_tokens: int
    custom: bool = False


class ModelsResponse(BaseModel):
    default: DefaultModelView
    custom: list[CustomModelView]


class UsageResponse(BaseModel):
    model_id: str
    prompt_tokens: int
    completion_tokens: int
    used_tokens: int
    context_tokens: int
    percent: float
    requests: int


__all__ = [
    "CustomModelCreate",
    "CustomModelView",
    "DefaultModelView",
    "ModelsResponse",
    "UsageResponse",
]
