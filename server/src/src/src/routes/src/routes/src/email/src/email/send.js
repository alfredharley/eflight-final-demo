import mjml2html from 'mjml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function renderReceipt({ order_ref, email, items, totals }) {
  const mjmlPath = path.join(__dirname, 'receipt.mjml');
  const template = fs.readFileSync(mjmlPath, 'utf8');

  const mjml = template
    .replace(/{{order_ref}}/g, order_ref)
    .replace(/{{email}}/g, email)
    .replace(/{{subtotal}}/g, (totals.subtotal/100).toFixed(2))
    .replace(/{{tax}}/g, (totals.tax/100).toFixed(2))
    .replace(/{{shipping}}/g, (totals.shipping/100).toFixed(2))
    .replace(/{{total}}/g, (totals.total/100).toFixed(2))
    .replace(/{{#each items}}([\\s\\S]*?){{\\/each}}/g, (_, rowTpl) => {
      return items.map(i =>
        rowTpl
          .replace(/{{title}}/g, i.title)
          .replace(/{{qty}}/g, String(i.qty))
          .replace(/{{unitPrice}}/g, (i.unit_price_cents/100).toFixed(2))
      ).join('');
    });

  return mjml2html(mjml, { validationLevel: 'soft' }).html;
}
