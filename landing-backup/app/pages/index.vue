<script setup>
const features = {
  title: 'Key Features',
  description: 'Reliable, automated, and restorable GitHub backups at any time.',
  items: [
    {
      icon: 'i-heroicons-cloud-arrow-down',
      title: 'Backup GitHub → S3',
      description: 'Export one or all your GitHub repositories to AWS, Scaleway, MinIO, Wasabi, and more in one click.'
    },
    {
      icon: 'i-heroicons-arrow-path',
      title: 'Scheduled Backups',
      description: 'Set a frequency (daily, weekly, custom) and get notified if something goes wrong.'
    },
    {
      icon: 'i-heroicons-cpu-chip',
      title: 'Monitoring & Logs',
      description: 'Real-time tracking of backup/restore jobs, detailed history.'
    },
    {
      icon: 'i-heroicons-lock-closed',
      title: 'Security & Roles',
      description: 'GitHub OAuth login, team permissions, granular access control.'
    },
    {
      icon: 'i-heroicons-folder-open',
      title: 'S3 Explorer',
      description: 'Browse, restore, or delete your archives directly in Snapgit.'
    },
    {
      icon: 'i-heroicons-credit-card',
      title: 'SaaS',
      description: 'Use this application as a service with all features included, or self-host for free.'
    }
  ]
}
</script>

<template>
  <div>
    <!-- HERO -->
    <UPageHero
      title="Backup your GitHub to your own S3"
      description="Snapgit is an open source tool to automate backups of your GitHub repositories to any S3-compatible storage (AWS, Scaleway, MinIO and more)."
      :links="[
        {
          label: 'Start my backup',
          to: '/app',
          icon: 'i-heroicons-cloud-arrow-down',
          size: 'xl',
          color: 'primary',
        },
        {
          label: 'View source on GitHub',
          to: 'https://github.com/killianmahe/snapgit',
          target: '_blank',
          icon: 'i-simple-icons-github',
          size: 'xl',
          color: 'neutral',
          variant: 'subtle',
        }
      ]"
      image="/snapgit-hero.svg"
    />
    <!-- FONCTIONNALITÉS -->
    <UPageSection
      :title="features.title"
      :description="features.description"
    >
      <UPageGrid>
        <UPageCard
          v-for="(item, index) in features.items"
          :key="index"
          v-bind="item"
          spotlight
        />
      </UPageGrid>
    </UPageSection>

    <!-- POURQUOI -->
    <UPageSection
      id="why-backup"
      title="Why backup GitHub?"
      description="Protect your code from accidental deletion, ransomware, or account loss. Keep a full copy in your own S3 storage."/>


    <!-- CTA FINAL -->
    <UPageSection>
      <UPageCTA
        title="Try Snapgit for free – open source, no lock-in, no credit card."
        description="Connect your GitHub, configure your S3, and launch your first backup in minutes. SSelf-host Snapgit for free, or choose SaaS for easy setup."
        variant="subtle"
        :links="[
          {
            label: 'Start my backup',
            to: '/app',
            icon: 'i-heroicons-cloud-arrow-down',
            color: 'primary'
          },
          {
            label: 'View source on GitHub',
            to: 'https://github.com/killianmahe/snapgit',
            target: '_blank',
            trailingIcon: 'i-simple-icons-github',
            color: 'neutral',
            variant: 'subtle'
          }
        ]"
      />
    </UPageSection>
  </div>
</template>