/**
 * Composable for making API calls with offline support
 * Automatically caches responses and handles offline scenarios
 */

// Shared reactive state for online status (singleton pattern)
const onlineState = ref(true)
let isInitialized = false
let queueProcessor: (() => Promise<void>) | null = null
let connectivityCheckInterval: NodeJS.Timeout | null = null

export const useOfflineApi = () => {
  const storage = useOfflineStorage()

  /**
   * Check actual internet connectivity (not just network interface)
   */
  const checkConnectivity = async (): Promise<boolean> => {
    if (!navigator.onLine) {
      return false
    }
    
    try {
      // Try to fetch a small resource with no-cache to test real connectivity
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      return true
    } catch (error) {
      console.log('⚠️ Connectivity check failed, treating as offline')
      return false
    }
  }

  /**
   * Update online status with connectivity check
   */
  const updateOnlineStatus = async () => {
    const isConnected = await checkConnectivity()
    if (onlineState.value !== isConnected) {
      onlineState.value = isConnected
      console.log(isConnected ? '✅ Connected to internet' : '❌ No internet connection')
    }
  }

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
    
    // Initial check
    checkConnectivity().then(isConnected => {
      onlineState.value = isConnected
      console.log('🔍 Initial connectivity:', isConnected ? 'Online' : 'Offline')
    })

    // Listen to browser events
    window.addEventListener('online', async () => {
      console.log('📡 Network interface connected, verifying internet...')
      await updateOnlineStatus()
    })

    window.addEventListener('offline', () => {
      onlineState.value = false
      console.log('📡 Network interface disconnected')
    })
    
    // Periodic connectivity check (every 10 seconds)
    connectivityCheckInterval = setInterval(updateOnlineStatus, 10000)
  }

  // Use computed to ensure reactivity
  const online = computed(() => onlineState.value)

  /**
   * Fetch data with offline support
   * Uses cache-first strategy when offline, network-first when online
   */
  const fetchWithCache = async <T>(
    url: string,
    options: any = {},
    cacheKey?: string
  ): Promise<T | null> => {
    const key = cacheKey || url

    // If offline, use cache-first strategy
    if (!online.value) {
      console.log('Offline: Loading from cache...', key)
      const cached = await storage.get<T>(key)
      
      if (cached) {
        console.log('Serving from cache (offline):', key)
        return cached
      }
      
      console.warn('No cached data available for:', key)
      throw new Error('You are offline and no cached data is available')
    }

    // Online: Try network first, fallback to cache
    try {
      console.log('Online: Fetching from API...', url)
      const data = await $fetch<T>(url, options)
      
      // Cache the successful response (24 hours TTL for better offline support)
      await storage.save(key, data, { ttl: 86400 })
      
      return data
    } catch (error: any) {
      console.warn('API call failed, trying cache...', error.message)
      
      // If fetch fails, try to get from cache
      const cached = await storage.get<T>(key)
      
      if (cached) {
        console.log('Serving from cache (API failed):', key)
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
    options: any = {},
    cacheKey?: string
  ): Promise<{ success: boolean; queued?: boolean }> => {
    const key = cacheKey || url
    const requestOptions = {
      ...options,
      method: options.method || 'PUT',
      body: data
    }

    if (!online.value) {
      // Queue the request for later
      console.log('Offline: Queueing request for later')
      
      // Convert to plain object to avoid "could not be cloned" error
      const plainData = JSON.parse(JSON.stringify(data))
      
      await storage.queueAction({
        url,
        data: plainData,
        options: requestOptions,
        cacheKey: key
      })
      
      // Update local cache optimistically with correct structure matching API response
      await storage.save(key, {
        user: plainData,
        success: true,
        message: 'Changes saved locally (offline mode)'
      }, { ttl: 86400 })
      
      return { success: true, queued: true }
    }

    try {
      const response = await $fetch<T>(url, requestOptions)
      
      // Update cache with new data using consistent cache key
      await storage.save(key, response, { ttl: 86400 })
      
      return { success: true }
    } catch (error: any) {
      console.error('Update failed:', error.message)
      
      // Queue for retry
      const plainData = JSON.parse(JSON.stringify(data))
      
      await storage.queueAction({
        url,
        data: plainData,
        options: requestOptions,
        cacheKey: key
      })
      
      // Save optimistically to cache with correct structure
      await storage.save(key, {
        user: plainData,
        success: true,
        message: 'Changes saved locally (will retry)'
      }, { ttl: 86400 })
      
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
    }, 'user-profile') // Use same cache key as getProfile
  }

  /**
   * Check if there are queued actions pending
   */
  const hasQueuedActions = async (): Promise<boolean> => {
    return await storage.hasQueuedActions()
  }

  return {
    online,
    fetchWithCache,
    updateWithQueue,
    processQueuedActions,
    hasQueuedActions,
    getProfile,
    updateProfile
  }
}
