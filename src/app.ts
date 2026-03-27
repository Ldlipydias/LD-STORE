import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import cors from 'cors';
import webpush from 'web-push';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Configuration for Server
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}

// CRITICAL: Must specify the databaseId for non-default databases in AI Studio
const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId || '(default)');

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
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
    const recipient = (to && to.includes('@')) ? to : adminEmail;

    console.log('Attempting to send email to:', recipient);

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
  res.json({ publicKey: vapidPublicKey });
});

app.post('/api/push/subscribe', async (req, res) => {
  try {
    const subscription = req.body;
    
    // Check if subscription already exists in Firestore
    const snapshot = await db.collection('admin_subscriptions')
      .where('endpoint', '==', subscription.endpoint)
      .get();
    
    if (snapshot.empty) {
      await db.collection('admin_subscriptions').add({
        ...subscription,
        createdAt: new Date().toISOString()
      });
      console.log('New admin subscription added to Firestore.');
    }
    
    res.status(201).json({ success: true });
  } catch (error: any) {
    console.error('Subscription Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/push/notify-admin', async (req, res) => {
  try {
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
    const snapshot = await db.collection('admin_subscriptions').get();
    const adminSubscriptions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Sending push notification to ${adminSubscriptions.length} admins: ${title}`);

    const notifications = adminSubscriptions.map((subscription: any) => {
      return webpush.sendNotification(subscription, payload)
        .catch(async (error) => {
          console.error('Error sending push notification:', error.endpoint, error.statusCode);
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription has expired or is no longer valid, delete from Firestore
            try {
              await db.collection('admin_subscriptions').doc(subscription.id).delete();
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

export default app;
