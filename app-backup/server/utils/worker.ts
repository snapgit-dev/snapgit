import { TaskBackupModel } from '../models/TaskBackup'
import { GroupTaskModel } from '../models/GroupTask'
import { BackupService } from './backup'
import { connectToDatabase } from './database'

export interface WorkerJob {
  id: string
  type: 'backup_repository' | 'backup_group'
  data: {
    taskId?: string
    groupTaskId?: string
    repositoryFullName?: string
    repositoryOwner?: string
    repositoryName?: string
    repositories?: Array<{
      owner: string
      name: string
      fullName: string
    }>
    s3ConfigIds?: string[]
    s3FolderPath?: string
    userId: string
  }
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  error?: string
}

// Simple in-memory job queue (en production, utilisez Redis ou une vraie queue)
const jobQueue: WorkerJob[] = []
let isWorkerRunning = false

export const addJobToQueue = async (taskId: string, executeImmediately: boolean = true) => {
  try {
    await connectToDatabase()
    
    const task = await TaskBackupModel.findById(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    const job: WorkerJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'backup_repository',
      data: {
        taskId: task._id.toString(),
        repositoryFullName: task.repositoryFullName!,
        repositoryOwner: task.repositoryOwner!,
        repositoryName: task.repositoryName!,
        s3ConfigIds: task.s3ConfigIds,
        userId: task.userId
      },
      status: 'pending',
      createdAt: new Date()
    }

    jobQueue.push(job)
    console.log(`Job ${job.id} ajouté à la queue pour le repository ${job.data.repositoryFullName}`)
    
    // Démarrer le worker immédiatement si demandé
    if (executeImmediately && !isWorkerRunning) {
      console.log('Démarrage immédiat du worker pour traitement des jobs')
      setImmediate(() => startWorker()) // Exécution asynchrone immédiate
    }
    
    return job.id
  } catch (error) {
    console.error('Error adding job to queue:', error)
    throw error
  }
}

export const addGroupJobToQueue = async (groupTaskId: string, executeImmediately: boolean = true) => {
  try {
    await connectToDatabase()
    
    const groupTask = await GroupTaskModel.findById(groupTaskId).populate('taskIds')
    if (!groupTask) {
      throw new Error(`GroupTask ${groupTaskId} not found`)
    }

    // Récupérer les tâches liées pour avoir les infos des repositories
    const tasks = await TaskBackupModel.find({ _id: { $in: groupTask.taskIds } })
    
    const repositories = tasks.map((task: any) => ({
      owner: task.repositoryOwner,
      name: task.repositoryName,
      fullName: task.repositoryFullName
    }))

    const job: WorkerJob = {
      id: `group_job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'backup_group',
      data: {
        groupTaskId: groupTask._id.toString(),
        repositories,
        s3FolderPath: groupTask.s3FolderPath,
        userId: groupTask.userId
      },
      status: 'pending',
      createdAt: new Date()
    }

    jobQueue.push(job)
    console.log(`Group Job ${job.id} ajouté à la queue pour ${repositories.length} repositories`)
    
    // Démarrer le worker immédiatement si demandé
    if (executeImmediately && !isWorkerRunning) {
      console.log('Démarrage immédiat du worker pour traitement du group job')
      setImmediate(() => startWorker()) // Exécution asynchrone immédiate
    }
    
    return job.id
  } catch (error) {
    console.error('Error adding group job to queue:', error)
    throw error
  }
}

export const startWorker = async () => {
  if (isWorkerRunning) {
    console.log('Worker is already running')
    return
  }

  isWorkerRunning = true
  console.log(`Worker démarré - ${jobQueue.length} job(s) en attente`)

  // Boucle de traitement des jobs
  while (jobQueue.length > 0) {
    const job = jobQueue.find(j => j.status === 'pending')
    if (!job) {
      break
    }

    try {
      const jobDescription = job.type === 'backup_group' 
        ? `groupe de ${job.data.repositories?.length} repositories`
        : job.data.repositoryFullName
      console.log(`Traitement du job ${job.id} pour ${jobDescription}`)
      await processJob(job)
      console.log(`Job ${job.id} terminé avec succès`)
    } catch (error) {
      console.error(`Erreur lors du traitement du job ${job.id}:`, error)
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Unknown error'
      job.completedAt = new Date()
      
      // Mettre à jour le statut de la tâche selon le type
      if (job.type === 'backup_repository' && job.data.taskId) {
        await updateTaskStatus(job.data.taskId, 'error', job.error)
      } else if (job.type === 'backup_group' && job.data.groupTaskId) {
        await updateGroupTaskStatus(job.data.groupTaskId, 'error', job.error)
      }
    }

    // Petite pause entre les jobs (réduite pour exécution plus rapide)
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  isWorkerRunning = false
  console.log('Worker arrêté - tous les jobs ont été traités')
}

const processJob = async (job: WorkerJob) => {
  if (job.type === 'backup_repository') {
    console.log(`Processing job ${job.id} for repository ${job.data.repositoryFullName}`)
    
    job.status = 'running'
    job.startedAt = new Date()
    
    // Mettre à jour le statut de la tâche individuelle
    if (job.data.taskId) {
      await updateTaskStatus(job.data.taskId, 'running')
    }

    try {
      // Utiliser le vrai système de backup pour un repository
      await performRealBackup(job)
      
      job.status = 'completed'
      job.completedAt = new Date()
      
      // Mettre à jour le statut de la tâche
      if (job.data.taskId) {
        await updateTaskStatus(job.data.taskId, 'success')
      }
      
      console.log(`Job ${job.id} completed successfully`)
    } catch (error) {
      throw error
    }
  } else if (job.type === 'backup_group') {
    console.log(`Processing group job ${job.id} for ${job.data.repositories?.length} repositories`)
    
    job.status = 'running'
    job.startedAt = new Date()
    
    // Mettre à jour le statut de la group task
    if (job.data.groupTaskId) {
      await updateGroupTaskStatus(job.data.groupTaskId, 'running')
    }

    try {
      // Utiliser le vrai système de backup pour un groupe
      await performGroupBackup(job)
      
      job.status = 'completed'
      job.completedAt = new Date()
      
      // Mettre à jour le statut de la group task
      if (job.data.groupTaskId) {
        await updateGroupTaskStatus(job.data.groupTaskId, 'success')
      }
      
      console.log(`Group job ${job.id} completed successfully`)
    } catch (error) {
      throw error
    }
  }
}

const performRealBackup = async (job: WorkerJob) => {
  if (!job.data.repositoryFullName || !job.data.s3ConfigIds || !job.data.userId) {
    throw new Error('Données de backup manquantes pour le repository')
  }

  console.log(`Début du backup réel pour ${job.data.repositoryFullName}`)
  
  // Créer un callback pour les updates de progression
  const progressCallback = (progress: any) => {
    console.log(`[${job.data.repositoryFullName}] ${progress.phase}: ${progress.message}`)
    if (progress.progress) {
      console.log(`[${job.data.repositoryFullName}] Progression: ${progress.progress}%`)
    }
  }
  
  // Créer le service de backup avec callback
  const backupService = new BackupService(progressCallback)
  
  try {
    // Lancer le backup pour ce repository spécifique
    await backupService.startSingleRepositoryBackup(
      job.data.repositoryFullName,
      {
        userId: job.data.userId,
        s3ConfigIds: job.data.s3ConfigIds,
        compressionLevel: 9
      }
    )
    
    console.log(`Backup réel terminé avec succès pour ${job.data.repositoryFullName}`)
  } catch (error) {
    console.error(`Erreur lors du backup de ${job.data.repositoryFullName}:`, error)
    throw error
  }
}

const performGroupBackup = async (job: WorkerJob) => {
  if (!job.data.repositories || !job.data.s3FolderPath) {
    throw new Error('Données de groupe manquantes pour le backup')
  }

  console.log(`Début du backup groupé pour ${job.data.repositories.length} repositories dans ${job.data.s3FolderPath}`)
  
  try {
    // Créer une instance du BackupService
    const backupService = new BackupService()
    
    // Récupérer le GroupTask pour avoir accès aux TaskBackup
    const groupTask = await GroupTaskModel.findById(job.data.groupTaskId)
    if (!groupTask) {
      throw new Error(`GroupTask ${job.data.groupTaskId} not found`)
    }
    
    // Récupérer les tâches individuelles
    const tasks = await TaskBackupModel.find({ _id: { $in: groupTask.taskIds } })
    
    // Effectuer le backup de chaque repository dans le dossier S3 spécifié
    for (const task of tasks) {
      // Le chemin S3 doit être directement dans le dossier du groupe, sans sous-dossier
      console.log(`Backup du repository ${task.repositoryFullName} vers ${job.data.s3FolderPath}`)
      
      // Utiliser le S3ConfigId de la tâche individuelle
      const s3ConfigId = task.s3ConfigIds[0] // Prendre le premier S3 config
      
      // Effectuer le backup du repository spécifique
      await backupService.backupSingleRepository(
        job.data.userId,
        task.repositoryOwner,
        task.repositoryName,
        s3ConfigId,
        job.data.s3FolderPath
      )
      
      console.log(`Repository ${task.repositoryFullName} sauvegardé avec succès`)
    }
    
    console.log(`Backup groupé terminé avec succès pour ${tasks.length} repositories`)
  } catch (error) {
    console.error(`Erreur lors du backup groupé:`, error)
    throw error
  }
}

const updateGroupTaskStatus = async (groupTaskId: string, status: 'pending' | 'running' | 'success' | 'error', error?: string) => {
  try {
    await connectToDatabase()
    
    const updateData: any = {
      lastStatus: status,
      updatedAt: new Date()
    }
    
    if (status === 'running') {
      updateData.lastRun = new Date()
    }
    
    if (error) {
      updateData.lastError = error
    } else if (status === 'success') {
      updateData.lastError = undefined
    }
    
    await GroupTaskModel.findByIdAndUpdate(groupTaskId, updateData)
    
    console.log(`GroupTask ${groupTaskId} status updated to ${status}`)
  } catch (error) {
    console.error(`Error updating GroupTask ${groupTaskId} status:`, error)
  }
}

const updateTaskStatus = async (taskId: string, status: 'pending' | 'running' | 'success' | 'error', error?: string) => {
  try {
    await connectToDatabase()
    
    const updateData: any = {
      lastStatus: status,
      updatedAt: new Date()
    }
    
    if (status === 'running') {
      updateData.lastRun = new Date()
    }
    
    if (error) {
      updateData.lastError = error
    } else if (status === 'success') {
      updateData.lastError = undefined
    }
    
    await TaskBackupModel.findByIdAndUpdate(taskId, updateData)
    
    console.log(`Task ${taskId} status updated to ${status}`)
  } catch (error) {
    console.error(`Error updating task ${taskId} status:`, error)
  }
}

export const getQueueStatus = () => {
  return {
    total: jobQueue.length,
    pending: jobQueue.filter(j => j.status === 'pending').length,
    running: jobQueue.filter(j => j.status === 'running').length,
    completed: jobQueue.filter(j => j.status === 'completed').length,
    failed: jobQueue.filter(j => j.status === 'failed').length,
    isWorkerRunning
  }
}

export const clearCompletedJobs = () => {
  const beforeCount = jobQueue.length
  jobQueue.splice(0, jobQueue.length, ...jobQueue.filter(j => j.status === 'pending' || j.status === 'running'))
  const afterCount = jobQueue.length
  console.log(`Cleared ${beforeCount - afterCount} completed/failed jobs`)
}
