import express from 'express';
import stripeSdk from 'stripe';
import { createOrder } from '../db.js';

const router = express.Router();
const stripe = stripeSdk(process.env.STRIPE_SECRET_KEY);

router.post('/checkout/stripe', async (req, res) => {
  try {
    const { email, lines } = req.body; // lines: [{ sku, title, price, qty }]
    if (!Array.isArray(lines) || !lines.length) {
      return res.status(400).json({ error: 'NO_LINES' });
    }
    const order_ref = `EF-${Math.random().toString(36).slice(2,10).toUpperCase()}`;
    const subtotal = Math.round(lines.reduce((s,l)=> s + Number(l.price)*100*Number(l.qty), 0));
    const tax = Math.round(subtotal * 0.08);
    const shipping = lines.length ? 900 : 0;
    const total = subtotal + tax + shipping;

    await createOrder({
      email,
      lines,
      totals: { order_ref, subtotal, tax, shipping, total },
      gateway: 'stripe'
    });

    const line_items = lines.map(l => ({
      price_data: {
        currency: 'usd',
        product_data: { name: l.title, metadata: { sku: l.sku } },
        unit_amount: Math.round(Number(l.price) * 100)
      },
      quantity: Number(l.qty)
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: email,
      success_url: `${process.env.BASE_URL || 'http://localhost:5173'}/success?order_ref=${order_ref}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:5173'}/cancel?order_ref=${order_ref}`
    });

    res.json({ id: session.id, url: session.url, order_ref });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'STRIPE_SESSION_ERROR' });
  }
});

export default router;
