import React from 'react';
import { Bot, ShoppingBag, Shuffle, ShieldCheck, Sparkles, Star, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage({ setCurrentPage }) {
  const { isAuthenticated } = useAuth();
  const goToAgent = () => setCurrentPage(isAuthenticated ? 'agent' : 'register');
  const goToProducts = () => setCurrentPage(isAuthenticated ? 'dashboard' : 'register');

  const steps = [
    {
      number: '01',
      title: 'Tell it what you need',
      description: 'Describe your request in plain language — budget, brand preferences, or the specs that matter to you.',
      icon: Bot,
    },
    {
      number: '02',
      title: 'It searches and compares',
      description: 'ShopGenie filters the catalog, rules out anything outside your budget, and lines up the closest matches side by side.',
      icon: Shuffle,
    },
    {
      number: '03',
      title: 'You get a clear pick',
      description: 'A recommendation with the reasoning behind it, plus alternatives — add to cart in a single click.',
      icon: ShoppingBag,
    },
  ];

  const features = [
    { title: 'Understands intent', desc: 'Turns everyday descriptions into real budget limits, categories, and spec requirements.', icon: Sparkles },
    { title: 'Searches live inventory', desc: 'Queries the actual product catalog — no static or made-up results.', icon: ShieldCheck },
    { title: 'Compares side by side', desc: 'Builds a clear comparison across price, rating, and features when you need to decide.', icon: Shuffle },
    { title: 'Acts on your cart', desc: 'Add, update quantity, or clear items just by asking — no extra clicks needed.', icon: ShoppingBag },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 lg:pt-14 lg:pb-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-50 border border-forest-100 text-forest-700 text-xs font-semibold mb-4">
            <Sparkles className="h-3.5 w-3.5 text-forest-500" />
            AI-Powered Shopping Assistant
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-ink leading-[1.12] mb-5 tracking-tight">
            Your next purchase,
            <br />
            <span className="text-forest-600 font-extrabold">made smarter.</span>
          </h1>
          <p className="text-ink text-base sm:text-lg leading-relaxed mb-8 max-w-lg font-normal opacity-90">
            Tell ShopGenie what you need. Our AI finds, compares, and helps you choose the right
            product from a catalog spanning electronics to everyday essentials.
          </p>
          <div className="flex flex-col sm:flex-row gap-3.5">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => setCurrentPage('dashboard')}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-forest-500 hover:bg-forest-600 text-white rounded-xl font-medium shadow-sm transition-all hover:shadow-md"
                >
                  <ShoppingBag className="h-4.5 w-4.5" />
                  Go to Dashboard
                </button>
                <button
                  onClick={() => setCurrentPage('agent')}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-sand hover:border-sandDark text-ink rounded-xl font-medium shadow-sm transition-all hover:bg-paperDim"
                >
                  <Bot className="h-4.5 w-4.5 text-forest-500" />
                  Launch AI Assistant
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCurrentPage('register')}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-forest-500 hover:bg-forest-600 text-white rounded-xl font-medium shadow-sm transition-all hover:shadow-md"
                >
                  <Bot className="h-4.5 w-4.5" />
                  Sign Up to Start Shopping
                </button>
                <button
                  onClick={() => setCurrentPage('login')}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-sand hover:border-sandDark text-ink rounded-xl font-medium shadow-sm transition-all hover:bg-paperDim"
                >
                  Log In
                </button>
              </>
            )}
          </div>

          {/* Mobile Product Card Showcase */}
          <div className="lg:hidden mt-8 grid grid-cols-2 gap-3 max-w-md">
            <div className="card p-2.5 shadow-sm border border-sand hover:border-sandDark transition-all">
              <div className="h-28 rounded-lg overflow-hidden bg-paperDim relative">
                <img
                  src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80"
                  alt="Sennheiser HD 250BT"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs font-semibold text-ink mt-2 truncate">Sennheiser HD 250BT</p>
              <div className="flex items-center justify-between mt-1 text-xs">
                <span className="text-forest-700 font-bold">₹2,999</span>
                <span className="text-amber-600 flex items-center gap-0.5 font-medium">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 4.5
                </span>
              </div>
            </div>

            <div className="card p-2.5 shadow-sm border border-sand hover:border-sandDark transition-all">
              <div className="h-28 rounded-lg overflow-hidden bg-paperDim relative">
                <img
                  src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=80"
                  alt="Wildcraft Trailblazer Backpack"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs font-semibold text-ink mt-2 truncate">Wildcraft Backpack</p>
              <div className="flex items-center justify-between mt-1 text-xs">
                <span className="text-forest-700 font-bold">₹1,999</span>
                <span className="text-amber-600 flex items-center gap-0.5 font-medium">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 4.4
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Product Composition */}
        <div className="relative hidden lg:block h-[420px] w-full max-w-md mx-auto">
          {/* Top Card (Headphones) */}
          <div className="absolute top-4 right-2 w-64 card p-3.5 shadow-md border border-sandDark/60 rotate-3 hover:rotate-0 transition-all duration-300 z-10">
            <div className="h-36 rounded-lg overflow-hidden bg-paperDim relative">
              <img
                src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80"
                alt="Sennheiser HD 250BT"
                className="w-full h-full object-cover"
              />
              <span className="absolute top-2 left-2 bg-forest-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                Electronics
              </span>
            </div>
            <p className="text-sm font-semibold text-ink mt-3 truncate">Sennheiser HD 250BT</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-forest-700 font-bold text-sm">₹2,999</span>
              <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 4.5
              </div>
            </div>
          </div>

          {/* Bottom Card (Backpack) */}
          <div className="absolute bottom-4 left-2 w-64 card p-3.5 shadow-md border border-sandDark/60 -rotate-3 hover:rotate-0 transition-all duration-300 z-10">
            <div className="h-36 rounded-lg overflow-hidden bg-paperDim relative">
              <img
                src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=80"
                alt="Wildcraft Trailblazer Backpack"
                className="w-full h-full object-cover"
              />
              <span className="absolute top-2 left-2 bg-amber-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                Travel
              </span>
            </div>
            <p className="text-sm font-semibold text-ink mt-3 truncate">Wildcraft Trailblazer</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-forest-700 font-bold text-sm">₹1,999</span>
              <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 4.4
              </div>
            </div>
          </div>

          {/* AI Badge */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-2 bg-forest-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg border border-white/30 backdrop-blur-sm animate-pulse-subtle">
            <Sparkles className="h-4 w-4 text-amber-300" /> AI Picked
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 tear-divider">
        <h2 className="font-display font-semibold text-3xl text-ink text-center mb-12">How ShopGenie works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="card p-7 relative">
                <span className="absolute top-5 right-6 font-display font-semibold text-3xl text-sand">{step.number}</span>
                <div className="h-11 w-11 rounded-lg bg-forest-50 flex items-center justify-center mb-5">
                  <Icon className="h-5 w-5 text-forest-500" />
                </div>
                <h3 className="font-display font-semibold text-lg text-ink mb-2">{step.title}</h3>
                <p className="text-inkMuted text-sm leading-relaxed">{step.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 tear-divider">
        <div className="max-w-2xl mb-12">
          <h2 className="font-display font-semibold text-3xl text-ink mb-3">Built to act, not just chat</h2>
          <p className="text-inkMuted">
            A shopping agent that resolves requirements against the real catalog — locally, or through Gemini for richer conversations.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div key={idx} className="p-5 rounded-xl border border-sand hover:border-forest-400 transition-colors">
                <Icon className="h-6 w-6 text-forest-500 mb-4" />
                <h4 className="font-medium text-ink mb-1.5">{feat.title}</h4>
                <p className="text-inkMuted text-sm leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
