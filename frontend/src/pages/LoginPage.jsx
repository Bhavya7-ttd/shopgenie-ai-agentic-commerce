import React, { useState } from 'react';
import { ShoppingBag, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ setCurrentPage }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      setCurrentPage('dashboard');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-11 w-11 rounded-xl bg-forest-500 flex items-center justify-center mb-3">
            <ShoppingBag className="h-5.5 w-5.5 text-white" />
          </div>
          <h1 className="font-display font-semibold text-2xl text-ink">Welcome back</h1>
          <p className="text-sm text-inkMuted mt-1">Log in to continue to ShopGenie</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-sm text-ember-600 bg-ember-50 border border-ember-100 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-inkMuted mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-lg bg-paper border border-sand text-ink placeholder-inkMuted/50 focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-inkMuted mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Your password"
              className="w-full px-3 py-2.5 rounded-lg bg-paper border border-sand text-ink placeholder-inkMuted/50 focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500/30"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-forest-500 text-white font-medium hover:bg-forest-600 transition-colors disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Logging in...' : 'Log in'}
          </button>

          <p className="text-center text-sm text-inkMuted">
            Don't have an account?{' '}
            <button type="button" onClick={() => setCurrentPage('register')} className="text-forest-600 hover:text-forest-700 font-medium">
              Sign up
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
