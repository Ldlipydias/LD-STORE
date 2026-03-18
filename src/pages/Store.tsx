import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { loadStripe } from '@stripe/stripe-js';
import { ShoppingCart, Download, ExternalLink, Sparkles, Filter, Loader2, Copy, Check, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PixPaymentModal from '../components/PixPaymentModal';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface StoreProps {
  user: User;
}

export default function Store({ user }: StoreProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [userOrders, setUserOrders] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pixProduct, setPixProduct] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const cats = await getDocs(query(collection(db, 'categories'), orderBy('name')));
      setCategories(cats.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const prods = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
      setProducts(prods.docs.map(d => ({ id: d.id, ...d.data() })));

      const orders = await getDocs(query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        where('status', '==', 'paid')
      ));
      setUserOrders(orders.docs.map(d => d.data().productId));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (product: any) => {
    const stripe = await stripePromise;
    if (!stripe) {
      alert('Erro: Chave pública do Stripe não configurada ou inválida. Verifique VITE_STRIPE_PUBLISHABLE_KEY nas configurações.');
      return;
    }

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

  const filteredProducts = selectedCategory
    ? products.filter(p => p.categoryId === selectedCategory)
    : products;

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

        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
              !selectedCategory ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 hover:bg-white/10 text-gray-400'
            }`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 hover:bg-white/10 text-gray-400'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-10">
        {categories.map((cat) => {
          const catProducts = products.filter(p => p.categoryId === cat.id);
          if (catProducts.length === 0) return null;

          return (
            <div key={cat.id} className="space-y-4">
              <h2 className="text-lg font-bold px-1 flex items-center gap-2 text-gray-200">
                <div className="w-1 h-5 bg-purple-600 rounded-full" />
                {cat.name}
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {catProducts.map((prod) => {
                  const isPurchased = userOrders.includes(prod.id);
                  const isOutOfStock = (prod.stock || 0) <= 0;
                  
                  return (
                    <motion.div
                      key={prod.id}
                      whileHover={{ scale: 1.02 }}
                      className="group relative flex flex-col rounded-2xl bg-white/5 border border-white/10 overflow-hidden hover:border-purple-500/50 transition-all duration-300"
                    >
                      {/* Image Container 16:9 */}
                      <div className="relative aspect-video overflow-hidden">
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        
                        {isPurchased && (
                          <div className="absolute top-2 right-2 px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg z-10">
                            ADQUIRIDO
                          </div>
                        )}

                        {isOutOfStock && !isPurchased && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                            <span className="px-3 py-1 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-widest">
                              ESGOTADO
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-4 space-y-3">
                        <div>
                          <h3 className="text-sm font-bold truncate text-gray-100">{prod.name}</h3>
                          <p className="text-[10px] text-gray-500 line-clamp-1">{prod.description}</p>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Preço</span>
                            <span className="text-sm font-black text-white">R$ {prod.price.toFixed(2)}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Disponível</span>
                            <span className={`text-xs font-bold ${isOutOfStock ? 'text-red-500' : 'text-emerald-400'}`}>
                              {prod.stock || 0} un.
                            </span>
                          </div>
                        </div>

                        {isPurchased ? (
                          <div className="flex gap-2">
                            <a
                              href={prod.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                            >
                              <Download className="w-4 h-4" />
                              BAIXAR
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(prod.downloadUrl);
                                setCopiedId(prod.id);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="px-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center justify-center"
                              title="Copiar Link"
                            >
                              {copiedId === prod.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <button
                              onClick={() => handleBuy(prod)}
                              disabled={buyingId === prod.id || isOutOfStock}
                              className={`w-full group/btn relative overflow-hidden py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                                isOutOfStock 
                                  ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
                                  : 'bg-white text-black hover:bg-gray-200 active:scale-95'
                              }`}
                            >
                              {buyingId === prod.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <ShoppingCart className="w-4 h-4" />
                                  <span>CARTÃO / STRIPE</span>
                                </>
                              )}
                            </button>
                            
                            {!isOutOfStock && (
                              <button
                                onClick={() => setPixProduct(prod)}
                                className="w-full py-2.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 text-xs font-bold hover:bg-purple-500/20 transition-all flex items-center justify-center gap-2"
                              >
                                <QrCode className="w-4 h-4" />
                                PAGAR COM PIX
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <Filter className="w-12 h-12 text-gray-600 mx-auto" />
          <p className="text-gray-500 font-medium">Nenhum produto encontrado nesta categoria.</p>
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
    </div>
  );
}
