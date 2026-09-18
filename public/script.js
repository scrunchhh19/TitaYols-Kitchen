document.getElementById('year').textContent = new Date().getFullYear();

// --- Menu tabs: À La Carte Trays vs Party Bundles & Sets ---
document.querySelectorAll('.menu-tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.menu-tab-btn').forEach((b) => b.setAttribute('aria-selected', 'false'));
    btn.setAttribute('aria-selected', 'true');
    const target = btn.dataset.tab;
    document.querySelectorAll('.menu-panel').forEach((panel) => {
      panel.dataset.active = String(panel.dataset.panel === target);
    });
  });
});

// --- Gallery category filters ---
const filterBtns = document.querySelectorAll('.gallery-filter-btn');
const galleryItems = document.querySelectorAll('.gallery-item');
filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterBtns.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    const filter = btn.dataset.filter;
    galleryItems.forEach((item) => {
      const show = filter === 'all' || item.dataset.category === filter;
      item.style.display = show ? '' : 'none';
    });
  });
});

// --- Lightbox: click a gallery photo to see it full size, swipe/arrow to browse ---
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');

let lightboxList = [];  // photo buttons currently visible under the active filter
let lightboxIndex = -1;

function visiblePhotoButtons() {
  return Array.from(document.querySelectorAll('.gallery-item'))
    .filter((item) => item.style.display !== 'none')
    .map((item) => item.querySelector('.gallery-item-photo'));
}

function showLightboxAt(index) {
  if (!lightboxList.length) return;
  lightboxIndex = (index + lightboxList.length) % lightboxList.length; // wraps both ways
  const btn = lightboxList[lightboxIndex];
  lightboxImg.src = btn.dataset.src;
  lightboxImg.alt = btn.dataset.alt;
}

function openLightboxFrom(btn) {
  lightboxList = visiblePhotoButtons();
  const hasMultiple = lightboxList.length > 1;
  lightboxPrev.style.display = hasMultiple ? '' : 'none';
  lightboxNext.style.display = hasMultiple ? '' : 'none';
  showLightboxAt(lightboxList.indexOf(btn));
  lightbox.dataset.open = 'true';
}

function closeLightbox() {
  lightbox.dataset.open = 'false';
  lightboxImg.src = '';
}

document.querySelectorAll('.gallery-item-photo').forEach((btn) => {
  btn.addEventListener('click', () => openLightboxFrom(btn));
});
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); showLightboxAt(lightboxIndex - 1); });
lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); showLightboxAt(lightboxIndex + 1); });

// Swipe left/right to browse to the next/previous photo
let lightboxTouchStartX = null;
lightbox.addEventListener('touchstart', (e) => {
  lightboxTouchStartX = e.changedTouches[0].clientX;
}, { passive: true });
lightbox.addEventListener('touchend', (e) => {
  if (lightboxTouchStartX === null) return;
  const deltaX = e.changedTouches[0].clientX - lightboxTouchStartX;
  const SWIPE_THRESHOLD = 40;
  if (deltaX > SWIPE_THRESHOLD) showLightboxAt(lightboxIndex - 1);
  else if (deltaX < -SWIPE_THRESHOLD) showLightboxAt(lightboxIndex + 1);
  lightboxTouchStartX = null;
}, { passive: true });

document.addEventListener('keydown', (e) => {
  if (lightbox.dataset.open === 'true') {
    if (e.key === 'ArrowLeft') showLightboxAt(lightboxIndex - 1);
    if (e.key === 'ArrowRight') showLightboxAt(lightboxIndex + 1);
  }
  if (e.key === 'Escape') {
    if (lightbox.dataset.open === 'true') closeLightbox();
    if (cartPanel.dataset.open === 'true') closeCart();
    if (paymentModal.dataset.open === 'true') closePayment();
    if (mobileNav.dataset.open === 'true') closeMobileNav();
  }
});

// =====================================================
// MOBILE NAV (full-screen menu below 720px)
// =====================================================
const navToggle = document.getElementById('nav-toggle');
const mobileNav = document.getElementById('mobile-nav');
const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
const mobileNavClose = document.getElementById('mobile-nav-close');

function openMobileNav() {
  mobileNav.dataset.open = 'true';
  mobileNavOverlay.dataset.open = 'true';
  mobileNav.setAttribute('aria-hidden', 'false');
  navToggle.setAttribute('aria-expanded', 'true');
  document.body.classList.add('mobile-nav-open');
}
function closeMobileNav() {
  mobileNav.dataset.open = 'false';
  mobileNavOverlay.dataset.open = 'false';
  mobileNav.setAttribute('aria-hidden', 'true');
  navToggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('mobile-nav-open');
}
navToggle.addEventListener('click', openMobileNav);
mobileNavClose.addEventListener('click', closeMobileNav);
mobileNavOverlay.addEventListener('click', closeMobileNav);
// Tapping a link jumps to the section, so close the menu out of the way.
mobileNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeMobileNav);
});

// =====================================================
// CART
// =====================================================
const CART_KEY = 'titayol_cart';
let cart = [];
try {
  cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
} catch (e) {
  cart = [];
}

const cartToggle = document.getElementById('cart-toggle');
const cartCount = document.getElementById('cart-count');
const cartPanel = document.getElementById('cart-panel');
const cartOverlay = document.getElementById('cart-overlay');
const cartClose = document.getElementById('cart-close');
const cartItemsEl = document.getElementById('cart-items');
const cartTotalEl = document.getElementById('cart-total');
const cartDownpaymentEl = document.getElementById('cart-downpayment');
const cartCheckoutBtn = document.getElementById('cart-checkout-btn');

function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* ignore */ }
}

function addToCart(name, price, contents) {
  const existing = cart.find((it) => it.name === name);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, price: price === null || isNaN(price) ? null : price, qty: 1, contents: contents || null });
  }
  saveCart();
  renderCart();
}

function changeQty(index, delta) {
  const item = cart[index];
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart.splice(index, 1);
  saveCart();
  renderCart();
}

function removeItem(index) {
  cart.splice(index, 1);
  saveCart();
  renderCart();
}

function pricedTotal() {
  return cart.reduce((sum, it) => sum + (it.price !== null ? it.price * it.qty : 0), 0);
}

function renderCart() {
  const totalCount = cart.reduce((sum, it) => sum + it.qty, 0);
  cartCount.textContent = totalCount;

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '<p class="cart-empty">Your cart is empty. Browse the menu above and tap "+" to add something.</p>';
    cartTotalEl.textContent = '\u20B10';
    cartDownpaymentEl.textContent = '\u20B10';
    return;
  }

  let html = '';
  cart.forEach((item, index) => {
    const lineTotal = item.price !== null ? item.price * item.qty : null;
    html += `
      <div class="cart-line">
        <div class="cart-line-name">${item.name}</div>
        <div class="cart-qty">
          <button type="button" data-action="dec" data-index="${index}" aria-label="Decrease quantity">-</button>
          <span>${item.qty}</span>
          <button type="button" data-action="inc" data-index="${index}" aria-label="Increase quantity">+</button>
        </div>
        <div class="cart-line-price">${item.price !== null ? '\u20B1' + lineTotal : 'TBC'}</div>
        <button type="button" class="cart-remove" data-action="remove" data-index="${index}">Remove</button>
      </div>`;
  });
  cartItemsEl.innerHTML = html;
  const total = pricedTotal();
  cartTotalEl.textContent = '\u20B1' + total;
  cartDownpaymentEl.textContent = '\u20B1' + Math.round(total * 0.5);
}

cartItemsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const index = Number(btn.dataset.index);
  if (btn.dataset.action === 'inc') changeQty(index, 1);
  if (btn.dataset.action === 'dec') changeQty(index, -1);
  if (btn.dataset.action === 'remove') removeItem(index);
});

function openCart() {
  cartPanel.dataset.open = 'true';
  cartOverlay.dataset.open = 'true';
}
function closeCart() {
  cartPanel.dataset.open = 'false';
  cartOverlay.dataset.open = 'false';
}
cartToggle.addEventListener('click', openCart);
cartClose.addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

// Add-to-cart buttons: à la carte items
document.querySelectorAll('.tray-item .add-cart-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const row = btn.closest('.tray-item');
    addToCart(row.dataset.name, parseFloat(row.dataset.price));
    btn.classList.add('added');
    btn.textContent = '\u2713';
    setTimeout(() => { btn.classList.remove('added'); btn.textContent = '+'; }, 900);
  });
});

// Add-to-cart buttons: bundles & sets (price read from the photo where known;
// Bento Meals has no single price since breakfast/lunch bentos differ, so it stays TBC)
document.querySelectorAll('.add-cart-btn-gallery').forEach((btn) => {
  btn.addEventListener('click', () => {
    const price = btn.dataset.price ? parseFloat(btn.dataset.price) : null;
    addToCart(btn.dataset.name, price, btn.dataset.contents);
    const original = btn.textContent;
    btn.textContent = 'Added!';
    setTimeout(() => { btn.textContent = original; }, 900);
  });
});

// Checkout: build an order summary from the cart and drop it into the order form
cartCheckoutBtn.addEventListener('click', () => {
  if (cart.length === 0) return;
  const lines = cart.map((it) => {
    let line = `${it.qty}x ${it.name}${it.price !== null ? ' (\u20B1' + (it.price * it.qty) + ')' : ''}`;
    if (it.contents) line += `\n   Includes: ${it.contents}`;
    return line;
  });
  const total = pricedTotal();
  let summary = lines.join('\n\n');
  if (total > 0) {
    summary += `\n\nEstimated total: \u20B1${total}`;
    summary += `\nDownpayment due now (50%): \u20B1${Math.round(total * 0.5)}`;
  }
  document.getElementById('order-details').value = summary;
  closeCart();
  document.getElementById('order').scrollIntoView({ behavior: 'smooth' });
});

renderCart();

// =====================================================
// ORDER FORM -> PAYMENT MODAL -> SUBMIT
// =====================================================
const form = document.getElementById('order-form');
const statusEl = document.getElementById('form-status');
const submitBtn = form.querySelector('.btn-submit');

// Address is only needed (and only editable) when "Delivery" is picked.
const fulfillmentSelect = document.getElementById('fulfillment');
const addressInput = document.getElementById('address');
function syncAddressField() {
  const isDelivery = fulfillmentSelect.value === 'Delivery';
  addressInput.disabled = !isDelivery;
  addressInput.required = isDelivery;
  if (!isDelivery) addressInput.value = '';
}
fulfillmentSelect.addEventListener('change', syncAddressField);
syncAddressField();

const paymentModal = document.getElementById('payment-modal');
const paymentClose = document.getElementById('payment-close');
const receiptInput = document.getElementById('receipt-upload');
const receiptFileName = document.getElementById('receipt-file-name');
const paymentStatus = document.getElementById('payment-status');
const confirmPaymentBtn = document.getElementById('confirm-payment-btn');

const MAX_RECEIPT_BYTES = 3 * 1024 * 1024; // ~3MB, stays safely under Vercel's request body limit
let receiptFile = null;

const paymentAmountBox = document.getElementById('payment-amount-box');

function openPayment() {
  const total = pricedTotal();
  if (total > 0) {
    const downpayment = Math.round(total * 0.5);
    paymentAmountBox.innerHTML = `Please pay <span class="amount">\u20B1${downpayment}</span><span class="note">50% downpayment of your \u20B1${total} estimated order.</span>`;
  } else {
    paymentAmountBox.innerHTML = `<span class="note">We'll confirm your downpayment amount with you directly, since your order doesn't have a fixed price yet.</span>`;
  }
  paymentModal.dataset.open = 'true';
}
function closePayment() {
  paymentModal.dataset.open = 'false';
}
paymentClose.addEventListener('click', closePayment);
paymentModal.addEventListener('click', (e) => {
  if (e.target === paymentModal) closePayment();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  openPayment();
});

receiptInput.addEventListener('change', () => {
  const file = receiptInput.files[0];
  paymentStatus.textContent = '';
  paymentStatus.className = 'form-status';

  if (!file) {
    receiptFile = null;
    receiptFileName.textContent = '';
    confirmPaymentBtn.disabled = true;
    return;
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    receiptFile = null;
    receiptFileName.textContent = '';
    confirmPaymentBtn.disabled = true;
    paymentStatus.textContent = 'That image is a bit too large. Please upload a smaller screenshot (under 3MB).';
    paymentStatus.className = 'form-status error';
    receiptInput.value = '';
    return;
  }
  receiptFile = file;
  receiptFileName.textContent = file.name;
  confirmPaymentBtn.disabled = false;
});

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

confirmPaymentBtn.addEventListener('click', async () => {
  if (!receiptFile) return;

  confirmPaymentBtn.disabled = true;
  paymentStatus.textContent = 'Sending your order\u2026';
  paymentStatus.className = 'form-status';

  try {
    const dataUrl = await readFileAsDataURL(receiptFile);

    const data = {
      name: form.name.value.trim(),
      contact: form.contact.value.trim(),
      dateNeeded: form.dateNeeded.value,
      fulfillment: form.fulfillment.value,
      address: form.address.value.trim(),
      orderDetails: form.orderDetails.value.trim(),
      notes: form.notes.value.trim(),
      receiptImage: dataUrl,
      receiptFileName: receiptFile.name,
    };

    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error('Request failed');

    paymentStatus.textContent = 'Payment received! Your order is confirmed.';
    paymentStatus.className = 'form-status success';
    statusEl.textContent = "Order sent! We'll message you to confirm.";
    statusEl.className = 'form-status success';

    cart = [];
    saveCart();
    renderCart();
    form.reset();
    syncAddressField(); // form.reset() doesn't fire 'change', so do this manually
    receiptFile = null;
    receiptInput.value = '';
    receiptFileName.textContent = '';

    setTimeout(() => {
      closePayment();
      paymentStatus.textContent = '';
      confirmPaymentBtn.disabled = true;
    }, 1800);
  } catch (err) {
    paymentStatus.textContent = 'Something went wrong sending your order. Please try again, or message us directly on Facebook.';
    paymentStatus.className = 'form-status error';
    confirmPaymentBtn.disabled = false;
  }
});
