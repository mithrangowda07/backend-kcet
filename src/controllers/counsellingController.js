const CounsellingChoice = require('../models/CounsellingChoice');
const Branch = require('../models/Branch');
const Category = require('../models/Category');
const { getRecommendations, calculateRankWindow } = require('../utils/counsellingAlgorithm');

// Helper function to replicate _get_cutoff_rank
const getCutoffRank = async (studentCategory, branch, year = '2025', roundName = 'r1') => {
    const cutoffField = `cutoff_${year}_${roundName}`;
    let categoriesToTry = [];
    
    if (studentCategory) {
        const catObj = await Category.findOne({ _id: studentCategory });
        if (catObj && catObj.fall_back) {
            catObj.fall_back.split(',').forEach(c => categoriesToTry.push(c.trim()));
        }
        categoriesToTry.unshift(studentCategory);
    }
    
    if (!categoriesToTry.includes('GM')) {
        categoriesToTry.push('GM');
    }

    for (const cat of categoriesToTry) {
        const cutoff = branch.cutoffs.find(c => c.category === cat);
        if (cutoff && cutoff[cutoffField] && !['NA', '-', 'nan', ''].includes(cutoff[cutoffField])) {
            const val = parseInt(cutoff[cutoffField], 10);
            if (!isNaN(val)) return val;
        }
    }
    return null;
};

// POST /api/counselling/recommendations/
const recommendations = async (req, res) => {
    try {
        const student = req.user;
        if (student.type_of_student !== 'counselling') {
            return res.status(403).json({ error: 'Only counselling students can access recommendations' });
        }

        let kcet_rank = req.body.kcet_rank || student.kcet_rank;
        if (!kcet_rank) {
            return res.status(400).json({ error: 'kcet_rank is required' });
        }
        kcet_rank = parseInt(kcet_rank, 10);
        if (isNaN(kcet_rank)) return res.status(400).json({ error: 'kcet_rank must be a valid integer' });

        const category = req.body.category || student.category;
        const year = req.body.year || '2025';
        let round_name = (req.body.round || 'R1').toUpperCase();
        if (!['R1', 'R2', 'R3'].includes(round_name)) round_name = 'R1';
        
        const cluster = req.body.cluster || null;
        let opening_rank = req.body.opening_rank !== undefined ? parseInt(req.body.opening_rank, 10) : null;
        let closing_rank = req.body.closing_rank !== undefined ? parseInt(req.body.closing_rank, 10) : null;

        const [calcOpening, calcClosing] = calculateRankWindow(kcet_rank);
        const response_opening = opening_rank !== null && !isNaN(opening_rank) ? opening_rank : calcOpening;
        const response_closing = closing_rank !== null && !isNaN(closing_rank) ? closing_rank : calcClosing;

        const recommendationsList = await getRecommendations(kcet_rank, category, year, round_name, cluster, opening_rank, closing_rank);

        res.json({
            kcet_rank,
            category,
            year,
            round: round_name,
            cluster,
            opening_rank: response_opening,
            closing_rank: response_closing,
            recommendations: recommendationsList,
            count: recommendationsList.length
        });
    } catch (error) {
        console.error("Recommendations error:", error);
        res.status(500).json({ error: "Server error" });
    }
};

// Helper to format counselling choices according to expected frontend structure
const formatCounsellingChoices = async (choices, student, year = '2025', round_name = 'r1') => {
    const validCategories = new Set();
    if (student.category) {
        const catObj = await Category.findOne({ _id: student.category });
        if (catObj && catObj.fall_back) {
            catObj.fall_back.split(',').forEach(c => validCategories.add(c.trim()));
        }
        validCategories.add(student.category);
    }

    const cutoffField = `cutoff_${year}_${round_name}`;

    return choices.map(choice => {
        const choiceObj = choice.toObject();
        const branch = choice.unique_key; // Populated Branch document
        let cutoffValue = null;

        if (branch && branch.cutoffs) {
            for (const cat of validCategories) {
                const cutoff = branch.cutoffs.find(c => c.category === cat);
                if (cutoff && cutoff[cutoffField]) {
                    cutoffValue = cutoff[cutoffField];
                    break;
                }
            }
            if (!cutoffValue) {
                const gmCutoff = branch.cutoffs.find(c => c.category === 'GM');
                if (gmCutoff && gmCutoff[cutoffField]) {
                    cutoffValue = gmCutoff[cutoffField];
                }
            }
        }

        const formattedCutoff = cutoffValue !== null && !['NA', '-', 'nan', ''].includes(cutoffValue)
            ? parseFloat(cutoffValue) || cutoffValue
            : null;

        return {
            choice_id: choiceObj._id,
            order_of_list: choiceObj.order_of_list,
            order: choiceObj.order_of_list,
            unique_key: branch ? branch._id : choiceObj.unique_key,
            unique_key_data: branch ? {
                unique_key: branch._id,
                public_id: branch.public_id,
                branch_id: branch.branch_id,
                branch_name: branch.branch_name,
                college: branch.college,
                cluster: branch.cluster,
            } : null,
            college_name: branch?.college?.college_name || '',
            branch_name: branch?.branch_name || '',
            cluster: branch?.cluster?.cluster_name || '',
            cutoff: formattedCutoff,
            created_at: choiceObj.created_at,
            updated_at: choiceObj.updated_at
        };
    });
};

// GET /api/counselling/choices/ or /api/counselling/choices/:studentId
const choicesList = async (req, res) => {
    try {
        const student = req.user;
        if (student.type_of_student !== 'counselling') {
            return res.status(403).json({ error: 'Only counselling students can access choices' });
        }

        const targetStudentId = req.params.studentId || student._id;

        const choices = await CounsellingChoice.find({ student_user_id: targetStudentId })
            .sort({ order_of_list: 1 })
            .populate({
                path: 'unique_key',
                populate: [{ path: 'college' }, { path: 'cluster' }]
            });

        const year = req.query.year || '2025';
        const round_name = req.query.round || 'r1';

        const choicesData = await formatCounsellingChoices(choices, student, year, round_name);
        res.json(choicesData);
    } catch (error) {
        console.error("Choices list error:", error);
        res.status(500).json({ error: "Server error" });
    }
};

// POST /api/counselling/choices/create/
const choicesCreate = async (req, res) => {
    try {
        const student = req.user;
        if (student.type_of_student !== 'counselling') {
            return res.status(403).json({ error: 'Only counselling students can create choices' });
        }

        const { public_id } = req.body;
        const branch = await Branch.findOne({ public_id });
        if (!branch) return res.status(404).json({ error: 'Branch not found' });

        const existing = await CounsellingChoice.findOne({ student_user_id: student._id, unique_key: branch._id });
        if (existing) return res.status(400).json({ error: 'This branch is already in your choices' });

        const existingChoices = await CounsellingChoice.find({ student_user_id: student._id }).sort({ order_of_list: 1 }).populate('unique_key');
        
        const newRank = await getCutoffRank(student.category, branch, '2025', 'r1');
        let insertPosition = existingChoices.length + 1;

        for (let i = 0; i < existingChoices.length; i++) {
            const choice = existingChoices[i];
            const existingRank = await getCutoffRank(student.category, choice.unique_key, '2025', 'r1');

            if (newRank === null) {
                if (existingRank === null) {
                    insertPosition = i + 1;
                    break;
                }
                continue;
            }

            if (existingRank === null || newRank <= existingRank) {
                insertPosition = i + 1;
                break;
            }
        }

        // Shift existing choices
        for (let i = existingChoices.length - 1; i >= 0; i--) {
            if (existingChoices[i].order_of_list >= insertPosition) {
                existingChoices[i].order_of_list += 1;
                await existingChoices[i].save();
            }
        }

        const newChoice = new CounsellingChoice({
            student_user_id: student._id,
            unique_key: branch._id,
            order_of_list: insertPosition
        });
        await newChoice.save();

        res.status(201).json(newChoice);
    } catch (error) {
        console.error("Choices create error:", error);
        res.status(400).json({ error: "Validation failed." });
    }
};

// PATCH /api/counselling/choices/:choice_id/update/
const choicesUpdate = async (req, res) => {
    try {
        const student = req.user;
        if (student.type_of_student !== 'counselling') return res.status(403).json({ error: 'Unauthorized' });

        const choice = await CounsellingChoice.findOne({ _id: req.params.choice_id, student_user_id: student._id });
        if (!choice) return res.status(404).json({ error: 'Choice not found' });

        const newOrder = req.body.order_of_list;
        if (newOrder === undefined) return res.status(400).json({ error: 'order_of_list is required' });

        const existing = await CounsellingChoice.findOne({ student_user_id: student._id, order_of_list: newOrder, _id: { $ne: choice._id } });
        if (existing) return res.status(400).json({ error: `Order ${newOrder} is already taken` });

        choice.order_of_list = newOrder;
        await choice.save();
        res.json(choice);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// DELETE /api/counselling/choices/:choice_id/delete/
const choicesDelete = async (req, res) => {
    try {
        const student = req.user;
        const choice = await CounsellingChoice.findOneAndDelete({ _id: req.params.choice_id, student_user_id: student._id });
        if (!choice) return res.status(404).json({ error: 'Choice not found' });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// POST /api/counselling/choices/bulk-update/
const choicesBulkUpdate = async (req, res) => {
    try {
        const student = req.user;
        if (student.type_of_student !== 'counselling') return res.status(403).json({ error: 'Unauthorized' });

        let choicesData = req.body;
        if (!Array.isArray(choicesData)) {
            choicesData = req.body.choices || [];
        }

        if (!choicesData.length) return res.status(400).json({ error: 'choices array is required' });

        // Temporarily set negative to avoid unique constraint
        for (const item of choicesData) {
            if (item.choice_id) {
                const choice = await CounsellingChoice.findOne({ _id: item.choice_id, student_user_id: student._id });
                if (choice) {
                    choice.order_of_list = -Math.abs(choice.order_of_list);
                    await choice.save();
                }
            }
        }

        // Apply new orders
        for (const item of choicesData) {
            if (item.choice_id && item.order_of_list !== undefined) {
                const choice = await CounsellingChoice.findOne({ _id: item.choice_id, student_user_id: student._id });
                if (choice) {
                    choice.order_of_list = item.order_of_list;
                    await choice.save();
                }
            }
        }

        // Refetch and return same as choicesList
        const choices = await CounsellingChoice.find({ student_user_id: student._id })
            .sort({ order_of_list: 1 })
            .populate({
                path: 'unique_key',
                populate: [{ path: 'college' }, { path: 'cluster' }]
            });
        
        const formattedChoices = await formatCounsellingChoices(choices, student);
        res.json(formattedChoices);
    } catch (error) {
        console.error("Bulk update error:", error);
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    recommendations,
    choicesList,
    choicesCreate,
    choicesUpdate,
    choicesDelete,
    choicesBulkUpdate
};
