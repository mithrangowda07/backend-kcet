const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Branch = require('../src/models/Branch');
const { getRecommendations } = require('../src/utils/counsellingAlgorithm');

async function testRV() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI not found in env');
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB\n');

        console.log('Running getRecommendations(481, "2AG", "2025", "R1", null, 168, 1721, null)...');
        const results = await getRecommendations(481, "2AG", "2025", "R1", null, 168, 1721, null);
        
        console.log(`📦 Recommendations Count: ${results.recommendations.length}`);
        console.log(`📈 Final Closing Rank: ${results.closingRank}`);
        
        results.recommendations.forEach((r, idx) => {
            console.log(`${idx + 1}. College: ${r.college.college_code} - ${r.college.college_name}, Branch: ${r.branch.branch_name}, Cutoff: ${r.cutoff}`);
        });

    } catch (err) {
        console.error('❌ Test failed:', err);
    } finally {
        await mongoose.connect(process.env.MONGODB_URI);
        await mongoose.disconnect();
    }
}

testRV();
