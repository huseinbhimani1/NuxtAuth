// composables/useOfflineAuth.ts
// Offline-first authentication system
// Caches user data locally and allows authentication to work offline

import { useOfflineStorage } from './useOfflineStorage';

export const useOfflineAuth = () => {
  const storage = useOfflineStorage();
  const AUTH_CACHE_KEY = 'auth_user_data';
  const AUTH_TOKEN_KEY = 'auth_token_cache';

  /**
   * Cache user data locally for offline access
   */
  const cacheUserData = async (user: any, token?: string) => {
    try {
      console.log('📦 [Offline Auth] Caching user data:', user?.email);
      
      // Store user data
      await storage.save(AUTH_CACHE_KEY, user);
      
      // Store token if provided
      if (token) {
        await storage.save(AUTH_TOKEN_KEY, token);
      }
      
      console.log('✅ [Offline Auth] User data cached successfully');
      return true;
    } catch (error) {
      console.error('❌ [Offline Auth] Failed to cache user data:', error);
      return false;
    }
  };

  /**
   * Get cached user data (for offline use)
   */
  const getCachedUserData = async () => {
    try {
      console.log('🔍 [Offline Auth] Retrieving cached user data');
      const userData = await storage.get(AUTH_CACHE_KEY);
      
      if (userData) {
        console.log('✅ [Offline Auth] Found cached user:', userData?.email);
        return userData;
      }
      
      console.log('⚠️ [Offline Auth] No cached user data found');
      return null;
    } catch (error) {
      console.error('❌ [Offline Auth] Failed to get cached user data:', error);
      return null;
    }
  };

  /**
   * Get cached token
   */
  const getCachedToken = async () => {
    try {
      const token = await storage.get(AUTH_TOKEN_KEY);
      return token || null;
    } catch (error) {
      console.error('❌ [Offline Auth] Failed to get cached token:', error);
      return null;
    }
  };

  /**
   * Clear cached auth data (on logout)
   */
  const clearAuthCache = async () => {
    try {
      console.log('🧹 [Offline Auth] Clearing cached auth data');
      await storage.remove(AUTH_CACHE_KEY);
      await storage.remove(AUTH_TOKEN_KEY);
      console.log('✅ [Offline Auth] Auth cache cleared');
      return true;
    } catch (error) {
      console.error('❌ [Offline Auth] Failed to clear auth cache:', error);
      return false;
    }
  };

  /**
   * Verify if token is valid (without server call)
   * Basic check: decode JWT and verify expiration
   */
  const verifyTokenOffline = (token: string): boolean => {
    try {
      // Decode JWT (format: header.payload.signature)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('⚠️ [Offline Auth] Invalid token format');
        return false;
      }

      // Decode payload
      const payload = JSON.parse(atob(parts[1]));
      
      // Check expiration
      if (payload.exp) {
        const expirationDate = new Date(payload.exp * 1000);
        const now = new Date();
        
        if (now >= expirationDate) {
          console.warn('⚠️ [Offline Auth] Token expired');
          return false;
        }
      }

      console.log('✅ [Offline Auth] Token valid (offline check)');
      return true;
    } catch (error) {
      console.error('❌ [Offline Auth] Token verification failed:', error);
      return false;
    }
  };

  /**
   * Get token from cookie (client-side)
   */
  const getTokenFromCookie = (): string | null => {
    if (typeof document === 'undefined') {
      return null;
    }

    const cookieString = document.cookie;
    const match = cookieString
      .split('; ')
      .find((row) => row.startsWith('auth_token='));
    
    return match ? match.split('=')[1] : null;
  };

  /**
   * Check if user is authenticated (offline-first)
   * Priority:
   * 1. Try cookie token + offline verification
   * 2. Fall back to cached user data
   */
  const isAuthenticatedOffline = async (): Promise<{
    authenticated: boolean;
    user: any | null;
    method: 'token' | 'cache' | 'none';
  }> => {
    // Try cookie token first
    const token = getTokenFromCookie();
    
    if (token && verifyTokenOffline(token)) {
      // Token exists and is valid
      const cachedUser = await getCachedUserData();
      
      if (cachedUser) {
        console.log('✅ [Offline Auth] Authenticated via cached token + user data');
        return {
          authenticated: true,
          user: cachedUser,
          method: 'token'
        };
      }
    }

    // Fall back to cached user data only
    const cachedUser = await getCachedUserData();
    if (cachedUser) {
      console.log('✅ [Offline Auth] Authenticated via cached user data only');
      return {
        authenticated: true,
        user: cachedUser,
        method: 'cache'
      };
    }

    console.log('❌ [Offline Auth] Not authenticated (no valid token or cache)');
    return {
      authenticated: false,
      user: null,
      method: 'none'
    };
  };

  return {
    cacheUserData,
    getCachedUserData,
    getCachedToken,
    clearAuthCache,
    verifyTokenOffline,
    getTokenFromCookie,
    isAuthenticatedOffline
  };
};
