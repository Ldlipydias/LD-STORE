import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, ShoppingCart, Plus, CheckCircle2, Zap, MessageSquare, Package, ShieldCheck, Share2, Loader2, Tag } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

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
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [activeCoupon, setActiveCoupon] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Reset current image and coupon when product changes or modal opens
  useEffect(() => {
    if (product) {
      setCurrentImage(product.imageUrl);
    }
    setCouponCode('');
    setActiveCoupon(null);
    setCouponError('');
  }, [product, isOpen]);

  if (!product) return null;

  const allImages = [product.imageUrl, ...(product.sampleImages || [])];

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    
    try {
      // Find coupon ignoring case
      const q = query(collection(db, 'coupons'), where('code', '==', couponCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setCouponError('Cupom inválido ou não encontrado.');
        setActiveCoupon(null);
        return;
      }

      const couponData = snap.docs[0].data();
      
      // Check active
      if (couponData.active === false) {
        setCouponError('Este cupom está inativo.');
        setActiveCoupon(null);
        return;
      }
      
      // Check minimum value
      if (couponData.minAmount && product.price < couponData.minAmount) {
        setCouponError(`Válido apenas para compras acima de R$ ${couponData.minAmount.toFixed(2)}.`);
        setActiveCoupon(null);
        return;
      }

      // Check validity date
      if (couponData.validUntil) {
        const validDate = new Date(couponData.validUntil);
        const today = new Date();
        // compare dates directly (ignoring time if we want, but simple compare is fine)
        if (today > validDate) {
          setCouponError('Este cupom já expirou.');
          setActiveCoupon(null);
          return;
        }
      }

      setActiveCoupon({
        ...couponData,
        code: snap.docs[0].id
      });
    } catch (error) {
      console.error('Error applying coupon', error);
      setCouponError('Erro ao validar o cupom.');
    } finally {
      setCouponLoading(false);
    }
  };

  const currentPrice = activeCoupon ? Math.max(0, product.price * (1 - activeCoupon.discount / 100)) : product.price;

  const handleShare = async () => {
    const url = `https://story.app.br/product/${product.id}`;
    
    let text = `Olha esse produto: *${product.name}*\n`;
    if (activeCoupon) {
      text += `Use o cupom *${activeCoupon.code}* e pague apenas *R$ ${currentPrice.toFixed(2)}*! (Valor original: R$ ${product.price.toFixed(2)})\n`;
    } else {
      text += `Por apenas *R$ ${product.price.toFixed(2)}*\n`;
    }
    
    text += `\n📸 Veja a imagem:\n${product.imageUrl}\n\nGaranta já o seu! 🔥\n${url}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Compre ${product.name}`,
          text: text,
        });
        return;
      } catch (err) {
        console.log("Ação de compartilhar cancelada ou não suportada", err);
      }
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleBuyInternal = () => {
    onBuy({ 
      ...product, 
      price: currentPrice, 
      appliedCoupon: activeCoupon ? activeCoupon.code : null,
      originalPrice: activeCoupon ? product.price : null
    });
  };

  const handlePixInternal = () => {
    onPix({ 
      ...product, 
      price: currentPrice, 
      appliedCoupon: activeCoupon ? activeCoupon.code : null,
      originalPrice: activeCoupon ? product.price : null
    });
  };

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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
                      <Package className="w-5 h-5 text-purple-400" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tighter text-white uppercase flex items-center gap-3">
                      <span>🎁</span> {product.name}
                    </h2>
                  </div>
                  <button 
                    onClick={handleShare}
                    className="p-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-xl border border-[#25D366]/20 transition-all flex items-center gap-2"
                    title="Compartilhar no WhatsApp"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-black tracking-widest hidden sm:inline">Compartilhar</span>
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest">
                    {product.stock || 0} em estoque
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  {activeCoupon ? (
                    <>
                      <span className="text-sm text-gray-500 font-bold line-through">R$ {product.price.toFixed(2)}</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]">R$ {currentPrice.toFixed(2)}</span>
                        <span className="text-sm text-gray-500 font-bold uppercase tracking-widest">com desconto</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]">R$ {product.price.toFixed(2)}</span>
                      <span className="text-sm text-gray-500 font-bold uppercase tracking-widest">À vista no Pix</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Coupon Section */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400">
                  <Tag className="w-4 h-4" />
                  Cupom de Desconto
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="DIGITE AQUI"
                    disabled={!!activeCoupon || couponLoading}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-purple-500 text-sm font-bold uppercase"
                  />
                  {!activeCoupon ? (
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="px-4 py-2 bg-purple-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-purple-500 disabled:opacity-50 flex items-center justify-center min-w-[80px]"
                    >
                      {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'APLICAR'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveCoupon(null);
                        setCouponCode('');
                      }}
                      className="px-4 py-2 bg-red-500/20 text-red-500 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-red-500 hover:text-white"
                    >
                      REMOVER
                    </button>
                  )}
                </div>
                {couponError && <p className="text-xs text-red-400 font-bold mt-2">{couponError}</p>}
                {activeCoupon && <p className="text-xs text-emerald-400 font-bold mt-2">Cupom '{activeCoupon.code}' aplicado! ({activeCoupon.discount}% OFF)</p>}
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
                  onClick={() => {
                    const cartStr = localStorage.getItem('ld_cart');
                    const cart = cartStr ? JSON.parse(cartStr) : [];
                    cart.push({
                      ...product,
                      cartPrice: currentPrice,
                      appliedCoupon: activeCoupon?.code || null,
                      originalPrice: activeCoupon ? product.price : null
                    });
                    localStorage.setItem('ld_cart', JSON.stringify(cart));
                    window.dispatchEvent(new Event('cart_updated'));
                    alert('Adicionado ao carrinho com sucesso!');
                    onClose();
                  }}
                  className="w-full py-5 rounded-[1.5rem] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-sm flex items-center justify-center gap-3 hover:bg-emerald-500 hover:text-black transition-all uppercase tracking-widest"
                >
                  <ShoppingCart className="w-5 h-5" />
                  ADICIONAR AO CARRINHO
                </button>

                <div className="flex gap-4">
                  <button 
                    onClick={handleBuyInternal}
                    className="flex-1 py-5 rounded-[1.5rem] bg-gradient-to-r from-purple-600 to-purple-400 text-white font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-purple-600/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    Cartão
                  </button>
                  
                  <button 
                    onClick={handlePixInternal}
                    className="flex-1 py-5 rounded-[1.5rem] bg-white/5 border border-white/10 text-white font-black text-sm flex items-center justify-center gap-3 hover:bg-white/10 transition-all uppercase tracking-widest"
                  >
                    <svg fill="#24b394" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M11.917 11.71a2.046 2.046 0 0 1-1.454-.602l-2.1-2.1a.4.4 0 0 0-.551 0l-2.108 2.108a2.044 2.044 0 0 1-1.454.602h-.414l2.66 2.66c.83.83 2.177.83 3.007 0l2.667-2.668h-.253zM4.25 4.282c.55 0 1.066.214 1.454.602l2.108 2.108a.39.39 0 0 0 .552 0l2.1-2.1a2.044 2.044 0 0 1 1.453-.602h.253L9.503 1.623a2.127 2.127 0 0 0-3.007 0l-2.66 2.66h.414z"></path><path d="m14.377 6.496-1.612-1.612a.307.307 0 0 1-.114.023h-.733c-.379 0-.75.154-1.017.422l-2.1 2.1a1.005 1.005 0 0 1-1.425 0L5.268 5.32a1.448 1.448 0 0 0-1.018-.422h-.9a.306.306 0 0 1-.109-.021L1.623 6.496c-.83.83-.83 2.177 0 3.008l1.618 1.618a.305.305 0 0 1 .108-.022h.901c.38 0 .75-.153 1.018-.421L7.375 8.57a1.034 1.034 0 0 1 1.426 0l2.1 2.1c.267.268.638.421 1.017.421h.733c.04 0 .079.01.114.024l1.612-1.612c.83-.83.83-2.178 0-3.008z"></path></g></svg>
                    Pix
                  </button>
                </div>

                <div className="pt-2">
                  <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
                    <p className="text-xs text-orange-400 font-bold leading-relaxed text-center">
                      <span className="block mb-1">Atenção sobre Reembolsos:</span>
                      O valor do reembolso será creditado exclusivamente como SALDO NA CARTEIRA desta plataforma, para uso em novas compras, e não retornará ao método original do pagamento.
                    </p>
                  </div>
                </div>
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
