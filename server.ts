import express from 'express';
import Stripe from 'stripe';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";
import serverless from 'serverless-http';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const app = express();
app.use(express.json());

// Gemini PIX Verification (Moved to server for security)
app.post('/api/verify-pix', async (req, res) => {
  const { base64Image, expectedAmount, recipientName } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
  }

  try {
    const model = "gemini-3-flash-preview";
    
    const prompt = `Analise este comprovante de PIX com ATENÇÃO MÁXIMA. 
    O usuário copiou uma chave com valor 0, portanto ele teve que digitar o valor manualmente.
    
    CRITÉRIOS OBRIGATÓRIOS PARA "isValid": true:
    1. O valor do pagamento (valor recebido/pago) deve ser EXATAMENTE R$ ${expectedAmount.toFixed(2)}. Se o valor for diferente, "isValid" deve ser false.
    2. O nome do destinatário (quem recebeu o dinheiro) deve ser EXATAMENTE "${recipientName}".
    3. O documento deve ser um comprovante de transferência PIX legítimo e concluído.
    
    Responda apenas com um JSON no seguinte formato:
    {
      "isValid": boolean (true apenas se TODOS os critérios acima forem atendidos),
      "amount": number (valor exato encontrado no comprovante),
      "recipient": string (nome do destinatário encontrado),
      "sender": string (nome de quem enviou),
      "date": string (data do pagamento),
      "reason": string (se isValid for false, explique o motivo detalhadamente em português)
    }`;

    const result_ai = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(',')[1] || base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            amount: { type: Type.NUMBER },
            recipient: { type: Type.STRING },
            sender: { type: Type.STRING },
            date: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["isValid", "amount", "recipient", "sender", "date"]
        }
      }
    });

    const result = JSON.parse(result_ai.text || '{}');
    
    // Programmatic safety check: even if AI says it's valid, we double check the amount
    if (result.isValid && Math.abs(result.amount - expectedAmount) > 0.01) {
      result.isValid = false;
      result.reason = `O valor no comprovante (R$ ${result.amount.toFixed(2)}) não coincide com o valor do produto (R$ ${expectedAmount.toFixed(2)}).`;
    }

    res.json(result);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  const { productId, productName, productPrice, userId, origin } = req.body;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Chave secreta do Stripe (STRIPE_SECRET_KEY) não configurada no servidor.' });
  }

  try {
    const baseUrl = origin || process.env.APP_URL || req.headers.origin;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'pix'],
      payment_method_options: {
        pix: {
          expires_after_seconds: 3600,
        },
      },
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

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Start server only if not in a serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.NETLIFY) {
  const PORT = 3000;
  startServer().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

const handler = serverless(app);

export { handler };
export default app;
export { startServer };
