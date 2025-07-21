import { connectToDatabase } from '../utils/database'
import { TaskBackupModel } from '../models/TaskBackup'
import { S3ConfigModel } from '../models/S3'
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
    
    const body = await readBody(event)
    const { 
      name, 
      description, 
      cronExpression, 
      s3ConfigIds, 
      compressionLevel, 
      isActive 
    } = body
    
    if (!name || !cronExpression || !s3ConfigIds || !Array.isArray(s3ConfigIds) || s3ConfigIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: name, cronExpression, s3ConfigIds'
      })
    }
    
    // Validate cron expression format
    const cronRegex = /^(\*|[0-5]?\d)(\s+(\*|[01]?\d|2[0-3]))(\s+(\*|[12]?\d|3[01]))(\s+(\*|[1-9]|1[012]))(\s+(\*|[0-6]))$/
    if (!cronRegex.test(cronExpression)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid cron expression format'
      })
    }
    
    // Verify that all S3 configs belong to the user
    const s3Configs = await S3ConfigModel.find({
      _id: { $in: s3ConfigIds },
      userId: session.userId
    })
    
    if (s3Configs.length !== s3ConfigIds.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'One or more S3 configurations not found or not accessible'
      })
    }
    
    const taskBackup = new TaskBackupModel({
      userId: session.userId,
      name,
      description,
      cronExpression,
      s3ConfigIds,
      compressionLevel: compressionLevel || 9,
      isActive: isActive !== false
    })
    
    await taskBackup.save()
    
    return taskBackup
  } catch (error) {
    console.error('Error creating backup task:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    if (error.code === 11000) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Backup task with this name already exists'
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create backup task: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})