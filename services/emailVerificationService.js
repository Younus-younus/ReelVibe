const dns = require('dns').promises;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PROVIDER = (process.env.EMAIL_VERIFICATION_PROVIDER || 'abstract').toLowerCase();
const API_KEY = process.env.EMAIL_VERIFICATION_API_KEY;

function parseBooleanLike(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return null;

    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', '1'].includes(normalized)) return true;
    if (['false', 'no', '0'].includes(normalized)) return false;
    return null;
}

async function checkMxRecords(domain) {
    try {
        const records = await dns.resolveMx(domain);
        return Array.isArray(records) && records.length > 0;
    } catch (error) {
        return false;
    }
}

async function verifyWithAbstractApi(email) {
    const endpoint = `https://emailvalidation.abstractapi.com/v1/?api_key=${encodeURIComponent(API_KEY)}&email=${encodeURIComponent(email)}`;
    const response = await fetch(endpoint);

    if (!response.ok) {
        throw new Error(`Abstract API request failed with status ${response.status}`);
    }

    const data = await response.json();

    const smtpValid = parseBooleanLike(data?.is_smtp_valid?.value);
    const deliverability = typeof data?.deliverability === 'string' ? data.deliverability.toLowerCase() : null;

    let exists = null;
    if (smtpValid === true) {
        exists = true;
    } else if (smtpValid === false) {
        exists = false;
    } else if (deliverability === 'deliverable') {
        exists = true;
    } else if (deliverability === 'undeliverable') {
        exists = false;
    }

    return {
        provider: 'abstract',
        exists,
        deliverability,
        raw: data
    };
}

async function verifyWithProvider(email) {
    if (!API_KEY) {
        return {
            provider: null,
            exists: null,
            reason: 'api-key-missing'
        };
    }

    if (PROVIDER === 'abstract') {
        return verifyWithAbstractApi(email);
    }

    throw new Error(`Unsupported email verification provider: ${PROVIDER}`);
}

async function verifyEmailAddress(email) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const isValidSyntax = EMAIL_REGEX.test(normalizedEmail);

    if (!isValidSyntax) {
        return {
            email: normalizedEmail,
            isValidSyntax: false,
            hasMxRecords: false,
            exists: false,
            canRegister: false,
            providerUsed: null,
            isApiCheckPerformed: false,
            reason: 'invalid-syntax'
        };
    }

    const domain = normalizedEmail.split('@')[1];
    const hasMxRecords = await checkMxRecords(domain);

    if (!hasMxRecords) {
        return {
            email: normalizedEmail,
            isValidSyntax: true,
            hasMxRecords: false,
            exists: false,
            canRegister: false,
            providerUsed: null,
            isApiCheckPerformed: false,
            reason: 'mx-missing'
        };
    }

    try {
        const providerResult = await verifyWithProvider(normalizedEmail);
        const exists = providerResult.exists;

        return {
            email: normalizedEmail,
            isValidSyntax: true,
            hasMxRecords: true,
            exists,
            canRegister: exists !== false,
            providerUsed: providerResult.provider,
            isApiCheckPerformed: Boolean(providerResult.provider),
            reason: providerResult.reason || null,
            deliverability: providerResult.deliverability || null
        };
    } catch (error) {
        return {
            email: normalizedEmail,
            isValidSyntax: true,
            hasMxRecords: true,
            exists: null,
            canRegister: true,
            providerUsed: null,
            isApiCheckPerformed: false,
            reason: 'provider-error',
            providerError: error.message
        };
    }
}

module.exports = {
    verifyEmailAddress
};
