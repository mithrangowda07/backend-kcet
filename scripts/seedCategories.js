#!/usr/bin/env node

/**
 * Seed categories into MongoDB
 * This populates the categories collection with all KCET categories
 * Usage: node scripts/seedCategories.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../src/models/Category');

const CATEGORIES = [
  { _id: '1R', fall_back: '1R,1G,GM' },
  { _id: '1K', fall_back: '1K,1G,GM' },
  { _id: '1G', fall_back: '1G,GM' },
  { _id: '2AR', fall_back: '2AR,2AG,GM' },
  { _id: '2AK', fall_back: '2AK,2AG,GM' },
  { _id: '2AG', fall_back: '2AG,GM' },
  { _id: '2BR', fall_back: '2BR,2BG,GM' },
  { _id: '2BK', fall_back: '2BK,2BG,GM' },
  { _id: '2BG', fall_back: '2BG,GM' },
  { _id: '3AK', fall_back: '3AK,3AG,GM' },
  { _id: '3AR', fall_back: '3AR,3AG,GM' },
  { _id: '3AG', fall_back: '3AG,GM' },
  { _id: '3BK', fall_back: '3BK,3BG,GM' },
  { _id: '3BR', fall_back: '3BR,3BG,GM' },
  { _id: '3BG', fall_back: '3BG,GM' },
  { _id: 'STK', fall_back: 'STK,STG,GM' },
  { _id: 'STR', fall_back: 'STR,STG,GM' },
  { _id: 'STG', fall_back: 'STG,GM' },
  { _id: 'SCK', fall_back: 'SCK,SCG,GM' },
  { _id: 'SCR', fall_back: 'SCR,SCG,GM' },
  { _id: 'SCG', fall_back: 'SCG,GM' },
  { _id: 'GMR', fall_back: 'GMR,GM' },
  { _id: 'GMK', fall_back: 'GMK,GM' },
  { _id: 'GM', fall_back: 'GM' },
];

const seedCategories = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check if categories already exist
        const count = await Category.countDocuments();
        
        if (count > 0) {
            console.log(`⚠️  Categories already exist (${count} found)`);
            console.log('   Clearing existing categories...');
            await Category.deleteMany({});
        }

        console.log(`➕ Seeding ${CATEGORIES.length} categories...`);
        const result = await Category.insertMany(CATEGORIES);
        
        console.log(`✅ Successfully seeded ${result.length} categories!`);
        console.log('\n📋 Seeded categories:');
        result.forEach(cat => {
            console.log(`   • ${cat._id} (fallback: ${cat.fall_back})`);
        });

    } catch (error) {
        console.error('❌ Error seeding categories:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
};

seedCategories();
