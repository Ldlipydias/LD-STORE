import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc, setDoc, getDoc, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { uploadToImgBB } from '../services/imgbb';
import { Plus, Trash2, Image as ImageIcon, Loader2, Lock, Edit2, X, Sparkles, Check, XCircle, ExternalLink, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Admin() {
  const [pin, setPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pixSettings, setPixSettings] = useState({ pixKey: '', pixRecipient: '' });
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Form states
  const [newCategory, setNewCategory] = useState('');
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    downloadUrl: '',
    stock: '10',
    image: null as File | null
  });

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
      fetchPixSettings();

      // Listen for pending PIX orders
      const q = query(
        collection(db, 'orders'),
        where('status', '==', 'pending'),
        where('paymentMethod', '==', 'pix'),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Check for new orders to show notification
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newOrder = { id: change.doc.id, ...change.doc.data() } as any;
            // Only notify if it's not the initial load (approximate check)
            const orderTime = new Date(newOrder.createdAt).getTime();
            if (Date.now() - orderTime < 10000) {
              setNotifications(prev => {
                // Prevent duplicate notifications
                if (prev.some(n => n.id === newOrder.id)) return prev;
                return [...prev, newOrder];
              });
              // Auto remove notification after 10 seconds
              setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== newOrder.id));
              }, 10000);
            }
          }
        });

        setPendingOrders(orders);
      });

      return () => unsubscribe();
    }
  }, [isAuthorized]);

  const fetchData = async () => {
    const cats = await getDocs(query(collection(db, 'categories'), orderBy('name')));
    setCategories(cats.docs.map(d => ({ id: d.id, ...d.data() })));
    
    const prods = await getDocs(query(collection(db, 'products'), orderBy('name')));
    setProducts(prods.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchPixSettings = async () => {
    const settingsDoc = await getDoc(doc(db, 'settings', 'pix'));
    if (settingsDoc.exists()) {
      setPixSettings(settingsDoc.data() as any);
    }
  };

  const handleUpdatePixSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'pix'), pixSettings);
      alert('Configurações de PIX atualizadas!');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const [error, setError] = useState<string | null>(null);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '2401') {
      setIsAuthorized(true);
      setError(null);
    } else {
      setError('PIN incorreto. Tente novamente.');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'categories'), { name: newCategory });
      setNewCategory('');
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price || !productForm.categoryId) return;
    setLoading(true);
    try {
      let imageUrl = '';
      if (productForm.image) {
        imageUrl = await uploadToImgBB(productForm.image);
      }

      if (editingId) {
        const updateData: any = {
          name: productForm.name,
          description: productForm.description,
          price: parseFloat(productForm.price),
          stock: parseInt(productForm.stock) || 0,
          categoryId: productForm.categoryId,
          downloadUrl: productForm.downloadUrl,
        };
        if (imageUrl) updateData.imageUrl = imageUrl;
        
        await updateDoc(doc(db, 'products', editingId), updateData);
        setEditingId(null);
      } else {
        if (!productForm.image) {
          alert('Por favor, selecione uma imagem para o novo produto.');
          setLoading(false);
          return;
        }
        await addDoc(collection(db, 'products'), {
          name: productForm.name,
          description: productForm.description,
          price: parseFloat(productForm.price),
          stock: parseInt(productForm.stock) || 0,
          categoryId: productForm.categoryId,
          downloadUrl: productForm.downloadUrl,
          imageUrl,
          createdAt: new Date().toISOString()
        });
      }
      setProductForm({ name: '', description: '', price: '', categoryId: '', downloadUrl: '', stock: '10', image: null });
      fetchData();
    } catch (error: any) {
      console.error(error);
      alert('Erro ao salvar produto: ' + (error.message || 'Verifique sua chave do ImgBB ou conexão.'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (prod: any) => {
    setEditingId(prod.id);
    setProductForm({
      name: prod.name,
      description: prod.description || '',
      price: prod.price.toString(),
      categoryId: prod.categoryId,
      downloadUrl: prod.downloadUrl || '',
      stock: (prod.stock || 0).toString(),
      image: null
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (coll: string, id: string) => {
    if (!confirm('Tem certeza que deseja excluir?')) return;
    await deleteDoc(doc(db, coll, id));
    fetchData();
  };

  const handleUpdateStock = async (id: string, newStock: number) => {
    try {
      await updateDoc(doc(db, 'products', id), { stock: newStock });
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleApprovePix = async (order: any) => {
    if (!confirm(`Liberar produto "${order.productName}" para ${order.userEmail}?`)) return;
    setLoading(true);
    try {
      // 1. Update order status
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'paid',
        approvedAt: new Date().toISOString()
      });

      // 2. Decrease stock
      const productDoc = await getDoc(doc(db, 'products', order.productId));
      if (productDoc.exists()) {
        const currentStock = productDoc.data().stock || 0;
        await updateDoc(doc(db, 'products', order.productId), {
          stock: Math.max(0, currentStock - 1)
        });
      }

      alert('Produto liberado com sucesso!');
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Erro ao liberar produto.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectPix = async (order: any) => {
    const reason = prompt('Motivo da rejeição (opcional):');
    if (reason === null) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date().toISOString()
      });
      alert('Pedido rejeitado.');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 rounded-3xl bg-white/5 border border-white/10 w-full max-w-md text-center space-y-6"
        >
          <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold">Acesso Restrito</h2>
          <p className="text-gray-400">Insira o PIN do administrador para continuar.</p>
          {error && (
            <p className="text-red-500 text-sm font-medium animate-bounce">{error}</p>
          )}
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Digite o PIN"
              className="w-full px-4 py-3 rounded-xl bg-black border border-white/20 focus:border-amber-500 outline-none text-center text-2xl tracking-widest"
              maxLength={4}
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors"
            >
              Entrar
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 relative">
      {/* Floating Notifications */}
      <div className="fixed bottom-8 right-8 z-50 space-y-4 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              className="pointer-events-auto w-80 p-4 rounded-2xl bg-emerald-600 border border-emerald-400 shadow-2xl flex items-start gap-4"
            >
              <div className="p-2 rounded-xl bg-white/20">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest">Novo Pagamento PIX</p>
                <p className="text-sm font-bold text-white line-clamp-1">{n.userEmail}</p>
                <p className="text-xs text-emerald-100 mt-1">Comprou: {n.productName}</p>
                <button
                  onClick={() => handleApprovePix(n)}
                  className="mt-3 w-full py-2 rounded-lg bg-white text-emerald-600 text-xs font-black hover:bg-emerald-50 transition-colors"
                >
                  LIBERAR AGORA
                </button>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                className="text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black tracking-tighter">PAINEL ADM</h1>
        <div className="px-4 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-widest">
          ADMINISTRADOR
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-3 space-y-6">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20">
              <Sparkles className="w-6 h-6 text-amber-500" />
            </div>
            PEDIDOS PIX PENDENTES
            {pendingOrders.length > 0 && (
              <span className="px-2 py-1 rounded-md bg-amber-500 text-black text-[10px] font-black">
                {pendingOrders.length}
              </span>
            )}
          </h2>

          {pendingOrders.length === 0 ? (
            <div className="p-12 rounded-3xl border-2 border-dashed border-white/5 text-center space-y-4">
              <p className="text-gray-500 font-medium">Nenhum pedido aguardando aprovação no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {pendingOrders.map((order) => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-6 hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Produto</p>
                      <h3 className="font-bold text-lg leading-tight">{order.productName}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Valor</p>
                      <p className="text-emerald-400 font-black">R$ {(order.price || order.amount || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cliente</p>
                    <p className="text-sm text-gray-300 font-medium break-all">{order.userEmail}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Comprovante</p>
                    <a 
                      href={order.receiptUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block relative group aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black"
                    >
                      <img 
                        src={order.receiptUrl} 
                        alt="Comprovante" 
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <ExternalLink className="w-6 h-6 text-white" />
                      </div>
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => handleRejectPix(order)}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-500 font-bold text-sm hover:bg-red-500 hover:text-white transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      REJEITAR
                    </button>
                    <button
                      onClick={() => handleApprovePix(order)}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-black font-black text-sm hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <Check className="w-4 h-4" />
                      LIBERAR
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* PIX Settings Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Configurações PIX
          </h2>
          <form onSubmit={handleUpdatePixSettings} className="space-y-4 p-6 rounded-3xl bg-white/5 border border-white/10">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Chave PIX (E-mail, CPF, Telefone ou Aleatória)</label>
              <input
                type="text"
                value={pixSettings.pixKey}
                onChange={(e) => setPixSettings({ ...pixSettings, pixKey: e.target.value })}
                placeholder="Chave PIX"
                className="w-full px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-emerald-500 outline-none text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nome do Destinatário (Exato)</label>
              <input
                type="text"
                value={pixSettings.pixRecipient}
                onChange={(e) => setPixSettings({ ...pixSettings, pixRecipient: e.target.value })}
                placeholder="Nome Completo"
                className="w-full px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-emerald-500 outline-none text-sm"
              />
              <p className="text-[10px] text-gray-500 italic">A IA usará este nome para validar o comprovante.</p>
            </div>
            <button
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors font-bold text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Salvar Dados PIX'}
            </button>
          </form>

          <h2 className="text-xl font-bold flex items-center gap-2 pt-6">
            <Plus className="w-5 h-5 text-purple-400" />
            Categorias
          </h2>
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Nova categoria"
              className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500 outline-none"
            />
            <button
              disabled={loading}
              className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-6 h-6" />
            </button>
          </form>
          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 group">
                <span>{cat.name}</span>
                <button
                  onClick={() => handleDelete('categories', cat.id)}
                  className="p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Products Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              {editingId ? <Edit2 className="w-5 h-5 text-amber-400" /> : <Plus className="w-5 h-5 text-pink-400" />}
              {editingId ? 'Editar Produto' : 'Novo Produto'}
            </h2>
            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setProductForm({ name: '', description: '', price: '', categoryId: '', downloadUrl: '', stock: '10', image: null });
                }}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
                CANCELAR EDIÇÃO
              </button>
            )}
          </div>
          <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-3xl bg-white/5 border border-white/10">
            <div className="space-y-4">
              <input
                type="text"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Nome do produto"
                className="w-full px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-pink-500 outline-none"
              />
              <textarea
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                placeholder="Descrição"
                className="w-full px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-pink-500 outline-none h-24"
              />
              <div className="flex gap-4">
                <input
                  type="number"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  placeholder="Preço (R$)"
                  className="flex-1 px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-pink-500 outline-none"
                />
                <input
                  type="number"
                  value={productForm.stock}
                  onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                  placeholder="Estoque"
                  className="w-24 px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-pink-500 outline-none"
                />
                <select
                  value={productForm.categoryId}
                  onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                  className="flex-1 px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-pink-500 outline-none"
                >
                  <option value="">Categoria</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={productForm.downloadUrl}
                onChange={(e) => setProductForm({ ...productForm, downloadUrl: e.target.value })}
                placeholder="Link de Download ou Acesso (Mega, Drive, Link, etc.)"
                className="w-full px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-pink-500 outline-none"
              />
              <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-white/10 hover:border-pink-500/50 cursor-pointer transition-colors group">
                {productForm.image ? (
                  <span className="text-pink-400 text-sm font-medium">{productForm.image.name}</span>
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 text-gray-500 group-hover:text-pink-400 transition-colors" />
                    <span className="text-gray-500 text-xs mt-2">Upload Capa (16:9)</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProductForm({ ...productForm, image: e.target.files?.[0] || null })}
                  className="hidden"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-all ${
                  editingId 
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500' 
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
                }`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingId ? 'Salvar Alterações' : 'Cadastrar Produto')}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(prod => (
              <div key={prod.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex gap-4 group">
                <img src={prod.imageUrl} alt={prod.name} className="w-24 h-24 object-cover rounded-lg" />
                <div className="flex-1">
                  <h3 className="font-bold">{prod.name}</h3>
                  <div className="flex items-center gap-3">
                    <p className="text-purple-400 font-bold">R$ {prod.price.toFixed(2)}</p>
                    <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                      <span className="text-[10px] text-gray-500 uppercase font-bold">Estoque:</span>
                      <input
                        type="number"
                        defaultValue={prod.stock || 0}
                        onBlur={(e) => handleUpdateStock(prod.id, parseInt(e.target.value))}
                        className="w-12 bg-transparent text-xs font-bold outline-none focus:text-pink-400"
                      />
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs line-clamp-1">{prod.description}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleEditClick(prod)}
                    className="p-2 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-400/10 rounded-lg"
                    title="Editar Produto"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('products', prod.id)}
                    className="p-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-400/10 rounded-lg"
                    title="Excluir Produto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
