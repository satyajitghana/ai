"""Two synthetic accessibility trees, deterministic by seed.  THESE ARE TOYS: shapes follow what
agent-desktop's docs describe (native shallow trees; Electron trees with chains of anonymous
wrapper groups), but they are not recordings of any real application."""
import random
from axport import Node, Rect

WORDS = ("the a project design review launch update team notes meeting budget draft ship fix bug "
         "release plan roadmap customer feedback metrics dashboard deploy staging prod rollback "
         "docs onboarding hiring sprint demo retro backlog priority blocked done thanks please "
         "can we should look into this morning tomorrow today quick question about migration "
         "latency cache queue worker index table schema build test lint green red flaky").split()
NAMES = ["Ana", "Ben", "Chidi", "Dara", "Eli", "Farah", "Gus", "Hana", "Ivo", "Jun"]
CHANNELS = ["general", "random", "design", "eng", "infra", "support", "sales", "ops", "launch",
            "incidents", "docs", "hiring", "data", "mobile", "web", "security", "finance", "legal"]


def sentence(rng, lo=6, hi=22):
    return " ".join(rng.choice(WORDS) for _ in range(rng.randint(lo, hi))).capitalize() + "."


def wrappers(rng, depth, child):
    """A chain of anonymous web wrapper groups ending in `child`."""
    n = child
    for _ in range(depth):
        n = Node("group", children=[n])
    return n


def file_manager(seed=1, rows=120):
    rng = random.Random(seed)
    bar = Node("group", name="Toolbar", children=[Node("button", name=n, actions=["Click"])
              for n in ["Back", "Forward", "Up", "View", "Sort", "Share", "Tags", "Get Info", "More"]]
              + [Node("textfield", name="Search", actions=["SetValue"])])
    side = []
    for sec, items in [("Favorites", ["AirDrop", "Recents", "Applications", "Desktop", "Documents", "Downloads"]),
                       ("iCloud", ["iCloud Drive", "Shared", "Desktop"]),
                       ("Locations", ["Macintosh HD", "Network", "Backup", "Camera", "Cloud"]),
                       ("Tags", ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Gray"])]:
        side.append(Node("group", name=sec, children=[Node("treeitem", name=i, actions=["Click"]) for i in items]))
    sidebar = Node("outline", name="Sidebar", children=side)
    table = []
    for r in range(rows):
        fname = f"{rng.choice(WORDS)}-{rng.choice(WORDS)}-{r:03d}.{rng.choice(['pdf', 'png', 'txt', 'zip', 'mov'])}"
        table.append(Node("row", children=[
            Node("cell", name=fname, actions=["Click"]),
            Node("cell", value=f"{rng.randint(1, 28)} Oct 2026 at {rng.randint(8, 22)}:{rng.randint(10, 59)}", actions=["Click"]),
            Node("cell", value=f"{rng.randint(1, 900)} {rng.choice(['KB', 'MB'])}", actions=["Click"]),
        ]))
    content = Node("table", name="Downloads", children=table)
    status = Node("statictext", name=f"{rows} items, 54.2 GB available")
    return Node("window", name="Downloads", children=[bar, Node("group", children=[sidebar, content]), status])


def chat_app(seed=2, messages=150):
    rng = random.Random(seed)
    chans = []
    for i, c in enumerate(CHANNELS * 3):
        name = f"# {c}" if i < len(CHANNELS) else (f"# {c}-{i}" if i < 2 * len(CHANNELS) else f"{rng.choice(NAMES)} {rng.choice(NAMES)}")
        chans.append(wrappers(rng, 2, Node("link", name=name, actions=["Click"],
                     children=[wrappers(rng, 1, Node("statictext", name=name))])))
    sidebar = Node("group", name="Channels and direct messages", children=chans)
    msgs = []
    for i in range(messages):
        who = rng.choice(NAMES)
        reacts = [Node("button", name=f"{rng.choice(['thumbsup', 'eyes', 'tada', 'heart'])} {rng.randint(1, 9)}", actions=["Click"])
                  for _ in range(rng.randint(0, 3))]
        body = Node("statictext", name=sentence(rng))
        parts = [Node("statictext", name=who), Node("statictext", name=f"{rng.randint(8, 22)}:{rng.randint(10, 59)}"),
                 wrappers(rng, 2, body)]
        if reacts:
            parts.append(Node("group", name="Reactions", children=reacts))
        parts += [Node("button", name="Reply in thread", actions=["Click"]), Node("button", name="More actions", actions=["Click"])]
        container = Node("group", native_id=f"msg-{1000 + i}", native_id_kind="DomId", children=parts)
        msgs.append(wrappers(rng, 3, container))
    messages_region = Node("group", name="Messages", children=msgs)
    composer = Node("group", name="Composer", children=[
        wrappers(rng, 3, Node("textfield", name="Message #design", actions=["SetValue"])),
        Node("button", name="Attach", actions=["Click"]), Node("button", name="Emoji", actions=["Click"]),
        Node("button", name="Send", actions=["Click"])])
    header = Node("group", name="Channel header", children=[Node("heading", name="# design"),
                  Node("button", name="Channel details", actions=["Click"]), Node("button", name="Huddle", actions=["Click"])])
    doc = Node("group", name="Acme Slack", children=[wrappers(rng, 5, Node("group", children=[sidebar, Node("group", children=[header, messages_region, composer])]))])
    return Node("window", name="Slack - acme", children=[doc])


def find_by_name(n: Node, name: str):
    if n.name == name:
        return n
    for c in n.children:
        r = find_by_name(c, name)
        if r:
            return r
    return None
