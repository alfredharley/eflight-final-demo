import pkg from 'pg';
const { Pool } = pkg;

// If DATABASE_URL present → Postgres mode; else → in-memory demo
const hasDb = !!process.env.DATABASE_URL;
let pool = null;

const mem = {
  orders: [],       // {order_ref, email, subtotal_cents, tax_cents, shipping_cents, total_cents, status, gateway, gateway_ref, created_at}
  order_items: []   // {order_ref, sku, title, unit_price_cents, qty}
};

export async function initDb(){
  if (!hasDb) {
    console.log('DB: Using in-memory store (set DATABASE_URL to use Postgres)');
    return;
  }
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_ref TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      subtotal_cents INT NOT NULL,
      tax_cents INT NOT NULL,
      shipping_cents INT NOT NULL,
      total_cents INT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      gateway TEXT,
      gateway_ref TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_ref TEXT NOT NULL REFERENCES orders(order_ref) ON DELETE CASCADE,
      sku TEXT NOT NULL,
      title TEXT NOT NULL,
      unit_price_cents INT NOT NULL,
      qty INT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orders_ref ON orders(order_ref);
  `);
  console.log('DB: Postgres connected and schema ensured');
}

export async function createOrder({ email, lines, totals, gateway, gateway_ref }){
  const now = new Date().toISOString();
  if (!hasDb) {
    mem.orders.push({
      order_ref: totals.order_ref,
      email,
      subtotal_cents: totals.subtotal,
      tax_cents: totals.tax,
      shipping_cents: totals.shipping,
      total_cents: totals.total,
      status: 'pending',
      gateway: gateway || null,
      gateway_ref: gateway_ref || null,
      created_at: now
    });
    for (const l of lines) {
      mem.order_items.push({
        order_ref: totals.order_ref,
        sku: l.sku, title: l.title,
        unit_price_cents: Math.round(Number(l.price) * 100),
        qty: Number(l.qty)
      });
    }
    return { order_ref: totals.order_ref };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO orders(order_ref,email,subtotal_cents,tax_cents,shipping_cents,total_cents,status,gateway,gateway_ref)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [totals.order_ref, email, totals.subtotal, totals.tax, totals.shipping, totals.total, 'pending', gateway || null, gateway_ref || null]
    );
    for(const l of lines){
      await client.query(
        `INSERT INTO order_items(order_ref,sku,title,unit_price_cents,qty) VALUES($1,$2,$3,$4,$5)`,
        [totals.order_ref, l.sku, l.title, Math.round(Number(l.price)*100), Number(l.qty)]
      );
    }
    await client.query('COMMIT');
    return { order_ref: totals.order_ref };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}

export async function markPaid(order_ref, gateway, gateway_ref){
  if (!hasDb) {
    const o = mem.orders.find(x => x.order_ref === order_ref);
    if (o) { o.status = 'paid'; o.gateway = gateway; o.gateway_ref = gateway_ref; }
    return;
  }
  await pool.query(
    `UPDATE orders SET status='paid', gateway=$2, gateway_ref=$3 WHERE order_ref=$1`,
    [order_ref, gateway, gateway_ref]
  );
}

export async function listOrders({ q }){
  const like = `%${q}%`;
  if (!hasDb) {
    return mem.orders
      .filter(o => o.order_ref.includes(q) || o.email.includes(q))
      .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0,200);
  }

  const { rows } = await pool.query(
    `SELECT * FROM orders WHERE order_ref ILIKE $1 OR email ILIKE $1 ORDER BY created_at DESC LIMIT 200`,
    [like]
  );
  return rows;
}
