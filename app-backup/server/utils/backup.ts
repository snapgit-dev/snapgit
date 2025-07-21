import { promises as fs } from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getInstallationRepositories, generateInstallationToken } from './github-app'
import { S3ConfigModel } from '../models/S3'
import { UserModel } from '../models/User'

const execAsync = promisify(exec)

export interface BackupOptions {
  userId: string
  s3ConfigIds?: string[]
  compressionLevel?: number
  customS3Path?: string
}

export interface BackupProgress {
  phase: 'init' | 'clone' | 'compress' | 'upload' | 'cleanup' | 'complete' | 'error'
  message: string
  progress?: number
  totalRepos?: number
  currentRepo?: number
}

export class BackupService {
  private workspaceBase = '/tmp/github-backups'
  private progressCallback?: (progress: BackupProgress) => void

  constructor(progressCallback?: (progress: BackupProgress) => void) {
    this.progressCallback = progressCallback
  }

  private async updateProgress(progress: BackupProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress)
    }
    console.log(`[Backup] ${progress.phase}: ${progress.message}`)
  }

  private async createWorkspace(userId: string): Promise<string> {
    const timestamp = Date.now()
    const workspacePath = path.join(this.workspaceBase, `${userId}-${timestamp}`)
    
    await fs.mkdir(workspacePath, { recursive: true })
    return workspacePath
  }

  private async cleanupWorkspace(workspacePath: string) {
    try {
      await execAsync(`rm -rf "${workspacePath}"`)
    } catch (error) {
      console.error('Error cleaning up workspace:', error)
    }
  }

  private async cloneRepository(
    installationId: string,
    repo: { full_name: string; owner: { login: string }; name: string; default_branch?: string; installationId: string },
    workspacePath: string,
    repoIndex: number,
    totalRepos: number
  ): Promise<void> {
    const token = await generateInstallationToken(installationId)
    const repoPath = path.join(workspacePath, repo.owner.login, repo.name)
    
    await this.updateProgress({
      phase: 'clone',
      message: `Cloning ${repo.full_name} (full backup with sources)`,
      currentRepo: repoIndex + 1,
      totalRepos,
      progress: Math.round(((repoIndex + 1) / totalRepos) * 100)
    })

    await fs.mkdir(path.dirname(repoPath), { recursive: true })

    const cloneUrl = `https://x-access-token:${token}@github.com/${repo.full_name}.git`
    
    try {
      // 1. Clone bare repository (pour l'historique complet)
      await execAsync(`git clone --bare --mirror "${cloneUrl}" "${repoPath}.git"`, {
        timeout: 300000 // 5 minutes timeout per repo
      })

      // 2. Clone working repository (pour les fichiers sources)
      await execAsync(`git clone --recurse-submodules "${cloneUrl}" "${repoPath}"`, {
        timeout: 300000 // 5 minutes timeout per repo
      })

      // 3. Dans le working repository, récupérer toutes les branches
      const fetchAllCmd = `cd "${repoPath}" && git fetch --all && git branch -r | grep -v '\\->' | while read remote; do git branch --track "\${remote#origin/}" "$remote" 2>/dev/null || true; done`
      
      try {
        await execAsync(fetchAllCmd, {
          timeout: 180000 // 3 minutes pour fetch toutes les branches
        })
      } catch (branchError) {
        console.warn(`Warning: Could not fetch all branches for ${repo.full_name}:`, branchError)
        // Continue même si on ne peut pas récupérer toutes les branches
      }

      // 4. Créer un fichier README avec les informations de backup
      const backupInfo = {
        repository: repo.full_name,
        backup_date: new Date().toISOString(),
        default_branch: repo.default_branch || 'main',
        backup_type: 'full_with_sources',
        structure: {
          [`${repo.name}.git`]: 'Bare repository with complete Git history (all branches, tags, refs)',
          [`${repo.name}/`]: 'Working directory with source files and all branches',
          'README_BACKUP.json': 'This file - backup metadata'
        },
        restore_instructions: {
          quick_restore: `cd ${repo.name} && git checkout ${repo.default_branch || 'main'}`,
          full_restore: `git clone ./${repo.name}.git restored_${repo.name}`,
          list_branches: `cd ${repo.name} && git branch -a`,
          list_tags: `cd ${repo.name}.git && git tag -l`
        }
      }

      await fs.writeFile(
        path.join(path.dirname(repoPath), 'README_BACKUP.json'),
        JSON.stringify(backupInfo, null, 2)
      )

    } catch (error) {
      console.error(`Failed to clone ${repo.full_name}:`, error)
      throw new Error(`Failed to clone ${repo.full_name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async compressWorkspace(workspacePath: string, compressionLevel: number = 9, customArchiveName?: string): Promise<string> {
    await this.updateProgress({
      phase: 'compress',
      message: 'Compressing backup data...'
    })

    const archiveName = customArchiveName || path.basename(workspacePath)
    const archivePath = path.join(path.dirname(workspacePath), `${archiveName}.tar.xz`)
    const compressionCmd = `tar -cJf "${archivePath}" -C "${path.dirname(workspacePath)}" "${path.basename(workspacePath)}"`
    
    try {
      await execAsync(compressionCmd, {
        timeout: 1800000, // 30 minutes timeout for compression
        env: { ...process.env, XZ_OPT: `-${compressionLevel}` }
      })
      
      const stats = await fs.stat(archivePath)
      console.log(`Archive created: ${archivePath} (${Math.round(stats.size / 1024 / 1024)} MB)`)
      
      return archivePath
    } catch (error) {
      throw new Error(`Compression failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async uploadToS3(archivePath: string, s3Configs: any[], userId: string, customS3Path?: string): Promise<void> {
    await this.updateProgress({
      phase: 'upload',
      message: 'Uploading to S3 storage(s)...'
    })

    const AWS = await import('@aws-sdk/client-s3')
    const archiveName = path.basename(archivePath)
    
    // Utiliser le chemin personnalisé s'il est fourni, sinon générer un chemin avec timestamp
    const s3Key = customS3Path 
      ? `${customS3Path}/${archiveName}`
      : `github-backups/${userId}/${new Date().toISOString().replace(/[:.]/g, '-')}/${archiveName}`

    for (let i = 0; i < s3Configs.length; i++) {
      const s3Config = s3Configs[i]
      const credentials = s3Config.getDecryptedCredentials()
      
      const s3Client = new AWS.S3Client({
        region: s3Config.region,
        endpoint: s3Config.endpoint,
        forcePathStyle: s3Config.forcePathStyle,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey
        }
      })

      try {
        const fileBuffer = await fs.readFile(archivePath)
        
        await s3Client.send(new AWS.PutObjectCommand({
          Bucket: s3Config.bucket,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: 'application/x-xz',
          Metadata: {
            'user-id': userId,
            'backup-date': new Date().toISOString(),
            'backup-type': 'github-full'
          }
        }))

        console.log(`Successfully uploaded to S3 config: ${s3Config.name}`)
      } catch (error) {
        console.error(`Failed to upload to S3 config ${s3Config.name}:`, error)
        throw new Error(`Upload to ${s3Config.name} failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  async startBackup(options: BackupOptions): Promise<void> {
    let workspacePath: string | null = null

    try {
      await this.updateProgress({
        phase: 'init',
        message: 'Initializing backup process...'
      })

      // Get user and installations
      const user = await UserModel.findOne({ githubId: options.userId })
      if (!user || !user.githubAppInstallationIds?.length) {
        throw new Error('No GitHub App installations found for user')
      }

      // Get S3 configurations
      let s3Configs
      if (options.s3ConfigIds?.length) {
        s3Configs = await S3ConfigModel.find({
          _id: { $in: options.s3ConfigIds },
          userId: options.userId
        })
      } else {
        s3Configs = await S3ConfigModel.find({ userId: options.userId, isDefault: true })
        if (!s3Configs.length) {
          s3Configs = await S3ConfigModel.find({ userId: options.userId }).limit(1)
        }
      }

      if (!s3Configs.length) {
        throw new Error('No S3 configurations found')
      }

      // Create workspace
      workspacePath = await this.createWorkspace(options.userId)

      // Collect all repositories
      const allRepos = []
      for (const installationId of user.githubAppInstallationIds) {
        try {
          const { repositories } = await getInstallationRepositories(installationId)
          allRepos.push(...repositories.map((repo: any) => ({ ...repo, installationId })))
        } catch (error) {
          console.error(`Failed to get repositories for installation ${installationId}:`, error)
        }
      }

      if (!allRepos.length) {
        throw new Error('No repositories found to backup')
      }

      // Clone all repositories
      for (let i = 0; i < allRepos.length; i++) {
        const repo = allRepos[i]
        await this.cloneRepository(
          repo.installationId,
          repo,
          workspacePath,
          i,
          allRepos.length
        )
      }

      // Compress workspace
      const archivePath = await this.compressWorkspace(
        workspacePath,
        options.compressionLevel || 9
      )

      // Upload to S3
      await this.uploadToS3(archivePath, s3Configs, options.userId)

      // Cleanup
      await this.updateProgress({
        phase: 'cleanup',
        message: 'Cleaning up temporary files...'
      })

      await this.cleanupWorkspace(workspacePath)
      await fs.unlink(archivePath)

      await this.updateProgress({
        phase: 'complete',
        message: `Backup completed successfully! ${allRepos.length} repositories backed up to ${s3Configs.length} S3 storage(s).`
      })

    } catch (error) {
      await this.updateProgress({
        phase: 'error',
        message: `Backup failed: ${error instanceof Error ? error.message : String(error)}`
      })

      if (workspacePath) {
        await this.cleanupWorkspace(workspacePath)
      }

      throw error
    }
  }

  // Nouvelle méthode pour backup d'un seul repository
  async startSingleRepositoryBackup(repositoryFullName: string, options: BackupOptions): Promise<void> {
    let workspacePath: string | null = null

    try {
      await this.updateProgress({
        phase: 'init',
        message: `Initializing backup for repository ${repositoryFullName}...`
      })

      // Get user and installations
      const user = await UserModel.findOne({ githubId: options.userId })
      if (!user || !user.githubAppInstallationIds?.length) {
        throw new Error('No GitHub App installations found for user')
      }

      // Get S3 configurations
      let s3Configs
      if (options.s3ConfigIds?.length) {
        s3Configs = await S3ConfigModel.find({
          _id: { $in: options.s3ConfigIds },
          userId: options.userId
        })
      } else {
        s3Configs = await S3ConfigModel.find({ userId: options.userId, isDefault: true })
        if (!s3Configs.length) {
          s3Configs = await S3ConfigModel.find({ userId: options.userId }).limit(1)
        }
      }

      if (!s3Configs.length) {
        throw new Error('No S3 configurations found')
      }

      // Create workspace
      workspacePath = await this.createWorkspace(options.userId)

      // Find the specific repository
      let targetRepo = null
      for (const installationId of user.githubAppInstallationIds) {
        try {
          const { repositories } = await getInstallationRepositories(installationId)
          targetRepo = repositories.find((repo: any) => repo.full_name === repositoryFullName)
          if (targetRepo) {
            targetRepo.installationId = installationId
            break
          }
        } catch (error) {
          console.error(`Failed to get repositories for installation ${installationId}:`, error)
        }
      }

      if (!targetRepo) {
        throw new Error(`Repository ${repositoryFullName} not found in user installations`)
      }

      // Clone the specific repository
      await this.cloneRepository(
        targetRepo.installationId,
        targetRepo,
        workspacePath,
        0,
        1
      )

      // Compress workspace
      const archivePath = await this.compressWorkspace(
        workspacePath,
        options.compressionLevel || 9,
        targetRepo.full_name.replace('/', '-')
      )

      // Upload to S3 with custom path if provided
      await this.uploadToS3(archivePath, s3Configs, options.userId, options.customS3Path)

      // Cleanup
      await this.updateProgress({
        phase: 'cleanup',
        message: 'Cleaning up temporary files...'
      })

      await this.cleanupWorkspace(workspacePath)
      await fs.unlink(archivePath)

      await this.updateProgress({
        phase: 'complete',
        message: `Backup completed successfully! Repository ${repositoryFullName} backed up to ${s3Configs.length} S3 storage(s).`
      })

    } catch (error) {
      await this.updateProgress({
        phase: 'error',
        message: `Backup failed for ${repositoryFullName}: ${error instanceof Error ? error.message : String(error)}`
      })

      if (workspacePath) {
        await this.cleanupWorkspace(workspacePath)
      }

      throw error
    }
  }

  // Méthode wrapper pour le worker system
  async backupSingleRepository(
    userId: string,
    owner: string,
    repoName: string,
    s3ConfigId: string,
    s3Path?: string
  ): Promise<void> {
    const repositoryFullName = `${owner}/${repoName}`
    
    try {
      await this.startSingleRepositoryBackup(repositoryFullName, {
        userId,
        s3ConfigIds: [s3ConfigId],
        customS3Path: s3Path
      })
    } catch (error) {
      console.error(`Erreur lors du backup de ${repositoryFullName}:`, error)
      throw error
    }
  }
}