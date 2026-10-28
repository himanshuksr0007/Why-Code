"""Repository-structure graphs.

When a question asks how a repository is laid out ("what is the
structure of this repo?", "show me the file tree"), the answer carries
a folder/file tree graph built from the file paths the retrieval
itself surfaced — evidence paths and graph-path file nodes — never
from an invented listing. The tree is rooted at the repository and
uses ``contains`` edges, so the frontend can render it as the
directory diagram the user sketched:

    repo
    |--- backend/
    |      |--- app/
    |--- frontend/

Only paths the pipeline actually retrieved appear; a repo whose
retrieval surfaces fewer than two files gets no structure graph.
"""

from __future__ import annotations

import re

from app.retrieval.models import AskResponse, PlanGraph, PlanGraphEdge, PlanGraphNode

_STRUCTURE_MARKERS = (
    "structure",
    "layout",
    "file tree",
    "folder",
    "director",  # directory / directories
    "organiz",  # organized / organisation / organization
    "repo map",
    "codebase map",
    "project tree",
    "directory tree",
    "folder tree",
)

_MAX_NODES = 48


def is_structure_question(question: str) -> bool:
    lowered = question.lower()
    return any(marker in lowered for marker in _STRUCTURE_MARKERS)


def _retrieved_paths(response: AskResponse) -> list[str]:
    paths: list[str] = []
    seen: set[str] = set()

    def add(raw: str | None) -> None:
        if not raw:
            return
        cleaned = raw.strip().strip("/")
        if not cleaned or cleaned in seen:
            return
        # Only plausible relative file paths: has a slash or a dot-name,
        # no spaces, no scheme.
        if " " in cleaned or "://" in cleaned:
            return
        if "/" not in cleaned and "." not in cleaned:
            return
        seen.add(cleaned)
        paths.append(cleaned)

    for item in response.evidence:
        add(item.path)
    for entry in response.graph_path:
        kind, _, label = entry.partition(":")
        if kind in {"File", "ChangedFile"}:
            add(label)
    for decision in response.decisions:
        for target in decision.target_ids:
            kind, _, label = target.partition(":")
            if kind in {"File", "ChangedFile"}:
                add(label)
    return paths


def paths_from_contexts(contexts: object) -> list[str]:
    """Every file path a demo backend holds, across all its contexts —
    the repo-wide fallback for structure questions the per-question
    retrieval refuses (no single decision is about 'the structure')."""
    found: list[str] = []
    seen: set[str] = set()
    values = contexts.values() if isinstance(contexts, dict) else []
    for context in values:
        for item in getattr(context, "evidence", []) or []:
            path = getattr(item, "path", None)
            if path and path not in seen:
                seen.add(path)
                found.append(path)
    return found


def build_structure_graph(
    repo: str,
    response: AskResponse,
    extra_paths: list[str] | None = None,
) -> PlanGraph | None:
    """Build the repo tree from retrieved file paths: the response's own
    first, merged with any repo-wide paths the caller supplies."""
    merged = list(_retrieved_paths(response))
    seen = set(merged)
    for path in extra_paths or []:
        cleaned = path.strip().strip("/")
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            merged.append(cleaned)
    paths = sorted(merged)
    if len(paths) < 2:
        return None

    nodes: dict[str, PlanGraphNode] = {}
    edges: list[PlanGraphEdge] = []
    edge_keys: set[tuple[str, str]] = set()

    root_id = "repo:root"
    nodes[root_id] = PlanGraphNode(
        id=root_id, label=repo, kind="repo", caption=f"Repository {repo}"
    )

    def ensure_node(node_id: str, label: str, kind: str, caption: str) -> str:
        if node_id not in nodes:
            nodes[node_id] = PlanGraphNode(
                id=node_id, label=label, kind=kind, caption=caption
            )
        return node_id

    def link(source: str, target: str) -> None:
        key = (source, target)
        if key not in edge_keys:
            edge_keys.add(key)
            edges.append(
                PlanGraphEdge(source=source, target=target, rel_type="contains")
            )

    for path in paths:
        parts = [part for part in path.split("/") if part]
        parent = root_id
        prefix = ""
        for index, part in enumerate(parts):
            prefix = f"{prefix}/{part}" if prefix else part
            is_leaf = index == len(parts) - 1
            node_id = f"path:{prefix}"
            if is_leaf:
                ensure_node(node_id, part, "file", path)
            else:
                ensure_node(node_id, f"{part}/", "folder", f"{prefix}/")
            link(parent, node_id)
            parent = node_id
        if len(nodes) >= _MAX_NODES:
            break

    return PlanGraph(nodes=list(nodes.values()), edges=edges)


_WHITESPACE = re.compile(r"\s+")


def structure_title(question: str) -> str:
    return _WHITESPACE.sub(" ", question).strip()


def summarize_structure(repo: str, graph: PlanGraph) -> str:
    """A plain-text companion for the tree, used when the retrieval
    itself refused the question: the top-level folders and their files,
    stated exactly as the index holds them."""
    children: dict[str, list[PlanGraphNode]] = {}
    by_id = {node.id: node for node in graph.nodes}
    for edge in graph.edges:
        children.setdefault(edge.source, []).append(by_id[edge.target])
    top = children.get("repo:root", [])
    parts: list[str] = []
    for node in top:
        if node.kind == "folder":
            files = [
                child.label
                for child in children.get(node.id, [])
                if child.kind == "file"
            ]
            subfolders = [
                child.label
                for child in children.get(node.id, [])
                if child.kind == "folder"
            ]
            listing = ", ".join(files[:6])
            extra = f" (plus subfolders {', '.join(subfolders[:3])})" if subfolders else ""
            parts.append(f"{node.label} — {listing}{extra}" if listing else f"{node.label}{extra}")
        else:
            parts.append(node.label)
    joined = "; ".join(parts)
    return (
        f"The repository {repo} is organized as follows: {joined}. "
        "The structure graph shows the full tree."
    )
