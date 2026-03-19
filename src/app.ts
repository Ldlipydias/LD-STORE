import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

let stripeClient: Stripe | null = null;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === 'sk_test_...') {
    throw new Error('STRIPE_SECRET_KEY is not configured or is using a placeholder.');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const app = express();
app.use(express.json());

// Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  const { productId, productName, productPrice, userId, origin } = req.body;

  try {
    const stripe = getStripe();
    console.log('Stripe Secret Key detected:', process.env.STRIPE_SECRET_KEY?.substring(0, 7) + '...');
    
    // Better base URL detection for Netlify and local dev
    let baseUrl = origin;
    if (!baseUrl) {
      if (process.env.URL) { // Netlify default env var
        baseUrl = process.env.URL;
      } else if (process.env.APP_URL) {
        baseUrl = process.env.APP_URL;
      } else {
        baseUrl = req.headers.origin || 'http://localhost:3000';
      }
    }
    
    // Ensure no trailing slash for consistency
    baseUrl = baseUrl.replace(/\/$/, '');
    
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
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    res.json({ status: session.payment_status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
