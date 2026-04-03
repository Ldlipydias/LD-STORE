import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc, setDoc, getDoc, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { uploadToImgBB } from '../services/imgbb';
import { Plus, Trash2, Image as ImageIcon, Loader2, Lock, Edit2, X, Sparkles, Check, XCircle, ExternalLink, Bell, MessageSquare, Users, Send, ShoppingBag, Mail, Activity, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Admin() {
  const [pin, setPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pixSettings, setPixSettings] = useState({ pixKey: '', pixRecipient: '' });
  const [supportEmail, setSupportEmail] = useState('kakaxe188@gmail.com');
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [supportQueueCount, setSupportQueueCount] = useState(110);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [adminReply, setAdminReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'support' | 'products' | 'settings' | 'users'>('orders');
  const [users, setUsers] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [messageModal, setMessageModal] = useState<{ show: boolean; user: any; subject: string; body: string } | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [rejectingOrder, setRejectingOrder] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPushPermission(Notification.permission);
    }

    // Check if already subscribed
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
          if (subscription) {
            setPushSubscribed(true);
            // Re-sync with server to ensure it's in Firestore
            fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(subscription)
            }).catch(err => console.error('Push re-sync error:', err));
          }
        });
      });
    }
  }, []);

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Seu navegador não suporta notificações push.');
      return;
    }

    setSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Get VAPID public key from server
      const response = await fetch('/api/push/vapid-public-key');
      const contentType = response.headers.get('content-type');
      
      let publicKey;
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        publicKey = data.publicKey;
      } else {
        const text = await response.text();
        console.error('VAPID Key Non-JSON Response:', text);
        throw new Error(`Erro ao buscar chave VAPID (Status: ${response.status}).`);
      }

      if (!publicKey) {
        throw new Error('Chave VAPID pública não encontrada no servidor.');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      setPushPermission(Notification.permission);

      // Send subscription to server
      const subResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      if (!subResponse.ok) {
        const subData = await subResponse.json().catch(() => ({ error: 'Erro ao salvar inscrição no servidor.' }));
        throw new Error(subData.error || 'Erro ao salvar inscrição no servidor.');
      }

      setPushSubscribed(true);
      alert('Notificações ativadas com sucesso! Você receberá alertas reais no seu celular.');
    } catch (error: any) {
      console.error('Push subscription error:', error);
      alert('Erro ao ativar notificações: ' + error.message);
    } finally {
      setSubscribing(false);
    }
  };

  const handleTestPushNotification = async () => {
    try {
      const response = await fetch('/api/push/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🔔 Teste de Notificação',
          body: 'Esta é uma notificação de teste enviada do painel administrativo. Se você recebeu isso, as notificações estão funcionando!',
          url: '/admin'
        })
      });
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.success) {
          alert(`Notificação enviada com sucesso para ${data.sentCount} dispositivo(s)!`);
        } else {
          const errorMsg = data.error || 'Erro desconhecido';
          if (errorMsg.includes('inscrito encontrado')) {
            alert('Aviso: ' + errorMsg);
          } else {
            alert('Erro ao enviar notificação: ' + errorMsg);
          }
        }
      } else {
        const text = await response.text();
        console.error('Push Notification Non-JSON Response:', text);
        alert(`Erro: Resposta do servidor não é JSON (Status: ${response.status}).`);
      }
    } catch (error: any) {
      alert('Erro: ' + error.message);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  useEffect(() => {
    if (selectedTicket) {
      const updated = supportTickets.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    }
  }, [supportTickets]);

  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    downloadUrl: '',
    stock: '10',
    image: null as File | null,
    currentImageUrl: '',
    sampleImages: [] as (File | string)[]
  });

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
      fetchPixSettings();
      fetchSupportSettings();

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

              // Trigger Real Push Notification to Admin
              fetch('/api/push/notify-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: '💰 Novo Pedido PIX',
                  body: `Novo pedido de ${newOrder.userEmail} no valor de R$ ${newOrder.total?.toFixed(2) || (newOrder.price || 0).toFixed(2)}`,
                  url: '/admin'
                })
              }).catch(err => console.error('Push error:', err));

              // Auto remove notification after 10 seconds
              setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== newOrder.id));
              }, 10000);
            }
          }
        });

        setPendingOrders(orders);
      });

      // Listen for support tickets
      const supportQ = query(
        collection(db, 'support_tickets'),
        orderBy('updatedAt', 'desc')
      );

      const unsubscribeSupport = onSnapshot(supportQ, (snapshot) => {
        const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSupportTickets(tickets);

        // Check for new messages to show notification
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const ticket = { id: change.doc.id, ...change.doc.data() } as any;
            if (ticket.unreadByAdmin > 0) {
              setNotifications(prev => {
                const existing = prev.find(n => n.id === `support-${ticket.id}`);
                if (existing && existing.unreadCount === ticket.unreadByAdmin) return prev;
                
                const newNotif = {
                  id: `support-${ticket.id}`,
                  type: 'support',
                  ticketId: ticket.id,
                  userEmail: ticket.userEmail,
                  unreadCount: ticket.unreadByAdmin,
                  message: 'Nova mensagem de suporte'
                };
                
                // Trigger Real Push Notification to Admin
                fetch('/api/push/notify-admin', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: '💬 Nova Mensagem de Suporte',
                    body: `Mensagem de ${ticket.userEmail}`,
                    url: '/admin'
                  })
                }).catch(err => console.error('Push error:', err));

                return [...prev.filter(n => n.id !== `support-${ticket.id}`), newNotif];
              });
            } else {
               setNotifications(prev => prev.filter(n => n.id !== `support-${ticket.id}`));
            }
          }
        });
      });

      // Listen for support queue count
      const unsubscribeQueue = onSnapshot(doc(db, 'settings', 'support'), (docSnap) => {
        if (docSnap.exists()) {
          setSupportQueueCount(docSnap.data().virtualQueueCount || 0);
        } else {
          setDoc(doc(db, 'settings', 'support'), { virtualQueueCount: 110 });
        }
      });

      return () => {
        unsubscribe();
        unsubscribeSupport();
        unsubscribeQueue();
      };
    }
  }, [isAuthorized]);

  const fetchData = async () => {
    const prods = await getDocs(query(collection(db, 'products'), orderBy('name')));
    setProducts(prods.docs.map(d => ({ id: d.id, ...d.data() })));

    const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
    setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    setAllOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchPixSettings = async () => {
    const settingsDoc = await getDoc(doc(db, 'settings', 'pix'));
    if (settingsDoc.exists()) {
      setPixSettings(settingsDoc.data() as any);
    }
  };

  const fetchSupportSettings = async () => {
    const supportDoc = await getDoc(doc(db, 'settings', 'support'));
    if (supportDoc.exists()) {
      const data = supportDoc.data();
      if (data.email) setSupportEmail(data.email);
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

  const handleUpdateSupportEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'support'), { email: supportEmail }, { merge: true });
      alert('E-mail de suporte atualizado!');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestApiHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        setTestEmailResult({
          success: true,
          message: `API Health: ${data.status} | DB: ${data.databaseId} | Inscritos: ${data.subscriptionCount} | VAPID: ${data.vapidConfigured ? 'OK' : 'FALTA'} | ${new Date(data.timestamp).toLocaleString()}`
        });
      } else {
        const text = await response.text();
        console.error('API Health Non-JSON Response:', text);
        setTestEmailResult({
          success: false,
          message: `Erro: Resposta não é JSON (Status: ${response.status}). Verifique o console.`
        });
      }
    } catch (error: any) {
      setTestEmailResult({
        success: false,
        message: `Erro de Saúde da API: ${error.message}`
      });
    }
  };

  const handleTestEmailConfig = async () => {
    setTestingEmail(true);
    setTestEmailResult(null);
    try {
      const response = await fetch('/api/test-email-config');
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        setTestEmailResult({
          success: data.success,
          message: data.success ? data.message : `Erro: ${data.error}`
        });
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        setTestEmailResult({
          success: false,
          message: `Erro do servidor: O servidor retornou uma resposta inesperada (HTML). Isso pode acontecer se o servidor estiver reiniciando. Por favor, aguarde alguns segundos e tente novamente.`
        });
      }
    } catch (error: any) {
      setTestEmailResult({
        success: false,
        message: `Erro de conexão: ${error.message}`
      });
    } finally {
      setTestingEmail(false);
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

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price) return;
    setLoading(true);
    try {
      let imageUrl = '';
      if (productForm.image) {
        imageUrl = await uploadToImgBB(productForm.image);
      }

      const sampleImageUrls: string[] = [];
      for (const item of productForm.sampleImages) {
        if (typeof item === 'string') {
          sampleImageUrls.push(item);
        } else {
          const url = await uploadToImgBB(item);
          sampleImageUrls.push(url);
        }
      }

      if (editingId) {
        const updateData: any = {
          name: productForm.name,
          description: productForm.description,
          price: parseFloat(productForm.price),
          stock: parseInt(productForm.stock) || 0,
          downloadUrl: productForm.downloadUrl,
          sampleImages: sampleImageUrls
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
          downloadUrl: productForm.downloadUrl,
          imageUrl,
          sampleImages: sampleImageUrls,
          createdAt: new Date().toISOString()
        });
      }
      setProductForm({ name: '', description: '', price: '', downloadUrl: '', stock: '10', image: null, currentImageUrl: '', sampleImages: [] });
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
      downloadUrl: prod.downloadUrl || '',
      stock: (prod.stock || 0).toString(),
      image: null,
      currentImageUrl: prod.imageUrl || '',
      sampleImages: prod.sampleImages || []
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (coll: string, id: string) => {
    setConfirmModal({
      show: true,
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, coll, id));
          fetchData();
        } catch (error) {
          console.error(error);
          alert('Erro ao excluir item.');
        } finally {
          setConfirmModal(null);
        }
      }
    });
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
    if (!confirm(`Deseja aprovar o pagamento de $ ${order.total?.toFixed(2) || (order.price || order.amount || 0).toFixed(2)} para o produto ${order.productName}?`)) return;
    
    setLoading(true);
    try {
      // 1. Update order status
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'paid',
        approvedAt: new Date().toISOString()
      });

      // 2. Decrease stock
      if (order.productId) {
        const productDoc = await getDoc(doc(db, 'products', order.productId));
        if (productDoc.exists()) {
          const currentStock = productDoc.data().stock || 0;
          await updateDoc(doc(db, 'products', order.productId), {
            stock: Math.max(0, currentStock - 1)
          });
        }
      }

      alert('Produto liberado com sucesso!');
      
      // Send email notification about approval
      if (order.userEmail) {
        try {
          console.log('Sending approval email to:', order.userEmail);
          await fetch('/api/send-support-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: order.userEmail,
              subject: `[Pagamento Aprovado] Seu pedido: ${order.productName} - LD STORE`,
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                  <h2 style="color: #10b981;">Pagamento Aprovado!</h2>
                  <p>Olá,</p>
                  <p>Seu pagamento para o produto <strong>${order.productName}</strong> foi aprovado com sucesso.</p>
                  <p>Você já pode acessar seu produto em nosso site na seção de "Meus Pedidos".</p>
                  <p style="font-size: 12px; color: #666; margin-top: 30px;">LD STORE - Obrigado pela sua compra!</p>
                </div>
              `
            })
          });
        } catch (emailError) {
          console.error('Error sending approval email:', emailError);
        }
      }

      fetchData();
    } catch (error: any) {
      console.error('Erro ao aprovar PIX:', error);
      alert(`Erro ao liberar produto: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectPix = async () => {
    if (!rejectingOrder) return;
    if (!rejectingOrder.userEmail) {
      alert('Erro: Este pedido não possui um e-mail de usuário associado para notificação.');
      return;
    }

    setIsRejecting(true);
    console.log('Attempting to reject order and notify:', rejectingOrder.userEmail);
    try {
      await updateDoc(doc(db, 'orders', rejectingOrder.id), {
        status: 'rejected',
        rejectionReason: rejectionReason,
        rejectedAt: new Date().toISOString()
      });

      // Send email notification about rejection
      try {
        await fetch('/api/send-support-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: rejectingOrder.userEmail,
            subject: `[Pedido Rejeitado] Atualização sobre seu pedido na LD STORE`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #ef4444;">Pedido Rejeitado</h2>
                <p>Olá,</p>
                <p>Infelizmente seu pedido do produto <strong>${rejectingOrder.productName}</strong> foi rejeitado.</p>
                <div style="background: #fee2e2; padding: 15px; border-radius: 10px; margin: 20px 0;">
                  <strong>Motivo:</strong> ${rejectionReason}
                </div>
                <p>Se você acredita que isso foi um erro, por favor entre em contato com nosso suporte.</p>
                <p style="font-size: 12px; color: #666; margin-top: 30px;">LD STORE - Agradecemos a compreensão.</p>
              </div>
            `
          })
        });
      } catch (emailError) {
        console.error('Error sending rejection email:', emailError);
      }

      setRejectingOrder(null);
      setRejectionReason('');
    } catch (error) {
      console.error(error);
      alert('Erro ao rejeitar pedido.');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleReplyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminReply.trim() || !selectedTicket) return;
    if (!selectedTicket.userEmail) {
      alert('Erro: Este chamado não possui um e-mail de usuário associado.');
      return;
    }
    setReplying(true);
    console.log('Attempting to reply to support ticket for:', selectedTicket.userEmail);
    try {
      const newMessage = {
        id: Date.now().toString(),
        sender: 'admin',
        text: adminReply,
        createdAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'support_tickets', selectedTicket.id), {
        messages: [...selectedTicket.messages, newMessage],
        updatedAt: new Date().toISOString(),
        unreadByUser: (selectedTicket.unreadByUser || 0) + 1,
        unreadByAdmin: 0,
        status: 'open'
      });

      const response = await fetch('/api/send-support-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedTicket.userEmail,
          subject: `[Suporte] Resposta ao seu chamado - LD STORE`,
          text: `Você recebeu uma nova resposta no seu chamado de suporte: "${adminReply.substring(0, 100)}..."`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #6366f1;">Nova Resposta do Suporte</h2>
              <p>Olá, você recebeu uma nova resposta no seu chamado de suporte.</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; margin: 20px 0;">
                <p style="margin: 0; font-style: italic;">"${adminReply}"</p>
              </div>
              <p>Acesse a loja para visualizar a conversa completa.</p>
            </div>
          `
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Email notification error:', errorData.error);
      }

      setAdminReply('');
    } catch (error) {
      console.error(error);
    } finally {
      setReplying(false);
    }
  };

  const handleDeliverProduct = async (product: any) => {
    if (!selectedTicket) return;
    if (!product) return;
    if (!selectedTicket.userEmail) {
      alert('Erro: Este chamado não possui um e-mail de usuário associado para entrega.');
      return;
    }
    
    setDelivering(true);
    console.log('Attempting to deliver to:', selectedTicket.userEmail);
    try {
      // 1. Send email with product
      const response = await fetch('/api/send-support-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedTicket.userEmail,
          subject: `[Entrega] Seu produto: ${product.name} - LD STORE`,
          text: `Olá! Seu produto "${product.name}" está pronto para download. Link: ${product.downloadUrl}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #6366f1;">Entrega de Produto</h2>
              <p>Olá! Seu produto <strong>${product.name}</strong> já está disponível.</p>
              <div style="margin: 30px 0;">
                <a href="${product.downloadUrl}" style="background: #6366f1; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  BAIXAR PRODUTO AGORA
                </a>
              </div>
              <p style="font-size: 12px; color: #666;">Se o botão acima não funcionar, copie e cole este link no seu navegador: ${product.downloadUrl}</p>
              <p>Obrigado por comprar na LD STORE!</p>
            </div>
          `
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar e-mail');
      }

      // 2. Add message to chat
      const newMessage = {
        id: Date.now().toString(),
        sender: 'admin',
        text: `PRODUTO ENTREGUE: ${product.name}\nLINK: ${product.downloadUrl}`,
        createdAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'support_tickets', selectedTicket.id), {
        messages: [...selectedTicket.messages, newMessage],
        updatedAt: new Date().toISOString(),
        unreadByUser: (selectedTicket.unreadByUser || 0) + 1,
        unreadByAdmin: 0
      });

      alert('Produto entregue com sucesso!');
      setShowDeliverModal(false);
    } catch (error: any) {
      console.error(error);
      alert('Erro ao entregar produto: ' + error.message);
    } finally {
      setDelivering(false);
    }
  };

  const handleMarkTicketResolved = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), {
        status: 'resolved',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageModal || !messageModal.body.trim()) return;
    setSendingMessage(true);
    if (!messageModal.user?.email) {
      alert('Erro: Este usuário não possui um e-mail cadastrado.');
      setSendingMessage(false);
      return;
    }
    console.log('Attempting to send manual message to:', messageModal.user.email);
    try {
      const response = await fetch('/api/send-support-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: messageModal.user.email,
          subject: messageModal.subject || 'Novidades da LD STORE',
          text: messageModal.body,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #6366f1;">LD STORE - Novidades</h2>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 15px; margin: 20px 0; line-height: 1.6;">
                ${messageModal.body.replace(/\n/g, '<br>')}
              </div>
              <p style="font-size: 12px; color: #666;">Você está recebendo este e-mail porque possui uma conta na LD STORE.</p>
            </div>
          `
        })
      });

      if (!response.ok) throw new Error('Erro ao enviar e-mail');
      alert('Mensagem enviada com sucesso!');
      setMessageModal(null);
    } catch (error: any) {
      alert('Erro: ' + error.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUpdateQueueCount = async (newCount: number) => {
    try {
      await setDoc(doc(db, 'settings', 'support'), { virtualQueueCount: Math.max(0, newCount) }, { merge: true });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectTicket = async (ticket: any) => {
    setSelectedTicket(ticket);
    if (ticket.unreadByAdmin > 0) {
      try {
        await updateDoc(doc(db, 'support_tickets', ticket.id), {
          unreadByAdmin: 0
        });
      } catch (error) {
        console.error(error);
      }
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
          <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-purple-500" />
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
              className="w-full px-4 py-3 rounded-xl bg-black border border-white/20 focus:border-purple-500 outline-none text-center text-2xl tracking-widest"
              maxLength={4}
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-purple-500 text-black font-bold hover:bg-purple-400 transition-colors"
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
      {/* Deliver Product Modal */}
      <AnimatePresence>
        {showDeliverModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-black tracking-tighter">ENTREGAR PRODUTO</h3>
                <button onClick={() => setShowDeliverModal(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <p className="text-sm text-gray-400">Selecione o produto para enviar ao e-mail do cliente:</p>
                <div className="space-y-2">
                  {products.map(prod => (
                    <button
                      key={prod.id}
                      disabled={delivering}
                      onClick={() => handleDeliverProduct(prod)}
                      className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/50 transition-all text-left flex items-center justify-between group"
                    >
                      <div>
                        <p className="font-bold text-sm">{prod.name}</p>
                        <p className="text-xs text-gray-500">$ {prod.price.toFixed(2)}</p>
                      </div>
                      <Send className="w-4 h-4 text-gray-500 group-hover:text-amber-500 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
              {delivering && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                    <p className="text-sm font-bold">Enviando e-mail...</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {rejectingOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 border border-white/10 rounded-[2rem] w-full max-w-md p-8 space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-xl font-black uppercase tracking-tight">Rejeitar Pedido</h2>
                <p className="text-gray-400 text-sm">Informe o motivo da rejeição para o cliente.</p>
              </div>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Comprovante inválido, valor incorreto..."
                className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 focus:border-red-500 outline-none h-32 text-sm"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRejectingOrder(null);
                    setRejectionReason('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-sm transition-all"
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleRejectPix}
                  disabled={isRejecting}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {isRejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  REJEITAR AGORA
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {confirmModal && confirmModal.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 border border-white/10 rounded-[2rem] w-full max-w-md p-8 space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-xl font-black uppercase tracking-tight">{confirmModal.title}</h2>
                <p className="text-gray-400 text-sm">{confirmModal.message}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-sm transition-all"
                >
                  CANCELAR
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-all"
                >
                  CONFIRMAR
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {messageModal && messageModal.show && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 border border-white/10 rounded-[2rem] w-full max-w-lg p-8 space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-xl font-black uppercase tracking-tight">Enviar Mensagem</h2>
                <p className="text-gray-400 text-sm">Para: {messageModal.user.email}</p>
              </div>

              <form onSubmit={handleSendMessage} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Assunto</label>
                  <input
                    type="text"
                    value={messageModal.subject}
                    onChange={(e) => setMessageModal({ ...messageModal, subject: e.target.value })}
                    placeholder="Ex: Novidades da LD STORE"
                    className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Mensagem</label>
                  <textarea
                    value={messageModal.body}
                    onChange={(e) => setMessageModal({ ...messageModal, body: e.target.value })}
                    placeholder="Digite sua mensagem aqui..."
                    className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none h-48 text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMessageModal(null)}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-sm transition-all"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    disabled={sendingMessage || !messageModal.body.trim()}
                    className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    ENVIAR AGORA
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Notifications */}
      <div className="fixed bottom-8 right-8 z-50 space-y-4 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              className={`pointer-events-auto w-80 p-4 rounded-2xl border shadow-2xl flex items-start gap-4 ${
                n.type === 'support' 
                  ? 'bg-blue-600 border-blue-400' 
                  : 'bg-emerald-600 border-emerald-400'
              }`}
            >
              <div className="p-2 rounded-xl bg-white/20">
                {n.type === 'support' ? <MessageSquare className="w-5 h-5 text-white" /> : <Bell className="w-5 h-5 text-white" />}
              </div>
              <div className="flex-1">
                {n.type === 'support' ? (
                  <>
                    <p className="text-xs font-bold text-blue-100 uppercase tracking-widest">Suporte</p>
                    <p className="text-sm font-bold text-white line-clamp-1">{n.userEmail}</p>
                    <p className="text-xs text-blue-100 mt-1">{n.unreadCount} nova(s) mensagem(ns)</p>
                    <button
                      onClick={() => {
                        const ticket = supportTickets.find(t => t.id === n.ticketId);
                        if (ticket) handleSelectTicket(ticket);
                        setNotifications(prev => prev.filter(notif => notif.id !== n.id));
                        document.getElementById('support-section')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="mt-3 w-full py-2 rounded-lg bg-white text-blue-600 text-xs font-black hover:bg-blue-50 transition-colors"
                    >
                      VER MENSAGEM
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest">Novo Pagamento PIX</p>
                    <p className="text-sm font-bold text-white line-clamp-1">{n.userEmail}</p>
                    <p className="text-xs text-emerald-100 mt-1">Comprou: {n.productName}</p>
                    <button
                      onClick={() => handleApprovePix(n)}
                      className="mt-3 w-full py-2 rounded-lg bg-white text-emerald-600 text-xs font-black hover:bg-emerald-50 transition-colors"
                    >
                      LIBERAR AGORA
                    </button>
                  </>
                )}
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <ShieldCheck className="w-6 h-6 text-purple-400" />
            </div>
            <h1 className="text-5xl font-black tracking-tighter pro-gradient-text">
              PAINEL <span className="italic font-serif font-light lowercase">adm</span>
            </h1>
          </div>
          <p className="text-gray-500 max-w-md font-medium leading-relaxed">
            Gerencie seus produtos, pedidos e suporte com ferramentas de alta performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white/[0.03] p-2 rounded-2xl border border-white/5">
          <button
            onClick={subscribeToPush}
            disabled={subscribing || pushSubscribed}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              pushSubscribed 
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                : 'bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20'
            }`}
          >
            {subscribing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : pushSubscribed ? (
              <Check className="w-3 h-3" />
            ) : (
              <Bell className="w-3 h-3" />
            )}
            {pushSubscribed ? 'NOTIFICAÇÕES ATIVAS' : 'ATIVAR NOTIFICAÇÕES REAL'}
          </button>

          {[
            { id: 'orders', label: 'Pedidos', icon: ShoppingBag, count: pendingOrders.length },
            { id: 'users', label: 'Clientes', icon: Users, count: users.length },
            { id: 'support', label: 'Suporte', icon: MessageSquare, count: supportTickets.filter(t => t.unreadByAdmin).length },
            { id: 'products', label: 'Produtos', icon: ImageIcon },
            { id: 'settings', label: 'Ajustes', icon: Activity }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                activeTab === tab.id 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' 
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-white text-black text-[8px]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12">
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/20">
                <Sparkles className="w-6 h-6 text-purple-500" />
              </div>
              PEDIDOS PIX PENDENTES
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
                      <p className="text-emerald-400 font-black">$ {(order.price || order.amount || 0).toFixed(2)}</p>
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
                      onClick={() => setRejectingOrder(order)}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-500 font-bold text-sm hover:bg-red-500 hover:text-white transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      REJEITAR
                    </button>
                    <button
                      onClick={() => handleApprovePix(order)}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-500 text-black font-black text-sm hover:bg-purple-400 transition-all shadow-lg shadow-purple-500/20"
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
      )}

        {/* Support Tickets Section */}
        {activeTab === 'support' && (
          <div id="support-section" className="space-y-6">
            <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/20">
                <MessageSquare className="w-6 h-6 text-purple-500" />
              </div>
              SUPORTE & ATENDIMENTO
              {supportTickets.filter(t => t.status === 'open').length > 0 && (
                <span className="px-2 py-1 rounded-md bg-purple-500 text-white text-[10px] font-black">
                  {supportTickets.filter(t => t.status === 'open').length}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-4 bg-white/5 p-2 rounded-xl border border-white/10">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-bold text-gray-400 uppercase hidden sm:inline">Fila Virtual:</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleUpdateQueueCount(supportQueueCount - 1)}
                  className="w-8 h-8 rounded-lg bg-black border border-white/10 flex items-center justify-center hover:border-purple-500 transition-colors"
                >
                  -
                </button>
                <span className="font-mono font-bold w-8 text-center">{supportQueueCount}</span>
                <button 
                  onClick={() => handleUpdateQueueCount(supportQueueCount + 1)}
                  className="w-8 h-8 rounded-lg bg-black border border-white/10 flex items-center justify-center hover:border-purple-500 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ticket List */}
            <div className="lg:col-span-1 space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {supportTickets.length === 0 ? (
                <div className="p-8 rounded-3xl border-2 border-dashed border-white/5 text-center">
                  <p className="text-gray-500 font-medium text-sm">Nenhum ticket de suporte.</p>
                </div>
              ) : (
                supportTickets.map(ticket => (
                    <button
                      key={ticket.id}
                      onClick={() => handleSelectTicket(ticket)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all ${
                        selectedTicket?.id === ticket.id
                          ? 'bg-purple-500/10 border-purple-500/50'
                          : 'bg-white/5 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                          ticket.status === 'open' ? 'bg-purple-500/20 text-purple-500' : 'bg-emerald-500/20 text-emerald-500'
                        }`}>
                          {ticket.status === 'open' ? 'Aberto' : 'Resolvido'}
                        </span>
                        {ticket.unreadByAdmin > 0 && (
                          <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {ticket.unreadByAdmin}
                          </span>
                        )}
                      </div>
                    <p className="font-bold text-sm line-clamp-1">{ticket.userEmail}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">Pedido: {ticket.orderId}</p>
                    <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                      {ticket.messages[ticket.messages.length - 1]?.text}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Chat Area */}
            <div className="lg:col-span-2">
              {selectedTicket ? (
                <div className="flex flex-col h-[600px] rounded-3xl bg-white/5 border border-white/10 overflow-hidden">
                  {/* Chat Header */}
                  <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
                    <div>
                      <p className="font-bold">{selectedTicket.userEmail}</p>
                      <p className="text-xs text-gray-500">Pedido: {selectedTicket.orderId}</p>
                    </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowDeliverModal(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 text-purple-500 text-xs font-bold hover:bg-purple-500 hover:text-black transition-colors"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          ENTREGAR PRODUTO
                        </button>
                      {selectedTicket.status === 'open' && (
                        <button
                          onClick={() => handleMarkTicketResolved(selectedTicket.id)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-xs font-bold hover:bg-emerald-500 hover:text-white transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          MARCAR RESOLVIDO
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {selectedTicket.messages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.sender === 'admin' ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] p-4 rounded-2xl ${
                            msg.sender === 'admin'
                              ? 'bg-purple-600 text-white rounded-tr-sm'
                              : 'bg-white/10 text-gray-200 rounded-tl-sm'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                          {msg.imageUrl && (
                            <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="block mt-3">
                              <img src={msg.imageUrl} alt="Anexo" className="max-w-full rounded-xl border border-white/10" />
                            </a>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-500 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Reply Input */}
                  {selectedTicket.status === 'open' ? (
                    <form onSubmit={handleReplyTicket} className="p-4 border-t border-white/10 bg-black/20">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={adminReply}
                          onChange={(e) => setAdminReply(e.target.value)}
                          placeholder="Digite sua resposta..."
                          className="flex-1 px-4 py-3 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none text-sm"
                        />
                        <button
                          type="submit"
                          disabled={replying || !adminReply.trim()}
                          className="px-6 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                          {replying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-4 border-t border-white/10 bg-black/20 text-center">
                      <p className="text-sm text-gray-500">Este ticket foi resolvido.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-[600px] rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                  <p>Selecione um ticket para visualizar.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* PIX Settings Section */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-12">
              <div className="space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
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
                      className="w-full px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nome do Destinatário (Exato)</label>
                    <input
                      type="text"
                      value={pixSettings.pixRecipient}
                      onChange={(e) => setPixSettings({ ...pixSettings, pixRecipient: e.target.value })}
                      placeholder="Nome Completo"
                      className="w-full px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none text-sm"
                    />
                    <p className="text-[10px] text-gray-500 italic">A IA usará este nome para validar o comprovante.</p>
                  </div>
                  <button
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-colors font-bold text-sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Salvar Dados PIX'}
                  </button>
                </form>
              </div>

              <div className="space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Mail className="w-5 h-5 text-purple-400" />
                  E-mail de Suporte
                </h2>
                <form onSubmit={handleUpdateSupportEmail} className="space-y-4 p-6 rounded-3xl bg-white/5 border border-white/10">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">E-mail para Notificações</label>
                    <input
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      placeholder="seu-email@exemplo.com"
                      className="w-full px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none text-sm"
                    />
                    <p className="text-[10px] text-gray-500 italic">Este e-mail receberá notificações de novos chamados.</p>
                  </div>
                  <button
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-colors font-bold text-sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Salvar E-mail'}
                  </button>
                </form>

                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Notificações Push (Celular)</h3>
                  <p className="text-xs text-gray-500">Ative as notificações para receber alertas reais de novos pedidos e mensagens de suporte no seu celular.</p>
                  
                <div className="flex flex-col gap-3">
                  {pushPermission === 'denied' && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-bold">
                      ⚠️ Permissão de notificação negada. Você precisa resetar as permissões no seu navegador/celular para ativar.
                    </div>
                  )}
                  
                  <button
                    onClick={subscribeToPush}
                    disabled={subscribing || (pushSubscribed && pushPermission === 'granted')}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      pushSubscribed && pushPermission === 'granted'
                        ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 cursor-default' 
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }`}
                  >
                    {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : (pushSubscribed && pushPermission === 'granted') ? <Check className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                    {(pushSubscribed && pushPermission === 'granted') ? 'NOTIFICAÇÕES ATIVADAS' : 'ATIVAR NOTIFICAÇÕES NESTE DISPOSITIVO'}
                  </button>
                    
                    {pushSubscribed && (
                      <button
                        onClick={handleTestPushNotification}
                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 font-bold text-sm transition-all flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        TESTAR NOTIFICAÇÃO REAL
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Diagnóstico de E-mail</h3>
                  <p className="text-xs text-gray-500">Clique no botão abaixo para testar se a conexão com o servidor de e-mail (SMTP) está funcionando corretamente.</p>
                  
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 font-bold leading-relaxed">
                    IMPORTANTE: Para Gmail, você DEVE usar uma "Senha de App" e ter a Verificação em Duas Etapas ativada. Senhas normais não funcionam em servidores de nuvem como o Netlify.
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={handleTestApiHealth}
                      className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <Activity className="w-4 h-4" />
                      SAÚDE DA API
                    </button>
                    
                    <button
                      onClick={handleTestEmailConfig}
                      disabled={testingEmail}
                      className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors font-bold text-sm flex items-center justify-center gap-2"
                    >
                      {testingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      TESTAR SMTP
                    </button>
                  </div>

                  {testEmailResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-xl text-xs font-medium ${
                        testEmailResult.success 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {testEmailResult.message}
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Section */}
        {activeTab === 'products' && (
          <div className="space-y-12">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              {editingId ? <Edit2 className="w-5 h-5 text-purple-400" /> : <Plus className="w-5 h-5 text-purple-400" />}
              {editingId ? 'Editar Produto' : 'Novo Produto'}
            </h2>
            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setProductForm({ name: '', description: '', price: '', downloadUrl: '', stock: '10', image: null });
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
                className="w-full px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none"
              />
              <textarea
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                placeholder="Descrição"
                className="w-full px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none h-24"
              />
              <div className="flex gap-4">
                <input
                  type="number"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  placeholder="Preço ($)"
                  className="flex-1 px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none"
                />
                <input
                  type="number"
                  value={productForm.stock}
                  onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                  placeholder="Estoque"
                  className="flex-1 px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none"
                />
              </div>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={productForm.downloadUrl}
                onChange={(e) => setProductForm({ ...productForm, downloadUrl: e.target.value })}
                placeholder="Link de Download ou Acesso (Mega, Drive, Link, etc.)"
                className="w-full px-4 py-2 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none"
              />
              <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-white/10 hover:border-purple-500/50 cursor-pointer transition-colors group overflow-hidden relative">
                {productForm.image ? (
                  <span className="text-purple-400 text-sm font-medium z-10 bg-black/50 px-2 py-1 rounded">{productForm.image.name}</span>
                ) : productForm.currentImageUrl ? (
                  <div className="absolute inset-0 w-full h-full">
                    <img src={productForm.currentImageUrl} alt="Current" className="w-full h-full object-cover opacity-50" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-xs font-bold uppercase tracking-widest">Alterar Capa</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 text-gray-500 group-hover:text-purple-400 transition-colors" />
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

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Imagens de Amostra (Opcional)</label>
                <div className="grid grid-cols-4 gap-2">
                  {productForm.sampleImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
                      <img 
                        src={typeof img === 'string' ? img : URL.createObjectURL(img)} 
                        alt={`Sample ${idx}`} 
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setProductForm({
                          ...productForm,
                          sampleImages: productForm.sampleImages.filter((_, i) => i !== idx)
                        })}
                        className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-lg border-2 border-dashed border-white/10 hover:border-purple-500/50 cursor-pointer flex items-center justify-center transition-colors">
                    <Plus className="w-5 h-5 text-gray-500" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setProductForm({
                          ...productForm,
                          sampleImages: [...productForm.sampleImages, ...files]
                        });
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-all ${
                  editingId 
                    ? 'bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-500 hover:to-purple-300' 
                    : 'bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-500 hover:to-purple-300'
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
                    <p className="text-purple-400 font-bold">$ {prod.price.toFixed(2)}</p>
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
        )}

        {/* Users Section */}
        {activeTab === 'users' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20">
                  <Users className="w-6 h-6 text-purple-500" />
                </div>
                HISTÓRICO DE CLIENTES
              </h2>
              <div className="flex items-center gap-4 bg-white/5 p-2 rounded-xl border border-white/10">
                <span className="text-xs font-bold text-gray-400 uppercase px-4">{users.length} USUÁRIOS</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {users.map(user => {
                const userOrders = allOrders.filter(o => o.userId === user.id);
                const totalSpent = userOrders.reduce((acc, o) => acc + (o.price || o.amount || 0), 0);
                
                return (
                  <div key={user.id} className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-purple-500/30 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform">
                        <Users className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <p className="font-black text-lg leading-tight">{user.email}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                          Desde: {new Date(user.createdAt).toLocaleDateString()} • ID: {user.id.substring(0, 8)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                      <div className="text-center md:text-right">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Pedidos</p>
                        <p className="font-black text-white">{userOrders.length}</p>
                      </div>
                      <div className="text-center md:text-right">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Gasto</p>
                        <p className="font-black text-emerald-400">$ {totalSpent.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                        >
                          {selectedUser?.id === user.id ? 'FECHAR HISTÓRICO' : 'VER HISTÓRICO'}
                        </button>
                        <button
                          onClick={() => setMessageModal({ show: true, user, subject: '', body: '' })}
                          className="px-4 py-2 rounded-xl bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-purple-500 transition-all flex items-center gap-2"
                        >
                          <Mail className="w-3 h-3" />
                          MENSAGEM
                        </button>
                      </div>
                    </div>

                    {selectedUser?.id === user.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="w-full mt-6 pt-6 border-t border-white/10 space-y-4"
                      >
                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Histórico de Compras</h4>
                        {userOrders.length === 0 ? (
                          <p className="text-xs text-gray-500 italic">Nenhum pedido realizado ainda.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {userOrders.map(order => (
                              <div key={order.id} className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                                <div className="flex justify-between items-start">
                                  <p className="font-bold text-sm">{order.productName}</p>
                                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                    order.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                  }`}>
                                    {order.status}
                                  </span>
                                </div>
                                <div className="flex justify-between items-end">
                                  <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                                  <p className="font-black text-white text-sm">$ {(order.price || order.amount || 0).toFixed(2)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
