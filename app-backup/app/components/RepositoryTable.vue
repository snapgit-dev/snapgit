<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">
          Mes Repositories ({{ repositories.length }}{{ totalCount > 0 && totalCount !== repositories.length ? ` / ${totalCount} total` : '' }})
        </h2>
        <UButton
          v-if="userRole === 'paid' || userRole === 'admin'"
          @click="saveAllRepos"
          :loading="saving"
          :disabled="repositories.length === 0"
        >
          <template #leading>
            <UIcon name="i-heroicons-check" />
          </template>
          Créer backup groupé ({{ repositories.length }})
        </UButton>
        <UButton
          v-else
          to="/app/settings/subscription"
          color="blue"
        >
          <template #leading>
            <UIcon name="i-heroicons-lock-closed" />
          </template>
          Passer au Premium pour créer des backups
        </UButton>
      </div>
    </template>

    <div v-if="loading" class="space-y-4">
      <USkeleton class="h-16 w-full" v-for="i in 5" :key="i" />
    </div>

    <div v-else-if="repositories.length === 0" class="text-center py-8">
      <UIcon name="i-simple-icons-github" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Aucun repository trouvé
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        Vérifiez votre connexion GitHub ou installez l'application GitHub.
      </p>
      <p class="text-xs text-gray-500 mt-2">
        Debug: Loading={{ loading }}, Repositories.length={{ repositories.length }}
      </p>
    </div>

    <!-- Debug des données -->
    <div v-else class="space-y-4">
      <div class="text-sm text-gray-600">
        Debug: {{ repositories.length }} repositories affichés
        <span v-if="totalCount > 0 && totalCount !== repositories.length" class="text-red-600">
          ({{ totalCount - repositories.length }} manquants sur {{ totalCount }} total)
        </span>
      </div>
      
      <UTable
        :data="repositories"
        :columns="columns"
      />
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'

const toast = useToast()

interface Repository {
  id: number
  name: string
  full_name: string
  description?: string
  private: boolean
  fork: boolean
  language?: string
  stargazers_count: number
  forks_count: number
  updated_at: string
  html_url: string
}

interface Emits {
  (e: 'save-all'): void
}

const emit = defineEmits<Emits>()

// États réactifs
const repositories = ref<Repository[]>([])
const loading = ref(true)
const saving = ref(false)
const totalCount = ref(0)
const userRole = ref<string>('basic')

// Fetch repositories directement dans le composant
const fetchRepositories = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/repositories')
    repositories.value = data.repositories || []
    totalCount.value = data.total_count || 0
    console.log(`Frontend: Récupéré ${repositories.value.length} repositories depuis toutes les installations`)
    console.log(`Frontend: API indique ${data.total_count} repositories au total`)
    console.log('Frontend: Données complètes reçues:', data)
  } catch (error) {
    console.error('Erreur lors de la récupération des repositories:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de récupérer les repositories',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Debug: Surveiller les changements de repositories
watch(repositories, (newVal) => {
  console.log('Repositories changed:', newVal)
  console.log('Repositories length:', newVal.length)
}, { immediate: true })

const fetchUserRole = async () => {
  try {
    const data = await $fetch('/api/user/profile')
    userRole.value = data.data.role || 'basic'
  } catch (error) {
    console.error('Erreur lors de la récupération du rôle utilisateur:', error)
    userRole.value = 'basic'
  }
}

// Chargement initial
onMounted(async () => {
  await Promise.all([
    fetchRepositories(),
    fetchUserRole()
  ])
})

const columns = [
  {
    accessorKey: 'name',
    header: 'Repository',
    cell: ({ row }: any) => {
      const UBadge = resolveComponent('UBadge')
      return h('div', { class: 'space-y-1' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h('span', { class: 'font-medium' }, row.getValue('name')),
          row.original.private ? h(UBadge, { color: 'warning', size: 'xs' }, () => 'Privé') : null,
          row.original.fork ? h(UBadge, { color: 'info', size: 'xs' }, () => 'Fork') : null
        ]),
        h('div', { class: 'text-sm text-gray-500 dark:text-gray-400' }, row.original.full_name),
        row.original.description ? h('div', { class: 'text-sm text-gray-500 dark:text-gray-400 line-clamp-2 max-w-xs break-words' }, row.original.description) : null
      ])
    }
  },
  {
    accessorKey: 'language',
    header: 'Langage & Stats',
    cell: ({ row }: any) => {
      return h('div', { class: 'flex flex-col gap-1 text-xs' }, [
        row.original.language ? h('span', { class: 'flex items-center gap-1' }, [
          h('div', { class: 'w-2 h-2 rounded-full bg-blue-500' }),
          row.original.language
        ]) : null,
        h('span', { class: 'text-gray-500' }, `⭐ ${row.original.stargazers_count || 0}`),
        h('span', { class: 'text-gray-500' }, `🍴 ${row.original.forks_count || 0}`)
      ])
    }
  },
  {
    accessorKey: 'updated_at',
    header: 'Dernière MAJ',
    cell: ({ row }: any) => {
      return h('span', { class: 'text-sm' }, formatDate(row.original.updated_at))
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }: any) => {
      const UButton = resolveComponent('UButton')
      const UIcon = resolveComponent('UIcon')
      return h(UButton, {
        to: row.original.html_url,
        target: '_blank',
        variant: 'ghost',
        size: 'sm'
      }, {
        leading: () => h(UIcon, { name: 'i-heroicons-arrow-top-right-on-square' }),
        default: () => 'Voir'
      })
    }
  }
]

const saveAllRepos = async () => {
  if (repositories.value.length === 0) {
    toast.add({
      title: 'Attention',
      description: 'Aucun repository sélectionné pour lancer les backups',
      color: 'warning'
    })
    return
  }

  saving.value = true
  try {
    const allRepoNames = repositories.value.map(repo => repo.full_name)
    
    await $fetch('/api/repositories/save', {
      method: 'POST',
      body: {
        repositories: allRepoNames
      }
    })
    
    toast.add({
      title: 'Succès',
      description: `Backup groupé créé pour ${repositories.value.length} repositories`,
      color: 'success'
    })
    
    // Émettre l'événement pour permettre au parent de mettre à jour le worker status
    emit('save-all')
  } catch (error: any) {
    console.error('Erreur lors du lancement des backups:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de lancer les backups',
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

const formatDate = (date: string) => {
  if (!date) return 'No date'
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return 'Invalid date'
    return d.toLocaleDateString('fr-FR')
  } catch (error) {
    console.error('Date formatting error:', error, 'for value:', date)
    return 'Date error'
  }
}
</script>