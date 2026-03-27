import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, QrCode, Copy, Check, Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { uploadToImgBB } from '../services/imgbb';
import { notifyAdmin } from '../services/notifications';

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
  const [pixKey, setPixKey] = useState('');
  const [receiptImage, setReceiptImage] = useState<File | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchPix = async () => {
        const docSnap = await getDoc(doc(db, 'settings', 'pix'));
        if (docSnap.exists()) {
          setPixKey(docSnap.data().pixKey || "Chave PIX não configurada pelo administrador.");
        } else {
          setPixKey("Chave PIX não configurada pelo administrador.");
        }
      };
      fetchPix();
      setReceiptImage(null);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!receiptImage) {
      alert('Por favor, anexe o comprovante de pagamento antes de confirmar.');
      return;
    }

    setLoading(true);
    try {
      const receiptUrl = await uploadToImgBB(receiptImage);

      await addDoc(collection(db, 'orders'), {
        userId,
        userEmail,
        productId: product.id,
        productName: product.name,
        price: product.price,
        status: 'pending',
        paymentMethod: 'pix',
        receiptUrl,
        createdAt: new Date().toISOString()
      });

      // Notificar administrador por e-mail e push
      try {
        await notifyAdmin(
          'Novo Pagamento PIX',
          `${userEmail || 'Um usuário'} enviou um comprovante para ${product.name}.`,
          '/admin'
        );

        await fetch('/api/send-support-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: 'LD STORE Admin', // O servidor usará o SMTP_USER se o 'to' não for um e-mail válido ou se preferir enviar para si mesmo
            subject: `Novo Comprovante PIX - ${product.name}`,
            text: `Um novo comprovante de pagamento PIX foi enviado.\n\nProduto: ${product.name}\nValor: $${product.price.toFixed(2)}\nUsuário: ${userEmail || 'Anônimo'}\nLink do Comprovante: ${receiptUrl}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; background: #f4f4f4;">
                <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 10px;">
                  <h2 style="color: #7c3aed;">Novo Pagamento PIX Recebido</h2>
                  <p>Um novo comprovante foi enviado para conferência.</p>
                  <hr style="border: 0; border-top: 1px solid #eee;" />
                  <p><strong>Produto:</strong> ${product.name}</p>
                  <p><strong>Valor:</strong> $${product.price.toFixed(2)}</p>
                  <p><strong>Usuário:</strong> ${userEmail || 'Anônimo'}</p>
                  <p><strong>ID do Usuário:</strong> ${userId}</p>
                  <div style="margin-top: 20px;">
                    <a href="${receiptUrl}" style="background: #7c3aed; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Comprovante</a>
                  </div>
                </div>
              </div>
            `
          })
        });
      } catch (emailError) {
        console.warn('Erro ao enviar notificação por e-mail:', emailError);
      }
      
      alert('Comprovante enviado com sucesso! O administrador irá conferir o seu pagamento e liberar o produto em breve.');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      alert('Erro ao enviar comprovante: ' + (error.message || 'Tente novamente.'));
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
              <h3 className="text-xl font-black tracking-tighter flex items-center gap-2">
                PAGAMENTO PIX
                <QrCode className="w-5 h-5 text-purple-400" />
              </h3>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6 text-center">
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Valor a pagar:</p>
                <p className="text-3xl font-black text-white">$ {product.price.toFixed(2)}</p>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Chave PIX para Transferência</p>
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

              <div className="space-y-3 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Envie seu Comprovante</p>
                <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-white/10 hover:border-purple-500/50 cursor-pointer transition-colors group bg-black/20">
                  {receiptImage ? (
                    <span className="text-purple-400 text-sm font-medium flex items-center gap-2">
                      <Check className="w-4 h-4" /> {receiptImage.name}
                    </span>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-500 group-hover:text-purple-400 transition-colors" />
                      <span className="text-gray-500 text-xs mt-2">Clique para anexar a foto ou PDF</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setReceiptImage(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  onClick={handleConfirm}
                  disabled={loading || !receiptImage}
                  className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ENVIAR COMPROVANTE'}
                </button>
                <p className="text-[10px] text-gray-500">
                  O acesso será liberado após a verificação do comprovante pelo administrador.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
