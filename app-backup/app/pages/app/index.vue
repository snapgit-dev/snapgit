<template>
  <UDashboardPanel>
    <template #body>
      <UContainer>
        <div class="py-8 space-y-6">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
              Repositories
            </h1>
            <p class="mt-2 text-gray-600 dark:text-gray-400">
              Tous les repositories de vos installations GitHub
            </p>
          </div>

          <!-- Statut du Worker -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <UIcon name="i-heroicons-cpu-chip" class="w-5 h-5" />
                  <span class="font-medium">Statut Worker</span>
                  <UBadge 
                    :color="workerStatus?.isWorkerRunning ? 'success' : 'neutral'"
                    size="sm"
                  >
                    {{ workerStatus?.isWorkerRunning ? 'Actif' : 'Inactif' }}
                  </UBadge>
                </div>
                <div class="flex items-center space-x-4 text-sm">
                  <span>En attente: {{ workerStatus?.pending || 0 }}</span>
                  <span>En cours: {{ workerStatus?.running || 0 }}</span>
                  <span>Terminés: {{ workerStatus?.completed || 0 }}</span>
                  <UButton 
                    @click="refreshWorkerStatus" 
                    variant="ghost" 
                    size="xs"
                    :loading="loadingWorkerStatus"
                  >
                    <UIcon name="i-heroicons-arrow-path" />
                  </UButton>
                </div>
              </div>
            </template>
          </UCard>

          <RepositoryTable
            @save-all="refreshWorkerStatus"
          />

          <GroupTaskTable />
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
const toast = useToast()

// États réactifs (plus besoin des repositories car ils sont dans le composant)

// Worker status
const workerStatus = ref<any>(null)
const loadingWorkerStatus = ref(false)

// Plus besoin des group tasks car ils sont dans le composant

// Méthodes

const refreshWorkerStatus = async () => {
  loadingWorkerStatus.value = true
  try {
    const data = await $fetch('/api/worker/status')
    workerStatus.value = data.data
  } catch (error) {
    console.error('Erreur lors de la récupération du statut worker:', error)
  } finally {
    loadingWorkerStatus.value = false
  }
}


// Chargement initial
onMounted(() => {
  refreshWorkerStatus()
})
</script>