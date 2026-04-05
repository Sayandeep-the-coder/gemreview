import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  orgId:         mongoose.Types.ObjectId;
  apiKeyId:      mongoose.Types.ObjectId;
  repoName:      string;
  prNumber:      number;
  prTitle:       string;
  prUrl:         string;
  triggeredBy:   'cli' | 'action';
  modelName:     string;
  durationMs:    number;
  filesReviewed: number;
  linesChanged:  number;
  totalFindings: number;
  criticalCount: number;
  highCount:     number;
  mediumCount:   number;
  lowCount:      number;
  createdAt:     Date;
}

const ReviewSchema = new Schema<IReview>({
  orgId:         { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
  apiKeyId:      { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  repoName:      { type: String, required: true },
  prNumber:      { type: Number, required: true },
  prTitle:       { type: String, default: '' },
  prUrl:         { type: String, required: true },
  triggeredBy:   { type: String, enum: ['cli', 'action'], required: true },
  modelName:     { type: String, required: true },
  durationMs:    { type: Number, default: 0 },
  filesReviewed: { type: Number, default: 0 },
  linesChanged:  { type: Number, default: 0 },
  totalFindings: { type: Number, default: 0 },
  criticalCount: { type: Number, default: 0 },
  highCount:     { type: Number, default: 0 },
  mediumCount:   { type: Number, default: 0 },
  lowCount:      { type: Number, default: 0 },
}, { timestamps: true });

ReviewSchema.index({ orgId: 1, createdAt: -1 });
ReviewSchema.index({ orgId: 1, repoName: 1 });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
