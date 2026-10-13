# Installation Guide - FutureKawa Frontend

> **Audience:** Developers, DevOps engineers, and technical contributors.  
> **Repository:** [github.com/Pogauh/front-mspr2](https://github.com/Pogauh/front-mspr2)

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Architecture Overview](#2-architecture-overview)
3. [Project Structure](#3-project-structure)
4. [Prerequisites](#4-prerequisites)
5. [Local Development Setup](#5-local-development-setup)
6. [Environment Variables](#6-environment-variables)
7. [Mock Mode (no backend)](#7-mock-mode-no-backend)
8. [Available Scripts](#8-available-scripts)
9. [Code Quality Tooling](#9-code-quality-tooling)
10. [Running Tests](#10-running-tests)
11. [Docker & Production Build](#11-docker--production-build)
12. [SonarQube](#12-sonarqube)
13. [Backend API Contract](#13-backend-api-contract)

---

## 1. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| UI Framework | [Vue 3](https://vuejs.org/) (Composition API + `<script setup>`) | `^3.5` |
| Build Tool | [Vite](https://vite.dev/) | `^8.0` |
| Language | TypeScript | `~6.0` |
| State Management | [Pinia](https://pinia.vuejs.org/) | `^3.0` |
| Routing | [Vue Router](https://router.vuejs.org/) | `^5.0` |
| Charting | [Chart.js](https://www.chartjs.org/) | `^4.4` |
| Unit testing | [Vitest](https://vitest.dev/) + [@vue/test-utils](https://test-utils.vuejs.org/) | `^4.1` |
| E2E testing | [Playwright](https://playwright.dev/) (Chromium) | `^1.61` |
| Formatting | [Prettier](https://prettier.io/) | `3.8` |
| Type checking | vue-tsc | `^3.2` |
| Container | Docker (multi-stage) + nginx | alpine |
| Code Quality | SonarQube Community | `9000` |

---

## 2. Architecture Overview

![Frontend-architecture](/docs/architecture.png "Frontend Architecture")

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / Client                     │
│                                                             │
│   Vue 3 SPA (Vite build → nginx static serve)               │
│   ┌───────────┐  ┌────────────┐  ┌──────────────────────┐   │
│   │ Vue Router│  │   Pinia    │  │  Chart.js components │   │
│   │  (RBAC)   │  │  stores    │  │  (readings, KPIs)    │   │
│   └───────────┘  └────────────┘  └──────────────────────┘   │
│          │               │                                  │
│   ┌──────▼───────────────▼──────────────────────────────┐   │
│   │                  services/api.ts                    │   │
│   │   Bearer JWT · fetch wrapper · 401 auto-logout      │   │
│   └──────────────────────────────┬──────────────────────┘   │
└─────────────────────────────────-│──────────────────────────┘
                                   │  HTTP / REST
                    ┌──────────────▼──────────────────┐
                    │   nginx reverse proxy (Docker)  │
                    │   /api-siege/ → backend-siege   │
                    └─────────────────────────────────┘
                                   │
                                   │
                                   │                    
                          ┌────────▼──────┐   
                          │  Siège API    │   
                          │  :8080        │   
                          └───────────────┘   
```

### Key Design Decisions

- **Role-Based Access Control (RBAC):** enforced at the router level via `router.beforeEach`. Each route has an allowlist of roles defined in `ROLE_ACCESS` (`src/router/index.ts`). Unauthorized navigation silently redirects to `/dashboard`.
- **Auto-scoped data:** on login, `auth.store.ts` enriches the user object with their `farm_id` and `warehouse_ids` by calling the geo API. All service calls use `autoFilters` (from the store) to automatically constrain queries to the user's country/farm/warehouse.
- **Multi-backend architecture:** the application targets a distributed backend with one API per country, called by the 'siege API'. The Vite dev server and nginx proxy both expose a single `/api-siege` entry point that routes to the 'siege API'.
- **Mock mode:** a full in-memory mock layer (`src/mocks/`) intercepts all `fetch` calls when `VITE_MOCK=true`, enabling full frontend development without any backend running.

---

## 3. Project Structure

```
src/
├── assets/           # Static CSS (base.css, main.css) and SVG logo
├── components/
│   ├── charts/       # ReadingChart.vue - Chart.js temperature/humidity graph
│   └── common/       # Shared UI: AppNav, AlertBadge, LotTable, LotHistory,
│                     #            CascadeFilter, Pagination, StatusBadge, ThresholdDot
├── config/
│   └── routes.ts     # Role → default redirect map (ROLE_DEFAULT_ROUTES)
├── mocks/
│   ├── data.ts       # Static fixture data (lots, alerts, users, warehouses…)
│   └── handlers.ts   # Mock fetch router - maps URL patterns to fixture data
├── router/
│   └── index.ts      # Vue Router setup + RBAC navigation guard
├── services/
│   ├── api.ts        # Base fetch wrapper (auth header, 401 handling, mock toggle)
│   ├── auth.service.ts
│   ├── alerts.service.ts
│   ├── geo.service.ts
│   ├── history.service.ts   # Lot history (GET /history/{idLot})
│   ├── lots.service.ts
│   ├── movements.service.ts
│   ├── readings.service.ts
│   ├── reporting.service.ts
│   └── status-overrides.ts   # Local overrides for lot status (localStorage)
├── stores/
│   ├── auth.store.ts          # User session, role, auto-filters
│   ├── alerts.store.ts        # Alert polling (30 s interval), unread count
│   └── filters.store.ts       # Cascade filter state (country/farm/warehouse/zone)
├── types/            # TypeScript interfaces: Lot, Alert, Movement, Reading…
├── views/
│   ├── LoginView.vue
│   ├── DashboardView.vue
│   ├── alerts/AlertsView.vue
│   ├── lots/LotListView.vue
│   ├── lots/LotDetailView.vue
│   ├── monitoring/MonitoringView.vue
│   └── roles/
│       ├── farm/FarmView.vue · CreateLotView.vue
│       ├── warehouse/WarehouseView.vue · MovementsView.vue
│       ├── quality/QualityView.vue
│       ├── supply-chain/SupplyChainView.vue
│       └── hq/HQView.vue
├── App.vue           # Root component - mounts AppNav + RouterView
└── main.ts           # App bootstrap: Vue, Pinia, Router
```

Unit tests live next to the code they cover (`*.test.ts`, e.g. `services/lots.service.test.ts`).

Other folders and files at the repository root:

```
e2e/                       # Playwright end-to-end tests (*.spec.ts, fixtures.ts, pages/ page objects)
docs/                      # architecture.png, Contributing.md, SONARQUBE_SETUP.md
public/user-guide.pdf      # End-user guide (English), opened from the help button of the navigation bar
.github/workflows/ci.yml   # CI: build, unit tests + coverage, E2E tests, SonarQube (optional), Docker image
Dockerfile · nginx.conf    # Production image (Node build stage, nginx serve stage) and /api-siege proxy
vite.config.ts · vitest.config.ts · playwright.config.ts · sonar-project.properties
```

---

## 4. Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | **22.12.0** (or 20.19.0 LTS) | Enforced via `engines` field in `package.json` |
| npm | 10+ | Bundled with Node 22 |
| Git | Any recent | - |
| Docker + Docker Compose | 24+ | Required only for production / SonarQube |

> **Tip:** use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to switch Node versions easily.

---

## 5. Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/Pogauh/front-mspr2.git
cd front-mspr2

# 2. Install dependencies
npm install

# 3. Configure environment: create a .env file at the project root (no template is
#    versioned, .env* is git-ignored) with the variables of Section 6

# 4. Start the dev server
npm run dev
```

The app is available at **http://localhost:5173** by default.

Hot Module Replacement (HMR) is enabled - changes to `.vue` and `.ts` files are reflected instantly without a full reload.

---

## 6. Environment Variables

All variables are prefixed with `VITE_` and exposed to the browser at build time.

| Variable | Default | Description |
|---|---|---|
| `VITE_MOCK` | `false` | Set to `true` to enable the in-memory mock layer (no backend required) |
| `VITE_API_BASE_URL` | `/api-siege` | Base URL for all API requests. In dev, proxied by Vite to the backend |

**Typical `.env` for development with a local backend:**

```env
VITE_MOCK=false
VITE_API_BASE_URL=/api-siege
```

The Vite dev server proxies `/api-siege` to `http://localhost:8085` (configured in `vite.config.ts`), the port of the HQ (siège) API (`docker compose up -d` in `backend-siege`, or `SERVER_PORT=8085` when it is run from Maven):

```ts
server: {
  proxy: {
    '/api-siege': {
      target: 'http://localhost:8085',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api-siege/, ''),
    },
  },
},
```

> **Never commit `.env`** - it is listed in `.gitignore` (`.env*`), so no `.env.example` template is versioned: create `.env` by hand from the examples above.

---

## 7. Mock Mode (no backend)

Set `VITE_MOCK=true` in your `.env` to run the entire application without any backend.

```env
VITE_MOCK=true
VITE_API_BASE_URL=/api-siege
```

All `fetch` calls are intercepted by `src/mocks/handlers.ts`, which routes requests to static fixtures in `src/mocks/data.ts`.

**Pre-configured mock users:**

| Email | Password | Role                |
|---|--------|---------------------|
| `farm@futurekawa.com` | `test` | Farm Manager        |
| `warehouse@futurekawa.com` | `test` | Warehouse Manager   |
| `quality@futurekawa.com` | `test` | Quality Team        |
| `supply@futurekawa.com` | `test` | Supply Chain        |
| `hq@futurekawa.com` | `test` | HQ                  |

---

## 8. Available Scripts

| Script | Command | Description |
|---|---|---|
| Dev server | `npm run dev` | Start Vite dev server with HMR on port 5173 |
| Type check | `npm run type-check` | Run `vue-tsc --build` (no emit) |
| Build | `npm run build` | Type-check + production bundle in `dist/` |
| Build only | `npm run build-only` | Production bundle without type check |
| Preview | `npm run preview` | Serve the `dist/` folder locally |
| Unit tests | `npm run test:unit` | Run Vitest in watch mode |
| Unit tests + coverage | `npm run test:coverage` | Run Vitest once with V8 coverage (`coverage/`) |
| E2E tests | `npm run test:e2e` | Run the Playwright tests (Chromium, mock backend) |
| E2E tests (UI) | `npm run test:e2e:ui` | Open the Playwright UI to run and debug the E2E tests |
| Dev server (E2E) | `npm run dev:e2e` | Vite on port 5174 in `e2e` mode; started automatically by Playwright |
| Lint | `npm run lint` | Run oxlint then ESLint (both with `--fix`) |
| Format | `npm run format` | Run Prettier on `src/` |

---

## 9. Code Quality Tooling

### Prettier

Configured in `.prettierrc.json`:

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100
}
```

### ESLint + oxlint

Two-stage linting pipeline (`lint:oxlint` → `lint:eslint`):

- **oxlint** handles fast, low-level correctness rules (configured in `.oxlintrc.json`)
- **ESLint** applies Vue-specific and TypeScript rules on top

Both are run with `--fix` - the majority of issues are auto-corrected.

### EditorConfig

`.editorconfig` enforces consistent formatting across editors:

- Indent: 2 spaces
- End of line: LF
- Charset: UTF-8
- Max line length: 100

---

## 10. Running Tests

### Unit tests (Vitest)

```bash
# Run tests once
npx vitest run

# Run in watch mode (recommended during development)
npm run test:unit

# Run once with coverage report (same as: npx vitest run --coverage)
npm run test:coverage
```

Coverage is generated in `coverage/` using the V8 provider. Reports are output in three formats: `lcov`, `text` (console), and `html`.

The lcov report (`coverage/lcov.info`) is the one consumed by SonarQube.

**Test environment:** jsdom (browser-like DOM emulation via Vitest's `environment: 'jsdom'` config). The `e2e/` folder is excluded from Vitest (`vitest.config.ts`).

### End-to-end tests (Playwright)

The E2E tests drive the real application in Chromium against the in-memory mock layer (`VITE_MOCK=true`): no backend is needed.

```bash
# One-time setup: download the Chromium browser used by Playwright
npx playwright install chromium

# Run all E2E tests (headless)
npm run test:e2e

# Interactive mode (Playwright UI)
npm run test:e2e:ui
```

- Specs are in `e2e/` (`auth`, `dashboard`, `lots`, `alerts`, `navigation`), with a `LoginPage` page object in `e2e/pages/` and shared helpers in `e2e/fixtures.ts`.
- Playwright starts its own dev server on port **5174** (`npm run dev:e2e`, so it does not clash with `npm run dev` on 5173) and reuses it if it is already running. In CI it builds the bundle once and serves it with `vite preview` instead.
- Tests run sequentially (single worker) to avoid cross-test pollution of the in-memory mock state.
- An HTML report is written to `playwright-report/`; screenshots are kept on failure and traces on the first retry (2 retries in CI).

---

## 11. Docker & Production Build

### Build the image

```bash
docker build -t futurekawa-frontend .
```

The `Dockerfile` is a two-stage build:

1. **Stage 1 (builder):** Node 22 Alpine - installs dependencies and runs `npm run build-only`, producing the `dist/` folder. `VITE_MOCK` and `VITE_API_BASE_URL` are frozen at build time: pass them with `--build-arg` if the defaults (`false` and `/api-siege`) do not suit you.
2. **Stage 2 (serve):** nginx Alpine - copies `dist/` and the custom `nginx.conf`, listens on port 80.

### nginx proxy

`nginx.conf` forwards `/api-siege/` requests to `http://backend-siege:8080/` (the HQ API service, container port 8080) with the `/api-siege` prefix removed, and serves the SPA with HTML5 history mode (`try_files $uri $uri/ /index.html`).

nginx resolves the `backend-siege` host name when it starts: the container only starts on a Docker network where a service with that name exists, which is the case in the full stack below.

### Full stack (Docker Compose)

The complete demo stack is started from the **`backend-siege`** repository, not from this one. It brings up the three country backends (each with Mosquitto, PostgreSQL and Adminer), the HQ backend (with its PostgreSQL and Adminer) and this frontend, all from Docker Hub images.

```bash
# In the backend-siege repository
docker compose up -d

# Check status
docker compose ps
```

| Service | URL | Description |
|---|---|---|
| Frontend | http://localhost:3000 | Vue.js SPA served by nginx |
| HQ backend (siège) | http://localhost:8085 | REST API used by the frontend (Swagger UI: `/swagger-ui/index.html`) |

### SonarQube

SonarQube is not started by this repository. Use the `sonar` profile of the backend repositories (`docker compose --profile sonar up -d`): it serves [http://localhost:9000](http://localhost:9000) (default login `admin` / `admin` on first start) and a single instance is enough for the three projects. Then see Section 12.

---

## 12. SonarQube

Static analysis is configured in `sonar-project.properties`.

**Key settings:**

| Property | Value |
|---|---|
| `sonar.projectKey` | `futurekawa-frontend` |
| `sonar.sources` | `src/` |
| `sonar.javascript.lcov.reportPaths` | `coverage/lcov.info` |
| `sonar.qualitygate.wait` | `true` - scanner fails if the Quality Gate is not passed |

**CI gate (when Sonar is enabled).** In `.github/workflows/ci.yml`, the `sonar` job also checks that the overall coverage reported by
SonarQube is at least `COVERAGE_MIN` (80 %), and the `docker` job depends on it: the image is built and pushed only if the Quality Gate and
the coverage threshold both pass. When the repository variable `SONAR_ENABLED` is not `true`, the `sonar` job is skipped and does not block
the image. If the self-hosted runner is offline while `SONAR_ENABLED` is `true`, the pipeline waits for it and nothing is published: set the
variable back to `false` in that case.

**Running the scanner locally:**

```bash
# 1. Generate coverage first
npx vitest run --coverage

# 2. Run the scanner (requires SONAR_TOKEN or admin credentials)
docker run --rm \
  -e SONAR_HOST_URL=http://localhost:9000 \
  -e SONAR_TOKEN=<your_token> \
  -v "$(pwd):/usr/src" \
  sonarsource/sonar-scanner-cli
```

---

## 13. Backend API Contract

The frontend talks to a single backend: the **HQ (siège) API**, reached through `/api-siege` (Vite proxy in development, nginx in Docker; the prefix is removed before forwarding). The HQ API aggregates the country backends. Its complete contract (routes, roles, response shapes) is documented in the README of the `backend-siege` repository (Section 7) and in its Swagger UI (`http://localhost:8085/swagger-ui/index.html`).

**Conventions**

- **Auth:** `POST /api/auth/login` returns `{ token }`, then `GET /api/auth/me` returns `{ id, email, roles, countryId }`. The token is a JWT (24 h) sent as `Authorization: Bearer <token>` on every call. There is no logout endpoint: the session is dropped client side, and a `401` response logs the user out automatically.
- **No server-side filtering or pagination:** list endpoints return plain arrays (`GET /lots` returns every lot of every country). The services filter, sort and paginate in the browser and build the `{ data, total, page, limit }` pages used by the views.
- **Country scope:** write calls and several reads take a `pays` query parameter (country name, for example `bresil`); the HQ API relays the call to that country backend.
- **Errors:** the HQ API often answers an error with a `403` and no body (see its README). `services/api.ts` throws an `Error` carrying the `message` of the JSON body when there is one, otherwise `HTTP <status>`. Some routes answer `200` with an empty body or an empty list when a country does not respond, so the views must handle empty results.

**API paths used by the frontend**

| Path | Method | Description | Roles |
|---|---|---|---|
| `/api/auth/login` | POST | Authenticate, returns the JWT | public |
| `/api/auth/me` | GET | Current user | any authenticated user |
| `/lots` | GET | All lots, oldest storage date first | any |
| `/lot/{id}` | GET | Lot detail | any |
| `/lot?pays=` | POST | Create a lot | ADMIN, FARM_MANAGER |
| `/lot/{id}/status?pays=` | PUT | Change the status of a lot (`{ status }`) | ADMIN, WAREHOUSE_MANAGER, QUALITY |
| `/lot/{id}/zones?pays=` | PUT | Move a lot to another zone (`{ idZone }`) | ADMIN, WAREHOUSE_MANAGER |
| `/mouvements/stockout?idLot=&pays=` | POST | Ship a lot (stock-out) | ADMIN, WAREHOUSE_MANAGER, FARM_MANAGER |
| `/lot/{id}/mesures` | GET | Temperature and humidity readings of a lot | any |
| `/history/{idLot}?type=` | GET | History of a lot (`TRANSFERT`, `ALERTE`, `SHIPPED`) | any |
| `/readings/{idZone}/?pays=&startDate=&endDate=` | GET | Readings of a zone over a period (the trailing `/` is required) | any |
| `/zones/{idZone}/readings/latest?pays=` | GET | Latest reading of a zone | any |
| `/warehouses/{idEntrepot}/readings/summary?pays=` | GET | Per zone: last values and 24 h averages | any |
| `/countries` | GET | Configured countries and their ideal ranges | any |
| `/farms/{pays}` | GET | Farms of a country | any |
| `/warehouses/{pays}` | GET | Warehouses of a country | any |
| `/warehouses/{idEntrepot}/zones?pays=` | GET | Zones of a warehouse | any |
| `/alertes?idEntrepot=&startDate=&endDate=` | GET | Alerts of a warehouse (dates optional) | ADMIN, WAREHOUSE_MANAGER, FARM_MANAGER, QUALITY, SUPPLY_CHAIN |
| `/reporting/global` | GET | Global KPIs | ADMIN, HQ |
| `/reporting/stock?pays=&startDate=&endDate=` | GET | Stock KPIs (country required) | ADMIN, SUPPLY_CHAIN, HQ |
| `/reporting/quality?startDate=&endDate=` | GET | Quality KPIs (`pays` optional) | ADMIN, QUALITY, HQ |

In mock mode (`VITE_MOCK=true`) the same calls are answered by `src/mocks/handlers.ts`.
