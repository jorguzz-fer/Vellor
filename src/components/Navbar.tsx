import React, { useState, useEffect } from 'react';
import { BrandLogo } from './BrandLogo';
import { 
  ShoppingBag, 
  Heart, 
  Search, 
  User, 
  MapPin, 
  Menu, 
  X, 
  PhoneCall, 
  ChevronDown 
} from 'lucide-react';

interface NavbarProps {
  cartCount: number;
  wishlistCount: number;
  onOpenCart: () => void;
  onOpenWishlist: () => void;
  onOpenStoreLocator: () => void;
  onOpenSearch: () => void;
  activeCollection: string;
  onSelectCollection: (colId: string) => void;
  currency: string;
  onChangeCurrency: (curr: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  cartCount,
  wishlistCount,
  onOpenCart,
  onOpenWishlist,
  onOpenStoreLocator,
  onOpenSearch,
  activeCollection,
  onSelectCollection,
  currency,
  onChangeCurrency,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'HOME', id: 'home', target: '#top' },
    { label: 'SHOP', id: 'all', isCollection: true },
    { label: 'CHRONOGRAPHS', id: 'chronograph', isCollection: true },
    { label: 'GOLD EDITIONS', id: 'gold', isCollection: true },
    { label: 'DIVERS & NAUTICAL', id: 'diver', isCollection: true },
    { label: 'HAUTE HORLOGERIE', id: 'tourbillon', isCollection: true },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-40 transition-all duration-300">
      {/* Top Announcement Bar from reference layout */}
      <div className="bg-[#0b1717] border-b border-[#1c3635] text-[11px] font-sans tracking-widest text-[#ede7dc]/70 py-2 px-4 md:px-8 flex justify-between items-center select-none">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#c8a25c] animate-pulse"></span>
          <span>10% OFF WITH VIP REGISTRATION | CODE: <strong className="text-[#c8a25c] font-medium tracking-widest">VELLOR10</strong></span>
        </div>

        <div className="hidden sm:flex items-center gap-5 text-[10px] tracking-widest">
          <div className="flex items-center gap-3 text-[#ede7dc]/60">
            <a href="#instagram" className="hover:text-[#c8a25c] transition-colors">IN.</a>
            <a href="#twitter" className="hover:text-[#c8a25c] transition-colors">TW.</a>
            <a href="#pinterest" className="hover:text-[#c8a25c] transition-colors">PN.</a>
          </div>

          <span className="text-[#1c3635]">|</span>

          {/* Store Locator Trigger */}
          <button
            id="store-locator-btn"
            onClick={onOpenStoreLocator}
            className="flex items-center gap-1.5 hover:text-[#c8a25c] transition-colors cursor-pointer"
          >
            <MapPin className="w-3 h-3 text-[#c8a25c]" />
            <span>BOUTIQUES</span>
          </button>

          <span className="text-[#1c3635]">|</span>

          {/* Currency Selector */}
          <div className="relative">
            <button
              onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
              className="flex items-center gap-1 hover:text-[#c8a25c] transition-colors cursor-pointer uppercase"
            >
              <span>{currency}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {currencyDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#0f1d1d] border border-[#1c3635] py-1 shadow-2xl rounded-sm z-50 min-w-[70px]">
                {['USD', 'EUR', 'GBP', 'BRL'].map((curr) => (
                  <button
                    key={curr}
                    onClick={() => {
                      onChangeCurrency(curr);
                      setCurrencyDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1 text-[11px] hover:bg-[#182e2c] ${
                      currency === curr ? 'text-[#c8a25c] font-semibold' : 'text-[#ede7dc]/80'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Luxury Navigation Bar */}
      <nav
        className={`px-4 md:px-10 transition-all duration-300 border-b ${
          scrolled
            ? 'bg-[#132524]/95 backdrop-blur-md py-3.5 border-[#1c3836] shadow-xl'
            : 'bg-[#132524] py-5 border-[#1a3331]'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo - Vellor Wealth Watches */}
          <a href="#top" className="group">
            <BrandLogo size="md" variant="gold" />
          </a>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.id}
                id={`nav-${link.id}`}
                onClick={() => {
                  if (link.isCollection) {
                    onSelectCollection(link.id);
                  }
                  const catalogElem = document.getElementById('catalog-section');
                  if (catalogElem) {
                    catalogElem.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className={`text-[12px] font-sans tracking-[0.2em] font-medium transition-all relative py-1 cursor-pointer ${
                  activeCollection === link.id
                    ? 'text-[#c8a25c]'
                    : 'text-[#ede7dc]/80 hover:text-[#ede7dc]'
                }`}
              >
                {link.label}
                {activeCollection === link.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#c8a25c] shadow-[0_0_8px_rgba(200,162,92,0.6)]" />
                )}
              </button>
            ))}
          </div>

          {/* Action Utilities: Search, Account, Wishlist, Cart */}
          <div className="flex items-center gap-4 md:gap-6 text-[#ede7dc]">
            {/* Search */}
            <button
              id="search-btn"
              onClick={onOpenSearch}
              className="p-1.5 text-[#ede7dc]/80 hover:text-[#c8a25c] transition-colors cursor-pointer"
              title="Search Timepieces"
            >
              <Search className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            {/* Account */}
            <button
              id="account-btn"
              onClick={onOpenStoreLocator}
              className="hidden sm:flex items-center gap-1.5 text-[11px] tracking-widest font-medium text-[#ede7dc]/80 hover:text-[#c8a25c] transition-colors cursor-pointer"
              title="Client Login / Concierge"
            >
              <User className="w-4 h-4 md:w-4 md:h-4" />
              <span className="hidden xl:inline">LOGIN</span>
            </button>

            {/* Wishlist */}
            <button
              id="wishlist-btn"
              onClick={onOpenWishlist}
              className="relative p-1.5 text-[#ede7dc]/80 hover:text-[#c8a25c] transition-colors cursor-pointer"
              title="Saved Masterpieces"
            >
              <Heart className="w-4 h-4 md:w-5 md:h-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#c8a25c] text-[#0e1b1a] text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center font-sans">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart / Bag */}
            <button
              id="cart-bag-btn"
              onClick={onOpenCart}
              className="relative flex items-center gap-2 p-1.5 text-[#ede7dc] hover:text-[#c8a25c] transition-colors cursor-pointer"
              title="Shopping Bag"
            >
              <ShoppingBag className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden md:inline text-[11px] tracking-widest font-medium">BAG</span>
              {cartCount > 0 && (
                <span className="bg-[#c8a25c] text-[#0e1b1a] text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center font-sans">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              id="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 text-[#ede7dc]/90 hover:text-[#c8a25c] transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-4 pt-4 border-t border-[#1c3836] bg-[#0e1b1a]/95 rounded-lg p-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    if (link.isCollection) {
                      onSelectCollection(link.id);
                    }
                    setMobileMenuOpen(false);
                    const catalogElem = document.getElementById('catalog-section');
                    if (catalogElem) {
                      catalogElem.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className={`text-left text-xs font-sans tracking-[0.2em] py-2 border-b border-[#182e2c] ${
                    activeCollection === link.id ? 'text-[#c8a25c] font-semibold' : 'text-[#ede7dc]/80'
                  }`}
                >
                  {link.label}
                </button>
              ))}

              <div className="pt-3 flex justify-between items-center text-xs text-[#ede7dc]/70">
                <button
                  onClick={() => {
                    onOpenStoreLocator();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-1.5 text-[#c8a25c]"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Find a Boutique
                </button>
                <div className="flex gap-2">
                  {['USD', 'EUR', 'GBP', 'BRL'].map((curr) => (
                    <button
                      key={curr}
                      onClick={() => onChangeCurrency(curr)}
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        currency === curr ? 'bg-[#c8a25c] text-[#0e1b1a] font-bold' : 'bg-[#182e2c]'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};
