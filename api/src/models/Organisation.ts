import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganisation extends Document {
  name:                string;
  slug:                string;
  geminiKeyEnc:        string;
  reviewsThisMonth:    number;
  totalReviewsAllTime: number;
  lastReviewedAt:      Date | null;
  createdAt:           Date;
  updatedAt:           Date;
}

const OrgSchema = new Schema<IOrganisation>({
  name:                { type: String, required: true },
  slug:                { type: String, required: true, unique: true },
  geminiKeyEnc:        { type: String, default: '' },
  reviewsThisMonth:    { type: Number, default: 0 },
  totalReviewsAllTime: { type: Number, default: 0 },
  lastReviewedAt:      { type: Date, default: null },
}, { timestamps: true });

export const Organisation = mongoose.model<IOrganisation>('Organisation', OrgSchema);
