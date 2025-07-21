import { connectToDatabase } from '../../utils/database'
import { GroupTaskModel } from '../../models/GroupTask'
import { TaskBackupModel } from '../../models/TaskBackup'
import { S3ConfigModel } from '../../models/S3'
import { getInstallationRepositories } from '../../utils/github-app'
import { UserModel } from '../../models/User'
import { addGroupJobToQueue } from '../../utils/worker'
import { requirePaidAccess } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()
    
    // Vérification des permissions (requiert un accès payant)
    const user = await requirePaidAccess()(event)

    const body = await readBody(event)
    const { repositories: repoNames } = body
    
    if (!repoNames || !Array.isArray(repoNames) || repoNames.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Liste des repositories requise'
      })
    }

    // Récupérer la configuration S3 par défaut pour cet utilisateur
    const defaultS3Config = await S3ConfigModel.findOne({ 
      userId: user.githubId, 
      isDefault: true 
    })
    
    if (!defaultS3Config) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Aucune configuration S3 par défaut trouvée. Veuillez configurer S3 d\'abord.'
      })
    }

    // Vérifier les installations GitHub
    if (!user.githubAppInstallationIds || user.githubAppInstallationIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'GitHub App not installed'
      })
    }

    // Récupérer tous les repositories depuis GitHub pour obtenir les détails complets
    const allGithubRepositories = []
    for (const installationId of user.githubAppInstallationIds) {
      try {
        const repositories = await getInstallationRepositories(installationId)
        allGithubRepositories.push(...repositories.repositories)
      } catch (error) {
        console.error(`Error fetching repositories for installation ${installationId}:`, error)
      }
    }

    // Filtrer seulement les repositories demandés
    const reposToBackup = allGithubRepositories.filter((repo: any) => 
      repoNames.includes(repo.full_name)
    )

    if (reposToBackup.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Aucun repository valide trouvé'
      })
    }

    // Créer un nom unique pour ce groupe de backup
    const groupName = `Backup Group ${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`
    const s3FolderPath = `backups/${user.githubId}/${Date.now()}-group-backup`

    // Incrémenter l'usage pour l'utilisateur
    user.incrementUsage('repositories', reposToBackup.length)
    user.incrementUsage('backups', 1)
    await user.save()

    // D'abord créer les TaskBackup individuels
    const taskIds = []
    for (const repo of reposToBackup) {
      // Générer un UUID simple pour éviter les doublons
      const uuid = Math.random().toString(36).substr(2, 9)
      const taskData = {
        userId: user.githubId,
        name: `Backup ${repo.full_name} - ${uuid}`,
        description: `Backup automatique du repository ${repo.full_name}`,
        repositoryFullName: repo.full_name,
        repositoryOwner: repo.owner.login,
        repositoryName: repo.name,
        s3ConfigIds: [defaultS3Config._id.toString()],
        isActive: true,
        executionMode: 'worker',
        executeImmediately: false, // Ne pas exécuter immédiatement les tâches individuelles
        createdBy: 'bulk_save',
        metadata: {
          githubId: repo.id,
          private: repo.private,
          defaultBranch: repo.default_branch,
          language: repo.language,
          groupBackup: true
        }
      }

      const savedTask = await TaskBackupModel.create(taskData)
      taskIds.push(savedTask._id.toString())
    }

    const groupTaskData = {
      userId: user.githubId,
      name: groupName,
      description: `Backup groupé de ${reposToBackup.length} repositories`,
      taskIds,
      s3FolderPath,
      isActive: true,
      executionMode: 'worker',
      executeImmediately: true,
      createdBy: 'bulk_save',
      metadata: {
        totalRepositories: reposToBackup.length,
        createdAt: new Date().toISOString()
      }
    }

    try {
      // Créer ou mettre à jour la GroupTask
      const savedGroupTask = await GroupTaskModel.findOneAndUpdate(
        { 
          userId: user.githubId, 
          name: groupName 
        },
        {
          ...groupTaskData,
          updatedAt: new Date()
        },
        { 
          upsert: true, 
          new: true,
          setDefaultsOnInsert: true
        }
      )

      // Ajouter le job de groupe à la queue
      if (savedGroupTask.executeImmediately || savedGroupTask.executionMode === 'worker') {
        try {
          const jobId = await addGroupJobToQueue(savedGroupTask._id.toString())
          console.log(`Group Job ${jobId} créé pour backup groupé de ${reposToBackup.length} repositories`)
        } catch (jobError) {
          console.error(`Échec de création du group job:`, jobError)
          // Continuer quand même, la tâche de groupe est créée
        }
      }

      return {
        success: true,
        data: {
          groupTaskId: savedGroupTask._id,
          groupName: savedGroupTask.name,
          repositoriesCount: reposToBackup.length,
          s3FolderPath: savedGroupTask.s3FolderPath,
          message: `Groupe de backup créé avec ${reposToBackup.length} repositories et ajouté à la queue d'exécution`,
          repositories: reposToBackup.map((repo: any) => repo.full_name)
        }
      }
    } catch (error: any) {
      console.error(`Error creating group backup task:`, error)
      throw createError({
        statusCode: 500,
        statusMessage: error.message || 'Failed to create group backup task'
      })
    }
  } catch (error: any) {
    console.error('Error creating backup tasks:', error)
    
    // Gérer les erreurs d'auth
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to create backup tasks'
    })
  }
})
