import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, User, AlertCircle, Eye, EyeOff, Shield, Crosshair } from 'lucide-react';
import chevlaLogo from '@/assets/chevla-logo.webp';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message || 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  if (user) return null;

  return (
    <div className="min-h-screen warzone-bg flex items-center justify-center p-4 relative overflow-hidden scanline-overlay">
      {/* War-zone ambient glows */}
      <div className="absolute top-1/4 -left-40 w-[500px] h-[500px] bg-red-600/8 rounded-full blur-[150px] war-orb-1" />
      <div className="absolute bottom-1/3 -right-40 w-[400px] h-[400px] bg-orange-600/6 rounded-full blur-[120px] war-orb-2" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-900/5 rounded-full blur-[180px] war-orb-3" />

      {/* Grid overlay */}
      <div className="absolute inset-0 grid-pattern opacity-30" />

      {/* Decorative crosshairs */}
      <div className="absolute top-20 right-20 text-red-500/10 hidden lg:block">
        <Crosshair className="w-32 h-32" strokeWidth={0.5} />
      </div>
      <div className="absolute bottom-20 left-20 text-red-500/8 hidden lg:block">
        <Shield className="w-24 h-24" strokeWidth={0.5} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo — war edition */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-white/95 rounded-2xl px-5 py-3 shadow-lg shadow-red-900/20 mb-5 ring-1 ring-white/20">
            <img src={chevlaLogo} alt="Chevla" className="h-12 w-auto" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">
            PROSPECTOR
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-red-500/50" />
            <p className="text-sm font-bold text-red-400/60 uppercase tracking-[0.25em]">Central de Comando</p>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-red-500/50" />
          </div>
        </div>

        {/* Glass Form Card — dark warfare */}
        <div className="bg-white/[0.04] backdrop-blur-2xl rounded-2xl border border-white/[0.08] p-8 shadow-2xl shadow-black/40 relative overflow-hidden">
          {/* Top border glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center border border-red-500/20">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Acesso Restrito</h2>
              <p className="text-sm text-gray-500 uppercase tracking-wider">Autenticação requerida</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm animate-slide-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Identificação</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Seu nome de operador"
                  className="w-full pl-12 pr-5 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 outline-none transition-all text-base"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Senha de Acesso</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 outline-none transition-all text-base font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-600 hover:text-gray-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-white rounded-lg font-bold text-base uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #FF1744 0%, #D50000 100%)',
                boxShadow: '0 0 30px rgba(255,23,68,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Iniciar Sessão
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
            <p className="text-xs text-gray-600 text-center font-mono">
              Sistema protegido · Acesso autorizado apenas
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-600 text-center mt-6 font-mono">
          CHEVLA &copy; {new Date().getFullYear()} — SISTEMA RESTRITO
        </p>
      </div>
    </div>
  );
}
