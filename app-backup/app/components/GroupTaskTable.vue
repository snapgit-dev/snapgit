<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">
          Backups Groupés ({{ groupTasks.length }})
        </h2>
        <UButton
          @click="refreshGroupTasks"
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
      <USkeleton class="h-16 w-full" v-for="i in 3" :key="i" />
    </div>

    <div v-else-if="groupTasks.length === 0" class="text-center py-8">
      <UIcon name="i-heroicons-archive-box" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Aucun backup groupé
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        Créez un backup groupé en cliquant sur le bouton "Créer backup groupé" ci-dessus.
      </p>
    </div>

    <UTable
      v-else
      :data="groupTasks"
      :columns="columns"
    />
  </UCard>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'

const toast = useToast()

interface GroupTask {
  id: string
  name: string
  description: string
  lastStatus: 'pending' | 'running' | 'success' | 'error' | null
  lastError?: string
  s3FolderPath: string
  createdAt: string
  lastRun?: string
  repositoriesCount: number
}

// États réactifs
const groupTasks = ref<GroupTask[]>([])
const loading = ref(false)

// Fetch group tasks directement dans le composant
const refreshGroupTasks = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/group-tasks')
    groupTasks.value = data.data || []
    console.log(`Récupéré ${groupTasks.value.length} group tasks`)
  } catch (error) {
    console.error('Erreur lors de la récupération des group tasks:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de récupérer les backups groupés',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Chargement initial
onMounted(() => {
  refreshGroupTasks()
})

const getStatusColor = (status: string | null) => {
  switch (status) {
    case 'success':
      return 'success'
    case 'error':
      return 'error'
    case 'running':
      return 'primary'
    case 'pending':
      return 'warning'
    default:
      return 'neutral'
  }
}

const formatDate = (date: string) => {
  if (!date) return 'N/A'
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return 'Date invalide'
    return d.toLocaleDateString('fr-FR')
  } catch (error) {
    return 'Erreur de date'
  }
}

const columns = [
  {
    accessorKey: 'name',
    header: 'Nom du Backup',
    cell: ({ row }: any) => {
      const UBadge = resolveComponent('UBadge')
      return h('div', { class: 'space-y-1' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h('span', { class: 'font-medium' }, row.getValue('name')),
          h(UBadge, { 
            color: getStatusColor(row.original.lastStatus), 
            size: 'sm' 
          }, () => row.original.lastStatus || 'En attente')
        ]),
        h('div', { class: 'text-sm text-gray-600 dark:text-gray-400' }, row.original.description),
        row.original.lastError ? h('div', { class: 'text-xs text-red-500 mt-1' }, `Erreur: ${row.original.lastError}`) : null
      ])
    }
  },
  {
    accessorKey: 'repositoriesCount',
    header: 'Repositories',
    cell: ({ row }: any) => {
      return h('div', { class: 'text-center' }, [
        h('span', { class: 'text-lg font-semibold' }, row.getValue('repositoriesCount') || 0),
        h('div', { class: 'text-xs text-gray-500' }, 'repos')
      ])
    }
  },
  {
    accessorKey: 's3FolderPath',
    header: 'Dossier S3',
    cell: ({ row }: any) => {
      return h('div', { class: 'max-w-xs' }, [
        h('span', { class: 'text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs truncate block' }, 
          row.getValue('s3FolderPath'))
      ])
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'Créé le',
    cell: ({ row }: any) => {
      return h('div', { class: 'text-sm' }, [
        h('div', {}, formatDate(row.getValue('createdAt'))),
        row.original.lastRun ? h('div', { class: 'text-xs text-gray-500' }, 
          `Dernière exec: ${formatDate(row.original.lastRun)}`) : null
      ])
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }: any) => {
      const UButton = resolveComponent('UButton')
      const UIcon = resolveComponent('UIcon')
      return h('div', { class: 'flex gap-2' }, [
        h(UButton, {
          variant: 'ghost',
          size: 'sm',
          onClick: () => refreshGroupTasks()
        }, {
          leading: () => h(UIcon, { name: 'i-heroicons-arrow-path' }),
          default: () => 'Actualiser'
        })
      ])
    }
  }
]
</script>