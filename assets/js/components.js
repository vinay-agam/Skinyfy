/**
 * Skinify — Reusable UI Components
 * All components are pure functions that return DOM elements.
 */

import { Utils, Favorites, Analytics, Icons, Cart } from './app.js';

// ─── Product Card ───────────────────────────────────────────────
export function createProductCard(product, options = {}) {
  const { showWhatsAppBtn = false, gridMode = false } = options;
  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.productId = product.id;

  const isFav = Favorites.has(product.id);
  const badge = product.badges && product.badges[0];
  const gradient = Utils.getPlaceholderGradient(product.id);

  // Device type icon for placeholder
  const deviceIcon = product.deviceType === 'laptop'
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="placeholder-icon"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="placeholder-icon"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;

  card.innerHTML = `
    <div class="card-image-wrap">
      <img src="${product.images[0]}" alt="${product.name} skin" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="product-placeholder" style="display:none;background:${gradient}">
        ${deviceIcon}
        <span class="placeholder-name">${product.name}</span>
      </div>
      ${badge ? `<span class="card-badge ${badge}">${badge.charAt(0).toUpperCase() + badge.slice(1)}</span>` : ''}
      <button class="card-fav-btn ${isFav ? 'active' : ''}" aria-label="Add to favorites" data-product-id="${product.id}">
        ${isFav ? Icons.heartFilled : Icons.heart}
      </button>
    </div>
    <div class="card-info">
      <div class="card-name">${product.name}</div>
      <div class="card-price"><span class="currency">₹</span>${product.price}</div>
      ${showWhatsAppBtn ? `
        <button class="card-whatsapp-btn" data-product-id="${product.id}">
          ${Icons.whatsapp}
          Order on WhatsApp
        </button>
      ` : ''}
    </div>
  `;

  // Image error handler: auto-show placeholder
  const img = card.querySelector('img');
  const placeholder = card.querySelector('.product-placeholder');
  if (img) {
    // If image fails, placeholder is shown via onerror inline
    // Also set placeholder visible immediately if src is empty
    if (!product.images || !product.images[0]) {
      img.style.display = 'none';
      placeholder.style.display = 'flex';
    }
  }

  // Favorite button handler
  const favBtn = card.querySelector('.card-fav-btn');
  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const added = Favorites.toggle(product.id);
    favBtn.classList.toggle('active', added);
    favBtn.innerHTML = added ? Icons.heartFilled : Icons.heart;
    if (added) favBtn.classList.add('animate-heart');
    setTimeout(() => favBtn.classList.remove('animate-heart'), 600);
    Analytics.favoriteToggled(product.id, added);
  });

  // WhatsApp button handler
  const urlParams = new URLSearchParams(window.location.search);
  const activeDevice = options.device || urlParams.get('device') || urlParams.get('model') || urlParams.get('phone');
  const replaceId = options.replace || urlParams.get('replace');
  const actionParam = options.action || urlParams.get('action');

  let checkoutUrl = `/checkout?product=${encodeURIComponent(product.id)}`;
  if (activeDevice) checkoutUrl += `&device=${encodeURIComponent(activeDevice)}`;
  if (replaceId) checkoutUrl += `&replace=${encodeURIComponent(replaceId)}`;
  if (actionParam) checkoutUrl += `&action=${encodeURIComponent(actionParam)}`;

  const selectThisSkin = (e) => {
    if (e) e.stopPropagation();

    if (replaceId) {
      // Direct replace in cart
      Cart.updateItem(replaceId, {
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        productImage: (product.images && product.images[0]) || '',
        deviceType: product.deviceType || 'phone'
      });
      window.location.href = `/checkout`;
      return;
    }

    // Direct add in cart
    Cart.addItem({
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      productImage: (product.images && product.images[0]) || '',
      deviceType: product.deviceType || 'phone',
      deviceId: activeDevice || null,
      deviceName: activeDevice || '',
      brandId: null,
      brandName: '',
      cutterStatus: 'available',
      qty: 1
    });

    window.location.href = checkoutUrl;
  };

  const waBtn = card.querySelector('.card-whatsapp-btn');
  if (waBtn) {
    if (replaceId) {
      waBtn.innerHTML = `✓ Select This Skin`;
      waBtn.style.background = 'var(--color-primary)';
      waBtn.style.color = '#fff';
    } else if (actionParam === 'add') {
      waBtn.innerHTML = `${Icons.plus} Add to Order`;
      waBtn.style.background = 'var(--color-primary)';
      waBtn.style.color = '#fff';
    }

    waBtn.addEventListener('click', selectThisSkin);
  }

  // Card click → checkout
  card.addEventListener('click', () => {
    Analytics.productView(product.id);
    selectThisSkin();
  });

  return card;
}

// ─── Floating Cart Banner ───────────────────────────────────────
export function renderFloatingCartBanner() {
  if (window.location.pathname.includes('/checkout')) return;

  const updateBanner = () => {
    let banner = document.getElementById('floating-cart-banner');
    const count = Cart.count();

    if (count === 0) {
      if (banner) banner.remove();
      return;
    }

    const subtotal = Cart.subtotal();
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'floating-cart-banner';
      banner.id = 'floating-cart-banner';
      document.body.appendChild(banner);
    }

    banner.innerHTML = `
      <div class="cart-banner-info">
        <div class="cart-banner-badge">
          ${count}
        </div>
        <div class="cart-banner-text">
          <div class="cart-banner-title">${count} ${count === 1 ? 'Skin' : 'Skins'} in Order</div>
          <div class="cart-banner-sub">₹${subtotal} • Precision cuts selected at checkout</div>
        </div>
      </div>
      <a href="/checkout" class="cart-banner-btn">
        <span>View Order</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </a>
    `;
  };

  updateBanner();
  window.addEventListener('cart-updated', updateBanner);
}

// ─── Product Grid / Scroll Renderer ─────────────────────────────
export function renderProductScroll(container, products, options = {}) {
  container.innerHTML = '';
  container.className = 'products-scroll stagger-children';
  products.forEach(p => container.appendChild(createProductCard(p, options)));
}

export function renderProductGrid(container, products, options = {}) {
  container.innerHTML = '';
  container.className = 'product-grid stagger-children';
  products.forEach(p => container.appendChild(createProductCard(p, { showWhatsAppBtn: true, gridMode: true, ...options })));
}


// ─── Category Circle ────────────────────────────────────────────
export function createCategoryCircle(category, isActive = false) {
  const item = document.createElement('a');
  item.className = `category-item ${isActive ? 'active' : ''}`;
  item.href = getCategoryLink(category);
  item.dataset.categoryId = category.id;

  const iconSVG = getCategoryIcon(category.icon || category.id);

  item.innerHTML = `
    <div class="category-circle">
      ${iconSVG}
    </div>
    <span class="category-name">${category.name}</span>
  `;

  return item;
}

function getCategoryLink(cat) {
  if (['minimal','anime','nature','abstract','quotes','gaming','cars','trending'].includes(cat.id)) {
    return `/phone-skins/?category=${cat.id}`;
  }
  return `/${cat.slug || cat.id}/`;
}

function getCategoryIcon(iconId) {
  const icons = {
    phone: Icons.phone,
    laptop: Icons.laptop,
    'phone-skins': Icons.phone,
    'laptop-skins': Icons.laptop,
    trending: Icons.trending,
    minimal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line></svg>`,
    anime: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    nature: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2"></path><path d="M12 18C6.5 18 2 14 2 9c0 0 4-1 6 2 0-4 2.5-8 4-8s4 4 4 8c2-3 6-2 6-2 0 5-4.5 9-10 9z"></path></svg>`,
    abstract: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
    quotes: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
    gaming: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="2"></rect></svg>`,
    cars: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h2m10 0h2M5 17H3v-4l2-7h14l2 7v4h-2M5 17a2 2 0 1 0 4 0m6 0a2 2 0 1 0 4 0"></path></svg>`
  };
  return icons[iconId] || icons.minimal;
}


// ─── Filter Chips ───────────────────────────────────────────────
export function createFilterChips(categories, activeId, onSelect) {
  const wrapper = document.createElement('div');
  wrapper.className = 'filter-chips-wrapper';

  const chips = document.createElement('div');
  chips.className = 'filter-chips';

  const allChip = document.createElement('button');
  allChip.className = `filter-chip ${activeId === 'all' ? 'active' : ''}`;
  allChip.textContent = 'All';
  allChip.dataset.id = 'all';
  allChip.addEventListener('click', () => {
    wrapper.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    allChip.classList.add('active');
    onSelect('all');
  });
  chips.appendChild(allChip);

  categories.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = `filter-chip ${activeId === cat.id ? 'active' : ''}`;
    chip.textContent = cat.name;
    chip.dataset.id = cat.id;
    chip.addEventListener('click', () => {
      wrapper.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      onSelect(cat.id);
    });
    chips.appendChild(chip);
  });

  wrapper.appendChild(chips);
  return wrapper;
}


// ─── Brand Pills Scroll ─────────────────────────────────────────
export function createBrandScroll(brands, onSelect) {
  const scroll = document.createElement('div');
  scroll.className = 'brands-scroll';

  brands.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'brand-pill';
    btn.dataset.brandId = b.id;
    btn.innerHTML = `<span>${b.name}</span>`;
    btn.addEventListener('click', () => onSelect(b.id));
    scroll.appendChild(btn);
  });

  return scroll;
}


// ─── Model Pills Scroll ─────────────────────────────────────────
export function createModelScroll(devices, onSelect) {
  const scroll = document.createElement('div');
  scroll.className = 'models-scroll';

  devices.forEach(d => {
    const btn = document.createElement('button');
    btn.className = 'model-pill';
    btn.dataset.deviceId = d.id;
    btn.innerHTML = `
      <span class="model-name">${d.name}</span>
      <span class="cutter-badge ${d.cutterStatus}">${d.cutterStatus === 'available' ? 'Cut Ready' : 'Verify'}</span>
    `;
    btn.addEventListener('click', () => onSelect(d.id));
    scroll.appendChild(btn);
  });

  return scroll;
}


// ─── Stepper ────────────────────────────────────────────────────
export function createStepper(currentStep = 1) {
  const stepper = document.createElement('div');
  stepper.className = 'checkout-stepper progress-stepper';

  const steps = [
    { num: 1, label: 'Select Model' },
    { num: 2, label: 'Fill Address' },
    { num: 3, label: 'Submit to WhatsApp' }
  ];

  steps.forEach((s, idx) => {
    if (idx > 0) {
      const line = document.createElement('div');
      line.className = `stepper-line ${currentStep >= s.num ? 'completed active' : ''}`;
      stepper.appendChild(line);
    }

    const step = document.createElement('div');
    const isCompleted = currentStep > s.num;
    const isActive = currentStep === s.num;
    step.className = `stepper-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;

    step.innerHTML = `
      <div class="stepper-circle">
        ${isCompleted ? Icons.check : s.num}
      </div>
      <span class="stepper-label">${s.label}</span>
    `;
    stepper.appendChild(step);
  });

  return stepper;
}


// ─── Bottom Navigation ──────────────────────────────────────────
export function createBottomNav(activePage = 'home') {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';

  const items = [
    { id: 'home', label: 'Home', icon: Icons.home, href: '/' },
    { id: 'categories', label: 'Categories', icon: Icons.grid, href: '/phone-skins/' },
    { id: 'favorites', label: 'Favorites', icon: Icons.heart, href: '/favorites.html' },
    { id: 'laptops', label: 'Laptops', icon: Icons.laptop, href: '/laptop-skins/' },
    { id: 'order', label: 'Order', icon: Icons.cart, href: '/checkout' }
  ];

  items.forEach(item => {
    const a = document.createElement('a');
    a.className = `bottom-nav-item ${item.id === activePage ? 'active' : ''}`;
    a.href = item.href;
    a.innerHTML = `${item.icon}<span>${item.label}</span>`;
    nav.appendChild(a);
  });

  return nav;
}


// ─── Header ─────────────────────────────────────────────────────
export function createHeader(options = {}) {
  const { showBack = false, showSearch = true, activePage = '' } = options;

  const header = document.createElement('header');
  header.className = 'top-header';
  header.innerHTML = `
    <div class="header-inner">
      <div class="header-left">
        ${showBack ? `<button class="header-back-btn" onclick="history.back()" aria-label="Go back">${Icons.arrowLeft}</button>` : ''}
        <a href="/" class="header-logo">
          <span class="logo-text">Skinify</span>
          <span class="logo-tagline">Style Your Tech</span>
        </a>
      </div>

      <!-- Meaningful Desktop & Tablet Navigation -->
      <nav class="header-nav-links">
        <a href="/phone-skins/" class="header-nav-link ${activePage === 'categories' ? 'active' : ''}">Phone Skins</a>
        <a href="/laptop-skins/" class="header-nav-link ${activePage === 'laptops' ? 'active' : ''}">Laptop Skins</a>
        <a href="/favorites.html" class="header-nav-link ${activePage === 'favorites' ? 'active' : ''}">Favorites</a>
      </nav>

      <div class="header-actions">
        ${showSearch ? `<button class="header-action-btn" id="header-search-btn" aria-label="Search" title="Search Skins & Models">${Icons.search}</button>` : ''}
        <a href="/checkout" class="header-action-btn header-cart-btn" id="header-cart-btn" aria-label="View Order" title="View Order">
          ${Icons.cart}
          <span class="header-cart-badge" id="header-cart-badge" style="display:none">0</span>
        </a>
        <a href="#" class="header-action-btn whatsapp-btn" id="header-whatsapp-btn" aria-label="WhatsApp Support" title="Chat on WhatsApp">
          ${Icons.whatsapp}
          <span class="badge-dot"></span>
        </a>
      </div>
    </div>
  `;

  // Update header cart badge live
  const updateBadge = () => {
    const badge = header.querySelector('#header-cart-badge');
    if (!badge) return;
    const count = Cart.count();
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
      badge.classList.add('badge-bump');
      setTimeout(() => badge.classList.remove('badge-bump'), 300);
    } else {
      badge.style.display = 'none';
    }
  };

  updateBadge();
  window.addEventListener('cart-updated', updateBadge);

  // Wire up Header Search button
  const searchBtn = header.querySelector('#header-search-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const overlay = document.getElementById('search-overlay');
      if (overlay) {
        overlay.classList.add('active');
        setTimeout(() => document.getElementById('search-input')?.focus(), 100);
      } else {
        window.location.href = '/search.html';
      }
    });
  }

  // Wire up WhatsApp Support button
  const waBtn = header.querySelector('#header-whatsapp-btn');
  if (waBtn) {
    waBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const num = options.whatsappNumber || '919876543210';
      window.open(Utils.buildWhatsAppURL(num, 'Hi Skinify 👋\nI need help choosing a skin or finding my device!'), '_blank');
    });
  }

  return header;
}


// ─── Search Overlay ─────────────────────────────────────────────
export function createSearchOverlay(dataService) {
  const overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.id = 'search-overlay';

  overlay.innerHTML = `
    <div class="search-overlay-header">
      <span>${Icons.search}</span>
      <input type="text" class="search-input" id="search-input" placeholder="Search phone models, laptop, skins..." autofocus>
      <button class="search-close-btn" id="search-close-btn">Cancel</button>
    </div>
    <div class="search-results" id="search-results">
      <!-- Quick Chips when input is empty -->
      <div class="search-suggestions" id="search-suggestions">
        <div class="search-suggestions-title">🔥 Trending Searches</div>
        <div class="search-chips-row">
          <button class="search-quick-chip" type="button">iPhone 16 Pro</button>
          <button class="search-quick-chip" type="button">Galaxy S25 Ultra</button>
          <button class="search-quick-chip" type="button">OnePlus 13</button>
          <button class="search-quick-chip" type="button">Redmi Note 13</button>
          <button class="search-quick-chip" type="button">Anime</button>
          <button class="search-quick-chip" type="button">Black Marble</button>
          <button class="search-quick-chip" type="button">MacBook Air</button>
        </div>
      </div>
      <div class="search-not-found" style="display:none" id="search-not-found">
        <h3>No results found</h3>
        <p>Can't find your model? We can precision-cut custom skins on request!</p>
        <a href="/checkout?requestModel=true" class="btn btn-primary">Request My Model</a>
      </div>
    </div>
  `;

  // Wire up search
  const input = overlay.querySelector('#search-input');
  const resultsEl = overlay.querySelector('#search-results');
  const notFound = overlay.querySelector('#search-not-found');
  const suggestions = overlay.querySelector('#search-suggestions');
  const closeBtn = overlay.querySelector('#search-close-btn');

  closeBtn.addEventListener('click', () => overlay.classList.remove('active'));

  // Quick chips click handler
  overlay.querySelectorAll('.search-quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      input.value = chip.textContent.trim();
      doSearch();
    });
  });

  const doSearch = Utils.debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) {
      notFound.style.display = 'none';
      if (suggestions) suggestions.style.display = 'block';
      resultsEl.querySelectorAll('.search-result-group').forEach(g => g.remove());
      return;
    }

    if (suggestions) suggestions.style.display = 'none';
    Analytics.search(q);
    const results = await dataService.searchAll(q);
    resultsEl.querySelectorAll('.search-result-group').forEach(g => g.remove());

    const hasResults = results.devices.length || results.products.length || results.categories.length;
    notFound.style.display = hasResults ? 'none' : 'block';

    if (results.devices.length) {
      const group = createResultGroup('Devices & Models', results.devices.map(d => ({
        text: d.name,
        sub: `${d.brand ? d.brand.charAt(0).toUpperCase() + d.brand.slice(1) : ''} · ${d.cutterStatus === 'available' ? 'Precision Cut Ready' : 'Template Available'}`,
        icon: d.type === 'laptop' ? Icons.laptop : Icons.phone,
        href: d.type === 'phone' ? `/phone-skins/${d.id}/` : `/laptop-skins/?device=${d.id}`
      })));
      resultsEl.insertBefore(group, notFound);
    }

    if (results.products.length) {
      const group = createResultGroup('Skins', results.products.map(p => ({
        text: p.name,
        sub: `₹${p.price} · ${p.category}`,
        icon: Icons.package,
        href: `/checkout.html?product=${p.id}`
      })));
      resultsEl.insertBefore(group, notFound);
    }

    if (results.categories.length) {
      const group = createResultGroup('Categories', results.categories.map(c => ({
        text: c.name,
        sub: c.description,
        icon: Icons.grid,
        href: `/phone-skins/?category=${c.id}`
      })));
      resultsEl.insertBefore(group, notFound);
    }
  }, 250);

  input.addEventListener('input', doSearch);

  // Close on Escape
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.classList.remove('active');
  });

  return overlay;
}

function createResultGroup(title, items) {
  const group = document.createElement('div');
  group.className = 'search-result-group';
  group.innerHTML = `<div class="search-result-group-title">${title}</div>`;
  items.forEach(item => {
    const row = document.createElement('a');
    row.className = 'search-result-item';
    row.href = item.href;
    row.innerHTML = `
      <div class="result-icon">${item.icon}</div>
      <div>
        <div class="result-text">${item.text}</div>
        ${item.sub ? `<div class="result-sub">${item.sub}</div>` : ''}
      </div>
    `;
    group.appendChild(row);
  });
  return group;
}


// ─── Skeleton Loader ────────────────────────────────────────────
export function createSkeletonCards(count = 6) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'product-card skeleton-card';
    card.innerHTML = `
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton skeleton-text" style="width:70%"></div>
      <div class="skeleton skeleton-text short" style="width:40%"></div>
    `;
    frag.appendChild(card);
  }
  return frag;
}


// ─── Init shared page elements ──────────────────────────────────
export async function initPage(dataService, options = {}) {
  const { activePage = 'home', showBack = false, showSearch = true } = options;

  // Insert header
  const header = createHeader({ showBack, showSearch });
  document.body.insertBefore(header, document.body.firstChild);

  // Insert bottom nav
  const bottomNav = createBottomNav(activePage);
  document.body.appendChild(bottomNav);

  // Insert search overlay
  const searchOverlay = createSearchOverlay(dataService);
  document.body.appendChild(searchOverlay);

  // Wire search button
  const searchBtn = document.getElementById('header-search-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      searchOverlay.classList.add('active');
      setTimeout(() => document.getElementById('search-input')?.focus(), 100);
    });
  }

  // Wire WhatsApp header button
  const settings = await dataService.getSettings();
  const waBtn = document.getElementById('header-whatsapp-btn');
  if (waBtn && settings.whatsappNumber) {
    waBtn.href = Utils.buildWhatsAppURL(settings.whatsappNumber, 'Hi Skinify 👋\nI have a question about skins.');
    waBtn.target = '_blank';
    waBtn.rel = 'noopener noreferrer';
  }

  // Floating cart banner if items in cart
  renderFloatingCartBanner();

  // Page view analytics
  Analytics.pageView();
}
