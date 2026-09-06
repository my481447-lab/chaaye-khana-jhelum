/**
 * Verified content store.
 *
 * Loads the JSON data files once, deep-freezes them so no request handler can
 * mutate the source of truth, and exposes read-only accessors. Everything the
 * API and the agent serve about the restaurant comes from here — there is no
 * other place data is authored, and nothing is generated at runtime.
 */

import { readFileSync } from "node:fs";

// `new URL(relative, import.meta.url)` is the bundler-friendly way to reach a
// sibling data file — serverless build tracers (Vercel) follow these reliably,
// unlike a path built with path.join().
function load(name) {
  const url = new URL(`../data/${name}`, import.meta.url);
  return deepFreeze(JSON.parse(readFileSync(url, "utf8")));
}

function deepFreeze(obj) {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const value of Object.values(obj)) deepFreeze(value);
  }
  return obj;
}

const restaurant = load("restaurant.json");
const menu = load("menu.json");
const offers = load("offers.json");
const reviews = load("reviews.json");

/* ---------- Menu ---------- */

export function getMenu() {
  return menu;
}

export function getMenuCategories() {
  return menu.categories;
}

export function getMenuItems(categoryId) {
  if (!categoryId) return menu.items;
  return menu.items.filter((it) => it.category === categoryId);
}

export function getMenuItemById(id) {
  return menu.items.find((it) => it.id === id) || null;
}

export function isValidCategory(id) {
  return menu.categories.some((c) => c.id === id);
}

/* ---------- Offers ---------- */

export function getOffers() {
  return offers;
}

/* ---------- Reviews ---------- */

export function getReviews() {
  return reviews;
}

/* ---------- Restaurant info ---------- */

export function getRestaurant() {
  return restaurant;
}

export function getOpeningHours() {
  return restaurant.openingHours;
}

export function getLocation() {
  return restaurant.location;
}

export function getContact() {
  return restaurant.contact;
}

export function getFacilities() {
  return restaurant.facilities;
}

/* ---------- Formatting helpers (shared by API + agent) ---------- */

export function formatPrice(amount) {
  return `${menu.currencySymbol} ${amount.toLocaleString("en-US")}`;
}
