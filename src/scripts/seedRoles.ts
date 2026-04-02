import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../models/Role';

dotenv.config();

const roles = [
  {
    name: "member",
    description: "Standard family member with contribution rights",
    permissions: ["can_view_own_ledger", "can_contribute", "can_view_summary"]
  },
  {
    name: "treasurer",
    description: "Financial manager (Key 1 of Double-Lock)",
    permissions: ["can_view_all_ledgers", "can_initiate_payout", "can_generate_reports", "can_view_own_ledger", "can_contribute", "can_view_summary"]
  },
  {
    name: "chairman",
    description: "Governance lead (Key 2 of Double-Lock)",
    permissions: ["can_approve_payout", "can_manage_roles", "can_generate_invite", "can_view_all_ledgers", "can_view_own_ledger", "can_contribute", "can_view_summary"]
  },
  {
    name: "secretary",
    description: "Administrative support",
    permissions: ["can_view_all_ledgers", "can_update_profiles", "can_manage_announcements", "can_view_own_ledger", "can_contribute", "can_view_summary"]
  }
];

const seedRoles = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/saveplan';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for role seeding...');

    for (const roleData of roles) {
      await Role.findOneAndUpdate(
        { name: roleData.name },
        { 
          $set: { 
            description: roleData.description,
            permissions: roleData.permissions,
            isActive: true
          }
        },
        { upsert: true, new: true }
      );
      console.log(`Role seeded/updated: ${roleData.name}`);
    }

    console.log('Role seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding roles:', error);
    process.exit(1);
  }
};

seedRoles();
