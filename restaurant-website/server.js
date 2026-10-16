"use strict";

const express = require("express");
const helmet = require("helmet");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const TAX_RATE = 0.05;

app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https://images.unsplash.com"],
      "connect-src": ["'self'"]
    }
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const menu = [
  { id: 1, name: "Truffle Mushroom Risotto", category: "Mains", price: 649, description: "Creamy Arborio rice, wild mushrooms, parmesan and truffle oil.", image: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=900&q=85", tag: "Chef's Special", vegetarian: true },
  { id: 2, name: "Classic Margherita", category: "Mains", price: 499, description: "Hand-stretched dough, San Marzano tomato, mozzarella and basil.", image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=85", tag: "Bestseller", vegetarian: true },
  { id: 3, name: "Grilled Herb Chicken", category: "Mains", price: 749, description: "Herb-marinated chicken, seasonal vegetables and pepper jus.", image: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=85", tag: "Popular", vegetarian: false },
  { id: 4, name: "Burrata Garden Salad", category: "Starters", price: 429, description: "Fresh burrata, heirloom tomatoes, greens and balsamic glaze.", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85", tag: "Fresh", vegetarian: true },
  { id: 5, name: "Crispy Truffle Fries", category: "Starters", price: 299, description: "Golden fries tossed with truffle oil, herbs and parmesan.", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=85", tag: "", vegetarian: true },
  { id: 6, name: "Wild Mushroom Soup", category: "Starters", price: 349, description: "Slow-simmered forest mushrooms with cream and toasted bread.", image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85", tag: "", vegetarian: true },
  { id: 7, name: "Chocolate Fondant", category: "Desserts", price: 379, description: "Warm chocolate cake with a molten centre and vanilla cream.", image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=85", tag: "Must Try", vegetarian: true },
  { id: 8, name: "New York Cheesecake", category: "Desserts", price: 329, description: "Silky baked cheesecake with a buttery biscuit base.", image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=85", tag: "", vegetarian: true },
  { id: 9, name: "Signature Iced Coffee", category: "Drinks", price: 249, description: "Double espresso, chilled milk and a delicate caramel finish.", image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=85", tag: "Signature", vegetarian: true },
  { id: 10, name: "Fresh Berry Cooler", category: "Drinks", price: 229, description: "A refreshing blend of berries, lime and sparkling water.", image: "https://images.unsplash.com/photo-1513558161293-cdaf765edfd7?auto=format&fit=crop&w=900&q=85", tag: "", vegetarian: true },
  { id: 11, name: "Pesto Penne", category: "Mains", price: 549, description: "Penne pasta, basil pesto, cherry tomatoes and parmesan.", image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85", tag: "", vegetarian: true },
  { id: 12, name: "Garlic Butter Prawns", category: "Starters", price: 599, description: "Pan-seared prawns with garlic butter, parsley and lemon.", image: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=85", tag: "Chef's Special", vegetarian: false }
];

const orders = [];
const reservations = [];

function isValidString(value, maxLength = 100) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}
function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length <= 254;
}
function isValidPhone(value) {
  return typeof value === "string" && /^\+?[0-9\s()-]{7,20}$/.test(value.trim());
}
function isValidDate(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}


function isValidTime(value) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function roundMoney(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Restaurant API is running." });
});

app.get("/api/menu", (req, res) => {
  res.json({ success: true, count: menu.length, menu });
});

app.post("/api/order", (req, res) => {
  const { customer, items } = req.body || {};

  if (!customer || typeof customer !== "object" ||
      !isValidString(customer.name, 100) ||
      !isValidEmail(customer.email) ||
      !isValidPhone(customer.phone)) {
    return res.status(400).json({ success: false, message: "Enter a valid name, email address and phone number." });
  }

  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    return res.status(400).json({ success: false, message: "Your cart must contain between 1 and 50 different items." });
  }

  const normalizedItems = [];
  const seenIds = new Set();

  for (const item of items) {
    const id = Number(item?.id);
    const quantity = Number(item?.quantity);
    const product = menu.find(entry => entry.id === id);

    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || seenIds.has(id)) {
      return res.status(400).json({ success: false, message: "One or more cart items are invalid. Please refresh your cart." });
    }

    seenIds.add(id);
    normalizedItems.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity,
      lineTotal: roundMoney(product.price * quantity)
    });
  }

  const subtotal = roundMoney(normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const tax = roundMoney(subtotal * TAX_RATE);
  const total = roundMoney(subtotal + tax);

  const order = {
    id: crypto.randomUUID(),
    customer: { name: customer.name.trim(), email: customer.email.trim(), phone: customer.phone.trim() },
    items: normalizedItems,
    subtotal,
    tax,
    total,
    currency: "INR",
    status: "received",
    createdAt: new Date().toISOString()
  };

  orders.push(order);

  return res.status(201).json({
    success: true,
    message: "Your order has been received successfully!",
    order: { id: order.id, items: order.items, subtotal: order.subtotal, tax: order.tax, total: order.total, currency: order.currency, status: order.status }
  });
});

app.post("/api/reserve", (req, res) => {
  const { name, email, phone, date, time, guests, notes } = req.body || {};
  console.log("Reservation request received:", { date, time, guests });

  if (!isValidString(name, 100) || !isValidEmail(email) || !isValidPhone(phone)) {
    return res.status(400).json({ success: false, message: "Enter your name, a valid email address and phone number." });
  }

  const guestCount = typeof guests === "number" ? guests :
    (typeof guests === "string" && guests.trim() !== "" ? Number(guests) : NaN);
  if (!isValidDate(date) || !isValidTime(time) ||
      !Number.isInteger(guestCount) || guestCount < 1 || guestCount > 20) {
    console.warn("Invalid reservation fields:", {
      dateValid: isValidDate(date),
      timeValid: isValidTime(time),
      guestsValid: Number.isInteger(guestCount) && guestCount >= 1 && guestCount <= 20
    });
    return res.status(400).json({ success: false, message: "Please choose a valid date, a time between 11:00 AM and 10:00 PM, and 1–20 guests." });
  }

  const now = new Date();
  const bookingDateTime = new Date(`${date}T${time}:00`);

  if (Number.isNaN(bookingDateTime.getTime()) || bookingDateTime <= now) {
    return res.status(400).json({ success: false, message: "Please select a future reservation date and time." });
  }

  if (time < "11:00" || time > "22:00") {
    return res.status(400).json({ success: false, message: "Reservations are available between 11:00 and 22:00." });
  }

  if (notes !== undefined && (typeof notes !== "string" || notes.length > 500)) {
    return res.status(400).json({ success: false, message: "Special requests must be 500 characters or fewer." });
  }

  const reservation = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    date,
    time,
    guests: guestCount,
    notes: typeof notes === "string" ? notes.trim() : "",
    status: "requested",
    createdAt: new Date().toISOString()
  };

  reservations.push(reservation);

  return res.status(201).json({
    success: true,
    message: "Your reservation request has been received!",
    reservation: { id: reservation.id, name: reservation.name, date: reservation.date, time: reservation.time, guests: reservation.guests, status: reservation.status }
  });
});

app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "API endpoint not found." });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ success: false, message: "Invalid JSON request body." });
  }

  console.error("Server error:", err.message);
  res.status(500).json({ success: false, message: "An unexpected server error occurred." });
});

app.listen(PORT, () => {
  console.log(`Restaurant website running at http://localhost:${PORT}`);
});
