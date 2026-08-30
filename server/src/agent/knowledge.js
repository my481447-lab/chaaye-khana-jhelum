/**
 * Builds the "VERIFIED RESTAURANT INFORMATION" block that the agent is allowed
 * to draw from. It is assembled purely from the frozen content store — no
 * secrets, no config, no request data. The output is deterministic, so it
 * caches cleanly as a prompt prefix.
 */

import {
  getRestaurant,
  getMenu,
  getOffers,
  getReviews,
  formatPrice,
} from "../lib/content.js";

let cached = null;

export function buildKnowledgeBlock() {
  if (cached) return cached;

  const r = getRestaurant();
  const menu = getMenu();
  const offers = getOffers();
  const reviews = getReviews();

  const lines = [];
  lines.push("=== VERIFIED RESTAURANT INFORMATION (the ONLY facts you may use) ===");
  lines.push("");
  lines.push(`Name: ${r.name} — ${r.branch} branch (also written: ${r.aka.join(", ")})`);
  lines.push(`About: ${r.about}`);
  lines.push(`Cuisine: ${r.cuisine.join(", ")}`);
  lines.push("");

  // --- Opening hours ---
  lines.push("OPENING HOURS:");
  for (const d of r.openingHours.weekly) {
    lines.push(`  ${d.day}: ${to12h(d.opens)} – ${d.closesLabel}`);
  }
  lines.push(`  Summary: ${r.openingHours.summary}`);
  lines.push(`  Note: ${r.openingHours.note}`);
  lines.push("");

  // --- Location ---
  lines.push("LOCATION:");
  lines.push(`  Address: ${r.location.addressLines.join(", ")}`);
  lines.push(`  Landmark: ${r.location.landmark}`);
  lines.push(`  Directions link: ${r.location.maps.directions}`);
  lines.push(`  Coordinates: ${r.location.geo ? JSON.stringify(r.location.geo) : "not verified — use the maps link"}`);
  lines.push("");

  // --- Contact ---
  lines.push("CONTACT:");
  for (const p of r.contact.phone) lines.push(`  ${p.label}: ${p.number}`);
  lines.push(`  Email: ${r.contact.email} (${r.contact.emailNote})`);
  lines.push("  Social media:");
  for (const [k, v] of Object.entries(r.contact.social)) {
    if (k.endsWith("Note")) continue;
    lines.push(`    ${k}: ${v ? v : "no verified account"}`);
  }
  lines.push("");

  // --- Facilities ---
  lines.push("FACILITIES & DINING OPTIONS:");
  for (const [key, f] of Object.entries(r.facilities)) {
    const status =
      f.available === true ? "yes" : f.available === false ? "no" : "NOT CONFIRMED for this branch";
    lines.push(`  ${labelFor(key)}: ${status}${f.note ? ` — ${f.note}` : ""}`);
  }
  lines.push("");

  // --- History ---
  lines.push(`HISTORY: ${r.history.note}`);
  lines.push("");

  // --- Menu ---
  lines.push(`MENU (prices in ${menu.currency}; quote exactly):`);
  lines.push(`  Note: ${menu.note}`);
  for (const cat of menu.categories) {
    lines.push(`  ${cat.name}:`);
    for (const it of menu.items.filter((i) => i.category === cat.id)) {
      lines.push(`    - ${it.name} — ${formatPrice(it.price)} — ${it.description}`);
    }
  }
  lines.push("");

  // --- Offers ---
  lines.push("OFFERS:");
  lines.push(`  Note: ${offers.note}`);
  for (const o of offers.offers) {
    lines.push(`    - ${o.title} (${o.schedule}): ${o.description} [no price/discount/expiry published]`);
  }
  lines.push("");

  // --- Reviews ---
  lines.push("REVIEWS & RATINGS:");
  lines.push(`  Note: ${reviews.note}`);
  lines.push(
    `  Google: ${reviews.summary.google.rating}/5 from ${reviews.summary.google.count.toLocaleString("en-US")} reviews.`,
  );
  lines.push(
    `  Tripadvisor: ${reviews.summary.tripadvisor.rating}/5 from ${reviews.summary.tripadvisor.count} reviews.`,
  );
  for (const ex of reviews.excerpts) {
    lines.push(`    - "${ex.text}" — ${ex.author}, ${ex.rating}/5 (${ex.source}, ${ex.date})`);
  }
  lines.push("");

  // --- Website features ---
  lines.push("WEBSITE FEATURES (this site):");
  for (const feat of r.websiteFeatures) lines.push(`  - ${feat}`);
  lines.push("");
  lines.push("=== END VERIFIED RESTAURANT INFORMATION ===");
  lines.push(
    "If a visitor's question cannot be answered from the block above, say you don't have that information and point them to the phone number.",
  );

  cached = lines.join("\n");
  return cached;
}

function to12h(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === 0 && m === 0) return "midnight";
  const period = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function labelFor(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
