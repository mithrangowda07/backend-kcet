const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '../../data');

// Helper to generate unique hex ID
function generateUUID() {
    if (crypto.randomUUID) {
        return crypto.randomUUID().replace(/-/g, '');
    }
    return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[x]/g, () => {
        return (Math.random() * 16 | 0).toString(16);
    });
}

// 24 standard KCET categories
const STANDARD_CATEGORIES = [
    '1R', '1K', '1G', '2AR', '2AK', '2AG', '2BR', '2BK', '2BG',
    '3AK', '3AR', '3AG', '3BK', '3BR', '3BG', 'STK', 'STR', 'STG',
    'SCK', 'SCR', 'SCG', 'GMR', 'GMK', 'GM'
];

// Cluster mapping logic based on branch name and code
function getClusterId(branchName, branchCode) {
    const name = branchName.toLowerCase();
    const code = branchCode.toUpperCase();
    
    // 1. Computer Science Cluster
    if (
        name.includes('computer') ||
        name.includes('information science') ||
        name.includes('data science') ||
        name.includes('artificial intelligence') ||
        name.includes('cyber security') ||
        name.includes('software') ||
        name.includes('cloud') ||
        name.includes('iot') ||
        name.includes('internet of') ||
        name.includes('it') ||
        name.includes('network') ||
        code === 'CS' ||
        code === 'IS' ||
        code === 'IE' ||
        code === 'AD' ||
        code === 'AI' ||
        code === 'CY' ||
        code === 'DS' ||
        code === 'CD' ||
        code === 'CG' ||
        code === 'CA' ||
        code === 'CB' ||
        code === 'CC' ||
        code === 'CF' ||
        code === 'IC' ||
        code === 'IO'
    ) {
        return '1';
    }
    
    // 2. Electronics Cluster
    if (
        name.includes('electronics') ||
        name.includes('electrical') ||
        name.includes('telecommunication') ||
        name.includes('telecomm') ||
        name.includes('instrumentation') ||
        name.includes('vlsi') ||
        code === 'EC' ||
        code === 'EE' ||
        code === 'EI' ||
        code === 'ET' ||
        code === 'TC' ||
        code === 'EV' ||
        code === 'EL' ||
        code === 'ER' ||
        code === 'ES' ||
        code === 'EZ'
    ) {
        return '2';
    }
    
    // 3. Mechanical Cluster
    if (
        name.includes('mechanical') ||
        name.includes('automobile') ||
        name.includes('aerospace') ||
        name.includes('aero space') ||
        name.includes('mechatronics') ||
        name.includes('industrial') ||
        name.includes('mining') ||
        name.includes('marine') ||
        name.includes('production') ||
        name.includes('robotics') ||
        name.includes('automotive') ||
        code === 'ME' ||
        code === 'AE' ||
        code === 'AU' ||
        code === 'AT' ||
        code === 'MT' ||
        code === 'IM' ||
        code === 'IP' ||
        code === 'MN' ||
        code === 'MI' ||
        code === 'MR' ||
        code === 'MA' ||
        code === 'PR' ||
        code === 'RA' ||
        code === 'RI' ||
        code === 'RO' ||
        code === 'RP'
    ) {
        return '3';
    }
    
    // 4. Civil Cluster
    if (
        name.includes('civil') ||
        name.includes('architecture') ||
        name.includes('construction') ||
        name.includes('planning') ||
        name.includes('design') ||
        code === 'CV' ||
        code === 'CE' ||
        code === 'CK' ||
        code === 'AR' ||
        code === 'CT' ||
        code === 'PL' ||
        code === 'LA' ||
        code === 'UP' ||
        code === 'UR'
    ) {
        return '4';
    }
    
    // 5. Other Cluster
    return '5';
}

const computeRecommendationIndex = (cutoffs) => {
    if (!cutoffs || !Array.isArray(cutoffs)) return undefined;
    const recommendation_index = {};
    
    const rounds = ['r1', 'r2', 'r3'];
    const years = ['2022', '2023', '2024', '2025'];
    
    for (const cutoff of cutoffs) {
        const category = cutoff.category;
        if (!category) continue;
        
        const values = [];
        for (const year of years) {
            for (const round of rounds) {
                const val = cutoff[`cutoff_${year}_${round}`];
                if (val !== null && val !== undefined && val !== '') {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed) && parsed !== 0) {
                        values.push(parsed);
                    }
                }
            }
        }
        
        if (values.length > 0) {
            const min_rank = Math.min(...values);
            const max_rank = Math.max(...values);
            recommendation_index[category] = { min_rank, max_rank };
        }
    }
    
    return Object.keys(recommendation_index).length > 0 ? recommendation_index : undefined;
};

function run() {
    console.log('📖 Reading raw data files...');
    const rawBranches = JSON.parse(fs.readFileSync(path.join(dataDir, 'branches.json'), 'utf8'));
    const rawColleges = JSON.parse(fs.readFileSync(path.join(dataDir, 'colleges.json'), 'utf8'));
    const rawCollegeDetails = JSON.parse(fs.readFileSync(path.join(dataDir, 'college_details.json'), 'utf8'));
    
    const cutoffs2023 = JSON.parse(fs.readFileSync(path.join(dataDir, 'cutoffs_2023.json'), 'utf8'));
    const cutoffs2024 = JSON.parse(fs.readFileSync(path.join(dataDir, 'cutoffs_2024.json'), 'utf8'));
    const cutoffs2025 = JSON.parse(fs.readFileSync(path.join(dataDir, 'cutoffs_2025.json'), 'utf8'));

    console.log('⚡ Processing colleges...');
    // Create mapping of code to detail
    const detailMap = new Map();
    rawCollegeDetails.forEach(d => {
        detailMap.set(d.code, d);
    });

    const collegesDb = rawColleges.map(c => {
        const detail = detailMap.get(c.code) || {};
        const collegeId = c.code.substring(1); // numeric part of E001 -> 001
        
        let website = detail.website || null;
        if (website && !website.endsWith('/')) {
            website = website + '/';
        }

        return {
            _id: collegeId,
            public_id: generateUUID(),
            college_code: c.code,
            college_name: detail.name || c.name,
            location: detail.city || 'Karnataka',
            college_link: website,
            __v: 0
        };
    });

    fs.writeFileSync(path.join(dataDir, 'colleges_db.json'), JSON.stringify(collegesDb, null, 2));
    console.log(`✅ Generated colleges_db.json with ${collegesDb.length} colleges.`);

    console.log('⚡ Mapping branches and clusters...');
    const uniqueBranchesSorted = rawBranches.sort((a, b) => a.code.localeCompare(b.code));
    const branchIdMap = new Map();
    const branchNameMap = new Map();
    
    uniqueBranchesSorted.forEach((b, index) => {
        const branchIdVal = index + 1;
        const branchId = branchIdVal.toString(36).padStart(2, '0'); // Base 36 alphanumeric
        branchIdMap.set(b.code, branchId);
        branchNameMap.set(b.code, b.name);
    });

    console.log('⚡ Processing cutoffs and generating branch documents...');
    const collegeBranchCutoffs = new Map();

    const addCutoffRecord = (record, year) => {
        const key = `${record.college_code}_${record.branch_code}`;
        if (!collegeBranchCutoffs.has(key)) {
            collegeBranchCutoffs.set(key, []);
        }
        collegeBranchCutoffs.get(key).push({ ...record, year });
    };

    cutoffs2023.forEach(r => addCutoffRecord(r, 2023));
    cutoffs2024.forEach(r => addCutoffRecord(r, 2024));
    cutoffs2025.forEach(r => addCutoffRecord(r, 2025));

    const branchesDb = [];

    collegeBranchCutoffs.forEach((records, key) => {
        const [collegeCode, branchCode] = key.split('_');
        const collegeId = collegeCode.substring(1);
        
        const branchName = branchNameMap.get(branchCode) || records[0].branch_name;
        const branchId = branchIdMap.get(branchCode);
        
        if (!branchId) {
            console.warn(`⚠️ Warning: Branch code ${branchCode} not found in branches.json! Skipping.`);
            return;
        }

        const clusterId = getClusterId(branchName, branchCode);

        // Initialize category map with standard categories
        const categoryMap = new Map();
        STANDARD_CATEGORIES.forEach(cat => {
            categoryMap.set(cat, {
                category: cat,
                cutoff_2022_r1: null, cutoff_2022_r2: null, cutoff_2022_r3: null,
                cutoff_2023_r1: null, cutoff_2023_r2: null, cutoff_2023_r3: null,
                cutoff_2024_r1: null, cutoff_2024_r2: null, cutoff_2024_r3: null,
                cutoff_2025_r1: null, cutoff_2025_r2: null, cutoff_2025_r3: null
            });
        });

        // Populate cutoff fields
        records.forEach(r => {
            let cutoffObj = categoryMap.get(r.category);
            if (!cutoffObj) {
                cutoffObj = {
                    category: r.category,
                    cutoff_2022_r1: null, cutoff_2022_r2: null, cutoff_2022_r3: null,
                    cutoff_2023_r1: null, cutoff_2023_r2: null, cutoff_2023_r3: null,
                    cutoff_2024_r1: null, cutoff_2024_r2: null, cutoff_2024_r3: null,
                    cutoff_2025_r1: null, cutoff_2025_r2: null, cutoff_2025_r3: null
                };
                categoryMap.set(r.category, cutoffObj);
            }

            const rankStr = r.closing_rank ? r.closing_rank.toString() : null;

            if (r.year === 2023) {
                if (r.round === 'Round 1') cutoffObj.cutoff_2023_r1 = rankStr;
                else if (r.round === 'Round 2') cutoffObj.cutoff_2023_r2 = rankStr;
                else if (r.round === 'Extended Round') cutoffObj.cutoff_2023_r3 = rankStr;
            } else if (r.year === 2024) {
                if (r.round === 'Round 1') cutoffObj.cutoff_2024_r1 = rankStr;
                else if (r.round === 'Round 2') cutoffObj.cutoff_2024_r2 = rankStr;
                else if (r.round === 'Extended Round') cutoffObj.cutoff_2024_r3 = rankStr;
            } else if (r.year === 2025) {
                if (r.round === 'Round 1') cutoffObj.cutoff_2025_r1 = rankStr;
                else if (r.round === 'Round 2') cutoffObj.cutoff_2025_r2 = rankStr;
                else if (r.round === 'Round 3') cutoffObj.cutoff_2025_r3 = rankStr;
            }
        });

        const cutoffsArray = Array.from(categoryMap.values());
        const recommendationIndex = computeRecommendationIndex(cutoffsArray);

        const uniqueKey = `${collegeId}${clusterId}${branchId}`;

        branchesDb.push({
            _id: uniqueKey,
            public_id: generateUUID(),
            college: collegeId,
            cluster: clusterId,
            branch_id: branchId,
            branch_name: branchName,
            cutoffs: cutoffsArray,
            recommendation_index: recommendationIndex,
            __v: 0
        });
    });

    fs.writeFileSync(path.join(dataDir, 'branches_db.json'), JSON.stringify(branchesDb, null, 2));
    console.log(`✅ Generated branches_db.json with ${branchesDb.length} branches.`);
}

run();
