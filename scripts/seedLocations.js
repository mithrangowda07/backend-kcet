#!/usr/bin/env node

/**
 * Seed locations into MongoDB
 * This extracts locations from Colleges and seeds them into the locations collection
 * Usage: node scripts/seedLocations.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const College = require('../src/models/College');
const Location = require('../src/models/Location');

const seedLocations = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Extract locations
        const colleges = await College.find();
        const uniqueLocations = [...new Set(colleges.map(c => c.location).filter(Boolean))];
        console.log(`Found ${uniqueLocations.length} unique locations in Colleges:`, uniqueLocations);

        // Clear existing locations
        const count = await Location.countDocuments();
        if (count > 0) {
            console.log(`⚠️ Locations already exist (${count} found). Clearing...`);
            await Location.deleteMany({});
        }

        // Insert
        const docs = uniqueLocations.map(loc => ({ location_name: loc.trim() }));
        const result = await Location.insertMany(docs);
        console.log(`✅ Successfully seeded ${result.length} locations!`);

    } catch (error) {
        console.error('❌ Error seeding locations:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
};

seedLocations();
