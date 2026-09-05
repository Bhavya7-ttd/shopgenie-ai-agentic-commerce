import React, { useState } from 'react';
import { ShoppingBag, Sparkles, ShoppingCart, LogOut, User, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AUTH_NAV = [
  { id: 'dashboard', label: 'Shop' },
  { id: 'products', label: 'Products' },
  { id: 'agent', label: 'AI Assistant' },
  { id: 'deals', label: 'Deals' },
  { id: 'compare', label: 'Compare' },
];

export default function Navbar({ currentPage, setCurrentPage, cartCount, onLogout }) {
  const { isAuthenticated, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (page) => {
    setCurrentPage(page);
    setMobileOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-paper/95 backdrop-blur-sm border-b border-sand">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={() => go(isAuthenticated ? 'dashboard' : 'landing')} className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-md bg-forest-500 flex items-center justify-center">
              <ShoppingBag className="h-4.5 w-4.5 text-paper" strokeWidth={2.25} />
            </div>
            <span className="font-display font-semibold text-xl text-ink tracking-tight">ShopGenie</span>
          </button>

          {/* Nav links */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1">
              {AUTH_NAV.map((item) => {
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item.id)}
                    className={`relative flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'text-forest-600' : 'text-inkMuted hover:text-ink'
                    }`}
                  >
                    {item.id === 'agent' && <Sparkles className="h-3.5 w-3.5" />}
                    {item.label}
                    {isActive && <span className="absolute -bottom-[17px] left-3.5 right-3.5 h-0.5 bg-forest-500 rounded-full" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => go('cart')}
                  aria-label="Cart"
                  className={`relative p-2 rounded-lg border transition-colors ${
                    currentPage === 'cart'
                      ? 'border-forest-500 text-forest-600 bg-forest-50'
                      : 'border-sand text-inkMuted hover:text-ink hover:border-sandDark'
                  }`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 min-w-[18px] px-0.5 items-center justify-center rounded-full bg-ember-500 text-[10px] font-semibold text-white">
                      {cartCount}
                    </span>
                  )}
                </button>

                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-paperDim text-ink text-sm">
                  <User className="h-3.5 w-3.5 text-inkMuted" />
                  <span className="max-w-[110px] truncate">{user?.full_name || user?.email}</span>
                </div>

                <button
                  onClick={onLogout}
                  title="Log out"
                  className="hidden sm:flex p-2 rounded-lg text-inkMuted hover:text-ember-600 transition-colors"
                >
                  <LogOut className="h-4.5 w-4.5" />
                </button>

                <button
                  onClick={() => setMobileOpen((v) => !v)}
                  className="md:hidden p-2 rounded-lg text-inkMuted hover:text-ink"
                  aria-label="Menu"
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => go('login')}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium text-inkMuted hover:text-ink transition-colors"
                >
                  Log in
                </button>
                <button
                  onClick={() => go('register')}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-forest-500 text-white hover:bg-forest-600 transition-colors"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        {isAuthenticated && mobileOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-1 border-t border-sand pt-3">
            {[...AUTH_NAV, { id: 'cart', label: `Cart (${cartCount})` }].map((item) => (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`text-left px-2 py-2.5 rounded-lg text-sm font-medium ${
                  currentPage === item.id ? 'text-forest-600 bg-forest-50' : 'text-inkMuted'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button onClick={onLogout} className="text-left px-2 py-2.5 rounded-lg text-sm font-medium text-ember-600">
              Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
