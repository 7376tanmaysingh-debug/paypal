const state = { products: [], cart: {}, category: 'All', config: {}, channel3Configured: false, toastTimer: null };
const $ = selector => document.querySelector(selector);
const money = amount => '$' + Number(amount).toFixed(2);
function offerMoney(offer) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: offer.currency || 'USD' }).format(offer.amount); }
  catch (_error) { return Number(offer.amount).toFixed(2) + ' ' + (offer.currency || 'USD'); }
}

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}
function filteredProducts() {
  return state.category === 'All' ? state.products : state.products.filter(item => item.category === state.category);
}
function renderFilters() {
  const categories = ['All', ...new Set(state.products.map(item => item.category))];
  $('#category-filters').innerHTML = categories.map(name => '<button type="button" class="' + (name === state.category ? 'selected' : '') + '" data-category="' + escapeHtml(name) + '">' + escapeHtml(name) + '</button>').join('');
}
function card(product) {
  return '<article class="product-card"><div class="product-image" style="background:' + escapeHtml(product.color) + '"><span class="product-tag">' + escapeHtml(product.category) + '</span><span class="product-emoji" aria-hidden="true">' + escapeHtml(product.emoji) + '</span></div><div class="product-info"><h3>' + escapeHtml(product.name) + '</h3><p>' + escapeHtml(product.description) + '</p><div class="product-actions"><strong>' + money(product.price) + '</strong><button class="add-button" type="button" data-add="' + escapeHtml(product.id) + '">+ Add</button></div></div></article>';
}
function renderProducts(items) {
  const list = items || filteredProducts();
  $('#product-grid').innerHTML = list.map(card).join('');
  $('#see-all').hidden = state.category !== 'All' || list.length === state.products.length;
}
function channel3Card(product) {
  const image = product.imageUrl
    ? '<img src="' + escapeHtml(product.imageUrl) + '" alt="" loading="lazy">'
    : '<span class="channel3-image-fallback">✳</span>';
  const offers = product.offers.map(offer =>
    '<a class="channel3-offer" href="' + escapeHtml(offer.url) + '" target="_blank" rel="noopener noreferrer">' +
      '<span><b>' + escapeHtml(offer.domain) + '</b><small>View retailer offer ↗</small></span>' +
      '<strong>' + offerMoney(offer) + '</strong></a>'
  ).join('');
  return '<article class="channel3-card"><div class="channel3-image">' + image + '</div>' +
    '<div class="channel3-details"><h4>' + escapeHtml(product.title) + '</h4>' +
    (product.brand ? '<p>' + escapeHtml(product.brand) + '</p>' : '') +
    (product.description ? '<p class="channel3-description">' + escapeHtml(product.description) + '</p>' : '') +
    '<div class="channel3-offers">' + offers + '</div></div></article>';
}
function renderChannel3Products(products) {
  const section = $('#channel3-results');
  if (!state.channel3Configured || !Array.isArray(products) || !products.length) {
    section.hidden = true;
    $('#channel3-grid').innerHTML = '';
    return;
  }
  section.hidden = false;
  $('#channel3-grid').innerHTML = products.map(channel3Card).join('');
}
function cartLines() {
  return Object.entries(state.cart).map(([id, quantity]) => ({ product: state.products.find(item => item.id === id), quantity })).filter(line => line.product);
}
function cartTotal() {
  return cartLines().reduce((sum, line) => sum + line.product.price * line.quantity, 0);
}
function renderCart() {
  const lines = cartLines();
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  $('#bag-count').textContent = count;
  $('#drawer-count').textContent = '(' + count + ')';
  $('#subtotal').textContent = money(cartTotal());
  $('#bag-lines').innerHTML = lines.length ? lines.map(line =>
    '<div class="bag-line"><div class="bag-thumb" style="background:' + escapeHtml(line.product.color) + '">' + escapeHtml(line.product.emoji) + '</div><div><strong>' + escapeHtml(line.product.name) + '</strong><small>' + money(line.product.price) + ' each</small><div class="quantity-controls"><button type="button" data-qty="' + escapeHtml(line.product.id) + '" data-step="-1" aria-label="Remove one">−</button><span>' + line.quantity + '</span><button type="button" data-qty="' + escapeHtml(line.product.id) + '" data-step="1" aria-label="Add one">+</button></div></div><span class="line-total">' + money(line.product.price * line.quantity) + '</span></div>'
  ).join('') : '<div class="empty-bag">Your bag is taking a little breather.<br>Add a find you love and it will show up here.</div>';
  renderPaypal();
}
function openBag() {
  $('#backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
  renderCart();
}
function closeBag() {
  $('#backdrop').hidden = true;
  document.body.style.overflow = '';
}
function renderPaypal() {
  const holder = $('#paypal-buttons');
  const hint = $('#checkout-hint');
  if (!Object.keys(state.cart).length) {
    holder.innerHTML = '';
    holder.removeAttribute('data-rendered');
    hint.hidden = true;
    return;
  }
  if (!state.config.paypalClientId) {
    holder.innerHTML = '';
    holder.removeAttribute('data-rendered');
    hint.hidden = false;
    return;
  }
  hint.hidden = true;
  if (!window.paypal) {
    hint.hidden = false;
    hint.textContent = 'PayPal checkout is loading. Refresh if it does not appear.';
    return;
  }
  if (holder.dataset.rendered) return;
  holder.dataset.rendered = 'true';
  window.paypal.Buttons({
    style: { layout: 'vertical', shape: 'rect', label: 'paypal', color: 'gold', height: 42 },
    createOrder: async () => {
      try {
        const result = await api('/api/paypal/create-order', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cartLines().map(line => ({ id: line.product.id, quantity: line.quantity })) })
        });
        return result.id;
      } catch (error) { notify(error.message); throw error; }
    },
    onApprove: async data => {
      try {
        const result = await api('/api/paypal/capture-order', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderID: data.orderID })
        });
        state.cart = {};
        renderCart();
        closeBag();
        notify(result.status === 'COMPLETED' ? 'Payment complete. Thanks for shopping thoughtfully!' : 'PayPal order status: ' + result.status);
      } catch (error) { notify(error.message); }
    },
    onCancel: () => notify('Checkout cancelled. Your picks are still in your bag.'),
    onError: error => { console.error('PayPal checkout:', error); notify('PayPal checkout hit a snag. Your bag is still saved.'); }
  }).render(holder).catch(error => {
    console.error('PayPal button render:', error);
    hint.hidden = false;
    hint.textContent = 'PayPal could not load. Check the sandbox Client ID and try again.';
  });
}
function loadPaypalSdk() {
  if (!state.config.paypalClientId) return;
  const script = document.createElement('script');
  script.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(state.config.paypalClientId) + '&currency=USD&intent=capture';
  script.onload = renderPaypal;
  script.onerror = () => {
    if (Object.keys(state.cart).length) {
      $('#checkout-hint').hidden = false;
      $('#checkout-hint').textContent = 'PayPal checkout could not load. Check your connection and sandbox Client ID.';
    }
  };
  document.head.append(script);
}
function addMessage(role, text) {
  const node = document.createElement('div');
  if (role === 'user') {
    node.className = 'user-bubble';
    node.textContent = text;
  } else {
    node.className = 'bot-reply';
    const icon = document.createElement('span');
    icon.className = 'bot-dot';
    icon.textContent = '✳';
    const body = document.createElement('div');
    body.className = 'bot-text';
    body.textContent = text;
    node.append(icon, body);
  }
  $('#conversation').append(node);
}
async function ask(message) {
  renderChannel3Products([]);
  addMessage('user', message);
  const conversation = $('#conversation');
  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.textContent = 'Finding a few thoughtful options…';
  conversation.append(typing);
  const input = $('#chat-input');
  input.disabled = true;
  $('#chat-form button').disabled = true;
  try {
    const result = await api('/api/assistant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    typing.remove();
    addMessage('assistant', result.reply);
    const recommended = state.products.filter(item => result.productIds.includes(item.id));
    const liveProducts = Array.isArray(result.channel3Products) ? result.channel3Products : [];
    const chosenIds = Array.isArray(result.channel3Ids) ? result.channel3Ids : [];
    const livePicks = chosenIds.length ? liveProducts.filter(item => chosenIds.includes(item.id)) : liveProducts;
    renderChannel3Products(livePicks);
    if (recommended.length) {
      $('#product-grid').innerHTML = recommended.map(card).join('');
      $('#collection-note').textContent = recommended.length + ' picks matched to you';
      $('#see-all').hidden = false;
    } else {
      $('#collection-note').textContent = 'Explore the full collection';
      renderProducts(state.products);
    }
  } catch (error) {
    typing.remove();
    addMessage('assistant', error.message);
  } finally {
    input.disabled = false;
    $('#chat-form button').disabled = false;
    input.focus();
  }
}

$('#product-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-add]');
  if (!button) return;
  const id = button.dataset.add;
  state.cart[id] = Math.min(10, (state.cart[id] || 0) + 1);
  renderCart();
  notify('Added to your bag');
});
$('#category-filters').addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  state.category = button.dataset.category;
  renderFilters();
  renderProducts();
  renderChannel3Products([]);
  $('#collection-note').textContent = state.category === 'All' ? 'A few favorites to start' : 'Browsing ' + state.category.toLowerCase();
});
$('#bag-lines').addEventListener('click', event => {
  const button = event.target.closest('[data-qty]');
  if (!button) return;
  const id = button.dataset.qty;
  state.cart[id] = (state.cart[id] || 0) + Number(button.dataset.step);
  if (state.cart[id] <= 0) delete state.cart[id];
  $('#paypal-buttons').removeAttribute('data-rendered');
  renderCart();
});
$('#bag-trigger').addEventListener('click', openBag);
$('#close-drawer').addEventListener('click', closeBag);
$('#backdrop').addEventListener('click', event => { if (event.target === $('#backdrop')) closeBag(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#backdrop').hidden) closeBag(); });
$('#chat-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = $('#chat-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  ask(message);
});
document.querySelectorAll('[data-ask]').forEach(button => button.addEventListener('click', () => ask(button.dataset.ask)));
$('#see-all').addEventListener('click', () => {
  state.category = 'All';
  renderFilters();
  renderProducts();
  renderChannel3Products([]);
  $('#collection-note').textContent = 'A few favorites to start';
});
Promise.all([api('/api/products'), api('/api/config')]).then(([products, config]) => {
  state.products = products;
  state.config = config;
  state.channel3Configured = Boolean(config.channel3Configured);
  $('#channel3-note').hidden = !state.channel3Configured;
  renderFilters();
  renderProducts();
  loadPaypalSdk();
}).catch(error => {
  console.error('PayPilot startup:', error);
  $('#product-grid').innerHTML = '<p>PayPilot could not load the collection. Refresh to try again.</p>';
});