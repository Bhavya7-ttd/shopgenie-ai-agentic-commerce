import React, { useState } from 'react';
import { Package, ShoppingBag } from 'lucide-react';

/**
 * Reusable ProductImage component with onError fallback support.
 * Prevents broken image icons by displaying a polished ShopGenie placeholder.
 */
export default function ProductImage({ src, alt, className = "w-full h-full object-cover", iconSize = 24 }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={`flex items-center justify-center bg-sand/40 text-forest-600/70 select-none ${className}`}>
        <div className="flex flex-col items-center justify-center gap-1 p-2 text-center">
          <ShoppingBag size={iconSize} strokeWidth={1.75} className="text-forest-500/80" />
          <span className="text-[10px] font-medium tracking-tight text-inkMuted/70 line-clamp-1">ShopGenie</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || "Product"}
      className={className}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
