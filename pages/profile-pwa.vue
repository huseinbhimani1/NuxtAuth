<!-- PWA-enabled Profile Page -->
<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <!-- Online/Offline Indicator -->
    <div 
      class="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg transition-all"
      :class="online ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'"
    >
      <div class="flex items-center space-x-2">
        <div class="w-2 h-2 rounded-full" :class="online ? 'bg-white' : 'bg-white animate-pulse'"></div>
        <span class="text-sm font-medium">{{ online ? 'Online' : 'Offline' }}</span>
      </div>
    </div>

    <div class="max-w-2xl mx-auto">
      <!-- Header -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Profile (PWA)</h1>
            <p class="text-gray-600 mt-1">Works offline & saves locally</p>
          </div>
          <div class="text-4xl">👤</div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-lg shadow-md p-8">
        <div class="flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span class="ml-3 text-gray-600">Loading...</span>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error && !profile" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <span class="text-red-700">{{ error }}</span>
        </div>
      </div>

      <!-- Profile Content -->
      <div v-if="profile" class="bg-white rounded-lg shadow-md p-6">
        <!-- Queued Changes Banner with Sync Button -->
        <div v-if="hasQueuedChanges" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <span class="text-yellow-800">Changes saved locally.</span>
            </div>
            <button
              v-if="online"
              @click="handleSync"
              :disabled="syncing"
              class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition flex items-center text-sm"
            >
              <svg v-if="syncing" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {{ syncing ? 'Syncing...' : 'Sync Now' }}
            </button>
            <span v-else class="text-yellow-600 text-sm">Go online to sync</span>
          </div>
        </div>

        <form @submit.prevent="handleSave" class="space-y-6">
          <!-- Name Field -->
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              id="name"
              v-model="formData.name"
              type="text"
              required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your name"
            />
          </div>

          <!-- Email Field -->
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              v-model="formData.email"
              type="email"
              required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your email"
            />
          </div>

          <!-- Bio Field -->
          <div>
            <label for="bio" class="block text-sm font-medium text-gray-700 mb-2">
              Bio
            </label>
            <textarea
              id="bio"
              v-model="formData.bio"
              rows="4"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Tell us about yourself..."
              maxlength="500"
            ></textarea>
            <p class="mt-1 text-sm text-gray-500">
              {{ (formData.bio || '').length }}/500 characters
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="flex space-x-4">
            <button
              type="submit"
              :disabled="saving"
              class="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center"
            >
              <svg v-if="saving" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>

            <button
              type="button"
              @click="handleRefresh"
              :disabled="loading"
              class="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition"
            >
              Refresh
            </button>
          </div>

          <!-- Success Message -->
          <div v-if="successMessage" class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span class="text-green-700">{{ successMessage }}</span>
            </div>
          </div>
        </form>

        <!-- PWA Info -->
        <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 class="font-semibold text-blue-900 mb-2">🎯 PWA Features Active:</h3>
          <ul class="text-sm text-blue-800 space-y-1">
            <li>✅ Works offline - data cached locally</li>
            <li>✅ Installable on mobile home screen</li>
            <li>✅ Auto-syncs when back online</li>
            <li>✅ Fast loading with service worker</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth-guard']
})

const { online, getProfile, updateProfile, processQueuedActions, hasQueuedActions } = useOfflineApi()

const profile = ref<any>(null)
const formData = ref({
  name: '',
  email: '',
  bio: ''
})

const loading = ref(false)
const saving = ref(false)
const syncing = ref(false)
const error = ref('')
const successMessage = ref('')
const hasQueuedChanges = ref(false)

// Load profile on mount
onMounted(async () => {
  // Check for any queued changes from previous sessions
  hasQueuedChanges.value = await hasQueuedActions()
  await loadProfile()
})

const loadProfile = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const data: any = await getProfile()
    
    if (data) {
      profile.value = data
      formData.value = {
        name: data.user?.name || data.name || '',
        email: data.user?.email || data.email || '',
        bio: data.user?.bio || data.bio || ''
      }
      
      // Show indicator if we're offline
      if (!online.value) {
        successMessage.value = 'Loaded from local storage (offline)'
        setTimeout(() => {
          successMessage.value = ''
        }, 2000)
      }
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load profile'
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  saving.value = true
  successMessage.value = ''
  error.value = ''

  try {
    const result = await updateProfile(formData.value)
    
    if (result.queued) {
      successMessage.value = 'Saved locally! Will sync when online.'
      hasQueuedChanges.value = true
    } else if (result.success) {
      successMessage.value = 'Profile updated successfully!'
      hasQueuedChanges.value = false
    } else {
      error.value = 'Failed to update profile'
    }

    // Clear message after 3 seconds
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err: any) {
    error.value = err.message || 'Failed to save profile'
  } finally {
    saving.value = false
  }
}

const handleRefresh = async () => {
  // If offline, just show message - don't try to fetch from server
  if (!online.value) {
    successMessage.value = 'Cannot refresh while offline - showing cached data'
    setTimeout(() => {
      successMessage.value = ''
    }, 2000)
    return
  }
  
  await loadProfile()
  successMessage.value = 'Profile refreshed from server!'
  setTimeout(() => {
    successMessage.value = ''
  }, 2000)
}

const handleSync = async () => {
  syncing.value = true
  error.value = ''
  
  try {
    await processQueuedActions()
    hasQueuedChanges.value = false
    successMessage.value = 'Changes synced successfully!'
    // Reload profile to get server data
    await loadProfile()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err: any) {
    error.value = 'Failed to sync changes. Please try again.'
  } finally {
    syncing.value = false
    // Re-check queue status
    hasQueuedChanges.value = await hasQueuedActions()
  }
}

// Watch online status
watch(online, (isOnline) => {
  if (isOnline && hasQueuedChanges.value) {
    successMessage.value = 'Back online! Tap "Sync Now" to sync your changes.'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  }
})
</script>
