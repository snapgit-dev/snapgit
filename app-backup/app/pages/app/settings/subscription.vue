<template>
  <UDashboardPanel>
    <template #body>
      <UContainer>
        <div class="py-8 space-y-6">
          <!-- Header -->
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                Abonnement
              </h1>
              <p class="mt-2 text-gray-600 dark:text-gray-400">
                Gérez votre abonnement et accédez aux fonctionnalités premium
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

          <!-- Plan actuel -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold">Plan actuel</h2>
                <UBadge 
                  :color="user?.role === 'paid' ? 'success' : 'neutral'"
                  size="lg"
                >
                  {{ getRoleBadge(user?.role) }}
                </UBadge>
              </div>
            </template>

            <div class="space-y-4">
              <div v-if="user?.role === 'basic'" class="text-center py-8">
                <UIcon name="i-heroicons-lock-closed" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Compte gratuit
                </h3>
                <p class="text-gray-600 dark:text-gray-400 mb-4">
                  Passez au plan payant pour accéder aux backups et à la gestion S3
                </p>
              </div>

              <div v-else-if="user?.role === 'paid'" class="text-center py-8">
                <UIcon name="i-heroicons-check-circle" class="w-12 h-12 mx-auto text-green-500 mb-4" />
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Plan Premium actif
                </h3>
                <p class="text-gray-600 dark:text-gray-400 mb-4">
                  Vous avez accès à toutes les fonctionnalités
                </p>
              </div>

              <!-- Informations d'usage -->
              <div v-if="user?.usage" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div class="text-2xl font-bold text-gray-900 dark:text-white">
                    {{ user.usage.repositories || 0 }}
                  </div>
                  <div class="text-sm text-gray-500">Repositories sauvegardés</div>
                </div>
                <div class="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div class="text-2xl font-bold text-gray-900 dark:text-white">
                    {{ user.usage.backups || 0 }}
                  </div>
                  <div class="text-sm text-gray-500">Backups créés</div>
                </div>
                <div class="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div class="text-2xl font-bold text-gray-900 dark:text-white">
                    {{ formatStorage(user.usage.storage || 0) }}
                  </div>
                  <div class="text-sm text-gray-500">Stockage utilisé</div>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Plans disponibles -->
          <UCard>
            <template #header>
              <h2 class="text-xl font-semibold">Plans disponibles</h2>
            </template>

            <ScriptLemonSqueezy 
              @lemon-squeezy-event="handleLemonSqueezyEvent"
              @ready="lemonSqueezyReady = true"
            >
              <UPricingTable :tiers="tiers" :sections="sections" />
            </ScriptLemonSqueezy>
          </UCard>

          <!-- Actions d'administration (seulement pour les admins) -->
          <UCard v-if="user?.role === 'admin'">
            <template #header>
              <h2 class="text-xl font-semibold">Administration</h2>
            </template>
            
            <div class="space-y-4">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                En tant qu'administrateur, vous pouvez modifier votre rôle pour tester l'application.
              </p>
              
              <div class="flex gap-2">
                <UButton
                  @click="setRole('basic')"
                  variant="outline"
                  size="sm"
                  :loading="changing"
                >
                  Tester Basic
                </UButton>
                <UButton
                  @click="setRole('paid')"
                  variant="outline"
                  size="sm"
                  :loading="changing"
                >
                  Tester Premium
                </UButton>
                <UButton
                  @click="setRole('admin')"
                  color="error"
                  size="sm"
                  :loading="changing"
                >
                  Retour Admin
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
const toast = useToast()

interface User {
  role: 'basic' | 'paid' | 'admin'
  usage: {
    repositories: number
    backups: number
    storage: number
    resetDate: string
  }
}

// États réactifs
const user = ref<User | null>(null)
const loading = ref(true)
const changing = ref(false)

// Variables pour Lemon Squeezy
const lemonSqueezyReady = ref(false)
const lemonSqueezyEvents = ref<any[]>([])

// Configuration des plans avec UPricingTable
const tiers = ref([
  {
    id: 'basic',
    title: 'Basic',
    price: 'Gratuit',
    description: 'Pour explorer l\'application',
    button: {
      label: user.value?.role === 'basic' ? 'Plan actuel' : 'Rétrograder',
      variant: user.value?.role === 'basic' ? 'ghost' : 'outline',
      disabled: user.value?.role === 'basic',
      onClick: () => user.value?.role !== 'basic' ? downgradeToPlan('basic') : null
    }
  },
  {
    id: 'paid',
    title: 'Premium',
    price: '1,99€',
    description: 'Configuration S3 et backups CRON',
    billingCycle: '/mois',
    button: {
      label: user.value?.role === 'paid' ? 'Plan actuel' : 'Passer au Premium',
      to: user.value?.role !== 'paid' ? 'https://smartcve.lemonsqueezy.com/buy/c14caaab-6395-47dd-b5e7-6064f411e863?embed=1' : undefined,
      disabled: user.value?.role === 'paid'
    }
  }
])

const sections = ref([
  {
    title: 'Fonctionnalités',
    features: [
      {
        title: 'Visualisation des repositories',
        tiers: {
          basic: true,
          paid: true
        }
      },
      {
        title: 'Installation GitHub App',
        tiers: {
          basic: true,
          paid: true
        }
      },
      {
        title: 'Configuration S3',
        tiers: {
          basic: false,
          paid: true
        }
      },
      {
        title: 'Backups CRON',
        tiers: {
          basic: false,
          paid: true
        }
      },
      {
        title: 'Navigation S3',
        tiers: {
          basic: false,
          paid: true
        }
      },
      {
        title: 'Support prioritaire',
        tiers: {
          basic: false,
          paid: true
        }
      }
    ]
  }
])

// Méthodes
const fetchUser = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/user/profile')
    user.value = data.data
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de récupérer les informations du profil',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const setRole = async (newRole: string) => {
  changing.value = true
  try {
    await $fetch('/api/user/role', {
      method: 'POST',
      body: { role: newRole }
    })
    
    toast.add({
      title: 'Succès',
      description: `Rôle modifié vers ${newRole}`,
      color: 'success'
    })
    
    await fetchUser()
    
    // Rediriger pour actualiser les permissions
    await navigateTo('/app/settings')
  } catch (error: any) {
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de modifier le rôle',
      color: 'error'
    })
  } finally {
    changing.value = false
  }
}

const upgradeToPlan = async (plan: string) => {
  changing.value = true
  try {
    // TODO: Intégrer avec Stripe ou autre système de paiement
    await setRole(plan)
  } catch (error) {
    console.error('Erreur lors de l\'upgrade:', error)
  } finally {
    changing.value = false
  }
}

const downgradeToPlan = async (plan: string) => {
  if (confirm('Êtes-vous sûr de vouloir rétrograder votre plan ? Vous perdrez l\'accès aux fonctionnalités premium.')) {
    await setRole(plan)
  }
}

const getRoleBadge = (role?: string) => {
  switch (role) {
    case 'basic':
      return 'Gratuit'
    case 'paid':
      return 'Premium'
    case 'admin':
      return 'Administrateur'
    default:
      return 'Inconnu'
  }
}

const formatStorage = (bytes: number) => {
  if (bytes === 0) return '0 MB'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

// Gestion des événements Lemon Squeezy
const handleLemonSqueezyEvent = async (event: any) => {
  lemonSqueezyEvents.value.push(event)
  
  if (event.event === 'Checkout.Success') {
    // L'utilisateur a payé avec succès
    toast.add({
      title: 'Paiement réussi !',
      description: 'Votre plan Premium a été activé',
      color: 'success'
    })
    
    // Marquer l'utilisateur comme premium
    await setRole('paid')
  }
}

// Chargement initial
onMounted(() => {
  fetchUser()
})
</script>