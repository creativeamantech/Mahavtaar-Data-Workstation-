import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Hexagon, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'EXECUTIVE' ? '/exec-dashboard' : '/dashboard');
    } catch {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* LEFT: Branding Panel (Desktop Only) */}
      <div className="hidden lg:flex w-[60%] bg-sidebar flex-col justify-center px-16 relative overflow-hidden animate-in fade-in slide-in-from-right-8 duration-700 ease-out fill-mode-both">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        <div className="z-10 max-w-lg">
          <div className="relative flex h-20 w-20 items-center justify-center text-accent mb-8">
            <Hexagon className="absolute inset-0 h-full w-full fill-accent/10 stroke-accent stroke-[1.5]" />
            <span className="z-10 font-sans text-4xl font-bold text-accent">M</span>
          </div>
          
          <h1 className="font-sans text-5xl font-extrabold tracking-tight text-white mb-4">
            MAHAVTAAR
          </h1>
          <h2 className="font-sans text-2xl font-medium tracking-widest text-white/50 uppercase mb-12">
            Ledger
          </h2>

          <div className="space-y-6">
            {[
              'Real-time recovery tracking',
              'City & team pivot reports',
              'Immutable audit trail',
              'Role-based access control'
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-4 text-white/80">
                <CheckCircle2 className="h-6 w-6 text-accent shrink-0" />
                <span className="font-sans text-lg">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Login Form (Mobile/Tablet Centered, Desktop Right) */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-background w-full lg:w-[40%] p-4">
        {/* Deep Field Elements - Hidden on extra small screens */}
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none hidden sm:block opacity-0 sm:opacity-100" />
        <div className="absolute bottom-1/4 -right-1/4 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[120px] pointer-events-none hidden sm:block opacity-0 sm:opacity-100" />
        
        {/* Mobile/Tablet Background Pattern */}
        <div className="absolute inset-0 lg:hidden opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        <div className="w-full max-w-[420px] z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
          <div className="mb-8 text-center flex flex-col items-center lg:hidden">
            <div className="relative flex h-14 w-14 items-center justify-center text-primary mb-4">
              <Hexagon className="absolute inset-0 h-full w-full fill-primary/10 stroke-primary stroke-[1.5]" />
              <span className="z-10 font-sans text-2xl font-bold text-primary">M</span>
            </div>
            <h1 className="font-sans text-2xl font-extrabold uppercase tracking-widest text-primary mb-1">
              Mahavtaar
            </h1>
            <h2 className="font-sans text-xs font-medium tracking-[0.3em] text-muted-foreground uppercase">
              Ledger
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="bg-card/50 backdrop-blur-md border border-border/50 shadow-xl rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            
            <div className="mb-8 hidden lg:block">
              <h3 className="text-2xl font-bold tracking-tight">Welcome back</h3>
              <p className="text-sm text-muted-foreground mt-1">Enter your credentials to access your account</p>
            </div>

            <div className="mb-5">
              <label className="mb-2 block font-sans text-xs font-bold uppercase tracking-widest text-muted-foreground">Name or Email</label>
              <input
                type="text"
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background/50 px-4 font-sans text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                placeholder="e.g. Aarti Sharma"
              />
            </div>
            
            <div className="mb-6">
              <label className="mb-2 block font-sans text-xs font-bold uppercase tracking-widest text-muted-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background/50 px-4 pr-11 font-sans text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            {error && (
              <div className="mb-5 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive font-medium flex items-center justify-center">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center rounded-md bg-primary font-sans text-sm font-bold uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : 'Authenticate'}
            </button>
                      
            <div className="mt-8 text-center">
              <p className="font-sans text-xs font-medium text-muted-foreground/60">
                Demo access: <span className="text-muted-foreground">admin@company.com</span> / <span className="text-muted-foreground">Admin@123</span>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
