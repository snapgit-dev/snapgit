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
    const prefix = (query.prefix as string) || ''
    const delimiter = (query.delimiter as string) || '/'
    const maxKeys = parseInt((query.maxKeys as string) || '1000')

    // Décrypter les credentials
    const credentials = s3Config.getDecryptedCredentials()

    // Importer et configurer le client S3
    const AWS = await import('@aws-sdk/client-s3')
    const s3Client = new AWS.S3Client({
      endpoint: s3Config.endpoint,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      },
      region: s3Config.region,
      forcePathStyle: s3Config.forcePathStyle
    })

    // Lister les objets
    const command = new AWS.ListObjectsV2Command({
      Bucket: s3Config.bucket,
      Prefix: prefix,
      Delimiter: delimiter,
      MaxKeys: maxKeys
    })

    const data = await s3Client.send(command)

    // Formater la réponse
    const folders = (data.CommonPrefixes || []).map(commonPrefix => ({
      type: 'folder',
      name: commonPrefix.Prefix!.replace(prefix, '').replace('/', ''),
      path: commonPrefix.Prefix,
      size: null,
      lastModified: null
    }))

    const files = (data.Contents || [])
      .filter(obj => obj.Key !== prefix) // Exclure le dossier lui-même
      .map(obj => ({
        type: 'file',
        name: obj.Key!.replace(prefix, ''),
        path: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified
      }))

    return {
      success: true,
      data: {
        currentPath: prefix,
        items: [...folders, ...files],
        hasMore: data.IsTruncated || false,
        nextToken: data.NextContinuationToken || null
      }
    }
  } catch (error: any) {
    console.error('Error browsing S3:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to browse S3'
    })
  }
})