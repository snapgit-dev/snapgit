import mongoose, { Schema, Document } from 'mongoose'

export type UserRole = 'basic' | 'paid' | 'admin'

export type SubscriptionStatus = 'active' | 'inactive' | 'canceled' | 'past_due' | 'trial'

export interface Subscription {
  status: SubscriptionStatus;
  planId?: string;
  customerId?: string;
  subscriptionId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: Date;
}

export interface Usage {
  repositories: number;
  backups: number;
  storage: number; // en MB
  resetDate: Date; // Date de reset mensuel
}

export interface User {
  githubId: string;
  username: string;
  email?: string;
  name?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  githubAppInstallationIds?: string[];
  githubAppInstalledAt?: Date;
  role: UserRole;
  subscription: Subscription;
  usage: Usage;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDocument extends User, Document {}

const subscriptionSchema = new Schema({
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'canceled', 'past_due', 'trial'], 
    default: 'inactive' 
  },
  planId: { type: String },
  customerId: { type: String },
  subscriptionId: { type: String },
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  trialEnd: { type: Date }
}, { _id: false })

const usageSchema = new Schema({
  repositories: { type: Number, default: 0 },
  backups: { type: Number, default: 0 },
  storage: { type: Number, default: 0 }, // en MB
  resetDate: { type: Date, default: () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) }
}, { _id: false })

const userSchema = new Schema<UserDocument>({
  githubId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  email: { type: String },
  name: { type: String },
  avatar: { type: String },
  bio: { type: String },
  location: { type: String },
  githubAppInstallationIds: { type: [String], default: [] },
  githubAppInstalledAt: { type: Date },
  role: { 
    type: String, 
    enum: ['basic', 'paid', 'admin'], 
    default: 'basic' 
  },
  subscription: { 
    type: subscriptionSchema, 
    default: () => ({ status: 'inactive' }) 
  },
  usage: { 
    type: usageSchema, 
    default: () => ({ repositories: 0, backups: 0, storage: 0, resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) }) 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

userSchema.pre('save', function() {
  this.updatedAt = new Date()
})

// Méthodes d'instance
userSchema.methods.hasPermission = function(action: string): boolean {
  if (this.role === 'admin') return true
  
  const permissions = {
    basic: ['view_repositories', 'install_github_app'],
    paid: ['view_repositories', 'install_github_app', 'create_backups', 'download_backups', 'manage_s3', 'browse_s3']
  }
  
  return permissions[this.role]?.includes(action) || false
}

userSchema.methods.isPaid = function(): boolean {
  return this.role === 'paid' || this.role === 'admin'
}

userSchema.methods.canPerformBackup = function(): boolean {
  return this.hasPermission('create_backups')
}

userSchema.methods.canManageS3 = function(): boolean {
  return this.hasPermission('manage_s3')
}

userSchema.methods.incrementUsage = function(type: 'repositories' | 'backups' | 'storage', amount: number = 1): void {
  // Reset usage si on est dans un nouveau mois
  const now = new Date()
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  
  if (now >= this.usage.resetDate) {
    this.usage.repositories = 0
    this.usage.backups = 0
    this.usage.storage = 0
    this.usage.resetDate = resetDate
  }
  
  this.usage[type] += amount
}

export const UserModel = mongoose.models.User || mongoose.model<UserDocument>('User', userSchema)