import { createBrowserRouter } from 'react-router';
import { AdminLayout } from './layouts/AdminLayout';
import { StoreLayout } from './layouts/StoreLayout';
import AccountLayout from './pages/account/AccountLayout';
import AddressesPage from './pages/account/AddressesPage';
import ForgotPasswordPage from './pages/account/ForgotPasswordPage';
import LoginPage from './pages/account/LoginPage';
import OrdersPage from './pages/account/OrdersPage';
import ProfilePage from './pages/account/ProfilePage';
import RegisterPage from './pages/account/RegisterPage';
import ResetPasswordPage from './pages/account/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import AboutPage from './pages/store/AboutPage';
import CartPage from './pages/store/CartPage';
import CategoryPage from './pages/store/CategoryPage';
import CheckoutPage from './pages/store/CheckoutPage';
import ContactPage from './pages/store/ContactPage';
import HomePage from './pages/store/HomePage';
import LegalPage from './pages/store/LegalPage';
import OrderPage from './pages/store/OrderPage';
import ProductPage from './pages/store/ProductPage';
import WishlistPage from './pages/store/WishlistPage';

/** Carrega uma página do admin sob demanda (chunk separado do bundle da loja). */
const lazyAdmin = (load: () => Promise<{ default: React.ComponentType }>) => async () => {
  const mod = await load();
  return { Component: mod.default };
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <StoreLayout />,
    errorElement: <StoreLayout error />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'relogios', element: <CategoryPage slug="relogios" /> },
      { path: 'perfumes', element: <CategoryPage slug="perfumes" /> },
      { path: 'categoria/:slug', element: <CategoryPage /> },
      { path: 'busca', element: <CategoryPage mode="search" /> },
      { path: 'produto/:slug', element: <ProductPage /> },
      { path: 'sacola', element: <CartPage /> },
      { path: 'favoritos', element: <WishlistPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'pedido/:id', element: <OrderPage /> },
      { path: 'atendimento', element: <ContactPage /> },
      { path: 'sobre', element: <AboutPage /> },
      { path: 'privacidade', element: <LegalPage kind="privacyPolicy" /> },
      { path: 'termos', element: <LegalPage kind="termsOfService" /> },
      { path: 'trocas', element: <LegalPage kind="exchangePolicy" /> },
      { path: 'conta/entrar', element: <LoginPage /> },
      { path: 'conta/cadastro', element: <RegisterPage /> },
      { path: 'conta/recuperar-senha', element: <ForgotPasswordPage /> },
      { path: 'conta/redefinir-senha', element: <ResetPasswordPage /> },
      {
        path: 'conta',
        element: <AccountLayout />,
        children: [
          { index: true, element: <OrdersPage /> },
          { path: 'pedidos', element: <OrdersPage /> },
          { path: 'enderecos', element: <AddressesPage /> },
          { path: 'dados', element: <ProfilePage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin/entrar',
    lazy: lazyAdmin(() => import('./pages/admin/AdminLoginPage')),
  },
  {
    path: '/admin/mfa',
    lazy: lazyAdmin(() => import('./pages/admin/AdminMfaPage')),
  },
  {
    path: '/admin/definir-senha',
    lazy: lazyAdmin(() => import('./pages/admin/AdminSetPasswordPage')),
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, lazy: lazyAdmin(() => import('./pages/admin/DashboardPage')) },
      { path: 'produtos', lazy: lazyAdmin(() => import('./pages/admin/ProductsPage')) },
      { path: 'produtos/novo', lazy: lazyAdmin(() => import('./pages/admin/ProductFormPage')) },
      { path: 'produtos/:id', lazy: lazyAdmin(() => import('./pages/admin/ProductFormPage')) },
      { path: 'categorias', lazy: lazyAdmin(() => import('./pages/admin/CategoriesPage')) },
      { path: 'pedidos', lazy: lazyAdmin(() => import('./pages/admin/OrdersPage')) },
      { path: 'pedidos/:id', lazy: lazyAdmin(() => import('./pages/admin/OrderDetailPage')) },
      { path: 'cupons', lazy: lazyAdmin(() => import('./pages/admin/CouponsPage')) },
      { path: 'clientes', lazy: lazyAdmin(() => import('./pages/admin/CustomersPage')) },
      { path: 'clientes/:id', lazy: lazyAdmin(() => import('./pages/admin/CustomerDetailPage')) },
      { path: 'atendimento', lazy: lazyAdmin(() => import('./pages/admin/ContactsPage')) },
      { path: 'atendimento/:id', lazy: lazyAdmin(() => import('./pages/admin/ContactDetailPage')) },
      { path: 'newsletter', lazy: lazyAdmin(() => import('./pages/admin/NewsletterPage')) },
      { path: 'configuracoes', lazy: lazyAdmin(() => import('./pages/admin/SettingsPage')) },
      { path: 'equipe', lazy: lazyAdmin(() => import('./pages/admin/TeamPage')) },
      { path: 'auditoria', lazy: lazyAdmin(() => import('./pages/admin/AuditPage')) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
