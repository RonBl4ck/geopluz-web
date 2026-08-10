// lib/dbCache.js
// Utilidad de Caché local con IndexedDB para evitar solicitudes excesivas a Supabase

const DB_NAME = 'GeoPluzCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'geopluz_store';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function getFromCache(key) {
  try {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Error leyendo de IndexedDB:', err);
    return null;
  }
}

export async function saveToCache(key, data) {
  try {
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ data, timestamp: Date.now() }, key);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn('Error guardando en IndexedDB:', err);
  }
}

export async function clearCache(key) {
  try {
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      if (key) {
        store.delete(key);
      } else {
        store.clear();
      }
      transaction.oncomplete = () => resolve(true);
    });
  } catch (err) {
    console.warn('Error limpiando IndexedDB:', err);
  }
}

// Funciones helpers específicas para SEDS y Llaves
const SEDS_CACHE_KEY = 'seds_database';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 12; // 12 Horas de Caché

export async function getCachedSeds(maxAgeMs = DEFAULT_TTL_MS) {
  const cached = await getFromCache(SEDS_CACHE_KEY);
  if (!cached || !cached.timestamp || !cached.data) return null;
  const isExpired = Date.now() - cached.timestamp > maxAgeMs;
  if (isExpired) return null;
  return cached.data;
}

export async function setCachedSeds(dbData) {
  await saveToCache(SEDS_CACHE_KEY, dbData);
}

export async function invalidateSedsCache() {
  await clearCache(SEDS_CACHE_KEY);
}
