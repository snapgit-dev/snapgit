import { connectToDatabase } from '../../utils/database'
import { SessionModel } from '../../models/Session'

// In a real application, you'd store backup status in a database or cache
// For now, we'll return a simple status response
export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()
    
    const sessionToken = getCookie(event, 'session')
    if (!sessionToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'No session found'
      })
    }
    
    const session = await SessionModel.findOne({ sessionToken })
    if (!session || session.expires < new Date()) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Session expired'
      })
    }
    
    // This is a placeholder - in a real app you'd check actual backup status
    return {
      userId: session.userId,
      status: 'ready', // 'ready', 'running', 'error', 'complete'
      message: 'No backup currently running',
      lastBackup: null,
      nextBackup: null
    }
    
  } catch (error) {
    console.error('Error checking backup status:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to check backup status: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})