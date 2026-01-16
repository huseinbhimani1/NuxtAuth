// Public profile API - handles GET and PUT requests
import User from '../../models/User'
import { getUserFromEvent } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const method = event.method
  
  // Try to get the authenticated user from JWT token
  const authUser = await getUserFromEvent(event)
  const userId = authUser?.id

  if (method === 'GET') {
    // Get profile
    try {
      if (userId) {
        const user = await User.findById(userId).select('-password -verificationToken -resetPasswordToken')
        
        if (user) {
          return {
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              bio: user.bio || '',
              role: user.role,
              createdAt: user.createdAt
            },
            success: true
          }
        }
      }
      
      // Return demo data if not authenticated
      return {
        user: {
          name: "Demo User",
          email: "demo@easemycargo.com", 
          bio: "This is a public demo profile for testing PWA features without authentication.",
          createdAt: new Date().toISOString(),
          role: "demo"
        },
        success: true
      }
    } catch (error: any) {
      return {
        user: {
          name: "Demo User",
          email: "demo@easemycargo.com", 
          bio: "This is a public demo profile for testing PWA features.",
          createdAt: new Date().toISOString(),
          role: "demo"
        },
        success: true
      }
    }
  }

  if (method === 'PUT') {
    // Update profile
    try {
      const body = await readBody(event)
      const { name, email, bio } = body
      
      if (userId) {
        // Update authenticated user
        const user = await User.findByIdAndUpdate(
          userId,
          { 
            name,
            email,
            bio 
          },
          { new: true, runValidators: true }
        ).select('-password -verificationToken -resetPasswordToken')
        
        if (user) {
          return {
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              bio: user.bio || '',
              role: user.role,
              updatedAt: user.updatedAt
            },
            success: true,
            message: 'Profile updated successfully'
          }
        }
      }
      
      // For demo users (not authenticated), just return success
      // This allows PWA to work and save locally without authentication
      return {
        user: {
          name,
          email,
          bio,
          updatedAt: new Date().toISOString(),
          role: "demo"
        },
        success: true,
        message: 'Changes saved locally (demo mode)'
      }
    } catch (error: any) {
      console.error('Profile update error:', error)
      return {
        success: false,
        message: error.message || 'Failed to update profile'
      }
    }
  }

  // Method not allowed
  throw createError({
    statusCode: 405,
    message: 'Method not allowed'
  })
})