# Guide: SonarQube Integration + GitHub Actions (FutureKawa Frontend)

## Files created/modified by this guide

| File | Purpose |
|---|---|
| `docker-compose.yml` | Starts SonarQube + PostgreSQL + App with one command |
| `sonar-project.properties` | SonarQube analysis configuration |
| `.github/workflows/ci.yml` | Multi-job GitHub Actions CI/CD pipeline |
| `vite.config.ts` | Added Vitest coverage configuration |
| `Dockerfile` | `npm run build-only` (without vue-tsc) to avoid TS errors |

---

## Step 1 - Start all services with Docker Compose

```bash
docker compose up -d
```

This starts at the same time:
- `sonar-db` → PostgreSQL on the internal network
- `sonarqube` → SonarQube Community on **http://localhost:9000**
- `app` → Vue.js application (nginx build) on **http://localhost:3000**

**Verify everything is up:**
```bash
docker compose ps
docker compose logs -f sonarqube   # wait for "SonarQube is operational"
```

> **Windows / Docker Desktop note:** `vm.max_map_count` is managed automatically.
> On native Linux you would need to add `sysctl -w vm.max_map_count=524288`.

**GitLab CI difference:** In GitLab, SonarQube often runs on a dedicated server
reachable from the internet. Here it is local, which is why a self-hosted runner is needed.

---

## Step 2 - Create the project in SonarQube and generate a token

1. Open **http://localhost:9000**
2. Log in (admin / admin default → change on first login)
3. **Create a project**:
   - Click **"Create Project" > "Manually"** (not "Import from GitHub": GitHub cannot send webhooks to localhost)
   - Project display name: `FutureKawa Frontend`
   - Project key: `futurekawa-frontend` ← must match `sonar.projectKey` in `sonar-project.properties`
   - Branch: `main`
   - Quality Gate: "Follows the instance's default" (Sonar way)
4. **Generate a token**:
   - On the project analysis page → **"Set up" > "With GitHub Actions"**
   - OR via **My Account > Security > Generate Token**
   - Type: **Project Analysis Token**
   - Name: `github-actions-futurekawa`
   - Expiration: according to policy
   - **Copy the token immediately** (shown only once)

**GitLab CI difference:**
- GitLab → the token is stored in **Settings > CI/CD > Variables** (masked)
- GitHub → the token is stored in **Settings > Secrets and variables > Actions > New repository secret**

---

## Step 3 - Configure GitHub Actions secrets

In the GitHub repo:
**Settings > Secrets and variables > Actions > New repository secret**

| Secret | Value |
|---|---|
| `SONAR_TOKEN` | The token generated in step 2 |
| `SONAR_HOST_URL` | `http://localhost:9000` |

> **Note:** `SONAR_HOST_URL` is kept as a reference in secrets but
> the Docker step uses `http://host.docker.internal:9000` directly in the workflow
> (see step 6). `localhost` inside a Docker container points to the container itself,
> not to the host machine.

**GitLab CI difference:**
```
# GitLab CI: CI/CD variables in the UI or in .gitlab-ci.yml
variables:
  SONAR_TOKEN: $SONAR_TOKEN
  SONAR_HOST_URL: $SONAR_HOST_URL
```
```yaml
# GitHub Actions: secrets injected via env in the step
env:
  SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
  SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

---

## Step 4 - Configure the SonarQube Server Base URL

Without this configuration, the URL shown in the scanner logs points to
`host.docker.internal:9000` (the Docker internal URL) instead of `localhost:9000`.

**http://localhost:9000 → Administration → Configuration → General Settings**

Find **"Server base URL"** and set:
```
http://localhost:9000
```

Save. Links in scanner reports will now use `localhost:9000`.

---

## Step 5 - Install the GitHub Actions self-hosted runner

GitHub-hosted runners (`ubuntu-latest`, `windows-latest`) are isolated VMs
on GitHub infrastructure: they **cannot reach** `localhost:9000`. A **self-hosted runner** is a process that runs on the user machine and executes jobs there instead.

**GitLab CI equivalent:** `gitlab-runner register --tags self-hosted` → `tags: [local]`.
In GitHub Actions: `runs-on: self-hosted`.

### Installation on Windows 10/11

1. In the GitHub repo: **Settings > Actions > Runners > New self-hosted runner**
2. Select **Windows** (x64)
3. Follow the displayed commands. In summary in PowerShell (Admin):

```powershell
mkdir C:\actions-runner
cd C:\actions-runner

# Download (copy the exact command from GitHub; the version changes)
Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.x.x/actions-runner-win-x64-2.x.x.zip -OutFile actions-runner-win-x64.zip

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory("$PWD\actions-runner-win-x64.zip", "$PWD")

# Configure (copy the exact command from GitHub; it contains the token)
.\config.cmd --url https://github.com/ORG_NAME/REPO_NAME --token AAAA...

# Answer the prompts:
#   runner group: leave blank (Default)
#   runner name: futurekawa-runner
#   work folder: leave _work
#   run as service: No (see note below)
```

### Start the runner

> **Note:** `svc.cmd` (Windows service) can fail with the NETWORK SERVICE account
> on some machines. The reliable workaround is to start `run.cmd`
> directly in the background via PowerShell:

```powershell
Start-Process -FilePath "C:\actions-runner\run.cmd" -WindowStyle Hidden
```

The runner appears as **Idle** in **Settings > Actions > Runners** for the repo.
To stop it: close the `Runner.Listener` process in Task Manager.

### Use the runner in the workflow

```yaml
runs-on: self-hosted
```

**GitLab CI difference:**
```yaml
# GitLab CI: runner tag
job:
  tags:
    - local
```
```yaml
# GitHub Actions: runs-on is enough
runs-on: self-hosted
# With custom labels:
runs-on: [self-hosted, windows, futurekawa]
```

---

## Step 6 - Verify the Vitest coverage configuration

The `vite.config.ts` file was updated with:

```typescript
test: {
  globals: true,
  environment: 'jsdom',
  coverage: {
    provider: 'v8',
    reporter: ['lcov', 'text', 'html'],
    reportsDirectory: './coverage',
    include: ['src/**/*.{ts,vue}'],
    exclude: ['src/main.ts','src/App.vue', 'src/**/*.d.ts', 'src/assets/**''src/mocks/**'],
  },
},
```

**Install the v8 provider** (if not already present):
```bash
npm install --save-dev @vitest/coverage-v8
```

**Test locally:**
```bash
npm run test:unit -- --coverage
# → generates coverage/lcov.info
```

`coverage/lcov.info` is read by SonarQube via `sonar-project.properties`:
```
sonar.javascript.lcov.reportPaths=coverage/lcov.info
```

---

## Step 7 - Multi-job CI/CD pipeline (.github/workflows/ci.yml)

### Why not use the official `sonarsource/sonarqube-scan-action`?

The official action runs a bash script (`sanity-checks.sh`) via `bash.EXE` (WSL).
On Windows without WSL installed, this causes:
```
WSL ERROR: CreateProcessEntryCommon: execvpe /bin/bash failed
Error: Process completed with exit code 1.
```

**Chosen solution:** use the Docker image `sonarsource/sonar-scanner-cli`
directly in a `shell: cmd` step. Docker is already available on the machine (used for SonarQube).

> **Note:** `pwsh` (PowerShell Core 7) is also not available by default on
> Windows 10. Use `shell: powershell` (Windows PowerShell 5) or `shell: cmd`.

### Pipeline structure

```
build ──► test ┐
               ├──► sonar ──► deploy (main only)
          lint ┘
```

| Job | GitLab equivalent | Details |
|---|---|---|
| `build` | `stage: build` | `npm run build-only` + upload `dist/` |
| `test` | `stage: test → unit-test-job` | Vitest + coverage, `continue-on-error` |
| `lint` | `stage: test → lint-test-job` | oxlint + ESLint (currently disabled) |
| `sonar` | `stage: sonar` | Docker scanner + JSON reports |
| `deploy` | `stage: deploy` | main only, placeholder |

**Passing artifacts between jobs:**

GitLab allows jobs in the same pipeline to access artifacts from previous jobs
via `dependencies:`. GitHub Actions requires an explicit `upload-artifact` and then a
`download-artifact` in the next job:

```yaml
# Job test → upload
- uses: actions/upload-artifact@v4
  with:
    name: coverage-${{ github.run_id }}
    path: coverage/

# Job sonar → download
- uses: actions/download-artifact@v4
  with:
    name: coverage-${{ github.run_id }}
    path: coverage/
```

**Why `host.docker.internal` in the Docker step?**

```yaml
- name: SonarQube Analysis & Quality Gate
  shell: cmd
  run: |
    docker run --rm ^
      -e SONAR_TOKEN=${{ secrets.SONAR_TOKEN }} ^
      -e SONAR_HOST_URL=http://host.docker.internal:9000 ^
      -v "%GITHUB_WORKSPACE%:/usr/src" ^
      sonarsource/sonar-scanner-cli:latest
```

From inside a Docker container on Windows/macOS, `localhost` points to the container itself.
`host.docker.internal` is resolved automatically by Docker Desktop and points to the host machine,
where SonarQube listens on port 9000.

**Collecting reports after analysis** (`if: always()` = equivalent to `when: always` in GitLab):

```yaml
- name: Upload Quality Gate report
  if: always()
  shell: cmd
  run: >
    curl -s
    -u "${{ secrets.SONAR_TOKEN }}:"
    "http://localhost:9000/api/qualitygates/project_status?projectKey=futurekawa-frontend"
    -o sonar-report.json
```

The files `sonar-report.json` and `sonar-issues.json` are uploaded as artifacts
(7 days retention), accessible in the repo **Actions > run > Artifacts** tab.

**Minimum coverage before the Docker image.** After the scan, the step `Checking minimum coverage` reads the overall coverage from the
SonarQube API (`/api/measures/component?metricKeys=coverage`) and fails the job below `COVERAGE_MIN` (80). The `docker` job has
`needs: [build, test, e2e, sonar]` and only runs if `sonar` succeeded or was skipped, so with `SONAR_ENABLED=true` the image is neither
built nor pushed when the Quality Gate or the coverage threshold fails.

---

## Step 8 - Trigger the pipeline

```bash
git add .
git commit -m "feat: add CI/CD pipeline with SonarQube"
git push origin main
```

The pipeline triggers automatically, visible in the repo **Actions** tab.

**Verify the result in SonarQube:**

Open **http://localhost:9000/dashboard?id=futurekawa-frontend**

---

## Step 9 - Test a failing Quality Gate scenario

To verify that the pipeline truly **fails** when the Quality Gate fails:

### Method 1: Lower the coverage threshold

1. **http://localhost:9000** > **Quality Gates** > **Sonar way** (or create a custom gate)
2. Add a condition: **Coverage on New Code < 80%**
3. Assign this Quality Gate to the FutureKawa project
4. Push → the `sonar` job should fail with:
   ```
   ERROR: QUALITY GATE STATUS: FAILED - View details on http://localhost:9000/dashboard?id=futurekawa-frontend
   ```

### Method 2: Introduce deliberate duplication

Copy-paste a code block into multiple files to trigger the Quality Gate rule "Duplicated Lines (%)".

### What you see in GitHub Actions if the QG fails

```
INFO: QUALITY GATE STATUS: FAILED
ERROR: QUALITY GATE STATUS: FAILED
Error: Process completed with exit code 1.
```

The `sonar` job turns red → the `deploy` job is automatically blocked.
If **branch protection rules** are configured on `main`
(Settings > Branches > Require status checks), the PR cannot be merged.

---

## Summary table GitLab CI vs GitHub Actions

| Concept | GitLab CI | GitHub Actions |
|---|---|---|
| Config file | `.gitlab-ci.yml` | `.github/workflows/ci.yml` |
| Execution unit | job | step within a job |
| Scheduling | `stages` | `needs:` between jobs |
| Parallel jobs | same `stage:` | same `needs:` level |
| Secrets | Settings > CI/CD > Variables | Settings > Secrets > Actions |
| Self-hosted runner | `tags: [local]` | `runs-on: self-hosted` |
| Docker image (scanner) | `image: sonarsource/sonar-scanner-cli` | `docker run` in `shell: cmd` |
| Automatic checkout | yes | no → `actions/checkout@v4` |
| Triggers | `only/except` or `rules` | `on: push/pull_request` |
| Artifacts between jobs | `dependencies:` (automatic) | `upload-artifact` + `download-artifact` |
| Upload on failure | `artifacts: when: always` | `if: always()` on the step |
| Env variables | `$VARIABLE` | `${{ secrets.VARIABLE }}` |
| Branch condition | `if: $CI_COMMIT_BRANCH == 'main'` | `if: github.ref_name == 'main'` |
| Deployment environment | `environment: production` | `environment: production` |
| Merge blocking | failed pipeline + MR check | status check required (branch protection) |
