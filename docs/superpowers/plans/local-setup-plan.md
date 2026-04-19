# Layers — Mac Mini Self-Hosting Setup Plan

## Context & goal

**Project:** Layers (formerly Drafter) — a security architecture diagramming + threat intelligence platform.  
**Objective:** Self-host the full stack on a Mac Mini with zero monthly hosting cost, publicly accessible, and hardened against attacks.  
**Repos:**
- Frontend: `https://github.com/sunilkrpv/layers` (React + React Flow)
- Backend: `https://github.com/sunilkrpv/layers-rest` (Node/Python REST API) — **this repo contains the existing `docker-compose.yml`**

**Stack:** React frontend · Node/Python backend · PostgreSQL · Redis · Nginx · Docker Compose · Cloudflare Tunnel · Tailscale

---

## Architecture summary

```
Internet → Cloudflare (WAF + DDoS + Tunnel) → Mac Mini
                                                 └── Nginx (reverse proxy, TLS)
                                                       ├── Frontend container
                                                       └── Backend container
                                                             ├── PostgreSQL container
                                                             └── Redis container
```

Key principle: **no open inbound ports on the router**. Cloudflare Tunnel creates an outbound-only encrypted connection. The Mac Mini firewall and router never expose any port to the internet.

---

## What has already been decided / designed

### Directory layout on Mac Mini

```
~/layers/                           ← top-level working directory
├── layers-rest/                    ← git clone of sunilkrpv/layers-rest
│   ├── docker-compose.yml          ← primary compose file (already exists, needs extension)
│   ├── .env                        ← secrets (never commit)
│   └── .gitignore                  ← must include .env and ../certs/
│
├── layers/                         ← git clone of sunilkrpv/layers
│
├── nginx/
│   └── nginx.conf                  ← reverse proxy config (outside both repos)
│
└── certs/                          ← TLS certs (outside both repos, never commit)
    ├── fullchain.pem
    └── privkey.pem
```

### `.env` file location
- Lives at `~/layers/layers-rest/.env` (next to `docker-compose.yml`)
- Permissions: `chmod 600 .env`
- Must be in `.gitignore`

### Nginx config location
- Lives at `~/layers/nginx/nginx.conf`
- Mounted read-only into the Nginx container via Docker volume

---

## What Claude Code needs to do

Work through the phases below in order. For each phase, read the existing files in the repo before making changes.

---

### Phase 1 — Audit existing `docker-compose.yml` in `layers-rest`

**Goal:** Understand the current service names, ports, and volumes before adding anything.

**Tasks:**
1. Read `layers-rest/docker-compose.yml` in full
2. Note the exact service names for backend and database
3. Note which internal ports the backend listens on
4. Note any existing volume definitions
5. Check if a `.env.example` or `.env.sample` exists and list its variables
6. Report findings before making any changes

---

### Phase 2 — Add missing services to `docker-compose.yml`

**Goal:** Extend (not rewrite) the existing compose file with frontend, nginx, redis (if missing), and monitoring.

**Services to add if not already present:**

```yaml
frontend:
  build:
    context: ../layers        # sibling repo directory
    dockerfile: Dockerfile
  restart: unless-stopped
  environment:
    - NODE_ENV=production
    - VITE_API_URL=https://<DOMAIN>/api   # replace <DOMAIN> after user confirms

nginx:
  image: nginx:alpine
  restart: unless-stopped
  ports:
    - "127.0.0.1:80:80"       # IMPORTANT: bind to localhost only, not 0.0.0.0
    - "127.0.0.1:443:443"
  volumes:
    - ../nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ../certs:/etc/nginx/certs:ro
  depends_on:
    - frontend
    - <backend-service-name>   # use actual name from existing compose

redis:                         # skip if already present
  image: redis:7-alpine
  restart: unless-stopped
  command: redis-server --requirepass ${REDIS_PASS}

uptime-kuma:
  image: louislam/uptime-kuma:1
  restart: unless-stopped
  ports:
    - "127.0.0.1:3001:3001"   # accessible via Tailscale only
  volumes:
    - kuma_data:/app/data
```

**Important rules:**
- Nginx ports must bind to `127.0.0.1` (localhost only) — Cloudflare Tunnel connects to localhost, not the external interface
- Do not expose PostgreSQL or Redis ports externally
- Keep all existing service definitions intact

---

### Phase 3 — Create `.env` template

**Goal:** Create a `.env.example` (safe to commit) and a `.env` (never commit) with all required variables.

**Create `layers-rest/.env.example`:**

```env
# Database
DB_PASS=changeme

# Redis
REDIS_PASS=changeme

# JWT / Auth
JWT_SECRET=changeme

# App
NODE_ENV=production
DOMAIN=yourdomain.com

# Optional: AI keys if backend calls LLM APIs
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
```

**Generate actual `.env` values:**
```bash
cd ~/layers/layers-rest
echo "DB_PASS=$(openssl rand -base64 32)" >> .env
echo "REDIS_PASS=$(openssl rand -base64 32)" >> .env
echo "JWT_SECRET=$(openssl rand -base64 48)" >> .env
echo "NODE_ENV=production" >> .env
echo "DOMAIN=yourdomain.com" >> .env
chmod 600 .env
```

**Update `.gitignore` in `layers-rest`:**
```
.env
../certs/
```

---

### Phase 4 — Create `nginx/nginx.conf`

**Goal:** Create the reverse proxy config at `~/layers/nginx/nginx.conf`.

Check the actual service names and ports from `docker-compose.yml` before writing the proxy_pass values.

```nginx
events {
  worker_processes auto;
}

http {
  # Rate limiting — 30 requests/min per IP on API routes
  limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;

  # Redirect HTTP → HTTPS
  server {
    listen 80;
    server_name <DOMAIN>;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl;
    server_name <DOMAIN>;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy no-referrer;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:;";

    # Frontend — catch-all (React SPA)
    location / {
      proxy_pass http://frontend:<FRONTEND_PORT>;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API — rate limited
    location /api/ {
      limit_req zone=api burst=20 nodelay;
      proxy_pass http://<BACKEND_SERVICE>:<BACKEND_PORT>;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support (if Layers uses WS for live diagram updates)
    location /ws/ {
      proxy_pass http://<BACKEND_SERVICE>:<BACKEND_PORT>;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
  }
}
```

Replace `<DOMAIN>`, `<FRONTEND_PORT>`, `<BACKEND_SERVICE>`, `<BACKEND_PORT>` with actual values from the repos.

---

### Phase 5 — Create a `Dockerfile` for the frontend (if missing)

**Goal:** If `layers/Dockerfile` doesn't exist, create a production Dockerfile for the React app.

```dockerfile
# layers/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# layers/nginx-frontend.conf
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # SPA fallback — all routes serve index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

---

### Phase 6 — Create database backup script

**Goal:** Create `layers-rest/scripts/backup.sh`.

```bash
#!/bin/bash
BACKUP_DIR="${BACKUP_DIR:-/tmp/layers-backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

docker compose -f ~/layers/layers-rest/docker-compose.yml exec -T db \
  pg_dump -U layers layers \
  | gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

# Retain last 30 days only
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup complete: db_$TIMESTAMP.sql.gz"
```

```bash
chmod +x ~/layers/layers-rest/scripts/backup.sh
# Add to crontab (daily at 2am)
(crontab -l 2>/dev/null; echo "0 2 * * * ~/layers/layers-rest/scripts/backup.sh") | crontab -
```

---

### Phase 7 — Validate the full setup

After all files are in place, run these checks:

```bash
# 1. Validate docker-compose syntax
cd ~/layers/layers-rest
docker compose config

# 2. Build all images
docker compose build

# 3. Start everything
docker compose up -d

# 4. Check all containers are running
docker compose ps

# 5. Test Nginx config inside container
docker compose exec nginx nginx -t

# 6. Tail logs for errors
docker compose logs -f --tail=50
```

---

## Phases NOT covered here (do after the above works)

The following phases were designed but are done manually, not via code:

| Phase | What to do |
|---|---|
| **Phase 4** | Install `cloudflared`, create tunnel, configure `~/.cloudflared/config.yml`, run `sudo cloudflared service install` |
| **Phase 5** | Run `certbot certonly --manual --preferred-challenges dns`, place certs in `~/layers/certs/`, set Cloudflare SSL mode to Full (Strict) |
| **Phase 6** | Install Tailscale on Mac Mini and your laptop for secure SSH admin access |

See the full guide in the Claude chat for step-by-step commands for each of these.

---

## Open questions for Claude Code to resolve from the repos

- [ ] What is the backend service name in `docker-compose.yml`?
- [ ] What port does the backend listen on internally?
- [ ] Does the frontend repo have a `Dockerfile`? If yes, what port does it expose?
- [ ] Does the frontend use `VITE_API_URL` or a different env var name for the API base URL?
- [ ] Is Redis already in the existing `docker-compose.yml`?
- [ ] What is the PostgreSQL service name and database name in the existing compose?
- [ ] Does the backend use WebSockets (relevant for the Nginx WS proxy block)?