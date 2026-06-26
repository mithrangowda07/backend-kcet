#!/usr/bin/env node

/**
 * Migration script to populate recommendation_index for all existing branches in the database.
 * Usage: node scripts/update_recommendation_index.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Branch = require('../src/models/Branch');

const runMigration = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI is not defined in your environment variables.');
        }

        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        console.log('📖 Fetching all branches...');
        const branches = await Branch.find({}, '_id cutoffs').lean();
        console.log(`   Found ${branches.length} branches.`);

        console.log('⚡ Updating recommendation indexes...');
        let updatedCount = 0;
        
        for (const branch of branches) {
            const index = Branch.computeRecommendationIndex(branch.cutoffs);
            if (index) {
                await Branch.updateOne(
                    { _id: branch._id },
                    { $set: { recommendation_index: index } }
                );
            } else {
                await Branch.updateOne(
                    { _id: branch._id },
                    { $unset: { recommendation_index: "" } }
                );
            }
            updatedCount++;
            if (updatedCount % 200 === 0) {
                console.log(`   Processed ${updatedCount}/${branches.length} branches...`);
            }
        }

        console.log(`\n🎉 Migration completed successfully! Updated ${updatedCount} branches.`);
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
};

runMigration();
