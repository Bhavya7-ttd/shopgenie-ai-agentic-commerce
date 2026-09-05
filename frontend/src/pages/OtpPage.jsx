import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  const maskedName = name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  return `${maskedName}@${domain}`;
}

export default function OtpPage({ setCurrentPage, pendingEmail, pendingOtp, setPendingOtp, isDemoMode = true }) {
  const { verifyOtp, resendOtp } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await verifyOtp({ email: pendingEmail, otp });
      setCurrentPage('login');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError('');
    setInfo('');
    setResending(true);
    try {
      const data = await resendOtp({ email: pendingEmail });
      if (data?.demo_mode && data?.demo_otp) {
        if (setPendingOtp) setPendingOtp(data.demo_otp);
        setInfo(`Demo Mode: Email delivery is not configured. Your new OTP is ${data.demo_otp}`);
      } else {
        setInfo('A new 6-digit verification code has been sent to your email address.');
      }
      setCooldown(30);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not resend OTP.');
    } finally {
      setResending(false);
    }
  };

  if (!pendingEmail) {
    return (
      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-inkMuted mb-4">No pending verification found.</p>
          <button onClick={() => setCurrentPage('register')} className="text-forest-600 hover:text-forest-700 font-medium">
            Go to Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-11 w-11 rounded-xl bg-forest-500 flex items-center justify-center mb-3">
            <ShieldCheck className="h-5.5 w-5.5 text-white" />
          </div>
          <h1 className="font-display font-semibold text-2xl text-ink">Verify your account</h1>
          <p className="text-sm text-inkMuted mt-1 text-center">
            Enter the 6-digit code sent to <span className="text-ink font-medium" title={pendingEmail}>{maskEmail(pendingEmail)}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {isDemoMode && (
            <div className="text-sm bg-forest-50 border border-forest-200 text-forest-800 rounded-xl p-4 space-y-1 text-center">
              <div className="font-semibold text-xs tracking-wider uppercase text-forest-700">Demo Mode Active</div>
              <div className="text-base font-mono font-bold text-forest-900 tracking-wider">
                Demo OTP: <span className="underline decoration-forest-400">{pendingOtp || 'Check Backend Console'}</span>
              </div>
              <p className="text-xs text-forest-600">Enter this code below to verify your account without an SMTP email server.</p>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-sm text-ember-600 bg-ember-50 border border-ember-100 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="flex items-start gap-2 text-sm text-forest-600 bg-forest-50 border border-forest-100 rounded-lg px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{info}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-inkMuted mb-1 block">OTP Code</label>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              inputMode="numeric"
              placeholder="123456"
              className="w-full px-3 py-2.5 rounded-lg bg-paper border border-sand text-ink placeholder-inkMuted/40 tracking-[0.3em] text-center text-lg focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500/30"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-forest-500 text-white font-medium hover:bg-forest-600 transition-colors disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Verifying...' : 'Verify'}
          </button>

          <p className="text-center text-sm text-inkMuted">
            Didn't get a code?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="text-forest-600 hover:text-forest-700 font-medium disabled:opacity-60"
            >
              {resending ? 'Resending...' : cooldown > 0 ? `Resend OTP (${cooldown}s)` : 'Resend OTP'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
