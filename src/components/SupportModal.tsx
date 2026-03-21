import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Loader2, Upload, MessageSquare, Clock, Users, Image as ImageIcon, Check } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc, updateDoc, onSnapshot, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { uploadToImgBB } from '../services/imgbb';
import { sendSupportEmail } from '../services/api';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string | null;
}

export default function SupportModal({ isOpen, onClose, userId, userEmail }: SupportModalProps) {
  const [ticket, setTicket] = useState<any | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [queueCount, setQueueCount] = useState(110);
  const [supportEmail, setSupportEmail] = useState('kakaxe188@gmail.com');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Form for new ticket
  const [orderId, setOrderId] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // Listen to user's most recent ticket
    const q = query(
      collection(db, 'support_tickets'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0];
        const ticketData = { id: docData.id, ...docData.data() } as any;
        setTicket(ticketData);
        setShowCreateForm(false);
        
        // Mark as read by user if it's not resolved or if there are unread messages
        if (ticketData.unreadByUser > 0) {
          updateDoc(doc(db, 'support_tickets', docData.id), {
            unreadByUser: 0
          });
        }
      } else {
        setTicket(null);
        setShowCreateForm(true);
      }
      setLoading(false);
    });

    // Listen to global settings
    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'support'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setQueueCount(data.virtualQueueCount || 110);
        if (data.email) setSupportEmail(data.email);
      } else {
        setQueueCount(110);
        setSupportEmail('kakaxe188@gmail.com');
      }
    });

    return () => {
      unsubscribe();
      settingsUnsubscribe();
    };
  }, [isOpen, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !orderId) {
      alert('Preencha a mensagem e o ID do pedido/comprovante.');
      return;
    }

    setSending(true);
    try {
      let imageUrl = '';
      if (attachment) {
        imageUrl = await uploadToImgBB(attachment);
      }

      const ticketRef = await addDoc(collection(db, 'support_tickets'), {
        userId,
        userEmail,
        orderId,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unreadByUser: 0,
        unreadByAdmin: 1,
        messages: [{
          id: Date.now().toString(),
          sender: 'user',
          text: message,
          imageUrl,
          createdAt: new Date().toISOString()
        }]
      });

      // Send email notification to admin
      await sendSupportEmail(
        supportEmail,
        `[Suporte] Novo Chamado de ${userEmail || 'Usuário'}`,
        `${userEmail || 'Um usuário'} abriu um novo chamado: ${message.substring(0, 100)}...`,
        `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #6366f1;">Novo Chamado de Suporte</h2>
            <p><strong>Usuário:</strong> ${userEmail || 'Não identificado'}</p>
            <p><strong>ID do Pedido:</strong> ${orderId}</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; margin: 20px 0;">
              <p style="margin: 0; font-style: italic;">"${message}"</p>
            </div>
            <p>Acesse o painel administrativo para responder.</p>
          </div>
        `,
        userEmail || undefined
      );

      setMessage('');
      setAttachment(null);
      setOrderId('');
    } catch (error: any) {
      console.error(error);
      alert('Erro ao criar ticket: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message && !attachment) return;
    if (!ticket) return;

    setSending(true);
    try {
      let imageUrl = '';
      if (attachment) {
        imageUrl = await uploadToImgBB(attachment);
      }

      const newMessage = {
        id: Date.now().toString(),
        sender: 'user',
        text: message,
        imageUrl,
        createdAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'support_tickets', ticket.id), {
        messages: [...(ticket.messages || []), newMessage],
        updatedAt: new Date().toISOString(),
        unreadByAdmin: (ticket.unreadByAdmin || 0) + 1
      });

      // Send email notification to admin
      await sendSupportEmail(
        supportEmail,
        `[Suporte] Nova Mensagem de ${userEmail || 'Usuário'}`,
        `${userEmail || 'Um usuário'} enviou uma mensagem: ${message.substring(0, 100)}...`,
        `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #6366f1;">Nova Mensagem no Chamado</h2>
            <p><strong>Usuário:</strong> ${userEmail || 'Não identificado'}</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; margin: 20px 0;">
              <p style="margin: 0; font-style: italic;">"${message}"</p>
            </div>
            <p>Acesse o painel administrativo para visualizar e responder.</p>
          </div>
        `,
        userEmail || undefined
      );

      setMessage('');
      setAttachment(null);
    } catch (error: any) {
      console.error(error);
      alert('Erro ao enviar mensagem: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col h-[80vh]"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40 backdrop-blur-md z-10">
              <h3 className="text-lg font-black tracking-tighter flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                SUPORTE
              </h3>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : showCreateForm ? (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="text-center space-y-4 mb-8">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto">
                    <MessageSquare className="w-8 h-8 text-purple-400" />
                  </div>
                  <h4 className="text-xl font-bold">Como podemos ajudar?</h4>
                  <p className="text-sm text-gray-400">
                    Abra um chamado informando o ID do seu pedido ou enviando o comprovante.
                  </p>
                  {ticket && ticket.status === 'resolved' && (
                    <button 
                      onClick={() => setShowCreateForm(false)}
                      className="text-[10px] text-purple-400 hover:underline font-bold uppercase tracking-widest"
                    >
                      Voltar para chamado resolvido
                    </button>
                  )}
                </div>

                <form onSubmit={handleCreateTicket} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      ID do Pedido ou Comprovante
                    </label>
                    <input
                      type="text"
                      value={orderId}
                      onChange={(e) => setOrderId(e.target.value)}
                      placeholder="Ex: #12345 ou PIX"
                      className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Mensagem
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Descreva seu problema..."
                      className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none text-sm h-32 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Anexo (Opcional)
                    </label>
                    <label className="flex items-center gap-3 w-full p-3 rounded-xl border border-dashed border-white/20 hover:border-purple-500/50 cursor-pointer transition-colors bg-black/20">
                      <Upload className="w-5 h-5 text-gray-500" />
                      <span className="text-sm text-gray-400 flex-1 truncate">
                        {attachment ? attachment.name : 'Anexar imagem ou comprovante'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={sending || !message || !orderId}
                    className="w-full py-4 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ABRIR CHAMADO'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Queue Status Header / Resolved Status */}
                <div className={`${ticket.status === 'resolved' ? 'bg-emerald-900/20 border-emerald-500/20' : 'bg-purple-900/20 border-purple-500/20'} border-b p-4 flex flex-col gap-2`}>
                  <div className="flex items-center justify-between">
                    {ticket.status === 'resolved' ? (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-bold uppercase tracking-widest">Chamado Resolvido</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-purple-400">
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-bold">Fila Virtual: {queueCount} pessoas</span>
                      </div>
                    )}
                    
                    {ticket.status !== 'resolved' && (
                      <div className="flex items-center gap-1 text-amber-400">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-bold">30 min a 1h</span>
                      </div>
                    )}

                    {ticket.status === 'resolved' && (
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="text-[10px] font-black bg-emerald-500 text-black px-2 py-1 rounded hover:bg-emerald-400 transition-colors uppercase"
                      >
                        Novo Suporte
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400">
                    {ticket.status === 'resolved' 
                      ? 'Este atendimento foi encerrado. Se precisar de mais ajuda, abra um novo chamado.'
                      : 'Aguarde, um administrador irá responder em breve. A fila é atualizada em tempo real.'}
                  </p>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {ticket.messages?.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[80%] ${
                        msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      <div
                        className={`p-3 rounded-2xl ${
                          msg.sender === 'user'
                            ? 'bg-purple-600 text-white rounded-br-sm'
                            : 'bg-white/10 text-gray-100 rounded-bl-sm'
                        }`}
                      >
                        {msg.imageUrl && (
                          <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                            <img src={msg.imageUrl} alt="Anexo" className="max-w-full h-auto rounded-lg mb-2 max-h-48 object-cover" />
                          </a>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      <span className="text-[10px] text-gray-500 mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                {ticket.status === 'open' ? (
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-zinc-900 flex gap-2 items-end">
                    <label className="p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors text-gray-400 hover:text-white">
                      <ImageIcon className="w-5 h-5" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                    
                    <div className="flex-1 relative">
                      {attachment && (
                        <div className="absolute -top-10 left-0 bg-purple-600 text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          Anexo pronto
                          <button type="button" onClick={() => setAttachment(null)} className="ml-1 hover:text-red-300">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 focus:border-purple-500 outline-none text-sm resize-none h-[48px] min-h-[48px] max-h-32"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                          }
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={sending || (!message.trim() && !attachment)}
                      className="p-3 rounded-xl bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 transition-colors"
                    >
                      {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </form>
                ) : (
                  <div className="p-6 border-t border-white/10 bg-zinc-900 text-center">
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 transition-all"
                    >
                      ABRIR NOVO CHAMADO
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
