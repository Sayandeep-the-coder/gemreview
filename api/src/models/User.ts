import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  githubId:    string;
  githubLogin: string;
  email:       string;
  name:        string;
  avatarUrl:   string;
  createdAt:   Date;
}

const UserSchema = new Schema<IUser>({
  githubId:    { type: String, required: true, unique: true },
  githubLogin: { type: String, required: true },
  email:       { type: String, required: true },
  name:        { type: String, default: '' },
  avatarUrl:   { type: String, default: '' },
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
