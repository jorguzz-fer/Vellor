import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { Search, X, ArrowRight } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  currency: string;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
  currency,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.specs.caseMaterial.toLowerCase().includes(q) ||
        p.specs.movement.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [query, products]);

  if (!isOpen) return null;

  const quickTags = ['Titanium', 'Gold', 'Chronograph', 'Diver', 'Automatic', 'Minimalist'];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-[#091212]/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#132524] border border-[#234542] rounded-sm shadow-2xl p-6 text-[#ede7dc]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Box */}
        <div className="relative flex items-center border-b border-[#2d524e] pb-3">
          <Search className="w-5 h-5 text-[#c8a25c] shrink-0 mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search timepiece name, complication, calibre, or gold edition..."
            className="w-full bg-transparent text-sm sm:text-base text-[#f4efe6] placeholder-[#ede7dc]/40 outline-none font-sans"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[#ede7dc]/60 hover:text-[#ede7dc] mr-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs text-[#ede7dc]/60 hover:text-[#c8a25c] uppercase tracking-wider font-sans ml-2 cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Quick Tag Recommendations */}
        {!query && (
          <div className="pt-4 pb-2">
            <span className="text-[10px] uppercase tracking-widest text-[#ede7dc]/50 font-sans block mb-2">
              Suggested Complications:
            </span>
            <div className="flex flex-wrap gap-2">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag)}
                  className="px-3 py-1 bg-[#0e1b1a] border border-[#1f3f3c] hover:border-[#c8a25c] rounded-full text-xs text-[#ede7dc]/80 hover:text-[#c8a25c] transition-colors cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results List */}
        {query && (
          <div className="mt-4 max-h-[360px] overflow-y-auto space-y-2">
            {filtered.length === 0 ? (
              <p className="text-xs text-[#ede7dc]/50 py-6 text-center">
                No horological masterworks match "{query}".
              </p>
            ) : (
              filtered.map((product) => (
                <div
                  key={product.id}
                  onClick={() => {
                    onSelectProduct(product);
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 bg-[#0e1b1a] hover:bg-[#182e2c] border border-[#1a3533] rounded-sm cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-12 h-12 object-contain"
                    />
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#f4efe6] group-hover:text-[#c8a25c] transition-colors">
                        {product.name}
                      </h4>
                      <p className="text-[10px] text-[#ede7dc]/60">
                        {product.specs.caseMaterial} · {product.specs.movement}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-[#c8a25c]">
                      ${product.price.toFixed(2)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#ede7dc]/40 group-hover:text-[#c8a25c] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
