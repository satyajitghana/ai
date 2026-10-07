# Where the generators read and write. Every generator imports this (directly
# or through its folder's common module) instead of hard-coding paths.
#   MATH_REELS_OUT  the folder the specs are written to (default: the repo's data/math-reels)
#   MATH_REVIEWS    the folder of the openai/math review *.jsonl files (not in the repo;
#                   the reviews the specs were written from)
import os

GEN = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(GEN, '..', '..', '..', '..'))
OUT = os.environ.get('MATH_REELS_OUT', os.path.join(REPO, 'data', 'math-reels'))
REVIEWS = os.environ.get('MATH_REVIEWS', os.path.join(REPO, '..', 'oaimath', 'reviews'))
