"""Multi-language high-value path detection.

The language packs are additive: Go/Java/Rust/TypeScript subsystem
files earn the same high_value_path signal Python files always did,
and plain files in those languages stay low-signal.
"""

from __future__ import annotations

from app.intent.selection.candidate_detector import (
    CandidateClass,
    CandidateDetector,
    detect_language,
)
from app.intent.selection.evidence_selector import EvidenceItem, PrEvidenceBundle


def _item(record_id: str, record_type: str, **payload: object) -> EvidenceItem:
    return EvidenceItem(
        record_id=record_id, record_type=record_type, pr_number=1, payload=payload
    )


def _bundle(paths: list[str]) -> PrEvidenceBundle:
    return PrEvidenceBundle(
        repo="acme/widgets",
        pr_number=1,
        pr=_item("pr:1", "pull_request", title="Improve configuration handling", body=""),
        files=[
            _item(f"file:{index}", "changed_file", path=path)
            for index, path in enumerate(paths)
        ],
    )


def _signal_names(paths: list[str]) -> set[str]:
    candidates = CandidateDetector().detect(_bundle(paths))
    return {signal.name for candidate in candidates for signal in candidate.signals}


def _classes(paths: list[str]) -> set[CandidateClass]:
    return {
        candidate.candidate_class
        for candidate in CandidateDetector().detect(_bundle(paths))
    }


def test_go_config_and_manifest_are_high_value() -> None:
    paths = ["internal/config/config.go", "go.mod"]
    assert "high_value_path" in _signal_names(paths)
    assert CandidateClass.DECISION_CANDIDATE in _classes(paths)


def test_java_security_config_and_build_are_high_value() -> None:
    paths = ["src/main/java/com/acme/SecurityConfig.java", "pom.xml"]
    assert "high_value_path" in _signal_names(paths)
    assert CandidateClass.DECISION_CANDIDATE in _classes(paths)


def test_rust_config_and_manifest_are_high_value() -> None:
    paths = ["crates/api/src/config.rs", "Cargo.toml"]
    assert "high_value_path" in _signal_names(paths)
    assert CandidateClass.DECISION_CANDIDATE in _classes(paths)


def test_typescript_middleware_and_manifest_are_high_value() -> None:
    paths = ["apps/web/src/middleware.ts", "package.json"]
    assert "high_value_path" in _signal_names(paths)
    assert CandidateClass.DECISION_CANDIDATE in _classes(paths)


def test_plain_go_file_stays_low_signal() -> None:
    paths = ["internal/util/helpers.go"]
    assert "high_value_path" not in _signal_names(paths)
    assert _classes(paths) == {CandidateClass.LOW_SIGNAL}


def test_detect_language() -> None:
    assert detect_language("go.mod") == "go"
    assert detect_language("services/api/main.go") == "go"
    assert detect_language("app/pom.xml") == "java"
    assert detect_language("src/main/java/com/acme/App.java") == "java"
    assert detect_language("crates/api/Cargo.toml") == "rust"
    assert detect_language("src/lib.rs") == "rust"
    assert detect_language("web/src/middleware.ts") == "typescript"
    assert detect_language("pkg/mod.py") == "python"
    assert detect_language("LICENSE") is None
