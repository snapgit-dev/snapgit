import { connectToDatabase } from '../utils/database'
import { SessionModel } from '../models/Session'
import { BackupService, BackupOptions } from '../utils/backup'

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
    const { s3ConfigIds, compressionLevel } = body
    
    const backupOptions: BackupOptions = {
      userId: session.userId,
      s3ConfigIds,
      compressionLevel: compressionLevel || 9
    }
    
    // Start backup in background (non-blocking)
    const backupService = new BackupService((progress) => {
      // Here you could implement real-time progress updates via WebSocket or SSE
      console.log(`Backup progress for user ${session.userId}:`, progress)
    })
    
    // Don't await - let it run in background
    backupService.startBackup(backupOptions).catch(error => {
      console.error(`Background backup failed for user ${session.userId}:`, error)
    })
    
    return {
      success: true,
      message: 'Backup started successfully',
      options: backupOptions
    }
    
  } catch (error) {
    console.error('Error starting backup:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to start backup: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})