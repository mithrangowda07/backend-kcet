#!/usr/bin/env node

/**
 * Create or update admin account with bcrypt hashing
 * Usage: node scripts/createAdmin.js <email> <password> [name]
 * Example: node scripts/createAdmin.js admin@example.com mypassword123 "Admin User"
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { hashPassword } = require('../src/utils/hash');
const AdminAccount = require('../src/models/AdminAccount');

const createAdmin = async () => {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.error('❌ Usage: node scripts/createAdmin.js <email> <password> [name]');
        console.error('Example: node scripts/createAdmin.js admin@example.com mypassword123 "Admin User"');
        process.exit(1);
    }

    const email = args[0].toLowerCase();
    const password = args[1];
    const name = args[2] || 'Admin';

    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check if admin already exists
        let admin = await AdminAccount.findOne({ email });
        
        if (admin) {
            console.log(`📝 Updating existing admin: ${email}`);
            admin.password = hashPassword(password);
            admin.name = name;
            admin.is_active = true;
            await admin.save();
            console.log('✅ Admin account updated successfully!');
            console.log(`   Email: ${admin.email}`);
            console.log(`   Name: ${admin.name}`);
            console.log(`   Active: ${admin.is_active}`);
        } else {
            console.log(`➕ Creating new admin account for: ${email}`);
            admin = new AdminAccount({
                email,
                password: hashPassword(password),
                name,
                is_active: true
            });
            await admin.save();
            console.log('✅ Admin account created successfully!');
            console.log(`   Email: ${admin.email}`);
            console.log(`   Name: ${admin.name}`);
            console.log(`   Active: ${admin.is_active}`);
            console.log(`   Created: ${admin.created_at}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
};

createAdmin();
