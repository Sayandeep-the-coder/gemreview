import mongoose, { Schema, Document } from 'mongoose';

export interface IApiKey extends Document {
  orgId:       mongoose.Types.ObjectId;
  name:        string;
  keyHash:     string;
  keyPreview:  string;
  createdById: mongoose.Types.ObjectId;
  lastUsedAt:  Date | null;
  createdAt:   Date;
}

const ApiKeySchema = new Schema<IApiKey>({
  orgId:       { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
  name:        { type: String, required: true },
  keyHash:     { type: String, required: true, unique: true },
  keyPreview:  { type: String, required: true },
  createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastUsedAt:  { type: Date, default: null },
}, { timestamps: true });

ApiKeySchema.index({ orgId: 1 });

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
