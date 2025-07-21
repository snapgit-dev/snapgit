import mongoose, { Schema, Document } from 'mongoose'

export interface TaskBackup {
  userId: string;
  name: string;
  description?: string;
  cronExpression?: string; // Rendu facultatif
  s3ConfigIds: string[];
  compressionLevel?: number;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  lastStatus?: 'pending' | 'running' | 'success' | 'error';
  lastError?: string;
  // Champs pour les repositories
  repositoryOwner?: string;
  repositoryName?: string;
  repositoryFullName?: string;
  executionMode?: 'sync' | 'worker';
  executeImmediately?: boolean; // Nouveau champ pour exécution immédiate
  createdBy?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskBackupDocument extends TaskBackup, Document {
  calculateNextRun(): Date | null;
  isValidCron(): boolean;
}

const taskBackupSchema = new Schema<TaskBackupDocument>({
  userId: { type: String, required: true, ref: 'User' },
  name: { type: String, required: true },
  description: { type: String },
  cronExpression: { type: String }, // Plus required
  s3ConfigIds: [{ type: String, ref: 'S3Config' }],
  compressionLevel: { type: Number, default: 9, min: 1, max: 9 },
  isActive: { type: Boolean, default: true },
  lastRun: { type: Date },
  nextRun: { type: Date },
  lastStatus: { 
    type: String, 
    enum: ['pending', 'running', 'success', 'error'],
    default: 'pending'
  },
  lastError: { type: String },
  // Champs pour les repositories
  repositoryOwner: { type: String },
  repositoryName: { type: String },
  repositoryFullName: { type: String },
  executionMode: { 
    type: String, 
    enum: ['sync', 'worker'], 
    default: 'worker' 
  },
  executeImmediately: { type: Boolean, default: false },
  createdBy: { type: String },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

taskBackupSchema.index({ userId: 1, name: 1 }, { unique: true })
taskBackupSchema.index({ userId: 1, isActive: 1 })
taskBackupSchema.index({ nextRun: 1, isActive: 1 })

taskBackupSchema.pre('save', function() {
  this.updatedAt = new Date()
  
  if (this.isModified('cronExpression') || this.isModified('isActive')) {
    const nextRun = this.calculateNextRun()
    this.nextRun = nextRun || undefined
  }
})

taskBackupSchema.methods.isValidCron = function(): boolean {
  // Si pas de cron expression, c'est valide (exécution immédiate)
  if (!this.cronExpression) {
    return true
  }
  const cronRegex = /^(\*|[0-5]?\d)(\s+(\*|[01]?\d|2[0-3]))(\s+(\*|[12]?\d|3[01]))(\s+(\*|[1-9]|1[012]))(\s+(\*|[0-6]))$/
  return cronRegex.test(this.cronExpression)
}

taskBackupSchema.methods.calculateNextRun = function(): Date | null {
  if (!this.isActive) {
    return null
  }
  
  // Si pas de cron expression, pas de prochaine exécution planifiée
  if (!this.cronExpression) {
    return null
  }
  
  if (!this.isValidCron()) {
    return null
  }
  
  const [minute, hour, day, month, dayOfWeek] = this.cronExpression.split(' ')
  const now = new Date()
  const next = new Date(now)
  
  // Simple cron calculation - in production, use a proper cron library like 'node-cron'
  if (minute !== '*') {
    next.setMinutes(parseInt(minute))
  }
  if (hour !== '*') {
    next.setHours(parseInt(hour))
  }
  
  // If the time has passed today, move to tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1)
  }
  
  return next
}

export const TaskBackupModel = mongoose.models.TaskBackup || mongoose.model<TaskBackupDocument>('TaskBackup', taskBackupSchema)