import { expect, test } from '@playwright/test';
import { totp } from './totp';

const ADMIN_EMAIL = 'admin@e2e.local';
const ADMIN_PASSWORD = 'SenhaAdmin#E2E-2026';
const ADMIN_MFA_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

test.describe('painel administrativo', () => {
  test('exige MFA, abre o dashboard e cadastra um produto', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/entrar/);
    await page.getByTestId('admin-login-email').fill(ADMIN_EMAIL);
    await page.getByTestId('admin-login-password').fill(ADMIN_PASSWORD);
    await page.getByTestId('admin-login-submit').click();

    await expect(page).toHaveURL(/\/admin\/mfa/);
    await page.getByTestId('mfa-code').fill(totp(ADMIN_MFA_SECRET));
    await page.getByTestId('mfa-submit').click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.goto('/admin/produtos');
    await page.getByTestId('admin-new-product').click();
    await expect(page).toHaveURL(/\/admin\/produtos\/novo/);
    const name = `Relógio E2E ${Date.now()}`;
    await page.getByTestId('product-name').fill(name);
    const category = page.getByTestId('product-category');
    await category.selectOption({ index: 1 });
    await page.getByTestId('product-price').fill('12.500,00');
    await page.getByTestId('variant-sku').first().fill(`E2E-${Date.now()}`);
    await page.getByTestId('variant-name').first().fill('Padrão');
    await page.getByTestId('variant-stock').first().fill('2');
    await page.getByTestId('product-save').click();

    await expect(page).toHaveURL(/\/admin\/produtos\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await page.goto('/admin/produtos?q=E2E');
    await expect(page.getByText(name)).toBeVisible();
  });
});
