<template>
  <UModal 
    v-model:open="isOpen" 
    title="Modifier la configuration S3"
    :close="{
      color: 'gray',
      variant: 'ghost',
      class: 'rounded-full'
    }"
  >
    <template #body>
      <div v-if="loading" class="space-y-4 p-6">
        <USkeleton class="h-12 w-full" v-for="i in 6" :key="i" />
      </div>

      <UForm v-else :state="form" @submit="submitForm" class="space-y-6 p-6">
        <!-- Nom de la configuration -->
        <UFormField label="Nom de la configuration" name="name" required>
          <UInput
            v-model="form.name"
            placeholder="ex: Mon serveur S3"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <!-- Endpoint -->
        <UFormField label="Endpoint" name="endpoint" required>
          <UInput
            v-model="form.endpoint"
            placeholder="ex: https://s3.amazonaws.com"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <!-- Région -->
        <UFormField label="Région" name="region" required>
          <UInput
            v-model="form.region"
            placeholder="ex: us-east-1"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <!-- Bucket -->
        <UFormField label="Bucket" name="bucket" required>
          <UInput
            v-model="form.bucket"
            placeholder="ex: mon-bucket"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <!-- Access Key ID -->
        <UFormField label="Access Key ID (optionnel)" name="accessKeyId">
          <UInput
            v-model="form.accessKeyId"
            type="password"
            placeholder="••••••••••••••••"
            size="lg"
            class="w-full"
          />
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Laisser vide pour conserver la clé d'accès actuelle
          </p>
        </UFormField>

        <!-- Secret Access Key -->
        <UFormField label="Secret Access Key (optionnel)" name="secretAccessKey">
          <UInput
            v-model="form.secretAccessKey"
            type="password"
            placeholder="••••••••••••••••••••••••••••••••••••••••"
            size="lg"
            class="w-full"
          />
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Laisser vide pour conserver la clé secrète actuelle
          </p>
        </UFormField>

        <!-- Options avancées -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Options avancées
          </h3>
          
          <!-- Force Path Style -->
          <UFormField label="Force Path Style" name="forcePathStyle">
            <UCheckbox
              v-model="form.forcePathStyle"
              label="Activer le style de chemin forcé"
            />
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Utilise le style d'URL avec le bucket dans le chemin au lieu du sous-domaine
            </p>
          </UFormField>

          <!-- Défaut -->
          <UFormField label="Configuration par défaut" name="isDefault">
            <UCheckbox
              v-model="form.isDefault"
              label="Définir comme configuration S3 par défaut"
            />
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Cette configuration sera utilisée par défaut pour les opérations S3
            </p>
          </UFormField>
        </div>

        <!-- Boutons d'action -->
        <div class="flex justify-end gap-3 pt-4">
          <UButton
            @click="closeModal"
            variant="ghost"
          >
            Annuler
          </UButton>
          <UButton
            type="submit"
            :loading="isSubmitting"
          >
            Modifier
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface S3FormData {
  name: string
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  isDefault: boolean
}

interface Props {
  modelValue: boolean
  configId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const toast = useToast()

// États réactifs
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const isSubmitting = ref(false)
const loading = ref(false)
const config = ref<any>(null)

// Formulaire
const form = ref<S3FormData>({
  name: '',
  endpoint: '',
  region: '',
  bucket: '',
  accessKeyId: '',
  secretAccessKey: '',
  forcePathStyle: false,
  isDefault: false
})

const resetForm = () => {
  form.value = {
    name: '',
    endpoint: '',
    region: '',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    forcePathStyle: false,
    isDefault: false
  }
}

// Fonction pour charger la configuration depuis l'API
const loadConfig = async () => {
  if (!props.configId) return
  
  loading.value = true
  try {
    const data = await $fetch(`/api/s3/${props.configId}`)
    config.value = data
    
    // Remplir le formulaire avec les données récupérées
    form.value = {
      name: data.name || '',
      endpoint: data.endpoint || '',
      region: data.region || '',
      bucket: data.bucket || '',
      accessKeyId: '',
      secretAccessKey: '',
      forcePathStyle: data.forcePathStyle || false,
      isDefault: data.isDefault || false
    }
    
    console.log('S3ConfigUpdateForm - Config loaded and form filled:', form.value)
  } catch (error) {
    console.error('Error loading S3 config:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de charger la configuration S3',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Watcher pour charger la config quand le modal s'ouvre et qu'on a un ID
watch(() => [props.modelValue, props.configId], ([isOpen, configId]) => {
  if (isOpen && configId) {
    loadConfig()
  } else if (!isOpen) {
    // Reset quand le modal se ferme
    config.value = null
    resetForm()
  }
})

const submitForm = async () => {
  if (!props.configId) {
    toast.add({
      title: 'Erreur',
      description: 'Aucune configuration à modifier',
      color: 'error'
    })
    return
  }

  isSubmitting.value = true
  
  try {
    const payload: any = {
      name: form.value.name,
      endpoint: form.value.endpoint,
      region: form.value.region,
      bucket: form.value.bucket,
      forcePathStyle: form.value.forcePathStyle,
      isDefault: form.value.isDefault
    }

    // Ajouter les clés seulement si elles sont remplies
    if (form.value.accessKeyId.trim()) {
      payload.accessKeyId = form.value.accessKeyId
    }
    if (form.value.secretAccessKey.trim()) {
      payload.secretAccessKey = form.value.secretAccessKey
    }

    await $fetch(`/api/s3/${props.configId}`, {
      method: 'PUT',
      body: payload
    })
    
    toast.add({
      title: 'Succès',
      description: 'Configuration S3 modifiée avec succès',
      color: 'success'
    })

    resetForm()
    emit('saved')
    closeModal()
  } catch (error: any) {
    console.error('Erreur lors de la modification:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de modifier la configuration S3',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}

const closeModal = () => {
  resetForm()
  emit('update:modelValue', false)
}
</script>