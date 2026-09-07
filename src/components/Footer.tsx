import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { ArrowRight, Check } from 'lucide-react';

interface FooterProps {
  onSelectCollection: (colId: string) => void;
  onOpenStoreLocator: () => void;
  onOpenWishlist: () => void;
  onOpenCart: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectCollection,
  onOpenStoreLocator,
  onOpenWishlist,
  onOpenCart,
}) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="bg-[#0b1717] border-t border-[#182e2c] text-[#ede7dc] pt-14 pb-8 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[#1c3836]">
          {/* Newsletter Column matching reference */}
          <div className="md:col-span-4 lg:col-span-5 flex flex-col justify-start pr-0 md:pr-8">
            <h3 
              className="text-lg sm:text-xl font-serif tracking-[0.1em] text-[#f4efe6] uppercase mb-3 font-normal"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              HELLO, SUBSCRIBE TO OUR NEWSLETTER
            </h3>
            <p className="text-xs text-[#ede7dc]/60 leading-relaxed mb-6 font-sans">
              Enter your email to receive private invitations to Baselworld debuts, exclusive limited releases, and private horology salon previews.
            </p>

            <form onSubmit={handleSubscribe} className="relative max-w-sm mb-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                required
                className="w-full bg-transparent border-b border-[#2d524e] focus:border-[#c8a25c] pb-2 text-xs text-[#ede7dc] placeholder-[#ede7dc]/40 outline-none pr-8 transition-colors font-sans"
              />
              <button
                type="submit"
                className="absolute right-0 top-1 text-[#ede7dc]/60 hover:text-[#c8a25c] transition-colors cursor-pointer"
                title="Subscribe"
              >
                {subscribed ? (
                  <Check className="w-4 h-4 text-[#c8a25c]" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </button>
            </form>

            {subscribed ? (
              <p className="text-[11px] text-[#c8a25c] font-sans">
                Privilege confirmed. Welcome to the Vellor Society.
              </p>
            ) : (
              <p className="text-[10px] text-[#ede7dc]/40 font-sans tracking-wide">
                <a href="#privacy" className="hover:text-[#ede7dc] underline">Privacy Policy</a> and <a href="#terms" className="hover:text-[#ede7dc] underline">Terms & Conditions</a>.
              </p>
            )}
          </div>

          {/* Links Columns from reference layout */}
          <div className="md:col-span-8 lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-6">
            {/* OUR COMPANY */}
            <div>
              <h4 className="text-[11px] font-sans font-bold tracking-[0.2em] uppercase text-[#c8a25c] mb-4">
                OUR COMPANY
              </h4>
              <ul className="space-y-2.5 text-xs text-[#ede7dc]/70 font-sans">
                <li><a href="#about" className="hover:text-[#c8a25c] transition-colors">About Us</a></li>
                <li><button onClick={onOpenStoreLocator} className="hover:text-[#c8a25c] transition-colors text-left">Contact Us</button></li>
                <li><button onClick={onOpenStoreLocator} className="hover:text-[#c8a25c] transition-colors text-left">Get In Touch</button></li>
                <li><a href="#catalog-section" className="hover:text-[#c8a25c] transition-colors">Shop Timepieces</a></li>
                <li><a href="#blog" className="hover:text-[#c8a25c] transition-colors">Horology Journal</a></li>
              </ul>
            </div>

            {/* CUSTOMER CARE */}
            <div>
              <h4 className="text-[11px] font-sans font-bold tracking-[0.2em] uppercase text-[#c8a25c] mb-4">
                CUSTOMER CARE
              </h4>
              <ul className="space-y-2.5 text-xs text-[#ede7dc]/70 font-sans">
                <li><a href="#faq" className="hover:text-[#c8a25c] transition-colors">FAQs</a></li>
                <li><a href="#services" className="hover:text-[#c8a25c] transition-colors">Our Services</a></li>
                <li><button onClick={onOpenWishlist} className="hover:text-[#c8a25c] transition-colors text-left">Wishlist</button></li>
                <li><button onClick={onOpenCart} className="hover:text-[#c8a25c] transition-colors text-left">Bag</button></li>
                <li><button onClick={onOpenStoreLocator} className="hover:text-[#c8a25c] transition-colors text-left">My Account</button></li>
                <li><span className="text-[#ede7dc]/40">Bespoke Engraving (Coming Soon)</span></li>
              </ul>
            </div>

            {/* SHOP */}
            <div>
              <h4 className="text-[11px] font-sans font-bold tracking-[0.2em] uppercase text-[#c8a25c] mb-4">
                SHOP
              </h4>
              <ul className="space-y-2.5 text-xs text-[#ede7dc]/70 font-sans">
                <li>
                  <button onClick={() => onSelectCollection('all')} className="hover:text-[#c8a25c] transition-colors text-left">
                    All Products
                  </button>
                </li>
                <li>
                  <button onClick={() => onSelectCollection('chronograph')} className="hover:text-[#c8a25c] transition-colors text-left">
                    Chronographs
                  </button>
                </li>
                <li>
                  <button onClick={() => onSelectCollection('gold')} className="hover:text-[#c8a25c] transition-colors text-left">
                    Gold Editions
                  </button>
                </li>
                <li>
                  <button onClick={() => onSelectCollection('diver')} className="hover:text-[#c8a25c] transition-colors text-left">
                    Nautical & Divers
                  </button>
                </li>
                <li>
                  <button onClick={onOpenCart} className="hover:text-[#c8a25c] transition-colors text-left">
                    Checkout
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright, Central Logo, Social Links */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-[11px] font-sans text-[#ede7dc]/60">
          {/* Left copyright */}
          <div>
            © 2026 VELLOR WEALTH WATCHES · all rights reserved
          </div>

          {/* Central Logo from Brand Palette */}
          <div>
            <BrandLogo size="sm" variant="gold" showSubtitle={false} />
          </div>

          {/* Right Social Shortcuts from reference */}
          <div className="flex items-center gap-4 tracking-widest text-[#ede7dc]/70">
            <a href="#twitter" className="hover:text-[#c8a25c] transition-colors">TW.</a>
            <a href="#youtube" className="hover:text-[#c8a25c] transition-colors">YT.</a>
            <a href="#pinterest" className="hover:text-[#c8a25c] transition-colors">PIN.</a>
            <a href="#instagram" className="hover:text-[#c8a25c] transition-colors">IN.</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
