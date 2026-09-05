import React, { useState, useEffect } from 'react';
import { Shuffle, ShoppingCart, Check, Star, Award, X, Sparkles } from 'lucide-react';
import { productAPI, cartAPI } from '../services/api';
import ProductImage from '../components/ProductImage';

export default function ComparePage({ updateCart }) {
  const [allProducts, setAllProducts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([null, null, null]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        const data = await productAPI.list();
        setAllProducts(data);
        // Pre-select the first two products for a good initial comparison view
        if (data.length >= 2) {
          setSelectedIds([data[0].id, data[1].id, null]);
        }
      } catch (err) {
        console.error("Error loading products for comparison:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const handleSelectProduct = (slotIndex, productId) => {
    const nextIds = [...selectedIds];
    nextIds[slotIndex] = productId ? parseInt(productId) : null;
    setSelectedIds(nextIds);
  };

  const handleClearSlot = (slotIndex) => {
    const nextIds = [...selectedIds];
    nextIds[slotIndex] = null;
    setSelectedIds(nextIds);
  };

  // Get active product data
  const comparedProducts = selectedIds
    .map(id => allProducts.find(p => p.id === id))
    .filter(p => !!p);

  // Extract all unique specification keys across selected products
  const uniqueSpecKeys = new Set();
  comparedProducts.forEach(prod => {
    if (prod.specifications) {
      Object.keys(prod.specifications).forEach(k => uniqueSpecKeys.add(k));
    }
  });
  const specKeysList = Array.from(uniqueSpecKeys);

  // Find "winner" by rating to highlight
  let highestRatedId = null;
  if (comparedProducts.length > 0) {
    const sortedByRating = [...comparedProducts].sort((a, b) => b.rating - a.rating);
    highestRatedId = sortedByRating[0].id;
  }

  const handleAddToCart = async (productId) => {
    try {
      setAddingId(productId);
      const updated = await cartAPI.add(productId, 1);
      updateCart(updated);
      setTimeout(() => setAddingId(null), 1000);
    } catch (err) {
      console.error(err);
      setAddingId(null);
    }
  };

  const winnerCellClass = 'bg-forest-50/60 border-x border-forest-100';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-3xl text-ink">Compare products</h2>
        <p className="text-inkMuted text-sm">Select up to three products to compare specs, price, and rating side by side.</p>
      </div>

      {/* Selectors grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[0, 1, 2].map((slot) => {
          const currentProduct = comparedProducts.find(p => p.id === selectedIds[slot]);
          return (
            <div key={slot} className="card p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-inkMuted font-semibold uppercase tracking-wide">Product {slot + 1}</span>
                {currentProduct && (
                  <button onClick={() => handleClearSlot(slot)} className="p-1 rounded-full text-inkMuted hover:text-ink transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {loading ? (
                <div className="h-10 bg-paperDim rounded-lg animate-pulse" />
              ) : (
                <select
                  value={selectedIds[slot] || ''}
                  onChange={(e) => handleSelectProduct(slot, e.target.value)}
                  className="w-full px-3 py-2.5 bg-paper border border-sand focus:border-forest-500 rounded-lg text-xs text-ink focus:outline-none transition-colors"
                >
                  <option value="">-- Select Product --</option>
                  {allProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (₹{p.price.toLocaleString()})</option>
                  ))}
                </select>
              )}

              {currentProduct && (
                <div className="flex items-center gap-3 pt-1">
                  <ProductImage src={currentProduct.image_url} alt={currentProduct.name} className="w-12 h-12 rounded-lg object-cover bg-paperDim" />
                  <div className="space-y-0.5 truncate">
                    <p className="text-ink text-xs font-medium truncate">{currentProduct.name}</p>
                    <p className="text-inkMuted text-[10px]">{currentProduct.category}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison Matrix Table */}
      {comparedProducts.length === 0 ? (
        <div className="card p-16 text-center space-y-4 max-w-lg mx-auto">
          <Shuffle className="h-10 w-10 text-sandDark mx-auto" />
          <h3 className="font-display font-semibold text-lg text-ink">No products selected</h3>
          <p className="text-inkMuted text-sm">Choose products from the dropdowns above to build a side-by-side comparison.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-sand">
              <thead className="bg-paperDim">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-inkMuted uppercase tracking-wide w-48">Feature</th>
                  {comparedProducts.map((p) => (
                    <th
                      key={p.id}
                      className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide relative ${
                        p.id === highestRatedId ? `${winnerCellClass} text-forest-600` : 'text-ink'
                      }`}
                    >
                      {p.id === highestRatedId && (
                        <span className="absolute -top-1.5 left-6 bg-forest-500 text-[8px] font-semibold text-white px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-0.5">
                          <Award className="h-2 w-2" />
                          <span>Top rated</span>
                        </span>
                      )}
                      <span className="block truncate max-w-[200px] normal-case font-medium">{p.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sand bg-white">
                {/* Images */}
                <tr>
                  <td className="px-6 py-4 text-xs font-medium text-inkMuted">Preview</td>
                  {comparedProducts.map((p) => (
                    <td key={p.id} className={`px-6 py-4 ${p.id === highestRatedId ? winnerCellClass : ''}`}>
                      <ProductImage src={p.image_url} alt={p.name} className="w-20 h-20 rounded-lg object-cover bg-paperDim" />
                    </td>
                  ))}
                </tr>

                {/* Price */}
                <tr>
                  <td className="px-6 py-4 text-xs font-medium text-inkMuted">Price</td>
                  {comparedProducts.map((p) => (
                    <td key={p.id} className={`px-6 py-4 text-sm font-semibold text-ink ${p.id === highestRatedId ? winnerCellClass : ''}`}>
                      ₹{p.price.toLocaleString()}
                    </td>
                  ))}
                </tr>

                {/* Rating */}
                <tr>
                  <td className="px-6 py-4 text-xs font-medium text-inkMuted">Rating</td>
                  {comparedProducts.map((p) => (
                    <td key={p.id} className={`px-6 py-4 text-xs ${p.id === highestRatedId ? winnerCellClass : ''}`}>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-ember-400 text-ember-400" />
                        <span className="font-medium text-ink">{p.rating}</span>
                        <span className="text-inkMuted">({p.reviews_count} reviews)</span>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Category */}
                <tr>
                  <td className="px-6 py-4 text-xs font-medium text-inkMuted">Category</td>
                  {comparedProducts.map((p) => (
                    <td key={p.id} className={`px-6 py-4 text-xs text-ink ${p.id === highestRatedId ? winnerCellClass : ''}`}>
                      {p.category}
                    </td>
                  ))}
                </tr>

                {/* Tech Specs */}
                {specKeysList.map((key) => (
                  <tr key={key}>
                    <td className="px-6 py-4 text-xs font-medium text-inkMuted">{key}</td>
                    {comparedProducts.map((p) => {
                      const specVal = p.specifications ? p.specifications[key] : 'N/A';
                      return (
                        <td key={p.id} className={`px-6 py-4 text-xs text-ink ${p.id === highestRatedId ? winnerCellClass : ''}`}>
                          {specVal || 'N/A'}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Stock Status */}
                <tr>
                  <td className="px-6 py-4 text-xs font-medium text-inkMuted">Stock Status</td>
                  {comparedProducts.map((p) => (
                    <td key={p.id} className={`px-6 py-4 text-xs ${p.id === highestRatedId ? winnerCellClass : ''}`}>
                      {p.stock > 0 ? (
                        <span className="inline-flex items-center text-forest-600 bg-forest-50 px-2 py-0.5 rounded text-[10px] font-semibold">
                          In Stock ({p.stock})
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-ember-600 bg-ember-50 px-2 py-0.5 rounded text-[10px] font-semibold">
                          Out of Stock
                        </span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Action button */}
                <tr className="bg-paperDim/60">
                  <td className="px-6 py-4 text-xs font-medium text-inkMuted">Actions</td>
                  {comparedProducts.map((p) => (
                    <td key={p.id} className={`px-6 py-4 ${p.id === highestRatedId ? winnerCellClass : ''}`}>
                      <button
                        onClick={() => handleAddToCart(p.id)}
                        disabled={addingId === p.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-forest-500 hover:bg-forest-600 disabled:bg-forest-600 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        {addingId === p.id ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
                        <span>{addingId === p.id ? 'Added' : 'Add to Cart'}</span>
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
