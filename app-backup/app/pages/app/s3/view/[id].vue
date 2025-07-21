<template>
  <UDashboardPanel>
    <template #body>
      <UContainer>
        <div class="py-8 space-y-6">
          <!-- Header avec navigation -->
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                Navigateur S3
              </h1>
              <p class="mt-2 text-gray-600 dark:text-gray-400">
                {{ configName ? `Configuration: ${configName}` : 'Chargement...' }}
              </p>
            </div>
            <UButton
              to="/app/settings"
              variant="ghost"
            >
              <template #leading>
                <UIcon name="i-heroicons-arrow-left" />
              </template>
              Retour
            </UButton>
          </div>

          <!-- Breadcrumb -->
          <UCard v-if="!loading">
            <div class="flex items-center gap-2 text-sm">
              <UButton
                @click="navigateToPath('')"
                variant="ghost"
                size="xs"
                :disabled="currentPath === ''"
              >
                <UIcon name="i-heroicons-home" />
              </UButton>
              <template v-if="breadcrumbs.length > 0">
                <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
                <template v-for="(crumb, index) in breadcrumbs" :key="index">
                  <UButton
                    @click="navigateToPath(crumb.path)"
                    variant="ghost"
                    size="xs"
                    :disabled="index === breadcrumbs.length - 1"
                  >
                    {{ crumb.name }}
                  </UButton>
                  <UIcon 
                    v-if="index < breadcrumbs.length - 1"
                    name="i-heroicons-chevron-right" 
                    class="w-4 h-4 text-gray-400" 
                  />
                </template>
              </template>
            </div>
          </UCard>

          <!-- Liste des fichiers -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold">
                  Contenu ({{ items.length }} éléments)
                </h2>
                <UButton
                  @click="fetchItems"
                  variant="ghost"
                  size="sm"
                  :loading="loading"
                >
                  <template #leading>
                    <UIcon name="i-heroicons-arrow-path" />
                  </template>
                  Actualiser
                </UButton>
              </div>
            </template>

            <div v-if="loading" class="space-y-4">
              <USkeleton class="h-16 w-full" v-for="i in 5" :key="i" />
            </div>

            <div v-else-if="items.length === 0" class="text-center py-8">
              <UIcon name="i-heroicons-folder" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Dossier vide
              </h3>
              <p class="text-gray-600 dark:text-gray-400">
                Ce dossier ne contient aucun fichier ou sous-dossier.
              </p>
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="item in items"
                :key="item.path"
                class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div class="flex items-center gap-3 flex-1">
                  <UIcon 
                    :name="item.type === 'folder' ? 'i-heroicons-folder' : 'i-heroicons-document'"
                    :class="item.type === 'folder' ? 'text-blue-500' : 'text-gray-500'"
                    class="w-5 h-5"
                  />
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span 
                        class="font-medium cursor-pointer hover:text-blue-600"
                        @click="item.type === 'folder' ? navigateToPath(item.path) : null"
                      >
                        {{ item.name }}
                      </span>
                      <UBadge v-if="item.type === 'folder'" color="blue" size="xs">
                        Dossier
                      </UBadge>
                    </div>
                    <div v-if="item.type === 'file'" class="text-sm text-gray-500 mt-1">
                      {{ formatFileSize(item.size) }} • {{ formatDate(item.lastModified) }}
                    </div>
                  </div>
                </div>
                <div v-if="item.type === 'file'" class="flex items-center gap-2">
                  <UButton
                    @click="downloadFile(item)"
                    variant="ghost"
                    size="sm"
                    :loading="downloadingFile === item.path"
                  >
                    <template #leading>
                      <UIcon name="i-heroicons-arrow-down-tray" />
                    </template>
                    Télécharger
                  </UButton>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
const route = useRoute()
const toast = useToast()

interface S3Item {
  type: 'file' | 'folder'
  name: string
  path: string
  size?: number
  lastModified?: string
}

interface Breadcrumb {
  name: string
  path: string
}

// États réactifs
const configId = route.params.id as string
const configName = ref<string>('')
const loading = ref(true)
const items = ref<S3Item[]>([])
const currentPath = ref<string>('')
const downloadingFile = ref<string | null>(null)

// Computed
const breadcrumbs = computed<Breadcrumb[]>(() => {
  if (!currentPath.value) return []
  
  const parts = currentPath.value.split('/').filter(Boolean)
  const crumbs: Breadcrumb[] = []
  
  for (let i = 0; i < parts.length; i++) {
    crumbs.push({
      name: parts[i],
      path: parts.slice(0, i + 1).join('/') + '/'
    })
  }
  
  return crumbs
})

// Méthodes
const fetchItems = async () => {
  loading.value = true
  try {
    const data = await $fetch(`/api/s3/${configId}/browse`, {
      query: {
        prefix: currentPath.value,
        delimiter: '/'
      }
    })
    items.value = data.data.items || []
  } catch (error: any) {
    console.error('Erreur lors de la récupération des éléments S3:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de récupérer le contenu du dossier',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const fetchConfig = async () => {
  try {
    const data = await $fetch(`/api/s3/${configId}`)
    configName.value = data.name
  } catch (error) {
    console.error('Erreur lors de la récupération de la configuration:', error)
  }
}

const navigateToPath = (path: string) => {
  currentPath.value = path
  fetchItems()
}

const downloadFile = async (item: S3Item) => {
  downloadingFile.value = item.path
  try {
    const data = await $fetch(`/api/s3/${configId}/download`, {
      query: {
        key: item.path
      }
    })
    
    // Ouvrir l'URL de téléchargement dans un nouvel onglet
    window.open(data.data.downloadUrl, '_blank')
    
    toast.add({
      title: 'Téléchargement démarré',
      description: `Le téléchargement de ${item.name} a été initié`,
      color: 'success'
    })
  } catch (error: any) {
    console.error('Erreur lors du téléchargement:', error)
    toast.add({
      title: 'Erreur de téléchargement',
      description: error.data?.message || 'Impossible de télécharger le fichier',
      color: 'error'
    })
  } finally {
    downloadingFile.value = null
  }
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

const formatDate = (date?: string) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Chargement initial
onMounted(async () => {
  await Promise.all([
    fetchConfig(),
    fetchItems()
  ])
})
</script>