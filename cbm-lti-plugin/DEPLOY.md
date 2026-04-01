# Deploying CBM LTI Plugin on simonmccallum.org.nz

## Quick Start

```bash
# On the server (ssh simon@simonmccallum.org.nz)
cd /opt/cbm-lti-plugin   # or wherever you clone

# Copy and edit env files
cp .env.example .env
cp ../novelty_detector/.env.example ../novelty_detector/.env
# Edit both .env files with API keys and secrets

# Build and start
docker compose up -d --build

# Check health
curl http://localhost:3001/health
curl http://localhost:5001/novelty/api/health
```

## Architecture on simonmccallum.org.nz

```
Internet
  │
  ├── :80/:443 → Nginx Proxy Manager (NPM at :81)
  │                ├── /novelty/*     → novelty-detector :5001
  │                ├── /cbm-quiz/*    → cbm-lti :3001        ← NEW
  │                ├── default        → six-animal-model :3000
  │                └── ludogogy.co.nz → cbm-lti :3001        ← FUTURE
  │
  └── Docker containers:
        ├── cbm-lti          :3001 (Node.js LTI plugin)
        ├── cbm-novelty-detector :5001 (Python FAISS/LLM sidecar)
        ├── cbm-mongo        :27017 (MongoDB for ltijs state)
        └── cbm-ollama       :11434 (optional local LLM)
```

## Routing Options

### Option A: Path prefix (immediate — no DNS changes)

Route `https://simonmccallum.org.nz/cbm-quiz/` to the plugin.

**In Nginx Proxy Manager (http://192.168.1.64:81):**

1. Edit the existing proxy host for `simonmccallum.org.nz`
2. Go to **Custom locations** tab
3. Add new location:
   - Location: `/cbm-quiz`
   - Scheme: `http`
   - Forward Hostname: `192.168.1.64` (or `host.docker.internal`)
   - Forward Port: `3001`
4. In the **Advanced** tab for this location, add:
   ```nginx
   proxy_read_timeout 300s;
   client_max_body_size 50M;
   proxy_set_header X-Forwarded-Proto $scheme;
   ```
5. Save

Then set in `.env`:
```
EXTERNAL_URL=https://simonmccallum.org.nz/cbm-quiz
```

### Option B: Subdomain (when DNS is ready)

Route `https://ludogogy.co.nz` or `https://cbm.simonmccallum.org.nz` to the plugin.

**DNS:** Point `ludogogy.co.nz` A record to `103.224.130.189`

**In Nginx Proxy Manager:**

1. Add new proxy host:
   - Domain: `ludogogy.co.nz`
   - Scheme: `http`
   - Forward Hostname: `192.168.1.64`
   - Forward Port: `3001`
   - Enable SSL (Let's Encrypt)
2. Advanced tab:
   ```nginx
   proxy_read_timeout 300s;
   client_max_body_size 50M;
   ```

Then set in `.env`:
```
EXTERNAL_URL=https://ludogogy.co.nz
```

## Environment Configuration

### cbm-lti-plugin/.env
```bash
PORT=3000
NODE_ENV=production
DATABASE_PATH=/app/data/cbm-lti.db
LTI_KEY=generate-a-random-secret-here
MONGODB_URI=mongodb://mongo:27017/cbm-lti
EXTERNAL_URL=https://simonmccallum.org.nz/cbm-quiz

# Python sidecar (internal Docker network name)
SIDECAR_URL=http://novelty-detector:5000
```

### novelty_detector/.env
```bash
# At least one API key for System 2 question generation
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# GOOGLE_API_KEY=AI...

FLASK_DEBUG=0
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_PROVIDER=local
DEFAULT_LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
```

## Canvas LTI Registration

Once running, register the tool in Canvas:

### For Institution Admins (Dynamic Registration)

1. In Canvas Admin → Developer Keys → `+ Developer Key` → LTI Key
2. Method: **Enter URL**
3. Enter: `https://simonmccallum.org.nz/cbm-quiz/register`
4. Canvas will auto-discover the OIDC, JWKS, and redirect URLs

### For Course-Level Testing

1. In Canvas course → Settings → Apps → `+ App`
2. Configuration Type: **By URL**
3. Config URL: `https://simonmccallum.org.nz/cbm-quiz/register`

### Manual Registration

If dynamic registration doesn't work:

| Field | Value |
|-------|-------|
| Title | CBM Assessment |
| Target Link URI | `https://simonmccallum.org.nz/cbm-quiz/` |
| OpenID Connect Initiation URL | `https://simonmccallum.org.nz/cbm-quiz/login` |
| JWK Set URL | `https://simonmccallum.org.nz/cbm-quiz/keys` |
| Redirect URIs | `https://simonmccallum.org.nz/cbm-quiz/` |

## Operations

```bash
# View logs
docker compose logs -f cbm-lti
docker compose logs -f novelty-detector

# Restart
docker compose restart cbm-lti

# Rebuild after code changes
docker compose up -d --build cbm-lti

# Run database migrations manually
docker exec cbm-lti node dist/models/migrate.js

# Backup database
docker cp cbm-lti:/app/data/cbm-lti.db ./backup-$(date +%Y%m%d).db

# Shell into container
docker exec -it cbm-lti sh

# Embed question bank (after importing QTI questions)
curl -X POST http://localhost:5001/api/validator/embed-bank \
  -H "Content-Type: application/json" \
  -d '{"course_id": "your-course-id"}'
```

## Upgrading

```bash
cd /opt/cbm-lti-plugin
git pull
docker compose up -d --build
```

The SQLite database is in a Docker volume (`lti-data`) and persists across rebuilds.

## Ports Summary

| Service | Internal Port | Host Port | Purpose |
|---------|--------------|-----------|---------|
| cbm-lti | 3000 | 3001 | LTI plugin (Node.js) |
| novelty-detector | 5000 | 5001 | FAISS + LLM sidecar (Python) |
| MongoDB | 27017 | — | ltijs state (not exposed) |
| Ollama | 11434 | — | Local LLM (optional) |

## Transitioning to ludogogy.co.nz

When you're ready to move the DNS:

1. Point `ludogogy.co.nz` A record to `103.224.130.189`
2. Add the domain in NPM with SSL
3. Update `.env`: `EXTERNAL_URL=https://ludogogy.co.nz`
4. Update Canvas LTI registration URLs
5. `docker compose restart cbm-lti`
