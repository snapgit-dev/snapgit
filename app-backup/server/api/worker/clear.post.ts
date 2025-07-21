import { clearCompletedJobs } from '../../utils/worker'
import { SessionModel } from '../../models/Session'
import { connectToDatabase } from '../../utils/database'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()
    
    // Vérification de l'authentification
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

    // Nettoyer les jobs terminés
    clearCompletedJobs()

    return {
      success: true,
      message: 'Completed jobs cleared'
    }
  } catch (error: any) {
    console.error('Error clearing completed jobs:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to clear completed jobs'
    })
  }
})
