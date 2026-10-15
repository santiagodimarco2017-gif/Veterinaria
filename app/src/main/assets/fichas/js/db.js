// db.js — capa de persistencia local (IndexedDB) offline-first.
'use strict';

const DB = (() => {
  const DB_NAME = 'ficha-clinica-fcv';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('patients')) {
          db.createObjectStore('patients', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('fichas')) {
          const store = db.createObjectStore('fichas', { keyPath: 'id' });
          store.createIndex('patientId', 'patientId', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return open().then(db => db.transaction(storeName, mode).objectStore(storeName));
  }

  function put(storeName, value) {
    return tx(storeName, 'readwrite').then(store => new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = (e) => reject(e.target.error);
    }));
  }

  function get(storeName, key) {
    return tx(storeName, 'readonly').then(store => new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    }));
  }

  function getAll(storeName) {
    return tx(storeName, 'readonly').then(store => new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    }));
  }

  function getAllByIndex(storeName, indexName, value) {
    return tx(storeName, 'readonly').then(store => new Promise((resolve, reject) => {
      const req = store.index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    }));
  }

  function remove(storeName, key) {
    return tx(storeName, 'readwrite').then(store => new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    }));
  }

  return {
    patients: {
      put: (p) => put('patients', p),
      get: (id) => get('patients', id),
      getAll: () => getAll('patients'),
      remove: (id) => remove('patients', id),
    },
    fichas: {
      put: (f) => put('fichas', f),
      get: (id) => get('fichas', id),
      getAll: () => getAll('fichas'),
      getByPatient: (patientId) => getAllByIndex('fichas', 'patientId', patientId),
      remove: (id) => remove('fichas', id),
    },
    settings: {
      put: (key, value) => put('settings', { key, value }),
      get: (key) => get('settings', key).then(r => r ? r.value : undefined),
    },
  };
})();
