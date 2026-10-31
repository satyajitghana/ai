"""A Python port of agent-desktop's ref allocation (crates/core/src/refs/ref_alloc.rs),
depth clamp semantics (docs/CONCEPTS.md) and node JSON schema (crates/core/src/tree/node*.rs).

This is OUR re-implementation, written from reading the Rust source at commit cb31212.
It is checked against the repository's own unit-test cases in test_port.py.
Simplifications (deliberate): no macOS retained objects, no mutable-value-role subtlety in
stable text identity, no RefMap size limit, bounds are only used as 'has a valid rect'.
"""
from __future__ import annotations
import json
from dataclasses import dataclass, field
from typing import Optional

INTERACTIVE_ROLES = {
    "button", "cell", "checkbox", "colorwell", "combobox", "dockitem", "incrementor", "link",
    "listbox", "menubutton", "menuitem", "option", "radiobutton", "slider", "switch", "tab",
    "textfield", "treeitem",
}
UBIQUITOUS = {"SetFocus", "RightClick", "ScrollTo"}
CANONICAL = INTERACTIVE_ROLES | {
    "window", "group", "statictext", "list", "toolbar", "image", "heading", "table", "row",
    "menu", "menubar", "scrollarea", "outline", "tablist", "separator", "unknown",
}


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def valid(self) -> bool:
        return self.w > 0 and self.h > 0


@dataclass
class Node:
    role: str
    name: Optional[str] = None
    value: Optional[str] = None
    description: Optional[str] = None
    native_id: Optional[str] = None
    native_id_kind: str = "AxIdentifier"
    states: list = field(default_factory=list)
    actions: list = field(default_factory=list)
    bounds: Optional[Rect] = None
    hint: Optional[str] = None
    children: list = field(default_factory=list)
    children_count: Optional[int] = None
    subtree_truncated: bool = False
    ref_id: Optional[str] = None

    def copy_shallow(self) -> "Node":
        n = Node(**{k: getattr(self, k) for k in self.__dataclass_fields__ if k != "children"})
        n.children = []
        return n


def non_blank(s):
    return s is not None and s.strip() != ""


def is_ref_able(n: Node) -> bool:
    return n.role in INTERACTIVE_ROLES or any(a not in UBIQUITOUS for a in n.actions)


def is_transparent_wrapper_role(role: str) -> bool:
    return role == "group"


def is_collapsible(n: Node) -> bool:
    return (
        is_transparent_wrapper_role(n.role)
        and n.ref_id is None
        and not non_blank(n.name)
        and not non_blank(n.value)
        and not non_blank(n.description)
        and n.native_id is None
        and not non_blank(n.hint)
        and not n.states
        and not n.actions
        and n.bounds is None
        and n.children_count is None
        and len(n.children) == 1
    )


def can_receive_observed_ref(n: Node) -> bool:
    return n.role in CANONICAL and n.role != "unknown"


def has_bounds_hash(n: Node) -> bool:
    return n.bounds is not None and n.bounds.valid()


def is_resolvable_skeleton_anchor(n: Node) -> bool:
    return can_receive_observed_ref(n) and (
        non_blank(n.name)
        or non_blank(n.description)
        or (n.native_id is not None and n.native_id_kind != "Unknown" and non_blank(n.native_id))
        or has_bounds_hash(n)
    )


def has_meaningful_identity(n: Node) -> bool:
    return non_blank(n.native_id) or non_blank(n.name) or non_blank(n.description) or non_blank(n.value)


@dataclass
class Entry:
    role: str
    name: Optional[str]
    actions: list
    bounds: Optional[Rect]
    path: tuple
    root_ref: Optional[str]


class RefMap:
    def __init__(self):
        self.counter = 0
        self.inner: dict[str, Entry] = {}

    def __len__(self):
        return len(self.inner)

    def allocate(self, e: Entry) -> str:
        self.counter += 1
        rid = f"@e{self.counter}"
        self.inner[rid] = e
        return rid

    def get(self, rid):
        return self.inner[rid]


def plan_skeleton_anchors(n: Node, path: list, anchors: set) -> bool:
    uncovered = n.children_count is not None
    for i, c in enumerate(n.children):
        path.append(i)
        uncovered |= plan_skeleton_anchors(c, path, anchors)
        path.pop()
    if not uncovered:
        return False
    if can_receive_observed_ref(n) and is_ref_able(n):
        return False
    if path and is_resolvable_skeleton_anchor(n):
        anchors.add(tuple(path))
        return False
    return True


def allocate_refs(node: Node, refmap: RefMap, include_bounds=False, interactive_only=False,
                  compact=False, root_ref=None) -> Node:
    anchors: set = set()
    if root_ref is None:
        plan_skeleton_anchors(node, [], anchors)
    return _alloc(node, refmap, [], anchors, include_bounds, interactive_only, compact, root_ref)


def _entry(n: Node, path, root_ref) -> Entry:
    return Entry(n.role, n.name if non_blank(n.name) else None, list(n.actions),
                 n.bounds if (n.bounds and n.bounds.valid()) else None, tuple(path), root_ref)


def _alloc(node: Node, refmap: RefMap, path: list, anchors: set, include_bounds, interactive_only,
           compact, root_ref) -> Node:
    able = is_ref_able(node)
    if able:
        e = _entry(node, path, root_ref)
        if not include_bounds and has_meaningful_identity(node):
            e.bounds = None
        if can_receive_observed_ref(node):
            node.ref_id = refmap.allocate(e)
    is_anchor = (not able) and tuple(path) in anchors
    if is_anchor:
        e = _entry(node, path, None)
        e.actions = []
        if not include_bounds and has_meaningful_identity(node):
            e.bounds = None
        if can_receive_observed_ref(node):
            node.ref_id = refmap.allocate(e)
    if not include_bounds:
        node.bounds = None
    kept = []
    for idx, child in enumerate(node.children):
        collapsible = compact and is_collapsible(child)
        path.append(idx)
        child = _alloc(child, refmap, path, anchors, include_bounds, interactive_only, compact, root_ref)
        path.pop()
        if collapsible:
            if child.children:
                kept.append(child.children[0])
            continue
        if (interactive_only and child.ref_id is None and not is_ref_able(child)
                and not child.children and child.children_count is None):
            continue
        kept.append(child)
    node.children = kept
    return node


def count_nodes(n: Node) -> int:
    return 1 + sum(count_nodes(c) for c in n.children)


def count_refs(n: Node) -> int:
    return (1 if n.ref_id else 0) + sum(count_refs(c) for c in n.children)


def to_json_obj(n: Node, snapshot_id="s8f3k2p9") -> dict:
    """Serialization order follows AccessibilityNode: ref_id, role, name, value, description,
    native_id, hint, states, available_actions, bounds, children_count, subtree_truncated, children."""
    d = {}
    if n.ref_id:
        d["ref_id"] = f"@{snapshot_id}:e{n.ref_id[2:]}"
    d["role"] = n.role
    if n.name is not None:
        d["name"] = n.name
    if n.value is not None:
        d["value"] = n.value
    if n.description is not None:
        d["description"] = n.description
    if n.native_id is not None:
        d["native_id"] = {"kind": n.native_id_kind, "value": n.native_id}
    if n.hint is not None:
        d["hint"] = n.hint
    if n.states:
        d["states"] = n.states
    if n.actions:
        d["available_actions"] = n.actions
    if n.bounds is not None:
        d["bounds"] = {"x": n.bounds.x, "y": n.bounds.y, "width": n.bounds.w, "height": n.bounds.h}
    if n.children_count is not None:
        d["children_count"] = n.children_count
    if n.subtree_truncated:
        d["subtree_truncated"] = True
    if n.children:
        d["children"] = [to_json_obj(c, snapshot_id) for c in n.children]
    return d


def compact_json(n: Node, snapshot_id="s8f3k2p9") -> str:
    return json.dumps(to_json_obj(n, snapshot_id), separators=(",", ":"), ensure_ascii=False)


def is_wrapper(n: Node) -> bool:
    """A web wrapper: transparent role, no name/value/description/native id, no actions/states."""
    return (n.role == "group" and not non_blank(n.name) and not non_blank(n.value)
            and not non_blank(n.description) and n.native_id is None and not n.actions
            and not n.states)


def observe(n: Node, max_depth: int, logical_depth: int = 0) -> Node:
    """Depth-clamped observation. Wrapper nodes consume raw depth but no logical depth
    (docs/CONCEPTS.md 'Web Wrapper'). At the clamp, a node with children is replaced by a
    boundary that carries children_count (CONCEPTS.md 'a depth clamp knows how many children
    it skipped and says so')."""
    out = n.copy_shallow()
    if not n.children:
        return out
    if logical_depth >= max_depth:
        out.children_count = len(n.children)
        return out
    for c in n.children:
        step = 0 if is_wrapper(c) else 1
        out.children.append(observe(c, max_depth, logical_depth + step))
    return out
