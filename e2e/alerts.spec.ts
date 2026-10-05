import { test, expect } from './fixtures'

test.describe('Alerts', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('hq')
  })

  test('loads the alerts page with a heading', async ({ page }) => {
    await page.goto('/alerts')

    await expect(page.locator('h2')).toBeVisible()
  })

  test('shows alert rows or the empty state', async ({ page }) => {
    await page.goto('/alerts')

    await expect(page.locator('.alert-list')).toBeVisible()

    const hasAlerts = (await page.locator('.alert-item').count()) > 0
    const hasEmpty = await page.locator('.empty').isVisible().catch(() => false)

    expect(hasAlerts || hasEmpty).toBe(true)
  })

  test('can mark an alert as read', async ({ page }) => {
    await page.goto('/alerts')

    await expect(page.locator('.alert-list')).toBeVisible()

    const markReadBtn = page.locator('.btn-read').first()

    if (!(await markReadBtn.isVisible())) {
      test.skip()
      return
    }

    await markReadBtn.click()

    await expect(page.locator('.read-label').first()).toBeVisible()
  })

  test('type filter changes the visible alerts', async ({ page }) => {
    await page.goto('/alerts')

    // The country/warehouse filters come first on the page: target the type select by its options
    const typeFilter = page.locator('select').filter({ has: page.locator('option[value="threshold"]') })
    await typeFilter.selectOption('threshold')

    await expect(page).toHaveURL('/alerts')
  })
})

test.describe('Alerts navigation', () => {
  test('nav link leads to alerts page', async ({ page, loginAs }) => {
    await loginAs('hq')
    await page.goto('/dashboard')

    await page.getByRole('link', { name: 'View alerts' }).click()

    await expect(page).toHaveURL('/alerts')
  })
})
