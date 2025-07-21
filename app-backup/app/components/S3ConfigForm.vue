<template>
  <UCard>
    <template #header>
      <h2 class="text-xl font-semibold">
        {{ isEditing ? 'Modifier la configuration S3' : 'Ajouter une configuration S3' }}
      </h2>
    </template>

    <UForm :state="form" @submit="submitForm" class="space-y-6">
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
      <UFormField label="Access Key ID" name="accessKeyId" required>
        <UInput
          v-model="form.accessKeyId"
          type="password"
          placeholder="Votre Access Key ID"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <!-- Secret Access Key -->
      <UFormField label="Secret Access Key" name="secretAccessKey" required>
        <UInput
          v-model="form.secretAccessKey"
          type="password"
          placeholder="Votre Secret Access Key"
          size="lg"
          class="w-full"
        />
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
      <div class="flex justify-end gap-3">
        <UButton
          v-if="isEditing"
          @click="cancelEdit"
          variant="ghost"
        >
          Annuler
        </UButton>
        <UButton
          type="submit"
          :loading="isSubmitting"
        >
          {{ isEditing ? 'Modifier' : 'Ajouter' }}
        </UButton>
      </div>
    </UForm>
  </UCard>
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
  editingConfig?: any
}

const props = defineProps<Props>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const toast = useToast()

// États réactifs
const isEditing = computed(() => !!props.editingConfig)
const isSubmitting = ref(false)

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

// Watcher pour remplir le formulaire en mode édition
watch(() => props.editingConfig, (config) => {
  if (config) {
    form.value = {
      name: config.name || '',
      endpoint: config.endpoint || '',
      region: config.region || '',
      bucket: config.bucket || '',
      accessKeyId: '',
      secretAccessKey: '',
      forcePathStyle: config.forcePathStyle || false,
      isDefault: config.isDefault || false
    }
  } else {
    resetForm()
  }
}, { immediate: true })

const submitForm = async () => {
  isSubmitting.value = true
  
  try {
    const payload = {
      name: form.value.name,
      endpoint: form.value.endpoint,
      region: form.value.region,
      bucket: form.value.bucket,
      accessKeyId: form.value.accessKeyId,
      secretAccessKey: form.value.secretAccessKey,
      forcePathStyle: form.value.forcePathStyle,
      isDefault: form.value.isDefault
    }

    if (isEditing.value) {
      await $fetch(`/api/s3/${props.editingConfig.id}`, {
        method: 'PUT',
        body: payload
      })
      toast.add({
        title: 'Succès',
        description: 'Configuration S3 modifiée avec succès',
        color: 'success'
      })
    } else {
      await $fetch('/api/s3', {
        method: 'POST',
        body: payload
      })
      toast.add({
        title: 'Succès',
        description: 'Configuration S3 ajoutée avec succès',
        color: 'success'
      })
    }

    resetForm()
    emit('saved')
  } catch (error: any) {
    console.error('Erreur lors de la soumission du formulaire:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de sauvegarder la configuration S3',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}

const cancelEdit = () => {
  resetForm()
  emit('cancel')
}
</script>