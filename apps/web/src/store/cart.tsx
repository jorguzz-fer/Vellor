import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantName: string;
  unitPriceCents: number;
  imageUrl: string | null;
  categoryKind: 'watch' | 'perfume' | 'other';
  quantity: number;
  maxQuantity: number;
}

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  cep: string | null;
  shippingService: 'PAC' | 'SEDEX' | null;
}

type Action =
  | { type: 'add'; item: Omit<CartItem, 'quantity'>; quantity: number }
  | { type: 'setQuantity'; variantId: string; quantity: number }
  | { type: 'remove'; variantId: string }
  | { type: 'clear' }
  | { type: 'coupon'; code: string | null }
  | { type: 'shipping'; cep: string | null; service: 'PAC' | 'SEDEX' | null }
  | {
      type: 'syncStock';
      updates: Array<{ variantId: string; maxQuantity: number; unitPriceCents: number }>;
    };

const STORAGE_KEY = 'vellor:cart:v1';
const EMPTY: CartState = { items: [], couponCode: null, cep: null, shippingService: null };

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case 'add': {
      const existing = state.items.find((i) => i.variantId === action.item.variantId);
      if (existing) {
        const quantity = Math.min(existing.maxQuantity, existing.quantity + action.quantity);
        return {
          ...state,
          items: state.items.map((i) =>
            i.variantId === existing.variantId ? { ...i, quantity } : i,
          ),
        };
      }
      const quantity = Math.max(1, Math.min(action.item.maxQuantity, action.quantity));
      return { ...state, items: [...state.items, { ...action.item, quantity }] };
    }
    case 'setQuantity': {
      if (action.quantity <= 0)
        return { ...state, items: state.items.filter((i) => i.variantId !== action.variantId) };
      return {
        ...state,
        items: state.items.map((i) =>
          i.variantId === action.variantId
            ? { ...i, quantity: Math.min(i.maxQuantity, action.quantity) }
            : i,
        ),
      };
    }
    case 'remove':
      return { ...state, items: state.items.filter((i) => i.variantId !== action.variantId) };
    case 'clear':
      return { ...EMPTY, cep: state.cep };
    case 'coupon':
      return { ...state, couponCode: action.code };
    case 'shipping':
      return { ...state, cep: action.cep, shippingService: action.service };
    case 'syncStock': {
      const byId = new Map(action.updates.map((u) => [u.variantId, u]));
      return {
        ...state,
        items: state.items
          .map((i) => {
            const u = byId.get(i.variantId);
            if (!u) return i;
            return {
              ...i,
              maxQuantity: u.maxQuantity,
              unitPriceCents: u.unitPriceCents,
              quantity: Math.min(i.quantity, Math.max(u.maxQuantity, 0)),
            };
          })
          .filter((i) => i.quantity > 0),
      };
    }
    default:
      return state;
  }
}

function load(): CartState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    return { ...EMPTY, ...parsed, items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return EMPTY;
  }
}

interface CartContextValue extends CartState {
  count: number;
  subtotalCents: number;
  add: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  setCoupon: (code: string | null) => void;
  setShipping: (cep: string | null, service: 'PAC' | 'SEDEX' | null) => void;
  syncStock: (
    updates: Array<{ variantId: string; maxQuantity: number; unitPriceCents: number }>,
  ) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [isOpen, toggle] = useReducer((_: boolean, next: boolean) => next, false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // armazenamento indisponível (modo privado): a sacola vive só na memória
    }
  }, [state]);

  const value = useMemo<CartContextValue>(
    () => ({
      ...state,
      count: state.items.reduce((sum, i) => sum + i.quantity, 0),
      subtotalCents: state.items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0),
      add: (item, quantity = 1) => dispatch({ type: 'add', item, quantity }),
      setQuantity: (variantId, quantity) => dispatch({ type: 'setQuantity', variantId, quantity }),
      remove: (variantId) => dispatch({ type: 'remove', variantId }),
      clear: () => dispatch({ type: 'clear' }),
      setCoupon: (code) => dispatch({ type: 'coupon', code }),
      setShipping: (cep, service) => dispatch({ type: 'shipping', cep, service }),
      syncStock: (updates) => dispatch({ type: 'syncStock', updates }),
      isOpen,
      open: () => toggle(true),
      close: () => toggle(false),
    }),
    [state, isOpen],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart precisa de CartProvider');
  return ctx;
}

// ---------- Favoritos ----------

const WISHLIST_KEY = 'vellor:wishlist:v1';

interface WishlistContextValue {
  slugs: string[];
  has: (slug: string) => boolean;
  toggle: (slug: string) => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

function loadWishlist(): string[] {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useReducer(
    (_: string[], next: string[]) => next,
    undefined,
    loadWishlist,
  );
  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(slugs));
    } catch {
      // ignorado
    }
  }, [slugs]);
  const toggle = useCallback(
    (slug: string) =>
      setSlugs(slugs.includes(slug) ? slugs.filter((s) => s !== slug) : [...slugs, slug]),
    [slugs],
  );
  const value = useMemo<WishlistContextValue>(
    () => ({ slugs, has: (slug) => slugs.includes(slug), toggle }),
    [slugs, toggle],
  );
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist precisa de WishlistProvider');
  return ctx;
}
