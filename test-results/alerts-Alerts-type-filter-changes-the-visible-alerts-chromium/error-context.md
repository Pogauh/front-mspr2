# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: alerts.spec.ts >> Alerts >> type filter changes the visible alerts
- Location: e2e\alerts.spec.ts:42:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('select').first()
    - locator resolved to <select data-v-4d766a47="">…</select>
  - attempting select option action
    2 × waiting for element to be visible and enabled
      - did not find some options
    - retrying select option action
    - waiting 20ms
    2 × waiting for element to be visible and enabled
      - did not find some options
    - retrying select option action
      - waiting 100ms
    58 × waiting for element to be visible and enabled
       - did not find some options
     - retrying select option action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic [ref=f1e3]:
    - navigation [ref=f1e4]:
      - link "🌿 FutureKawa" [ref=f1e6] [cursor=pointer]:
        - /url: /dashboard
      - list [ref=f1e7]:
        - listitem [ref=f1e8]:
          - link "Quality" [ref=f1e9] [cursor=pointer]:
            - /url: /quality
        - listitem [ref=f1e10]:
          - link "Supply Chain" [ref=f1e11] [cursor=pointer]:
            - /url: /supply-chain
        - listitem
      - generic [ref=f1e12]:
        - link "? Help" [ref=f1e13] [cursor=pointer]:
          - /url: /user-guide.pdf
        - generic [ref=f1e14]:
          - text: Marie Dupont ·
          - emphasis [ref=f1e15]: hq
        - button "Log out" [ref=f1e16] [cursor=pointer]
    - main [ref=f1e17]:
      - generic [ref=f1e18]:
        - heading "Alerts" [level=2] [ref=f1e19]
        - generic [ref=f1e20]:
          - generic [ref=f1e21]:
            - combobox [ref=f1e22]:
              - option "- All countries -" [selected]
              - option "Colombia"
              - option "Brazil"
              - option "Ecuador"
            - combobox [ref=f1e23]:
              - option "- All warehouses -" [selected]
              - option "Bogotá Central Warehouse"
              - option "Medellín Warehouse"
              - option "Tumbes Warehouse"
            - button "Reset" [ref=f1e24] [cursor=pointer]
          - generic [ref=f1e25] [cursor=pointer]:
            - checkbox "Active only" [checked] [ref=f1e26]
            - text: Active only
          - combobox [ref=f1e27]:
            - option "- All types -" [selected]
            - option "Out of range (temperature/humidity)"
            - option "Expiry (> 365 days)"
            - option "FIFO at risk"
        - list [ref=f1e28]:
          - listitem [ref=f1e29]:
            - generic [ref=f1e30]:
              - generic [ref=f1e31]: Out of range
              - generic [ref=f1e32]: "Zone : Zone B - Stockage froid"
            - paragraph [ref=f1e33]: "Humidité hors plage : 74.5% (max 63%). Zone B - Stockage froid."
            - generic [ref=f1e34]:
              - generic [ref=f1e35]: 10/4/2026, 8:48:05 AM
              - button "Mark as read" [ref=f1e36] [cursor=pointer]
          - listitem [ref=f1e37]:
            - generic [ref=f1e38]:
              - generic [ref=f1e39]: Out of range
              - generic [ref=f1e40]: "Zone : Zone EQ-Principal"
            - paragraph [ref=f1e41]: "Humidité en limite haute : 61.0% (seuil warn 60%). Surveiller."
            - generic [ref=f1e42]:
              - generic [ref=f1e43]: 10/2/2026, 8:48:05 AM
              - button "Mark as read" [ref=f1e44] [cursor=pointer]
          - listitem [ref=f1e45]:
            - generic [ref=f1e46]:
              - generic [ref=f1e47]: FIFO
              - generic [ref=f1e48]: "Zone : Zone B - Stockage froid"
            - paragraph [ref=f1e49]: "Rotation FIFO à risque : lot CO-2024-0002 stocké depuis 310 jours, lots plus récents déjà expédiés."
            - generic [ref=f1e50]:
              - generic [ref=f1e51]: 9/30/2026, 8:48:05 AM
              - button "Mark as read" [ref=f1e52] [cursor=pointer]
  - generic [ref=f1e53]:
    - generic "Toggle devtools panel" [ref=f1e54] [cursor=pointer]
    - generic "Toggle Component Inspector" [ref=f1e60] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from './fixtures'
  2  | 
  3  | test.describe('Alerts', () => {
  4  |   test.beforeEach(async ({ loginAs }) => {
  5  |     await loginAs('hq')
  6  |   })
  7  | 
  8  |   test('loads the alerts page with a heading', async ({ page }) => {
  9  |     await page.goto('/alerts')
  10 | 
  11 |     await expect(page.locator('h2')).toBeVisible()
  12 |   })
  13 | 
  14 |   test('shows alert rows or the empty state', async ({ page }) => {
  15 |     await page.goto('/alerts')
  16 | 
  17 |     await expect(page.locator('.alert-list')).toBeVisible()
  18 | 
  19 |     const hasAlerts = (await page.locator('.alert-item').count()) > 0
  20 |     const hasEmpty = await page.locator('.empty').isVisible().catch(() => false)
  21 | 
  22 |     expect(hasAlerts || hasEmpty).toBe(true)
  23 |   })
  24 | 
  25 |   test('can mark an alert as read', async ({ page }) => {
  26 |     await page.goto('/alerts')
  27 | 
  28 |     await expect(page.locator('.alert-list')).toBeVisible()
  29 | 
  30 |     const markReadBtn = page.locator('.btn-read').first()
  31 | 
  32 |     if (!(await markReadBtn.isVisible())) {
  33 |       test.skip()
  34 |       return
  35 |     }
  36 | 
  37 |     await markReadBtn.click()
  38 | 
  39 |     await expect(page.locator('.read-label').first()).toBeVisible()
  40 |   })
  41 | 
  42 |   test('type filter changes the visible alerts', async ({ page }) => {
  43 |     await page.goto('/alerts')
  44 | 
  45 |     const typeFilter = page.locator('select').first()
> 46 |     await typeFilter.selectOption('threshold')
     |                      ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
  47 | 
  48 |     await expect(page).toHaveURL('/alerts')
  49 |   })
  50 | })
  51 | 
  52 | test.describe('Alerts navigation', () => {
  53 |   test('nav link leads to alerts page', async ({ page, loginAs }) => {
  54 |     await loginAs('hq')
  55 |     await page.goto('/dashboard')
  56 | 
  57 |     await page.getByRole('link', { name: 'View alerts' }).click()
  58 | 
  59 |     await expect(page).toHaveURL('/alerts')
  60 |   })
  61 | })
  62 | 
```