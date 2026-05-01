---
layout: default
title: Linux machine setup
---

# Linux machine setup

Use **`scripts/install-linux-machine.sh`** on a Debian/Ubuntu host to install Docker and start the **`api`** + **`web`** services from `local_deploy.yaml`.

```bash
bash scripts/install-linux-machine.sh --refresh-env --lan-ip 192.168.1.50
```

Generated env files match **`apps/api/.env.example`** (Fastify + SQLite + CORS). There is **no** separate control-panel stack to install alongside the repo.

See also **`docs/local-network-streaming.md`** and **`docs/icecast-fallback-guide.md`** if you run Icecast on the same LAN.
