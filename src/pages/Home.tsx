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

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
      navigate('/store');
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-12">
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
            className="px-12 py-4 rounded-2xl bg-white text-black font-bold text-lg hover:bg-gray-200 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            Entrar com Google
            <ShoppingBag className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => navigate('/store')}
              className="px-12 py-4 rounded-2xl bg-purple-600 text-white font-bold text-lg hover:bg-purple-500 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 shadow-[0_0_30px_rgba(147,51,234,0.3)]"
            >
              Ir para a Loja
              <ShoppingBag className="w-5 h-5" />
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="px-12 py-4 rounded-2xl bg-amber-500 text-black font-bold text-lg hover:bg-amber-400 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 shadow-[0_0_30px_rgba(245,158,11,0.3)]"
              >
                Painel Administrativo
                <ShieldCheck className="w-5 h-5" />
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
