import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { loadStripe } from '@stripe/stripe-js';
import { ShoppingCart, Download, ExternalLink, Sparkles, Filter, Loader2, Copy, Check, QrCode, Clock, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PixPaymentModal from '../components/PixPaymentModal';
import SupportModal from '../components/SupportModal';
import ProductDetailsModal from '../components/ProductDetailsModal';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

// Debug log to help identify if the key is being loaded correctly in Netlify
console.log('--- Stripe Debug Info ---');
console.log('VITE_STRIPE_PUBLISHABLE_KEY:', STRIPE_PUBLISHABLE_KEY ? 'Loaded (starts with ' + STRIPE_PUBLISHABLE_KEY.substring(0, 7) + '...)' : 'MISSING');
console.log('import.meta.env keys:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
console.log('-------------------------');

interface StoreProps {
  user: User;
}

export default function Store({ user }: StoreProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [userOrders, setUserOrders] = useState<string[]>([]);
  const [userPendingOrders, setUserPendingOrders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pixProduct, setPixProduct] = useState<any | null>(null);
  const [selectedProductDetails, setSelectedProductDetails] = useState<any | null>(null);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [unreadSupportMessages, setUnreadSupportMessages] = useState(0);

  useEffect(() => {
    fetchData();

    // Listen to unread support messages (most recent ticket)
    const q = query(
      collection(db, 'support_tickets'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const ticket = snapshot.docs[0].data();
        setUnreadSupportMessages(ticket.unreadByUser || 0);
      } else {
        setUnreadSupportMessages(0);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const prods = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
      setProducts(prods.docs.map(d => ({ id: d.id, ...d.data() })));

      const orders = await getDocs(query(
        collection(db, 'orders'),
        where('userId', '==', user.uid)
      ));
      
      const paid = orders.docs.filter(d => d.data().status === 'paid').map(d => d.data().productId);
      const pending = orders.docs.filter(d => d.data().status === 'pending').map(d => d.data().productId);
      
      setUserOrders(paid);
      setUserPendingOrders(pending);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (product: any) => {
    if (!STRIPE_PUBLISHABLE_KEY) {
      alert('Erro: Chave pública do Stripe não configurada. \n\nSe você está no Netlify: Adicione VITE_STRIPE_PUBLISHABLE_KEY nas "Environment Variables" do painel do Netlify e faça um novo Deploy.\n\nSe você está no AI Studio: Adicione nos Secrets.');
      return;
    }

    if (!stripePromise) {
      alert('Erro ao inicializar Stripe. Verifique sua chave pública.');
      return;
    }

    const stripe = await stripePromise;

    try {
      setError(null);
      setBuyingId(product.id);
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          productPrice: product.price,
          userId: user.uid,
          origin: window.location.origin
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar sessão de pagamento');
      }

      if (data.url) {
        // No AI Studio, abrir em nova aba é muito mais confiável no celular
        const win = window.open(data.url, '_blank');
        if (!win) {
          // Se o bloqueador de popups impedir, tentamos o redirecionamento direto como fallback
          window.location.href = data.url;
        }
      } else {
        throw new Error('URL de checkout não retornada pelo servidor. Verifique se a sua chave do Stripe tem permissão para "Checkout Sessions".');
      }
    } catch (error: any) {
      console.error('Stripe Error:', error);
      setError(error.message);
      alert(`Erro no Pagamento: ${error.message}`);
    } finally {
      setBuyingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 z-50 bg-red-500 text-white px-6 py-3 rounded-lg shadow-xl font-bold flex items-center gap-2"
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {error}
            <button onClick={() => setError(null)} className="ml-4 hover:opacity-70">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3">
            LOJA PREMIUM
            <Sparkles className="w-8 h-8 text-amber-400" />
          </h1>
          <p className="text-gray-400">Explore nossa coleção de aplicativos exclusivos.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {products.map((prod) => {
          const isPurchased = userOrders.includes(prod.id);
          const isPending = userPendingOrders.includes(prod.id);
          const isOutOfStock = (prod.stock || 0) <= 0;
          
          return (
            <motion.div
              key={prod.id}
              whileHover={{ scale: 1.02 }}
              className="group relative flex flex-col rounded-[2.5rem] bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden hover:border-purple-500/50 transition-all duration-300 shadow-2xl"
            >
              {/* Image Container - 16:9 and not cropped */}
              <div className="relative aspect-video overflow-hidden p-2 pb-0">
                <img
                  src={prod.imageUrl}
                  alt={prod.name}
                  className="w-full h-full object-contain rounded-[1.8rem] bg-black/40 group-hover:scale-105 transition-transform duration-500"
                />
                
                {isPurchased && (
                  <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg z-10">
                    ADQUIRIDO
                  </div>
                )}

                {isPending && !isPurchased && (
                  <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest shadow-lg z-10 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    EM ANÁLISE
                  </div>
                )}

                {isOutOfStock && !isPurchased && !isPending && (
                  <div className="absolute inset-2 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-[1.8rem]">
                    <div className="w-full bg-white/10 backdrop-blur-md py-2 flex items-center justify-center border-y border-white/20">
                      <span className="text-white text-[10px] font-black uppercase tracking-[0.3em] animate-flash">
                        ESGOTADO
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 pt-3 space-y-3 text-center">
                <div className="space-y-1">
                  <h3 className="text-sm font-black tracking-tight text-white uppercase flex items-center justify-center gap-2">
                    🎁 {prod.name}
                  </h3>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-black text-white tracking-tighter">
                    $ {prod.price.toFixed(2)}
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">À vista no Pix</p>
                </div>

                <div className="flex justify-center">
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <QrCode className="w-5 h-5 text-purple-400" />
                  </div>
                </div>

                {isPurchased ? (
                  <div className="flex gap-2">
                    <a
                      href={prod.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                    >
                      <Download className="w-4 h-4" />
                      BAIXAR
                    </a>
                  </div>
                ) : isPending ? (
                  <div className="py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black text-center uppercase tracking-widest">
                    Em Análise
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedProductDetails(prod)}
                    disabled={isOutOfStock}
                    className={`w-full py-4 rounded-2xl font-black text-[10px] transition-all flex items-center justify-center gap-2 shadow-xl uppercase tracking-[0.15em] ${
                      isOutOfStock 
                        ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-purple-600 to-purple-400 text-white hover:scale-[1.02] active:scale-95 shadow-purple-600/20'
                    }`}
                  >
                    COMPRAR AGORA
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {products.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <Filter className="w-12 h-12 text-gray-600 mx-auto" />
          <p className="text-gray-500 font-medium">Nenhum produto encontrado.</p>
        </div>
      )}

      {pixProduct && (
        <PixPaymentModal
          isOpen={!!pixProduct}
          onClose={() => setPixProduct(null)}
          product={pixProduct}
          userId={user.uid}
          userEmail={user.email}
          onSuccess={() => {
            fetchData();
            setPixProduct(null);
          }}
        />
      )}

      {selectedProductDetails && (
        <ProductDetailsModal
          isOpen={!!selectedProductDetails}
          onClose={() => setSelectedProductDetails(null)}
          product={selectedProductDetails}
          onBuy={(prod) => {
            setSelectedProductDetails(null);
            handleBuy(prod);
          }}
          onPix={(prod) => {
            setSelectedProductDetails(null);
            setPixProduct(prod);
          }}
        />
      )}

      {/* Floating Support Button */}
      <button
        onClick={() => setIsSupportOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-4 rounded-full bg-purple-600 text-white shadow-xl shadow-purple-500/30 hover:bg-purple-500 hover:scale-105 transition-all flex items-center justify-center group"
      >
        <MessageSquare className="w-6 h-6" />
        {unreadSupportMessages > 0 && (
          <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-black animate-pulse">
            {unreadSupportMessages}
          </span>
        )}
      </button>

      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        userId={user.uid}
        userEmail={user.email}
      />
    </div>
  );
}
