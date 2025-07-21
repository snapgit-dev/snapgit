import mongoose, { Schema, Document } from 'mongoose'

export interface GroupTask {
  userId: string;
  name: string;
  description?: string;
  taskIds: string[]; // Références aux TaskBackup
  s3FolderPath: string; // Chemin du dossier S3 pour ce groupe
  compressionLevel?: number;
  isActive: boolean;
  lastRun?: Date;
  lastStatus?: 'pending' | 'running' | 'success' | 'error';
  lastError?: string;
  executionMode?: 'sync' | 'worker';
  executeImmediately?: boolean;
  createdBy?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupTaskDocument extends GroupTask, Document {}

const groupTaskSchema = new Schema<GroupTaskDocument>({
  userId: { type: String, required: true, ref: 'User' },
  name: { type: String, required: true },
  description: { type: String },
  taskIds: [{ type: String, ref: 'TaskBackup' }],
  s3FolderPath: { type: String, required: true },
  compressionLevel: { type: Number, default: 9, min: 1, max: 9 },
  isActive: { type: Boolean, default: true },
  lastRun: { type: Date },
  lastStatus: { 
    type: String, 
    enum: ['pending', 'running', 'success', 'error'],
    default: 'pending'
  },
  lastError: { type: String },
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

groupTaskSchema.index({ userId: 1, name: 1 }, { unique: true })
groupTaskSchema.index({ userId: 1, isActive: 1 })

groupTaskSchema.pre('save', function() {
  this.updatedAt = new Date()
})

export const GroupTaskModel = mongoose.models.GroupTask || mongoose.model<GroupTaskDocument>('GroupTask', groupTaskSchema)
