import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, QrCode, Copy, Check, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  userId: string;
  userEmail: string | null;
  onSuccess: () => void;
}

export default function PixPaymentModal({ isOpen, onClose, product, userId, userEmail, onSuccess }: PixPaymentModalProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Simulação de chave PIX (em produção seria gerada via API)
  const pixKey = "00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540510.005802BR5913LD STORE6009SAO PAULO62070503***6304ABCD";

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Em um cenário real, você verificaria o pagamento via webhook.
      // Aqui simulamos a criação do pedido após o usuário clicar em "Já paguei".
      await addDoc(collection(db, 'orders'), {
        userId,
        userEmail,
        productId: product.id,
        productName: product.name,
        price: product.price,
        status: 'paid',
        paymentMethod: 'pix',
        createdAt: new Date().toISOString()
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Erro ao confirmar pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-black tracking-tighter flex items-center gap-2">
                PAGAMENTO PIX
                <QrCode className="w-5 h-5 text-purple-400" />
              </h3>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6 text-center">
              <div className="bg-white p-4 rounded-2xl inline-block shadow-lg">
                {/* Em produção, use uma biblioteca de QR Code real */}
                <div className="w-48 h-48 bg-zinc-100 flex items-center justify-center text-black font-bold">
                  QR CODE PIX
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-400">Valor a pagar:</p>
                <p className="text-3xl font-black text-white">R$ {product.price.toFixed(2)}</p>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Copia e Cola</p>
                <div className="flex items-center gap-2 bg-black/40 p-3 rounded-xl border border-white/5">
                  <code className="text-[10px] text-gray-400 truncate flex-1">{pixKey}</code>
                  <button
                    onClick={copyToClipboard}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold hover:bg-purple-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'JÁ REALIZEI O PAGAMENTO'}
                </button>
                <p className="text-[10px] text-gray-500">
                  O acesso será liberado imediatamente após a confirmação.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
