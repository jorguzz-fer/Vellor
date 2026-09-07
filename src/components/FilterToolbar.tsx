import React from 'react';
import { LayoutGrid, Grid3X3, Columns2, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { WATCH_COLLECTIONS } from '../data/watches';

interface FilterToolbarProps {
  selectedCollection: string;
  onSelectCollection: (col: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  gridColumns: 2 | 3 | 4;
  onGridColumnsChange: (cols: 2 | 3 | 4) => void;
  totalCount: number;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  selectedCollection,
  onSelectCollection,
  sortBy,
  onSortChange,
  gridColumns,
  onGridColumnsChange,
  totalCount,
}) => {
  return (
    <div className="bg-[#132524] border-y border-[#1c3836] py-4 px-4 sm:px-6 md:px-8 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Collections Horizontal Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          {WATCH_COLLECTIONS.map((col) => {
            const isActive = selectedCollection === col.id;
            return (
              <button
                key={col.id}
                id={`filter-${col.id}`}
                onClick={() => onSelectCollection(col.id)}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-sans tracking-wider uppercase whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#c8a25c] text-[#0e1b1a] font-semibold shadow-md'
                    : 'bg-[#182e2c] text-[#ede7dc]/80 hover:bg-[#1f3a38] hover:text-[#ede7dc]'
                }`}
              >
                {col.label}
              </button>
            );
          })}
        </div>

        {/* Right Controls: Sort, Columns, Count */}
        <div className="flex items-center justify-between md:justify-end gap-5 w-full md:w-auto">
          {/* Item Count */}
          <span className="text-[11px] font-sans tracking-widest text-[#ede7dc]/60 uppercase">
            <strong className="text-[#c8a25c] font-semibold">{totalCount}</strong> Timepieces
          </span>

          <span className="hidden sm:inline text-[#1c3836]">|</span>

          {/* Sort Selection */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#c8a25c]" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="bg-[#182e2c] border border-[#234542] text-[#ede7dc] text-[11px] font-sans rounded px-2.5 py-1.5 tracking-wider focus:outline-none focus:border-[#c8a25c] cursor-pointer"
            >
              <option value="featured">Featured Horology</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Client Rating</option>
            </select>
          </div>

          <span className="hidden sm:inline text-[#1c3836]">|</span>

          {/* Grid Layout View Toggle (4-col as in reference image) */}
          <div className="hidden sm:flex items-center gap-1 bg-[#182e2c] p-0.5 rounded border border-[#234542]">
            <button
              onClick={() => onGridColumnsChange(2)}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                gridColumns === 2 ? 'bg-[#c8a25c] text-[#0e1b1a]' : 'text-[#ede7dc]/60 hover:text-[#ede7dc]'
              }`}
              title="2 Columns Grid"
            >
              <Columns2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onGridColumnsChange(3)}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                gridColumns === 3 ? 'bg-[#c8a25c] text-[#0e1b1a]' : 'text-[#ede7dc]/60 hover:text-[#ede7dc]'
              }`}
              title="3 Columns Grid"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onGridColumnsChange(4)}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                gridColumns === 4 ? 'bg-[#c8a25c] text-[#0e1b1a]' : 'text-[#ede7dc]/60 hover:text-[#ede7dc]'
              }`}
              title="4 Columns Grid (Reference Standard)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
