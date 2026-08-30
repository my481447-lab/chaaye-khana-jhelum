/**
 * Shopping-cart pricing. Stateless: the client sends a list of
 * `{ id, qty }` lines, the server re-prices every line against the verified
 * menu and returns the authoritative totals. The server is the source of
 * truth for prices — a price sent by the client is ignored.
 *
 * No tax or delivery fee is assumed (none is verified), so total === subtotal.
 */

import { getMenuItemById, formatPrice } from "./content.js";

const MAX_LINES = 50;
const MAX_QTY = 99;

export function quoteCart(rawLines) {
  if (!Array.isArray(rawLines)) {
    return { error: "Body must be { items: [{ id, qty }] }." };
  }
  if (rawLines.length > MAX_LINES) {
    return { error: `Too many lines (max ${MAX_LINES}).` };
  }

  const lines = [];
  const unknown = [];
  let subtotal = 0;

  for (const raw of rawLines) {
    const id = typeof raw?.id === "string" ? raw.id : null;
    let qty = Number.parseInt(raw?.qty, 10);
    if (!id) continue;
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (qty > MAX_QTY) qty = MAX_QTY;

    const item = getMenuItemById(id);
    if (!item) {
      unknown.push(id);
      continue;
    }

    const lineTotal = item.price * qty;
    subtotal += lineTotal;
    lines.push({
      id: item.id,
      name: item.name,
      category: item.category,
      unitPrice: item.price,
      unitPriceLabel: formatPrice(item.price),
      qty,
      lineTotal,
      lineTotalLabel: formatPrice(lineTotal),
    });
  }

  const total = subtotal; // no tax / delivery assumed
  return {
    currency: "PKR",
    lines,
    unknownItems: unknown,
    itemCount: lines.reduce((n, l) => n + l.qty, 0),
    subtotal,
    subtotalLabel: formatPrice(subtotal),
    total,
    totalLabel: formatPrice(total),
    note: "Prices from the verified Chaaye Khana menu. No tax or delivery fee is assumed. Confirm the final bill with the branch.",
  };
}
