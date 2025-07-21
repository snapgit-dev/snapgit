<template>
  <UContainer>
    <div class="py-8 space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Paramètres
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Gérez vos paramètres et configurations
        </p>
      </div>


      <!-- Connexion GitHub App -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">
            Connexion GitHub App
          </h2>
        </template>

        <div v-if="loadingGithubStatus" class="space-y-4">
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-10 w-48" />
        </div>

        <div v-else class="space-y-4">
          <UAlert
            v-if="route.query.success === 'github_app_installed'"
            color="green"
            variant="soft"
            title="Succès"
            description="Votre GitHub App a été installée avec succès !"
          />
          
          <UAlert
            v-if="route.query.error === 'github_app_auth_failed'"
            color="red"
            variant="soft"
            title="Erreur"
            description="Erreur lors de la connexion à GitHub App. Veuillez réessayer."
          />

          <p class="text-gray-600 dark:text-gray-400">
            {{ hasGithubApp ? 'Modifiez les droits de votre GitHub App sur vos repositories.' : 'Installez notre GitHub App sur vos repositories pour permettre l\'interaction avec vos projets.' }}
          </p>

          <UButton
            @click="installGitHubApp"
            variant="outline"
            size="lg"
            :loading="isInstalling"
          >
            <template #leading>
              <UIcon name="i-simple-icons-github" class="w-5 h-5" />
            </template>
            {{ hasGithubApp ? 'Modifier les droits GitHub' : 'Installer GitHub App' }}
          </UButton>
        </div>
      </UCard>

      <!-- Abonnement -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">
              Abonnement
            </h2>
            <UButton
              to="/app/settings/subscription"
              icon="i-heroicons-credit-card"
              size="sm"
            >
              Gérer l'abonnement
            </UButton>
          </div>
        </template>

        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-medium text-gray-900 dark:text-white">
              Plan actuel
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Gérez votre abonnement et accédez aux fonctionnalités premium
            </p>
          </div>
          <UBadge 
            :color="userRole === 'paid' ? 'success' : 'gray'"
            size="lg"
          >
            {{ userRole === 'paid' ? 'Premium' : 'Gratuit' }}
          </UBadge>
        </div>
      </UCard>

      <!-- Configurations S3 -->
      <S3ConfigList />

    </div>
  </UContainer>
</template>

<script setup lang="ts">
const toast = useToast()
const route = useRoute()

// États réactifs
const isInstalling = ref(false)
const hasGithubApp = ref(false)
const loadingGithubStatus = ref(true)
const userRole = ref<string>('basic')

const installGitHubApp = () => {
  isInstalling.value = true
  window.location.href = '/api/auth/github-app'
}

const checkGithubAppStatus = async () => {
  try {
    const data = await $fetch('/api/repositories')
    hasGithubApp.value = data.repositories && data.repositories.length > 0
  } catch (error) {
    hasGithubApp.value = false
  } finally {
    loadingGithubStatus.value = false
  }
}


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
    checkGithubAppStatus(),
    fetchUserRole()
  ])
})
</script>