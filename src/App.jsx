import React, { useState, useRef, useEffect } from 'react';
import { Package, Plus, X, Trash2, Search, Settings, Download, Upload, Camera, Loader, BarChart3, TrendingUp, TrendingDown, Clock, AlertTriangle, AlertCircle, FileText, Filter, Users, UserPlus, Edit2, Check, MapPin, Calendar, CreditCard, Building, User, Lock, Unlock, ShieldCheck, DollarSign, RefreshCw, Calculator, Layers, Star, ExternalLink, Flame, Archive, Zap, Shield, Database, FileSpreadsheet, AlertOctagon, Wifi, WifiOff, HardDrive, Cloud, CloudOff, ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react';

// ============ CONFIGURATION - ADD YOUR API KEYS HERE ============
const CONFIG = {
  // Firebase Configuration
  // Get these from: https://console.firebase.google.com/ → Project Settings → General → Your apps
  firebase: {
    apiKey: "AIzaSyAApo2lgLStbMuIokFyE-Qw5hY3ZHloOdc",
    authDomain: "ses-inventory.firebaseapp.com",
    projectId: "ses-inventory",
    storageBucket: "ses-inventory.firebasestorage.app",
    messagingSenderId: "869784219152",
    appId: "1:869784219152:web:9631095f78c8098e87e495"
  },
  
  // API Keys are now stored securely in Vercel environment variables
  // See: https://vercel.com/s-stevens-projects/ses-inventory/settings/environment-variables
  // Required env vars: ANTHROPIC_API_KEY, EBAY_APP_ID, EBAY_CERT_ID
  
  // Spot Price API (Metals.live is free, no key needed)
  // Alternative: GoldAPI.io - get key from https://www.goldapi.io/
  goldApiKey: null, // Optional: only if using GoldAPI.io instead of Metals.live
  
  // Feature flags
  features: {
    useFirebase: true, // Firebase cloud sync enabled
    useAiVision: true, // AI coin identification enabled
    useEbayPricing: true, // eBay market price lookups enabled
    useEbayListing: true, // eBay listing creation enabled
    useLiveSpot: true, // Metals.live works without a key
  }
};

// ============ FIREBASE SERVICE ============
// Import Firebase at top level
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

const FirebaseService = {
  db: null,
  storage: null,
  initialized: false,
  
  // Initialize Firebase
  async init() {
    if (this.initialized || !CONFIG.features.useFirebase) return false;
    if (CONFIG.firebase.apiKey === "YOUR_FIREBASE_API_KEY") {
      console.log('Firebase not configured - using local storage');
      return false;
    }
    
    try {
      const app = initializeApp(CONFIG.firebase);
      this.db = getFirestore(app);
      this.storage = getStorage(app);
      this.firestore = { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot };
      this.storageHelpers = { ref, uploadString, getDownloadURL, deleteObject };
      this.initialized = true;
      console.log('Firebase initialized successfully');
      return true;
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      return false;
    }
  },
  
  // Helper to remove undefined values (Firestore doesn't accept undefined)
  cleanObject(obj) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = value === null ? null : value;
      }
    }
    return cleaned;
  },
  
  // Save inventory to Firestore
  async saveInventory(inventory) {
    if (!this.initialized) return false;
    try {
      const { doc, setDoc } = this.firestore;
      for (const item of inventory) {
        // Store photo separately in Storage if exists
        let photoUrl = null;
        let photoBackUrl = null;
        if (item.photo && item.photo.length > 1000) {
          photoUrl = await this.uploadPhoto(item.id, item.photo);
        }
        if (item.photoBack && item.photoBack.length > 1000) {
          photoBackUrl = await this.uploadPhoto(`${item.id}_back`, item.photoBack);
        }
        
        const itemData = this.cleanObject({ 
          ...item, 
          photo: photoUrl || item.photo || null,
          photoBack: photoBackUrl || item.photoBack || null
        });
        await setDoc(doc(this.db, 'inventory', item.id), itemData);
      }
      return true;
    } catch (error) {
      console.error('Error saving inventory:', error);
      return false;
    }
  },
  
  // Load inventory from Firestore
  async loadInventory() {
    if (!this.initialized) return null;
    try {
      const { collection, getDocs } = this.firestore;
      const snapshot = await getDocs(collection(this.db, 'inventory'));
      const inventory = [];
      snapshot.forEach(doc => inventory.push({ id: doc.id, ...doc.data() }));
      return inventory;
    } catch (error) {
      console.error('Error loading inventory:', error);
      return null;
    }
  },
  
  // Save clients to Firestore
  async saveClients(clients) {
    if (!this.initialized) return false;
    try {
      const { doc, setDoc } = this.firestore;
      for (const client of clients) {
        // Store ID photos and signature in Storage
        let idPhotoFrontUrl = client.idPhotoFront || null;
        let idPhotoBackUrl = client.idPhotoBack || null;
        let signatureUrl = client.signature || null;
        
        if (client.idPhotoFront && client.idPhotoFront.length > 1000) {
          idPhotoFrontUrl = await this.uploadPhoto(`${client.id}_id_front`, client.idPhotoFront);
        }
        if (client.idPhotoBack && client.idPhotoBack.length > 1000) {
          idPhotoBackUrl = await this.uploadPhoto(`${client.id}_id_back`, client.idPhotoBack);
        }
        if (client.signature && client.signature.length > 1000) {
          signatureUrl = await this.uploadPhoto(`${client.id}_signature`, client.signature);
        }
        
        const clientData = this.cleanObject({
          ...client,
          idPhotoFront: idPhotoFrontUrl,
          idPhotoBack: idPhotoBackUrl,
          signature: signatureUrl
        });
        await setDoc(doc(this.db, 'clients', client.id), clientData);
      }
      return true;
    } catch (error) {
      console.error('Error saving clients:', error);
      return false;
    }
  },
  
  // Load clients from Firestore
  async loadClients() {
    if (!this.initialized) return null;
    try {
      const { collection, getDocs } = this.firestore;
      const snapshot = await getDocs(collection(this.db, 'clients'));
      const clients = [];
      snapshot.forEach(doc => clients.push({ id: doc.id, ...doc.data() }));
      return clients;
    } catch (error) {
      console.error('Error loading clients:', error);
      return null;
    }
  },
  
  // Save lots to Firestore
  async saveLots(lots) {
    if (!this.initialized) return false;
    try {
      const { doc, setDoc } = this.firestore;
      for (const lot of lots) {
        const lotData = this.cleanObject(lot);
        await setDoc(doc(this.db, 'lots', lot.id), lotData);
      }
      return true;
    } catch (error) {
      console.error('Error saving lots:', error);
      return false;
    }
  },
  
  // Load lots from Firestore
  async loadLots() {
    if (!this.initialized) return null;
    try {
      const { collection, getDocs } = this.firestore;
      const snapshot = await getDocs(collection(this.db, 'lots'));
      const lots = [];
      snapshot.forEach(doc => lots.push({ id: doc.id, ...doc.data() }));
      return lots;
    } catch (error) {
      console.error('Error loading lots:', error);
      return null;
    }
  },
  
  // Upload photo to Firebase Storage
  async uploadPhoto(id, base64Data) {
    if (!this.initialized || !this.storage) return null;
    try {
      const { ref, uploadString, getDownloadURL } = this.storageHelpers;
      const storageRef = ref(this.storage, `photos/${id}.jpg`);
      await uploadString(storageRef, base64Data, 'base64');
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  },
  
  // Delete item from Firestore
  async deleteItem(collectionName, itemId) {
    if (!this.initialized) return false;
    try {
      const { doc, deleteDoc } = this.firestore;
      await deleteDoc(doc(this.db, collectionName, itemId));
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      return false;
    }
  }
};

// ============ SPOT PRICE SERVICE ============
const SpotPriceService = {
  lastPrices: { gold: 4600.00, silver: 90.00, platinum: 985.00, palladium: 945.00 },
  lastUpdate: null,
  
  // Fetch live spot prices from goldprice.org (free, CORS-friendly)
  async fetchFromMetalsLive() {
    try {
      console.log('Fetching spot prices from goldprice.org...');
      const response = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
      if (!response.ok) throw new Error('API error: ' + response.status);
      const data = await response.json();
      console.log('API response:', data);
      
      // Parse response - xauPrice is gold, xagPrice is silver
      if (data.items && data.items[0]) {
        const item = data.items[0];
        if (item.xauPrice) this.lastPrices.gold = item.xauPrice;
        if (item.xagPrice) this.lastPrices.silver = item.xagPrice;
        this.lastUpdate = new Date();
        console.log('Spot prices updated successfully:', this.lastPrices);
        return this.lastPrices;
      }
      throw new Error('Invalid response format');
    } catch (error) {
      console.log('Spot price fetch failed, using defaults:', error.message);
      return this.lastPrices;
    }
  },
  
  // Fetch from GoldAPI.io (requires API key, more reliable)
  async fetchFromGoldApi() {
    if (!CONFIG.goldApiKey) return null;
    
    try {
      const metals = ['XAU', 'XAG', 'XPT', 'XPD']; // Gold, Silver, Platinum, Palladium
      const prices = {};
      
      for (const metal of metals) {
        const response = await fetch(`https://www.goldapi.io/api/${metal}/USD`, {
          headers: { 'x-access-token': CONFIG.goldApiKey }
        });
        if (response.ok) {
          const data = await response.json();
          if (metal === 'XAU') prices.gold = data.price;
          if (metal === 'XAG') prices.silver = data.price;
          if (metal === 'XPT') prices.platinum = data.price;
          if (metal === 'XPD') prices.palladium = data.price;
        }
      }
      
      this.lastPrices = { ...this.lastPrices, ...prices };
      this.lastUpdate = new Date();
      return this.lastPrices;
    } catch (error) {
      console.error('GoldAPI fetch failed:', error);
      return null;
    }
  },
  
  // Main fetch function - tries available sources
  async fetchPrices() {
    if (!CONFIG.features.useLiveSpot) return this.lastPrices;
    
    // Try Metals.live first (free)
    let prices = await this.fetchFromMetalsLive();
    
    // Fall back to GoldAPI if available and Metals.live failed
    if (!prices && CONFIG.goldApiKey) {
      prices = await this.fetchFromGoldApi();
    }
    
    return prices || this.lastPrices;
  },
  
  // Get cached prices (for instant display)
  getCachedPrices() {
    return this.lastPrices;
  },
  
  // Check if prices are stale (older than 5 minutes)
  isPriceStale() {
    if (!this.lastUpdate) return true;
    const fiveMinutes = 5 * 60 * 1000;
    return (new Date() - this.lastUpdate) > fiveMinutes;
  }
};

// ============ AI VISION SERVICE (Anthropic Claude) ============
const AIVisionService = {
  // Analyze coin/metal image using Claude Vision via secure proxy
  async analyzeImage(base64Image) {
    if (!CONFIG.features.useAiVision) {
      console.log('AI Vision disabled - returning manual entry required');
      return this.getManualEntryResult('AI Vision is disabled in config');
    }
    
    try {
      // Use server-side proxy to keep API key secure
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          max_tokens: 1024,
          system: `You are an expert numismatist and precious metals appraiser for Stevens Estate Services. Your job is to accurately identify items brought in for appraisal.

CRITICAL: First determine if this is actually a precious metal item (coin, bullion, jewelry, silverware, etc.) or something else entirely.

If it is NOT a precious metal item (like electronics, toys, household items, etc.), respond with:
{
  "isPreciousMetal": false,
  "type": "description of what you actually see",
  "notes": "This is not a precious metal item"
}

Only if it IS a precious metal item, provide full analysis.`,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: `Look at this image carefully. What do you see?

FIRST: Is this a precious metal item (coin, bullion, gold/silver jewelry, sterling silverware, etc.)?

If NO - this is NOT a precious metal item, respond with:
{
  "isPreciousMetal": false,
  "type": "what you actually see (e.g., TV remote, phone, toy, etc.)",
  "notes": "This is not a precious metal item and cannot be appraised for metal value."
}

If YES - this IS a precious metal item, respond with:
{
  "isPreciousMetal": true,
  "type": "coin type or item description",
  "metal": "Gold/Silver/Platinum/Palladium",
  "purity": "purity as percentage or karat (e.g., 90%, 925, 14K)",
  "year": "year if visible, null if not",
  "mintMark": "mint mark if visible, null if not",
  "grade": "estimated grade (cull/ag/vg/fine/vf/xf/au/bu/ms60-70)",
  "weight": "weight in troy oz if known, null if unknown",
  "coinKey": "reference key if recognized (see list below), null otherwise",
  "confidence": 0.0-1.0,
  "notes": "any notable features, damage, or observations"
}

Common coin reference keys: morgan-dollar, peace-dollar, walking-liberty-half, franklin-half, kennedy-half-90, washington-quarter, standing-liberty-quarter, barber-quarter, roosevelt-dime, mercury-dime, barber-dime, silver-eagle, gold-eagle-1oz, gold-eagle-1/2oz, gold-eagle-1/4oz, gold-eagle-1/10oz, gold-buffalo, st-gaudens-20, liberty-20

For jewelry or scrap, set coinKey to null and describe the item type.`
              }
            ]
          }]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Vision proxy error:', response.status, errorText);
        
        // Parse error for better message
        let errorMessage = 'API request failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || `HTTP ${response.status}`;
        }
        
        return this.getManualEntryResult(errorMessage);
      }
      
      const data = await response.json();
      const content = data.content?.[0]?.text || '';
      
      if (!content) {
        return this.getManualEntryResult('Empty response from AI');
      }
      
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        // If not a precious metal, flag for manual handling
        if (result.isPreciousMetal === false) {
          return {
            ...result,
            coinKey: null,
            metal: null,
            notPreciousMetal: true,
            confidence: 0.95 // High confidence it's NOT a PM item
          };
        }
        
        return result;
      }
      
      return this.getManualEntryResult('Could not parse AI response');
    } catch (error) {
      console.error('AI Vision analysis failed:', error);
      return this.getManualEntryResult(error.message || 'Network error');
    }
  },
  
  // Return result requiring manual entry (used when API fails or is disabled)
  getManualEntryResult(reason = 'Unknown error') {
    return {
      type: 'Unknown Item',
      needsManualEntry: true,
      confidence: 0,
      notes: `AI analysis unavailable: ${reason}. Please identify manually.`,
      apiError: reason
    };
  },
  
  // Analyze a pair of images (front and back of coin)
  async analyzeImagePair(frontBase64, backBase64) {
    if (!CONFIG.features.useAiVision) {
      console.log('AI Vision disabled - returning manual entry required');
      return this.getManualEntryResult('AI Vision is disabled in config');
    }
    
    try {
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          max_tokens: 1024,
          system: `You are an expert numismatist and precious metals appraiser for Stevens Estate Services. You will receive TWO images - the FRONT (obverse) and BACK (reverse) of a coin or item. Use both images together to make your identification.

CRITICAL: First determine if this is actually a precious metal item (coin, bullion, jewelry, etc.) or something else entirely.`,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Here is the FRONT (obverse) of the item:'
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: frontBase64
                }
              },
              {
                type: 'text',
                text: 'Here is the BACK (reverse) of the item:'
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: backBase64
                }
              },
              {
                type: 'text',
                text: `Analyze BOTH images together to identify this item.

FIRST: Is this a precious metal item (coin, bullion, gold/silver jewelry, sterling silverware, etc.)?

If NO - this is NOT a precious metal item, respond with:
{
  "isPreciousMetal": false,
  "type": "what you actually see",
  "notes": "This is not a precious metal item and cannot be appraised for metal value."
}

If YES - this IS a precious metal item, respond with:
{
  "isPreciousMetal": true,
  "type": "coin type or item description",
  "metal": "Gold/Silver/Platinum/Palladium",
  "purity": "purity as percentage (e.g., 90%, 99.9%, 92.5%)",
  "year": "year if visible on either side, null if not",
  "mintMark": "mint mark if visible (D, S, O, CC, etc.), null if not",
  "grade": "estimated grade based on wear visible (cull/ag/vg/fine/vf/xf/au/bu/ms60-70)",
  "weight": "weight in troy oz if this is a standard coin type, null if unknown",
  "coinKey": "reference key if recognized (see list below), null otherwise",
  "confidence": 0.0-1.0,
  "notes": "any notable features, damage, toning, or observations from either side"
}

Common coin reference keys: morgan-dollar, peace-dollar, walking-liberty-half, franklin-half, kennedy-half-90, washington-quarter, standing-liberty-quarter, barber-quarter, roosevelt-dime, mercury-dime, barber-dime, silver-eagle, gold-eagle-1oz, gold-eagle-1/2oz, gold-eagle-1/4oz, gold-eagle-1/10oz, gold-buffalo, st-gaudens-20, liberty-20

For jewelry or scrap, set coinKey to null and describe the item type.`
              }
            ]
          }]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Vision proxy error:', response.status, errorText);
        
        let errorMessage = 'API request failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || `HTTP ${response.status}`;
        }
        
        return this.getManualEntryResult(errorMessage);
      }
      
      const data = await response.json();
      const content = data.content?.[0]?.text || '';
      
      if (!content) {
        return this.getManualEntryResult('Empty response from AI');
      }
      
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        if (result.isPreciousMetal === false) {
          return {
            ...result,
            coinKey: null,
            metal: null,
            notPreciousMetal: true,
            confidence: 0.95
          };
        }
        
        return result;
      }
      
      return this.getManualEntryResult('Could not parse AI response');
    } catch (error) {
      console.error('AI Vision analysis failed:', error);
      return this.getManualEntryResult(error.message || 'Network error');
    }
  }
};

// ============ EBAY LISTING SERVICE ============
const EbayListingService = {
  accessToken: null,
  tokenExpiry: null,
  
  // Get OAuth access token (needs more scopes for selling)
  async getAccessToken() {
    if (!CONFIG.features.useEbayListing) return null;
    if (CONFIG.ebay.appId === "YOUR_EBAY_APP_ID") {
      console.log('eBay API not configured');
      return null;
    }
    
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }
    
    try {
      const credentials = btoa(`${CONFIG.ebay.appId}:${CONFIG.ebay.certId}`);
      // Note: For listing, you need user consent flow (OAuth 2.0 Authorization Code Grant)
      // This requires redirecting user to eBay login
      // For now, we'll use the application token which works for some endpoints
      const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account'
      });
      
      if (!response.ok) throw new Error('Token request failed');
      
      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000) - 60000);
      return this.accessToken;
    } catch (error) {
      console.error('eBay token error:', error);
      return null;
    }
  },
  
  // Upload image to eBay
  async uploadImage(base64Image) {
    const token = await this.getAccessToken();
    if (!token) return null;
    
    try {
      // Convert base64 to binary
      const binaryData = atob(base64Image);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }
      
      const response = await fetch('https://api.ebay.com/sell/inventory/v1/inventory_item/uploadImage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'image/jpeg'
        },
        body: bytes
      });
      
      if (!response.ok) throw new Error('Image upload failed');
      
      const data = await response.json();
      return data.imageUrl;
    } catch (error) {
      console.error('eBay image upload error:', error);
      return null;
    }
  },
  
  // Upload video to eBay
  // Note: eBay video upload uses a different flow - upload to their video service
  async uploadVideo(videoFile) {
    const token = await this.getAccessToken();
    if (!token || !videoFile) return null;
    
    try {
      // Step 1: Create video upload request
      const createResponse = await fetch('https://apim.ebay.com/commerce/media/v1_beta/video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          size: videoFile.size,
          title: videoFile.name || 'Item Video',
          description: 'Product demonstration video'
        })
      });
      
      if (!createResponse.ok) {
        const err = await createResponse.json();
        throw new Error(err.errors?.[0]?.message || 'Failed to create video upload');
      }
      
      const createData = await createResponse.json();
      const videoId = createData.videoId;
      
      // Step 2: Upload video content in chunks (eBay requires chunked upload for large files)
      const chunkSize = 5 * 1024 * 1024; // 5MB chunks
      const totalChunks = Math.ceil(videoFile.size / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, videoFile.size);
        const chunk = videoFile.slice(start, end);
        
        const uploadResponse = await fetch(
          `https://apim.ebay.com/commerce/media/v1_beta/video/${videoId}/upload`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/octet-stream',
              'Content-Range': `bytes ${start}-${end - 1}/${videoFile.size}`
            },
            body: chunk
          }
        );
        
        if (!uploadResponse.ok && uploadResponse.status !== 200 && uploadResponse.status !== 308) {
          throw new Error(`Failed to upload video chunk ${i + 1}/${totalChunks}`);
        }
      }
      
      return videoId;
    } catch (error) {
      console.error('eBay video upload error:', error);
      return null;
    }
  },
  
  // Get video processing status
  async getVideoStatus(videoId) {
    const token = await this.getAccessToken();
    if (!token) return null;
    
    try {
      const response = await fetch(
        `https://apim.ebay.com/commerce/media/v1_beta/video/${videoId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return {
        status: data.status, // PENDING, PROCESSING, LIVE, FAILED
        videoId: data.videoId
      };
    } catch (error) {
      console.error('eBay video status error:', error);
      return null;
    }
  },
  
  // Create inventory item on eBay
  async createInventoryItem(sku, itemData) {
    const token = await this.getAccessToken();
    if (!token) return null;
    
    try {
      const response = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Language': 'en-US'
        },
        body: JSON.stringify({
          availability: {
            shipToLocationAvailability: {
              quantity: itemData.quantity || 1
            }
          },
          condition: itemData.condition || 'USED_EXCELLENT',
          product: {
            title: itemData.title,
            description: itemData.description,
            aspects: itemData.aspects || {},
            imageUrls: itemData.imageUrls || []
          }
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.message || 'Failed to create inventory item');
      }
      
      return true;
    } catch (error) {
      console.error('eBay inventory error:', error);
      return null;
    }
  },
  
  // Create offer (sets price and listing details)
  async createOffer(sku, offerData) {
    const token = await this.getAccessToken();
    if (!token) return null;
    
    try {
      const response = await fetch('https://api.ebay.com/sell/inventory/v1/offer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Language': 'en-US'
        },
        body: JSON.stringify({
          sku: sku,
          marketplaceId: 'EBAY_US',
          format: offerData.format || 'FIXED_PRICE',
          listingDescription: offerData.description,
          availableQuantity: offerData.quantity || 1,
          pricingSummary: {
            price: {
              value: offerData.price.toString(),
              currency: 'USD'
            }
          },
          listingPolicies: {
            fulfillmentPolicyId: offerData.fulfillmentPolicyId,
            paymentPolicyId: offerData.paymentPolicyId,
            returnPolicyId: offerData.returnPolicyId
          },
          categoryId: offerData.categoryId,
          merchantLocationKey: offerData.locationKey
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.message || 'Failed to create offer');
      }
      
      const data = await response.json();
      return data.offerId;
    } catch (error) {
      console.error('eBay offer error:', error);
      return null;
    }
  },
  
  // Publish offer (makes it live)
  async publishOffer(offerId) {
    const token = await this.getAccessToken();
    if (!token) return null;
    
    try {
      const response = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.message || 'Failed to publish offer');
      }
      
      const data = await response.json();
      return data.listingId;
    } catch (error) {
      console.error('eBay publish error:', error);
      return null;
    }
  },
  
  // Get seller's business policies
  async getBusinessPolicies() {
    const token = await this.getAccessToken();
    if (!token) return null;
    
    try {
      const [fulfillment, payment, returns] = await Promise.all([
        fetch('https://api.ebay.com/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('https://api.ebay.com/sell/account/v1/payment_policy?marketplace_id=EBAY_US', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('https://api.ebay.com/sell/account/v1/return_policy?marketplace_id=EBAY_US', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      return {
        fulfillment: (await fulfillment.json()).fulfillmentPolicies || [],
        payment: (await payment.json()).paymentPolicies || [],
        returns: (await returns.json()).returnPolicies || []
      };
    } catch (error) {
      console.error('eBay policies error:', error);
      return null;
    }
  },
  
  // Suggest category for item
  async suggestCategory(query) {
    const token = await this.getAccessToken();
    if (!token) return null;
    
    try {
      const response = await fetch(
        `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(query)}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.categorySuggestions || [];
    } catch (error) {
      console.error('eBay category error:', error);
      return null;
    }
  },
  
  // Common coin categories on eBay
  coinCategories: {
    'morgan-dollar': '39482', // US Dollars: Morgan
    'peace-dollar': '39483', // US Dollars: Peace
    'walking-liberty-half': '39454', // US Half Dollars: Walking Liberty
    'franklin-half': '39452', // US Half Dollars: Franklin
    'kennedy-half-90': '39453', // US Half Dollars: Kennedy
    'washington-quarter': '39468', // US Quarters: Washington
    'roosevelt-dime': '39478', // US Dimes: Roosevelt
    'mercury-dime': '39477', // US Dimes: Mercury
    'silver-eagle': '39486', // US Silver Eagles
    'gold-eagle-1oz': '39467', // US Gold Eagles
    'gold-buffalo': '134530', // US Buffalo Gold
    'generic-round': '39487', // Bullion: Rounds
    'generic-bar-1oz': '39489', // Bullion: Bars
  }
};

// ============ EBAY PRICING SERVICE ============
const EbayPricingService = {
  // Search for SOLD listings via Finding API (accurate market values)
  async searchSoldListings(query, options = {}) {
    try {
      const params = new URLSearchParams({
        query: query,
        daysBack: options.daysBack || '90'
      });
      
      // Add optional filters
      if (options.category) params.append('category', options.category);
      if (options.minPrice) params.append('minPrice', options.minPrice);
      if (options.maxPrice) params.append('maxPrice', options.maxPrice);
      if (options.condition) params.append('condition', options.condition);
      
      const response = await fetch(`/api/ebay-sold?${params}`);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('eBay sold search error:', error);
        throw new Error(error.error || 'Search failed');
      }
      
      const data = await response.json();
      
      // Map to expected format for compatibility
      return {
        source: 'sold', // Mark as sold listings data
        count: data.stats?.count || 0,
        avgPrice: data.stats?.avgPrice || 0,
        medianPrice: data.stats?.medianPrice || 0,
        lowPrice: data.stats?.lowPrice || 0,
        highPrice: data.stats?.highPrice || 0,
        items: data.items?.map(item => ({
          title: item.title,
          price: item.price,
          soldDate: item.soldDate,
          condition: item.condition,
          imageUrl: item.imageUrl,
          itemUrl: item.itemUrl,
          listingType: item.listingType,
          bidCount: item.bidCount
        })) || [],
        priceDistribution: data.priceDistribution,
        query: data.query
      };
    } catch (error) {
      console.error('eBay search error:', error);
      return null;
    }
  },
  
  // Get market price for a specific coin with smart query building
  async getCoinMarketPrice(coinName, options = {}) {
    let query = coinName;
    if (options.grade) query += ` ${options.grade.toUpperCase()}`;
    if (options.year) query += ` ${options.year}`;
    if (options.mint) query += ` ${options.mint}`;
    
    // Use coins category for better results
    return await this.searchSoldListings(query, { 
      ...options,
      category: '11116', // Coins & Paper Money
      daysBack: options.daysBack || '60'
    });
  },
  
  // Get silver coin market prices (90% silver, etc)
  async getSilverCoinPrice(coinType, options = {}) {
    // Build specific search for silver coins
    const searches = {
      'mercury-dime': 'Mercury Dime 90% silver -proof -roll',
      'roosevelt-dime-silver': 'Roosevelt Dime 90% silver 1964 -proof -roll',
      'washington-quarter': 'Washington Quarter 90% silver -proof -roll',
      'standing-liberty-quarter': 'Standing Liberty Quarter 90% silver',
      'barber-quarter': 'Barber Quarter 90% silver',
      'walking-liberty-half': 'Walking Liberty Half Dollar 90% silver',
      'franklin-half': 'Franklin Half Dollar 90% silver',
      'kennedy-half-silver': 'Kennedy Half Dollar 90% silver 1964',
      'morgan-dollar': 'Morgan Silver Dollar',
      'peace-dollar': 'Peace Silver Dollar',
      'american-silver-eagle': 'American Silver Eagle 1oz'
    };
    
    const query = searches[coinType] || `${coinType} 90% silver`;
    
    return await this.searchSoldListings(query, {
      category: '11116',
      daysBack: '30',
      ...options
    });
  }
};

// ============ IMAGE COMPRESSION UTILITY ============
const ImageUtils = {
  // Compress image to reduce storage size
  compressImage(base64Data, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Scale down if needed
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Get compressed base64 (without data URL prefix)
        const compressed = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        resolve(compressed);
      };
      img.src = `data:image/jpeg;base64,${base64Data}`;
    });
  }
};

// Default spot prices (will be updated by SpotPriceService)
const spotPrices = { gold: 4600.00, silver: 90.00, platinum: 985.00, palladium: 945.00 };

const categories = [
  'Gold - Jewelry', 'Gold - Coins', 'Gold - Bullion', 'Gold - Scrap',
  'Silver - Sterling', 'Silver - Coins', 'Silver - Bullion', 'Silver - Plated',
  'Coins - Silver', 'Coins - Gold', 'Coins - Numismatic',
  'Platinum', 'Palladium', 'Watches', 'Gemstones', 'Other'
];

// Categories exempt from holding period per NC G.S. 66-406
// "precious metal" does not include coins, medals, medallions, tokens, numismatic items, art ingots, or art bars
const EXEMPT_CATEGORIES = [
  'Gold - Coins', 'Gold - Bullion', 
  'Silver - Coins', 'Silver - Bullion',
  'Coins - Silver', 'Coins - Gold', 'Coins - Numismatic'
];

// NC Seller Certification Language
const NC_SELLER_CERTIFICATION = `By signing below, I hereby certify and affirm under penalty of law that:

1. OWNERSHIP: I am the legal owner of the item(s) being sold, or I am legally authorized to sell these items on behalf of the owner.

2. STOLEN PROPERTY: The item(s) being sold are not stolen, and I have not obtained them through theft, fraud, or any illegal means. I understand that selling stolen property is a criminal offense under N.C.G.S. § 14-71 (Receiving Stolen Goods) and federal law.

3. ANTI-MONEY LAUNDERING: This transaction does not involve proceeds from illegal activity. I am not using this sale to launder money, structure transactions to avoid reporting requirements, or evade taxes.

4. IDENTIFICATION: The identification I have provided is genuine, current, and belongs to me. I understand that providing false identification is a criminal offense.

5. ACCURACY: All information I have provided regarding these items, including descriptions of weight, purity, and origin, is true and accurate to the best of my knowledge.

6. COMPLIANCE: I understand that Stevens Estate Services LLC is required by North Carolina law (N.C.G.S. Chapter 66, Article 45) to maintain records of this transaction and report to law enforcement upon request.

7. HOLD PERIOD: I understand that applicable items may be subject to a mandatory hold period before resale as required by N.C.G.S. § 66-410.

I understand that making false statements in connection with this transaction may result in criminal prosecution and civil liability.`;

// Calculate NC hold release date (7 business days per current NC statute)
function calculateHoldReleaseDate(acquiredDate) {
  const acquired = new Date(acquiredDate);
  let businessDays = 0;
  let currentDate = new Date(acquired);
  
  // NC holidays (simplified - major federal holidays)
  const isHoliday = (date) => {
    const month = date.getMonth();
    const day = date.getDate();
    const dayOfWeek = date.getDay();
    
    // New Year's Day
    if (month === 0 && day === 1) return true;
    // MLK Day (3rd Monday of January)
    if (month === 0 && dayOfWeek === 1 && day >= 15 && day <= 21) return true;
    // Presidents Day (3rd Monday of February)
    if (month === 1 && dayOfWeek === 1 && day >= 15 && day <= 21) return true;
    // Memorial Day (last Monday of May)
    if (month === 4 && dayOfWeek === 1 && day >= 25) return true;
    // Independence Day
    if (month === 6 && day === 4) return true;
    // Labor Day (1st Monday of September)
    if (month === 8 && dayOfWeek === 1 && day <= 7) return true;
    // Veterans Day
    if (month === 10 && day === 11) return true;
    // Thanksgiving (4th Thursday of November)
    if (month === 10 && dayOfWeek === 4 && day >= 22 && day <= 28) return true;
    // Christmas
    if (month === 11 && day === 25) return true;
    
    return false;
  };
  
  while (businessDays < 7) {
    currentDate.setDate(currentDate.getDate() + 1);
    const dayOfWeek = currentDate.getDay();
    
    // Skip weekends and holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(currentDate)) {
      businessDays++;
    }
  }
  
  return currentDate;
}

// Calculate spot value for inventory by metal type
function calculateSpotValues(inventory, spotPrices) {
  const available = inventory.filter(i => i.status === 'Available');
  
  const byMetal = {
    Gold: { weightOz: 0, spotValue: 0, items: 0 },
    Silver: { weightOz: 0, spotValue: 0, items: 0 },
    Platinum: { weightOz: 0, spotValue: 0, items: 0 },
    Palladium: { weightOz: 0, spotValue: 0, items: 0 },
    Other: { weightOz: 0, spotValue: 0, items: 0 }
  };
  
  available.forEach(item => {
    const metal = item.metalType || 'Other';
    const weight = parseFloat(item.weightOz) || 0;
    
    // Calculate pure metal weight based on purity
    let purityDecimal = 1;
    const purity = item.purity || '';
    if (purity.includes('K')) purityDecimal = parseInt(purity) / 24;
    else if (purity.includes('%')) purityDecimal = parseInt(purity) / 100;
    else if (purity === '925') purityDecimal = 0.925;
    else if (purity === '999') purityDecimal = 0.999;
    else if (purity === '950') purityDecimal = 0.95;
    else if (purity === '900') purityDecimal = 0.90;
    else if (purity === 'Plated' || purity === 'plated') purityDecimal = 0;
    
    const pureWeight = weight * purityDecimal;
    const spotPrice = spotPrices[metal.toLowerCase()] || 0;
    const spotValue = pureWeight * spotPrice;
    
    if (byMetal[metal]) {
      byMetal[metal].weightOz += pureWeight;
      byMetal[metal].spotValue += spotValue;
      byMetal[metal].items += 1;
    } else {
      byMetal.Other.weightOz += pureWeight;
      byMetal.Other.spotValue += spotValue;
      byMetal.Other.items += 1;
    }
  });
  
  return byMetal;
}

// Check if item is exempt from hold period
function isExemptFromHold(category) {
  return EXEMPT_CATEGORIES.includes(category);
}

// Get hold status for an item
function getHoldStatus(item) {
  // Check if manually released first
  if (item.holdReleased) {
    return { 
      status: 'released', 
      message: `Released Early: ${item.holdReleaseReason || 'Manual'}`, 
      daysLeft: 0, 
      canSell: true,
      manuallyReleased: true,
      releaseReason: item.holdReleaseReason
    };
  }
  
  if (isExemptFromHold(item.category)) {
    return { status: 'exempt', message: 'Coins/Bullion - No Hold Required', daysLeft: 0, canSell: true };
  }
  
  const releaseDate = calculateHoldReleaseDate(item.dateAcquired);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  releaseDate.setHours(0, 0, 0, 0);
  
  const diffTime = releaseDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) {
    return { status: 'released', message: 'Hold Complete - Available to Sell', daysLeft: 0, canSell: true, releaseDate };
  } else {
    return { status: 'hold', message: `On Hold - ${diffDays} day${diffDays > 1 ? 's' : ''} remaining`, daysLeft: diffDays, canSell: false, releaseDate };
  }
}

// Your actual inventory from past conversations
const starterInventory = [
  // January 13, 2026 - Auction Purchases
  { id: 'SES-001', description: 'Franklin Half Dollars (15 coin set)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 5.43, source: 'Auction', clientId: 'CLI-001', dateAcquired: '2026-01-13', purchasePrice: 400, meltValue: 469, status: 'Available', notes: 'Capital Plastics holder, AU/BU condition. Retail $600-675.', coinKey: 'franklin-half', quantity: 15, lotId: 'LOT-001' },
  { id: 'SES-002', description: 'Peace Dollars (9 coin set, 1924)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 6.96, source: 'Auction', clientId: 'CLI-001', dateAcquired: '2026-01-13', purchasePrice: 550, meltValue: 601, status: 'Available', notes: 'Capital Plastics holder, VF-AU. Retail $720-855.', coinKey: 'peace-dollar', quantity: 9, lotId: 'LOT-002' },
  { id: 'SES-003', description: '1927-D Peace Dollar NGC AU55', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.7734, source: 'Auction', clientId: 'CLI-001', dateAcquired: '2026-01-13', purchasePrice: 75, meltValue: 67, status: 'Available', notes: 'NGC Cert #1531904-041, Semi-key date (1.27M mintage). Retail $125-175.', coinKey: 'peace-dollar', year: '1927', mint: 'D', grade: 'AU55' },
  { id: 'SES-004', description: '1922 Peace Dollar NGC MS63', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.7734, source: 'Auction', clientId: 'CLI-001', dateAcquired: '2026-01-13', purchasePrice: 75, meltValue: 67, status: 'Available', notes: 'NGC Cert #6788772-065, Common date. Retail $85-110.', coinKey: 'peace-dollar', year: '1922', grade: 'MS63' },
  { id: 'SES-005', description: '90% Silver Quarters (60 coins)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 10.85, source: 'Auction', clientId: 'CLI-001', dateAcquired: '2026-01-13', purchasePrice: 750, meltValue: 938, status: 'Available', notes: 'Mixed Washington quarters bulk lot.', coinKey: 'washington-quarter', quantity: 60, lotId: 'LOT-003' },
  
  // January 12, 2026 - Victorian Lace Antique Mall
  { id: 'SES-006', description: 'Mexican Sterling Hinged Bangle (HPL maker)', category: 'Silver - Sterling', metalType: 'Silver', purity: '925', weightOz: 2.70, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 136.96, meltValue: 225, status: 'Available', notes: 'Modernist square design, 84g. Price includes 7% tax.' },
  { id: 'SES-007', description: 'Mexican Sterling Chevron Link Bracelet', category: 'Silver - Sterling', metalType: 'Silver', purity: '925', weightOz: 1.93, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 48.15, meltValue: 161, status: 'Available', notes: 'Leaf/wheat pattern, 60g, Mexico 925 mark, TL-01 maker. Price includes tax. Paid 32% of melt.' },
  { id: 'SES-008', description: '2008-S Hawaii Silver Proof Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 13, meltValue: 16, status: 'Available', notes: 'State Quarter series, SGC booth', coinKey: 'washington-quarter', year: '2008', mint: 'S', grade: 'PF' },
  { id: 'SES-009', description: '2011-S Gettysburg Silver Proof Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 11, meltValue: 16, status: 'Available', notes: 'America the Beautiful', coinKey: 'washington-quarter', year: '2011', mint: 'S', grade: 'PF' },
  { id: 'SES-010', description: '2010-S Grand Canyon Silver Proof Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 13, meltValue: 16, status: 'Available', notes: 'America the Beautiful', coinKey: 'washington-quarter', year: '2010', mint: 'S', grade: 'PF' },
  { id: 'SES-011', description: '1962-D Franklin Half Dollar', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 26, meltValue: 31, status: 'Available', coinKey: 'franklin-half', year: '1962', mint: 'D' },
  { id: 'SES-012', description: '1930 Standing Liberty Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 23, meltValue: 16, status: 'Available', notes: 'Collector premium (150% melt)', coinKey: 'standing-liberty-quarter', year: '1930' },
  { id: 'SES-013', description: '1928 Standing Liberty Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 23, meltValue: 16, status: 'Available', coinKey: 'standing-liberty-quarter', year: '1928' },
  { id: 'SES-014', description: '1924 Standing Liberty Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 75, meltValue: 16, status: 'Available', notes: 'Paid 488% of melt - collector piece', coinKey: 'standing-liberty-quarter', year: '1924' },
  { id: 'SES-015', description: '1927 Standing Liberty Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 23, meltValue: 16, status: 'Available', coinKey: 'standing-liberty-quarter', year: '1927' },
  { id: 'SES-016', description: '1925 Standing Liberty Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 23, meltValue: 16, status: 'Available', coinKey: 'standing-liberty-quarter', year: '1925' },
  { id: 'SES-017', description: '1903-O Barber Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 13, meltValue: 16, status: 'Available', notes: 'Good buy at 85% melt', coinKey: 'barber-quarter', year: '1903', mint: 'O' },
  { id: 'SES-018', description: '1909 Barber Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 13, meltValue: 16, status: 'Available', coinKey: 'barber-quarter', year: '1909' },
  { id: 'SES-019', description: '1908 Barber Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 13, meltValue: 16, status: 'Available', coinKey: 'barber-quarter', year: '1908' },
  { id: 'SES-020', description: '1909-D Barber Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 14, meltValue: 16, status: 'Available', coinKey: 'barber-quarter', year: '1909', mint: 'D' },
  { id: 'SES-021', description: '1912 Barber Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 23, meltValue: 16, status: 'Available', notes: 'Collector premium (150% melt)', coinKey: 'barber-quarter', year: '1912' },
  { id: 'SES-022', description: '1915 Barber Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 23, meltValue: 16, status: 'Available', coinKey: 'barber-quarter', year: '1915' },
  { id: 'SES-023', description: '1945-S Walking Liberty Half', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 26, meltValue: 31, status: 'Available', coinKey: 'walking-liberty-half', year: '1945', mint: 'S' },
  { id: 'SES-024', description: '1937 Walking Liberty Half', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 28, meltValue: 31, status: 'Available', coinKey: 'walking-liberty-half', year: '1937' },
  { id: 'SES-025', description: '1949-S Franklin Half Dollar', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617, source: 'Victorian Lace Antique Mall', clientId: 'CLI-002', dateAcquired: '2026-01-12', purchasePrice: 26, meltValue: 31, status: 'Available', coinKey: 'franklin-half', year: '1949', mint: 'S' },
  
  // Other items from conversations
  { id: 'SES-026', description: 'South African Threepence Coin Bracelet (8 coins)', category: 'Silver - World', metalType: 'Silver', purity: '80%', weightOz: 0.29, source: 'Walk-in', clientId: 'CLI-003', dateAcquired: '2026-01-13', purchasePrice: 18, meltValue: 25, status: 'Available', notes: 'George VI era 3d coins (1951-1952), broken bracelet, base metal bezels. Melt only.' },
  { id: 'SES-027', description: 'Franklin Mint Apollo 13 Medal', category: 'Collectibles', metalType: 'Silver', purity: '925', weightOz: 0, source: 'Walk-in', clientId: 'CLI-003', dateAcquired: '2026-01-10', purchasePrice: 60, meltValue: 0, status: 'Available', notes: 'Space-flown metal content, presentation case & docs. Collector value $100-150, not melt.' },
  { id: 'SES-028', description: 'Mexican Sterling Mahogany Obsidian Bracelet', category: 'Silver - Sterling', metalType: 'Silver', purity: '925', weightOz: 0.80, source: 'Walk-in', clientId: 'CLI-003', dateAcquired: '2026-01-11', purchasePrice: 42, meltValue: 67, status: 'Available', notes: 'Taxco-style, 8 oval cabochons, ~43g total (~25g silver). eBay value $80-120. Bought at 70% melt.' },
];

// Your actual clients
const starterClients = [
  { id: 'CLI-001', name: 'January 13 Auction', type: 'Business', email: '', phone: '', address: '', idType: 'Business', idNumber: '', idExpiry: '', idFrontPhoto: null, idBackPhoto: null, signature: null, signatureTimestamp: null, signatureLocation: null, notes: 'Auction house - Franklin set, Peace set, NGC slabs, 60 quarters. Total: $1,850', dateAdded: '2026-01-13', totalTransactions: 5, totalPurchased: 1850 },
  { id: 'CLI-002', name: 'Victorian Lace Antique Mall', type: 'Business', email: '', phone: '', address: 'Rutherfordton, NC', businessLicense: '', taxId: '', idType: 'Business', idNumber: '', idFrontPhoto: null, idBackPhoto: null, signature: null, signatureTimestamp: null, signatureLocation: null, notes: 'Antique mall with multiple booths (SGC, WW, etc). Coins exempt from tax, jewelry taxed at 7%.', dateAdded: '2026-01-12', totalTransactions: 22, totalPurchased: 560 },
  { id: 'CLI-003', name: 'Walk-in Sellers', type: 'Private', email: '', phone: '', address: '', idType: '', idNumber: '', idExpiry: '', idFrontPhoto: null, idBackPhoto: null, signature: null, signatureTimestamp: null, signatureLocation: null, notes: 'Miscellaneous walk-in sellers - SA bracelet, Apollo medal, obsidian bracelet', dateAdded: '2026-01-10', totalTransactions: 3, totalPurchased: 120 },
];

// Your actual lots
const starterLots = [
  { 
    id: 'LOT-001', 
    description: 'Franklin Half Dollar Set (15 coins)', 
    totalCost: 400, 
    totalItems: 15, 
    source: 'Auction',
    clientId: 'CLI-001',
    dateAcquired: '2026-01-13',
    status: 'intact',
    allocationMethod: 'equal',
    notes: 'Capital Plastics holder, AU/BU condition. Paid 85.4% of melt ($468.57). Retail value $600-675. Consider selling as set for collector premium.',
    itemIds: ['SES-001'],
    createdAt: '2026-01-13T00:00:00Z'
  },
  { 
    id: 'LOT-002', 
    description: 'Peace Dollar Set (9 coins, 1924)', 
    totalCost: 550, 
    totalItems: 9, 
    source: 'Auction',
    clientId: 'CLI-001',
    dateAcquired: '2026-01-13',
    status: 'intact',
    allocationMethod: 'equal',
    notes: 'Capital Plastics holder (aftermarket, not mint issued), VF-AU. Paid 91.5% of melt ($600.88). Retail $720-855. Test for authenticity before resale.',
    itemIds: ['SES-002'],
    createdAt: '2026-01-13T00:00:00Z'
  },
  { 
    id: 'LOT-003', 
    description: '90% Silver Quarters (60 coins)', 
    totalCost: 750, 
    totalItems: 60, 
    source: 'Auction',
    clientId: 'CLI-001',
    dateAcquired: '2026-01-13',
    status: 'intact',
    allocationMethod: 'equal',
    notes: 'Mixed Washington quarters. $15 face value. Paid $50/face ($12.50/coin). Junk silver for melt or resale.',
    itemIds: ['SES-005'],
    createdAt: '2026-01-13T00:00:00Z'
  }
];

// ============ EBAY LISTING VIEW ============
function EbayListingView({ item, generatedListing, onBack, onListingCreated }) {
  const [photos, setPhotos] = useState(item.photos || (item.photo ? [item.photo] : []));
  const [video, setVideo] = useState(null); // Video as base64 or blob URL
  const [videoFile, setVideoFile] = useState(null); // Original file for upload
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('USED_EXCELLENT');
  const [quantity, setQuantity] = useState(1);
  const [format, setFormat] = useState('FIXED_PRICE'); // FIXED_PRICE or AUCTION
  const [auctionDuration, setAuctionDuration] = useState('DAYS_7');
  const [startingBid, setStartingBid] = useState('');
  const [buyItNow, setBuyItNow] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categorySuggestions, setCategorySuggestions] = useState([]);
  const [policies, setPolicies] = useState(null);
  const [selectedPolicies, setSelectedPolicies] = useState({
    fulfillment: '',
    payment: '',
    returns: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const photoInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const videoGalleryRef = useRef(null);
  
  // Use generatedListing if provided, otherwise generate basic title/desc
  useEffect(() => {
    if (generatedListing) {
      // Use the pre-generated listing from DetailView
      setTitle(generatedListing.title || '');
      setDescription(generatedListing.description || '');
      setPrice(generatedListing.pricingStrategy?.binPrice || item.meltValue || '');
      setFormat(generatedListing.pricingStrategy?.recommendedFormat === 'AUCTION' ? 'AUCTION' : 'FIXED_PRICE');
      if (generatedListing.pricingStrategy?.auctionStart) {
        setStartingBid(generatedListing.pricingStrategy.auctionStart);
      }
      if (generatedListing.pricingStrategy?.binPrice) {
        setBuyItNow(generatedListing.pricingStrategy.binPrice);
      }
    } else {
      // Fallback: generate basic title
      let generatedTitle = item.description;
      if (item.year) generatedTitle += ` ${item.year}`;
      if (item.mint) generatedTitle += `-${item.mint}`;
      if (item.grade) generatedTitle += ` ${item.grade.toUpperCase()}`;
      if (item.purity) generatedTitle += ` ${item.purity}`;
      setTitle(generatedTitle);
      
      // Generate basic description
      const desc = `${item.description}

Metal: ${item.metalType || 'Silver'}
Purity: ${item.purity || 'N/A'}
Weight: ${item.weightOz || 'N/A'} oz
${item.year ? `Year: ${item.year}` : ''}
${item.mint ? `Mint: ${item.mint}` : ''}
${item.grade ? `Grade: ${item.grade.toUpperCase()}` : ''}

${item.notes || ''}

Ships securely in protective packaging. Thanks for looking!`;
      setDescription(desc);
      setPrice(item.meltValue || '');
    }
    
    // Get category suggestions
    if (item.coinKey && EbayListingService.coinCategories[item.coinKey]) {
      setCategoryId(EbayListingService.coinCategories[item.coinKey]);
    }
  }, [item, generatedListing]);
  
  // Load business policies on mount
  useEffect(() => {
    const loadPolicies = async () => {
      if (CONFIG.features.useEbayListing) {
        const p = await EbayListingService.getBusinessPolicies();
        if (p) {
          setPolicies(p);
          // Auto-select first policy of each type
          setSelectedPolicies({
            fulfillment: p.fulfillment[0]?.fulfillmentPolicyId || '',
            payment: p.payment[0]?.paymentPolicyId || '',
            returns: p.returns[0]?.returnPolicyId || ''
          });
        }
      }
    };
    loadPolicies();
  }, []);
  
  // Add photo
  const handleAddPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result.split(',')[1];
      // Compress before adding
      const compressed = await ImageUtils.compressImage(base64, 1200, 0.85);
      setPhotos([...photos, compressed]);
    };
    reader.readAsDataURL(file);
  };
  
  // Remove photo
  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };
  
  // Move photo (reorder)
  const movePhoto = (fromIndex, toIndex) => {
    const newPhotos = [...photos];
    const [removed] = newPhotos.splice(fromIndex, 1);
    newPhotos.splice(toIndex, 0, removed);
    setPhotos(newPhotos);
  };
  
  // Handle video capture
  const handleVideoCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (eBay limit is typically 150MB, we'll warn at 50MB)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 150) {
      setError('Video must be under 150MB. Try recording a shorter video.');
      return;
    }
    
    // Check duration if possible
    const videoElement = document.createElement('video');
    videoElement.preload = 'metadata';
    videoElement.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoElement.src);
      const duration = videoElement.duration;
      
      // eBay typically allows up to 1 minute
      if (duration > 60) {
        setError('Video must be under 60 seconds for eBay listings.');
        return;
      }
      
      // Store both the blob URL for preview and the file for upload
      setVideo(URL.createObjectURL(file));
      setVideoFile(file);
      setError(null);
    };
    videoElement.src = URL.createObjectURL(file);
  };
  
  // Remove video
  const removeVideo = () => {
    if (video) {
      URL.revokeObjectURL(video);
    }
    setVideo(null);
    setVideoFile(null);
  };
  
  // Search for category
  const searchCategory = async () => {
    const suggestions = await EbayListingService.suggestCategory(title);
    if (suggestions) {
      setCategorySuggestions(suggestions);
    }
  };
  
  // Condition options
  const conditionOptions = [
    { value: 'NEW', label: 'New' },
    { value: 'LIKE_NEW', label: 'Like New' },
    { value: 'USED_EXCELLENT', label: 'Used - Excellent' },
    { value: 'USED_VERY_GOOD', label: 'Used - Very Good' },
    { value: 'USED_GOOD', label: 'Used - Good' },
    { value: 'USED_ACCEPTABLE', label: 'Used - Acceptable' },
  ];
  
  // Create and publish listing
  const handlePublish = async () => {
    if (!title || !price || photos.length === 0) {
      setError('Please fill in title, price, and add at least one photo');
      return;
    }
    
    if (!categoryId) {
      setError('Please select a category');
      return;
    }
    
    setIsPublishing(true);
    setError(null);
    
    try {
      // 1. Upload images to eBay
      const imageUrls = [];
      for (const photo of photos) {
        const url = await EbayListingService.uploadImage(photo);
        if (url) imageUrls.push(url);
      }
      
      if (imageUrls.length === 0) {
        throw new Error('Failed to upload images');
      }
      
      // 2. Upload video if provided
      let videoId = null;
      if (videoFile) {
        setIsUploadingVideo(true);
        videoId = await EbayListingService.uploadVideo(videoFile);
        setIsUploadingVideo(false);
        
        if (!videoId) {
          // Video upload failed but we can continue without it
          console.warn('Video upload failed, continuing without video');
        }
      }
      
      // 3. Create inventory item
      const sku = `SES-${item.id}-${Date.now()}`;
      const inventoryCreated = await EbayListingService.createInventoryItem(sku, {
        title,
        description,
        condition,
        quantity,
        imageUrls,
        videoIds: videoId ? [videoId] : undefined,
        aspects: {
          'Brand': ['Unbranded'],
          'Year': item.year ? [item.year] : undefined,
          'Composition': item.metalType ? [item.metalType] : undefined,
        }
      });
      
      if (!inventoryCreated) {
        throw new Error('Failed to create inventory item');
      }
      
      // 4. Create offer
      const offerId = await EbayListingService.createOffer(sku, {
        description,
        price: format === 'AUCTION' ? startingBid : price,
        quantity,
        format,
        categoryId,
        fulfillmentPolicyId: selectedPolicies.fulfillment,
        paymentPolicyId: selectedPolicies.payment,
        returnPolicyId: selectedPolicies.returns,
      });
      
      if (!offerId) {
        throw new Error('Failed to create offer');
      }
      
      // 5. Publish offer
      const listingId = await EbayListingService.publishOffer(offerId);
      
      if (!listingId) {
        throw new Error('Failed to publish listing');
      }
      
      setSuccess(`Listing created! eBay Item #${listingId}${videoId ? ' (with video)' : ''}`);
      
      if (onListingCreated) {
        onListingCreated({
          listingId,
          sku,
          videoId,
          ebayUrl: `https://www.ebay.com/itm/${listingId}`
        });
      }
      
    } catch (err) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setIsPublishing(false);
    }
  };
  
  // Preview modal
  if (showPreview) {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
          <button onClick={() => setShowPreview(false)}>← Back to Edit</button>
          <h1 className="font-bold">Listing Preview</h1>
          <div className="w-16"></div>
        </div>
        
        <div className="p-4">
          {/* Photo Gallery */}
          <div className="mb-4">
            {photos.length > 0 && (
              <img 
                src={`data:image/jpeg;base64,${photos[0]}`} 
                className="w-full aspect-square object-contain bg-gray-100 rounded-lg"
              />
            )}
            {photos.length > 1 && (
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {photos.map((photo, index) => (
                  <img 
                    key={index}
                    src={`data:image/jpeg;base64,${photo}`}
                    className="w-16 h-16 object-cover rounded border"
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Video Preview */}
          {video && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm text-blue-600 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 8-6 4 6 4V8Z"/>
                  <rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
                </svg>
                <span>Video included</span>
              </div>
              <video 
                src={video} 
                className="w-full rounded-lg bg-black"
                controls
                style={{ maxHeight: '150px' }}
              />
            </div>
          )}
          
          {/* Title */}
          <h1 className="text-xl font-bold mb-2">{title}</h1>
          
          {/* Price */}
          <div className="text-2xl font-bold text-green-700 mb-4">
            {format === 'AUCTION' ? (
              <>Starting bid: ${startingBid}</>
            ) : (
              <>${price}</>
            )}
          </div>
          
          {/* Condition */}
          <div className="text-sm text-gray-600 mb-4">
            Condition: {conditionOptions.find(c => c.value === condition)?.label}
          </div>
          
          {/* Description */}
          <div className="border-t pt-4">
            <h3 className="font-bold mb-2">Description</h3>
            <div className="whitespace-pre-wrap text-sm text-gray-700">{description}</div>
          </div>
        </div>
        
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <button
            onClick={() => { setShowPreview(false); handlePublish(); }}
            disabled={isPublishing}
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold"
          >
            {isPublishing ? (isUploadingVideo ? 'Uploading video...' : 'Publishing...') : 'Publish to eBay'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack}>← Cancel</button>
          <h1 className="text-xl font-bold">List on eBay</h1>
          <button onClick={() => setShowPreview(true)} className="text-sm">Preview</button>
        </div>
      </div>
      
      {/* Success/Error Messages */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mx-4 mt-4 p-3 bg-green-100 border border-green-300 rounded-lg text-green-700">
          {success}
          <a 
            href={`https://www.ebay.com/sh/lst/active`} 
            target="_blank" 
            className="block mt-2 text-blue-600 underline"
          >
            View in Seller Hub →
          </a>
        </div>
      )}
      
      <div className="p-4 space-y-4 pb-32">
        {/* Photos Section */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3 flex items-center justify-between">
            <span>Photos ({photos.length}/12)</span>
            <span className="text-xs text-gray-500">First photo is main image</span>
          </h3>
          
          <div className="grid grid-cols-4 gap-2 mb-3">
            {photos.map((photo, index) => (
              <div key={index} className="relative aspect-square">
                <img 
                  src={`data:image/jpeg;base64,${photo}`} 
                  className="w-full h-full object-cover rounded-lg"
                />
                {index === 0 && (
                  <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-1 rounded">Main</span>
                )}
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                >
                  <X size={12} />
                </button>
                {index > 0 && (
                  <button
                    onClick={() => movePhoto(index, 0)}
                    className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded"
                  >
                    Set Main
                  </button>
                )}
              </div>
            ))}
            
            {photos.length < 12 && (
              <div className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 gap-1">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="flex flex-col items-center text-gray-500 hover:text-teal-600"
                  title="Take photo"
                >
                  <Camera size={20} />
                  <span className="text-xs">Camera</span>
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center text-gray-500 hover:text-teal-600"
                  title="Choose from gallery"
                >
                  <Upload size={16} />
                  <span className="text-xs">Gallery</span>
                </button>
              </div>
            )}
          </div>
          
          {/* Camera input (captures new photo) */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={photoInputRef}
            onChange={handleAddPhoto}
            className="hidden"
          />
          
          {/* Gallery input (choose existing photo) */}
          <input
            type="file"
            accept="image/*"
            ref={galleryInputRef}
            onChange={handleAddPhoto}
            className="hidden"
          />
          
          <p className="text-xs text-gray-500">
            Tip: Add multiple angles - front, back, edge, close-up of date/mint mark
          </p>
        </div>
        
        {/* Video Section (Optional) */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3 flex items-center justify-between">
            <span>Video (Optional)</span>
            <span className="text-xs text-gray-500 font-normal">Max 60 sec</span>
          </h3>
          
          {video ? (
            <div className="relative">
              <video 
                src={video} 
                className="w-full rounded-lg bg-black"
                controls
                style={{ maxHeight: '200px' }}
              />
              <button
                onClick={removeVideo}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg"
              >
                <X size={16} />
              </button>
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                <Check size={16} />
                <span>Video ready for upload</span>
                {videoFile && (
                  <span className="text-gray-500">
                    ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex gap-2">
                <button
                  onClick={() => videoInputRef.current?.click()}
                  className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-400 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m22 8-6 4 6 4V8Z"/>
                    <rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
                  </svg>
                  <span className="mt-1 font-medium text-sm">Record</span>
                </button>
                <button
                  onClick={() => videoGalleryRef.current?.click()}
                  className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-400 transition-colors"
                >
                  <Upload size={28} />
                  <span className="mt-1 font-medium text-sm">Choose</span>
                </button>
              </div>
              
              {/* Camera video input */}
              <input
                type="file"
                accept="video/*"
                capture="environment"
                ref={videoInputRef}
                onChange={handleVideoCapture}
                className="hidden"
              />
              
              {/* Gallery video input */}
              <input
                type="file"
                accept="video/*"
                ref={videoGalleryRef}
                onChange={handleVideoCapture}
                className="hidden"
              />
              
              <p className="text-xs text-gray-500 mt-2">
                Videos help buyers see coin details, luster, and toning that photos can't capture
              </p>
            </div>
          )}
        </div>
        
        {/* Title */}
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block font-bold mb-2">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded-lg p-3"
            maxLength={80}
            placeholder="e.g., 1921 Morgan Silver Dollar VF"
          />
          <div className="text-xs text-gray-500 mt-1 text-right">{title.length}/80</div>
        </div>
        
        {/* Pricing */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">Pricing</h3>
          
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setFormat('FIXED_PRICE')}
              className={`flex-1 py-2 rounded-lg font-medium ${
                format === 'FIXED_PRICE' ? 'bg-blue-600 text-white' : 'bg-gray-100'
              }`}
            >
              Fixed Price
            </button>
            <button
              onClick={() => setFormat('AUCTION')}
              className={`flex-1 py-2 rounded-lg font-medium ${
                format === 'AUCTION' ? 'bg-blue-600 text-white' : 'bg-gray-100'
              }`}
            >
              Auction
            </button>
          </div>
          
          {format === 'FIXED_PRICE' ? (
            <div>
              <label className="block text-sm mb-1">Price *</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500">$</span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full border rounded-lg p-3 pl-7"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Melt value: ${item.meltValue} • Suggested: ${(item.meltValue * 1.3).toFixed(2)}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Starting Bid *</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500">$</span>
                  <input
                    type="number"
                    value={startingBid}
                    onChange={(e) => setStartingBid(e.target.value)}
                    className="w-full border rounded-lg p-3 pl-7"
                    step="0.01"
                    placeholder="0.99"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Buy It Now (optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500">$</span>
                  <input
                    type="number"
                    value={buyItNow}
                    onChange={(e) => setBuyItNow(e.target.value)}
                    className="w-full border rounded-lg p-3 pl-7"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Duration</label>
                <select
                  value={auctionDuration}
                  onChange={(e) => setAuctionDuration(e.target.value)}
                  className="w-full border rounded-lg p-3 bg-white"
                >
                  <option value="DAYS_1">1 Day</option>
                  <option value="DAYS_3">3 Days</option>
                  <option value="DAYS_5">5 Days</option>
                  <option value="DAYS_7">7 Days</option>
                  <option value="DAYS_10">10 Days</option>
                </select>
              </div>
            </div>
          )}
        </div>
        
        {/* Condition */}
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block font-bold mb-2">Condition *</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full border rounded-lg p-3 bg-white"
          >
            {conditionOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        
        {/* Category */}
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block font-bold mb-2">Category *</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex-1 border rounded-lg p-3"
              placeholder="Category ID"
            />
            <button
              onClick={searchCategory}
              className="bg-gray-200 px-4 rounded-lg"
            >
              Find
            </button>
          </div>
          
          {categorySuggestions.length > 0 && (
            <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
              {categorySuggestions.map((cat, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCategoryId(cat.category.categoryId);
                    setCategorySuggestions([]);
                  }}
                  className="w-full text-left p-2 hover:bg-gray-100 border-b last:border-b-0 text-sm"
                >
                  {cat.category.categoryName}
                  <span className="text-gray-500 text-xs block">{cat.categoryTreeNodeAncestors?.map(a => a.categoryName).join(' > ')}</span>
                </button>
              ))}
            </div>
          )}
          
          {item.coinKey && EbayListingService.coinCategories[item.coinKey] && (
            <p className="text-xs text-green-600 mt-1">
              ✓ Auto-detected: Coin category {EbayListingService.coinCategories[item.coinKey]}
            </p>
          )}
        </div>
        
        {/* Description */}
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block font-bold mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded-lg p-3"
            rows={8}
          />
        </div>
        
        {/* Business Policies */}
        {policies && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3">Business Policies</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Shipping</label>
                <select
                  value={selectedPolicies.fulfillment}
                  onChange={(e) => setSelectedPolicies({...selectedPolicies, fulfillment: e.target.value})}
                  className="w-full border rounded-lg p-2 bg-white text-sm"
                >
                  {policies.fulfillment.map(p => (
                    <option key={p.fulfillmentPolicyId} value={p.fulfillmentPolicyId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm mb-1">Payment</label>
                <select
                  value={selectedPolicies.payment}
                  onChange={(e) => setSelectedPolicies({...selectedPolicies, payment: e.target.value})}
                  className="w-full border rounded-lg p-2 bg-white text-sm"
                >
                  {policies.payment.map(p => (
                    <option key={p.paymentPolicyId} value={p.paymentPolicyId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm mb-1">Returns</label>
                <select
                  value={selectedPolicies.returns}
                  onChange={(e) => setSelectedPolicies({...selectedPolicies, returns: e.target.value})}
                  className="w-full border rounded-lg p-2 bg-white text-sm"
                >
                  {policies.returns.map(p => (
                    <option key={p.returnPolicyId} value={p.returnPolicyId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
        
        {/* Quantity */}
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block font-bold mb-2">Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="w-full border rounded-lg p-3"
            min="1"
          />
        </div>
      </div>
      
      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex gap-3">
        <button
          onClick={() => setShowPreview(true)}
          className="flex-1 border border-gray-300 py-3 rounded-lg font-medium"
        >
          Preview
        </button>
        <button
          onClick={handlePublish}
          disabled={isPublishing || !title || !price || photos.length === 0}
          className={`flex-1 py-3 rounded-lg font-bold text-white ${
            isPublishing || !title || !price || photos.length === 0
              ? 'bg-gray-300'
              : 'bg-blue-600'
          }`}
        >
          {isPublishing ? (isUploadingVideo ? 'Uploading video...' : 'Publishing...') : 'List on eBay'}
        </button>
      </div>
    </div>
  );
}

// ============ PERSONAL STASH VIEW ============
function PersonalStashView({ inventory, spotPrices, onBack, onSelectItem, onMoveToStash, onMoveToInventory }) {
  const [view, setView] = useState('stash'); // stash, add
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  
  // Get stash items
  const stashItems = inventory.filter(i => i.status === 'Stash');
  const availableItems = inventory.filter(i => i.status === 'Available');
  
  // Calculate stash totals
  const calculateMetalValue = (item) => {
    const weight = parseFloat(item.weightOz) || 0;
    let purityDecimal = 1;
    if (item.purity?.includes('K')) purityDecimal = parseInt(item.purity) / 24;
    else if (item.purity?.includes('%')) purityDecimal = parseInt(item.purity) / 100;
    else if (item.purity === '925') purityDecimal = 0.925;
    else if (item.purity === '999' || item.purity === '9999') purityDecimal = 0.999;
    const spot = spotPrices[item.metalType?.toLowerCase()] || 0;
    return weight * purityDecimal * spot;
  };
  
  // Group stash by metal type
  const stashByMetal = stashItems.reduce((acc, item) => {
    const metal = item.metalType || 'Other';
    if (!acc[metal]) acc[metal] = { items: [], totalOz: 0, spotValue: 0, costBasis: 0 };
    acc[metal].items.push(item);
    acc[metal].totalOz += parseFloat(item.weightOz) || 0;
    acc[metal].spotValue += calculateMetalValue(item);
    acc[metal].costBasis += parseFloat(item.purchasePrice) || 0;
    return acc;
  }, {});
  
  const totalSpotValue = stashItems.reduce((sum, item) => sum + calculateMetalValue(item), 0);
  const totalCostBasis = stashItems.reduce((sum, item) => sum + (parseFloat(item.purchasePrice) || 0), 0);
  const totalGain = totalSpotValue - totalCostBasis;
  
  // Toggle item selection for adding to stash
  const toggleItemSelection = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };
  
  // Move selected items to stash
  const handleMoveToStash = () => {
    onMoveToStash(selectedItems);
    setSelectedItems([]);
    setView('stash');
  };
  
  // Filter available items for search
  const filteredAvailable = availableItems.filter(item =>
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-700 to-yellow-600 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-white">← Back</button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Star size={24} /> Personal Stash
          </h1>
          <button 
            onClick={() => setView(view === 'stash' ? 'add' : 'stash')}
            className="bg-white bg-opacity-20 px-3 py-1 rounded text-sm"
          >
            {view === 'stash' ? '+ Add' : 'View Stash'}
          </button>
        </div>
      </div>
      
      {view === 'stash' ? (
        <>
          {/* Stash Summary */}
          <div className="p-4">
            <div className="bg-gradient-to-br from-amber-900 to-yellow-900 rounded-xl p-4 mb-4">
              <div className="text-amber-200 text-sm mb-1">Total Stash Value</div>
              <div className="text-4xl font-bold text-white mb-2">${totalSpotValue.toFixed(2)}</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-amber-300">Cost Basis</div>
                  <div className="text-white font-medium">${totalCostBasis.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-amber-300">Unrealized Gain</div>
                  <div className={`font-medium ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalGain >= 0 ? '+' : ''}${totalGain.toFixed(2)}
                    <span className="text-xs ml-1">
                      ({totalCostBasis > 0 ? ((totalGain / totalCostBasis) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Metal Breakdown */}
            <div className="space-y-3 mb-4">
              {Object.entries(stashByMetal).map(([metal, data]) => (
                <div key={metal} className={`rounded-lg p-4 ${
                  metal === 'Gold' ? 'bg-yellow-900' :
                  metal === 'Silver' ? 'bg-gray-700' :
                  metal === 'Platinum' ? 'bg-gray-600' :
                  'bg-orange-900'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        metal === 'Gold' ? 'bg-yellow-400' :
                        metal === 'Silver' ? 'bg-gray-300' :
                        metal === 'Platinum' ? 'bg-gray-200' :
                        'bg-orange-400'
                      }`}></div>
                      <span className="text-white font-bold">{metal}</span>
                    </div>
                    <span className="text-white font-bold">${data.spotValue.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-gray-400">Items</div>
                      <div className="text-white">{data.items.length}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Weight</div>
                      <div className="text-white">{data.totalOz.toFixed(2)} oz</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Cost</div>
                      <div className="text-white">${data.costBasis.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Stash Items List */}
            <div className="bg-gray-800 rounded-lg">
              <div className="p-3 border-b border-gray-700">
                <h3 className="text-white font-bold">Stash Items ({stashItems.length})</h3>
              </div>
              
              {stashItems.length === 0 ? (
                <div className="p-8 text-center">
                  <Star size={48} className="mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400">Your personal stash is empty</p>
                  <p className="text-gray-500 text-sm">Add items from inventory to track your stack</p>
                  <button 
                    onClick={() => setView('add')}
                    className="mt-4 bg-amber-600 text-white px-4 py-2 rounded-lg"
                  >
                    Add Items
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {stashItems.map(item => {
                    const spotValue = calculateMetalValue(item);
                    const gain = spotValue - (item.purchasePrice || 0);
                    return (
                      <div 
                        key={item.id} 
                        className="p-3 flex items-center gap-3"
                        onClick={() => onSelectItem(item)}
                      >
                        {item.photo && (
                          <img 
                            src={`data:image/jpeg;base64,${item.photo}`} 
                            className="w-12 h-12 rounded object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="text-white font-medium">{item.description}</div>
                          <div className="text-gray-400 text-sm">
                            {item.weightOz} oz • {item.purity} • {item.metalType}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-amber-400 font-bold">${spotValue.toFixed(2)}</div>
                          <div className={`text-xs ${gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {gain >= 0 ? '+' : ''}${gain.toFixed(2)}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveToInventory([item.id]);
                          }}
                          className="text-gray-500 hover:text-red-400 p-2"
                          title="Move back to inventory"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Add to Stash View */}
          <div className="p-4">
            <div className="bg-gray-800 rounded-lg mb-4">
              <div className="p-3 border-b border-gray-700">
                <h3 className="text-white font-bold">Select Items for Stash</h3>
                <p className="text-gray-400 text-sm">Choose items to move to your personal collection</p>
              </div>
              
              {/* Search */}
              <div className="p-3 border-b border-gray-700">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
                  <input
                    type="text"
                    placeholder="Search inventory..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg"
                  />
                </div>
              </div>
              
              {/* Available Items */}
              <div className="max-h-96 overflow-y-auto">
                {filteredAvailable.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    No available items to add
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {filteredAvailable.map(item => {
                      const isSelected = selectedItems.includes(item.id);
                      const spotValue = calculateMetalValue(item);
                      return (
                        <div 
                          key={item.id}
                          onClick={() => toggleItemSelection(item.id)}
                          className={`p-3 flex items-center gap-3 cursor-pointer ${
                            isSelected ? 'bg-amber-900 bg-opacity-30' : 'hover:bg-gray-700'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'border-amber-500 bg-amber-500' : 'border-gray-500'
                          }`}>
                            {isSelected && <Check size={16} className="text-white" />}
                          </div>
                          {item.photo && (
                            <img 
                              src={`data:image/jpeg;base64,${item.photo}`} 
                              className="w-10 h-10 rounded object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <div className="text-white font-medium">{item.description}</div>
                            <div className="text-gray-400 text-sm">
                              {item.id} • {item.metalType} • {item.purity}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-amber-400">${spotValue.toFixed(2)}</div>
                            <div className="text-gray-500 text-xs">Cost: ${item.purchasePrice}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            {/* Selection Summary & Action */}
            {selectedItems.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white">
                    {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
                  </span>
                  <span className="text-amber-400 font-bold">
                    ${filteredAvailable
                      .filter(i => selectedItems.includes(i.id))
                      .reduce((sum, i) => sum + calculateMetalValue(i), 0)
                      .toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={handleMoveToStash}
                  className="w-full bg-amber-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <Star size={20} /> Move to Personal Stash
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============ COIN REFERENCE TABLE ============
const coinReference = {
  // Silver Coins - 90% (0.900 fine) - PERCENTAGE PRICING (melt-based)
  // buyPercent = what % of melt you're willing to pay (editable in settings)
  'morgan-dollar': { name: 'Morgan Dollar', metal: 'Silver', purity: 0.90, aswOz: 0.7234, years: '1878-1921', pricingMode: 'percentage', buyPercent: 70, premiums: { cull: 2, ag: 3, vg: 5, fine: 8, vf: 12, xf: 18, au: 30, bu: 35 } },
  'peace-dollar': { name: 'Peace Dollar', metal: 'Silver', purity: 0.90, aswOz: 0.7234, years: '1921-1935', pricingMode: 'percentage', buyPercent: 70, premiums: { cull: 1, ag: 2, vg: 3, fine: 4, vf: 6, xf: 10, au: 18, bu: 22 } },
  'walking-liberty-half': { name: 'Walking Liberty Half', metal: 'Silver', purity: 0.90, aswOz: 0.3617, years: '1916-1947', pricingMode: 'percentage', buyPercent: 70, premiums: { cull: 0.25, ag: 0.50, vg: 0.75, fine: 1, vf: 1.50, xf: 3, au: 6, bu: 10 } },
  'franklin-half': { name: 'Franklin Half', metal: 'Silver', purity: 0.90, aswOz: 0.3617, years: '1948-1963', pricingMode: 'percentage', buyPercent: 70, premiums: { cull: 0, ag: 0.25, vg: 0.50, fine: 0.75, vf: 1, xf: 2, au: 4, bu: 6 } },
  'kennedy-half-90': { name: 'Kennedy Half (90%)', metal: 'Silver', purity: 0.90, aswOz: 0.3617, years: '1964', pricingMode: 'percentage', buyPercent: 70, premiums: { cull: 0, ag: 0, vg: 0.25, fine: 0.50, vf: 0.75, xf: 1, au: 2, bu: 3 } },
  'washington-quarter': { name: 'Washington Quarter', metal: 'Silver', purity: 0.90, aswOz: 0.1808, years: '1932-1964', pricingMode: 'percentage', buyPercent: 70, premiums: { cull: 0, ag: 0, vg: 0, fine: 0.10, vf: 0.25, xf: 0.50, au: 1, bu: 2 } },
  'standing-liberty-quarter': { name: 'Standing Liberty Quarter', metal: 'Silver', purity: 0.90, aswOz: 0.1808, years: '1916-1930', pricingMode: 'percentage', buyPercent: 70, premiums: { cull: 0.25, ag: 0.50, vg: 1, fine: 2, vf: 4, xf: 8, au: 15, bu: 25 } },
  'barber-quarter': { name: 'Barber Quarter', metal: 'Silver', purity: 0.90, aswOz: 0.1808, years: '1892-1916', pricingMode: 'percentage', buyPercent: 70, premiums: { cull: 0.50, ag: 1, vg: 2, fine: 4, vf: 8, xf: 15, au: 25, bu: 40 } },
  'roosevelt-dime': { name: 'Roosevelt Dime', metal: 'Silver', purity: 0.90, aswOz: 0.0723, years: '1946-1964', pricingMode: 'percentage', buyPercent: 70, premiums: { cull: 0, ag: 0, vg: 0, fine: 0, vf: 0, xf: 0.10, au: 0.25, bu: 0.50 } },
  'mercury-dime': { name: 'Mercury Dime', metal: 'Silver', purity: 0.90, aswOz: 0.0723, years: '1916-1945', pricingMode: 'percentage', buyPercent: 70, premiums: { cull: 0, ag: 0.05, vg: 0.10, fine: 0.15, vf: 0.25, xf: 0.50, au: 1, bu: 2 } },
  'barber-dime': { name: 'Barber Dime', metal: 'Silver', purity: 0.90, aswOz: 0.0723, years: '1892-1916', pricingMode: 'percentage', buyPercent: 70, premiums: { cull: 0.25, ag: 0.50, vg: 1, fine: 2, vf: 4, xf: 8, au: 15, bu: 25 } },
  'war-nickel': { name: 'War Nickel (35%)', metal: 'Silver', purity: 0.35, aswOz: 0.0563, years: '1942-1945', pricingMode: 'percentage', buyPercent: 70, premiums: { cull: 0, ag: 0, vg: 0, fine: 0.05, vf: 0.10, xf: 0.25, au: 0.50, bu: 1 } },
  'junk-silver-lot': { name: '90% Junk Silver (per $1 face)', metal: 'Silver', purity: 0.90, aswOz: 0.715, years: 'Pre-1965', pricingMode: 'percentage', buyPercent: 70, premiums: { avg: 0 } },
  
  // Silver Bullion - FIXED PREMIUM PRICING (spot + $X)
  'silver-eagle': { 
    name: 'Silver Eagle', 
    metal: 'Silver', 
    purity: 0.999, 
    aswOz: 1.0, 
    years: '1986-present', 
    pricingMode: 'fixed', // Buy at spot + buyModifier
    buyModifiers: { bu: 2, proof: 4, ms69: 3, ms70: 8, pf69: 5, pf70: 12 },
    retailPremiums: { bu: 4, proof: 8, ms69: 6, ms70: 15, pf69: 10, pf70: 25 }
  },
  'canadian-maple-silver': { 
    name: 'Canadian Maple (Silver)', 
    metal: 'Silver', 
    purity: 0.9999, 
    aswOz: 1.0, 
    years: '1988-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 1.50, proof: 3, ms69: 2.50, ms70: 6 },
    retailPremiums: { bu: 3, proof: 6, ms69: 5, ms70: 12 }
  },
  'generic-round': { 
    name: 'Generic Silver Round', 
    metal: 'Silver', 
    purity: 0.999, 
    aswOz: 1.0, 
    years: 'Various', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 0.50 },
    retailPremiums: { bu: 1.50 }
  },
  'generic-bar-1oz': { 
    name: 'Generic Silver Bar (1oz)', 
    metal: 'Silver', 
    purity: 0.999, 
    aswOz: 1.0, 
    years: 'Various', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 0.50 },
    retailPremiums: { bu: 1.50 }
  },
  'generic-bar-10oz': { 
    name: 'Generic Silver Bar (10oz)', 
    metal: 'Silver', 
    purity: 0.999, 
    aswOz: 10.0, 
    years: 'Various', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 3 }, // $3 over spot for 10oz
    retailPremiums: { bu: 8 }
  },
  'generic-bar-100oz': { 
    name: 'Generic Silver Bar (100oz)', 
    metal: 'Silver', 
    purity: 0.999, 
    aswOz: 100.0, 
    years: 'Various', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 20 }, // $20 over spot for 100oz
    retailPremiums: { bu: 50 }
  },
  'austrian-philharmonic-silver': { 
    name: 'Austrian Philharmonic (Silver)', 
    metal: 'Silver', 
    purity: 0.999, 
    aswOz: 1.0, 
    years: '2008-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 1.50, proof: 3 },
    retailPremiums: { bu: 3, proof: 6 }
  },
  'britannia-silver': { 
    name: 'Britannia (Silver)', 
    metal: 'Silver', 
    purity: 0.999, 
    aswOz: 1.0, 
    years: '1997-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 1.75, proof: 3.50 },
    retailPremiums: { bu: 3.50, proof: 7 }
  },
  
  // Gold Coins - US - FIXED PREMIUM PRICING
  'gold-eagle-1oz': { 
    name: 'Gold Eagle 1oz', 
    metal: 'Gold', 
    purity: 0.9167, 
    agwOz: 1.0, 
    years: '1986-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 50, proof: 80, ms69: 60, ms70: 150, pf69: 100, pf70: 200 },
    retailPremiums: { bu: 80, proof: 130, ms69: 100, ms70: 250, pf69: 160, pf70: 350 }
  },
  'gold-eagle-half': { 
    name: 'Gold Eagle 1/2oz', 
    metal: 'Gold', 
    purity: 0.9167, 
    agwOz: 0.5, 
    years: '1986-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 35, proof: 50, ms69: 40, ms70: 90 },
    retailPremiums: { bu: 55, proof: 80, ms69: 70, ms70: 150 }
  },
  'gold-eagle-quarter': { 
    name: 'Gold Eagle 1/4oz', 
    metal: 'Gold', 
    purity: 0.9167, 
    agwOz: 0.25, 
    years: '1986-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 25, proof: 40, ms69: 30, ms70: 60 },
    retailPremiums: { bu: 40, proof: 60, ms69: 50, ms70: 100 }
  },
  'gold-eagle-tenth': { 
    name: 'Gold Eagle 1/10oz', 
    metal: 'Gold', 
    purity: 0.9167, 
    agwOz: 0.1, 
    years: '1986-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 18, proof: 30, ms69: 22, ms70: 45 },
    retailPremiums: { bu: 28, proof: 45, ms69: 35, ms70: 75 }
  },
  'gold-buffalo': { 
    name: 'Gold Buffalo 1oz', 
    metal: 'Gold', 
    purity: 0.9999, 
    agwOz: 1.0, 
    years: '2006-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 60, proof: 100, ms69: 75, ms70: 175 },
    retailPremiums: { bu: 95, proof: 160, ms69: 125, ms70: 300 }
  },
  'canadian-maple-gold': { 
    name: 'Canadian Maple (Gold)', 
    metal: 'Gold', 
    purity: 0.9999, 
    agwOz: 1.0, 
    years: '1979-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 45, proof: 75, ms69: 55, ms70: 130 },
    retailPremiums: { bu: 70, proof: 120, ms69: 90, ms70: 220 }
  },
  'krugerrand': { 
    name: 'Krugerrand 1oz', 
    metal: 'Gold', 
    purity: 0.9167, 
    agwOz: 1.0, 
    years: '1967-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 40, proof: 70 },
    retailPremiums: { bu: 65, proof: 110 }
  },
  'mexican-50-peso': { 
    name: 'Mexican 50 Peso', 
    metal: 'Gold', 
    purity: 0.900, 
    agwOz: 1.2057, 
    years: '1921-1947', 
    pricingMode: 'fixed',
    buyModifiers: { au: 30, bu: 45 },
    retailPremiums: { au: 50, bu: 75 }
  },
  'austrian-philharmonic-gold': { 
    name: 'Austrian Philharmonic (Gold)', 
    metal: 'Gold', 
    purity: 0.9999, 
    agwOz: 1.0, 
    years: '1989-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 45, proof: 75 },
    retailPremiums: { bu: 70, proof: 120 }
  },
  'britannia-gold': { 
    name: 'Britannia (Gold)', 
    metal: 'Gold', 
    purity: 0.9999, 
    agwOz: 1.0, 
    years: '1987-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 50, proof: 80 },
    retailPremiums: { bu: 80, proof: 130 }
  },
  
  // Pre-1933 US Gold - PERCENTAGE PRICING (numismatic)
  'st-gaudens-20': { name: 'St. Gaudens $20', metal: 'Gold', purity: 0.900, agwOz: 0.9675, years: '1907-1933', pricingMode: 'percentage', premiums: { vf: 80, xf: 100, au: 130, bu: 180, ms60: 180, ms63: 300, ms64: 450, ms65: 800 } },
  'liberty-20': { name: 'Liberty $20', metal: 'Gold', purity: 0.900, agwOz: 0.9675, years: '1850-1907', pricingMode: 'percentage', premiums: { vf: 90, xf: 120, au: 160, bu: 220, ms60: 220, ms63: 400, ms64: 650, ms65: 1200 } },
  'indian-10': { name: 'Indian $10', metal: 'Gold', purity: 0.900, agwOz: 0.4838, years: '1907-1933', pricingMode: 'percentage', premiums: { vf: 50, xf: 75, au: 100, bu: 150, ms60: 150, ms63: 250, ms64: 400, ms65: 700 } },
  'liberty-10': { name: 'Liberty $10', metal: 'Gold', purity: 0.900, agwOz: 0.4838, years: '1838-1907', pricingMode: 'percentage', premiums: { vf: 45, xf: 65, au: 90, bu: 140, ms60: 140, ms63: 220, ms64: 350, ms65: 600 } },
  'indian-5': { name: 'Indian $5 Half Eagle', metal: 'Gold', purity: 0.900, agwOz: 0.2419, years: '1908-1929', pricingMode: 'percentage', premiums: { vf: 35, xf: 50, au: 70, bu: 100, ms60: 100, ms63: 180, ms64: 280, ms65: 500 } },
  'liberty-5': { name: 'Liberty $5 Half Eagle', metal: 'Gold', purity: 0.900, agwOz: 0.2419, years: '1839-1908', pricingMode: 'percentage', premiums: { vf: 30, xf: 45, au: 65, bu: 95, ms60: 95, ms63: 160, ms64: 250, ms65: 450 } },
  'indian-quarter-eagle': { name: 'Indian $2.50', metal: 'Gold', purity: 0.900, agwOz: 0.1209, years: '1908-1929', pricingMode: 'percentage', premiums: { vf: 30, xf: 50, au: 80, bu: 120, ms60: 120, ms63: 200, ms64: 320, ms65: 550 } },
  'liberty-quarter-eagle': { name: 'Liberty $2.50', metal: 'Gold', purity: 0.900, agwOz: 0.1209, years: '1840-1907', pricingMode: 'percentage', premiums: { vf: 35, xf: 60, au: 100, bu: 150, ms60: 150, ms63: 250, ms64: 400, ms65: 700 } },
  'gold-dollar': { name: 'Gold Dollar', metal: 'Gold', purity: 0.900, agwOz: 0.04837, years: '1849-1889', pricingMode: 'percentage', premiums: { vf: 50, xf: 80, au: 120, bu: 180, ms60: 180, ms63: 300, ms64: 450, ms65: 800 } },
  
  // Platinum - FIXED PREMIUM PRICING
  'platinum-eagle-1oz': { 
    name: 'Platinum Eagle 1oz', 
    metal: 'Platinum', 
    purity: 0.9995, 
    apwOz: 1.0, 
    years: '1997-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 40, proof: 70, ms69: 50, ms70: 120 },
    retailPremiums: { bu: 65, proof: 110, ms69: 85, ms70: 200 }
  },
  'canadian-maple-platinum': { 
    name: 'Canadian Maple (Platinum)', 
    metal: 'Platinum', 
    purity: 0.9995, 
    apwOz: 1.0, 
    years: '1988-present', 
    pricingMode: 'fixed',
    buyModifiers: { bu: 35, proof: 60 },
    retailPremiums: { bu: 55, proof: 95 }
  },
};

const gradeOptions = [
  // Circulated grades
  { value: 'cull', label: 'Cull/Damaged', category: 'circulated' },
  { value: 'ag', label: 'AG-3 (About Good)', category: 'circulated' },
  { value: 'g', label: 'G-4/6 (Good)', category: 'circulated' },
  { value: 'vg', label: 'VG-8/10 (Very Good)', category: 'circulated' },
  { value: 'fine', label: 'F-12/15 (Fine)', category: 'circulated' },
  { value: 'vf', label: 'VF-20/35 (Very Fine)', category: 'circulated' },
  { value: 'xf', label: 'XF-40/45 (Extremely Fine)', category: 'circulated' },
  { value: 'au', label: 'AU-50/58 (About Unc)', category: 'circulated' },
  // Uncirculated - default for numismatic
  { value: 'bu', label: 'BU (Brilliant Unc)', category: 'uncirculated', isDefault: true },
  { value: 'ms60', label: 'MS-60', category: 'mint-state' },
  { value: 'ms61', label: 'MS-61', category: 'mint-state' },
  { value: 'ms62', label: 'MS-62', category: 'mint-state' },
  { value: 'ms63', label: 'MS-63', category: 'mint-state' },
  { value: 'ms64', label: 'MS-64', category: 'mint-state' },
  { value: 'ms65', label: 'MS-65 (Gem)', category: 'mint-state' },
  { value: 'ms66', label: 'MS-66', category: 'mint-state' },
  { value: 'ms67', label: 'MS-67 (Superb Gem)', category: 'mint-state' },
  { value: 'ms68', label: 'MS-68', category: 'mint-state' },
  { value: 'ms69', label: 'MS-69 (Near Perfect)', category: 'mint-state' },
  { value: 'ms70', label: 'MS-70 (Perfect)', category: 'mint-state' },
  // Proof grades
  { value: 'proof', label: 'Proof (Ungraded)', category: 'proof' },
  { value: 'pf60', label: 'PF-60', category: 'proof' },
  { value: 'pf63', label: 'PF-63', category: 'proof' },
  { value: 'pf64', label: 'PF-64', category: 'proof' },
  { value: 'pf65', label: 'PF-65 (Gem Proof)', category: 'proof' },
  { value: 'pf66', label: 'PF-66', category: 'proof' },
  { value: 'pf67', label: 'PF-67', category: 'proof' },
  { value: 'pf68', label: 'PF-68', category: 'proof' },
  { value: 'pf69', label: 'PF-69 (Near Perfect)', category: 'proof' },
  { value: 'pf70', label: 'PF-70 (Perfect Proof)', category: 'proof' },
  // Special designations
  { value: 'avg', label: 'Average Circulated', category: 'bulk' },
];

// Premium multipliers for graded coins (relative to BU base)
const gradedPremiumMultipliers = {
  // MS grades - exponential increase
  'ms60': 1.0,
  'ms61': 1.1,
  'ms62': 1.25,
  'ms63': 1.5,
  'ms64': 2.0,
  'ms65': 3.0,
  'ms66': 5.0,
  'ms67': 10.0,
  'ms68': 25.0,
  'ms69': 75.0,
  'ms70': 200.0,
  // PF grades
  'pf60': 1.0,
  'pf63': 1.3,
  'pf64': 1.6,
  'pf65': 2.0,
  'pf66': 3.0,
  'pf67': 5.0,
  'pf68': 10.0,
  'pf69': 30.0,
  'pf70': 100.0,
};

// ============ APPRAISAL SESSION VIEW ============
function AppraisalSessionView({ clients, spotPrices, buyPercentages, coinBuyPercents, onComplete, onCancel }) {
  const [sessionClient, setSessionClient] = useState(null);
  const [sessionItems, setSessionItems] = useState([]);
  const [currentView, setCurrentView] = useState('setup'); // setup, evaluate, review, offer, complete
  const [evaluatingItem, setEvaluatingItem] = useState(null);
  const [showCoinPicker, setShowCoinPicker] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({ name: '', type: 'Private', phone: '', notes: '' });
  const [bulkDiscount, setBulkDiscount] = useState('');
  const [discountMethod, setDiscountMethod] = useState('proportional');
  const [sessionNotes, setSessionNotes] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [apiError, setApiError] = useState(null);
  
  // Two-photo capture state
  const [captureStep, setCaptureStep] = useState('idle'); // idle, front, back
  const [frontPhoto, setFrontPhoto] = useState(null);
  const [backPhoto, setBackPhoto] = useState(null);
  
  const cameraRef = useRef(null);
  const photoInputRef = useRef(null);
  
  // Calculate totals
  const totalOffer = sessionItems.reduce((sum, item) => sum + item.buyPrice, 0);
  const discountAmount = parseFloat(bulkDiscount) || 0;
  const finalOffer = totalOffer - discountAmount;
  
  // Calculate value for a coin from reference
  const calculateCoinValue = (coinKey, grade, quantity = 1) => {
    const coin = coinReference[coinKey];
    if (!coin) return null;
    
    const spot = spotPrices[coin.metal.toLowerCase()] || 0;
    const metalWeight = coin.aswOz || coin.agwOz || coin.apwOz || 0;
    const meltValue = metalWeight * spot;
    const spotValue = meltValue; // What the pure metal is worth
    
    let buyPrice, marketValue, premium, isGraded, pricingMode;
    pricingMode = coin.pricingMode || 'percentage';
    
    if (pricingMode === 'fixed') {
      // BULLION MODE: Spot + fixed dollar amount
      // Get buy modifier for this grade (what we pay over spot)
      let buyModifier = coin.buyModifiers?.[grade] ?? coin.buyModifiers?.['bu'] ?? 0;
      let retailPremium = coin.retailPremiums?.[grade] ?? coin.retailPremiums?.['bu'] ?? 0;
      
      // Handle graded versions (ms69, ms70, pf69, pf70)
      if (grade.startsWith('ms') || grade.startsWith('pf')) {
        const gradeNum = parseInt(grade.replace(/[^\d]/g, ''));
        if (gradeNum >= 69) {
          isGraded = true;
          // Use specific graded modifiers if available
          if (coin.buyModifiers?.[grade]) {
            buyModifier = coin.buyModifiers[grade];
            retailPremium = coin.retailPremiums?.[grade] || buyModifier * 1.6;
          } else {
            // Estimate based on grade
            const baseModifier = coin.buyModifiers?.['bu'] || 0;
            buyModifier = gradeNum === 69 ? baseModifier * 1.2 : baseModifier * 2.5;
            retailPremium = buyModifier * 1.6;
          }
        }
      }
      
      buyPrice = spotValue + buyModifier;
      marketValue = spotValue + retailPremium;
      premium = buyModifier; // In fixed mode, "premium" is the $ over spot
      
      return {
        coin,
        meltValue: meltValue * quantity,
        spotValue: spotValue * quantity,
        premium: premium * quantity,
        marketValue: marketValue * quantity,
        buyPrice: buyPrice * quantity,
        buyModifier,
        retailPremium,
        quantity,
        isGraded,
        pricingMode: 'fixed',
        pricingLabel: `Spot + $${buyModifier.toFixed(2)}`
      };
      
    } else {
      // NUMISMATIC MODE: (Melt + premium) × buy percentage
      // Get base premium - use 'bu' as base for graded coins
      premium = 0;
      isGraded = false;
      
      if (coin.premiums?.[grade] !== undefined) {
        // Direct match in reference table
        premium = coin.premiums[grade];
      } else if (gradedPremiumMultipliers[grade] && coin.premiums?.['bu']) {
        // Graded coin - apply multiplier to BU premium
        isGraded = true;
        const buPremium = coin.premiums['bu'] || coin.premiums['ms60'] || 0;
        premium = buPremium * gradedPremiumMultipliers[grade];
      } else if (grade.startsWith('ms') || grade.startsWith('pf')) {
        // Fallback for graded without BU reference
        isGraded = true;
        const basePremium = coin.premiums?.['au'] || coin.premiums?.['xf'] || 5;
        premium = basePremium * (gradedPremiumMultipliers[grade] || 1);
      } else {
        // Use closest available grade
        premium = coin.premiums?.['vf'] || coin.premiums?.['fine'] || 0;
      }
      
      marketValue = meltValue + premium;
      
      // Use coin-specific buy percent if available, otherwise fall back to metal-based
      const coinSpecificPercent = coinBuyPercents?.[coinKey] ?? coin.buyPercent;
      const baseBuyPercent = coinSpecificPercent ?? buyPercentages[coin.metal.toLowerCase()] ?? 70;
      
      // Graded coins often command higher buy percentages (closer to market)
      const adjustedBuyPercent = isGraded ? Math.min(100, baseBuyPercent + 5) : baseBuyPercent;
      buyPrice = marketValue * (adjustedBuyPercent / 100);
      
      return {
        coin,
        meltValue: meltValue * quantity,
        spotValue: spotValue * quantity,
        premium: premium * quantity,
        marketValue: marketValue * quantity,
        buyPrice: buyPrice * quantity,
        buyPercent: adjustedBuyPercent,
        quantity,
        isGraded,
        pricingMode: 'percentage',
        pricingLabel: `${adjustedBuyPercent}% of market`
      };
    }
  };
  
  // AI Photo Analysis
  const analyzePhoto = async (photoBase64) => {
    setAnalyzing(true);
    
    try {
      // Use the AI Vision Service
      const analysis = await AIVisionService.analyzeImage(photoBase64);
      
      setAnalyzing(false);
      
      // Check if this is not a precious metal item
      if (analysis.notPreciousMetal || analysis.isPreciousMetal === false) {
        return {
          photo: photoBase64,
          description: analysis.type || 'Non-Precious Metal Item',
          notPreciousMetal: true,
          needsManualEntry: false,
          confidence: analysis.confidence || 0.95,
          notes: analysis.notes || 'This item is not a precious metal and cannot be appraised for metal value.'
        };
      }
      
      // Check if manual entry is needed
      if (analysis.needsManualEntry) {
        return {
          photo: photoBase64,
          description: analysis.type || 'Unknown Item',
          needsManualEntry: true,
          confidence: 0,
          notes: analysis.notes
        };
      }
      
      return {
        coinKey: analysis.coinKey,
        grade: analysis.grade || 'bu',
        description: analysis.type || 'Unknown Item',
        year: analysis.year,
        mint: analysis.mintMark,
        metal: analysis.metal,
        purity: analysis.purity,
        photo: photoBase64,
        confidence: analysis.confidence || 0.5,
        notes: analysis.notes
      };
    } catch (error) {
      console.error('AI analysis error:', error);
      setAnalyzing(false);
      
      // Return a basic result requiring manual entry
      return {
        photo: photoBase64,
        description: 'Unknown Item',
        needsManualEntry: true,
        confidence: 0
      };
    }
  };
  
  // Handle photo capture - supports both single and two-photo mode
  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result.split(',')[1];
      
      console.log('Photo captured, captureStep:', captureStep, 'frontPhoto exists:', !!frontPhoto);
      
      // Two-photo flow for coins
      if (captureStep === 'front') {
        console.log('Setting front photo, switching to back step');
        setFrontPhoto(base64);
        setCaptureStep('back');
        // Reset the input so the same file can be selected again
        if (e.target) e.target.value = '';
        return;
      }
      
      if (captureStep === 'back' && frontPhoto) {
        console.log('Got back photo, analyzing both...');
        const savedFrontPhoto = frontPhoto; // Save before async operation
        setBackPhoto(base64);
        setCaptureStep('idle');
        setFrontPhoto(null); // Clear early
        setBackPhoto(null);
        
        // Now analyze both photos together
        setAnalyzing(true);
        setApiError(null);
        
        try {
          const analysis = await analyzePhotoPair(savedFrontPhoto, base64);
          console.log('Analysis result:', analysis);
          
          if (analysis.apiError) {
            setApiError(analysis.apiError);
          }
          
          // Handle non-precious metal items
          if (analysis.notPreciousMetal) {
            setEvaluatingItem({
              id: `eval-${Date.now()}`,
              photo: savedFrontPhoto,
              photoBack: base64,
              description: analysis.description,
              notPreciousMetal: true,
              notes: analysis.notes
            });
            setAnalyzing(false);
            return;
          }
          
          if (analysis.coinKey && coinReference[analysis.coinKey]) {
            const valuation = calculateCoinValue(analysis.coinKey, analysis.grade, 1);
            console.log('Coin identified:', analysis.coinKey, 'Valuation:', valuation);
            setEvaluatingItem({
              ...analysis,
              ...valuation,
              id: `eval-${Date.now()}`,
              photo: savedFrontPhoto,
              photoBack: base64
            });
          } else if (analysis.isPreciousMetal !== false && (analysis.metal || analysis.type)) {
            // Coin identified but not in our reference - show with basic info
            console.log('PM item identified but not in reference:', analysis);
            setEvaluatingItem({
              id: `eval-${Date.now()}`,
              photo: savedFrontPhoto,
              photoBack: base64,
              description: analysis.type || analysis.description || 'Precious Metal Item',
              coinKey: analysis.coinKey,
              grade: analysis.grade || 'vf',
              year: analysis.year,
              mint: analysis.mintMark,
              metal: analysis.metal,
              purity: analysis.purity,
              confidence: analysis.confidence,
              notes: analysis.notes,
              needsManualEntry: true, // Let them look up eBay prices
              apiError: analysis.coinKey ? `Coin "${analysis.coinKey}" not in reference database` : null
            });
            setShowManualEntry(true);
          } else {
            // Unknown item - show manual entry
            console.log('Unknown item, showing manual entry');
            setEvaluatingItem({
              id: `eval-${Date.now()}`,
              photo: savedFrontPhoto,
              photoBack: base64,
              description: analysis.description || analysis.type || 'Unknown Item',
              needsManualEntry: true,
              metal: analysis.metal,
              purity: analysis.purity,
              notes: analysis.notes,
              apiError: analysis.apiError
            });
            setShowManualEntry(true);
          }
          
          setAnalyzing(false);
        } catch (error) {
          console.error('Analysis error:', error);
          setApiError('Failed to analyze images: ' + error.message);
          setAnalyzing(false);
          setCaptureStep('idle');
        }
        return;
      }
      
      // Single photo mode (original behavior) - for quick adds or when not in two-photo flow
      console.log('Single photo mode');
      setApiError(null);
      setAnalyzing(true);
      const analysis = await analyzePhoto(base64);
      setAnalyzing(false);
      
      if (analysis.apiError) {
        setApiError(analysis.apiError);
      }
      
      if (analysis.notPreciousMetal) {
        setEvaluatingItem({
          id: `eval-${Date.now()}`,
          photo: base64,
          description: analysis.description,
          notPreciousMetal: true,
          notes: analysis.notes
        });
        return;
      }
      
      if (analysis.coinKey && coinReference[analysis.coinKey]) {
        const valuation = calculateCoinValue(analysis.coinKey, analysis.grade, 1);
        setEvaluatingItem({
          ...analysis,
          ...valuation,
          id: `eval-${Date.now()}`,
          photo: base64
        });
      } else {
        setEvaluatingItem({
          id: `eval-${Date.now()}`,
          photo: base64,
          description: analysis.description || 'Unknown Item',
          needsManualEntry: true,
          metal: analysis.metal,
          purity: analysis.purity,
          notes: analysis.notes,
          apiError: analysis.apiError
        });
        setShowManualEntry(true);
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Analyze a pair of photos (front and back)
  const analyzePhotoPair = async (frontBase64, backBase64) => {
    try {
      const analysis = await AIVisionService.analyzeImagePair(frontBase64, backBase64);
      
      if (analysis.notPreciousMetal || analysis.isPreciousMetal === false) {
        return {
          description: analysis.type || 'Non-Precious Metal Item',
          notPreciousMetal: true,
          notes: analysis.notes || 'This item is not a precious metal.'
        };
      }
      
      if (analysis.needsManualEntry) {
        return {
          description: analysis.type || 'Unknown Item',
          needsManualEntry: true,
          notes: analysis.notes
        };
      }
      
      return {
        coinKey: analysis.coinKey,
        grade: analysis.grade || 'vf',
        description: analysis.type || 'Unknown Item',
        year: analysis.year,
        mint: analysis.mintMark,
        metal: analysis.metal,
        purity: analysis.purity,
        confidence: analysis.confidence || 0.5,
        notes: analysis.notes
      };
    } catch (error) {
      console.error('AI analysis error:', error);
      return {
        description: 'Unknown Item',
        needsManualEntry: true,
        apiError: error.message
      };
    }
  };
  
  // Add item to session
  const addToOffer = (item) => {
    setSessionItems([...sessionItems, {
      ...item,
      addedAt: new Date().toISOString()
    }]);
    setEvaluatingItem(null);
  };
  
  // Remove item from session
  const removeFromOffer = (itemId) => {
    setSessionItems(sessionItems.filter(i => i.id !== itemId));
  };
  
  // Update item quantity
  const updateItemQuantity = (itemId, quantity) => {
    setSessionItems(sessionItems.map(item => {
      if (item.id !== itemId) return item;
      const newQty = Math.max(1, parseInt(quantity) || 1);
      const valuation = calculateCoinValue(item.coinKey, item.grade, newQty);
      return { ...item, ...valuation, quantity: newQty };
    }));
  };
  
  // Update item price manually
  const updateItemPrice = (itemId, newPrice) => {
    setSessionItems(sessionItems.map(item => 
      item.id === itemId ? { ...item, buyPrice: parseFloat(newPrice) || 0 } : item
    ));
  };
  
  // Manual coin selection
  const handleManualCoinSelect = (coinKey, grade, quantity) => {
    const valuation = calculateCoinValue(coinKey, grade, quantity);
    if (valuation) {
      const coin = coinReference[coinKey];
      setEvaluatingItem({
        id: `eval-${Date.now()}`,
        coinKey,
        grade,
        description: coin.name,
        photo: evaluatingItem?.photo || null,
        ...valuation
      });
    }
    setShowCoinPicker(false);
  };
  
  // Complete session - create inventory items
  const handleCompleteSession = () => {
    const inventoryItems = sessionItems.map((item, index) => {
      // Apply discount proportionally if set
      let adjustedPrice = item.buyPrice;
      if (discountAmount > 0 && discountMethod === 'proportional') {
        const proportion = item.buyPrice / totalOffer;
        adjustedPrice = item.buyPrice - (discountAmount * proportion);
      }
      
      const coin = item.coinKey ? coinReference[item.coinKey] : null;
      
      return {
        description: item.description + (item.year ? ` ${item.year}` : '') + (item.mint ? `-${item.mint}` : ''),
        category: coin?.metal === 'Gold' ? 'Coins - Gold' : coin?.metal === 'Platinum' ? 'Platinum' : 'Coins - Silver',
        metalType: coin?.metal || 'Silver',
        purity: coin ? `${(coin.purity * 100).toFixed(0)}%` : '90%',
        weightOz: coin?.aswOz || coin?.agwOz || coin?.apwOz || 0,
        purchasePrice: Math.round(adjustedPrice * 100) / 100,
        meltValue: Math.round((item.meltValue || 0) * 100) / 100,
        photo: item.photo,
        photoBack: item.photoBack,
        grade: item.grade,
        year: item.year,
        mint: item.mint,
        quantity: item.quantity || 1
      };
    });
    
    onComplete({
      client: sessionClient,
      items: inventoryItems,
      totalPaid: finalOffer,
      discount: discountAmount,
      notes: sessionNotes,
      sessionDate: new Date().toISOString()
    });
  };
  
  // ============ SETUP VIEW ============
  if (currentView === 'setup') {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-4">
          <div className="flex items-center justify-between">
            <button onClick={onCancel}>Cancel</button>
            <h1 className="text-xl font-bold">New Appraisal Session</h1>
            <div className="w-16"></div>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-800 mb-3">Select Client</h3>
            <p className="text-sm text-gray-500 mb-3">Who are you evaluating items for?</p>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {clients.map(client => (
                <button
                  key={client.id}
                  onClick={() => setSessionClient(client)}
                  className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 ${
                    sessionClient?.id === client.id ? 'border-teal-500 bg-teal-50' : 'border-gray-200'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    client.type === 'Business' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {client.type === 'Business' ? <Building size={20} /> : <User size={20} />}
                  </div>
                  <div>
                    <div className="font-medium">{client.name}</div>
                    <div className="text-sm text-gray-500">{client.type}</div>
                  </div>
                  {sessionClient?.id === client.id && (
                    <Check className="ml-auto text-teal-600" size={20} />
                  )}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setShowNewClientForm(true)}
              className="w-full mt-3 border-2 border-dashed border-gray-300 rounded-lg p-3 text-gray-500 flex items-center justify-center gap-2 hover:border-teal-400 hover:text-teal-600 transition-colors"
            >
              <UserPlus size={18} /> Add New Client
            </button>
            
            {/* New Client Form Modal */}
            {showNewClientForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full p-4">
                  <h3 className="font-bold text-lg mb-4">Add New Client</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name *</label>
                      <input
                        type="text"
                        value={newClientData.name}
                        onChange={(e) => setNewClientData({...newClientData, name: e.target.value})}
                        className="w-full border rounded p-2"
                        placeholder="Client name"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Type</label>
                      <select
                        value={newClientData.type}
                        onChange={(e) => setNewClientData({...newClientData, type: e.target.value})}
                        className="w-full border rounded p-2 bg-white"
                      >
                        <option value="Private">Private Individual</option>
                        <option value="Business">Business</option>
                        <option value="Estate">Estate</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone</label>
                      <input
                        type="tel"
                        value={newClientData.phone}
                        onChange={(e) => setNewClientData({...newClientData, phone: e.target.value})}
                        className="w-full border rounded p-2"
                        placeholder="(555) 555-5555"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Notes</label>
                      <textarea
                        value={newClientData.notes}
                        onChange={(e) => setNewClientData({...newClientData, notes: e.target.value})}
                        className="w-full border rounded p-2"
                        rows={2}
                        placeholder="Optional notes..."
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => {
                        setShowNewClientForm(false);
                        setNewClientData({ name: '', type: 'Private', phone: '', notes: '' });
                      }}
                      className="flex-1 py-2 border rounded-lg"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        if (newClientData.name.trim()) {
                          const newClient = {
                            id: `CLI-${Date.now()}`,
                            name: newClientData.name.trim(),
                            type: newClientData.type,
                            phone: newClientData.phone,
                            notes: newClientData.notes,
                            email: '',
                            address: '',
                            idType: '',
                            idNumber: '',
                            dateAdded: new Date().toISOString().split('T')[0],
                            totalTransactions: 0,
                            totalPurchased: 0
                          };
                          // Add to clients list (will be handled by parent)
                          clients.push(newClient);
                          setSessionClient(newClient);
                          setShowNewClientForm(false);
                          setNewClientData({ name: '', type: 'Private', phone: '', notes: '' });
                        }
                      }}
                      disabled={!newClientData.name.trim()}
                      className={`flex-1 py-2 rounded-lg font-medium ${
                        newClientData.name.trim() ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      Add & Select
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={() => sessionClient && setCurrentView('evaluate')}
            disabled={!sessionClient}
            className={`w-full py-4 rounded-lg font-bold text-white ${
              sessionClient ? 'bg-teal-600' : 'bg-gray-300'
            }`}
          >
            Start Evaluating Items
          </button>
        </div>
      </div>
    );
  }
  
  // ============ EVALUATE VIEW ============
  if (currentView === 'evaluate') {
    const handleBackFromEvaluate = () => {
      if (sessionItems.length > 0) {
        if (confirm(`You have ${sessionItems.length} items ($${totalOffer.toFixed(2)}) in this session. Go back and lose these items?`)) {
          setCurrentView('setup');
        }
      } else {
        setCurrentView('setup');
      }
    };
    
    return (
      <div className="min-h-screen bg-gray-900">
        {/* Header with running total */}
        <div className="bg-gray-800 text-white p-3">
          <div className="flex items-center justify-between">
            <button onClick={handleBackFromEvaluate} className="text-gray-300">← Back</button>
            <div className="text-center">
              <div className="text-xs text-gray-400">Session with {sessionClient?.name}</div>
              <div className="font-bold">{sessionItems.length} items • ${totalOffer.toFixed(2)}</div>
            </div>
            <button 
              onClick={() => setCurrentView('review')}
              className="bg-teal-600 px-3 py-1 rounded text-sm"
            >
              Review
            </button>
          </div>
        </div>
        
        {/* Camera / Evaluation Area */}
        <div className="p-4">
          {!evaluatingItem && !analyzing && (
            <div className="space-y-4">
              {/* Two-Photo Capture Flow */}
              {captureStep !== 'idle' ? (
                <div className="bg-gray-800 rounded-xl p-6 text-center">
                  {captureStep === 'front' && (
                    <>
                      <div className="text-teal-400 text-lg font-bold mb-2">Step 1 of 2</div>
                      <Camera size={48} className="mx-auto text-teal-500 mb-4" />
                      <p className="text-white font-medium mb-2">Take photo of FRONT (obverse)</p>
                      <p className="text-gray-400 text-sm mb-4">Show the main design side of the coin</p>
                      
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={photoInputRef}
                        onChange={handlePhotoCapture}
                        className="hidden"
                      />
                      
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        className="w-full bg-teal-600 text-white py-4 rounded-lg font-medium flex items-center justify-center gap-2"
                      >
                        <Camera size={24} /> Capture Front
                      </button>
                      
                      <button
                        onClick={() => setCaptureStep('idle')}
                        className="w-full mt-3 text-gray-400 py-2"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  
                  {captureStep === 'back' && (
                    <>
                      <div className="text-teal-400 text-lg font-bold mb-2">Step 2 of 2</div>
                      
                      {/* Show front photo preview */}
                      {frontPhoto && (
                        <div className="mb-4">
                          <p className="text-gray-400 text-xs mb-2">Front captured ✓</p>
                          <img 
                            src={`data:image/jpeg;base64,${frontPhoto}`} 
                            className="w-24 h-24 mx-auto rounded-lg object-cover border-2 border-teal-500"
                          />
                        </div>
                      )}
                      
                      <Camera size={48} className="mx-auto text-teal-500 mb-4" />
                      <p className="text-white font-medium mb-2">Now take photo of BACK (reverse)</p>
                      <p className="text-gray-400 text-sm mb-4">Flip the coin and capture the other side</p>
                      
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={photoInputRef}
                        onChange={handlePhotoCapture}
                        className="hidden"
                      />
                      
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        className="w-full bg-teal-600 text-white py-4 rounded-lg font-medium flex items-center justify-center gap-2"
                      >
                        <Camera size={24} /> Capture Back
                      </button>
                      
                      <button
                        onClick={() => { setCaptureStep('idle'); setFrontPhoto(null); }}
                        className="w-full mt-3 text-gray-400 py-2"
                      >
                        Start Over
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Capture Options */}
                  <div className="bg-gray-800 rounded-xl p-6 text-center">
                    <Camera size={48} className="mx-auto text-gray-500 mb-4" />
                    <p className="text-gray-400 mb-4">Snap photos to identify and price</p>
                    
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={photoInputRef}
                      onChange={handlePhotoCapture}
                      className="hidden"
                    />
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => setCaptureStep('front')}
                        className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                      >
                        <Camera size={20} /> Snap Coin (2 photos)
                      </button>
                      <button
                        onClick={() => setShowCoinPicker(true)}
                        className="flex-1 bg-gray-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                      >
                        <Search size={20} /> Manual Lookup
                      </button>
                    </div>
                    
                    {/* Single photo option for non-coins */}
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full mt-3 bg-gray-700 text-gray-300 py-2 rounded-lg text-sm"
                    >
                      Quick snap (1 photo) - for bars, jewelry, etc.
                    </button>
                  </div>
              
              {/* Quick Add Common Items */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-gray-400 text-sm font-medium mb-3">Quick Add</h3>
                <div className="grid grid-cols-2 gap-2">
                  {['morgan-dollar', 'peace-dollar', 'walking-liberty-half', 'roosevelt-dime', 'silver-eagle', 'junk-silver-lot'].map(coinKey => {
                    const coin = coinReference[coinKey];
                    return (
                      <button
                        key={coinKey}
                        onClick={() => {
                          setEvaluatingItem({ coinKey, showGradeSelect: true });
                        }}
                        className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded text-sm text-left"
                      >
                        {coin.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Session Items Preview */}
              {sessionItems.length > 0 && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <h3 className="text-gray-400 text-sm font-medium mb-3">Added Items ({sessionItems.length})</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {sessionItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-gray-700 p-2 rounded">
                        <div className="flex items-center gap-2">
                          {item.photo && (
                            <img src={`data:image/jpeg;base64,${item.photo}`} className="w-8 h-8 rounded object-cover" />
                          )}
                          <div>
                            <div className="text-white text-sm">{item.description}</div>
                            <div className="text-gray-400 text-xs">Qty: {item.quantity || 1}</div>
                          </div>
                        </div>
                        <div className="text-teal-400 font-medium">${item.buyPrice.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          )}
          
          {/* Analyzing Spinner */}
          {analyzing && (
            <div className="bg-gray-800 rounded-xl p-8 text-center">
              <Loader className="animate-spin mx-auto text-teal-500 mb-4" size={48} />
              <p className="text-gray-400">Analyzing image...</p>
            </div>
          )}
          
          {/* API Error Banner */}
          {apiError && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <div className="text-red-200 font-medium text-sm">AI Identification Failed</div>
                  <div className="text-red-300 text-xs mt-1">{apiError}</div>
                  <div className="text-red-400 text-xs mt-2">
                    Check that ANTHROPIC_API_KEY is set in Vercel environment variables.
                  </div>
                </div>
                <button onClick={() => setApiError(null)} className="text-red-400 ml-auto">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
          
          {/* Evaluation Result */}
          {evaluatingItem && !analyzing && (
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              {/* Photo */}
              {evaluatingItem.photo && (
                <div className="aspect-video bg-black">
                  <img 
                    src={`data:image/jpeg;base64,${evaluatingItem.photo}`} 
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              
              {/* Grade Selection for Quick Add */}
              {evaluatingItem.showGradeSelect && (
                <div className="p-4">
                  <h3 className="text-white font-bold mb-2">{coinReference[evaluatingItem.coinKey]?.name}</h3>
                  <p className="text-gray-400 text-sm mb-3">Select grade (default: BU):</p>
                  
                  {/* Circulated Grades */}
                  <div className="mb-3">
                    <div className="text-gray-500 text-xs mb-1">CIRCULATED</div>
                    <div className="grid grid-cols-4 gap-1">
                      {gradeOptions.filter(g => g.category === 'circulated').map(gradeOpt => {
                        const hasPrice = coinReference[evaluatingItem.coinKey]?.premiums[gradeOpt.value] !== undefined;
                        return (
                          <button
                            key={gradeOpt.value}
                            onClick={() => {
                              const valuation = calculateCoinValue(evaluatingItem.coinKey, gradeOpt.value, 1);
                              setEvaluatingItem({
                                ...evaluatingItem,
                                ...valuation,
                                grade: gradeOpt.value,
                                description: coinReference[evaluatingItem.coinKey].name,
                                id: `eval-${Date.now()}`,
                                showGradeSelect: false
                              });
                            }}
                            className={`py-2 px-1 rounded text-xs ${hasPrice ? 'bg-gray-700 hover:bg-teal-600 text-white' : 'bg-gray-800 text-gray-500'}`}
                          >
                            {gradeOpt.value.toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Uncirculated / BU - Default */}
                  <div className="mb-3">
                    <div className="text-gray-500 text-xs mb-1">UNCIRCULATED (DEFAULT)</div>
                    <button
                      onClick={() => {
                        const valuation = calculateCoinValue(evaluatingItem.coinKey, 'bu', 1);
                        setEvaluatingItem({
                          ...evaluatingItem,
                          ...valuation,
                          grade: 'bu',
                          description: coinReference[evaluatingItem.coinKey].name,
                          id: `eval-${Date.now()}`,
                          showGradeSelect: false
                        });
                      }}
                      className="w-full py-3 rounded bg-teal-600 hover:bg-teal-500 text-white font-medium"
                    >
                      BU (Brilliant Uncirculated)
                    </button>
                  </div>
                  
                  {/* Mint State Graded */}
                  <div className="mb-3">
                    <div className="text-gray-500 text-xs mb-1">MINT STATE (GRADED)</div>
                    <div className="grid grid-cols-4 gap-1">
                      {gradeOptions.filter(g => g.category === 'mint-state').map(gradeOpt => (
                        <button
                          key={gradeOpt.value}
                          onClick={() => {
                            const valuation = calculateCoinValue(evaluatingItem.coinKey, gradeOpt.value, 1);
                            setEvaluatingItem({
                              ...evaluatingItem,
                              ...valuation,
                              grade: gradeOpt.value,
                              description: coinReference[evaluatingItem.coinKey].name,
                              id: `eval-${Date.now()}`,
                              showGradeSelect: false,
                              isGraded: true
                            });
                          }}
                          className="py-2 px-1 rounded text-xs bg-blue-900 hover:bg-blue-700 text-blue-100"
                        >
                          {gradeOpt.value.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Proof Graded */}
                  <div className="mb-4">
                    <div className="text-gray-500 text-xs mb-1">PROOF (GRADED)</div>
                    <div className="grid grid-cols-4 gap-1">
                      {gradeOptions.filter(g => g.category === 'proof').map(gradeOpt => (
                        <button
                          key={gradeOpt.value}
                          onClick={() => {
                            const valuation = calculateCoinValue(evaluatingItem.coinKey, gradeOpt.value, 1);
                            setEvaluatingItem({
                              ...evaluatingItem,
                              ...valuation,
                              grade: gradeOpt.value,
                              description: coinReference[evaluatingItem.coinKey].name,
                              id: `eval-${Date.now()}`,
                              showGradeSelect: false,
                              isGraded: true
                            });
                          }}
                          className="py-2 px-1 rounded text-xs bg-purple-900 hover:bg-purple-700 text-purple-100"
                        >
                          {gradeOpt.value.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setEvaluatingItem(null)}
                    className="w-full bg-gray-700 text-gray-300 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              {/* Valuation Display */}
              {!evaluatingItem.showGradeSelect && !evaluatingItem.needsManualEntry && !evaluatingItem.notPreciousMetal && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-bold text-lg">{evaluatingItem.description}</h3>
                    <div className="flex items-center gap-2">
                      {evaluatingItem.isGraded && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                          SLABBED
                        </span>
                      )}
                      {evaluatingItem.confidence && (
                        <span className="text-xs bg-teal-600 text-white px-2 py-1 rounded">
                          {Math.round(evaluatingItem.confidence * 100)}% match
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {evaluatingItem.year && (
                    <p className="text-gray-400 text-sm mb-1">
                      {evaluatingItem.year}{evaluatingItem.mint ? `-${evaluatingItem.mint}` : ''}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-sm px-2 py-1 rounded ${
                      evaluatingItem.grade?.startsWith('ms') ? 'bg-blue-900 text-blue-200' :
                      evaluatingItem.grade?.startsWith('pf') ? 'bg-purple-900 text-purple-200' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      Grade: {evaluatingItem.grade?.toUpperCase()}
                    </span>
                    <button
                      onClick={() => setEvaluatingItem({ ...evaluatingItem, showGradeSelect: true })}
                      className="text-teal-400 text-sm underline"
                    >
                      Change Grade
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-700 p-3 rounded text-center">
                      <div className="text-gray-400 text-xs">Spot Value</div>
                      <div className="text-white font-bold">${(evaluatingItem.spotValue || evaluatingItem.meltValue)?.toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-700 p-3 rounded text-center">
                      <div className="text-gray-400 text-xs">Retail</div>
                      <div className="text-white font-bold">${evaluatingItem.marketValue?.toFixed(2)}</div>
                      {evaluatingItem.pricingMode === 'fixed' && evaluatingItem.retailPremium > 0 && (
                        <div className="text-green-400 text-xs">+${evaluatingItem.retailPremium?.toFixed(2)}</div>
                      )}
                      {evaluatingItem.pricingMode === 'percentage' && evaluatingItem.premium > 0 && (
                        <div className="text-green-400 text-xs">+${evaluatingItem.premium?.toFixed(2)} prem</div>
                      )}
                    </div>
                    <div className="bg-teal-600 p-3 rounded text-center">
                      <div className="text-teal-200 text-xs">Your Buy</div>
                      <div className="text-white font-bold text-lg">${evaluatingItem.buyPrice?.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  <div className="text-gray-400 text-xs text-center mb-4">
                    {evaluatingItem.pricingMode === 'fixed' ? (
                      <span className="text-green-400">
                        Bullion: Spot + ${evaluatingItem.buyModifier?.toFixed(2)}
                      </span>
                    ) : (
                      <span>
                        Buying at {evaluatingItem.buyPercent}% of market
                        {evaluatingItem.isGraded && <span className="text-blue-400"> (graded premium)</span>}
                      </span>
                    )}
                  </div>
                  
                  {/* eBay Price Lookup Button */}
                  {evaluatingItem.ebayResults ? (
                    <div className="bg-blue-900 border border-blue-700 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-blue-300 text-sm font-medium">
                          eBay {evaluatingItem.ebayResults.source === 'sold' ? 'Sold' : 'Active'} ({evaluatingItem.ebayResults.count})
                        </span>
                        <button 
                          onClick={() => setEvaluatingItem({ ...evaluatingItem, ebayResults: null })}
                          className="text-blue-400 text-xs"
                        >
                          Hide
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-gray-400 text-xs">Low</div>
                          <div className="text-white font-medium">${evaluatingItem.ebayResults.lowPrice}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Avg</div>
                          <div className="text-green-400 font-bold">${evaluatingItem.ebayResults.avgPrice}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">High</div>
                          <div className="text-white font-medium">${evaluatingItem.ebayResults.highPrice}</div>
                        </div>
                      </div>
                      {/* View Sold on eBay button - OUTSIDE accordion */}
                      <button
                        onClick={() => {
                          const query = evaluatingItem.ebaySearchQuery || `${evaluatingItem.description} ${evaluatingItem.year || ''} ${evaluatingItem.grade || ''}`.trim();
                          const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sacat=11116&LH_Sold=1&LH_Complete=1&_sop=13`;
                          window.open(ebayUrl, '_blank');
                        }}
                        className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 text-sm"
                      >
                        <ExternalLink size={16} /> View Sold on eBay
                      </button>
                      {/* Collapsible active listings */}
                      {evaluatingItem.ebayResults.items?.length > 0 && (
                        <details className="mt-2 pt-2 border-t border-blue-700">
                          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                            View {evaluatingItem.ebayResults.items.length} active listings...
                          </summary>
                          <div className="max-h-40 overflow-y-auto space-y-2 mt-2">
                            {evaluatingItem.ebayResults.items.slice(0, 10).map((item, idx) => (
                              <a 
                                key={idx} 
                                href={item.itemUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block bg-gray-800 rounded p-2 hover:bg-gray-700"
                              >
                                <div className="flex justify-between items-start">
                                  <span className="text-gray-300 text-xs truncate flex-1 mr-2">{item.title?.slice(0, 50)}...</span>
                                  <span className="text-green-400 font-bold">${item.price}</span>
                                </div>
                                <div className="flex justify-between items-center mt-1 text-xs">
                                  <span className="text-gray-500">
                                    {item.status === 'Sold' ? `Sold ${item.soldDate}` : 'Active'} • {item.listingType || 'BIN'}
                                  </span>
                                </div>
                              </a>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {/* Prepopulated search bar */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={evaluatingItem.ebaySearchQuery || `${evaluatingItem.description} ${evaluatingItem.year || ''} ${evaluatingItem.grade || ''}`.trim()}
                          onChange={(e) => setEvaluatingItem({ ...evaluatingItem, ebaySearchQuery: e.target.value })}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                          placeholder="eBay search query..."
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                              setEvaluatingItem({ ...evaluatingItem, ebayLoading: true, ebaySearchQuery: e.target.value });
                              const results = await EbayPricingService.searchSoldListings(e.target.value);
                              setEvaluatingItem({ ...evaluatingItem, ebayResults: results, ebayLoading: false, ebaySearchQuery: e.target.value });
                            }
                          }}
                        />
                        <button
                          onClick={async () => {
                            const query = evaluatingItem.ebaySearchQuery || `${evaluatingItem.description} ${evaluatingItem.year || ''} ${evaluatingItem.grade || ''}`.trim();
                            setEvaluatingItem({ ...evaluatingItem, ebayLoading: true, ebaySearchQuery: query });
                            const results = await EbayPricingService.searchSoldListings(query);
                            setEvaluatingItem({ ...evaluatingItem, ebayResults: results, ebayLoading: false, ebaySearchQuery: query });
                          }}
                          disabled={evaluatingItem.ebayLoading}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg flex items-center gap-2"
                        >
                          {evaluatingItem.ebayLoading ? (
                            <Loader size={16} className="animate-spin" />
                          ) : (
                            <Search size={16} />
                          )}
                        </button>
                      </div>
                      <p className="text-gray-500 text-xs text-center">Edit search terms above, then press Enter or click Search</p>
                    </div>
                  )}
                  
                  {/* Quantity Selector */}
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <span className="text-gray-400">Quantity:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newQty = Math.max(1, (evaluatingItem.quantity || 1) - 1);
                          const valuation = calculateCoinValue(evaluatingItem.coinKey, evaluatingItem.grade, newQty);
                          setEvaluatingItem({ ...evaluatingItem, ...valuation, quantity: newQty });
                        }}
                        className="w-8 h-8 bg-gray-700 text-white rounded"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={evaluatingItem.quantity || 1}
                        onChange={(e) => {
                          const newQty = Math.max(1, parseInt(e.target.value) || 1);
                          const valuation = calculateCoinValue(evaluatingItem.coinKey, evaluatingItem.grade, newQty);
                          setEvaluatingItem({ ...evaluatingItem, ...valuation, quantity: newQty });
                        }}
                        className="w-16 bg-gray-700 text-white text-center py-1 rounded"
                        min="1"
                      />
                      <button
                        onClick={() => {
                          const newQty = (evaluatingItem.quantity || 1) + 1;
                          const valuation = calculateCoinValue(evaluatingItem.coinKey, evaluatingItem.grade, newQty);
                          setEvaluatingItem({ ...evaluatingItem, ...valuation, quantity: newQty });
                        }}
                        className="w-8 h-8 bg-gray-700 text-white rounded"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  {/* PRIMARY ACTIONS - Pass or Add to running list */}
                  <div className="flex gap-3 mb-4">
                    <button
                      onClick={() => setEvaluatingItem(null)}
                      className="flex-1 bg-gray-700 text-gray-300 py-3 rounded-lg font-medium"
                    >
                      Pass
                    </button>
                    <button
                      onClick={() => addToOffer(evaluatingItem)}
                      className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <Plus size={20} /> Add ${evaluatingItem.buyPrice?.toFixed(2)}
                    </button>
                  </div>
                  
                  {/* COLLAPSIBLE ANALYSIS - Available but not blocking */}
                  <details className="bg-gray-700 rounded-lg overflow-hidden">
                    <summary className="p-3 cursor-pointer text-gray-300 text-sm font-medium flex items-center gap-2 hover:bg-gray-600">
                      <TrendingUp size={16} className="text-teal-400" />
                      View Analysis & Options
                    </summary>
                    <div className="p-4 pt-0 space-y-4 border-t border-gray-600">
                      {/* PROFIT ANALYSIS */}
                      <div>
                        <h4 className="text-teal-400 text-sm font-bold mb-2 flex items-center gap-2">
                          <TrendingUp size={16} /> Profit Analysis
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-gray-800 p-2 rounded">
                            <div className="text-gray-400 text-xs">If Melt</div>
                            <div className={`font-medium ${((evaluatingItem.meltValue || evaluatingItem.spotValue) - evaluatingItem.buyPrice) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${(((evaluatingItem.meltValue || evaluatingItem.spotValue) * 0.98) - evaluatingItem.buyPrice).toFixed(2)}
                              <span className="text-xs text-gray-500 ml-1">
                                ({((((evaluatingItem.meltValue || evaluatingItem.spotValue) * 0.98) - evaluatingItem.buyPrice) / evaluatingItem.buyPrice * 100).toFixed(0)}%)
                              </span>
                            </div>
                            <div className="text-gray-500 text-xs">@ 98% refiner</div>
                          </div>
                          <div className="bg-gray-800 p-2 rounded">
                            <div className="text-gray-400 text-xs">If Sell Retail</div>
                            <div className={`font-medium ${(evaluatingItem.marketValue - evaluatingItem.buyPrice) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${(evaluatingItem.marketValue - evaluatingItem.buyPrice).toFixed(2)}
                              <span className="text-xs text-gray-500 ml-1">
                                ({((evaluatingItem.marketValue - evaluatingItem.buyPrice) / evaluatingItem.buyPrice * 100).toFixed(0)}%)
                              </span>
                            </div>
                            <div className="text-gray-500 text-xs">@ market value</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* PRICE FACTORS */}
                      <div>
                        <h4 className="text-amber-400 text-sm font-bold mb-2 flex items-center gap-2">
                          <Star size={16} /> Price Factors
                        </h4>
                        <div className="space-y-1 text-sm">
                          {evaluatingItem.year && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-500">📅</span>
                              <div>
                                <span className="text-gray-300">{evaluatingItem.year}{evaluatingItem.mint ? `-${evaluatingItem.mint}` : ''}</span>
                                {evaluatingItem.coinKey === 'mercury-dime' && evaluatingItem.year === '1916' && evaluatingItem.mint === 'D' && (
                                  <span className="ml-2 text-yellow-400 text-xs">🔥 KEY DATE!</span>
                                )}
                                {evaluatingItem.mint === 'CC' && (
                                  <span className="ml-2 text-yellow-400 text-xs">🏆 Carson City!</span>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="flex items-start gap-2">
                            <span className="text-gray-500">🎯</span>
                            <span className="text-gray-300">
                              {evaluatingItem.grade?.toUpperCase()}
                              {['cull', 'ag'].includes(evaluatingItem.grade) && <span className="text-gray-400 text-xs ml-2">→ melt candidate</span>}
                              {['au', 'bu'].includes(evaluatingItem.grade) && <span className="text-green-400 text-xs ml-2">→ collector grade</span>}
                            </span>
                          </div>
                          {evaluatingItem.notes && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-500">📝</span>
                              <span className="text-gray-400 text-xs">{evaluatingItem.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* RECOMMENDATION */}
                      <div className="bg-gray-800 rounded p-3">
                        <h4 className="text-white text-sm font-bold mb-1">💡 Recommendation</h4>
                        {(() => {
                          const meltProfit = ((evaluatingItem.meltValue || evaluatingItem.spotValue) * 0.98) - evaluatingItem.buyPrice;
                          const retailProfit = evaluatingItem.marketValue - evaluatingItem.buyPrice;
                          const profitMargin = retailProfit / evaluatingItem.buyPrice;
                          const isKeyDate = (evaluatingItem.coinKey === 'mercury-dime' && evaluatingItem.year === '1916' && evaluatingItem.mint === 'D') ||
                                           (evaluatingItem.mint === 'CC');
                          
                          if (isKeyDate) {
                            return <div className="text-yellow-400 text-sm">⚠️ <strong>VERIFY KEY DATE</strong> - Worth significantly more if authentic.</div>;
                          } else if (profitMargin > 0.5) {
                            return <div className="text-green-400 text-sm">📈 <strong>SELL RETAIL</strong> - Good margin ({(profitMargin * 100).toFixed(0)}%).</div>;
                          } else if (['cull', 'ag'].includes(evaluatingItem.grade) && meltProfit > 0) {
                            return <div className="text-amber-400 text-sm">🔥 <strong>MELT</strong> - Low grade, ${meltProfit.toFixed(2)} profit @ refiner.</div>;
                          } else if (profitMargin > 0.25) {
                            return <div className="text-teal-400 text-sm">📦 <strong>HOLD</strong> - Decent margin, wait for right buyer.</div>;
                          } else {
                            return <div className="text-gray-400 text-sm">🤔 <strong>TIGHT</strong> - Only {(profitMargin * 100).toFixed(0)}% margin.</div>;
                          }
                        })()}
                      </div>
                      
                      {/* DISPOSITION OPTIONS */}
                      <div>
                        <h4 className="text-gray-400 text-xs font-medium mb-2">Add with planned disposition:</h4>
                        <div className="grid grid-cols-4 gap-2">
                          <button
                            onClick={() => addToOffer({ ...evaluatingItem, plannedDisposition: 'melt' })}
                            className="bg-amber-700 hover:bg-amber-600 text-white py-2 px-2 rounded-lg text-xs flex flex-col items-center gap-1"
                          >
                            <Flame size={16} />
                            <span>Melt</span>
                          </button>
                          <button
                            onClick={() => addToOffer({ ...evaluatingItem, plannedDisposition: 'stash' })}
                            className="bg-purple-700 hover:bg-purple-600 text-white py-2 px-2 rounded-lg text-xs flex flex-col items-center gap-1"
                          >
                            <Lock size={16} />
                            <span>Stash</span>
                          </button>
                          <button
                            onClick={() => addToOffer({ ...evaluatingItem, plannedDisposition: 'sell' })}
                            className="bg-green-700 hover:bg-green-600 text-white py-2 px-2 rounded-lg text-xs flex flex-col items-center gap-1"
                          >
                            <DollarSign size={16} />
                            <span>Sell</span>
                          </button>
                          <button
                            onClick={() => addToOffer({ ...evaluatingItem, plannedDisposition: 'hold' })}
                            className="bg-blue-700 hover:bg-blue-600 text-white py-2 px-2 rounded-lg text-xs flex flex-col items-center gap-1"
                          >
                            <Archive size={16} />
                            <span>Hold</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              )}
              
              {/* Manual Entry Needed - Coin identified but not in reference */}
              {evaluatingItem.needsManualEntry && !evaluatingItem.notPreciousMetal && (
                <div className="p-4">
                  <div className="flex items-center justify-center mb-4">
                    <div className="bg-blue-900 text-blue-200 px-4 py-2 rounded-lg flex items-center gap-2">
                      <Search size={20} />
                      <span className="font-medium">Manual Lookup Required</span>
                    </div>
                  </div>
                  
                  <div className="text-center mb-4">
                    <h3 className="text-white font-bold text-lg mb-2">{evaluatingItem.description}</h3>
                    {evaluatingItem.year && (
                      <p className="text-gray-400 text-sm">
                        {evaluatingItem.year}{evaluatingItem.mint ? `-${evaluatingItem.mint}` : ''}
                        {evaluatingItem.grade && ` • Grade: ${evaluatingItem.grade.toUpperCase()}`}
                      </p>
                    )}
                    {evaluatingItem.metal && (
                      <p className="text-gray-400 text-sm">
                        {evaluatingItem.metal} {evaluatingItem.purity && `(${evaluatingItem.purity})`}
                      </p>
                    )}
                    {evaluatingItem.notes && (
                      <p className="text-gray-500 text-xs mt-2">{evaluatingItem.notes}</p>
                    )}
                    {evaluatingItem.apiError && (
                      <p className="text-amber-400 text-xs mt-2">{evaluatingItem.apiError}</p>
                    )}
                  </div>
                  
                  {/* eBay Search */}
                  {evaluatingItem.ebayResults ? (
                    <div className="bg-blue-900 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-blue-200 text-sm font-medium">eBay Prices ({evaluatingItem.ebayResults.count || 0})</span>
                        <button
                          onClick={() => {
                            const query = evaluatingItem.ebaySearchQuery || evaluatingItem.description;
                            const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sacat=11116&LH_Sold=1&LH_Complete=1`;
                            window.open(ebayUrl, '_blank');
                          }}
                          className="text-green-400 text-xs underline"
                        >
                          View Sold on eBay
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-gray-400 text-xs">Low</div>
                          <div className="text-white font-medium">${evaluatingItem.ebayResults.lowPrice || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Avg</div>
                          <div className="text-green-400 font-bold">${evaluatingItem.ebayResults.avgPrice || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">High</div>
                          <div className="text-white font-medium">${evaluatingItem.ebayResults.highPrice || 0}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={evaluatingItem.ebaySearchQuery || evaluatingItem.description || ''}
                          onChange={(e) => setEvaluatingItem({ ...evaluatingItem, ebaySearchQuery: e.target.value })}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                          placeholder="eBay search query..."
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                              setEvaluatingItem({ ...evaluatingItem, ebayLoading: true });
                              const results = await EbayPricingService.searchSoldListings(e.target.value);
                              setEvaluatingItem({ ...evaluatingItem, ebayResults: results, ebayLoading: false, ebaySearchQuery: e.target.value });
                            }
                          }}
                        />
                        <button
                          onClick={async () => {
                            const query = evaluatingItem.ebaySearchQuery || evaluatingItem.description || '';
                            if (query.trim()) {
                              setEvaluatingItem({ ...evaluatingItem, ebayLoading: true });
                              const results = await EbayPricingService.searchSoldListings(query);
                              setEvaluatingItem({ ...evaluatingItem, ebayResults: results, ebayLoading: false, ebaySearchQuery: query });
                            }
                          }}
                          disabled={evaluatingItem.ebayLoading}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg"
                        >
                          {evaluatingItem.ebayLoading ? <Loader size={18} className="animate-spin" /> : <Search size={18} />}
                        </button>
                      </div>
                      <p className="text-gray-500 text-xs text-center">Search eBay to get pricing</p>
                    </div>
                  )}
                  
                  {/* Manual Buy Price Entry */}
                  <div className="bg-gray-700 rounded-lg p-3 mb-4">
                    <label className="text-gray-400 text-sm block mb-2">Your Buy Price:</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">$</span>
                      <input
                        type="number"
                        value={evaluatingItem.manualBuyPrice || ''}
                        onChange={(e) => setEvaluatingItem({ ...evaluatingItem, manualBuyPrice: e.target.value })}
                        className="flex-1 bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                        placeholder={evaluatingItem.ebayResults ? `Suggested: $${Math.round((evaluatingItem.ebayResults.avgPrice || 0) * 0.5)}-${Math.round((evaluatingItem.ebayResults.avgPrice || 0) * 0.7)}` : 'Enter your buy price'}
                      />
                    </div>
                    {evaluatingItem.ebayResults && (
                      <p className="text-gray-500 text-xs mt-1">Typical buy: 50-70% of eBay average for coins</p>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEvaluatingItem(null)}
                      className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-medium"
                    >
                      Pass
                    </button>
                    {evaluatingItem.manualBuyPrice && (
                      <button
                        onClick={() => {
                          addToOffer({
                            id: `eval-${Date.now()}`,
                            description: evaluatingItem.description,
                            photo: evaluatingItem.photo,
                            photoBack: evaluatingItem.photoBack,
                            buyPrice: parseFloat(evaluatingItem.manualBuyPrice) || 0,
                            meltValue: 0,
                            marketValue: evaluatingItem.ebayResults?.avgPrice || 0,
                            category: evaluatingItem.metal === 'Gold' ? 'Coins - Gold' : 'Coins - Silver',
                            metalType: evaluatingItem.metal || 'Unknown',
                            grade: evaluatingItem.grade,
                            year: evaluatingItem.year,
                            mint: evaluatingItem.mint,
                            notes: evaluatingItem.notes
                          });
                        }}
                        className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                      >
                        <Plus size={20} /> Add ${evaluatingItem.manualBuyPrice}
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Not a Precious Metal Item Display */}
              {evaluatingItem.notPreciousMetal && (
                <div className="p-4">
                  <div className="flex items-center justify-center mb-4">
                    <div className="bg-amber-900 text-amber-200 px-4 py-2 rounded-lg flex items-center gap-2">
                      <Package size={20} />
                      <span className="font-medium">Non-Metal Item Detected</span>
                    </div>
                  </div>
                  
                  <div className="text-center mb-4">
                    <h3 className="text-white font-bold text-lg mb-2">{evaluatingItem.description}</h3>
                    <p className="text-gray-400 text-sm">
                      This item is not a precious metal, but may still have resale value.
                    </p>
                  </div>
                  
                  {/* eBay Search for Non-PM Items */}
                  {evaluatingItem.ebayResults ? (
                    <div className="bg-blue-900 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-blue-200 text-sm font-medium">eBay Sold Prices</span>
                        <span className="text-blue-300 text-xs">{evaluatingItem.ebayResults.count || 0} results</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-gray-400 text-xs">Low</div>
                          <div className="text-white font-medium">${evaluatingItem.ebayResults.lowPrice || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Avg</div>
                          <div className="text-green-400 font-bold">${evaluatingItem.ebayResults.avgPrice || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">High</div>
                          <div className="text-white font-medium">${evaluatingItem.ebayResults.highPrice || 0}</div>
                        </div>
                      </div>
                      {evaluatingItem.ebayResults.items?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-blue-700 max-h-32 overflow-y-auto">
                          {evaluatingItem.ebayResults.items.slice(0, 5).map((item, idx) => (
                            <a 
                              key={idx} 
                              href={item.itemUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block bg-gray-800 rounded p-2 mb-1 hover:bg-gray-700"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300 text-xs truncate flex-1 mr-2">{item.title?.slice(0, 40)}...</span>
                                <span className="text-green-400 font-bold text-sm">${item.price}</span>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {/* Prepopulated search bar based on description */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={evaluatingItem.ebaySearchQuery || evaluatingItem.description || ''}
                          onChange={(e) => setEvaluatingItem({ ...evaluatingItem, ebaySearchQuery: e.target.value })}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                          placeholder="eBay search query..."
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                              setEvaluatingItem({ ...evaluatingItem, ebayLoading: true, ebaySearchQuery: e.target.value });
                              const results = await EbayPricingService.searchSoldListings(e.target.value);
                              setEvaluatingItem({ ...evaluatingItem, ebayResults: results, ebayLoading: false, ebaySearchQuery: e.target.value });
                            }
                          }}
                        />
                        <button
                          onClick={async () => {
                            const query = evaluatingItem.ebaySearchQuery || evaluatingItem.description || '';
                            if (query.trim()) {
                              setEvaluatingItem({ ...evaluatingItem, ebayLoading: true, ebaySearchQuery: query });
                              const results = await EbayPricingService.searchSoldListings(query);
                              setEvaluatingItem({ ...evaluatingItem, ebayResults: results, ebayLoading: false, ebaySearchQuery: query });
                            }
                          }}
                          disabled={evaluatingItem.ebayLoading}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg flex items-center gap-2"
                        >
                          {evaluatingItem.ebayLoading ? (
                            <Loader size={18} className="animate-spin" />
                          ) : (
                            <Search size={18} />
                          )}
                        </button>
                      </div>
                      <p className="text-gray-500 text-xs text-center">Edit search terms above, then press Enter or click Search</p>
                    </div>
                  )}
                  
                  {/* Value Entry for Non-PM */}
                  {evaluatingItem.ebayResults && (
                    <div className="bg-gray-700 rounded-lg p-3 mb-4">
                      <label className="text-gray-400 text-sm block mb-2">Your Buy Price:</label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">$</span>
                        <input
                          type="number"
                          value={evaluatingItem.manualBuyPrice || ''}
                          onChange={(e) => setEvaluatingItem({ ...evaluatingItem, manualBuyPrice: e.target.value })}
                          className="flex-1 bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                          placeholder={`Suggested: $${Math.round((evaluatingItem.ebayResults.avgPrice || 0) * 0.4)}-${Math.round((evaluatingItem.ebayResults.avgPrice || 0) * 0.5)}`}
                        />
                      </div>
                      <p className="text-gray-500 text-xs mt-1">Typical buy: 40-50% of eBay sold average</p>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEvaluatingItem(null)}
                      className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-medium"
                    >
                      Pass
                    </button>
                    {evaluatingItem.ebayResults && evaluatingItem.manualBuyPrice && (
                      <button
                        onClick={() => {
                          // Add as non-PM item to session
                          addToOffer({
                            id: `eval-${Date.now()}`,
                            description: evaluatingItem.description,
                            photo: evaluatingItem.photo,
                            buyPrice: parseFloat(evaluatingItem.manualBuyPrice) || 0,
                            meltValue: 0,
                            marketValue: evaluatingItem.ebayResults.avgPrice || 0,
                            category: 'Resale Items',
                            metalType: 'None',
                            notes: `Non-PM item. eBay avg: $${evaluatingItem.ebayResults.avgPrice}`
                          });
                        }}
                        className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                      >
                        <Plus size={20} /> Add ${evaluatingItem.manualBuyPrice}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEvaluatingItem({ ...evaluatingItem, notPreciousMetal: false, needsManualEntry: true });
                        setShowManualEntry(true);
                      }}
                      className="bg-amber-600 text-white px-4 py-3 rounded-lg font-medium"
                      title="Mark as precious metal"
                    >
                      It's PM
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Coin Picker Modal */}
        {showCoinPicker && (
          <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-end">
            <div className="bg-gray-800 rounded-t-xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-gray-800">
                <h3 className="text-white font-bold">Select Coin Type</h3>
                <button onClick={() => setShowCoinPicker(false)} className="text-gray-400"><X size={24} /></button>
              </div>
              
              <div className="p-4">
                {/* Silver Coins */}
                <h4 className="text-gray-400 text-sm font-medium mb-2">Silver Coins (90%)</h4>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {Object.entries(coinReference)
                    .filter(([_, coin]) => coin.metal === 'Silver' && coin.purity === 0.90)
                    .map(([key, coin]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setShowCoinPicker(false);
                          setEvaluatingItem({ coinKey: key, showGradeSelect: true });
                        }}
                        className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded text-left"
                      >
                        <div className="font-medium text-sm">{coin.name}</div>
                        <div className="text-gray-400 text-xs">{coin.years}</div>
                      </button>
                    ))}
                </div>
                
                {/* Silver Bullion */}
                <h4 className="text-gray-400 text-sm font-medium mb-2">Silver Bullion</h4>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {Object.entries(coinReference)
                    .filter(([_, coin]) => coin.metal === 'Silver' && coin.purity > 0.90)
                    .map(([key, coin]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setShowCoinPicker(false);
                          setEvaluatingItem({ coinKey: key, showGradeSelect: true });
                        }}
                        className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded text-left"
                      >
                        <div className="font-medium text-sm">{coin.name}</div>
                        <div className="text-gray-400 text-xs">{coin.aswOz} oz</div>
                      </button>
                    ))}
                </div>
                
                {/* Gold Coins */}
                <h4 className="text-yellow-500 text-sm font-medium mb-2">Gold Coins</h4>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {Object.entries(coinReference)
                    .filter(([_, coin]) => coin.metal === 'Gold')
                    .map(([key, coin]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setShowCoinPicker(false);
                          setEvaluatingItem({ coinKey: key, showGradeSelect: true });
                        }}
                        className="bg-gray-700 hover:bg-yellow-900 text-white p-3 rounded text-left"
                      >
                        <div className="font-medium text-sm">{coin.name}</div>
                        <div className="text-gray-400 text-xs">{coin.agwOz} oz AGW</div>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // ============ REVIEW VIEW ============
  if (currentView === 'review') {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentView('evaluate')}>← Back</button>
            <h1 className="text-xl font-bold">Review Offer</h1>
            <button 
              onClick={() => setCurrentView('offer')}
              className="bg-white text-teal-700 px-3 py-1 rounded text-sm font-medium"
            >
              Show Client
            </button>
          </div>
        </div>
        
        <div className="p-4 space-y-4 pb-32">
          {/* Client Info */}
          <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              sessionClient?.type === 'Business' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
            }`}>
              {sessionClient?.type === 'Business' ? <Building size={24} /> : <User size={24} />}
            </div>
            <div>
              <div className="font-bold">{sessionClient?.name}</div>
              <div className="text-sm text-gray-500">{sessionClient?.phone}</div>
            </div>
          </div>
          
          {/* Items List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="font-bold">{sessionItems.length} Items</h3>
            </div>
            
            <div className="divide-y">
              {sessionItems.map((item, index) => (
                <div key={item.id} className="p-4">
                  <div className="flex gap-3">
                    {item.photo && (
                      <img 
                        src={`data:image/jpeg;base64,${item.photo}`} 
                        className="w-16 h-16 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{item.description}</div>
                          {item.year && (
                            <div className="text-sm text-gray-500">
                              {item.year}{item.mint ? `-${item.mint}` : ''} • {item.grade?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => removeFromOffer(item.id)}
                          className="text-red-500 p-1"
                        >
                          <X size={18} />
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Qty:</span>
                          <input
                            type="number"
                            value={item.quantity || 1}
                            onChange={(e) => updateItemQuantity(item.id, e.target.value)}
                            className="w-16 border rounded px-2 py-1 text-center text-sm"
                            min="1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">$</span>
                          <input
                            type="number"
                            value={item.buyPrice.toFixed(2)}
                            onChange={(e) => updateItemPrice(item.id, e.target.value)}
                            className="w-24 border rounded px-2 py-1 text-right font-medium"
                            step="0.01"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {sessionItems.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                <Package size={32} className="mx-auto mb-2 opacity-50" />
                <p>No items added yet</p>
              </div>
            )}
          </div>
          
          {/* Bulk Discount */}
          {sessionItems.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-3">Bulk Discount (Optional)</h3>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">Subtract:</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={bulkDiscount}
                    onChange={(e) => setBulkDiscount(e.target.value)}
                    className="w-full border rounded pl-7 pr-3 py-2"
                    placeholder="0.00"
                    step="1"
                  />
                </div>
              </div>
              {discountAmount > 0 && (
                <div className="mt-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={discountMethod === 'proportional'}
                      onChange={(e) => setDiscountMethod(e.target.checked ? 'proportional' : 'equal')}
                    />
                    Apply discount proportionally to each item's cost basis
                  </label>
                </div>
              )}
            </div>
          )}
          
          {/* Notes */}
          <div className="bg-white rounded-lg shadow p-4">
            <label className="block text-sm font-medium mb-1">Session Notes</label>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              className="w-full border rounded p-2"
              rows={2}
              placeholder="Any notes about this transaction..."
            />
          </div>
        </div>
        
        {/* Bottom Summary */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">${totalOffer.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between items-center mb-3 text-red-600">
              <span>Discount:</span>
              <span>-${discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-lg">Total Offer:</span>
            <span className="font-bold text-2xl text-teal-600">${finalOffer.toFixed(2)}</span>
          </div>
          <div className="flex gap-3 mb-3">
            <button
              onClick={() => setCurrentView('evaluate')}
              className="flex-1 border border-gray-300 py-3 rounded-lg font-medium"
            >
              Add More Items
            </button>
            <button
              onClick={() => setCurrentView('offer')}
              className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-medium"
            >
              Present Offer
            </button>
          </div>
          
          {/* Save Offer Without Purchase */}
          <button
            onClick={() => {
              // Save to client's appraisal history without adding to inventory
              const appraisalRecord = {
                id: `APR-${Date.now()}`,
                date: new Date().toISOString(),
                status: 'declined',
                items: sessionItems.map(item => ({
                  description: item.description,
                  year: item.year,
                  mint: item.mint,
                  grade: item.grade,
                  quantity: item.quantity || 1,
                  offeredPrice: item.buyPrice,
                  meltValue: item.meltValue,
                  marketValue: item.marketValue
                })),
                totalOffered: finalOffer,
                discount: discountAmount,
                notes: sessionNotes,
                clientId: sessionClient?.id,
                clientName: sessionClient?.name
              };
              
              // Call onComplete with declined status (won't add to inventory)
              onComplete({
                client: sessionClient,
                items: [], // Empty - don't add to inventory
                totalPaid: 0,
                discount: 0,
                notes: sessionNotes,
                sessionDate: new Date().toISOString(),
                status: 'declined',
                appraisalRecord: appraisalRecord
              });
            }}
            className="w-full border-2 border-amber-500 text-amber-600 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            <FileText size={18} /> Save Offer (Client Declined)
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            Saves to client file for reference - items won't be added to inventory
          </p>
        </div>
      </div>
    );
  }
  
  // ============ CLIENT-FACING OFFER VIEW ============
  if (currentView === 'offer') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Minimal header - tap to go back */}
        <button 
          onClick={() => setCurrentView('review')}
          className="p-4 text-gray-500 text-sm"
        >
          ← Tap to edit
        </button>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-6 text-center">
              <h1 className="text-2xl font-bold">STEVENS ESTATE SERVICES</h1>
              <p className="text-amber-200 text-sm mt-1">Precious Metals Purchase Offer</p>
            </div>
            
            {/* Client */}
            <div className="bg-gray-100 px-6 py-3 text-center">
              <span className="text-gray-600">Prepared for: </span>
              <span className="font-bold">{sessionClient?.name}</span>
            </div>
            
            {/* Items */}
            <div className="px-6 py-4">
              <table className="w-full">
                <tbody>
                  {sessionItems.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-3 text-left">
                        <div className="font-medium">{item.description}</div>
                        {(item.quantity || 1) > 1 && (
                          <div className="text-sm text-gray-500">× {item.quantity}</div>
                        )}
                      </td>
                      <td className="py-3 text-right font-medium">
                        ${item.buyPrice.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Total */}
            <div className="px-6 py-4 border-t-2 border-gray-200">
              {discountAmount > 0 && (
                <>
                  <div className="flex justify-between text-gray-600 mb-1">
                    <span>Subtotal:</span>
                    <span>${totalOffer.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-600 mb-2">
                    <span>Bulk Discount:</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">TOTAL OFFER</span>
                <span className="text-3xl font-bold text-amber-600">${finalOffer.toFixed(2)}</span>
              </div>
            </div>
            
            {/* Date */}
            <div className="px-6 py-3 bg-gray-50 text-center text-sm text-gray-500">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="p-4 flex gap-3">
          <button
            onClick={() => setCurrentView('review')}
            className="flex-1 bg-gray-700 text-white py-4 rounded-xl font-medium"
          >
            Adjust Offer
          </button>
          <button
            onClick={() => setCurrentView('complete')}
            className="flex-1 bg-green-600 text-white py-4 rounded-xl font-medium"
          >
            Accept & Complete
          </button>
        </div>
      </div>
    );
  }
  
  // ============ COMPLETE VIEW ============
  if (currentView === 'complete') {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentView('offer')}>← Back</button>
            <h1 className="text-xl font-bold">Complete Transaction</h1>
            <div className="w-16"></div>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-center mb-4">
              <div className="text-gray-500">Total Purchase</div>
              <div className="text-4xl font-bold text-green-600">${finalOffer.toFixed(2)}</div>
              <div className="text-sm text-gray-500">{sessionItems.length} items from {sessionClient?.name}</div>
            </div>
          </div>
          
          {/* What happens next */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3">Completing this transaction will:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <Check size={18} className="text-green-500 mt-0.5" />
                <span>Add {sessionItems.length} items to your inventory with photos</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={18} className="text-green-500 mt-0.5" />
                <span>Record cost basis for tax reporting</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={18} className="text-green-500 mt-0.5" />
                <span>Link items to {sessionClient?.name}'s client record</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={18} className="text-green-500 mt-0.5" />
                <span>Start 7-day hold period for applicable items</span>
              </li>
            </ul>
          </div>
          
          {/* Signature reminder */}
          {!sessionClient?.signature && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-yellow-600 mt-0.5" size={20} />
                <div>
                  <div className="font-medium text-yellow-800">Signature Required</div>
                  <p className="text-sm text-yellow-700">
                    {sessionClient?.name} hasn't signed the seller certification yet. 
                    You'll be prompted to capture their signature.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <button
            onClick={handleCompleteSession}
            className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg"
          >
            Complete Purchase
          </button>
          
          <button
            onClick={() => setCurrentView('offer')}
            className="w-full border border-gray-300 py-3 rounded-lg text-gray-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  return null;
}

// ============ LOT PURCHASE VIEW ============
function LotPurchaseView({ clients, onSave, onCancel }) {
  const [lotInfo, setLotInfo] = useState({
    description: '',
    totalCost: '',
    source: '',
    clientId: '',
    dateAcquired: new Date().toISOString().split('T')[0],
    notes: '',
    allocationMethod: 'equal' // 'equal' or 'relative'
  });
  
  const [lotItems, setLotItems] = useState([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    description: '',
    category: 'Coins - Silver',
    metalType: 'Silver',
    purity: '90%',
    quantity: 1,
    weightOzEach: '',
    estimatedValueEach: '', // For relative allocation
    meltValueEach: ''
  });
  
  const totalCost = parseFloat(lotInfo.totalCost) || 0;
  const totalItems = lotItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalEstimatedValue = lotItems.reduce((sum, item) => sum + (item.quantity * (parseFloat(item.estimatedValueEach) || 0)), 0);
  
  // Calculate cost basis for each item type
  const calculateCostBasis = (item) => {
    if (totalItems === 0 || totalCost === 0) return 0;
    
    if (lotInfo.allocationMethod === 'equal') {
      return totalCost / totalItems;
    } else {
      // Relative value allocation
      if (totalEstimatedValue === 0) return totalCost / totalItems;
      const itemTotalValue = item.quantity * (parseFloat(item.estimatedValueEach) || 0);
      const proportion = itemTotalValue / totalEstimatedValue;
      return (totalCost * proportion) / item.quantity;
    }
  };
  
  const addItemToLot = () => {
    if (!newItem.description || newItem.quantity < 1) return;
    
    setLotItems([...lotItems, {
      ...newItem,
      id: `item-${Date.now()}`,
      quantity: parseInt(newItem.quantity) || 1
    }]);
    
    setNewItem({
      description: '',
      category: 'Coins - Silver',
      metalType: 'Silver',
      purity: '90%',
      quantity: 1,
      weightOzEach: '',
      estimatedValueEach: '',
      meltValueEach: ''
    });
    setShowAddItem(false);
  };
  
  const removeItem = (id) => {
    setLotItems(lotItems.filter(item => item.id !== id));
  };
  
  const updateItemQuantity = (id, quantity) => {
    setLotItems(lotItems.map(item => 
      item.id === id ? { ...item, quantity: parseInt(quantity) || 1 } : item
    ));
  };
  
  const handleSave = () => {
    if (!lotInfo.description || totalCost === 0 || lotItems.length === 0) {
      alert('Please enter lot description, total cost, and add at least one item');
      return;
    }
    
    // Generate individual inventory items from lot
    const inventoryItems = [];
    lotItems.forEach(item => {
      const costBasisEach = calculateCostBasis(item);
      for (let i = 0; i < item.quantity; i++) {
        inventoryItems.push({
          description: item.description,
          category: item.category,
          metalType: item.metalType,
          purity: item.purity,
          weightOz: parseFloat(item.weightOzEach) || 0,
          source: lotInfo.source,
          clientId: lotInfo.clientId,
          dateAcquired: lotInfo.dateAcquired,
          purchasePrice: Math.round(costBasisEach * 100) / 100, // Round to cents
          meltValue: parseFloat(item.meltValueEach) || 0,
          status: 'Available',
          notes: `Lot: ${lotInfo.description}${lotInfo.notes ? ' | ' + lotInfo.notes : ''}`,
          lotId: null // Will be set by parent
        });
      }
    });
    
    onSave({
      lotInfo: {
        ...lotInfo,
        totalCost,
        totalItems,
        allocationMethod: lotInfo.allocationMethod
      },
      items: inventoryItems
    });
  };
  
  // Common coin presets
  const coinPresets = [
    // ==================== US CONSTITUTIONAL SILVER (90%) ====================
    // Silver Dollars - 0.7734 oz ASW (26.73g total, 90% silver)
    { name: 'Morgan Dollar (1878-1921)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.7734 },
    { name: 'Peace Dollar (1921-1935)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.7734 },
    { name: 'Trade Dollar (1873-1885)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.7874 },
    { name: 'Seated Liberty Dollar (1840-1873)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.7734 },
    { name: 'Eisenhower Dollar 40% (1971-1976 S)', category: 'Coins - Silver', metalType: 'Silver', purity: '40%', weightOz: 0.3161 },
    
    // Half Dollars - 0.3617 oz ASW for 90% (12.5g total)
    { name: 'Walking Liberty Half (1916-1947)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617 },
    { name: 'Franklin Half (1948-1963)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617 },
    { name: 'Kennedy Half 90% (1964)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617 },
    { name: 'Kennedy Half 40% (1965-1970)', category: 'Coins - Silver', metalType: 'Silver', purity: '40%', weightOz: 0.1479 },
    { name: 'Barber Half (1892-1915)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617 },
    { name: 'Seated Liberty Half (1839-1891)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617 },
    { name: 'Capped Bust Half (1807-1839)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617 },
    
    // Quarters - 0.1808 oz ASW (6.25g total, 90% silver)
    { name: 'Washington Quarter 90% (1932-1964)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808 },
    { name: 'Standing Liberty Quarter (1916-1930)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808 },
    { name: 'Barber Quarter (1892-1916)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808 },
    { name: 'Seated Liberty Quarter (1838-1891)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808 },
    { name: 'Capped Bust Quarter (1815-1838)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808 },
    
    // Dimes - 0.0723 oz ASW (2.5g total, 90% silver)
    { name: 'Roosevelt Dime 90% (1946-1964)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.0723 },
    { name: 'Mercury Dime (1916-1945)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.0723 },
    { name: 'Barber Dime (1892-1916)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.0723 },
    { name: 'Seated Liberty Dime (1837-1891)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.0723 },
    { name: 'Capped Bust Dime (1809-1837)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.0723 },
    
    // War Nickels - 0.0563 oz ASW (35% silver)
    { name: 'War Nickel 35% (1942-1945 P/D/S)', category: 'Coins - Silver', metalType: 'Silver', purity: '35%', weightOz: 0.0563 },
    
    // Half Dimes - 0.0388 oz ASW
    { name: 'Seated Liberty Half Dime (1837-1873)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.0388 },
    
    // Three Cent Silver
    { name: 'Three Cent Silver (1851-1873)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.0241 },

    // ==================== US PRE-1933 GOLD ====================
    // Double Eagles ($20) - 0.9675 oz AGW
    { name: '$20 Liberty Double Eagle (1850-1907)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.9675 },
    { name: '$20 Saint-Gaudens Double Eagle (1907-1933)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.9675 },
    
    // Eagles ($10) - 0.4838 oz AGW
    { name: '$10 Liberty Eagle (1838-1907)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.4838 },
    { name: '$10 Indian Eagle (1907-1933)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.4838 },
    
    // Half Eagles ($5) - 0.2419 oz AGW
    { name: '$5 Liberty Half Eagle (1839-1908)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.2419 },
    { name: '$5 Indian Half Eagle (1908-1929)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.2419 },
    
    // Quarter Eagles ($2.50) - 0.1209 oz AGW
    { name: '$2.50 Liberty Quarter Eagle (1840-1907)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.1209 },
    { name: '$2.50 Indian Quarter Eagle (1908-1929)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.1209 },
    
    // Gold Dollars - 0.0484 oz AGW
    { name: '$1 Gold Dollar (1849-1889)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.0484 },
    
    // $3 Gold - 0.1451 oz AGW
    { name: '$3 Gold Princess (1854-1889)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.1451 },

    // ==================== US MODERN BULLION - SILVER ====================
    { name: 'American Silver Eagle 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 1.0 },
    
    // ==================== US MODERN BULLION - GOLD ====================
    // American Gold Eagles (22K - contains stated pure gold content)
    { name: 'American Gold Eagle 1oz', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 1.0 },
    { name: 'American Gold Eagle 1/2oz', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 0.5 },
    { name: 'American Gold Eagle 1/4oz', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 0.25 },
    { name: 'American Gold Eagle 1/10oz', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 0.1 },
    
    // American Gold Buffalo (24K - .9999 fine)
    { name: 'American Gold Buffalo 1oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 1.0 },
    
    // American Platinum Eagles
    { name: 'American Platinum Eagle 1oz', category: 'Platinum - Coins', metalType: 'Platinum', purity: '9995', weightOz: 1.0 },
    { name: 'American Platinum Eagle 1/2oz', category: 'Platinum - Coins', metalType: 'Platinum', purity: '9995', weightOz: 0.5 },
    { name: 'American Platinum Eagle 1/4oz', category: 'Platinum - Coins', metalType: 'Platinum', purity: '9995', weightOz: 0.25 },
    { name: 'American Platinum Eagle 1/10oz', category: 'Platinum - Coins', metalType: 'Platinum', purity: '9995', weightOz: 0.1 },

    // ==================== CANADA - GOLD MAPLE LEAFS (24K .9999) ====================
    { name: 'Canadian Gold Maple 1oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 1.0 },
    { name: 'Canadian Gold Maple 1/2oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.5 },
    { name: 'Canadian Gold Maple 1/4oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.25 },
    { name: 'Canadian Gold Maple 1/10oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.1 },
    { name: 'Canadian Gold Maple 1/20oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.05 },
    
    // Canada Silver Maple Leafs (.9999)
    { name: 'Canadian Silver Maple 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '9999', weightOz: 1.0 },

    // ==================== SOUTH AFRICA - KRUGERRANDS (22K) ====================
    // Krugerrands contain stated pure gold but total weight is higher due to 22K alloy
    { name: 'Krugerrand 1oz', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 1.0 },
    { name: 'Krugerrand 1/2oz', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 0.5 },
    { name: 'Krugerrand 1/4oz', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 0.25 },
    { name: 'Krugerrand 1/10oz', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 0.1 },
    
    // Krugerrand Silver (since 2018)
    { name: 'Krugerrand Silver 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 1.0 },

    // ==================== AUSTRALIA - KANGAROOS/NUGGETS (.9999) ====================
    { name: 'Australian Gold Kangaroo 1oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 1.0 },
    { name: 'Australian Gold Kangaroo 1/2oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.5 },
    { name: 'Australian Gold Kangaroo 1/4oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.25 },
    { name: 'Australian Gold Kangaroo 1/10oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.1 },
    { name: 'Australian Gold Kangaroo 1/20oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.05 },
    
    // Australia Silver
    { name: 'Australian Silver Kangaroo 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '9999', weightOz: 1.0 },
    { name: 'Australian Silver Kookaburra 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 1.0 },
    { name: 'Australian Silver Koala 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 1.0 },
    
    // Australia Platinum
    { name: 'Australian Platinum Kangaroo 1oz', category: 'Platinum - Coins', metalType: 'Platinum', purity: '9995', weightOz: 1.0 },

    // ==================== UNITED KINGDOM - BRITANNIAS & SOVEREIGNS ====================
    // Gold Britannias (24K since 2013, 22K prior)
    { name: 'British Gold Britannia 1oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 1.0 },
    { name: 'British Gold Britannia 1/2oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.5 },
    { name: 'British Gold Britannia 1/4oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.25 },
    { name: 'British Gold Britannia 1/10oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.1 },
    
    // British Sovereigns (22K - 0.2354 oz AGW)
    { name: 'British Gold Sovereign', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 0.2354 },
    { name: 'British Gold Half Sovereign', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 0.1177 },
    { name: 'British Gold Double Sovereign', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 0.4708 },
    { name: 'British Gold Quintuple Sovereign (5x)', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 1.177 },
    
    // Silver Britannias
    { name: 'British Silver Britannia 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 1.0 },
    
    // Platinum Britannias
    { name: 'British Platinum Britannia 1oz', category: 'Platinum - Coins', metalType: 'Platinum', purity: '9995', weightOz: 1.0 },

    // ==================== AUSTRIA - PHILHARMONICS (.9999) ====================
    { name: 'Austrian Gold Philharmonic 1oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 1.0 },
    { name: 'Austrian Gold Philharmonic 1/2oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.5 },
    { name: 'Austrian Gold Philharmonic 1/4oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.25 },
    { name: 'Austrian Gold Philharmonic 1/10oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.1 },
    { name: 'Austrian Gold Philharmonic 1/25oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 0.04 },
    
    { name: 'Austrian Silver Philharmonic 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 1.0 },
    
    { name: 'Austrian Platinum Philharmonic 1oz', category: 'Platinum - Coins', metalType: 'Platinum', purity: '9995', weightOz: 1.0 },
    
    // Austria - Historic/Restrike
    { name: 'Austrian 100 Corona Restrike', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.9802 },
    { name: 'Austrian 4 Ducat Restrike', category: 'Gold - Coins', metalType: 'Gold', purity: '986', weightOz: 0.4430 },
    { name: 'Austrian 1 Ducat Restrike', category: 'Gold - Coins', metalType: 'Gold', purity: '986', weightOz: 0.1107 },
    { name: 'Maria Theresa Thaler (Silver)', category: 'Coins - Silver', metalType: 'Silver', purity: '833', weightOz: 0.752 },

    // ==================== MEXICO - LIBERTADS ====================
    // Gold Libertads (.999)
    { name: 'Mexican Gold Libertad 1oz', category: 'Gold - Coins', metalType: 'Gold', purity: '999', weightOz: 1.0 },
    { name: 'Mexican Gold Libertad 1/2oz', category: 'Gold - Coins', metalType: 'Gold', purity: '999', weightOz: 0.5 },
    { name: 'Mexican Gold Libertad 1/4oz', category: 'Gold - Coins', metalType: 'Gold', purity: '999', weightOz: 0.25 },
    { name: 'Mexican Gold Libertad 1/10oz', category: 'Gold - Coins', metalType: 'Gold', purity: '999', weightOz: 0.1 },
    { name: 'Mexican Gold Libertad 1/20oz', category: 'Gold - Coins', metalType: 'Gold', purity: '999', weightOz: 0.05 },
    
    // Silver Libertads (.999)
    { name: 'Mexican Silver Libertad 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 1.0 },
    { name: 'Mexican Silver Libertad 2oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 2.0 },
    { name: 'Mexican Silver Libertad 5oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 5.0 },
    
    // Mexico - Historic Gold Pesos (90% gold)
    { name: 'Mexican 50 Peso Gold (Centenario)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 1.2057 },
    { name: 'Mexican 20 Peso Gold (Azteca)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.4823 },
    { name: 'Mexican 10 Peso Gold', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.2411 },
    { name: 'Mexican 5 Peso Gold', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.1206 },
    { name: 'Mexican 2.5 Peso Gold (Dos y Medio)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.0603 },
    { name: 'Mexican 2 Peso Gold', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.0482 },

    // ==================== CHINA - PANDAS ====================
    // Gold Pandas (.999) - Note: Changed from oz to grams in 2016, these are pre-2016 oz weights
    { name: 'Chinese Gold Panda 1oz (30g)', category: 'Gold - Coins', metalType: 'Gold', purity: '999', weightOz: 1.0 },
    { name: 'Chinese Gold Panda 1/2oz (15g)', category: 'Gold - Coins', metalType: 'Gold', purity: '999', weightOz: 0.5 },
    { name: 'Chinese Gold Panda 1/4oz (8g)', category: 'Gold - Coins', metalType: 'Gold', purity: '999', weightOz: 0.25 },
    { name: 'Chinese Gold Panda 1/10oz (3g)', category: 'Gold - Coins', metalType: 'Gold', purity: '999', weightOz: 0.1 },
    { name: 'Chinese Gold Panda 1/20oz (1g)', category: 'Gold - Coins', metalType: 'Gold', purity: '999', weightOz: 0.05 },
    
    // Silver Pandas
    { name: 'Chinese Silver Panda 1oz (30g)', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 1.0 },

    // ==================== SWITZERLAND ====================
    { name: 'Swiss 20 Franc Gold (Helvetia/Vreneli)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.1867 },
    { name: 'Swiss 10 Franc Gold', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.0933 },

    // ==================== FRANCE ====================
    { name: 'French 20 Franc Gold (Rooster/Napoleon)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.1867 },
    { name: 'French 10 Franc Gold', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.0933 },

    // ==================== NETHERLANDS ====================
    { name: 'Dutch 10 Guilder Gold', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.1947 },

    // ==================== BELGIUM ====================
    { name: 'Belgian 20 Franc Gold', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.1867 },

    // ==================== ITALY ====================
    { name: 'Italian 20 Lire Gold', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.1867 },

    // ==================== RUSSIA/SOVIET ====================
    { name: 'Russian 5 Rouble Gold', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.1244 },
    { name: 'Russian 10 Rouble Gold (Chervonets)', category: 'Gold - Coins', metalType: 'Gold', purity: '90%', weightOz: 0.2489 },

    // ==================== ISLE OF MAN - NOBLE (.9999) ====================
    { name: 'Isle of Man Gold Noble 1oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 1.0 },
    { name: 'Isle of Man Platinum Noble 1oz', category: 'Platinum - Coins', metalType: 'Platinum', purity: '9995', weightOz: 1.0 },

    // ==================== NEW ZEALAND ====================
    { name: 'NZ Silver Kiwi 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 1.0 },

    // ==================== SOMALIA ====================
    { name: 'Somali Gold Elephant 1oz', category: 'Gold - Coins', metalType: 'Gold', purity: '9999', weightOz: 1.0 },
    { name: 'Somali Silver Elephant 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '9999', weightOz: 1.0 },

    // ==================== GENERIC ROUNDS/BARS ====================
    { name: 'Generic Silver Round 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 1.0 },
    { name: 'Generic Silver Bar 1oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 1.0 },
    { name: 'Generic Silver Bar 5oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 5.0 },
    { name: 'Generic Silver Bar 10oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 10.0 },
    { name: 'Generic Silver Bar 100oz', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 100.0 },
    { name: 'Generic Gold Bar 1oz', category: 'Gold - Coins', metalType: 'Gold', purity: '999', weightOz: 1.0 },
    { name: 'Generic Gold Bar 10oz', category: 'Gold - Coins', metalType: 'Gold', purity: '999', weightOz: 10.0 },
    { name: 'Generic Platinum Bar 1oz', category: 'Platinum - Coins', metalType: 'Platinum', purity: '9995', weightOz: 1.0 },
    
    // ==================== 90% JUNK SILVER BY FACE VALUE ====================
    // These calculate oz based on face value: $1 face = 0.715 oz ASW (except dollars = 0.7734)
    { name: 'Junk Silver $1 Face (Mixed)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.715 },
    { name: 'Junk Silver $10 Face (Mixed)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 7.15 },
    { name: 'Junk Silver $100 Face (Mixed)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 71.5 },
    { name: 'Junk Silver $1000 Face (Bag)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 715.0 },
  ];
  
  const applyPreset = (preset) => {
    setNewItem({
      ...newItem,
      description: preset.name,
      category: preset.category,
      metalType: preset.metalType,
      purity: preset.purity,
      weightOzEach: preset.weightOz.toString()
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-purple-700 to-purple-800 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onCancel}>Cancel</button>
          <h1 className="text-xl font-bold flex items-center gap-2"><Layers size={24} /> New Lot Purchase</h1>
          <button onClick={handleSave} className="font-bold">Save</button>
        </div>
      </div>
      
      <div className="p-4 space-y-4 pb-8">
        {/* Lot Info */}
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <h3 className="font-bold text-gray-800">Lot Information</h3>
          
          <div>
            <label className="block text-sm font-medium mb-1">Lot Description *</label>
            <input
              type="text"
              value={lotInfo.description}
              onChange={(e) => setLotInfo({...lotInfo, description: e.target.value})}
              className="w-full border rounded p-2"
              placeholder="e.g., Estate Sale Silver Lot, Mixed 90% Coins"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Total Cost Paid *</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  value={lotInfo.totalCost}
                  onChange={(e) => setLotInfo({...lotInfo, totalCost: e.target.value})}
                  className="w-full border rounded p-2 pl-7"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date Acquired</label>
              <input
                type="date"
                value={lotInfo.dateAcquired}
                onChange={(e) => setLotInfo({...lotInfo, dateAcquired: e.target.value})}
                className="w-full border rounded p-2"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Client/Seller</label>
            <select
              value={lotInfo.clientId}
              onChange={(e) => setLotInfo({...lotInfo, clientId: e.target.value})}
              className="w-full border rounded p-2 bg-white"
            >
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Source</label>
            <input
              type="text"
              value={lotInfo.source}
              onChange={(e) => setLotInfo({...lotInfo, source: e.target.value})}
              className="w-full border rounded p-2"
              placeholder="e.g., Estate Sale, Auction, Walk-in"
            />
          </div>
        </div>
        
        {/* Cost Allocation Method */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-800 mb-3">Cost Allocation Method</h3>
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="allocation"
                checked={lotInfo.allocationMethod === 'equal'}
                onChange={() => setLotInfo({...lotInfo, allocationMethod: 'equal'})}
                className="mt-1"
              />
              <div>
                <div className="font-medium">Equal Split</div>
                <div className="text-sm text-gray-500">Divide total cost equally among all items</div>
                {totalItems > 0 && totalCost > 0 && (
                  <div className="text-sm text-purple-600 mt-1">
                    ${(totalCost / totalItems).toFixed(2)} per item
                  </div>
                )}
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="allocation"
                checked={lotInfo.allocationMethod === 'relative'}
                onChange={() => setLotInfo({...lotInfo, allocationMethod: 'relative'})}
                className="mt-1"
              />
              <div>
                <div className="font-medium">Relative Value</div>
                <div className="text-sm text-gray-500">Allocate based on estimated value of each item type</div>
              </div>
            </label>
          </div>
        </div>
        
        {/* Lot Summary */}
        <div className="bg-purple-100 border border-purple-300 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-purple-600">Total Cost</div>
              <div className="text-xl font-bold text-purple-800">${totalCost.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-purple-600">Total Items</div>
              <div className="text-xl font-bold text-purple-800">{totalItems}</div>
            </div>
            <div>
              <div className="text-xs text-purple-600">Avg Cost/Item</div>
              <div className="text-xl font-bold text-purple-800">
                ${totalItems > 0 ? (totalCost / totalItems).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Items in Lot */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">Items in Lot ({totalItems})</h3>
            <button
              onClick={() => setShowAddItem(true)}
              className="bg-purple-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
            >
              <Plus size={16} /> Add Item
            </button>
          </div>
          
          {lotItems.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Layers size={32} className="mx-auto mb-2 opacity-50" />
              <p>No items added yet</p>
              <p className="text-sm">Add items to this lot</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lotItems.map(item => {
                const costBasis = calculateCostBasis(item);
                return (
                  <div key={item.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{item.description}</div>
                        <div className="text-sm text-gray-500">{item.category} • {item.purity}</div>
                        {item.weightOzEach && (
                          <div className="text-xs text-gray-400">{item.weightOzEach} oz each</div>
                        )}
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-red-500 p-1">
                        <X size={18} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Qty:</span>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(item.id, e.target.value)}
                          className="w-16 border rounded px-2 py-1 text-center"
                          min="1"
                        />
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Cost basis each:</div>
                        <div className="font-bold text-purple-600">${costBasis.toFixed(2)}</div>
                      </div>
                    </div>
                    {lotInfo.allocationMethod === 'relative' && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Est. value each: $</span>
                          <input
                            type="number"
                            value={item.estimatedValueEach}
                            onChange={(e) => setLotItems(lotItems.map(i => 
                              i.id === item.id ? { ...i, estimatedValueEach: e.target.value } : i
                            ))}
                            className="w-20 border rounded px-2 py-1 text-sm"
                            placeholder="0.00"
                            step="0.01"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Notes */}
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            value={lotInfo.notes}
            onChange={(e) => setLotInfo({...lotInfo, notes: e.target.value})}
            className="w-full border rounded p-2"
            rows={2}
            placeholder="Additional notes about this lot..."
          />
        </div>
        
        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!lotInfo.description || totalCost === 0 || lotItems.length === 0}
          className={`w-full py-4 rounded-lg font-bold text-white ${
            lotInfo.description && totalCost > 0 && lotItems.length > 0
              ? 'bg-purple-600'
              : 'bg-gray-300'
          }`}
        >
          Create {totalItems} Inventory Items
        </button>
      </div>
      
      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
              <h3 className="font-bold text-lg">Add Item to Lot</h3>
              <button onClick={() => setShowAddItem(false)}><X size={24} /></button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Quick Presets with Search */}
              <div>
                <label className="block text-sm font-medium mb-2">Quick Presets <span className="text-gray-400 font-normal">({coinPresets.length} coins)</span></label>
                <input
                  type="text"
                  placeholder="Search presets (e.g., Morgan, Eagle, Maple)..."
                  onChange={(e) => {
                    const searchEl = e.target;
                    searchEl.dataset.search = e.target.value.toLowerCase();
                    // Force re-render of presets
                    searchEl.dispatchEvent(new Event('input', { bubbles: true }));
                  }}
                  className="w-full border rounded p-2 mb-2 text-sm"
                  id="preset-search"
                />
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {coinPresets
                    .filter(p => {
                      const searchInput = document.getElementById('preset-search');
                      const search = searchInput?.dataset?.search || searchInput?.value?.toLowerCase() || '';
                      return !search || p.name.toLowerCase().includes(search);
                    })
                    .slice(0, 20)
                    .map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className={`text-xs px-2 py-1 rounded ${
                        preset.metalType === 'Gold' ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800' :
                        preset.metalType === 'Platinum' ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' :
                        'bg-gray-100 hover:bg-purple-100 text-gray-700'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <input
                  type="text"
                  value={newItem.description}
                  onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                  className="w-full border rounded p-2"
                  placeholder="e.g., Morgan Dollar, Roosevelt Dime"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                    className="w-full border rounded p-2 bg-white text-sm"
                  >
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                    className="w-full border rounded p-2"
                    min="1"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Metal</label>
                  <select
                    value={newItem.metalType}
                    onChange={(e) => setNewItem({...newItem, metalType: e.target.value})}
                    className="w-full border rounded p-2 bg-white"
                  >
                    <option>Gold</option>
                    <option>Silver</option>
                    <option>Platinum</option>
                    <option>Palladium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Purity</label>
                  <input
                    type="text"
                    value={newItem.purity}
                    onChange={(e) => setNewItem({...newItem, purity: e.target.value})}
                    className="w-full border rounded p-2"
                    placeholder="e.g., 90%, 925, 14K"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Weight Each (oz)</label>
                  <input
                    type="number"
                    value={newItem.weightOzEach}
                    onChange={(e) => setNewItem({...newItem, weightOzEach: e.target.value})}
                    className="w-full border rounded p-2"
                    placeholder="0.000"
                    step="0.001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Melt Value Each</label>
                  <input
                    type="number"
                    value={newItem.meltValueEach}
                    onChange={(e) => setNewItem({...newItem, meltValueEach: e.target.value})}
                    className="w-full border rounded p-2"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>
              
              {lotInfo.allocationMethod === 'relative' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Estimated Value Each (for allocation)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={newItem.estimatedValueEach}
                      onChange={(e) => setNewItem({...newItem, estimatedValueEach: e.target.value})}
                      className="w-full border rounded p-2 pl-7"
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Used to proportionally allocate lot cost</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t flex gap-2">
              <button onClick={() => setShowAddItem(false)} className="flex-1 border py-3 rounded-lg">Cancel</button>
              <button onClick={addItemToLot} className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-medium">
                Add {newItem.quantity > 1 ? `${newItem.quantity} Items` : 'Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ LOTS MANAGEMENT VIEW ============
function LotsView({ lots, inventory, liveSpotPrices, onBack, onUpdateLot, onBreakLot, onSelectItem }) {
  const [selectedLot, setSelectedLot] = useState(null);
  const [showBreakConfirm, setShowBreakConfirm] = useState(null);
  
  // Calculate lot values
  const getLotValue = (lot) => {
    // Get items belonging to this lot
    const lotItems = inventory.filter(item => 
      lot.itemIds?.includes(item.id) || item.lotId === lot.id
    );
    
    if (lotItems.length === 0) {
      // Lot might be stored as a single item with quantity
      const singleItem = inventory.find(item => lot.itemIds?.includes(item.id));
      if (singleItem) {
        const meltValue = parseFloat(singleItem.meltValue) || 0;
        return {
          itemCount: singleItem.quantity || 1,
          totalCost: lot.totalCost,
          currentMelt: meltValue,
          profit: meltValue - lot.totalCost
        };
      }
    }
    
    const totalMelt = lotItems.reduce((sum, item) => sum + (parseFloat(item.meltValue) || 0), 0);
    const itemCount = lotItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    return {
      itemCount: itemCount || lot.totalItems,
      totalCost: lot.totalCost,
      currentMelt: totalMelt,
      profit: totalMelt - lot.totalCost
    };
  };
  
  // Get status color
  const getStatusColor = (status) => {
    switch(status) {
      case 'intact': return 'bg-green-100 text-green-700';
      case 'partial': return 'bg-yellow-100 text-yellow-700';
      case 'broken': return 'bg-gray-100 text-gray-500';
      case 'sold': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };
  
  const activeLots = lots.filter(l => l.status !== 'sold' && l.status !== 'broken');
  const soldLots = lots.filter(l => l.status === 'sold' || l.status === 'broken');
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-purple-700 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1">← Back</button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package size={24} /> Lot Management
          </h1>
          <div className="w-16"></div>
        </div>
      </div>
      
      <div className="p-4 space-y-4 pb-24">
        {/* Summary */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg shadow p-4 text-white">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold">{activeLots.length}</div>
              <div className="text-xs opacity-80">Active Lots</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                ${activeLots.reduce((sum, lot) => sum + lot.totalCost, 0).toLocaleString()}
              </div>
              <div className="text-xs opacity-80">Total Cost</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {activeLots.reduce((sum, lot) => sum + (lot.totalItems || 0), 0)}
              </div>
              <div className="text-xs opacity-80">Total Items</div>
            </div>
          </div>
        </div>
        
        {/* Active Lots */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-3 border-b font-medium text-gray-700">Active Lots</div>
          {activeLots.length === 0 ? (
            <div className="p-4 text-center text-gray-400">No active lots</div>
          ) : (
            <div className="divide-y">
              {activeLots.map(lot => {
                const values = getLotValue(lot);
                const profitPercent = values.totalCost > 0 ? ((values.profit / values.totalCost) * 100) : 0;
                
                return (
                  <div key={lot.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-medium">{lot.description}</div>
                        <div className="text-sm text-gray-500">{lot.id} • {lot.dateAcquired}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(lot.status)}`}>
                        {lot.status || 'intact'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 mb-3 text-sm">
                      <div className="bg-gray-50 p-2 rounded text-center">
                        <div className="text-xs text-gray-500">Items</div>
                        <div className="font-bold">{values.itemCount}</div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded text-center">
                        <div className="text-xs text-gray-500">Cost</div>
                        <div className="font-bold">${values.totalCost}</div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded text-center">
                        <div className="text-xs text-gray-500">Melt</div>
                        <div className="font-bold text-amber-600">${values.currentMelt.toFixed(0)}</div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded text-center">
                        <div className="text-xs text-gray-500">Profit</div>
                        <div className={`font-bold ${values.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {values.profit >= 0 ? '+' : ''}${values.profit.toFixed(0)}
                        </div>
                      </div>
                    </div>
                    
                    {lot.notes && (
                      <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-50 rounded">
                        {lot.notes}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          // Find the main item for this lot
                          const lotItem = inventory.find(item => lot.itemIds?.includes(item.id));
                          if (lotItem && onSelectItem) onSelectItem(lotItem);
                        }}
                        className="flex-1 py-2 text-sm bg-purple-100 text-purple-700 rounded font-medium"
                      >
                        View Item
                      </button>
                      <button 
                        onClick={() => setShowBreakConfirm(lot)}
                        className="flex-1 py-2 text-sm bg-amber-100 text-amber-700 rounded font-medium"
                      >
                        Break Apart
                      </button>
                      <button 
                        onClick={() => onUpdateLot({ ...lot, status: 'sold' })}
                        className="flex-1 py-2 text-sm bg-green-100 text-green-700 rounded font-medium"
                      >
                        Sold as Set
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Sold/Broken Lots */}
        {soldLots.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-3 border-b font-medium text-gray-500">Completed Lots</div>
            <div className="divide-y">
              {soldLots.map(lot => (
                <div key={lot.id} className="p-3 opacity-60">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm">{lot.description}</div>
                      <div className="text-xs text-gray-500">{lot.totalItems} items • ${lot.totalCost}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(lot.status)}`}>
                      {lot.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Break Lot Confirmation Modal */}
      {showBreakConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-4">
            <h3 className="font-bold text-lg mb-2">Break Apart Lot?</h3>
            <p className="text-gray-600 mb-4">
              This will convert "{showBreakConfirm.description}" into {showBreakConfirm.totalItems} individual inventory items, each with cost basis of ${(showBreakConfirm.totalCost / showBreakConfirm.totalItems).toFixed(2)}.
            </p>
            <p className="text-sm text-amber-600 mb-4">
              ⚠️ Consider: Sets often sell for a premium over individual coins. Are you sure you want to break this apart?
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowBreakConfirm(null)}
                className="flex-1 py-3 border rounded-lg"
              >
                Keep as Set
              </button>
              <button 
                onClick={() => {
                  if (onBreakLot) onBreakLot(showBreakConfirm);
                  setShowBreakConfirm(null);
                }}
                className="flex-1 py-3 bg-amber-600 text-white rounded-lg font-medium"
              >
                Break Apart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ SCRAP CALCULATOR VIEW ============
function ScrapCalculatorView({ spotPrices: propSpotPrices, onRefresh, isLoading: propIsLoading, onBack }) {
  const [goldSpot, setGoldSpot] = useState(propSpotPrices?.gold || 4600.00);
  const [silverSpot, setSilverSpot] = useState(propSpotPrices?.silver || 90.00);
  const [platinumSpot, setPlatinumSpot] = useState(propSpotPrices?.platinum || 985.00);
  const [palladiumSpot, setPalladiumSpot] = useState(propSpotPrices?.palladium || 945.00);
  
  // Update local state when props change
  useEffect(() => {
    if (propSpotPrices) {
      if (propSpotPrices.gold) setGoldSpot(propSpotPrices.gold);
      if (propSpotPrices.silver) setSilverSpot(propSpotPrices.silver);
      if (propSpotPrices.platinum) setPlatinumSpot(propSpotPrices.platinum);
      if (propSpotPrices.palladium) setPalladiumSpot(propSpotPrices.palladium);
    }
  }, [propSpotPrices]);
  
  const [goldBuyPercent, setGoldBuyPercent] = useState(90);
  const [silverBuyPercent, setSilverBuyPercent] = useState(70);
  const [platinumBuyPercent, setPlatinumBuyPercent] = useState(85);
  const [palladiumBuyPercent, setPalladiumBuyPercent] = useState(80);
  
  const [unit, setUnit] = useState('oz'); // oz, g, dwt
  const [showSettings, setShowSettings] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  
  // Unit conversion factors (to troy oz)
  const toTroyOz = {
    oz: 1,
    g: 0.03215, // 1 gram = 0.03215 troy oz
    dwt: 0.05, // 1 pennyweight = 0.05 troy oz
  };
  
  const unitLabels = { oz: 'oz', g: 'g', dwt: 'dwt' };
  
  // Refresh prices using parent function if available
  const refreshPrices = async () => {
    if (onRefresh) {
      await onRefresh();
      setLastUpdate(new Date());
    } else {
      // Fallback to local fetch
      setLoading(true);
      const prices = await SpotPriceService.fetchPrices();
      if (prices) {
        setGoldSpot(prices.gold);
        setSilverSpot(prices.silver);
        setPlatinumSpot(prices.platinum);
        setPalladiumSpot(prices.palladium);
        setLastUpdate(new Date());
      }
      setLoading(false);
    }
  };
  
  // Gold items with purity
  const [goldItems, setGoldItems] = useState([
    { id: 'g9k', name: '9K Gold', purity: 0.375, weight: '', enabled: true },
    { id: 'g10k', name: '10K Gold', purity: 0.4167, weight: '', enabled: true },
    { id: 'g12k', name: '12K Gold', purity: 0.50, weight: '', enabled: false },
    { id: 'g14k', name: '14K Gold', purity: 0.5833, weight: '', enabled: true },
    { id: 'g16k', name: '16K Gold', purity: 0.6667, weight: '', enabled: false },
    { id: 'g18k', name: '18K Gold', purity: 0.75, weight: '', enabled: true },
    { id: 'g21k', name: '21K Gold', purity: 0.875, weight: '', enabled: false },
    { id: 'g22k', name: '22K Gold', purity: 0.9167, weight: '', enabled: true },
    { id: 'g24k', name: '24K Gold', purity: 0.9999, weight: '', enabled: true },
    { id: 'g900', name: '900 Gold Coins', purity: 0.90, weight: '', enabled: true },
  ]);
  
  // Silver items with purity - including 90% coins
  const [silverItems, setSilverItems] = useState([
    { id: 's90', name: '90% Coins', purity: 0.90, weight: '', enabled: true },
    { id: 's400', name: '400 Silver', purity: 0.40, weight: '', enabled: false },
    { id: 's600', name: '600 Silver', purity: 0.60, weight: '', enabled: false },
    { id: 's800', name: '800 Silver', purity: 0.80, weight: '', enabled: false },
    { id: 's925', name: 'Sterling (925)', purity: 0.925, weight: '', enabled: true },
    { id: 's999', name: 'Pure Silver', purity: 0.999, weight: '', enabled: true },
  ]);
  
  // Platinum items
  const [platinumItems, setPlatinumItems] = useState([
    { id: 'pt850', name: '850 Platinum', purity: 0.85, weight: '', enabled: false },
    { id: 'pt900', name: '900 Platinum', purity: 0.90, weight: '', enabled: true },
    { id: 'pt950', name: '950 Platinum', purity: 0.95, weight: '', enabled: true },
    { id: 'pt999', name: 'Pure Platinum', purity: 0.999, weight: '', enabled: true },
  ]);
  
  // Palladium items
  const [palladiumItems, setPalladiumItems] = useState([
    { id: 'pd500', name: '500 Palladium', purity: 0.50, weight: '', enabled: false },
    { id: 'pd950', name: '950 Palladium', purity: 0.95, weight: '', enabled: true },
    { id: 'pd999', name: 'Pure Palladium', purity: 0.999, weight: '', enabled: true },
  ]);
  
  // Calculate value for an item
  const calcItemValue = (item, spotPrice, buyPercent) => {
    const weight = parseFloat(item.weight) || 0;
    const weightInOz = weight * toTroyOz[unit];
    const pureWeight = weightInOz * item.purity;
    const spotValue = pureWeight * spotPrice;
    const buyValue = spotValue * (buyPercent / 100);
    return { spotValue, buyValue, pureWeight };
  };
  
  // Calculate price per unit for display
  const calcPricePerUnit = (spotPrice, purity, buyPercent) => {
    const pricePerOz = spotPrice * purity * (buyPercent / 100);
    return pricePerOz * toTroyOz[unit]; // Convert to selected unit (multiply to get smaller unit price)
  };
  
  // Calculate totals
  const goldTotal = goldItems.filter(i => i.enabled).reduce((sum, item) => {
    return sum + calcItemValue(item, goldSpot, goldBuyPercent).buyValue;
  }, 0);
  
  const silverTotal = silverItems.filter(i => i.enabled).reduce((sum, item) => {
    return sum + calcItemValue(item, silverSpot, silverBuyPercent).buyValue;
  }, 0);
  
  const platinumTotal = platinumItems.filter(i => i.enabled).reduce((sum, item) => {
    return sum + calcItemValue(item, platinumSpot, platinumBuyPercent).buyValue;
  }, 0);
  
  const palladiumTotal = palladiumItems.filter(i => i.enabled).reduce((sum, item) => {
    return sum + calcItemValue(item, palladiumSpot, palladiumBuyPercent).buyValue;
  }, 0);
  
  const grandTotal = goldTotal + silverTotal + platinumTotal + palladiumTotal;
  
  // Update item weight
  const updateWeight = (items, setItems, id, weight) => {
    setItems(items.map(item => item.id === id ? { ...item, weight } : item));
  };
  
  // Clear all weights
  const clearAll = () => {
    setGoldItems(goldItems.map(i => ({ ...i, weight: '' })));
    setSilverItems(silverItems.map(i => ({ ...i, weight: '' })));
    setPlatinumItems(platinumItems.map(i => ({ ...i, weight: '' })));
    setPalladiumItems(palladiumItems.map(i => ({ ...i, weight: '' })));
  };
  
  // Toggle item visibility
  const toggleItem = (items, setItems, id) => {
    setItems(items.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item));
  };
  
  // Render item row
  const renderItemRow = (item, items, setItems, spotPrice, buyPercent, bgColor) => {
    if (!item.enabled) return null;
    const pricePerUnit = calcPricePerUnit(spotPrice, item.purity, buyPercent);
    const { buyValue } = calcItemValue(item, spotPrice, buyPercent);
    
    return (
      <div key={item.id} className="flex items-center py-2 border-b border-gray-200">
        <div className="w-28 text-sm font-medium">{item.name}</div>
        <div className="flex-1 flex items-center gap-1">
          <input
            type="number"
            value={item.weight}
            onChange={(e) => updateWeight(items, setItems, item.id, e.target.value)}
            className="w-20 border rounded px-2 py-1 text-center text-sm"
            placeholder="0"
            step="0.01"
          />
          <span className="text-xs text-gray-500">{unitLabels[unit]}</span>
        </div>
        <div className="w-28 text-right">
          <div className="text-sm font-medium">${pricePerUnit.toFixed(2)}/{unitLabels[unit]}</div>
          {buyValue > 0 && <div className="text-xs text-green-600 font-bold">${buyValue.toFixed(2)}</div>}
        </div>
      </div>
    );
  };
  
  // Settings Modal
  if (showSettings) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setShowSettings(false)}>Cancel</button>
            <h1 className="text-lg font-bold">Calculator Settings</h1>
            <button onClick={() => setShowSettings(false)} className="font-bold">Done</button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Buy Percentages */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3">Buy Percentages (% of Spot)</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-yellow-700">Gold</span>
                <div className="flex items-center gap-2">
                  <input type="number" value={goldBuyPercent} onChange={(e) => setGoldBuyPercent(parseFloat(e.target.value) || 0)} className="w-20 border rounded px-2 py-1 text-center" />
                  <span>%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">Silver</span>
                <div className="flex items-center gap-2">
                  <input type="number" value={silverBuyPercent} onChange={(e) => setSilverBuyPercent(parseFloat(e.target.value) || 0)} className="w-20 border rounded px-2 py-1 text-center" />
                  <span>%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-500">Platinum</span>
                <div className="flex items-center gap-2">
                  <input type="number" value={platinumBuyPercent} onChange={(e) => setPlatinumBuyPercent(parseFloat(e.target.value) || 0)} className="w-20 border rounded px-2 py-1 text-center" />
                  <span>%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-orange-600">Palladium</span>
                <div className="flex items-center gap-2">
                  <input type="number" value={palladiumBuyPercent} onChange={(e) => setPalladiumBuyPercent(parseFloat(e.target.value) || 0)} className="w-20 border rounded px-2 py-1 text-center" />
                  <span>%</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Manual Spot Override */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3">Spot Prices (Manual Override)</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Gold</span>
                <div className="flex items-center gap-1">
                  <span>$</span>
                  <input type="number" value={goldSpot} onChange={(e) => setGoldSpot(parseFloat(e.target.value) || 0)} className="w-24 border rounded px-2 py-1 text-right" step="0.01" />
                  <span>/oz</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Silver</span>
                <div className="flex items-center gap-1">
                  <span>$</span>
                  <input type="number" value={silverSpot} onChange={(e) => setSilverSpot(parseFloat(e.target.value) || 0)} className="w-24 border rounded px-2 py-1 text-right" step="0.01" />
                  <span>/oz</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Platinum</span>
                <div className="flex items-center gap-1">
                  <span>$</span>
                  <input type="number" value={platinumSpot} onChange={(e) => setPlatinumSpot(parseFloat(e.target.value) || 0)} className="w-24 border rounded px-2 py-1 text-right" step="0.01" />
                  <span>/oz</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Palladium</span>
                <div className="flex items-center gap-1">
                  <span>$</span>
                  <input type="number" value={palladiumSpot} onChange={(e) => setPalladiumSpot(parseFloat(e.target.value) || 0)} className="w-24 border rounded px-2 py-1 text-right" step="0.01" />
                  <span>/oz</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Gold Items Toggle */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3 text-yellow-700">Gold Items</h3>
            <div className="space-y-2">
              {goldItems.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={item.enabled} onChange={() => toggleItem(goldItems, setGoldItems, item.id)} className="w-5 h-5" />
                    <span>{item.name}</span>
                  </label>
                  <span className="text-sm text-gray-500">{(item.purity * 100).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Silver Items Toggle */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3 text-gray-600">Silver Items</h3>
            <div className="space-y-2">
              {silverItems.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={item.enabled} onChange={() => toggleItem(silverItems, setSilverItems, item.id)} className="w-5 h-5" />
                    <span>{item.name}</span>
                  </label>
                  <span className="text-sm text-gray-500">{(item.purity * 100).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Platinum Items Toggle */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3 text-gray-500">Platinum Items</h3>
            <div className="space-y-2">
              {platinumItems.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={item.enabled} onChange={() => toggleItem(platinumItems, setPlatinumItems, item.id)} className="w-5 h-5" />
                    <span>{item.name}</span>
                  </label>
                  <span className="text-sm text-gray-500">{(item.purity * 100).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Palladium Items Toggle */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3 text-orange-600">Palladium Items</h3>
            <div className="space-y-2">
              {palladiumItems.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={item.enabled} onChange={() => toggleItem(palladiumItems, setPalladiumItems, item.id)} className="w-5 h-5" />
                    <span>{item.name}</span>
                  </label>
                  <span className="text-sm text-gray-500">{(item.purity * 100).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 text-white p-3">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-white">← Back</button>
          <h1 className="text-lg font-bold">Scrap Calculator</h1>
          <button onClick={() => setShowSettings(true)} className="bg-gray-600 px-3 py-1 rounded text-sm">Settings</button>
        </div>
      </div>
      
      {/* Controls Bar */}
      <div className="bg-amber-600 text-white p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">Unit:</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="bg-white text-black rounded px-2 py-1 text-sm">
            <option value="oz">ounce</option>
            <option value="g">gram</option>
            <option value="dwt">DWT</option>
          </select>
        </div>
        <button onClick={refreshPrices} disabled={propIsLoading || loading} className="bg-gray-700 px-3 py-1 rounded text-sm flex items-center gap-1">
          {(propIsLoading || loading) ? <Loader className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          Refresh
        </button>
        <button onClick={clearAll} className="bg-red-600 px-3 py-1 rounded text-sm">Clear</button>
      </div>
      
      {/* Grand Total */}
      <div className="bg-green-700 text-white p-4">
        <div className="text-center">
          <div className="text-sm opacity-80">Total Buy Price</div>
          <div className="text-4xl font-bold">${grandTotal.toFixed(2)}</div>
        </div>
      </div>
      
      <div className="p-2 space-y-2 pb-8">
        {/* Gold Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-yellow-500 text-white p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold">Gold</span>
              <span className="text-sm">${goldSpot.toFixed(2)}/oz</span>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-80">{goldBuyPercent}% of spot</div>
              <div className="font-bold">${goldTotal.toFixed(2)}</div>
            </div>
          </div>
          <div className="p-2 bg-yellow-50">
            <div className="flex items-center py-1 border-b border-yellow-200 text-xs text-gray-500">
              <div className="w-28">Description</div>
              <div className="flex-1">Weight</div>
              <div className="w-28 text-right">Buy Price</div>
            </div>
            {goldItems.map(item => renderItemRow(item, goldItems, setGoldItems, goldSpot, goldBuyPercent, 'yellow'))}
          </div>
        </div>
        
        {/* Silver Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-500 text-white p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold">Silver</span>
              <span className="text-sm">${silverSpot.toFixed(2)}/oz</span>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-80">{silverBuyPercent}% of spot</div>
              <div className="font-bold">${silverTotal.toFixed(2)}</div>
            </div>
          </div>
          <div className="p-2 bg-gray-50">
            <div className="flex items-center py-1 border-b border-gray-200 text-xs text-gray-500">
              <div className="w-28">Description</div>
              <div className="flex-1">Weight</div>
              <div className="w-28 text-right">Buy Price</div>
            </div>
            {silverItems.map(item => renderItemRow(item, silverItems, setSilverItems, silverSpot, silverBuyPercent, 'gray'))}
          </div>
        </div>
        
        {/* Platinum Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-400 text-white p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold">Platinum</span>
              <span className="text-sm">${platinumSpot.toFixed(2)}/oz</span>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-80">{platinumBuyPercent}% of spot</div>
              <div className="font-bold">${platinumTotal.toFixed(2)}</div>
            </div>
          </div>
          <div className="p-2 bg-gray-50">
            <div className="flex items-center py-1 border-b border-gray-200 text-xs text-gray-500">
              <div className="w-28">Description</div>
              <div className="flex-1">Weight</div>
              <div className="w-28 text-right">Buy Price</div>
            </div>
            {platinumItems.map(item => renderItemRow(item, platinumItems, setPlatinumItems, platinumSpot, platinumBuyPercent, 'gray'))}
          </div>
        </div>
        
        {/* Palladium Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-orange-500 text-white p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold">Palladium</span>
              <span className="text-sm">${palladiumSpot.toFixed(2)}/oz</span>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-80">{palladiumBuyPercent}% of spot</div>
              <div className="font-bold">${palladiumTotal.toFixed(2)}</div>
            </div>
          </div>
          <div className="p-2 bg-orange-50">
            <div className="flex items-center py-1 border-b border-orange-200 text-xs text-gray-500">
              <div className="w-28">Description</div>
              <div className="flex-1">Weight</div>
              <div className="w-28 text-right">Buy Price</div>
            </div>
            {palladiumItems.map(item => renderItemRow(item, palladiumItems, setPalladiumItems, palladiumSpot, palladiumBuyPercent, 'orange'))}
          </div>
        </div>
        
        {/* Last Update */}
        <div className="text-center text-xs text-gray-400 py-2">
          Last updated: {lastUpdate.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

// ============ SPOT VALUE VIEW ============
function SpotValueView({ inventory, onBack, liveSpotPrices }) {
  // Use live prices if available, otherwise fall back to defaults
  const currentPrices = liveSpotPrices || spotPrices;
  const spotValues = calculateSpotValues(inventory, currentPrices);
  const available = inventory.filter(i => i.status === 'Available');
  
  const totalSpotValue = Object.values(spotValues).reduce((sum, m) => sum + m.spotValue, 0);
  const totalCost = available.reduce((sum, i) => sum + (i.purchasePrice || 0), 0);
  const totalMeltValue = available.reduce((sum, i) => sum + (i.meltValue || 0), 0);
  const unrealizedGain = totalSpotValue - totalCost;
  
  const metals = ['Gold', 'Silver', 'Platinum', 'Palladium'].filter(m => spotValues[m].items > 0);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-yellow-600 to-yellow-700 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack}>← Back</button>
          <h1 className="text-xl font-bold flex items-center gap-2"><DollarSign size={24} /> Spot Values</h1>
          <div className="w-16"></div>
        </div>
      </div>
      
      <div className="p-4 space-y-4 pb-8">
        {/* Current Spot Prices */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-800 mb-3">Current Spot Prices</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              <div className="text-xs text-yellow-700">Gold</div>
              <div className="text-xl font-bold text-yellow-700">${currentPrices.gold.toLocaleString()}<span className="text-sm font-normal">/oz</span></div>
            </div>
            <div className="bg-gray-100 p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-600">Silver</div>
              <div className="text-xl font-bold text-gray-700">${currentPrices.silver.toFixed(2)}<span className="text-sm font-normal">/oz</span></div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-600">Platinum</div>
              <div className="text-xl font-bold text-gray-700">${currentPrices.platinum.toLocaleString()}<span className="text-sm font-normal">/oz</span></div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-600">Palladium</div>
              <div className="text-xl font-bold text-gray-700">${currentPrices.palladium.toLocaleString()}<span className="text-sm font-normal">/oz</span></div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Live prices from goldprice.org</p>
        </div>
        
        {/* Total Summary */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg shadow p-4 text-white">
          <h3 className="font-bold mb-3">Inventory Spot Value Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs opacity-80">Total Spot Value</div>
              <div className="text-2xl font-bold">${totalSpotValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <div>
              <div className="text-xs opacity-80">Total Cost Basis</div>
              <div className="text-2xl font-bold">${totalCost.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs opacity-80">Unrealized Gain</div>
              <div className={`text-2xl font-bold ${unrealizedGain >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                {unrealizedGain >= 0 ? '+' : ''}${unrealizedGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-xs opacity-80">Items in Stock</div>
              <div className="text-2xl font-bold">{available.length}</div>
            </div>
          </div>
        </div>
        
        {/* Breakdown by Metal */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-800 mb-3">Value by Metal Type</h3>
          
          {metals.length === 0 ? (
            <p className="text-gray-400 text-sm">No items with precious metal content in inventory</p>
          ) : (
            <div className="space-y-4">
              {metals.map(metal => {
                const data = spotValues[metal];
                const percentage = totalSpotValue > 0 ? (data.spotValue / totalSpotValue * 100) : 0;
                const barColor = metal === 'Gold' ? 'bg-yellow-400' : 
                                 metal === 'Silver' ? 'bg-gray-400' : 
                                 metal === 'Platinum' ? 'bg-gray-300' : 'bg-orange-300';
                
                return (
                  <div key={metal}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${barColor}`}></div>
                        <span className="font-medium">{metal}</span>
                      </div>
                      <span className="font-bold">${data.spotValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-1">
                      <div className={`h-3 rounded-full ${barColor}`} style={{ width: `${percentage}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{data.weightOz.toFixed(2)} oz pure • {data.items} items</span>
                      <span>{percentage.toFixed(1)}% of total</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Detailed Breakdown Table */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-800 mb-3">Detailed Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Metal</th>
                  <th className="text-right py-2">Pure Oz</th>
                  <th className="text-right py-2">Spot $/oz</th>
                  <th className="text-right py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {['Gold', 'Silver', 'Platinum', 'Palladium'].map(metal => {
                  const data = spotValues[metal];
                  if (data.items === 0) return null;
                  return (
                    <tr key={metal} className="border-b last:border-0">
                      <td className="py-2 font-medium">{metal}</td>
                      <td className="py-2 text-right">{data.weightOz.toFixed(3)}</td>
                      <td className="py-2 text-right">${currentPrices[metal.toLowerCase()].toLocaleString()}</td>
                      <td className="py-2 text-right font-bold">${data.spotValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-bold">
                  <td className="py-2">TOTAL</td>
                  <td className="py-2 text-right">—</td>
                  <td className="py-2 text-right">—</td>
                  <td className="py-2 text-right">${totalSpotValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Note about melt vs spot */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Spot Value = pure metal weight × current spot price. 
            Your recorded Melt Value (${totalMeltValue.toLocaleString()}) may differ based on refiner rates and when items were added.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============ HOLD STATUS VIEW ============
function HoldStatusView({ inventory, onBack, onSelectItem, onReleaseFromHold }) {
  const available = inventory.filter(i => i.status === 'Available');
  const [showReleaseModal, setShowReleaseModal] = useState(null); // holds item to release
  const [releaseReason, setReleaseReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  
  // Group items by hold status
  const onHold = [];
  const readyToSell = [];
  const exempt = [];
  
  available.forEach(item => {
    const holdStatus = getHoldStatus(item);
    if (holdStatus.status === 'exempt') {
      exempt.push({ ...item, holdStatus });
    } else if (holdStatus.status === 'hold') {
      onHold.push({ ...item, holdStatus });
    } else {
      // 'released' status - either naturally or manually
      readyToSell.push({ ...item, holdStatus });
    }
  });
  
  // Sort on-hold items by days remaining
  onHold.sort((a, b) => a.holdStatus.daysLeft - b.holdStatus.daysLeft);
  
  const handleReleaseConfirm = () => {
    if (!showReleaseModal || !releaseReason) return;
    
    const reason = releaseReason === 'Other' ? (otherReason || 'Other') : releaseReason;
    onReleaseFromHold(showReleaseModal.id, reason);
    setShowReleaseModal(null);
    setReleaseReason('');
    setOtherReason('');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-purple-700 to-purple-800 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack}>← Back</button>
          <h1 className="text-xl font-bold flex items-center gap-2"><Clock size={24} /> Hold Status</h1>
          <div className="w-16"></div>
        </div>
      </div>
      
      <div className="p-4 space-y-4 pb-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <Lock className="mx-auto text-red-500 mb-1" size={20} />
            <div className="text-2xl font-bold text-red-600">{onHold.length}</div>
            <div className="text-xs text-red-600">On Hold</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <Unlock className="mx-auto text-green-500 mb-1" size={20} />
            <div className="text-2xl font-bold text-green-600">{readyToSell.length}</div>
            <div className="text-xs text-green-600">Ready to Sell</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <ShieldCheck className="mx-auto text-blue-500 mb-1" size={20} />
            <div className="text-2xl font-bold text-blue-600">{exempt.length}</div>
            <div className="text-xs text-blue-600">Coins (Exempt)</div>
          </div>
        </div>
        
        {/* Legal Reference */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            <strong>NC Statute:</strong> 7 business day hold required for precious metals (jewelry, flatware, etc.). 
            <strong> Exempt:</strong> Coins, medals, medallions, tokens, numismatic items, bullion per N.C.G.S. § 66-406.
          </p>
        </div>
        
        {/* On Hold Section */}
        {onHold.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-3 border-b bg-red-50">
              <h3 className="font-bold text-red-700 flex items-center gap-2">
                <Lock size={18} /> On Hold ({onHold.length})
              </h3>
            </div>
            <div className="divide-y">
              {onHold.map(item => (
                <div key={item.id} className="p-3">
                  <div className="flex justify-between items-start">
                    <div onClick={() => onSelectItem(item)} className="cursor-pointer hover:text-amber-700 flex-1">
                      <div className="font-medium">{item.description}</div>
                      <div className="text-sm text-gray-500">{item.category}</div>
                      <div className="text-xs text-gray-400">Acquired: {item.dateAcquired}</div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-bold">
                        {item.holdStatus.daysLeft} day{item.holdStatus.daysLeft > 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-gray-400">
                        Release: {item.holdStatus.releaseDate?.toLocaleDateString()}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowReleaseModal(item);
                        }}
                        className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 flex items-center gap-1"
                      >
                        <Unlock size={12} /> Release Early
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Release from Hold Modal */}
        {showReleaseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-4">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <Unlock size={20} className="text-amber-600" /> Release from Hold
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Release <strong>{showReleaseModal.description}</strong> from hold early?
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> NC law requires a 10-day hold on secondhand goods from the public. 
                  Only release early if you have a valid reason.
                </p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Reason for Early Release:</label>
                <select
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  className="w-full border rounded-lg p-2 bg-white"
                >
                  <option value="">Select a reason...</option>
                  <option value="Hold Not Required">Hold Not Required (exempt item type)</option>
                  <option value="Already Met Hold">Already Met Hold (acquired earlier than recorded)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              {releaseReason === 'Other' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Specify Reason:</label>
                  <input
                    type="text"
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    className="w-full border rounded-lg p-2"
                    placeholder="Enter reason..."
                  />
                </div>
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowReleaseModal(null);
                    setReleaseReason('');
                    setOtherReason('');
                  }}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReleaseConfirm}
                  disabled={!releaseReason || (releaseReason === 'Other' && !otherReason.trim())}
                  className={`flex-1 py-2 rounded-lg font-medium ${
                    releaseReason && (releaseReason !== 'Other' || otherReason.trim())
                      ? 'bg-amber-600 text-white hover:bg-amber-700'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  Release from Hold
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Ready to Sell Section */}
        {readyToSell.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-3 border-b bg-green-50">
              <h3 className="font-bold text-green-700 flex items-center gap-2">
                <Unlock size={18} /> Ready to Sell ({readyToSell.length})
              </h3>
            </div>
            <div className="divide-y">
              {readyToSell.map(item => (
                <div key={item.id} onClick={() => onSelectItem(item)} className="p-3 cursor-pointer hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{item.description}</div>
                      <div className="text-sm text-gray-500">{item.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm font-medium">
                        ✓ Available
                      </div>
                      <div className="text-sm font-bold text-amber-700">${item.meltValue}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Exempt Section */}
        {exempt.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-3 border-b bg-blue-50">
              <h3 className="font-bold text-blue-700 flex items-center gap-2">
                <ShieldCheck size={18} /> Coins/Bullion - No Hold ({exempt.length})
              </h3>
            </div>
            <div className="divide-y">
              {exempt.map(item => (
                <div key={item.id} onClick={() => onSelectItem(item)} className="p-3 cursor-pointer hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{item.description}</div>
                      <div className="text-sm text-gray-500">{item.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                        EXEMPT
                      </div>
                      <div className="text-sm font-bold text-amber-700">${item.meltValue}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {available.length === 0 && (
          <div className="text-center text-gray-500 py-8">No items in inventory</div>
        )}
      </div>
    </div>
  );
}

// ============ SIGNATURE PAD COMPONENT ============
function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [location, setLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(true);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy });
          setGettingLocation(false);
        },
        () => setGettingLocation(false),
        { enableHighAccuracy: true }
      );
    } else {
      setGettingLocation(false);
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const coords = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const coords = getCoords(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const timestamp = new Date().toISOString();
    const signatureData = canvasRef.current.toDataURL('image/png').split(',')[1];
    onSave({
      signature: signatureData,
      timestamp,
      location: location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Location unavailable',
      locationAccuracy: location?.accuracy
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
          <h3 className="font-bold text-lg">Seller Certification</h3>
          <button onClick={onCancel}><X size={24} /></button>
        </div>
        
        <div className="p-4">
          {/* Certification Text */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-48 overflow-y-auto">
            <p className="text-xs text-gray-700 whitespace-pre-line">{NC_SELLER_CERTIFICATION}</p>
          </div>
          
          {/* Timestamp and Location */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-sm text-blue-800 mb-1">
              <Calendar size={14} />
              <span>{new Date().toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <MapPin size={14} />
              {gettingLocation ? (
                <span className="flex items-center gap-1"><Loader className="animate-spin" size={12} /> Getting location...</span>
              ) : location ? (
                <span>{location.lat.toFixed(4)}, {location.lng.toFixed(4)} (±{Math.round(location.accuracy)}m)</span>
              ) : (
                <span className="text-red-500">Location unavailable</span>
              )}
            </div>
          </div>
          
          <p className="text-sm font-medium mb-2">Sign below to certify:</p>
          
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="w-full touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
        </div>
        
        <div className="p-4 border-t flex gap-2 sticky bottom-0 bg-white">
          <button onClick={clearSignature} className="flex-1 border py-2 rounded">Clear</button>
          <button onClick={onCancel} className="flex-1 border py-2 rounded">Cancel</button>
          <button onClick={saveSignature} className="flex-1 bg-green-600 text-white py-2 rounded">Sign & Certify</button>
        </div>
      </div>
    </div>
  );
}

// ============ CLIENT VIEWS ============
function ClientListView({ clients, onSelect, onAdd, onBack }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  const filtered = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone?.includes(searchTerm);
    const matchesType = filterType === 'all' || c.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-800 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack}>← Back</button>
          <h1 className="text-xl font-bold flex items-center gap-2"><Users size={24} /> Clients</h1>
          <button onClick={onAdd} className="p-2"><UserPlus size={20} /></button>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border rounded-lg px-3 bg-white">
            <option value="all">All</option>
            <option value="Private">Private</option>
            <option value="Business">Business</option>
          </select>
        </div>
        
        <div className="space-y-2">
          {filtered.map(client => (
            <div key={client.id} onClick={() => onSelect(client)} className="bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${client.type === 'Business' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {client.type === 'Business' ? <Building size={20} /> : <User size={20} />}
                  </div>
                  <div>
                    <div className="font-medium">{client.name}</div>
                    <div className="text-sm text-gray-500">{client.phone}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xs px-2 py-1 rounded ${client.type === 'Business' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{client.type}</div>
                </div>
              </div>
              {(!client.idFrontPhoto || !client.signature) && (
                <div className="mt-2 flex gap-2">
                  {!client.idFrontPhoto && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">ID Missing</span>}
                  {!client.signature && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">No Signature</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <button onClick={onAdd} className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg"><UserPlus size={24} /></button>
    </div>
  );
}

function ClientFormView({ client, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(client || {
    name: '', type: 'Private', email: '', phone: '', address: '',
    idType: 'NC Driver License', idNumber: '', idExpiry: '',
    businessLicense: '', taxId: '',
    idFrontPhoto: null, idBackPhoto: null,
    signature: null, signatureTimestamp: null, signatureLocation: null,
    notes: '', dateAdded: new Date().toISOString().split('T')[0],
    totalTransactions: 0, totalPurchased: 0
  });
  
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);
  
  const handlePhotoCapture = (side) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result.split(',')[1];
      setForm(prev => ({ ...prev, [side === 'front' ? 'idFrontPhoto' : 'idBackPhoto']: base64 }));
    };
    reader.readAsDataURL(file);
  };
  
  const handleSignatureSave = (sigData) => {
    setForm(prev => ({
      ...prev,
      signature: sigData.signature,
      signatureTimestamp: sigData.timestamp,
      signatureLocation: sigData.location
    }));
    setShowSignaturePad(false);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-indigo-700 text-white p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">{client ? 'Edit Client' : 'New Client'}</h1>
          <button onClick={onCancel}><X size={24} /></button>
        </div>
      </div>
      
      <div className="p-4 space-y-4 pb-8">
        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <h3 className="font-bold">Basic Information</h3>
          <div>
            <label className="block text-sm font-medium mb-1">Full Name / Business Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full border rounded p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Seller Type</label>
            <div className="flex gap-2">
              <button onClick={() => setForm({...form, type: 'Private'})} className={`flex-1 py-2 rounded flex items-center justify-center gap-2 ${form.type === 'Private' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}><User size={18} /> Private</button>
              <button onClick={() => setForm({...form, type: 'Business'})} className={`flex-1 py-2 rounded flex items-center justify-center gap-2 ${form.type === 'Business' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}><Building size={18} /> Business</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="w-full border rounded p-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full border rounded p-2" /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Address</label><input type="text" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} className="w-full border rounded p-2" /></div>
        </div>
        
        {/* ID Information */}
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <h3 className="font-bold flex items-center gap-2"><CreditCard size={18} /> Identification</h3>
          {form.type === 'Private' ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">ID Type</label>
                <select value={form.idType} onChange={(e) => setForm({...form, idType: e.target.value})} className="w-full border rounded p-2 bg-white">
                  <option>NC Driver License</option><option>NC State ID</option><option>US Passport</option><option>Military ID</option><option>Other State ID</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">ID Number</label><input type="text" value={form.idNumber} onChange={(e) => setForm({...form, idNumber: e.target.value})} className="w-full border rounded p-2" /></div>
                <div><label className="block text-sm font-medium mb-1">Expiration</label><input type="date" value={form.idExpiry} onChange={(e) => setForm({...form, idExpiry: e.target.value})} className="w-full border rounded p-2" /></div>
              </div>
            </>
          ) : (
            <>
              <div><label className="block text-sm font-medium mb-1">Business License #</label><input type="text" value={form.businessLicense} onChange={(e) => setForm({...form, businessLicense: e.target.value})} className="w-full border rounded p-2" /></div>
              <div><label className="block text-sm font-medium mb-1">Tax ID (last 4)</label><input type="text" value={form.taxId} onChange={(e) => setForm({...form, taxId: e.target.value})} className="w-full border rounded p-2" /></div>
            </>
          )}
        </div>
        
        {/* ID Photos */}
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <h3 className="font-bold flex items-center gap-2"><Camera size={18} /> ID Photos</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Front of ID</label>
              <input type="file" accept="image/*" capture="environment" ref={frontInputRef} onChange={handlePhotoCapture('front')} className="hidden" />
              {form.idFrontPhoto ? (
                <div className="relative">
                  <img src={`data:image/jpeg;base64,${form.idFrontPhoto}`} alt="ID Front" className="w-full h-24 object-cover rounded-lg" />
                  <button onClick={() => setForm({...form, idFrontPhoto: null})} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><X size={12} /></button>
                </div>
              ) : (
                <button onClick={() => frontInputRef.current?.click()} className="w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-400">
                  <Camera size={24} /><span className="text-xs mt-1">Front</span>
                </button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Back of ID</label>
              <input type="file" accept="image/*" capture="environment" ref={backInputRef} onChange={handlePhotoCapture('back')} className="hidden" />
              {form.idBackPhoto ? (
                <div className="relative">
                  <img src={`data:image/jpeg;base64,${form.idBackPhoto}`} alt="ID Back" className="w-full h-24 object-cover rounded-lg" />
                  <button onClick={() => setForm({...form, idBackPhoto: null})} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><X size={12} /></button>
                </div>
              ) : (
                <button onClick={() => backInputRef.current?.click()} className="w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-400">
                  <Camera size={24} /><span className="text-xs mt-1">Back</span>
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Signature */}
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <h3 className="font-bold flex items-center gap-2"><Edit2 size={18} /> Seller Certification</h3>
          {form.signature ? (
            <div>
              <div className="border rounded-lg p-2 bg-gray-50">
                <img src={`data:image/png;base64,${form.signature}`} alt="Signature" className="w-full h-16 object-contain" />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <div className="flex items-center gap-1"><Calendar size={12} />{form.signatureTimestamp ? new Date(form.signatureTimestamp).toLocaleString() : '—'}</div>
                <div className="flex items-center gap-1"><MapPin size={12} />{form.signatureLocation || '—'}</div>
              </div>
              <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-700">✓ NC Seller Certification on file</div>
              <button onClick={() => setShowSignaturePad(true)} className="w-full mt-2 border py-2 rounded text-sm">Capture New Signature</button>
            </div>
          ) : (
            <button onClick={() => setShowSignaturePad(true)} className="w-full py-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-400">
              <Edit2 size={24} /><span className="text-sm mt-1">Tap to Capture Signature & Certification</span>
            </button>
          )}
        </div>
        
        <div><label className="block text-sm font-medium mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="w-full border rounded p-2" rows={2} /></div>
        
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 border py-3 rounded-lg">Cancel</button>
          <button onClick={() => { if (form.name) onSave(form); }} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg">{client ? 'Update' : 'Add Client'}</button>
        </div>
        
        {client && onDelete && (
          <button onClick={() => { if (confirm('Delete client?')) onDelete(client.id); }} className="w-full border border-red-300 text-red-600 py-2 rounded-lg">Delete Client</button>
        )}
      </div>
      
      {showSignaturePad && <SignaturePad onSave={handleSignatureSave} onCancel={() => setShowSignaturePad(false)} />}
    </div>
  );
}

function ClientDetailView({ client, transactions, onEdit, onBack }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-indigo-700 text-white p-4 flex justify-between">
        <button onClick={onBack}>← Back</button>
        <button onClick={onEdit}><Edit2 size={20} /></button>
      </div>
      
      <div className="p-4 space-y-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${client.type === 'Business' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
              {client.type === 'Business' ? <Building size={32} /> : <User size={32} />}
            </div>
            <div>
              <h2 className="text-xl font-bold">{client.name}</h2>
              <div className={`inline-block text-xs px-2 py-1 rounded ${client.type === 'Business' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{client.type} Seller</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-gray-50 p-3 rounded"><div className="text-xs text-gray-500">Transactions</div><div className="text-xl font-bold">{client.totalTransactions}</div></div>
            <div className="bg-gray-50 p-3 rounded"><div className="text-xs text-gray-500">Total Purchased</div><div className="text-xl font-bold text-green-600">${client.totalPurchased?.toLocaleString()}</div></div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">Contact</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b"><span className="text-gray-500">Phone</span><span>{client.phone || '—'}</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-gray-500">Email</span><span>{client.email || '—'}</span></div>
            <div className="flex justify-between py-2"><span className="text-gray-500">Address</span><span className="text-right max-w-[180px]">{client.address || '—'}</span></div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">Identification</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b"><span className="text-gray-500">ID Type</span><span>{client.idType || '—'}</span></div>
            <div className="flex justify-between py-2"><span className="text-gray-500">ID Number</span><span>{client.idNumber || '—'}</span></div>
          </div>
          {(client.idFrontPhoto || client.idBackPhoto) && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {client.idFrontPhoto && <img src={`data:image/jpeg;base64,${client.idFrontPhoto}`} alt="ID Front" className="w-full h-20 object-cover rounded" />}
              {client.idBackPhoto && <img src={`data:image/jpeg;base64,${client.idBackPhoto}`} alt="ID Back" className="w-full h-20 object-cover rounded" />}
            </div>
          )}
        </div>
        
        {client.signature && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3">Seller Certification</h3>
            <div className="border rounded-lg p-2 bg-gray-50">
              <img src={`data:image/png;base64,${client.signature}`} alt="Signature" className="w-full h-16 object-contain" />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <div className="flex items-center gap-1"><Calendar size={12} />{client.signatureTimestamp ? new Date(client.signatureTimestamp).toLocaleString() : '—'}</div>
              <div className="flex items-center gap-1"><MapPin size={12} />{client.signatureLocation || '—'}</div>
            </div>
            <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-700">✓ NC Anti-Theft/AML Certification on file</div>
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">Transaction History</h3>
          {transactions.length === 0 ? (
            <p className="text-gray-400 text-sm">No transactions</p>
          ) : (
            <div className="space-y-2">
              {transactions.map(txn => (
                <div key={txn.id} className="py-2 border-b last:border-0">
                  <div className="flex justify-between"><span className="font-medium text-sm">{txn.description}</span><span className="text-green-600">${txn.purchasePrice}</span></div>
                  <div className="text-xs text-gray-400">{txn.dateAcquired} • {txn.category}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Appraisal History - including declined offers */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">Appraisal History</h3>
          {(!client.appraisals || client.appraisals.length === 0) ? (
            <p className="text-gray-400 text-sm">No appraisals on file</p>
          ) : (
            <div className="space-y-3">
              {client.appraisals.sort((a, b) => new Date(b.date) - new Date(a.date)).map(apr => (
                <details key={apr.id} className="border rounded-lg overflow-hidden">
                  <summary className={`p-3 cursor-pointer flex items-center justify-between ${
                    apr.status === 'declined' ? 'bg-amber-50' : 'bg-green-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        apr.status === 'declined' 
                          ? 'bg-amber-200 text-amber-800' 
                          : 'bg-green-200 text-green-800'
                      }`}>
                        {apr.status === 'declined' ? 'DECLINED' : 'PURCHASED'}
                      </span>
                      <span className="text-sm font-medium">
                        {new Date(apr.date).toLocaleDateString()}
                      </span>
                    </div>
                    <span className={`font-bold ${apr.status === 'declined' ? 'text-amber-600' : 'text-green-600'}`}>
                      ${apr.status === 'declined' ? (apr.totalOffered || 0).toFixed(2) : (apr.totalPaid || 0).toFixed(2)}
                    </span>
                  </summary>
                  <div className="p-3 bg-gray-50 border-t">
                    <div className="text-xs text-gray-500 mb-2">
                      {apr.items?.length || apr.itemCount || 0} items
                      {apr.status === 'declined' && ' • Client declined this offer'}
                    </div>
                    {apr.items && apr.items.length > 0 && (
                      <div className="space-y-1">
                        {apr.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm py-1 border-b border-gray-200 last:border-0">
                            <span className="text-gray-700">
                              {item.description}
                              {item.quantity > 1 && <span className="text-gray-400"> ×{item.quantity}</span>}
                            </span>
                            <span className="text-gray-600">
                              ${(item.offeredPrice || item.purchasePrice || 0).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {apr.notes && (
                      <div className="mt-2 text-xs text-gray-500 italic">
                        Notes: {apr.notes}
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ SIMPLIFIED OTHER VIEWS ============
function DashboardView({ inventory, onBack }) {
  // Filter by status
  const sold = inventory.filter(i => i.status === 'Sold');
  const available = inventory.filter(i => i.status === 'Available');
  const stash = inventory.filter(i => i.status === 'Stash');
  
  // Counts
  const soldCount = sold.length;
  const availableCount = available.length;
  const stashCount = stash.length;
  
  // Hold status counts
  const onHoldItems = available.filter(i => getHoldStatus(i).status === 'hold');
  const readyToSellItems = available.filter(i => getHoldStatus(i).status === 'released');
  const exemptItems = available.filter(i => getHoldStatus(i).status === 'exempt');
  const onHoldCount = onHoldItems.length;
  const readyToSellCount = readyToSellItems.length;
  const exemptCount = exemptItems.length;
  
  // Financial - Sales
  const totalRevenue = sold.reduce((s, i) => s + (parseFloat(i.salePrice) || 0), 0);
  const soldCost = sold.reduce((s, i) => s + (parseFloat(i.purchasePrice) || 0), 0);
  const realizedProfit = totalRevenue - soldCost;
  const avgMargin = soldCost > 0 ? ((realizedProfit / soldCost) * 100) : 0;
  
  // Financial - Inventory
  const totalCost = available.reduce((s, i) => s + (parseFloat(i.purchasePrice) || 0), 0);
  const totalMeltValue = available.reduce((s, i) => s + (parseFloat(i.meltValue) || 0), 0);
  const unrealizedGain = totalMeltValue - totalCost;
  const roi = totalCost > 0 ? ((unrealizedGain / totalCost) * 100) : 0;
  
  // Capital deployed (available inventory cost)
  const capitalDeployed = totalCost;
  
  // Total profit (realized)
  const totalProfit = realizedProfit;
  
  // Metal breakdown
  const metalBreakdown = ['Gold', 'Silver', 'Platinum', 'Palladium'].map(metal => {
    const items = available.filter(i => i.metalType === metal);
    return {
      name: metal,
      count: items.length,
      weight: items.reduce((s, i) => s + (parseFloat(i.weightOz) || 0), 0),
      value: items.reduce((s, i) => s + (parseFloat(i.meltValue) || 0), 0),
      cost: items.reduce((s, i) => s + (parseFloat(i.purchasePrice) || 0), 0)
    };
  }).filter(m => m.count > 0);
  
  // Top items by value
  const topItems = [...available]
    .sort((a, b) => (parseFloat(b.meltValue) || 0) - (parseFloat(a.meltValue) || 0))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-amber-700 to-amber-800 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack}>← Back</button>
          <h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 size={24} /> Analytics</h1>
          <div className="w-16"></div>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500">Total Profit</div>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalProfit.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500">Capital Deployed</div>
            <div className="text-2xl font-bold text-amber-700">${capitalDeployed.toLocaleString()}</div>
          </div>
        </div>
        
        {/* Inventory Overview */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Package size={18} /> Inventory Overview
          </h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">{availableCount}</div>
              <div className="text-xs text-gray-500">Available</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600">{onHoldCount}</div>
              <div className="text-xs text-gray-500">On Hold</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{soldCount}</div>
              <div className="text-xs text-gray-500">Sold</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-600">{stashCount}</div>
              <div className="text-xs text-gray-500">Stash</div>
            </div>
          </div>
        </div>
        
        {/* Financial Summary */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <DollarSign size={18} /> Financial Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Total Cost Basis</span>
              <span className="font-bold">${totalCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Current Melt Value</span>
              <span className="font-bold text-amber-700">${totalMeltValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Unrealized Gain/Loss</span>
              <span className={`font-bold ${unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {unrealizedGain >= 0 ? '+' : ''}${unrealizedGain.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">ROI</span>
              <span className={`font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        
        {/* Sales Performance */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp size={18} /> Sales Performance
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Items Sold</div>
              <div className="text-xl font-bold">{soldCount}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Revenue</div>
              <div className="text-xl font-bold text-green-600">${totalRevenue.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Realized Profit</div>
              <div className={`text-xl font-bold ${realizedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${realizedProfit.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Avg Margin</div>
              <div className={`text-xl font-bold ${avgMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {avgMargin.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
        
        {/* Inventory by Metal */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-700 mb-3">Inventory by Metal</h3>
          <div className="space-y-3">
            {metalBreakdown.map(metal => (
              <div key={metal.name} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  metal.name === 'Gold' ? 'bg-yellow-500' :
                  metal.name === 'Silver' ? 'bg-gray-400' :
                  metal.name === 'Platinum' ? 'bg-gray-300' :
                  'bg-orange-400'
                }`}></div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="font-medium">{metal.name}</span>
                    <span className="font-bold">${metal.value.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{metal.count} items</span>
                    <span>{metal.weight.toFixed(2)} oz</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className={`h-2 rounded-full ${
                        metal.name === 'Gold' ? 'bg-yellow-500' :
                        metal.name === 'Silver' ? 'bg-gray-400' :
                        metal.name === 'Platinum' ? 'bg-gray-300' :
                        'bg-orange-400'
                      }`}
                      style={{ width: `${totalMeltValue > 0 ? (metal.value / totalMeltValue * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Hold Status */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Clock size={18} /> Hold Status
          </h3>
          <div className="flex gap-2">
            <div className="flex-1 bg-red-50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                <Lock size={16} />
                <span className="text-xl font-bold">{onHoldCount}</span>
              </div>
              <div className="text-xs text-gray-500">On Hold</div>
            </div>
            <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                <Unlock size={16} />
                <span className="text-xl font-bold">{readyToSellCount}</span>
              </div>
              <div className="text-xs text-gray-500">Ready to Sell</div>
            </div>
            <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                <ShieldCheck size={16} />
                <span className="text-xl font-bold">{exemptCount}</span>
              </div>
              <div className="text-xs text-gray-500">Exempt</div>
            </div>
          </div>
        </div>
        
        {/* Top Items by Value */}
        {topItems.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-700 mb-3">Top Items by Value</h3>
            <div className="space-y-2">
              {topItems.map((item, index) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b last:border-b-0">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.description}</div>
                    <div className="text-xs text-gray-500">{item.metalType} • {item.weightOz} oz</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-700">${item.meltValue}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaxReportView({ inventory, onBack }) {
  const yearSales = inventory.filter(i => i.status === 'Sold');
  const totalRevenue = yearSales.reduce((s, i) => s + (i.salePrice || 0), 0);
  const totalCOGS = yearSales.reduce((s, i) => s + (i.purchasePrice || 0), 0);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-green-700 to-green-800 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack}>← Back</button>
          <h1 className="text-xl font-bold flex items-center gap-2"><FileText size={24} /> Tax</h1>
          <div className="w-16"></div>
        </div>
      </div>
      <div className="p-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">Schedule C Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b"><span>Gross Receipts</span><span className="font-bold">${totalRevenue.toLocaleString()}</span></div>
            <div className="flex justify-between py-2 border-b"><span>COGS</span><span className="font-bold">${totalCOGS.toLocaleString()}</span></div>
            <div className="flex justify-between py-2"><span className="font-bold">Gross Profit</span><span className={`font-bold ${(totalRevenue - totalCOGS) >= 0 ? 'text-green-600' : 'text-red-600'}`}>${(totalRevenue - totalCOGS).toLocaleString()}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// eBay Listings Management View
function EbayListingsView({ inventory, onBack, onSelectItem, onListItem }) {
  const [activeTab, setActiveTab] = useState('unlisted'); // 'listed' or 'unlisted'
  const [searchTerm, setSearchTerm] = useState('');
  
  const listedItems = inventory.filter(i => i.ebayListingId);
  const unlistedItems = inventory.filter(i => i.status === 'Available' && !i.ebayListingId);
  
  const displayItems = activeTab === 'listed' ? listedItems : unlistedItems;
  const filteredItems = displayItems.filter(item => 
    item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="flex items-center gap-1">
            ← Back
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ExternalLink size={24} /> eBay Listings
          </h1>
          <div className="w-16"></div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-500 bg-opacity-50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold">{listedItems.length}</div>
            <div className="text-blue-200 text-sm">Listed on eBay</div>
          </div>
          <div className="bg-blue-500 bg-opacity-50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold">{unlistedItems.length}</div>
            <div className="text-blue-200 text-sm">Ready to List</div>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b bg-white">
        <button
          onClick={() => setActiveTab('unlisted')}
          className={`flex-1 py-3 text-center font-medium ${
            activeTab === 'unlisted' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500'
          }`}
        >
          Not Listed ({unlistedItems.length})
        </button>
        <button
          onClick={() => setActiveTab('listed')}
          className={`flex-1 py-3 text-center font-medium ${
            activeTab === 'listed' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500'
          }`}
        >
          Listed ({listedItems.length})
        </button>
      </div>
      
      {/* Search */}
      <div className="p-3 bg-white border-b">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
      </div>
      
      {/* Items List */}
      <div className="p-3 space-y-2">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {activeTab === 'listed' 
              ? 'No items listed on eBay yet' 
              : 'All items have been listed!'}
          </div>
        ) : (
          filteredItems.map(item => (
            <div 
              key={item.id} 
              className="bg-white rounded-lg shadow p-3 flex items-center gap-3"
            >
              {/* Thumbnail */}
              {item.photo ? (
                <img 
                  src={`data:image/jpeg;base64,${item.photo}`} 
                  className="w-16 h-16 object-cover rounded"
                  alt={item.description}
                />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                  <Package size={24} className="text-gray-400" />
                </div>
              )}
              
              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.description}</div>
                <div className="text-sm text-gray-500">{item.id}</div>
                {item.ebayListingId && (
                  <a 
                    href={item.ebayUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> #{item.ebayListingId}
                  </a>
                )}
              </div>
              
              {/* Price & Action */}
              <div className="text-right">
                <div className="font-bold text-amber-700">${item.meltValue}</div>
                {!item.ebayListingId && (
                  <button
                    onClick={() => onListItem(item)}
                    className="mt-1 text-xs bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    List
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AddItemView({ onSave, onCancel, calculateMelt, clients, liveSpotPrices }) {
  const [form, setForm] = useState({ 
    description: '', category: 'Silver - Sterling', metalType: 'Silver', purity: '925', 
    weight: '', source: '', clientId: '', purchasePrice: '', meltValue: '', notes: '', 
    status: 'Available', dateAcquired: new Date().toISOString().split('T')[0],
    photo: null, photoBack: null, year: '', mint: '', grade: '', serialNumber: ''
  });
  const [weightUnit, setWeightUnit] = useState('g'); // 'g' for grams, 'oz' for troy ounces
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [captureStep, setCaptureStep] = useState('idle'); // idle, front, back, done
  
  // Conversion: 1 troy oz = 31.1035 grams
  const GRAMS_PER_OZ = 31.1035;
  
  // Get weight in oz for calculations
  const getWeightInOz = () => {
    const w = parseFloat(form.weight) || 0;
    return weightUnit === 'g' ? w / GRAMS_PER_OZ : w;
  };
  
  // Calculate melt value from metal type, purity, and weight
  const calculateMeltValue = (metalType, purity, weightOz) => {
    if (!weightOz || weightOz <= 0) return 0;
    
    const spot = liveSpotPrices?.[metalType?.toLowerCase()] || 0;
    if (!spot) return 0;
    
    // Parse purity
    let purityDecimal = 1;
    if (purity) {
      const p = purity.toString().toUpperCase();
      if (p.includes('K')) {
        // Karat gold: 24K = 1.0, 18K = 0.75, 14K = 0.583, 10K = 0.417
        const karat = parseInt(p.replace('K', ''));
        purityDecimal = karat / 24;
      } else if (p.includes('%')) {
        purityDecimal = parseFloat(p.replace('%', '')) / 100;
      } else {
        const num = parseFloat(p);
        if (num > 1) {
          purityDecimal = num / 1000; // 925 -> 0.925, 999 -> 0.999
        } else {
          purityDecimal = num;
        }
      }
    }
    
    return (weightOz * spot * purityDecimal).toFixed(2);
  };
  
  // Photo refs
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  
  const holdStatus = getHoldStatus(form);
  
  // AI Photo Analysis - analyzes both photos together
  const analyzePhotosWithAI = async (frontBase64, backBase64) => {
    setIsAnalyzing(true);
    setAiError(null);
    
    try {
      // Build content array with both images
      const content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: frontBase64
          }
        }
      ];
      
      // Add back photo if provided
      if (backBase64) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: backBase64
          }
        });
      }
      
      content.push({
        type: 'text',
        text: `Analyze ${backBase64 ? 'these two images (front and back)' : 'this image'} and identify the precious metal item.

CRITICAL - READ ALL TEXT IN THE IMAGE:
1. Look for HANDWRITTEN text (prices, notes, grades)
2. Look for PRINTED LABELS or STICKERS (price tags, inventory labels, maker's marks)
3. Look for HOLDER/SLAB information (PCGS, NGC, ANACS grades, certification numbers)
4. Look for 2x2 FLIP text (handwritten or typed descriptions)
5. Look for HALLMARKS on jewelry (14K, 18K, 925, 750, maker stamps)
6. Look for MINT MARKS or SERIAL NUMBERS on bullion bars

FOR COINS (if two images provided):
- Year (on coin or written on holder/flip)
- Mint mark (on coin OR written on holder/flip)
- Grade (from holder, slab, or flip - e.g., "PR69", "MS65", "Proof", "BU")
- Purchase price (often handwritten on flip or sticker)

FOR JEWELRY:
- Metal type and purity from hallmarks (14K, 18K, 10K, 925, STERLING)
- Style description (Cuban link, rope chain, tennis bracelet, etc.)
- Approximate weight category (light, medium, heavy)
- Any gemstones or diamonds visible
- Maker's marks or designer stamps

FOR BULLION BARS/ROUNDS:
- Manufacturer (Engelhard, Johnson Matthey, PAMP, Sunshine, etc.)
- Weight marking (1oz, 10oz, 100oz, etc.)
- Serial number if visible
- Purity marking (.999, .9999)

FOR FLATWARE/STERLING:
- Pattern name if identifiable
- Manufacturer (Gorham, Reed & Barton, Wallace, etc.)
- Sterling marks (925, STERLING, Lion hallmark)
- Piece type (fork, spoon, serving piece)

Return ONLY a valid JSON object (no markdown, no explanation) with these fields:
{
  "description": "Full description (e.g., '1976-S Washington Quarter Proof', '14K Yellow Gold Cuban Link Bracelet 7 inch', '10oz Engelhard Silver Bar')",
  "category": "One of: Coins - Silver, Coins - Gold, Silver - Sterling, Silver - Bullion, Gold - Jewelry, Gold - Bullion, Gold - Scrap, Platinum, Palladium, Other",
  "metalType": "Gold, Silver, Platinum, Palladium, or Other",
  "purity": "e.g., 999, 925, 14K, 10K, 18K, 90%, 40%",
  "estimatedWeightOz": number or null (estimate based on item type/size if possible),
  "year": "year if visible or applicable" or null,
  "mint": "mint mark if visible (P, D, S, O, CC, W)" or null,
  "grade": "grade from holder/flip/slab or condition assessment" or null,
  "purchasePrice": number or null (if a price is written/labeled, extract just the number),
  "serialNumber": "any serial numbers, certification numbers (NGC/PCGS cert#), hallmarks, maker marks" or null,
  "notes": "additional condition details or other observations",
  "confidence": "high, medium, or low"
}

Common weights reference:
- Morgan/Peace Dollar: 0.7734 oz ASW (90% silver)
- Washington Quarter (pre-1965): 0.1808 oz ASW
- 1976 Bicentennial Quarter (40% silver S-mint): 0.0739 oz ASW
- American Silver Eagle: 1.0 oz (999 fine)
- Average men's 14K gold chain (20"): 0.5-1.5 oz total weight
- Average women's 14K bracelet: 0.2-0.5 oz total weight

Return ONLY the JSON object.`
      });
      
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_tokens: 1024,
          system: `You are an expert numismatist and precious metals appraiser. Analyze coin images carefully, using BOTH sides when provided to accurately identify year, mint mark, and type.`,
          messages: [{
            role: 'user',
            content: content
          }]
        })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('API error:', response.status, errData);
        throw new Error(errData.details || errData.error || `API error ${response.status}`);
      }
      
      const data = await response.json();
      console.log('AI Response received:', JSON.stringify(data).substring(0, 500));
      
      // Extract text from response
      let aiText = data.content?.[0]?.text || data.response;
      if (!aiText) {
        console.error('No text in response:', data);
        throw new Error('No response from AI');
      }
      
      console.log('AI text:', aiText.substring(0, 300));
      
      // Clean up and parse JSON
      aiText = aiText.replace(/```json\n?|\n?```/g, '').trim();
      
      let aiResult;
      try {
        aiResult = JSON.parse(aiText);
      } catch (parseErr) {
        console.error('JSON parse failed:', parseErr, 'Text was:', aiText);
        throw new Error('Failed to parse AI response');
      }
      
      console.log('Parsed AI result:', aiResult);
      
      // Update form with AI results
      const weightOz = aiResult.estimatedWeightOz || 0;
      const weightGrams = weightOz ? (weightOz * GRAMS_PER_OZ).toFixed(2) : '';
      const meltVal = calculateMeltValue(aiResult.metalType, aiResult.purity, weightOz);
      
      setForm(prev => ({
        ...prev,
        description: aiResult.description || prev.description,
        category: aiResult.category || prev.category,
        metalType: aiResult.metalType || prev.metalType,
        purity: aiResult.purity || prev.purity,
        weight: weightGrams || prev.weight,
        year: aiResult.year || prev.year,
        mint: aiResult.mint || prev.mint,
        grade: aiResult.grade || prev.grade,
        purchasePrice: aiResult.purchasePrice || prev.purchasePrice,
        meltValue: meltVal || prev.meltValue,
        serialNumber: aiResult.serialNumber || prev.serialNumber,
        notes: aiResult.notes || prev.notes
      }));
      
    } catch (err) {
      console.error('AI analysis error:', err.message, err);
      setAiError(`AI analysis failed: ${err.message}. Please fill in details manually.`);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Handle photo capture - simple handler that uses captureStep state
  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result.split(',')[1];
      console.log('Photo captured, step:', captureStep, 'size:', Math.round(base64.length/1024), 'KB');
      
      if (captureStep === 'front') {
        setForm(prev => ({...prev, photo: base64}));
        setCaptureStep('idle');
      } else if (captureStep === 'back') {
        setForm(prev => ({...prev, photoBack: base64}));
        setCaptureStep('idle');
        // Auto-analyze after both photos captured
        const frontPhoto = form.photo;
        if (frontPhoto) {
          await analyzePhotosWithAI(frontPhoto, base64);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };
  
  // Handle unit change - convert the current value
  const handleUnitChange = (newUnit) => {
    if (newUnit === weightUnit) return;
    const currentWeight = parseFloat(form.weight) || 0;
    if (currentWeight > 0) {
      let newWeight;
      if (newUnit === 'g') {
        // Converting from oz to g
        newWeight = (currentWeight * GRAMS_PER_OZ).toFixed(2);
      } else {
        // Converting from g to oz
        newWeight = (currentWeight / GRAMS_PER_OZ).toFixed(4);
      }
      setForm({...form, weight: newWeight});
    }
    setWeightUnit(newUnit);
  };
  
  // Clear photos and re-analyze
  const clearPhotos = () => {
    setForm(prev => ({...prev, photo: null, photoBack: null}));
    setCaptureStep('idle');
    setAiError(null);
  };
  
  return (
    <div className="min-h-screen bg-amber-50">
      <div className="bg-amber-700 text-white p-4 flex justify-between"><h1 className="text-xl font-bold">Add Item</h1><button onClick={onCancel}><X size={24} /></button></div>
      <div className="p-4">
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          
          {/* AI Analysis Status */}
          {isAnalyzing && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <span className="text-teal-700 font-medium">AI analyzing your photo(s)...</span>
                <p className="text-teal-600 text-sm">Identifying item, reading labels, estimating value</p>
              </div>
            </div>
          )}
          
          {aiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {aiError}
            </div>
          )}
          
          {/* Photo Section */}
          <div>
            <label className="block text-sm font-medium mb-1">Photos</label>
            <p className="text-xs text-teal-600 mb-2">📸 Coins: take front + back | Jewelry/Bullion: one photo is fine</p>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Front Photo */}
              <div>
                <div className="text-xs text-gray-500 mb-1">① Main Photo</div>
                {form.photo ? (
                  <div className="relative">
                    <img src={`data:image/jpeg;base64,${form.photo}`} className="w-full h-28 object-cover rounded-lg border-2 border-green-400" />
                    <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                      <Check size={12} />
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => { setCaptureStep('front'); cameraRef.current?.click(); }}
                    disabled={isAnalyzing}
                    className="w-full h-28 border-2 border-dashed border-teal-400 bg-teal-50 rounded-lg flex flex-col items-center justify-center text-teal-700 hover:bg-teal-100 disabled:opacity-50"
                  >
                    <Camera size={24} />
                    <span className="text-xs font-medium mt-1">Tap to capture</span>
                  </button>
                )}
              </div>
              
              {/* Back Photo */}
              <div>
                <div className="text-xs text-gray-500 mb-1">② Back (optional)</div>
                {form.photoBack ? (
                  <div className="relative">
                    <img src={`data:image/jpeg;base64,${form.photoBack}`} className="w-full h-28 object-cover rounded-lg border-2 border-green-400" />
                    <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                      <Check size={12} />
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => { setCaptureStep('back'); cameraRef.current?.click(); }}
                    disabled={isAnalyzing || !form.photo}
                    className={`w-full h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center disabled:opacity-50 ${
                      form.photo 
                        ? 'border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100' 
                        : 'border-gray-300 bg-gray-50 text-gray-400'
                    }`}
                  >
                    <Camera size={24} />
                    <span className="text-xs font-medium mt-1">
                      {form.photo ? 'Add back (coins)' : 'Take main first'}
                    </span>
                  </button>
                )}
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-2">
              {(form.photo || form.photoBack) && (
                <button 
                  onClick={clearPhotos}
                  className="text-sm text-red-600 flex items-center gap-1"
                >
                  <X size={14} /> Clear
                </button>
              )}
              
              {/* Analyze button - available after just the front photo */}
              {form.photo && !isAnalyzing && (
                <button 
                  onClick={() => analyzePhotosWithAI(form.photo, form.photoBack)}
                  className="ml-auto text-sm bg-teal-600 text-white px-3 py-1 rounded flex items-center gap-1"
                >
                  <Zap size={14} /> {form.photoBack ? 'Analyze with AI' : 'Analyze (1 photo)'}
                </button>
              )}
            </div>
            
            {/* Hidden file inputs */}
            <input type="file" accept="image/*" capture="environment" ref={cameraRef} onChange={handlePhotoCapture} className="hidden" />
            <input type="file" accept="image/*" ref={galleryRef} onChange={handlePhotoCapture} className="hidden" />
          </div>
          
          <div><label className="block text-sm font-medium mb-1">Description *</label><input type="text" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="w-full border rounded p-2" /></div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Client/Seller</label>
            <select value={form.clientId} onChange={(e) => setForm({...form, clientId: e.target.value})} className="w-full border rounded p-2 bg-white">
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="w-full border rounded p-2 bg-white">
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium mb-1">Metal</label><select value={form.metalType} onChange={(e) => setForm({...form, metalType: e.target.value})} className="w-full border rounded p-2 bg-white"><option>Gold</option><option>Silver</option><option>Platinum</option><option>Palladium</option><option>Other</option></select></div>
          </div>
          
          {/* Hold Status Indicator */}
          <div className={`p-3 rounded-lg ${holdStatus.status === 'exempt' ? 'bg-blue-50 border border-blue-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex items-center gap-2">
              {holdStatus.status === 'exempt' ? <ShieldCheck size={18} className="text-blue-600" /> : <Lock size={18} className="text-yellow-600" />}
              <span className={`text-sm font-medium ${holdStatus.status === 'exempt' ? 'text-blue-700' : 'text-yellow-700'}`}>
                {holdStatus.status === 'exempt' ? 'No Hold Required (Coins/Bullion Exempt)' : '7 Business Day Hold Required'}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Purity</label><input type="text" value={form.purity} onChange={(e) => setForm({...form, purity: e.target.value})} className="w-full border rounded p-2" placeholder="925, 999, 14K..." /></div>
            <div>
              <label className="block text-sm font-medium mb-1">Weight</label>
              <div className="flex gap-1">
                <input 
                  type="number" 
                  step="0.01" 
                  value={form.weight} 
                  onChange={(e) => setForm({...form, weight: e.target.value})} 
                  className="flex-1 border rounded-l p-2" 
                  placeholder={weightUnit === 'g' ? 'grams' : 'troy oz'}
                />
                <div className="flex border rounded-r overflow-hidden">
                  <button 
                    onClick={() => handleUnitChange('g')}
                    className={`px-2 py-2 text-sm font-medium transition-colors ${weightUnit === 'g' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    g
                  </button>
                  <button 
                    onClick={() => handleUnitChange('oz')}
                    className={`px-2 py-2 text-sm font-medium transition-colors ${weightUnit === 'oz' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    oz
                  </button>
                </div>
              </div>
              {form.weight && (
                <div className="text-xs text-gray-500 mt-1">
                  = {weightUnit === 'g' 
                    ? `${getWeightInOz().toFixed(4)} troy oz` 
                    : `${(parseFloat(form.weight) * GRAMS_PER_OZ).toFixed(2)} grams`}
                </div>
              )}
            </div>
          </div>
          
          {/* Year/Mint/Grade for coins */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Year</label>
              <input type="text" value={form.year || ''} onChange={(e) => setForm({...form, year: e.target.value})} className="w-full border rounded p-2" placeholder="1921" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mint</label>
              <select value={form.mint || ''} onChange={(e) => setForm({...form, mint: e.target.value})} className="w-full border rounded p-2 bg-white">
                <option value="">-</option>
                <option value="P">P (Philadelphia)</option>
                <option value="D">D (Denver)</option>
                <option value="S">S (San Francisco)</option>
                <option value="O">O (New Orleans)</option>
                <option value="CC">CC (Carson City)</option>
                <option value="W">W (West Point)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Grade</label>
              <select value={form.grade || ''} onChange={(e) => setForm({...form, grade: e.target.value})} className="w-full border rounded p-2 bg-white">
                <option value="">-</option>
                <option value="AG">AG (About Good)</option>
                <option value="G">G (Good)</option>
                <option value="VG">VG (Very Good)</option>
                <option value="F">F (Fine)</option>
                <option value="VF">VF (Very Fine)</option>
                <option value="XF">XF (Extremely Fine)</option>
                <option value="AU">AU (About Uncirculated)</option>
                <option value="BU">BU (Brilliant Uncirculated)</option>
                <option value="MS60">MS60</option>
                <option value="MS63">MS63</option>
                <option value="MS65">MS65</option>
                <option value="MS67">MS67</option>
                <option value="MS69">MS69</option>
                <option value="MS70">MS70</option>
              </select>
            </div>
          </div>
          
          {/* Marks/Serial Numbers - AML Compliance */}
          <div>
            <label className="block text-sm font-medium mb-1">Marks / Serial Numbers</label>
            <input 
              type="text" 
              value={form.serialNumber || ''} 
              onChange={(e) => setForm({...form, serialNumber: e.target.value})} 
              className="w-full border rounded p-2" 
              placeholder="Hallmarks, serial #, cert #, maker marks..."
            />
            <p className="text-xs text-gray-500 mt-1">For AML compliance: document all identifying marks</p>
          </div>
          
          <div><label className="block text-sm font-medium mb-1">Source</label><input type="text" value={form.source} onChange={(e) => setForm({...form, source: e.target.value})} className="w-full border rounded p-2" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Purchase $</label><input type="number" value={form.purchasePrice} onChange={(e) => setForm({...form, purchasePrice: e.target.value})} className="w-full border rounded p-2" /></div>
            <div>
              <label className="block text-sm font-medium mb-1">Melt Value</label>
              <div className="flex gap-2">
                <input type="number" value={form.meltValue} onChange={(e) => setForm({...form, meltValue: e.target.value})} className="flex-1 border rounded p-2" />
                <button onClick={() => setForm({...form, meltValue: calculateMelt(form.metalType, form.purity, getWeightInOz())})} className="bg-amber-100 px-2 rounded text-amber-700 text-sm">Calc</button>
              </div>
            </div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="w-full border rounded p-2" rows={2} /></div>
          <div className="flex gap-2 pt-2">
            <button onClick={onCancel} className="flex-1 border py-2 rounded">Cancel</button>
            <button 
              onClick={() => { 
                if (form.description) {
                  const weightInOz = getWeightInOz();
                  onSave({ 
                    ...form, 
                    weightOz: weightInOz, 
                    purchasePrice: parseFloat(form.purchasePrice) || 0, 
                    meltValue: parseFloat(form.meltValue || calculateMelt(form.metalType, form.purity, weightInOz)) || 0 
                  }); 
                }
              }} 
              className="flex-1 bg-amber-600 text-white py-2 rounded"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailView({ item, clients, onUpdate, onDelete, onBack, onListOnEbay, liveSpotPrices, onCreateLot, onPrev, onNext, currentIndex, totalItems }) {
  const [showSold, setShowSold] = useState(false);
  const [salePrice, setSalePrice] = useState(item.meltValue || '');
  const [salePlatform, setSalePlatform] = useState('Refiner');
  const [ebayPrices, setEbayPrices] = useState(null);
  const [isLoadingEbay, setIsLoadingEbay] = useState(false);
  const [showPricingAnalysis, setShowPricingAnalysis] = useState(false);
  const [generatedListing, setGeneratedListing] = useState(null);
  const [showCreateLot, setShowCreateLot] = useState(false);
  const [lotDescription, setLotDescription] = useState(item.description);
  const [lotNotes, setLotNotes] = useState(item.notes || '');
  const [showPhotoManager, setShowPhotoManager] = useState(false);
  
  // Photo management refs
  const photoCameraRef = useRef(null);
  const photoGalleryRef = useRef(null);
  const backPhotoCameraRef = useRef(null);
  const backPhotoGalleryRef = useRef(null);
  
  const client = clients.find(c => c.id === item.clientId);
  const holdStatus = getHoldStatus(item);
  const profit = item.status === 'Sold' ? (item.salePrice - item.purchasePrice) : (item.meltValue - item.purchasePrice);
  
  // Handle adding/updating photos
  const handlePhotoCapture = (side) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result.split(',')[1];
      if (side === 'front') {
        onUpdate({ ...item, photo: base64 });
      } else {
        onUpdate({ ...item, photoBack: base64 });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };
  
  const removePhoto = (side) => {
    if (side === 'front') {
      onUpdate({ ...item, photo: null });
    } else {
      onUpdate({ ...item, photoBack: null });
    }
  };
  
  // Generate casual, human eBay listing - NO cost info, conversational tone
  const generateListing = (ebayData) => {
    const coinInfo = item.coinKey ? coinReference[item.coinKey] : null;
    
    // Build optimized title (max 80 chars)
    let title = '';
    if (item.year) title += `${item.year} `;
    if (item.mint) title += `${item.mint} `;
    title += item.description;
    if (item.grade) {
      title += ` ${item.grade.toUpperCase()}`;
    }
    if (item.purity && !title.includes(item.purity)) title += ` ${item.purity}`;
    if (item.metalType === 'Silver' && !title.toLowerCase().includes('silver')) title += ' Silver';
    if (item.metalType === 'Gold' && !title.toLowerCase().includes('gold')) title += ' Gold';
    title = title.slice(0, 80);
    
    // Determine item type
    const isCoin = item.category?.includes('Coin') || item.coinKey;
    const isJewelry = item.category?.includes('Sterling') || item.category?.includes('Jewelry');
    const isGraded = item.grade?.toUpperCase().startsWith('MS') || item.grade?.toUpperCase().startsWith('PF');
    const isMexican = item.description?.toLowerCase().includes('mexico') || item.description?.toLowerCase().includes('mexican') || item.description?.toLowerCase().includes('taxco');
    
    // Build casual, conversational description
    let description = '';
    
    if (isJewelry) {
      // Jewelry style - like the obsidian bracelet example
      if (isMexican) {
        description = `Here's a nice piece of vintage Mexican silver.

${item.description}. `;
        
        if (item.weightOz) {
          const grams = Math.round(item.weightOz * 31.1);
          description += `Got some weight to it at ${grams}g - you'll know you're wearing it. `;
        }
        
        description += `

Marked 925 MEXICO${item.notes?.includes('maker') ? '' : ' on the clasp'}. This is mid-century Mexican silver work - solid construction, nice patina that shows its age in a good way.`;
        
        if (item.notes) {
          // Extract useful details from notes, skip purchase price stuff
          const cleanNotes = item.notes.replace(/paid.*?%.*?(melt|value)/gi, '').replace(/\$[\d,.]+/g, '').trim();
          if (cleanNotes.length > 10) {
            description += ` ${cleanNotes}`;
          }
        }
        
        description += `

No damage, clasp works great. What you see is what you get.`;
        
      } else {
        // Generic jewelry
        description = `${item.description}.`;
        
        if (item.weightOz) {
          const grams = Math.round(item.weightOz * 31.1);
          description += ` Nice weight at ${grams}g.`;
        }
        
        if (item.purity) {
          description += ` Marked ${item.purity}.`;
        }
        
        if (item.notes) {
          const cleanNotes = item.notes.replace(/paid.*?%.*?(melt|value)/gi, '').replace(/\$[\d,.]+/g, '').trim();
          if (cleanNotes.length > 10) {
            description += ` ${cleanNotes}`;
          }
        }
        
        description += `

Good condition, no issues. Photos show exactly what you're getting.`;
      }
      
    } else if (isCoin) {
      // Coin style
      if (isGraded) {
        description = `${item.year || ''} ${item.description}${item.mint ? `-${item.mint}` : ''} graded ${item.grade?.toUpperCase()}.

Third-party graded and encapsulated - what you see is what you get. Nice eye appeal.`;
      } else {
        description = `${item.year || ''} ${item.description}${item.mint ? ` (${item.mint} mint)` : ''}.`;
        
        if (coinInfo) {
          description += ` ${((coinInfo.purity || 0.9) * 100).toFixed(0)}% silver, ${coinInfo.aswOz || item.weightOz || ''} oz actual silver weight.`;
        }
        
        if (item.grade) {
          description += ` ${item.grade.toUpperCase()} condition.`;
        }
        
        if (item.notes) {
          const cleanNotes = item.notes.replace(/paid.*?%.*?(melt|value)/gi, '').replace(/\$[\d,.]+/g, '').replace(/retail/gi, '').trim();
          if (cleanNotes.length > 10) {
            description += ` ${cleanNotes}`;
          }
        }
      }
      
      description += `

Photos show the actual coin you'll receive. Check them out - happy to answer any questions.`;
      
    } else {
      // Generic item
      description = `${item.description}.`;
      
      if (item.notes) {
        const cleanNotes = item.notes.replace(/paid.*?%.*?(melt|value)/gi, '').replace(/\$[\d,.]+/g, '').trim();
        if (cleanNotes.length > 10) {
          description += ` ${cleanNotes}`;
        }
      }
      
      description += `

What you see is what you get. Check photos for condition.`;
    }
    
    // Add shipping - casual
    description += `

Ships fast and packed well. Questions? Just ask.`;
    
    description = description.trim();
    
    // Pricing strategy based on eBay sold data
    let pricingStrategy = {
      recommendedFormat: 'FIXED_PRICE',
      binPrice: 0,
      auctionStart: 0,
      reasoning: ''
    };
    
    if (ebayData && ebayData.count > 0) {
      const avgPrice = ebayData.avgPrice;
      const medianPrice = ebayData.medianPrice || avgPrice;
      const meltValue = parseFloat(item.meltValue) || 0;
      const premium = avgPrice - meltValue;
      const premiumPercent = meltValue > 0 ? ((premium / meltValue) * 100) : 0;
      
      if (premiumPercent > 30) {
        // High premium item - auction might get more
        pricingStrategy = {
          recommendedFormat: 'AUCTION',
          binPrice: Math.round(avgPrice * 1.1),
          auctionStart: Math.round(avgPrice * 0.7),
          reasoning: `High collector premium (${premiumPercent.toFixed(0)}% over melt). Auction could drive competitive bidding.`
        };
      } else if (premiumPercent > 10) {
        // Moderate premium - BIN with best offer
        pricingStrategy = {
          recommendedFormat: 'FIXED_PRICE',
          binPrice: Math.round(avgPrice * 0.95),
          auctionStart: Math.round(avgPrice * 0.8),
          reasoning: `Moderate premium (${premiumPercent.toFixed(0)}% over melt). BIN at 5% below average for quick sale.`
        };
      } else {
        // Low premium - compete on price
        pricingStrategy = {
          recommendedFormat: 'FIXED_PRICE',
          binPrice: Math.round(ebayData.lowPrice * 1.05),
          auctionStart: Math.round(ebayData.lowPrice),
          reasoning: `Low premium item. Price competitively near low end for fast turnover.`
        };
      }
    } else {
      // No eBay data - price based on melt
      const meltValue = parseFloat(item.meltValue) || 0;
      pricingStrategy = {
        recommendedFormat: 'FIXED_PRICE',
        binPrice: Math.round(meltValue * 1.15),
        auctionStart: Math.round(meltValue),
        reasoning: `No eBay comps found. Pricing at 15% over melt value.`
      };
    }
    
    return {
      title,
      description,
      pricingStrategy,
      condition: item.grade ? 'USED_EXCELLENT' : 'USED_GOOD',
      category: coinInfo ? '39482' : '11116', // US Coins or Bullion
    };
  };
  
  // Calculate sell strategy recommendation
  const getSellStrategy = (ebayData) => {
    const meltValue = parseFloat(item.meltValue) || 0;
    const cost = parseFloat(item.purchasePrice) || 0;
    const meltProfit = meltValue - cost;
    const meltProfitPercent = cost > 0 ? ((meltProfit / cost) * 100) : 0;
    
    let strategy = {
      recommendation: 'HOLD',
      confidence: 'medium',
      reasoning: '',
      options: []
    };
    
    if (ebayData && ebayData.count > 0) {
      const ebayAvg = ebayData.avgPrice;
      const ebayProfit = ebayAvg - cost;
      const ebayProfitPercent = cost > 0 ? ((ebayProfit / cost) * 100) : 0;
      const ebayVsMelt = ebayAvg - meltValue;
      const ebayFees = ebayAvg * 0.13; // ~13% eBay + PayPal fees
      const ebayNet = ebayAvg - ebayFees;
      const ebayNetProfit = ebayNet - cost;
      
      strategy.options = [
        {
          channel: 'Refiner',
          grossPrice: meltValue,
          fees: 0,
          netPrice: meltValue,
          profit: meltProfit,
          profitPercent: meltProfitPercent,
          timeToSell: 'Immediate',
          risk: 'None'
        },
        {
          channel: 'eBay',
          grossPrice: ebayAvg,
          fees: ebayFees,
          netPrice: ebayNet,
          profit: ebayNetProfit,
          profitPercent: cost > 0 ? ((ebayNetProfit / cost) * 100) : 0,
          timeToSell: '3-14 days',
          risk: 'Low-Medium'
        }
      ];
      
      // Determine recommendation
      if (ebayNetProfit > meltProfit * 1.2) {
        // eBay nets 20%+ more than melt
        strategy.recommendation = 'SELL_EBAY';
        strategy.confidence = 'high';
        strategy.reasoning = `eBay nets $${ebayNetProfit.toFixed(2)} vs $${meltProfit.toFixed(2)} at refiner (+$${(ebayNetProfit - meltProfit).toFixed(2)}). Worth the extra effort.`;
      } else if (ebayNetProfit > meltProfit) {
        // eBay slightly better
        strategy.recommendation = 'SELL_EBAY';
        strategy.confidence = 'medium';
        strategy.reasoning = `eBay nets slightly more ($${(ebayNetProfit - meltProfit).toFixed(2)} extra), but refiner is faster with less hassle.`;
      } else if (meltProfitPercent > 20) {
        // Good profit at refiner
        strategy.recommendation = 'SELL_REFINER';
        strategy.confidence = 'high';
        strategy.reasoning = `Strong ${meltProfitPercent.toFixed(0)}% profit at melt. Quick, guaranteed sale.`;
      } else if (meltProfitPercent < 5 && ebayVsMelt > meltValue * 0.1) {
        // Low melt profit but collector premium exists
        strategy.recommendation = 'SELL_EBAY';
        strategy.confidence = 'medium';
        strategy.reasoning = `Low melt margin but ${((ebayVsMelt/meltValue)*100).toFixed(0)}% collector premium on eBay.`;
      } else if (meltProfitPercent < 0) {
        // Underwater
        strategy.recommendation = 'STASH';
        strategy.confidence = 'medium';
        strategy.reasoning = `Currently underwater. Hold for spot price recovery or collector demand.`;
      } else {
        strategy.recommendation = 'HOLD';
        strategy.confidence = 'low';
        strategy.reasoning = `Marginal profit either way. Consider holding for better conditions.`;
      }
    } else {
      // No eBay data
      if (meltProfitPercent > 15) {
        strategy.recommendation = 'SELL_REFINER';
        strategy.confidence = 'medium';
        strategy.reasoning = `${meltProfitPercent.toFixed(0)}% profit at melt. No eBay comps to compare.`;
      } else {
        strategy.recommendation = 'HOLD';
        strategy.confidence = 'low';
        strategy.reasoning = `Low melt margin and no eBay data. Hold for now.`;
      }
      
      strategy.options = [
        {
          channel: 'Refiner',
          grossPrice: meltValue,
          fees: 0,
          netPrice: meltValue,
          profit: meltProfit,
          profitPercent: meltProfitPercent,
          timeToSell: 'Immediate',
          risk: 'None'
        }
      ];
    }
    
    return strategy;
  };
  
  // Fetch eBay sold prices and generate analysis
  const fetchEbayPrices = async () => {
    setIsLoadingEbay(true);
    try {
      const searchQuery = item.description + (item.year ? ` ${item.year}` : '') + (item.grade ? ` ${item.grade}` : '');
      const results = await EbayPricingService.searchSoldListings(searchQuery, 15);
      setEbayPrices(results);
      setGeneratedListing(generateListing(results));
      setShowPricingAnalysis(true);
    } catch (error) {
      console.error('eBay price lookup failed:', error);
    }
    setIsLoadingEbay(false);
  };
  
  const handleMarkSold = () => {
    if (!holdStatus.canSell) {
      alert(`Cannot sell - item is on hold until ${holdStatus.releaseDate?.toLocaleDateString()}`);
      return;
    }
    onUpdate({ ...item, status: 'Sold', dateSold: new Date().toISOString().split('T')[0], salePrice: parseFloat(salePrice), salePlatform });
    setShowSold(false);
  };
  
  const handleToggleStash = () => {
    if (item.status === 'Stash') {
      onUpdate({ ...item, status: 'Available' });
    } else if (item.status === 'Available') {
      onUpdate({ ...item, status: 'Stash' });
    }
  };
  
  const sellStrategy = ebayPrices ? getSellStrategy(ebayPrices) : null;

  return (
    <div className="min-h-screen bg-amber-50 pb-24">
      <div className="bg-amber-700 text-white p-4 flex justify-between">
        <button onClick={onBack}>← Back</button>
        <button onClick={onDelete}><Trash2 size={20} /></button>
      </div>
      <div className="p-4"><div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold">{item.description}</h2>
        <div className="text-gray-500">{item.id} • {item.category}</div>
        
        {/* Photo Section */}
        <div className="mt-4 mb-4">
          {(item.photo || item.photoBack) ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                {/* Front Photo */}
                <div className="flex-1">
                  {item.photo ? (
                    <div className="relative">
                      <img 
                        src={`data:image/jpeg;base64,${item.photo}`} 
                        className="w-full h-32 object-cover rounded-lg"
                        alt="Front"
                      />
                      <span className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-0.5 rounded">Front</span>
                      <button
                        onClick={() => removePhoto('front')}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setShowPhotoManager(true)}
                      className="h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-teal-400"
                    >
                      <Camera size={24} />
                      <span className="text-xs mt-1">Add Front</span>
                    </div>
                  )}
                </div>
                
                {/* Back Photo */}
                <div className="flex-1">
                  {item.photoBack ? (
                    <div className="relative">
                      <img 
                        src={`data:image/jpeg;base64,${item.photoBack}`} 
                        className="w-full h-32 object-cover rounded-lg"
                        alt="Back"
                      />
                      <span className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-0.5 rounded">Back</span>
                      <button
                        onClick={() => removePhoto('back')}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setShowPhotoManager(true)}
                      className="h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-teal-400"
                    >
                      <Camera size={24} />
                      <span className="text-xs mt-1">Add Back</span>
                    </div>
                  )}
                </div>
              </div>
              
              <button
                onClick={() => setShowPhotoManager(true)}
                className="w-full text-teal-600 text-sm py-1"
              >
                Manage Photos
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPhotoManager(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-gray-400 hover:border-teal-400 hover:text-teal-500"
            >
              <Camera size={32} />
              <span className="mt-2 font-medium">Add Photos</span>
              <span className="text-xs">Front & Back</span>
            </button>
          )}
        </div>
        
        {/* Photo Manager Modal */}
        {showPhotoManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
              <div className="bg-teal-600 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold">Manage Photos</h3>
                <button onClick={() => setShowPhotoManager(false)}><X size={24} /></button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Front Photo */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Front (Obverse)</h4>
                  {item.photo ? (
                    <div className="relative">
                      <img 
                        src={`data:image/jpeg;base64,${item.photo}`} 
                        className="w-full h-48 object-contain bg-gray-100 rounded-lg"
                      />
                      <button
                        onClick={() => removePhoto('front')}
                        className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => photoCameraRef.current?.click()}
                        className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center text-gray-500 hover:border-teal-400 hover:text-teal-500"
                      >
                        <Camera size={24} />
                        <span className="text-sm mt-1">Camera</span>
                      </button>
                      <button
                        onClick={() => photoGalleryRef.current?.click()}
                        className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center text-gray-500 hover:border-teal-400 hover:text-teal-500"
                      >
                        <Upload size={24} />
                        <span className="text-sm mt-1">Gallery</span>
                      </button>
                    </div>
                  )}
                  <input type="file" accept="image/*" capture="environment" ref={photoCameraRef} onChange={handlePhotoCapture('front')} className="hidden" />
                  <input type="file" accept="image/*" ref={photoGalleryRef} onChange={handlePhotoCapture('front')} className="hidden" />
                </div>
                
                {/* Back Photo */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Back (Reverse)</h4>
                  {item.photoBack ? (
                    <div className="relative">
                      <img 
                        src={`data:image/jpeg;base64,${item.photoBack}`} 
                        className="w-full h-48 object-contain bg-gray-100 rounded-lg"
                      />
                      <button
                        onClick={() => removePhoto('back')}
                        className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => backPhotoCameraRef.current?.click()}
                        className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center text-gray-500 hover:border-teal-400 hover:text-teal-500"
                      >
                        <Camera size={24} />
                        <span className="text-sm mt-1">Camera</span>
                      </button>
                      <button
                        onClick={() => backPhotoGalleryRef.current?.click()}
                        className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center text-gray-500 hover:border-teal-400 hover:text-teal-500"
                      >
                        <Upload size={24} />
                        <span className="text-sm mt-1">Gallery</span>
                      </button>
                    </div>
                  )}
                  <input type="file" accept="image/*" capture="environment" ref={backPhotoCameraRef} onChange={handlePhotoCapture('back')} className="hidden" />
                  <input type="file" accept="image/*" ref={backPhotoGalleryRef} onChange={handlePhotoCapture('back')} className="hidden" />
                </div>
                
                <button
                  onClick={() => setShowPhotoManager(false)}
                  className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* eBay Listed Badge */}
        {item.ebayListingId && (
          <a 
            href={item.ebayUrl} 
            target="_blank"
            className="mt-2 p-2 rounded-lg flex items-center gap-2 bg-blue-100 text-blue-700"
          >
            <ExternalLink size={18} /> Listed on eBay #{item.ebayListingId}
          </a>
        )}
        
        {/* Stash Badge */}
        {item.status === 'Stash' && (
          <div className="mt-2 p-2 rounded-lg flex items-center gap-2 bg-amber-100 text-amber-700">
            <Star size={18} /> In Personal Stash
          </div>
        )}
        
        {/* Hold Status Badge */}
        {item.status === 'Available' && (
          <div className={`mt-2 p-2 rounded-lg flex items-center gap-2 ${
            holdStatus.status === 'exempt' ? 'bg-blue-50 text-blue-700' :
            holdStatus.status === 'hold' ? 'bg-red-50 text-red-700' :
            'bg-green-50 text-green-700'
          }`}>
            {holdStatus.status === 'exempt' && <><ShieldCheck size={18} /> No Hold - Coins/Bullion Exempt</>}
            {holdStatus.status === 'hold' && <><Lock size={18} /> On Hold - {holdStatus.daysLeft} day{holdStatus.daysLeft > 1 ? 's' : ''} remaining (until {holdStatus.releaseDate?.toLocaleDateString()})</>}
            {holdStatus.status === 'released' && <><Unlock size={18} /> Hold Complete - Available to Sell</>}
          </div>
        )}
        
        {item.status === 'Sold' && (
          <div className="inline-block px-2 py-1 rounded text-sm mt-2 bg-green-100 text-green-700">Sold</div>
        )}
        
        {client && (
          <div className="mt-3 p-3 bg-indigo-50 rounded-lg">
            <div className="text-xs text-indigo-600 font-medium">Purchased From</div>
            <div className="font-medium">{client.name}</div>
            <div className="text-sm text-gray-500">{client.type} Seller</div>
            {client.signature && <div className="text-xs text-green-600 mt-1">✓ Certification on file</div>}
          </div>
        )}
        
        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="bg-gray-50 p-3 rounded"><div className="text-xs text-gray-500">Cost</div><div className="text-lg font-bold">${item.purchasePrice}</div></div>
          <div className="bg-gray-50 p-3 rounded"><div className="text-xs text-gray-500">Melt</div><div className="text-lg font-bold text-amber-700">${item.meltValue}</div></div>
          <div className="bg-gray-50 p-3 rounded"><div className="text-xs text-gray-500">Profit</div><div className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${profit}</div></div>
        </div>
        
        {item.status === 'Sold' && (
          <div className="bg-green-50 p-3 rounded mb-4">
            <div className="text-sm text-gray-500">Sold {item.dateSold} via {item.salePlatform} for ${item.salePrice}</div>
          </div>
        )}
        
        <div className="text-sm space-y-2">
          <div className="flex justify-between py-2 border-b"><span className="text-gray-500">Metal</span><span>{item.metalType} ({item.purity})</span></div>
          <div className="flex justify-between py-2 border-b"><span className="text-gray-500">Weight</span><span>{item.weightOz} oz</span></div>
          <div className="flex justify-between py-2"><span className="text-gray-500">Acquired</span><span>{item.dateAcquired}</span></div>
        </div>
        
        {/* Serial/Marks - AML Compliance - Editable */}
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-blue-600 font-medium">Marks / Serial Numbers</span>
            <button 
              onClick={() => {
                const newValue = prompt('Enter marks, serial numbers, or certification numbers:', item.serialNumber || '');
                if (newValue !== null) {
                  onUpdate({ ...item, serialNumber: newValue });
                }
              }}
              className="text-xs text-blue-600 underline"
            >
              Edit
            </button>
          </div>
          <div className="text-sm">{item.serialNumber || <span className="text-gray-400 italic">None recorded</span>}</div>
          <p className="text-xs text-blue-500 mt-1">For AML compliance</p>
        </div>
        
        {item.notes && <div className="mt-4 p-3 bg-gray-50 rounded text-sm">{item.notes}</div>}
        
        {/* PRICING ANALYSIS SECTION */}
        {item.status === 'Available' && holdStatus.canSell && !item.ebayListingId && (
          <div className="mt-4 border-t pt-4">
            <button 
              onClick={fetchEbayPrices}
              disabled={isLoadingEbay}
              className="w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white"
            >
              {isLoadingEbay ? (
                <><Loader size={18} className="animate-spin" /> Analyzing Market...</>
              ) : (
                <><TrendingUp size={18} /> Analyze Pricing & Generate Listing</>
              )}
            </button>
            
            {/* Pricing Analysis Results */}
            {showPricingAnalysis && sellStrategy && (
              <div className="mt-4 space-y-4">
                {/* Recommendation Banner */}
                <div className={`p-4 rounded-lg ${
                  sellStrategy.recommendation === 'SELL_EBAY' ? 'bg-blue-100 border-2 border-blue-400' :
                  sellStrategy.recommendation === 'SELL_REFINER' ? 'bg-green-100 border-2 border-green-400' :
                  sellStrategy.recommendation === 'STASH' ? 'bg-amber-100 border-2 border-amber-400' :
                  'bg-gray-100 border-2 border-gray-300'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {sellStrategy.recommendation === 'SELL_EBAY' && <><ExternalLink size={20} className="text-blue-600" /><span className="font-bold text-blue-800">Recommend: Sell on eBay</span></>}
                    {sellStrategy.recommendation === 'SELL_REFINER' && <><DollarSign size={20} className="text-green-600" /><span className="font-bold text-green-800">Recommend: Sell to Refiner</span></>}
                    {sellStrategy.recommendation === 'STASH' && <><Star size={20} className="text-amber-600" /><span className="font-bold text-amber-800">Recommend: Stash / Hold</span></>}
                    {sellStrategy.recommendation === 'HOLD' && <><Clock size={20} className="text-gray-600" /><span className="font-bold text-gray-800">Recommend: Hold</span></>}
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      sellStrategy.confidence === 'high' ? 'bg-green-200 text-green-800' :
                      sellStrategy.confidence === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-gray-200 text-gray-600'
                    }`}>{sellStrategy.confidence} confidence</span>
                  </div>
                  <p className="text-sm text-gray-700">{sellStrategy.reasoning}</p>
                </div>
                
                {/* Channel Comparison */}
                <div className="bg-white border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-2 font-medium text-sm">Channel Comparison</div>
                  <div className="divide-y">
                    {sellStrategy.options.map((opt, idx) => (
                      <div key={idx} className={`p-3 ${opt.channel === 'eBay' && sellStrategy.recommendation === 'SELL_EBAY' ? 'bg-blue-50' : opt.channel === 'Refiner' && sellStrategy.recommendation === 'SELL_REFINER' ? 'bg-green-50' : ''}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{opt.channel}</span>
                          <span className={`text-lg font-bold ${opt.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${opt.netPrice.toFixed(2)} net
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                          <div>
                            <span className="block text-gray-400">Gross</span>
                            ${opt.grossPrice.toFixed(2)}
                          </div>
                          <div>
                            <span className="block text-gray-400">Fees</span>
                            -${opt.fees.toFixed(2)}
                          </div>
                          <div>
                            <span className="block text-gray-400">Profit</span>
                            <span className={opt.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {opt.profit >= 0 ? '+' : ''}${opt.profit.toFixed(2)} ({opt.profitPercent.toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {opt.timeToSell} • {opt.risk} risk
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* eBay Market Data */}
                {ebayPrices && ebayPrices.count > 0 && (
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-3 py-2 font-medium text-sm flex justify-between items-center">
                      <span>eBay Market Data ({ebayPrices.count} {ebayPrices.source === 'sold' ? 'sold' : 'active'})</span>
                    </div>
                    <div className="p-3">
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="text-center p-2 bg-red-50 rounded">
                          <div className="text-xs text-gray-500">Low</div>
                          <div className="font-bold text-red-600">${ebayPrices.lowPrice}</div>
                        </div>
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="text-xs text-gray-500">Avg</div>
                          <div className="font-bold text-blue-600">${ebayPrices.avgPrice}</div>
                        </div>
                        <div className="text-center p-2 bg-green-50 rounded">
                          <div className="text-xs text-gray-500">High</div>
                          <div className="font-bold text-green-600">${ebayPrices.highPrice}</div>
                        </div>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {ebayPrices.items.slice(0, 5).map((listing, idx) => (
                          <a 
                            key={idx}
                            href={listing.itemUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex justify-between items-center p-2 bg-gray-50 rounded text-xs hover:bg-gray-100"
                          >
                            <span className="truncate flex-1 mr-2">{listing.title?.slice(0, 40)}...</span>
                            <span className="font-medium text-green-600">${listing.price}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Generated Listing Preview */}
                {generatedListing && (
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <div className="bg-blue-600 text-white px-3 py-2 font-medium text-sm">
                      📝 Auto-Generated eBay Listing
                    </div>
                    <div className="p-3 space-y-3">
                      {/* Title */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Title ({generatedListing.title.length}/80 chars)</div>
                        <div className="font-medium text-sm bg-gray-50 p-2 rounded">{generatedListing.title}</div>
                      </div>
                      
                      {/* Pricing Strategy */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Suggested Pricing</div>
                        <div className="bg-green-50 p-3 rounded">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">
                              {generatedListing.pricingStrategy.recommendedFormat === 'AUCTION' ? '🔨 Auction' : '💰 Buy It Now'}
                            </span>
                            <span className="text-xl font-bold text-green-700">
                              ${generatedListing.pricingStrategy.binPrice}
                            </span>
                          </div>
                          {generatedListing.pricingStrategy.recommendedFormat === 'AUCTION' && (
                            <div className="text-xs text-gray-600 mb-1">
                              Start: ${generatedListing.pricingStrategy.auctionStart} | BIN: ${generatedListing.pricingStrategy.binPrice}
                            </div>
                          )}
                          <div className="text-xs text-gray-600">{generatedListing.pricingStrategy.reasoning}</div>
                        </div>
                      </div>
                      
                      {/* Description Preview */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Description Preview</div>
                        <div className="bg-gray-50 p-2 rounded text-xs max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                          {generatedListing.description.slice(0, 500)}...
                        </div>
                      </div>
                      
                      {/* List on eBay Button */}
                      {onListOnEbay && (
                        <button 
                          onClick={() => onListOnEbay(generatedListing)}
                          className="w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 bg-blue-600 text-white"
                        >
                          <ExternalLink size={18} />
                          Create eBay Listing @ ${generatedListing.pricingStrategy.binPrice}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Previous / Next Navigation */}
        {(onPrev || onNext) && (
          <div className="flex items-center gap-2 mt-4">
            <button 
              onClick={onPrev}
              disabled={!onPrev}
              className={`flex-1 py-3 rounded font-medium flex items-center justify-center gap-2 ${
                onPrev 
                  ? 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200' 
                  : 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed'
              }`}
            >
              <ChevronLeft size={20} />
              Previous
            </button>
            <div className="text-center text-sm text-gray-500 px-2">
              {currentIndex + 1} / {totalItems}
            </div>
            <button 
              onClick={onNext}
              disabled={!onNext}
              className={`flex-1 py-3 rounded font-medium flex items-center justify-center gap-2 ${
                onNext 
                  ? 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200' 
                  : 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed'
              }`}
            >
              Next
              <ChevronRight size={20} />
            </button>
          </div>
        )}
        
        {/* Move to Stash / Move to Inventory Button */}
        {(item.status === 'Available' || item.status === 'Stash') && (
          <button 
            onClick={handleToggleStash}
            className={`w-full mt-4 py-3 rounded font-medium flex items-center justify-center gap-2 ${
              item.status === 'Stash' 
                ? 'bg-gray-200 text-gray-700 border border-gray-300' 
                : 'bg-amber-100 text-amber-700 border border-amber-300'
            }`}
          >
            <Star size={18} />
            {item.status === 'Stash' ? 'Move Back to Inventory' : 'Move to Personal Stash'}
          </button>
        )}
        
        {item.status === 'Available' && !showSold && (
          <button 
            onClick={() => setShowSold(true)} 
            disabled={!holdStatus.canSell}
            className={`w-full mt-2 py-3 rounded font-medium ${holdStatus.canSell ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
          >
            {holdStatus.canSell ? 'Mark as Sold' : `On Hold - ${holdStatus.daysLeft} days remaining`}
          </button>
        )}
        
        {showSold && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg space-y-3">
            <div><label className="block text-sm mb-1">Sale Price</label><input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="w-full border rounded p-2" /></div>
            <div><label className="block text-sm mb-1">Platform</label><select value={salePlatform} onChange={(e) => setSalePlatform(e.target.value)} className="w-full border rounded p-2 bg-white"><option>Refiner</option><option>eBay</option><option>Direct</option><option>Auction</option></select></div>
            <div className="flex gap-2"><button onClick={() => setShowSold(false)} className="flex-1 border py-2 rounded">Cancel</button><button onClick={handleMarkSold} className="flex-1 bg-green-600 text-white py-2 rounded">Record Sale</button></div>
          </div>
        )}
        
        {/* Convert to Lot Button - only show if item doesn't already belong to a lot */}
        {item.status === 'Available' && !item.lotId && onCreateLot && (
          <button 
            onClick={() => setShowCreateLot(true)}
            className="w-full mt-2 py-3 rounded font-medium bg-purple-100 text-purple-700 border border-purple-300 flex items-center justify-center gap-2"
          >
            <Layers size={18} /> Convert to Lot
          </button>
        )}
        
        {/* Show lot info if item belongs to a lot */}
        {item.lotId && (
          <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 text-purple-700">
              <Layers size={16} />
              <span className="text-sm font-medium">Part of Lot: {item.lotId}</span>
            </div>
          </div>
        )}
        
        {/* Create Lot Modal */}
        {showCreateLot && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-4">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <Layers size={20} className="text-purple-600" /> Create Lot from Item
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Convert this item into a lot for tracking as a set/group purchase.
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Lot Description</label>
                  <input
                    type="text"
                    value={lotDescription}
                    onChange={(e) => setLotDescription(e.target.value)}
                    className="w-full border rounded-lg p-2"
                    placeholder="e.g., Franklin Half Dollar Set (15 coins)"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Total Items in Lot</label>
                  <input
                    type="number"
                    defaultValue={item.quantity || 1}
                    id="lotItemCount"
                    className="w-full border rounded-lg p-2"
                    min="1"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Lot Notes</label>
                  <textarea
                    value={lotNotes}
                    onChange={(e) => setLotNotes(e.target.value)}
                    className="w-full border rounded-lg p-2"
                    rows={2}
                    placeholder="Notes about the lot..."
                  />
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">Client:</span> <span className="font-medium">{client?.name || 'Unknown'}</span></div>
                    <div><span className="text-gray-500">Cost:</span> <span className="font-medium">${item.purchasePrice}</span></div>
                    <div><span className="text-gray-500">Acquired:</span> <span className="font-medium">{item.dateAcquired}</span></div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowCreateLot(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const itemCount = parseInt(document.getElementById('lotItemCount')?.value) || item.quantity || 1;
                    onCreateLot({
                      description: lotDescription,
                      totalCost: item.purchasePrice,
                      totalItems: itemCount,
                      source: item.source,
                      clientId: item.clientId,
                      dateAcquired: item.dateAcquired,
                      status: 'intact',
                      allocationMethod: 'equal',
                      notes: lotNotes,
                      itemIds: [item.id]
                    });
                    setShowCreateLot(false);
                  }}
                  className="flex-1 py-2 rounded-lg font-medium bg-purple-600 text-white hover:bg-purple-700"
                >
                  Create Lot
                </button>
              </div>
            </div>
          </div>
        )}
      </div></div>
    </div>
  );
}

// ============ ADMIN PANEL VIEW ============
function AdminPanelView({ onBack, inventory, clients, lots, onClearCollection, firebaseReady }) {
  const [confirmClear, setConfirmClear] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  
  // Export to CSV
  const exportToCSV = (data, filename, columns) => {
    const headers = columns.map(c => c.label).join(',');
    const rows = data.map(item => 
      columns.map(c => {
        let val = item[c.key];
        if (val === null || val === undefined) val = '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Export to Excel (using CSV that Excel can open)
  const exportToExcel = (data, filename, columns) => {
    // For true Excel format, we'd need a library like xlsx
    // For now, CSV works well and Excel opens it fine
    exportToCSV(data, filename.replace('.xlsx', '.csv'), columns);
  };
  
  // Inventory columns for export
  const inventoryColumns = [
    { key: 'id', label: 'ID' },
    { key: 'description', label: 'Description' },
    { key: 'category', label: 'Category' },
    { key: 'metalType', label: 'Metal' },
    { key: 'purity', label: 'Purity' },
    { key: 'weightOz', label: 'Weight (oz)' },
    { key: 'purchasePrice', label: 'Purchase Price' },
    { key: 'meltValue', label: 'Melt Value' },
    { key: 'status', label: 'Status' },
    { key: 'dateAcquired', label: 'Date Acquired' },
    { key: 'source', label: 'Source' },
    { key: 'year', label: 'Year' },
    { key: 'mint', label: 'Mint' },
    { key: 'grade', label: 'Grade' },
    { key: 'serialNumber', label: 'Marks/Serial#' },
    { key: 'salePrice', label: 'Sale Price' },
    { key: 'saleDate', label: 'Sale Date' },
    { key: 'notes', label: 'Notes' }
  ];
  
  // Client columns for export
  const clientColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
    { key: 'idType', label: 'ID Type' },
    { key: 'idNumber', label: 'ID Number' },
    { key: 'createdAt', label: 'Created' },
    { key: 'notes', label: 'Notes' }
  ];
  
  // Lot columns for export
  const lotColumns = [
    { key: 'id', label: 'ID' },
    { key: 'description', label: 'Description' },
    { key: 'clientId', label: 'Client ID' },
    { key: 'totalItems', label: 'Total Items' },
    { key: 'totalMelt', label: 'Total Melt' },
    { key: 'totalPurchase', label: 'Total Purchase' },
    { key: 'status', label: 'Status' },
    { key: 'dateAcquired', label: 'Date Acquired' },
    { key: 'createdAt', label: 'Created' },
    { key: 'notes', label: 'Notes' }
  ];
  
  const handleExport = (type, format) => {
    setIsExporting(true);
    setExportStatus(null);
    
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      
      if (type === 'inventory') {
        const filename = `ses-inventory-${timestamp}.${format}`;
        if (format === 'csv') {
          exportToCSV(inventory, filename, inventoryColumns);
        } else {
          exportToExcel(inventory, filename, inventoryColumns);
        }
        setExportStatus({ success: true, message: `Exported ${inventory.length} inventory items` });
      } else if (type === 'clients') {
        const filename = `ses-clients-${timestamp}.${format}`;
        if (format === 'csv') {
          exportToCSV(clients, filename, clientColumns);
        } else {
          exportToExcel(clients, filename, clientColumns);
        }
        setExportStatus({ success: true, message: `Exported ${clients.length} clients` });
      } else if (type === 'lots') {
        const filename = `ses-lots-${timestamp}.${format}`;
        if (format === 'csv') {
          exportToCSV(lots, filename, lotColumns);
        } else {
          exportToExcel(lots, filename, lotColumns);
        }
        setExportStatus({ success: true, message: `Exported ${lots.length} lots` });
      } else if (type === 'all') {
        exportToCSV(inventory, `ses-inventory-${timestamp}.csv`, inventoryColumns);
        exportToCSV(clients, `ses-clients-${timestamp}.csv`, clientColumns);
        exportToCSV(lots, `ses-lots-${timestamp}.csv`, lotColumns);
        setExportStatus({ success: true, message: 'Exported all data (3 files)' });
      }
    } catch (error) {
      setExportStatus({ success: false, message: `Export failed: ${error.message}` });
    }
    
    setIsExporting(false);
  };
  
  const handleClearCollection = async (collection) => {
    setIsClearing(true);
    try {
      await onClearCollection(collection);
      setConfirmClear(null);
      setExportStatus({ success: true, message: `Cleared ${collection} collection` });
    } catch (error) {
      setExportStatus({ success: false, message: `Failed to clear: ${error.message}` });
    }
    setIsClearing(false);
  };
  
  return (
    <div className="min-h-screen bg-amber-50">
      <div className="bg-red-700 text-white p-4 flex items-center">
        <button onClick={onBack} className="mr-4">← Back</button>
        <Shield size={24} className="mr-2" />
        <h1 className="text-xl font-bold">Admin Panel</h1>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Firebase Status */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Database size={18} /> Database Status
          </h3>
          <div className={`flex items-center gap-2 p-3 rounded ${firebaseReady ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {firebaseReady ? <Cloud size={20} /> : <CloudOff size={20} />}
            <span className="font-medium">{firebaseReady ? 'Firebase Connected' : 'Firebase Disconnected'}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-2xl font-bold text-amber-600">{inventory?.length || 0}</div>
              <div className="text-gray-500">Inventory</div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-2xl font-bold text-amber-600">{clients?.length || 0}</div>
              <div className="text-gray-500">Clients</div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-2xl font-bold text-amber-600">{lots?.length || 0}</div>
              <div className="text-gray-500">Lots</div>
            </div>
          </div>
        </div>
        
        {/* Export Data */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <FileSpreadsheet size={18} /> Export Data
          </h3>
          
          {exportStatus && (
            <div className={`mb-3 p-2 rounded text-sm ${exportStatus.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {exportStatus.message}
            </div>
          )}
          
          <div className="space-y-3">
            {/* Export Inventory */}
            <div className="border rounded p-3">
              <div className="font-medium text-sm mb-2">Inventory ({inventory?.length || 0} items)</div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleExport('inventory', 'csv')}
                  disabled={isExporting || !inventory?.length}
                  className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Download size={14} /> CSV
                </button>
                <button 
                  onClick={() => handleExport('inventory', 'xlsx')}
                  disabled={isExporting || !inventory?.length}
                  className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Download size={14} /> Excel
                </button>
              </div>
            </div>
            
            {/* Export Clients */}
            <div className="border rounded p-3">
              <div className="font-medium text-sm mb-2">Clients ({clients?.length || 0} records)</div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleExport('clients', 'csv')}
                  disabled={isExporting || !clients?.length}
                  className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Download size={14} /> CSV
                </button>
                <button 
                  onClick={() => handleExport('clients', 'xlsx')}
                  disabled={isExporting || !clients?.length}
                  className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Download size={14} /> Excel
                </button>
              </div>
            </div>
            
            {/* Export Lots */}
            <div className="border rounded p-3">
              <div className="font-medium text-sm mb-2">Lots ({lots?.length || 0} records)</div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleExport('lots', 'csv')}
                  disabled={isExporting || !lots?.length}
                  className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Download size={14} /> CSV
                </button>
                <button 
                  onClick={() => handleExport('lots', 'xlsx')}
                  disabled={isExporting || !lots?.length}
                  className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Download size={14} /> Excel
                </button>
              </div>
            </div>
            
            {/* Export All */}
            <button 
              onClick={() => handleExport('all', 'csv')}
              disabled={isExporting}
              className="w-full bg-amber-600 text-white py-3 rounded font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download size={18} /> Export All Data (CSV)
            </button>
          </div>
        </div>
        
        {/* Clear Data - Danger Zone */}
        <div className="bg-white p-4 rounded-lg shadow border-2 border-red-200">
          <h3 className="font-medium mb-3 flex items-center gap-2 text-red-700">
            <AlertOctagon size={18} /> Danger Zone
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Permanently delete data from collections. This action cannot be undone. Data will be removed from both the app and Firebase.
          </p>
          
          <div className="space-y-2">
            {/* Clear Inventory */}
            {confirmClear === 'inventory' ? (
              <div className="bg-red-50 p-3 rounded border border-red-300">
                <p className="text-sm text-red-700 mb-2">Delete all {inventory?.length || 0} inventory items?</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setConfirmClear(null)}
                    className="flex-1 border border-gray-300 py-2 rounded text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleClearCollection('inventory')}
                    disabled={isClearing}
                    className="flex-1 bg-red-600 text-white py-2 rounded text-sm flex items-center justify-center gap-1"
                  >
                    {isClearing ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Confirm Delete
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setConfirmClear('inventory')}
                className="w-full border border-red-300 text-red-600 py-2 rounded text-sm flex items-center justify-center gap-2 hover:bg-red-50"
              >
                <Trash2 size={14} /> Clear Inventory ({inventory?.length || 0} items)
              </button>
            )}
            
            {/* Clear Clients */}
            {confirmClear === 'clients' ? (
              <div className="bg-red-50 p-3 rounded border border-red-300">
                <p className="text-sm text-red-700 mb-2">Delete all {clients?.length || 0} clients?</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setConfirmClear(null)}
                    className="flex-1 border border-gray-300 py-2 rounded text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleClearCollection('clients')}
                    disabled={isClearing}
                    className="flex-1 bg-red-600 text-white py-2 rounded text-sm flex items-center justify-center gap-1"
                  >
                    {isClearing ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Confirm Delete
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setConfirmClear('clients')}
                className="w-full border border-red-300 text-red-600 py-2 rounded text-sm flex items-center justify-center gap-2 hover:bg-red-50"
              >
                <Trash2 size={14} /> Clear Clients ({clients?.length || 0} records)
              </button>
            )}
            
            {/* Clear Lots */}
            {confirmClear === 'lots' ? (
              <div className="bg-red-50 p-3 rounded border border-red-300">
                <p className="text-sm text-red-700 mb-2">Delete all {lots?.length || 0} lots?</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setConfirmClear(null)}
                    className="flex-1 border border-gray-300 py-2 rounded text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleClearCollection('lots')}
                    disabled={isClearing}
                    className="flex-1 bg-red-600 text-white py-2 rounded text-sm flex items-center justify-center gap-1"
                  >
                    {isClearing ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Confirm Delete
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setConfirmClear('lots')}
                className="w-full border border-red-300 text-red-600 py-2 rounded text-sm flex items-center justify-center gap-2 hover:bg-red-50"
              >
                <Trash2 size={14} /> Clear Lots ({lots?.length || 0} records)
              </button>
            )}
          </div>
        </div>
        
        {/* App Info */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <HardDrive size={18} /> App Information
          </h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Version:</strong> 72</p>
            <p><strong>Firebase Project:</strong> ses-inventory</p>
            <p><strong>Last Updated:</strong> January 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ RECEIPT MANAGER VIEW ============
function ReceiptManagerView({ onBack, receipts, onAddReceipt, onDeleteReceipt, onUpdateReceipt, inventory, lots, clients }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [filter, setFilter] = useState('all'); // all, purchase, sale
  const fileInputRef = useRef(null);
  
  // Start editing
  const startEditing = () => {
    setEditForm({ ...selectedReceipt });
    setIsEditing(true);
  };
  
  // Save edits
  const saveEdits = () => {
    onUpdateReceipt(editForm);
    setSelectedReceipt(editForm);
    setIsEditing(false);
    setEditForm(null);
  };
  
  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(null);
  };
  
  // Update item in edit form
  const updateEditItem = (index, field, value) => {
    const newItems = [...(editForm.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditForm({ ...editForm, items: newItems });
  };
  
  // Add new item
  const addEditItem = () => {
    const newItems = [...(editForm.items || []), { description: '', quantity: 1, totalPrice: 0 }];
    setEditForm({ ...editForm, items: newItems });
  };
  
  // Remove item
  const removeEditItem = (index) => {
    const newItems = (editForm.items || []).filter((_, i) => i !== index);
    setEditForm({ ...editForm, items: newItems });
  };
  
  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      // Read file as base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const fileType = file.type;
      const fileName = file.name;
      const isPDF = fileType === 'application/pdf';
      
      setIsAnalyzing(true);
      
      // Send to AI for analysis
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_tokens: 2048,
          system: `You are an expert at extracting data from receipts and invoices for a precious metals dealer. 
Extract all relevant information and return structured JSON.`,
          messages: [{
            role: 'user',
            content: [
              {
                type: isPDF ? 'document' : 'image',
                source: {
                  type: 'base64',
                  media_type: fileType,
                  data: base64
                }
              },
              {
                type: 'text',
                text: `Analyze this receipt/invoice and extract all information.

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "type": "purchase" or "sale",
  "date": "YYYY-MM-DD" or null,
  "vendor": "seller/buyer name" or null,
  "vendorType": "individual", "dealer", "refiner", "auction", or "other",
  "items": [
    {
      "description": "item description",
      "quantity": number,
      "unitPrice": number or null,
      "totalPrice": number or null,
      "metalType": "Gold", "Silver", "Platinum", or null,
      "purity": "999", "925", "14K", etc. or null,
      "weight": number or null,
      "weightUnit": "oz", "g", "dwt", or null
    }
  ],
  "subtotal": number or null,
  "tax": number or null,
  "shipping": number or null,
  "total": number,
  "paymentMethod": "cash", "check", "wire", "card", or null,
  "referenceNumber": "invoice/receipt number" or null,
  "notes": "any additional details",
  "confidence": "high", "medium", or "low"
}

Be thorough - extract every line item you can identify.`
              }
            ]
          }]
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze receipt');
      }
      
      const data = await response.json();
      let extractedData;
      
      try {
        const textContent = data.content?.find(c => c.type === 'text')?.text || '';
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch (parseErr) {
        console.error('Parse error:', parseErr);
        extractedData = { type: 'unknown', items: [], total: 0, notes: 'Could not parse receipt' };
      }
      
      // Create receipt record
      const newReceipt = {
        id: `RCP-${Date.now()}`,
        fileName,
        fileType,
        fileData: base64,
        uploadedAt: new Date().toISOString(),
        ...extractedData,
        linkedItems: [],
        linkedLots: []
      };
      
      onAddReceipt(newReceipt);
      setSelectedReceipt(newReceipt);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.message || 'Failed to process receipt');
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
      e.target.value = '';
    }
  };
  
  // Download receipt as file
  const downloadReceipt = (receipt) => {
    const byteCharacters = atob(receipt.fileData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: receipt.fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = receipt.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Filter receipts
  const filteredReceipts = (receipts || []).filter(r => {
    if (filter === 'all') return true;
    return r.type === filter;
  }).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  
  // Calculate totals
  const totals = {
    purchases: (receipts || []).filter(r => r.type === 'purchase').reduce((sum, r) => sum + (r.total || 0), 0),
    sales: (receipts || []).filter(r => r.type === 'sale').reduce((sum, r) => sum + (r.total || 0), 0)
  };
  
  // Receipt detail view
  if (selectedReceipt) {
    const receipt = isEditing ? editForm : selectedReceipt;
    
    return (
      <div className="min-h-screen bg-amber-50">
        <div className="bg-amber-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => { 
              if (isEditing) { cancelEditing(); } 
              else { setSelectedReceipt(null); }
            }} className="mr-4">
              {isEditing ? '✕ Cancel' : '← Back'}
            </button>
            <h1 className="text-xl font-bold">{isEditing ? 'Edit Receipt' : 'Receipt Details'}</h1>
          </div>
          {isEditing ? (
            <button 
              onClick={saveEdits}
              className="bg-green-500 text-white px-4 py-1 rounded text-sm font-medium"
            >
              ✓ Save
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={startEditing}
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm font-medium"
              >
                Edit
              </button>
              <button 
                onClick={() => downloadReceipt(selectedReceipt)}
                className="bg-white text-amber-700 px-3 py-1 rounded text-sm font-medium"
              >
                Download
              </button>
            </div>
          )}
        </div>
        
        <div className="p-4 space-y-4">
          {/* Receipt Header */}
          <div className="bg-white rounded-lg shadow p-4">
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Type</label>
                  <select 
                    value={editForm.type || 'purchase'}
                    onChange={(e) => setEditForm({...editForm, type: e.target.value})}
                    className="w-full border rounded p-2 mt-1"
                  >
                    <option value="purchase">Purchase</option>
                    <option value="sale">Sale</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Vendor/Customer</label>
                  <input 
                    type="text"
                    value={editForm.vendor || ''}
                    onChange={(e) => setEditForm({...editForm, vendor: e.target.value})}
                    className="w-full border rounded p-2 mt-1"
                    placeholder="Name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Vendor Type</label>
                    <select 
                      value={editForm.vendorType || 'individual'}
                      onChange={(e) => setEditForm({...editForm, vendorType: e.target.value})}
                      className="w-full border rounded p-2 mt-1"
                    >
                      <option value="individual">Individual</option>
                      <option value="dealer">Dealer</option>
                      <option value="refiner">Refiner</option>
                      <option value="auction">Auction</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Date</label>
                    <input 
                      type="date"
                      value={editForm.date || ''}
                      onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                      className="w-full border rounded p-2 mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Reference Number</label>
                  <input 
                    type="text"
                    value={editForm.referenceNumber || ''}
                    onChange={(e) => setEditForm({...editForm, referenceNumber: e.target.value})}
                    className="w-full border rounded p-2 mt-1"
                    placeholder="Invoice/Receipt #"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      receipt.type === 'purchase' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {receipt.type === 'purchase' ? '📥 PURCHASE' : '📤 SALE'}
                    </span>
                    <h2 className="text-lg font-bold mt-2">{receipt.vendor || 'Unknown Vendor'}</h2>
                    <p className="text-sm text-gray-500">{receipt.vendorType}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-amber-700">${(receipt.total || 0).toLocaleString()}</div>
                    <div className="text-sm text-gray-500">{receipt.date || 'No date'}</div>
                  </div>
                </div>
                {receipt.referenceNumber && (
                  <div className="text-sm text-gray-600">Ref: {receipt.referenceNumber}</div>
                )}
              </>
            )}
          </div>
          
          {/* Line Items */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Items ({receipt.items?.length || 0})</h3>
              {isEditing && (
                <button 
                  onClick={addEditItem}
                  className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded"
                >
                  + Add Item
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              {(receipt.items || []).map((item, idx) => (
                <div key={idx} className={`${isEditing ? 'bg-gray-50 p-3 rounded border' : 'border-b pb-2 last:border-b-0 last:pb-0'}`}>
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <input 
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => updateEditItem(idx, 'description', e.target.value)}
                          className="flex-1 border rounded p-1 text-sm"
                          placeholder="Description"
                        />
                        <button 
                          onClick={() => removeEditItem(idx)}
                          className="ml-2 text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Qty</label>
                          <input 
                            type="number"
                            value={item.quantity || 1}
                            onChange={(e) => updateEditItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full border rounded p-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Unit $</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={item.unitPrice || ''}
                            onChange={(e) => updateEditItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full border rounded p-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Total $</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={item.totalPrice || ''}
                            onChange={(e) => updateEditItem(idx, 'totalPrice', parseFloat(e.target.value) || 0)}
                            className="w-full border rounded p-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Metal</label>
                          <select 
                            value={item.metalType || ''}
                            onChange={(e) => updateEditItem(idx, 'metalType', e.target.value)}
                            className="w-full border rounded p-1 text-sm"
                          >
                            <option value="">--</option>
                            <option value="Gold">Gold</option>
                            <option value="Silver">Silver</option>
                            <option value="Platinum">Platinum</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Purity</label>
                          <input 
                            type="text"
                            value={item.purity || ''}
                            onChange={(e) => updateEditItem(idx, 'purity', e.target.value)}
                            className="w-full border rounded p-1 text-sm"
                            placeholder="14K, 925..."
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Weight</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={item.weight || ''}
                            onChange={(e) => updateEditItem(idx, 'weight', parseFloat(e.target.value) || 0)}
                            className="w-full border rounded p-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Unit</label>
                          <select 
                            value={item.weightUnit || 'oz'}
                            onChange={(e) => updateEditItem(idx, 'weightUnit', e.target.value)}
                            className="w-full border rounded p-1 text-sm"
                          >
                            <option value="oz">oz</option>
                            <option value="g">g</option>
                            <option value="dwt">dwt</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.description}</div>
                        <div className="text-xs text-gray-500">
                          {item.quantity > 1 && `Qty: ${item.quantity} • `}
                          {item.metalType && `${item.metalType} `}
                          {item.purity && `${item.purity} `}
                          {item.weight && `• ${item.weight}${item.weightUnit || 'oz'}`}
                        </div>
                      </div>
                      <div className="text-right">
                        {item.totalPrice && (
                          <div className="font-medium">${item.totalPrice.toLocaleString()}</div>
                        )}
                        {item.unitPrice && item.quantity > 1 && (
                          <div className="text-xs text-gray-500">${item.unitPrice}/ea</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Totals */}
            <div className="mt-4 pt-3 border-t space-y-2 text-sm">
              {isEditing ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Subtotal</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={editForm.subtotal || ''}
                        onChange={(e) => setEditForm({...editForm, subtotal: parseFloat(e.target.value) || 0})}
                        className="w-full border rounded p-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Tax</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={editForm.tax || ''}
                        onChange={(e) => setEditForm({...editForm, tax: parseFloat(e.target.value) || 0})}
                        className="w-full border rounded p-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Shipping</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={editForm.shipping || ''}
                        onChange={(e) => setEditForm({...editForm, shipping: parseFloat(e.target.value) || 0})}
                        className="w-full border rounded p-1 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Total</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={editForm.total || ''}
                      onChange={(e) => setEditForm({...editForm, total: parseFloat(e.target.value) || 0})}
                      className="w-full border rounded p-2 text-lg font-bold"
                    />
                  </div>
                </>
              ) : (
                <>
                  {receipt.subtotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span>${receipt.subtotal.toLocaleString()}</span>
                    </div>
                  )}
                  {receipt.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax</span>
                      <span>${receipt.tax.toLocaleString()}</span>
                    </div>
                  )}
                  {receipt.shipping > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping</span>
                      <span>${receipt.shipping.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-2 border-t">
                    <span>Total</span>
                    <span>${(receipt.total || 0).toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Payment & Notes */}
          <div className="bg-white rounded-lg shadow p-4">
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Payment Method</label>
                    <select 
                      value={editForm.paymentMethod || ''}
                      onChange={(e) => setEditForm({...editForm, paymentMethod: e.target.value})}
                      className="w-full border rounded p-2 mt-1"
                    >
                      <option value="">Not specified</option>
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="wire">Wire Transfer</option>
                      <option value="card">Card</option>
                      <option value="zelle">Zelle</option>
                      <option value="venmo">Venmo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">AI Confidence</label>
                    <div className={`mt-1 p-2 rounded text-sm ${
                      editForm.confidence === 'high' ? 'bg-green-100 text-green-700' :
                      editForm.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {editForm.confidence || 'Unknown'}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Notes</label>
                  <textarea 
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                    className="w-full border rounded p-2 mt-1"
                    rows={3}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Payment Method</span>
                    <div className="font-medium capitalize">{receipt.paymentMethod || 'Not specified'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">AI Confidence</span>
                    <div className={`font-medium ${
                      receipt.confidence === 'high' ? 'text-green-600' :
                      receipt.confidence === 'medium' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {receipt.confidence || 'Unknown'}
                    </div>
                  </div>
                </div>
                {receipt.notes && (
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-gray-500 text-sm">Notes</span>
                    <p className="text-sm mt-1">{receipt.notes}</p>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Original File Preview - only show when not editing */}
          {!isEditing && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-medium mb-3">Original Document</h3>
              {selectedReceipt.fileType?.startsWith('image/') ? (
                <img 
                  src={`data:${selectedReceipt.fileType};base64,${selectedReceipt.fileData}`}
                  alt="Receipt"
                  className="w-full rounded border"
                />
              ) : (
                <div className="bg-gray-100 p-4 rounded text-center">
                  <FileText size={48} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">{selectedReceipt.fileName}</p>
                  <button 
                    onClick={() => downloadReceipt(selectedReceipt)}
                    className="mt-2 text-blue-600 text-sm underline"
                  >
                    Download to view PDF
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Delete Button - only show when not editing */}
          {!isEditing && (
            <button 
              onClick={() => {
                if (confirm('Delete this receipt?')) {
                  onDeleteReceipt(selectedReceipt.id);
                  setSelectedReceipt(null);
                }
              }}
              className="w-full border border-red-300 text-red-600 py-2 rounded flex items-center justify-center gap-2"
            >
              <Trash2 size={16} /> Delete Receipt
            </button>
          )}
        </div>
      </div>
    );
  }
  
  // Receipt list view
  return (
    <div className="min-h-screen bg-amber-50">
      <div className="bg-amber-700 text-white p-4 flex items-center">
        <button onClick={onBack} className="mr-4">← Back</button>
        <FileText size={24} className="mr-2" />
        <h1 className="text-xl font-bold">Receipts</h1>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Upload Button */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isAnalyzing}
          className="w-full bg-amber-600 text-white p-4 rounded-lg shadow flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isAnalyzing ? (
            <>
              <Loader size={24} className="animate-spin" />
              <span>AI Analyzing Receipt...</span>
            </>
          ) : isUploading ? (
            <>
              <Loader size={24} className="animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload size={24} />
              <div className="text-left">
                <div className="font-bold">Upload Receipt</div>
                <div className="text-sm opacity-80">Photo or PDF • AI extracts data</div>
              </div>
            </>
          )}
        </button>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload}
          accept="image/*,.pdf,application/pdf"
          className="hidden"
        />
        
        {uploadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
            {uploadError}
          </div>
        )}
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
            <div className="text-xs text-red-600 font-medium">PURCHASES</div>
            <div className="text-xl font-bold text-red-700">${totals.purchases.toLocaleString()}</div>
            <div className="text-xs text-red-500">{(receipts || []).filter(r => r.type === 'purchase').length} receipts</div>
          </div>
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
            <div className="text-xs text-green-600 font-medium">SALES</div>
            <div className="text-xl font-bold text-green-700">${totals.sales.toLocaleString()}</div>
            <div className="text-xs text-green-500">{(receipts || []).filter(r => r.type === 'sale').length} receipts</div>
          </div>
        </div>
        
        {/* Filter */}
        <div className="flex gap-2">
          {['all', 'purchase', 'sale'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded text-sm font-medium ${
                filter === f 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-white border text-gray-600'
              }`}
            >
              {f === 'all' ? 'All' : f === 'purchase' ? 'Purchases' : 'Sales'}
            </button>
          ))}
        </div>
        
        {/* Receipt List */}
        {filteredReceipts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <FileText size={48} className="mx-auto mb-3 opacity-50" />
            <p>No receipts yet</p>
            <p className="text-sm">Upload purchase or sale receipts to track transactions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredReceipts.map(receipt => (
              <button
                key={receipt.id}
                onClick={() => setSelectedReceipt(receipt)}
                className="w-full bg-white rounded-lg shadow p-4 text-left flex items-center gap-3"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  receipt.type === 'purchase' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                }`}>
                  {receipt.type === 'purchase' ? '📥' : '📤'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{receipt.vendor || 'Unknown'}</div>
                  <div className="text-xs text-gray-500">
                    {receipt.date || 'No date'} • {receipt.items?.length || 0} items
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${receipt.type === 'purchase' ? 'text-red-600' : 'text-green-600'}`}>
                    {receipt.type === 'purchase' ? '-' : '+'}${(receipt.total || 0).toLocaleString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsView({ onBack, onExport, onImport, onReset, fileInputRef, coinBuyPercents, onUpdateCoinBuyPercent, ebayConnected, onEbayDisconnect, onViewEbaySync, onViewAdmin, buyPercentages, onUpdateBuyPercentages, refinerRates, onUpdateRefinerRates }) {
  const [showCoinSettings, setShowCoinSettings] = useState(false);
  const [showBuySettings, setShowBuySettings] = useState(false);
  const [showRefinerSettings, setShowRefinerSettings] = useState(false);
  
  // Local state for buy percentages (with defaults)
  const [localBuyPercents, setLocalBuyPercents] = useState({
    silver: buyPercentages?.silver || 70,
    gold: buyPercentages?.gold || 90,
    resale: buyPercentages?.resale || 45
  });
  
  // Local state for refiner rates (with defaults)
  const [localRefinerRates, setLocalRefinerRates] = useState({
    gold: refinerRates?.gold || 98,
    silver: refinerRates?.silver || 85
  });
  
  // Get all percentage-based coins
  const percentageCoins = Object.entries(coinReference)
    .filter(([key, coin]) => coin.pricingMode === 'percentage')
    .map(([key, coin]) => ({ key, ...coin }));

  return (
    <div className="min-h-screen bg-amber-50">
      <div className="bg-amber-700 text-white p-4 flex items-center">
        <button onClick={onBack} className="mr-4">← Back</button>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>
      <div className="p-4 space-y-4">
        
        {/* Admin Panel Link */}
        <button 
          onClick={onViewAdmin}
          className="w-full bg-red-700 text-white p-4 rounded-lg shadow flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Shield size={24} />
            <div className="text-left">
              <div className="font-bold">Admin Panel</div>
              <div className="text-sm opacity-80">Export data, clear collections, database</div>
            </div>
          </div>
          <span>→</span>
        </button>
        
        {/* Buy Percentages */}
        <div className="bg-white p-4 rounded-lg shadow">
          <button 
            onClick={() => setShowBuySettings(!showBuySettings)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-medium flex items-center gap-2">
              <DollarSign size={18} /> Buy Percentages
            </h3>
            <span className="text-gray-400">{showBuySettings ? '▲' : '▼'}</span>
          </button>
          
          {showBuySettings && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-gray-500">
                What percentage of melt value you pay when buying
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm">Silver (sterling, scrap)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={localBuyPercents.silver}
                      onChange={(e) => setLocalBuyPercents({...localBuyPercents, silver: parseInt(e.target.value) || 0})}
                      className="w-16 text-center border rounded p-1 text-sm"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm">Gold (jewelry, scrap)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={localBuyPercents.gold}
                      onChange={(e) => setLocalBuyPercents({...localBuyPercents, gold: parseInt(e.target.value) || 0})}
                      className="w-16 text-center border rounded p-1 text-sm"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">Resale items</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={localBuyPercents.resale}
                      onChange={(e) => setLocalBuyPercents({...localBuyPercents, resale: parseInt(e.target.value) || 0})}
                      className="w-16 text-center border rounded p-1 text-sm"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-gray-500 bg-amber-50 p-2 rounded">
                <strong>Example:</strong> Silver at $90/oz, 70% buy = you pay $63/oz
              </div>
            </div>
          )}
        </div>
        
        {/* Refiner Payout Rates */}
        <div className="bg-white p-4 rounded-lg shadow">
          <button 
            onClick={() => setShowRefinerSettings(!showRefinerSettings)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-medium flex items-center gap-2">
              <Flame size={18} /> Refiner Payout Rates
            </h3>
            <span className="text-gray-400">{showRefinerSettings ? '▲' : '▼'}</span>
          </button>
          
          {showRefinerSettings && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-gray-500">
                What percentage your refiner pays you for melt
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm">Gold</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={localRefinerRates.gold}
                      onChange={(e) => setLocalRefinerRates({...localRefinerRates, gold: parseInt(e.target.value) || 0})}
                      className="w-16 text-center border rounded p-1 text-sm"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">Silver</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={localRefinerRates.silver}
                      onChange={(e) => setLocalRefinerRates({...localRefinerRates, silver: parseInt(e.target.value) || 0})}
                      className="w-16 text-center border rounded p-1 text-sm"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                <strong>Profit calculation:</strong> (Refiner rate - Buy rate) × melt value
              </div>
            </div>
          )}
        </div>
        
        {/* Coin Buy Percentages */}
        <div className="bg-white p-4 rounded-lg shadow">
          <button 
            onClick={() => setShowCoinSettings(!showCoinSettings)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-medium flex items-center gap-2">
              <Calculator size={18} /> Coin Buy Percentages
            </h3>
            <span className="text-gray-400">{showCoinSettings ? '▲' : '▼'}</span>
          </button>
          
          {showCoinSettings && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-gray-500 mb-3">
                Set what % of melt value you pay for each coin type
              </p>
              
              {percentageCoins.map(coin => {
                const currentPercent = coinBuyPercents[coin.key] ?? coin.buyPercent ?? 85;
                return (
                  <div key={coin.key} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{coin.name}</div>
                      <div className="text-xs text-gray-500">{coin.years}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={currentPercent}
                        onChange={(e) => onUpdateCoinBuyPercent(coin.key, parseInt(e.target.value) || 0)}
                        className="w-16 text-center border rounded p-1 text-sm"
                        min="0"
                        max="150"
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  </div>
                );
              })}
              
              <div className="pt-3 border-t">
                <p className="text-xs text-gray-500">
                  100% = spot melt value. Above 100% = paying premium.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* eBay Connection */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <ExternalLink size={18} /> eBay Integration
          </h3>
          {ebayConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded">
                <Check size={18} />
                <span className="font-medium">Connected</span>
              </div>
              <button
                onClick={onViewEbaySync}
                className="w-full bg-blue-600 text-white py-2 rounded flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} /> Sync Listings
              </button>
              <button
                onClick={onEbayDisconnect}
                className="w-full border border-red-300 text-red-600 py-2 rounded text-sm"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Connect to import active listings and sync inventory.
              </p>
              <a
                href="/api/ebay-auth"
                className="block w-full bg-blue-600 text-white py-3 rounded text-center font-medium"
              >
                Connect eBay Account
              </a>
            </div>
          )}
        </div>
        
        {/* Legacy Import/Export - hidden but functional */}
        <input type="file" ref={fileInputRef} onChange={onImport} accept=".json" className="hidden" />
      </div>
    </div>
  );
}

// ============ EBAY SYNC VIEW ============
function EbaySyncView({ onBack, onImportListings, inventory }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedListings, setSelectedListings] = useState([]);
  
  // Get eBay tokens from localStorage
  const getEbayToken = () => localStorage.getItem('ebay_access_token');
  
  useEffect(() => {
    fetchListings();
  }, []);
  
  const fetchListings = async () => {
    setLoading(true);
    setError(null);
    
    const token = getEbayToken();
    if (!token) {
      setError('eBay not connected. Please connect your eBay account in Settings.');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch('/api/ebay-listings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.needsRefresh) {
          // Try to refresh token
          const refreshed = await refreshToken();
          if (refreshed) {
            fetchListings(); // Retry
            return;
          }
        }
        throw new Error(data.error || 'Failed to fetch listings');
      }
      
      setListings(data.listings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const refreshToken = async () => {
    const refreshToken = localStorage.getItem('ebay_refresh_token');
    if (!refreshToken) return false;
    
    try {
      const response = await fetch('/api/ebay-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('ebay_access_token', data.access_token);
        localStorage.setItem('ebay_token_time', data.token_time.toString());
        return true;
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
    }
    return false;
  };
  
  // Check if listing already exists in inventory (by title match or ID)
  const isAlreadyImported = (listing) => {
    const title = (listing.title || listing.sku || '').toLowerCase();
    return inventory.some(item => 
      item.description?.toLowerCase().includes(title.substring(0, 30)) || 
      item.ebayListingId === listing.listingId ||
      item.ebayListingId === listing.itemId ||
      item.ebayListingId === listing.legacyItemId ||
      item.ebayOfferId === listing.offerId
    );
  };
  
  const toggleSelection = (listing) => {
    const listingId = listing.itemId || listing.sku || listing.listingId;
    setSelectedListings(prev => {
      const exists = prev.find(l => (l.itemId || l.sku || l.listingId) === listingId);
      if (exists) {
        return prev.filter(l => (l.itemId || l.sku || l.listingId) !== listingId);
      } else {
        return [...prev, listing];
      }
    });
  };
  
  const handleImportSelected = () => {
    const itemsToImport = selectedListings.map(listing => ({
      description: listing.title || listing.sku,
      category: 'eBay Import',
      metalType: 'Unknown',
      purity: '',
      weightOz: 0,
      purchasePrice: 0,
      meltValue: 0,
      status: 'Listed',
      source: 'eBay',
      dateAcquired: new Date().toISOString().split('T')[0],
      ebayListingId: listing.itemId || listing.legacyItemId || listing.listingId,
      ebayOfferId: listing.offerId,
      ebayPrice: listing.price,
      ebayQuantity: listing.quantity,
      ebayStatus: listing.status || 'ACTIVE',
      ebayUrl: listing.itemWebUrl,
      notes: `Imported from eBay. Price: $${listing.price || 0}`,
      photo: listing.imageUrl || listing.imageUrls?.[0] || null
    }));
    
    onImportListings(itemsToImport);
  };
  
  const newListings = listings.filter(l => !isAlreadyImported(l));
  const existingListings = listings.filter(l => isAlreadyImported(l));
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1">
            ← Back
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <RefreshCw size={20} /> eBay Sync
          </h1>
          <button onClick={fetchListings} disabled={loading} className="p-2">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Status Summary */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{listings.length}</div>
              <div className="text-xs text-gray-500">Total on eBay</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{newListings.length}</div>
              <div className="text-xs text-gray-500">New to Import</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-400">{existingListings.length}</div>
              <div className="text-xs text-gray-500">Already Tracked</div>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Loader className="animate-spin mx-auto mb-2" size={32} />
            <p className="text-gray-500">Loading your eBay listings...</p>
          </div>
        ) : (
          <>
            {/* New Listings to Import */}
            {newListings.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-3 border-b bg-green-50">
                  <h3 className="font-bold text-green-700 flex items-center gap-2">
                    <Plus size={18} /> New Listings to Import ({newListings.length})
                  </h3>
                </div>
                <div className="divide-y max-h-96 overflow-y-auto">
                  {newListings.map(listing => (
                    <div 
                      key={listing.itemId || listing.sku || listing.listingId} 
                      className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 ${
                        selectedListings.find(l => (l.itemId || l.sku) === (listing.itemId || listing.sku)) ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => toggleSelection(listing)}
                    >
                      <input
                        type="checkbox"
                        checked={!!selectedListings.find(l => (l.itemId || l.sku) === (listing.itemId || listing.sku))}
                        onChange={() => {}}
                        className="w-5 h-5"
                      />
                      {(listing.imageUrl || listing.imageUrls?.[0]) && (
                        <img src={listing.imageUrl || listing.imageUrls[0]} alt="" className="w-12 h-12 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{listing.title || listing.sku}</div>
                        <div className="text-xs text-gray-500">
                          {listing.condition || listing.status || 'Active'} • {listing.itemId ? `#${listing.itemId.slice(-6)}` : listing.sku}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">${listing.price || 0}</div>
                        <div className="text-xs text-gray-400">{listing.buyingOptions?.[0] || listing.format || 'Fixed'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedListings.length > 0 && (
                  <div className="p-3 border-t bg-gray-50">
                    <button
                      onClick={handleImportSelected}
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <Download size={18} /> Import {selectedListings.length} Selected Listing{selectedListings.length > 1 ? 's' : ''}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Already Tracked */}
            {existingListings.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-3 border-b bg-gray-50">
                  <h3 className="font-bold text-gray-600 flex items-center gap-2">
                    <Check size={18} /> Already in Inventory ({existingListings.length})
                  </h3>
                </div>
                <div className="divide-y max-h-48 overflow-y-auto">
                  {existingListings.map(listing => (
                    <div key={listing.sku || listing.listingId} className="p-3 flex items-center gap-3 opacity-60">
                      {listing.imageUrls?.[0] && (
                        <img src={listing.imageUrls[0]} alt="" className="w-10 h-10 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{listing.title || listing.sku}</div>
                      </div>
                      <div className="text-green-600 text-sm">✓ Tracked</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {listings.length === 0 && !error && (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <Package size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No active listings found on eBay</p>
                <p className="text-sm text-gray-400 mt-1">
                  List items on eBay, then sync to track them here
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============ MAIN APP ============
export default function SESInventoryApp() {
  // Start with null to indicate "not yet loaded" vs "empty"
  const [inventory, setInventory] = useState(null);
  const [clients, setClients] = useState(null);
  const [lots, setLots] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if initial load is complete
  const [kpiExpanded, setKpiExpanded] = useState(true); // KPI dashboard expanded by default
  const [kpiFilter, setKpiFilter] = useState(null); // Filter for KPI drill-down: 'stash', 'hold', 'sell', 'available', 'silver', 'gold', 'platinum', 'sold'
  const [view, setView] = useState('list');
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingListing, setPendingListing] = useState(null); // Store generated listing for eBay
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [liveSpotPrices, setLiveSpotPrices] = useState(spotPrices);
  const [spotLastUpdate, setSpotLastUpdate] = useState(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [ebayConnected, setEbayConnected] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]); // Bulk selection for multi-item actions
  const [bulkMode, setBulkMode] = useState(false); // Whether bulk selection mode is active
  const [coinBuyPercents, setCoinBuyPercents] = useState(() => {
    // Load from localStorage or use defaults from coinReference
    const saved = localStorage.getItem('ses-coin-buy-percents');
    if (saved) return JSON.parse(saved);
    // Build defaults from coinReference
    const defaults = {};
    Object.entries(coinReference).forEach(([key, coin]) => {
      if (coin.pricingMode === 'percentage' && coin.buyPercent) {
        defaults[key] = coin.buyPercent;
      }
    });
    return defaults;
  });
  const fileInputRef = useRef(null);
  
  // Check for eBay connection on mount and handle OAuth callback
  useEffect(() => {
    // Check if we have a valid eBay token
    const token = localStorage.getItem('ebay_access_token');
    const tokenTime = localStorage.getItem('ebay_token_time');
    if (token && tokenTime) {
      // Check if token is less than 2 hours old
      const tokenAge = Date.now() - parseInt(tokenTime);
      if (tokenAge < 7200000) { // 2 hours in ms
        setEbayConnected(true);
      }
    }
    
    // Handle OAuth callback params
    const params = new URLSearchParams(window.location.search);
    if (params.get('ebay_connected') === 'true') {
      const accessToken = params.get('ebay_access_token');
      const refreshToken = params.get('ebay_refresh_token');
      const expiresIn = params.get('ebay_expires_in');
      const tokenTime = params.get('ebay_token_time');
      
      if (accessToken) {
        localStorage.setItem('ebay_access_token', accessToken);
        localStorage.setItem('ebay_refresh_token', refreshToken || '');
        localStorage.setItem('ebay_expires_in', expiresIn || '7200');
        localStorage.setItem('ebay_token_time', tokenTime || Date.now().toString());
        setEbayConnected(true);
        
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
    
    if (params.get('ebay_error')) {
      alert('eBay connection failed: ' + params.get('ebay_error'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  
  // eBay disconnect handler
  const handleEbayDisconnect = () => {
    localStorage.removeItem('ebay_access_token');
    localStorage.removeItem('ebay_refresh_token');
    localStorage.removeItem('ebay_expires_in');
    localStorage.removeItem('ebay_token_time');
    setEbayConnected(false);
  };
  
  // Import eBay listings to inventory
  const handleImportEbayListings = (items) => {
    const currentInventory = inventory || [];
    let currentMax = currentInventory.length > 0 
      ? Math.max(...currentInventory.map(i => parseInt(i.id.replace('SES-', '')) || 0))
      : 0;
    
    const newItems = items.map((item, index) => ({
      ...item,
      id: `SES-${String(currentMax + index + 1).padStart(3, '0')}`
    }));
    
    setInventory([...currentInventory, ...newItems]);
    setView('list');
    alert(`Imported ${newItems.length} listing(s) from eBay`);
  };
  
  // Save coin buy percents to localStorage when they change
  useEffect(() => {
    localStorage.setItem('ses-coin-buy-percents', JSON.stringify(coinBuyPercents));
  }, [coinBuyPercents]);
  
  // Handler to update coin buy percent
  const handleUpdateCoinBuyPercent = (coinKey, percent) => {
    setCoinBuyPercents(prev => ({ ...prev, [coinKey]: percent }));
  };
  
  // Helper to get buy percent for a coin
  const getCoinBuyPercent = (coinKey) => {
    return coinBuyPercents[coinKey] ?? coinReference[coinKey]?.buyPercent ?? 85;
  };

  // Initialize services on mount
  useEffect(() => {
    const initServices = async () => {
      // Initialize Firebase
      const fbReady = await FirebaseService.init();
      setFirebaseReady(fbReady);
      
      // Load data from Firebase if available
      if (fbReady) {
        const [fbInventory, fbClients, fbLots] = await Promise.all([
          FirebaseService.loadInventory(),
          FirebaseService.loadClients(),
          FirebaseService.loadLots()
        ]);
        
        // Use Firebase data if it exists, otherwise use starter data
        setInventory(fbInventory?.length ? fbInventory : starterInventory);
        setClients(fbClients?.length ? fbClients : starterClients);
        setLots(fbLots?.length ? fbLots : starterLots);
        
        console.log('Loaded from Firebase:', {
          inventory: fbInventory?.length || 0,
          clients: fbClients?.length || 0,
          lots: fbLots?.length || 0
        });
      } else {
        // Firebase not available, use starter data
        setInventory(starterInventory);
        setClients(starterClients);
        setLots(starterLots);
        console.log('Firebase not available, using starter data');
      }
      
      // Mark initial load as complete - this enables auto-save
      setDataLoaded(true);
      
      // Fetch live spot prices
      await refreshSpotPrices();
    };
    
    initServices();
    
    // Refresh spot prices every 5 minutes
    const priceInterval = setInterval(refreshSpotPrices, 5 * 60 * 1000);
    return () => clearInterval(priceInterval);
  }, []);
  
  // Auto-save to Firebase when data changes - ONLY after initial load completes
  useEffect(() => {
    if (firebaseReady && dataLoaded && inventory !== null && inventory.length >= 0) {
      FirebaseService.saveInventory(inventory);
    }
  }, [inventory, firebaseReady, dataLoaded]);
  
  useEffect(() => {
    if (firebaseReady && dataLoaded && clients !== null && clients.length >= 0) {
      FirebaseService.saveClients(clients);
    }
  }, [clients, firebaseReady, dataLoaded]);
  
  useEffect(() => {
    if (firebaseReady && dataLoaded && lots !== null && lots.length >= 0) {
      FirebaseService.saveLots(lots);
    }
  }, [lots, firebaseReady, dataLoaded]);
  
  // Refresh spot prices
  const refreshSpotPrices = async () => {
    setIsLoadingPrices(true);
    const prices = await SpotPriceService.fetchPrices();
    if (prices) {
      setLiveSpotPrices(prices);
      setSpotLastUpdate(new Date());
    }
    setIsLoadingPrices(false);
  };

  const stats = {
    availableItems: (inventory || []).filter(i => i.status === 'Available').length,
    soldItems: (inventory || []).filter(i => i.status === 'Sold').length,
    totalMelt: (inventory || []).filter(i => i.status === 'Available').reduce((sum, i) => sum + (i.meltValue || 0), 0),
    totalProfit: (inventory || []).filter(i => i.status === 'Sold').reduce((sum, i) => sum + ((i.salePrice || 0) - (i.purchasePrice || 0)), 0)
  };
  
  // Hold stats
  const available = (inventory || []).filter(i => i.status === 'Available');
  const onHoldCount = available.filter(i => getHoldStatus(i).status === 'hold').length;
  const readyCount = available.filter(i => getHoldStatus(i).canSell).length;

  const filteredInventory = (inventory || []).filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) || item.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'available' && item.status === 'Available') || (filter === 'sold' && item.status === 'Sold');
    
    // KPI filter from dashboard drill-down
    let matchesKpiFilter = true;
    if (kpiFilter) {
      switch (kpiFilter) {
        case 'stash':
          matchesKpiFilter = item.status === 'Stash';
          break;
        case 'hold':
          matchesKpiFilter = item.plannedDisposition === 'hold';
          break;
        case 'sell':
          matchesKpiFilter = item.plannedDisposition === 'sell';
          break;
        case 'available':
          matchesKpiFilter = item.status === 'Available' && !item.plannedDisposition;
          break;
        case 'sold':
          matchesKpiFilter = item.status === 'Sold';
          break;
        case 'silver':
          matchesKpiFilter = item.metalType?.toLowerCase() === 'silver' && item.status !== 'Sold';
          break;
        case 'gold':
          matchesKpiFilter = item.metalType?.toLowerCase() === 'gold' && item.status !== 'Sold';
          break;
        case 'platinum':
          matchesKpiFilter = item.metalType?.toLowerCase() === 'platinum' && item.status !== 'Sold';
          break;
        default:
          matchesKpiFilter = true;
      }
    }
    
    return matchesSearch && matchesFilter && matchesKpiFilter;
  });

  const getNextId = (prefix) => {
    const items = prefix === 'SES' ? (inventory || []) : prefix === 'LOT' ? (lots || []) : (clients || []);
    const nums = items.map(i => parseInt(i.id.replace(`${prefix}-`, ''))).filter(n => !isNaN(n));
    return `${prefix}-${String(Math.max(...nums, 0) + 1).padStart(3, '0')}`;
  };

  const calculateMelt = (metalType, purity, weightOz) => {
    const weight = parseFloat(weightOz) || 0;
    let purityDecimal = 1;
    if (purity?.includes('K')) purityDecimal = parseInt(purity) / 24;
    else if (purity?.includes('%')) purityDecimal = parseInt(purity) / 100;
    else if (purity === '925') purityDecimal = 0.925;
    else if (purity === '999') purityDecimal = 0.999;
    return (weight * purityDecimal * (liveSpotPrices[metalType?.toLowerCase()] || 0)).toFixed(2);
  };
  
  // Handle lot purchase save
  const handleLotSave = (lotData) => {
    const lotId = getNextId('LOT');
    const newLot = {
      id: lotId,
      ...lotData.lotInfo,
      createdAt: new Date().toISOString()
    };
    setLots([...lots, newLot]);
    
    // Add all items to inventory with lot reference
    const newItems = lotData.items.map((item, index) => ({
      ...item,
      id: `${getNextId('SES').slice(0, -3)}${String(inventory.length + index + 1).padStart(3, '0')}`,
      lotId: lotId
    }));
    
    // Generate proper IDs
    let currentMax = inventory.length > 0 
      ? Math.max(...inventory.map(i => parseInt(i.id.replace('SES-', '')) || 0))
      : 0;
    
    const itemsWithIds = lotData.items.map((item, index) => ({
      ...item,
      id: `SES-${String(currentMax + index + 1).padStart(3, '0')}`,
      lotId: lotId
    }));
    
    setInventory([...inventory, ...itemsWithIds]);
    setView('list');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ inventory, clients, lots }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `ses-backup-${new Date().toISOString().split('T')[0]}.json`; a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.inventory) setInventory(data.inventory);
          if (data.clients) setClients(data.clients);
          if (data.lots) setLots(data.lots);
        } catch {}
      };
      reader.readAsText(file);
    }
  };

  // Default buy percentages for appraisal
  const buyPercentages = {
    gold: 90,
    silver: 70,
    platinum: 85,
    palladium: 80
  };
  
  // Handle appraisal session completion
  const handleAppraisalComplete = (sessionData) => {
    // Check if this is a declined offer (save for reference only)
    if (sessionData.status === 'declined') {
      // Save appraisal record to client WITHOUT adding inventory
      const appraisalRecord = sessionData.appraisalRecord || {
        id: `APR-${Date.now()}`,
        date: sessionData.sessionDate,
        status: 'declined',
        itemCount: 0,
        totalOffered: sessionData.appraisalRecord?.totalOffered || 0,
        totalPaid: 0,
        notes: sessionData.notes,
        items: sessionData.appraisalRecord?.items || []
      };
      
      // Update client with declined appraisal record
      setClients(clients.map(c => {
        if (c.id === sessionData.client.id) {
          return {
            ...c,
            appraisals: [...(c.appraisals || []), appraisalRecord],
            lastContact: sessionData.sessionDate.split('T')[0]
          };
        }
        return c;
      }));
      
      setView('list');
      return;
    }
    
    // Regular purchase flow below...
    // Generate lot ID
    const lotId = getNextId('LOT');
    
    // Create lot record
    const newLot = {
      id: lotId,
      description: `Appraisal Session - ${sessionData.client.name}`,
      totalCost: sessionData.totalPaid,
      clientId: sessionData.client.id,
      source: 'Appraisal Session',
      dateAcquired: sessionData.sessionDate.split('T')[0],
      notes: sessionData.notes,
      discount: sessionData.discount,
      createdAt: sessionData.sessionDate
    };
    setLots([...lots, newLot]);
    
    // Save appraisal record to client
    const appraisalRecord = {
      id: `APR-${Date.now()}`,
      date: sessionData.sessionDate,
      itemCount: sessionData.items.reduce((sum, i) => sum + (i.quantity || 1), 0),
      totalPaid: sessionData.totalPaid,
      discount: sessionData.discount,
      notes: sessionData.notes,
      items: sessionData.items.map(item => ({
        description: item.description,
        grade: item.grade,
        year: item.year,
        purchasePrice: item.purchasePrice,
        meltValue: item.meltValue,
        quantity: item.quantity || 1
      })),
      lotId: lotId
    };
    
    // Update client with appraisal record and totals
    setClients(clients.map(c => {
      if (c.id === sessionData.client.id) {
        return {
          ...c,
          appraisals: [...(c.appraisals || []), appraisalRecord],
          totalTransactions: (c.totalTransactions || 0) + 1,
          totalPurchased: (c.totalPurchased || 0) + sessionData.totalPaid,
          lastTransaction: sessionData.sessionDate.split('T')[0]
        };
      }
      return c;
    }));
    
    // Generate inventory items
    let currentMax = inventory.length > 0 
      ? Math.max(...inventory.map(i => parseInt(i.id.replace('SES-', '')) || 0))
      : 0;
    
    const newItems = [];
    sessionData.items.forEach((item, index) => {
      // Handle quantity > 1
      const qty = item.quantity || 1;
      for (let i = 0; i < qty; i++) {
        currentMax++;
        newItems.push({
          id: `SES-${String(currentMax).padStart(3, '0')}`,
          description: item.description,
          category: item.category,
          metalType: item.metalType,
          purity: item.purity,
          weightOz: item.weightOz,
          purchasePrice: Math.round((item.purchasePrice / qty) * 100) / 100,
          meltValue: Math.round((item.meltValue / qty) * 100) / 100,
          source: 'Appraisal Session',
          clientId: sessionData.client.id,
          dateAcquired: sessionData.sessionDate.split('T')[0],
          status: 'Available',
          notes: sessionData.notes ? `Session: ${sessionData.notes}` : '',
          lotId: lotId,
          photo: item.photo,
          photoBack: item.photoBack,
          grade: item.grade,
          year: item.year,
          mint: item.mint
        });
      }
    });
    
    setInventory([...inventory, ...newItems]);
    setView('list');
  };

  // Move items to personal stash
  const handleMoveToStash = (itemIds) => {
    setInventory(inventory.map(item => 
      itemIds.includes(item.id) ? { ...item, status: 'Stash' } : item
    ));
  };
  
  // Move items back to inventory from stash
  const handleMoveToInventory = (itemIds) => {
    setInventory(inventory.map(item => 
      itemIds.includes(item.id) ? { ...item, status: 'Available' } : item
    ));
  };

  // Show loading screen while data is loading
  if (!dataLoaded || inventory === null || clients === null) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-amber-800">Stevens Estate Services</h2>
          <p className="text-amber-600 mt-2">Loading your inventory...</p>
          {firebaseReady && <p className="text-green-600 text-sm mt-2">✓ Connected to cloud</p>}
        </div>
      </div>
    );
  }

  // Client views
  if (view === 'clients') return <ClientListView clients={clients} onSelect={(c) => { setSelectedClient(c); setView('clientDetail'); }} onAdd={() => setView('clientAdd')} onBack={() => setView('list')} />;
  if (view === 'clientAdd') return <ClientFormView onSave={(c) => { setClients([...clients, { ...c, id: getNextId('CLI') }]); setView('clients'); }} onCancel={() => setView('clients')} />;
  if (view === 'clientEdit' && selectedClient) return <ClientFormView client={selectedClient} onSave={(c) => { setClients(clients.map(x => x.id === c.id ? c : x)); setSelectedClient(c); setView('clientDetail'); }} onCancel={() => setView('clientDetail')} onDelete={(id) => { setClients(clients.filter(x => x.id !== id)); setView('clients'); }} />;
  if (view === 'clientDetail' && selectedClient) return <ClientDetailView client={selectedClient} transactions={inventory.filter(i => i.clientId === selectedClient.id)} onEdit={() => setView('clientEdit')} onBack={() => { setView('clients'); setSelectedClient(null); }} />;

  // Stash view
  if (view === 'stash') return (
    <PersonalStashView 
      inventory={inventory} 
      spotPrices={liveSpotPrices}
      onBack={() => setView('list')}
      onSelectItem={(item) => { setSelectedItem(item); setView('detail'); }}
      onMoveToStash={handleMoveToStash}
      onMoveToInventory={handleMoveToInventory}
    />
  );

  // Other views
  if (view === 'appraisal') return <AppraisalSessionView clients={clients} spotPrices={liveSpotPrices} buyPercentages={buyPercentages} coinBuyPercents={coinBuyPercents} onComplete={handleAppraisalComplete} onCancel={() => setView('list')} />;
  if (view === 'lotPurchase') return <LotPurchaseView clients={clients} onSave={handleLotSave} onCancel={() => setView('list')} />;
  if (view === 'lots') return <LotsView 
    lots={lots} 
    inventory={inventory} 
    liveSpotPrices={liveSpotPrices} 
    onBack={() => setView('list')} 
    onUpdateLot={(updatedLot) => setLots(lots.map(l => l.id === updatedLot.id ? updatedLot : l))}
    onBreakLot={(lot) => {
      // Break lot into individual items
      const lotItem = inventory.find(item => lot.itemIds?.includes(item.id));
      if (lotItem && lotItem.quantity > 1) {
        // Create individual items from the lot
        const costPerItem = lot.totalCost / lot.totalItems;
        const newItems = [];
        let currentMax = Math.max(...inventory.map(i => parseInt(i.id.replace('SES-', '')) || 0));
        
        for (let i = 0; i < lot.totalItems; i++) {
          newItems.push({
            ...lotItem,
            id: `SES-${String(currentMax + i + 1).padStart(3, '0')}`,
            description: lotItem.description.replace(/\(\d+ coin[s]? set\)/i, '').trim(),
            quantity: 1,
            purchasePrice: Math.round(costPerItem * 100) / 100,
            meltValue: Math.round((lotItem.meltValue / lot.totalItems) * 100) / 100,
            notes: `Broken from ${lot.id}: ${lot.description}`,
            lotId: lot.id
          });
        }
        
        // Remove original lot item and add individual items
        setInventory([...inventory.filter(i => i.id !== lotItem.id), ...newItems]);
        setLots(lots.map(l => l.id === lot.id ? { ...l, status: 'broken' } : l));
      }
    }}
    onSelectItem={(item) => { setSelectedItem(item); setView('detail'); }}
  />;
  if (view === 'calculator') return <ScrapCalculatorView spotPrices={liveSpotPrices} onRefresh={refreshSpotPrices} isLoading={isLoadingPrices} onBack={() => setView('list')} />;
  if (view === 'holdStatus') return <HoldStatusView 
    inventory={inventory} 
    onBack={() => setView('list')} 
    onSelectItem={(item) => { setSelectedItem(item); setView('detail'); }}
    onReleaseFromHold={(itemId, reason) => {
      setInventory(inventory.map(i => 
        i.id === itemId 
          ? { ...i, holdReleased: true, holdReleaseReason: reason, holdReleaseDate: new Date().toISOString() }
          : i
      ));
    }}
  />;
  if (view === 'spotValue') return <SpotValueView inventory={inventory} onBack={() => setView('list')} liveSpotPrices={liveSpotPrices} />;
  if (view === 'dashboard') return <DashboardView inventory={inventory} onBack={() => setView('list')} />;
  if (view === 'tax') return <TaxReportView inventory={inventory} onBack={() => setView('list')} />;
  if (view === 'ebayListings') return <EbayListingsView inventory={inventory} onBack={() => setView('list')} onSelectItem={(item) => { setSelectedItem(item); setView('detail'); }} onListItem={(item) => { setSelectedItem(item); setView('ebayListing'); }} />;
  if (view === 'add') return <AddItemView clients={clients} liveSpotPrices={liveSpotPrices} onSave={(item) => { setInventory([...inventory, { ...item, id: getNextId('SES') }]); setView('list'); }} onCancel={() => setView('list')} calculateMelt={calculateMelt} />;
  if (view === 'detail' && selectedItem) {
    // Find current item index in filtered list for prev/next navigation
    const currentIndex = filteredInventory.findIndex(i => i.id === selectedItem.id);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < filteredInventory.length - 1 && currentIndex !== -1;
    
    return <DetailView 
      item={selectedItem} 
      clients={clients} 
      liveSpotPrices={liveSpotPrices} 
      onUpdate={(u) => { setInventory(inventory.map(i => i.id === u.id ? u : i)); setSelectedItem(u); }} 
      onDelete={() => { setInventory(inventory.filter(i => i.id !== selectedItem.id)); setView('list'); }} 
      onBack={() => { setView('list'); setSelectedItem(null); }} 
      onListOnEbay={(listing) => { setPendingListing(listing); setView('ebayListing'); }}
      onPrev={hasPrev ? () => setSelectedItem(filteredInventory[currentIndex - 1]) : null}
      onNext={hasNext ? () => setSelectedItem(filteredInventory[currentIndex + 1]) : null}
      currentIndex={currentIndex}
      totalItems={filteredInventory.length}
      onCreateLot={(lotData) => {
        const lotId = getNextId('LOT');
        const newLot = {
          id: lotId,
          ...lotData,
          createdAt: new Date().toISOString()
        };
        setLots([...lots, newLot]);
        // Update item with lot reference
        const updatedItem = { ...selectedItem, lotId: lotId };
        setInventory(inventory.map(i => i.id === selectedItem.id ? updatedItem : i));
        setSelectedItem(updatedItem);
      }}
    />;
  }
  if (view === 'ebayListing' && selectedItem) return <EbayListingView item={selectedItem} generatedListing={pendingListing} onBack={() => { setPendingListing(null); setView('detail'); }} onListingCreated={(listing) => { setInventory(inventory.map(i => i.id === selectedItem.id ? { ...i, ebayListingId: listing.listingId, ebayUrl: listing.ebayUrl, status: 'Listed' } : i)); setSelectedItem({ ...selectedItem, ebayListingId: listing.listingId, ebayUrl: listing.ebayUrl, status: 'Listed' }); setPendingListing(null); setView('detail'); }} />;
  if (view === 'settings') return <SettingsView onBack={() => setView('list')} onExport={handleExport} onImport={handleImport} onReset={() => { setInventory(starterInventory); setClients(starterClients); setLots(starterLots); }} fileInputRef={fileInputRef} coinBuyPercents={coinBuyPercents} onUpdateCoinBuyPercent={handleUpdateCoinBuyPercent} ebayConnected={ebayConnected} onEbayDisconnect={handleEbayDisconnect} onViewEbaySync={() => setView('ebaySync')} onViewAdmin={() => setView('admin')} />;
  if (view === 'admin') return <AdminPanelView 
    onBack={() => setView('settings')} 
    inventory={inventory} 
    clients={clients} 
    lots={lots}
    firebaseReady={firebaseReady}
    onClearCollection={async (collection) => {
      if (collection === 'inventory') {
        // Clear from Firebase
        if (firebaseReady) {
          for (const item of inventory) {
            await FirebaseService.deleteItem('inventory', item.id);
          }
        }
        setInventory([]);
      } else if (collection === 'clients') {
        if (firebaseReady) {
          for (const client of clients) {
            await FirebaseService.deleteItem('clients', client.id);
          }
        }
        setClients([]);
      } else if (collection === 'lots') {
        if (firebaseReady) {
          for (const lot of lots) {
            await FirebaseService.deleteItem('lots', lot.id);
          }
        }
        setLots([]);
      }
    }}
  />;
  if (view === 'ebaySync') return <EbaySyncView onBack={() => setView('settings')} onImportListings={handleImportEbayListings} inventory={inventory} />;
  if (view === 'receipts') return <ReceiptManagerView 
    onBack={() => setView('list')} 
    receipts={receipts}
    inventory={inventory}
    lots={lots}
    clients={clients}
    onAddReceipt={(receipt) => setReceipts([...receipts, receipt])}
    onDeleteReceipt={(id) => setReceipts(receipts.filter(r => r.id !== id))}
    onUpdateReceipt={(updated) => setReceipts(receipts.map(r => r.id === updated.id ? updated : r))}
  />;

  // LIST VIEW
  // Calculate comprehensive KPIs
  const calculateKPIs = () => {
    const inv = inventory || [];
    const availableItems = inv.filter(i => i.status === 'Available' && !i.plannedDisposition);
    const stashItems = inv.filter(i => i.status === 'Stash');
    const holdItems = inv.filter(i => i.plannedDisposition === 'hold');
    const sellItems = inv.filter(i => i.plannedDisposition === 'sell');
    const soldItems = inv.filter(i => i.status === 'Sold');
    const listedItems = inv.filter(i => i.ebayListingId);
    
    // Helper to calculate spot value
    const calcSpotValue = (items) => items.reduce((sum, item) => {
      const weight = parseFloat(item.weightOz) || 0;
      let purityDecimal = 1;
      if (item.purity?.includes('K')) purityDecimal = parseInt(item.purity) / 24;
      else if (item.purity?.includes('%')) purityDecimal = parseInt(item.purity) / 100;
      else if (item.purity === '925') purityDecimal = 0.925;
      else if (item.purity === '999' || item.purity === '9999') purityDecimal = 0.999;
      return sum + (weight * purityDecimal * (liveSpotPrices[item.metalType?.toLowerCase()] || 0));
    }, 0);
    
    const calcCostBasis = (items) => items.reduce((sum, i) => sum + (parseFloat(i.purchasePrice) || 0), 0);
    const calcMeltValue = (items) => items.reduce((sum, i) => sum + (parseFloat(i.meltValue) || 0), 0);
    
    // Portfolio by disposition
    const stashValue = calcSpotValue(stashItems);
    const stashCost = calcCostBasis(stashItems);
    const holdValue = calcSpotValue(holdItems);
    const holdCost = calcCostBasis(holdItems);
    const sellValue = calcSpotValue(sellItems);
    const sellCost = calcCostBasis(sellItems);
    const availableValue = calcSpotValue(availableItems);
    const availableCost = calcCostBasis(availableItems);
    
    // Total portfolio
    const totalValue = stashValue + holdValue + sellValue + availableValue;
    const totalCost = stashCost + holdCost + sellCost + availableCost;
    const unrealizedPL = totalValue - totalCost;
    
    // Sold performance
    const totalSalesRevenue = soldItems.reduce((sum, i) => sum + (parseFloat(i.salePrice) || 0), 0);
    const soldCostBasis = calcCostBasis(soldItems);
    const realizedPL = totalSalesRevenue - soldCostBasis;
    const avgProfitMargin = soldCostBasis > 0 ? ((realizedPL / soldCostBasis) * 100) : 0;
    
    // Metal breakdown
    const silverItems = inv.filter(i => i.metalType?.toLowerCase() === 'silver' && i.status !== 'Sold');
    const goldItems = inv.filter(i => i.metalType?.toLowerCase() === 'gold' && i.status !== 'Sold');
    const platinumItems = inv.filter(i => i.metalType?.toLowerCase() === 'platinum' && i.status !== 'Sold');
    
    return {
      // Counts
      totalItems: inv.length,
      availableCount: availableItems.length,
      stashCount: stashItems.length,
      holdCount: holdItems.length,
      sellCount: sellItems.length,
      soldCount: soldItems.length,
      listedCount: listedItems.length,
      
      // Values by disposition
      stashValue, stashCost,
      holdValue, holdCost,
      sellValue, sellCost,
      availableValue, availableCost,
      
      // Portfolio totals
      totalValue,
      totalCost,
      unrealizedPL,
      
      // Realized P&L
      totalSalesRevenue,
      soldCostBasis,
      realizedPL,
      avgProfitMargin,
      
      // Net worth (current holdings at spot)
      netWorth: totalValue,
      
      // By metal
      silverValue: calcSpotValue(silverItems),
      silverCount: silverItems.length,
      goldValue: calcSpotValue(goldItems),
      goldCount: goldItems.length,
      platinumValue: calcSpotValue(platinumItems),
      platinumCount: platinumItems.length
    };
  };
  
  const kpis = calculateKPIs();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Clean Header with Spot Prices */}
      <div className="bg-gradient-to-r from-amber-700 to-amber-800 text-white p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold">Stevens Estate Services</h1>
          <button onClick={() => setView('settings')} className="p-2 hover:bg-amber-600 rounded">
            <Settings size={20} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-sm">
          <div className="flex gap-4">
            <span>Au: <span className="font-bold">${liveSpotPrices.gold?.toLocaleString()}</span></span>
            <span>Ag: <span className="font-bold">${liveSpotPrices.silver?.toFixed(2)}</span></span>
            <span>Pt: <span className="font-bold">${liveSpotPrices.platinum?.toLocaleString()}</span></span>
          </div>
          <button onClick={refreshSpotPrices} disabled={isLoadingPrices} className="p-1">
            <RefreshCw size={16} className={isLoadingPrices ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      
      {/* Quick Actions - 4 Main Buttons */}
      <div className="p-4 grid grid-cols-4 gap-2">
        <button 
          onClick={() => setView('appraisal')}
          className="bg-teal-600 text-white p-3 rounded-xl shadow-lg flex flex-col items-center gap-1"
        >
          <Camera size={24} />
          <span className="text-xs font-medium">Appraisal</span>
        </button>
        <button 
          onClick={() => setView('clients')}
          className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg flex flex-col items-center gap-1"
        >
          <Users size={24} />
          <span className="text-xs font-medium">Clients</span>
        </button>
        <button 
          onClick={() => setView('receipts')}
          className="bg-emerald-600 text-white p-3 rounded-xl shadow-lg flex flex-col items-center gap-1"
        >
          <FileText size={24} />
          <span className="text-xs font-medium">Receipts</span>
        </button>
        <button 
          onClick={() => setView('calculator')}
          className="bg-gray-700 text-white p-3 rounded-xl shadow-lg flex flex-col items-center gap-1"
        >
          <Calculator size={24} />
          <span className="text-xs font-medium">Scrap Calc</span>
        </button>
      </div>
      
      {/* KPI Dashboard - Collapsible */}
      <div className="px-4 pb-2">
        <details open={kpiExpanded} onToggle={(e) => setKpiExpanded(e.target.open)} className="bg-white rounded-xl shadow-lg overflow-hidden">
          <summary className="p-4 cursor-pointer bg-gradient-to-r from-blue-600 to-blue-700 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} />
              <span className="font-bold">Dashboard</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-blue-100 text-sm">Net Worth:</span>
              <span className="font-bold text-lg">${kpis.netWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </summary>
          
          <div className="p-4 space-y-4">
            {/* Portfolio by Disposition */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Portfolio by Status <span className="text-gray-400 font-normal">(tap to filter)</span></h4>
              <div className="grid grid-cols-2 gap-2">
                {/* Stash */}
                <button 
                  onClick={() => { setKpiFilter(kpiFilter === 'stash' ? null : 'stash'); setKpiExpanded(false); }}
                  className={`bg-amber-50 border rounded-lg p-3 text-left transition-all ${kpiFilter === 'stash' ? 'border-amber-500 ring-2 ring-amber-300' : 'border-amber-200'}`}
                >
                  <div className="flex items-center gap-2 text-amber-700 mb-1">
                    <Star size={16} />
                    <span className="font-medium text-sm">Stash</span>
                    <span className="text-xs bg-amber-200 px-1.5 rounded">{kpis.stashCount}</span>
                  </div>
                  <div className="text-lg font-bold text-amber-800">${kpis.stashValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className={`text-xs ${kpis.stashValue - kpis.stashCost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {kpis.stashValue - kpis.stashCost >= 0 ? '+' : ''}${(kpis.stashValue - kpis.stashCost).toFixed(0)} P&L
                  </div>
                </button>
                
                {/* Hold */}
                <button 
                  onClick={() => { setKpiFilter(kpiFilter === 'hold' ? null : 'hold'); setKpiExpanded(false); }}
                  className={`bg-blue-50 border rounded-lg p-3 text-left transition-all ${kpiFilter === 'hold' ? 'border-blue-500 ring-2 ring-blue-300' : 'border-blue-200'}`}
                >
                  <div className="flex items-center gap-2 text-blue-700 mb-1">
                    <Archive size={16} />
                    <span className="font-medium text-sm">Hold</span>
                    <span className="text-xs bg-blue-200 px-1.5 rounded">{kpis.holdCount}</span>
                  </div>
                  <div className="text-lg font-bold text-blue-800">${kpis.holdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className={`text-xs ${kpis.holdValue - kpis.holdCost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {kpis.holdValue - kpis.holdCost >= 0 ? '+' : ''}${(kpis.holdValue - kpis.holdCost).toFixed(0)} P&L
                  </div>
                </button>
                
                {/* Sell */}
                <button 
                  onClick={() => { setKpiFilter(kpiFilter === 'sell' ? null : 'sell'); setKpiExpanded(false); }}
                  className={`bg-green-50 border rounded-lg p-3 text-left transition-all ${kpiFilter === 'sell' ? 'border-green-500 ring-2 ring-green-300' : 'border-green-200'}`}
                >
                  <div className="flex items-center gap-2 text-green-700 mb-1">
                    <DollarSign size={16} />
                    <span className="font-medium text-sm">Sell</span>
                    <span className="text-xs bg-green-200 px-1.5 rounded">{kpis.sellCount}</span>
                  </div>
                  <div className="text-lg font-bold text-green-800">${kpis.sellValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className={`text-xs ${kpis.sellValue - kpis.sellCost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {kpis.sellValue - kpis.sellCost >= 0 ? '+' : ''}${(kpis.sellValue - kpis.sellCost).toFixed(0)} P&L
                  </div>
                </button>
                
                {/* Available (untagged) */}
                <button 
                  onClick={() => { setKpiFilter(kpiFilter === 'available' ? null : 'available'); setKpiExpanded(false); }}
                  className={`bg-gray-50 border rounded-lg p-3 text-left transition-all ${kpiFilter === 'available' ? 'border-gray-500 ring-2 ring-gray-300' : 'border-gray-200'}`}
                >
                  <div className="flex items-center gap-2 text-gray-700 mb-1">
                    <Package size={16} />
                    <span className="font-medium text-sm">Available</span>
                    <span className="text-xs bg-gray-200 px-1.5 rounded">{kpis.availableCount}</span>
                  </div>
                  <div className="text-lg font-bold text-gray-800">${kpis.availableValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className={`text-xs ${kpis.availableValue - kpis.availableCost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {kpis.availableValue - kpis.availableCost >= 0 ? '+' : ''}${(kpis.availableValue - kpis.availableCost).toFixed(0)} P&L
                  </div>
                </button>
              </div>
            </div>
            
            {/* Summary Row */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-gray-400 text-xs">Total Cost</div>
                  <div className="font-bold">${kpis.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Current Value</div>
                  <div className="font-bold text-lg">${kpis.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Unrealized P&L</div>
                  <div className={`font-bold ${kpis.unrealizedPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {kpis.unrealizedPL >= 0 ? '+' : ''}${kpis.unrealizedPL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Realized Performance */}
            {kpis.soldCount > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Realized Performance</h4>
                <button 
                  onClick={() => { setKpiFilter(kpiFilter === 'sold' ? null : 'sold'); setKpiExpanded(false); }}
                  className={`w-full bg-green-50 border rounded-lg p-3 text-left transition-all ${kpiFilter === 'sold' ? 'border-green-500 ring-2 ring-green-300' : 'border-green-200'}`}
                >
                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">Sold</div>
                      <div className="font-bold">{kpis.soldCount}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Revenue</div>
                      <div className="font-bold">${kpis.totalSalesRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Profit</div>
                      <div className={`font-bold ${kpis.realizedPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${kpis.realizedPL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Margin</div>
                      <div className={`font-bold ${kpis.avgProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {kpis.avgProfitMargin.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            )}
            
            {/* Metal Breakdown */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">By Metal <span className="text-gray-400 font-normal">(tap to filter)</span></h4>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => { setKpiFilter(kpiFilter === 'silver' ? null : 'silver'); setKpiExpanded(false); }}
                  className={`rounded-lg p-2 text-center transition-all ${kpiFilter === 'silver' ? 'bg-gray-300 ring-2 ring-gray-400' : 'bg-gray-100'}`}
                >
                  <div className="text-gray-500 text-xs">Silver</div>
                  <div className="font-bold text-gray-700">${kpis.silverValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className="text-xs text-gray-400">{kpis.silverCount} items</div>
                </button>
                <button 
                  onClick={() => { setKpiFilter(kpiFilter === 'gold' ? null : 'gold'); setKpiExpanded(false); }}
                  className={`rounded-lg p-2 text-center transition-all ${kpiFilter === 'gold' ? 'bg-yellow-200 ring-2 ring-yellow-400' : 'bg-yellow-50'}`}
                >
                  <div className="text-yellow-600 text-xs">Gold</div>
                  <div className="font-bold text-yellow-700">${kpis.goldValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className="text-xs text-yellow-500">{kpis.goldCount} items</div>
                </button>
                <button 
                  onClick={() => { setKpiFilter(kpiFilter === 'platinum' ? null : 'platinum'); setKpiExpanded(false); }}
                  className={`rounded-lg p-2 text-center transition-all ${kpiFilter === 'platinum' ? 'bg-gray-400 ring-2 ring-gray-500' : 'bg-gray-200'}`}
                >
                  <div className="text-gray-600 text-xs">Platinum</div>
                  <div className="font-bold text-gray-700">${kpis.platinumValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className="text-xs text-gray-400">{kpis.platinumCount} items</div>
                </button>
              </div>
            </div>
            
            {/* Quick Links */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button onClick={() => setView('stash')} className="text-amber-600 text-sm py-2 bg-amber-50 rounded-lg">
                View Stash →
              </button>
              <button onClick={() => setView('holdStatus')} className="text-purple-600 text-sm py-2 bg-purple-50 rounded-lg">
                Hold Status →
              </button>
              <button onClick={() => setView('tax')} className="text-green-600 text-sm py-2 bg-green-50 rounded-lg">
                Tax Report →
              </button>
            </div>
          </div>
        </details>
      </div>
      
      {/* Search and Inventory List */}
      <div className="p-4 pt-2">
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search inventory..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white" 
            />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border rounded-lg px-3 bg-white">
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="sold">Sold</option>
          </select>
        </div>
        
        {/* Inventory Count */}
        <div className="flex justify-between items-center mb-2 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span>{filteredInventory.length} items</span>
            {bulkMode && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                {bulkSelectedIds.length} selected
              </span>
            )}
            {kpiFilter && (
              <button 
                onClick={() => setKpiFilter(null)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                  kpiFilter === 'stash' ? 'bg-amber-100 text-amber-700' :
                  kpiFilter === 'hold' ? 'bg-blue-100 text-blue-700' :
                  kpiFilter === 'sell' ? 'bg-green-100 text-green-700' :
                  kpiFilter === 'sold' ? 'bg-green-100 text-green-700' :
                  kpiFilter === 'silver' ? 'bg-gray-200 text-gray-700' :
                  kpiFilter === 'gold' ? 'bg-yellow-100 text-yellow-700' :
                  kpiFilter === 'platinum' ? 'bg-gray-300 text-gray-700' :
                  'bg-gray-100 text-gray-700'
                }`}
              >
                {kpiFilter.charAt(0).toUpperCase() + kpiFilter.slice(1)}
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {bulkMode ? (
              <button 
                onClick={() => { setBulkMode(false); setBulkSelectedIds([]); }}
                className="text-red-600 text-sm font-medium"
              >
                Cancel
              </button>
            ) : (
              <button 
                onClick={() => setBulkMode(true)}
                className="text-purple-600 text-sm flex items-center gap-1"
              >
                <CheckSquare size={14} /> Select
              </button>
            )}
            {lots.filter(l => l.status !== 'sold' && l.status !== 'broken').length > 0 && !bulkMode && (
              <button onClick={() => setView('lots')} className="text-purple-600 flex items-center gap-1">
                <Layers size={14} /> {lots.filter(l => l.status !== 'sold' && l.status !== 'broken').length} Lots
              </button>
            )}
          </div>
        </div>
        
        {/* Inventory Items */}
        <div className="space-y-2 pb-24">
          {filteredInventory.map(item => {
            const holdStatus = getHoldStatus(item);
            const profit = item.status === 'Sold' ? (item.salePrice - item.purchasePrice) : (item.meltValue - item.purchasePrice);
            const isSelected = bulkSelectedIds.includes(item.id);
            
            // Long press handler
            let pressTimer = null;
            const handleTouchStart = () => {
              pressTimer = setTimeout(() => {
                // Long press detected - enter bulk mode and select this item
                if (!bulkMode) {
                  setBulkMode(true);
                }
                if (!isSelected) {
                  setBulkSelectedIds(prev => [...prev, item.id]);
                }
              }, 500); // 500ms for long press
            };
            const handleTouchEnd = () => {
              if (pressTimer) {
                clearTimeout(pressTimer);
              }
            };
            const handleClick = () => {
              if (bulkMode) {
                // In bulk mode, toggle selection
                if (isSelected) {
                  setBulkSelectedIds(prev => prev.filter(id => id !== item.id));
                } else {
                  setBulkSelectedIds(prev => [...prev, item.id]);
                }
              } else {
                // Normal mode - open detail view
                setSelectedItem(item);
                setView('detail');
              }
            };
            
            return (
              <div 
                key={item.id} 
                onClick={handleClick}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                className={`bg-white p-3 rounded-lg shadow cursor-pointer hover:shadow-md transition-all ${
                  item.status === 'Sold' ? 'opacity-60' : ''
                } ${isSelected ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    {/* Checkbox for bulk mode */}
                    {bulkMode && (
                      <div className="flex items-center justify-center w-6 h-12">
                        {isSelected ? (
                          <CheckSquare size={22} className="text-purple-600" />
                        ) : (
                          <Square size={22} className="text-gray-400" />
                        )}
                      </div>
                    )}
                    {item.photo && (
                      <img src={`data:image/jpeg;base64,${item.photo}`} className="w-12 h-12 rounded object-cover" />
                    )}
                    <div>
                      <div className="font-medium">{item.description}</div>
                      <div className="text-xs text-gray-500">{item.id} • {item.category}</div>
                      <div className="flex gap-1 mt-1">
                        {item.status === 'Stash' && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Star size={10} /> Stash
                          </span>
                        )}
                        {item.plannedDisposition === 'hold' && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Hold</span>
                        )}
                        {item.plannedDisposition === 'sell' && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Sell</span>
                        )}
                        {item.ebayListingId && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <ExternalLink size={10} /> eBay
                          </span>
                        )}
                        {item.status === 'Available' && !item.plannedDisposition && (
                          <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${
                            holdStatus.status === 'hold' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {holdStatus.status === 'hold' ? <><Lock size={10} /> {holdStatus.daysLeft}d</> : <><Unlock size={10} /> Ready</>}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-700">${item.meltValue}</div>
                    <div className="text-xs text-gray-400">Cost: ${item.purchasePrice}</div>
                    <div className={`text-xs font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {profit >= 0 ? '+' : ''}${profit.toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Bulk Action Bar */}
        {bulkMode && bulkSelectedIds.length > 0 && (
          <div className="fixed bottom-20 left-4 right-4 bg-purple-700 text-white rounded-xl shadow-xl p-4 z-50">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold">{bulkSelectedIds.length} items selected</span>
              <button 
                onClick={() => {
                  // Select all in filtered list
                  setBulkSelectedIds(filteredInventory.map(i => i.id));
                }}
                className="text-purple-200 text-sm"
              >
                Select All ({filteredInventory.length})
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => {
                  setInventory(inventory.map(i => 
                    bulkSelectedIds.includes(i.id) ? { ...i, status: 'Stash' } : i
                  ));
                  setBulkSelectedIds([]);
                  setBulkMode(false);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
              >
                <Star size={16} /> Stash
              </button>
              <button 
                onClick={() => {
                  setInventory(inventory.map(i => 
                    bulkSelectedIds.includes(i.id) ? { ...i, plannedDisposition: 'hold' } : i
                  ));
                  setBulkSelectedIds([]);
                  setBulkMode(false);
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
              >
                <Lock size={16} /> Hold
              </button>
              <button 
                onClick={() => {
                  setInventory(inventory.map(i => 
                    bulkSelectedIds.includes(i.id) ? { ...i, plannedDisposition: 'sell' } : i
                  ));
                  setBulkSelectedIds([]);
                  setBulkMode(false);
                }}
                className="bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
              >
                <TrendingUp size={16} /> Sell
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button 
                onClick={() => {
                  setInventory(inventory.map(i => 
                    bulkSelectedIds.includes(i.id) ? { ...i, status: 'Available', plannedDisposition: null } : i
                  ));
                  setBulkSelectedIds([]);
                  setBulkMode(false);
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-3 rounded-lg text-sm font-medium"
              >
                Clear Status
              </button>
              <button 
                onClick={() => {
                  if (window.confirm(`Delete ${bulkSelectedIds.length} items? This cannot be undone.`)) {
                    setInventory(inventory.filter(i => !bulkSelectedIds.includes(i.id)));
                    setBulkSelectedIds([]);
                    setBulkMode(false);
                  }
                }}
                className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        )}
        
        {/* Floating Action Button */}
        <div className="fixed bottom-6 right-6">
          <button 
            onClick={() => setView('add')} 
            className="bg-amber-600 text-white p-4 rounded-full shadow-lg hover:bg-amber-700 transition-colors"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
