// middleware/auth-guard.ts - Consolidated authentication and authorization middleware  
// SUPPORTS OFFLINE-FIRST AUTHENTICATION
import { defineNuxtRouteMiddleware, navigateTo, createError } from '#app';
import { useAuthStore } from '~/stores/auth';
import { getCookie } from 'h3';
import type { OrgVerifyResponse } from '~/types/api';
import { apiGet } from '~/utils/api';
import { useOfflineAuth } from '~/composables/useOfflineAuth';
import { useOfflineApi } from '~/composables/useOfflineApi';

export default defineNuxtRouteMiddleware(async (to, from) => {
  const authStore = useAuthStore();
  
  // SERVER-SIDE: Skip auth check on server during offline scenarios
  // Let client-side handle authentication with cached data
  if (process.server) {
    const event = useNuxtApp().ssrContext?.event;
    if (event) {
      const sessionCookie = getCookie(event, 'auth_token');
      console.log('[Auth Guard] Server-side session cookie:', sessionCookie ? 'Found' : 'Not found');
      
      // If no cookie on server, allow render and let client-side check offline auth
      if (!sessionCookie) {
        console.log('⚠️ [Auth Guard] No server-side cookie - allowing client-side to handle auth');
        return; // Don't redirect on server, let client decide
      }
      
      // If cookie exists on server, continue with normal server-side auth
      // (This will be handled by the fetchUser call below)
    }
    return; // Always allow server-side render, client will handle redirects
  }

  // CLIENT-SIDE ONLY from here on
  const offlineAuth = useOfflineAuth();
  const { online } = useOfflineApi();

  // 1. SESSION VALIDATION - Ensure session cookie exists
  let sessionCookie;
  if (process.client) {
    // Client-side: Multiple methods to find the cookie
    console.log('[Auth Guard] All cookies:', typeof document !== 'undefined' ? document.cookie : 'No document');
    
    // Method 1: Direct document.cookie parsing
    if (typeof document !== 'undefined') {
      const cookieString = document.cookie;
      console.log('[Auth Guard] Cookie string:', cookieString);
      
      sessionCookie = cookieString
        .split('; ')
        .find((row) => row.startsWith('auth_token='))
        ?.split('=')[1];
      
      if (!sessionCookie) {
        // Try without semicolon space
        sessionCookie = cookieString
          .split(';')
          .find((row) => row.trim().startsWith('auth_token='))
          ?.split('=')[1];
      }
    }
    
    // Method 2: Use Nuxt's useCookie composable
    if (!sessionCookie) {
      try {
        const authCookie = useCookie('auth_token', { 
          default: () => null,
          httpOnly: false,
          secure: false,
          sameSite: 'lax'
        });
        sessionCookie = authCookie.value;
        console.log('[Auth Guard] useCookie result:', sessionCookie ? 'Found' : 'Not found');
      } catch (e) {
        console.warn('[Auth Guard] useCookie failed:', e);
      }
    }
    
    console.log('[Auth Guard] Client-side session cookie final result:', sessionCookie ? 'Found' : 'Not found');
  }

  // Add detailed logs for debugging
  console.log('[Auth Guard] Client-side execution');
  console.log('[Auth Guard] Retrieved session cookie:', sessionCookie);

  // OFFLINE-FIRST: If no cookie but we're on client-side, check cached auth
  if (!sessionCookie) {
    console.log('🔍 [Auth Guard] No session cookie - checking offline authentication');
    const offlineAuthResult = await offlineAuth.isAuthenticatedOffline();
    
    if (offlineAuthResult.authenticated && offlineAuthResult.user) {
      console.log('✅ [Auth Guard] User authenticated via offline cache:', offlineAuthResult.method);
      
      // Load cached user into auth store
      authStore.user = offlineAuthResult.user;
      authStore.loggedIn = true;
      
      // Allow access - user is authenticated offline
      return;
    }
    
    // No session cookie and no offline auth - redirect to login
    console.warn('[Auth Guard] Missing session cookie and no offline auth. Redirecting to login.');
    return navigateTo('/login?reason=missing_cookie');
  }

  console.log('[Auth Guard] Session cookie found:', sessionCookie);

  // 3. AUTHENTICATION - Ensure user is loaded and authenticated
  // OFFLINE-FIRST: If offline, use cached user data
  if (!online.value) {
    console.log('📡 [Auth Guard] System is OFFLINE - using cached authentication');
    
    const cachedUser = await offlineAuth.getCachedUserData();
    if (cachedUser) {
      console.log('✅ [Auth Guard] Using cached user data (offline mode)');
      authStore.user = cachedUser;
      authStore.loggedIn = true;
      // Skip server validation when offline
      return;
    } else {
      console.warn('❌ [Auth Guard] No cached user data available for offline mode');
      // Still try to fetch, might work if connectivity comes back
    }
  }

  // ONLINE: Normal authentication flow
  try {
    if (!authStore.user && !authStore.loading) {
      await authStore.fetchUser();
      
      // Cache user data for offline use (if online)
      if (online.value && authStore.user) {
        await offlineAuth.cacheUserData(authStore.user, sessionCookie);
      }
    }
    console.log('[Auth Guard] User data:', authStore.user);
  } catch (err) {
    console.warn('[Auth Guard] fetchUser failed:', err);
    
    // OFFLINE FALLBACK: If fetch failed due to network, try cached data
    const cachedUser = await offlineAuth.getCachedUserData();
    if (cachedUser) {
      console.log('✅ [Auth Guard] Using cached user data (fetch failed)');
      authStore.user = cachedUser;
      authStore.loggedIn = true;
      return;
    }
    
    return navigateTo('/login?reason=fetch_user_failed');
  }

  // Check if page is public (no auth required)
  const publicPages = ['/', '/login', '/register', '/forgot-password'];
  const isPublic = 
    publicPages.includes(to.path) ||
    to.path.startsWith('/verify-email') ||
    to.path.startsWith('/reset-password') ||
    to.path.startsWith('/accept-invite');

  // Redirect to login if not authenticated and not a public page
  if (!authStore.loggedIn && !isPublic) {
    console.warn('[Auth Guard] User not authenticated. Redirecting to login.');
    return navigateTo('/login?reason=not_authenticated');
  }

  // If not logged in but on public page, allow access
  if (!authStore.loggedIn && isPublic) {
    return;
  }

  // Role-based routing
  const userRole = authStore.user?.role;
  if (to.path === '/dashboard') {
    switch (userRole) {
      case 'employee':
      case 'guest':
        return; // Stay on dashboard (will redirect to /user)
      case 'super_admin':
        return navigateTo('/superadmin');
      case 'platform_admin':
        return navigateTo('/platform');
      case 'organization_admin':
      case 'manager':
        return navigateTo('/org/dashboard');
      default:
        return navigateTo('/login?reason=invalid_role');
    }
  }

  // 5. ROLE AUTHORIZATION - Check if user has required permissions
  
  // Get allowed roles from page meta (supports both legacy 'roles' array and new 'requiredRole' string)
  const allowedRoles = to.meta?.roles as string[] | undefined;
  const requiredRole = to.meta?.requiredRole as string | undefined;
  
  // If no role restrictions, allow access
  if (!allowedRoles && !requiredRole) {
    return;
  }

  // Ensure user has a role
  if (!userRole) {
    return navigateTo('/login');
  }

  // Check single required role
  if (requiredRole && userRole !== requiredRole) {
    return redirectToAppropriateArea(userRole);
  }

  // Check against allowed roles array
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return redirectToAppropriateArea(userRole);
  }

  // 6. ORGANIZATION ADMIN SPECIAL VERIFICATION
  // If user is organization_admin, ensure they have organization access
  if (userRole === 'organization_admin' && to.path.startsWith('/org')) {
    if (!authStore.user?.organizationId) {
      try {
        const response = await apiGet<OrgVerifyResponse>('/api/org/users/verify-admin');
        
        if (!response.success || !response.hasOrgAccess) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Not a member of any organization. Please contact support.'
          });
        }
      } catch (error) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Organization access verification failed. Please contact support.'
        });
      }
    }
  }
});

/**
 * Redirect user to their appropriate area based on role
 */
function redirectToAppropriateArea(userRole: string) {
  switch (userRole) {
    case 'super_admin':
      return navigateTo('/superadmin');
    case 'platform_admin':
      return navigateTo('/platform');
    case 'organization_admin':
    case 'manager':
      return navigateTo('/org/dashboard');
    case 'employee':
    case 'guest':
      return navigateTo('/user');
    default:
      return navigateTo('/login');
  }
}