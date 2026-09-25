import mongoose, { Schema, Document } from 'mongoose';

export interface IInvite extends Document {
  orgId:       mongoose.Types.ObjectId;
  invitedBy:   mongoose.Types.ObjectId;
  type:        'email' | 'github';
  email:       string | null;
  githubLogin: string | null;
  role:        'admin' | 'member';
  token:       string;
  expiresAt:   Date;
  acceptedAt:  Date | null;
  status:      'pending' | 'accepted' | 'expired';
}

const InviteSchema = new Schema<IInvite>({
  orgId:       { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
  invitedBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type:        { type: String, enum: ['email', 'github'], required: true },
  email:       { type: String, default: null },
  githubLogin: { type: String, default: null },
  role:        { type: String, enum: ['admin', 'member'], default: 'member' },
  token:       { type: String, unique: true, sparse: true },
  expiresAt:   { type: Date, required: true },
  acceptedAt:  { type: Date, default: null },
  status:      { type: String, enum: ['pending', 'accepted', 'expired'], default: 'pending' },
}, { timestamps: true });

InviteSchema.index({ orgId: 1 });

export const Invite = mongoose.model<IInvite>('Invite', InviteSchema);
