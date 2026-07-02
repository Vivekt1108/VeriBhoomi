# VeriBhoomi — Transparent Land Records & Fraud Detection

Most land fraud doesn't hide in one document — it hides in the **contradictions
between** documents and parties. VeriBhoomi models a property as a web of owners,
inheritances, taxes, liens, approvals and disputes, then runs a **deterministic
fraud-detection engine** (no AI / no paid API) over that web to surface risks,
score the property, and keep a human officer in the loop.

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + Framer Motion + React Flow |
| Backend | Node + Express + TypeScript |
| Database | PostgreSQL via Prisma ORM (use free **Neon** cloud Postgres) |
| Auth | JWT + bcrypt, role + jurisdiction enforced on the backend |

The fraud engine (`server/src/engine`) is a **pure module** — same input always
gives the same output, runs with zero external services, fully unit-tested.

## Project layout

```
veribhoomi/
├── server/   # Express API + Prisma + the fraud engine + tests
└── web/      # Next.js frontend (cartographic / archival design)
```

## Prerequisites (same on Mac and Windows)

- Node.js 18+ (https://nodejs.org)
- A free Postgres database. Easiest: **Neon** (https://neon.tech) — sign up,
  create a project, copy the connection string. No install needed.

## Setup — step by step

### 1. Backend

```bash
cd server
npm install
cp .env.example .env          # on Windows: copy .env.example .env
```

Open `server/.env` and paste your Neon connection string into `DATABASE_URL`,
and set any long random string for `JWT_SECRET`.

```bash
npm run prisma:push           # creates the tables in your database
npm run seed                  # loads 4 sample properties + demo users
npm run dev                   # API runs on http://localhost:4000
```

### 2. Frontend (in a second terminal)

```bash
cd web
npm install
npm run dev                   # app runs on http://localhost:3000
```

Open http://localhost:3000.

## Demo accounts (password: `password123`)

| Email | Role | Can do |
|-------|------|--------|
| citizen@demo.in | Citizen | Search properties, view health reports |
| officer@demo.in | Officer | Verify/override findings in their jurisdiction |
| authority@demo.in | Authority | Officer powers + audit log, region-wide |
| admin@demo.in | Admin | Manage users (separation of duty) |

## The four sample properties

1. **Whitefield (SY-147)** — clean, scores 100.
2. **Koramangala (SY-89)** — double-sold + plot-area mismatch.
3. **Indiranagar (SY-56)** — hidden active lien + open court case.
4. **Jayanagar (SY-203)** — inheritance conflict + circular ownership.

Open any property and click **Run fraud analysis** to compute findings + score.
Hover a finding to highlight the exact records that triggered it in the graph.

## The fraud rules

1. Double-selling (overlapping ownership periods)
2. Broken chain of title (unexplained gaps)
3. Inheritance conflict (owner is not the recorded heir)
4. Tax paid by a non-owner
5. Hidden active lien (clear-title claim vs open encumbrance)
6. Area / survey-number mismatch across documents
7. Active litigation
8. Circular / benami ownership pattern

## Testing

```bash
cd server
npm test                      # runs the fraud-engine unit tests
```

## Notes

- This is a demonstration system on **sample data** — it is not connected to any
  real government records.
- OCR (reading scanned documents) is designed as an isolated module and is
  currently mocked with sample extracted fields. Real OCR (OpenCV preprocessing
  + PaddleOCR/EasyOCR) can be plugged in behind the same interface later.
