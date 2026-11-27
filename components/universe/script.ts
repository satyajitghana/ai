// The /universe talk as data: twenty-eight scenes, their beats, the speaker note for each beat and the
// sources behind every number. No three.js here, so the server page can print the whole talk as
// text and the deck can show notes and sources before a single shader has compiled.
//
// Rules this file keeps:
// - Every number in `head`, `sub`, `note` or `page` is stated by a page or abstract listed in that
//   beat's `src` (keys into SOURCES), or is arithmetic on such numbers and says so. Geological
//   boundary ages are from the International Chronostratigraphic Chart v2026/06.
// - Where the science is unsettled (the earliest life, the first star, the snowball) the beat gives
//   the range and says it is debated.
// - `ill: true` marks a beat whose picture is a staged drawing of the idea, not a measurement or a
//   photograph. That is nearly all of them: this is a talk, and the scenery is scenery.
// - `page` is what the corner of the slide prints. After the white template it stops being a page
//   number and becomes the clock: time since the Big Bang at first, then years before today, then
//   (from the first tablets on) calendar years. In the ages of people it steps back four times,
//   because the ages overlap (die, question, fold, loom); the notes say so out loud. The running
//   measure of how fast things are moving is not the corner clock but the rule of ages
//   (RULE_MILESTONES, below).

export type Source = { label: string; url: string }

export const SOURCES = {
  planck: {
    label: "Planck Collaboration 2018, results VI: cosmological parameters (Table 2, age 13.787 ± 0.020 Gyr)",
    url: "https://arxiv.org/abs/1807.06209",
  },
  nasaInflation: {
    label: "NASA Goddard, Cosmic Times: Inflation (factor of 10^26 in a fraction of a second)",
    url: "https://imagine.gsfc.nasa.gov/educators/programs/cosmictimes/educators/guide/1993/inflation.html",
  },
  nasaUniverse: { label: "NASA Science: Universe overview", url: "https://science.nasa.gov/universe/overview/" },
  esaCmb: {
    label: "ESA: Planck and the cosmic microwave background",
    url: "https://www.esa.int/Science_Exploration/Space_Science/Planck/Planck_and_the_cosmic_microwave_background",
  },
  naidu: {
    label: "Naidu et al. 2025, A Cosmic Miracle: a remarkably luminous galaxy at z = 14.44 confirmed with JWST",
    url: "https://arxiv.org/abs/2505.11263",
  },
  stsci: {
    label: "STScI news release 2026-107: Webb pushes boundaries of observable universe closer to Big Bang",
    url: "https://www.stsci.edu/contents/news-releases/2026/news-2026-107",
  },
  carniani: {
    label: "Carniani et al. 2024, Spectroscopic confirmation of two luminous galaxies at z ~ 14 (Nature)",
    url: "https://arxiv.org/abs/2405.18485",
  },
  xiang: {
    label: "Xiang & Rix 2022, A time-resolved picture of our Milky Way's early formation history (Nature)",
    url: "https://doi.org/10.1038/s41586-022-04496-5",
  },
  nasaGalaxies: { label: "NASA Science: Galaxies", url: "https://science.nasa.gov/universe/galaxies/" },
  nasaSun: { label: "NASA Science: Sun facts", url: "https://science.nasa.gov/sun/facts/" },
  usgs: { label: "USGS: Age of the Earth", url: "https://pubs.usgs.gov/gip/geotime/age.html" },
  nasaMoon: { label: "NASA Science: Moon formation", url: "https://science.nasa.gov/moon/formation/" },
  wilde: {
    label: "Wilde et al. 2001, Evidence from detrital zircons for the existence of continental crust and oceans on the Earth 4.4 Gyr ago (Nature)",
    url: "https://doi.org/10.1038/35051550",
  },
  nutman: {
    label: "Nutman et al. 2016, Rapid emergence of life shown by discovery of 3,700-million-year-old microbial structures (Nature)",
    url: "https://doi.org/10.1038/nature19355",
  },
  dodd: {
    label: "Dodd et al. 2017, Evidence for early life in Earth's oldest hydrothermal vent precipitates (Nature)",
    url: "https://doi.org/10.1038/nature21377",
  },
  gumsley: {
    label: "Gumsley et al. 2017, Timing and tempo of the Great Oxidation Event (PNAS)",
    url: "https://doi.org/10.1073/pnas.1608824114",
  },
  ostrander: {
    label: "Ostrander et al. 2024, Onset of coupled atmosphere-ocean oxygenation 2.3 billion years ago (Nature)",
    url: "https://doi.org/10.1038/s41586-024-07551-5",
  },
  lyons: {
    label: "Lyons, Reinhard & Planavsky 2014, The rise of oxygen in Earth's early ocean and atmosphere (Nature)",
    url: "https://doi.org/10.1038/nature13068",
  },
  ics: {
    label: "International Commission on Stratigraphy: International Chronostratigraphic Chart v2026/06",
    url: "https://stratigraphy.org/ICSchart/ChronostratChart2026-06.pdf",
  },
  hoffman: {
    label: "Hoffman et al. 1998, A Neoproterozoic snowball Earth (Science)",
    url: "https://doi.org/10.1126/science.281.5381.1342",
  },
  bobrovskiy: {
    label: "Bobrovskiy et al. 2018, Ancient steroids establish the Ediacaran fossil Dickinsonia as one of the earliest animals (Science)",
    url: "https://doi.org/10.1126/science.aat7228",
  },
  nhmDino: {
    label: "Natural History Museum, London: When did dinosaurs live?",
    url: "https://www.nhm.ac.uk/discover/when-did-dinosaurs-live.html",
  },
  jpl: {
    label: "NASA JPL: More evidence points to impact as dinosaur killer",
    url: "https://www.jpl.nasa.gov/news/more-evidence-points-to-impact-as-dinosaur-killer/",
  },
  renne: {
    label: "Renne et al. 2013, Time scales of critical events around the Cretaceous-Paleogene boundary (Science)",
    url: "https://doi.org/10.1126/science.1230492",
  },
  siSapiens: {
    label: "Smithsonian Human Origins: Homo sapiens",
    url: "https://humanorigins.si.edu/evidence/human-fossils/species/homo-sapiens",
  },
  siWorld: {
    label: "Smithsonian Human Origins: Humans change the world",
    url: "https://humanorigins.si.edu/human-characteristics/humans-change-world",
  },
  hublin: {
    label: "Hublin et al. 2017, New fossils from Jebel Irhoud, Morocco and the pan-African origin of Homo sapiens (Nature)",
    url: "https://doi.org/10.1038/nature22336",
  },
  antiquity: {
    label: "Antiquity 2024: Rolling back the origins of writing (news summary of doi 10.15184/aqy.2024.165)",
    url: "https://www.antiquity.ac.uk/index.php/news/2024/rolling-back-origins-writing",
  },
  nasaSputnik: {
    label: "NASA History: Sputnik and the dawn of the space age",
    url: "https://www.nasa.gov/history/sputnik/index.html",
  },
  // ── Acts III and IV (scenes 12 to 26) ──
  // spark
  harmand: {
    label: "Harmand et al. 2015, 3.3-million-year-old stone tools from Lomekwi 3, West Turkana, Kenya (Nature)",
    url: "https://doi.org/10.1038/nature14464",
  },
  siTools: {
    label: "Smithsonian Human Origins: Stone tools (toolmaking by at least 2.6 million years ago; handaxes by about 1.76 million)",
    url: "https://humanorigins.si.edu/evidence/behavior/stone-tools",
  },
  lepre: { label: "Lepre et al. 2011, An earlier origin for the Acheulian (Nature)", url: "https://doi.org/10.1038/nature10372" },
  siHearths: {
    label: "Smithsonian Human Origins: Hearths and shelters (earliest hearths at least 790,000 years old)",
    url: "https://humanorigins.si.edu/evidence/behavior/hearths-shelters",
  },
  gorenInbar: {
    label: "Goren-Inbar et al. 2004, Evidence of hominin control of fire at Gesher Benot Ya'aqov, Israel (Science)",
    url: "https://doi.org/10.1126/science.1095443",
  },
  berna: {
    label: "Berna et al. 2012, Microstratigraphic evidence of in situ fire in the Acheulean strata of Wonderwerk Cave (PNAS)",
    url: "https://doi.org/10.1073/pnas.1117620109",
  },
  davisBarnham: {
    label: "Davis et al. 2025, Earliest evidence of making fire (Nature, online 10 December 2025)",
    url: "https://doi.org/10.1038/s41586-025-09855-6",
  },
  // hands
  oktaviana2026: {
    label: "Oktaviana et al. 2026, Rock art from at least 67,800 years ago in Sulawesi (Nature)",
    url: "https://doi.org/10.1038/s41586-025-09968-y",
  },
  oktaviana2024: {
    label: "Oktaviana et al. 2024, Narrative cave art in Indonesia by 51,200 years ago (Nature)",
    url: "https://doi.org/10.1038/s41586-024-07541-7",
  },
  hoffmann: {
    label: "Hoffmann et al. 2018, U-Th dating of carbonate crusts reveals Neandertal origin of Iberian cave art (Science)",
    url: "https://doi.org/10.1126/science.aap7778",
  },
  slimak: {
    label: "Slimak et al. 2018, Comment on Hoffmann et al.: the dates are questioned (Science)",
    url: "https://doi.org/10.1126/science.aau1371",
  },
  chauvet: {
    label: "French Ministry of Culture: Chauvet-Pont d'Arc cave, Aurignacian cave art (first use around 36,500 years ago)",
    url: "https://archeologie.culture.gouv.fr/chauvet/en/aurignacian-cave-art",
  },
  chauvetTorch: {
    label: "French Ministry of Culture: Chauvet-Pont d'Arc cave, the Gravettian presence (torch smears on the walls)",
    url: "https://archeologie.culture.gouv.fr/chauvet/en/gravettian-presence",
  },
  bradshawHands: {
    label: "Bradshaw Foundation: Hand stencils with missing fingers (Gargas: 114 of 231)",
    url: "https://bradshawfoundation.com/hands/hand_stencils_missing_fingers/index.php",
  },
  // tablet
  kelley: {
    label: "Kelley, Cartolano & Ferrara 2024, Seals and signs: tracing the origins of writing in ancient South-west Asia (Antiquity)",
    url: "https://doi.org/10.15184/aqy.2024.165",
  },
  willigen: {
    label: "van Willigen et al. 2024, New evidence for prehistoric ploughing in Europe (Humanities and Social Sciences Communications)",
    url: "https://doi.org/10.1057/s41599-024-02837-5",
  },
  hamburgPrints: {
    label: "University of Hamburg, Centre for the Study of Manuscript Cultures: What can we learn from fingerprints on clay?",
    url: "https://www.csmc.uni-hamburg.de/publications/mesopotamia/2019-08-31.html",
  },
  // metal
  mcBronze: {
    label: "French Ministry of Culture, archaeology glossary: Bronze Age (3000 to 1000 BC, with substantial variations by area)",
    url: "https://archeologie.culture.gouv.fr/archeo-sous-marine/en/glossary/bronze-age",
  },
  ashmoleanBronze: {
    label: "Ashmolean Museum, British Archaeology Collections: Bronze Age (2300 BC to 800 BC)",
    url: "https://britisharchaeology.ashmus.ox.ac.uk/collections/bronze-age.html",
  },
  ashmoleanIron: {
    label: "Ashmolean Museum, British Archaeology Collections: Iron Age (800 BC to AD 43)",
    url: "https://britisharchaeology.ashmus.ox.ac.uk/collections/iron-age.html",
  },
  gettyPatina: { label: "Getty: Bronze patinas, noble and vile", url: "https://www.getty.edu/news/bronze-patinas-noble-and-vile/" },
  londonMould: {
    label: "London Museum: fragments of a clay sword mould, Late Bronze Age",
    url: "https://www.londonmuseum.org.uk/collections/v/object-1005239/mould-sword-mould/",
  },
  jungScale: {
    label: "Jung, Kwon & Cho 2022, Smithing processes based on hammer scale from ancient iron-making sites (Materials)",
    url: "https://doi.org/10.3390/ma15124188",
  },
  // gearwork
  freeth2006: {
    label: "Freeth et al. 2006, Decoding the ancient Greek astronomical calculator known as the Antikythera Mechanism (Nature)",
    url: "https://doi.org/10.1038/nature05357",
  },
  freeth2021: {
    label: "Freeth et al. 2021, A model of the cosmos in the ancient Greek Antikythera Mechanism (Scientific Reports)",
    url: "https://doi.org/10.1038/s41598-021-84310-w",
  },
  isaw4: {
    label: "Freeth & Jones 2012, The cosmos in the Antikythera Mechanism (ISAW Papers 4)",
    url: "https://dlib.nyu.edu/awdl/isaw/isaw-papers/4/",
  },
  freethSciAm: {
    label: "Freeth 2009, Decoding an Ancient Computer (Scientific American; university-hosted copy): a gear with 223 teeth drives the Saros dial",
    url: "https://www.cs.virginia.edu/~robins/Decoding_an_Ancient_Computer.pdf",
  },
  carman: {
    label: "Carman & Evans 2014, On the epoch of the Antikythera mechanism and its eclipse predictor (Archive for History of Exact Sciences)",
    url: "https://doi.org/10.1007/s00407-014-0145-5",
  },
  // press
  locGutenberg: {
    label: "Library of Congress: The Gutenberg Bible, a resource guide (Mainz, 1454/1455; perhaps as many as 180 copies)",
    url: "https://guides.loc.gov/gutenberg",
  },
  locGutenbergFaq: {
    label: "Library of Congress: Gutenberg Bible resource guide, questions (42 lines in each of two columns)",
    url: "https://guides.loc.gov/gutenberg/questions",
  },
  locAsiaPrint: {
    label: "Library of Congress: The history of printing in Asia, part 1 (Bi Sheng, 1041 to 1048)",
    url: "https://blogs.loc.gov/international-collections/2021/06/the-history-of-printing-in-asia-according-to-library-of-congress-asian-collections-part-1/",
  },
  bnfJikji: {
    label: "Bibliothèque nationale de France: Jikji, a treasure of the world of printing (1377)",
    url: "https://www.bnf.fr/en/jikji-treasure-world-printing",
  },
  mainzType: { label: "City of Mainz: Gutenberg's invention (mirror-image letters)", url: "https://www.mainz.de/en/microsite/gutenberg/erfindung/" },
  apha: { label: "American Printing History Association: History of printing timeline (ink rollers, 1810)", url: "https://printinghistory.org/timeline/" },
  owidBooks: {
    label: "Our World in Data: Production of printed books per half century (data: Buringh & van Zanden 2009)",
    url: "https://ourworldindata.org/grapher/production-printed-books-half-century",
  },
  // lens
  sidereus: {
    label: "Galileo 1610, Sidereus Nuncius, translated by A. Van Helden (excerpt, Central Connecticut State University)",
    url: "https://bertie.ccsu.edu/naturesci/Cosmology/GalileoStarry.html",
  },
  riceGalileo: {
    label: "Rice University, The Galileo Project: Satellites of Jupiter",
    url: "https://galileo.library.rice.edu/sci/observations/jupiter_satellites.html",
  },
  museoGalileo: {
    label: "Museo Galileo, Florence: Galileo's telescope, inv. 2428 (magnification 21)",
    url: "https://catalogue.museogalileo.it/object/GalileosTelescope_n01.html",
  },
  newton1672: {
    label: "Newton 1672, A letter containing his new theory about light and colors (Philosophical Transactions 80; text at the Newton Project)",
    url: "https://www.newtonproject.ox.ac.uk/view/texts/normalized/NATP00006",
  },
  bodleianSR: {
    label: "Bodleian Libraries, History Faculty Library 2020: the Scientific Revolution, usually dated from Copernicus (1543) to Newton's Principia (1687)",
    url: "https://blogs.bodleian.ox.ac.uk/history/2020/04/30/bodleian-new-history-ebooks-april-2020-science-and-the-occult/",
  },
  // engine
  smNewcomen: { label: "Science Museum: In pursuit of power (Newcomen's engine, 1712)", url: "https://blog.sciencemuseum.org.uk/a-new-age/" },
  smWatt: {
    label: "Science Museum: James Watt and the separate condenser (patent, 5 January 1769)",
    url: "https://blog.sciencemuseum.org.uk/james-watt-and-the-separate-condenser/",
  },
  asmeWatt: {
    label: "ASME landmark brochure: Boulton and Watt rotative steam engine, 1785 (20 to 21 strokes per minute; governor, 1788)",
    url: "https://www.asme.org/wwwasmeorg/media/resourcefiles/aboutasme/who%20we%20are/engineering%20history/landmarks/111-boulton-watt-rotative-steam-engine.pdf",
  },
  freeth2006supp: {
    label: "Freeth et al. 2006, Decoding the Antikythera Mechanism, Supplementary Notes 3 (gear table and tooth counts)",
    url: "https://web.archive.org/web/20130126213307/http://www.antikythera-mechanism.gr/system/files/0608_Nature-Supplementary.pdf",
  },
  pdb1pga: {
    label: "RCSB PDB 1PGA: protein G B1 domain, X-ray (Gallagher et al. 1994); backbone drawn in the fold beat",
    url: "https://www.rcsb.org/structure/1PGA",
  },
  wikiGame6: {
    label: "Wikipedia, Deep Blue versus Garry Kasparov: game 6 score and final position after 19.c4 (citing Pandolfini 1997, p. 160)",
    url: "https://en.wikipedia.org/wiki/Deep_Blue_versus_Garry_Kasparov",
  },
  wikiSunPlanet: {
    label: "Wikipedia: Sun and planet gear (Watt's alternative to the crank; the shaft turns twice per double stroke)",
    url: "https://en.wikipedia.org/wiki/Sun_and_planet_gear",
  },
  powerhouse: {
    label: "Powerhouse Museum: Boulton and Watt rotative steam engine (the governor as the first feedback device on an engine)",
    url: "https://collection.powerhouse.com.au/object/7177",
  },
  rutgersLamp: {
    label: "Thomas A. Edison Papers, Rutgers: The carbon-filament lamp (22 October 1879, 13 1/2 hours)",
    url: "https://edison.rutgers.edu/life-of-edison/biographical-essays/lighting/the-carbon-filament-lamp",
  },
  energyBulb: { label: "US Department of Energy: The history of the light bulb (tungsten filament, 1904)", url: "https://www.energy.gov/articles/history-light-bulb" },
  ethwPearl: {
    label: "IEEE Milestone: Pearl Street Station, 1882 (4 September; 85 customers, about 400 lamps)",
    url: "https://ethw.org/Milestones:Pearl_Street_Station,_1882",
  },
  ethwBulbs: { label: "Engineering and Technology History Wiki: Early light bulbs (Joseph Swan)", url: "https://ethw.org/Early_Light_Bulbs" },
  // footprint
  nasmFlyer: {
    label: "Smithsonian National Air and Space Museum: 1903 Wright Flyer (17 December 1903; 12 seconds, 120 ft)",
    url: "https://airandspace.si.edu/collection-objects/1903-wright-flyer/nasm_A19610048000",
  },
  doeTrinity: {
    label: "US Department of Energy, Manhattan Project history: The Trinity test (16 July 1945)",
    url: "https://www.osti.gov/opennet/manhattan-project-history/Events/1945/trinity.htm",
  },
  nasaGagarin: {
    label: "NASA Science: Yuri Gagarin, first human in space (12 April 1961, 108 minutes)",
    url: "https://science.nasa.gov/resource/yuri-gagarin-first-human-in-space/",
  },
  nssdcApollo11: {
    label: "NASA NSSDCA: Apollo 11 Lunar Module (landed 20:17:40 UT, 20 July 1969)",
    url: "https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C",
  },
  alsjImages: {
    label: "Apollo Lunar Surface Journal: Apollo 11 image library (AS11-40-5877, Aldrin's bootprint for the soil mechanics experts)",
    url: "https://apollojournals.org/alsj/a11/images11.html",
  },
  alsjStars: { label: "Apollo Lunar Surface Journal: Photographing stars", url: "https://apollojournals.org/alsj/alsj-stars.html" },
  alsjSky: {
    label: "Apollo Lunar Surface Journal: The Apollo 11 moonwalk pictures (Earth almost 60 degrees above the horizon)",
    url: "https://apollojournals.org/alsj/a11/a11_eva_thumbs.html",
  },
  nasmOvershoes: {
    label: "Smithsonian National Air and Space Museum: Overshoes of the last man on the Moon (the lunar overshoe's tread)",
    url: "https://airandspace.si.edu/stories/editorial/overshoes-last-man-moon",
  },
  alsjReseau: {
    label: "Apollo Lunar Surface Journal: Reseau marks on the Hasselblad film (the 5 by 5 grid of crosses)",
    url: "https://apollojournals.org/alsj/alsj-reseau.html",
  },
  nasaRegolith: {
    label: "NASA Science: Leveraging lunar regolith (no wind or water, so the dust keeps sharp edges)",
    url: "https://science.nasa.gov/biological-physical/leveraging-lunar-regolith-to-further-space-exploration/",
  },
  // die
  chmTransistor: {
    label: "Computer History Museum: 1947, invention of the point-contact transistor (16 December 1947)",
    url: "https://www.computerhistory.org/siliconengine/invention-of-the-point-contact-transistor/",
  },
  intel4004: {
    label: "Intel: Intel 4004 fun facts (15 November 1971; 2,300 transistors)",
    url: "https://download.intel.com/newsroom/kits/40thanniversary/pdfs/40_years_of_processors_facts.pdf",
  },
  appleM3: {
    label: "Apple Newsroom, 30 October 2023: M3, M3 Pro and M3 Max (M3 Max: 92 billion transistors)",
    url: "https://www.apple.com/newsroom/2023/10/apple-unveils-m3-m3-pro-and-m3-max-the-most-advanced-chips-for-a-personal-computer/",
  },
  ethwTat8: {
    label: "IEEE Milestone: TAT-8, the first fibre-optic cable to cross an ocean (14 December 1988; 40,000 telephone circuits)",
    url: "https://ethw.org/Milestones:Trans-Atlantic_Telephone_Fiber-Optic_Submarine_Cable_(TAT-8),_1988",
  },
  ituCables: {
    label: "ITU, Global Connectivity Report 2025, chapter 3 (submarine cables carry over 99 per cent of international data flows)",
    url: "https://www.itu.int/itu-d/reports/statistics/2025/11/17/gcr-2025-chapter-3/",
  },
  cernWeb: {
    label: "CERN: A short history of the Web (first proposal, March 1989)",
    url: "https://home.cern/science/computing/the-birth-of-the-web/short-history-web/",
  },
  tgCables: {
    label: "TeleGeography: Submarine cable frequently asked questions (as wide as a garden hose)",
    url: "https://www2.telegeography.com/submarine-cable-faqs-frequently-asked-questions",
  },
  icpcCables: {
    label: "International Cable Protection Committee: About submarine telecommunications cables (no armour in the deep ocean)",
    url: "https://www.iscpc.org/documents/?id=1753",
  },
  // question
  turing: {
    label: "Turing 1950, Computing Machinery and Intelligence (Mind LIX, no. 236, October 1950)",
    url: "https://doi.org/10.1093/mind/LIX.236.433",
  },
  dartmouth: {
    label: "McCarthy, Minsky, Rochester & Shannon, A proposal for the Dartmouth summer research project on artificial intelligence, 31 August 1955",
    url: "http://www-formal.stanford.edu/jmc/history/dartmouth/dartmouth.html",
  },
  nilsson: {
    label: "Nilsson 2010, The Quest for Artificial Intelligence (Cambridge University Press; author's copy)",
    url: "https://ai.stanford.edu/~nilsson/QAI/qai.pdf",
  },
  lighthill: {
    label: "Lighthill, Artificial Intelligence: a general survey, July 1972 (Science Research Council)",
    url: "http://www.chilton-computing.org.uk/inf/literature/reports/lighthill_report/p001.htm",
  },
  toosi: { label: "Toosi et al. 2021, A brief history of AI: how to prevent another winter", url: "https://arxiv.org/abs/2109.01517" },
  // board
  ibmDeepBlue: { label: "IBM Heritage: Deep Blue (3.5 to 2.5; 200 million positions per second)", url: "https://www.ibm.com/history/deep-blue" },
  chmDeepBlue: {
    label: "Computer History Museum, Mastering the Game: Deep Blue v Kasparov (11 May 1997)",
    url: "https://www.computerhistory.org/chess/main.php?sec=thm-42f15cec6680f&sel=thm-42f15d3399c41",
  },
  deepmindAlphaGo: { label: "Google DeepMind: AlphaGo (4 to 1 in Seoul, March 2016)", url: "https://deepmind.google/research/breakthroughs/alphago/" },
  googleSeoul: {
    label: "Hassabis 2016, What we learned in Seoul with AlphaGo (move 37: a 1 in 10,000 chance of being played by a human)",
    url: "https://blog.google/technology/ai/what-we-learned-in-seoul-with-alphago/",
  },
  sgfGame2: {
    label: "Game record (SGF), AlphaGo v Lee Sedol, game 2, 10 March 2016: move 37 is B[oj], which is P10",
    url: "https://homepages.cwi.nl/~aeb/go/games/games/AlphaGo/LeeSedol/2.sgf",
  },
  // fold
  russakovsky: {
    label: "Russakovsky et al. 2015, ImageNet Large Scale Visual Recognition Challenge (IJCV)",
    url: "https://arxiv.org/abs/1409.0575",
  },
  krizhevsky: {
    label: "Krizhevsky, Sutskever & Hinton 2012, ImageNet classification with deep convolutional neural networks (NeurIPS, paper PDF)",
    url: "https://proceedings.neurips.cc/paper_files/paper/2012/file/c399862d3b9d6b76c8436e924a68c45b-Paper.pdf",
  },
  deepmindCasp14: {
    label: "DeepMind, 30 November 2020: AlphaFold, a solution to a 50-year-old grand challenge in biology (median 92.4 GDT)",
    url: "https://deepmind.google/discover/blog/alphafold-a-solution-to-a-50-year-old-grand-challenge-in-biology/",
  },
  casp14: { label: "CASP14 press release, 30 November 2020", url: "https://predictioncenter.org/casp14/doc/CASP14_press_release.html" },
  nobelChem2024: { label: "Nobel Prize in Chemistry 2024: press release", url: "https://www.nobelprize.org/prizes/chemistry/2024/press-release/" },
  nobelChemBackground: {
    label: "Nobel Committee for Chemistry 2024: scientific background (structure prediction is not the folding process)",
    url: "https://www.nobelprize.org/uploads/2024/10/advanced-chemistryprize2024.pdf",
  },
  // loom
  vaswani: { label: "Vaswani et al. 2017, Attention Is All You Need (submitted 12 June 2017)", url: "https://arxiv.org/abs/1706.03762" },
  clark: { label: "Clark et al. 2019, What Does BERT Look At? An analysis of BERT's attention", url: "https://arxiv.org/abs/1906.04341" },
  jainWallace: { label: "Jain & Wallace 2019, Attention is not Explanation", url: "https://arxiv.org/abs/1902.10186" },
  brown: {
    label: "Brown et al. 2020, Language Models are Few-Shot Learners (GPT-3; submitted 28 May 2020; 175 billion parameters)",
    url: "https://arxiv.org/abs/2005.14165",
  },
  openaiChatgpt: { label: "OpenAI, 30 November 2022: Introducing ChatGPT", url: "https://openai.com/index/chatgpt/" },
  reutersUbs: {
    label: "Reuters, 1 February 2023: ChatGPT sets record for fastest-growing user base, analyst note (a UBS estimate; syndicated copy)",
    url: "https://www.thestar.com.my/tech/tech-news/2023/02/02/chatgpt-sets-record-for-fastest-growing-user-base---analyst-note",
  },
  // horizon
  metrPaper: {
    label: "Kwa et al. 2025, Measuring AI Ability to Complete Long Software Tasks (METR)",
    url: "https://arxiv.org/abs/2503.14499",
  },
  metrResults: {
    label: "METR: Time Horizon 1.1 results file (every point estimate and 95% interval)",
    url: "https://metr.org/assets/benchmark_results_1_1.yaml",
  },
  metrHorizons: {
    label: "METR: Task-completion time horizons of frontier AI models (measurements above 16 hrs flagged as unreliable; no longer updated)",
    url: "https://metr.org/time-horizons/",
  },
  metrQ4: {
    label: "METR, 20 November 2026: Q4 2026 capability update (doubling every 3.61 months; pooled estimates; 200 hours in July 2027 by naive extrapolation)",
    url: "https://metr.org/blog/2026-11-20-q4-2026-capability-update/",
  },
  // The Cambrian sea in scene 10: one museum page per animal shown (fetched by the scene's builder).
  romOlenoides: {
    label: "Royal Ontario Museum, Burgess Shale fossil gallery: Olenoides serratus",
    url: "https://burgess-shale.rom.on.ca/fossils/olenoides-serratus/",
  },
  romMarrella: {
    label: "Royal Ontario Museum, Burgess Shale fossil gallery: Marrella splendens",
    url: "https://burgess-shale.rom.on.ca/fossils/marrella-splendens/",
  },
  romAnomalocaris: {
    label: "Royal Ontario Museum, Burgess Shale fossil gallery: Anomalocaris canadensis",
    url: "https://burgess-shale.rom.on.ca/fossils/anomalocaris-canadensis/",
  },
  romOpabinia: {
    label: "Royal Ontario Museum, Burgess Shale fossil gallery: Opabinia regalis",
    url: "https://burgess-shale.rom.on.ca/fossils/opabinia-regalis/",
  },
  romHallucigenia: {
    label: "Royal Ontario Museum, Burgess Shale fossil gallery: Hallucigenia sparsa",
    url: "https://burgess-shale.rom.on.ca/fossils/hallucigenia-sparsa/",
  },
  romWiwaxia: {
    label: "Royal Ontario Museum, Burgess Shale fossil gallery: Wiwaxia corrugata",
    url: "https://burgess-shale.rom.on.ca/fossils/wiwaxia-corrugata/",
  },
  romPikaia: {
    label: "Royal Ontario Museum, Burgess Shale fossil gallery: Pikaia gracilens",
    url: "https://burgess-shale.rom.on.ca/fossils/pikaia-gracilens/",
  },
  romVauxia: {
    label: "Royal Ontario Museum, Burgess Shale fossil gallery: Vauxia gracilenta",
    url: "https://burgess-shale.rom.on.ca/fossils/vauxia-gracilenta/",
  },
  romDinomischus: {
    label: "Royal Ontario Museum, Burgess Shale fossil gallery: Dinomischus isolatus",
    url: "https://burgess-shale.rom.on.ca/fossils/dinomischus-isolatus/",
  },
  romChancelloria: {
    label: "Royal Ontario Museum, Burgess Shale fossil gallery: Chancelloria eros",
    url: "https://burgess-shale.rom.on.ca/fossils/chancelloria-eros/",
  },
} satisfies Record<string, Source>

export type SourceKey = keyof typeof SOURCES

export type TransitionId =
  | "fade"
  | "dot" //       1→2  the title's full stop opens into the next scene
  | "pour" //      2→3  the white-hot frame runs like molten glass into the pot
  | "steam" //     3→4  steam off the pot thickens into the fog
  | "lightsout" // 4→5  the plate cools like a filament: brightest parts last
  | "hex" //       5→6  hexagonal mirror segments tilt, each showing the next scene
  | "dive" //      6→7  a selected spot in the galaxy opens into the next scene
  | "anneal" //    7→8  the molten frame cools into crystal facets
  | "settle" //    8→9  silt buries the frame in beds, from the bottom up
  | "thaw" //      9→10 frost on the lens melts and runs off
  | "pageturn" //  10→11 the plate is turned like a page
  | "ember" //     11→12 the ash keeps falling, one ember stays lit and is a spark off stone
  | "torch" //     12→13 a brand is carried across the lens; where its light falls is the wall
  | "clay" //      13→14 the rock softens and a thumb presses it flat into a wet slab
  | "mould" //     14→15 the clay closes round the frame as the two halves of a mould
  | "mesh" //      15→16 teeth rise out of the cooling metal; the frame breaks into wheels
  | "platen" //    16→17 a platen comes down, ink spreads, a printed page lifts away
  | "aperture" //  17→18 an iris closes on the frame and opens on the next
  | "ticker" //    18→19 telegraph tape, punched with the last picture, pulls the next one in
  | "splice" //    19→20 the film jumps the gate, a splice passes, the next reel is running
  | "scanline" //  20→21 a tube switches on: a dot, a line, a raster
  | "cards" //     21→22 the frame is a deck of punched cards, riffled and dealt
  | "squares" //   22→23 the squares of a board flip like tiles
  | "trace" //     23→24 an oscilloscope beam draws the frame, flattens and redraws
  | "unravel" //   24→25 the frame comes apart into threads pulled straight into a warp
  | "axis" //      25→26 the rule of ages swings up and becomes the chart's axis
  | "tearoff" //   26→27 the chart sheet is torn off its pad; the page under it is January 1
  | "thumbnail" // 27→28 the whole scene shrinks into a picture on a white slide

export type BeatDef = {
  /** The line on screen. */
  head: string
  /** The smaller line: the number and who measured it. */
  sub?: string
  /** What the presenter says, with stage directions in parentheses. */
  note: string
  /** Seconds the beat animates. */
  dur: number
  /** Seconds it then holds before auto-play moves on (time to say the line). */
  hold: number
  /** What the corner of the slide prints. */
  page: string
  ill?: boolean
  src: SourceKey[]
}

export type SceneDef = {
  id: string
  title: string
  when: string
  enterWith: TransitionId
  beats: BeatDef[]
}

export const SCENES: SceneDef[] = [
  {
    id: "template",
    title: "A Brief History of Everything",
    when: "a conference room",
    enterWith: "fade",
    beats: [
      {
        head: "A Brief History of Everything.",
        sub: "An Overview",
        note: "(Stand still. Read the title in a flat voice.) Good afternoon. Today I will be giving an overview of everything.",
        dur: 0.6,
        hold: 4,
        page: "1",
        src: [],
      },
      {
        head: "Agenda. Project timeline (to scale): universe 13.8, Earth 4.54, life about 3.7, animals 0.57 billion years. Humans 0.0003.",
        sub: "A linear axis, so the last bar cannot be drawn.",
        note: "There is a lot of ground to cover, so I will go in order. (Read the bullets out loud, slowly. Do not explain the chart. Press next and stop talking.)",
        dur: 4.4,
        hold: 3.5,
        page: "2",
        src: ["planck", "usgs", "nutman", "bobrovskiy", "siSapiens"],
      },
      {
        head: "Where is the last bar? It is there. It is about 0.002% of the axis. Start here.",
        sub: "300,000 years out of 13.787 billion (arithmetic)",
        note: "(Do not touch anything. The deck argues with itself, then picks the full stop at the end of the title and goes in. Pick up again when the ruler is on screen.)",
        dur: 13,
        hold: 0.6,
        page: "3",
        ill: true,
        src: ["planck", "siSapiens"],
      },
    ],
  },
  {
    id: "inflation",
    title: "Inflation",
    when: "13.8 billion years ago",
    enterWith: "dot",
    beats: [
      {
        head: "First, space itself inflates.",
        sub: "By a factor of about 10^26, in a fraction of a second (NASA)",
        note: "Each click of the ruler is ten times the one before, and there are twenty-six of them. Inflation is a theory with good support, not a photograph. (Let the counter finish. Do not talk over it.)",
        dur: 9.5,
        hold: 3,
        page: "T + 0",
        ill: true,
        src: ["nasaInflation"],
      },
      {
        head: "Then it stops, and everything is hot.",
        sub: "13.787 ± 0.020 billion years ago (Planck 2018)",
        note: "The energy that drove inflation becomes matter and light. This is the hot Big Bang, and its date is known to better than a percent. The ripples on it are drawn. Remember them anyway.",
        dur: 5,
        hold: 4.5,
        page: "T + a fraction of a second",
        ill: true,
        src: ["planck", "nasaUniverse"],
      },
    ],
  },
  {
    id: "forge",
    title: "The first five minutes",
    when: "the first five minutes",
    enterWith: "pour",
    beats: [
      {
        head: "One second old. Ten billion degrees.",
        sub: "About 10 billion degrees Celsius at one second (NASA)",
        note: "Too hot for atoms. Too hot for a nucleus to hold together for long. (Let the pot rattle.) Red is a proton, pale is a neutron. The colours are mine.",
        dur: 5,
        hold: 3.5,
        page: "T + 1 second",
        ill: true,
        src: ["nasaUniverse"],
      },
      {
        head: "Cook for five minutes.",
        sub: "After five minutes, most of today's helium exists (NASA)",
        note: "For a few minutes the whole universe is a fusion reactor. (Watch the timer, not the room. Wait for the bell.)",
        dur: 9,
        hold: 3,
        page: "T + 5 minutes",
        ill: true,
        src: ["nasaUniverse"],
      },
      {
        head: "Then the stove goes cold.",
        sub: "Hydrogen, helium and not much else, for a very long time",
        note: "Space keeps expanding, the reactions stop, and the recipe is fixed. Every heavier element you will see tonight has to be made later, inside stars.",
        dur: 5,
        hold: 4,
        page: "T + 5 minutes, cooling",
        ill: true,
        src: ["nasaUniverse"],
      },
    ],
  },
  {
    id: "fog",
    title: "The fog lifts",
    when: "380,000 years after the Big Bang",
    enterWith: "steam",
    beats: [
      {
        head: "For 380,000 years, light gets nowhere.",
        sub: "Every free electron is something to hit (NASA, ESA)",
        note: "(Follow the photon with your hand.) It is not dark in here. It is the opposite. The light is everywhere and it cannot travel.",
        dur: 7,
        hold: 3.5,
        page: "T + 379,999 years",
        ill: true,
        src: ["nasaUniverse", "esaCmb"],
      },
      {
        head: "Atoms form. The fog clears.",
        sub: "About 380,000 years after the Big Bang, at about 3,000 K (ESA)",
        note: "Electrons join nuclei, and there is suddenly nothing in the way. (Let it go. Watch it leave.)",
        dur: 7,
        hold: 3.5,
        page: "T + 380,000 years",
        ill: true,
        src: ["nasaUniverse", "esaCmb"],
      },
      {
        head: "That light is still arriving.",
        sub: "Stretched and cooled to 2.726 K. First detected in 1964 (ESA)",
        note: "This is the cosmic microwave background, the oldest light there is, and it comes from every direction. On this plate it is one flat colour. That is not a mistake.",
        dur: 6,
        hold: 4,
        page: "T + 13.8 billion years",
        ill: true,
        src: ["esaCmb"],
      },
      {
        head: "Almost perfectly smooth.",
        sub: "It varies by about 1 part in 100,000 across the sky (ESA)",
        note: "(Reach for the dial. Turn the contrast all the way up.) Almost. Those blotches are the ripples from two slides ago, and every galaxy that comes next grows from one. The map is drawn, not Planck data.",
        dur: 6.5,
        hold: 4.5,
        page: "contrast × 100,000",
        ill: true,
        src: ["esaCmb"],
      },
    ],
  },
  {
    id: "dark",
    title: "The dark ages and first light",
    when: "about 200 million years after the Big Bang",
    enterWith: "lightsout",
    beats: [
      {
        head: "Then, darkness.",
        sub: "No stars shine for about the next 200 million years (NASA)",
        note: "(The screen goes black. Say nothing for as long as you can stand.) Gas, gravity and time.",
        dur: 4,
        hold: 5,
        page: "T + 380,001 years",
        ill: true,
        src: ["nasaUniverse"],
      },
      {
        head: "The first stars switch on.",
        sub: "Expected: 30 to 300 times the Sun's mass, millions of times brighter (NASA)",
        note: "Nobody has seen one of these stars. The masses are what the models expect, so this is a drawing. (Count them in under your breath.)",
        dur: 9,
        hold: 3.5,
        page: "T + 200 million years",
        ill: true,
        src: ["nasaUniverse"],
      },
      {
        head: "The earliest galaxy confirmed so far.",
        sub: "MoM-z14, redshift 14.44: about 280 million years after the Big Bang (Naidu et al. 2025)",
        note: "(We pull back through the mirror that saw it.) The James Webb Space Telescope measured its spectrum, and NASA announced it in January 2026. The previous holder was reported in 2024, so check whether this record still stands before you give this talk.",
        dur: 8,
        hold: 4.5,
        page: "T + 280 million years",
        ill: true,
        src: ["naidu", "stsci", "carniani"],
      },
    ],
  },
  {
    id: "galaxy",
    title: "A galaxy assembles",
    when: "about 13 billion years ago",
    enterWith: "hex",
    beats: [
      {
        head: "The Milky Way starts early.",
        sub: "Its thick disk began forming about 13 billion years ago (Xiang & Rix 2022)",
        note: "Clumps fall together and the mess starts to turn. Ours is one of the old galaxies. A good share of its oldest disk stars formed around 11 billion years ago, when a smaller galaxy ran into it.",
        dur: 9,
        hold: 3.5,
        page: "13,000,000,000 years ago",
        ill: true,
        src: ["xiang"],
      },
      {
        head: "A spiral, still being built.",
        sub: "A disk of stars more than 100,000 light-years across (NASA)",
        note: "(Let it turn.) Nothing in the rest of this talk leaves this picture.",
        dur: 7,
        hold: 4,
        page: "11,000,000,000 years ago",
        ill: true,
        src: ["nasaGalaxies", "xiang"],
      },
      {
        head: "Skip eight billion years.",
        sub: "4.6 billion years ago, in one arm, a cloud collapses (NASA)",
        note: "(Say that you are skipping.) More than eight billion years, gone. About halfway out from the centre a cloud of gas and dust falls in on itself, and a star lights. We go there.",
        dur: 7,
        hold: 3.5,
        page: "4,600,000,000 years ago",
        ill: true,
        src: ["nasaSun", "nasaGalaxies"],
      },
    ],
  },
  {
    id: "impact",
    title: "Earth, and what hit it",
    when: "about 4.5 billion years ago",
    enterWith: "dive",
    beats: [
      {
        head: "Dust becomes a planet.",
        sub: "Earth: 4.54 billion years old, to within 1 percent (USGS)",
        note: "It does not look like home. No rock survives from this time. The planet recycles its crust, so its age comes from meteorites and lead isotopes, not from anything you could pick up here.",
        dur: 6,
        hold: 4,
        page: "4,540,000,000 years ago",
        ill: true,
        src: ["usgs"],
      },
      {
        head: "Something the size of Mars hits.",
        sub: "The giant impact, about 4.5 billion years ago (NASA)",
        note: "(Do not warn them. Look at the horizon.) The leading explanation is one body, named Theia. It could also have been a series of smaller ones.",
        dur: 9,
        hold: 3,
        page: "4,500,000,000 years ago",
        ill: true,
        src: ["nasaMoon"],
      },
      {
        head: "The debris becomes the Moon.",
        sub: "Oldest dated Moon rocks: 4.4 to 4.5 billion years (USGS)",
        note: "Molten and vaporised rock goes into orbit and collects. Every tide since then is a consequence of this slide.",
        dur: 8,
        hold: 4.5,
        page: "4,500,000,000 years ago",
        ill: true,
        src: ["nasaMoon", "usgs"],
      },
    ],
  },
  {
    id: "water",
    title: "Water, and something in it",
    when: "4.4 to 3.5 billion years ago",
    enterWith: "anneal",
    beats: [
      {
        head: "Water, earlier than expected.",
        sub: "One zircon, 4,404 ± 8 million years old (Wilde et al. 2001)",
        note: "A crystal smaller than a grain of sand, from the Jack Hills of Western Australia. Its chemistry says the magma it grew in had met liquid water. The crystal outlived its rock: the oldest known rock is about 4,030 million years old.",
        dur: 7,
        hold: 4.5,
        page: "4,404,000,000 years ago",
        ill: true,
        src: ["wilde"],
      },
      {
        head: "Then something is alive.",
        sub: "Generally accepted: microbial mats, 3,480 million years ago, Pilbara (Nutman et al. 2016)",
        note: "(We go in through the crystal.) Nobody knows when or where life began. What we have is a floor: by this date, microbes were building layered mats in shallow water.",
        dur: 8,
        hold: 4,
        page: "3,480,000,000 years ago",
        ill: true,
        src: ["nutman"],
      },
      {
        head: "The date is debated.",
        sub: "Claimed: 3,700 million years, Greenland. Possibly 3,770 to 4,280, Quebec (Nutman 2016; Dodd 2017)",
        note: "Greenland has structures 1 to 4 centimetres high that may be mats. Quebec has tubes the authors themselves call putative. (Shrug.) The honest answer is a range, and the range is wide.",
        dur: 6,
        hold: 4.5,
        page: "3,700,000,000 years ago?",
        ill: true,
        src: ["nutman", "dodd"],
      },
    ],
  },
  {
    id: "strata",
    title: "Oxygen, then ice",
    when: "2.4 billion to 635 million years ago",
    enterWith: "settle",
    beats: [
      {
        head: "Microbes start making oxygen.",
        sub: "Free oxygen is a waste product of early life (Lyons et al. 2014)",
        note: "(From here we read the rock, bottom to top.) Photosynthesis that splits water gives off oxygen. For a long time the gas reacted away as fast as it was made.",
        dur: 6,
        hold: 4,
        page: "before 2,460,000,000 years ago",
        ill: true,
        src: ["lyons"],
      },
      {
        head: "Then the air changes.",
        sub: "The Great Oxidation Event begins 2,460 to 2,426 million years ago (Gumsley et al. 2017)",
        note: "The first lasting build-up of oxygen in the atmosphere. It is pollution on a planetary scale, by bacteria. It was not one clean step: oxygen rose and fell, perhaps until 2.2 billion years ago. The colours of the beds are a drawing.",
        dur: 7,
        hold: 4.5,
        page: "2,426,000,000 years ago",
        ill: true,
        src: ["gumsley", "ostrander"],
      },
      {
        head: "The planet freezes.",
        sub: "The Cryogenian: about 720 to 635 million years ago (ICS 2026)",
        note: "(Let the lens frost over.) The proposal is a global glaciation. Whether the oceans froze over completely is still argued.",
        dur: 7,
        hold: 4,
        page: "720,000,000 years ago",
        ill: true,
        src: ["ics", "hoffman"],
      },
      {
        head: "Volcanoes end it.",
        sub: "CO2 builds to about 350 times the modern level, by one estimate (Hoffman et al. 1998)",
        note: "With the surface sealed, volcanic carbon dioxide has nowhere to go. It builds until the ice gives way, and the thaw is fast. (Wipe the lens.)",
        dur: 6,
        hold: 3.5,
        page: "635,000,000 years ago",
        ill: true,
        src: ["hoffman", "ics"],
      },
    ],
  },
  {
    id: "cambrian",
    title: "Bodies",
    when: "571 to 487 million years ago",
    enterWith: "thaw",
    beats: [
      {
        head: "Bodies you can see.",
        sub: "The Ediacara biota: 571 to 541 million years ago (Bobrovskiy et al. 2018)",
        note: "Soft, flat, quilted things on the sea floor. For decades nobody could agree whether Dickinsonia was an animal, a giant single cell or a lichen. Then a fossil turned out to have kept its fat, and that settled it: animal.",
        dur: 8,
        hold: 4.5,
        page: "571,000,000 years ago",
        ill: true,
        src: ["bobrovskiy"],
      },
      {
        head: "Then, fast.",
        sub: "The Cambrian begins 538.8 ± 0.6 million years ago (ICS 2026)",
        note: "(Let the pen run. Do not narrate the drawings.) Fast by a geologist's standards. The fossil record goes from sparse to crowded.",
        dur: 11,
        hold: 3,
        page: "538,800,000 years ago",
        ill: true,
        src: ["ics"],
      },
      {
        head: "Shells, legs, eyes, predators.",
        sub: "The period ends 486.85 ± 1.5 million years ago (ICS 2026)",
        note: "Hard parts fossilise well, which is partly why this looks so sudden. Most major animal groups alive today have a relative on this page. (One of them leaves.)",
        dur: 8,
        hold: 4,
        page: "486,850,000 years ago",
        ill: true,
        src: ["ics"],
      },
      {
        // Added at the owner's request: the plate comes alive. Each animal shown has its own museum
        // page in SOURCES; the scene labels each by genus. Colours are not known from the fossils.
        head: "And they moved.",
        sub: "Illustration: Burgess Shale animals as reconstructed (Royal Ontario Museum). Colours invented.",
        note: "(The page wets through. Let them swim. Say nothing until the water drains and they are ink again.) Everything you just saw drawn was alive, and it moved like this, as far as the fossils let anyone say. The colours are mine.",
        dur: 16,
        hold: 4,
        page: "486,850,000 years ago",
        ill: true,
        src: ["romOlenoides", "romMarrella", "romAnomalocaris", "romOpabinia", "romHallucigenia", "romWiwaxia", "romPikaia", "romVauxia", "romDinomischus", "romChancelloria"],
      },
    ],
  },
  {
    id: "lastday",
    title: "One bad day",
    when: "66 million years ago",
    enterWith: "pageturn",
    beats: [
      {
        head: "From 245 to 66 million years ago: this.",
        sub: "Dinosaurs appear around 245 million years ago (Natural History Museum)",
        note: "(Slow down. Let them enjoy the evening.) We have had three hundred thousand years. They are on their hundred and seventy-ninth million. (Do not point at the bright star.)",
        dur: 7,
        hold: 5,
        page: "66,000,001 years ago",
        ill: true,
        src: ["nhmDino", "siSapiens"],
      },
      {
        head: "One bad day.",
        sub: "An object 10 to 14 km wide. A crater about 200 km across (NASA JPL)",
        note: "(No warning. Cut straight to it.) It lands off what is now Yucatan. The crater, Chicxulub, is still there under the coast. Published sizes differ somewhat, so read these as approximate.",
        dur: 8,
        hold: 3,
        page: "66,000,000 years ago",
        ill: true,
        src: ["jpl", "ics"],
      },
      {
        head: "The dinosaurs that made it through.",
        sub: "Impact and extinction match to within 32,000 years (Renne et al. 2013)",
        note: "A thin layer of debris from the impact is found around the world at exactly this boundary. The non-bird dinosaurs end at it. (Nod at the branch.) The birds are the ones that did not.",
        dur: 8,
        hold: 4.5,
        page: "65,999,999 years ago",
        ill: true,
        src: ["renne", "nhmDino"],
      },
    ],
  },
  // ───────────────────────────── Act III: the ages of people ─────────────────────────────
  {
    id: "spark",
    title: "Stone",
    when: "3.3 million to 400,000 years ago",
    enterWith: "ember",
    beats: [
      {
        head: "Someone hits one stone with another.",
        sub: "Kenya: stone tools reported at 3.3 million years (Harmand et al. 2015)",
        note: "The Smithsonian's summary starts toolmaking at 2.6 million years, so treat the 3.3 as reported, not settled. (Let each strike land. Do not talk over one. There are no sparks: this is cold stone.)",
        dur: 4.5,
        hold: 5,
        page: "3,300,000 years ago?",
        ill: true,
        src: ["harmand", "siTools"],
      },
      {
        head: "Then a shape, made on purpose.",
        sub: "Hand-axes by about 1.76 million years ago (Lepre et al. 2011; Smithsonian)",
        note: "Large flakes struck off, then shaped around the edge, both faces. (Turn it in the light.) Since the last slide: about one and a half million years. That is subtraction, and it is the last time tonight the number is that big.",
        dur: 4,
        hold: 4.5,
        page: "1,760,000 years ago",
        ill: true,
        src: ["lepre", "siTools", "harmand"],
      },
      {
        head: "Then fire, kept.",
        sub: "Hearths at least 790,000 years old (Smithsonian). The date is debated",
        note: "Burning in a cave about 1.0 million years ago. Hearths by 790,000. The oldest evidence of making fire, flint struck on pyrite, is 400,000 years old and was published in December 2025. (Now the sparks. They come off the pyrite.)",
        dur: 4.5,
        hold: 4.5,
        page: "790,000 years ago",
        ill: true,
        src: ["siHearths", "gorenInbar", "berna", "davisBarnham"],
      },
    ],
  },
  {
    id: "hands",
    title: "Hands",
    when: "67,800 to 36,000 years ago",
    enterWith: "torch",
    beats: [
      {
        head: "A hand on a wall.",
        sub: "Sulawesi: a hand stencil at least 67,800 years old (Oktaviana et al. 2026)",
        note: "Pigment sprayed around a hand held to the rock. The date is a minimum: it is the age of the crust that grew over the paint. (Hold your hand up. Take it away.)",
        dur: 3.5,
        hold: 4.5,
        page: "67,800 years ago, at least",
        ill: true,
        src: ["oktaviana2026"],
      },
      {
        head: "Then a story.",
        sub: "Sulawesi: narrative cave art at least 51,200 years old (Oktaviana et al. 2024)",
        note: "A stencil in Spain is claimed for Neanderthals at more than 64,800 years. That date is disputed, and so is who made it. (Walk the torch along the wall.)",
        dur: 3.5,
        hold: 4,
        page: "51,200 years ago, at least",
        ill: true,
        src: ["oktaviana2024", "hoffmann", "slimak"],
      },
      {
        head: "Some of the hands are missing fingers.",
        sub: "Gargas, France: 114 of 231 hand images lack a finger segment (Bradshaw Foundation)",
        note: "Folded away, frostbite, or worse. Nobody agrees. Chauvet was first used around 36,500 years ago, and later visitors left torch smears on its walls. (The reviewer asks: Who? Do not answer. There are no names yet.)",
        dur: 3.5,
        hold: 4,
        page: "36,500 years ago",
        ill: true,
        src: ["bradshawHands", "chauvet", "chauvetTorch"],
      },
    ],
  },
  {
    id: "tablet",
    title: "Clay",
    when: "12,000 years ago to about 3000 BC",
    enterWith: "clay",
    beats: [
      {
        head: "People start growing their food.",
        sub: "Within the past 12,000 years (Smithsonian)",
        note: "Farming, herding, staying in one place. (One slow pull upward.) The furrows are a drawing. The oldest plough marks known in Europe date from the start of the fifth millennium BCE, long after the first fields.",
        dur: 17,
        hold: 4,
        page: "12,000 years ago",
        ill: true,
        src: ["siWorld", "willigen"],
      },
      {
        head: "Then they start keeping count.",
        sub: "Clay tablets at Uruk, c. 3350 to 3000 BC (Kelley et al. 2024, Antiquity)",
        note: "The first writing is accounting. It is a tally of goods, on clay that still carries the fingerprints of whoever shaped it. (Press one mark in. Let it dry.) From here the corner counts in calendar years.",
        dur: 17,
        hold: 4,
        page: "about 3350 BC",
        ill: true,
        src: ["kelley", "antiquity", "hamburgPrints"],
      },
    ],
  },
  {
    id: "metal",
    title: "Metal",
    when: "about 3000 BC to 800 BC, by region",
    enterWith: "mould",
    beats: [
      {
        head: "Copper and tin, poured.",
        sub: "The Bronze Age: about 3000 to 1000 BC, varying by region (French Ministry of Culture)",
        note: "There is no single date. Metal reached Britain in about 2300 BC. (Side-on. Watch the mould fill. It is a clay mould, bound and wrapped.) The green is malachite and it comes from burial. Here it takes seconds.",
        dur: 14.5,
        hold: 3.5,
        page: "about 3000 BC",
        ill: true,
        src: ["mcBronze", "ashmoleanBronze", "gettyPatina", "londonMould"],
      },
      {
        head: "Then iron, hammered.",
        sub: "In Britain the Iron Age runs from 800 BC to AD 43 (Ashmolean)",
        note: "Iron follows bronze, and the date moves with the map. (Let the flakes fly.) Those are hammer scale, iron oxide, one of the by-products of smithing.",
        dur: 14.5,
        hold: 3.5,
        page: "about 800 BC",
        ill: true,
        src: ["mcBronze", "ashmoleanIron", "jungScale"],
      },
    ],
  },
  {
    id: "gearwork",
    title: "Gearwork",
    when: "about 150 to 100 BC",
    enterWith: "mesh",
    beats: [
      {
        head: "The sky, as a machine you can hold.",
        sub: "The Antikythera mechanism: built 150 to 100 BC (Freeth et al. 2006). Debated: its eclipse dial starts in 205 BCE",
        note: "From a shipwreck found in 1900. It survives as 82 fragments with 30 gears, about a third of the original. (It cleans as it turns. That part is a drawing.) The teeth are triangles, cut by hand with a file.",
        dur: 12.5,
        hold: 3,
        page: "about 100 BC",
        ill: true,
        src: ["freeth2006", "freeth2021", "isaw4", "carman"],
      },
      {
        head: "Nothing like it for a thousand years.",
        sub: "A 223-tooth gear drives a dial of 223 months, the eclipse cycle (Freeth 2009; Freeth & Jones 2012)",
        note: "Another dial counts 19 years as 235 lunar months. Nothing this complex is known for at least a millennium afterwards. Tooth counts from Freeth et al. 2006; two of the wheels shown do not survive and are the paper's proposals. (Let it run. Then warn them: the number on the rule is about to go up, once.)",
        dur: 12.5,
        hold: 3,
        page: "about 100 BC",
        ill: true,
        src: ["freethSciAm", "isaw4", "freeth2006", "freeth2006supp"],
      },
    ],
  },
  {
    id: "press",
    title: "Print",
    when: "1455",
    enterWith: "platen",
    beats: [
      {
        head: "One page, set in metal.",
        sub: "The Gutenberg Bible, Mainz, 1454/1455: 42 lines a column, perhaps 180 copies (Library of Congress)",
        note: "Movable type is older. Bi Sheng made it of earthenware in China between 1041 and 1048, and a Korean book was printed from metal type in 1377. (The letters are mirror images. Wait for the sheet.) The ink goes on with leather balls. Rollers arrive in 1810.",
        dur: 10.3,
        hold: 2.8,
        page: "1455",
        ill: true,
        src: ["locGutenberg", "locGutenbergFaq", "locAsiaPrint", "bnfJikji", "mainzType", "apha"],
      },
      {
        head: "Then thousands. Then millions.",
        sub: "Printed books produced in Europe: 12.6 million in the half century to 1500, then 79 million in the next (Buringh & van Zanden estimate, via Our World in Data)",
        note: "(Let the counter run.) These are one study's estimates, summed over its country rows, so the totals are arithmetic. The dataset defines a book as a published title with more than 49 pages. The counter between the two figures is a drawing.",
        dur: 10.3,
        hold: 2.6,
        page: "1500",
        ill: true,
        src: ["owidBooks"],
      },
    ],
  },
  {
    id: "lens",
    title: "Glass",
    when: "1610 to 1672",
    enterWith: "aperture",
    beats: [
      {
        head: "Four points of light that move.",
        sub: "Galileo, 13 January 1610: four little stars beside Jupiter (Sidereus Nuncius)",
        note: "On 7 January he saw three. By the 15th he knew they went round Jupiter and not round us. The book was out in March. (His surviving telescope magnifies 21 times. Keep the view small.)",
        dur: 8.7,
        hold: 2.4,
        page: "1610",
        ill: true,
        src: ["sidereus", "riceGalileo", "museoGalileo"],
      },
      {
        head: "White light, taken apart.",
        sub: "Newton, begun 1666, printed 1672: a spectrum about five times longer than broad",
        note: "A darkened room, a small hole in the shutter, a prism, the far wall 22 feet away. Violet bends most and red least. (A hole, not a slit. Follow the beam to the wall.)",
        dur: 8.7,
        hold: 2.2,
        page: "1672",
        ill: true,
        src: ["newton1672"],
      },
    ],
  },
  {
    id: "engine",
    title: "Steam, then light",
    when: "1712 to 1882",
    enterWith: "ticker",
    beats: [
      {
        head: "Heat, made to do work.",
        sub: "Newcomen's engine, 1712. Watt's separate condenser, patented 1769 (Science Museum)",
        note: "(Ride the rod.) A Boulton and Watt engine of 1785 ran at 20 to 21 strokes a minute. The spinning balls are the governor, fitted from 1788: the first feedback device on an engine.",
        dur: 7.1,
        hold: 2,
        page: "1769",
        ill: true,
        src: ["smNewcomen", "smWatt", "asmeWatt", "powerhouse", "wikiSunPlanet"],
      },
      {
        head: "Then light, down a wire.",
        sub: "Edison's lamp, 22 October 1879: a carbon thread that burned 13 1/2 hours (Edison Papers)",
        note: "Carbonised cotton, not tungsten. Tungsten is 1904. Swan in England had almost the same idea at about the same time. New York's first station switched on on 4 September 1882 with 85 customers and about 400 lamps. (The city on screen is generous.)",
        dur: 7.1,
        hold: 1.8,
        page: "1882",
        ill: true,
        src: ["rutgersLamp", "energyBulb", "ethwBulbs", "ethwPearl"],
      },
    ],
  },
  {
    id: "footprint",
    title: "Off the ground",
    when: "1903 to 1969",
    enterWith: "splice",
    beats: [
      {
        head: "Twelve seconds off the ground.",
        sub: "Kitty Hawk, 17 December 1903: 12 seconds, 120 feet (Smithsonian)",
        note: "(The film speeds up. Let it.) 1945, the Trinity test. 1957, Sputnik. 1961, Gagarin, 108 minutes.",
        dur: 6,
        hold: 1.6,
        page: "1903",
        ill: true,
        src: ["nasmFlyer", "doeTrinity", "nasaSputnik", "nasaGagarin"],
      },
      {
        head: "Then, a bootprint.",
        sub: "Apollo 11 lands 20 July 1969 (NASA). Under 66 years after Kitty Hawk (arithmetic)",
        note: "(Stop dead.) It is Aldrin's, made on purpose and photographed for the soil engineers. No wind, so the dust keeps its edge. No stars, because the exposure was set for sunlight. The Earth was almost 60 degrees up, so we tilt to find it. That ground is the debris of scene seven.",
        dur: 5.9,
        hold: 1.5,
        page: "1969",
        ill: true,
        src: ["nssdcApollo11", "nasmFlyer", "alsjImages", "nasaRegolith", "alsjStars", "alsjSky", "nasmOvershoes", "alsjReseau"],
      },
    ],
  },
  {
    id: "die",
    title: "Silicon and glass",
    when: "1947 to 1989",
    enterWith: "scanline",
    beats: [
      {
        head: "A switch with no moving parts.",
        sub: "Transistor, 1947. Intel 4004, 1971: 2,300 transistors. One Apple chip, 2023: 92 billion",
        note: "(Ride the zoom down.) The first transistor worked on 16 December 1947, which is before the Moon. The ages overlap from here on, and the corner clock steps back to say so.",
        dur: 5,
        hold: 1.2,
        page: "1947",
        ill: true,
        src: ["chmTransistor", "intel4004", "appleM3"],
      },
      {
        head: "Then all of them, connected.",
        sub: "First fibre across an ocean, 14 December 1988: 40,000 circuits. Cables now carry over 99 per cent of international data (ITU)",
        note: "The Web is proposed at CERN in March 1989. (Follow one pulse.) On the deep sea floor the cable is about as wide as a garden hose, with no armour.",
        dur: 4.8,
        hold: 1,
        page: "1989",
        ill: true,
        src: ["ethwTat8", "ituCables", "cernWeb", "tgCables", "icpcCables"],
      },
    ],
  },
  // ───────────────────────────── Act IV: the AI age ─────────────────────────────
  {
    id: "question",
    title: "The question",
    when: "1950 to 1956",
    enterWith: "cards",
    beats: [
      {
        head: "\"Can machines think?\"",
        sub: "Alan Turing, in the journal Mind, October 1950",
        note: "(The clock steps back again.) He wanted a teleprinter between two rooms, and thought the question itself too meaningless to deserve discussion. (Let it type.)",
        dur: 4.2,
        hold: 0.8,
        page: "1950",
        ill: true,
        src: ["turing"],
      },
      {
        head: "\"A 2 month, 10 man study.\"",
        sub: "The Dartmouth proposal, 31 August 1955, for the summer of 1956",
        note: "It ran about six weeks. The hopes ran ahead of the results, and in the mid to late 1980s the funding fell away. That is what came to be called the AI winter. (Frost, once. It thaws. The reviewer: Not yet.)",
        dur: 3.3,
        hold: 0.7,
        page: "1956",
        ill: true,
        src: ["dartmouth", "nilsson"],
      },
    ],
  },
  {
    id: "board",
    title: "The board",
    when: "1997 to 2016",
    enterWith: "squares",
    beats: [
      {
        head: "Chess.",
        sub: "Deep Blue beats Kasparov 3.5 to 2.5, 11 May 1997 (IBM; Computer History Museum)",
        note: "200 million positions a second. Kasparov won the first game and lost the second. Three draws. Then Deep Blue took game six, and the match.",
        dur: 3.4,
        hold: 0.7,
        page: "1997",
        ill: true,
        src: ["ibmDeepBlue", "chmDeepBlue", "wikiGame6"],
      },
      {
        head: "Then Go. Move 37.",
        sub: "AlphaGo beats Lee Sedol 4 to 1, March 2016. Game two, move 37, at P10 (game record)",
        note: "DeepMind gave it a 1 in 10,000 chance of being played by a human. (Stop on the stone.)",
        dur: 3.3,
        hold: 0.6,
        page: "2016",
        ill: true,
        src: ["deepmindAlphaGo", "sgfGame2", "googleSeoul"],
      },
    ],
  },
  {
    id: "fold",
    title: "Seeing, then folding",
    when: "2012 to 2020",
    enterWith: "trace",
    beats: [
      {
        head: "A machine learns to see.",
        sub: "ImageNet, top-5 error: 25.8% in 2011, 16.4% in 2012 (Russakovsky et al. 2015)",
        note: "The 2012 entry was a neural network. With extra training data it scored 15.3% against 26.2% for second place. Winners by year: 28.2% (2010), 25.8%, 16.4%, 11.7%, 6.7% (2014). Bootstrap intervals exist for 2012 to 2014 only and are drawn to scale. (The clock steps back. Keep going.)",
        dur: 3,
        hold: 0.6,
        page: "2012",
        ill: true,
        src: ["russakovsky", "krizhevsky"],
      },
      {
        head: "Then the shape of a protein.",
        sub: "AlphaFold 2, 30 November 2020: a median score of 92.4 GDT, by DeepMind's own summary",
        note: "It predicts the finished structure, not the folding. The fold on screen is a drawing. Nobel Prize in Chemistry, 2024.",
        dur: 2.9,
        hold: 0.5,
        page: "2020",
        ill: true,
        src: ["deepmindCasp14", "casp14", "nobelChemBackground", "nobelChem2024", "pdb1pga"],
      },
    ],
  },
  {
    id: "loom",
    title: "The loom",
    when: "2017 to 2022",
    enterWith: "unravel",
    beats: [
      {
        head: "\"Attention Is All You Need.\"",
        sub: "Vaswani et al., 12 June 2017: \"dispensing with recurrence and convolutions entirely\"",
        note: "(The clock steps back once more.) Each new token looks back at earlier ones, never ahead. (The threads follow patterns found in published attention maps: previous token, punctuation, broad. They are not an explanation.)",
        dur: 2.6,
        hold: 0.5,
        page: "2017",
        ill: true,
        src: ["vaswani", "clark", "jainWallace"],
      },
      {
        head: "Then it answers.",
        sub: "GPT-3, May 2020: 175 billion parameters. ChatGPT, 30 November 2022 (OpenAI)",
        note: "One outside estimate, from UBS: 100 million monthly users two months after launch. That is ten years after the ImageNet result of 2012, by subtraction. (Type the question. Let the cloth reply.)",
        dur: 2.5,
        hold: 0.4,
        page: "2022",
        ill: true,
        src: ["brown", "openaiChatgpt", "reutersUbs", "russakovsky"],
      },
    ],
  },
  {
    id: "horizon",
    title: "The horizon",
    when: "2019 to November 2026",
    enterWith: "axis",
    beats: [
      {
        head: "How long a task can it finish alone?",
        sub: "From about 3 seconds (GPT-2, 2019) to 17.4 hours (Claude Mythos Preview, April 2026), at 50% success (METR)",
        note: "(The rule swings up and is the axis. Linear. It is a wall.) The measure is how long a task takes a person, for tasks the model finishes half the time. (The reviewer: Log axis, please.)",
        dur: 7,
        hold: 3,
        page: "April 2026",
        ill: true,
        src: ["metrResults", "metrHorizons"],
      },
      {
        head: "Same data. Log axis.",
        sub: "Doubling about every seven months since 2019 (METR 2025). Every 3.61 months now, 95% interval 2.08 to 4.94 (METR, November 2026)",
        note: "(The rule re-denominates. The wall is a line.) The line does steepen, gently. Most of the wall was the axis. The bars are METR's 95% intervals: on that last point, 8.48 to 55.1 hours.",
        dur: 7,
        hold: 5,
        page: "November 2026",
        ill: true,
        src: ["metrPaper", "metrQ4", "metrResults"],
      },
      {
        head: "Solid where measured. Dashed where not.",
        sub: "Latest: GPT-6 Astra 40 h (13 to 2645), Opus 5.5 39 h (12 to 1253), two suites pooled (METR, 20 November 2026)",
        note: "METR flags anything above 16 hours on its old suite as unreliable, and its own headline is up to 27 hours. The dashes are what METR calls naive extrapolation: 200 hours in July 2027. That is not a measurement. (Stop at the last pin. The pulse stops. Say nothing. Hold.)",
        dur: 6,
        hold: 12,
        page: "20 November 2026",
        ill: true,
        src: ["metrQ4", "metrHorizons"],
      },
    ],
  },
  {
    id: "calendar",
    title: "One year",
    when: "13.8 billion years as one year",
    enterWith: "tearoff",
    beats: [
      {
        head: "Now squeeze all of it into one year.",
        sub: "One day is 37.8 million years. One second is 437 years (arithmetic)",
        note: "This is arithmetic, not a measurement: 13.787 billion years divided by 365 days. The Big Bang is midnight on January 1. Now is midnight on December 31. (Let the pages go.)",
        dur: 7,
        hold: 3.5,
        page: "January 1, 00:00:00",
        ill: true,
        src: ["planck"],
      },
      {
        head: "The Sun forms on September 1.",
        sub: "Life by late September. Cambrian animals December 17. Dinosaurs gone December 30 (arithmetic)",
        note: "Same ages as the earlier slides, rescaled. Most of the year is stars and nothing else. Everything with a face is in the last two weeks.",
        dur: 10,
        hold: 3.5,
        page: "September 1 to December 30",
        ill: true,
        src: ["planck", "nasaSun", "nutman", "ics"],
      },
      {
        head: "We arrive at 23:48 on December 31.",
        sub: "Homo sapiens: about 300,000 years ago (Smithsonian; Hublin et al. 2017)",
        note: "Under twelve minutes for our whole species. The oldest fossils, from Jebel Irhoud in Morocco, are 315 thousand years old, give or take 34.",
        dur: 6,
        hold: 4,
        page: "December 31, 23:48",
        ill: true,
        src: ["siSapiens", "hublin"],
      },
      {
        head: "Farming: 27 seconds to midnight.",
        sub: "Writing: about 12. Sputnik: under one (arithmetic)",
        note: "Farming begins about 12,000 years ago, writing more than 5,000, and Sputnik flew in 1957. All of recorded history fits in about twelve seconds. (Stop talking for roughly that long. Let the clock do it.)",
        dur: 14,
        hold: 2,
        page: "December 31, 23:59:59",
        ill: true,
        src: ["siWorld", "antiquity", "nasaSputnik"],
      },
    ],
  },
  {
    id: "here",
    title: "You are here",
    when: "today",
    enterWith: "thumbnail",
    beats: [
      {
        head: "Summary",
        sub: "13.8 billion years. One planet that we know of. Questions?",
        note: "(The template is back. Read it flatly, as if nothing happened.) In summary.",
        dur: 3,
        hold: 3.5,
        page: "4",
        src: ["planck"],
      },
      {
        head: "You are here.",
        sub: "With today's date under it, and a clock that has not stopped",
        note: "(Turn to the room.) The hydrogen in you dates from the third slide. The date on screen is today's, and the counter in the corner is the same clock that has been running all evening. It did not stop when I did.",
        dur: 9,
        hold: 6,
        page: "now",
        src: ["planck"],
      },
      {
        head: "Any questions? One. What happens next?",
        note: "(Let the slide ask it. Do not answer.) Thank you.",
        dur: 9,
        hold: 8,
        page: "now + 1",
        src: [],
      },
    ],
  },
]

/**
 * The age title cards of Acts III and IV: the card that opens an age sits over the first frame of
 * scene `opens` and prints the age's name and its `span`. `how` shows the arithmetic behind the
 * span and `src` the sources of the dates it uses. An empty `span` means none could be sourced:
 * the card prints the name alone.
 */
export type AgeCard = {
  age: string
  /** Scene id whose first frame the card sits over. */
  opens: string
  span: string
  how: string
  src: SourceKey[]
}

// Every span is arithmetic on two dates the listed sources state; no institution's span is quoted
// except the scientific revolution's. The endpoints are the milestones the scenes stage, so each
// is a choice, shown in `how`. The spans shrink from card to card until the last: the AI age
// starts in 1950, inside the two ages before it, so its honest span (76 years so far) is longer
// than theirs. "About a decade" is true of 2012 to 2022 and is said in `loom`, not on a card.
export const AGE_CARDS: AgeCard[] = [
  { age: "The Stone Age", opens: "spark", span: "about 3.3 million years", how: "3,300,000 years ago (Lomekwi, reported) to 3000 BC, which is 5,025 years ago: 3,294,975 (arithmetic). About 2.6 million if toolmaking starts where the Smithsonian puts it", src: ["harmand", "mcBronze", "siTools"] },
  { age: "Farming and the first cities", opens: "tablet", span: "about 6,600 years", how: "12,000 years ago to c. 3350 BC, which is 5,375 years ago: 6,625 (arithmetic)", src: ["siWorld", "kelley"] },
  { age: "The Bronze and Iron Ages", opens: "metal", span: "about 3,000 years, by region", how: "3000 BC (rule of thumb) to AD 43 (Britain): 3000 + 43 - 1 = 3,042 (arithmetic)", src: ["mcBronze", "ashmoleanIron"] },
  // Name only. No page that could be fetched states a span for classical antiquity, and the
  // mechanism's own dates (150 to 100 BC) are not the age's.
  { age: "The classical age", opens: "gearwork", span: "", how: "no span printed: none could be sourced", src: [] },
  { age: "The age of print", opens: "press", span: "about 150 years", how: "1455 (Gutenberg Bible) to 1610 (Galileo's observations): 155 (arithmetic)", src: ["locGutenberg", "sidereus"] },
  { age: "The scientific revolution", opens: "lens", span: "144 years", how: "1543 to 1687, the usual start and end points as the Bodleian gives them: 144 (arithmetic)", src: ["bodleianSR"] },
  { age: "The Industrial Age", opens: "engine", span: "110 years", how: "1769 (Watt's patent) to 1879 (Edison's lamp): 110 (arithmetic)", src: ["smWatt", "rutgersLamp"] },
  { age: "The Atomic and Space Age", opens: "footprint", span: "under 66 years", how: "17 December 1903 (first flight) to 20 July 1969 (Apollo 11): 65 years 7 months (arithmetic)", src: ["nasmFlyer", "nssdcApollo11"] },
  { age: "The Information Age", opens: "die", span: "about 40 years", how: "December 1947 (transistor) to March 1989 (Web proposal): 41 years 3 months (arithmetic)", src: ["chmTransistor", "cernWeb"] },
  { age: "The AI age", opens: "question", span: "76 years so far", how: "October 1950 (Turing's paper) to November 2026 (METR's latest update): 76 (arithmetic)", src: ["turing", "metrQ4"] },
]

/**
 * The "rule of ages", the running measure along the foot of the frame through Acts III and IV. Its
 * readout is "since the last milestone: N years (arithmetic)": `gap` is the difference between this
 * row's date and the row before it. One headline milestone per scene, strictly shrinking but for
 * one rise (antiquity to print), which is real. `die` and `question` do not click the rule: their
 * dates (1947, 1950) fall before Apollo.
 */
export type RuleMilestone = { scene: string; what: string; date: string; gap: string; src: SourceKey[] }

// The rule: exactly one row per scene, scenes 12 to 26 in order, and the gap shrinks at every step.
// The one exception is antiquity to print (700 years, then 1,554), which is real: nothing was
// chosen to hide it. Two rows carry no gap and do not click the rule, `die` and `question`: their
// dates (1947, 1950) fall before Apollo, so a gap would be negative. `horizon` carries no gap
// either: there the rule swings up and becomes the chart's axis, and the readout changes unit.
// BCE dates are converted with + 2025 (reference year 2026, no year zero).
export const RULE_MILESTONES: RuleMilestone[] = [
  { scene: "spark", what: "stone tools (reported)", date: "3,300,000 years ago", gap: "", src: ["harmand"] },
  { scene: "hands", what: "hand stencil", date: "67,800 years ago", gap: "3,232,200 years (arithmetic)", src: ["harmand", "oktaviana2026"] },
  { scene: "tablet", what: "writing", date: "c. 3350 BC", gap: "62,425 years (arithmetic)", src: ["oktaviana2026", "kelley"] },
  { scene: "metal", what: "the Iron Age in Britain", date: "800 BC", gap: "2,550 years (arithmetic)", src: ["kelley", "ashmoleanIron"] },
  { scene: "gearwork", what: "the Antikythera mechanism", date: "c. 100 BC", gap: "700 years (arithmetic)", src: ["ashmoleanIron", "freeth2006"] },
  { scene: "press", what: "the Gutenberg Bible", date: "1455", gap: "1,554 years (arithmetic)", src: ["freeth2006", "locGutenberg"] },
  { scene: "lens", what: "Newton's prism paper", date: "1672", gap: "217 years (arithmetic)", src: ["locGutenberg", "newton1672"] },
  { scene: "engine", what: "Edison's lamp", date: "1879", gap: "207 years (arithmetic)", src: ["newton1672", "rutgersLamp"] },
  { scene: "footprint", what: "Apollo 11", date: "1969", gap: "90 years (arithmetic)", src: ["rutgersLamp", "nssdcApollo11"] },
  { scene: "die", what: "the transistor (does not click the rule)", date: "1947", gap: "", src: ["chmTransistor"] },
  { scene: "question", what: "Turing's paper (does not click the rule)", date: "1950", gap: "", src: ["turing"] },
  { scene: "board", what: "AlphaGo", date: "2016", gap: "47 years (arithmetic)", src: ["nssdcApollo11", "deepmindAlphaGo"] },
  { scene: "fold", what: "AlphaFold 2", date: "2020", gap: "4 years (arithmetic)", src: ["deepmindAlphaGo", "deepmindCasp14"] },
  { scene: "loom", what: "ChatGPT", date: "2022", gap: "2 years (arithmetic)", src: ["deepmindCasp14", "openaiChatgpt"] },
  { scene: "horizon", what: "the rule becomes the axis; the readout is METR's doubling time, 3.61 months", date: "20 November 2026", gap: "", src: ["metrQ4"] },
]

export const BEAT_COUNT = SCENES.reduce((n, s) => n + s.beats.length, 0)

/** The sources a scene cites, in first-use order, without repeats. */
export function sceneSources(scene: SceneDef): Source[] {
  const seen = new Set<SourceKey>()
  for (const b of scene.beats) for (const k of b.src) seen.add(k)
  return [...seen].map((k) => SOURCES[k])
}
