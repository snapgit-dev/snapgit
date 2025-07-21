<template>
  <UDashboardPanel>
    <template #body>
      <UContainer>
        <div class="py-8 space-y-8">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
              Configurations S3
            </h1>
            <p class="mt-2 text-gray-600 dark:text-gray-400">
              Gérez vos configurations de stockage S3
            </p>
          </div>

          <!-- Formulaire de création -->
          <S3ConfigForm
            @saved="onConfigSaved"
          />

          <!-- Liste des configurations existantes -->
          <S3ConfigList ref="configListRef" />
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
// Référence au composant liste pour pouvoir le rafraîchir
const configListRef = ref()

// Méthodes
const onConfigSaved = async () => {
  // Rafraîchir la liste après création d'une nouvelle config
  if (configListRef.value?.fetchConfigs) {
    await configListRef.value.fetchConfigs()
  }
}
</script>