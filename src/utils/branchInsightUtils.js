const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, bucketName } = require('../config/s3');

const normalizeInsightData = (data) => {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid insight JSON structure');
    }

    const prosCons = data.pros_cons || data.prosCons || {};

    return {
        about: data.about || '',
        admission_cutoffs: data.admission_cutoffs || data.admission_cutoff || '',
        placements: data.placements || '',
        pros_cons: {
            pros: Array.isArray(prosCons.pros) ? prosCons.pros : [],
            cons: Array.isArray(prosCons.cons) ? prosCons.cons : [],
        },
        features: Array.isArray(data.features) ? data.features : [],
        one_line_summary: data.one_line_summary || data.summary || '',
        additional_info: Array.isArray(data.additional_info)
            ? data.additional_info
            : Array.isArray(data.additionalInfo)
              ? data.additionalInfo
              : [],
    };
};

const fetchInsightJson = async (insight) => {
    if (!insight) {
        throw new Error('Insight record not found');
    }

    if (insight.json_data) {
        try {
            return normalizeInsightData(insight.json_data);
        } catch (dbError) {
            console.warn('Failed to normalize json_data from database, falling back to S3:', dbError.message);
        }
    }

    if (s3Client && bucketName && insight.s3_key) {
        try {
            const response = await s3Client.send(
                new GetObjectCommand({
                    Bucket: bucketName,
                    Key: insight.s3_key,
                })
            );
            const body = await response.Body.transformToString();
            return normalizeInsightData(JSON.parse(body));
        } catch (s3Error) {
            console.warn('S3 GetObject failed, trying URL fetch:', s3Error.message);
        }
    }

    if (insight.s3_url && !insight.s3_url.includes('dummy-s3-url') && !insight.s3_url.includes('s3-mock')) {
        const response = await fetch(insight.s3_url);
        if (!response.ok) {
            throw new Error('Unable to retrieve insights from storage.');
        }
        const raw = await response.json();
        return normalizeInsightData(raw);
    }

    throw new Error('Unable to retrieve insights from storage.');
};

module.exports = {
    normalizeInsightData,
    fetchInsightJson,
};
