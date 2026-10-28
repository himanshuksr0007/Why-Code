"""Plan-mode construction.

A plan is built *from a finished answer's own retrieval* — the decisions,
evidence and graph path the pipeline already produced — never invented
freely:

- Steps the retrieved decisions prove are already in the repository are
  marked ``done`` and cite the decision's evidence.
- The steps still to build are scaffolding, but they name the real
  modules, files and config keys the retrieval surfaced, so the timeline
  is about this repository and not a generic checklist.
- The connection graph is the answer's real graph path (targets -> PR ->
  decision -> evidence) rooted at the goal, not a decorative diagram.

Because it only reshapes an :class:`AskResponse`, every answer path
(graph service, live service, custom-model re-synthesis) gets the same
plan behaviour.
"""

from __future__ import annotations

from app.retrieval.models import (
    AskResponse,
    PlanGraph,
    PlanGraphEdge,
    PlanGraphNode,
    PlanStep,
    PlanView,
)

_MAX_DONE_STEPS = 5
_MAX_GRAPH_NODES = 16

_KIND_BY_LABEL = {
    "ConfigKey": "config",
    "Symbol": "symbol",
    "CodeRegion": "code",
    "ChangedFile": "file",
    "File": "file",
    "PullRequest": "pr",
    "Commit": "commit",
    "Decision": "decision",
    "Evidence": "evidence",
    "Person": "person",
    "Issue": "issue",
    "Doc": "doc",
    "Repo": "repo",
}

_LABEL_BY_KIND = {
    "feature": "Goal",
    "config": "Config",
    "symbol": "Symbol",
    "code": "Code region",
    "file": "File",
    "pr": "Pull request",
    "commit": "Commit",
    "decision": "Decision",
    "evidence": "Evidence",
    "person": "Person",
    "issue": "Issue",
    "doc": "Doc",
    "repo": "Repository",
    "module": "Module",
}


def _shorten(text: str, limit: int) -> str:
    cleaned = " ".join(text.split()).strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1].rstrip() + "…"


def build_plan(question: str, response: AskResponse) -> PlanView:
    """Build the structured plan for a plan-mode ask from its response."""
    evidence_by_id = {item.evidence_id: item for item in response.evidence}
    steps = _done_steps(response, evidence_by_id)
    steps.extend(_needed_steps(response, evidence_by_id, has_done=bool(steps)))
    graph = _graph(question, response, evidence_by_id)
    return PlanView(goal=question, steps=steps, graph=graph)


def _done_steps(response: AskResponse, evidence_by_id: dict) -> list[PlanStep]:
    steps: list[PlanStep] = []
    for decision in response.decisions[:_MAX_DONE_STEPS]:
        evidence_ids = [
            eid for eid in decision.evidence_ids if eid in evidence_by_id
        ]
        title = decision.title or _shorten(decision.claim, 90)
        if not title:
            continue
        detail = decision.rationale or decision.claim
        steps.append(
            PlanStep(
                title=title,
                detail=_shorten(detail, 320),
                status="done",
                evidence_ids=evidence_ids,
            )
        )
    return steps


def _grounding(response: AskResponse) -> tuple[list[str], list[str]]:
    """(file paths, config keys) the retrieval actually surfaced."""
    files: list[str] = []
    configs: list[str] = []
    for raw in response.graph_path:
        label, _, rest = raw.partition(":")
        if label in {"ChangedFile", "File"} and rest and rest not in files:
            files.append(rest)
        elif label == "ConfigKey" and rest and rest not in configs:
            configs.append(rest)
    for item in response.evidence:
        if item.path and item.path not in files:
            files.append(item.path)
    for decision in response.decisions:
        for target in decision.target_ids:
            label, _, rest = target.partition(":")
            if label == "ConfigKey" and rest and rest not in configs:
                configs.append(rest)
    return files[:5], configs[:4]


def _needed_steps(
    response: AskResponse, evidence_by_id: dict, *, has_done: bool
) -> list[PlanStep]:
    files, configs = _grounding(response)
    file_evidence = [
        item.evidence_id for item in response.evidence if item.path
    ][:3]

    if not has_done and not files and not response.evidence:
        # A refusal: nothing in the graph covers this goal yet. The honest
        # plan starts with building the evidence base, naming the closest
        # records the retrieval did find.
        steps = [
            PlanStep(
                title="Establish the evidence base",
                detail=(
                    "No indexed decision covers this goal yet, so there is "
                    "nothing defensible to build on. Start by reading the "
                    "code that owns this area and pinning down its current "
                    "behaviour."
                ),
                status="needed",
            )
        ]
        if response.nearest_candidates:
            claims = "; ".join(
                _shorten(candidate.claim, 70)
                for candidate in response.nearest_candidates[:2]
                if candidate.claim
            )
            if claims:
                steps.append(
                    PlanStep(
                        title="Review the closest existing decisions",
                        detail=(
                            "These records sit next to the goal and bound "
                            f"what the change may touch: {claims}."
                        ),
                        status="needed",
                    )
                )
        steps.append(
            PlanStep(
                title="Implement and record the first decision",
                detail=(
                    "Land the change as a reviewed pull request that states "
                    "the why; it becomes the decision the next plan reads "
                    "back as done."
                ),
                status="needed",
            )
        )
        return steps

    steps: list[PlanStep] = []
    if configs:
        steps.append(
            PlanStep(
                title="Extend the configuration surface",
                detail=(
                    "The behaviour is steered by "
                    + ", ".join(f"`{key}`" for key in configs)
                    + ". Add the new option there first, defaulting to the "
                    "current behaviour so existing callers are unaffected."
                ),
                status="needed",
                evidence_ids=file_evidence,
            )
        )
    if files:
        steps.append(
            PlanStep(
                title="Implement the change in the owning modules",
                detail=(
                    "The retrieved code path runs through "
                    + ", ".join(f"`{path}`" for path in files)
                    + ". Keep the change inside these modules and follow "
                    "the decisions already recorded above."
                ),
                status="needed",
                evidence_ids=file_evidence,
            )
        )
    steps.append(
        PlanStep(
            title="Cover the new behaviour with tests",
            detail=(
                "Add tests at the same seams the existing decisions were "
                "verified at, including the default path, so the new "
                "behaviour cannot silently revert what is already decided."
            ),
            status="needed",
            evidence_ids=file_evidence[:1],
        )
    )
    steps.append(
        PlanStep(
            title="Record the decision",
            detail=(
                "Land the change as a reviewed pull request whose "
                "description states the why and links the evidence. That "
                "record becomes a done step in the next plan."
            ),
            status="needed",
        )
    )
    return steps


def _path_nodes(
    response: AskResponse, evidence_by_id: dict
) -> list[PlanGraphNode]:
    """Nodes built from the answer's graph path, in path order."""
    nodes: list[PlanGraphNode] = []
    seen: set[str] = set()
    for raw in response.graph_path:
        if raw in seen:
            continue
        seen.add(raw)
        label, _, rest = raw.partition(":")
        kind = _KIND_BY_LABEL.get(label, "module")
        caption = rest
        if kind == "evidence":
            item = evidence_by_id.get(rest)
            if item is not None:
                caption = item.path or item.kind
        elif kind == "decision":
            caption = _shorten(rest.replace("dec_", "").replace("_", " "), 48)
        elif kind == "file":
            caption = rest.rsplit("/", 1)[-1] or rest
        else:
            caption = _shorten(rest, 48)
        nodes.append(
            PlanGraphNode(
                id=f"n{len(nodes)}",
                label=_LABEL_BY_KIND.get(kind, "Module"),
                kind=kind,
                caption=caption or None,
            )
        )
    # Keep every structural node; let evidence nodes fill what room is left.
    structural = [node for node in nodes if node.kind != "evidence"]
    evidence = [node for node in nodes if node.kind == "evidence"]
    kept = (structural + evidence)[: _MAX_GRAPH_NODES - 1]
    order = {node.id: index for index, node in enumerate(nodes)}
    kept.sort(key=lambda node: order[node.id])
    return kept


def _rel_for(source_kind: str, target_kind: str) -> str:
    if target_kind == "pr":
        return "changed in"
    if source_kind == "pr" and target_kind == "decision":
        return "decided in"
    if source_kind == "decision" and target_kind == "evidence":
        return "supported by"
    if source_kind in {"symbol", "code"} and target_kind == "file":
        return "lives in"
    if target_kind == "decision":
        return "informs"
    return "connects"


def _graph(
    question: str, response: AskResponse, evidence_by_id: dict
) -> PlanGraph:
    goal = PlanGraphNode(
        id="goal",
        label="Goal",
        kind="feature",
        caption=_shorten(question, 72),
    )
    nodes: list[PlanGraphNode] = [goal]
    edges: list[PlanGraphEdge] = []

    path_nodes = _path_nodes(response, evidence_by_id)
    if path_nodes:
        nodes.extend(path_nodes)
        for a, b in zip(path_nodes, path_nodes[1:], strict=False):
            edges.append(
                PlanGraphEdge(
                    source=a.id,
                    target=b.id,
                    rel_type=_rel_for(a.kind, b.kind),
                )
            )
        edges.append(
            PlanGraphEdge(source="goal", target=path_nodes[0].id, rel_type="starts from")
        )
        for node in path_nodes:
            if node.kind == "decision":
                edges.append(
                    PlanGraphEdge(source="goal", target=node.id, rel_type="builds on")
                )
        return PlanGraph(nodes=nodes, edges=_dedupe_edges(edges))

    # No graph path (refusals, knowledge fallback): connect the goal to
    # whatever decisions and files the response does carry.
    decision_nodes: list[PlanGraphNode] = []
    for index, decision in enumerate(response.decisions[:4]):
        node = PlanGraphNode(
            id=f"d{index}",
            label="Decision",
            kind="decision",
            caption=_shorten(decision.title or decision.claim, 56) or None,
        )
        decision_nodes.append(node)
        nodes.append(node)
        edges.append(
            PlanGraphEdge(source="goal", target=node.id, rel_type="builds on")
        )
    file_nodes: dict[str, PlanGraphNode] = {}
    for item in response.evidence:
        if not item.path or item.path in file_nodes:
            continue
        node = PlanGraphNode(
            id=f"f{len(file_nodes)}",
            label="File",
            kind="file",
            caption=item.path.rsplit("/", 1)[-1] or item.path,
        )
        file_nodes[item.path] = node
        nodes.append(node)
        owner = next(
            (
                decision_nodes[i]
                for i, decision in enumerate(response.decisions[:4])
                if item.evidence_id in decision.evidence_ids
            ),
            None,
        )
        if owner is not None:
            edges.append(
                PlanGraphEdge(source=owner.id, target=node.id, rel_type="evidenced in")
            )
        else:
            edges.append(
                PlanGraphEdge(source="goal", target=node.id, rel_type="touches")
            )
        if len(file_nodes) >= 5:
            break
    return PlanGraph(nodes=nodes[:_MAX_GRAPH_NODES], edges=_dedupe_edges(edges))


def _dedupe_edges(edges: list[PlanGraphEdge]) -> list[PlanGraphEdge]:
    seen: set[tuple[str, str, str]] = set()
    unique: list[PlanGraphEdge] = []
    for edge in edges:
        key = (edge.source, edge.target, edge.rel_type)
        if key in seen or edge.source == edge.target:
            continue
        seen.add(key)
        unique.append(edge)
    return unique


__all__ = ["build_plan"]
