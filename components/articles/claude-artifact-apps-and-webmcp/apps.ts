// The 61 demo apps @nopsnek posted on 24 November 2026, in the order of the
// posts. The posts name no app, so each caption describes what its screenshot
// shows. `post` is the post the screenshot came from (apps 1-20, 21-40, 41-60, 61).

export const POSTS = {
  p1: "https://x.com/nopsnek/status/2125339529393381587",
  p2: "https://x.com/nopsnek/status/2125342022144078172",
  p3: "https://x.com/nopsnek/status/2125342288595374424",
  p4: "https://x.com/nopsnek/status/2125342471903412367",
} as const

export type PostKey = keyof typeof POSTS

export type App = { n: number; title: string; what: string; post: PostKey }

const raw: [string, string][] = [
  ["Orbit tracker", "A globe of every catalogued object in Earth orbit since 1957, filtered by payloads, rocket bodies and debris, with a timeline of the catalogue's growth."],
  ["Incident map", "Help-desk tickets drawn as a graph around one root cause, an expired webhook certificate, with a drafted reply and a merge into one ticket."],
  ["Van charging planner", "Thirty-eight delivery vans as battery bars, sorted into those that make their routes and those that fall short, with a suggested route swap."],
  ["Crystal plate scorer", "A crystallisation screening plate of wells, one drop magnified, scored as crystals with a habit and a size, and queued for harvest."],
  ["Protein mutant viewer", "Two mutants of a protein overlaid in 3D, a loop highlighted, a measured shift at one residue and the sequence alignment below."],
  ["Orbit lesson", "A teaching simulator: change a launch speed and watch the orbit become a circle, an ellipse or an escape, with trails of past launches."],
  ["Wind farm wakes", "A wind farm layout with turbine wakes streaming downwind, a wind rose sweep and the farm's output under each layout variant."],
  ["Bioreactor monitor", "Six bioreactor vessels as small charts, one drifting with pH and oxygen falling together, and an alarm table below."],
  ["Observatory night plan", "A red night-mode sky chart for a dome: tonight's targets, a mount panel, camera exposures and a timeline of the night."],
  ["Outage replay", "An incident replayed service by service: errors climbing from a database lock up to the storefront, with a timeline and action items."],
  ["Line changeover clock", "A factory line changeover as a ring of ten steps around an elapsed-time clock, with the current step's settings and past changeovers."],
  ["Bridge defect log", "An elevation drawing of a masonry bridge span with numbered cracks, each with width, photos and a severity for the inspection report."],
  ["Slow query flame graph", "A database query traced as a flame graph, the sequential scan that takes most of the request found, and an index suggested."],
  ["Marathon plan", "A training block for a marathon as a week grid of runs, today's session large, weekly mileage bars and paces for each segment."],
  ["Robot arm reach", "A six-joint robot arm in its reach envelope, joint sliders, one target out of reach and one reachable, in a work cell."],
  ["Low tide planner", "Tide heights for a month, the next low-tide window on the rocks for a shore survey, and a kit list for the trip."],
  ["Creek gauge", "A creek cross-section with the water level rising toward a flood mark, alert thresholds and a hydrograph with a forecast."],
  ["Knitting chart", "A colourwork knitting chart for a sweater yoke, a knit preview, yarn colours and gauge, read right to left by band."],
  ["Glaze test tiles", "A wall of ceramic glaze test tiles, one opened with its recipe of materials, firing cone and atmosphere."],
  ["Shop shelf planner", "A corner shop's drinks shelves drawn product by product, sell-through per item and a facings change for one lemonade."],
  ["Apprentice skills map", "An electrician apprentice's skills as a honeycomb of tiles, signed off or pending, with the checklist for one test."],
  ["Geometry proof", "A geometry proof built step by step on a triangle with equilateral triangles on each side, the angles and lengths listed."],
  ["Pollinator network", "Flowers and bees from field walks linked by how often each bee visited each flower, with the observations table below."],
  ["Street tree map", "A city's street trees on a map, one London plane selected with its size, condition, work history and a scheduled crown lift."],
  ["Machine spindle", "An exploded drawing of a vertical mill's spindle, one bearing in red with its vibration spectrum and a work order to replace it."],
  ["Type design", "A typeface editor with a lowercase g's outline and its handles, a glyph grid, metrics, and weights from light to bold."],
  ["Knee rehab gauge", "Knee flexion after a replacement drawn as a gauge against the goal, weekly measurements and the exercise list."],
  ["Poem translation", "A poem set vertically in Japanese beside its English draft, linked words, and dictionary senses for the verb being translated."],
  ["Meeting question rings", "A facilitator's question for a meeting set in rings of follow-up questions, with an agenda, a timer and notes."],
  ["Film contact sheet", "A roll of black-and-white negatives as a contact sheet, one frame circled, rated and graded with a test strip for printing."],
  ["Nuclei counter", "A microscope field of stained cells with nuclei segmented and counted, channels, thresholds and a size histogram."],
  ["Warehouse pick routes", "A warehouse floor with a picker's route through the racks, the distance walked per route and suggested slot moves."],
  ["School air quality", "Schools on a hexagonal map coloured by fine-particle readings, one school flagged unhealthy with recess advice and a note to the principal."],
  ["Purchase order lines", "A purchase order's approval path drawn as a transit map of stations, showing where it waits and who to nudge."],
  ["Gene expression heatmap", "A clustered heatmap of gene expression across knockout mice, one cluster selected with its genes and fold changes."],
  ["Repo ownership atlas", "A monorepo's folders as nested circles coloured by owning team, one unowned folder selected with suggested owners."],
  ["Soil cores", "Twelve soil cores from a farm's fields drawn side by side with their horizons, organic carbon curve and lab results."],
  ["Seed bank drawers", "A seed bank's drawers as a wall, one drawer opened on a sea pea accession with germination trials over the years."],
  ["Novel shape", "A novel's chapters as tension bars along the book, a sagging middle circled, scene details and a writing session counter."],
  ["Coral reef transect", "Coral growth along a fifty-metre reef transect across years, one colony tracked, with photo quadrats along the tape."],
  ["Reagent shelf", "A lab's chemicals laid out as a periodic table, one reagent with stock left, expiry and location, and reorder flags."],
  ["Medication clock", "A day's medications on a clock face, the next dose and its timing, a schedule list and the people caring that day."],
  ["Sleep study scorer", "A night of sleep scored in stages on a hypnogram, the EEG signals below, and events for one epoch."],
  ["Guitar solo map", "A guitar solo traced on the fretboard as a path through a pentatonic scale, sections, and the backing tracks below."],
  ["Water main risk", "A town's water mains on a map coloured by decade laid, one cast-iron main marked to replace next, and a ranked risk table."],
  ["Bird call spectrogram", "A dawn recording as a spectrogram with calls labelled by species, the species heard before sunrise and confidence."],
  ["Packaging dieline", "A tea carton's flat dieline with panels, folds and dust flaps, a folded preview and preflight checks on overlaps."],
  ["Coffee roast log", "A coffee roast curve with drying, Maillard and development phases, first crack marked, beside past batches."],
  ["Hut water tanks", "A mountain route's huts on an elevation profile with their water tank levels, and a radio log from the wardens."],
  ["Palette contrast", "A colour palette as a grid of text on background pairs with contrast ratios and pass or fail marks, and a suggested shade."],
  ["Beetle phylogeny", "A circular tree of beetle species with drawings at its tips, one new species selected with its measurements and placement."],
  ["Fraction bars", "A classroom fractions lesson: three quarters shown equal to six eighths with coloured bars, and the lesson's pages."],
  ["Talk rehearsal", "A keynote rehearsal with the speaking pace drawn under the slide, rushed and lost moments marked and notes on each."],
  ["Snow plough routes", "A storm's plough routes on a dark city map, the share of lane-miles cleared, each plough's progress and radio calls."],
  ["Particle collision", "A detector event display with tracks and two muons, the candidate's invariant mass and the cuts that select it."],
  ["Paper map", "Thousands of papers in a field placed as stars on a map by topic, the reading queue and one paper's abstract."],
  ["Circuit board trace", "A circuit board layout with one tuned trace highlighted between two chips, its length and the matched net table."],
  ["Main Street facades", "A street's historic shopfronts drawn as an elevation, one building's protected features listed for a permit decision."],
  ["Reaction mechanisms", "An organic chemistry drill: draw the curly arrows of an aldol addition step by step, with a deck of reactions to practise."],
  ["Glacier outlines", "A glacier's front traced year by year on a contour map, how far it retreated each year and since the first survey."],
  ["Passage planner", "A sailing passage across a nautical chart with waypoints, tidal streams, a tide gate's open window, and the wind forecast."],
]

export const APPS: App[] = raw.map(([title, what], i) => {
  const n = i + 1
  const post: PostKey = n <= 20 ? "p1" : n <= 40 ? "p2" : n <= 60 ? "p3" : "p4"
  return { n, title, what, post }
})

export const appSrc = (n: number, size: "sm" | "full") =>
  `/articles/claude-artifact-apps-and-webmcp/apps/app-${String(n).padStart(2, "0")}${size === "sm" ? "-sm" : ""}.webp`
