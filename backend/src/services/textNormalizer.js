/**
 * Text Normalizer Service
 * 
 * Normalizes speech-to-text transcriptions:
 * - Normalizes whitespace and punctuation
 * - Converts spoken numbers and multipliers (e.g., "nine eight double seven oh four") to digits
 * - Normalizes spoken email phrases (e.g., "at the rate", "dot com") into canonical symbols
 * - Handles spoken phone number formats and social handles
 * - Preserves original transcript for reference
 */

const DIGIT_WORDS = {
    zero: "0",
    oh: "0",
    o: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9"
};

/**
 * Normalizes whitespace and basic punctuation.
 */
export function normalizeWhitespaceAndPunctuation(text) {
    if (!text || typeof text !== "string") return "";

    return text
        // Replace smart/curly quotes with standard ASCII
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u2014|\u2013/g, "-")
        .replace(/[`´]/g, "'")
        // Collapse repeated punctuation marks
        .replace(/!{2,}/g, "!")
        .replace(/\?{2,}/g, "?")
        .replace(/\.{3,}/g, "...")
        // Collapse multiple whitespace/newlines
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

/**
 * Normalizes spoken multipliers such as "double seven" -> "77" or "triple nine" -> "999".
 */
export function normalizeMultipliers(text) {
    if (!text) return "";

    let result = text;

    // Handle "triple <digit>"
    result = result.replace(
        /\btriple\s+(zero|oh|o|one|two|three|four|five|six|seven|eight|nine|\d)\b/gi,
        (match, digit) => {
            const d = DIGIT_WORDS[digit.toLowerCase()] || digit;
            return `${d}${d}${d}`;
        }
    );

    // Handle "double <digit>"
    result = result.replace(
        /\bdouble\s+(zero|oh|o|one|two|three|four|five|six|seven|eight|nine|\d)\b/gi,
        (match, digit) => {
            const d = DIGIT_WORDS[digit.toLowerCase()] || digit;
            return `${d}${d}`;
        }
    );

    return result;
}

/**
 * Normalizes spoken country code prefixes like "plus nine one" or "plus 91" -> "+91".
 */
export function normalizeCountryCodes(text) {
    if (!text) return "";

    return text
        .replace(/\bplus\s+nine\s+one\b/gi, "+91 ")
        .replace(/\bplus\s+91\b/gi, "+91 ")
        .replace(/\bplus\s+one\b/gi, "+1 ");
}

/**
 * Normalizes spoken separators like "dash" or "hyphen" between digits or digit words.
 */
export function normalizeSpokenSeparators(text) {
    if (!text) return "";

    const digitOrWord = "(?:zero|oh|o|one|two|three|four|five|six|seven|eight|nine|\\d+)";
    const pattern = new RegExp(`(\\b${digitOrWord})\\s+(?:dash|hyphen)\\s+(${digitOrWord}\\b)`, "gi");
    return text.replace(pattern, "$1-$2");
}

/**
 * Normalizes sequences of spoken or spaced digit words into numeric strings.
 */
export function normalizeSpokenDigits(text) {
    if (!text) return "";

    let processed = normalizeCountryCodes(text);
    processed = normalizeMultipliers(processed);
    processed = normalizeSpokenSeparators(processed);

    // Match sequences of digit words and digits separated by spaces, dashes, or commas
    // e.g. "nine eight seven six five four three two one zero" -> "9876543210"
    const digitWordPattern = /\b(?:zero|oh|o|one|two|three|four|five|six|seven|eight|nine|\d+)(?:[\s,-]+(?:zero|oh|o|one|two|three|four|five|six|seven|eight|nine|\d+)){3,}\b/gi;

    processed = processed.replace(digitWordPattern, (match) => {
        const tokens = match.split(/[\s,-]+/);
        let digitsOnly = "";
        for (const token of tokens) {
            const lower = token.toLowerCase();
            if (DIGIT_WORDS[lower] !== undefined) {
                digitsOnly += DIGIT_WORDS[lower];
            } else if (/^\d+$/.test(token)) {
                digitsOnly += token;
            } else {
                return match;
            }
        }
        return digitsOnly;
    });

    // Merge "+91 " directly followed by 10 digits
    processed = processed.replace(/\+91\s+(\d{10})\b/g, "+91$1");

    return processed;
}

/**
 * Normalizes spoken email representations into valid email strings:
 * - "at the rate of", "at the rate" -> "@"
 * - "dot com", "dot in" -> ".com", ".in"
 * - "dot" between username components -> "."
 * - "underscore" -> "_"
 */
export function normalizeSpokenEmail(text) {
    if (!text) return "";

    let result = text;

    // 1. Spoken symbols
    result = result
        .replace(/\bat\s+the\s+rate\s+of\b/gi, "@")
        .replace(/\bat\s+the\s+rate\b/gi, "@")
        .replace(/\s*\[at\]\s*/gi, "@")
        .replace(/\s*\(at\)\s*/gi, "@");

    // 2. Spoken connectors in handle/email context
    result = result.replace(/([a-zA-Z0-9]+)\s+underscore\s+([a-zA-Z0-9]+)/gi, "$1_$2");
    result = result.replace(/\bunderscore\b/gi, "_");

    // 3. Spoken common domain extensions: "dot com", "dot co dot in", "dot org", etc.
    result = result
        .replace(/\bdot\s+co\s+dot\s+in\b/gi, ".co.in")
        .replace(/\bdot\s+ac\s+dot\s+in\b/gi, ".ac.in")
        .replace(/\bdot\s+res\s+dot\s+in\b/gi, ".res.in")
        .replace(/\bdot\s+(com|in|org|net|edu|gov|io|ai|tech|me|dev|app|xyz)\b/gi, ".$1");

    // 4. "dot" surrounded by letters/numbers before an @ symbol: e.g. "rahul dot verma@" -> "rahul.verma@"
    result = result.replace(/([a-zA-Z0-9_-]+)\s+dot\s+([a-zA-Z0-9_-]+)(?=\s*@)/gi, "$1.$2");

    // 5. Connect domain parts around @: e.g. "username @ gmail . com" -> "username@gmail.com"
    result = result.replace(
        /([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9-]+)\s*(\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/gi,
        "$1@$2$3"
    );

    // 6. Connect "at" between username and well-known email providers:
    // e.g. "rahul at gmail dot com" -> "rahul@gmail.com"
    result = result.replace(
        /([a-zA-Z0-9._%+-]+)\s+at\s+(gmail|yahoo|outlook|hotmail|icloud|proton|protonmail)\s*\.(com|in|org|net|me)\b/gi,
        "$1@$2.$3"
    );

    // 7. Spoken social handle: "at the rate username" -> "@username"
    result = result.replace(/@\s+([a-zA-Z0-9_]+)/g, "@$1");

    return result;
}

/**
 * Normalizes phone numbers with spaced or hyphenated digits:
 * e.g. "+91 98765 43210" or "98765 43210" or "9876-543-210"
 */
export function normalizePhoneFormatting(text) {
    if (!text) return "";

    let result = text;

    // Standardize spaced 10 digits starting with 6-9
    result = result.replace(
        /(^|[^\d])(\+91|0)?\s*([6-9]\d{2,4})[\s-]+(\d{3,5})[\s-]*(\d{1,4})?\b/g,
        (match, lead, prefix, p1, p2, p3) => {
            const combined = `${p1}${p2}${p3 || ""}`;
            if (combined.length === 10) {
                const p = prefix ? prefix.trim() : "";
                return `${lead}${p}${combined}`;
            }
            return match;
        }
    );

    return result;
}

/**
 * Main normalization pipeline:
 * Preserves the original transcript and returns an object with both original and normalized text.
 * 
 * @param {string} rawTranscript - The raw session transcript
 * @returns {{ original: string, normalized: string }}
 */
export function normalizeTranscript(rawTranscript) {
    const original = typeof rawTranscript === "string" ? rawTranscript : "";
    if (!original.trim()) {
        return {
            original,
            normalized: ""
        };
    }

    let normalized = normalizeWhitespaceAndPunctuation(original);
    normalized = normalizeSpokenDigits(normalized);
    normalized = normalizeSpokenEmail(normalized);
    normalized = normalizePhoneFormatting(normalized);
    normalized = normalizeWhitespaceAndPunctuation(normalized);

    return {
        original,
        normalized
    };
}

export default {
    normalizeTranscript,
    normalizeWhitespaceAndPunctuation,
    normalizeSpokenDigits,
    normalizeSpokenEmail,
    normalizePhoneFormatting,
    normalizeMultipliers,
    normalizeCountryCodes,
    normalizeSpokenSeparators
};
