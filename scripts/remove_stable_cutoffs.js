#!/usr/bin/env node

const path = require('path');
const envPath = path.join(__dirname, '../.env');
require('dotenv').config({ path: envPath });

const mongoose = require('mongoose');
const Branch = require('../src/models/Branch');

const removeStableCutoffs = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI is not defined in your environment variables.');
        }

        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        console.log('🧹 Removing stable cutoff fields from all documents...');
        
        // Use native MongoDB collection to bypass any Mongoose schema filtering
        const result = await Branch.collection.updateMany({}, {
            $unset: {
                "cutoffs.$[].stable_r1": "",
                "cutoffs.$[].stable_r2": "",
                "cutoffs.$[].stable_r3": ""
            }
        });

        console.log(`🎉 Success! Matched ${result.matchedCount} and modified ${result.modifiedCount} documents.`);
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
};

removeStableCutoffs();
