#!/usr/bin/env bash
# Mix a narration track with a film's generated score and mux into web assets.
#
#   mux.sh <silent-render.mp4> <voice.wav> <scored-render.mp4|-> <out-prefix>
#
# Produces <out-prefix>.mp4, <out-prefix>.webm and <out-prefix>-poster.jpg.
# Pass "-" for the scored render to ship the voice alone.
#
# The webm is listed first in <Video>, so it is the file most browsers fetch:
# it is the one that has to be small. Audio is mono — this is speech over flat
# vector art, stereo buys nothing and costs bitrate.
set -euo pipefail
VIDEO=$1; VOICE=$2; SCORE=$3; OUT=$4
POSTER_AT=${POSTER_AT:-0}
BED=${BED:-0.13}          # score level under the voice
CRF_H264=${CRF_H264:-33}
CRF_VP9=${CRF_VP9:-46}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

if [ "$SCORE" = "-" ]; then
  cp "$VOICE" "$TMP/mix.wav"
else
  DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VOICE")
  ffmpeg -v error -y -i "$SCORE" -vn -ar 48000 -ac 1 -c:a pcm_s16le "$TMP/score.wav"
  ffmpeg -v error -y -i "$VOICE" -i "$TMP/score.wav" -filter_complex \
    "[1:a]volume=${BED},apad,atrim=0:${DUR}[bed];[0:a][bed]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.95,aresample=48000[a]" \
    -map "[a]" -ar 48000 -ac 1 -c:a pcm_s16le "$TMP/mix.wav"
fi

ffmpeg -v error -y -i "$VIDEO" -i "$TMP/mix.wav" -map 0:v -map 1:a \
  -c:v libx264 -tune animation -preset veryslow -crf "$CRF_H264" -pix_fmt yuv420p \
  -profile:v high -level 4.0 -c:a aac -b:a 64k -ac 1 -ar 48000 \
  -movflags +faststart -shortest "${OUT}.mp4"

ffmpeg -v error -y -i "$VIDEO" -i "$TMP/mix.wav" -map 0:v -map 1:a \
  -c:v libvpx-vp9 -crf "$CRF_VP9" -b:v 0 -row-mt 1 -deadline good -cpu-used 1 \
  -pix_fmt yuv420p -c:a libopus -b:a 48k -ac 1 -ar 48000 -shortest "${OUT}.webm"

ffmpeg -v error -y -i "$VIDEO" -ss "$POSTER_AT" -frames:v 1 -q:v 6 "${OUT}-poster.jpg"

for f in "${OUT}.mp4" "${OUT}.webm" "${OUT}-poster.jpg"; do
  printf '%-40s %9d bytes\n' "$f" "$(stat -c%s "$f")"
done
ffmpeg -hide_banner -i "$TMP/mix.wav" -af volumedetect -f null /dev/null 2>&1 | grep -E 'mean_volume|max_volume'
