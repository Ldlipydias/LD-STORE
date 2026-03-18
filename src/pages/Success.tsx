import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { CheckCircle2, Download, Home, Loader2, ShoppingBag, Copy, Check, ExternalLink, Globe } from 'lucide-react';
import { motion } from 'motion/react';

interface SuccessProps {
  user: User;
}

export default function Success({ user }: SuccessProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [product, setProduct] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const sessionId = searchParams.get('session_id');
  const productId = searchParams.get('product_id');

  useEffect(() => {
    if (!sessionId || !productId) {
      navigate('/store');
      return;
    }

    if (!user) return;

    const verifyAndSave = async () => {
      try {
        // 1. Verify session with server
        const response = await fetch(`/api/verify-session/${sessionId}`);
        const data = await response.json();

        if (data.status === 'paid') {
          // 2. Check if order already exists
          const ordersRef = collection(db, 'orders');
          const q = query(
            ordersRef, 
            where('stripeSessionId', '==', sessionId),
            where('userId', '==', user.uid)
          );
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            // 3. Save order to Firestore
            await addDoc(ordersRef, {
              userId: user.uid,
              productId,
              stripeSessionId: sessionId,
              status: 'paid',
              createdAt: new Date().toISOString()
            });

            // 3.1 Decrement stock
            const productRef = doc(db, 'products', productId);
            const productSnap = await getDocs(query(collection(db, 'products'), where('__name__', '==', productId)));
            if (!productSnap.empty) {
              const currentStock = productSnap.docs[0].data().stock || 0;
              if (currentStock > 0) {
                await updateDoc(productRef, { stock: currentStock - 1 });
              }
            }
          }

          // 4. Fetch product info
          const productSnap = await getDocs(query(collection(db, 'products'), where('__name__', '==', productId)));
          if (!productSnap.empty) {
            setProduct({ id: productSnap.docs[0].id, ...productSnap.docs[0].data() });
          }

          setStatus('success');
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error(error);
        setStatus('error');
      }
    };

    verifyAndSave();
  }, [sessionId, productId, user, navigate]);

  const isDownloadable = (url: string) => {
    const fileExtensions = ['.zip', '.apk', '.pdf', '.rar', '.exe', '.dmg', '.ipa', '.txt', '.mp4', '.mp3'];
    return fileExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
        <p className="text-gray-400 font-medium animate-pulse">Processando seu pagamento...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-3xl font-bold">Ops! Algo deu errado.</h1>
        <p className="text-gray-400 max-w-md">Não conseguimos confirmar seu pagamento. Se houve cobrança, entre em contato com o suporte.</p>
        <Link to="/store" className="px-8 py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-colors">
          Voltar para a Loja
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center"
      >
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
      </motion.div>

      <div className="space-y-4">
        <h1 className="text-4xl font-black tracking-tighter">PAGAMENTO APROVADO!</h1>
        <p className="text-gray-400">Obrigado pela sua compra. Seu produto já está disponível.</p>
      </div>

      {product && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-lg space-y-4"
        >
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 flex items-center gap-6 text-left">
            <img src={product.imageUrl} alt={product.name} className="w-24 h-24 object-cover rounded-2xl" />
            <div className="flex-1">
              <h3 className="font-bold text-xl">{product.name}</h3>
              <p className="text-gray-500 text-sm line-clamp-2">{product.description}</p>
            </div>
          </div>

          <div className="p-8 rounded-3xl bg-purple-500/5 border border-purple-500/20 space-y-6 text-left">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Globe className="w-4 h-4" />
                LINK DE ACESSO / DOWNLOAD
              </h4>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black">LIBERADO</span>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Copie e cole o link abaixo no seu navegador:
              </p>
              <div className="relative group">
                <div className="w-full p-5 rounded-2xl bg-black/50 border border-white/10 font-mono text-sm break-all pr-14 text-purple-300 leading-relaxed shadow-inner">
                  {product.downloadUrl}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(product.downloadUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-all shadow-lg active:scale-90"
                  title="Copiar Link"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(product.downloadUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white text-black font-black text-sm hover:bg-gray-200 transition-all shadow-xl active:scale-95"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                {copied ? 'LINK COPIADO!' : 'COPIAR LINK AGORA'}
              </button>

              <a
                href={product.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm hover:bg-white/10 transition-all active:scale-95"
              >
                <ExternalLink className="w-5 h-5" />
                ABRIR LINK
              </a>
            </div>
            
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-[11px] text-amber-200/70 text-center leading-relaxed">
                <strong>Atenção:</strong> Se o download não iniciar automaticamente ao clicar em "Abrir Link", utilize o botão <strong>"Copiar Link Agora"</strong> e cole manualmente na barra de endereços do seu navegador (Chrome, Safari, etc).
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <Link to="/store" className="flex items-center gap-2 px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors">
          <ShoppingBag className="w-5 h-5" />
          Continuar Comprando
        </Link>
        <Link to="/" className="flex items-center gap-2 px-8 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 transition-colors">
          <Home className="w-5 h-5" />
          Ir para Início
        </Link>
      </div>
    </div>
  );
}
