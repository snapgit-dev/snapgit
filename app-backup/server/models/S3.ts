import mongoose, { Schema, Document } from 'mongoose'
import { encrypt, decrypt } from '../utils/crypto'

export interface S3Config {
  userId: string;
  name: string;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface S3ConfigDocument extends S3Config, Document {
  getDecryptedCredentials(): { accessKeyId: string; secretAccessKey: string };
  toSafeObject(): Omit<S3Config, 'accessKeyId' | 'secretAccessKey'>;
}

const s3ConfigSchema = new Schema<S3ConfigDocument>({
  userId: { type: String, required: true, ref: 'User' },
  name: { type: String, required: true },
  endpoint: { type: String, required: true },
  region: { type: String, required: true },
  bucket: { type: String, required: true },
  accessKeyId: { type: String, required: true },
  secretAccessKey: { type: String, required: true },
  forcePathStyle: { type: Boolean, default: false },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

s3ConfigSchema.index({ userId: 1, name: 1 }, { unique: true })

s3ConfigSchema.pre('save', function() {
  this.updatedAt = new Date()
  
  if (this.isModified('accessKeyId')) {
    this.accessKeyId = encrypt(this.accessKeyId)
  }
  
  if (this.isModified('secretAccessKey')) {
    this.secretAccessKey = encrypt(this.secretAccessKey)
  }
})

s3ConfigSchema.methods.getDecryptedCredentials = function() {
  return {
    accessKeyId: decrypt(this.accessKeyId),
    secretAccessKey: decrypt(this.secretAccessKey)
  }
}

s3ConfigSchema.methods.toSafeObject = function() {
  const obj = this.toObject()
  delete obj.accessKeyId
  delete obj.secretAccessKey
  return obj
}

export const S3ConfigModel = mongoose.models.S3Config || mongoose.model<S3ConfigDocument>('S3Config', s3ConfigSchema)