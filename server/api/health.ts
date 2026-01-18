// Simple health check endpoint for connectivity testing
export default defineEventHandler(() => {
  return { status: 'ok', timestamp: Date.now() }
})
