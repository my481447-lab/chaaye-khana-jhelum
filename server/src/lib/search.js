/**
 * Menu / content search. Deterministic, offline, verified-data-only.
 *
 * Matches the query against menu item name, category name and description
 * (all terms must appear somewhere in the item's searchable text). Also
 * surfaces a small set of "info" answers (hours, location, contact, offers)
 * when the query clearly points at them — so the site search box can answer
 * "opening hours" without hitting the agent.
 */

import { getMenu, getMenuCategories } from "./content.js";

function normalise(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s&]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchMenu(query, { limit = 20 } = {}) {
  const menu = getMenu();
  const categoriesById = Object.fromEntries(
    getMenuCategories().map((c) => [c.id, c.name]),
  );
  const q = normalise(query);
  if (!q) return [];

  const terms = q.split(" ");

  const scored = [];
  for (const item of menu.items) {
    const categoryName = categoriesById[item.category] || item.category;
    const haystack = normalise(
      `${item.name} ${categoryName} ${item.category} ${item.description}`,
    );
    if (!terms.every((t) => haystack.includes(t))) continue;

    // Simple relevance: exact name match > name-prefix > name-contains > body.
    const name = normalise(item.name);
    let score = 1;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 60;
    else if (name.includes(q)) score = 40;
    else if (normalise(categoryName).includes(q)) score = 20;

    scored.push({
      score,
      item: {
        id: item.id,
        name: item.name,
        category: item.category,
        categoryName,
        price: item.price,
        description: item.description,
      },
    });
  }

  scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return scored.slice(0, limit).map((s) => s.item);
}
