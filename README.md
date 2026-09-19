# 🌱 GreenGrid — Campus Impact Engine

**HackACE 2026 · Domain 3: Gen Z Experience Solutions · Team Geese Coders**

> *AllCollegeEvent tells you which event to attend. GreenGrid tells you what it changed.*

GreenGrid is a full-stack, gamified sustainability layer for college events. Every event gets an explainable **GreenScore**, students earn XP and GreenPoints through **Eco-Missions**, organisers use a live **what-if simulator** and Green Certification, civic issues are routed by a deterministic AI router, sponsor budgets are tracked to the rupee, and every aggregate number is published on a public **Open Data** page — so judges, sponsors and students all read the same numbers.

This is a **fully runnable project** — not a static mock. It has a real Express + JWT backend, a deterministic versioned scoring engine, and a vanilla HTML/CSS/JS frontend with a custom cursor, an animated 4D Impact Twin hypercube, 3D tilt cards, and scroll-reveal micro-interactions.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Quick Start](#2-quick-start)
3. [Login Credentials](#3-login-credentials)
4. [Features & What's Real](#4-features--whats-real)
5. [API Key & Security](#5-api-key--security)
6. [Deploying Online](#6-deploying-online)
7. [GreenScore Engine](#7-greenscore-engine)
8. [Entity & Data Model](#8-entity--data-model)
9. [The Sri Assistant](#9-the-sri-assistant)
10. [Virtual Mentorship](#10-virtual-mentorship)
11. [Sponsor Impact Console](#11-sponsor-impact-console)
12. [Embeddable Widget](#12-embeddable-widget)
13. [Open Data & Validation](#13-open-data--validation)
14. [API Reference](#14-api-reference)
15. [Environment Variables](#15-environment-variables)
16. [Demo Script (2–3 min)](#16-demo-script-23-min)

---

## 1. Project Structure

```
greengrid/
├── README.md
│
├── backend/
│   ├── server.js               Entry point — Express app, middleware, route wiring
│   ├── package.json
│   ├── .env.example            copy to .env before first run
│   ├── .gitignore              (node_modules/, .env, db.json)
│   └── src/
│       ├── data/
│       │   ├── db.js           In-memory store + JSON-file persistence + seed data
│       │   └── db.json         Auto-created on first boot (git-ignored)
│       ├── entities/           Plain-object schemas with factory functions
│       │   ├── User.js
│       │   ├── Event.js
│       │   ├── Mission.js
│       │   ├── Report.js
│       │   ├── Guild.js
│       │   ├── Transaction.js
│       │   ├── Reward.js
│       │   ├── Mentor.js
│       │   └── Impact.js       (Campaign, PoolGroup, VerifiedAction, Certificate, EventGoal)
│       ├── middleware/
│       │   ├── apiKey.js       Shared-secret gate (x-api-key header)
│       │   └── auth.js         JWT bearer token verification + role guard
│       ├── routes/             One file per resource
│       │   ├── auth.routes.js
│       │   ├── dashboard.routes.js
│       │   ├── events.routes.js
│       │   ├── missions.routes.js
│       │   ├── leaderboard.routes.js
│       │   ├── reports.routes.js
│       │   ├── opendata.routes.js
│       │   ├── admin.routes.js
│       │   ├── rewards.routes.js
│       │   ├── impact.routes.js
│       │   ├── embed.routes.js (public — no API key required)
│       │   ├── sri.routes.js
│       │   └── mentors.routes.js
│       └── utils/
│           ├── greenscore.js           Deterministic scoring engine (v2.0)
│           ├── greenscore.validate.js  12-invariant + 6-regression test suite
│           ├── ai-router.js            Local deterministic issue classifier
│           └── ai-insight.js           Optional Claude narration layer
│
└── frontend/
    ├── index.html        Landing page — 4D Impact Twin, live simulator, feature grid
    ├── login.html        Student / Organiser login with role switching
    ├── dashboard.html    Student app (Overview, Events, Missions, Wallet, Community,
    │                                  Report, EcoDNA Passport)
    ├── admin.html        Organiser console (Simulator, Create Event, My Events,
    │                                       Civic Reports)
    ├── sponsor.html      Sponsor Impact Console (campaigns, ledger, Green Deposit)
    ├── mentors.html      Virtual Mentorship (match, book, sessions, close-out)
    ├── opendata.html     Public transparency dashboard + JSON download
    ├── embed-demo.html   Embeddable GreenScore badge demo
    └── assets/
        ├── css/base.css  Shared design tokens, components, dark theme
        └── js/
            ├── api.js          API client (fetch wrapper, auth helpers, esc() XSS guard)
            ├── auth-guard.js   Role-based redirect protection
            ├── cursor.js       Custom cursor, particles, 3D tilt, scroll reveal, GGToast
            └── sri.js          Sri floating assistant widget
```

---

## 2. Quick Start

You need **two terminals** running simultaneously — one for the backend, one for the frontend.

### Terminal 1 — Backend

```bash
cd greengrid/backend

# First time only — installs Express, bcryptjs, jsonwebtoken, cors, dotenv
npm install

# Copy the environment file (only needed once)
cp .env.example .env          # macOS / Linux
copy .env.example .env        # Windows CMD
Copy-Item .env.example .env   # Windows PowerShell

# Start with hot-reload (recommended during development)
npm run dev

# OR start without hot-reload
npm start
```

**Expected output:**

```
🌱 GreenGrid backend running on http://localhost:4000
   Demo student login: rohan@campus.edu / student123
   Demo admin login:   organizer@campus.edu / admin123
```

The backend listens on **port 4000** by default (change with `PORT` in `.env`).

On first boot the server auto-seeds `src/data/db.json` with demo users, events, missions, guilds, mentor slots, and a sponsor campaign. **Delete `db.json` and restart to reseed from scratch.**

> **Note:** If you skip the `cp .env.example .env` step, the server auto-creates it and logs a one-time warning. Both paths work.

---

### Terminal 2 — Frontend

The frontend is plain HTML — **no build step required**. It must be served over `http://`, not opened as a `file://` URL, or API calls will be blocked by the browser's CORS policy.

Pick any static file server:

```bash
# Option A — Node (recommended)
cd greengrid/frontend
npx -y serve .
# opens at http://localhost:3000

# Option B — Python
cd greengrid/frontend
python -m http.server 5500
# opens at http://localhost:5500

# Option C — VS Code
# Install the "Live Server" extension
# Right-click frontend/index.html → "Open with Live Server"
# opens at http://localhost:5500
```

Open the URL your server prints in your browser.

---

### Verify Everything Works

Open the **Open Data** page (`http://localhost:PORT/opendata.html`).

- ✅ Live numbers visible (students, events, CO₂) — full stack is running
- ⚠️ "Backend unreachable" message — check `npm start` is running in `/backend`

---

## 3. Login Credentials

Two demo accounts are pre-seeded automatically on first boot.

| Role | Email | Password | Redirects to |
|------|-------|----------|-------------|
| 🎓 **Student** | `rohan@campus.edu` | `student123` | `dashboard.html` |
| 🏛️ **Organiser** | `organizer@campus.edu` | `admin123` | `admin.html` |

> **Tip:** There is a **"Fill the current role's credentials"** button on the login page — click it to auto-fill without typing during a demo.

### What Each Account Can Do

**Student (`rohan@campus.edu`)**
- View and complete daily Eco-Missions → earn XP, GreenPoints, CO₂ credit
- Browse events with GreenScores and category footprint breakdowns
- Join EcoPool carpool groups to cut transport emissions (awards XP, funds sponsor campaign)
- Redeem GreenPoints for rewards (campus coffee, event passes, eco merch)
- Submit civic issue reports → instant AI routing result
- Claim and verify impact certificates
- View EcoDNA Passport with CO₂ saved, level, rank and unlocked badges
- Talk to Sri (the assistant) about any event, score or mentor

**Organiser (`organizer@campus.edu`)**
- Use the live what-if GreenScore simulator before creating an event
- Create events — checklist toggles update the score in real time
- Certify events that score ≥ 60 → they get a "Green Certified" badge
- View and resolve AI-clustered civic reports (resolving rewards the reporting student)
- See campus-wide analytics and guild stats

### Creating Additional Accounts

```http
POST /api/auth/register
Content-Type: application/json
x-api-key: gg_demo_9f2c1a7e4b6d0158

{
  "name": "Your Name",
  "email": "you@campus.edu",
  "password": "yourpassword",
  "role": "student"
}
```

`role` must be `"student"` or `"admin"`. The server enforces this — selecting the wrong tab on the login form never grants extra access.

### How Authentication Works

1. Login → `POST /api/auth/login` → receives `{ token, user }`
2. Token is a **JWT** signed with `JWT_SECRET`, valid for 7 days
3. `api.js` saves both to `localStorage` (`gg_token`, `gg_user`)
4. Every subsequent API call carries `Authorization: Bearer <token>`
5. `auth-guard.js` on protected pages redirects to `login.html` if session is missing or expired
6. Logout clears both keys from `localStorage`

---

## 4. Features & What's Real

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (student + admin, JWT + bcrypt) | ✅ Real | Role enforced server-side |
| GreenScore / CO₂ / carbon budget engine | ✅ Real | Deterministic, versioned (v2.0) |
| What-if simulator (landing + admin) | ✅ Real | Calls the live engine API |
| Eco-Missions + daily completion + streaks | ✅ Real | |
| GreenPoints wallet + rewards catalog | ✅ Real | Redemption with balance check + evidence rule |
| Leaderboard + Guilds | ✅ Real | |
| Civic issue reporting + AI routing + clustering | ✅ Real | Local deterministic model, clearly labelled |
| Event Green Certification | ✅ Real | Requires GreenScore ≥ 60 |
| EcoPool carpool matching | ✅ Real | Corridor-based, privacy-preserving |
| Collective event goals | ✅ Real | Progress bar + shared reward |
| Impact Receipts / Certificates | ✅ Real | Public verify endpoint (no auth needed) |
| Trust tiers (self-reported vs event-verified) | ✅ Real | Weights: 0.4 / 0.85 / 1.0 |
| Sponsor Green Deposit + ledger | ✅ Real | Per-action funding + rollover |
| Embeddable GreenScore badge | ✅ Real | Shadow DOM isolated |
| Open Data page + JSON download | ✅ Real | Live aggregates |
| GreenScore validation suite | ✅ Real | 12 invariants, 504 configs swept |
| Sri assistant | ✅ Real | Cites live records as sources |
| Virtual Mentorship | ✅ Real | Slot booking, Jitsi video links, session notes |
| EcoDNA Passport | ✅ Real | Rendered from live data |
| Inter-Campus League | 💡 Roadmap | Not yet implemented |
| Social share on Passport | 💡 Out of scope | Screenshot works for demo |

---

## 5. API Key & Security

### Shared API Key

Every request to `/api/*` (except `/api/embed/*` and `/health`) must carry:

```
x-api-key: gg_demo_9f2c1a7e4b6d0158
```

This key is set in two places and **must match exactly**:

| Location | Setting |
|----------|---------|
| `backend/.env` | `GREENGRID_API_KEY=gg_demo_9f2c1a7e4b6d0158` |
| `frontend/assets/js/api.js` | `const API_KEY = 'gg_demo_9f2c1a7e4b6d0158'` |

To use a custom key: change both to the same new string.

### CORS

Controlled by `ALLOWED_ORIGIN` in `.env` (defaults to `*` for local dev). For production:

```env
ALLOWED_ORIGIN=https://your-frontend-domain.com
```

### JWT Secret

```bash
# Generate a strong secret for production
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Set the output as `JWT_SECRET` in your production `.env`.

### XSS Protection

`api.js` exports `GG_API.esc(s)` — an HTML-escape utility that all dynamic `innerHTML` injections use to prevent stored XSS from user-controlled data.

### Embed Routes (Public)

Routes under `/api/embed/` are intentionally unauthenticated — they serve the embeddable badge widget which lives on third-party pages and cannot safely carry a secret key. These routes are strictly read-only.

---

## 6. Deploying Online

### Same Host (e.g. one VPS / Render / Railway)

No config change needed. `api.js` auto-detects non-localhost environments and infers `https://<hostname>:4000/api`.

### Different Hosts (frontend on Netlify/Vercel, backend on Render/Railway)

Add one line to the `<head>` of each HTML file **before** `assets/js/api.js` loads:

```html
<script>window.GG_API_BASE = 'https://your-backend.onrender.com/api';</script>
```

Also set in your backend environment:

```env
ALLOWED_ORIGIN=https://your-frontend.netlify.app
GREENGRID_API_KEY=your-new-random-key
```

And update `API_KEY` in `frontend/assets/js/api.js` to match.

### Recommended Deployment Targets

| Part | Hosts |
|------|-------|
| Backend | Render, Railway, Fly.io, any VPS with Node ≥ 18 |
| Frontend | Netlify, Vercel, GitHub Pages, Surge — upload `frontend/` as-is, no build step |

---

## 7. GreenScore Engine

### Version 2.0 — Five-Category Model

GreenScore v1 charged `0.32 kg CO₂e per person per hour` — silently breaking long events. A 300-person 24-hour hackathon scored **5/100 at 2,304 kg** because transport was charged 24 times over. Transport is a one-time round trip.

v2 splits impact into five categories, each scaling only with what it genuinely depends on:

| Category | Scales with | Rationale |
|----------|-------------|-----------|
| Transport | Attendees | One round trip each, regardless of duration |
| Energy | Attendees × Hours | HVAC, lighting, AV run the entire event |
| Food | Meals (derived from hours) | A 24h event feeds ~5 meals, not 24 |
| Waste | Attendees | One-time per head |
| Materials | Attendees | Badges, certs, signage |

Scoring is **ratio-based against the event's own carbon budget** — so a 24-hour hackathon and a 2-hour seminar can both score 90/100 by being well-run for what they are.

### Checklist Multipliers

| Toggle | Effect |
|--------|--------|
| Hybrid attendance | Reduces transport footprint ~40% |
| Reusable food containers | Cuts food and waste categories |
| Public transport incentive | Lowers per-head transport kg |
| Digital certificates only | Eliminates materials footprint |
| Waste segregation stations | Reduces waste category |

### Model Transparency

```bash
# View all coefficients, units, and stated basis
GET /api/events/model/assumptions

# Run the full validation suite (CLI or HTTP)
node backend/src/utils/greenscore.validate.js
GET /api/events/model/validate
```

The validation suite sweeps **504 event configurations** across **12 invariants**, including:
- *Monotonicity* — adding a green action can never lower the score
- *Transport-duration independence* — 8× duration must not produce 8× footprint
- *Dimensional coherence* — category parts sum to the reported total
- *Determinism* — identical input, identical output

---

## 8. Entity & Data Model

### Relationships

```
User ──< Transaction >── Mission / Event / Report   (every reward has a reason)
User >── Guild                                       (many students per guild)
Event ── organizerId ──> User (role=admin)
Report ── reporterId ──> User
Report ── clusterId ──> groups related reports into one incident
Campaign ── eventIds[] ──> Event[]
PoolGroup ── eventId ──> Event, memberIds[] ──> User[]
Certificate ── userId + eventId ──> verifiable public code
Session ── studentId + mentorId + slotId
```

### Collections in `db.json`

| Collection | Purpose |
|-----------|---------|
| `users` | Students and organisers with XP, GreenPoints, CO₂, streak, badges, guild |
| `events` | Events with GreenScore, CO₂ estimate, carbon budget, checklist, certified flag |
| `missions` | Daily eco-actions with XP/GP/CO₂ rewards |
| `reports` | Civic issues with AI classification (category, urgency, team, confidence, cluster) |
| `transactions` | Immutable ledger — every XP/GP/CO₂ change has a human-readable reason |
| `guilds` | Campus action groups with aggregate CO₂ and issues-solved |
| `rewards` | Redeemable items (coffee, passes, merch) with sponsor and GP cost |
| `campaigns` | Sponsor funding pools with per-action price, ledger, and rollover balance |
| `pools` | EcoPool carpool groups per event and corridor |
| `actions` | Verified eco-actions with trust tier |
| `certificates` | Impact certificates with public verify code |
| `goals` | Collective CO₂ targets per event with shared reward |
| `mentors` | Mentor profiles with expertise, slots, rating |
| `sessions` | Booked mentorship sessions with video link, notes, action items |

**Persistence:** Written to `db.json` on every mutation. Delete the file and restart to reseed.

---

## 9. The Sri Assistant

Sri is a **query layer over live platform state**, not a decorative chatbot.

- A deterministic intent router selects a handler from the message
- The handler reads live records or calls the GreenScore engine directly
- Sri cannot hallucinate a GreenScore because it never generates one — it only reports what the engine computed
- Every reply carries a `sources` array naming records read (e.g. `User:u_abc`, `Validation:greenscore-v2.0`)
- Sources are rendered under each message in the UI so every answer is checkable

If `ANTHROPIC_API_KEY` is set in `.env`, Claude rephrases answers more naturally — but it is given the facts and told not to add any. Without a key, the deterministic templated answer is returned. The app is fully functional without a key.

**UI:** Round green **Sri** button, bottom-right corner of every page. Opens a chat panel with typing indicator, suggestion chips, and source citations.

---

## 10. Virtual Mentorship

### Matching Algorithm

| Signal | Weight |
|--------|--------|
| Exact expertise phrase match | +10 |
| Related term match | +5 |
| Available slots | +0 to +3 |
| Rating ≥ 4.7 | +1 |

Availability is only a tiebreak — a well-matched mentor with one slot outranks a poor match with ten. Every card shows which terms matched.

### Booking Flow

1. Describe your need → mentors ranked by relevance score
2. Click a time slot → fill topic and pre-session question → confirm
3. Slot is claimed atomically — a second student gets 409 Conflict
4. A `joinUrl` (Jitsi Meet room, no account required) is returned immediately — **the link works right now**

### Closing a Session

- Notes are required to save
- Action items saved to profile as a tickable list
- Completing a session awards **+80 XP**
- Cancelling frees the slot for another student

---

## 11. Sponsor Impact Console

Sponsors fund verified outcomes at a price per action — not impressions.

| Concept | How it works |
|---------|-------------|
| Per-action funding | Campaign sets `perActionInr`; deducted on each verified student action |
| Covered actions | Only `event_verified` tier or higher draws down funds; self-reported earns XP but not sponsor money |
| Green Deposit | Unspent budget rolls forward to the next event instead of expiring |
| Metrics | Actions funded, kg CO₂e attributed, cost per action, cost per kg CO₂e |
| Ledger | Full auditable transaction history with timestamps and notes |

---

## 12. Embeddable Widget

Any external page can embed a live GreenScore with one script tag:

```html
<script
  src="https://your-backend/api/embed/widget.js"
  data-event-id="evt_abc123"
  data-theme="light"
></script>
```

- Rendered into a **Shadow DOM** — host CSS cannot leak in, GreenGrid CSS cannot leak out
- No API key needed — intentionally public so third-party sites can embed it without setup
- Read-only — no state mutations are possible

See `embed-demo.html` for a live demo inside a mock third-party page with deliberately clashing serif styling.

---

## 13. Open Data & Validation

```
GET /api/opendata
```

Returns live aggregates: students, events, CO₂, transactions, events by category, reports by category, guild table, model version. Nothing is hand-typed — all numbers are read from the Transaction ledger and GreenScore engine.

**Download:** Click "Download .json" on the Open Data page → `greengrid-opendata.json`

**Validation:**

```bash
GET /api/events/model/validate
node backend/src/utils/greenscore.validate.js
```

Returns per-invariant and per-regression-case pass/fail. The `scope` field states exactly what the suite does and does not prove — it validates internal consistency, not measured real-world emissions.

---

## 14. API Reference

All routes (except where noted) require the `x-api-key` header. Routes marked **JWT** also require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | Key | Create account `{ name, email, password, role }` |
| `POST` | `/api/auth/login` | Key | Login `{ email, password }` → `{ token, user }` |
| `GET` | `/api/auth/me` | JWT | Current user profile |

### Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/dashboard` | JWT | Full student dashboard (stats, events, missions, receipts) |

### Events

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/events` | Key | All events (`?category=`) |
| `GET` | `/api/events/:id` | Key | Single event |
| `POST` | `/api/events` | JWT+admin | Create event |
| `POST` | `/api/events/simulate` | Key | What-if scoring (no persistence) |
| `GET` | `/api/events/model/assumptions` | Key | Scoring coefficients |
| `GET` | `/api/events/model/validate` | Key | Run validation suite |
| `GET` | `/api/events/:id/receipt` | Key | Full impact receipt |
| `GET` | `/api/events/:id/recommendations` | Key | Ranked improvement advice |
| `PATCH` | `/api/events/:id/checklist` | JWT+admin | Update checklist + rescore |
| `POST` | `/api/events/:id/certify` | JWT+admin | Certify (requires score ≥ 60) |

### Missions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/missions` | JWT | All missions + today's completion status |
| `POST` | `/api/missions/:id/complete` | JWT | Complete a mission |

### Leaderboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/leaderboard` | JWT | Campus leaderboard |
| `GET` | `/api/leaderboard/guilds` | JWT | Guild standings |

### Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/reports` | JWT | My reports |
| `POST` | `/api/reports` | JWT | Submit a civic issue report |

### Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/overview` | JWT+admin | Stats + my events + guilds |
| `GET` | `/api/admin/reports` | JWT+admin | All reports with AI routing data |
| `POST` | `/api/admin/reports/:id/resolve` | JWT+admin | Resolve + reward reporting student |

### Impact Layer

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/impact/ecopool/:eventId` | JWT | EcoPool groups for event |
| `POST` | `/api/impact/ecopool/:eventId/join` | JWT | Join a carpool group `{ corridor }` |
| `POST` | `/api/impact/actions` | JWT | Log a verified action |
| `GET` | `/api/impact/trust-tiers` | Key | Trust tier definitions |
| `GET` | `/api/impact/goal/:eventId` | Key | Collective goal + progress |
| `GET` | `/api/impact/certificates` | JWT | My certificates |
| `POST` | `/api/impact/certificates/issue` | JWT | Claim a certificate `{ eventId }` |
| `GET` | `/api/impact/campaigns` | Key | All sponsor campaigns |
| `POST` | `/api/impact/campaigns/:id/rollover` | Key | Roll unspent balance to next event |

### Rewards

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/rewards` | JWT | Rewards catalog |
| `POST` | `/api/rewards/:id/redeem` | JWT | Redeem (balance + evidence check) |

### Mentors

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/mentors` | Key | All mentors (`?need=` for ranked matching) |
| `POST` | `/api/mentors/:id/book` | JWT | Book a slot `{ slotId, topic, question }` |
| `GET` | `/api/mentors/sessions/mine` | JWT | My booked sessions |
| `POST` | `/api/mentors/sessions/:id/complete` | JWT | Close out + add notes (+80 XP) |
| `POST` | `/api/mentors/sessions/:id/cancel` | JWT | Cancel + free the slot |
| `POST` | `/api/mentors/sessions/:id/actions/:idx/toggle` | JWT | Tick/untick an action item |

### Open Data

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/opendata` | Key | Public aggregate dataset |

### Embed (No Auth Required)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/embed/widget.js` | None | Embeddable badge script |
| `GET` | `/api/embed/badge/:eventId` | None | Raw badge data JSON |
| `GET` | `/api/embed/verify/:code` | None | Verify a certificate by public code |

### Sri

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/sri/ask` | Key | Ask the assistant `{ message }` |
| `GET` | `/api/sri/capabilities` | Key | Starter suggestion chips |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | None | Server alive check |

---

## 15. Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `GREENGRID_API_KEY` | `gg_demo_9f2c1a7e4b6d0158` | Yes | Shared API secret — must match `api.js` |
| `JWT_SECRET` | `dev-secret-change-me` | **Yes in prod** | Signs login tokens — use a long random string in production |
| `PORT` | `4000` | No | Port the backend listens on |
| `ALLOWED_ORIGIN` | `*` | **Yes in prod** | CORS origin — set to your frontend URL in production |
| `ANTHROPIC_API_KEY` | *(empty)* | No | Enables Claude-phrased narration on issue reports. App fully functional without it |

---

## 16. Demo Script (2–3 min)

### Step 1 — Landing Page
- Hover over the **4D Impact Twin** hypercube → it pulses and rotates
- Flip 2–3 toggles in the **live simulator** → GreenScore and CO₂ update from the real API
- Say: *"Every number comes from a versioned engine on the backend — not hardcoded"*

### Step 2 — Login as Student
1. Click **"Enter GreenGrid"** → `rohan@campus.edu` / `student123` (or use "Fill credentials")
2. **Overview** → live stats: Level, CO₂ Saved, GreenPoints, Streak
3. Tick a **Mission** → toast fires, XP and GreenPoints update instantly
4. **Explore Events** → click any event card → detail modal opens with:
   - Category footprint split bar (transport / energy / food / waste / materials)
   - Collective goal progress + contributor count
   - EcoPool groups with seat indicators → click **Join** → XP awarded, sponsor campaign charged
5. **Report an Issue** → submit → instant AI routing: category, urgency, team, confidence

### Step 3 — Switch to Organiser
1. Log out → `organizer@campus.edu` / `admin123`
2. **Create Event** → change attendees and duration → GreenScore updates live as you type
3. Toggle checklist items → score climbs in real time
4. **Publish** → appears in "My Events" → **Certify** (if score ≥ 60)
5. **Civic Reports** → click "Resolve" → student who filed it is rewarded automatically

### Step 4 — Open Data (the trust closer)
1. Navigate to **Open Data** (`/opendata.html`)
2. Same numbers, live — nobody typed these for the demo
3. Click **"Re-run now"** on the validation panel → watch 12-invariant suite execute
4. Click **"Download .json"** → *"Judges can verify every number independently"*

### Step 5 — Mentorship (bonus)
1. Navigate to **Mentorship** (`/mentors.html`)
2. Type `"cutting transport emissions for a hackathon"` → mentors ranked, matched terms highlighted
3. Click a time slot → booking modal → *"The Jitsi video link works right now — no account needed"*

---

*GreenGrid — HackACE 2026, Domain 3: Gen Z Experience Solutions | Team Geese Coders*
