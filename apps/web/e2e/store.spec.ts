import { expect, test } from '@playwright/test';

test.describe('loja', () => {
  test('navega, adiciona à sacola, finaliza compra com Pix simulado e vê o pagamento confirmado', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Vellor/);

    await page.goto('/relogios');
    await expect(page.getByTestId('category-title')).toBeVisible();
    const cards = page.getByTestId('product-card');
    await expect(cards.first()).toBeVisible();
    await cards.first().getByRole('link').first().click();

    await expect(page.getByTestId('product-name')).toBeVisible();
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-items')).toBeVisible();

    await page.goto('/checkout');
    await page.getByTestId('checkout-name').fill('Cliente E2E');
    await page.getByTestId('checkout-email').fill('cliente@e2e.local');
    await page.getByTestId('checkout-phone').fill('11912345678');
    await page.getByTestId('checkout-cpf').fill('52998224725');
    await page.getByTestId('checkout-cep').fill('01310100');
    await page.getByTestId('checkout-street').fill('Avenida Paulista');
    await page.getByTestId('checkout-number').fill('1000');
    await page.getByTestId('checkout-district').fill('Bela Vista');
    await page.getByTestId('checkout-city').fill('São Paulo');
    await page.getByTestId('checkout-state').selectOption('SP');

    await page.getByTestId('shipping-option-SEDEX').click();
    await page.getByTestId('payment-pix').click();
    await page.getByTestId('accept-terms').check();
    await page.getByTestId('place-order').click();

    await expect(page).toHaveURL(/\/pedido\//, { timeout: 20_000 });
    await expect(page.getByText(/VL-\d+/).first()).toBeVisible();
    await page.getByTestId('simulate-payment').click();
    await expect(page.getByText('Pagamento confirmado').first()).toBeVisible({ timeout: 20_000 });
  });

  test('busca encontra produtos e página inexistente mostra 404', async ({ page }) => {
    await page.goto('/busca?q=oud');
    await expect(page.getByTestId('product-card').first()).toBeVisible();
    await page.goto('/pagina-que-nao-existe');
    await expect(page.getByText('Página não encontrada')).toBeVisible();
  });
});
