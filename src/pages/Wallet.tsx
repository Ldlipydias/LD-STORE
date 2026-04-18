import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Wallet, CreditCard, ArrowUpCircle, History, Sparkles, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { loadStripe } from '@stripe/stripe-js';
import PixPaymentModal from '../components/PixPaymentModal';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

interface WalletPageProps {
  user: User | null;
}

export default function WalletPage({ user }: WalletPageProps) {
  const [balance, setBalance] = useState(0);
  const [amountToAdd, setAmountToAdd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Pix Modal state
  const [isPixOpen, setIsPixOpen] = useState(false);
  const fakeWalletProduct = { id: 'wallet_topup', name: 'Adição de Saldo na Carteira', price: parseFloat(amountToAdd) || 0 };

  useEffect(() => {
    if (!user) return;
    
    // Balance listener
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists() && docSnap.data().balance !== undefined) {
        setBalance(docSnap.data().balance || 0);
      }
    }, (err) => console.error("Wallet balance error:", err));

    // Fetch previous topups (Orders with isWalletTopup or productId wallet_topup)
    const fetchTransactions = async () => {
      try {
        const q = query(
          collection(db, 'orders'), 
          where('userId', '==', user.uid), 
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const allOrders = snap.docs.map(d => ({id: d.id, ...d.data()}) as any);
        const topups = allOrders.filter((o: any) => o.isWalletTopup || o.productId === 'wallet_topup');
        setTransactions(topups);
      } catch (e) {
        console.error("Error fetching transactions:", e);
      }
    }
    fetchTransactions();

    return () => unsub();
  }, [user]);

  if (!user) {
    return (
      <div className="text-center py-20 space-y-4">
        <Wallet className="w-12 h-12 text-gray-600 mx-auto" />
        <p className="text-gray-500 font-medium">Faça login para acessar sua carteira.</p>
      </div>
    );
  }

  const handleStripeCheckout = async () => {
    const val = parseFloat(amountToAdd.replace(',', '.'));
    if (isNaN(val) || val < 5) {
      alert("O valor mínimo para adição é R$ 5,00");
      return;
    }

    if (!STRIPE_PUBLISHABLE_KEY || !stripePromise) {
      alert("Pagamento por cartão indisponível momentaneamente.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'wallet_topup',
          productName: 'Adição de Saldo na Carteira',
          productPrice: val,
          userId: user.uid,
          origin: window.location.origin
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar sessão de pagamento');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePixClick = () => {
    const val = parseFloat(amountToAdd.replace(',', '.'));
    if (isNaN(val) || val < 5) {
      alert("O valor mínimo para adição é R$ 5,00");
      return;
    }
    setIsPixOpen(true);
  };

  const pendingTopups = transactions.filter(t => t.status === 'pending');

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-emerald-500/20">
          <Wallet className="w-8 h-8 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Minha Carteira</h1>
          <p className="text-gray-400 text-sm">Adicione saldo e use para compras rápidas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="p-8 rounded-3xl bg-gradient-to-br from-emerald-900/40 to-black border border-emerald-500/20 relative overflow-hidden">
          <Sparkles className="absolute top-4 right-4 w-24 h-24 text-emerald-500/10" />
          <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">Saldo Atual</p>
          <p className="text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">R$ {balance.toFixed(2)}</p>
        </div>

        <AnimatePresence>
          {pendingTopups.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-4"
            >
              <div className="p-2 rounded-full bg-amber-500/20 shrink-0">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-amber-500 uppercase tracking-tight">Análise Pendente</h3>
                <p className="text-amber-200/80 text-sm mt-1 leading-relaxed">
                  Você possui {pendingTopups.length} tentativa(s) de adição de saldo via PIX aguardando aprovação do administrador. O valor será creditado em sua conta assim que o comprovante for validado.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-6">
          <h2 className="text-lg font-bold uppercase flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-purple-400" />
            Adicionar Saldo
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Valor a adicionar (Mín. R$ 5,00)</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">R$</span>
                <input
                  type="number"
                  min="5"
                  step="0.01"
                  value={amountToAdd}
                  onChange={(e) => setAmountToAdd(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none text-xl font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <button
                onClick={handleStripeCheckout}
                disabled={loading || !amountToAdd}
                className="py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-gradient-to-r from-purple-600 to-purple-400 cursor-pointer text-white disabled:opacity-50 hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                {loading ? 'Redirecionando...' : <>
                  <CreditCard className="w-4 h-4" />
                  Pagar via Cartão
                </>}
              </button>
              <button
                onClick={handlePixClick}
                disabled={loading || !amountToAdd}
                className="py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-[#24b394]/20 text-[#24b394] border border-[#24b394]/30 cursor-pointer disabled:opacity-50 hover:bg-[#24b394]/30 transition-colors flex items-center justify-center gap-2"
              >
                PIX
              </button>
            </div>
          </div>
        </div>

        {transactions.length > 0 && (
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
            <h2 className="text-lg font-bold uppercase flex items-center gap-2 mb-6">
              <History className="w-5 h-5 text-gray-400" />
              Histórico de Adições
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
              {transactions.map(t => (
                <div key={t.id} className="p-4 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">Adição de Saldo</p>
                    <p className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString()} • {t.paymentMethod}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-400 text-sm">R$ {parseFloat(t.amount || t.price || 0).toFixed(2)}</p>
                    <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${t.status === 'paid' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                      {t.status === 'paid' ? 'Aprovado' : 'Pendente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      
      {isPixOpen && (
        <PixPaymentModal
          isOpen={isPixOpen}
          onClose={() => setIsPixOpen(false)}
          product={fakeWalletProduct}
          userId={user.uid}
          userEmail={user.email}
          onSuccess={() => setIsPixOpen(false)}
        />
      )}
    </div>
  )
}
