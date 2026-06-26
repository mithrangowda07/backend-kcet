#!/usr/bin/env node

/**
 * MongoDB Atlas Seeding Script
 * 
 * Clears existing colleges, branches, clusters, and locations,
 * and seeds them with the prepared data.
 * 
 * Run this from the backend-node directory:
 *   node scripts/seed_db.js
 */

const fs = require('fs');
const path = require('path');

// Resolve .env path from backend-node
const envPath = path.join(__dirname, '../.env');
require('dotenv').config({ path: envPath });

const mongoose = require('mongoose');

// Import models
const Cluster = require('../src/models/Cluster');
const College = require('../src/models/College');
const Branch = require('../src/models/Branch');
const Location = require('../src/models/Location');

const seedDb = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI is not defined in your environment variables.');
        }

        console.log('🔗 Connecting to MongoDB Atlas...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB Atlas');

        // 1. Clear existing collections
        console.log('🧹 Clearing old collections...');
        
        const deletedClusters = await Cluster.deleteMany({});
        console.log(`   Deleted ${deletedClusters.deletedCount} clusters`);
        
        const deletedColleges = await College.deleteMany({});
        console.log(`   Deleted ${deletedColleges.deletedCount} colleges`);
        
        const deletedBranches = await Branch.deleteMany({});
        console.log(`   Deleted ${deletedBranches.deletedCount} branches`);
        
        const deletedLocations = await Location.deleteMany({});
        console.log(`   Deleted ${deletedLocations.deletedCount} locations`);

        // 2. Read prepared JSON data files from data folder
        console.log('📖 Reading prepared JSON data...');
        const clusters = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/clusters_db.json'), 'utf8'));
        const colleges = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/colleges_db.json'), 'utf8'));
        const branches = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/branches_db.json'), 'utf8'));

        // 3. Seed Clusters
        console.log(`➕ Seeding ${clusters.length} clusters...`);
        const seededClusters = await Cluster.insertMany(clusters);
        console.log(`✅ Seeded ${seededClusters.length} clusters`);

        // 4. Seed Colleges
        console.log(`➕ Seeding ${colleges.length} colleges...`);
        const seededColleges = await College.insertMany(colleges);
        console.log(`✅ Seeded ${seededColleges.length} colleges`);

        // 5. Seed Branches (contains embedded cutoffs)
        console.log(`➕ Seeding ${branches.length} branches...`);
        console.log('   Denormalizing fields for seeding...');
        const collegeDocs = await College.find({}).lean();
        const collegeMap = new Map(collegeDocs.map(c => [c._id, c]));
        const clusterDocs = await Cluster.find({}).lean();
        const clusterMap = new Map(clusterDocs.map(c => [c._id, c]));


        const enrichedBranches = branches.map(branch => {
            // 1. Denormalize fields
            const colDoc = collegeMap.get(branch.college);
            if (colDoc) {
                branch.college_name = colDoc.college_name;
                branch.college_code = colDoc.college_code;
                branch.location = colDoc.location;
            }

            const clDoc = clusterMap.get(branch.cluster);
            if (clDoc) {
                branch.cluster_name = clDoc.cluster_name;
            }

            // 2. Compute recommendation index
            if (Branch.computeRecommendationIndex) {
                branch.recommendation_index = Branch.computeRecommendationIndex(branch.cutoffs);
            }

            return branch;
        });

        const seededBranches = await Branch.insertMany(enrichedBranches);
        console.log(`✅ Seeded ${seededBranches.length} branches`);

        // 6. Extract and seed locations from colleges
        console.log('⚡ Extracting locations from colleges...');
        const uniqueLocations = [...new Set(colleges.map(c => c.location).filter(Boolean))];
        const locationDocs = uniqueLocations.map(loc => ({ location_name: loc.trim() }));
        
        console.log(`➕ Seeding ${locationDocs.length} locations...`);
        const seededLocations = await Location.insertMany(locationDocs);
        console.log(`✅ Seeded ${seededLocations.length} locations`);

        console.log('\n🎉 Database seeding completed successfully!');

    } catch (error) {
        console.error('❌ Seeding failed with error:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB Atlas');
    }
};

seedDb();
