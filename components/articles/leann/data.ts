// Everything here was measured by me on one corpus: 20,000 chunks of 100 words each, cut from 25 public-domain
// Project Gutenberg books, embedded with all-MiniLM-L6-v2 (384-d, normalised), inner-product search, k = 10.
// Queries are the first 16 words of held-out chunks from the same books. Ground truth is exact search over the
// stored vectors. Software: leann-core and leann-backend-hnsw 0.3.8, faiss-cpu 1.15.1, torch 2.14.1, 2 CPU threads.

export const N_CHUNKS = 20_000
export const DIM = 384

// Bytes on disk. FAISS: IndexHNSWFlat (M 32, efConstruction 200) written with faiss.write_index.
// LEANN: LeannBuilder(backend "hnsw", is_recompute, is_compact, M 32, efConstruction 200) from the same vectors.
export const SIZES = {
  vectors: 30_720_000, // 20,000 x 384 x 4
  faissIndex: 36_162_530,
  leannIndex: 3_234_570,
  passages: 12_156_140,
  passagesIdx: 248_756,
  ids: 108_890,
  meta: 666,
}

// Stored-vector HNSW, 100 queries. ndis = mean distance computations per query (faiss hnsw_stats).
export const FAISS = [
  { ef: 16, recall: 0.802, lat_ms: 0.232, ndis: 664 },
  { ef: 32, recall: 0.903, lat_ms: 0.267, ndis: 1044 },
  { ef: 64, recall: 0.963, lat_ms: 0.439, ndis: 1728 },
  { ef: 128, recall: 0.991, lat_ms: 0.698, ndis: 2867 },
]

// LEANN, recompute on every visit. n = queries run (it is slow). texts = mean chunks sent to the embedding
// server per query, counted from the server's own log; rounds = round trips; sec = wall seconds per query.
export const LEANN = [
  { ef: 16, n: 15, recall: 0.847, texts: 663, rounds: 23.5, sec: 25.3 },
  { ef: 32, n: 15, recall: 0.947, texts: 1045, rounds: 38.4, sec: 39.1 },
  { ef: 64, n: 15, recall: 0.973, texts: 1757, rounds: 70.1, sec: 64.1 },
  { ef: 128, n: 6, recall: 0.983, texts: 2768, rounds: 133.3, sec: 91.8 },
]
