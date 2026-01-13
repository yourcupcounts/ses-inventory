# SES Inventory - NC Compliant

**Stevens Estate Services Precious Metals Inventory Management System**

A mobile-first React application for precious metals dealers with NC state compliance, AI coin identification, live spot prices, and eBay integration.

---

## Features

- ✅ **Inventory Tracking** - Full item management with photos
- ✅ **NC Compliance** - 7-day hold period with coin/bullion exemptions
- ✅ **Client KYC** - ID capture, GPS-stamped signatures, seller certification
- ✅ **Live Spot Prices** - Auto-updating from Metals.live (free)
- ✅ **AI Coin Identification** - Snap a photo, get instant ID (Claude Vision)
- ✅ **Scrap Calculator** - Kitco-style with buy percentages
- ✅ **Appraisal Sessions** - Walk-in evaluation workflow
- ✅ **Personal Stash** - Track your own collection separately
- ✅ **Firebase Cloud Sync** - Multi-device access
- ✅ **eBay Integration** - Market pricing + listing creation
- ✅ **Analytics Dashboard** - KPIs, P&L, inventory breakdown
- ✅ **Tax Reports** - Schedule C ready

---

## Quick Start

### Option 1: Local Development

```bash
# Clone or download this folder
cd ses-inventory-app

# Install dependencies
npm install

# Start development server
npm start
```

The app will open at http://localhost:3000

### Option 2: Deploy to Vercel (Recommended)

1. Push this folder to a GitHub repository
2. Go to vercel.com
3. Click "New Project"
4. Import your GitHub repo
5. Click "Deploy"

That's it! Vercel auto-detects React and deploys.

### Option 3: Deploy to Netlify

1. Push to GitHub
2. Go to netlify.com
3. Click "Add new site" > "Import an existing project"
4. Connect GitHub and select repo
5. Build command: npm run build
6. Publish directory: build
7. Click "Deploy"

---

## Configuration

API keys are in src/App.jsx in the CONFIG object at the top of the file.

### What's Already Configured:
- Firebase (cloud sync) ✅
- Anthropic API (AI coin ID) ✅  
- Metals.live (spot prices) ✅ No setup needed

### Still Needs Setup:
- eBay credentials (for pricing lookup and listing)

---

## Mobile Installation

**iPhone/iPad:**
1. Open the deployed URL in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"

**Android:**
1. Open the deployed URL in Chrome
2. Tap the menu (3 dots)
3. Tap "Add to Home Screen"

---

## Security Notes

For production deployment, consider:
1. Moving API keys to environment variables
2. Updating Firebase security rules
3. Regenerating API keys if code was shared

---

## Version

v1.0.0 - January 2025
