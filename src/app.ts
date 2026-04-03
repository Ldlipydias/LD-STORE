import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import cors from 'cors';
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Firebase Configuration for Server
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID
};

if (fs.existsSync(configPath)) {
  try {
    const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    firebaseConfig = { ...firebaseConfig, ...fileConfig };
  } catch (err) {
    console.error('Error reading firebase-applet-config.json:', err);
  }
}

import { initializeApp as initializeClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, collection, addDoc, getDocs, query, where, doc, deleteDoc } from 'firebase/firestore';

// Initialize Firebase Client for Server (uses API Key)
let db: any = null;
try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    const clientApp = initializeClientApp(firebaseConfig);
    db = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId || '(default)');
    console.log('Firebase initialized successfully on server.');
  } else {
    console.warn('Firebase configuration missing or incomplete. Some features may not work.');
  }
} catch (err) {
  console.error('Firebase initialization error on server:', err);
}

// Web Push Configuration
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (vapidSubject && vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let subscriptionCount = 0;
  if (db) {
    try {
      const snapshot = await getDocs(collection(db as any, 'admin_subscriptions'));
      subscriptionCount = snapshot.size;
    } catch (err) {
      console.error('Error counting subscriptions for health check:', err);
    }
  }

  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    firebaseInitialized: !!db,
    databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
    vapidConfigured: !!(vapidSubject && vapidPublicKey && vapidPrivateKey),
    subscriptionCount
  });
});

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true';

    console.log('Initializing SMTP Transporter with:', {
      host,
      port,
      secure,
      user: user ? 'Configured' : 'MISSING',
      pass: pass ? 'Configured' : 'MISSING'
    });

    if (!user || !pass) {
      return null;
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }
  return transporter;
}

app.get('/api/test-email-config', async (req, res) => {
  try {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = process.env.SMTP_PORT || '587';
    
    console.log('Testing SMTP with:', {
      host,
      port,
      user: user ? 'Configured' : 'MISSING',
      pass: pass ? 'Configured' : 'MISSING',
      env: process.env.NODE_ENV
    });

    const mailTransporter = getTransporter();
    if (!mailTransporter) {
      return res.json({ 
        success: false, 
        error: 'Configuração SMTP incompleta. Verifique se SMTP_USER e SMTP_PASS estão definidos no Netlify.',
        envVars: {
          SMTP_USER: !!user,
          SMTP_PASS: !!pass,
          SMTP_HOST: !!process.env.SMTP_HOST,
          SMTP_PORT: !!process.env.SMTP_PORT
        }
      });
    }

    await mailTransporter.verify();
    res.json({ 
      success: true, 
      message: 'Configuração SMTP válida e conexão estabelecida com sucesso!' 
    });
  } catch (error: any) {
    console.error('SMTP Verify Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      code: error.code,
      command: error.command,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.post('/api/send-support-email', async (req, res) => {
  try {
    const { to, subject, text, html, replyTo } = req.body;
    const adminEmail = process.env.SMTP_USER;
    
    console.log('[Email API] Received request:', { to, subject, hasText: !!text, hasHtml: !!html });

    // Prioritize 'to' if it looks like a valid email, otherwise fallback to admin
    const recipient = (to && typeof to === 'string' && to.includes('@')) ? to : adminEmail;

    console.log(`[Email API] Final recipient: ${recipient}`);

    const mailTransporter = getTransporter();
    if (!mailTransporter) {
      console.warn('SMTP configuration missing. Skipping email notification.');
      return res.status(200).json({ 
        success: false, 
        message: 'Configurações de e-mail (SMTP_USER/SMTP_PASS) não encontradas. O e-mail não foi enviado, mas a ação foi registrada.',
        skipped: true 
      });
    }

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'LD STORE'}" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject,
      text,
      html,
      replyTo: replyTo || process.env.SMTP_USER,
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('Email Send Error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Verifique se a "Senha de App" do Gmail está correta e se a Verificação em Duas Etapas está ativada.'
    });
  }
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { productId, productName, productPrice, userId, origin } = req.body;

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY não configurada no servidor.');
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: productName,
            },
            unit_amount: Math.round(productPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}&product_id=${productId}`,
      cancel_url: `${origin}/store`,
      metadata: {
        productId,
        userId,
      },
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/verify-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    res.json({ status: session.payment_status });
  } catch (error: any) {
    console.error('Stripe Verification Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Push Notification Endpoints
app.get('/api/push/vapid-public-key', (req, res) => {
  if (!vapidPublicKey) {
    console.error('VAPID public key not configured');
    return res.status(500).json({ error: 'VAPID public key not configured' });
  }
  res.json({ publicKey: vapidPublicKey });
});

app.post('/api/push/subscribe', async (req, res) => {
  try {
    if (!db) {
      throw new Error('Firestore not initialized. Please check your configuration.');
    }
    const subscription = req.body;
    
    // Check if subscription already exists in Firestore
    if (!subscription || !subscription.endpoint) {
      console.error('Invalid subscription object received:', subscription);
      return res.status(400).json({ error: 'Objeto de inscrição inválido.' });
    }

    const q = query(collection(db as any, 'admin_subscriptions'), where('endpoint', '==', subscription.endpoint));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      await addDoc(collection(db as any, 'admin_subscriptions'), {
        ...subscription,
        createdAt: new Date().toISOString()
      });
      console.log('New admin subscription added to Firestore:', subscription.endpoint);
    } else {
      console.log('Admin subscription already exists:', subscription.endpoint);
    }
    
    res.status(201).json({ success: true });
  } catch (error: any) {
    console.error('Subscription Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/push/notify-admin', async (req, res) => {
  try {
    if (!db) {
      throw new Error('Firestore not initialized. Please check your configuration.');
    }
    const { title, body, icon, url } = req.body;
    
    const payload = JSON.stringify({
      title: title || 'Nova Notificação',
      body: body || 'Você tem uma nova mensagem.',
      icon: icon || '/pwa-192x192.png',
      data: {
        url: url || '/admin'
      }
    });

    // Fetch all subscriptions from Firestore
    console.log('Fetching admin subscriptions from Firestore...');
    const snapshot = await getDocs(collection(db as any, 'admin_subscriptions'));
    const adminSubscriptions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Found ${adminSubscriptions.length} admin subscriptions.`);

    if (adminSubscriptions.length === 0) {
      console.warn('No admin subscriptions found in Firestore.');
      return res.json({ 
        success: false, 
        sentCount: 0, 
        error: 'Nenhum dispositivo inscrito encontrado. Por favor, clique em "ATIVAR NOTIFICAÇÕES" neste dispositivo primeiro.' 
      });
    }

    console.log(`Sending push notification to ${adminSubscriptions.length} admins: ${title}`);

    const notifications = adminSubscriptions.map((subscription: any) => {
      return webpush.sendNotification(subscription, payload)
        .catch(async (error) => {
          console.error('Error sending push notification:', error.endpoint, error.statusCode);
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription has expired or is no longer valid, delete from Firestore
            try {
              await deleteDoc(doc(db as any, 'admin_subscriptions', subscription.id));
              console.log('Removed expired subscription from Firestore.');
            } catch (delErr) {
              console.error('Error deleting expired subscription:', delErr);
            }
          }
          return { error };
        });
    });

    await Promise.all(notifications);
    res.json({ success: true, sentCount: adminSubscriptions.length });
  } catch (error: any) {
    console.error('Notify Admin Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ 
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

export default app;
