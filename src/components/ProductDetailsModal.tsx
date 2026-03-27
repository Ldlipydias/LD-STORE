import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, Plus, CheckCircle2, Zap, MessageSquare, Package, ShieldCheck } from 'lucide-react';

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  onBuy: (product: any) => void;
  onPix: (product: any) => void;
}

export default function ProductDetailsModal({ isOpen, onClose, product, onBuy, onPix }: ProductDetailsModalProps) {
  const [selectedOption, setSelectedOption] = useState(0);
  const [currentImage, setCurrentImage] = useState(product?.imageUrl);

  // Reset current image when product changes or modal opens
  useEffect(() => {
    if (product) setCurrentImage(product.imageUrl);
  }, [product, isOpen]);

  if (!product) return null;

  const allImages = [product.imageUrl, ...(product.sampleImages || [])];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative my-auto"
          >
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 z-10 p-2 bg-black/50 hover:bg-black/80 rounded-full border border-white/10 transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Product Image & Gallery */}
            <div className="space-y-4 p-4">
              <div className="aspect-video w-full overflow-hidden bg-black/40 rounded-2xl">
                <img 
                  src={currentImage || product.imageUrl} 
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              </div>
              
              {allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImage(img)}
                      className={`relative w-20 aspect-square rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                        currentImage === img ? 'border-purple-500 scale-95' : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-8 space-y-8">
              {/* Header Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
                    <Package className="w-5 h-5 text-purple-400" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tighter text-white uppercase flex items-center gap-3">
                    <span>🎁</span> {product.name}
                  </h2>
                </div>

                <div className="flex items-center gap-4">
                  <div className="px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest">
                    {product.stock || 0} em estoque
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]">R$ {product.price.toFixed(2)}</span>
                  <span className="text-sm text-gray-500 font-bold uppercase tracking-widest">À vista no Pix</span>
                </div>
              </div>

              {/* Feedback Button */}
              <button className="w-full py-4 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 font-black text-xs tracking-widest hover:bg-purple-600/20 transition-all uppercase">
                FAÇA SEU FEEDBACK
              </button>

              {/* Options List */}
              <div className="space-y-3">
                <button 
                  onClick={() => setSelectedOption(0)}
                  className={`w-full p-5 rounded-3xl border transition-all flex items-center justify-between group ${
                    selectedOption === 0 ? 'bg-purple-600/10 border-purple-500' : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedOption === 0 ? 'border-purple-500 bg-purple-500' : 'border-white/20'
                    }`}>
                      {selectedOption === 0 && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div className="text-left">
                      <p className="font-black text-sm text-white uppercase tracking-tight flex items-center gap-2">
                        <span>🎁</span> {product.name}
                      </p>
                      <p className="text-xs text-emerald-400 font-bold">{product.stock || 0} em estoque</p>
                    </div>
                  </div>
                  <span className="font-black text-yellow-400">R$ {product.price.toFixed(2)}</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                <button 
                  onClick={() => onBuy(product)}
                  className="w-full py-5 rounded-[1.5rem] bg-gradient-to-r from-purple-600 to-purple-400 text-white font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-purple-600/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest"
                >
                  <ShoppingBag className="w-5 h-5" />
                  Comprar agora
                </button>
                
                <button 
                  onClick={() => onPix(product)}
                  className="w-full py-5 rounded-[1.5rem] bg-white/5 border border-white/10 text-white font-black text-sm flex items-center justify-center gap-3 hover:bg-white/10 transition-all uppercase tracking-widest"
                >
                  <Plus className="w-5 h-5" />
                  Pagar com Pix
                </button>
              </div>

              {/* Description Section */}
              <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-xl">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                  </div>
                  <h3 className="font-black text-white uppercase tracking-tight">Descrição</h3>
                </div>
                
                <div className="space-y-4">
                  {product.description ? (
                    <p className="text-sm font-medium text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {product.description}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-gray-300 leading-relaxed uppercase">ENTREGA IMEDIATA</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-gray-300 leading-relaxed uppercase">SUPORTE 24/7</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-gray-300 leading-relaxed uppercase">QUALIDADE PREMIUM</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Info */}
              <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-xl">
                    <Zap className="w-4 h-4 text-purple-400" />
                  </div>
                  <h3 className="font-black text-white uppercase tracking-tight">Entrega imediata</h3>
                </div>
                <p className="text-sm text-gray-400 font-medium leading-relaxed">
                  Receba o seu pacote imediatamente após o pagamento. Sistema automatizado de entrega.
                </p>
              </div>

              {/* Security Info */}
              <div className="flex items-center justify-center gap-2 text-gray-500 py-4">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Compra 100% Segura</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
