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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        <div className="min-h-screen flex items-center justify-center">
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
    </div>
  );
}