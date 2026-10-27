// Measured by public/articles/layerfs/toy_store.py (a Python toy, not LayerFS): 157 commits sampled evenly, oldest to newest, from the git history
// of this site's repository with public/ excluded, 569,351 file occurrences, 7,795,062,839 logical bytes. Every number is a byte
// count. zlib level 6 stands in for zstd everywhere, so ratios between rows hold and absolute sizes do not match LayerFS.
export type Row = { k: number; plain: number; gzTar: number; hard: number; toyFlat: number; toyPaged: number; payload: number; dirFlat: number; dirPaged: number }

// gzTar is the per-file zlib sum scaled by 0.895, the ratio measured on the last snapshot (19,623,863 B real tar.gz over 21,923,627 B summed).
export const ROWS: Row[] = [
  { k: 1, plain: 43038560, gzTar: 16036540, hard: 42965402, toyFlat: 18518389, toyPaged: 18529076, payload: 18265844, dirFlat: 252545, dirPaged: 263232 },
  { k: 5, plain: 216080249, gzTar: 80470365, hard: 46973941, toyFlat: 19082698, toyPaged: 18884223, payload: 18505502, dirFlat: 577196, dirPaged: 378721 },
  { k: 10, plain: 433707986, gzTar: 161444540, hard: 48135384, toyFlat: 19804810, toyPaged: 19321387, payload: 18801262, dirFlat: 1003548, dirPaged: 520125 },
  { k: 20, plain: 878987674, gzTar: 326601068, hard: 57798255, toyFlat: 21445940, toyPaged: 20417145, payload: 19571800, dirFlat: 1874140, dirPaged: 845345 },
  { k: 30, plain: 1336578539, gzTar: 495623848, hard: 66569651, toyFlat: 23416542, toyPaged: 21858594, payload: 20778495, dirFlat: 2638047, dirPaged: 1080099 },
  { k: 40, plain: 1815101112, gzTar: 670955001, hard: 70428603, toyFlat: 24725366, toyPaged: 22665719, payload: 21287157, dirFlat: 3438209, dirPaged: 1378562 },
  { k: 50, plain: 2302517561, gzTar: 849109419, hard: 73973162, toyFlat: 25946508, toyPaged: 23422921, payload: 21778672, dirFlat: 4167836, dirPaged: 1644249 },
  { k: 60, plain: 2787790226, gzTar: 1026449035, hard: 77920318, toyFlat: 27428905, toyPaged: 24252973, payload: 22319862, dirFlat: 5109043, dirPaged: 1933111 },
  { k: 70, plain: 3279691180, gzTar: 1205912888, hard: 81956117, toyFlat: 28866360, toyPaged: 25078453, payload: 22852800, dirFlat: 6013560, dirPaged: 2225653 },
  { k: 80, plain: 3778347341, gzTar: 1387557616, hard: 86994513, toyFlat: 30324338, toyPaged: 25880981, payload: 23420813, dirFlat: 6903525, dirPaged: 2460168 },
  { k: 90, plain: 4282248340, gzTar: 1570838876, hard: 93122407, toyFlat: 31873346, toyPaged: 26703051, payload: 23967297, dirFlat: 7906049, dirPaged: 2735754 },
  { k: 100, plain: 4791045274, gzTar: 1755673039, hard: 97147124, toyFlat: 33056024, toyPaged: 27288787, payload: 24335144, dirFlat: 8720880, dirPaged: 2953643 },
  { k: 110, plain: 5304551697, gzTar: 1942022644, hard: 102590876, toyFlat: 34523384, toyPaged: 28189864, payload: 24903102, dirFlat: 9620282, dirPaged: 3286762 },
  { k: 120, plain: 5824138256, gzTar: 2130333603, hard: 109920800, toyFlat: 35936312, toyPaged: 29013787, payload: 25467109, dirFlat: 10469203, dirPaged: 3546678 },
  { k: 130, plain: 6347572532, gzTar: 2319869397, hard: 115611708, toyFlat: 37336046, toyPaged: 29813120, payload: 26000247, dirFlat: 11335799, dirPaged: 3812873 },
  { k: 140, plain: 6877644785, gzTar: 2511493986, hard: 122659198, toyFlat: 38978161, toyPaged: 30641612, payload: 26532305, dirFlat: 12445856, dirPaged: 4109307 },
  { k: 150, plain: 7414913903, gzTar: 2705377265, hard: 128182096, toyFlat: 40538894, toyPaged: 31575692, payload: 27165397, dirFlat: 13373497, dirPaged: 4410295 },
  { k: 157, plain: 7795062839, gzTar: 2842323078, hard: 132433378, toyFlat: 41561905, toyPaged: 32093681, payload: 27500226, dirFlat: 14061679, dirPaged: 4593455 },
]

export const LAST = ROWS[ROWS.length - 1]
export const XZ_ARCHIVE = 20_388_344 // one xz -6 tar of the 4,525 unique blobs: smallest, but not mountable
export const GZ_ARCHIVE = 37_760_206 // the same tar through zlib 6

// What LayerFS itself reported for its own 157-snapshot run (docs/research/layerfs-vs-btrfs-157/REPORT.md, September 2026 research candidate).
export const REPORTED = {
  logical: 4_936_693_030,
  layerfsResearch: 184_598_528,
  layerfsRelease: 100_100_000, // README: 100.1 MB, rounded in the README
  btrfsZstd: 1_994_596_352,
  parts: [
    { name: "payload groups", b: 98_256_041 },
    { name: "structure groups", b: 56_719_413 },
    { name: "pack headers", b: 378_096 },
    { name: "database, indexes", b: 26_357_298 },
    { name: "unattributed", b: 2_887_680 },
  ],
}
