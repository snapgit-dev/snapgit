import { S3ConfigModel } from '../models/S3'
import { SessionModel } from '../models/Session'
import { connectToDatabase } from '../utils/database'

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
    
    // Récupérer toutes les configurations S3 pour cet utilisateur
    const configs = await S3ConfigModel.find({ userId: session.userId }).sort({ createdAt: -1 })

    return {
      success: true,
      data: configs.map(config => config.toSafeObject()) // Retire les clés d'accès
    }
  } catch (error: any) {
    console.error('Erreur lors de la récupération des configurations S3:', error)
    
    // Gérer les erreurs d'auth
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Erreur interne du serveur'
    })
  }
})
