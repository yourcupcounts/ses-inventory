import React, { useState, useRef, useEffect } from 'react';
import { Package, Plus, X, Trash2, Search, Settings, Download, Upload, Camera, Loader, BarChart3, TrendingUp, TrendingDown, Clock, AlertTriangle, AlertCircle, FileText, Filter, Users, UserPlus, Edit2, Edit3, Check, MapPin, Calendar, CreditCard, Building, User, Lock, Unlock, ShieldCheck, DollarSign, RefreshCw, Calculator, Layers, Star, ExternalLink, Flame, Archive, Zap, Shield, Database, FileSpreadsheet, AlertOctagon, Wifi, WifiOff, HardDrive, Cloud, CloudOff, Home, ChevronDown, ChevronRight, ChevronLeft, Link2, UserCheck, RotateCw, Car } from 'lucide-react';

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

// ============ UNIVERSAL PURITY PARSER ============
// Converts any purity format to a decimal (0-1)
// Handles: 9999, 999, 925, 900, 800, 90, 50, 99, 0.999, 90%, 50%, 14K, 24K, etc.
const parsePurity = (purity) => {
  if (!purity) return 1;
  
  const p = purity.toString().trim().toUpperCase();
  
  // Handle karat gold (24K, 18K, 14K, 10K, etc.)
  if (p.includes('K')) {
    const karat = parseInt(p.replace('K', ''));
    return karat / 24;
  }
  
  // Handle percentage format (90%, 50%, 92.5%)
  if (p.includes('%')) {
    return parseFloat(p.replace('%', '')) / 100;
  }
  
  // Handle numeric values
  const num = parseFloat(p);
  if (isNaN(num)) return 1;
  
  // Already a decimal (0.999, 0.925, 0.90, etc.)
  if (num <= 1) {
    return num;
  }
  
  // 4-digit millesimal (9999 → 0.9999, 9995 → 0.9995)
  if (num >= 1000) {
    return num / 10000;
  }
  
  // 3-digit millesimal (999, 925, 900, 800, 500, etc.)
  if (num >= 100) {
    return num / 1000;
  }
  
  // 2-digit percentage (90 → 0.90, 50 → 0.50, 99 → 0.99)
  // This catches common formats like "90" for 90% silver
  if (num >= 10 && num <= 99) {
    return num / 100;
  }
  
  // Single digit - assume it's a fraction already or invalid
  // (rare case, default to treating as-is if small)
  return num > 1 ? num / 100 : num;
};

// Test the parser (uncomment to debug):
// console.log('Purity tests:', {
//   '9999': parsePurity('9999'),   // 0.9999
//   '999': parsePurity('999'),     // 0.999
//   '925': parsePurity('925'),     // 0.925
//   '900': parsePurity('900'),     // 0.9
//   '800': parsePurity('800'),     // 0.8
//   '90': parsePurity('90'),       // 0.9
//   '50': parsePurity('50'),       // 0.5
//   '99': parsePurity('99'),       // 0.99
//   '0.999': parsePurity('0.999'), // 0.999
//   '0.90': parsePurity('0.90'),   // 0.9
//   '90%': parsePurity('90%'),     // 0.9
//   '50%': parsePurity('50%'),     // 0.5
//   '14K': parsePurity('14K'),     // 0.583
//   '24K': parsePurity('24K'),     // 1.0
//   '18K': parsePurity('18K'),     // 0.75
// });

// ============ FIREBASE SERVICE ============
// Import Firebase at top level
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

const FirebaseService = {
  db: null,
  storage: null,
  initialized: false,
  demoMode: false, // Demo mode uses separate collections
  
  // Set demo mode
  setDemoMode(enabled) {
    this.demoMode = enabled;
    console.log(`Demo mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  },
  
  // Get collection name (prefixed with demo_ in demo mode)
  getCollectionName(baseName) {
    return this.demoMode ? `demo_${baseName}` : baseName;
  },
  
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
  
  // Save inventory to Firestore with photo handling
  async saveInventory(inventory) {
    if (!this.initialized) {
      console.error('SAVE BLOCKED: Firebase not initialized');
      return false;
    }
    
    try {
      console.log(`SAVING: ${inventory.length} items to Firebase...`);
      const { doc, setDoc } = this.firestore;
      
      for (const item of inventory) {
        await this.saveItem(item);
      }
      
      console.log(`SAVE COMPLETE: ${inventory.length} items saved`);
      return true;
    } catch (error) {
      console.error('SAVE FAILED:', error);
      return false;
    }
  },
  
  // Save a SINGLE item to Firestore (much faster than saving all)
  async saveItem(item) {
    if (!this.initialized) {
      console.error('SAVE BLOCKED: Firebase not initialized');
      return false;
    }
    
    try {
      const { doc, setDoc } = this.firestore;
      const startTime = Date.now();
      
      // Photos are already compressed during capture, so just handle URLs vs base64
      let photoToSave = item.photo || null;
      let photoBackToSave = item.photoBack || null;
      
      // Only upload to Storage if photo is very large (>500KB after capture compression)
      // Otherwise save inline to Firestore for faster access
      if (photoToSave && !photoToSave.startsWith('http') && photoToSave.length > 500000) {
        console.log(`Photo too large (${Math.round(photoToSave.length/1000)}KB), uploading to Storage...`);
        const url = await this.uploadPhoto(`${item.id}_photo`, photoToSave);
        if (url) photoToSave = url;
      }
      
      if (photoBackToSave && !photoBackToSave.startsWith('http') && photoBackToSave.length > 500000) {
        console.log(`Back photo too large (${Math.round(photoBackToSave.length/1000)}KB), uploading to Storage...`);
        const url = await this.uploadPhoto(`${item.id}_photoBack`, photoBackToSave);
        if (url) photoBackToSave = url;
      }
      
      const itemData = this.cleanObject({ 
        ...item, 
        photo: photoToSave,
        photoBack: photoBackToSave
      });
      
      const photoInfo = photoToSave ? (photoToSave.startsWith('http') ? 'URL' : `${Math.round(photoToSave.length/1000)}KB`) : 'none';
      console.log(`SAVING item: ${item.id} (photo: ${photoInfo})`);
      
      await setDoc(doc(this.db, this.getCollectionName('inventory'), item.id), itemData);
      
      const elapsed = Date.now() - startTime;
      console.log(`SAVED item: ${item.id} - SUCCESS in ${elapsed}ms`);
      return true;
    } catch (error) {
      console.error(`SAVE FAILED for ${item.id}:`, error);
      return false;
    }
  },
  
  // Load inventory from Firestore
  async loadInventory() {
    if (!this.initialized) {
      console.error('LOAD BLOCKED: Firebase not initialized');
      return null;
    }
    try {
      console.log(`LOADING: Fetching inventory from Firebase (${this.demoMode ? 'DEMO' : 'PRODUCTION'})...`);
      const { collection, getDocs } = this.firestore;
      const snapshot = await getDocs(collection(this.db, this.getCollectionName('inventory')));
      const inventory = [];
      snapshot.forEach(doc => {
        console.log(`LOADED item: ${doc.id}`);
        inventory.push({ id: doc.id, ...doc.data() });
      });
      
      // Track last known count to prevent accidental wipes
      this._lastKnownInventoryCount = inventory.length;
      
      console.log(`LOAD COMPLETE: ${inventory.length} items from Firebase`);
      return inventory;
    } catch (error) {
      console.error('LOAD FAILED:', error);
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
        await setDoc(doc(this.db, this.getCollectionName('clients'), client.id), clientData);
      }
      return true;
    } catch (error) {
      console.error('Error saving clients:', error);
      return false;
    }
  },
  
  // Load clients from Firestore
  async loadClients() {
    if (!this.initialized) {
      console.log('Firebase not initialized, cannot load clients');
      return null;
    }
    try {
      const { collection, getDocs } = this.firestore;
      const snapshot = await getDocs(collection(this.db, this.getCollectionName('clients')));
      const clients = [];
      snapshot.forEach(doc => clients.push({ id: doc.id, ...doc.data() }));
      console.log(`Loaded ${clients.length} clients from Firebase`);
      return clients;
    } catch (error) {
      console.error('Error loading clients from Firebase:', error);
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
        await setDoc(doc(this.db, this.getCollectionName('lots'), lot.id), lotData);
      }
      return true;
    } catch (error) {
      console.error('Error saving lots:', error);
      return false;
    }
  },
  
  // Load lots from Firestore
  async loadLots() {
    if (!this.initialized) {
      console.log('Firebase not initialized, cannot load lots');
      return null;
    }
    try {
      const { collection, getDocs } = this.firestore;
      const snapshot = await getDocs(collection(this.db, this.getCollectionName('lots')));
      const lots = [];
      snapshot.forEach(doc => lots.push({ id: doc.id, ...doc.data() }));
      console.log(`Loaded ${lots.length} lots from Firebase`);
      return lots;
    } catch (error) {
      console.error('Error loading lots from Firebase:', error);
      return null;
    }
  },
  
  // Save a SINGLE client to Firestore
  async saveClient(client) {
    if (!this.initialized) {
      console.error('SAVE BLOCKED: Firebase not initialized');
      return false;
    }
    try {
      const { doc, setDoc } = this.firestore;
      
      // Handle ID photos and signature
      let idPhotoFrontUrl = client.idPhotoFront || null;
      let idPhotoBackUrl = client.idPhotoBack || null;
      let signatureUrl = client.signature || null;
      
      if (client.idPhotoFront && client.idPhotoFront.length > 1000 && !client.idPhotoFront.startsWith('http')) {
        idPhotoFrontUrl = await this.uploadPhoto(`${client.id}_id_front`, client.idPhotoFront);
      }
      if (client.idPhotoBack && client.idPhotoBack.length > 1000 && !client.idPhotoBack.startsWith('http')) {
        idPhotoBackUrl = await this.uploadPhoto(`${client.id}_id_back`, client.idPhotoBack);
      }
      if (client.signature && client.signature.length > 1000 && !client.signature.startsWith('http')) {
        signatureUrl = await this.uploadPhoto(`${client.id}_signature`, client.signature);
      }
      
      const clientData = this.cleanObject({
        ...client,
        idPhotoFront: idPhotoFrontUrl,
        idPhotoBack: idPhotoBackUrl,
        signature: signatureUrl
      });
      
      console.log(`SAVING client: ${client.id}`);
      await setDoc(doc(this.db, this.getCollectionName('clients'), client.id), clientData);
      console.log(`SAVED client: ${client.id} - SUCCESS`);
      return true;
    } catch (error) {
      console.error(`SAVE FAILED for client ${client.id}:`, error);
      return false;
    }
  },
  
  // Save a SINGLE receipt to Firestore (with file in Storage)
  async saveReceipt(receipt) {
    if (!this.initialized) {
      console.error('SAVE BLOCKED: Firebase not initialized');
      return false;
    }
    try {
      const { doc, setDoc } = this.firestore;
      
      // If receipt has large fileData, upload to Storage first
      let fileUrl = receipt.fileUrl || null;
      if (receipt.fileData && receipt.fileData.length > 1000 && !receipt.fileData.startsWith('http')) {
        console.log(`Uploading receipt file ${receipt.id} to Storage (${Math.round(receipt.fileData.length/1000)}KB)...`);
        fileUrl = await this.uploadReceiptFile(receipt.id, receipt.fileData, receipt.fileType);
        if (!fileUrl) {
          console.error(`Failed to upload receipt file for ${receipt.id}`);
          // Continue anyway, but file won't be saved
        }
      }
      
      // Save receipt metadata to Firestore (WITHOUT the large fileData)
      const receiptData = this.cleanObject({
        ...receipt,
        fileData: null, // Don't save base64 to Firestore
        fileUrl: fileUrl // Save the Storage URL instead
      });
      
      console.log(`SAVING receipt: ${receipt.id}`);
      await setDoc(doc(this.db, this.getCollectionName('receipts'), receipt.id), receiptData);
      console.log(`SAVED receipt: ${receipt.id} - SUCCESS`);
      return true;
    } catch (error) {
      console.error(`SAVE FAILED for receipt ${receipt.id}:`, error);
      return false;
    }
  },
  
  // Upload receipt file to Firebase Storage
  async uploadReceiptFile(id, base64Data, mimeType = 'application/pdf') {
    if (!this.initialized || !this.storage) {
      console.error('Cannot upload receipt - Storage not initialized');
      return null;
    }
    try {
      const { ref, uploadString, getDownloadURL } = this.storageHelpers;
      // Determine file extension from mime type
      const ext = mimeType.includes('pdf') ? 'pdf' : mimeType.includes('png') ? 'png' : 'jpg';
      const filePath = this.demoMode ? `demo_receipts/${id}.${ext}` : `receipts/${id}.${ext}`;
      const storageRef = ref(this.storage, filePath);
      
      // Upload as base64
      await uploadString(storageRef, base64Data, 'base64', { contentType: mimeType });
      const downloadUrl = await getDownloadURL(storageRef);
      console.log(`Receipt file uploaded: ${filePath}`);
      return downloadUrl;
    } catch (error) {
      console.error('Error uploading receipt file:', error);
      return null;
    }
  },
  
  // Load receipts from Firestore
  async loadReceipts() {
    if (!this.initialized) {
      console.log('Firebase not initialized, cannot load receipts');
      return null;
    }
    try {
      const { collection, getDocs } = this.firestore;
      const snapshot = await getDocs(collection(this.db, this.getCollectionName('receipts')));
      const receipts = [];
      snapshot.forEach(doc => receipts.push({ id: doc.id, ...doc.data() }));
      console.log(`Loaded ${receipts.length} receipts from Firebase`);
      return receipts;
    } catch (error) {
      console.error('Error loading receipts from Firebase:', error);
      return null;
    }
  },
  
  // Save mileage trip
  async saveMileage(trip) {
    if (!this.initialized) {
      console.error('SAVE BLOCKED: Firebase not initialized');
      return false;
    }
    try {
      const { doc, setDoc } = this.firestore;
      const tripData = this.cleanObject(trip);
      console.log(`SAVING mileage: ${trip.id}`);
      await setDoc(doc(this.db, this.getCollectionName('mileage'), trip.id), tripData);
      console.log(`SAVED mileage: ${trip.id} - SUCCESS`);
      return true;
    } catch (error) {
      console.error(`SAVE FAILED for mileage ${trip.id}:`, error);
      return false;
    }
  },
  
  // Load mileage from Firestore
  async loadMileage() {
    if (!this.initialized) return null;
    try {
      const { collection, getDocs } = this.firestore;
      const snapshot = await getDocs(collection(this.db, this.getCollectionName('mileage')));
      const mileage = [];
      snapshot.forEach(doc => mileage.push({ id: doc.id, ...doc.data() }));
      console.log(`Loaded ${mileage.length} mileage trips from Firebase`);
      return mileage;
    } catch (error) {
      console.error('Error loading mileage from Firebase:', error);
      return null;
    }
  },
  
  // Save vehicle
  async saveVehicle(vehicle) {
    if (!this.initialized) {
      console.error('SAVE BLOCKED: Firebase not initialized');
      return false;
    }
    try {
      const { doc, setDoc } = this.firestore;
      const vehicleData = this.cleanObject(vehicle);
      console.log(`SAVING vehicle: ${vehicle.id}`);
      await setDoc(doc(this.db, this.getCollectionName('vehicles'), vehicle.id), vehicleData);
      console.log(`SAVED vehicle: ${vehicle.id} - SUCCESS`);
      return true;
    } catch (error) {
      console.error(`SAVE FAILED for vehicle ${vehicle.id}:`, error);
      return false;
    }
  },
  
  // Load vehicles from Firestore
  async loadVehicles() {
    if (!this.initialized) return null;
    try {
      const { collection, getDocs } = this.firestore;
      const snapshot = await getDocs(collection(this.db, this.getCollectionName('vehicles')));
      const vehicles = [];
      snapshot.forEach(doc => vehicles.push({ id: doc.id, ...doc.data() }));
      console.log(`Loaded ${vehicles.length} vehicles from Firebase`);
      return vehicles;
    } catch (error) {
      console.error('Error loading vehicles from Firebase:', error);
      return null;
    }
  },

  // Upload photo to Firebase Storage
  async uploadPhoto(id, base64Data) {
    if (!this.initialized || !this.storage) return null;
    try {
      const { ref, uploadString, getDownloadURL } = this.storageHelpers;
      // Use demo_ prefix for photos in demo mode
      const photoPath = this.demoMode ? `demo_photos/${id}.jpg` : `photos/${id}.jpg`;
      const storageRef = ref(this.storage, photoPath);
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
      await deleteDoc(doc(this.db, this.getCollectionName(collectionName), itemId));
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      return false;
    }
  },
  
  // Clear all demo data (admin function)
  async clearDemoData() {
    if (!this.initialized) return false;
    try {
      const { collection, getDocs } = this.firestore;
      const { doc, deleteDoc } = this.firestore;
      
      // Clear demo_inventory
      const invSnapshot = await getDocs(collection(this.db, 'demo_inventory'));
      for (const docSnap of invSnapshot.docs) {
        await deleteDoc(doc(this.db, 'demo_inventory', docSnap.id));
      }
      
      // Clear demo_clients
      const clientSnapshot = await getDocs(collection(this.db, 'demo_clients'));
      for (const docSnap of clientSnapshot.docs) {
        await deleteDoc(doc(this.db, 'demo_clients', docSnap.id));
      }
      
      // Clear demo_lots
      const lotSnapshot = await getDocs(collection(this.db, 'demo_lots'));
      for (const docSnap of lotSnapshot.docs) {
        await deleteDoc(doc(this.db, 'demo_lots', docSnap.id));
      }
      
      console.log('Demo data cleared');
      return true;
    } catch (error) {
      console.error('Error clearing demo data:', error);
      return false;
    }
  }
};

// Helper function to get photo src - handles both base64 and URL formats
const getPhotoSrc = (photo) => {
  if (!photo) return null;
  // If it's already a URL (from Firebase Storage), use it directly
  if (photo.startsWith('http://') || photo.startsWith('https://')) {
    return photo;
  }
  // If it's a data URL, use it directly
  if (photo.startsWith('data:')) {
    return photo;
  }
  // Otherwise assume it's base64 and add the prefix
  return `data:image/jpeg;base64,${photo}`;
};

// ============ SPOT PRICE SERVICE ============
const SpotPriceService = {
  lastPrices: { gold: 4600.00, silver: 90.00, platinum: 985.00, palladium: 945.00 },
  lastUpdate: null,
  
  // Fetch live spot prices from multiple sources
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
        // goldprice.org also has platinum and palladium
        if (item.xptPrice) this.lastPrices.platinum = item.xptPrice;
        if (item.xpdPrice) this.lastPrices.palladium = item.xpdPrice;
        this.lastUpdate = new Date();
        console.log('Spot prices updated successfully:', this.lastPrices);
        return this.lastPrices;
      }
      throw new Error('Invalid response format');
    } catch (error) {
      console.log('goldprice.org fetch failed, trying backup...', error.message);
      return null;
    }
  },
  
  // Backup: Fetch from metals-api via our serverless function
  async fetchFromBackup() {
    try {
      console.log('Fetching from backup spot price API...');
      const response = await fetch('/api/spot-prices');
      if (!response.ok) throw new Error('Backup API error: ' + response.status);
      const data = await response.json();
      
      if (data.gold) this.lastPrices.gold = data.gold;
      if (data.silver) this.lastPrices.silver = data.silver;
      if (data.platinum) this.lastPrices.platinum = data.platinum;
      if (data.palladium) this.lastPrices.palladium = data.palladium;
      this.lastUpdate = new Date();
      console.log('Backup spot prices loaded:', this.lastPrices);
      return this.lastPrices;
    } catch (error) {
      console.log('Backup API failed:', error.message);
      return null;
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
    
    // Try goldprice.org first (free, has all 4 metals)
    let prices = await this.fetchFromMetalsLive();
    
    // Try backup API if primary failed
    if (!prices) {
      prices = await this.fetchFromBackup();
    }
    
    // Fall back to GoldAPI if available
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
    const purity = item.purity || '';
    const purityDecimal = purity.toLowerCase() === 'plated' ? 0 : parsePurity(purity);
    
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
function PersonalStashView({ inventory, spotPrices, onBack, onSelectItem, onMoveToStash, onMoveToInventory, onGoHome }) {
  const [view, setView] = useState('stash'); // stash, add
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  
  // Get stash items
  const stashItems = inventory.filter(i => i.status === 'Stash');
  const availableItems = inventory.filter(i => i.status === 'Available');
  
  // Calculate stash totals
  const calculateMetalValue = (item) => {
    const weight = parseFloat(item.weightOz) || 0;
    const purityDecimal = parsePurity(item.purity);
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
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-white">← Back</button>
            {onGoHome && (
              <button onClick={onGoHome} className="p-1 hover:bg-white hover:bg-opacity-20 rounded">
                <Home size={18} />
              </button>
            )}
          </div>
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
                            src={getPhotoSrc(item.photo)} 
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
                              src={getPhotoSrc(item.photo)} 
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
  
  // Sales tax state
  const [taxable, setTaxable] = useState(false);
  const [taxRate, setTaxRate] = useState(6.75);
  
  // Two-photo capture state
  const [captureStep, setCaptureStep] = useState('idle'); // idle, front, back
  const [frontPhoto, setFrontPhoto] = useState(null);
  const [backPhoto, setBackPhoto] = useState(null);
  
  const cameraRef = useRef(null);
  const photoInputRef = useRef(null);
  
  // Calculate totals
  const totalOffer = sessionItems.reduce((sum, item) => sum + item.buyPrice, 0);
  const discountAmount = parseFloat(bulkDiscount) || 0;
  const subtotalAfterDiscount = totalOffer - discountAmount;
  const salesTax = taxable ? Math.round(subtotalAfterDiscount * (taxRate / 100) * 100) / 100 : 0;
  const finalOffer = subtotalAfterDiscount + salesTax;
  
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
        originalBuyPrice: buyPrice * quantity,
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
        originalBuyPrice: buyPrice * quantity,
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
      
      // Apply sales tax proportionally if taxable
      let taxPortion = 0;
      if (taxable && salesTax > 0) {
        const proportion = adjustedPrice / subtotalAfterDiscount;
        taxPortion = salesTax * proportion;
      }
      
      const totalItemCost = adjustedPrice + taxPortion;
      const coin = item.coinKey ? coinReference[item.coinKey] : null;
      
      return {
        description: item.description + (item.year ? ` ${item.year}` : '') + (item.mint ? `-${item.mint}` : ''),
        category: coin?.metal === 'Gold' ? 'Coins - Gold' : coin?.metal === 'Platinum' ? 'Platinum' : 'Coins - Silver',
        metalType: coin?.metal || 'Silver',
        purity: coin ? `${(coin.purity * 100).toFixed(0)}%` : '90%',
        weightOz: coin?.aswOz || coin?.agwOz || coin?.apwOz || 0,
        purchasePrice: Math.round(totalItemCost * 100) / 100, // Total including proportional tax
        priceBeforeTax: Math.round(adjustedPrice * 100) / 100,
        salesTax: Math.round(taxPortion * 100) / 100,
        taxable: taxable,
        taxRate: taxable ? taxRate : null,
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
      salesTax: salesTax,
      taxRate: taxable ? taxRate : null,
      taxable: taxable,
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
                            <img src={getPhotoSrc(item.photo)} className="w-8 h-8 rounded object-cover" />
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
                    src={getPhotoSrc(evaluatingItem.photo)} 
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
                          // If custom unit price is set, recalculate buyPrice from it
                          const customUnit = evaluatingItem.customUnitPrice ? parseFloat(evaluatingItem.customUnitPrice) : null;
                          const newBuyPrice = customUnit ? (customUnit * newQty) : valuation.buyPrice;
                          setEvaluatingItem({ ...evaluatingItem, ...valuation, quantity: newQty, buyPrice: newBuyPrice });
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
                          // If custom unit price is set, recalculate buyPrice from it
                          const customUnit = evaluatingItem.customUnitPrice ? parseFloat(evaluatingItem.customUnitPrice) : null;
                          const newBuyPrice = customUnit ? (customUnit * newQty) : valuation.buyPrice;
                          setEvaluatingItem({ ...evaluatingItem, ...valuation, quantity: newQty, buyPrice: newBuyPrice });
                        }}
                        className="w-16 bg-gray-700 text-white text-center py-1 rounded"
                        min="1"
                      />
                      <button
                        onClick={() => {
                          const newQty = (evaluatingItem.quantity || 1) + 1;
                          const valuation = calculateCoinValue(evaluatingItem.coinKey, evaluatingItem.grade, newQty);
                          // If custom unit price is set, recalculate buyPrice from it
                          const customUnit = evaluatingItem.customUnitPrice ? parseFloat(evaluatingItem.customUnitPrice) : null;
                          const newBuyPrice = customUnit ? (customUnit * newQty) : valuation.buyPrice;
                          setEvaluatingItem({ ...evaluatingItem, ...valuation, quantity: newQty, buyPrice: newBuyPrice });
                        }}
                        className="w-8 h-8 bg-gray-700 text-white rounded"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  {/* MANUAL PRICE OVERRIDE */}
                  <div className="mb-3 bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm">
                        Custom Price {(evaluatingItem.quantity || 1) > 1 ? '(per item):' : ':'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder={(evaluatingItem.originalBuyPrice / (evaluatingItem.quantity || 1))?.toFixed(2)}
                          value={evaluatingItem.customUnitPrice || ''}
                          onChange={(e) => {
                            const unitPrice = e.target.value ? parseFloat(e.target.value) : null;
                            const qty = evaluatingItem.quantity || 1;
                            setEvaluatingItem({ 
                              ...evaluatingItem, 
                              customUnitPrice: e.target.value,
                              buyPrice: unitPrice ? (unitPrice * qty) : evaluatingItem.originalBuyPrice
                            });
                          }}
                          className="w-24 bg-gray-800 text-white text-right py-1 px-2 rounded border border-gray-600 focus:border-teal-500 focus:outline-none"
                        />
                        {evaluatingItem.customUnitPrice && (
                          <button
                            onClick={() => setEvaluatingItem({ 
                              ...evaluatingItem, 
                              customUnitPrice: '',
                              buyPrice: evaluatingItem.originalBuyPrice
                            })}
                            className="text-gray-400 hover:text-white"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    {evaluatingItem.customUnitPrice && (evaluatingItem.quantity || 1) > 1 && (
                      <div className="text-xs text-amber-400 mt-1 text-right">
                        ${evaluatingItem.customUnitPrice} × {evaluatingItem.quantity} = ${evaluatingItem.buyPrice?.toFixed(2)} total
                      </div>
                    )}
                    {evaluatingItem.customUnitPrice && (evaluatingItem.quantity || 1) === 1 && (
                      <div className="text-xs text-amber-400 mt-1 text-right">Using custom price</div>
                    )}
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
                        src={getPhotoSrc(item.photo)} 
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
          
          {/* Sales Tax Section */}
          {sessionItems.length > 0 && (
            <div className="bg-gray-50 rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={taxable} 
                    onChange={(e) => setTaxable(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="font-medium">Taxable Purchase</span>
                  <span className="text-xs text-gray-500">(e.g., estate sale company, retail)</span>
                </label>
                {taxable && (
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      step="0.01"
                      value={taxRate} 
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-16 border rounded px-2 py-1 text-sm text-right"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                )}
              </div>
              {taxable && subtotalAfterDiscount > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal (after discount):</span>
                    <span>${subtotalAfterDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sales Tax ({taxRate}%):</span>
                    <span className="text-amber-600 font-medium">+${salesTax.toFixed(2)}</span>
                  </div>
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
          {taxable && salesTax > 0 && (
            <div className="flex justify-between items-center mb-3 text-amber-600">
              <span>Sales Tax ({taxRate}%):</span>
              <span>+${salesTax.toFixed(2)}</span>
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
              {taxable && salesTax > 0 && (
                <div className="flex justify-between text-amber-600 mb-2">
                  <span>Sales Tax ({taxRate}%):</span>
                  <span>+${salesTax.toFixed(2)}</span>
                </div>
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
    { name: 'Morgan Dollar', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.859 },
    { name: 'Peace Dollar', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.859 },
    { name: 'Walking Liberty Half', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617 },
    { name: 'Franklin Half', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617 },
    { name: 'Kennedy Half (64)', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.3617 },
    { name: 'Washington Quarter', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.1808 },
    { name: 'Roosevelt Dime', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.0723 },
    { name: 'Mercury Dime', category: 'Coins - Silver', metalType: 'Silver', purity: '90%', weightOz: 0.0723 },
    { name: 'Silver Eagle', category: 'Silver - Bullion', metalType: 'Silver', purity: '999', weightOz: 1.0 },
    { name: 'Gold Eagle 1oz', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 1.0 },
    { name: 'Gold Eagle 1/2oz', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 0.5 },
    { name: 'Gold Eagle 1/4oz', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 0.25 },
    { name: 'Gold Eagle 1/10oz', category: 'Gold - Coins', metalType: 'Gold', purity: '22K', weightOz: 0.1 },
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
              {/* Quick Presets */}
              <div>
                <label className="block text-sm font-medium mb-2">Quick Presets</label>
                <div className="flex flex-wrap gap-2">
                  {coinPresets.slice(0, 8).map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className="text-xs bg-gray-100 hover:bg-purple-100 px-2 py-1 rounded"
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
function LotsView({ lots, inventory, liveSpotPrices, onBack, onUpdateLot, onBreakLot, onSelectItem, onGoHome }) {
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
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="flex items-center gap-1">← Back</button>
            {onGoHome && (
              <button onClick={onGoHome} className="p-1 hover:bg-purple-600 rounded">
                <Home size={18} />
              </button>
            )}
          </div>
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
function ScrapCalculatorView({ spotPrices: propSpotPrices, onRefresh, isLoading: propIsLoading, onBack, onGoHome }) {
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
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-white">← Back</button>
            {onGoHome && (
              <button onClick={onGoHome} className="p-1 hover:bg-gray-600 rounded">
                <Home size={18} />
              </button>
            )}
          </div>
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
function ClientListView({ clients, onSelect, onAdd, onBack, onGoHome }) {
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
          <div className="flex items-center gap-2">
            <button onClick={onBack}>← Back</button>
            {onGoHome && (
              <button onClick={onGoHome} className="p-1 hover:bg-indigo-600 rounded">
                <Home size={18} />
              </button>
            )}
          </div>
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
function DashboardView({ inventory, spotPrices, onBack, onOpenTax }) {
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
  
  // Helper to calculate live spot value
  const calcLiveSpotValue = (item) => {
    if (!item.weightOz || !item.metalType) return parseFloat(item.meltValue) || 0;
    const spot = spotPrices?.[item.metalType?.toLowerCase()] || 0;
    if (!spot) return parseFloat(item.meltValue) || 0;
    
    const purityDecimal = parsePurity(item.purity);
    return (parseFloat(item.weightOz) || 0) * spot * purityDecimal;
  };
  
  // Financial - Sales
  const totalRevenue = sold.reduce((s, i) => s + (parseFloat(i.salePrice) || 0), 0);
  const soldCost = sold.reduce((s, i) => s + (parseFloat(i.purchasePrice) || 0), 0);
  const realizedProfit = totalRevenue - soldCost;
  const avgMargin = soldCost > 0 ? ((realizedProfit / soldCost) * 100) : 0;
  
  // Financial - Inventory (using LIVE spot prices)
  const allHoldings = [...available, ...stash];
  const totalCost = allHoldings.reduce((s, i) => s + (parseFloat(i.purchasePrice) || 0), 0);
  const totalLiveValue = allHoldings.reduce((s, i) => s + calcLiveSpotValue(i), 0);
  const unrealizedGain = totalLiveValue - totalCost;
  const roi = totalCost > 0 ? ((unrealizedGain / totalCost) * 100) : 0;
  
  // Capital deployed (available inventory cost)
  const capitalDeployed = totalCost;
  
  // Total profit (realized)
  const totalProfit = realizedProfit;
  
  // Metal breakdown with LIVE values
  const metalBreakdown = ['Gold', 'Silver', 'Platinum', 'Palladium'].map(metal => {
    const items = allHoldings.filter(i => i.metalType === metal);
    const liveValue = items.reduce((s, i) => s + calcLiveSpotValue(i), 0);
    return {
      name: metal,
      count: items.length,
      weight: items.reduce((s, i) => s + (parseFloat(i.weightOz) || 0), 0),
      value: liveValue,
      cost: items.reduce((s, i) => s + (parseFloat(i.purchasePrice) || 0), 0),
      spot: spotPrices?.[metal.toLowerCase()] || 0
    };
  }).filter(m => m.count > 0);
  
  // Top items by value
  const topItems = [...allHoldings]
    .map(i => ({ ...i, liveValue: calcLiveSpotValue(i) }))
    .sort((a, b) => b.liveValue - a.liveValue)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-amber-700 to-amber-800 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1">
            <ChevronLeft size={20} /> Back
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 size={24} /> Dashboard</h1>
          <div className="w-16"></div>
        </div>
        {/* Live Spot Prices Bar */}
        <div className="flex justify-center gap-6 mt-3 text-sm">
          <span>Au: <span className="font-bold">${spotPrices?.gold?.toLocaleString() || '—'}</span></span>
          <span>Ag: <span className="font-bold">${spotPrices?.silver?.toFixed(2) || '—'}</span></span>
          <span>Pt: <span className="font-bold">${spotPrices?.platinum?.toLocaleString() || '—'}</span></span>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-4 text-white">
            <div className="text-xs text-green-100 uppercase tracking-wide">Realized Profit</div>
            <div className="text-2xl font-bold mt-1">
              ${totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-green-200 mt-1">{soldCount} items sold</div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-4 text-white">
            <div className="text-xs text-amber-100 uppercase tracking-wide">Portfolio Value</div>
            <div className="text-2xl font-bold mt-1">
              ${totalLiveValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-amber-200 mt-1">@ live spot prices</div>
          </div>
        </div>
        
        {/* Unrealized P&L */}
        <div className={`rounded-xl shadow-lg p-4 ${unrealizedGain >= 0 ? 'bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200' : 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200'}`}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Unrealized P&L</div>
              <div className={`text-2xl font-bold ${unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {unrealizedGain >= 0 ? '+' : ''}${unrealizedGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">ROI</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Cost basis: ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        
        {/* Inventory by Metal - Visual Cards */}
        <div>
          <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp size={18} /> Holdings by Metal
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {metalBreakdown.map(metal => {
              const gain = metal.value - metal.cost;
              const metalRoi = metal.cost > 0 ? ((gain / metal.cost) * 100) : 0;
              const colorClass = metal.name === 'Gold' ? 'from-yellow-400 to-yellow-500' :
                metal.name === 'Silver' ? 'from-gray-300 to-gray-400' :
                metal.name === 'Platinum' ? 'from-slate-400 to-slate-500' :
                'from-orange-400 to-orange-500';
              
              return (
                <div key={metal.name} className={`bg-gradient-to-br ${colorClass} rounded-xl shadow-lg p-4 text-white`}>
                  <div className="flex justify-between items-start">
                    <div className="text-lg font-bold">{metal.name}</div>
                    <div className="text-xs bg-white/20 rounded-full px-2 py-0.5">{metal.count}</div>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    ${metal.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-sm opacity-90">{metal.weight.toFixed(2)} oz</div>
                  <div className="text-xs mt-2 opacity-75">
                    Spot: ${metal.spot?.toLocaleString()} • {metalRoi >= 0 ? '+' : ''}{metalRoi.toFixed(0)}% ROI
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Inventory Overview */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Package size={18} /> Inventory Status
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
        
        {/* Sales Performance */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <DollarSign size={18} /> Sales Performance
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Revenue</div>
              <div className="text-xl font-bold text-green-600">${totalRevenue.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">COGS</div>
              <div className="text-xl font-bold">${soldCost.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Gross Profit</div>
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
        
        {/* Top Holdings */}
        {topItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Star size={18} /> Top Holdings by Value
            </h3>
            <div className="space-y-2">
              {topItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                    idx === 1 ? 'bg-gray-300 text-gray-700' :
                    idx === 2 ? 'bg-orange-400 text-orange-900' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.description}</div>
                    <div className="text-xs text-gray-500">{item.metalType} • {item.weightOz} oz</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-700">${item.liveValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="text-xs text-gray-500">Cost: ${item.purchasePrice}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Tax & Mileage Reports */}
        <button
          onClick={onOpenTax}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl shadow-lg p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FileText size={24} />
            </div>
            <div className="text-left">
              <div className="font-bold">Tax & Mileage Reports</div>
              <div className="text-sm opacity-90">Schedule C, mileage log, deductions</div>
            </div>
          </div>
          <ChevronRight size={24} />
        </button>
        
        {/* Hold Status */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Clock size={18} /> NC Hold Status
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
              <div className="text-xs text-gray-500">Ready</div>
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
      </div>
    </div>
  );
}

function TaxReportView({ inventory, mileageLog, vehicles, onBack, onAddMileage, onDeleteMileage, onAddVehicle, spotPrices }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState('schedule-c');
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [isReadingOdometer, setIsReadingOdometer] = useState(null); // 'start' or 'end'
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const startOdometerRef = useRef(null);
  const endOdometerRef = useRef(null);
  
  const [tripForm, setTripForm] = useState({
    date: new Date().toISOString().split('T')[0],
    vehicleId: vehicles?.[0]?.id || '',
    purpose: '',
    startLocation: '',
    destination: '',
    startOdometer: '',
    endOdometer: '',
    startPhoto: null,
    endPhoto: null,
    notes: ''
  });
  const [vehicleForm, setVehicleForm] = useState({
    name: '',
    make: '',
    model: '',
    year: '',
    startingOdometer: ''
  });
  
  // IRS mileage rates by year
  const mileageRates = { 2023: 0.655, 2024: 0.67, 2025: 0.70, 2026: 0.725 };
  
  // Get unique years
  const soldItems = inventory.filter(i => i.status === 'Sold');
  const years = [...new Set([
    ...soldItems.map(i => new Date(i.saleDate || i.dateAcquired || new Date()).getFullYear()),
    ...(mileageLog || []).map(m => new Date(m.date).getFullYear()),
    currentYear
  ])].sort((a, b) => b - a);
  
  // Filter by year
  const yearSales = soldItems.filter(i => {
    const year = new Date(i.saleDate || i.dateAcquired || new Date()).getFullYear();
    return year === selectedYear;
  });
  const yearMileage = (mileageLog || []).filter(m => new Date(m.date).getFullYear() === selectedYear);
  
  // Calculations
  const grossReceipts = yearSales.reduce((s, i) => s + (parseFloat(i.salePrice) || 0), 0);
  const cogs = yearSales.reduce((s, i) => s + (parseFloat(i.purchasePrice) || 0), 0);
  const grossProfit = grossReceipts - cogs;
  const totalMiles = yearMileage.reduce((s, m) => s + (parseFloat(m.miles) || 0), 0);
  const mileageRate = mileageRates[selectedYear] || 0.70;
  const mileageDeduction = totalMiles * mileageRate;
  
  // Get current location
  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });
      
      // Reverse geocode
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
      );
      const data = await response.json();
      const address = data.display_name?.split(',').slice(0, 3).join(',') || 
        `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
      
      setTripForm(prev => ({ ...prev, startLocation: address }));
    } catch (err) {
      console.error('Location error:', err);
      alert('Could not get location. Please enter manually.');
    }
    setIsGettingLocation(false);
  };
  
  // AI Odometer Reading
  const readOdometerPhoto = async (photoBase64, field) => {
    setIsReadingOdometer(field);
    try {
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photoBase64 }},
              { type: 'text', text: `Read the odometer in this image. Return ONLY the number shown on the odometer, nothing else. Just the digits. If you cannot read it clearly, respond with "UNREADABLE".` }
            ]
          }],
          max_tokens: 50
        })
      });
      
      const data = await response.json();
      const reading = data.content?.[0]?.text?.trim();
      
      if (reading && reading !== 'UNREADABLE' && /^\d+$/.test(reading.replace(/,/g, ''))) {
        const numericReading = reading.replace(/,/g, '');
        setTripForm(prev => ({ 
          ...prev, 
          [field]: numericReading,
          [`${field.replace('Odometer', '')}Photo`]: photoBase64
        }));
      } else {
        alert('Could not read odometer clearly. Please enter manually or retake photo.');
      }
    } catch (err) {
      console.error('Odometer read error:', err);
      alert('Error reading odometer. Please enter manually.');
    }
    setIsReadingOdometer(null);
  };
  
  // Handle odometer photo capture
  const handleOdometerCapture = (field) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result.split(',')[1];
      await readOdometerPhoto(base64, field);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  
  // Add trip
  const handleAddTrip = async () => {
    if (!tripForm.purpose) {
      alert('Please enter business purpose');
      return;
    }
    if (!tripForm.startOdometer || !tripForm.endOdometer) {
      alert('Please enter start and end odometer readings');
      return;
    }
    
    const miles = parseFloat(tripForm.endOdometer) - parseFloat(tripForm.startOdometer);
    if (miles <= 0) {
      alert('End odometer must be greater than start odometer');
      return;
    }
    
    const newTrip = {
      id: `MILE-${Date.now()}`,
      ...tripForm,
      miles,
      createdAt: new Date().toISOString()
    };
    
    await onAddMileage(newTrip);
    
    // Reset form but keep vehicle and use end odometer as next start
    setTripForm({
      date: new Date().toISOString().split('T')[0],
      vehicleId: tripForm.vehicleId,
      purpose: '',
      startLocation: '',
      destination: '',
      startOdometer: tripForm.endOdometer,
      endOdometer: '',
      startPhoto: null,
      endPhoto: null,
      notes: ''
    });
    setShowAddTrip(false);
  };
  
  // Add vehicle
  const handleAddVehicle = async () => {
    if (!vehicleForm.name) {
      alert('Please enter vehicle name');
      return;
    }
    const newVehicle = {
      id: `VEH-${Date.now()}`,
      ...vehicleForm,
      createdAt: new Date().toISOString()
    };
    await onAddVehicle(newVehicle);
    setVehicleForm({ name: '', make: '', model: '', year: '', startingOdometer: '' });
    setShowAddVehicle(false);
    setTripForm(prev => ({ ...prev, vehicleId: newVehicle.id }));
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-green-800 text-white p-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1">
            <ChevronLeft size={20} /> Back
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2"><FileText size={24} /> Tax & Mileage</h1>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-green-600 text-white border border-green-500 rounded px-2 py-1"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b bg-white sticky top-0 z-10">
        {['schedule-c', 'mileage', 'vehicles'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${
              activeTab === tab ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'
            }`}
          >
            {tab === 'schedule-c' ? 'Schedule C' : tab}
          </button>
        ))}
      </div>
      
      <div className="p-4 space-y-4">
        {/* SCHEDULE C TAB */}
        {activeTab === 'schedule-c' && (
          <>
            <div className={`rounded-xl p-4 text-white ${grossProfit >= 0 ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
              <div className="text-sm opacity-90">Net Profit (After Mileage) - {selectedYear}</div>
              <div className="text-3xl font-bold">${(grossProfit - mileageDeduction).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="font-bold text-gray-700 mb-3">Schedule C Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span>Gross Receipts ({yearSales.length} sales)</span>
                  <span className="font-bold">${grossReceipts.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>Cost of Goods Sold</span>
                  <span className="font-bold">${cogs.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>Gross Profit</span>
                  <span className={`font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${grossProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b bg-amber-50 -mx-4 px-4">
                  <span>Mileage Deduction ({totalMiles.toLocaleString()} mi × ${mileageRate})</span>
                  <span className="font-bold text-amber-700">${mileageDeduction.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="font-bold">Net Profit</span>
                  <span className={`font-bold text-lg ${(grossProfit - mileageDeduction) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${(grossProfit - mileageDeduction).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Sales breakdown */}
            {yearSales.length > 0 && (
              <details className="bg-white rounded-xl shadow-lg overflow-hidden">
                <summary className="p-4 cursor-pointer font-bold text-gray-700">
                  Sales Detail ({yearSales.length} items)
                </summary>
                <div className="max-h-60 overflow-y-auto border-t">
                  {yearSales.map(item => (
                    <div key={item.id} className="flex justify-between p-3 border-b text-sm">
                      <div>
                        <div className="font-medium">{item.description}</div>
                        <div className="text-xs text-gray-500">{item.saleDate || item.dateAcquired}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">${item.salePrice}</div>
                        <div className="text-xs text-gray-500">Cost: ${item.purchasePrice}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
        
        {/* MILEAGE TAB */}
        {activeTab === 'mileage' && (
          <>
            {/* Mileage Summary */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm opacity-90">{selectedYear} Mileage Deduction</div>
                  <div className="text-3xl font-bold">${mileageDeduction.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{totalMiles.toLocaleString()}</div>
                  <div className="text-sm opacity-90">miles</div>
                </div>
              </div>
              <div className="text-xs mt-2 opacity-75">Rate: ${mileageRate}/mile</div>
            </div>
            
            {/* Add Trip Button */}
            <button
              onClick={() => setShowAddTrip(true)}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Log New Trip
            </button>
            
            {/* Trip List */}
            <div className="space-y-2">
              {yearMileage.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                  <Car size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No trips logged for {selectedYear}</p>
                </div>
              ) : (
                yearMileage.sort((a, b) => new Date(b.date) - new Date(a.date)).map(trip => (
                  <div key={trip.id} className="bg-white rounded-xl shadow p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-800">{trip.purpose}</div>
                        <div className="text-sm text-gray-500">{trip.date}</div>
                        {trip.startLocation && (
                          <div className="text-xs text-gray-400 mt-1">
                            {trip.startLocation} → {trip.destination || 'N/A'}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-600">{trip.miles} mi</div>
                        <div className="text-sm text-green-600">${(trip.miles * mileageRate).toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t text-xs text-gray-400">
                      <span>Odometer: {trip.startOdometer} → {trip.endOdometer}</span>
                      <button
                        onClick={() => onDeleteMileage(trip.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
        
        {/* VEHICLES TAB */}
        {activeTab === 'vehicles' && (
          <>
            <button
              onClick={() => setShowAddVehicle(true)}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Add Vehicle
            </button>
            
            {(vehicles || []).length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                <Car size={48} className="mx-auto mb-2 opacity-50" />
                <p>No vehicles added yet</p>
                <p className="text-sm">Add a vehicle to start tracking mileage</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vehicles.map(v => (
                  <div key={v.id} className="bg-white rounded-xl shadow p-4">
                    <div className="font-bold text-gray-800">{v.name}</div>
                    <div className="text-sm text-gray-500">
                      {v.year} {v.make} {v.model}
                    </div>
                    {v.startingOdometer && (
                      <div className="text-xs text-gray-400 mt-1">
                        Starting odometer: {parseInt(v.startingOdometer).toLocaleString()} mi
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* ADD TRIP MODAL */}
      {showAddTrip && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Log Trip</h2>
              <button onClick={() => setShowAddTrip(false)} className="p-2"><X size={24} /></button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={tripForm.date}
                  onChange={(e) => setTripForm({ ...tripForm, date: e.target.value })}
                  className="w-full border rounded-lg p-3"
                />
              </div>
              
              {/* Vehicle */}
              {vehicles?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Vehicle</label>
                  <select
                    value={tripForm.vehicleId}
                    onChange={(e) => setTripForm({ ...tripForm, vehicleId: e.target.value })}
                    className="w-full border rounded-lg p-3"
                  >
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Business Purpose */}
              <div>
                <label className="block text-sm font-medium mb-1">Business Purpose *</label>
                <input
                  type="text"
                  value={tripForm.purpose}
                  onChange={(e) => setTripForm({ ...tripForm, purpose: e.target.value })}
                  placeholder="e.g., Meet client for gold purchase"
                  className="w-full border rounded-lg p-3"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {['Client purchase', 'Refiner drop-off', 'Estate sale', 'Coin show', 'Bank deposit', 'Supplies'].map(p => (
                    <button
                      key={p}
                      onClick={() => setTripForm({ ...tripForm, purpose: p })}
                      className="text-xs bg-gray-100 px-2 py-1 rounded"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Starting Location with GPS */}
              <div>
                <label className="block text-sm font-medium mb-1">Starting Location</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tripForm.startLocation}
                    onChange={(e) => setTripForm({ ...tripForm, startLocation: e.target.value })}
                    placeholder="e.g., Home office"
                    className="flex-1 border rounded-lg p-3"
                  />
                  <button
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    className="bg-blue-100 text-blue-700 px-4 rounded-lg flex items-center gap-1"
                  >
                    {isGettingLocation ? <RefreshCw size={18} className="animate-spin" /> : <MapPin size={18} />}
                  </button>
                </div>
              </div>
              
              {/* Destination */}
              <div>
                <label className="block text-sm font-medium mb-1">Destination</label>
                <input
                  type="text"
                  value={tripForm.destination}
                  onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
                  placeholder="e.g., Client's home, Refiner"
                  className="w-full border rounded-lg p-3"
                />
              </div>
              
              {/* Start Odometer with Camera */}
              <div>
                <label className="block text-sm font-medium mb-1">Start Odometer *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={tripForm.startOdometer}
                    onChange={(e) => setTripForm({ ...tripForm, startOdometer: e.target.value })}
                    placeholder="e.g., 45230"
                    className="flex-1 border rounded-lg p-3"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={startOdometerRef}
                    onChange={handleOdometerCapture('startOdometer')}
                    className="hidden"
                  />
                  <button
                    onClick={() => startOdometerRef.current?.click()}
                    disabled={isReadingOdometer === 'startOdometer'}
                    className="bg-amber-100 text-amber-700 px-4 rounded-lg flex items-center gap-1"
                  >
                    {isReadingOdometer === 'startOdometer' ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Camera size={18} />
                    )}
                  </button>
                </div>
                {tripForm.startPhoto && (
                  <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <Check size={14} /> Photo captured & read
                  </div>
                )}
              </div>
              
              {/* End Odometer with Camera */}
              <div>
                <label className="block text-sm font-medium mb-1">End Odometer *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={tripForm.endOdometer}
                    onChange={(e) => setTripForm({ ...tripForm, endOdometer: e.target.value })}
                    placeholder="e.g., 45280"
                    className="flex-1 border rounded-lg p-3"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={endOdometerRef}
                    onChange={handleOdometerCapture('endOdometer')}
                    className="hidden"
                  />
                  <button
                    onClick={() => endOdometerRef.current?.click()}
                    disabled={isReadingOdometer === 'endOdometer'}
                    className="bg-amber-100 text-amber-700 px-4 rounded-lg flex items-center gap-1"
                  >
                    {isReadingOdometer === 'endOdometer' ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Camera size={18} />
                    )}
                  </button>
                </div>
                {tripForm.endPhoto && (
                  <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <Check size={14} /> Photo captured & read
                  </div>
                )}
              </div>
              
              {/* Calculated Miles */}
              {tripForm.startOdometer && tripForm.endOdometer && (
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <div className="text-sm text-blue-600">Trip Distance</div>
                  <div className="text-3xl font-bold text-blue-700">
                    {(parseFloat(tripForm.endOdometer) - parseFloat(tripForm.startOdometer)).toLocaleString()} miles
                  </div>
                  <div className="text-sm text-green-600">
                    ≈ ${((parseFloat(tripForm.endOdometer) - parseFloat(tripForm.startOdometer)) * mileageRate).toFixed(2)} deduction
                  </div>
                </div>
              )}
              
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <textarea
                  value={tripForm.notes}
                  onChange={(e) => setTripForm({ ...tripForm, notes: e.target.value })}
                  placeholder="Additional details..."
                  className="w-full border rounded-lg p-3"
                  rows={2}
                />
              </div>
              
              {/* Save Button */}
              <button
                onClick={handleAddTrip}
                disabled={!tripForm.purpose || !tripForm.startOdometer || !tripForm.endOdometer}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-bold disabled:bg-gray-300"
              >
                Save Trip
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ADD VEHICLE MODAL */}
      {showAddVehicle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl">
            <div className="border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Add Vehicle</h2>
              <button onClick={() => setShowAddVehicle(false)} className="p-2"><X size={24} /></button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Vehicle Name *</label>
                <input
                  type="text"
                  value={vehicleForm.name}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
                  placeholder="e.g., Work Truck"
                  className="w-full border rounded-lg p-3"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Year</label>
                  <input
                    type="text"
                    value={vehicleForm.year}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                    placeholder="2020"
                    className="w-full border rounded-lg p-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Make</label>
                  <input
                    type="text"
                    value={vehicleForm.make}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                    placeholder="Ford"
                    className="w-full border rounded-lg p-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Model</label>
                  <input
                    type="text"
                    value={vehicleForm.model}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                    placeholder="F-150"
                    className="w-full border rounded-lg p-3"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Starting Odometer (for {currentYear})</label>
                <input
                  type="number"
                  value={vehicleForm.startingOdometer}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, startingOdometer: e.target.value })}
                  placeholder="e.g., 45000"
                  className="w-full border rounded-lg p-3"
                />
              </div>
              <button
                onClick={handleAddVehicle}
                disabled={!vehicleForm.name}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:bg-gray-300"
              >
                Add Vehicle
              </button>
            </div>
          </div>
        </div>
      )}
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
                  src={getPhotoSrc(item.photo)} 
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
  const initialFormState = { 
    description: '', category: 'Silver - Sterling', metalType: 'Silver', purity: '925', 
    weight: '', clientId: '', purchasePrice: '', meltValue: '', notes: '', 
    status: 'Available', dateAcquired: new Date().toISOString().split('T')[0],
    photo: null, photoBack: null, year: '', mint: '', grade: '', serialNumber: '',
    taxable: false, taxRate: 6.75, salesTax: 0
  };
  
  const [form, setForm] = useState(initialFormState);
  const [weightUnit, setWeightUnit] = useState('g'); // 'g' for grams, 'oz' for troy ounces
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [captureStep, setCaptureStep] = useState('idle'); // idle, front, back, done
  const [saveCount, setSaveCount] = useState(0); // Track saves in this session
  
  // Scroll to top when component mounts or after save
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [saveCount]);
  
  // Reset form for next item
  const resetForm = () => {
    setForm({
      ...initialFormState,
      dateAcquired: new Date().toISOString().split('T')[0] // Fresh date
    });
    setWeightUnit('g');
    setCaptureStep('idle');
    setAiError(null);
    setSaveCount(prev => prev + 1); // Trigger scroll to top
  };
  
  // Calculate sales tax when price or rate changes
  const calculateSalesTax = (price, rate, isTaxable) => {
    if (!isTaxable) return 0;
    return Math.round((parseFloat(price) || 0) * (parseFloat(rate) || 0) / 100 * 100) / 100;
  };
  
  const salesTax = calculateSalesTax(form.purchasePrice, form.taxRate, form.taxable);
  const totalWithTax = (parseFloat(form.purchasePrice) || 0) + salesTax;
  
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
    
    const purityDecimal = parsePurity(purity);
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
  "description": "Full description (e.g., '1921 Morgan Dollar', '14K Yellow Gold Cuban Link Bracelet 7 inch', '10oz Engelhard Silver Bar')",
  "category": "One of: Coins - Silver, Coins - Gold, Silver - Sterling, Silver - Bullion, Gold - Jewelry, Gold - Bullion, Gold - Scrap, Platinum, Palladium, Other",
  "metalType": "Gold, Silver, Platinum, Palladium, or Other",
  "purity": "e.g., 999, 925, 14K, 10K, 18K, 90%, 40%",
  "aswOz": number - THE ACTUAL PRECIOUS METAL WEIGHT IN TROY OUNCES (not total weight - this is critical for melt calculation),
  "year": "year if visible or applicable" or null,
  "mint": "mint mark if visible (P, D, S, O, CC, W)" or null,
  "grade": "grade from holder/flip/slab or condition assessment" or null,
  "purchasePrice": number or null (if a price is written/labeled, extract just the number),
  "serialNumber": "any serial numbers, certification numbers (NGC/PCGS cert#), hallmarks, maker marks" or null,
  "notes": "additional condition details or other observations",
  "confidence": "high, medium, or low"
}

CRITICAL - aswOz MUST BE THE PURE METAL CONTENT:
- Morgan/Peace Dollar: aswOz = 0.7734 (NOT 0.859 total weight)
- Walking Liberty/Franklin/Kennedy Half (90%): aswOz = 0.3617
- Washington Quarter (pre-1965): aswOz = 0.1808
- Roosevelt/Mercury Dime: aswOz = 0.0723
- American Silver Eagle: aswOz = 1.0 (999 fine, so ASW = total weight)
- 10oz Silver Bar (999): aswOz = 10.0
- 14K gold jewelry: aswOz = total weight × 0.583
- 18K gold jewelry: aswOz = total weight × 0.750
- Sterling silver (925): aswOz = total weight × 0.925

For coins, use the KNOWN ASW from numismatic references.
For jewelry/scrap, estimate total weight and multiply by purity.

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
      // aswOz is the ACTUAL SILVER/GOLD WEIGHT - purity already factored in
      const aswOz = aiResult.aswOz || aiResult.estimatedWeightOz || 0;
      const weightGrams = aswOz ? (aswOz * GRAMS_PER_OZ).toFixed(2) : '';
      
      // Calculate melt directly: ASW × spot price (no purity multiplier needed)
      const spot = liveSpotPrices?.[aiResult.metalType?.toLowerCase()] || 0;
      const meltVal = spot && aswOz ? (aswOz * spot).toFixed(2) : '';
      
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
    
    // Compress photo to keep size manageable
    const compressImage = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Scale down if too large
            const maxDim = 1200;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round(height * maxDim / width);
                width = maxDim;
              } else {
                width = Math.round(width * maxDim / height);
                height = maxDim;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG at 70% quality
            const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
            console.log(`Photo compressed: ${Math.round(base64.length/1024)}KB`);
            resolve(base64);
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    };
    
    const base64 = await compressImage(file);
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
    e.target.value = ''; // Reset input
  };
  
  // Rotate photo 90 degrees clockwise
  const rotatePhoto = (side) => {
    const photoData = side === 'front' ? form.photo : form.photoBack;
    if (!photoData) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Swap width and height for 90 degree rotation
      canvas.width = img.height;
      canvas.height = img.width;
      
      // Rotate 90 degrees clockwise
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0);
      
      // Get rotated base64 (without the data:image prefix)
      const rotatedBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      
      if (side === 'front') {
        setForm(prev => ({...prev, photo: rotatedBase64}));
      } else {
        setForm(prev => ({...prev, photoBack: rotatedBase64}));
      }
    };
    img.src = getPhotoSrc(photoData);
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
                    <img src={getPhotoSrc(form.photo)} className="w-full h-28 object-cover rounded-lg border-2 border-green-400" />
                    <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                      <Check size={12} />
                    </div>
                    <button 
                      onClick={() => rotatePhoto('front')}
                      className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white rounded-full w-7 h-7 flex items-center justify-center"
                      title="Rotate 90°"
                    >
                      <RotateCw size={14} />
                    </button>
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
                    <img src={getPhotoSrc(form.photoBack)} className="w-full h-28 object-cover rounded-lg border-2 border-green-400" />
                    <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                      <Check size={12} />
                    </div>
                    <button 
                      onClick={() => rotatePhoto('back')}
                      className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white rounded-full w-7 h-7 flex items-center justify-center"
                      title="Rotate 90°"
                    >
                      <RotateCw size={14} />
                    </button>
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
          
          {/* Purity - Full Width */}
          <div>
            <label className="block text-sm font-medium mb-1">Purity</label>
            <input type="text" value={form.purity} onChange={(e) => setForm({...form, purity: e.target.value})} className="w-full border rounded p-2" placeholder="925, 999, 14K..." />
          </div>
          
          {/* Metal Weight - Full Width */}
          <div>
            <label className="block text-sm font-medium mb-1">ASW (Actual Silver/Gold Weight)</label>
            <p className="text-xs text-gray-500 mb-1">Pure metal content in troy oz - NOT total weight</p>
            <div className="flex gap-1">
              <input 
                type="number" 
                step="0.01" 
                value={form.weight} 
                onChange={(e) => setForm({...form, weight: e.target.value})} 
                className="flex-1 min-w-0 border rounded-l p-2" 
                placeholder={weightUnit === 'g' ? 'grams' : 'troy oz'}
              />
              <div className="flex border rounded-r overflow-hidden flex-shrink-0">
                <button 
                  type="button"
                  onClick={() => handleUnitChange('g')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${weightUnit === 'g' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  g
                </button>
                <button 
                  type="button"
                  onClick={() => handleUnitChange('oz')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${weightUnit === 'oz' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}
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
          
          {/* Status/Basket Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">Disposition</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setForm({...form, status: 'Available'})}
                className={`py-3 px-2 rounded-lg font-medium text-sm transition-all ${
                  form.status === 'Available' 
                    ? 'bg-green-500 text-white ring-2 ring-green-300' 
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                🏷️ Sell
              </button>
              <button
                type="button"
                onClick={() => setForm({...form, status: 'Stash'})}
                className={`py-3 px-2 rounded-lg font-medium text-sm transition-all ${
                  form.status === 'Stash' 
                    ? 'bg-purple-500 text-white ring-2 ring-purple-300' 
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                🏦 Stash
              </button>
              <button
                type="button"
                onClick={() => setForm({...form, status: 'Hold'})}
                className={`py-3 px-2 rounded-lg font-medium text-sm transition-all ${
                  form.status === 'Hold' 
                    ? 'bg-amber-500 text-white ring-2 ring-amber-300' 
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                ⏳ Hold
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {form.status === 'Available' && 'Ready to sell - appears in active inventory'}
              {form.status === 'Stash' && 'Long-term hold - personal collection'}
              {form.status === 'Hold' && 'Regulatory hold - waiting for release'}
            </p>
          </div>
          
          {/* Purchase Price - Full Width */}
          <div>
            <label className="block text-sm font-medium mb-1">Purchase Price</label>
            <div className="flex">
              <span className="bg-gray-100 border border-r-0 rounded-l px-3 py-2 text-gray-500">$</span>
              <input type="number" value={form.purchasePrice} onChange={(e) => setForm({...form, purchasePrice: e.target.value})} className="flex-1 min-w-0 border rounded-r p-2" placeholder="0.00" />
            </div>
          </div>
          
          {/* Sales Tax Section */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.taxable} 
                  onChange={(e) => setForm({...form, taxable: e.target.checked})}
                  className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm font-medium">Taxable Purchase</span>
              </label>
              {form.taxable && (
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    step="0.01"
                    value={form.taxRate} 
                    onChange={(e) => setForm({...form, taxRate: e.target.value})}
                    className="w-16 border rounded px-2 py-1 text-sm text-right"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              )}
            </div>
            {form.taxable && form.purchasePrice && (
              <div className="pt-2 border-t border-gray-200 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal:</span>
                  <span>${parseFloat(form.purchasePrice).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sales Tax ({form.taxRate}%):</span>
                  <span className="text-amber-600">${salesTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total Cost Basis:</span>
                  <span className="text-green-600">${totalWithTax.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Melt at Purchase - Full Width */}
          <div>
            <label className="block text-sm font-medium mb-1">Melt at Purchase</label>
            <p className="text-xs text-gray-500 mb-1">Locked value using spot when saved</p>
            <div className="flex gap-2">
              <div className="flex flex-1 min-w-0">
                <span className="bg-gray-100 border border-r-0 rounded-l px-3 py-2 text-gray-500">$</span>
                <input type="number" value={form.meltValue} onChange={(e) => setForm({...form, meltValue: e.target.value})} className="flex-1 min-w-0 border rounded-r p-2" placeholder="0.00" />
              </div>
              <button 
                type="button"
                onClick={() => {
                  const spot = liveSpotPrices?.[form.metalType?.toLowerCase()] || 0;
                  const asw = getWeightInOz();
                  setForm({...form, meltValue: (asw * spot).toFixed(2)});
                }} 
                className="bg-amber-500 text-white px-4 rounded text-sm font-medium flex-shrink-0"
              >
                Calc
              </button>
            </div>
          </div>
          
          {/* Live Melt Value Display */}
          {form.weight && form.metalType && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs text-green-600 font-medium">Current Melt Value (Live)</div>
                  <div className="text-xl font-bold text-green-700">
                    ${(getWeightInOz() * (liveSpotPrices?.[form.metalType?.toLowerCase()] || 0)).toFixed(2)}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>{form.metalType} Spot</div>
                  <div className="font-medium">${liveSpotPrices?.[form.metalType?.toLowerCase()]?.toFixed(2) || 'N/A'}/oz</div>
                </div>
              </div>
              <div className="text-xs text-green-600 mt-1">
                {getWeightInOz().toFixed(4)} oz ASW × ${liveSpotPrices?.[form.metalType?.toLowerCase()]?.toFixed(2) || '0'}/oz
              </div>
            </div>
          )}
          
          <div><label className="block text-sm font-medium mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="w-full border rounded p-2" rows={2} /></div>
          <div className="flex gap-2 pt-2">
            <button onClick={onCancel} disabled={isSaving} className="flex-1 border py-2 rounded disabled:opacity-50">Cancel</button>
            <button 
              disabled={isSaving}
              onClick={async () => { 
                if (!form.description) {
                  alert('Please enter a description');
                  return;
                }
                setIsSaving(true);
                
                try {
                  const weightInOz = getWeightInOz();
                  const meltAtPurchase = parseFloat(form.meltValue || calculateMelt(form.metalType, form.purity, weightInOz)) || 0;
                  // Calculate total cost including tax if applicable
                  const basePurchasePrice = parseFloat(form.purchasePrice) || 0;
                  const taxAmount = form.taxable ? calculateSalesTax(form.purchasePrice, form.taxRate, true) : 0;
                  const totalPurchasePrice = basePurchasePrice + taxAmount;
                  
                  await onSave({ 
                    ...form, 
                    weightOz: weightInOz, 
                    purchasePrice: totalPurchasePrice,
                    priceBeforeTax: basePurchasePrice,
                    salesTax: taxAmount,
                    taxRate: form.taxable ? parseFloat(form.taxRate) : null,
                    taxable: form.taxable,
                    meltValue: meltAtPurchase,
                    spotAtPurchase: {
                      gold: liveSpotPrices?.gold || 0,
                      silver: liveSpotPrices?.silver || 0,
                      platinum: liveSpotPrices?.platinum || 0,
                      palladium: liveSpotPrices?.palladium || 0,
                      date: new Date().toISOString()
                    }
                  }, resetForm); // Pass resetForm callback
                } catch (error) {
                  console.error('Save error:', error);
                  alert('Save failed: ' + error.message);
                } finally {
                  setIsSaving(false);
                }
              }} 
              className={`flex-1 py-2 rounded text-white font-medium ${isSaving ? 'bg-gray-400' : 'bg-amber-600'}`}
            >
              {isSaving ? '⏳ Saving...' : 'Save & Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailView({ item, clients, onUpdate, onDelete, onBack, onListOnEbay, liveSpotPrices, onCreateLot, onGoHome }) {
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
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    description: item.description || '',
    category: item.category || 'Silver - Sterling',
    metalType: item.metalType || 'Silver',
    purity: item.purity || '',
    weightOz: item.weightOz || '',
    purchasePrice: item.purchasePrice || '',
    meltValue: item.meltValue || '',
    notes: item.notes || '',
    serialNumber: item.serialNumber || '',
    year: item.year || '',
    mint: item.mint || '',
    grade: item.grade || '',
    clientId: item.clientId || '',
    status: item.status || 'Available'
  });
  
  // Photo management refs
  const photoCameraRef = useRef(null);
  const photoGalleryRef = useRef(null);
  const backPhotoCameraRef = useRef(null);
  const backPhotoGalleryRef = useRef(null);
  
  const client = clients.find(c => c.id === item.clientId);
  const holdStatus = getHoldStatus(item);
  const profit = item.status === 'Sold' ? (item.salePrice - item.purchasePrice) : (item.meltValue - item.purchasePrice);
  
  // Handle adding/updating photos with compression
  const handlePhotoCapture = (side) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Compress photo
    const compressImage = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Scale down if too large
            const maxDim = 1200;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round(height * maxDim / width);
                width = maxDim;
              } else {
                width = Math.round(width * maxDim / height);
                height = maxDim;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
            console.log(`Photo compressed: ${Math.round(base64.length/1024)}KB`);
            resolve(base64);
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    };
    
    const base64 = await compressImage(file);
    if (side === 'front') {
      onUpdate({ ...item, photo: base64 });
    } else {
      onUpdate({ ...item, photoBack: base64 });
    }
    e.target.value = ''; // Reset input
  };
  
  const removePhoto = (side) => {
    if (side === 'front') {
      onUpdate({ ...item, photo: null });
    } else {
      onUpdate({ ...item, photoBack: null });
    }
  };
  
  // Rotate photo 90 degrees clockwise
  const rotatePhoto = (side) => {
    const photoData = side === 'front' ? item.photo : item.photoBack;
    if (!photoData) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Swap width and height for 90 degree rotation
      canvas.width = img.height;
      canvas.height = img.width;
      
      // Rotate 90 degrees clockwise
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0);
      
      // Get rotated base64 (without the data:image prefix)
      const rotatedBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      
      if (side === 'front') {
        onUpdate({ ...item, photo: rotatedBase64 });
      } else {
        onUpdate({ ...item, photoBack: rotatedBase64 });
      }
    };
    img.src = getPhotoSrc(photoData);
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
  
  // Categories for edit form
  const categories = ['Coins - Silver', 'Coins - Gold', 'Silver - Sterling', 'Silver - Bullion', 'Gold - Jewelry', 'Gold - Bullion', 'Gold - Scrap', 'Platinum', 'Palladium', 'Collectibles', 'Other'];
  
  // Save edit handler
  const handleSaveEdit = () => {
    onUpdate({
      ...item,
      ...editForm,
      weightOz: parseFloat(editForm.weightOz) || item.weightOz,
      purchasePrice: parseFloat(editForm.purchasePrice) || item.purchasePrice,
      meltValue: parseFloat(editForm.meltValue) || item.meltValue
    });
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-amber-50 pb-24">
      <div className="bg-amber-700 text-white p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button onClick={onBack}>← Back</button>
          {onGoHome && (
            <button onClick={onGoHome} className="p-1 hover:bg-amber-600 rounded">
              <Home size={18} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-amber-600 rounded">
            <Edit3 size={20} />
          </button>
          <button onClick={onDelete}><Trash2 size={20} /></button>
        </div>
      </div>
      
      {/* EDIT MODAL */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <div className="min-h-screen p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg mx-auto">
              <div className="bg-amber-600 text-white p-4 rounded-t-lg flex justify-between items-center">
                <h3 className="font-bold text-lg">Edit Item</h3>
                <button onClick={() => setIsEditing(false)}><X size={24} /></button>
              </div>
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium mb-1">Description *</label>
                  <input type="text" value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} className="w-full border rounded p-2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select value={editForm.category} onChange={(e) => setEditForm({...editForm, category: e.target.value})} className="w-full border rounded p-2 bg-white">
                      {categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Metal</label>
                    <select value={editForm.metalType} onChange={(e) => setEditForm({...editForm, metalType: e.target.value})} className="w-full border rounded p-2 bg-white">
                      <option>Gold</option><option>Silver</option><option>Platinum</option><option>Palladium</option><option>Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Purity</label>
                    <input type="text" value={editForm.purity} onChange={(e) => setEditForm({...editForm, purity: e.target.value})} className="w-full border rounded p-2" placeholder="925, 999, 14K..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Weight (oz)</label>
                    <input type="number" step="0.0001" value={editForm.weightOz} onChange={(e) => setEditForm({...editForm, weightOz: e.target.value})} className="w-full border rounded p-2" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Year</label>
                    <input type="text" value={editForm.year} onChange={(e) => setEditForm({...editForm, year: e.target.value})} className="w-full border rounded p-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Mint</label>
                    <select value={editForm.mint} onChange={(e) => setEditForm({...editForm, mint: e.target.value})} className="w-full border rounded p-2 bg-white">
                      <option value="">-</option>
                      <option value="P">P</option><option value="D">D</option><option value="S">S</option>
                      <option value="O">O</option><option value="CC">CC</option><option value="W">W</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Grade</label>
                    <input type="text" value={editForm.grade} onChange={(e) => setEditForm({...editForm, grade: e.target.value})} className="w-full border rounded p-2" placeholder="MS65, VF..." />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Client</label>
                  <select value={editForm.clientId} onChange={(e) => setEditForm({...editForm, clientId: e.target.value})} className="w-full border rounded p-2 bg-white">
                    <option value="">No client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Purchase Price</label>
                    <input type="number" step="0.01" value={editForm.purchasePrice} onChange={(e) => setEditForm({...editForm, purchasePrice: e.target.value})} className="w-full border rounded p-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Melt at Purchase</label>
                    <input type="number" step="0.01" value={editForm.meltValue} onChange={(e) => setEditForm({...editForm, meltValue: e.target.value})} className="w-full border rounded p-2" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Serial / Marks</label>
                  <input type="text" value={editForm.serialNumber} onChange={(e) => setEditForm({...editForm, serialNumber: e.target.value})} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({...editForm, status: e.target.value})} className="w-full border rounded p-2 bg-white">
                    <option value="Available">Available</option>
                    <option value="Stash">Stash</option>
                    <option value="Sold">Sold</option>
                    <option value="Listed">Listed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea value={editForm.notes} onChange={(e) => setEditForm({...editForm, notes: e.target.value})} className="w-full border rounded p-2" rows={3} />
                </div>
              </div>
              <div className="p-4 border-t flex gap-3">
                <button onClick={() => setIsEditing(false)} className="flex-1 border py-2 rounded">Cancel</button>
                <button onClick={handleSaveEdit} className="flex-1 bg-amber-600 text-white py-2 rounded font-medium">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
                        src={getPhotoSrc(item.photo)} 
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
                      <button
                        onClick={() => rotatePhoto('front')}
                        className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white rounded-full w-7 h-7 flex items-center justify-center"
                        title="Rotate 90°"
                      >
                        <RotateCw size={14} />
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
                        src={getPhotoSrc(item.photoBack)} 
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
                      <button
                        onClick={() => rotatePhoto('back')}
                        className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white rounded-full w-7 h-7 flex items-center justify-center"
                        title="Rotate 90°"
                      >
                        <RotateCw size={14} />
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
                        src={getPhotoSrc(item.photo)} 
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
                        src={getPhotoSrc(item.photoBack)} 
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
        
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="bg-gray-50 p-3 rounded"><div className="text-xs text-gray-500">Cost</div><div className="text-lg font-bold">${item.purchasePrice}</div></div>
          <div className="bg-gray-50 p-3 rounded"><div className="text-xs text-gray-500">Melt @ Purchase</div><div className="text-lg font-bold text-amber-700">${item.meltValue}</div></div>
        </div>
        
        {/* Current Melt Value - calculated live from spot */}
        {item.weightOz && item.metalType && (
          <div className="bg-green-50 p-3 rounded-lg mb-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-green-600 font-medium">Current Melt Value (Live)</div>
                <div className="text-2xl font-bold text-green-700">
                  ${(() => {
                    const spot = liveSpotPrices?.[item.metalType?.toLowerCase()] || 0;
                    const purityDecimal = parsePurity(item.purity);
                    return ((item.weightOz || 0) * spot * purityDecimal).toFixed(2);
                  })()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">{item.metalType} Spot</div>
                <div className="font-medium">${liveSpotPrices?.[item.metalType?.toLowerCase()]?.toFixed(2) || 'N/A'}/oz</div>
              </div>
            </div>
            {/* Show profit vs cost */}
            {(() => {
              const spot = liveSpotPrices?.[item.metalType?.toLowerCase()] || 0;
              const purityDecimal = parsePurity(item.purity);
              const currentMelt = (item.weightOz || 0) * spot * purityDecimal;
              const currentProfit = currentMelt - (item.purchasePrice || 0);
              return (
                <div className={`text-sm mt-2 ${currentProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {currentProfit >= 0 ? '↑' : '↓'} ${Math.abs(currentProfit).toFixed(2)} vs cost ({((currentProfit / (item.purchasePrice || 1)) * 100).toFixed(0)}%)
                </div>
              );
            })()}
          </div>
        )}
        
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
        
        {/* Demo Mode Sharing */}
        <div className="bg-white p-4 rounded-lg shadow border-2 border-purple-200">
          <h3 className="font-medium mb-3 flex items-center gap-2 text-purple-700">
            <Zap size={18} /> Demo Mode (Share with Others)
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Share this link to let others try the app without accessing your real data. Demo users have their own separate database.
          </p>
          
          <div className="bg-purple-50 p-3 rounded mb-3">
            <p className="text-xs text-purple-600 font-medium mb-1">Demo Link:</p>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={`${window.location.origin}${window.location.pathname}?demo=true`}
                className="flex-1 text-sm bg-white border rounded px-2 py-1"
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?demo=true`);
                  alert('Demo link copied to clipboard!');
                }}
                className="bg-purple-600 text-white px-3 py-1 rounded text-sm"
              >
                Copy
              </button>
            </div>
          </div>
          
          <button 
            onClick={async () => {
              if (confirm('Clear ALL demo data? This removes all inventory, clients, and lots from the demo environment.')) {
                const success = await FirebaseService.clearDemoData();
                alert(success ? 'Demo data cleared!' : 'Failed to clear demo data');
              }
            }}
            className="w-full border border-purple-300 text-purple-600 py-2 rounded text-sm flex items-center justify-center gap-2 hover:bg-purple-50"
          >
            <Trash2 size={14} /> Clear Demo Data
          </button>
        </div>
        
        {/* App Info */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <HardDrive size={18} /> App Information
          </h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Version:</strong> 117</p>
            <p><strong>Firebase Project:</strong> ses-inventory</p>
            <p><strong>Last Updated:</strong> January 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ RECEIPT MANAGER VIEW ============
function ReceiptManagerView({ onBack, receipts, onAddReceipt, onDeleteReceipt, onUpdateReceipt, inventory, lots, clients, onAddClient, onGoHome }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [filter, setFilter] = useState('all'); // all, purchase, sale
  const [showClientLink, setShowClientLink] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const fileInputRef = useRef(null);
  
  // Find matching clients based on vendor name
  const findMatchingClients = (vendorName) => {
    if (!vendorName || !clients) return [];
    const searchLower = vendorName.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchLower) ||
      searchLower.includes(c.name.toLowerCase())
    );
  };
  
  // Link receipt to existing client
  const linkToClient = (clientId) => {
    const updatedReceipt = { ...selectedReceipt, linkedClientId: clientId };
    onUpdateReceipt(updatedReceipt);
    setSelectedReceipt(updatedReceipt);
    setShowClientLink(false);
  };
  
  // Create new client from receipt vendor and link
  const createAndLinkClient = () => {
    const receipt = selectedReceipt;
    const newClient = {
      id: `CLI-${Date.now()}`,
      name: receipt.vendor || 'Unknown',
      type: receipt.vendorType === 'individual' ? 'Private' : 'Business',
      email: '',
      phone: '',
      address: '',
      idType: receipt.vendorType === 'individual' ? 'Drivers License' : 'Business',
      idNumber: '',
      idExpiry: '',
      idFrontPhoto: null,
      idBackPhoto: null,
      signature: null,
      signatureTimestamp: null,
      signatureLocation: null,
      notes: `Created from receipt ${receipt.id}. ${receipt.vendorType ? `Type: ${receipt.vendorType}` : ''}`,
      dateAdded: new Date().toISOString().split('T')[0],
      totalTransactions: 1,
      totalPurchased: receipt.type === 'purchase' ? (receipt.total || 0) : 0,
      // New field to track if this is a vendor (we buy FROM) vs client (sells TO us)
      relationship: receipt.type === 'purchase' ? 'vendor' : 'client'
    };
    
    if (onAddClient) {
      onAddClient(newClient);
    }
    
    // Link receipt to new client
    const updatedReceipt = { ...selectedReceipt, linkedClientId: newClient.id };
    onUpdateReceipt(updatedReceipt);
    setSelectedReceipt(updatedReceipt);
    setShowClientLink(false);
  };
  
  // Get linked client info
  const getLinkedClient = (receipt) => {
    if (!receipt?.linkedClientId || !clients) return null;
    return clients.find(c => c.id === receipt.linkedClientId);
  };
  
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
          
          {/* Client/Vendor Linking Section */}
          {!isEditing && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Link2 size={16} />
                  {selectedReceipt.type === 'purchase' ? 'Vendor' : 'Client'} Link
                </h3>
              </div>
              
              {(() => {
                const linkedClient = getLinkedClient(selectedReceipt);
                if (linkedClient) {
                  return (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <UserCheck size={20} className="text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium text-green-800">{linkedClient.name}</div>
                          <div className="text-xs text-green-600">
                            {linkedClient.type} • {linkedClient.relationship === 'vendor' ? 'Vendor (buy from)' : 'Client (sell to)'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const updatedReceipt = { ...selectedReceipt };
                          delete updatedReceipt.linkedClientId;
                          onUpdateReceipt(updatedReceipt);
                          setSelectedReceipt(updatedReceipt);
                        }}
                        className="text-red-500 text-sm"
                      >
                        Unlink
                      </button>
                    </div>
                  );
                }
                
                // Not linked yet - show linking options
                const matchingClients = findMatchingClients(selectedReceipt.vendor);
                
                return (
                  <div className="space-y-3">
                    {/* Suggested matches */}
                    {matchingClients.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Possible matches:</p>
                        <div className="space-y-2">
                          {matchingClients.slice(0, 3).map(client => (
                            <button
                              key={client.id}
                              onClick={() => linkToClient(client.id)}
                              className="w-full flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-2 hover:bg-blue-100"
                            >
                              <div className="flex items-center gap-2">
                                <User size={16} className="text-blue-600" />
                                <span className="font-medium text-blue-800">{client.name}</span>
                                <span className="text-xs text-blue-500">{client.type}</span>
                              </div>
                              <span className="text-xs text-blue-600">Link →</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Search existing clients */}
                    {showClientLink ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={clientSearchTerm}
                          onChange={(e) => setClientSearchTerm(e.target.value)}
                          placeholder="Search clients..."
                          className="w-full border rounded p-2 text-sm"
                          autoFocus
                        />
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {(clients || [])
                            .filter(c => 
                              clientSearchTerm === '' || 
                              c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
                            )
                            .slice(0, 10)
                            .map(client => (
                              <button
                                key={client.id}
                                onClick={() => linkToClient(client.id)}
                                className="w-full text-left p-2 rounded hover:bg-gray-100 flex items-center gap-2"
                              >
                                <User size={14} className="text-gray-400" />
                                <span className="text-sm">{client.name}</span>
                                <span className="text-xs text-gray-400">{client.type}</span>
                              </button>
                            ))
                          }
                        </div>
                        <button
                          onClick={() => { setShowClientLink(false); setClientSearchTerm(''); }}
                          className="w-full text-sm text-gray-500 py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowClientLink(true)}
                          className="flex-1 border border-blue-300 text-blue-600 py-2 rounded text-sm flex items-center justify-center gap-2"
                        >
                          <Search size={14} /> Find Existing
                        </button>
                        {selectedReceipt.vendor && (
                          <button
                            onClick={createAndLinkClient}
                            className="flex-1 bg-green-600 text-white py-2 rounded text-sm flex items-center justify-center gap-2"
                          >
                            <UserPlus size={14} /> Create "{selectedReceipt.vendor}"
                          </button>
                        )}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-400 text-center">
                      {selectedReceipt.type === 'purchase' 
                        ? 'Link to vendor you purchased from' 
                        : 'Link to client you sold to'}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
          
          {/* Original File Preview - only show when not editing */}
          {!isEditing && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-medium mb-3">Original Document</h3>
              {selectedReceipt.fileType?.startsWith('image/') ? (
                <img 
                  src={selectedReceipt.fileUrl || `data:${selectedReceipt.fileType};base64,${selectedReceipt.fileData}`}
                  alt="Receipt"
                  className="w-full rounded border"
                />
              ) : selectedReceipt.fileUrl ? (
                <div className="bg-gray-100 p-4 rounded text-center">
                  <FileText size={48} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">{selectedReceipt.fileName}</p>
                  <a 
                    href={selectedReceipt.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-blue-600 text-sm underline block"
                  >
                    Open PDF
                  </a>
                </div>
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
      <div className="bg-amber-700 text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={onBack} className="mr-4">← Back</button>
          <FileText size={24} className="mr-2" />
          <h1 className="text-xl font-bold">Receipts</h1>
        </div>
        {onGoHome && (
          <button onClick={onGoHome} className="p-2 hover:bg-amber-600 rounded">
            <Home size={20} />
          </button>
        )}
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
  // Check for demo mode from URL
  const [demoMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('demo') === 'true';
  });
  
  // Start with null to indicate "not yet loaded" vs "empty"
  const [inventory, setInventory] = useState(null);
  const [clients, setClients] = useState(null);
  const [lots, setLots] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [mileageLog, setMileageLog] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if initial load is complete
  const [loadError, setLoadError] = useState(null); // Critical error state - blocks app if set
  const [kpiExpanded, setKpiExpanded] = useState(true); // KPI dashboard expanded by default
  const [inventoryListExpanded, setInventoryListExpanded] = useState(false); // Inventory list collapsed by default
  const [inventoryViewMode, setInventoryViewMode] = useState('list'); // 'list' or 'grid'
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
  
  // Sell Trigger Settings - stored in localStorage
  const [sellTriggers, setSellTriggers] = useState(() => {
    const saved = localStorage.getItem('ses-sell-triggers');
    if (saved) return JSON.parse(saved);
    return {
      enabled: true,
      globalOverride: false, // If true, disables all triggers
      triggers: [
        { id: 'retail-premium', name: 'Retail Premium Opportunity', enabled: true, 
          condition: 'eBay price > melt + X%', threshold: 20, unit: '%',
          description: 'Flag when item can sell on eBay for premium over melt' },
        { id: 'spot-spike', name: 'Spot Price Spike', enabled: true,
          condition: 'Spot up X% in 7 days', threshold: 5, unit: '%',
          description: 'Alert when spot rises sharply - sell into strength' },
        { id: 'downward-trend', name: 'Downward Trend Warning', enabled: true,
          condition: 'Spot down X% in 3 days', threshold: 3, unit: '%',
          description: 'Warning when spot is falling - consider selling to refiner' },
        { id: 'min-roi', name: 'Minimum ROI Alert', enabled: true,
          condition: 'Current melt < cost + X%', threshold: 10, unit: '%',
          description: 'Warning when approaching break-even' },
        { id: 'stale-inventory', name: 'Stale Inventory', enabled: false,
          condition: 'Held > X days with no premium', threshold: 90, unit: 'days',
          description: 'Suggest moving to refiner if held too long' }
      ],
      metalOverrides: {
        gold: { enabled: true, overrides: {} },
        silver: { enabled: true, overrides: {} },
        platinum: { enabled: true, overrides: {} }
      },
      itemOverrides: {} // itemId -> { disabled: true } to ignore triggers for specific items
    };
  });
  
  // Save triggers to localStorage when changed
  useEffect(() => {
    localStorage.setItem('ses-sell-triggers', JSON.stringify(sellTriggers));
  }, [sellTriggers]);
  
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
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }
  const fileInputRef = useRef(null);
  
  // Show toast notification - errors stay longer
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    const duration = type === 'error' ? 6000 : 3000;
    setTimeout(() => setToast(null), duration);
  };
  
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
      // Set demo mode in FirebaseService
      FirebaseService.setDemoMode(demoMode);
      
      // Initialize Firebase
      const fbReady = await FirebaseService.init();
      setFirebaseReady(fbReady);
      
      if (!fbReady) {
        // Firebase failed to initialize - this is a critical error
        console.error('CRITICAL: Firebase failed to initialize');
        setLoadError('Failed to connect to database. Please check your internet connection and refresh.');
        setDataLoaded(true);
        return;
      }
      
      console.log('Firebase ready, loading data...');
      
      try {
        const [fbInventory, fbClients, fbLots, fbReceipts, fbMileage, fbVehicles] = await Promise.all([
          FirebaseService.loadInventory(),
          FirebaseService.loadClients(),
          FirebaseService.loadLots(),
          FirebaseService.loadReceipts(),
          FirebaseService.loadMileage(),
          FirebaseService.loadVehicles()
        ]);
        
        console.log('Firebase load results:', {
          inventory: fbInventory?.length ?? 'null',
          clients: fbClients?.length ?? 'null',
          lots: fbLots?.length ?? 'null',
          receipts: fbReceipts?.length ?? 'null',
          mileage: fbMileage?.length ?? 'null',
          vehicles: fbVehicles?.length ?? 'null'
        });
        
        // If any load returned null, there was an error - don't proceed
        if (fbInventory === null || fbClients === null || fbLots === null) {
          console.error('CRITICAL: Firebase load returned null - data may be corrupted or connection failed');
          setLoadError('Failed to load your data. Please refresh the page. If this persists, check browser console for errors.');
          setDataLoaded(true);
          return;
        }
        
        // Success - use whatever Firebase returned (empty arrays are valid)
        setInventory(fbInventory);
        setClients(fbClients);
        setLots(fbLots);
        setReceipts(fbReceipts || []);
        setMileageLog(fbMileage || []);
        setVehicles(fbVehicles || []);
        
        console.log('Successfully loaded from Firebase:', {
          inventory: fbInventory.length,
          clients: fbClients.length,
          lots: fbLots.length,
          receipts: fbReceipts?.length || 0,
          mileage: fbMileage?.length || 0,
          vehicles: fbVehicles?.length || 0
        });
        
      } catch (error) {
        console.error('CRITICAL: Firebase load threw exception:', error);
        setLoadError(`Database error: ${error.message}. Please refresh the page.`);
        setDataLoaded(true);
        return;
      }
      
      // Mark initial load as complete - this enables auto-save
      setDataLoaded(true);
      
      // Fetch live spot prices
      try {
        const prices = await SpotPriceService.fetchPrices();
        if (prices) {
          setLiveSpotPrices(prices);
          setSpotLastUpdate(new Date());
        }
      } catch (e) {
        console.log('Initial spot price fetch failed:', e);
      }
    };
    
    initServices();
    
    // Refresh spot prices every 5 minutes
    const priceInterval = setInterval(async () => {
      try {
        const prices = await SpotPriceService.fetchPrices();
        if (prices) {
          setLiveSpotPrices(prices);
          setSpotLastUpdate(new Date());
        }
      } catch (e) {
        console.log('Spot price refresh failed:', e);
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(priceInterval);
  }, []);
  
  // Auto-save to Firebase when data changes - ONLY after initial load completes
  // Using a ref to track if we're in the middle of initial load
  const initialLoadComplete = useRef(false);
  const lastSavedInventoryLength = useRef(0);
  
  // Save immediately when inventory changes (no debounce - mobile browsers kill timeouts)
  useEffect(() => {
    // AUTO-SAVE REMOVED - all saves are now explicit
    // This prevents deleted items from being resurrected by stale data in memory
    // Saves happen on: Add item, Edit item, Delete item (explicit calls)
    
    // Just track initial load for other purposes
    if (!firebaseReady || !dataLoaded || inventory === null) return;
    if (!initialLoadComplete.current) {
      initialLoadComplete.current = true;
      lastSavedInventoryLength.current = inventory.length;
      console.log('Initial load complete:', inventory.length, 'items');
    }
  }, [inventory, firebaseReady, dataLoaded]);
  
  // Also save on page unload (backup for mobile)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (firebaseReady && inventory && inventory.length > 0) {
        console.log('UNLOAD SAVE: Saving before page close');
        // Use sendBeacon for reliable save on close (doesn't work with Firestore, but try anyway)
        FirebaseService.saveInventory(inventory);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload); // iOS Safari
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && firebaseReady && inventory && inventory.length > 0) {
        console.log('VISIBILITY SAVE: Page hidden, saving...');
        FirebaseService.saveInventory(inventory);
      }
    });
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [firebaseReady, inventory]);
  
  useEffect(() => {
    if (firebaseReady && dataLoaded && clients !== null && initialLoadComplete.current) {
      FirebaseService.saveClients(clients);
    }
  }, [clients, firebaseReady, dataLoaded]);
  
  useEffect(() => {
    if (firebaseReady && dataLoaded && lots !== null && initialLoadComplete.current) {
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
    const purityDecimal = parsePurity(purity);
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

  // Show error screen if there was a critical database error
  if (loadError) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertOctagon size={32} className="text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-red-800">Database Error</h2>
          <p className="text-red-600 mt-2 mb-4">{loadError}</p>
          <div className="space-y-2">
            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-red-700"
            >
              Refresh Page
            </button>
            <p className="text-xs text-red-500 mt-4">
              If this error persists, check the browser console (F12) for details, 
              or verify your Firebase connection at console.firebase.google.com
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading screen while data is loading
  if (!dataLoaded || inventory === null || clients === null) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-amber-800">Stevens Estate Services</h2>
          <p className="text-amber-600 mt-2">
            {demoMode ? 'Loading demo environment...' : 'Loading your inventory...'}
          </p>
          {demoMode && (
            <div className="mt-3 bg-purple-100 text-purple-700 px-4 py-2 rounded-full inline-block text-sm">
              <Zap size={14} className="inline mr-1" /> Demo Mode Active
            </div>
          )}
          {firebaseReady && <p className="text-green-600 text-sm mt-2">✓ Connected to cloud</p>}
        </div>
      </div>
    );
  }

  // Client views
  if (view === 'clients') return <ClientListView clients={clients} onSelect={(c) => { setSelectedClient(c); setView('clientDetail'); }} onAdd={() => setView('clientAdd')} onBack={() => setView('list')} onGoHome={() => setView('list')} />;
  if (view === 'clientAdd') return <ClientFormView onSave={(c) => { setClients([...clients, { ...c, id: getNextId('CLI') }]); setView('clients'); }} onCancel={() => setView('clients')} />;
  if (view === 'clientEdit' && selectedClient) return <ClientFormView client={selectedClient} onSave={(c) => { setClients(clients.map(x => x.id === c.id ? c : x)); setSelectedClient(c); setView('clientDetail'); }} onCancel={() => setView('clientDetail')} onDelete={(id) => { setClients(clients.filter(x => x.id !== id)); setView('clients'); }} />;
  if (view === 'clientDetail' && selectedClient) return <ClientDetailView client={selectedClient} transactions={inventory.filter(i => i.clientId === selectedClient.id)} onEdit={() => setView('clientEdit')} onBack={() => { setView('clients'); setSelectedClient(null); }} />;

  // Stash view
  if (view === 'stash') return (
    <PersonalStashView 
      inventory={inventory} 
      spotPrices={liveSpotPrices}
      onBack={() => setView('list')}
      onGoHome={() => setView('list')}
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
    onGoHome={() => setView('list')} 
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
  if (view === 'calculator') return <ScrapCalculatorView spotPrices={liveSpotPrices} onRefresh={refreshSpotPrices} isLoading={isLoadingPrices} onBack={() => setView('list')} onGoHome={() => setView('list')} />;
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
  if (view === 'dashboard') return <DashboardView inventory={inventory} spotPrices={liveSpotPrices} onBack={() => setView('list')} onOpenTax={() => setView('tax')} />;
  if (view === 'tax') return <TaxReportView 
    inventory={inventory} 
    mileageLog={mileageLog}
    vehicles={vehicles}
    spotPrices={liveSpotPrices}
    onBack={() => setView('list')} 
    onAddMileage={async (trip) => {
      setMileageLog([...mileageLog, trip]);
      const success = await FirebaseService.saveMileage(trip);
      if (success) {
        showToast(`✓ Trip logged: ${trip.miles} miles`, 'success');
      } else {
        showToast(`⚠ Trip may not have saved`, 'error');
      }
    }}
    onDeleteMileage={async (id) => {
      setMileageLog(mileageLog.filter(m => m.id !== id));
      await FirebaseService.deleteItem('mileage', id);
      showToast(`✓ Trip deleted`, 'success');
    }}
    onAddVehicle={async (vehicle) => {
      setVehicles([...vehicles, vehicle]);
      const success = await FirebaseService.saveVehicle(vehicle);
      if (success) {
        showToast(`✓ Vehicle added: ${vehicle.name}`, 'success');
      } else {
        showToast(`⚠ Vehicle may not have saved`, 'error');
      }
    }}
  />;
  if (view === 'ebayListings') return <EbayListingsView inventory={inventory} onBack={() => setView('list')} onSelectItem={(item) => { setSelectedItem(item); setView('detail'); }} onListItem={(item) => { setSelectedItem(item); setView('ebayListing'); }} />;
  if (view === 'add') return <AddItemView clients={clients} liveSpotPrices={liveSpotPrices} onSave={async (item, resetForm) => { 
    const newItem = { ...item, id: getNextId('SES') };
    const currentInv = inventory || [];
    
    // Save to Firebase
    try {
      const success = await FirebaseService.saveItem(newItem);
      if (success) {
        // Add to inventory and reset form for next item
        setInventory([...currentInv, newItem]); 
        showToast(`✓ ${newItem.id} saved - ready for next item`, 'success');
        // Reset form to add another item (don't navigate away)
        if (resetForm) resetForm();
      } else {
        // Save returned false - DON'T add to inventory, DON'T reset form
        showToast(`❌ ${newItem.id} FAILED TO SAVE - Try again!`, 'error');
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast(`❌ SAVE FAILED: ${err.message}`, 'error');
    }
  }} onCancel={() => setView('list')} calculateMelt={calculateMelt} />;
  if (view === 'detail' && selectedItem) return <DetailView 
    item={selectedItem} 
    clients={clients} 
    liveSpotPrices={liveSpotPrices} 
    onUpdate={async (u) => { 
      const newInventory = inventory.map(i => i.id === u.id ? u : i);
      setInventory(newInventory); 
      setSelectedItem(u);
      // Save only the updated item
      const success = await FirebaseService.saveItem(u);
      if (success) {
        showToast(`✓ ${u.id} updated`, 'success');
      }
    }} 
    onDelete={async () => { 
      const newInventory = inventory.filter(i => i.id !== selectedItem.id);
      setInventory(newInventory); 
      // Delete from Firebase
      const success = await FirebaseService.deleteItem('inventory', selectedItem.id);
      if (success) {
        showToast(`✓ ${selectedItem.id} deleted`, 'success');
      }
      setView('list'); 
    }} 
    onBack={() => { setView('list'); setSelectedItem(null); }}
    onGoHome={() => { setView('list'); setSelectedItem(null); }} 
    onListOnEbay={(listing) => { setPendingListing(listing); setView('ebayListing'); }}
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
  if (view === 'ebayListing' && selectedItem) return <EbayListingView item={selectedItem} generatedListing={pendingListing} onBack={() => { setPendingListing(null); setView('detail'); }} onListingCreated={(listing) => { setInventory(inventory.map(i => i.id === selectedItem.id ? { ...i, ebayListingId: listing.listingId, ebayUrl: listing.ebayUrl, status: 'Listed' } : i)); setSelectedItem({ ...selectedItem, ebayListingId: listing.listingId, ebayUrl: listing.ebayUrl, status: 'Listed' }); setPendingListing(null); setView('detail'); }} />;
  if (view === 'settings') return <SettingsView onBack={() => setView('list')} onExport={handleExport} onImport={handleImport} onReset={() => { if(confirm('This will DELETE ALL your data. Are you absolutely sure?')) { setInventory([]); setClients([]); setLots([]); }}} fileInputRef={fileInputRef} coinBuyPercents={coinBuyPercents} onUpdateCoinBuyPercent={handleUpdateCoinBuyPercent} ebayConnected={ebayConnected} onEbayDisconnect={handleEbayDisconnect} onViewEbaySync={() => setView('ebaySync')} onViewAdmin={() => setView('admin')} />;
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
    onGoHome={() => setView('list')}
    receipts={receipts}
    inventory={inventory}
    lots={lots}
    clients={clients}
    onAddReceipt={async (receipt) => {
      setReceipts([...receipts, receipt]);
      const success = await FirebaseService.saveReceipt(receipt);
      if (success) {
        showToast(`✓ Receipt ${receipt.id} saved`, 'success');
      } else {
        showToast(`⚠ Receipt may not have saved`, 'error');
      }
    }}
    onDeleteReceipt={async (id) => {
      setReceipts(receipts.filter(r => r.id !== id));
      await FirebaseService.deleteItem('receipts', id);
      showToast(`✓ Receipt deleted`, 'success');
    }}
    onUpdateReceipt={async (updated) => {
      setReceipts(receipts.map(r => r.id === updated.id ? updated : r));
      const success = await FirebaseService.saveReceipt(updated);
      if (success) {
        showToast(`✓ Receipt updated`, 'success');
      }
    }}
    onAddClient={async (client) => {
      setClients([...clients, client]);
      const success = await FirebaseService.saveClient(client);
      if (success) {
        showToast(`✓ Client ${client.name} created`, 'success');
      } else {
        showToast(`⚠ Client may not have saved`, 'error');
      }
    }}
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
      const purityDecimal = parsePurity(item.purity);
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
      {/* Toast Notification - Bigger and more visible */}
      {toast && (
        <div className={`fixed top-4 left-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl text-white font-bold text-center text-lg ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600 animate-pulse'
        }`}>
          {toast.message}
        </div>
      )}
      
      {/* Demo Mode Banner */}
      {demoMode && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <Zap size={16} />
            <span className="font-medium">Demo Mode</span>
            <span className="text-purple-200">- Your data is separate and will be cleared periodically</span>
          </div>
        </div>
      )}
      
      {/* Clean Header with Spot Prices */}
      <div className="bg-gradient-to-r from-amber-700 to-amber-800 text-white p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold">Stevens Estate Services</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => setView('tax')} className="p-2 hover:bg-amber-600 rounded" title="Tax & Mileage">
              <Car size={20} />
            </button>
            <button onClick={() => setView('dashboard')} className="p-2 hover:bg-amber-600 rounded" title="Dashboard">
              <BarChart3 size={20} />
            </button>
            <button onClick={() => setView('settings')} className="p-2 hover:bg-amber-600 rounded" title="Settings">
              <Settings size={20} />
            </button>
          </div>
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
        {/* Collapsible Inventory List */}
        <details 
          open={inventoryListExpanded} 
          onToggle={(e) => setInventoryListExpanded(e.target.open)} 
          className="bg-white rounded-xl shadow-lg overflow-hidden"
        >
          <summary className="p-3 cursor-pointer bg-gradient-to-r from-amber-600 to-amber-700 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Package size={20} />
              <span className="font-bold">Inventory</span>
              <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-sm">
                {filteredInventory.length} items
              </span>
            </div>
            <div className="flex items-center gap-2">
              {kpiFilter && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  kpiFilter === 'stash' ? 'bg-amber-200 text-amber-800' :
                  kpiFilter === 'hold' ? 'bg-blue-200 text-blue-800' :
                  kpiFilter === 'sell' ? 'bg-green-200 text-green-800' :
                  kpiFilter === 'sold' ? 'bg-green-200 text-green-800' :
                  kpiFilter === 'silver' ? 'bg-gray-200 text-gray-800' :
                  kpiFilter === 'gold' ? 'bg-yellow-200 text-yellow-800' :
                  kpiFilter === 'platinum' ? 'bg-gray-300 text-gray-800' :
                  'bg-gray-200 text-gray-800'
                }`}>
                  {kpiFilter.charAt(0).toUpperCase() + kpiFilter.slice(1)}
                </span>
              )}
              <ChevronDown size={20} className={`transform transition-transform ${inventoryListExpanded ? 'rotate-180' : ''}`} />
            </div>
          </summary>
          
          <div className="p-3">
            {/* Search, Filter, and View Toggle */}
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
              {/* View Toggle */}
              <div className="flex border rounded-lg overflow-hidden">
                <button 
                  onClick={() => setInventoryViewMode('list')}
                  className={`px-3 py-2 ${inventoryViewMode === 'list' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600'}`}
                  title="List View"
                >
                  <Package size={18} />
                </button>
                <button 
                  onClick={() => setInventoryViewMode('grid')}
                  className={`px-3 py-2 ${inventoryViewMode === 'grid' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600'}`}
                  title="Grid View"
                >
                  <Layers size={18} />
                </button>
              </div>
            </div>
            
            {/* Filter badge and lots link */}
            <div className="flex justify-between items-center mb-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
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
                    Clear filter
                    <X size={12} />
                  </button>
                )}
              </div>
              {lots.filter(l => l.status !== 'sold' && l.status !== 'broken').length > 0 && (
                <button onClick={() => setView('lots')} className="text-purple-600 flex items-center gap-1">
                  <Layers size={14} /> {lots.filter(l => l.status !== 'sold' && l.status !== 'broken').length} Lots
                </button>
              )}
            </div>
            
            {/* Inventory Items - List or Grid View */}
            {inventoryViewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                {filteredInventory.map(item => {
                  const spot = liveSpotPrices?.[item.metalType?.toLowerCase()] || 0;
                  const purityDecimal = parsePurity(item.purity);
                  const currentMelt = (parseFloat(item.weightOz) || 0) * spot * purityDecimal;
                  const equity = currentMelt - (parseFloat(item.purchasePrice) || 0);
                  const equityPercent = item.purchasePrice > 0 ? (equity / item.purchasePrice * 100) : 0;
                  
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => { setSelectedItem(item); setView('detail'); }} 
                      className={`bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-all ${item.status === 'Sold' ? 'opacity-60' : ''}`}
                    >
                      {/* Photo */}
                      <div className="relative h-28 bg-gray-100">
                        {item.photo ? (
                          <img src={getPhotoSrc(item.photo)} className="w-full h-full object-cover" alt={item.description} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Camera size={32} />
                          </div>
                        )}
                        {/* Status Badge */}
                        <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                          item.status === 'Stash' ? 'bg-purple-500 text-white' :
                          item.status === 'Sold' ? 'bg-gray-500 text-white' :
                          item.status === 'Hold' ? 'bg-amber-500 text-white' :
                          'bg-green-500 text-white'
                        }`}>
                          {item.status === 'Available' ? 'Sell' : item.status}
                        </div>
                        {/* Metal Badge */}
                        <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                          item.metalType === 'Gold' ? 'bg-yellow-400 text-yellow-900' :
                          item.metalType === 'Platinum' ? 'bg-gray-300 text-gray-800' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          {item.metalType}
                        </div>
                      </div>
                      
                      {/* Info */}
                      <div className="p-2">
                        <div className="font-medium text-sm truncate">{item.description}</div>
                        <div className="text-xs text-gray-400">{item.id}</div>
                        
                        {/* Equity Display */}
                        <div className={`mt-2 p-2 rounded-lg ${equity >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Equity</span>
                            <span className={`font-bold text-sm ${equity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {equity >= 0 ? '+' : ''}${equity.toFixed(0)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">ROI</span>
                            <span className={equity >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {equityPercent >= 0 ? '+' : ''}{equityPercent.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        
                        {/* Cost & Value */}
                        <div className="mt-1 flex justify-between text-xs text-gray-500">
                          <span>Cost: ${item.purchasePrice}</span>
                          <span>Melt: ${currentMelt.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW */
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredInventory.map(item => {
                  const holdStatus = getHoldStatus(item);
                  const spot = liveSpotPrices?.[item.metalType?.toLowerCase()] || 0;
                  const purityDecimal = parsePurity(item.purity);
                  const currentMelt = (parseFloat(item.weightOz) || 0) * spot * purityDecimal;
                  const equity = currentMelt - (parseFloat(item.purchasePrice) || 0);
                  
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => { setSelectedItem(item); setView('detail'); }} 
                      className={`bg-gray-50 p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors ${item.status === 'Sold' ? 'opacity-60' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex gap-3">
                          {item.photo && (
                            <img src={getPhotoSrc(item.photo)} className="w-12 h-12 rounded object-cover" />
                          )}
                          <div>
                            <div className="font-medium">{item.description}</div>
                            <div className="text-xs text-gray-500">{item.id} • {item.category}</div>
                            <div className="flex gap-1 mt-1">
                              {item.status === 'Stash' && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Star size={10} /> Stash
                                </span>
                              )}
                              {item.status === 'Hold' && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Hold</span>
                              )}
                              {item.ebayListingId && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <ExternalLink size={10} /> eBay
                                </span>
                              )}
                              {item.status === 'Available' && (
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
                          <div className="font-bold text-amber-700">${currentMelt.toFixed(0)}</div>
                          <div className="text-xs text-gray-400">Cost: ${item.purchasePrice}</div>
                          <div className={`text-xs font-bold ${equity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {equity >= 0 ? '+' : ''}${equity.toFixed(0)} equity
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {filteredInventory.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Package size={48} className="mx-auto mb-2 opacity-50" />
                <p>No items found</p>
                {kpiFilter && <p className="text-sm">Try clearing your filter</p>}
              </div>
            )}
          </div>
        </details>
        
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
