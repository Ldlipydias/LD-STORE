import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { loginWithGoogle } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag, ShieldCheck, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import metadata from '../../metadata.json';

interface HomeProps {
  user: User | null;
  isAdmin: boolean;
}

export default function Home({ user, isAdmin }: HomeProps) {
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-dismiss error after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

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
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/popup-blocked') {
        setError('O login foi interrompido. Verifique se o seu navegador não bloqueou o pop-up de login e tente novamente.');
        console.log('Login popup closed or blocked');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('Uma solicitação de login já está em andamento. Por favor, aguarde.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login com Google não está habilitado no Firebase Console. Ative-o em Authentication > Sign-in method.');
      } else if (err.code === 'auth/internal-error') {
        setError('Ocorreu um erro interno no Firebase. Verifique se as configurações do seu projeto estão corretas.');
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
    <div className="relative flex flex-col items-center justify-center min-h-[90vh] text-center space-y-16 overflow-hidden py-20">
      {/* Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] opacity-50" />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent" />
        
        {/* Floating Particles/Glows */}
        <motion.div 
          animate={{ 
            y: [0, -20, 0],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ duration: 5, repeat: Infinity }}
          className="absolute top-1/4 left-1/4 w-2 h-2 bg-purple-500 rounded-full blur-sm"
        />
        <motion.div 
          animate={{ 
            y: [0, 20, 0],
            opacity: [0.2, 0.5, 0.2]
          }}
          transition={{ duration: 7, repeat: Infinity, delay: 1 }}
          className="absolute top-1/3 right-1/4 w-3 h-3 bg-blue-500 rounded-full blur-sm"
        />
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs font-bold uppercase tracking-widest backdrop-blur-xl"
        >
          {error}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-12 flex flex-col items-center max-w-5xl"
      >
        <div className="relative group">
          <div className="absolute inset-0 bg-purple-500/20 blur-[80px] rounded-full group-hover:bg-purple-500/40 transition-all duration-1000" />
          <img 
            src="https://i.ibb.co/Ld56XhCf/Chat-GPT-Image-28-de-mar-de-2026-23-21-40.png" 
            alt={metadata.name} 
            className="h-64 md:h-96 w-auto object-contain relative z-10 drop-shadow-[0_0_60px_rgba(147,51,234,0.4)] hover:scale-105 transition-transform duration-1000"
            referrerPolicy="no-referrer"
          />
        </div>
        
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Sua Loja Digital Definitiva</span>
          </div>

          <h1 className="text-7xl md:text-[10rem] font-black tracking-tighter leading-[0.8] pro-gradient-text">
            O MELHOR DO <br />
            <span className="italic font-serif font-light lowercase text-purple-400">digital</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-gray-400 text-lg md:text-2xl font-medium tracking-tight leading-relaxed opacity-80">
            Descubra uma curadoria exclusiva de ferramentas, scripts e aplicativos premium para elevar seu nível.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        className="flex flex-col sm:flex-row gap-6"
      >
        <div className="flex flex-col sm:flex-row gap-6">
          <button
            onClick={() => navigate('/store')}
            className="pro-button pro-button-primary flex items-center gap-4 px-12 py-5 text-xl group"
          >
            <span>Acessar Catálogo</span>
            <ShoppingBag className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="pro-button pro-button-secondary flex items-center gap-4 px-12 py-5 text-xl"
            >
              <span>Painel Gestor</span>
              <ShieldCheck className="w-6 h-6" />
            </button>
          )}
        </div>
      </motion.div>

      <div className="w-full overflow-hidden py-12 border-y border-white/5 bg-white/[0.01]">
        <div className="flex gap-24 animate-marquee whitespace-nowrap px-12 w-max">
          {[
            "ENTREGA IMEDIATA", "SUPORTE 24/7", "PAGAMENTO SEGURO", 
            "PRODUTOS VERIFICADOS", "ATUALIZAÇÕES VITALÍCIAS",
            "ENTREGA IMEDIATA", "SUPORTE 24/7", "PAGAMENTO SEGURO",
            "PRODUTOS VERIFICADOS", "ATUALIZAÇÕES VITALÍCIAS"
          ].map((text, i) => (
            <span key={i} className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">
              {text}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-16 w-full max-w-6xl pt-12">
        {[
          { icon: ShieldCheck, title: "Segurança Total", desc: "Transações protegidas e criptografadas de ponta a ponta." },
          { icon: CheckCircle2, title: "Qualidade Garantida", desc: "Cada produto passa por uma análise técnica rigorosa." },
          { icon: Sparkles, title: "Novidades Diárias", desc: "Sempre à frente com os lançamentos mais quentes do mercado." }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 + i * 0.1 }}
            className="flex flex-col items-center gap-6 group"
          >
            <div className="w-20 h-20 rounded-[2rem] bg-white/[0.02] border border-white/5 flex items-center justify-center group-hover:bg-purple-500/10 group-hover:border-purple-500/20 transition-all duration-700 group-hover:rotate-6">
              <feature.icon className="w-10 h-10 text-purple-400" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-xl uppercase tracking-tighter text-white/90">{feature.title}</h3>
              <p className="text-gray-500 text-sm font-medium leading-relaxed max-w-[250px] mx-auto">{feature.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
