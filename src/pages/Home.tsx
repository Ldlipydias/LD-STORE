import { useState } from 'react';
import { User } from 'firebase/auth';
import { loginWithGoogle } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import metadata from '../../metadata.json';

interface HomeProps {
  user: User | null;
  isAdmin: boolean;
}

export default function Home({ user, isAdmin }: HomeProps) {
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError(null);
      await loginWithGoogle();
      navigate('/store');
    } catch (err: any) {
      console.error('Login error:', err);
      
      // Handle specific Firebase Auth errors
      if (err.code === 'auth/unauthorized-domain') {
        setError('Este domínio não está autorizado no Firebase. Adicione a URL atual nos "Domínios Autorizados" do Firebase Console.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, usually no need to show a big error message
        console.log('User closed the login popup');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('Uma solicitação de login já está em andamento. Por favor, aguarde.');
      } else if (err.message?.includes('INTERNAL ASSERTION FAILED')) {
        setError('Ocorreu um erro interno no Firebase Auth. Por favor, tente recarregar a página.');
      } else {
        setError('Erro ao fazer login: ' + (err.message || 'Erro desconhecido'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[80vh] text-center space-y-12 overflow-hidden">
      {/* Animated Glows */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />
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
        className="space-y-8 flex flex-col items-center"
      >
        <div className="relative group">
          <div className="absolute inset-0 bg-purple-500/30 blur-[40px] rounded-full group-hover:bg-purple-500/50 transition-colors duration-500" />
          <img 
            src="https://i.ibb.co/gLNrfByH/Chat-GPT-Image-20-de-mar-de-2026-23-30-58.png" 
            alt={metadata.name} 
            className="h-48 md:h-72 w-auto object-contain relative z-10 drop-shadow-[0_0_30px_rgba(147,51,234,0.4)]"
            referrerPolicy="no-referrer"
          />
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none">
          A MELHOR LOJA DE <br />
          <span className="bg-gradient-to-r from-purple-500 via-white to-purple-500 bg-clip-text text-transparent">
            APPS PREMIUM
          </span>
        </h1>
        
        <p className="max-w-2xl mx-auto text-gray-400 text-lg md:text-xl font-light">
          {metadata.description}
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
            disabled={loading}
            className="group relative px-12 py-4 rounded-2xl bg-white text-black font-black text-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.2)] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
            <span className="relative z-10">
              {loading ? 'Entrando...' : 'Entrar com Google'}
            </span>
            {loading ? (
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <ShoppingBag className="w-5 h-5 relative z-10" />
            )}
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-6">
            <button
              onClick={() => navigate('/store')}
              className="group relative px-12 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-purple-400 to-purple-600 bg-[length:200%_auto] text-white font-black text-lg hover:bg-[100%_center] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 shadow-[0_0_40px_rgba(147,51,234,0.4)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
              <span className="relative z-10">Ir para a Loja</span>
              <ShoppingBag className="w-5 h-5 relative z-10" />
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="group relative px-12 py-4 rounded-2xl bg-white text-black font-black text-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.2)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
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
