<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">
          Configurations S3
        </h2>
        <UButton
          @click="fetchConfigs"
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
      <USkeleton class="h-24 w-full" v-for="i in 3" :key="i" />
    </div>

    <div v-else-if="configs.length === 0" class="text-center py-8">
      <UIcon name="i-heroicons-cloud" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Aucune configuration S3
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        Ajoutez votre première configuration S3 ci-dessus.
      </p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="config in configs"
        :key="config._id || config.id"
        class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
      >
        <div class="flex-1">
          <div class="flex items-center gap-3">
            <h3 class="font-medium text-gray-900 dark:text-white">
              {{ config.name }}
            </h3>
            <UBadge v-if="config.isDefault" color="primary" size="xs">
              Par défaut
            </UBadge>
          </div>
          <div class="mt-1 space-y-1">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              <strong>Endpoint:</strong> {{ config.endpoint }}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              <strong>Région:</strong> {{ config.region }} | <strong>Bucket:</strong> {{ config.bucket }}
            </p>
            <div class="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span v-if="config.forcePathStyle">Path Style activé</span>
              <span>Créé le {{ formatDate(config.createdAt) }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="userRole === 'paid' || userRole === 'admin'"
            :to="`/app/s3/view/${config._id || config.id}`"
            variant="ghost"
            size="sm"
          >
            <template #leading>
              <UIcon name="i-heroicons-folder-open" />
            </template>
            Parcourir
          </UButton>
          <UButton
            v-if="userRole === 'paid' || userRole === 'admin'"
            @click="testConnection(config)"
            variant="ghost"
            size="sm"
            :loading="testingConnection === (config._id || config.id)"
          >
            <template #leading>
              <UIcon name="i-heroicons-wifi" />
            </template>
            Tester
          </UButton>
          <UButton
            v-if="userRole === 'paid' || userRole === 'admin'"
            @click="editConfig(config)"
            variant="ghost"
            size="sm"
          >
            <template #leading>
              <UIcon name="i-heroicons-pencil-square" />
            </template>
            Modifier
          </UButton>
          <UButton
            v-if="userRole === 'paid' || userRole === 'admin'"
            @click="deleteConfig(config._id || config.id)"
            color="error"
            variant="ghost"
            size="sm"
          >
            <template #leading>
              <UIcon name="i-heroicons-trash" />
            </template>
            Supprimer
          </UButton>
          <UButton
            v-if="userRole === 'basic'"
            to="/app/settings/subscription"
            color="blue"
            size="sm"
          >
            <template #leading>
              <UIcon name="i-heroicons-lock-closed" />
            </template>
            Premium requis
          </UButton>
        </div>
      </div>
    </div>

    <!-- Modal de modification -->
    <S3ConfigUpdateForm
      v-model:model-value="showUpdateModal"
      :config-id="editingConfigId"
      @saved="onConfigUpdated"
    />
  </UCard>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  edit: [config: any]
}>()

const toast = useToast()

// États réactifs
const configs = ref<any[]>([])
const loading = ref(true)
const testingConnection = ref<string | null>(null)
const showUpdateModal = ref(false)
const editingConfigId = ref<string | null>(null)
const userRole = ref<string>('basic')

// Méthodes
const fetchConfigs = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/s3')
    configs.value = data.data || []
  } catch (error) {
    console.error('Erreur lors de la récupération des configurations S3:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de récupérer les configurations S3',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const editConfig = (config: any) => {
  console.log('S3ConfigList - Edit config clicked:', config)
  editingConfigId.value = config._id || config.id
  showUpdateModal.value = true
  console.log('S3ConfigList - Modal should open with config ID:', editingConfigId.value)
}

const onConfigUpdated = async () => {
  await fetchConfigs()
  editingConfigId.value = null
}

const deleteConfig = async (id: string) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette configuration S3 ?')) {
    try {
      await $fetch(`/api/s3/${id}`, {
        method: 'DELETE'
      })
      toast.add({
        title: 'Succès',
        description: 'Configuration S3 supprimée avec succès',
        color: 'success'
      })
      await fetchConfigs()
    } catch (error: any) {
      toast.add({
        title: 'Erreur',
        description: error.data?.message || 'Impossible de supprimer la configuration S3',
        color: 'error'
      })
    }
  }
}

const testConnection = async (config: any) => {
  testingConnection.value = config._id || config.id
  try {
    await $fetch(`/api/s3/${config._id || config.id}/test`, {
      method: 'POST'
    })
    toast.add({
      title: 'Connexion réussie',
      description: `La connexion à ${config.name} fonctionne correctement`,
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Échec de la connexion',
      description: error.data?.message || `Impossible de se connecter à ${config.name}`,
      color: 'error'
    })
  } finally {
    testingConnection.value = null
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR')
}

// Exposition de la méthode pour rafraîchir depuis le parent
defineExpose({
  fetchConfigs
})

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
    fetchConfigs(),
    fetchUserRole()
  ])
})
</script>