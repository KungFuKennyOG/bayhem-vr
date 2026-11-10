#!/bin/bash
# LIGHTS OUT review frames: fixed positions at standing eye height on the real-play path (no autopilot),
# plus the set pieces. usage: tools/lights-out-review.sh <outdir>   (dev server on :5173)
export NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules}
OUT=${1:-/tmp/lo-review}; mkdir -p "$OUT"
cd "$(dirname "$0")/.."
shot() { timeout 560 node tools/shot.cjs "level=lights-out&noauto=1&$1" "$OUT/$2" "$3" 2>&1 | grep -v "ReadPixels" | grep -v "^$" | cut -c1-60; }
shot ""                                   01_intro   60
shot "beat=road"                          02_road    45
shot "beat=heron&yaw=11"                 03_heron   270,2760,2850,2940
shot "beat=wave"                          04_wave    150
shot "beat=bridge&px=692&pz=276&yaw=0"    05_bridge  60
shot "beat=fore"                          06_fore    40
shot "beat=lift"                          07_lift    40
shot "beat=lift&yaw=140"                  07b_ride   1500
shot "beat=roof&yaw=90"               08_roof    300,560
shot "beat=jump"                          09_jump    40
shot "beat=glide&yaw=35"                 10_glide   300,360,420
shot "beat=glide&yaw=60"                  11_glide   780,1050,1350
shot "beat=glide"                         11b_glide  1650
shot "beat=outro"                         12_outro   330
