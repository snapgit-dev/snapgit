import { connectToDatabase } from '../../utils/database'
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
        statusMessage: 'S3 configuration ID is required'
      })
    }
    
    const s3Config = await S3ConfigModel.findOne({ _id: id, userId: session.userId })
    if (!s3Config) {
      throw createError({
        statusCode: 404,
        statusMessage: 'S3 configuration not found'
      })
    }
    
    return s3Config.toSafeObject()
  } catch (error) {
    console.error('Error fetching S3 configuration:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch S3 configuration: ${error.message}`
    })
  }
})