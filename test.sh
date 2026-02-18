#!/usr/bin/env bash

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); const ok = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22; if (!ok) { console.error(`Node ${process.versions.node} is not supported. Use Node >=20.19.0 (or >=22.12.0).`); process.exit(1); }'

npm test
