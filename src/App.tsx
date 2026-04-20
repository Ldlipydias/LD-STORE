/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// Pages
import Home from './pages/Home';
import Store from './pages/Store';
import Admin from './pages/Admin';
import Success from './pages/Success';
import WalletPage from './pages/Wallet';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    const handleOpenCart = () => setIsCartOpen(true);
    window.addEventListener('open_cart', handleOpenCart);
    return () => window.removeEventListener('open_cart', handleOpenCart);
  }, []);

  useEffect(() => {
    let unsubBalance: (() => void) | null = null;
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Check if user is admin
        if (user.email?.toLowerCase().trim() === 'kakaxe188@gmail.com') {
          setIsAdmin(true);
        }
        
        // Sync user to Firestore
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (!isMounted) return;

          const extractEmail = (u: any) => {
            if (u.email) return u.email;
            if (u.providerData && u.providerData.length > 0) {
              for (const p of u.providerData) {
                if (p.email) return p.email;
              }
            }
            return null;
          };
          
          const currentEmail = extractEmail(user);

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: currentEmail,
              displayName: user.displayName || null,
              photoURL: user.photoURL || null,
              role: currentEmail?.toLowerCase().trim() === 'kakaxe188@gmail.com' ? 'admin' : 'user',
              createdAt: new Date().toISOString()
            });
          } else {
            const data = userSnap.data();
            const updates: any = {};
            if (!data.email && currentEmail) updates.email = currentEmail;
            if (!data.displayName && user.displayName) updates.displayName = user.displayName;
            if (!data.photoURL && user.photoURL) updates.photoURL = user.photoURL;
            
            if (Object.keys(updates).length > 0) {
              await setDoc(userRef, updates, { merge: true });
            }
          }
          
          if (!isMounted) return;

          // Clean up previous listener if it exists
          if (unsubBalance) unsubBalance();

          // Listen for balance updates
          unsubBalance = onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
              const d = snap.data();
              if (d.balance !== undefined) setBalance(d.balance);
              if (d.bonusBalance !== undefined) setBonusBalance(d.bonusBalance);
            }
          }, (err) => {
            console.error("App.tsx balance snapshot error:", err);
          });
        } catch (error) {
           console.error("Erro crítico na sincronização de usuário:", error);
        } finally {
           if (isMounted) setLoading(false);
        }
      } else {
        if (!isMounted) return;
        setUser(null);
        setIsAdmin(false);
        setBalance(0);
        setBonusBalance(0);
        setLoading(false);
        if (unsubBalance) {
          unsubBalance();
          unsubBalance = null;
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (unsubBalance) unsubBalance();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen text-white font-sans selection:bg-purple-500/30">
        <Navbar user={user} isAdmin={isAdmin} />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Store user={user} />} />
            <Route path="/store" element={<Store user={user} />} />
            <Route path="/product/:id" element={<Store user={user} />} />
            <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" />} />
            <Route path="/wallet" element={<WalletPage user={user} />} />
            <Route path="/success" element={<Success user={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        
        <CartDrawer 
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          user={user}
          balance={balance}
          bonusBalance={bonusBalance}
        />
      </div>
    </Router>
  );
}
