import mongoose, { Schema } from 'mongoose';
import type { IRole } from '../types/index';

const roleSchema = new Schema<IRole>({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  permissions: [{ 
    type: String, 
    trim: true 
  }],
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

const Role = mongoose.model<IRole>('Role', roleSchema);
export default Role;
