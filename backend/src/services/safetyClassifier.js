/**
 * Contextual Safety Classifier Service
 * 
 * Analyzes session transcripts to detect potentially unsafe mentorship behavior:
 * - Off-platform communication requests
 * - Attempts to move mentorship sessions to private channels
 * - External payment requests
 * - Unnecessary contact sharing
 * - Attempts to bypass SkillSwap's platform
 * 
 * Uses contextual sentence analysis to eliminate false positives
 * (e.g., "WhatsApp is a messaging application" is NOT flagged;
 *  "Let's continue our mentorship on WhatsApp" IS flagged).
 * 
 * Architecture is modular so an LLM provider can be integrated if configured.
 */

import { detectPII, maskPhoneNumber, maskEmail } from "./piiDetector.js";

// Informational/Technical pattern regexes that should NOT be flagged as violations
const SAFE_CONTEXT_PATTERNS = [
    /\b(?:is|are|was|were)\s+(?:a|an)\s+(?:messaging|chat|mobile|voip|payment|fintech|banking|cloud|software|video)\s+(?:application|app|platform|service|system|protocol|tool)\b/i,
    /\b(?:architecture|clone|integration|api|sdk|internals|mechanism|backend|frontend|design)\s+of\s+(?:whatsapp|telegram|signal|gpay|upi|phonepe|paytm|zoom|google meet)\b/i,
    /\b(?:building|built|create|creating|develop|developing)\s+(?:a|an)\s+(?:clone|app|system)\s+(?:like|similar to)\s+(?:whatsapp|telegram|signal|gpay|upi|phonepe|paytm)\b/i,
    /\bhow\s+(?:does|do|can)\s+(?:whatsapp|telegram|signal|gpay|upi|phonepe|paytm)\s+(?:work|handle|scale|encrypt|process)\b/i,
    /\b(?:uses?|implements?)\s+end-to-end\s+encryption\b/i,
    /\b(?:npci|reserve bank|rbi)\b/i,
    /\b(?:launched|created|developed|regulated)\s+by\s+(?:npci|rbi|google|meta|facebook|telegram)\b/i,
    /\b(?:digital\s+payments?|payment\s+system|payment\s+gateway)\s+(?:in\s+india|ecosystem|infrastructure|technology)\b/i
];

// 1. Off-Platform Communication & Private Channel Solicitation Rules
const OFF_PLATFORM_CHANNELS = [
    { name: "WhatsApp", regex: /\b(?:whatsapp|wa)\b/i },
    { name: "Telegram", regex: /\b(?:telegram|tg)\b/i },
    { name: "Signal", regex: /\bsignal\b/i },
    { name: "Instagram", regex: /\b(?:instagram|insta|ig)\b/i },
    { name: "Discord", regex: /\bdiscord\b/i },
    { name: "Personal Zoom/Meet", regex: /\b(?:personal\s+(?:zoom|google\s*meet|meet)|my\s+(?:zoom|meet)|external\s+(?:zoom|meet))\b/i },
    { name: "Phone/Call", regex: /\b(?:phone\s*call|call\s+me|direct\s+call)\b/i }
];

const SOLICITATION_VERBS = [
    /\b(?:let'?s|lets|we\s+can|you\s+can|please)\s+(?:continue|connect|chat|talk|message|text|ping|reach|switch|move|take)\b/i,
    /\b(?:reach\s*(?:out)?\s*(?:to\s*me)?|contact\s*me|message\s*me|text\s*me|ping\s*me|call\s*me|dm\s*me|add\s*me)\b/i,
    /\b(?:drop\s*(?:me)?\s*a\s*(?:message|text|dm)|send\s*(?:me)?\s*a\s*(?:message|text|dm))\b/i,
    /\b(?:continue\s*(?:our)?\s*(?:mentorship|sessions?|discussion|chat))\b/i,
    /\b(?:take\s*this\s*offline)\b/i,
    /\b(?:next\s+session\s+(?:on|over|via))\b/i
];

// 2. Private Channel Migration Indicators (high severity)
const PRIVATE_MIGRATION_PATTERNS = [
    /\b(?:continue\s+(?:our\s+)?mentorship|future\s+sessions?|next\s+sessions?|upcoming\s+sessions?)\s+(?:on|over|via|through)\s+(?:whatsapp|telegram|signal|phone|call|personal\s+(?:zoom|meet))\b/i,
    /\b(?:take\s+this\s+offline|move\s+(?:this\s+)?to\s+private|discuss\s+privately\s+(?:on|via))\b/i,
    /\b(?:let'?s\s+(?:continue|connect)\s+(?:on|over|via)\s+(?:whatsapp|telegram|signal|instagram|personal\s+(?:zoom|meet)))\b/i,
    /\b(?:next\s+time\s+(?:just\s+)?(?:call|message|text|ping)\s+me\s+(?:on|via|at))\b/i
];

// 3. External Payment Rules
const PAYMENT_INSTRUMENTS = [
    { name: "UPI", regex: /\b(?:upi|vpa)\b/i },
    { name: "Google Pay / GPay", regex: /\b(?:gpay|google\s*pay)\b/i },
    { name: "PhonePe", regex: /\bphonepe\b/i },
    { name: "Paytm", regex: /\bpaytm\b/i },
    { name: "PayPal", regex: /\bpaypal\b/i },
    { name: "Bank Transfer", regex: /\b(?:bank\s*transfer|neft|rtgs|imps|account\s*number|ifsc)\b/i },
    { name: "Cash / Crypto", regex: /\b(?:cash|cryptocurrency|crypto|usdt|bitcoin)\b/i }
];

const PAYMENT_ACTION_PATTERNS = [
    /\b(?:pay\s*(?:me|directly|outside)|send\s*(?:money|payment|cash|fees?)|transfer\s*(?:money|funds?|amount))\b/i,
    /\b(?:my\s+(?:upi|gpay|phonepe|paytm|account|vpa)|upi\s+(?:id|handle|address|vpa)|upi\s*[:=])\b/i,
    /\b(?:charge\s*you|fee\s*is|rate\s*is|\b\d+\s*(?:rs|rupees|inr|dollars)\b)/i,
    /\b(?:pay\s+(?:via|through|using)\s+(?:upi|gpay|google\s*pay|phonepe|paytm|bank|cash|crypto))\b/i,
    /\b(?:direct\s+payment|skip\s+(?:the\s+)?fees?|discount\s+(?:if\s+you|for\s+direct))\b/i
];

// 4. Platform Bypass Rules
const PLATFORM_BYPASS_PATTERNS = [
    /\b(?:don'?t|do\s+not|avoid|skip|bypass|no\s+need\s+to)\s+(?:book|use|pay)\s+(?:on|through|via|in)\s*(?:skillswap|the\s+platform|the\s+app)\b/i,
    /\b(?:book\s+directly\s+with\s+me|deal\s+directly\s+with\s+me)\b/i,
    /\b(?:save\s*(?:platform|skillswap)?\s*(?:commission|fees?|charges?))\b/i,
    /\b(?:outside\s+(?:of\s+)?(?:skillswap|the\s+platform|the\s+app))\b/i,
    /\b(?:don'?t\s+schedule\s+here|no\s+need\s+to\s+book\s+(?:future|more)\s+sessions?\s+here)\b/i
];

// 5. Unnecessary Contact Sharing Rules
const CONTACT_SHARING_PATTERNS = [
    /\b(?:here\s*is\s*my|take\s*(?:down)?\s*my|note\s*(?:down)?\s*my|save\s*my)\s+(?:personal\s+)?(?:number|phone|contact|email|whatsapp|telegram)\b/i,
    /\b(?:my\s+(?:personal\s+)?(?:number|phone|whatsapp)\s+is)\b/i,
    /\b(?:ping\s*me\s*at|call\s*me\s*at|reach\s*me\s*at|reach\s*out\s*at)\s+(?:\+?91|0|\d{10}|[A-Za-z0-9._%+-]+@)/i,
    /\b(?:give\s*me\s*your\s*(?:personal\s+)?(?:number|phone|whatsapp|email|contact)|share\s*your\s*(?:personal\s+)?(?:number|phone|contact))\b/i
];

/**
 * Splits text into individual sentences while preserving standard abbreviations and decimals.
 */
export function splitIntoSentences(text) {
    if (!text || typeof text !== "string") return [];

    // Avoid splitting on common abbreviations like Dr., Prof., e.g., etc., or numbers
    const clean = text.replace(/([A-Z][a-z]{1,3}\.)\s+/g, "$1___SPACE___");

    const rawSentences = clean.split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/);

    return rawSentences
        .map((s) => s.replace(/___SPACE___/g, " ").trim())
        .filter((s) => s.length > 0);
}

/**
 * Checks whether a sentence is a purely safe/informational technical statement.
 */
function isSafeInformationalContext(sentence) {
    for (const pattern of SAFE_CONTEXT_PATTERNS) {
        if (pattern.test(sentence)) {
            // If it's a technical statement and does NOT contain explicit personal solicitation
            const hasExplicitSolicitation = /\b(?:call\s*me|pay\s*me|let'?s\s+continue\s+our\s+mentorship|my\s+upi|reach\s+me)\b/i.test(sentence);
            if (!hasExplicitSolicitation) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Evaluates deterministic safety rules across sentences and PII findings.
 */
export function classifySafetyRules(normalizedText, originalText = "", piiResult = null) {
    const flags = [];
    const pii = piiResult || detectPII(normalizedText);
    const sentences = splitIntoSentences(normalizedText);

    // Track rule deduplication within the single analysis
    const seenCategories = new Set();

    function addFlag(category, severity, confidence, excerpt, matchedText, reason, ruleId) {
        // Only one flag per category per analysis run (highest severity wins)
        const existing = flags.find((f) => f.category === category);
        if (existing) {
            if (confidence > existing.confidence) {
                existing.confidence = confidence;
                existing.excerpt = excerpt;
                existing.severity = severity;
                existing.reason = reason;
            }
            return;
        }

        flags.push({
            category,
            severity,
            confidence: Number(confidence.toFixed(3)),
            excerpt,
            matchedText,
            reason,
            ruleId
        });
        seenCategories.add(category);
    }

    // 1. Sentence-by-sentence contextual safety evaluation
    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];

        // Skip purely informational or educational sentences
        if (isSafeInformationalContext(sentence)) {
            continue;
        }

        // --- A. Platform Bypass Check ---
        for (const pattern of PLATFORM_BYPASS_PATTERNS) {
            const match = sentence.match(pattern);
            if (match) {
                addFlag(
                    "platform_bypass",
                    "critical",
                    0.96,
                    sentence,
                    match[0],
                    "Detected direct attempt to circumvent or bypass SkillSwap platform bookings or fees.",
                    "RULE_PLATFORM_BYPASS"
                );
                break;
            }
        }

        // --- B. Private Channel Mentorship Migration Check ---
        for (const pattern of PRIVATE_MIGRATION_PATTERNS) {
            const match = sentence.match(pattern);
            if (match) {
                addFlag(
                    "private_channel_migration",
                    "high",
                    0.94,
                    sentence,
                    match[0],
                    "Attempt to migrate mentorship relationship or future sessions to private personal channels.",
                    "RULE_PRIVATE_CHANNEL_MIGRATION"
                );
                break;
            }
        }

        // --- C. External Payment Check ---
        let paymentActionFound = null;
        for (const pat of PAYMENT_ACTION_PATTERNS) {
            const m = sentence.match(pat);
            if (m) {
                paymentActionFound = m[0];
                break;
            }
        }

        let paymentInstrumentFound = null;
        for (const inst of PAYMENT_INSTRUMENTS) {
            const m = sentence.match(inst.regex);
            if (m) {
                paymentInstrumentFound = inst.name;
                break;
            }
        }

        if (paymentActionFound && paymentInstrumentFound) {
            addFlag(
                "external_payment",
                "high",
                0.95,
                sentence,
                `${paymentActionFound} (${paymentInstrumentFound})`,
                `External payment request detected via ${paymentInstrumentFound}. SkillSwap strictly prohibits off-platform payments.`,
                "RULE_EXTERNAL_PAYMENT"
            );
        } else if (/\bmy\s+upi\s*(?:id)?\b/i.test(sentence) || /\b(?:gpay|paytm|phonepe)\s+me\b/i.test(sentence)) {
            addFlag(
                "external_payment",
                "high",
                0.92,
                sentence,
                sentence,
                "Direct peer-to-peer payment handle or payment request communicated in session.",
                "RULE_EXTERNAL_PAYMENT_HANDLE"
            );
        }

        // --- D. Off-Platform Communication Check ---
        let commVerbFound = null;
        for (const v of SOLICITATION_VERBS) {
            const m = sentence.match(v);
            if (m) {
                commVerbFound = m[0];
                break;
            }
        }

        let channelFound = null;
        for (const ch of OFF_PLATFORM_CHANNELS) {
            const m = sentence.match(ch.regex);
            if (m) {
                channelFound = ch.name;
                break;
            }
        }

        if (commVerbFound && channelFound) {
            addFlag(
                "off_platform_communication",
                "medium",
                0.88,
                sentence,
                `${commVerbFound} on ${channelFound}`,
                `Request to move communication off-platform to ${channelFound}.`,
                "RULE_OFF_PLATFORM_COMMUNICATION"
            );
        }

        // --- E. Unnecessary Contact Sharing Check ---
        for (const pattern of CONTACT_SHARING_PATTERNS) {
            const match = sentence.match(pattern);
            if (match) {
                addFlag(
                    "unnecessary_contact_sharing",
                    "medium",
                    0.89,
                    sentence,
                    match[0],
                    "Explicit sharing or solicitation of personal contact details during session.",
                    "RULE_UNNECESSARY_CONTACT_SHARING"
                );
                break;
            }
        }
    }

    // 2. Cross-Sentence PII Contact Sharing Check
    // If phone numbers or personal emails were detected alongside any contact sharing intent
    if (pii && pii.hasPII) {
        const hasPhone = pii.categories.includes("phone");
        const hasEmail = pii.categories.includes("email");

        if (hasPhone || hasEmail) {
            // Check if there is an existing flag or explicit sharing phrase
            const sharingPhrases = /\b(?:reach\s*me|contact\s*me|call\s*me|ping\s*me|text\s*me|here\s*is\s*my|my\s*number|my\s*email)\b/i;
            if (sharingPhrases.test(normalizedText)) {
                const piiExcerpt = pii.items[0]?.excerpt || pii.maskedText.slice(0, 100);
                addFlag(
                    "unnecessary_contact_sharing",
                    "medium",
                    0.87,
                    piiExcerpt,
                    hasPhone ? "Personal phone shared" : "Personal email shared",
                    "Personal direct contact details shared with active contact solicitation.",
                    "RULE_PII_CONTACT_SHARING"
                );
            }
        }
    }

    // Mask PII in all generated flag excerpts to protect user privacy
    for (const flag of flags) {
        const flagPii = detectPII(flag.excerpt);
        if (flagPii.hasPII) {
            flag.excerpt = flagPii.maskedText;
        }
    }

    return {
        isSafe: flags.length === 0,
        flagsCount: flags.length,
        flags
    };
}

/**
 * Modular safety classifier entry point.
 * Can support pluggable LLM-based classifier in options if desired.
 * 
 * @param {string} normalizedText - Normalized transcript text
 * @param {string} originalText - Raw transcript text
 * @param {object} piiResult - Optional pre-computed PII detection results
 * @param {object} options - Optional configuration (e.g., llmProvider)
 * @returns {Promise<object>} Safety classification report
 */
export async function classifySafety(normalizedText, originalText = "", piiResult = null, options = {}) {
    // 1. Run deterministic rule-based safety classifier
    const ruleReport = classifySafetyRules(normalizedText, originalText, piiResult);

    // 2. Modular hook: If an external LLM classifier is provided in options, it can be invoked here.
    if (typeof options.llmProvider === "function") {
        try {
            const llmReport = await options.llmProvider({
                normalizedText,
                originalText,
                ruleReport
            });
            if (llmReport && Array.isArray(llmReport.flags)) {
                // Combine and deduplicate flags
                for (const flag of llmReport.flags) {
                    if (!ruleReport.flags.some((f) => f.category === flag.category)) {
                        ruleReport.flags.push(flag);
                    }
                }
                ruleReport.flagsCount = ruleReport.flags.length;
                ruleReport.isSafe = ruleReport.flagsCount === 0;
            }
        } catch (err) {
            console.warn("LLM safety classifier hook error (falling back to deterministic rules):", err.message);
        }
    }

    return ruleReport;
}

export default {
    classifySafety,
    classifySafetyRules,
    splitIntoSentences
};

