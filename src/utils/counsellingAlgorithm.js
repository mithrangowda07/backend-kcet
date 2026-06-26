const Branch = require('../models/Branch');
const Category = require('../models/Category');
const Cluster = require('../models/Cluster');
const College = require('../models/College');

const FALLBACK_ORDER = {
  "1R": ["1R", "1G", "GM"],
  "1K": ["1K", "1G", "GM"],
  "1G": ["1G", "GM"],
  "2AR": ["2AR", "2AG", "GM"],
  "2AK": ["2AK", "2AG", "GM"],
  "2AG": ["2AG", "GM"],
  "2BR": ["2BR", "2BG", "GM"],
  "2BK": ["2BK", "2BG", "GM"],
  "2BG": ["2BG", "GM"],
  "3AK": ["3AK", "3AG", "GM"],
  "3AR": ["3AR", "3AG", "GM"],
  "3AG": ["3AG", "GM"],
  "3BK": ["3BK", "3BG", "GM"],
  "3BR": ["3BR", "3BG", "GM"],
  "3BG": ["3BG", "GM"],
  "STK": ["STK", "STG", "GM"],
  "STR": ["STR", "STG", "GM"],
  "STG": ["STG", "GM"],
  "SCK": ["SCK", "SCG", "GM"],
  "SCR": ["SCR", "SCG", "GM"],
  "SCG": ["SCG", "GM"],
  "GMR": ["GMR", "GM"],
  "GMK": ["GMK", "GM"],
  "GM": ["GM"],
};

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

const getRecommendations = async (kcetRank, category = null, year = '2025', roundName = 'R1', clusters = null, openingRank = null, closingRank = null, locations = null) => {
    let [calculatedOpening, calculatedClosing] = calculateRankWindow(kcetRank);
    openingRank = openingRank !== null ? parseInt(openingRank, 10) : calculatedOpening;
    closingRank = closingRank !== null ? parseInt(closingRank, 10) : calculatedClosing;

    const roundUpper = roundName.toUpperCase();
    const roundLower = roundName.toLowerCase();
    const fallbackOrder = getRoundFallbackOrder(roundUpper);
    const years = ['2022', '2023', '2024', '2025'];

    console.log(`[RECOMMENDATIONS] Incoming clusters value:`, clusters);

    let branchQuery = {};
    if (clusters) {
        const clusterArray = Array.isArray(clusters) ? clusters : [clusters];
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

    if (locations && Array.isArray(locations) && locations.length > 0) {
        const hasAll = locations.some(l => typeof l === 'string' && l.trim().toLowerCase() === 'all');
        if (!hasAll) {
            const locationRegexes = locations.map(l => new RegExp(`^${l.trim()}$`, 'i'));
            branchQuery.location = { $in: locationRegexes };
        }
    }

    const targetCategory = category || 'GM';
    const searchCategories = FALLBACK_ORDER[targetCategory] || [targetCategory];
    const validCategories = new Set(searchCategories);

    // Fetch college public IDs to construct the required response format in memory without populate
    const colleges = await College.find({}, '_id public_id').lean();
    const collegePublicIdMap = new Map(colleges.map(c => [c._id, c.public_id]));

    // Parallelize Branch processing using Promise.all
    const processBranch = async (branch) => {
        let bestCutoff = null;
        let bestCategory = null;

        const selectedRoundField = `cutoff_${year}_${roundLower}`;

        for (const cat of validCategories) {
            const cutoffObj = branch.cutoffs.find(c => c.category === cat);
            if (!cutoffObj) continue;

            const val = cutoffObj[selectedRoundField];
            if (val && !['NA', '-', 'nan', '', '0'].includes(val)) {
                const intValue = parseInt(val, 10);
                if (!isNaN(intValue) && intValue !== 0) {
                    bestCutoff = intValue;
                    bestCategory = cat;
                    break; // Found the most specific category's cutoff. Use it and stop falling back.
                }
            }
        }

        if (bestCutoff !== null && bestCutoff >= openingRank) {
            const key = `${branch.college}_${branch.branch_id}`;
            const distanceFromRank = Math.abs(bestCutoff - kcetRank);
            const eligibilityFlag = bestCutoff <= kcetRank;

            return {
                unique_key: branch._id,
                public_id: branch.public_id,
                college: {
                    public_id: collegePublicIdMap.get(branch.college) || null,
                    college_code: branch.college_code,
                    college_name: branch.college_name,
                    location: branch.location,
                },
                branch: {
                    branch_id: branch.branch_id,
                    branch_name: branch.branch_name,
                },
                cluster: {
                    cluster_code: branch.cluster,
                    cluster_name: branch.cluster_name,
                },
                category: bestCategory,
                cutoff: bestCutoff,
                distance_from_rank: distanceFromRank,
                eligibility_flag: eligibilityFlag,
                key, // used for deduplication
            };
        }
        return null;
    };

    let branches = [];
    const fetchedBranchIds = new Set();
    const processedResults = new Map(); // branch._id -> processed recommendation object or null

    let finalRecs = [];
    let finalClosingRank = closingRank;
    let satisfied = false;

    const stages = [
        { lower: 0.7, upper: 1.3 },
        { lower: 0.6, upper: 1.5 },
        { lower: 0.5, upper: 1.8 },
        { lower: 0.3, upper: 2.5 }
    ];

    for (let s = 0; s < stages.length; s++) {
        if (satisfied) break;

        const stage = stages[s];
        const lowerRank = kcetRank * stage.lower;
        const upperRank = kcetRank * stage.upper;

        console.log(`[RECOMMENDATIONS] Window Stage ${s}: Range coefficient [${stage.lower}, ${stage.upper}] -> Rank search window [${lowerRank}, ${upperRank}]`);

        // Build simultaneous fallback categories index query
        let optimizedQuery;
        if (searchCategories.length === 1) {
            const cat = searchCategories[0];
            optimizedQuery = {
                ...branchQuery,
                [`recommendation_index.${cat}.min_rank`]: { $lte: upperRank },
                [`recommendation_index.${cat}.max_rank`]: { $gte: lowerRank }
            };
        } else {
            const orConditions = searchCategories.map(cat => ({
                [`recommendation_index.${cat}.min_rank`]: { $lte: upperRank },
                [`recommendation_index.${cat}.max_rank`]: { $gte: lowerRank }
            }));
            optimizedQuery = {
                ...branchQuery,
                $or: orConditions
            };
        }

        console.log(`[RECOMMENDATIONS] Optimized simultaneous query:`, JSON.stringify(optimizedQuery));

        const categoryBranches = await Branch.find(optimizedQuery)
            .select('_id public_id branch_id branch_name college college_name college_code location cluster cluster_name cutoffs')
            .lean();

        console.log(`[RECOMMENDATIONS] Query returned ${categoryBranches.length} branches.`);

        // Accumulate unique branches that are new in this stage
        const newBranches = [];
        for (const b of categoryBranches) {
            if (!fetchedBranchIds.has(b._id)) {
                fetchedBranchIds.add(b._id);
                branches.push(b);
                newBranches.push(b);
            }
        }

        if (newBranches.length > 0) {
            // Process only the newly added branches
            const newResults = await Promise.all(newBranches.map(processBranch));
            for (let j = 0; j < newBranches.length; j++) {
                processedResults.set(newBranches[j]._id, newResults[j]);
            }
        }

        // Deduplicate and group recommendations by key (college_branch) from all processed results so far
        const recommendationsDict = {};
        for (const rec of processedResults.values()) {
            if (!rec) continue;
            const key = rec.key;
            if (!recommendationsDict[key] || rec.distance_from_rank < recommendationsDict[key].distance_from_rank) {
                recommendationsDict[key] = rec;
            }
        }

        // Remove the temporary 'key' property from returned objects to preserve exact response format
        const allCandidates = Object.values(recommendationsDict).map(rec => {
            const { key, ...cleanRec } = rec;
            return cleanRec;
        });

        allCandidates.sort((a, b) => a.cutoff - b.cutoff);

        // Initial filtering based on current closing rank
        const initialMatches = allCandidates.filter(r => r.cutoff <= closingRank);

        if (initialMatches.length >= 20) {
            finalRecs = initialMatches;
            finalClosingRank = closingRank;
            satisfied = true;
            console.log(`[RECOMMENDATIONS] Found sufficient recommendations (${finalRecs.length}) at window stage ${s}. Stopping expansion.`);
            break;
        } else {
            finalRecs = allCandidates.slice(0, 20);
            if (finalRecs.length > 0) {
                const lastCutoff = finalRecs[finalRecs.length - 1].cutoff;
                finalClosingRank = Math.max(closingRank, lastCutoff);
            } else {
                finalClosingRank = closingRank;
            }
        }
    }

    if (finalRecs.length < 20) {
        console.log(`[RECOMMENDATIONS] Window Stage 3 completed but found only ${finalRecs.length} recommendations. Falling back to query all branches to guarantee 20 recommendations.`);

        const categoryBranches = await Branch.find(branchQuery)
            .select('_id public_id branch_id branch_name college college_name college_code location cluster cluster_name cutoffs')
            .lean();

        console.log(`[RECOMMENDATIONS] Fallback unrestricted query returned ${categoryBranches.length} branches.`);

        const newBranches = [];
        for (const b of categoryBranches) {
            if (!fetchedBranchIds.has(b._id)) {
                fetchedBranchIds.add(b._id);
                branches.push(b);
                newBranches.push(b);
            }
        }

        if (newBranches.length > 0) {
            const newResults = await Promise.all(newBranches.map(processBranch));
            for (let j = 0; j < newBranches.length; j++) {
                processedResults.set(newBranches[j]._id, newResults[j]);
            }
        }

        const recommendationsDict = {};
        for (const rec of processedResults.values()) {
            if (!rec) continue;
            const key = rec.key;
            if (!recommendationsDict[key] || rec.distance_from_rank < recommendationsDict[key].distance_from_rank) {
                recommendationsDict[key] = rec;
            }
        }

        const allCandidates = Object.values(recommendationsDict).map(rec => {
            const { key, ...cleanRec } = rec;
            return cleanRec;
        });

        allCandidates.sort((a, b) => a.cutoff - b.cutoff);

        const initialMatches = allCandidates.filter(r => r.cutoff <= closingRank);

        if (initialMatches.length >= 20) {
            finalRecs = initialMatches;
            finalClosingRank = closingRank;
        } else {
            finalRecs = allCandidates.slice(0, 20);
            if (finalRecs.length > 0) {
                const lastCutoff = finalRecs[finalRecs.length - 1].cutoff;
                finalClosingRank = Math.max(closingRank, lastCutoff);
            } else {
                finalClosingRank = closingRank;
            }
        }
    }

    // Format recommendation cutoffs to display category suffix if fallback is used (Step 3 UI requirement)
    const formattedRecommendations = finalRecs.map(rec => {
        const isFallback = rec.category !== targetCategory;
        return {
            ...rec,
            cutoff: isFallback ? `${rec.cutoff} (${rec.category})` : rec.cutoff
        };
    });

    console.log(`[RECOMMENDATIONS] Final recommendation count: ${formattedRecommendations.length}, final closing rank: ${finalClosingRank}`);
    return {
        recommendations: formattedRecommendations,
        closingRank: finalClosingRank
    };
};

module.exports = {
    getRecommendations,
    calculateRankWindow
};
