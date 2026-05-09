#!/usr/bin/env bash

NODE22_BIN="/opt/homebrew/opt/node@22/bin"
if [ -x "$NODE22_BIN/node" ]; then
  export PATH="$NODE22_BIN:$PATH"
fi

npm run db:migrate
./dispatch-dev.sh dev
