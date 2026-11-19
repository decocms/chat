#!/bin/sh
# Build step: install the vibebook CLI if it isn't there. It never logs in for you.
. ./lib.sh
if [ -x "$VB" ]; then echo "vibebook CLI found: $VB"; exit 0; fi
echo "Installing the vibebook CLI (https://chat.decocms.com/install.sh)…"
curl -fsSL https://chat.decocms.com/install.sh | sh
