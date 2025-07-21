import { S3ConfigModel } from '../../../models/S3'
import { SessionModel } from '../../../models/Session'
import { connectToDatabase } from '../../../utils/database'

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

    const configId = getRouterParam(event, 'id')
    if (!configId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Config ID is required'
      })
    }

    // Récupérer la configuration S3
    const s3Config = await S3ConfigModel.findOne({ 
      _id: configId, 
      userId: session.userId 
    })
    
    if (!s3Config) {
      throw createError({
        statusCode: 404,
        statusMessage: 'S3 configuration not found'
      })
    }

    // Récupérer les paramètres de requête
    const query = getQuery(event)
    const key = query.key as string
    
    if (!key) {
      throw createError({
        statusCode: 400,
        statusMessage: 'File key is required'
      })
    }

    // Décrypter les credentials
    const credentials = s3Config.getDecryptedCredentials()

    // Importer et configurer le client S3
    const AWS = await import('@aws-sdk/client-s3')
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    
    const s3Client = new AWS.S3Client({
      endpoint: s3Config.endpoint,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      },
      region: s3Config.region,
      forcePathStyle: s3Config.forcePathStyle
    })

    // Vérifier que l'objet existe
    try {
      const headCommand = new AWS.HeadObjectCommand({
        Bucket: s3Config.bucket,
        Key: key
      })
      await s3Client.send(headCommand)
    } catch (headError: any) {
      if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
        throw createError({
          statusCode: 404,
          statusMessage: 'File not found'
        })
      }
      throw headError
    }

    // Générer une URL de téléchargement présignée (valide 1 heure)
    const getObjectCommand = new AWS.GetObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${key.split('/').pop()}"`
    })
    
    const downloadUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 })

    return {
      success: true,
      data: {
        downloadUrl,
        fileName: key.split('/').pop(),
        expiresIn: 3600
      }
    }
  } catch (error: any) {
    console.error('Error generating download URL:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to generate download URL'
    })
  }
})