import { connectToDatabase } from '../../utils/database'
import { TaskBackupModel } from '../../models/TaskBackup'
import { S3ConfigModel } from '../../models/S3'
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
    
    const body = await readBody(event)
    const { 
      name, 
      description, 
      cronExpression, 
      s3ConfigIds, 
      compressionLevel, 
      isActive 
    } = body
    
    const task = await TaskBackupModel.findOne({ _id: id, userId: session.userId })
    if (!task) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Backup task not found'
      })
    }
    
    // Validate cron expression if provided
    if (cronExpression !== undefined) {
      const cronRegex = /^(\*|[0-5]?\d)(\s+(\*|[01]?\d|2[0-3]))(\s+(\*|[12]?\d|3[01]))(\s+(\*|[1-9]|1[012]))(\s+(\*|[0-6]))$/
      if (!cronRegex.test(cronExpression)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid cron expression format'
        })
      }
    }
    
    // Validate S3 configs if provided
    if (s3ConfigIds !== undefined) {
      if (!Array.isArray(s3ConfigIds) || s3ConfigIds.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'S3 config IDs must be a non-empty array'
        })
      }
      
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
    }
    
    // Update fields
    if (name !== undefined) task.name = name
    if (description !== undefined) task.description = description
    if (cronExpression !== undefined) task.cronExpression = cronExpression
    if (s3ConfigIds !== undefined) task.s3ConfigIds = s3ConfigIds
    if (compressionLevel !== undefined) task.compressionLevel = compressionLevel
    if (isActive !== undefined) task.isActive = isActive
    
    await task.save()
    
    return task
  } catch (error) {
    console.error('Error updating backup task:', error)
    
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
      statusMessage: `Failed to update backup task: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})