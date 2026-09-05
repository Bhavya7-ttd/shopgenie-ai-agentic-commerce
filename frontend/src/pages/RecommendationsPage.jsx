import React, { useState, useEffect } from 'react';
import { Sparkles, Star, ShoppingCart, Bot, Check } from 'lucide-react';
import { agentAPI, cartAPI } from '../services/api';
import ProductImage from '../components/ProductImage';

export default function RecommendationsPage({ updateCart, setCurrentPage, setAgentPrompt }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    async function loadRecs() {
      try {
        setLoading(true);
        const data = await agentAPI.getRecommendations();
        setRecommendations(data);
      } catch (err) {
        console.error("Error loading recommendations:", err);
      } finally {
        setLoading(false);
      }
    }
    loadRecs();
  }, []);

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

  const handleConsultAgent = (productName) => {
    setAgentPrompt(`Tell me more about ${productName} and check if it is suitable for daily use.`);
    setCurrentPage('agent');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-3xl text-ink flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-ember-500" />
          Smart Deals for you
        </h2>
        <p className="text-inkMuted text-sm">
          Cross-sells and deals tailored to your recent searches and cart activity.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6 h-64 space-y-4">
              <div className="flex gap-4">
                <div className="w-32 h-32 bg-paperDim rounded-xl" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-paperDim rounded w-2/3" />
                  <div className="h-3 bg-paperDim rounded w-1/2" />
                </div>
              </div>
              <div className="h-10 bg-paperDim rounded w-full" />
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="card p-16 text-center space-y-4 max-w-lg mx-auto">
          <Sparkles className="h-10 w-10 text-sandDark mx-auto" />
          <h3 className="font-display font-semibold text-lg text-ink">No personalized deals yet</h3>
          <p className="text-inkMuted text-sm">
            Keep searching with the AI Assistant and we'll build tailored deals for you.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {recommendations.map((rec) => (
            <div key={rec.id} className="card card-hover p-6 flex flex-col justify-between tag-corner">
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="w-full sm:w-32 h-32 rounded-xl overflow-hidden bg-paperDim flex-shrink-0">
                  <ProductImage src={rec.image_url} alt={rec.name} className="w-full h-full object-cover" />
                </div>

                <div className="space-y-2 flex-1 min-w-0">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-forest-50 text-[10px] font-semibold text-forest-600 uppercase tracking-wide">
                    {rec.category}
                  </span>
                  <h3 className="font-display font-semibold text-lg text-ink line-clamp-1">{rec.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Star className="h-3.5 w-3.5 fill-ember-400 text-ember-400" />
                    <span className="font-medium text-ink">{rec.rating}</span>
                    <span className="text-inkMuted">({rec.reviews_count} reviews)</span>
                  </div>
                  <div className="p-2.5 bg-forest-50/60 border border-forest-100 rounded-lg">
                    <span className="text-[10px] font-semibold text-forest-600 uppercase tracking-wide block mb-0.5">Why we picked this</span>
                    <p className="text-inkMuted text-xs leading-relaxed">{rec.recommendation_reason}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 tear-divider flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs text-inkMuted">Special offer</span>
                  <span className="text-ink font-semibold text-lg">₹{rec.price.toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleConsultAgent(rec.name)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 border border-sand hover:border-sandDark text-inkMuted hover:text-ink text-xs font-medium rounded-lg transition-colors"
                  >
                    <Bot className="h-4 w-4" />
                    Ask Genie
                  </button>

                  <button
                    onClick={() => handleAddToCart(rec.id)}
                    disabled={addingId === rec.id}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 bg-forest-500 hover:bg-forest-600 disabled:bg-forest-600 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {addingId === rec.id ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                    {addingId === rec.id ? 'Added' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
