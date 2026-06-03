const Branch = require('../models/Branch');
const Category = require('../models/Category');

const getRoundFallbackOrder = (selectedRound) => {
    const round = selectedRound.toUpperCase();
    const fallbackOrders = {
        'R1': ['R1', 'R2', 'R3'],
        'R2': ['R2', 'R1', 'R3'],
        'R3': ['R3', 'R2', 'R1'],
    };
    return fallbackOrders[round] || ['R1', 'R2', 'R3'];
};

const resolveCutoffWithFallback = (branch, category, year, fallbackOrder) => {
    for (const roundName of fallbackOrder) {
        const roundLower = roundName.toLowerCase();
        
        const cutoff = branch.cutoffs.find(c => c.category === category);
        if (!cutoff) continue;

        const value = cutoff[`cutoff_${year}_${roundLower}`];
        if (value && !['NA', '-', 'nan', ''].includes(value)) {
            const intValue = parseInt(value, 10);
            if (!isNaN(intValue)) {
                return intValue;
            }
        }
    }
    return null;
};

const calculateRankBand = (userRank) => {
    if (userRank <= 1000) return 'tight';
    if (userRank <= 5000) return 'medium';
    if (userRank <= 20000) return 'wide';
    return 'very_wide';
};

const calculateRankWindow = (userRank) => {
    const band = calculateRankBand(userRank);
    if (band === 'tight') return [Math.floor(userRank * 0.4), Math.floor(userRank * 2.5)];
    if (band === 'medium') return [Math.floor(userRank * 0.6), Math.floor(userRank * 3)];
    if (band === 'wide') return [Math.floor(userRank * 0.7), Math.floor(userRank * 3.5)];
    return [Math.floor(userRank * 0.8), Math.floor(userRank * 4)];
};

const getMultiYearCutoffs = (branch, category, years, roundName) => {
    const cutoffs = [];
    const cutoff = branch.cutoffs.find(c => c.category === category);
    if (!cutoff) return cutoffs;

    for (const year of years) {
        const value = cutoff[`cutoff_${year}_${roundName}`];
        if (value && !['NA', '-', 'nan', ''].includes(value)) {
            const intValue = parseInt(value, 10);
            if (!isNaN(intValue)) {
                cutoffs.push(intValue);
            }
        }
    }
    return cutoffs;
};

const stabilizeCutoff = (cutoffs) => {
    if (!cutoffs || cutoffs.length === 0) return null;
    if (cutoffs.length === 1) return cutoffs[0];

    const sortedCutoffs = [...cutoffs].sort((a, b) => a - b);
    
    if (sortedCutoffs.length >= 2) {
        const mean = sortedCutoffs.reduce((sum, val) => sum + val, 0) / sortedCutoffs.length;
        if (mean > 0) {
            const variance = sortedCutoffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (sortedCutoffs.length - 1);
            const stdDev = Math.sqrt(variance);
            const cv = stdDev / mean;

            if (cv > 0.15) {
                const mid = Math.floor(sortedCutoffs.length / 2);
                return sortedCutoffs.length % 2 !== 0 ? sortedCutoffs[mid] : Math.floor((sortedCutoffs[mid - 1] + sortedCutoffs[mid]) / 2);
            }
        }
    }

    return sortedCutoffs[sortedCutoffs.length - 1]; // Assume last one is best representation if not highly fluctuating
};

const getRecommendations = async (kcetRank, category = null, year = '2025', roundName = 'R1', cluster = null, openingRank = null, closingRank = null) => {
    let [calculatedOpening, calculatedClosing] = calculateRankWindow(kcetRank);
    openingRank = openingRank !== null ? parseInt(openingRank, 10) : calculatedOpening;
    closingRank = closingRank !== null ? parseInt(closingRank, 10) : calculatedClosing;

    const roundUpper = roundName.toUpperCase();
    const roundLower = roundName.toLowerCase();
    const fallbackOrder = getRoundFallbackOrder(roundUpper);
    const years = ['2022', '2023', '2024', '2025'];

    let branchQuery = {};
    if (cluster) {
        branchQuery.cluster = cluster;
    }
    
    const branches = await Branch.find(branchQuery).populate('college').populate('cluster').lean();

    let validCategories = new Set();
    if (category) {
        const catObj = await Category.findOne({ _id: category }).lean();
        if (catObj && catObj.fall_back) {
            catObj.fall_back.split(',').forEach(c => validCategories.add(c.trim()));
        }
        validCategories.add(category);
    } else {
        const allCats = await Category.find().lean();
        allCats.forEach(c => validCategories.add(c._id));
    }

    const recommendationsDict = {};

    for (const branch of branches) {
        let bestCutoff = null;
        let bestCategory = null;

        for (const cat of validCategories) {
            const cutoffValue = resolveCutoffWithFallback(branch, cat, year, fallbackOrder);

            if (cutoffValue !== null) {
                const multiYearCutoffs = getMultiYearCutoffs(branch, cat, years, roundLower);
                let finalCutoff = cutoffValue;
                
                if (multiYearCutoffs.length > 0) {
                    const stabilized = stabilizeCutoff(multiYearCutoffs);
                    if (stabilized !== null) finalCutoff = stabilized;
                }

                if (finalCutoff >= openingRank && finalCutoff <= closingRank) {
                    if (bestCutoff === null || finalCutoff < bestCutoff) {
                        bestCutoff = finalCutoff;
                        bestCategory = cat;
                    }
                }
            }
        }

        if (bestCutoff !== null) {
            const key = `${branch.college._id}_${branch.branch_id}`;
            const distanceFromRank = Math.abs(bestCutoff - kcetRank);
            const eligibilityFlag = bestCutoff <= kcetRank;

            if (!recommendationsDict[key] || distanceFromRank < recommendationsDict[key].distance_from_rank) {
                recommendationsDict[key] = {
                    unique_key: branch._id,
                    public_id: branch.public_id,
                    college: {
                        public_id: branch.college.public_id,
                        college_code: branch.college.college_code,
                        college_name: branch.college.college_name,
                        location: branch.college.location,
                    },
                    branch: {
                        branch_id: branch.branch_id,
                        branch_name: branch.branch_name,
                    },
                    cluster: {
                        cluster_code: branch.cluster._id,
                        cluster_name: branch.cluster.cluster_name,
                    },
                    category: bestCategory,
                    cutoff: bestCutoff,
                    distance_from_rank: distanceFromRank,
                    eligibility_flag: eligibilityFlag,
                };
            }
        }
    }

    const recommendations = Object.values(recommendationsDict);
    recommendations.sort((a, b) => a.cutoff - b.cutoff);
    return recommendations;
};

module.exports = {
    getRecommendations,
    calculateRankWindow
};
