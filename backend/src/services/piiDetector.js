/**
 * PII Detector Service
 * 
 * Detects Personally Identifiable Information (PII) in session transcripts:
 * - Indian phone numbers (+91, 0, or 10-digit formats starting with 6-9)
 * - Email addresses
 * - URLs (web links, meeting links, shortened URLs)
 * - Social media handles and chat usernames (@handle, Telegram, LinkedIn, WhatsApp links)
 * 
 * Returns detected categories, matched excerpts, positions, and masks sensitive values for admin preview.
 */

// Indian phone number pattern:
// Optional +91 or 0 prefix, starts with 6, 7, 8, or 9, followed by 9 digits with optional spaces/hyphens
const INDIAN_PHONE_REGEX = /(?:(?:\+91|91|0)[ -]?)?[6-9]\d{4}[ -]?\d{5}\b|(?:(?:\+91|91|0)[ -]?)?[6-9]\d{9}\b/g;

// Email pattern
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// URL patterns
const PROTOCOL_URL_REGEX = /\bhttps?:\/\/[^\s<>"'{}|\\^`]+(?:\/[^\s<>"'{}|\\^`]*)?/gi;
const WWW_URL_REGEX = /\bwww\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s<>"'{}|\\^`]*)?/gi;
const MEETING_OR_SHORT_URL_REGEX = /\b(?:bit\.ly|tinyurl\.com|t\.me|wa\.me|zoom\.us|meet\.google\.com|teams\.microsoft\.com)\/[^\s<>"'{}|\\^`]+/gi;

// Social handle patterns:
// 1. @handle (negative lookbehind for email characters to avoid matching @domain.com)
const AT_HANDLE_REGEX = /(?<![a-zA-Z0-9._%+-])@([a-zA-Z0-9_]{3,30})\b/g;

// 2. Specific social profile links & patterns
const SOCIAL_PROFILE_REGEX = /\b(?:instagram|insta|twitter|x|github|linkedin|telegram|tg|discord|snapchat)[\s/:@]+([a-zA-Z0-9_.-]{3,30})\b/gi;
const WHATSAPP_LINK_REGEX = /\b(?:wa\.me|chat\.whatsapp\.com)\/[a-zA-Z0-9_-]+/gi;
const LINKEDIN_PROFILE_REGEX = /\blinkedin\.com\/in\/[a-zA-Z0-9_-]+/gi;
const TELEGRAM_LINK_REGEX = /\bt\.me\/[a-zA-Z0-9_]+/gi;

/**
 * Mask an Indian phone number: e.g., "+919876543210" -> "+91 98****3210", "9876543210" -> "98****3210"
 */
export function maskPhoneNumber(phone) {
    if (!phone) return "";
    const clean = phone.replace(/[\s-]/g, "");

    if (clean.startsWith("+91") && clean.length >= 13) {
        return `+91 ${clean.slice(3, 5)}****${clean.slice(-2)}`;
    }
    if (clean.startsWith("91") && clean.length === 12) {
        return `+91 ${clean.slice(2, 4)}****${clean.slice(-2)}`;
    }
    if (clean.length === 10) {
        return `${clean.slice(0, 2)}****${clean.slice(-2)}`;
    }
    if (clean.length > 4) {
        return `${clean.slice(0, 2)}****${clean.slice(-2)}`;
    }
    return "****";
}

/**
 * Mask an email address: e.g., "rahul.verma@gmail.com" -> "r***a@gmail.com"
 */
export function maskEmail(email) {
    if (!email) return "";
    const parts = email.split("@");
    if (parts.length !== 2) return "*****";

    const [user, domain] = parts;
    if (user.length <= 2) {
        return `${user[0]}***@${domain}`;
    }
    return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

/**
 * Mask a URL or meeting link: e.g., "https://meet.google.com/abc-def" -> "https://meet.google.com/[REDACTED]"
 */
export function maskUrl(url) {
    if (!url) return "";
    try {
        const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
        return `${parsed.protocol}//${parsed.hostname}/[REDACTED]`;
    } catch {
        const slashIdx = url.indexOf("/");
        if (slashIdx !== -1) {
            return `${url.slice(0, slashIdx)}/[REDACTED]`;
        }
        return "[URL_REDACTED]";
    }
}

/**
 * Mask a social handle: e.g., "@rahul_dev" -> "@r***v"
 */
export function maskSocialHandle(handle) {
    if (!handle) return "";
    const clean = handle.startsWith("@") ? handle.slice(1) : handle;
    if (clean.length <= 2) return "@***";
    return `@${clean[0]}***${clean[clean.length - 1]}`;
}

/**
 * Extracts a surrounding sentence or snippet context for a match.
 */
function extractContextExcerpt(text, startIndex, endIndex, padding = 60) {
    const start = Math.max(0, startIndex - padding);
    const end = Math.min(text.length, endIndex + padding);

    let snippet = text.slice(start, end);
    if (start > 0) snippet = `...${snippet}`;
    if (end < text.length) snippet = `${snippet}...`;

    return snippet;
}

/**
 * Main PII detection function.
 * 
 * @param {string} text - The normalized or raw text
 * @returns {object} PII detection summary and items
 */
export function detectPII(text) {
    if (!text || typeof text !== "string") {
        return {
            hasPII: false,
            categories: [],
            items: [],
            maskedText: ""
        };
    }

    const matches = [];

    // Helper to add match if not already overlapping
    function addMatch(category, value, startIndex, endIndex, maskFn) {
        // Discard if completely overlapping an already registered match
        const isOverlapping = matches.some(
            (m) => !(endIndex <= m.startIndex || startIndex >= m.endIndex)
        );

        if (!isOverlapping) {
            const maskedValue = maskFn(value);
            matches.push({
                category,
                value,
                maskedValue,
                startIndex,
                endIndex,
                rawExcerpt: extractContextExcerpt(text, startIndex, endIndex),
                excerpt: "" // Will populate after masking
            });
        }
    }

    // 1. Detect Email Addresses (first to avoid handle/url confusion)
    let match;
    const emailRegex = new RegExp(EMAIL_REGEX.source, EMAIL_REGEX.flags);
    while ((match = emailRegex.exec(text)) !== null) {
        addMatch("email", match[0], match.index, match.index + match[0].length, maskEmail);
    }

    // 2. Detect URLs
    const urlRegexes = [PROTOCOL_URL_REGEX, WWW_URL_REGEX, MEETING_OR_SHORT_URL_REGEX];
    for (const r of urlRegexes) {
        const regex = new RegExp(r.source, r.flags);
        while ((match = regex.exec(text)) !== null) {
            addMatch("url", match[0], match.index, match.index + match[0].length, maskUrl);
        }
    }

    // 3. Detect WhatsApp and Telegram specific links
    const socialLinkRegexes = [WHATSAPP_LINK_REGEX, LINKEDIN_PROFILE_REGEX, TELEGRAM_LINK_REGEX];
    for (const r of socialLinkRegexes) {
        const regex = new RegExp(r.source, r.flags);
        while ((match = regex.exec(text)) !== null) {
            addMatch("social_handle", match[0], match.index, match.index + match[0].length, maskUrl);
        }
    }

    // 4. Detect Indian Phone Numbers
    const phoneRegex = new RegExp(INDIAN_PHONE_REGEX.source, INDIAN_PHONE_REGEX.flags);
    while ((match = phoneRegex.exec(text)) !== null) {
        const digitsOnly = match[0].replace(/[\s+-]/g, "");
        // Filter out non-phone numbers like years (2026), small sequences, or 10-digit zeros
        if (digitsOnly.length >= 10 && digitsOnly.length <= 13) {
            addMatch("phone", match[0], match.index, match.index + match[0].length, maskPhoneNumber);
        }
    }

    // 5. Detect @handles
    const handleRegex = new RegExp(AT_HANDLE_REGEX.source, AT_HANDLE_REGEX.flags);
    while ((match = handleRegex.exec(text)) !== null) {
        addMatch("social_handle", match[0], match.index, match.index + match[0].length, maskSocialHandle);
    }

    // 6. Detect platform mentions with usernames e.g. "telegram: rahul_dev"
    const platformRegex = new RegExp(SOCIAL_PROFILE_REGEX.source, SOCIAL_PROFILE_REGEX.flags);
    while ((match = platformRegex.exec(text)) !== null) {
        addMatch("social_handle", match[0], match.index, match.index + match[0].length, (val) => {
            const parts = val.split(/[\s/:@]+/);
            return `${parts[0]}: ${maskSocialHandle(parts[1] || "")}`;
        });
    }

    // Sort matches in order of appearance
    matches.sort((a, b) => a.startIndex - b.startIndex);

    // Build fully masked text
    let maskedText = "";
    let lastIndex = 0;

    for (const m of matches) {
        maskedText += text.slice(lastIndex, m.startIndex);
        maskedText += m.maskedValue;
        lastIndex = m.endIndex;
    }
    maskedText += text.slice(lastIndex);

    // Populate masked excerpts for each match
    for (const m of matches) {
        m.excerpt = extractContextExcerpt(maskedText, m.startIndex, m.startIndex + m.maskedValue.length);
    }

    const categories = [...new Set(matches.map((m) => m.category))];

    return {
        hasPII: matches.length > 0,
        categories,
        items: matches,
        maskedText
    };
}

export default {
    detectPII,
    maskPhoneNumber,
    maskEmail,
    maskUrl,
    maskSocialHandle
};

