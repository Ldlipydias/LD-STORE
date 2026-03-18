import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { uploadToImgBB } from '../services/imgbb';
import { verifyPixReceipt } from '../services/gemini';
import { X, Copy, Check, Upload, Loader2, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  userId: string;
  onSuccess: () => void;
}

export default function PixPaymentModal({ isOpen, onClose, product, userId, onSuccess }: PixPaymentModalProps) {
  const [pixSettings, setPixSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'payment' | 'upload' | 'verifying' | 'success'>('payment');

  useEffect(() => {
    if (isOpen) {
      fetchPixSettings();
    }
  }, [isOpen]);

  const fetchPixSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'pix'));
      if (settingsDoc.exists()) {
        setPixSettings(settingsDoc.data());
      } else {
        setError('Configurações de PIX não encontradas. Contate o suporte.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar dados do PIX.');
    }
  };

  const handleCopy = () => {
    if (pixSettings?.pixKey) {
      navigator.clipboard.writeText(pixSettings.pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceipt(file);
      setError(null);
    }
  };

  const handleVerify = async () => {
    if (!receipt) {
      setError('Por favor, selecione o comprovante.');
      return;
    }

    setVerifying(true);
    setError(null);
    setStep('verifying');

    try {
      // 1. Convert image to base64 for Gemini
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(receipt);
      });
      const base64Image = await base64Promise;

      // 2. Verify with Gemini
      const result = await verifyPixReceipt(base64Image, product.price, pixSettings.pixRecipient);

      if (result.isValid) {
        // 3. Upload to ImgBB for record
        const receiptUrl = await uploadToImgBB(receipt);

        // 4. Create Order in Firestore
        await addDoc(collection(db, 'orders'), {
          userId,
          productId: product.id,
          status: 'paid',
          paymentMethod: 'pix',
          receiptUrl,
          verifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          aiMetadata: result
        });

        // 5. Decrement stock
        const productRef = doc(db, 'products', product.id);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const currentStock = productSnap.data().stock || 0;
          if (currentStock > 0) {
            await updateDoc(productRef, { stock: currentStock - 1 });
          }
        }

        setStep('success');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 3000);
      } else {
        setError(`Comprovante Inválido: ${result.reason || 'Dados não conferem.'}`);
        setStep('upload');
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro ao processar o comprovante. Tente novamente.');
      setStep('upload');
    } finally {
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 sm:p-10 space-y-8">
          {step === 'payment' && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest">
                  <Sparkles className="w-3 h-3" />
                  Pagamento Instantâneo
                </div>
                <h2 className="text-3xl font-black tracking-tighter">PAGAR COM PIX</h2>
                <p className="text-gray-400 text-sm">Escaneie o QR Code ou copie a chave abaixo.</p>
              </div>

              <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Valor a Pagar</span>
                  <span className="text-2xl font-black text-white">R$ {product.price.toFixed(2)}</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    <span>Chave PIX (CNPJ/E-mail/Telefone)</span>
                    <span className="text-purple-400">Copia e Cola</span>
                  </div>
                  <div className="relative group">
                    <div className="w-full p-4 rounded-2xl bg-black border border-white/10 font-mono text-sm break-all pr-12 text-purple-300">
                      {pixSettings?.pixKey || 'Carregando...'}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-[10px] text-amber-200/70 text-center leading-relaxed">
                      <strong>Atenção:</strong> Esta chave não contém o valor. Você deve digitar manualmente o valor de <strong>R$ {product.price.toFixed(2)}</strong> no seu aplicativo do banco.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-200">Destinatário:</p>
                      <p>{pixSettings?.pixRecipient || '...'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep('upload')}
                className="w-full py-5 rounded-2xl bg-white text-black font-black text-sm hover:bg-gray-200 transition-all shadow-xl active:scale-95"
              >
                JÁ FIZ O PAGAMENTO
              </button>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black tracking-tighter">ENVIAR COMPROVANTE</h2>
                <p className="text-gray-400 text-sm">Nossa IA vai validar seu pagamento em segundos.</p>
              </div>

              <div className="space-y-4">
                <label className="flex flex-col items-center justify-center w-full h-48 rounded-[2rem] border-2 border-dashed border-white/10 hover:border-purple-500/50 cursor-pointer transition-all bg-white/5 group overflow-hidden">
                  {receipt ? (
                    <div className="relative w-full h-full">
                      <img
                        src={URL.createObjectURL(receipt)}
                        alt="Preview"
                        className="w-full h-full object-contain p-4"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold">TROCAR IMAGEM</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-purple-500" />
                      </div>
                      <span className="text-gray-400 text-sm font-bold">Clique para selecionar</span>
                      <span className="text-gray-600 text-[10px] uppercase tracking-widest mt-1">PNG, JPG ou PDF</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>

                {error && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setStep('payment')}
                  className="py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm hover:bg-white/10 transition-all"
                >
                  VOLTAR
                </button>
                <button
                  onClick={handleVerify}
                  disabled={!receipt || verifying}
                  className="py-5 rounded-2xl bg-purple-600 text-white font-black text-sm hover:bg-purple-500 transition-all shadow-xl shadow-purple-500/20 disabled:opacity-50 active:scale-95"
                >
                  VERIFICAR AGORA
                </button>
              </div>
            </div>
          )}

          {step === 'verifying' && (
            <div className="py-12 text-center space-y-8">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tighter">VALIDANDO PAGAMENTO</h2>
                <p className="text-gray-400 text-sm animate-pulse">Nossa IA está lendo seu comprovante...</p>
              </div>
              <div className="max-w-xs mx-auto p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed">
                  Estamos conferindo o valor de <strong>R$ {product.price.toFixed(2)}</strong> e o destinatário <strong>{pixSettings?.pixRecipient}</strong>.
                </p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-12 text-center space-y-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40"
              >
                <Check className="w-12 h-12 text-white" />
              </motion.div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tighter text-emerald-400">PAGAMENTO APROVADO!</h2>
                <p className="text-gray-400 text-sm">Sua compra foi liberada instantaneamente.</p>
              </div>
              <p className="text-xs text-gray-500">Redirecionando você para o conteúdo...</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
