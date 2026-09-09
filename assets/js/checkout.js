/**
 * Skinify — Multi-Item Ecommerce Checkout Flow
 * 3-step order process:
 * Step 1: Select Model for all skins (Add / Remove / Change skins)
 * Step 2: Fill Address
 * Step 3: Review & Submit to WhatsApp
 */

import { dataService, Utils, Analytics, Icons, Cart } from './app.js';
import { createStepper } from './components.js';

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
        if (params.get('action') === 'add') {
          // Explicitly add another item to order
          Cart.addItem({
            productId: product.id,
            productName: product.name,
            productPrice: product.price,
            productImage: product.images[0] || '',
            deviceType: product.deviceType || 'phone',
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
          });
          this.items = Cart.getItems();
        } else {
          // Standard check if already in cart
          const existing = this.items.find(i => i.productId === product.id && (!matchedDevice || i.deviceId === matchedDevice.id));
          if (existing) {
            if (matchedDevice && !existing.deviceId) {
              existing.deviceId = matchedDevice.id;
              existing.deviceName = matchedDevice.name;
              existing.brandId = matchedDevice.brand;
              existing.brandName = this.allBrands.find(b => b.id === matchedDevice.brand)?.name || '';
              existing.cutterStatus = matchedDevice.cutterStatus || 'available';
              Cart.saveItems(this.items);
            }
          } else {
            Cart.addItem({
              productId: product.id,
              productName: product.name,
              productPrice: product.price,
              productImage: product.images[0] || '',
              deviceType: product.deviceType || 'phone',
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
            });
            this.items = Cart.getItems();
          }
        }
      }
    }

    // 3. If matchedDevice is available, assign it to any item missing device or the last item
    if (matchedDevice && this.items.length > 0) {
      const itemToUpdate = this.items.find(i => !i.deviceId) || this.items[this.items.length - 1];
      if (itemToUpdate) {
        itemToUpdate.deviceId = matchedDevice.id;
        itemToUpdate.deviceName = matchedDevice.name;
        itemToUpdate.brandId = matchedDevice.brand;
        const brandObj = this.allBrands.find(b => b.id === matchedDevice.brand);
        itemToUpdate.brandName = brandObj ? brandObj.name : matchedDevice.brand;
        itemToUpdate.cutterStatus = matchedDevice.cutterStatus || 'available';
        Cart.saveItems(this.items);
      }
    }

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

    this.container.appendChild(step1);
    this.container.appendChild(step2);
    this.container.appendChild(step3);

    // Bottom bar
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

    step.innerHTML = `
      <div style="margin-bottom:var(--space-4)">
        <h2 class="checkout-section-title">Select Device Model</h2>
        <p class="checkout-section-subtitle">Choose the exact phone or laptop model for each skin</p>
      </div>

      <!-- Items List -->
      <div class="checkout-items-list" id="checkout-items-list"></div>

      <!-- Add Another Skin Button -->
      <a href="${Utils.resolveUrl('phone-skins/?action=add')}" class="add-more-skins-btn" id="add-more-skins-btn">
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

          <!-- Brand Select -->
          <div class="form-group" style="margin-bottom:var(--space-2)">
            <select class="form-input form-select brand-select-item" data-id="${item.cartItemId}" style="font-size:var(--text-xs);padding:var(--space-2)">
              <option value="">Choose Brand</option>
              ${brandsForType.map(b => `<option value="${b.id}" ${b.id === item.brandId ? 'selected' : ''}>${b.name}</option>`).join('')}
            </select>
          </div>

          <!-- Model Select -->
          <div class="form-group" style="margin-bottom:var(--space-2);display:${item.brandId ? 'block' : 'none'}" id="model-group-${item.cartItemId}">
            <select class="form-input form-select model-select-item" data-id="${item.cartItemId}" style="font-size:var(--text-xs);padding:var(--space-2);${item.deviceId ? 'border-color:var(--color-primary);' : ''}">
              <option value="">Choose Model</option>
              ${devicesForBrand.map(d => `<option value="${d.id}" ${d.id === item.deviceId ? 'selected' : ''}>${d.name}</option>`).join('')}
            </select>
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
              <span>Skin Type / Finish:</span>
              <span class="active-type-badge" style="color:var(--color-primary);font-weight:700">${Utils.formatSkinType(item.skinType || (item.deviceType === 'laptop' ? 'laptop-matt' : 'back-skin'))}</span>
            </div>
            <div class="skin-type-pill-group" style="display:flex;flex-wrap:wrap;gap:6px">
              ${(item.deviceType === 'laptop'
                ? [
                    { id: 'laptop-matt', name: 'Laptop Matte' },
                    { id: 'embossed', name: 'Embossed' },
                    { id: 'glitter', name: 'Glitter' },
                    { id: 'leather', name: 'Leather' },
                    { id: '8pa', name: '8PA Skin' }
                  ]
                : [
                    { id: 'back-skin', name: 'Back Skin' },
                    { id: 'front-skin', name: 'Front Skin' },
                    { id: 'embossed', name: 'Embossed' },
                    { id: 'glitter', name: 'Glitter' },
                    { id: 'leather', name: 'Leather' },
                    { id: '8pa', name: '8PA Skin' }
                  ]
              ).map(st => `
                <button type="button" class="skin-type-select-btn ${st.id === (item.skinType || (item.deviceType === 'laptop' ? 'laptop-matt' : 'back-skin')) ? 'active' : ''}" data-cart-id="${item.cartItemId}" data-skin-type="${st.id}">
                  ${st.name}
                </button>
              `).join('')}
            </div>
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

    // Brand Select
    step.querySelectorAll('.brand-select-item').forEach(select => {
      select.addEventListener('change', () => {
        const id = select.dataset.id;
        const item = this.items.find(i => i.cartItemId === id);
        if (item) {
          item.brandId = select.value;
          const brand = this.allBrands.find(b => b.id === select.value);
          item.brandName = brand ? brand.name : '';
          item.deviceId = null;
          item.deviceName = '';
          Cart.saveItems(this.items);

          // Update Model Select in place
          const modelGroup = step.querySelector(`#model-group-${id}`);
          const modelSelect = modelGroup?.querySelector('.model-select-item');
          const cutterBox = step.querySelector(`#cutter-${id}`);
          if (cutterBox) cutterBox.style.display = 'none';

          if (select.value && modelSelect) {
            const devices = this.allDevices.filter(d => d.brand === select.value);
            modelSelect.innerHTML = '<option value="">Choose Model</option>' + devices.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
            modelSelect.style.borderColor = 'var(--color-border)';
            modelGroup.style.display = 'block';
          } else if (modelGroup) {
            modelGroup.style.display = 'none';
          }
        }
      });
    });

    // Model Select
    step.querySelectorAll('.model-select-item').forEach(select => {
      select.addEventListener('change', () => {
        const id = select.dataset.id;
        const item = this.items.find(i => i.cartItemId === id);
        if (item) {
          const device = this.allDevices.find(d => d.id === select.value);
          if (device) {
            item.deviceId = device.id;
            item.deviceName = device.name;
            item.cutterStatus = device.cutterStatus || 'available';
            select.style.borderColor = 'var(--color-primary)';
            const cutterBox = step.querySelector(`#cutter-${id}`);
            if (cutterBox) {
              cutterBox.style.display = 'block';
              cutterBox.innerHTML = `
                <div style="padding:6px 10px;border-radius:var(--radius-lg);font-size:var(--text-xs);background:var(--color-primary-light);color:var(--color-primary);font-weight:600">
                  ✓ <strong>${device.name}</strong>: Precision cut skin available!
                </div>
              `;
            }
          } else {
            item.deviceId = null;
            item.deviceName = '';
            select.style.borderColor = 'var(--color-border)';
            const cutterBox = step.querySelector(`#cutter-${id}`);
            if (cutterBox) cutterBox.style.display = 'none';
          }
          Cart.saveItems(this.items);
        }
      });
    });

    return step;
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

      <div class="form-group">
        <label class="form-label">Full Name <span class="required">*</span></label>
        <div class="form-input-icon">
          ${Icons.user}
          <input type="text" class="form-input" id="customer-name" placeholder="Ramesh Kumar" value="${this.customer.name}" required>
        </div>
        <div class="form-error" id="name-error"></div>
      </div>

      <div class="form-group">
        <label class="form-label">WhatsApp Number <span class="required">*</span></label>
        <div class="form-input-icon">
          ${Icons.phone}
          <input type="tel" class="form-input" id="customer-phone" placeholder="9876543210" value="${this.customer.phone}" required>
        </div>
        <div class="form-error" id="phone-error"></div>
      </div>

      <div class="form-group">
        <label class="form-label">Email <span style="color:var(--color-text-tertiary)">(Optional)</span></label>
        <div class="form-input-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          <input type="email" class="form-input" id="customer-email" placeholder="ramesh@gmail.com" value="${this.customer.email}">
        </div>
      </div>

      <h3 class="checkout-section-heading">
        ${Icons.mapPin} Delivery Address
      </h3>

      <div class="form-group">
        <label class="form-label">Flat / House No. / Street Address <span class="required">*</span></label>
        <textarea class="form-input form-textarea" id="customer-address" rows="2" placeholder="123, Anna Nagar 2nd Street" required>${this.customer.address}</textarea>
        <div class="form-error" id="address-error"></div>
      </div>

      <div class="form-group">
        <label class="form-label">Landmark</label>
        <input type="text" class="form-input" id="customer-landmark" placeholder="Near Metro Station" value="${this.customer.landmark}">
      </div>

      <div class="form-group">
        <label class="form-label">Pincode <span class="required">*</span></label>
        <div class="form-input-icon">
          ${Icons.mapPin}
          <input type="text" class="form-input" id="customer-pincode" placeholder="400001" maxlength="6" value="${this.customer.pincode}" required>
        </div>
        <div class="form-error" id="pincode-error"></div>
      </div>

      <div class="form-group">
        <label class="form-label">City <span class="required">*</span></label>
        <input type="text" class="form-input" id="customer-city" placeholder="Mumbai" value="${this.customer.city}" required>
        <div class="form-error" id="city-error"></div>
      </div>

      <div class="form-group">
        <label class="form-label">State <span class="required">*</span></label>
        <select class="form-input form-select" id="customer-state" required>
          <option value="">Select State</option>
          ${stateOptions}
        </select>
        <div class="form-error" id="state-error"></div>
      </div>

      <div class="payment-badge">
        ${Icons.coins}
        <div>
          <div class="payment-title">Cash on Delivery Available</div>
          <div class="payment-desc">Pay directly when your parcel is delivered.</div>
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
          ${this.items.map((item, idx) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:var(--space-2);${idx < this.items.length - 1 ? 'border-bottom:1px dashed var(--color-border)' : ''}">
              <div>
                <div style="font-weight:700;font-size:var(--text-sm)">${item.productName} × ${item.qty || 1}</div>
                <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:2px">
                  Model: <strong>${item.deviceName?.toLowerCase().startsWith(item.brandName?.toLowerCase()) ? item.deviceName : `${item.brandName || ''} ${item.deviceName || 'Selected Model'}`.trim()}</strong>
                  · Type: <strong style="color:var(--color-primary)">${Utils.formatSkinType(item.skinType || (item.deviceType === 'laptop' ? 'laptop-matt' : 'back-skin'))}</strong>
                </div>
              </div>
              <div style="font-weight:800;font-size:var(--text-sm)">₹${(Number(item.productPrice) || 0) * (item.qty || 1)}</div>
            </div>
          `).join('')}
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
            card.scrollIntoView({ behavior: 'smooth' });
            const sel = card.querySelector('.model-select-item') || card.querySelector('.brand-select-item');
            if (sel) {
              sel.focus();
              sel.style.borderColor = 'var(--color-danger)';
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
    const orderId = Utils.generateOrderId(this.settings?.orderIdPrefix || 'SK');
    const subtotal = Cart.subtotal();
    const isFreeDelivery = subtotal >= (this.settings?.freeDeliveryAbove || 999);
    const deliveryCharge = isFreeDelivery ? 0 : (this.settings?.defaultDeliveryCharge || 50);
    const total = subtotal + deliveryCharge;

    let message = `Hi Skinify 👋\nI would like to place an order!\n\n`;
    message += `📦 *ORDER #${orderId}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*ITEMS (${this.items.length}):*\n`;
    this.items.forEach((item, idx) => {
      const modelName = item.deviceName || 'Custom Model';
      const brandName = item.brandName || '';
      const fullModel = modelName.toLowerCase().startsWith(brandName.toLowerCase()) ? modelName : `${brandName} ${modelName}`.trim();
      message += `${idx + 1}. *${item.productName}*\n`;
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
