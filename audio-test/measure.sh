#!/bin/bash
f=${1:-test.wav}
ffmpeg -hide_banner -i $f -af astats=measure_perchannel=none -f null - 2>&1 | grep -E "Peak level|RMS level dB" | sed 's/.*\] //'
ffmpeg -hide_banner -i $f -af ebur128=peak=true -f null - 2>&1 | grep -A14 Summary | grep -E " I:|LRA:|Peak:" 
ffmpeg -hide_banner -i $f -af ebur128 -f null - 2>&1 | grep -oE "t: *[0-9.]+ .*S: *[-0-9.]+" | awk '{t=$2; for(i=1;i<=NF;i++) if($i=="S:") S=$(i+1); k=int(t); if (k!=last) {printf "%d:%s ", k, S; last=k}} END{print ""}'
