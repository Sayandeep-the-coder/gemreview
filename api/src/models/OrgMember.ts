import mongoose, { Schema, Document } from 'mongoose';

export interface IOrgMember extends Document {
  orgId:    mongoose.Types.ObjectId;
  userId:   mongoose.Types.ObjectId;
  role:     'admin' | 'member';
  joinedAt: Date;
}

const OrgMemberSchema = new Schema<IOrgMember>({
  orgId:    { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role:     { type: String, enum: ['admin', 'member'], default: 'member' },
  joinedAt: { type: Date, default: Date.now },
});

OrgMemberSchema.index({ orgId: 1, userId: 1 }, { unique: true });
OrgMemberSchema.index({ orgId: 1 });

export const OrgMember = mongoose.model<IOrgMember>('OrgMember', OrgMemberSchema);
