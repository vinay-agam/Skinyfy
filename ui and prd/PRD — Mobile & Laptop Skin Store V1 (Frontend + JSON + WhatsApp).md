# Product Requirements Document (PRD)

## 1. Product Overview

Build a **mobile-first ecommerce-style website** for selling:

- Mobile phone back skins
- Laptop skins
- Future: tablets, gaming devices and other devices

### V1 business model

There will be **no online payment and no backend/database initially**.

Customer flow:

**Browse → Select Device → Select Skin → Enter Details → Review → Order on WhatsApp**

The website should look and feel like a modern mobile shopping app.

---

# 2. V1 Technology

## Frontend

Recommended:

- HTML5
- CSS3
- JavaScript
- Tailwind CSS
- JSON product catalog

## Hosting

Static hosting.

No PHP/MySQL required in V1.

## Data

Use JSON files:

```text
/data/
    products.json
    brands.json
    devices.json
    categories.json
    settings.json
```

## Images

```text
/images/
    products/
    categories/
    brands/
    devices/
```

---

# 3. Important Architecture Principle

The frontend must **not hard-code products, brands, models or categories**.

Everything should come from JSON.

For example:

```text
products.json
      ↓
JavaScript
      ↓
Product Cards
      ↓
Product Details
      ↓
Order Flow
```

Therefore, adding a new product should require changing only JSON and uploading the image.

---

# 4. Business Goals

### Primary goal

Convert visitors into WhatsApp orders with the minimum number of steps.

### Secondary goals

- Rank in Google for phone/laptop skin searches.
- Make product discovery easy.
- Support a very large device catalog.
- Allow unknown/new device models.
- Make product management simple.
- Prepare the architecture for future PHP/MySQL migration.

---

# 5. Target Users

### Primary

Indian customers looking for:

- Phone skins
- Laptop skins
- Custom-looking device skins
- Anime skins
- Minimal skins
- Gaming skins
- Premium skins

### Primary device categories

Phones:

- Apple
- Samsung
- OnePlus
- Xiaomi
- Redmi
- Realme
- Vivo
- Oppo
- Nothing
- Motorola
- Google
- Asus
- Infinix
- Tecno
- iQOO
- Poco
- Other

Laptops:

- Apple MacBook
- HP
- Dell
- Lenovo
- Asus
- Acer
- MSI
- Other

---

# 6. Main Navigation

Mobile bottom navigation:

```text
┌─────────────────────────────────┐
│                                 │
│ Home Categories Search  Orders  │
│  ⌂       ▦        ⌕       ♡     │
└─────────────────────────────────┘
```

Top navigation:

```text
Logo       Search       WhatsApp
```

Desktop can use a traditional header.

---

# 7. Homepage

## Hero section

Example:

**Your Device. Your Style.**

Premium skins for phones & laptops.

Buttons:

**Shop Phone Skins**

**Shop Laptop Skins**

---

## Categories

Display:

```text
Phone
Laptop
Anime
Minimal
Nature
Gaming
Cars
Trending
```

Categories must come from `categories.json`.

---

## Popular devices

Example:

```text
iPhone 15 Pro
iPhone 16
Galaxy S25 Ultra
OnePlus 13
MacBook Air
```

---

## Trending skins

Product cards with:

- Image
- Product name
- Price
- Badge
- Compatible devices
- Order button

---

# 8. Product Card

Mobile card:

```text
┌───────────────────────────┐
│                   ♡       │
│                           │
│       PRODUCT IMAGE       │
│                           │
├───────────────────────────┤
│ Black Marble              │
│ ₹299                      │
│                           │
│ Bestseller               │
│                           │
│ [ Order on WhatsApp ]     │
└───────────────────────────┘
```

Product cards must be generated dynamically from JSON.

---

# 9. Product Detail Page

Every product should have its own SEO-friendly URL.

Example:

```text
/phone-skins/iphone-15-pro/black-marble
```

Page contents:

### Image gallery

- Main image
- Additional images
- Zoom
- Device preview where available

### Product information

```text
Black Marble Skin

₹299

Premium vinyl phone skin
```

### Features

- Precision cut
- Premium finish
- Lightweight
- Scratch resistant
- Easy application

### Compatibility

Show supported models.

### CTA

**Order on WhatsApp**

---

# 10. Device Selection System

The website must support both known and unknown models.

## Step 1

### Choose your device

```text
Phone
Laptop
```

Then:

### Brand

```text
Select Brand ▼
```

Then:

### Model

```text
Search your model
```

The model list should come from `devices.json`.

---

# 11. Device Search

Search should support:

```text
iPhone 15 Pro
iphone15pro
A3102
Galaxy S25
S25 Ultra
MacBook Air M3
```

Support model aliases where possible.

Example:

```json
{
  "id": "iphone-15-pro",
  "brand": "Apple",
  "name": "iPhone 15 Pro",
  "aliases": [
    "iPhone15,2",
    "A3102",
    "A3104"
  ]
}
```

---

# 12. Unknown Model Flow

This is a critical feature for the business.

If a customer searches:

```text
XYZ Phone 2026
```

and it isn't available:

Show:

**Can't find your model?**

> We may still be able to make a custom skin for your device.

Button:

**Request My Model**

---

# 13. Unknown Model Form

```text
Device Type
[ Phone ▼ ]

Brand
[ __________________ ]

Model Name
[ __________________ ]

Model Number
[ __________________ ]

Upload Photo (optional)
[ 📷 Upload ]

[ Continue ]
```

The user can upload:

- Phone back photo
- About Phone screenshot
- Device box photo

Since V1 is frontend-only, the image should be handled according to the chosen storage approach; don't pretend it has been permanently saved if there is no backend.

For WhatsApp, provide an option to share the relevant photo through WhatsApp.

---

# 14. Cutter Compatibility

Do not tell the customer:

**"We don't support this model."**

Instead use:

### Known + available

```text
✓ Skin available
```

### Known but template needs verification

```text
We'll confirm the cutter template before processing.
```

### Unknown

```text
Custom model request
```

The customer experience should always lead toward an order/request rather than a dead end.

---

# 15. Skin Selection

After device selection:

```text
Choose your skin
```

Display compatible products.

Example:

```text
Black Marble
₹299

Anime Pro
₹329

Carbon Fiber
₹299

Good Vibes
₹299
```

Only show products compatible with the selected device.

---

# 16. Three-Step Order Flow

The checkout must remain extremely simple.

## STEP 1

### Select Device & Skin

```text
Device Type
↓
Brand
↓
Model
↓
Skin
```

Progress:

```text
● Device     ○ Details     ○ WhatsApp
```

Button:

**Continue**

---

# 17. STEP 2 — Customer Details

Title:

**Where should we deliver it?**

Fields:

```text
Name *
WhatsApp Number *
Address *
Landmark
Pincode *
City *
State *
```

Optional:

```text
Email
```

Button:

**Review Order**

No login required.

---

# 18. STEP 3 — Review

Display:

### Product

```text
Black Marble
iPhone 15 Pro
₹299
```

### Customer

```text
Name
WhatsApp
```

### Delivery

```text
Address
City
State
Pincode
```

### Total

```text
Product       ₹299
Delivery      ₹50
----------------
Total         ₹349
```

Then:

**Order on WhatsApp**

---

# 19. WhatsApp Integration

The final button should open WhatsApp with a pre-filled message.

Example:

```text
Hi Cormal 👋

I would like to order a skin.

ORDER
Product: Black Marble
Device: Phone
Brand: Apple
Model: iPhone 15 Pro
Price: ₹299

CUSTOMER
Name: Customer Name
WhatsApp: 9876543210

DELIVERY
Address: 123 Main Street
City: Chennai
State: Tamil Nadu
Pincode: 600001

Please confirm my order.
```

The WhatsApp number should be stored in:

```text
settings.json
```

so it can be changed without editing JavaScript.

---

# 20. Order ID

Generate a client-side temporary order reference.

Example:

```text
SK-260909-001
```

Include it in the WhatsApp message.

Because V1 has no backend, this is **not a guaranteed globally unique server-side order number**.

When PHP/MySQL is introduced, order IDs should be generated server-side.

---

# 21. JSON Product Structure

Recommended:

```json
{
  "id": "black-marble",
  "name": "Black Marble",
  "slug": "black-marble",
  "deviceType": "phone",
  "category": "minimal",
  "price": 299,
  "currency": "INR",
  "images": [
    "/images/products/black-marble/main.webp",
    "/images/products/black-marble/angle.webp"
  ],
  "compatibleDevices": [
    "iphone-15",
    "iphone-15-pro",
    "galaxy-s24"
  ],
  "badges": [
    "bestseller"
  ],
  "description": "Premium black marble skin.",
  "features": [
    "Premium vinyl",
    "Precision cut",
    "Scratch resistant"
  ],
  "active": true
}
```

---

# 22. Category JSON

```json
{
  "id": "anime",
  "name": "Anime",
  "slug": "anime",
  "description": "Anime inspired phone and laptop skins.",
  "image": "/images/categories/anime.webp",
  "active": true
}
```

Adding a category should automatically make it appear in:

- Homepage
- Navigation
- Category page
- Product filtering
- SEO metadata

---

# 23. Device JSON

```json
{
  "id": "iphone-15-pro",
  "type": "phone",
  "brand": "apple",
  "name": "iPhone 15 Pro",
  "aliases": [
    "iPhone15,2",
    "A3102"
  ],
  "cutterStatus": "available"
}
```

Possible cutter states:

```text
available
verification_required
custom_request
inactive
```

---

# 24. External Device Data

The architecture should allow future importing/syncing from an external device database.

Important:

**External device data is not the cutter database.**

Use external data for:

- Brand names
- Model names
- Model numbers
- Device discovery
- New device identification

Use your own data for:

- Cutter templates
- Cutter status
- Pricing
- Skin compatibility
- Your actual production capability

---

# 25. Search

Global search should search:

```text
Products
Brands
Models
Categories
```

Example:

Search:

**"S25"**

Results:

```text
Devices

Samsung Galaxy S25
Samsung Galaxy S25+
Samsung Galaxy S25 Ultra

Skins

Black Marble
Carbon Fiber
Anime
```

---

# 26. SEO Architecture

SEO is a major requirement.

Use server-friendly/static HTML pages wherever possible.

Do not make the entire site dependent on JavaScript rendering for important SEO content.

---

# 27. SEO URLs

Use clean URLs.

### Main

```text
/
```

### Device type

```text
/phone-skins
/laptop-skins
```

### Brand

```text
/phone-skins/apple
/phone-skins/samsung
```

### Model

```text
/phone-skins/apple/iphone-15-pro
```

### Category

```text
/phone-skins/anime
/phone-skins/minimal
```

### Product

```text
/phone-skins/apple/iphone-15-pro/black-marble
```

---

# 28. SEO Metadata

Every important page must have dynamic:

```text
<title>
<meta name="description">
<link rel="canonical">
Open Graph metadata
Twitter/X metadata
```

Example:

```text
Title:
iPhone 15 Pro Skins | Premium Back Skins | Cormal

Description:
Shop premium iPhone 15 Pro skins in different designs.
Choose your skin and order easily through WhatsApp.
```

---

# 29. Structured Data

Generate appropriate JSON-LD for:

- Organization
- WebSite
- BreadcrumbList
- Product
- Offer

Where product variants are genuinely represented, use the appropriate ProductGroup/variant structure.

Do not generate fake reviews, ratings or prices.

---

# 30. SEO Landing Pages

Create useful pages for:

```text
Phone Skins
Laptop Skins
Apple Skins
Samsung Skins
OnePlus Skins
iPhone Skins
MacBook Skins
Anime Skins
Minimal Skins
Gaming Skins
```

Only index pages that have enough useful content/products.

---

# 31. Sitemap

Generate:

```text
/sitemap.xml
```

Initially this can be generated during build/deployment from JSON.

It should include:

- Homepage
- Category pages
- Brand pages
- Model pages
- Product pages

---

# 32. Robots

Create:

```text
/robots.txt
```

Allow search engines to crawl public pages.

Do not expose internal development files or private information.

---

# 33. SEO Content

Each major landing page should contain:

### H1

Example:

**iPhone 15 Pro Skins**

### Introduction

Useful original content.

### Products

Relevant skins.

### Compatibility

Supported models.

### FAQ

Real customer questions.

### Related pages

Internal links.

Avoid generating thousands of pages containing only a product grid with no useful content.

---

# 34. Performance

Target:

- Fast mobile loading
- Optimized images
- WebP/AVIF
- Lazy loading
- Responsive images
- Minimal JavaScript
- Minified CSS/JS
- Browser caching
- CDN where available

Avoid loading all products/images on the homepage.

---

# 35. Mobile UI Requirements

The website should feel like an app.

Use:

- Rounded cards
- Bottom navigation
- Sticky CTA
- Large touch targets
- Smooth transitions
- Clear typography
- Minimal forms
- One-handed interaction

Primary screen width:

**Mobile**

Desktop should be responsive rather than being the primary design target.

---

# 36. Error Handling

Examples:

### Empty search

```text
No model found.

Try another spelling or request your model.
```

### Missing product

```text
This skin is currently unavailable.
```

### Invalid phone number

```text
Please enter a valid WhatsApp number.
```

### Invalid pincode

```text
Please enter a valid 6-digit pincode.
```

### WhatsApp unavailable

Provide:

```text
Copy Order Details
```

as a fallback.

---

# 37. Product Availability

Each product should have:

```json
"active": true
```

If:

```json
"active": false
```

don't display it as available for ordering.

Possible future status:

```text
active
out_of_stock
coming_soon
inactive
```

---

# 38. Settings JSON

Keep business configuration separate.

Example:

```json
{
  "storeName": "Cormal",
  "whatsappNumber": "919876543210",
  "currency": "INR",
  "defaultDeliveryCharge": 50,
  "freeDeliveryAbove": 999,
  "country": "India"
}
```

Never hard-code these values throughout the application.

---

# 39. Project Structure

Recommended:

```text
skin-store/
│
├── index.html
│
├── phone-skins/
│
├── laptop-skins/
│
├── products/
│
├── categories/
│
├── assets/
│   ├── css/
│   ├── js/
│   └── icons/
│
├── images/
│   ├── products/
│   ├── categories/
│   ├── brands/
│   └── devices/
│
├── data/
│   ├── products.json
│   ├── devices.json
│   ├── brands.json
│   ├── categories.json
│   └── settings.json
│
├── sitemap.xml
└── robots.txt
```

---

# 40. Future Migration to PHP/MySQL

The frontend must be designed so JSON can later be replaced by an API.

### V1

```text
JavaScript
   ↓
JSON
```

### V2

```text
JavaScript
   ↓
PHP API
   ↓
MySQL
```

The UI should remain almost identical.

Only the data source changes.

---

# 41. Future Admin Panel

Not required in V1.

Later:

```text
/admin

Dashboard
Products
Categories
Brands
Models
Cutter Templates
Orders
Model Requests
SEO
Settings
```

The admin should support:

**Add Product**

**Edit Product**

**Import JSON**

**Export JSON**

**Add Category**

**Add Device**

**Manage Cutter Template**

---

# 42. Future Cutter Template System

Later add:

```text
Cutter Templates
```

Example:

```text
iPhone 15 Pro
Template: iphone-15-pro.svg
Status: Active
```

For unknown models:

```text
Infinix Note 50 Pro
Template: Not available
Status: Verification required
```

This allows your business to accept requests for new models without incorrectly claiming compatibility.

---

# 43. Analytics

V1 should include lightweight analytics.

Track:

```text
Page view
Product view
Search
Device search
Model selected
Skin selected
Checkout started
Details completed
WhatsApp clicked
Unknown model request
```

Most important metric:

**WhatsApp order click**

---

# 44. Conversion Funnel

Measure:

```text
Visitors
   ↓
Product Views
   ↓
Device Selection
   ↓
Skin Selection
   ↓
Details Completed
   ↓
Order Review
   ↓
WhatsApp Click
```

This will tell you where customers are leaving.

---

# 45. Trust & Conversion

Homepage should clearly explain:

### How it works

**01 — Choose your device**

Select your brand and model.

**02 — Choose your skin**

Pick your favourite design.

**03 — Order on WhatsApp**

Enter your details and send your order.

---

# 46. Customer Support

Display WhatsApp support prominently.

Example:

**Need help finding your model?**

**Chat with us on WhatsApp**

This is particularly important for unknown/new phone models.

---

# 47. V1 Features — MUST HAVE

### Customer

- [ ] Mobile-first homepage
- [ ] Product listing
- [ ] Product cards
- [ ] Product details
- [ ] Categories
- [ ] Brand selection
- [ ] Model search
- [ ] Unknown model request
- [ ] Skin selection
- [ ] 3-step checkout
- [ ] Customer details
- [ ] Address
- [ ] Order review
- [ ] WhatsApp order
- [ ] Search
- [ ] Responsive design

### Data

- [ ] products.json
- [ ] categories.json
- [ ] brands.json
- [ ] devices.json
- [ ] settings.json

### SEO

- [ ] Clean URLs
- [ ] SEO titles
- [ ] Meta descriptions
- [ ] Canonical URLs
- [ ] Breadcrumbs
- [ ] JSON-LD
- [ ] Sitemap
- [ ] Robots.txt
- [ ] Internal linking
- [ ] Optimized images
- [ ] SEO landing pages

---

# 48. V1 Features — NOT REQUIRED

Do not build initially:

- Login
- Customer accounts
- Online payment
- Shopping cart
- Database
- Admin dashboard
- Inventory management
- Automated WhatsApp API
- Delivery API
- Reviews
- Coupons
- Complex order tracking

These can be added after validating the business.

---

# 49. Definition of Done

V1 is complete when:

1. Customer can visit the website on mobile.
2. Customer can browse skins.
3. Customer can search their device.
4. Customer can select brand.
5. Customer can select model.
6. Customer can select a skin.
7. Customer can request an unknown model.
8. Customer can enter delivery details.
9. Customer can review the order.
10. One tap opens WhatsApp with a complete order message.
11. Products can be added by modifying JSON.
12. Categories can be added by modifying JSON.
13. Devices can be added by modifying JSON.
14. Product pages have SEO-friendly URLs.
15. Search engines can crawl important pages.
16. Sitemap and robots.txt are available.
17. Website loads quickly on mobile.
18. The architecture can later replace JSON with PHP/MySQL APIs.

---

# 50. Recommended V1 User Journey

```text
                    HOME
                      │
          ┌───────────┴───────────┐
          ↓                       ↓
     PHONE SKINS             LAPTOP SKINS
          │                       │
          ↓                       ↓
       SEARCH                  SEARCH
          │                       │
          ↓                       ↓
       BRAND                   BRAND
          │                       │
          ↓                       ↓
       MODEL                   MODEL
          │                       │
          ↓                       ↓
       SKIN                    SKIN
          │                       │
          └───────────┬───────────┘
                      ↓
                  STEP 1
              DEVICE + SKIN
                      ↓
                  STEP 2
              CUSTOMER DETAILS
                      ↓
                  STEP 3
                REVIEW ORDER
                      ↓
                WHATSAPP
                      ↓
             YOU CONFIRM ORDER
```

# 51. Final Product Strategy

The V1 should deliberately be **simple, fast and cheap to operate**.

### V1

**Frontend + JSON + WhatsApp**

↓

Validate demand

↓

Grow product catalog

↓

Collect model requests

↓

Identify popular devices

↓

Build cutter templates

↓

### V2

**PHP/Laravel + MySQL + Admin Panel**

↓

Automated product management

↓

Order management

↓

Payment

↓

Delivery integration

↓

### Long-term

**Full skin ecommerce platform**

with custom skin design, online payment, automated WhatsApp, cutter-template management and personalized products.

The most important technical rule is:

> **Build the V1 frontend as if an API will replace the JSON tomorrow.**

That way you get a very low-cost launch now without throwing away the frontend when the business grows.