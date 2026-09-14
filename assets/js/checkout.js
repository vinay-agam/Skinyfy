/**
 * Cormal — Multi-Item Ecommerce Checkout Flow
 * 3-step order process:
 * Step 1: Select Model for all skins (Add / Remove / Change skins)
 * Step 2: Fill Address
 * Step 3: Review & Submit to WhatsApp
 */

import { dataService, Utils, Analytics, Icons, Cart } from './app.js';
import { createStepper } from './components.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class CheckoutFlow {
  constructor(containerEl) {
    this.container = containerEl;
    this.currentStep = 1;
    this.items = [];
    this.customer = {
      name: '',
      phone: '',
      email: '',
      address: '',
      landmark: '',
      pincode: '',
      city: '',
      state: ''
    };
    this.settings = null;
    this.allProducts = [];
    this.allBrands = [];
    this.allDevices = [];
  }

  async init() {
    this.settings = await dataService.getSettings();
    this.allProducts = await dataService.getActiveProducts();
    this.allBrands = await dataService.getBrands();
    this.allDevices = await dataService.getDevices();

    // Check URL params
    const params = new URLSearchParams(window.location.search);
    const productParam = params.get('product') || params.get('skin');
    const deviceParam = params.get('device') || params.get('model') || params.get('phone') || params.get('slug');
    const replaceCartItemId = params.get('replace');

    // Match device if provided
    let matchedDevice = null;
    if (deviceParam) {
      matchedDevice = this.allDevices.find(d => 
        d.id.toLowerCase() === deviceParam.toLowerCase() ||
        d.name.toLowerCase() === deviceParam.toLowerCase() ||
        d.aliases?.some(a => a.toLowerCase() === deviceParam.toLowerCase())
      );
    }
    if (!matchedDevice) {
      const pathParts = window.location.pathname.toLowerCase().split('/').filter(Boolean);
      matchedDevice = this.allDevices.find(d => pathParts.includes(d.id.toLowerCase()));
    }

    // Load current cart items
    this.items = Cart.getItems();

    // 1. If replacing a skin from the product page
    if (replaceCartItemId && productParam) {
      const newProduct = this.allProducts.find(p => p.id === productParam || p.slug === productParam);
      if (newProduct) {
        const itemIdx = this.items.findIndex(i => i.cartItemId === replaceCartItemId);
        if (itemIdx > -1) {
          this.items[itemIdx].productId = newProduct.id;
          this.items[itemIdx].productName = newProduct.name;
          this.items[itemIdx].productPrice = newProduct.price;
          this.items[itemIdx].productImage = newProduct.images[0] || '';
          this.items[itemIdx].deviceType = newProduct.deviceType || 'phone';
          if (matchedDevice) {
            this.items[itemIdx].deviceId = matchedDevice.id;
            this.items[itemIdx].deviceName = matchedDevice.name;
            this.items[itemIdx].brandId = matchedDevice.brand;
            this.items[itemIdx].brandName = this.allBrands.find(b => b.id === matchedDevice.brand)?.name || '';
            this.items[itemIdx].cutterStatus = matchedDevice.cutterStatus || 'available';
          }
          Cart.saveItems(this.items);
        }
      }
    }
    // 2. If a product was passed in URL and not replacing
    else if (productParam) {
      const product = this.allProducts.find(p => p.id === productParam || p.slug === productParam);
      if (product) {
        const prodSkinType = product.skinType || (product.deviceType === 'laptop' ? 'laptop-matt' : 'back-skin');
        const isActionAdd = params.get('action') === 'add';

        // Check if an item for this product already exists in cart with same product and skinType
        const existing = this.items.find(i => i.productId === product.id && (!matchedDevice || i.deviceId === matchedDevice.id) && (i.skinType === prodSkinType));

        if (existing && !isActionAdd) {
          if (matchedDevice && !existing.deviceId) {
            existing.deviceId = matchedDevice.id;
            existing.deviceName = matchedDevice.name;
            existing.brandId = matchedDevice.brand;
            existing.brandName = this.allBrands.find(b => b.id === matchedDevice.brand)?.name || '';
            existing.cutterStatus = matchedDevice.cutterStatus || 'available';
            Cart.saveItems(this.items);
          }
        } else if (!existing) {
          Cart.addItem({
            productId: product.id,
            productName: product.name,
            productPrice: product.price,
            productImage: product.images[0] || '',
            deviceType: product.deviceType || 'phone',
            skinType: prodSkinType,
            supportedSkinTypes: product.supportedSkinTypes || (prodSkinType ? [prodSkinType] : []),
            deviceId: matchedDevice ? matchedDevice.id : null,
            deviceName: matchedDevice ? matchedDevice.name : '',
            brandId: matchedDevice ? matchedDevice.brand : null,
            brandName: matchedDevice ? (this.allBrands.find(b => b.id === matchedDevice.brand)?.name || '') : '',
            cutterStatus: matchedDevice ? (matchedDevice.cutterStatus || 'available') : 'available',
            isUnknownModel: false,
            unknownBrand: '',
            unknownModel: '',
            unknownModelNumber: '',
            qty: 1
          }, isActionAdd);
          this.items = Cart.getItems();
        }
      }
    }

    // 3. If any item has deviceId, ensure full device/brand info is populated
    this.items.forEach(item => {
      if (item.deviceId && (!item.brandId || !item.brandName || !item.deviceName || item.deviceName === item.deviceId)) {
        const dev = this.allDevices.find(d => d.id.toLowerCase() === item.deviceId.toLowerCase());
        if (dev) {
          item.deviceId = dev.id;
          item.deviceName = dev.name;
          item.brandId = dev.brand;
          const brandObj = this.allBrands.find(b => b.id === dev.brand);
          item.brandName = brandObj ? brandObj.name : dev.brand;
          item.cutterStatus = dev.cutterStatus || 'available';
        }
      }
    });

    // If matchedDevice is available from URL, assign it to any item missing device or the last item
    if (matchedDevice && this.items.length > 0) {
      const itemToUpdate = this.items.find(i => !i.deviceId) || this.items[this.items.length - 1];
      if (itemToUpdate) {
        itemToUpdate.deviceId = matchedDevice.id;
        itemToUpdate.deviceName = matchedDevice.name;
        itemToUpdate.brandId = matchedDevice.brand;
        const brandObj = this.allBrands.find(b => b.id === matchedDevice.brand);
        itemToUpdate.brandName = brandObj ? brandObj.name : matchedDevice.brand;
        itemToUpdate.cutterStatus = matchedDevice.cutterStatus || 'available';
      }
    }
    Cart.saveItems(this.items);

    // Clean URL without reload if query had replace or add or product
    if (replaceCartItemId || params.get('action') || productParam) {
      const cleanUrl = new URL(window.location);
      cleanUrl.searchParams.delete('replace');
      cleanUrl.searchParams.delete('action');
      cleanUrl.searchParams.delete('product');
      cleanUrl.searchParams.delete('skin');
      window.history.replaceState({}, '', cleanUrl);
    }

    Analytics.checkoutStarted();
    this.render();
  }

  render() {
    this.container.innerHTML = '';

    // Stepper
    const stepper = createStepper(this.currentStep);
    this.container.appendChild(stepper);

    // Steps
    const step1 = this.createStep1();
    const step2 = this.createStep2();
    const step3 = this.createStep3();

    step1.classList.toggle('active', this.currentStep === 1);
    step2.classList.toggle('active', this.currentStep === 2);
    step3.classList.toggle('active', this.currentStep === 3);

    // Layout Wrapper for Desktop & Tablet
    const layout = document.createElement('div');
    layout.className = 'checkout-layout';

    const mainCol = document.createElement('div');
    mainCol.className = 'checkout-main-col';
    mainCol.appendChild(step1);
    mainCol.appendChild(step2);
    mainCol.appendChild(step3);
    layout.appendChild(mainCol);

    if (this.items.length > 0) {
      const sidebarCol = this.createDesktopSidebar();
      layout.appendChild(sidebarCol);
    }

    this.container.appendChild(layout);

    // Bottom bar (mobile/tablet)
    this.renderBottomBar();
  }

  // ─── STEP 1: Select Model (For all skins in order) ───────────────
  createStep1() {
    const step = document.createElement('div');
    step.className = 'checkout-step';
    step.id = 'step-1';

    // Empty state
    if (this.items.length === 0) {
      step.innerHTML = `
        <div style="text-align:center;padding:var(--space-12) var(--space-4)">
          <div style="width:64px;height:64px;border-radius:var(--radius-full);background:var(--color-primary-light);color:var(--color-primary);display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-4)">
            ${Icons.package}
          </div>
          <h2 class="checkout-section-title">Your Order is Empty</h2>
          <p class="checkout-section-subtitle" style="margin-bottom:var(--space-6)">Select a skin design to get started!</p>
          <a href="${Utils.resolveUrl('phone-skins/')}" class="btn btn-primary btn-lg" style="display:inline-flex">
            Browse Phone Skins
          </a>
        </div>
      `;
      return step;
    }

    const subtotal = Cart.subtotal();
    const freeDeliveryThreshold = this.settings?.freeDeliveryAbove || 999;
    const isFreeDelivery = subtotal >= freeDeliveryThreshold;
    const deliveryCharge = isFreeDelivery ? 0 : (this.settings?.defaultDeliveryCharge || 50);

    const hasOnlyLaptops = this.items.length > 0 && this.items.every(i => i.deviceType === 'laptop');
    const addMoreUrl = hasOnlyLaptops ? 'laptop-skins/?action=add' : 'phone-skins/?action=add';

    step.innerHTML = `
      <div style="margin-bottom:var(--space-4)">
        <h2 class="checkout-section-title">Select Device Model</h2>
        <p class="checkout-section-subtitle">Choose the exact phone or laptop model for each skin</p>
      </div>

      <!-- Items List -->
      <div class="checkout-items-list" id="checkout-items-list"></div>

      <!-- Add Another Skin Button -->
      <a href="${Utils.resolveUrl(addMoreUrl)}" class="add-more-skins-btn" id="add-more-skins-btn">
        ${Icons.plus}
        <span>Add Another Skin Design</span>
      </a>

      <!-- Subtotal Bar -->
      <div class="cart-summary-total-bar">
        <div>
          <span style="font-weight:700">Subtotal (${Cart.count()} ${Cart.count() === 1 ? 'skin' : 'skins'}):</span>
          <span style="font-size:var(--text-lg);font-weight:800;color:var(--color-primary);margin-left:var(--space-2)">₹${subtotal}</span>
        </div>
        <div style="font-size:var(--text-xs);color:${isFreeDelivery ? 'var(--color-primary)' : 'var(--color-text-secondary)'};font-weight:600">
          ${isFreeDelivery ? '✓ FREE Delivery Unlocked!' : `Add ₹${freeDeliveryThreshold - subtotal} for FREE Delivery`}
        </div>
      </div>
    `;

    const itemsContainer = step.querySelector('#checkout-items-list');

    // Render each item card
    this.items.forEach((item, index) => {
      const gradient = Utils.getPlaceholderGradient(item.productId);
      const brandsForType = this.allBrands.filter(b => b.active && b.deviceTypes.includes(item.deviceType || 'phone')).sort((a,b) => a.order - b.order);
      const devicesForBrand = item.brandId ? this.allDevices.filter(d => d.brand === item.brandId) : [];
      const selectedBrand = this.allBrands.find(b => b.id === item.brandId);
      const selectedDevice = this.allDevices.find(d => d.id === item.deviceId);

      // Determine the supported skin types for this specific product (2 or 3 configured types)
      const prod = this.allProducts.find(p => p.id === item.productId || p.slug === item.productId);
      const supportedList = (prod && Array.isArray(prod.supportedSkinTypes) && prod.supportedSkinTypes.length > 0)
        ? prod.supportedSkinTypes
        : (item.supportedSkinTypes && Array.isArray(item.supportedSkinTypes) && item.supportedSkinTypes.length > 0)
          ? item.supportedSkinTypes
          : (prod && prod.skinType ? [prod.skinType] : [item.skinType || (item.deviceType === 'laptop' ? 'laptop-matt' : 'back-skin')]);

      // If current item.skinType is not in the supported list, auto-select the first supported type
      if (!supportedList.includes(item.skinType)) {
        item.skinType = supportedList[0];
        Cart.saveItems(this.items);
      }

      const allSkinTypesMap = {
        'back-skin': { id: 'back-skin', name: '📱 Back Skin' },
        'front-skin': { id: 'front-skin', name: '🔲 Front Skin' },
        'glitter': { id: 'glitter', name: '✨ Glitter' },
        '8pa': { id: '8pa', name: '🛡️ 8PA Skin' },
        'embossed': { id: 'embossed', name: '⚡ Embossed' },
        'leather': { id: 'leather', name: '👔 Leather' },
        'laptop-matt': { id: 'laptop-matt', name: '💻 Laptop Matte' }
      };

      const availableSkinTypes = supportedList.map(typeId => {
        return allSkinTypesMap[typeId] || { id: typeId, name: Utils.formatSkinType(typeId) };
      });

      const itemCard = document.createElement('div');
      itemCard.className = 'checkout-cart-item';
      itemCard.id = `cart-item-${item.cartItemId}`;

      itemCard.innerHTML = `
        <!-- Item Header (Image, Title, Price, Qty, Remove) -->
        <div class="cart-item-header">
          <div class="cart-item-main">
            <div class="cart-item-thumb" style="background:${gradient}">
              ${item.productImage ? `<img src="${Utils.resolveUrl(item.productImage)}" alt="${item.productName}" onerror="this.style.display='none'">` : `<span style="font-size:0.6rem;font-weight:800;color:var(--color-primary)">${item.productName.slice(0,6)}</span>`}
            </div>
            <div class="cart-item-info">
              <div class="cart-item-title">${item.productName}</div>
              ${item.productImage ? `
                <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin:3px 0;">
                  <span style="display:inline-flex;align-items:center;background:var(--color-primary-light);color:var(--color-primary);border:1px solid var(--color-primary);padding:1px 7px;border-radius:var(--radius-full);font-size:10px;font-weight:700;">
                    ${(item.productImage.match(/\d+/) ? '#' + item.productImage.match(/\d+/)[0] : 'Design')}
                  </span>
                  <span style="display:inline-flex;align-items:center;background:rgba(255,255,255,0.06);border:1px solid var(--color-border);padding:1px 6px;border-radius:var(--radius-sm);font-size:10px;font-family:monospace;color:var(--color-text-secondary);">
                    📁 ${item.productImage.split('/').pop()}
                  </span>
                </div>
              ` : ''}
              <div class="cart-item-price">₹${item.productPrice} each</div>
              <a href="${Utils.resolveUrl((item.deviceType === 'laptop' ? 'laptop-skins/' : 'phone-skins/') + '?replace=' + item.cartItemId + (item.deviceId ? '&device=' + encodeURIComponent(item.deviceId) : ''))}" class="item-change-skin-link" style="font-size:var(--text-xs);color:var(--color-primary);background:var(--color-primary-light);padding:3px 10px;border-radius:var(--radius-full);text-decoration:none;margin-top:4px;display:inline-flex;align-items:center;gap:4px;font-weight:700">
                <span>🔄</span> Change Skin
              </a>
            </div>
          </div>
          <div class="cart-item-actions">
            <div style="display:flex;align-items:center;gap:4px">
              <button class="cart-qty-btn qty-minus" type="button" data-id="${item.cartItemId}">-</button>
              <span class="cart-qty-val">${item.qty || 1}</span>
              <button class="cart-qty-btn qty-plus" type="button" data-id="${item.cartItemId}">+</button>
            </div>
            <button class="cart-item-remove-btn" type="button" data-id="${item.cartItemId}" title="Remove Skin">
              ✕
            </button>
          </div>
        </div>

        <!-- Model Selection Section for this specific skin -->
        <div class="cart-item-model-box">
          <div class="cart-item-model-header">
            <span>Model for this skin:</span>
            ${item.deviceId 
              ? `<span style="color:var(--color-primary);font-size:var(--text-xs);font-weight:700">✓ Model Selected</span>` 
              : `<span style="color:var(--color-danger);font-size:var(--text-xs);font-weight:700">* Select Model Below</span>`}
          </div>

          <!-- Device Type Buttons -->
          <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2)">
            <button type="button" class="btn btn-sm dt-btn ${item.deviceType === 'phone' ? 'btn-primary' : 'btn-outline'}" data-type="phone" data-id="${item.cartItemId}" style="padding:4px 12px;font-size:var(--text-xs)">
              Mobile
            </button>
            <button type="button" class="btn btn-sm dt-btn ${item.deviceType === 'laptop' ? 'btn-primary' : 'btn-outline'}" data-type="laptop" data-id="${item.cartItemId}" style="padding:4px 12px;font-size:var(--text-xs)">
              Laptop
            </button>
          </div>

          <!-- Brand & Model Select Grid (Side-by-Side on Tablet/Desktop, Stacked on Mobile) -->
          <div class="cart-item-device-grid">
            <!-- Brand Searchable Select -->
            <div class="searchable-select" data-select-type="brand" data-cart-id="${item.cartItemId}" id="brand-select-wrapper-${item.cartItemId}">
              <button type="button" 
                      class="searchable-select-trigger brand-trigger ${item.brandId ? 'has-value' : ''}" 
                      id="brand-trigger-${item.cartItemId}" 
                      aria-haspopup="listbox" 
                      aria-expanded="false">
                <div class="searchable-select-trigger-content">
                  <span class="searchable-select-label">Brand</span>
                  <span class="searchable-select-value" id="brand-val-${item.cartItemId}">
                    ${selectedBrand ? selectedBrand.name : (item.brandName || 'Choose Brand')}
                  </span>
                </div>
                <span class="searchable-select-icons">
                  ${item.brandId ? `<span class="searchable-select-clear" data-action="clear-brand" data-cart-id="${item.cartItemId}" title="Clear Brand">✕</span>` : ''}
                  <svg class="searchable-select-chevron" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                  </svg>
                </span>
              </button>
              <input type="hidden" class="brand-select-item" data-id="${item.cartItemId}" value="${item.brandId || ''}">
              <div class="searchable-select-menu" id="brand-menu-${item.cartItemId}" role="listbox">
                <div class="searchable-select-search-wrap">
                  <svg class="searchable-select-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="11" cy="11" r="8" stroke-width="2"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <input type="text" 
                         class="searchable-select-input brand-search-input" 
                         placeholder="Search brand (e.g. Apple, Vivo, Samsung)..." 
                         autocomplete="off" 
                         spellcheck="false">
                  <button type="button" class="searchable-select-clear-search" style="display:none" title="Clear search">✕</button>
                </div>
                <div class="searchable-select-meta">
                  <span class="searchable-count">${brandsForType.length} brands available</span>
                </div>
                <div class="searchable-select-options" tabindex="-1">
                  ${brandsForType.map(b => `
                    <div class="searchable-option ${b.id === item.brandId ? 'selected' : ''}" data-value="${b.id}" data-label="${b.name}" data-search="${(b.name + ' ' + b.id).toLowerCase()}">
                      <span class="searchable-option-text">${b.name}</span>
                      ${b.id === item.brandId ? `<span class="searchable-option-check">✓</span>` : ''}
                    </div>
                  `).join('')}
                </div>
                <div class="searchable-select-empty" style="display:none">
                  <span class="searchable-empty-icon">🔍</span>
                  <div class="searchable-empty-title">No brands found</div>
                  <div class="searchable-empty-desc">Check your spelling</div>
                </div>
              </div>
            </div>

            <!-- Model Searchable Select -->
            <div class="searchable-select ${item.brandId ? '' : 'is-empty-brand'}" data-select-type="model" data-cart-id="${item.cartItemId}" id="model-group-${item.cartItemId}">
              <button type="button" 
                      class="searchable-select-trigger model-trigger ${item.deviceId ? 'has-value' : ''}" 
                      id="model-trigger-${item.cartItemId}" 
                      aria-haspopup="listbox" 
                      aria-expanded="false"
                      ${!item.brandId ? 'disabled' : ''}>
                <div class="searchable-select-trigger-content">
                  <span class="searchable-select-label">Model</span>
                  <span class="searchable-select-value" id="model-val-${item.cartItemId}">
                    ${selectedDevice ? selectedDevice.name : (item.brandId ? (item.deviceName || 'Choose Model') : 'Select Brand First')}
                  </span>
                </div>
                <span class="searchable-select-icons">
                  ${item.deviceId ? `<span class="searchable-select-clear" data-action="clear-model" data-cart-id="${item.cartItemId}" title="Clear Model">✕</span>` : ''}
                  <svg class="searchable-select-chevron" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                  </svg>
                </span>
              </button>
              <input type="hidden" class="model-select-item" data-id="${item.cartItemId}" value="${item.deviceId || ''}">
              <div class="searchable-select-menu" id="model-menu-${item.cartItemId}" role="listbox">
                <div class="searchable-select-search-wrap">
                  <svg class="searchable-select-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="11" cy="11" r="8" stroke-width="2"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <input type="text" 
                         class="searchable-select-input model-search-input" 
                         placeholder="Search model (e.g. V29, 15 Pro, S24)..." 
                         autocomplete="off" 
                         spellcheck="false">
                  <button type="button" class="searchable-select-clear-search" style="display:none" title="Clear search">✕</button>
                </div>
                <div class="searchable-select-meta">
                  <span class="searchable-count">${devicesForBrand.length} models available</span>
                </div>
                <div class="searchable-select-options" tabindex="-1">
                  ${devicesForBrand.map(d => `
                    <div class="searchable-option ${d.id === item.deviceId ? 'selected' : ''}" data-value="${d.id}" data-label="${d.name}" data-search="${(d.name + ' ' + (d.aliases || []).join(' ')).toLowerCase()}">
                      <div class="searchable-option-content">
                        <span class="searchable-option-text">${d.name}</span>
                        <span class="searchable-option-sub">${d.cutterStatus === 'available' ? '✓ Precision Cut' : 'Template Available'}</span>
                      </div>
                      ${d.id === item.deviceId ? `<span class="searchable-option-check">✓</span>` : ''}
                    </div>
                  `).join('')}
                </div>
                <div class="searchable-select-empty" style="display:none">
                  <span class="searchable-empty-icon">🔍</span>
                  <div class="searchable-empty-title">No models found</div>
                  <div class="searchable-empty-desc">Check your search query</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Cutter Status -->
          <div class="cutter-status-item" id="cutter-${item.cartItemId}" style="display:${item.deviceId ? 'block' : 'none'};margin-top:var(--space-2)">
            <div style="padding:6px 10px;border-radius:var(--radius-lg);font-size:var(--text-xs);background:var(--color-primary-light);color:var(--color-primary);font-weight:600">
              ✓ <strong>${item.deviceName || 'Device'}</strong>: Precision cut skin available!
            </div>
          </div>

          <!-- Skin Type / Finish Selector -->
          <div class="cart-item-skin-type-box" style="margin-top:var(--space-3);padding-top:var(--space-2);border-top:1px dashed var(--color-border)">
            <div style="font-size:var(--text-xs);font-weight:700;color:var(--color-text-secondary);margin-bottom:var(--space-2);display:flex;align-items:center;justify-content:space-between">
              <span>Finish / Skin Type:</span>
              <span class="active-type-badge" style="color:var(--color-primary);font-weight:700">${Utils.formatSkinType(item.skinType)}</span>
            </div>
            ${availableSkinTypes.length > 1 ? `
              <div class="skin-type-pill-group" style="display:flex;flex-wrap:wrap;gap:6px">
                ${availableSkinTypes.map(st => `
                  <button type="button" class="skin-type-select-btn ${st.id === item.skinType ? 'active' : ''}" data-cart-id="${item.cartItemId}" data-skin-type="${st.id}">
                    ${st.name}
                  </button>
                `).join('')}
              </div>
            ` : `
              <div style="font-size:var(--text-xs);color:var(--color-text-secondary);padding:2px 0">
                Exclusive finish available in <strong>${availableSkinTypes[0]?.name || Utils.formatSkinType(item.skinType)}</strong>
              </div>
            `}
          </div>
        </div>
      `;

      itemsContainer.appendChild(itemCard);
    });

    // ─── Wire Event Listeners ─────────────────────────────────────
    // Quantity Plus
    step.querySelectorAll('.qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = this.items.find(i => i.cartItemId === id);
        if (item) {
          item.qty = (item.qty || 1) + 1;
          Cart.saveItems(this.items);
          this.render();
        }
      });
    });

    // Quantity Minus
    step.querySelectorAll('.qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = this.items.find(i => i.cartItemId === id);
        if (item && item.qty > 1) {
          item.qty -= 1;
          Cart.saveItems(this.items);
          this.render();
        }
      });
    });

    // Skin Type Select Buttons
    step.querySelectorAll('.skin-type-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cartId = btn.dataset.cartId;
        const st = btn.dataset.skinType;
        const item = this.items.find(i => i.cartItemId === cartId);
        if (item) {
          item.skinType = st;
          Cart.saveItems(this.items);
          this.render();
        }
      });
    });

    // Remove Item
    step.querySelectorAll('.cart-item-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        Cart.removeItem(id);
        this.items = Cart.getItems();
        this.render();
      });
    });

    // Device Type Switch
    step.querySelectorAll('.dt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const type = btn.dataset.type;
        const item = this.items.find(i => i.cartItemId === id);
        if (item && item.deviceType !== type) {
          item.deviceType = type;
          item.brandId = null;
          item.brandName = '';
          item.deviceId = null;
          item.deviceName = '';
          Cart.saveItems(this.items);
          this.render();
        }
      });
    });

    // Brand and Model Searchable Selects
    this.setupSearchableSelects(step);

    return step;
  }

  // ─── Searchable Dropdown Helper Methods ─────────────────────────
  setupSearchableSelects(step) {
    const closeAllSelects = (exceptEl = null) => {
      step.querySelectorAll('.searchable-select.is-open').forEach(sel => {
        if (sel !== exceptEl) {
          sel.classList.remove('is-open');
          sel.closest('.checkout-cart-item')?.classList.remove('has-open-select');
          const trigger = sel.querySelector('.searchable-select-trigger');
          if (trigger) trigger.setAttribute('aria-expanded', 'false');
        }
      });
    };

    // Global click listener to close selects when clicking outside
    if (!this._hasBoundSelectGlobalClick) {
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.searchable-select')) {
          document.querySelectorAll('.searchable-select.is-open').forEach(sel => {
            sel.classList.remove('is-open');
            sel.closest('.checkout-cart-item')?.classList.remove('has-open-select');
            const trigger = sel.querySelector('.searchable-select-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
          });
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const open = document.querySelector('.searchable-select.is-open');
          if (open) {
            open.classList.remove('is-open');
            open.closest('.checkout-cart-item')?.classList.remove('has-open-select');
            open.querySelector('.searchable-select-trigger')?.focus();
          }
        }
      });
      this._hasBoundSelectGlobalClick = true;
    }

    step.querySelectorAll('.searchable-select').forEach(wrapper => {
      const selectType = wrapper.dataset.selectType; // 'brand' or 'model'
      const cartId = wrapper.dataset.cartId;
      const trigger = wrapper.querySelector('.searchable-select-trigger');
      const input = wrapper.querySelector('.searchable-select-input');
      const clearSearchBtn = wrapper.querySelector('.searchable-select-clear-search');
      const optionsContainer = wrapper.querySelector('.searchable-select-options');
      const parentCard = wrapper.closest('.checkout-cart-item');

      if (!trigger) return;

      // Trigger click
      trigger.addEventListener('click', (e) => {
        // If clear button on trigger was clicked
        if (e.target.closest('.searchable-select-clear')) {
          e.stopPropagation();
          this.handleClearSelect(cartId, selectType, step);
          return;
        }

        if (trigger.disabled) return;

        const isOpen = wrapper.classList.contains('is-open');
        closeAllSelects(wrapper);

        if (!isOpen) {
          wrapper.classList.add('is-open');
          parentCard?.classList.add('has-open-select');
          trigger.setAttribute('aria-expanded', 'true');
          trigger.classList.remove('select-error');

          if (input) {
            input.value = '';
            this.filterSearchableOptions(wrapper, '');
            setTimeout(() => {
              input.focus();
              const rect = wrapper.getBoundingClientRect();
              if (rect.bottom > window.innerHeight - 80) {
                wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 50);
          }
        } else {
          wrapper.classList.remove('is-open');
          parentCard?.classList.remove('has-open-select');
          trigger.setAttribute('aria-expanded', 'false');
        }
      });

      // Clear search button inside dropdown
      if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (input) {
            input.value = '';
            this.filterSearchableOptions(wrapper, '');
            input.focus();
          }
        });
      }

      // Search typing filter
      if (input) {
        input.addEventListener('input', () => {
          this.filterSearchableOptions(wrapper, input.value);
        });

        // Keyboard navigation (ArrowDown, ArrowUp, Enter)
        input.addEventListener('keydown', (e) => {
          const visibleOptions = Array.from(optionsContainer.querySelectorAll('.searchable-option')).filter(
            opt => opt.style.display !== 'none'
          );
          if (visibleOptions.length === 0) return;

          let currentHighlighted = optionsContainer.querySelector('.searchable-option.is-highlighted');
          let currentIndex = visibleOptions.indexOf(currentHighlighted);

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentHighlighted) currentHighlighted.classList.remove('is-highlighted');
            currentIndex = (currentIndex + 1) % visibleOptions.length;
            visibleOptions[currentIndex].classList.add('is-highlighted');
            visibleOptions[currentIndex].scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentHighlighted) currentHighlighted.classList.remove('is-highlighted');
            currentIndex = (currentIndex - 1 + visibleOptions.length) % visibleOptions.length;
            visibleOptions[currentIndex].classList.add('is-highlighted');
            visibleOptions[currentIndex].scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const targetOpt = currentHighlighted || visibleOptions[0];
            if (targetOpt) {
              const val = targetOpt.dataset.value;
              const lbl = targetOpt.dataset.label;
              this.handleSelectOption(cartId, selectType, val, lbl, step);
              wrapper.classList.remove('is-open');
              parentCard?.classList.remove('has-open-select');
              trigger.setAttribute('aria-expanded', 'false');
              trigger.focus();
            }
          }
        });
      }

      // Option click delegation
      if (optionsContainer) {
        optionsContainer.addEventListener('click', (e) => {
          const option = e.target.closest('.searchable-option');
          if (!option) return;
          const value = option.dataset.value;
          const label = option.dataset.label;

          this.handleSelectOption(cartId, selectType, value, label, step);
          wrapper.classList.remove('is-open');
          parentCard?.classList.remove('has-open-select');
          trigger.setAttribute('aria-expanded', 'false');
          trigger.focus();
        });
      }
    });
  }

  filterSearchableOptions(wrapper, query) {
    const q = (query || '').trim().toLowerCase();
    const selectType = wrapper.dataset.selectType;
    const optionsContainer = wrapper.querySelector('.searchable-select-options');
    if (!optionsContainer) return;

    const options = Array.from(optionsContainer.querySelectorAll('.searchable-option'));
    const emptyEl = wrapper.querySelector('.searchable-select-empty');
    const countEl = wrapper.querySelector('.searchable-count');
    const clearSearchBtn = wrapper.querySelector('.searchable-select-clear-search');

    if (clearSearchBtn) {
      clearSearchBtn.style.display = q ? 'flex' : 'none';
    }

    let visibleCount = 0;
    options.forEach(opt => {
      const searchTarget = (opt.dataset.search || opt.dataset.label || '').toLowerCase();
      const label = opt.dataset.label || '';
      const textSpan = opt.querySelector('.searchable-option-text') || opt;

      if (!q || searchTarget.includes(q)) {
        opt.style.display = 'flex';
        visibleCount++;

        if (q && textSpan) {
          const matchIdx = label.toLowerCase().indexOf(q);
          if (matchIdx !== -1) {
            const before = label.slice(0, matchIdx);
            const matched = label.slice(matchIdx, matchIdx + q.length);
            const after = label.slice(matchIdx + q.length);
            textSpan.innerHTML = `${escapeHtml(before)}<mark>${escapeHtml(matched)}</mark>${escapeHtml(after)}`;
          } else {
            textSpan.textContent = label;
          }
        } else if (textSpan) {
          textSpan.textContent = label;
        }
      } else {
        opt.style.display = 'none';
      }
      opt.classList.remove('is-highlighted');
    });

    if (emptyEl) {
      emptyEl.style.display = visibleCount === 0 ? 'block' : 'none';
      if (visibleCount === 0 && q) {
        const desc = emptyEl.querySelector('.searchable-empty-desc');
        if (desc) desc.textContent = `No results found for "${query}"`;
      }
    }

    if (countEl) {
      if (visibleCount === 0) {
        countEl.textContent = '0 matching results';
      } else if (q) {
        countEl.textContent = `Showing ${visibleCount} of ${options.length} ${selectType}s`;
      } else {
        countEl.textContent = `${options.length} ${selectType}s available`;
      }
    }
  }

  handleSelectOption(cartId, selectType, value, label, step) {
    const item = this.items.find(i => i.cartItemId === cartId);
    if (!item) return;

    if (selectType === 'brand') {
      if (item.brandId === value) return; // already selected
      item.brandId = value;
      const brand = this.allBrands.find(b => b.id === value);
      item.brandName = brand ? brand.name : label;
      item.deviceId = null;
      item.deviceName = '';
      Cart.saveItems(this.items);

      // 1. Update Brand trigger UI
      const brandWrapper = step.querySelector(`#brand-select-wrapper-${cartId}`);
      if (brandWrapper) {
        const trigger = brandWrapper.querySelector('.searchable-select-trigger');
        const valSpan = brandWrapper.querySelector('.searchable-select-value');
        const hidden = brandWrapper.querySelector('.brand-select-item');
        if (valSpan) valSpan.textContent = item.brandName;
        if (hidden) hidden.value = value;
        trigger.classList.add('has-value');
        trigger.classList.remove('select-error');

        // Add clear button if missing
        let icons = trigger.querySelector('.searchable-select-icons');
        if (icons && !icons.querySelector('.searchable-select-clear')) {
          const clearBtn = document.createElement('span');
          clearBtn.className = 'searchable-select-clear';
          clearBtn.dataset.action = 'clear-brand';
          clearBtn.dataset.cartId = cartId;
          clearBtn.title = 'Clear Brand';
          clearBtn.textContent = '✕';
          icons.insertBefore(clearBtn, icons.firstChild);
        }

        // Update selected state in options
        brandWrapper.querySelectorAll('.searchable-option').forEach(opt => {
          const isSel = opt.dataset.value === value;
          opt.classList.toggle('selected', isSel);
          let check = opt.querySelector('.searchable-option-check');
          if (isSel && !check) {
            opt.insertAdjacentHTML('beforeend', '<span class="searchable-option-check">✓</span>');
          } else if (!isSel && check) {
            check.remove();
          }
        });
      }

      // 2. Populate & Show Model dropdown
      const modelGroup = step.querySelector(`#model-group-${cartId}`);
      if (modelGroup) {
        modelGroup.classList.remove('is-empty-brand');
        modelGroup.style.display = 'block';
        const modelTrigger = modelGroup.querySelector('.searchable-select-trigger');
        const modelValSpan = modelGroup.querySelector('.searchable-select-value');
        const modelHidden = modelGroup.querySelector('.model-select-item');
        const modelClear = modelTrigger?.querySelector('.searchable-select-clear');
        if (modelClear) modelClear.remove();
        if (modelValSpan) modelValSpan.textContent = 'Choose Model';
        if (modelHidden) modelHidden.value = '';
        if (modelTrigger) {
          modelTrigger.classList.remove('has-value', 'select-error');
          modelTrigger.disabled = false;
        }

        // Filter and render devices for this brand
        const devices = this.allDevices.filter(d => d.brand === value);
        const optionsCont = modelGroup.querySelector('.searchable-select-options');
        const metaCount = modelGroup.querySelector('.searchable-count');
        if (metaCount) metaCount.textContent = `${devices.length} models available`;

        if (optionsCont) {
          optionsCont.innerHTML = devices.map(d => `
            <div class="searchable-option" data-value="${d.id}" data-label="${d.name}" data-search="${(d.name + ' ' + (d.aliases || []).join(' ')).toLowerCase()}">
              <div class="searchable-option-content">
                <span class="searchable-option-text">${d.name}</span>
                <span class="searchable-option-sub">${d.cutterStatus === 'available' ? '✓ Precision Cut' : 'Template Available'}</span>
              </div>
            </div>
          `).join('');
        }

        // Reset search filter input
        const modelInput = modelGroup.querySelector('.searchable-select-input');
        if (modelInput) modelInput.value = '';
        const emptyEl = modelGroup.querySelector('.searchable-select-empty');
        if (emptyEl) emptyEl.style.display = 'none';

        // Update item header status
        const itemCard = step.querySelector(`#cart-item-${cartId}`);
        const statusSpan = itemCard?.querySelector('.cart-item-model-header span:last-child');
        if (statusSpan) {
          statusSpan.style.color = 'var(--color-danger)';
          statusSpan.textContent = '* Select Model Below';
        }

        // Hide cutter box
        const cutterBox = step.querySelector(`#cutter-${cartId}`);
        if (cutterBox) cutterBox.style.display = 'none';

        // Seamless auto-open of the Model dropdown so user immediately can search model
        setTimeout(() => {
          modelGroup.classList.add('is-open');
          itemCard?.classList.add('has-open-select');
          modelTrigger?.setAttribute('aria-expanded', 'true');
          if (modelInput) {
            modelInput.focus();
            modelGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 120);
      }
    } else if (selectType === 'model') {
      const device = this.allDevices.find(d => d.id === value);
      if (!device) return;

      item.deviceId = device.id;
      item.deviceName = device.name;
      item.cutterStatus = device.cutterStatus || 'available';
      Cart.saveItems(this.items);

      // Update Model Trigger UI
      const modelWrapper = step.querySelector(`#model-group-${cartId}`);
      if (modelWrapper) {
        const trigger = modelWrapper.querySelector('.searchable-select-trigger');
        const valSpan = modelWrapper.querySelector('.searchable-select-value');
        const hidden = modelWrapper.querySelector('.model-select-item');
        if (valSpan) valSpan.textContent = device.name;
        if (hidden) hidden.value = device.id;
        trigger.classList.add('has-value');
        trigger.classList.remove('select-error');

        // Add clear button if missing
        let icons = trigger.querySelector('.searchable-select-icons');
        if (icons && !icons.querySelector('.searchable-select-clear')) {
          const clearBtn = document.createElement('span');
          clearBtn.className = 'searchable-select-clear';
          clearBtn.dataset.action = 'clear-model';
          clearBtn.dataset.cartId = cartId;
          clearBtn.title = 'Clear Model';
          clearBtn.textContent = '✕';
          icons.insertBefore(clearBtn, icons.firstChild);
        }

        // Update checkmark in options
        modelWrapper.querySelectorAll('.searchable-option').forEach(opt => {
          const isSel = opt.dataset.value === value;
          opt.classList.toggle('selected', isSel);
          let check = opt.querySelector('.searchable-option-check');
          if (isSel && !check) {
            opt.insertAdjacentHTML('beforeend', '<span class="searchable-option-check">✓</span>');
          } else if (!isSel && check) {
            check.remove();
          }
        });
      }

      // Update item header status
      const itemCard = step.querySelector(`#cart-item-${cartId}`);
      const statusSpan = itemCard?.querySelector('.cart-item-model-header span:last-child');
      if (statusSpan) {
        statusSpan.style.color = 'var(--color-primary)';
        statusSpan.textContent = '✓ Model Selected';
      }

      // Show cutter alert box
      const cutterBox = step.querySelector(`#cutter-${cartId}`);
      if (cutterBox) {
        cutterBox.style.display = 'block';
        cutterBox.innerHTML = `
          <div style="padding:6px 10px;border-radius:var(--radius-lg);font-size:var(--text-xs);background:var(--color-primary-light);color:var(--color-primary);font-weight:600">
            ✓ <strong>${device.name}</strong>: Precision cut skin available!
          </div>
        `;
      }
    }
  }

  handleClearSelect(cartId, selectType, step) {
    const item = this.items.find(i => i.cartItemId === cartId);
    if (!item) return;

    if (selectType === 'brand') {
      item.brandId = null;
      item.brandName = '';
      item.deviceId = null;
      item.deviceName = '';
      Cart.saveItems(this.items);

      const brandWrapper = step.querySelector(`#brand-select-wrapper-${cartId}`);
      if (brandWrapper) {
        const trigger = brandWrapper.querySelector('.searchable-select-trigger');
        const valSpan = brandWrapper.querySelector('.searchable-select-value');
        const hidden = brandWrapper.querySelector('.brand-select-item');
        const clearBtn = trigger.querySelector('.searchable-select-clear');
        if (clearBtn) clearBtn.remove();
        if (valSpan) valSpan.textContent = 'Choose Brand';
        if (hidden) hidden.value = '';
        trigger.classList.remove('has-value');
        brandWrapper.querySelectorAll('.searchable-option').forEach(opt => {
          opt.classList.remove('selected');
          opt.querySelector('.searchable-option-check')?.remove();
        });
      }

      const modelGroup = step.querySelector(`#model-group-${cartId}`);
      if (modelGroup) {
        modelGroup.classList.add('is-empty-brand');
        if (window.innerWidth < 768) {
          modelGroup.style.display = 'none';
        }
        const modelTrigger = modelGroup.querySelector('.searchable-select-trigger');
        const modelValSpan = modelGroup.querySelector('.searchable-select-value');
        const modelHidden = modelGroup.querySelector('.model-select-item');
        const modelClear = modelTrigger?.querySelector('.searchable-select-clear');
        if (modelClear) modelClear.remove();
        if (modelValSpan) modelValSpan.textContent = 'Select Brand First';
        if (modelHidden) modelHidden.value = '';
        if (modelTrigger) {
          modelTrigger.classList.remove('has-value', 'select-error');
          modelTrigger.disabled = true;
        }
      }

      const itemCard = step.querySelector(`#cart-item-${cartId}`);
      const statusSpan = itemCard?.querySelector('.cart-item-model-header span:last-child');
      if (statusSpan) {
        statusSpan.style.color = 'var(--color-danger)';
        statusSpan.textContent = '* Select Model Below';
      }

      const cutterBox = step.querySelector(`#cutter-${cartId}`);
      if (cutterBox) cutterBox.style.display = 'none';

    } else if (selectType === 'model') {
      item.deviceId = null;
      item.deviceName = '';
      Cart.saveItems(this.items);

      const modelGroup = step.querySelector(`#model-group-${cartId}`);
      if (modelGroup) {
        const trigger = modelGroup.querySelector('.searchable-select-trigger');
        const valSpan = modelGroup.querySelector('.searchable-select-value');
        const hidden = modelGroup.querySelector('.model-select-item');
        const clearBtn = trigger.querySelector('.searchable-select-clear');
        if (clearBtn) clearBtn.remove();
        if (valSpan) valSpan.textContent = 'Choose Model';
        if (hidden) hidden.value = '';
        trigger.classList.remove('has-value');
        modelGroup.querySelectorAll('.searchable-option').forEach(opt => {
          opt.classList.remove('selected');
          opt.querySelector('.searchable-option-check')?.remove();
        });
      }

      const itemCard = step.querySelector(`#cart-item-${cartId}`);
      const statusSpan = itemCard?.querySelector('.cart-item-model-header span:last-child');
      if (statusSpan) {
        statusSpan.style.color = 'var(--color-danger)';
        statusSpan.textContent = '* Select Model Below';
      }

      const cutterBox = step.querySelector(`#cutter-${cartId}`);
      if (cutterBox) cutterBox.style.display = 'none';
    }
  }

  // ─── STEP 2: Delivery Address ─────────────────────────────────
  createStep2() {
    const step = document.createElement('div');
    step.className = 'checkout-step';
    step.id = 'step-2';

    const stateOptions = Utils.indianStates.map(s => `<option value="${s}" ${this.customer.state === s ? 'selected' : ''}>${s}</option>`).join('');

    step.innerHTML = `
      <h2 class="checkout-section-title">Fill Delivery Address</h2>
      <p class="checkout-section-subtitle">We'll deliver all ${Cart.count()} skins to this address.</p>

      <div class="address-form-grid">
        <div class="form-group col-span-1">
          <label class="form-label">Full Name <span class="required">*</span></label>
          <div class="form-input-icon">
            ${Icons.user}
            <input type="text" class="form-input" id="customer-name" placeholder="Ramesh Kumar" value="${this.customer.name}" required>
          </div>
          <div class="form-error" id="name-error"></div>
        </div>

        <div class="form-group col-span-1">
          <label class="form-label">WhatsApp Number <span class="required">*</span></label>
          <div class="form-input-icon">
            ${Icons.phone}
            <input type="tel" class="form-input" id="customer-phone" placeholder="9876543210" value="${this.customer.phone}" required>
          </div>
          <div class="form-error" id="phone-error"></div>
        </div>

        <div class="form-group col-span-2">
          <label class="form-label">Email <span style="color:var(--color-text-tertiary)">(Optional)</span></label>
          <div class="form-input-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <input type="email" class="form-input" id="customer-email" placeholder="ramesh@gmail.com" value="${this.customer.email}">
          </div>
        </div>

        <div class="col-span-2">
          <h3 class="checkout-section-heading" style="margin-top:var(--space-2)">
            ${Icons.mapPin} Delivery Address
          </h3>
        </div>

        <div class="form-group col-span-2">
          <label class="form-label">Flat / House No. / Street Address <span class="required">*</span></label>
          <textarea class="form-input form-textarea" id="customer-address" rows="2" placeholder="123, Anna Nagar 2nd Street" required>${this.customer.address}</textarea>
          <div class="form-error" id="address-error"></div>
        </div>

        <div class="form-group col-span-1">
          <label class="form-label">Landmark</label>
          <input type="text" class="form-input" id="customer-landmark" placeholder="Near Metro Station" value="${this.customer.landmark}">
        </div>

        <div class="form-group col-span-1">
          <label class="form-label">Pincode <span class="required">*</span></label>
          <div class="form-input-icon">
            ${Icons.mapPin}
            <input type="text" class="form-input" id="customer-pincode" placeholder="400001" maxlength="6" value="${this.customer.pincode}" required>
          </div>
          <div class="form-error" id="pincode-error"></div>
        </div>

        <div class="form-group col-span-1">
          <label class="form-label">City <span class="required">*</span></label>
          <input type="text" class="form-input" id="customer-city" placeholder="Mumbai" value="${this.customer.city}" required>
          <div class="form-error" id="city-error"></div>
        </div>

        <div class="form-group col-span-1">
          <label class="form-label">State <span class="required">*</span></label>
          <select class="form-input form-select" id="customer-state" required>
            <option value="">Select State</option>
            ${stateOptions}
          </select>
          <div class="form-error" id="state-error"></div>
        </div>

        <div class="col-span-2">
          <div class="payment-badge">
            ${Icons.coins}
            <div>
              <div class="payment-title">Cash on Delivery Available</div>
              <div class="payment-desc">Pay directly when your parcel is delivered.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    return step;
  }

  validateStep2() {
    let valid = true;
    const fields = {
      name: { el: 'customer-name', error: 'name-error', msg: 'Please enter your name' },
      phone: { el: 'customer-phone', error: 'phone-error', msg: 'Please enter a valid WhatsApp number' },
      address: { el: 'customer-address', error: 'address-error', msg: 'Please enter your street address' },
      pincode: { el: 'customer-pincode', error: 'pincode-error', msg: 'Please enter a valid 6-digit pincode' },
      city: { el: 'customer-city', error: 'city-error', msg: 'Please enter your city' },
      state: { el: 'customer-state', error: 'state-error', msg: 'Please select your state' }
    };

    Object.values(fields).forEach(f => {
      const el = document.getElementById(f.el);
      const errEl = document.getElementById(f.error);
      if (errEl) errEl.textContent = '';
      if (el) el.classList.remove('error');
    });

    const name = document.getElementById('customer-name')?.value?.trim();
    if (!name) { this.showFieldError('customer-name', 'name-error', fields.name.msg); valid = false; }

    const phone = document.getElementById('customer-phone')?.value?.trim();
    if (!phone || !Utils.isValidPhone(phone)) { this.showFieldError('customer-phone', 'phone-error', fields.phone.msg); valid = false; }

    const address = document.getElementById('customer-address')?.value?.trim();
    if (!address) { this.showFieldError('customer-address', 'address-error', fields.address.msg); valid = false; }

    const pincode = document.getElementById('customer-pincode')?.value?.trim();
    if (!pincode || !Utils.isValidPincode(pincode)) { this.showFieldError('customer-pincode', 'pincode-error', fields.pincode.msg); valid = false; }

    const city = document.getElementById('customer-city')?.value?.trim();
    if (!city) { this.showFieldError('customer-city', 'city-error', fields.city.msg); valid = false; }

    const state = document.getElementById('customer-state')?.value;
    if (!state) { this.showFieldError('customer-state', 'state-error', fields.state.msg); valid = false; }

    if (valid) {
      this.customer.name = name;
      this.customer.phone = phone;
      this.customer.email = document.getElementById('customer-email')?.value?.trim() || '';
      this.customer.address = address;
      this.customer.landmark = document.getElementById('customer-landmark')?.value?.trim() || '';
      this.customer.pincode = pincode;
      this.customer.city = city;
      this.customer.state = state;
      Analytics.detailsCompleted();
    }

    return valid;
  }

  showFieldError(inputId, errorId, msg) {
    const el = document.getElementById(inputId);
    const errEl = document.getElementById(errorId);
    if (el) el.classList.add('error');
    if (errEl) errEl.textContent = msg;
  }

  // ─── STEP 3: Review & Submit to WhatsApp ─────────────────────
  createStep3() {
    const step = document.createElement('div');
    step.className = 'checkout-step';
    step.id = 'step-3';
    return step;
  }

  renderStep3() {
    const step = document.getElementById('step-3');
    if (!step) return;

    const subtotal = Cart.subtotal();
    const freeDeliveryThreshold = this.settings?.freeDeliveryAbove || 999;
    const isFreeDelivery = subtotal >= freeDeliveryThreshold;
    const deliveryCharge = isFreeDelivery ? 0 : (this.settings?.defaultDeliveryCharge || 50);
    const total = subtotal + deliveryCharge;

    step.innerHTML = `
      <div class="review-whatsapp-icon">
        <div class="wa-circle">
          ${Icons.whatsapp}
        </div>
        <h2>Review Your Order</h2>
        <p>Click below to submit your order on WhatsApp. We'll confirm your models & dispatch right away!</p>
      </div>

      <!-- Items Summary Card -->
      <div class="review-card">
        <div class="review-card-header">
          <div class="review-card-title">${Icons.package} Order Items (${this.items.length})</div>
          <button class="review-edit-btn" id="edit-items-btn" type="button">Edit</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3)">
          ${this.items.map((item, idx) => {
            const imgFile = item.productImage ? item.productImage.split('/').pop() : '';
            const numMatch = (imgFile || item.productId || '').match(/\d+/);
            const designNum = numMatch ? `#${numMatch[0]}` : '';
            return `
            <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:var(--space-2);${idx < this.items.length - 1 ? 'border-bottom:1px dashed var(--color-border)' : ''}">
              <div>
                <div style="font-weight:700;font-size:var(--text-sm);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <span>${item.productName} × ${item.qty || 1}</span>
                  ${designNum ? `<span style="background:var(--color-primary-light);color:var(--color-primary);font-size:10px;font-weight:800;padding:1px 7px;border-radius:var(--radius-full);border:1px solid var(--color-primary)">Design ${designNum}</span>` : ''}
                </div>
                ${imgFile ? `<div style="font-size:10px;font-family:monospace;color:var(--color-text-secondary);margin-top:2px">Image File: <strong>${imgFile}</strong></div>` : ''}
                <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:2px">
                  Model: <strong>${item.deviceName?.toLowerCase().startsWith(item.brandName?.toLowerCase()) ? item.deviceName : `${item.brandName || ''} ${item.deviceName || 'Selected Model'}`.trim()}</strong>
                  · Type: <strong style="color:var(--color-primary)">${Utils.formatSkinType(item.skinType || (item.deviceType === 'laptop' ? 'laptop-matt' : 'back-skin'))}</strong>
                </div>
              </div>
              <div style="font-weight:800;font-size:var(--text-sm)">₹${(Number(item.productPrice) || 0) * (item.qty || 1)}</div>
            </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Delivery Address Card -->
      <div class="review-card">
        <div class="review-card-header">
          <div class="review-card-title">${Icons.mapPin} Delivery Address</div>
          <button class="review-edit-btn" id="edit-address-btn" type="button">Edit</button>
        </div>
        <div class="review-info-row">
          <div class="review-value" style="font-weight:700">${this.customer.name} · ${this.customer.phone}</div>
          <div class="review-value">${this.customer.address}${this.customer.landmark ? ', ' + this.customer.landmark : ''}</div>
          <div class="review-value">${this.customer.city}, ${this.customer.state} - ${this.customer.pincode}</div>
        </div>
      </div>

      <!-- Payment Summary -->
      <div class="review-card" style="background:var(--color-bg-secondary)">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2)">
          <span style="font-size:var(--text-sm);color:var(--color-text-secondary)">Subtotal</span>
          <span style="font-size:var(--text-sm);font-weight:600">₹${subtotal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-3)">
          <span style="font-size:var(--text-sm);color:var(--color-text-secondary)">Delivery</span>
          <span style="font-size:var(--text-sm);font-weight:600;color:${deliveryCharge === 0 ? 'var(--color-primary)' : 'inherit'}">
            ${deliveryCharge === 0 ? 'FREE' : '₹' + deliveryCharge}
          </span>
        </div>
        <div style="border-top:1px solid var(--color-border);padding-top:var(--space-3);display:flex;justify-content:space-between">
          <span style="font-weight:800">Total</span>
          <span style="font-weight:800;font-size:var(--text-lg);color:var(--color-primary)">₹${total}</span>
        </div>
      </div>

      <!-- Payment Method -->
      <div class="payment-badge">
        ${Icons.coins}
        <div>
          <div class="payment-title">Cash on Delivery</div>
          <div class="payment-desc">Pay directly when your package is delivered to your door.</div>
        </div>
      </div>
    `;

    step.querySelector('#edit-items-btn')?.addEventListener('click', () => this.goToStep(1));
    step.querySelector('#edit-address-btn')?.addEventListener('click', () => this.goToStep(2));
  }

  // ─── Navigation ─────────────────────────────────────────────
  goToStep(step) {
    this.currentStep = step;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep() {
    if (this.currentStep === 1) {
      if (this.items.length === 0) {
        alert('Please add at least one skin to your order.');
        window.location.href = Utils.resolveUrl('phone-skins/');
        return;
      }

      // Check that every item has a device model selected
      for (const item of this.items) {
        if (!item.deviceId && !item.isUnknownModel) {
          alert(`Please select the device model for "${item.productName}".`);
          const card = document.getElementById(`cart-item-${item.cartItemId}`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const trigger = card.querySelector(`#model-trigger-${item.cartItemId}`) || card.querySelector(`#brand-trigger-${item.cartItemId}`);
            if (trigger) {
              trigger.focus();
              trigger.classList.add('select-error');
              setTimeout(() => trigger.classList.remove('select-error'), 2500);
            }
          }
          return;
        }
      }

      this.goToStep(2);
    } else if (this.currentStep === 2) {
      if (!this.validateStep2()) return;
      this.goToStep(3);
      this.renderStep3();
    }
  }

  // ─── Desktop Sticky Order Summary Sidebar ─────────────────────
  createDesktopSidebar() {
    const sidebarCol = document.createElement('div');
    sidebarCol.className = 'checkout-sidebar-col';

    const subtotal = Cart.subtotal();
    const freeDeliveryThreshold = this.settings?.freeDeliveryAbove || 999;
    const isFreeDelivery = subtotal >= freeDeliveryThreshold;
    const deliveryCharge = isFreeDelivery ? 0 : (this.settings?.defaultDeliveryCharge || 50);
    const total = subtotal + deliveryCharge;

    sidebarCol.innerHTML = `
      <div class="checkout-sticky-sidebar">
        <div class="desktop-order-summary-card">
          <div class="sidebar-summary-header">
            <h3 class="sidebar-summary-title">Order Summary</h3>
            <span class="sidebar-item-count">${this.items.length} ${this.items.length === 1 ? 'skin' : 'skins'}</span>
          </div>

          <!-- Mini Item Previews -->
          <div class="sidebar-items-mini-list">
            ${this.items.map(item => {
              const imgFile = item.productImage ? item.productImage.split('/').pop() : '';
              const numMatch = (imgFile || item.productId || '').match(/\d+/);
              const designNum = numMatch ? `#${numMatch[0]}` : '';
              return `
              <div class="sidebar-mini-item">
                <div class="mini-item-thumb">
                  ${item.productImage 
                    ? `<img src="${Utils.resolveUrl(item.productImage)}" alt="${item.productName}" onerror="this.style.display='none'">` 
                    : `<div class="mini-item-placeholder" style="background:${Utils.getPlaceholderGradient(item.productId)}">${item.productName.slice(0,2)}</div>`}
                  <span class="mini-item-qty">${item.qty || 1}</span>
                </div>
                <div class="mini-item-info">
                  <div class="mini-item-name" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
                    <span>${item.productName}</span>
                    ${designNum ? `<span style="font-size:9px;font-weight:800;color:var(--color-primary);background:var(--color-primary-light);padding:0 4px;border-radius:4px">${designNum}</span>` : ''}
                  </div>
                  ${imgFile ? `<div style="font-size:9px;font-family:monospace;color:var(--color-text-tertiary);margin:1px 0">${imgFile}</div>` : ''}
                  <div class="mini-item-sub">
                    ${item.deviceName ? `✓ ${item.deviceName}` : '<span style="color:var(--color-danger)">Select device model</span>'}
                  </div>
                  <div class="mini-item-type">Finish: ${Utils.formatSkinType(item.skinType)}</div>
                </div>
                <div class="mini-item-price">₹${(Number(item.productPrice) || 0) * (item.qty || 1)}</div>
              </div>
              `;
            }).join('')}
          </div>

          <!-- Free Delivery Progress / Status -->
          <div class="sidebar-shipping-banner ${isFreeDelivery ? 'is-free' : ''}">
            ${isFreeDelivery ? `
              <div class="shipping-unlocked">
                <span class="shipping-icon">🎉</span>
                <div>
                  <div style="font-weight:700;color:var(--color-primary);font-size:var(--text-xs)">FREE Delivery Unlocked!</div>
                  <div style="font-size:11px;color:var(--color-text-secondary)">You saved ₹${this.settings?.defaultDeliveryCharge || 50} on delivery</div>
                </div>
              </div>
            ` : `
              <div class="shipping-progress-wrap">
                <div class="shipping-progress-text">
                  <span>Add <strong>₹${freeDeliveryThreshold - subtotal}</strong> for <strong>FREE Delivery</strong></span>
                  <span style="font-weight:700;color:var(--color-primary)">${Math.round((subtotal / freeDeliveryThreshold) * 100)}%</span>
                </div>
                <div class="shipping-progress-bar">
                  <div class="shipping-progress-fill" style="width:${Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100))}%"></div>
                </div>
              </div>
            `}
          </div>

          <!-- Price Breakdown -->
          <div class="sidebar-price-rows">
            <div class="sidebar-price-row">
              <span class="price-label">Subtotal</span>
              <span class="price-val">₹${subtotal}</span>
            </div>
            <div class="sidebar-price-row">
              <span class="price-label">Delivery</span>
              <span class="price-val ${isFreeDelivery ? 'free-tag' : ''}">${deliveryCharge === 0 ? 'FREE' : '₹' + deliveryCharge}</span>
            </div>
            <div class="sidebar-price-row total-row">
              <span class="price-label">Total Amount</span>
              <span class="price-val total-amount">₹${total}</span>
            </div>
            <div class="payment-method-hint">
              <span>💵 Cash on Delivery</span>
              <span style="opacity:0.75">· Pay at delivery</span>
            </div>
          </div>

          <!-- Primary Action CTA Button -->
          <div class="sidebar-cta-wrap">
            ${this.currentStep === 3 ? `
              <button type="button" class="btn btn-whatsapp btn-lg btn-full sidebar-action-btn" id="sidebar-place-order-btn" style="font-weight:800">
                ${Icons.whatsapp} Submit to WhatsApp
              </button>
            ` : `
              <button type="button" class="btn btn-primary btn-lg btn-full sidebar-action-btn" id="sidebar-next-step-btn" style="font-weight:800">
                ${this.currentStep === 1 ? 'Continue to Address →' : 'Review Order →'}
              </button>
            `}
          </div>

          <!-- Trust Badges -->
          <div class="sidebar-trust-features">
            <div class="trust-feat">
              <span class="trust-icon">✂️</span>
              <span>100% Precision Laser Cut</span>
            </div>
            <div class="trust-feat">
              <span class="trust-icon">🛡️</span>
              <span>Bubble-Free Easy Application</span>
            </div>
            <div class="trust-feat">
              <span class="trust-icon">🔄</span>
              <span>Free Model Replacement Guarantee</span>
            </div>
          </div>
        </div>
      </div>
    `;

    sidebarCol.querySelector('#sidebar-next-step-btn')?.addEventListener('click', () => this.nextStep());
    sidebarCol.querySelector('#sidebar-place-order-btn')?.addEventListener('click', () => this.placeOrder());

    return sidebarCol;
  }

  // ─── Bottom Bar ─────────────────────────────────────────────
  renderBottomBar() {
    let bar = document.getElementById('checkout-bottom-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'checkout-bottom-bar';
      bar.id = 'checkout-bottom-bar';
      document.body.appendChild(bar);
    }

    if (this.items.length === 0) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'block';

    if (this.currentStep === 3) {
      bar.innerHTML = `
        <button class="btn btn-whatsapp btn-lg" id="place-order-btn" style="font-weight:800;font-size:var(--text-base)">
          ${Icons.whatsapp}
          Submit Order to WhatsApp
        </button>
        <div class="security-note">
          ${Icons.lock}
          <span>Your order will open directly in WhatsApp</span>
        </div>
      `;
      bar.querySelector('#place-order-btn').addEventListener('click', () => this.placeOrder());
    } else {
      const btnText = this.currentStep === 1 ? 'Continue to Address →' : 'Review Order →';
      const hint = this.currentStep === 1 
        ? `Step 1 of 3: ${this.items.length} ${this.items.length === 1 ? 'skin' : 'skins'} in order`
        : 'Step 2 of 3: Enter your delivery address';
      bar.innerHTML = `
        <button class="btn btn-primary btn-full btn-lg" id="next-step-btn">${btnText}</button>
        <div class="checkout-hint">${hint}</div>
      `;
      bar.querySelector('#next-step-btn').addEventListener('click', () => this.nextStep());
    }
  }

  // ─── Place Order (WhatsApp) ─────────────────────────────────
  placeOrder() {
    const orderId = Utils.generateOrderId(this.settings?.orderIdPrefix || 'CR');
    const subtotal = Cart.subtotal();
    const isFreeDelivery = subtotal >= (this.settings?.freeDeliveryAbove || 999);
    const deliveryCharge = isFreeDelivery ? 0 : (this.settings?.defaultDeliveryCharge || 50);
    const total = subtotal + deliveryCharge;

    let message = `Hi Cormal 👋\nI would like to place an order!\n\n`;
    message += `📦 *ORDER #${orderId}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*ITEMS (${this.items.length}):*\n`;
    this.items.forEach((item, idx) => {
      const modelName = item.deviceName || 'Custom Model';
      const brandName = item.brandName || '';
      const fullModel = modelName.toLowerCase().startsWith(brandName.toLowerCase()) ? modelName : `${brandName} ${modelName}`.trim();
      
      const imgFile = item.productImage ? item.productImage.split('/').pop() : '';
      const numMatch = (imgFile || item.productId || '').match(/\d+/);
      const designNum = numMatch ? `#${numMatch[0]}` : '';

      message += `${idx + 1}. *${item.productName}* ${designNum ? `[Design ${designNum}]` : ''}\n`;
      if (imgFile) {
        message += `   • Design Image: *${imgFile}*\n`;
      }
      message += `   • Device: ${fullModel}\n`;
      message += `   • Type / Finish: ${Utils.formatSkinType(item.skinType || (item.deviceType === 'laptop' ? 'laptop-matt' : 'back-skin'))}\n`;
      message += `   • Qty: ${item.qty || 1} × ₹${item.productPrice} = ₹${(Number(item.productPrice) || 0) * (item.qty || 1)}\n`;
    });
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *PAYMENT SUMMARY:*\n`;
    message += `Subtotal: ₹${subtotal}\n`;
    message += `Delivery: ${deliveryCharge === 0 ? 'FREE' : '₹' + deliveryCharge}\n`;
    message += `*Total: ₹${total}* (Cash on Delivery)\n\n`;
    message += `📍 *DELIVERY DETAILS:*\n`;
    message += `Name: ${this.customer.name}\n`;
    message += `Phone: ${this.customer.phone}\n`;
    if (this.customer.email) message += `Email: ${this.customer.email}\n`;
    message += `Address: ${this.customer.address}\n`;
    if (this.customer.landmark) message += `Landmark: ${this.customer.landmark}\n`;
    message += `City: ${this.customer.city}\n`;
    message += `State: ${this.customer.state} - ${this.customer.pincode}\n\n`;
    message += `Please confirm and process my order! 🙏`;

    const url = Utils.buildWhatsAppURL(this.settings?.whatsappNumber || '919876543210', message);
    Analytics.whatsappClicked(orderId);

    // Open WhatsApp
    window.open(url, '_blank');

    // Clear cart after submitting order so next order starts fresh
    Cart.clear();

    // Show copy option fallback
    setTimeout(() => {
      const copyMsg = confirm('WhatsApp opened! Would you also like to copy the order summary to your clipboard?');
      if (copyMsg) {
        navigator.clipboard.writeText(message).then(() => {
          alert('Order details copied to clipboard!');
        }).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = message;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          alert('Order details copied to clipboard!');
        });
      }
    }, 1500);
  }
}
