# Ledgerly

![CWE-639](https://img.shields.io/badge/CWE--639-IDOR-red?style=flat-square)
![Node](https://img.shields.io/badge/Node-Express-blue?style=flat-square&logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/Lab-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
[![GHCR](https://img.shields.io/badge/ghcr.io-iv0ks%2Fledgerly-blue?logo=docker)](https://github.com/iv0ks/ledgerly/pkgs/container/ledgerly)

**Ledgerly is an intentionally vulnerable application built for security education.** It contains a deliberate [IDOR / broken access control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
(CWE-639) flaw so you can practice finding and exploiting it in a safe and controlled environment.

<br>

<div align="center">

| 🛡️ Vulnerability | 🎯 Difficulty | 🛠️ Stack | 🚩 Entry point |
| :--- | :--- | :--- | :--- |
| IDOR (CWE-639) | ⭐ Level 1 (Read IDOR) | Node · Express | `GET /api/invoices/:id` |

</div>

<br>

> [!NOTE]
> The guided, spoiler-free path is [GUIDE.md](GUIDE.md); the full answer waits in [SOLUTION.md](SOLUTION.md) whenever you want it.

<br>

## 📂 Project layout

The repository is organised so the vulnerable code is easy to find and reason
about. The **application** lives in `src/` (a small Express API plus a static
dashboard), the **data layer** is Drizzle ORM over Postgres (`src/db/` +
`drizzle/` migrations), and the **tooling** around it (Docker, CI/CD, linters)
turns the lab into a production-shaped project. The challenge flag is never in
the repo — it is baked into the image and seeded into the victim's invoice.

```
ledgerly/
├── src/                      # the application (the bug lives here)
│   ├── server.ts             # HTTP entrypoint
│   ├── app.ts                # Express app factory (session, static, routes)
│   ├── routes.ts             # routes — the vulnerable invoice endpoint
│   ├── auth.ts               # password hashing + session typing
│   ├── config.ts             # env-backed configuration
│   ├── db/
│   │   ├── schema.ts         # Drizzle schema (users, invoices)
│   │   ├── client.ts         # Postgres connection
│   │   ├── migrate.ts        # applies migrations on startup
│   │   └── seed.ts           # seeds users + invoices (flag on the victim's)
│   └── public/               # the dashboard UI (html/css/js)
├── drizzle/                  # generated SQL migrations
├── tests/                    # http smoke tests (vitest + supertest)
├── tools/traefik/            # reverse-proxy config (static + dynamic routing)
├── GUIDE.md                  # non-spoiler learning guide
├── SOLUTION.md               # exploit writeup + the fix (spoilers)
├── SECURITY.md               # security policy (it's a lab — read before reporting)
├── .github/workflows/        # integration · delivery · security · release
├── Dockerfile                # hardened multi-stage image
├── docker-compose.yml        # db + ledgerly + traefik stack
├── docker-entrypoint.sh      # migrates + seeds, then starts the app
└── .env.example              # DB creds, session secret, flag, Traefik ACME
```

The flag is **not** in the repo: the `Dockerfile` bakes it in via a build arg
and the seed writes it into one user's invoice note.

<br>

## 🚀 The Lab

The lab ships as a Docker Compose stack with three services:

- **`db`** — Postgres 16. The app waits until it is *healthy* before migrating.
- **`ledgerly`** — the API + dashboard, published on port `3000`.
- **`traefik`** — an optional reverse proxy for HTTPS on a real hostname.

Because the stack attaches to an **external** Docker network (`iv0ks-dev`),
create it once before the first run:

```bash
docker network create iv0ks-dev
```

<br>

#### Option A — app + database (quickest)

Start the database and the app (Compose skips `traefik` when you name services
explicitly):

```bash
docker compose up -d db ledgerly
```

The entrypoint migrates the schema and seeds the data automatically, so the app
is ready at:

- **<http://localhost:3000>**

Sign in with the seeded demo account **`alice` / `password123`**. That is all
you need to start playing with Burp Suite.

<br>

#### Option B — full stack with Traefik (HTTPS + hostname)

Bring up everything to also expose the app through Traefik with TLS:

```bash
docker compose up -d
```

Now the _same_ app is reachable two ways at once:

- **<http://localhost:3000>** — direct, no TLS (handy for quick testing).
- **<https://ledgerly.iv0ks.dev>** — proxied by Traefik with a real certificate.

Traefik routing is defined in `tools/traefik/`. TLS uses the ACME DNS-01
challenge via Namecheap, so Traefik needs those API credentials — copy
`.env.example` to `.env` and fill them in (the `.env` file is gitignored). The
dashboard is at `https://traefik.iv0ks.dev`.

<br>

> [!CAUTION]
> The `ledgerly.iv0ks.dev` hostname must resolve to the host running the stack.
> For purely local experiments, Option A (localhost) is simpler and needs no
> DNS or certificates.

<br>

#### Running without cloning (prebuilt image)

The app image on GHCR still needs a Postgres to talk to, so Compose is the
easiest path. To pull the published image instead of building locally:

```bash
docker compose pull ledgerly && docker compose up -d db ledgerly
```

Then open <http://localhost:3000>.

<br>

## 🎯 The Challenge

### The Scenario

Ledgerly is an invoicing console. You sign in as **alice**, and your dashboard
lists **your** invoices — only yours. Each invoice has an id, and there is an
endpoint to open one by its id. A legitimate user only ever opens invoices they
can see on their own dashboard. You're going to prove that boundary is an
illusion.

### Your objective

Read an invoice that does **not** belong to you — specifically, reach another
user's invoice and capture the flag hidden in its internal note.

> [!NOTE]
> The flag has the format `FLAG{...}`.

### The rules

Everything happens over HTTP against the running app — no need to read the
source to win (though you can). The flag is **not** in the repo: it lives in
another user's record in the database, reachable only by breaking access
control on the running app.

> [!TIP]
> For the full method, the **[Learning Guide](GUIDE.md)** walks you through it.
