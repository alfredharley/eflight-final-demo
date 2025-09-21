import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { initDb, listOrders } from './db.js';
import checkout from './routes/checkout.js';
import webhooks from './routes/webhooks.js';

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

// Admin list orders (used by the UI "Admin" tab and Success overlay)
app.get('/api/admin/orders', async (req, res) => {
  try {
    const q = req.query.q || '';
    const rows = await listOrders({ q });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'ADMIN_ORDERS_ERROR' });
  }
});

app.use('/api', checkout);
app.use('/api', webhooks);

await initDb();

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
