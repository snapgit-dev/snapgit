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
    
    const body = await readBody(event)
    const { name, endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle, isDefault } = body
    
    const s3Config = await S3ConfigModel.findOne({ _id: id, userId: session.userId })
    if (!s3Config) {
      throw createError({
        statusCode: 404,
        statusMessage: 'S3 configuration not found'
      })
    }
    
    if (isDefault && !s3Config.isDefault) {
      await S3ConfigModel.updateMany(
        { userId: session.userId },
        { isDefault: false }
      )
    }
    
    if (name !== undefined) s3Config.name = name
    if (endpoint !== undefined) s3Config.endpoint = endpoint
    if (region !== undefined) s3Config.region = region
    if (bucket !== undefined) s3Config.bucket = bucket
    if (accessKeyId !== undefined) s3Config.accessKeyId = accessKeyId
    if (secretAccessKey !== undefined) s3Config.secretAccessKey = secretAccessKey
    if (forcePathStyle !== undefined) s3Config.forcePathStyle = forcePathStyle
    if (isDefault !== undefined) s3Config.isDefault = isDefault
    
    await s3Config.save()
    
    return s3Config.toSafeObject()
  } catch (error) {
    console.error('Error updating S3 configuration:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    if (error.code === 11000) {
      throw createError({
        statusCode: 409,
        statusMessage: 'S3 configuration with this name already exists'
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to update S3 configuration: ${error.message}`
    })
  }
})