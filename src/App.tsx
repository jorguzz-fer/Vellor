/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { WATCHES, WATCH_COLLECTIONS } from './data/watches';
import { Product, CartItem } from './types';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { FilterToolbar } from './components/FilterToolbar';
import { ProductCard } from './components/ProductCard';
import { PromoCard } from './components/PromoCard';
import { QuickViewModal } from './components/QuickViewModal';
import { CartDrawer } from './components/CartDrawer';
import { WishlistDrawer } from './components/WishlistDrawer';
import { SearchModal } from './components/SearchModal';
import { BoutiqueModal } from './components/BoutiqueModal';
import { ValueProps } from './components/ValueProps';
import { Footer } from './components/Footer';
import { MessageCircle, Sparkles, Check, ChevronUp } from 'lucide-react';

export default function App() {
  // Navigation & Catalog States
  const [activeCollection, setActiveCollection] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [gridColumns, setGridColumns] = useState<2 | 3 | 4>(4);
  const [currency, setCurrency] = useState<string>('USD');
  const [showPromoInGrid, setShowPromoInGrid] = useState<boolean>(true);

  // Modals & Drawers
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isStoreLocatorOpen, setIsStoreLocatorOpen] = useState<boolean>(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [boutiqueWatchName, setBoutiqueWatchName] = useState<string>('');

  // Cart & Wishlist persistence
  const [cartItems, setCartItems] = useState<CartItem[]>([
    // Seed one starter item to show richness of bag
    {
      id: 'item-seed-1',
      product: WATCHES[0],
      selectedColor: 'Cobalt Blue',
      quantity: 1,
    },
  ]);

  const [wishlistIds, setWishlistIds] = useState<string[]>([
    'titanium-precision',
    'timeless-beauty',
    'gold-for-generations',
  ]);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Filter & Sort Products
  const filteredProducts = useMemo(() => {
    let list = [...WATCHES];

    // Filter by collection
    if (activeCollection !== 'all') {
      list = list.filter((p) => p.collection === activeCollection);
    }

    // Sort
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount);
    }

    return list;
  }, [activeCollection, sortBy]);

  // Wishlist handler
  const handleToggleWishlist = (productId: string) => {
    if (wishlistIds.includes(productId)) {
      setWishlistIds(wishlistIds.filter((id) => id !== productId));
      triggerToast('Removed from Saved Masterpieces');
    } else {
      setWishlistIds([...wishlistIds, productId]);
      triggerToast('Added to Saved Masterpieces');
    }
  };

  // Cart Handlers
  const handleAddToCart = (product: Product, selectedColorName = 'Standard', quantity = 1) => {
    const existingIndex = cartItems.findIndex(
      (item) => item.product.id === product.id && item.selectedColor === selectedColorName
    );

    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += quantity;
      setCartItems(updated);
    } else {
      const newItem: CartItem = {
        id: `${product.id}-${Date.now()}`,
        product,
        selectedColor: selectedColorName,
        quantity,
      };
      setCartItems([...cartItems, newItem]);
    }
    triggerToast(`Added ${product.name} to Shopping Bag`);
  };

  const handleUpdateCartQuantity = (itemId: string, delta: number) => {
    setCartItems(
      cartItems
        .map((item) => {
          if (item.id === itemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCartItems(cartItems.filter((item) => item.id !== itemId));
    triggerToast('Item removed from Shopping Bag');
  };

  const handleMoveWishlistToCart = (product: Product) => {
    handleAddToCart(product, product.colors[0]?.name || 'Standard', 1);
    setWishlistIds(wishlistIds.filter((id) => id !== product.id));
    setIsWishlistOpen(false);
    setIsCartOpen(true);
  };

  const handleOpenBoutiqueForProduct = (product: Product) => {
    setBoutiqueWatchName(product.name);
    setQuickViewProduct(null);
    setIsStoreLocatorOpen(true);
  };

  const currentCollectionLabel =
    WATCH_COLLECTIONS.find((c) => c.id === activeCollection)?.label || 'Product List Boxed';

  // Responsive grid class based on toolbar layout toggle
  const getGridClass = () => {
    switch (gridColumns) {
      case 2:
        return 'grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6';
      case 3:
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6';
      case 4:
      default:
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6';
    }
  };

  return (
    <div className="min-h-screen bg-[#101f20] text-[#f4efe6] font-sans flex flex-col selection:bg-[#c8a25c] selection:text-[#101f20]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-6 z-50 bg-[#0e1b1a] border border-[#c8a25c] text-[#f4efe6] px-4 py-3 rounded-sm shadow-2xl flex items-center gap-3 text-xs tracking-wide animate-in fade-in slide-in-from-right-3 duration-200">
          <div className="w-5 h-5 rounded-full bg-[#c8a25c] text-[#0e1b1a] flex items-center justify-center font-bold">
            <Check className="w-3 h-3" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Luxury Navigation Bar */}
      <Navbar
        cartCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)}
        wishlistCount={wishlistIds.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenStoreLocator={() => {
          setBoutiqueWatchName('');
          setIsStoreLocatorOpen(true);
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
        activeCollection={activeCollection}
        onSelectCollection={(colId) => setActiveCollection(colId)}
        currency={currency}
        onChangeCurrency={(c) => setCurrency(c)}
      />

      {/* Hero Banner with Editorial Background matching reference image */}
      <HeroBanner
        title="PRODUCT LIST BOXED"
        categoryName={currentCollectionLabel}
        onExploreClick={() => {
          const cat = document.getElementById('catalog-section');
          if (cat) cat.scrollIntoView({ behavior: 'smooth' });
        }}
        onOpenQuickCart={() => setIsCartOpen(true)}
      />

      {/* Filter and Sort Toolbar */}
      <div id="catalog-section">
        <FilterToolbar
          selectedCollection={activeCollection}
          onSelectCollection={(col) => setActiveCollection(col)}
          sortBy={sortBy}
          onSortChange={(s) => setSortBy(s)}
          gridColumns={gridColumns}
          onGridColumnsChange={(cols) => setGridColumns(cols)}
          totalCount={filteredProducts.length}
        />
      </div>

      {/* Main Boxed Product Grid matching reference layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className={getGridClass()}>
          {filteredProducts.map((product, index) => {
            // Replicate the reference image layout:
            // Exactly between item 2 and item 3, display the embedded PromoCard!
            const renderPromoHere = showPromoInGrid && index === 2 && activeCollection === 'all';

            return (
              <React.Fragment key={product.id}>
                {renderPromoHere && (
                  <PromoCard onDismiss={() => setShowPromoInGrid(false)} />
                )}

                <ProductCard
                  product={product}
                  currency={currency}
                  isWishlisted={wishlistIds.includes(product.id)}
                  onToggleWishlist={handleToggleWishlist}
                  onQuickView={(p) => setQuickViewProduct(p)}
                  onAddToCart={(p, color) => handleAddToCart(p, color, 1)}
                />
              </React.Fragment>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center">
            <Sparkles className="w-10 h-10 text-[#c8a25c] mb-3 opacity-60" />
            <h3 className="text-xl font-serif uppercase tracking-wider text-[#f4efe6]">
              No Timepieces Found
            </h3>
            <p className="text-xs text-[#ede7dc]/60 max-w-md mt-1 mb-6">
              There are currently no timepieces registered under this specific category filter.
            </p>
            <button
              onClick={() => setActiveCollection('all')}
              className="py-2 px-6 bg-[#c8a25c] text-[#0e1b1a] text-xs font-sans font-semibold tracking-widest uppercase rounded-sm hover:bg-[#dfbe7d] transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </main>

      {/* 4 Value Propositions Bar matching reference image */}
      <ValueProps />

      {/* Luxury Footer matching reference design */}
      <Footer
        onSelectCollection={(colId) => {
          setActiveCollection(colId);
          const cat = document.getElementById('catalog-section');
          if (cat) cat.scrollIntoView({ behavior: 'smooth' });
        }}
        onOpenStoreLocator={() => {
          setBoutiqueWatchName('');
          setIsStoreLocatorOpen(true);
        }}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Floating Concierge / VIP Contact Button */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
        <button
          onClick={() => {
            setBoutiqueWatchName('');
            setIsStoreLocatorOpen(true);
          }}
          className="group flex items-center gap-2.5 px-4 py-3 bg-[#132524] hover:bg-[#c8a25c] hover:text-[#0e1b1a] text-[#c8a25c] border border-[#c8a25c]/50 rounded-full shadow-2xl transition-all transform hover:scale-105 cursor-pointer backdrop-blur-md"
          title="Direct VIP Concierge Assistance"
        >
          <MessageCircle className="w-4 h-4 text-[#c8a25c] group-hover:text-[#0e1b1a]" />
          <span className="text-[11px] font-sans font-semibold tracking-widest uppercase hidden sm:inline">
            VIP Concierge
          </span>
        </button>
      </div>

      {/* Quick View Horology Specs Modal */}
      <QuickViewModal
        product={quickViewProduct}
        currency={currency}
        isWishlisted={quickViewProduct ? wishlistIds.includes(quickViewProduct.id) : false}
        onToggleWishlist={handleToggleWishlist}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={(p, color, qty) => {
          handleAddToCart(p, color, qty);
          setQuickViewProduct(null);
        }}
        onBookAppointment={handleOpenBoutiqueForProduct}
      />

      {/* Shopping Bag Slide-Over Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        currency={currency}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onCheckout={() => {
          triggerToast('Redirecting to Private Escrow Concierge...');
        }}
      />

      {/* Saved Masterpieces Wishlist Drawer */}
      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        wishlistIds={wishlistIds}
        allProducts={WATCHES}
        currency={currency}
        onRemoveFromWishlist={handleToggleWishlist}
        onMoveToCart={handleMoveWishlistToCart}
        onQuickView={(p) => {
          setIsWishlistOpen(false);
          setQuickViewProduct(p);
        }}
      />

      {/* Search Catalog Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        products={WATCHES}
        onSelectProduct={(p) => {
          setQuickViewProduct(p);
        }}
        currency={currency}
      />

      {/* Boutiques & Appointment Reservation Modal */}
      <BoutiqueModal
        isOpen={isStoreLocatorOpen}
        onClose={() => setIsStoreLocatorOpen(false)}
        selectedWatchName={boutiqueWatchName}
      />
    </div>
  );
}
