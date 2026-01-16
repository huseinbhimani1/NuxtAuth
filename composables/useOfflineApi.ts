/**
 * Composable for making API calls with offline support
 * Automatically caches responses and handles offline scenarios
 */

// Shared reactive state for online status (singleton pattern)
const onlineState = ref(true)
let isInitialized = false
let queueProcessor: (() => Promise<void>) | null = null

export const useOfflineApi = () => {
  const storage = useOfflineStorage()

  /**
   * Process queued actions when back online
   */
  const processQueuedActions = async () => {
    await storage.processQueue(async (action) => {
      try {
        console.log('Processing queued action:', action.url)
        await $fetch(action.url, action.options)
        console.log('Successfully synced:', action.url)
      } catch (error) {
        console.error('Failed to sync queued action:', error)
        throw error // Will keep in queue
      }
    })
  }

  // Store reference for event listener
  queueProcessor = processQueuedActions

  // Initialize online/offline listeners only once
  if (process.client && !isInitialized) {
    isInitialized = true
    onlineState.value = navigator.onLine

    window.addEventListener('online', () => {
      onlineState.value = true
      console.log('Back online! Processing queued actions...')
      // Process any queued actions
      if (queueProcessor) {
        queueProcessor()
      }
    })

    window.addEventListener('offline', () => {
      onlineState.value = false
      console.log('Gone offline. Data will be cached locally.')
    })
  }

  // Use computed to ensure reactivity
  const online = computed(() => onlineState.value)

  /**
   * Fetch data with offline support
   */
  const fetchWithCache = async <T>(
    url: string,
    options: any = {},
    cacheKey?: string
  ): Promise<T | null> => {
    const key = cacheKey || url

    try {
      // Try to fetch from API first (network-first strategy)
      const data = await $fetch<T>(url, options)
      
      // Cache the successful response
      await storage.save(key, data, { ttl: 300 }) // Cache for 5 minutes
      
      return data
    } catch (error: any) {
      console.warn('API call failed, trying cache...', error.message)
      
      // If fetch fails, try to get from cache
      const cached = await storage.get<T>(key)
      
      if (cached) {
        console.log('Serving from cache:', key)
        return cached
      }
      
      // No cache available
      throw error
    }
  }

  /**
   * Update data with offline queueing
   */
  const updateWithQueue = async <T>(
    url: string,
    data: any,
    options: any = {}
  ): Promise<{ success: boolean; queued?: boolean }> => {
    const requestOptions = {
      ...options,
      method: options.method || 'PUT',
      body: data
    }

    if (!online.value) {
      // Queue the request for later
      console.log('Offline: Queueing request for later')
      await storage.queueAction({
        url,
        data,
        options: requestOptions
      })
      
      // Update local cache optimistically
      await storage.save(url, data)
      
      return { success: true, queued: true }
    }

    try {
      const response = await $fetch<T>(url, requestOptions)
      
      // Update cache with new data
      await storage.save(url, response)
      
      return { success: true }
    } catch (error: any) {
      console.error('Update failed:', error.message)
      
      // Queue for retry
      await storage.queueAction({
        url,
        data,
        options: requestOptions
      })
      
      return { success: false, queued: true }
    }
  }

  /**
   * Get profile with offline support
   */
  const getProfile = async () => {
    return await fetchWithCache('/api/public/profile', {}, 'user-profile')
  }

  /**
   * Update profile with offline support
   */
  const updateProfile = async (profileData: any) => {
    return await updateWithQueue('/api/public/profile', profileData, {
      method: 'PUT'
    })
  }

  return {
    online,
    fetchWithCache,
    updateWithQueue,
    processQueuedActions,
    getProfile,
    updateProfile
  }
}
