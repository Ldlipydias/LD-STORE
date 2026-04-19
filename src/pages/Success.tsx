import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db, loginWithGoogle } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { CheckCircle2, Loader2, XCircle, Download, ArrowRight, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { notifyAdmin } from '../services/notifications';

interface SuccessProps {
  user: User | null;
}

export default function Success({ user }: SuccessProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [product, setProduct] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const verifyPayment = async () => {
      const sessionId = searchParams.get('session_id');
      const productId = searchParams.get('product_id');
      const appliedCoupon = searchParams.get('coupon');
      const originalPriceParam = searchParams.get('original');

      if (!sessionId || !productId) {
        setStatus('error');
        setErrorMsg('Parâmetros de sessão inválidos.');
        return;
      }

      if (!user) {
        setStatus('error');
        setErrorMsg('Você precisa estar logado para verificar seu pagamento.');
        return;
      }

      try {
        // 1. Verify session with backend
        const response = await fetch(`/api/verify-session/${sessionId}`);
        const data = await response.json();

        if (data.status === 'complete' || data.status === 'paid') {
          let expectedName = '';
          let expectedPrice = 0;
          let isWalletTopup = false;

          if (productId === 'wallet_topup') {
            isWalletTopup = true;
            expectedName = 'Adição de Saldo na Carteira';
            expectedPrice = data.amount_total ? data.amount_total / 100 : 0;
            setProduct({ name: expectedName, id: 'wallet_topup', isWalletTopup: true, amount: expectedPrice });
          } else {
            // 2. Get product details
            const productDoc = await getDoc(doc(db, 'products', productId));
            if (!productDoc.exists()) {
              throw new Error('Produto não encontrado');
            }
            
            const productData = productDoc.data();
            expectedName = productData.name;
            expectedPrice = productData.price;
            setProduct(productData);
          }

          // 3. Save order to Firestore
          const orderRef = doc(db, 'orders', sessionId);
          const orderDoc = await getDoc(orderRef);
          
          if (!orderDoc.exists()) {
            const finalPrice = data.amount_total ? data.amount_total / 100 : expectedPrice;
            
            await setDoc(orderRef, {
              userId: user.uid,
              userEmail: user.email,
              productId,
              productName: expectedName,
              amount: finalPrice,
              appliedCoupon: appliedCoupon || null,
              originalPrice: originalPriceParam ? parseFloat(originalPriceParam) : null,
              status: 'paid',
              paymentMethod: 'stripe',
              stripeSessionId: sessionId,
              createdAt: new Date().toISOString(),
              approvedAt: new Date().toISOString(),
              isWalletTopup
            });

            // If Wallet Topup, update user balance
            if (isWalletTopup) {
              const userRef = doc(db, 'users', user.uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const currentBalance = userSnap.data().balance || 0;
                await setDoc(userRef, { balance: currentBalance + finalPrice }, { merge: true });
              }
            } else {
              // Not topup: Compute Loyalty Points
              const userRef = doc(db, 'users', user.uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                let pts = (userData.loyaltyPoints || 0) + 1;
                let spent = (userData.loyaltySpent || 0) + finalPrice;
                let newBonus = userData.bonusBalance || 0;
                
                if (pts >= 10 || spent >= 30) {
                  newBonus += 5;
                  pts -= 10;
                  if (pts < 0) pts = 0;
                  spent -= 30;
                  if (spent < 0) spent = 0;
                }
                
                await setDoc(userRef, { 
                  loyaltyPoints: pts, 
                  loyaltySpent: spent, 
                  bonusBalance: newBonus 
                }, { merge: true });
              }
            }

            // Notificar administrador
            const paidValue = finalPrice.toFixed(2);
            const couponMsg = appliedCoupon ? ` (Cupom: ${appliedCoupon})` : '';
            await notifyAdmin(
              isWalletTopup ? 'Adição de Saldo (Stripe)' : 'Venda Aprovada (Stripe)',
              `${user.email || 'Um usuário'} ${isWalletTopup ? 'adicionou' : 'comprou'} ${expectedName} por R$ ${paidValue}${couponMsg}.`,
              '/admin'
            );
          }

          setStatus('success');
        } else {
          setStatus('error');
          setErrorMsg('Pagamento não concluído ou pendente.');
        }
      } catch (error: any) {
        console.error('Verification error:', error);
        setStatus('error');
        setErrorMsg(error.message || 'Erro ao verificar pagamento.');
      }
    };

    verifyPayment();
  }, [searchParams, user]);

  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
        <h2 className="text-2xl font-bold animate-pulse">Verificando pagamento...</h2>
        <p className="text-gray-400">Por favor, não feche esta página.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center"
        >
          <XCircle className="w-12 h-12 text-red-500" />
        </motion.div>
        <h2 className="text-3xl font-black">Ops! Algo deu errado.</h2>
        <p className="text-gray-400 text-center max-w-md">{errorMsg}</p>
        
        <div className="flex flex-col gap-4 w-full max-w-xs">
          {!user && (
            <button
              onClick={() => loginWithGoogle()}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black transition-all shadow-lg shadow-purple-500/25"
            >
              <LogIn className="w-5 h-5" />
              FAZER LOGIN
            </button>
          )}
          <button
            onClick={() => navigate('/store')}
            className="px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 font-bold transition-all"
          >
            Voltar para a Loja
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-8">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="w-32 h-32 bg-emerald-500/20 rounded-full flex items-center justify-center relative"
      >
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
        <CheckCircle2 className="w-16 h-16 text-emerald-500 relative z-10" />
      </motion.div>

      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black tracking-tighter">Pagamento Aprovado!</h1>
        <p className="text-xl text-gray-400">
          Obrigado por adquirir <strong className="text-white">{product?.name}</strong>.
        </p>
      </div>

      {product?.downloadUrl && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-8 rounded-3xl bg-white/5 border border-white/10 max-w-md w-full text-center space-y-6"
        >
          <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto">
            <Download className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Seu produto está pronto!</h3>
            <p className="text-sm text-gray-400 mb-6">
              Clique no botão abaixo para acessar ou baixar seu produto imediatamente.
            </p>
            <a
              href={product.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black transition-all shadow-lg shadow-purple-500/25"
            >
              ACESSAR PRODUTO
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </motion.div>
      )}

      <button
        onClick={() => navigate('/store')}
        className="text-gray-500 hover:text-white font-medium transition-colors"
      >
        Voltar para a Loja
      </button>
    </div>
  );
}
