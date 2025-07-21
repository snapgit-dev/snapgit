import { connectToDatabase } from '../utils/database'
import { TaskBackupModel } from '../models/TaskBackup'
import { SessionModel } from '../models/Session'

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
    
    const tasks = await TaskBackupModel.find({ userId: session.userId })
      .populate('s3ConfigIds', 'name endpoint bucket')
      .sort({ createdAt: -1 })
    
    return tasks
  } catch (error) {
    console.error('Error fetching backup tasks:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch backup tasks: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})