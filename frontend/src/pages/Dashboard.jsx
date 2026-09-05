import React, { useState, useEffect } from 'react';
import { Bot, History, Sparkles, ArrowRight, Eye, Star, ShoppingBag } from 'lucide-react';
import { productAPI, agentAPI } from '../services/api';
import ProductImage from '../components/ProductImage';
import { useAuth } from '../context/AuthContext';
import { getCategoryIcon } from '../utils/categoryMeta';

export default function Dashboard({ cart, setCurrentPage, setAgentPrompt, setCategoryFilter }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const prods = await productAPI.list();
        const recs = await agentAPI.getRecommendations();

        // Group the live catalog by category so this stays correct as the
        // catalog grows, rather than hardcoding category counts.
        const grouped = prods.reduce((acc, p) => {
          acc[p.category] = (acc[p.category] || 0) + 1;
          return acc;
        }, {});
        setCategories(Object.entries(grouped).map(([name, count]) => ({ name, count })));
        setTotalProducts(prods.length);

        setRecentSearches([
          { query: 'wireless headphones under 3000', timestamp: '2 mins ago' },
          { query: 'skincare sunscreen gel', timestamp: '1 hour ago' },
          { query: 'laptop with 16gb ram', timestamp: '1 day ago' },
        ]);
        setRecommendations(recs);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const liveCartCount = cart?.items ? cart.items.reduce((acc, curr) => acc + curr.quantity, 0) : 0;
  const liveCartSubtotal = cart?.subtotal ?? 0;
  const firstName = (user?.full_name || '').split(' ')[0];

  const handleRecentSearchClick = (query) => {
    setAgentPrompt(query);
    setCurrentPage('agent');
  };

  const handleCategoryClick = (catName) => {
    setCategoryFilter(catName);
    setCurrentPage('products');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Header banner */}
      <div className="rounded-2xl bg-forest-500 px-8 py-9 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <h1 className="font-display font-semibold text-3xl text-white">
            {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
          </h1>
          <p className="text-forest-50/85 text-sm">
            Browse the catalog, pick up where a recent search left off, or ask the AI assistant to find something specific.
          </p>
        </div>
        <button
          onClick={() => setCurrentPage('agent')}
          className="flex items-center gap-2 px-6 py-3 bg-white text-forest-600 font-medium rounded-xl hover:bg-forest-50 transition-colors shrink-0"
        >
          <Bot className="h-4.5 w-4.5" />
          <span>Ask the AI Assistant</span>
        </button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Products available', value: totalProducts, icon: ShoppingBag },
          { label: 'Categories', value: categories.length, icon: Sparkles },
          { label: 'Items in your cart', value: liveCartCount, icon: Bot, detail: liveCartCount > 0 ? `₹${liveCartSubtotal.toLocaleString()} subtotal` : null },
          { label: 'Your account', value: user?.is_verified ? 'Verified' : 'Active', icon: Star },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="card p-5">
              <Icon className="h-5 w-5 text-forest-500 mb-3" />
              <p className="font-display font-semibold text-2xl text-ink">{item.value}</p>
              <p className="text-inkMuted text-xs mt-0.5">{item.label}</p>
              {item.detail && <p className="text-[11px] text-ember-600 font-medium mt-1">{item.detail}</p>}
            </div>
          );
        })}
      </div>

      {/* Categories & Recent Searches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 space-y-4 lg:col-span-2">
          <h3 className="font-display font-semibold text-lg text-ink">Browse by category</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {categories.map((cat, idx) => {
              const Icon = getCategoryIcon(cat.name);
              return (
                <button
                  key={idx}
                  onClick={() => handleCategoryClick(cat.name)}
                  className="p-4 rounded-lg border border-sand hover:border-forest-400 hover:bg-forest-50/50 text-left transition-colors group"
                >
                  <Icon className="h-5 w-5 text-forest-500 mb-2.5" />
                  <p className="text-sm font-medium text-ink group-hover:text-forest-600">{cat.name}</p>
                  <p className="text-xs text-inkMuted mt-0.5">{cat.count} items</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card p-6 space-y-3.5">
          <h3 className="font-display font-semibold text-lg text-ink flex items-center gap-2">
            <History className="h-4.5 w-4.5 text-inkMuted" />
            Recent searches
          </h3>
          <div className="space-y-2">
            {recentSearches.map((search, idx) => (
              <button
                key={idx}
                onClick={() => handleRecentSearchClick(search.query)}
                className="w-full text-left p-3 rounded-lg border border-sand hover:border-forest-400 hover:bg-forest-50/40 flex items-center justify-between gap-2 transition-colors group"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="text-ink text-xs font-medium truncate group-hover:text-forest-600">{search.query}</p>
                  <p className="text-inkMuted text-[11px]">{search.timestamp}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-inkMuted group-hover:text-forest-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-xl text-ink flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-ember-500" />
            Picked for you
          </h3>
          <button
            onClick={() => setCurrentPage('deals')}
            className="text-sm text-forest-600 hover:text-forest-700 font-medium flex items-center gap-1"
          >
            View all deals <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-4 space-y-3 animate-pulse">
                <div className="w-full h-36 bg-paperDim rounded-lg" />
                <div className="h-3.5 bg-paperDim rounded w-2/3" />
                <div className="h-3 bg-paperDim rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {recommendations.slice(0, 4).map((rec, idx) => (
              <div key={idx} className="card card-hover p-4 flex flex-col justify-between tag-corner">
                <div>
                  <div className="w-full h-36 rounded-lg overflow-hidden mb-3 bg-paperDim">
                    <ProductImage src={rec.image_url} alt={rec.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[11px] text-inkMuted font-medium mb-1">{rec.category}</p>
                  <h4 className="text-ink font-medium text-sm line-clamp-1">{rec.name}</h4>
                  <div className="flex items-center gap-1 text-xs mt-1">
                    <Star className="h-3 w-3 fill-ember-400 text-ember-400" />
                    <span className="font-medium text-ink">{rec.rating}</span>
                    <span className="text-inkMuted">({rec.reviews_count})</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 tear-divider flex items-center justify-between">
                  <span className="text-ink font-semibold text-sm">₹{rec.price.toLocaleString()}</span>
                  <button
                    onClick={() => {
                      setCategoryFilter(rec.category);
                      setCurrentPage('products');
                    }}
                    className="p-1.5 rounded-lg border border-sand text-inkMuted hover:text-forest-600 hover:border-forest-400 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
