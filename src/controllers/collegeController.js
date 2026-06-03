const College = require('../models/College');
const Branch = require('../models/Branch');
const Cluster = require('../models/Cluster');
const Category = require('../models/Category');
const BranchInsightFile = require('../models/BranchInsightFile');
const Location = require('../models/Location');
const { fetchInsightJson } = require('../utils/branchInsightUtils');

// GET /api/colleges/
const getColleges = async (req, res) => {
    try {
        const filter = {};
        if (req.query.location) {
            filter.location = req.query.location;
        }
        const colleges = await College.find(filter).sort({ college_name: 1 });
        res.json(colleges);
    } catch (error) {
        console.error("Error fetching colleges:", error);
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/colleges/:public_id/
const getCollegeDetail = async (req, res) => {
    try {
        const college = await College.findOne({ public_id: req.params.public_id });
        if (!college) {
            return res.status(404).json({ error: "College not found" });
        }
        
        // Populate branches
        const branches = await Branch.find({ college: college._id }).populate('cluster');
        
        // Emulate Django CollegeDetailSerializer which likely nests branches
        const collegeData = college.toObject();
        collegeData.branches = branches;
        
        res.json(collegeData);
    } catch (error) {
        console.error("Error fetching college detail:", error);
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/branches/:public_id/
const getBranchDetail = async (req, res) => {
    try {
        const branch = await Branch.findOne({ public_id: req.params.public_id })
            .populate('college')
            .populate('cluster');
            
        if (!branch) {
            return res.status(404).json({ error: "Branch not found" });
        }
        res.json(branch);
    } catch (error) {
        console.error("Error fetching branch detail:", error);
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/branches/by-code/:college_code/
const getBranchesByCollegeCode = async (req, res) => {
    try {
        const college = await College.findOne({ college_code: req.params.college_code });
        if (!college) return res.json([]);

        const branches = await Branch.find({ college: college._id })
            .populate('college')
            .populate('cluster')
            .sort({ branch_name: 1 });
            
        res.json(branches);
    } catch (error) {
        console.error("Error fetching branches by code:", error);
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/colleges/:public_id/cutoff/
const getCollegeCutoff = async (req, res) => {
    try {
        const college = await College.findOne({ public_id: req.params.public_id });
        if (!college) {
            return res.status(404).json({ error: "College not found" });
        }

        const branches = await Branch.find({ college: college._id }).populate('college').populate('cluster');
        
        const cutoffData = {};
        branches.forEach(branch => {
            const branchKey = branch._id;
            cutoffData[branchKey] = {
                branch: branch,
                categories: {}
            };

            if (branch.cutoffs && branch.cutoffs.length > 0) {
                branch.cutoffs.forEach(cutoff => {
                    cutoffData[branchKey].categories[cutoff.category] = {
                        '2022': {
                            'r1': cutoff.cutoff_2022_r1,
                            'r2': cutoff.cutoff_2022_r2,
                            'r3': cutoff.cutoff_2022_r3,
                        },
                        '2023': {
                            'r1': cutoff.cutoff_2023_r1,
                            'r2': cutoff.cutoff_2023_r2,
                            'r3': cutoff.cutoff_2023_r3,
                        },
                        '2024': {
                            'r1': cutoff.cutoff_2024_r1,
                            'r2': cutoff.cutoff_2024_r2,
                            'r3': cutoff.cutoff_2024_r3,
                        },
                        '2025': {
                            'r1': cutoff.cutoff_2025_r1,
                            'r2': cutoff.cutoff_2025_r2,
                            'r3': cutoff.cutoff_2025_r3,
                        },
                    };
                });
            }
        });

        res.json(cutoffData);
    } catch (error) {
        console.error("Error fetching college cutoff:", error);
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/branches/:public_id/cutoff/
const getBranchCutoff = async (req, res) => {
    try {
        const branch = await Branch.findOne({ public_id: req.params.public_id }).populate('college').populate('cluster');
        if (!branch) {
            return res.status(404).json({ error: "Branch not found" });
        }

        const categoryFilter = req.query.category;
        let validCategories = new Set();
        
        if (categoryFilter) {
            const catObj = await Category.findOne({ _id: categoryFilter });
            if (catObj && catObj.fall_back) {
                catObj.fall_back.split(',').forEach(c => validCategories.add(c.trim()));
            } else {
                validCategories.add(categoryFilter);
            }
        }

        const cutoffData = {
            branch: branch,
            categories: {}
        };

        if (branch.cutoffs && branch.cutoffs.length > 0) {
            branch.cutoffs.forEach(cutoff => {
                if (categoryFilter && !validCategories.has(cutoff.category)) {
                    return; // Skip if filter applied
                }

                cutoffData.categories[cutoff.category] = {
                    '2022': { r1: cutoff.cutoff_2022_r1, r2: cutoff.cutoff_2022_r2, r3: cutoff.cutoff_2022_r3 },
                    '2023': { r1: cutoff.cutoff_2023_r1, r2: cutoff.cutoff_2023_r2, r3: cutoff.cutoff_2023_r3 },
                    '2024': { r1: cutoff.cutoff_2024_r1, r2: cutoff.cutoff_2024_r2, r3: cutoff.cutoff_2024_r3 },
                    '2025': { r1: cutoff.cutoff_2025_r1, r2: cutoff.cutoff_2025_r2, r3: cutoff.cutoff_2025_r3 }
                };
            });
        }

        res.json(cutoffData);
    } catch (error) {
        console.error("Error fetching branch cutoff:", error);
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/colleges/search/ or /api/search/
const search = async (req, res) => {
    try {
        const query = (req.query.query || '').trim();
        const location = (req.query.location || '').trim();

        let collegeMatch = {};
        if (query) {
            collegeMatch.$or = [
                { college_name: { $regex: query, $options: 'i' } },
                { college_code: { $regex: query, $options: 'i' } },
                { location: { $regex: query, $options: 'i' } }
            ];
        }
        if (location) {
            collegeMatch.location = { $regex: `^${location}$`, $options: 'i' };
        }

        const colleges = await College.find(collegeMatch);

        // Branches logic requires join with College in MongoDB. Since College is ref, we use populate
        // But filtering based on populated fields is complex in standard mongoose find().
        // We will fetch matching Colleges first and filter branches, or use aggregate
        // Alternatively, since branch dataset is small, fetch all populated or fetch matching colleges first
        let branchCollegesMatch = {};
        if (query) {
            branchCollegesMatch.$or = [
                { college_name: { $regex: query, $options: 'i' } },
                { college_code: { $regex: query, $options: 'i' } },
                { location: { $regex: query, $options: 'i' } }
            ];
        }
        if (location) {
            branchCollegesMatch.location = { $regex: `^${location}$`, $options: 'i' };
        }

        const matchedCollegesForBranch = await College.find(branchCollegesMatch);
        const matchedCollegeIds = matchedCollegesForBranch.map(c => c._id);

        let branchMatch = {};
        if (query) {
            branchMatch.$or = [
                { branch_name: { $regex: query, $options: 'i' } },
                { college: { $in: matchedCollegeIds } }
            ];
        } else if (location) {
            branchMatch.college = { $in: matchedCollegeIds };
        }

        const branches = await Branch.find(branchMatch).populate('college').populate('cluster');

        const uniqueLocations = await College.distinct('location');
        const sortedLocations = uniqueLocations.filter(loc => loc).sort();

        res.json({
            colleges,
            branches,
            locations: sortedLocations
        });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/colleges/locations/
const locationsList = async (req, res) => {
    try {
        const locations = await Location.find().sort({ location_name: 1 });
        res.json(locations);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/colleges/categories/
const categoryList = async (req, res) => {
    try {
        const categories = await Category.find().sort({ _id: 1 });
        const formatted = categories.map(c => ({ category: c._id, fall_back: c.fall_back }));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/colleges/clusters/
const clusterList = async (req, res) => {
    try {
        const clusters = await Cluster.find().sort({ _id: 1 });
        res.json(clusters);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// POST /api/colleges/branch-insights/
const branchInsights = async (req, res) => {
    try {
        const { college_name, branch_name } = req.body;
        if (!college_name || !branch_name) {
            return res.status(400).json({ error: 'college_name and branch_name are required.' });
        }

        const college = await College.findOne({ college_name: { $regex: `^${college_name}$`, $options: 'i' } });
        const branch = await Branch.findOne({ 
            college: college ? college._id : null,
            branch_name: { $regex: `^${branch_name}$`, $options: 'i' } 
        });

        if (!college || !branch) {
            return res.status(404).json({ error: "Branch insights not found for this specific branch." });
        }

        const insight = await BranchInsightFile.findOne({ branch: branch._id, is_active: true });
        
        if (!insight) {
            return res.status(404).json({ error: "Branch insights not found for this specific branch." });
        }

        const insightData = await fetchInsightJson(insight);
        res.json(insightData);
    } catch (error) {
        console.error("Branch insights error:", error);
        res.status(500).json({ error: 'Unable to fetch branch insights at the moment. Please try again later.' });
    }
};

module.exports = {
    getColleges,
    getCollegeDetail,
    getBranchDetail,
    getBranchesByCollegeCode,
    getCollegeCutoff,
    getBranchCutoff,
    search,
    locationsList,
    categoryList,
    clusterList,
    branchInsights
};
