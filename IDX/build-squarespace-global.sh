#!/bin/sh
# Rebuild IDX/squarespace-global.css for pasting into Squarespace → Design → Custom CSS.
set -e
cd "$(dirname "$0")"
{
  printf '%s\n' '/* ASG Squarespace Custom CSS — paste this entire file. Rebuild: ./build-squarespace-global.sh */'
  printf '\n'
  cat squarespace-global-part-a.css
  printf '\n'
  cat squarespace-global-part-b.css
  printf '\n'
  cat squarespace-tail.css
} > squarespace-global.css
echo "Wrote squarespace-global.css ($(wc -c < squarespace-global.css | tr -d ' ') bytes)"
