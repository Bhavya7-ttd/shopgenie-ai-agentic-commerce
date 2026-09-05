import React, { useState, useEffect } from 'react';
import { ShoppingBag, Star, Search, ShoppingCart, X, Check } from 'lucide-react';
import { productAPI, cartAPI } from '../services/api';
import ProductImage from '../components/ProductImage';
import { getCategoryIcon } from '../utils/categoryMeta';

// The 13 canonical categories in the current catalog (see backend/seed.py).
// categoryMeta.js additionally keeps a couple of legacy aliases (e.g. plain
// "Beauty"/"Home") around purely so old data/links still resolve to an icon —
// those aren't real category values anymore, so they're intentionally left
// out of this tab list.
const categories = [
  'All',
  'Electronics',
  'Fashion',
  'Beauty & Personal Care',
  'Home & Kitchen',
  'Accessories',
  'Books & Stationery',
  'Sports & Fitness',
  'Grocery & Food',
  'Health & Wellness',
  'Toys & Games',
  'Travel',
  'Pet Supplies',
  'Automotive',
];

export default function ProductsPage({ categoryFilter, setCategoryFilter, updateCart }) {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        const data = await productAPI.list({
          query: searchQuery,
          category: categoryFilter === 'All' ? null : categoryFilter
        });
        setProducts(data);
      } catch (err) {
        console.error("Error loading products:", err);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      fetchProducts();
    }, 300); // Debounce search input

    return () => clearTimeout(timer);
  }, [searchQuery, categoryFilter]);

  const handleAddToCart = async (productId, e) => {
    e?.stopPropagation();
    try {
      setAddingId(productId);
      const updated = await cartAPI.add(productId, 1);
      updateCart(updated);
      setTimeout(() => setAddingId(null), 1000); // Flash visual check
    } catch (err) {
      console.error(err);
      setAddingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Header and Search bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1">
          <h2 className="font-display font-semibold text-3xl text-ink">Product Catalog</h2>
          <p className="text-inkMuted text-sm">Browse the full ShopGenie catalog.</p>
        </div>

        <div className="w-full md:w-96 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-inkMuted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by keyword..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-sand focus:border-forest-500 rounded-xl text-sm placeholder-inkMuted/50 text-ink focus:outline-none focus:ring-1 focus:ring-forest-500/30 transition-colors"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 tear-divider pb-5">
        {categories.map((cat) => {
          const Icon = cat === 'All' ? null : getCategoryIcon(cat);
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
                categoryFilter === cat
                  ? 'bg-forest-500 text-white'
                  : 'bg-white text-inkMuted border border-sand hover:border-sandDark hover:text-ink'
              }`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {cat}
            </button>
          );
        })}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="card p-4 space-y-3">
              <div className="w-full h-44 bg-paperDim rounded-lg" />
              <div className="h-3.5 bg-paperDim rounded w-2/3" />
              <div className="h-3 bg-paperDim rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="card p-16 text-center space-y-4 max-w-lg mx-auto">
          <ShoppingBag className="h-10 w-10 text-sandDark mx-auto" />
          <h3 className="font-display font-semibold text-lg text-ink">No products found</h3>
          <p className="text-inkMuted text-sm">
            We couldn't find anything matching those filters. Try a different keyword or category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className="card card-hover p-4 flex flex-col justify-between cursor-pointer group tag-corner"
            >
              <div>
                <div className="relative w-full h-44 rounded-lg overflow-hidden mb-3 bg-paperDim">
                  <ProductImage
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-white/90 text-[9px] font-semibold uppercase text-inkMuted tracking-wide">
                    {product.category}
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-medium text-ink text-sm line-clamp-1">{product.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Star className="h-3.5 w-3.5 fill-ember-400 text-ember-400" />
                    <span className="font-medium text-ink">{product.rating}</span>
                    <span className="text-inkMuted">({product.reviews_count})</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 tear-divider flex items-center justify-between">
                <span className="text-ink font-semibold text-sm">₹{product.price.toLocaleString()}</span>
                <button
                  onClick={(e) => handleAddToCart(product.id, e)}
                  disabled={addingId === product.id}
                  className="p-2 rounded-lg bg-forest-500 hover:bg-forest-600 disabled:opacity-100 text-white transition-colors"
                >
                  {addingId === product.id ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal Overlay */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-xl relative flex flex-col md:flex-row">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white text-inkMuted hover:text-ink border border-sand transition-colors z-10"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="w-full md:w-1/2 h-56 md:h-auto bg-paperDim">
              <ProductImage src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
            </div>

            <div className="p-6 md:w-1/2 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <span className="inline-block px-2 py-0.5 rounded bg-forest-50 text-[10px] font-semibold text-forest-600 uppercase tracking-wide">
                  {selectedProduct.category}
                </span>

                <h3 className="font-display font-semibold text-xl text-ink leading-tight">{selectedProduct.name}</h3>

                <div className="flex items-center gap-1.5 text-xs text-inkMuted">
                  <Star className="h-4 w-4 fill-ember-400 text-ember-400" />
                  <span className="font-medium text-ink">{selectedProduct.rating}</span>
                  <span>· {selectedProduct.reviews_count} customer reviews</span>
                </div>

                <p className="text-inkMuted text-xs leading-relaxed">{selectedProduct.description}</p>

                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] text-inkMuted font-semibold uppercase tracking-wide block">Specifications</span>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {Object.entries(selectedProduct.specifications || {}).map(([key, val]) => (
                      <div key={key} className="p-2 rounded-lg bg-paperDim text-[10px]">
                        <span className="text-inkMuted block">{key}</span>
                        <span className="text-ink font-medium">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 tear-divider flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs text-inkMuted">Price</span>
                  <span className="text-ink font-semibold text-lg">₹{selectedProduct.price.toLocaleString()}</span>
                </div>

                <button
                  onClick={() => handleAddToCart(selectedProduct.id)}
                  className="flex items-center gap-2 px-5 py-3 bg-forest-500 hover:bg-forest-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
