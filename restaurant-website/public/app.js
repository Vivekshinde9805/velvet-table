"use strict";

const TAX_RATE = 0.05;
const MAX_QUANTITY = 20;
const state = {
  menu: [],
  cart: new Map(),
  category: "All",
  search: "",
  submittingOrder: false,
  submittingReservation: false
};
const $ = (selector) => document.querySelector(selector);
const elements = {
  menuGrid: $("#menuGrid"), menuStatus: $("#menuStatus"), menuCounter: $("#menuCounter"),
  menuFilters: $("#menuFilters"), menuSearch: $("#menuSearch"), cartOpen: $("#cartOpen"),
  cartClose: $("#cartClose"), cartDrawer: $("#cartDrawer"), cartBackdrop: $("#cartBackdrop"),
  cartItems: $("#cartItems"), cartEmpty: $("#cartEmpty"), cartBottom: $("#cartBottom"),
  cartCount: $("#cartCount"), cartSubtotal: $("#cartSubtotal"), cartTax: $("#cartTax"),
  cartTotal: $("#cartTotal"), continueShopping: $("#continueShopping"), checkoutForm: $("#checkoutForm"),
  checkoutSubmit: $("#checkoutSubmit"), checkoutMessage: $("#checkoutMessage"),
  reservationForm: $("#reservationForm"), reservationDate: $("#reservationDate"),
  reserveSubmit: $("#reserveSubmit"), reservationMessage: $("#reservationMessage"),
  navToggle: $("#navToggle"), navLinks: $("#navLinks"), toast: $("#toast"), currentYear: $("#currentYear")
};
let toastTimeout;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(value);
}
function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function showMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `form-message ${type}`.trim();
}
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}
async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error("Unable to connect to the restaurant server. Please check your connection and try again.");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }
  if (!response.ok || data.success === false) {
    throw new Error(data.message || "The request could not be completed.");
  }
  return data;
}

function getFilteredMenu() {
  const query = state.search.trim().toLowerCase();
  return state.menu.filter(item => {
    const categoryMatches = state.category === "All" || item.category === state.category;
    const searchMatches = !query || item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
    return categoryMatches && searchMatches;
  });
}
function renderMenu() {
  const items = getFilteredMenu();
  elements.menuCounter.textContent = `${items.length} ${items.length === 1 ? "dish" : "dishes"}`;
  elements.menuStatus.textContent = "";
  if (state.menu.length === 0) {
    elements.menuGrid.innerHTML = `<div class="no-results"><p>The menu is currently unavailable.</p><button class="btn btn-outline" id="retryMenu" type="button">Try Again</button></div>`;
    $("#retryMenu").addEventListener("click", loadMenu);
    return;
  }
  if (items.length === 0) {
    elements.menuGrid.innerHTML = `<div class="no-results"><h3>No dishes found</h3><p>Try another search or select a different category.</p></div>`;
    return;
  }
  elements.menuGrid.innerHTML = items.map(item => {
    const tag = item.tag ? `<span class="menu-tag">${escapeHTML(item.tag)}</span>` : "";
    const dietaryLabel = item.vegetarian ? '<span class="veg-label">● Vegetarian</span>' : "<span>Non-vegetarian</span>";
    return `<article class="menu-card">
      <div class="menu-card-image"><img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" loading="lazy">${tag}</div>
      <div class="menu-card-body">
        <div class="menu-card-meta"><span>${escapeHTML(item.category)}</span>${dietaryLabel}</div>
        <h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.description)}</p>
        <div class="menu-card-footer"><span class="menu-price">${formatMoney(item.price)}</span>
          <button class="add-btn" type="button" data-add="${item.id}" aria-label="Add ${escapeHTML(item.name)} to cart">+ Add to Cart</button>
        </div>
      </div>
    </article>`;
  }).join("");
  elements.menuGrid.querySelectorAll(".menu-card-image img").forEach(image => {
    image.addEventListener("error", () => {
      image.style.display = "none";
      image.parentElement.classList.add("image-unavailable");
      image.parentElement.setAttribute("aria-label", `${image.alt} image unavailable`);
    }, { once: true });
  });
}
async function loadMenu() {
  elements.menuStatus.textContent = "Loading our menu...";
  elements.menuGrid.innerHTML = "";
  try {
    const data = await apiRequest("/api/menu");
    if (!Array.isArray(data.menu)) throw new Error("The server returned an invalid menu.");
    state.menu = data.menu;
    renderMenu();
    renderCart();
  } catch (error) {
    state.menu = [];
    renderMenu();
    elements.menuStatus.textContent = error.message;
  }
}
elements.menuFilters.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  elements.menuFilters.querySelectorAll(".filter-btn").forEach(filter => {
    const active = filter === button;
    filter.classList.toggle("active", active);
    filter.setAttribute("aria-pressed", String(active));
  });
  renderMenu();
});
elements.menuSearch.addEventListener("input", event => {
  state.search = event.target.value;
  renderMenu();
});
elements.menuGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const item = state.menu.find(entry => entry.id === Number(button.dataset.add));
  if (item) addToCart(item.id);
});

function addToCart(id) {
  const item = state.menu.find(entry => entry.id === id);
  if (!item) return;
  const current = state.cart.get(id);
  const currentQuantity = current ? current.quantity : 0;
  if (currentQuantity >= MAX_QUANTITY) {
    showToast(`Maximum ${MAX_QUANTITY} of each dish per order.`);
    return;
  }
  state.cart.set(id, { item, quantity: currentQuantity + 1 });
  renderCart();
  showToast(`${item.name} added to your basket.`);
}
function changeQuantity(id, change) {
  const entry = state.cart.get(id);
  if (!entry) return;
  const nextQuantity = entry.quantity + change;
  if (nextQuantity < 1) state.cart.delete(id);
  else if (nextQuantity <= MAX_QUANTITY) state.cart.set(id, { ...entry, quantity: nextQuantity });
  else {
    showToast(`Maximum ${MAX_QUANTITY} of each dish per order.`);
    return;
  }
  renderCart();
}
function removeFromCart(id) {
  state.cart.delete(id);
  renderCart();
}
function getCartTotals() {
  let subtotal = 0;
  let itemCount = 0;
  for (const entry of state.cart.values()) {
    subtotal += entry.item.price * entry.quantity;
    itemCount += entry.quantity;
  }
  subtotal = roundMoney(subtotal);
  const tax = roundMoney(subtotal * TAX_RATE);
  return { subtotal, tax, total: roundMoney(subtotal + tax), itemCount };
}
function renderCart() {
  const entries = [...state.cart.entries()];
  const totals = getCartTotals();
  elements.cartCount.textContent = String(totals.itemCount);
  elements.cartCount.setAttribute("aria-label", `${totals.itemCount} items in cart`);
  elements.cartSubtotal.textContent = formatMoney(totals.subtotal);
  elements.cartTax.textContent = formatMoney(totals.tax);
  elements.cartTotal.textContent = formatMoney(totals.total);
  const isEmpty = entries.length === 0;
  elements.cartEmpty.hidden = !isEmpty;
  elements.cartBottom.hidden = isEmpty;
  elements.cartItems.hidden = isEmpty;
  if (isEmpty) {
    elements.cartItems.innerHTML = "";
    return;
  }
  elements.cartItems.innerHTML = entries.map(([id, entry]) => `<article class="cart-item">
    <img src="${escapeHTML(entry.item.image)}" alt="${escapeHTML(entry.item.name)}">
    <div class="cart-item-info"><div class="cart-item-title">${escapeHTML(entry.item.name)}</div>
      <div class="cart-item-price">${formatMoney(entry.item.price * entry.quantity)}</div>
      <div class="cart-item-controls">
        <button class="qty-btn" type="button" data-quantity="${id}" data-change="-1" aria-label="Decrease ${escapeHTML(entry.item.name)} quantity">−</button>
        <span class="qty-value">${entry.quantity}</span>
        <button class="qty-btn" type="button" data-quantity="${id}" data-change="1" aria-label="Increase ${escapeHTML(entry.item.name)} quantity" ${entry.quantity >= MAX_QUANTITY ? "disabled" : ""}>+</button>
        <button class="remove-btn" type="button" data-remove="${id}" aria-label="Remove ${escapeHTML(entry.item.name)}">Remove</button>
      </div>
    </div>
  </article>`).join("");
}
elements.cartItems.addEventListener("click", event => {
  const quantityButton = event.target.closest("[data-quantity]");
  const removeButton = event.target.closest("[data-remove]");
  if (quantityButton) changeQuantity(Number(quantityButton.dataset.quantity), Number(quantityButton.dataset.change));
  if (removeButton) removeFromCart(Number(removeButton.dataset.remove));
});

let previousFocus = null;
function openCart() {
  previousFocus = document.activeElement;
  elements.cartDrawer.inert = false;
  elements.cartDrawer.setAttribute("aria-hidden", "false");
  elements.cartBackdrop.hidden = false;
  requestAnimationFrame(() => {
    elements.cartDrawer.classList.add("open");
    document.body.classList.add("drawer-open");
    elements.cartClose.focus();
  });
}
function closeCart() {
  elements.cartDrawer.classList.remove("open");
  elements.cartDrawer.setAttribute("aria-hidden", "true");
  elements.cartDrawer.inert = true;
  elements.cartBackdrop.hidden = true;
  document.body.classList.remove("drawer-open");
  if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
}
elements.cartOpen.addEventListener("click", openCart);
elements.cartClose.addEventListener("click", closeCart);
elements.cartBackdrop.addEventListener("click", closeCart);
elements.continueShopping.addEventListener("click", () => {
  closeCart();
  $("#menu").scrollIntoView({ behavior: "smooth" });
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && elements.cartDrawer.classList.contains("open")) closeCart();
});

elements.checkoutForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (state.submittingOrder) return;
  if (state.cart.size === 0) {
    showMessage(elements.checkoutMessage, "Your basket is empty.", "error");
    return;
  }
  if (!elements.checkoutForm.reportValidity()) return;
  const formData = new FormData(elements.checkoutForm);
  const payload = {
    customer: {
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      phone: formData.get("phone").trim()
    },
    items: [...state.cart.entries()].map(([id, entry]) => ({ id, quantity: entry.quantity }))
  };
  state.submittingOrder = true;
  elements.checkoutSubmit.disabled = true;
  elements.checkoutSubmit.textContent = "Processing Order...";
  showMessage(elements.checkoutMessage, "");
  try {
    const data = await apiRequest("/api/order", { method: "POST", body: JSON.stringify(payload) });
    state.cart.clear();
    renderCart();
    elements.checkoutForm.reset();
    showMessage(elements.checkoutMessage, `${data.message} Order ID: ${data.order.id}. Total: ${formatMoney(data.order.total)}.`, "success");
    showToast("Your order was received successfully.");
    setTimeout(() => {
      closeCart();
      $("#menu").scrollIntoView({ behavior: "smooth" });
    }, 2200);
  } catch (error) {
    showMessage(elements.checkoutMessage, error.message, "error");
  } finally {
    state.submittingOrder = false;
    elements.checkoutSubmit.disabled = false;
    elements.checkoutSubmit.innerHTML = 'Place Order <span>↗</span>';
  }
});

function setMinimumReservationDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  elements.reservationDate.min = `${year}-${month}-${day}`;
}
elements.reservationForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (state.submittingReservation) return;
  if (!elements.reservationForm.reportValidity()) return;
  const formData = new FormData(elements.reservationForm);
  const payload = {
    name: formData.get("name").trim(),
    phone: formData.get("phone").trim(),
    email: formData.get("email").trim(),
    date: formData.get("date"),
    time: formData.get("time"),
    guests: Number(formData.get("guests")),
    notes: formData.get("notes").trim()
  };
  state.submittingReservation = true;
  elements.reserveSubmit.disabled = true;
  elements.reserveSubmit.textContent = "Submitting Request...";
  showMessage(elements.reservationMessage, "");
  try {
    const data = await apiRequest("/api/reserve", { method: "POST", body: JSON.stringify(payload) });
    showMessage(elements.reservationMessage, `${data.message} Reference: ${data.reservation.id}. Your booking is awaiting confirmation.`, "success");
    showToast("Reservation request submitted.");
    elements.reservationForm.reset();
    setMinimumReservationDate();
  } catch (error) {
    showMessage(elements.reservationMessage, error.message, "error");
  } finally {
    state.submittingReservation = false;
    elements.reserveSubmit.disabled = false;
    elements.reserveSubmit.innerHTML = 'Request a Reservation <span>↗</span>';
  }
});

elements.navToggle.addEventListener("click", () => {
  const isOpen = elements.navLinks.classList.toggle("open");
  elements.navToggle.setAttribute("aria-expanded", String(isOpen));
  elements.navToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
});
elements.navLinks.addEventListener("click", event => {
  if (event.target.closest("a")) {
    elements.navLinks.classList.remove("open");
    elements.navToggle.setAttribute("aria-expanded", "false");
    elements.navToggle.setAttribute("aria-label", "Open navigation");
  }
});

function initializeWebsite() {
  elements.currentYear.textContent = String(new Date().getFullYear());
  elements.menuFilters.querySelectorAll(".filter-btn").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.category === state.category));
  });
  setMinimumReservationDate();
  renderCart();
  loadMenu();
}
initializeWebsite();
