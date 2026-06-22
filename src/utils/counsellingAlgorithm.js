const Branch = require('../models/Branch');
const Category = require('../models/Category');
const Cluster = require('../models/Cluster');

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

    console.log(`[RECOMMENDATIONS] Incoming cluster value:`, cluster);

    let branchQuery = {};
    if (cluster) {
        const clusterArray = Array.isArray(cluster) ? cluster : [cluster];
        const hasAll = clusterArray.some(c => typeof c === 'string' && c.trim().toLowerCase() === 'all');
        if (!hasAll && clusterArray.length > 0) {
            const abbreviations = {
                'cs': '1', 'cse': '1', 'computer science': '1',
                'ec': '2', 'ece': '2', 'electronics': '2',
                'me': '3', 'mech': '3', 'mechanical': '3',
                'cv': '4', 'civil': '4',
                'other': '5'
            };

            const dbClusters = await Cluster.find().lean();
            const matchedClusterIds = [];

            for (const c of clusterArray) {
                if (typeof c !== 'string') continue;
                const normalizedCluster = c.trim().toLowerCase().replace(/[_-]/g, ' ');
                if (!normalizedCluster) continue;

                let matchedClusterId = abbreviations[normalizedCluster];

                if (!matchedClusterId) {
                    let matchedCluster = dbClusters.find(dc =>
                        dc._id.toLowerCase() === normalizedCluster ||
                        dc.cluster_name.toLowerCase().replace(/[_-]/g, ' ') === normalizedCluster ||
                        dc.cluster_name.toLowerCase().replace(/\s+cluster$/i, '').replace(/[_-]/g, ' ') === normalizedCluster
                    );

                    if (!matchedCluster) {
                        matchedCluster = dbClusters.find(dc =>
                            dc.cluster_name.toLowerCase().includes(normalizedCluster) ||
                            normalizedCluster.includes(dc.cluster_name.toLowerCase()) ||
                            normalizedCluster.includes(dc.cluster_name.toLowerCase().replace(/\s+cluster$/i, ''))
                        );
                    }

                    if (matchedCluster) {
                        matchedClusterId = matchedCluster._id;
                    }
                }

                if (matchedClusterId) {
                    matchedClusterIds.push(matchedClusterId);
                } else {
                    // Fallback to original value if no matches found
                    matchedClusterIds.push(c);
                }
            }

            if (matchedClusterIds.length > 0) {
                branchQuery.cluster = { $in: matchedClusterIds };
            }
        }
    }

    console.log(`[RECOMMENDATIONS] Generated MongoDB query:`, JSON.stringify(branchQuery));
    
    const branches = await Branch.find(branchQuery).populate('college').populate('cluster').lean();

    console.log(`[RECOMMENDATIONS] Filtered branch list (${branches.length} branches):`, 
        branches.map(b => `${b._id} (${b.branch_name})`).join(', ')
    );

    const targetCategory = category || 'GM';
    let validCategories = new Set();
    const catObj = await Category.findOne({ _id: targetCategory }).lean();
    if (catObj && catObj.fall_back) {
        catObj.fall_back.split(',').forEach(c => validCategories.add(c.trim()));
    }
    validCategories.add(targetCategory);

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

                bestCutoff = finalCutoff;
                bestCategory = cat;
                break; // Found the most specific category's cutoff. Use it and stop falling back.
            }
        }

        if (bestCutoff !== null && bestCutoff >= openingRank) {
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

    const allCandidates = Object.values(recommendationsDict);
    allCandidates.sort((a, b) => a.cutoff - b.cutoff);

    // Initial filtering based on current closing rank
    const initialMatches = allCandidates.filter(r => r.cutoff <= closingRank);

    let finalRecs;
    let finalClosingRank = closingRank;

    if (initialMatches.length >= 20) {
        finalRecs = initialMatches;
    } else {
        // If matches are fewer than 20, increase the closing rank to fetch up to 20 recommendations
        finalRecs = allCandidates.slice(0, 20);
        if (finalRecs.length > 0) {
            const lastCutoff = finalRecs[finalRecs.length - 1].cutoff;
            finalClosingRank = Math.max(closingRank, lastCutoff);
        }
    }

    console.log(`[RECOMMENDATIONS] Final recommendation count: ${finalRecs.length}, final closing rank: ${finalClosingRank}`);
    return {
        recommendations: finalRecs,
        closingRank: finalClosingRank
    };
};

module.exports = {
    getRecommendations,
    calculateRankWindow
};
