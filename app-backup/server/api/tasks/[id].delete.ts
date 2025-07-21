import { connectToDatabase } from '../../utils/database'
import { TaskBackupModel } from '../../models/TaskBackup'
import { SessionModel } from '../../models/Session'

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
    
    await TaskBackupModel.deleteOne({ _id: id, userId: session.userId })
    
    return { 
      success: true, 
      message: 'Backup task deleted successfully',
      deletedTask: {
        id: task._id,
        name: task.name
      }
    }
  } catch (error) {
    console.error('Error deleting backup task:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to delete backup task: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})