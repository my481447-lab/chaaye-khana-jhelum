/**
 * Verified content store.
 *
 * Loads the JSON data files once, deep-freezes them so no request handler can
 * mutate the source of truth, and exposes read-only accessors. Everything the
 * API and the agent serve about the restaurant comes from here — there is no
 * other place data is authored, and nothing is generated at runtime.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");

function load(name) {
  const raw = readFileSync(path.join(dataDir, name), "utf8");
  return deepFreeze(JSON.parse(raw));
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
