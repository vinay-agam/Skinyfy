/**
 * Cormal — Core Application Module
 * DataService, Utils, Favorites, Analytics, SEO helpers
 * 
 * Architecture: All data fetching goes through DataService.
 * In V2, swap fetch('/data/...') calls to fetch('/api/...') — UI stays the same.
 */

// ─── Data Service ───────────────────────────────────────────────
export class DataService {
  constructor() {
    this._cache = {};
  }

  async _fetch(key, path) {
    if (this._cache[key]) return this._cache[key];
    try {
      const resolvedPath = Utils.resolveUrl(path);
      const res = await fetch(`${resolvedPath}?v=3`);
      if (!res.ok) throw new Error(`Failed to load ${resolvedPath} (${res.status})`);
      const data = await res.json();
      this._cache[key] = data;
      return data;
    } catch (err) {
      console.error(`DataService: ${err.message}`);
      return Array.isArray(this._cache[key]) ? [] : {};
    }
  }

  getSettings()   { return this._fetch('settings',   'data/settings.json'); }
  getProducts()   { return this._fetch('products',   'data/products.json'); }
  getCategories() { return this._fetch('categories', 'data/categories.json'); }
  getBrands()     { return this._fetch('brands',     'data/brands.json'); }
  getDevices()    { return this._fetch('devices',    'data/devices.json'); }
  getSkinTypes()  { return this._fetch('skinTypes',  'data/skin-types.json'); }

  // Filtered helpers
  async getActiveProducts() {
    const products = await this.getProducts();
    return products.filter(p => p.active);
  }

  async getProductsByType(type) {
    const products = await this.getActiveProducts();
    return products.filter(p => p.deviceType === type);
  }

  async getProductsByCategory(category) {
    const products = await this.getActiveProducts();
    if (category === 'all' || !category) return products;
    if (category === 'trending') return products.filter(p => p.badges && p.badges.length > 0);
    return products.filter(p => p.category === category);
  }

  async getProductBySlug(slug) {
    const products = await this.getProducts();
    return products.find(p => p.slug === slug) || null;
  }

  async getBrandsByType(type) {
    const brands = await this.getBrands();
    return brands.filter(b => b.active && b.deviceTypes.includes(type)).sort((a,b) => a.order - b.order);
  }

  async getDevicesByBrand(brand) {
    const devices = await this.getDevices();
    return devices.filter(d => d.brand === brand);
  }

  async getDeviceById(id) {
    const devices = await this.getDevices();
    return devices.find(d => d.id === id) || null;
  }

  // ─── Smart Search Engine with Relevance Scoring ──────────────────
  async searchDevices(query) {
    if (!query || query.trim().length < 2) return [];
    const devices = await this.getDevices();
    const rawQ = query.trim().toLowerCase();
    const cleanQ = rawQ.replace(/[^a-z0-9]/g, '');
    const tokens = rawQ.split(/\s+/).filter(t => t.length > 0);

    const scored = [];
    for (const d of devices) {
      let score = 0;
      const dName = d.name.toLowerCase();
      const dClean = dName.replace(/[^a-z0-9]/g, '');
      const dBrand = (d.brand || '').toLowerCase();
      const aliases = (d.aliases || []).map(a => a.toLowerCase());
      const aliasCleans = aliases.map(a => a.replace(/[^a-z0-9]/g, ''));

      // 1. Exact match
      if (dName === rawQ || dClean === cleanQ) {
        score += 200;
      }
      // 2. Starts with query
      else if (dName.startsWith(rawQ) || dClean.startsWith(cleanQ)) {
        score += 100;
      }
      // 3. Exact alias match (e.g. CPH2581, SM-S928B)
      else if (aliases.some(a => a === rawQ || a.replace(/[^a-z0-9]/g, '') === cleanQ)) {
        score += 120;
      }
      // 4. Contains exact query string
      else if (dName.includes(rawQ) || dClean.includes(cleanQ)) {
        score += 75;
      }

      // 5. Multi-token matching (e.g. "15 pro", "s24 ultra", "nord ce")
      let matchedTokens = 0;
      for (const token of tokens) {
        const tokenClean = token.replace(/[^a-z0-9]/g, '');
        if (dName.includes(token) || dClean.includes(tokenClean)) {
          matchedTokens++;
          score += 25;
        } else if (dBrand === token || dBrand.includes(token)) {
          matchedTokens++;
          score += 15;
        } else if (aliasCleans.some(a => a.includes(tokenClean))) {
          matchedTokens++;
          score += 20;
        }
      }

      // Full token coverage bonus
      if (tokens.length > 1 && matchedTokens === tokens.length) {
        score += 50;
      }

      // Modern/popular devices priority
      if (/(iphone\s*1[456]|galaxy\s*s2[345]|oneplus\s*1[123]|pixel\s*[89]|redmi\s*note\s*1[23])/i.test(dName)) {
        score += 10;
      }

      if (score > 0) {
        scored.push({ device: d, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.device);
  }

  async searchAll(query) {
    if (!query || query.trim().length < 2) return { devices: [], products: [], categories: [] };
    const rawQ = query.trim().toLowerCase();
    const cleanQ = rawQ.replace(/[^a-z0-9]/g, '');
    const tokens = rawQ.split(/\s+/).filter(t => t.length > 0);

    const [devices, products, categories] = await Promise.all([
      this.getDevices(),
      this.getActiveProducts(),
      this.getCategories()
    ]);

    // 1. Devices (scored and ranked)
    const scoredDevices = await this.searchDevices(rawQ);

    // 2. Products (scored and ranked)
    const scoredProducts = [];
    for (const p of products) {
      let score = 0;
      const pName = p.name.toLowerCase();
      const pClean = pName.replace(/[^a-z0-9]/g, '');
      const pCat = (p.category || '').toLowerCase();
      const pDesc = (p.description || '').toLowerCase();
      const badges = (p.badges || []).map(b => b.toLowerCase());

      if (pName === rawQ || pClean === cleanQ) {
        score += 200;
      } else if (pName.startsWith(rawQ) || pClean.startsWith(cleanQ)) {
        score += 100;
      } else if (pName.includes(rawQ) || pClean.includes(cleanQ)) {
        score += 70;
      }

      for (const token of tokens) {
        if (pName.includes(token)) score += 30;
        if (pCat.includes(token)) score += 20;
        if (pDesc.includes(token)) score += 10;
        if (badges.some(b => b.includes(token))) score += 15;
        if (p.skinType && p.skinType.toLowerCase().includes(token)) score += 40;
        if (p.supportedSkinTypes && p.supportedSkinTypes.some(st => st.toLowerCase().includes(token))) score += 25;
      }

      if (score > 0) {
        scoredProducts.push({ product: p, score });
      }
    }
    scoredProducts.sort((a, b) => b.score - a.score);

    // 3. Categories (scored)
    const matchedCategories = categories.filter(c => 
      c.active && (c.name.toLowerCase().includes(rawQ) || c.id.toLowerCase().includes(rawQ))
    );

    return {
      devices: scoredDevices.slice(0, 10),
      products: scoredProducts.map(s => s.product).slice(0, 8),
      categories: matchedCategories.slice(0, 4)
    };
  }

  async getCompatibleProducts(deviceId) {
    const products = await this.getActiveProducts();
    return products.filter(p => p.compatibleDevices && p.compatibleDevices.includes(deviceId));
  }
}

// ─── Singleton ──────────────────────────────────────────────────
export const dataService = new DataService();


// ─── Utilities ──────────────────────────────────────────────────
export const Utils = {
  getBasePath() {
    if (typeof window === 'undefined') return '/';
    const isGh = window.location.hostname.endsWith('github.io');
    if (isGh) {
      const repo = window.location.pathname.split('/').filter(Boolean)[0];
      return repo ? '/' + repo + '/' : '/';
    }
    return '/';
  },

  resolveUrl(path) {
    if (!path) return this.getBasePath();
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//') || path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('#') || path.startsWith('mailto:') || path.startsWith('tel:')) {
      return path;
    }
    const base = this.getBasePath();
    const clean = path.replace(/^\/+/, '');
    return `${base}${clean}`;
  },

  formatPrice(amount, symbol = '₹') {
    return `${symbol}${amount.toLocaleString('en-IN')}`;
  },

  generateOrderId(prefix = 'SK') {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    return `${prefix}-${yy}${mm}${dd}-${rand}`;
  },

  slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  },

  debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  // Deterministic gradient from product id (for placeholder images)
  getPlaceholderGradient(id) {
    const gradients = [
      'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      'linear-gradient(135deg, #2d2d44 0%, #383850 50%, #1a1a2e 100%)',
      'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      'linear-gradient(135deg, #1a1a2e 0%, #e94560 100%)',
      'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
      'linear-gradient(135deg, #232526 0%, #414345 100%)',
      'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
      'linear-gradient(135deg, #200122 0%, #6f0000 100%)',
      'linear-gradient(135deg, #1f1c2c 0%, #928dab 100%)',
      'linear-gradient(135deg, #0b0b0b 0%, #3a3a3a 100%)',
      'linear-gradient(135deg, #373b44 0%, #4286f4 100%)',
      'linear-gradient(135deg, #654ea3 0%, #eaafc8 100%)',
      'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
      'linear-gradient(135deg, #c94b4b 0%, #4b134f 100%)',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
    return gradients[Math.abs(hash) % gradients.length];
  },

  // Build WhatsApp URL with pre-filled message
  buildWhatsAppURL(phoneNumber, message) {
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${phoneNumber}?text=${encoded}`;
  },

  // Format skin type label
  formatSkinType(typeId) {
    const map = {
      'glitter': 'Glitter',
      '8pa': '8PA Skin',
      'embossed': 'Embossed',
      'leather': 'Leather',
      'front-skin': 'Front Skin',
      'back-skin': 'Back Skin',
      'laptop-matt': 'Laptop Matte'
    };
    return map[typeId] || (typeId ? typeId.charAt(0).toUpperCase() + typeId.slice(1) : '');
  },

  // Indian states list
  indianStates: [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
    'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
    'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
    'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
    'Uttarakhand','West Bengal','Delhi','Jammu and Kashmir','Ladakh',
    'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
    'Lakshadweep','Puducherry'
  ],

  // Validate Indian phone number
  isValidPhone(num) {
    const cleaned = num.replace(/[\s\-\+]/g, '');
    return /^(91)?[6-9]\d{9}$/.test(cleaned);
  },

  // Validate 6-digit pincode
  isValidPincode(pin) {
    return /^\d{6}$/.test(pin.trim());
  }
};


// ─── Favorites (localStorage) ───────────────────────────────────
export const Favorites = {
  KEY: 'cormal_favorites',

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || JSON.parse(localStorage.getItem('skinify_favorites')) || [];
    } catch { return []; }
  },

  has(productId) {
    return this.getAll().includes(productId);
  },

  toggle(productId) {
    const favs = this.getAll();
    const idx = favs.indexOf(productId);
    if (idx > -1) {
      favs.splice(idx, 1);
    } else {
      favs.push(productId);
    }
    localStorage.setItem(this.KEY, JSON.stringify(favs));
    return idx === -1; // returns true if added, false if removed
  },

  count() {
    return this.getAll().length;
  }
};


// ─── Shopping Cart (multi-item order) ───────────────────────────
export const Cart = {
  KEY: 'cormal_cart',

  getItems() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || localStorage.getItem('skinify_cart') || '[]');
    } catch {
      return [];
    }
  },

  saveItems(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: items }));
  },

  addItem(item, forceNewItem = false) {
    const items = this.getItems();
    const existingIndex = forceNewItem ? -1 : items.findIndex(i => i.productId === item.productId && i.deviceId === item.deviceId && (i.skinType || '') === (item.skinType || ''));
    if (existingIndex > -1) {
      items[existingIndex].qty = (items[existingIndex].qty || 1) + (item.qty || 1);
      if (item.cutterStatus) {
        items[existingIndex].cutterStatus = item.cutterStatus;
      }
    } else {
      items.push({
        ...item,
        skinType: item.skinType || (item.deviceType === 'laptop' ? 'laptop-matt' : 'back-skin'),
        qty: item.qty || 1,
        cartItemId: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
      });
    }
    this.saveItems(items);
    return items;
  },

  removeItem(cartItemId) {
    const items = this.getItems().filter(i => i.cartItemId !== cartItemId);
    this.saveItems(items);
    return items;
  },

  updateItem(cartItemId, updates) {
    const items = this.getItems().map(i => i.cartItemId === cartItemId ? { ...i, ...updates } : i);
    this.saveItems(items);
    return items;
  },

  clear() {
    localStorage.removeItem(this.KEY);
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: [] }));
  },

  count() {
    return this.getItems().reduce((sum, item) => sum + (item.qty || 1), 0);
  },

  subtotal() {
    return this.getItems().reduce((sum, item) => sum + ((Number(item.productPrice) || 0) * (item.qty || 1)), 0);
  }
};


// ─── Analytics (lightweight) ────────────────────────────────────
export const Analytics = {
  track(event, data = {}) {
    const entry = {
      event,
      data,
      timestamp: new Date().toISOString(),
      page: window.location.pathname
    };
    // Log to console in V1; in V2, send to analytics endpoint
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('📊 Analytics:', entry);
    }
    // Store recent events for debugging
    try {
      const events = JSON.parse(sessionStorage.getItem('cormal_events') || sessionStorage.getItem('skinify_events') || '[]');
      events.push(entry);
      if (events.length > 100) events.shift();
      sessionStorage.setItem('cormal_events', JSON.stringify(events));
    } catch {}
  },

  pageView() { this.track('page_view'); },
  productView(id) { this.track('product_view', { productId: id }); },
  search(query) { this.track('search', { query }); },
  deviceSelected(id) { this.track('device_selected', { deviceId: id }); },
  skinSelected(id) { this.track('skin_selected', { productId: id }); },
  checkoutStarted() { this.track('checkout_started'); },
  detailsCompleted() { this.track('details_completed'); },
  whatsappClicked(orderId) { this.track('whatsapp_clicked', { orderId }); },
  unknownModelRequest(data) { this.track('unknown_model_request', data); },
  favoriteToggled(id, added) { this.track('favorite_toggled', { productId: id, added }); }
};


// ─── SEO Helpers ────────────────────────────────────────────────
export const SEO = {
  setTitle(title) {
    document.title = title;
  },

  setMeta(name, content) {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.name = name;
      document.head.appendChild(el);
    }
    el.content = content;
  },

  setOG(property, content) {
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.content = content;
  },

  setCanonical(url) {
    let el = document.querySelector('link[rel="canonical"]');
    if (!el) {
      el = document.createElement('link');
      el.rel = 'canonical';
      document.head.appendChild(el);
    }
    el.href = url;
  },

  addJsonLd(data) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }
};


// ─── SVG Icons ──────────────────────────────────────────────────
export const Icons = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
  
  grid: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect></svg>`,
  
  heart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
  
  heartFilled: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
  
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  
  whatsapp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
  
  phone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
  
  laptop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="20" x2="22" y2="20"></line></svg>`,
  
  user: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  
  arrowLeft: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`,
  
  arrowRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`,
  
  chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
  
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  
  cart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
  
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  
  menu: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`,
  
  x: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  
  mapPin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
  
  shield: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  
  lock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
  
  truck: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`,
  
  star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
  
  package: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
  
  trending: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`,

  coins: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"></circle><path d="M18.09 10.37A6 6 0 1 1 10.34 18"></path><path d="M7 6h1v4"></path><path d="M16.71 13.88l.7.71-2.82 2.82"></path></svg>`
};
