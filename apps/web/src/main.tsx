import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { router } from './app';
import { ToastProvider } from './components/ui/feedback';
import { queryClient } from './lib/queries';
import { CartProvider, WishlistProvider } from './store/cart';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CartProvider>
          <WishlistProvider>
            <RouterProvider router={router} />
          </WishlistProvider>
        </CartProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
