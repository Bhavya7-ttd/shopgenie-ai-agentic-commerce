import React, { useState } from 'react';
import { ShoppingBag, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage({ setCurrentPage, setPendingEmail, setPendingOtp, setIsDemoMode }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await register(form);
      setPendingEmail(form.email);
      if (res?.demo_mode && res?.demo_otp) {
        if (setPendingOtp) setPendingOtp(res.demo_otp);
        if (setIsDemoMode) setIsDemoMode(true);
      } else {
        if (setPendingOtp) setPendingOtp('');
        if (setIsDemoMode) setIsDemoMode(false);
      }
      setCurrentPage('otp');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Registration failed. Please try again.');
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
          <h1 className="font-display font-semibold text-2xl text-ink">Create your account</h1>
          <p className="text-sm text-inkMuted mt-1">Join ShopGenie to start shopping smarter</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-sm text-ember-600 bg-ember-50 border border-ember-100 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-inkMuted mb-1 block">Full Name</label>
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              required
              placeholder="Jane Doe"
              className="w-full px-3 py-2.5 rounded-lg bg-paper border border-sand text-ink placeholder-inkMuted/50 focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-inkMuted mb-1 block">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-lg bg-paper border border-sand text-ink placeholder-inkMuted/50 focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-inkMuted mb-1 block">Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="At least 6 characters"
              className="w-full px-3 py-2.5 rounded-lg bg-paper border border-sand text-ink placeholder-inkMuted/50 focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-inkMuted mb-1 block">Confirm Password</label>
            <input
              type="password"
              name="confirm_password"
              value={form.confirm_password}
              onChange={handleChange}
              required
              placeholder="Re-enter your password"
              className="w-full px-3 py-2.5 rounded-lg bg-paper border border-sand text-ink placeholder-inkMuted/50 focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500/30"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-forest-500 text-white font-medium hover:bg-forest-600 transition-colors disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Creating account...' : 'Register'}
          </button>

          <p className="text-center text-sm text-inkMuted">
            Already have an account?{' '}
            <button type="button" onClick={() => setCurrentPage('login')} className="text-forest-600 hover:text-forest-700 font-medium">
              Log in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
