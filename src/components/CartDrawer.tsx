import { useState, useEffect } from 'react';
import { ShoppingCart, LogIn, Wallet, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db, loginWithGoogle } from '../firebase';
import { User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  balance: number;
}

export default function CartDrawer({ isOpen, onClose, user, balance }: CartDrawerProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadCart = () => {
      const cartStr = localStorage.getItem('ld_cart');
      setItems(cartStr ? JSON.parse(cartStr) : []);
    };
    
    if (isOpen) loadCart();
    
    window.addEventListener('cart_updated', loadCart);
    return () => window.removeEventListener('cart_updated', loadCart);
  }, [isOpen]);

  const removeItem = (idx: number) => {
    const newItems = [...items];
    newItems.splice(idx, 1);
    setItems(newItems);
    localStorage.setItem('ld_cart', JSON.stringify(newItems));
    window.dispatchEvent(new Event('cart_updated'));
  };

  const total = items.reduce((acc, item) => acc + (item.cartPrice || item.price || 0), 0);

  const handleCheckout = async () => {
    if (!user) {
      await loginWithGoogle();
      return;
    }

    if (balance < total) {
      alert(`Saldo insuficiente. Você tem R$ ${balance.toFixed(2)} e o carrinho custa R$ ${total.toFixed(2)}. Adicione mais fundos.`);
      onClose();
      navigate('/wallet');
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      
      // Deduct balance
      await setDoc(userRef, { balance: balance - total }, { merge: true });

      // Create orders
      for (const item of items) {
        await addDoc(collection(db, 'orders'), {
          userId: user.uid,
          userEmail: user.email,
          productId: item.id,
          productName: item.name,
          amount: item.cartPrice || item.price,
          appliedCoupon: item.appliedCoupon || null,
          originalPrice: item.originalPrice || null,
          status: 'paid',
          paymentMethod: 'wallet',
          stripeSessionId: `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          approvedAt: new Date().toISOString(),
        });
      }

      alert('Compra realizada com sucesso!');
      setItems([]);
      localStorage.removeItem('ld_cart');
      window.dispatchEvent(new Event('cart_updated'));
      onClose();
    } catch(err:any) {
      alert("Erro ao finalizar compra: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[400px] bg-black border-l border-white/10 z-[101] flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <ShoppingCart className="w-5 h-5 text-emerald-500" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Carrinho</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.length === 0 ? (
                <div className="text-center text-gray-500 py-10 space-y-4">
                  <ShoppingCart className="w-12 h-12 mx-auto opacity-20" />
                  <p>Seu carrinho está vazio.</p>
                </div>
              ) : (
                items.map((item, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 relative">
                    <button 
                      onClick={() => removeItem(idx)}
                      className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="w-16 h-16 rounded-xl bg-black border border-white/5 overflow-hidden shrink-0">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white line-clamp-1">{item.name}</p>
                      <div className="mt-2">
                        <p className="font-black text-emerald-400 text-lg">R$ {(item.cartPrice || item.price).toFixed(2)}</p>
                        {item.originalPrice && <p className="text-[10px] text-gray-500 line-through">R$ {item.originalPrice.toFixed(2)}</p>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-white/10 bg-white/5 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Total</span>
                  <span className="text-2xl font-black text-white">R$ {total.toFixed(2)}</span>
                </div>

                {user ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-black border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Seu Saldo</span>
                      </div>
                      <span className={`font-black ${balance >= total ? 'text-emerald-400' : 'text-red-400'}`}>R$ {balance.toFixed(2)}</span>
                    </div>

                    <button
                      onClick={handleCheckout}
                      disabled={loading}
                      className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all ${
                        balance >= total 
                          ? 'bg-emerald-600 hover:bg-emerald-500' 
                          : 'bg-purple-600 hover:bg-purple-500'
                      }`}
                    >
                      {loading ? 'Processando...' : balance >= total ? 'Finalizar com Saldo' : 'Adicionar Saldo'}
                    </button>
                    {balance < total && (
                      <p className="text-[10px] text-center text-red-400 font-bold flex items-center justify-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Saldo insuficiente para a compra
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => loginWithGoogle()}
                    className="w-full py-4 rounded-xl bg-purple-600 text-white font-black text-sm uppercase tracking-widest hover:bg-purple-500 transition-all flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Entrar para Comprar
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
