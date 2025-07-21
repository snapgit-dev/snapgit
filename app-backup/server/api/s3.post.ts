import { S3ConfigModel } from '../models/S3'
import { connectToDatabase } from '../utils/database'
import { requirePaidAccess } from '../utils/permissions'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()
    
    // Vérification des permissions (requiert un accès payant)
    const user = await requirePaidAccess()(event)
    
    const body = await readBody(event)
    
    // Validation des données
    const { name, endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle, isDefault } = body
    
    if (!name || !endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tous les champs obligatoires doivent être renseignés'
      })
    }

    // Si cette config doit être par défaut, désactiver les autres
    if (isDefault) {
      await S3ConfigModel.updateMany(
        { userId: user.githubId },
        { isDefault: false }
      )
    }

    // Créer la nouvelle configuration S3
    const newConfig = new S3ConfigModel({
      userId: user.githubId,
      name,
      endpoint,
      region,
      bucket,
      accessKeyId, // Sera automatiquement chiffré par le pre-hook
      secretAccessKey, // Sera automatiquement chiffré par le pre-hook
      forcePathStyle: forcePathStyle || false,
      isDefault: isDefault || false
    })

    const savedConfig = await newConfig.save()

    return {
      success: true,
      data: savedConfig.toSafeObject() // Retourne l'objet sans les clés d'accès
    }
  } catch (error: any) {
    console.error('Erreur lors de la création de la configuration S3:', error)
    
    // Gérer les erreurs d'auth
    if (error.statusCode) {
      throw error
    }
    
    // Gérer les erreurs de validation/duplicata
    if (error.code === 11000) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Une configuration avec ce nom existe déjà'
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Erreur interne du serveur'
    })
  }
})
