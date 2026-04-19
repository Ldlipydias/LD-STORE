import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { useParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { ShoppingCart, Download, ExternalLink, Sparkles, Filter, Loader2, Copy, Check, QrCode, Clock, MessageSquare, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PixPaymentModal from '../components/PixPaymentModal';
import SupportModal from '../components/SupportModal';
import ProductDetailsModal from '../components/ProductDetailsModal';
import BannerCarousel from '../components/BannerCarousel';
import { loginWithGoogle } from '../firebase';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

// Debug log to help identify if the key is being loaded correctly in Netlify
console.log('--- Stripe Debug Info ---');
console.log('VITE_STRIPE_PUBLISHABLE_KEY:', STRIPE_PUBLISHABLE_KEY ? 'Loaded (starts with ' + STRIPE_PUBLISHABLE_KEY.substring(0, 7) + '...)' : 'MISSING');
console.log('import.meta.env keys:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
console.log('-------------------------');

interface StoreProps {
  user: User | null;
}

export default function Store({ user }: StoreProps) {
  const { id: urlProductId } = useParams();
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
  const [topBuyers, setTopBuyers] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);

  // Load pending PIX product from localStorage on mount
  useEffect(() => {
    const savedPixProduct = localStorage.getItem('pending_pix_product');
    if (savedPixProduct) {
      try {
        setPixProduct(JSON.parse(savedPixProduct));
      } catch (e) {
        console.error('Error parsing saved pix product:', e);
        localStorage.removeItem('pending_pix_product');
      }
    }
    
    // Listen for Top Buyers (Wall of Fame)
    let unsubscribeWallOfFame: (() => void) | null = null;
    let isMounted = true;
    
    import('firebase/firestore').then(({ doc, onSnapshot }) => {
      if (!isMounted) return;
      unsubscribeWallOfFame = onSnapshot(doc(db, 'settings', 'wallOfFame'), (docSnap) => {
        if (docSnap.exists() && docSnap.data().list) {
          setTopBuyers(docSnap.data().list);
        }
      }, (err) => console.error("Top buyers error:", err));
    });

    return () => {
      isMounted = false;
      if (unsubscribeWallOfFame) unsubscribeWallOfFame();
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (user) {
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
      }, (err) => console.error("Store support messages snapshot error:", err));

      return () => unsubscribe();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const prods = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
      const productsList = prods.docs.map(d => ({ id: d.id, ...d.data() }));
      setProducts(productsList);

      if (urlProductId) {
        const productFromUrl = productsList.find(p => p.id === urlProductId);
        if (productFromUrl) {
          setSelectedProductDetails(productFromUrl);
        }
      }

      if (user) {
        const orders = await getDocs(query(
          collection(db, 'orders'),
          where('userId', '==', user.uid)
        ));
        
        const paid = orders.docs.filter(d => d.data().status === 'paid').map(d => d.data().productId);
        const pending = orders.docs.filter(d => d.data().status === 'pending').map(d => d.data().productId);
        
        setUserOrders(paid);
        setUserPendingOrders(pending);
      } else {
        setUserOrders([]);
        setUserPendingOrders([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (product: any) => {
    if (!user) {
      try {
        await loginWithGoogle();
        return; // After login, they can click again
      } catch (error) {
        console.error('Login error:', error);
        return;
      }
    }

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
          origin: window.location.origin,
          appliedCoupon: product.appliedCoupon || null,
          originalPrice: product.originalPrice || null
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

  const handlePix = async (product: any) => {
    if (!user) {
      // Save product to localStorage before login redirect/popup
      localStorage.setItem('pending_pix_product', JSON.stringify(product));
      try {
        await loginWithGoogle();
        return;
      } catch (error) {
        console.error('Login error:', error);
        return;
      }
    }
    setPixProduct(product);
    localStorage.setItem('pending_pix_product', JSON.stringify(product));
  };

  const handleSupport = async () => {
    if (!user) {
      try {
        await loginWithGoogle();
        return;
      } catch (error) {
        console.error('Login error:', error);
        return;
      }
    }
    setIsSupportOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-16 pb-32">
      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-4 z-40">
        <button
          onClick={handleSupport}
          className="relative p-4 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 hover:scale-110 active:scale-95 transition-all group"
        >
          {unreadSupportMessages > 0 && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-black animate-pulse">
              {unreadSupportMessages}
            </div>
          )}
          <MessageSquare className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-6 z-50 bg-red-500/10 border border-red-500/20 backdrop-blur-xl text-red-200 px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3"
          >
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs uppercase tracking-widest">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 hover:opacity-70 text-lg">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      <BannerCarousel />

      {topBuyers.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-500 to-purple-700">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-white/90">Destaques do Mês</h2>
              <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Os maiores compradores da plataforma</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {topBuyers.map((buyer, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-black/40 border border-purple-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 group hover:border-purple-500/50 hover:bg-purple-500/10 transition-colors shadow-lg shadow-purple-500/5"
              >
                <div className="flex items-center gap-2 w-full justify-center px-1">
                  <Crown className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <p className="font-bold text-white text-sm truncate flex-1" title={buyer.name}>{buyer.name}</p>
                </div>
                {buyer.username && <p className="text-[10px] text-purple-300/70 font-bold uppercase tracking-widest truncate w-full">{buyer.username}</p>}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end border-b border-white/5 pb-6">
        <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/5">
          <div className="px-4 py-2 rounded-xl bg-white/5 text-white text-[10px] font-black uppercase tracking-widest">
            {products.length} PRODUTOS
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
        {products.map((prod) => {
          const isPurchased = userOrders.includes(prod.id);
          const isPending = userPendingOrders.includes(prod.id);
          const isOutOfStock = (prod.stock || 0) <= 0;
          
          return (
            <motion.div
              key={prod.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -8 }}
              className="group glass-card flex flex-col rounded-[2.5rem] overflow-hidden hover:border-purple-500/30 transition-all duration-500"
            >
              {/* Image Container */}
              <div className="relative aspect-[4/3] md:aspect-video overflow-hidden p-3">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
                <img
                  src={prod.imageUrl}
                  alt={prod.name}
                  className="w-full h-full object-contain rounded-[1.8rem] bg-black/40 group-hover:scale-110 transition-transform duration-700"
                />
                
                <div className="absolute top-6 right-6 flex flex-col gap-2 z-20">
                  {prod.originalPrice && prod.originalPrice > prod.price && (
                    <div className="px-4 py-1.5 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-widest shadow-2xl backdrop-blur-md flex items-center gap-1">
                       <span className="text-white text-xs">🔥</span> PROMOÇÃO
                    </div>
                  )}

                  {isPurchased && (
                    <div className="px-4 py-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-2xl backdrop-blur-md">
                      ADQUIRIDO
                    </div>
                  )}

                  {isPending && !isPurchased && (
                    <div className="px-4 py-1.5 rounded-full bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest shadow-2xl backdrop-blur-md flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      PENDENTE
                    </div>
                  )}
                </div>

                {isOutOfStock && !isPurchased && !isPending && (
                  <div className="absolute inset-3 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20 rounded-[1.8rem]">
                    <span className="text-white text-[10px] font-black uppercase tracking-[0.4em] px-6 py-2 border border-white/20 rounded-full bg-white/5">
                      ESGOTADO
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 md:p-8 pt-2 md:pt-4 space-y-4 md:space-y-6">
                <div className="space-y-2">
                  <h3 className="text-sm md:text-xl font-black tracking-tight text-white/90 group-hover:text-purple-400 transition-colors duration-300 line-clamp-1 flex items-center gap-2">
                    <span>🎁</span> {prod.name}
                  </h3>
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                    <span className="text-lg md:text-2xl font-black text-yellow-400 tracking-tighter drop-shadow-[0_0_10px_rgba(250,204,21,0.3)]">
                      R$ {prod.price.toFixed(2)}
                    </span>
                    <span className="text-[8px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest md:border-l md:border-white/10 md:pl-3">
                      Pix ou Cartão
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {isPurchased ? (
                    <a
                      href={prod.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] md:text-[10px] font-black hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 md:gap-3 uppercase tracking-widest"
                    >
                      <Download className="w-3 h-3 md:w-4 md:h-4" />
                      DOWNLOAD
                    </a>
                  ) : isPending ? (
                    <div className="flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] md:text-[10px] font-black text-center uppercase tracking-widest leading-tight">
                      <span className="md:hidden">Aguardando</span>
                      <span className="hidden md:block">Aguardando Aprovação</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedProductDetails(prod)}
                      disabled={isOutOfStock}
                      className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 md:gap-3 uppercase tracking-widest ${
                        isOutOfStock 
                          ? 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5' 
                          : 'bg-purple-600/30 backdrop-blur-xl text-purple-100/90 border border-purple-500/40 shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:bg-purple-600/40 hover:text-white hover:border-purple-500/60'
                      }`}
                    >
                      DETALHES
                      <ExternalLink className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                  )}
                </div>
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

      {/* Pending PIX Alert for logged out users */}
      {!user && localStorage.getItem('pending_pix_product') && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 left-6 right-6 md:left-auto md:right-24 z-50 bg-amber-500 text-black p-6 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center gap-4 border-2 border-black/10"
        >
          <div className="flex-1">
            <h4 className="font-black text-sm uppercase tracking-tight">Pagamento Pendente Detectado</h4>
            <p className="text-xs font-medium opacity-80">Você iniciou um pagamento PIX. Faça login para anexar o comprovante e liberar seu produto.</p>
          </div>
          <button
            onClick={() => loginWithGoogle()}
            className="px-6 py-2 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform"
          >
            FAZER LOGIN AGORA
          </button>
          <button
            onClick={() => localStorage.removeItem('pending_pix_product')}
            className="text-[10px] font-bold opacity-50 hover:opacity-100"
          >
            DESCARTAR
          </button>
        </motion.div>
      )}

      {pixProduct && user && (
        <PixPaymentModal
          isOpen={!!pixProduct}
          onClose={() => {
            setPixProduct(null);
            localStorage.removeItem('pending_pix_product');
          }}
          product={pixProduct}
          userId={user.uid}
          userEmail={user.email || ''}
          onSuccess={() => {
            fetchData();
            setPixProduct(null);
            localStorage.removeItem('pending_pix_product');
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
            handlePix(prod);
          }}
        />
      )}

      {user && (
        <SupportModal
          isOpen={isSupportOpen}
          onClose={() => setIsSupportOpen(false)}
          userId={user.uid}
          userEmail={user.email || ''}
        />
      )}
    </div>
  );
}
