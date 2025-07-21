import { createAppAuth } from '@octokit/auth-app'
import jwt from 'jsonwebtoken'

export async function generateInstallationToken(installationId: string): Promise<string> {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  
  console.log('App ID:', appId)
  console.log('Private key exists:', !!privateKey)
  console.log('Installation ID:', installationId)
  
  if (!appId || !privateKey) {
    throw new Error('GitHub App credentials not configured')
  }
  
  try {
    const auth = createAppAuth({
      appId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      installationId: parseInt(installationId)
    })
    
    const installationAuthentication = await auth({ type: 'installation' })
    console.log('Token generated successfully')
    return installationAuthentication.token
  } catch (error) {
    console.error('Error generating installation token:', error)
    throw error
  }
}

export async function getInstallationRepositories(installationId: string) {
  const installationToken = await generateInstallationToken(installationId)
  
  let allRepositories: any[] = []
  let page = 1
  let totalCount = 0
  const perPage = 100 // Maximum allowed per page
  
  while (true) {
    // Récupérer les repositories de l'installation avec pagination
    const installationResponse = await $fetch(`https://api.github.com/installation/repositories?per_page=${perPage}&page=${page}`, {
      headers: {
        'Authorization': `token ${installationToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ccweb-app'
      }
    })
    
    allRepositories.push(...installationResponse.repositories)
    totalCount = installationResponse.total_count
    
    console.log(`Installation ${installationId} - Page ${page}: ${installationResponse.repositories.length} repositories (${allRepositories.length}/${totalCount} total)`)
    
    // Si on a récupéré moins de repositories que la limite par page, c'est la dernière page
    if (installationResponse.repositories.length < perPage) {
      break
    }
    
    page++
  }
  
  console.log(`Installation ${installationId} - Final count: ${allRepositories.length} repositories`)
  
  return {
    repositories: allRepositories,
    total_count: totalCount
  }
}

export async function getRepositoryBranches(installationId: string, owner: string, repo: string) {
  const token = await generateInstallationToken(installationId)
  
  const response = await $fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ccweb-app'
    }
  })
  
  return response
}