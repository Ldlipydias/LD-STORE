import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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
    console.log('Attempting to send email to:', to);

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
      to,
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

export default app;
