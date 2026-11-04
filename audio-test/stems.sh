#!/bin/bash
# render stems and print integrated loudness / peak for each
cd "$(dirname "$0")"
for s in "$@"; do
  node run.cjs 40 $s /tmp/claude-0/-home-claude/1542c773-fb6b-5e5d-a0c6-cea07a1c8e8a/scratchpad/stem_$s.wav >/dev/null
  I=$(ffmpeg -hide_banner -i /tmp/claude-0/-home-claude/1542c773-fb6b-5e5d-a0c6-cea07a1c8e8a/scratchpad/stem_$s.wav -af ebur128 -f null - 2>&1 | grep -A1 "Integrated" | grep "I:" | awk '{print $2}')
  P=$(ffmpeg -hide_banner -i /tmp/claude-0/-home-claude/1542c773-fb6b-5e5d-a0c6-cea07a1c8e8a/scratchpad/stem_$s.wav -af astats=measure_perchannel=none -f null - 2>&1 | grep "Peak level" | awk '{print $NF}')
  echo "$s: I=$I LUFS peak=$P dB"
done
