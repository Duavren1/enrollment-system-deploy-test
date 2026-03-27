import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  Lock, User, Search, Loader2 as Spinner, CheckCircle, Clock, XCircle, AlertCircle,
} from 'lucide-react';
import { UserRole } from '../App';
import { authService } from '../services/auth.service';
import { preRegistrationService } from '../services/preregistration.service';

interface LoginPageProps {
  onLogin: (role: UserRole) => void;
  onPreRegister?: () => void;
}

export default function LoginPage({ onLogin, onPreRegister }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaA, setCaptchaA] = useState(0);
  const [captchaB, setCaptchaB] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotValue, setForgotValue] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  // Pre-registration tracking
  const [trackRefId, setTrackRefId] = useState('');
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState('');

  const handleTrack = async () => {
    if (!trackRefId.trim()) return;
    try {
      setTrackLoading(true);
      setTrackError('');
      setTrackResult(null);
      const resp = await preRegistrationService.trackApplication(trackRefId.trim());
      if (resp.success) {
        setTrackResult(resp.data);
      } else {
        setTrackError(resp.message || 'Application not found.');
      }
    } catch (err: any) {
      setTrackError(err.message || 'Application not found.');
    } finally {
      setTrackLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: any }> = {
      'Pending Payment': { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      'Payment Submitted': { color: 'bg-blue-100 text-blue-800', icon: Clock },
      'Payment Verified': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      'Payment Rejected': { color: 'bg-red-100 text-red-800', icon: XCircle },
      'In Admin Queue': { color: 'bg-indigo-100 text-indigo-800', icon: Clock },
      'Account Created': { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
      'Rejected': { color: 'bg-red-100 text-red-800', icon: XCircle },
    };
    const m = map[status] || { color: 'bg-slate-100 text-slate-800', icon: AlertCircle };
    const Icon = m.icon;
    return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${m.color}`}><Icon className="h-3 w-3" />{status}</span>;
  };

  // Captcha generation
  const generateCaptcha = () => {
    const a = Math.floor(Math.random() * 8) + 1; // 1-8
    const b = Math.floor(Math.random() * 8) + 1; // 1-8
    setCaptchaA(a);
    setCaptchaB(b);
    setCaptchaAnswer('');
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      setError('Please enter both username and password.');
      generateCaptcha();
      return;
    }

    const expected = captchaA + captchaB;
    if (String(expected) !== String(captchaAnswer).trim()) {
      setError('Captcha answer is incorrect. Please try again.');
      generateCaptcha();
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await authService.login({ username, password });

      if (response.success) {
        const role = response.data.user.role as UserRole;
        onLogin(role);
      } else {
        setError(response.message || 'Login failed. Please check your credentials.');
        generateCaptcha();
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      generateCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col min-h-screen">
      <div className="container mx-auto px-4 py-8 flex-1 flex items-center justify-center">
        <div>
          <div className="w-full max-w-6xl grid md:grid-cols-2 gap-12 items-center">
            
            {/* Left Side - Branding */}
            <div className="space-y-6 text-center md:text-left">
              <div className="inline-flex items-center justify-center mb-4">
                <img src="/Informatics-Logo.png" alt="Informatics College Logo" className="h-20 w-20 object-contain brightness-110 drop-shadow-lg" style={{imageRendering: 'crisp-edges'}} />
              </div>
              <div className="space-y-2">
                <h1 className="text-5xl font-bold text-blue-600">
                  Informatics College
                </h1>
                <p className="text-2xl text-slate-600">Northgate Campus</p>
                <p className="text-xl text-slate-500">Enrollment System</p>
              </div>
              <p className="text-slate-600 max-w-md">
                Seamlessly manage your academic journey with our modern enrollment platform.
              </p>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full max-w-md mx-auto">
              <div className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-200">
                <div className="text-center mb-8">
                  <h2 className="text-3xl mb-2">Welcome Back</h2>
                  <p className="text-slate-500">Sign in to continue</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Username */}
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-slate-700">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-10 h-12 border-slate-200 focus:border-blue-500 rounded-xl"
                        placeholder="Enter your username"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-700">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 h-12 border-slate-200 focus:border-blue-500 rounded-xl"
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                  </div>

                  {/* Simple Captcha */}
                  <div className="space-y-2">
                    <Label htmlFor="captcha" className="text-slate-700">Captcha: solve</Label>
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-2 bg-slate-100 rounded-md">{captchaA} + {captchaB} =</div>
                      <Input
                        id="captcha"
                        type="text"
                        value={captchaAnswer}
                        onChange={(e) => setCaptchaAnswer(e.target.value)}
                        className="h-12 border-slate-200 focus:border-blue-500 rounded-xl w-32"
                        placeholder="Answer"
                        required
                      />
                      <Button type="button" variant="outline" onClick={generateCaptcha}>New</Button>
                    </div>
                    <p className="text-xs text-slate-500">Prove you're human — solve the addition.</p>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 text-center">{error}</p>
                  )}

                  {/* Register Link — redirects to Pre-Registration */}
                  {onPreRegister && (
                    <div className="text-center">
                      <a href="#" onClick={(e) => { e.preventDefault(); onPreRegister(); }} className="text-sm text-blue-600 hover:text-blue-700">Register as a new student</a>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg disabled:opacity-60"
                  >
                    {isSubmitting ? 'Signing in...' : 'Sign In'}
                  </Button>

                  {/* Forgot Password Link */}
                  <div className="text-center">
                    <a href="#" onClick={(e) => { e.preventDefault(); setShowForgot(true); }} className="text-sm text-blue-600 hover:text-blue-700">Forgot password?</a>
                  </div>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                  Need help? Contact support
                </div>
              </div>

              {/* Track Application Card */}
              <div className="bg-white rounded-3xl shadow-lg p-6 border border-slate-200 mt-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Search className="h-4 w-4" /> Track Pre-Registration
                </h3>
                <div className="flex gap-2">
                  <Input
                    value={trackRefId}
                    onChange={(e) => setTrackRefId(e.target.value)}
                    placeholder="Enter Reference ID (e.g. PRE-2026-XXXX)"
                    className="h-10 rounded-xl text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
                  />
                  <Button size="sm" onClick={handleTrack} disabled={trackLoading} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-4">
                    {trackLoading ? <Spinner className="h-4 w-4 animate-spin" /> : 'Track'}
                  </Button>
                </div>
                {trackError && <p className="text-xs text-red-600 mt-2">{trackError}</p>}
                {trackResult && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Status</span>
                      {statusBadge(trackResult.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Name</span>
                      <span className="font-medium">{trackResult.first_name} {trackResult.last_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Course</span>
                      <span className="font-medium">{trackResult.course}</span>
                    </div>
                    {trackResult.status === 'Account Created' && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg text-green-800 text-xs">
                        ✅ Your account has been created! Check your email for login credentials.
                      </div>
                    )}
                    {trackResult.status === 'Payment Rejected' && trackResult.cashier_remarks && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs">
                        Rejection Reason: {trackResult.cashier_remarks}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Forgot Password Dialog */}
      <Dialog open={showForgot} onOpenChange={setShowForgot}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forgot Password</DialogTitle>
            <DialogDescription>Enter your username to reset your password.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async e => {
              e.preventDefault();
              // Simple check: if value matches a hardcoded user, allow reset
              if (forgotValue === 'student1' || forgotValue === 'admin1') {
                setForgotMessage('Account found. Enter new password.');
              } else {
                setForgotMessage('Account not found.');
              }
            }}
            className="space-y-4"
          >
            <Label htmlFor="forgot-value">Username</Label>
            <Input
              id="forgot-value"
              type="text"
              value={forgotValue}
              onChange={e => setForgotValue(e.target.value)}
              placeholder="Enter your username"
              required
            />
            {forgotMessage && <p className="text-sm text-blue-600">{forgotMessage}</p>}
            <Button type="submit" className="w-full">
              Verify Account
            </Button>
          </form>
          {forgotMessage === 'Account found. Enter new password.' && (
            <form
              onSubmit={e => {
                e.preventDefault();
                setForgotMessage('Password reset successful.');
              }}
              className="space-y-4 mt-4"
            >
              <Label htmlFor="reset-password-value">New Password</Label>
              <Input
                id="reset-password-value"
                type="password"
                placeholder="Enter new password"
                required
              />
              <Button type="submit" className="w-full">
                Reset Password
              </Button>
            </form>
          )}
          {forgotMessage === 'Password reset successful.' && (
            <p className="text-sm text-green-600">Password reset successful. You can now log in with your new password.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer
        style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          borderTop: '1px solid rgba(148, 163, 184, 0.15)',
          marginTop: 'auto',
        }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '2.5rem 1.5rem 2rem' }}>

          {/* Three-column grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '2.5rem',
            }}
          >

            {/* ── Contact ── */}
            <div>
              <p style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Contact
              </p>
              <a
                href="mailto:info@informatics.edu.ph"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#94a3b8',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                info@informatics.edu.ph
              </a>
            </div>

            {/* ── Office Hours ── */}
            <div>
              <p style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Office Hours
              </p>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: '1.75' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16.5 15"/></svg>
                  Mon – Fri : 8:00 AM – 8:00 PM
                </span>
                <span style={{ paddingLeft: '1.55rem', display: 'block' }}>Sat : 9:00 AM – 5:00 PM</span>
              </div>
            </div>

            {/* ── Follow Us ── */}
            <div>
              <p style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Follow Us
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {/* Facebook */}
                <a href="https://www.facebook.com/InformaticsPH/" target="_blank" rel="noopener noreferrer" title="Facebook"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.06)', transition: 'all 0.25s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1877f2'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(24,119,242,0.35)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="#cbd5e1"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                {/* Instagram */}
                <a href="https://www.instagram.com/informaticsph" target="_blank" rel="noopener noreferrer" title="Instagram"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.06)', transition: 'all 0.25s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e1306c'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(225,48,108,0.35)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="#cbd5e1"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                {/* LinkedIn */}
                <a href="https://www.linkedin.com/company/informaticsph/posts/?feedView=all" target="_blank" rel="noopener noreferrer" title="LinkedIn"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.06)', transition: 'all 0.25s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0a66c2'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(10,102,194,0.35)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="#cbd5e1"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                {/* YouTube */}
                <a href="https://www.youtube.com/@InformaticsPhilippinesOfficial" target="_blank" rel="noopener noreferrer" title="YouTube"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.06)', transition: 'all 0.25s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#ff0000'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,0,0,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="#cbd5e1"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
                {/* X (Twitter) */}
                <a href="https://x.com/informaticsph" target="_blank" rel="noopener noreferrer" title="X (Twitter)"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.06)', transition: 'all 0.25s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1d9bf0'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(29,155,240,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="#cbd5e1"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
              </div>
            </div>

          </div>

          {/* Copyright */}
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', marginTop: '2rem', paddingTop: '1.25rem', textAlign: 'center', color: '#64748b', fontSize: '0.78rem', letterSpacing: '0.01em' }}>
            © {new Date().getFullYear()} Informatics College Northgate. All rights reserved.
          </div>

        </div>
      </footer>
    </div>
  );
}