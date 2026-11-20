// The four photos the splat viewer can show, with what the viewer needs to put its camera where the
// photographer stood. All four are CC0 photographs from Wikimedia Commons, used at 1920 px wide.
// fPx is the focal length SHARP was given: the photo's EXIF 35 mm-equivalent focal length turned
// into pixels of the 1920 px image (f35 x diagonal / 43.27 mm). depth is the median depth of the
// splat's front layer, from the beast2 run; yaw and pitch are how far the orbit may swing before
// the scene stops holding, chosen by looking at each splat.

import type { SceneGeom } from "./splat-gl"

export type SplatScene = SceneGeom & {
  id: string
  label: string
  /** site paths (through mediaUrl) */
  photo: string
  depthMap: string
  splat: string
  /** download size, for the button */
  size: string
  alt: string
  credit: string
  page: string
}

const DIR = "/articles/depth-pro-2-single-image-splats"

export const SCENES: SplatScene[] = [
  {
    id: "hall",
    label: "Court hall",
    photo: `${DIR}/hall-photo.jpg`,
    depthMap: `${DIR}/hall-depth.jpg`,
    splat: `${DIR}/hall.spz`,
    size: "about 8 MB",
    w: 1920,
    h: 1440,
    fPx: 1497.7,
    depth: 4.45,
    yaw: 14,
    pitch: 7,
    alt: "A white entrance hall in a court building in Ostrava: square pillars, a tiled floor in grey and white, wooden doors along the left wall and a staircase rising at the back right.",
    credit: "Qasinka, CC0",
    page: "https://commons.wikimedia.org/wiki/File:2021_Ostrava_Krajsk%C3%BD_soud_chodba_(bud._A).jpg",
  },
  {
    id: "cabin",
    label: "Ship's cabin",
    photo: `${DIR}/cabin-photo.jpg`,
    depthMap: `${DIR}/cabin-depth.jpg`,
    splat: `${DIR}/cabin.spz`,
    size: "about 8 MB",
    w: 1920,
    h: 1440,
    fPx: 1442.2,
    depth: 3.05,
    yaw: 14,
    pitch: 7,
    alt: "A low white-painted cabin on USS Constitution: a wooden dining table with chairs in front of a mirrored sideboard, a beam ceiling and a doorway at the back.",
    credit: "Education Prof, CC0",
    page: "https://commons.wikimedia.org/wiki/File:Interior_Room_on_the_USS_Constitution_in_Boston.jpg",
  },
  {
    id: "facade",
    label: "Painted facade",
    photo: `${DIR}/facade-photo.jpg`,
    depthMap: `${DIR}/facade-depth.jpg`,
    splat: `${DIR}/facade.spz`,
    size: "about 8 MB",
    w: 1920,
    h: 1439,
    fPx: 1497.3,
    depth: 21.15,
    yaw: 10,
    pitch: 6,
    alt: "A Bavarian house in Oberammergau with painted murals across its front, blue and white flags, a wooden balcony under a wide roof and two small cars parked in front.",
    credit: "Jebulon, CC0",
    page: "https://commons.wikimedia.org/wiki/File:Dorfstrasse_20,_Oberammergau,_Bavaria,_Germany.jpg",
  },
  {
    id: "courtyard",
    label: "Glass courtyard",
    photo: `${DIR}/courtyard-photo.jpg`,
    depthMap: `${DIR}/courtyard-depth.jpg`,
    splat: `${DIR}/courtyard.spz`,
    size: "about 8 MB",
    w: 1920,
    h: 1440,
    fPx: 1497.7,
    depth: 9.97,
    yaw: 11,
    pitch: 6,
    alt: "The courtyard of the Simose Art Museum: a stone path between beds of dark gravel and thin trees, leading to a glass wall that reflects the hills and the sky.",
    credit: "Licjar Xeymelloz, CC0",
    page: "https://commons.wikimedia.org/wiki/File:Simose_Art_Museum_courtyard_2025.jpg",
  },
]
