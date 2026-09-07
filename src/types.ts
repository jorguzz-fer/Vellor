export interface WatchSpec {
  diameter: string;
  thickness: string;
  movement: string;
  powerReserve: string;
  waterResistance: string;
  caseMaterial: string;
  glass: string;
  strap: string;
  calibre: string;
}

export interface WatchColorVariant {
  name: string;
  hex: string;
  image: string;
}

export interface Product {
  id: string;
  reference: string;
  name: string;
  category: string;
  collection: 'all' | 'chronograph' | 'dress' | 'gold' | 'diver' | 'tourbillon';
  price: number;
  originalPrice?: number;
  priceRange?: string;
  rating: number;
  reviewsCount: number;
  isNew?: boolean;
  isBestseller?: boolean;
  images: string[];
  colors: WatchColorVariant[];
  specs: WatchSpec;
  description: string;
}

export interface CartItem {
  id: string;
  product: Product;
  selectedColor: string;
  quantity: number;
}
