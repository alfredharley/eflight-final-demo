import express from 'express';
import stripeSdk from 'stripe';
import { markPaid } from '../db.js';

const router = express.Router();
const stripe = stripeSdk(process.env.STRIPE_SECRET_KEY);

// Stripe webhook (optional for demo). Stripe will call this after payment.
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err.message);
    return res.sendStatus(400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // Our success_url contains order_ref as a query param. Pull it out if available.
    try {
      const url = new URL(session.success_url);
      const order_ref = url.searchParams.get('order_ref');
      if (order_ref) await markPaid(order_ref, 'stripe', session.id);
    } catch (e) {
      console.warn('Could not parse success_url for order_ref');
    }
  }

  res.json({ received: true });
});

export default router;
