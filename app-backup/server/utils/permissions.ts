import { UserModel, type UserRole } from '../models/User'
import { SessionModel } from '../models/Session'

export interface AuthResult {
  user: any
  hasPermission: boolean
  reason?: string
}

export async function checkUserPermission(
  sessionToken: string | undefined,
  requiredPermission: string
): Promise<AuthResult> {
  // Vérification du token de session
  if (!sessionToken) {
    return {
      user: null,
      hasPermission: false,
      reason: 'No session token provided'
    }
  }

  // Récupération de la session
  const session = await SessionModel.findOne({ sessionToken })
  if (!session || session.expires < new Date()) {
    return {
      user: null,
      hasPermission: false,
      reason: 'Session expired or invalid'
    }
  }

  // Récupération de l'utilisateur
  const user = await UserModel.findOne({ githubId: session.userId })
  if (!user) {
    return {
      user: null,
      hasPermission: false,
      reason: 'User not found'
    }
  }

  // Vérification de la permission
  const hasPermission = user.hasPermission(requiredPermission)
  
  return {
    user,
    hasPermission,
    reason: hasPermission ? undefined : `Permission '${requiredPermission}' required for role '${user.role}'`
  }
}

export function requirePermission(permission: string) {
  return async (event: any) => {
    const sessionToken = getCookie(event, 'session')
    const authResult = await checkUserPermission(sessionToken, permission)

    if (!authResult.hasPermission) {
      throw createError({
        statusCode: authResult.user ? 403 : 401,
        statusMessage: authResult.reason || 'Permission denied'
      })
    }

    // Ajouter l'utilisateur au contexte de l'événement
    event.context.user = authResult.user
    return authResult.user
  }
}

export function requireRole(role: UserRole) {
  return async (event: any) => {
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
    
    const user = await UserModel.findOne({ githubId: session.userId })
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }

    // Admin peut tout faire
    if (user.role === 'admin') {
      event.context.user = user
      return user
    }

    // Vérifier le rôle requis
    if (user.role !== role) {
      throw createError({
        statusCode: 403,
        statusMessage: `Role '${role}' required, current role: '${user.role}'`
      })
    }

    event.context.user = user
    return user
  }
}

export function requirePaidAccess() {
  return requirePermission('create_backups')
}

export function requireBasicAccess() {
  return requirePermission('view_repositories')
}