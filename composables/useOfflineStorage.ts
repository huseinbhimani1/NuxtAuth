/**
 * Composable for offline-first data storage
 * Works with IndexedDB for persistent storage
 * Falls back gracefully if not available
 */

interface StorageOptions {
  ttl?: number // Time to live in seconds
}

export const useOfflineStorage = () => {
  const isSupported = ref(false)
  let db: IDBDatabase | null = null

  const initDB = async (): Promise<IDBDatabase | null> => {
    if (db) return db

    if (!process.client) return null

    // Check if IndexedDB is supported
    if (!('indexedDB' in window)) {
      console.warn('⚠️ IndexedDB not supported, will use localStorage')
      return null
    }

    try {
      console.log('🔧 Initializing IndexedDB...')
      const request = indexedDB.open('EaseMyCargoDB', 1)

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result
        console.log('📦 Creating object stores...')
        
        // Create object stores if they don't exist
        if (!database.objectStoreNames.contains('cache')) {
          database.createObjectStore('cache', { keyPath: 'key' })
          console.log('✅ Created "cache" store')
        }
        if (!database.objectStoreNames.contains('queue')) {
          database.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
          console.log('✅ Created "queue" store')
        }
      }

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          db = request.result
          isSupported.value = true
          console.log('✅ IndexedDB initialized successfully')
          resolve(db)
        }
        request.onerror = () => {
          console.error('❌ Failed to open IndexedDB:', request.error)
          reject(request.error)
        }
        request.onblocked = () => {
          console.warn('⚠️ IndexedDB upgrade blocked, close other tabs')
        }
      })
    } catch (error) {
      console.error('❌ IndexedDB initialization error:', error)
      return null
    }
  }

  /**
   * Save data to offline storage
   */
  const save = async <T>(key: string, value: T, options?: StorageOptions): Promise<boolean> => {
    try {
      const database = await initDB()
      if (!database) {
        // Fallback to localStorage
        if (process.client && window.localStorage) {
          console.log('📝 IndexedDB unavailable, using localStorage for:', key)
          localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now(), ttl: options?.ttl }))
          return true
        }
        console.error('❌ No storage available (IndexedDB and localStorage both failed)')
        return false
      }

      const transaction = database.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      
      // Serialize the value to ensure it's cloneable
      const serializedValue = JSON.parse(JSON.stringify(value))
      
      const data = {
        key,
        value: serializedValue,
        timestamp: Date.now(),
        ttl: options?.ttl
      }

      return new Promise((resolve, reject) => {
        const request = store.put(data)
        request.onsuccess = () => {
          console.log('✅ Saved to IndexedDB:', key)
          resolve(true)
        }
        request.onerror = () => {
          console.error('❌ IndexedDB save failed:', request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      console.error('Error saving to IndexedDB, trying localStorage fallback:', error)
      // Fallback to localStorage if IndexedDB fails
      try {
        if (process.client && window.localStorage) {
          localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now(), ttl: options?.ttl }))
          console.log('✅ Saved to localStorage (fallback):', key)
          return true
        }
      } catch (lsError) {
        console.error('❌ localStorage fallback also failed:', lsError)
      }
      return false
    }
  }

  /**
   * Get data from offline storage
   */
  const get = async <T>(key: string): Promise<T | null> => {
    try {
      const database = await initDB()
      if (!database) {
        // Fallback to localStorage
        if (process.client && window.localStorage) {
          const item = localStorage.getItem(key)
          if (item) {
            const parsed = JSON.parse(item)
            return parsed.value as T
          }
        }
        return null
      }

      const transaction = database.transaction(['cache'], 'readonly')
      const store = transaction.objectStore('cache')

      return new Promise((resolve, reject) => {
        const request = store.get(key)
        request.onsuccess = () => {
          const result = request.result
          if (!result) {
            resolve(null)
            return
          }

          // Check if data has expired
          if (result.ttl) {
            const age = (Date.now() - result.timestamp) / 1000
            if (age > result.ttl) {
              // Data expired, remove it
              remove(key)
              resolve(null)
              return
            }
          }

          resolve(result.value as T)
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error getting from offline storage:', error)
      return null
    }
  }

  /**
   * Remove data from offline storage
   */
  const remove = async (key: string): Promise<boolean> => {
    try {
      const database = await initDB()
      if (!database) {
        if (process.client && window.localStorage) {
          localStorage.removeItem(key)
          return true
        }
        return false
      }

      const transaction = database.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')

      return new Promise((resolve, reject) => {
        const request = store.delete(key)
        request.onsuccess = () => resolve(true)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error removing from offline storage:', error)
      return false
    }
  }

  /**
   * Clear all offline storage
   */
  const clear = async (): Promise<boolean> => {
    try {
      const database = await initDB()
      if (!database) {
        if (process.client && window.localStorage) {
          localStorage.clear()
          return true
        }
        return false
      }

      const transaction = database.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')

      return new Promise((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = () => resolve(true)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error clearing offline storage:', error)
      return false
    }
  }

  /**
   * Queue an action for later (when offline)
   */
  const queueAction = async (action: any): Promise<boolean> => {
    try {
      const database = await initDB()
      if (!database) return false

      const transaction = database.transaction(['queue'], 'readwrite')
      const store = transaction.objectStore('queue')

      // Serialize the entire action object to ensure it's cloneable
      const serializedAction = JSON.parse(JSON.stringify({ ...action, timestamp: Date.now() }))

      return new Promise((resolve, reject) => {
        const request = store.add(serializedAction)
        request.onsuccess = () => {
          console.log('✅ Action queued for sync')
          resolve(true)
        }
        request.onerror = () => {
          console.error('❌ Failed to queue action:', request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      console.error('❌ Error queueing action:', error)
      return false
    }
  }

  /**
   * Process queued actions (when back online)
   */
  const processQueue = async (processor: (action: any) => Promise<void>): Promise<void> => {
    try {
      const database = await initDB()
      if (!database) return

      const transaction = database.transaction(['queue'], 'readonly')
      const store = transaction.objectStore('queue')

      return new Promise((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = async () => {
          const actions = request.result
          for (const action of actions) {
            try {
              await processor(action)
              // Remove from queue after successful processing
              const deleteTransaction = database.transaction(['queue'], 'readwrite')
              const deleteStore = deleteTransaction.objectStore('queue')
              deleteStore.delete(action.id)
            } catch (error) {
              console.error('Error processing queued action:', error)
            }
          }
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error processing queue:', error)
    }
  }

  /**
   * Check if there are queued actions
   */
  const hasQueuedActions = async (): Promise<boolean> => {
    try {
      const database = await initDB()
      if (!database) return false

      const transaction = database.transaction(['queue'], 'readonly')
      const store = transaction.objectStore('queue')

      return new Promise((resolve) => {
        const request = store.count()
        request.onsuccess = () => {
          resolve(request.result > 0)
        }
        request.onerror = () => resolve(false)
      })
    } catch (error) {
      console.error('Error checking queue:', error)
      return false
    }
  }

  return {
    isSupported,
    save,
    get,
    remove,
    clear,
    queueAction,
    processQueue,
    hasQueuedActions
  }
}
