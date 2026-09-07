import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { BrandLogo } from '@/components/BrandLogo';
import { t } from '@/i18n/pt-BR';
import { useAuth, useSettings } from '@/lib/queries';
import { useCart, useWishlist } from '@/store/cart';

const LINKS = [
  { to: '/relogios', label: t('nav.watches') },
  { to: '/perfumes', label: t('nav.perfumes') },
  { to: '/sobre', label: t('nav.about') },
  { to: '/atendimento', label: t('nav.contact') },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const cart = useCart();
  const wishlist = useWishlist();
  const auth = useAuth();
  const { data: settings } = useSettings();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearchOpen(false);
    setMenuOpen(false);
    navigate(`/busca?q=${encodeURIComponent(q)}`);
  };

  const announcement = settings?.announcement;

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      {announcement?.enabled && announcement.text && (
        <div className="flex h-8 items-center justify-center gap-2 border-b border-line bg-noir px-4 text-center text-[10px] uppercase tracking-[0.2em] text-ivory/70">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          <span className="truncate">{announcement.text}</span>
        </div>
      )}
      <nav
        className={`border-b transition-all duration-300 ${scrolled ? 'border-line bg-dark/95 py-3 shadow-xl backdrop-blur' : 'border-line/60 bg-dark py-4'}`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 md:px-8">
          <Link to="/" aria-label="Vellor — início">
            <BrandLogo size="md" />
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `relative py-1 text-[12px] font-medium uppercase tracking-[0.2em] transition-colors ${isActive ? 'text-gold' : 'text-ivory/80 hover:text-ivory'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button
              type="button"
              className="p-1.5 text-ivory/80 hover:text-gold"
              aria-label={t('nav.search')}
              onClick={() => setSearchOpen((v) => !v)}
            >
              <Search className="h-5 w-5" />
            </button>
            <Link
              to={auth.authenticated ? '/conta' : '/conta/entrar'}
              className="hidden items-center gap-1.5 p-1.5 text-[11px] uppercase tracking-[0.15em] text-ivory/80 hover:text-gold sm:flex"
              aria-label={t('nav.account')}
            >
              <User className="h-5 w-5" />
              <span className="hidden xl:inline">
                {auth.authenticated ? auth.user?.name.split(' ')[0] : t('nav.login')}
              </span>
            </Link>
            <Link
              to="/favoritos"
              className="relative p-1.5 text-ivory/80 hover:text-gold"
              aria-label={t('nav.wishlist')}
            >
              <Heart className="h-5 w-5" />
              {wishlist.slugs.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-noir">
                  {wishlist.slugs.length}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={cart.open}
              className="relative flex items-center gap-2 p-1.5 text-ivory hover:text-gold"
              aria-label={t('nav.cart')}
              data-testid="open-cart"
            >
              <ShoppingBag className="h-5 w-5" />
              <span className="hidden text-[11px] uppercase tracking-[0.15em] md:inline">
                {t('nav.cart')}
              </span>
              {cart.count > 0 && (
                <span className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-noir">
                  {cart.count}
                </span>
              )}
            </button>
            <button
              type="button"
              className="p-1.5 text-ivory/90 hover:text-gold lg:hidden"
              aria-label={menuOpen ? t('nav.close') : t('nav.menu')}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <form
            onSubmit={submitSearch}
            className="mx-auto mt-3 flex max-w-7xl items-center gap-2 px-4 md:px-8 animate-fade-in"
            role="search"
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar relógios, perfumes, marcas…"
              className="input"
              aria-label={t('nav.search')}
            />
            <button type="submit" className="btn-primary px-4 py-2.5">
              {t('nav.search')}
            </button>
          </form>
        )}

        {menuOpen && (
          <div className="mx-4 mt-3 rounded-sm border border-line bg-noir/95 p-4 lg:hidden animate-fade-in">
            <div className="flex flex-col">
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `border-b border-line py-3 text-xs uppercase tracking-[0.2em] ${isActive ? 'text-gold' : 'text-ivory/80'}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <Link
                to={auth.authenticated ? '/conta' : '/conta/entrar'}
                onClick={() => setMenuOpen(false)}
                className="py-3 text-xs uppercase tracking-[0.2em] text-gold"
              >
                {auth.authenticated ? t('nav.account') : t('nav.login')}
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
