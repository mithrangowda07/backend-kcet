const AdminAccount = require('../models/AdminAccount');
const College = require('../models/College');
const Branch = require('../models/Branch');
const Student = require('../models/Student');
const BranchInsightFile = require('../models/BranchInsightFile');
const { verifyPassword } = require('../utils/hash');
const { generateAdminTokens } = require('../utils/jwt');
const { uploadToS3, getPresignedUrlFromObjectUrl } = require('../utils/s3Upload');
const { fetchInsightJson } = require('../utils/branchInsightUtils');
const { sendRegistrationApprovedEmail, sendRegistrationRejectedEmail } = require('../utils/emailService');

const formatAdminStudentListItem = (student) => {
    const branch = student.unique_key;
    let college_name = student.college_code || '';
    let department = '';

    if (branch && typeof branch === 'object') {
        department = branch.branch_name || '';
        const college = branch.college;
        if (college && typeof college === 'object' && college.college_name) {
            college_name = college.college_name;
        }
    }

    return {
        student_user_id: student._id,
        name: student.name || '',
        email_id: student.email_id,
        college_name,
        department,
        created_at: student.created_at,
        approval_status: student.approval_status,
    };
};

const formatAdminStudentDetail = async (student) => {
    const branch = student.unique_key;
    let college_name = '';
    let department = '';

    if (branch && typeof branch === 'object') {
        department = branch.branch_name || '';
        const college = branch.college;
        if (college && typeof college === 'object' && college.college_name) {
            college_name = college.college_name;
        }
    }

    if (!college_name && student.college_code) {
        const college = await College.findOne({ college_code: student.college_code });
        if (college) college_name = college.college_name;
    }

    const presignedUrl = student.id_card_url
        ? await getPresignedUrlFromObjectUrl(student.id_card_url, 3600)
        : null;

    return {
        student_user_id: student._id,
        name: student.name || '',
        email_id: student.email_id,
        phone_number: student.phone_number,
        college_name,
        department,
        college_code: student.college_code,
        year_of_starting: student.year_of_starting,
        usn: student.usn,
        category: student.category,
        created_at: student.created_at,
        approval_status: student.approval_status,
        id_card_url: presignedUrl,
        id_card_view_url: presignedUrl,
        id_card_download_url: presignedUrl,
        reviewed_at: student.reviewed_at,
        rejection_reason: student.rejection_reason,
    };
};

// POST /api/insights-manager/login/
const adminLogin = async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const admin = await AdminAccount.findOne({ email, is_active: true });
        if (!admin || !verifyPassword(password, admin.password)) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const tokens = generateAdminTokens(admin._id, email);

        res.json({
            admin: admin,
            tokens: tokens
        });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/insights-manager/me/
const adminMe = async (req, res) => {
    // req.admin populated by adminAuthMiddleware
    res.json({ admin: req.admin });
};

// GET /api/insights-manager/colleges/
const adminCollegeList = async (req, res) => {
    try {
        const colleges = await College.find().sort({ college_name: 1 });
        res.json(colleges);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/insights-manager/colleges/:college_id/branches/
const adminBranchesByCollege = async (req, res) => {
    try {
        const collegeParam = req.params.college_id;
        const college = await College.findOne({
            $or: [
                { _id: collegeParam },
                { public_id: collegeParam },
                { college_code: collegeParam }
            ]
        });

        if (!college) return res.status(404).json({ error: 'College not found.' });

        const branches = await Branch.find({ college: college._id }).populate('college').populate('cluster').sort({ branch_name: 1 });
        if (branches.length === 0) {
            return res.json([]);
        }
        res.json(branches);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// POST /api/insights-manager/branch-insights/upload/
const adminUploadBranchInsight = async (req, res) => {
    // Requires a file upload logic for insights if it doesn't already exist.
    // For now we assume a simple json_text or json_file and we will mock the upload functionality.
    try {
        const { college_id, branch_id, json_text } = req.body;

        if (!college_id || !branch_id) {
            return res.status(400).json({ error: 'Validation failed.', validation_errors: ['Select both college and branch.'] });
        }

        const college = await College.findOne({
            $or: [
                { _id: college_id },
                { public_id: college_id },
                { college_code: college_id }
            ]
        });
        if (!college) {
            return res.status(404).json({ error: 'College not found.' });
        }

        const branch = await Branch.findOne({
            $or: [
                { _id: branch_id },
                { public_id: branch_id }
            ]
        });
        if (!branch || String(branch.college) !== String(college._id)) {
            return res.status(404).json({ error: 'Branch not found for selected college.' });
        }
        
        let fileContent = '';
        let originalFilename = '';

        if (req.file) {
            fileContent = req.file.buffer.toString('utf-8');
            originalFilename = req.file.originalname;
        } else if (json_text) {
            fileContent = json_text;
            originalFilename = 'pasted.json';
        } else {
            return res.status(400).json({ error: 'Validation failed.', validation_errors: ['Please provide json_text or a file.'] });
        }

        try {
            JSON.parse(fileContent);
        } catch (_error) {
            return res.status(400).json({ error: 'Validation failed.', validation_errors: ['Insight content must be valid JSON.'] });
        }

        // Deactivate old active insights
        await BranchInsightFile.updateMany({ branch: branch._id }, { is_active: false });

        const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const s3_key = `insights/${branch._id}/${Date.now()}_${safeName}`;
        const uploadResult = await uploadToS3(
            Buffer.from(fileContent, 'utf-8'),
            safeName.endsWith('.json') ? safeName : `${safeName}.json`,
            'application/json',
            'insights',
            s3_key
        );
        const s3_url = typeof uploadResult === 'string' ? uploadResult : uploadResult.url;
        const storedKey = typeof uploadResult === 'string' ? s3_key : uploadResult.key;

        const insight = new BranchInsightFile({
            college: college._id,
            branch: branch._id,
            s3_key: storedKey,
            s3_url: s3_url,
            original_filename: originalFilename,
            uploaded_by: req.admin?._id,
            file_size: Buffer.byteLength(fileContent, 'utf8'),
            is_active: true
        });

        await insight.save();

        res.status(201).json({
            message: 'Branch insight uploaded successfully.',
            insight: insight
        });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/insights-manager/students/
const adminStudentList = async (req, res) => {
    try {
        const statusFilter = (req.query.status || 'all').toLowerCase();
        let query = { type_of_student: 'studying' };

        if (statusFilter === 'pending') query.approval_status = 'PENDING';
        else if (statusFilter === 'approved') query.approval_status = 'APPROVED';
        else if (statusFilter === 'rejected') query.approval_status = 'REJECTED';

        const search = (req.query.search || '').trim();
        if (search) {
            // Because college name is in College, finding by it requires complex joins. 
            // In Node, we'll simplify search to just student fields.
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email_id: { $regex: search, $options: 'i' } },
                { college_code: { $regex: search, $options: 'i' } },
                { usn: { $regex: search, $options: 'i' } }
            ];
        }

        const students = await Student.find(query).sort({ created_at: -1 }).populate({ path: 'unique_key', populate: { path: 'college' } });
        res.json(students.map(formatAdminStudentListItem));
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/insights-manager/students/:student_id/
const adminStudentDetail = async (req, res) => {
    try {
        const student = await Student.findOne({ _id: req.params.student_id, type_of_student: 'studying' }).populate({ path: 'unique_key', populate: { path: 'college' } });
        if (!student) return res.status(404).json({ error: 'Student not found.' });

        const data = await formatAdminStudentDetail(student);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// POST /api/insights-manager/students/:student_id/approve/
const adminStudentApprove = async (req, res) => {
    try {
        const student = await Student.findOne({ _id: req.params.student_id, type_of_student: 'studying' });
        if (!student) return res.status(404).json({ error: 'Student not found.' });

        if (student.approval_status === 'APPROVED') {
            return res.json({ message: 'Student is already approved.' });
        }

        student.approval_status = 'APPROVED';
        student.is_verified_student = true;
        if (req.admin?._id) student.reviewed_by = req.admin._id;
        student.reviewed_at = new Date();
        student.rejection_reason = '';
        await student.save();

        await sendRegistrationApprovedEmail(student.name, student.email_id);

        res.json({ message: 'Student approved successfully.', student });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// POST /api/insights-manager/students/:student_id/reject/
const adminStudentReject = async (req, res) => {
    try {
        const reason = (req.body.reason || '').trim();
        if (!reason) return res.status(400).json({ error: 'Rejection reason is required.' });

        const student = await Student.findOne({ _id: req.params.student_id, type_of_student: 'studying' });
        if (!student) return res.status(404).json({ error: 'Student not found.' });

        student.approval_status = 'REJECTED';
        student.is_verified_student = false;
        if (req.admin?._id) student.reviewed_by = req.admin._id;
        student.reviewed_at = new Date();
        student.rejection_reason = reason;
        await student.save();

        await sendRegistrationRejectedEmail(student.name, student.email_id, reason);

        res.json({ message: 'Student rejected successfully.', student });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/insights-manager/branch-insights/:branch_id/
const getBranchInsight = async (req, res) => {
    try {
        const branch = await Branch.findOne({
            $or: [
                { _id: req.params.branch_id },
                { public_id: req.params.branch_id }
            ]
        }).populate('college');
        if (!branch) return res.status(404).json({ error: 'Branch not found.' });

        const insight = await BranchInsightFile.findOne({ branch: branch._id, is_active: true });
        if (!insight) return res.status(404).json({ error: 'Insight not found for this branch.' });

        const insightData = await fetchInsightJson(insight);
        res.json(insightData);
    } catch (error) {
        console.error('getBranchInsight error:', error);
        const status = error.message?.includes('not found') ? 404 : 503;
        res.status(status).json({
            error: error.message || 'Unable to fetch branch insights at the moment. Please try again later.',
        });
    }
};

module.exports = {
    adminLogin, adminMe, adminCollegeList, adminBranchesByCollege, adminUploadBranchInsight,
    adminStudentList, adminStudentDetail, adminStudentApprove, adminStudentReject, getBranchInsight
};
