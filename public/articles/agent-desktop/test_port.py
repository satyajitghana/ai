"""Checks of axport.py against the cases in the repository's own Rust tests.
Source tests: crates/core/src/snapshot/skeleton_anchor_tests.rs, snapshot_tests.rs,
and tests/fixtures/skeleton-tree.json. Run: python3 test_port.py path/to/skeleton-tree.json"""
import json, sys
from axport import *

GOLDEN = sys.argv[1] if len(sys.argv) > 1 else 'agent-desktop/tests/fixtures/skeleton-tree.json'  # tests/fixtures/skeleton-tree.json in a clone of vercel-labs/agent-desktop
ok = 0

def check(name, cond):
    global ok
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        sys.exit(1)
    ok += 1

def alloc(root, **kw):
    rm = RefMap()
    out = allocate_refs(root, rm, **kw)
    return out, rm

# 1. golden skeleton fixture (test_skeleton_fixture_matches_golden)
sidebar = Node("group", name="Sidebar", children_count=26)
described = Node("group", description="Channels and direct messages", children_count=12)
content = Node("group", name="Content", children=[Node("button", name="Send"), Node("textfield", name="Message")])
root = Node("window", name="Test Window", children=[sidebar, described, content])
out, rm = alloc(root)
got = to_json_obj(out)
# the golden file serialises refs unqualified: undo the snapshot qualification for comparison
def unq(d):
    if "ref_id" in d: d["ref_id"] = "@e" + d["ref_id"].split(":e")[1]
    for c in d.get("children", []): unq(c)
    return d
got = unq(got)
golden = json.load(open(GOLDEN))
check("golden skeleton-tree.json reproduced exactly", got == golden)
check("golden: 4 refs, Content container has none", len(rm) == 4 and out.children[2].ref_id is None)

# 2. native-id ancestor covers unnamed boundaries
sv = Node("group", native_id="main, SidebarNavigationSplitView")
sv.children = [Node("group", children_count=1) for _ in range(3)]
out, rm = alloc(Node("window", children=[sv]))
check("native_id ancestor gets the ref, unnamed boundaries do not",
      out.children[0].ref_id and all(b.ref_id is None for b in out.children[0].children) and len(rm) == 1)

# 3. web boundary with only ubiquitous affordances gets an anchor with actions emptied
b = Node("group", name="Task list", actions=["RightClick", "ScrollTo"], children_count=40)
out, rm = alloc(Node("window", children=[b]))
e = rm.get(out.children[0].ref_id)
check("ubiquitous-affordance boundary gets an anchor ref, entry actions empty", e.actions == [] and len(rm) == 1)

# 4. unlabeled bounded boundary gets a drill ref and the entry keeps its rect
b = Node("group", children_count=5, bounds=Rect(10, 20, 300, 400))
out, rm = alloc(Node("window", children=[b]))
e = rm.get(out.children[0].ref_id)
check("unlabeled bounded boundary: ref allocated, node bounds hidden, entry keeps rect",
      out.children[0].ref_id and out.children[0].bounds is None and e.bounds is not None)

# 5. named bounded boundary still has its rect stripped
b = Node("group", name="Sidebar", children_count=5, bounds=Rect(10, 20, 300, 400))
out, rm = alloc(Node("window", children=[b]))
check("named bounded boundary: entry rect stripped", rm.get(out.children[0].ref_id).bounds is None)

# 6. deepest resolvable anchor wins
bd = Node("group", children_count=5, bounds=Rect(10, 20, 300, 400))
sv = Node("group", native_id="split-view", children=[bd])
out, rm = alloc(Node("window", children=[sv]))
check("deepest resolvable anchor wins (outer none, inner ref, 1 ref total)",
      out.children[0].ref_id is None and out.children[0].children[0].ref_id and len(rm) == 1)

# 7. described container gets a ref; truncated node survives interactive_only
out, rm = alloc(Node("window", children=[Node("group", description="Channels and direct messages", children_count=12)]))
check("described container gets a ref", out.children[0].ref_id and len(rm) == 1)
out, rm = alloc(Node("window", children=[Node("group", name="Content", children_count=10)]), interactive_only=True)
check("truncated node survives interactive_only", len(out.children) == 1 and out.children[0].children_count == 10)

# 8. drill-down never creates skeleton anchors
out, rm = alloc(Node("window", children=[Node("group", name="Sidebar", children_count=5)]), root_ref="@e3")
check("drill-down (root_ref set): no anchors, refmap empty", out.children[0].ref_id is None and len(rm) == 0)

print(f"\n{ok} checks passed")
