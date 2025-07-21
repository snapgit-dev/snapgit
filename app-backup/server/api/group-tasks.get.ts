import { GroupTaskModel } from '../models/GroupTask'
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

    // Récupérer toutes les GroupTasks pour cet utilisateur
    const groupTasks = await GroupTaskModel.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .limit(20) // Limiter aux 20 plus récentes

    return {
      success: true,
      data: groupTasks.map((task: any) => ({
        id: task._id,
        name: task.name,
        description: task.description,
        repositoriesCount: task.taskIds ? task.taskIds.length : 0,
        s3FolderPath: task.s3FolderPath,
        lastStatus: task.lastStatus,
        lastRun: task.lastRun,
        lastError: task.lastError,
        executionMode: task.executionMode,
        executeImmediately: task.executeImmediately,
        createdAt: task.createdAt,
        taskIds: task.taskIds || []
      }))
    }
  } catch (error: any) {
    console.error('Error getting group tasks:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to get group tasks'
    })
  }
})
