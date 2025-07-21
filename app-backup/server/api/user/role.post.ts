import { SessionModel } from '../../models/Session'
import { UserModel, type UserRole } from '../../models/User'
import { connectToDatabase } from '../../utils/database'

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

    // Récupérer l'utilisateur
    const user = await UserModel.findOne({ githubId: session.userId })
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }

    const body = await readBody(event)
    const { role } = body

    // Validation du rôle
    if (!role || !['basic', 'paid', 'admin'].includes(role)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid role. Must be: basic, paid, or admin'
      })
    }

    // Vérification des permissions pour changer de rôle
    if (user.role !== 'admin') {
      // Permettre aux utilisateurs de passer au statut payant après un paiement
      if (role === 'paid' && user.role === 'basic') {
        // OK - upgrade from basic to paid
      }
      // Permettre aux utilisateurs payants de repasser en basic (downgrade)
      else if (role === 'basic' && user.role === 'paid') {
        // OK - downgrade from paid to basic
      }
      // Interdire les autres changements pour les non-admins
      else {
        throw createError({
          statusCode: 403,
          statusMessage: 'Only administrators can change roles or users can upgrade/downgrade between basic and paid'
        })
      }
    }

    // Mettre à jour le rôle
    user.role = role as UserRole
    
    // Si on passe à un plan payant, activer l'abonnement
    if (role === 'paid') {
      user.subscription.status = 'active'
      user.subscription.currentPeriodStart = new Date()
      user.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
    } else if (role === 'basic') {
      user.subscription.status = 'inactive'
    }

    await user.save()

    return {
      success: true,
      data: {
        role: user.role,
        subscription: user.subscription,
        message: `Role updated to ${role}`
      }
    }
  } catch (error: any) {
    console.error('Error updating user role:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update user role'
    })
  }
})