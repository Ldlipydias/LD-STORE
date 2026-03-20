import { useState } from 'react';
import { User } from 'firebase/auth';
import { loginWithGoogle } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

interface HomeProps {
  user: User | null;
  isAdmin: boolean;
}

export default function Home({ user, isAdmin }: HomeProps) {
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setError(null);
      await loginWithGoogle();
      navigate('/store');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setError('Este domínio não está autorizado no Firebase. Adicione a URL do Netlify nos "Domínios Autorizados" do Firebase Console.');
      } else {
        setError('Erro ao fazer login: ' + (err.message || 'Erro desconhecido'));
      }
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[80vh] text-center space-y-12 overflow-hidden">
      {/* Pentagon Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-black" />
        <svg width="100%" height="100%" className="opacity-20 blur-[2px]">
          <defs>
            <pattern id="pentagons" width="120" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
              <path
                d="M60 10 L110 45 L90 105 L30 105 L10 45 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-purple-500/40"
              />
              <circle cx="60" cy="60" r="2" className="fill-purple-500/20" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pentagons)" />
        </svg>
        {/* Animated Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black" />
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl bg-red-500/20 border border-red-500/50 text-red-200 text-sm max-w-md backdrop-blur-xl"
        >
          {error}
        </motion.div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-6"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          Bem-vindo à LD STORE
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none">
          A MELHOR LOJA DE <br />
          <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 bg-clip-text text-transparent">
            APPS PREMIUM
          </span>
        </h1>
        
        <p className="max-w-2xl mx-auto text-gray-400 text-lg md:text-xl font-light">
          Acesse os melhores aplicativos e conteúdos digitais com segurança e exclusividade. 
          Pagamento rápido via Stripe e entrega imediata.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        {!user ? (
          <button
            onClick={handleLogin}
            className="group relative px-12 py-4 rounded-2xl bg-white text-black font-black text-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.2)] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
            <span className="relative z-10">Entrar com Google</span>
            <ShoppingBag className="w-5 h-5 relative z-10" />
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-6">
            <button
              onClick={() => navigate('/store')}
              className="group relative px-12 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-[length:200%_auto] text-white font-black text-lg hover:bg-[100%_center] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 shadow-[0_0_40px_rgba(147,51,234,0.4)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
              <span className="relative z-10">Ir para a Loja</span>
              <ShoppingBag className="w-5 h-5 relative z-10" />
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="group relative px-12 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 bg-[length:200%_auto] text-black font-black text-lg hover:bg-[100%_center] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 shadow-[0_0_40px_rgba(245,158,11,0.4)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
                <span className="relative z-10">Painel Administrativo</span>
                <ShieldCheck className="w-5 h-5 relative z-10" />
              </button>
            )}
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl pt-12">
        {[
          { icon: ShieldCheck, title: "Seguro", desc: "Pagamentos via Stripe" },
          { icon: CheckCircle2, title: "Verificado", desc: "Produtos de qualidade" },
          { icon: Sparkles, title: "Premium", desc: "Conteúdo exclusivo" }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center gap-3"
          >
            <feature.icon className="w-8 h-8 text-purple-400" />
            <h3 className="font-bold text-lg">{feature.title}</h3>
            <p className="text-gray-500 text-sm">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
