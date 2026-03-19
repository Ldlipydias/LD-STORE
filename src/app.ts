import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const app = express();
app.use(express.json());

// Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  const { productId, productName, productPrice, userId, origin } = req.body;

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_...') {
    console.error('STRIPE_SECRET_KEY is not configured.');
    return res.status(500).json({ 
      error: 'Configuração Incompleta: A chave secreta do Stripe (STRIPE_SECRET_KEY) não foi configurada no servidor. Adicione-a nos Secrets do AI Studio.' 
    });
  }

  try {
    const baseUrl = origin || process.env.APP_URL || req.headers.origin;
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
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}&product_id=${productId}`,
      cancel_url: `${baseUrl}/store`,
      metadata: {
        userId,
        productId,
      },
    });

    res.json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe Error:', error);
    res.status(500).json({ 
      error: error.message,
      type: error.type,
      code: error.code 
    });
  }
});

// Verify Stripe Session
app.get('/api/verify-session/:sessionId', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    res.json({ status: session.payment_status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
