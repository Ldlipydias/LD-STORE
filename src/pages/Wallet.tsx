import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Wallet, CreditCard, ArrowUpCircle, History, Sparkles, Clock, Target, Gift, Building2, ShoppingBag, Users } from 'lucide-react';
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
  const [bonusBalance, setBonusBalance] = useState(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltySpent, setLoyaltySpent] = useState(0);

  const [amountToAdd, setAmountToAdd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  const [isPixOpen, setIsPixOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Fetch true email from users doc
  const [currentEmail, setCurrentEmail] = useState(user?.email || '');

  const fakeWalletProduct = { id: 'wallet_topup', name: 'Depósito na LD Bank Stor', price: parseFloat(amountToAdd) || 0 };

  useEffect(() => {
    if (!user) return;
    
    // Balance listener
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBalance(data.balance || 0);
        setBonusBalance(data.bonusBalance || 0);
        setLoyaltyPoints(data.loyaltyPoints || 0);
        setLoyaltySpent(data.loyaltySpent || 0);
        if (data.email) setCurrentEmail(data.email);
        else setCurrentEmail(user.email || '');
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
        setTransactions(allOrders); // Now we show ALL orders / extracts
      } catch (e) {
        console.error("Error fetching transactions:", e);
      }
    }
    fetchTransactions();

    return () => unsub();
  }, [user]);

  const handleUpdateEmail = async () => {
    if (!newEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      alert("Por favor, informe um e-mail válido.");
      return;
    }
    setSavingEmail(true);
    try {
      await updateDoc(doc(db, 'users', user!.uid), {
        email: newEmail,
        updatedAt: new Date().toISOString()
      });
      alert('Seu e-mail foi salvo com sucesso! O administrador agora poderá entrar em contato com você.');
      setEditingEmail(false);
    } catch (e: any) {
      alert('Erro ao salvar e-mail: ' + e.message);
    } finally {
      setSavingEmail(false);
    }
  };

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
        const win = window.open(data.url, '_blank');
        if (!win) {
           window.location.href = data.url;
        }
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
        <div className="p-3 rounded-xl bg-purple-500/20">
          <Building2 className="w-8 h-8 text-purple-500" />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">LD Bank Stor</h1>
          <p className="text-gray-400 text-sm">Sua conta digital na LD Store</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Virtual Card */}
        <div className="p-8 rounded-3xl bg-gradient-to-br from-purple-900/60 via-[#1C0F2E] to-black border border-purple-500/30 relative overflow-hidden shadow-2xl shadow-purple-900/20">
          <Sparkles className="absolute top-0 right-0 w-32 h-32 text-purple-500/10 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute top-4 right-8 flex gap-1">
            <div className="w-8 h-8 rounded-full bg-white/20" />
            <div className="w-8 h-8 rounded-full bg-white/20 -ml-4" />
          </div>
          
          <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">Saldo Principal</p>
          <p className="text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]">R$ {balance.toFixed(2)}</p>
          
          <div className="mt-8 flex justify-between items-end">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Titular da Conta</p>
              <p className="text-sm font-bold text-white uppercase tracking-wider">{user?.email?.split('@')[0] || 'Usuário'}</p>
            </div>
            {bonusBalance > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-pink-400 uppercase tracking-widest mb-1 font-bold">Saldo Bônus</p>
                <p className="text-lg font-black text-pink-400 drop-shadow-[0_0_10px_rgba(244,114,182,0.3)]">+ R$ {bonusBalance.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Loyalty Tracker */}
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold uppercase flex items-center gap-2">
              <Gift className="w-5 h-5 text-pink-500" />
              Programa de Recompensas
            </h2>
            <div className="text-xs font-bold px-2 py-1 bg-pink-500/20 text-pink-400 rounded-lg uppercase tracking-widest">
              Ganhe R$ 5,00
            </div>
          </div>
          
          <p className="text-sm text-gray-400 mb-6">Complete 10 compras ou gaste até R$ 30,00 para ganhar R$ 5,00 em saldo bônus para gastar na loja!</p>
          
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <span>Compras realizadas</span>
                <span className="text-white">{loyaltyPoints} / 10</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                <motion.div 
                  className="bg-gradient-to-r from-pink-500 to-purple-500 h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (loyaltyPoints / 10) * 100)}%` }}
                  transition={{ duration: 1, delay: 0.2 }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <span>Valor Gasto</span>
                <span className="text-white">R$ {loyaltySpent.toFixed(2)} / R$ 30,00</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                <motion.div 
                  className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (loyaltySpent / 30) * 100)}%` }}
                  transition={{ duration: 1, delay: 0.4 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Profile / Email Settings */}
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold uppercase flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Perfil
            </h2>
            {!currentEmail && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 px-2 py-1 rounded">
                E-mail Ausente
              </span>
            )}
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Caso seu e-mail não esteja visível para a loja, o administrador não conseguirá entrar em contato com você via chat nem solucionar problemas fora da plataforma.
            </p>
            
            {!editingEmail ? (
              <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">E-mail de Contato</p>
                  <p className="font-bold text-white mb-1">{currentEmail || 'Nenhum e-mail registrado'}</p>
                  <p className="text-xs text-gray-400">{user?.displayName || 'Sem nome'}</p>
                </div>
                <button 
                  onClick={() => { setEditingEmail(true); setNewEmail(currentEmail); }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  {currentEmail ? 'ALTERAR' : 'ADICIONAR'}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-black/40 rounded-2xl border border-blue-500/30 space-y-4">
                <input
                  type="email"
                  placeholder="Seu melhor e-mail..."
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleUpdateEmail}
                    disabled={savingEmail}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                  >
                    {savingEmail ? 'SALVANDO...' : 'SALVAR E-MAIL'}
                  </button>
                  <button 
                    onClick={() => setEditingEmail(false)}
                    className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white text-sm font-black uppercase tracking-widest rounded-xl transition-all"
                  >
                    CANCELAR
                  </button>
                </div>
              </div>
            )}
          </div>
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
            
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  // This will force re-fetching of all orders for this user by the backend 
                  // or just refresh the UI to see if a late webhook or sync happened
                  window.location.reload(); 
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full mt-4 py-2 rounded-xl text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <Clock className="w-3 h-3" />
              Verificar pagamentos pendentes
            </button>
          </div>
        </div>

        {transactions.length > 0 && (
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
            <h2 className="text-lg font-bold uppercase flex items-center gap-2 mb-6">
              <History className="w-5 h-5 text-gray-400" />
              Extrato de Transações
            </h2>
            <div className="space-y-3 max-h-[500px] overflow-auto pr-2 custom-scrollbar">
              {transactions.map(t => {
                const isAddition = t.isWalletTopup || t.productId === 'wallet_topup';
                const statusColor = t.status === 'paid' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500';
                
                return (
                  <div key={t.id} className="p-4 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full hidden sm:block ${isAddition ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'}`}>
                        {isAddition ? <ArrowUpCircle className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-bold text-sm tracking-tight">{isAddition ? 'Depósito na Conta' : `Compra: ${t.productName}`}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{new Date(t.createdAt).toLocaleDateString()} • {t.paymentMethod}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-sm ${isAddition ? 'text-emerald-400' : 'text-gray-200'}`}>
                        {isAddition ? '+' : '-'} R$ {parseFloat(t.amount || t.price || 0).toFixed(2)}
                      </p>
                      <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${statusColor}`}>
                        {t.status === 'paid' ? 'Aprovado' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                );
              })}
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
