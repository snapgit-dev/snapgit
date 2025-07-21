import { connectToDatabase } from '../../../utils/database'
import { TaskBackupModel } from '../../../models/TaskBackup'
import { SessionModel } from '../../../models/Session'
import { addJobToQueue } from '../../../utils/worker'

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
    
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Task ID is required'
      })
    }
    
    const task = await TaskBackupModel.findOne({ _id: id, userId: session.userId })
    if (!task) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Backup task not found'
      })
    }
    
    if (!task.isActive) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot execute inactive task'
      })
    }

    // Ajouter le job à la queue pour exécution immédiate
    const jobId = await addJobToQueue(id, true)

    return {
      success: true,
      message: `Tâche ${task.name} ajoutée à la queue pour exécution immédiate`,
      data: {
        taskId: id,
        jobId,
        taskName: task.name,
        status: 'queued'
      }
    }
    
  } catch (error: any) {
    console.error('Error executing backup task:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to execute backup task: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})