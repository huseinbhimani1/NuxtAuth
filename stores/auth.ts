// stores/auth.ts
import { defineStore } from 'pinia';

type UserRole = 'super_admin' | 'platform_admin' | 'organization_admin' | 'manager' | 'employee' | 'guest';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  platformId?: string;
}

interface AuthState {
  user: User | null;
  loggedIn: boolean;
  loading: boolean;
}

function normalizeRole(role: string): UserRole {
  const r = role?.toLowerCase().trim();
  if (r === 'super_admin' || r === 'platform_admin' || r === 'organization_admin' || r === 'manager' || r === 'employee' || r === 'guest') {
    return r;
  }
  return 'guest'; // fallback to most restricted role
}


export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    loggedIn: false,
    loading: false,
  }),

  getters: {
    isEmployee: (state): boolean => state.user?.role === 'employee',
    isManager: (state): boolean => state.user?.role === 'manager',
    isGuest: (state): boolean => state.user?.role === 'guest',
    isSuperAdmin: (state): boolean => state.user?.role === 'super_admin',
    isOrgAdmin: (state): boolean => state.user?.role === 'organization_admin',
    isPlatformAdmin: (state): boolean => state.user?.role === 'platform_admin',
    isAdmin: (state): boolean =>
      ['super_admin', 'platform_admin', 'organization_admin'].includes(state.user?.role ?? ''),
    userRole: (state): UserRole | null => state.user?.role ?? null,
    userOrgId: (state): string | null => state.user?.organizationId ?? null,
    userPlatformId: (state): string | null => state.user?.platformId ?? null,
  },

  actions: {
    async fetchUser() {
      this.loading = true;
      try {
        const headers = process.server ? useRequestHeaders(['cookie']) : undefined;

        const data = await $fetch('/api/auth/user', {
          credentials: 'include',
          headers,
        });

        if (data && data.user) {
          (data.user as any).role = normalizeRole((data.user as any).role);
          this.user = data.user as User;
          this.loggedIn = true;
          
          // Cache user data for offline use
          if (process.client) {
            const { useOfflineAuth } = await import('~/composables/useOfflineAuth');
            const offlineAuth = useOfflineAuth();
            await offlineAuth.cacheUserData(this.user);
          }
        } else {
          this.user = null;
          this.loggedIn = false;
        }
      } catch (error: any) {
        if (error?.statusCode === 401) {
          this.user = null;
          this.loggedIn = false;
        } else {
          console.error('Error fetching user:', error);
          this.user = null;
          this.loggedIn = false;
        }
      } finally {
        this.loading = false;
      }
    },

    async login(email: string, password: string): Promise<boolean> {
      this.loading = true;
      try {
        const response = await $fetch('/api/auth/login', {
          method: 'POST',
          body: { email, password },
          credentials: 'include',
        });

        if (response && response.user) {
          (response.user as any).role = normalizeRole((response.user as any).role);
          this.user = response.user as User;
          this.loggedIn = true;
          
          // Cache user data and token for offline use
          if (process.client) {
            const { useOfflineAuth } = await import('~/composables/useOfflineAuth');
            const offlineAuth = useOfflineAuth();
            const token = offlineAuth.getTokenFromCookie();
            await offlineAuth.cacheUserData(this.user, token || undefined);
          }
          
          return true;
        }

        return false;
      } catch (error: any) {
        console.error('Login error:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      this.loading = true;
      try {
        await $fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });

        this.user = null;
        this.loggedIn = false;
        
        // Clear offline auth cache
        if (process.client) {
          const { useOfflineAuth } = await import('~/composables/useOfflineAuth');
          const offlineAuth = useOfflineAuth();
          await offlineAuth.clearAuthCache();
        }
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        this.loading = false;
      }
    },

    canAccessOrg(orgId: string): boolean {
      if (this.isAdmin || this.isSuperAdmin) return true;
      return this.user?.organizationId === orgId;
    },
  },
});
