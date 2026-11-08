/**
 * Moderation Service
 * 
 * Orchestrates session transcript safety moderation:
 * 1. Normalizes text using textNormalizer
 * 2. Detects and masks PII using piiDetector
 * 3. Classifies safety violations using safetyClassifier
 * 4. Combines results and checks for duplicates
 * 5. Persists safety flags to Supabase safety_flags table
 * 6. Never automatically bans users or terminates bookings (human-in-the-loop review)
 */

import supabase from "../config/supabase.js";
import { normalizeTranscript } from "./textNormalizer.js";
import { detectPII } from "./piiDetector.js";
import { classifySafety } from "./safetyClassifier.js";

/**
 * Moderates a completed session transcript.
 * 
 * @param {object} params
 * @param {string} params.bookingId - UUID of the mentorship booking
 * @param {string} params.transcriptText - Raw speech-to-text transcript
 * @param {string} [params.studentId] - Optional student user UUID
 * @param {string} [params.mentorId] - Optional mentor user UUID
 * @param {object} [params.supabaseClient] - Optional Supabase client instance (for testing or transactions)
 * @returns {Promise<object>} Moderation outcome
 */
export async function moderateSessionTranscript({
    bookingId,
    transcriptText,
    studentId = null,
    mentorId = null,
    supabaseClient = supabase
}) {
    if (!bookingId) {
        throw new Error("bookingId is required for session moderation");
    }

    if (!transcriptText || typeof transcriptText !== "string" || !transcriptText.trim()) {
        return {
            success: true,
            isSafe: true,
            bookingId,
            flagsCount: 0,
            flagsCreated: 0,
            flags: [],
            message: "Empty or blank transcript. No moderation flags raised."
        };
    }

    // 1. Resolve studentId and mentorId from bookings table if not supplied
    let resolvedStudentId = studentId;
    let resolvedMentorId = mentorId;

    if (!resolvedStudentId || !resolvedMentorId) {
        try {
            const { data: booking, error: bookingErr } = await supabaseClient
                .from("bookings")
                .select("id, student_id, mentor_id")
                .eq("id", bookingId)
                .maybeSingle();

            if (!bookingErr && booking) {
                resolvedStudentId = resolvedStudentId || booking.student_id;
                resolvedMentorId = resolvedMentorId || booking.mentor_id;
            }
        } catch (fetchErr) {
            console.warn("Could not query booking details for moderation (proceeding with provided IDs):", fetchErr.message);
        }
    }

    // 2. Normalize text (preserves original transcript)
    const { original, normalized } = normalizeTranscript(transcriptText);

    // 3. Detect PII and generate masked preview
    const piiResults = detectPII(normalized);

    // 4. Run contextual safety classifier
    const safetyReport = await classifySafety(normalized, original, piiResults);

    // If session is completely clean, return early
    if (safetyReport.isSafe || safetyReport.flags.length === 0) {
        return {
            success: true,
            isSafe: true,
            bookingId,
            flagsCount: 0,
            flagsCreated: 0,
            flags: [],
            piiDetected: piiResults.hasPII,
            piiCategories: piiResults.categories,
            message: "Session transcript analyzed. No safety violations detected."
        };
    }

    // 5. Query existing flags for this booking to avoid duplicate flags for the same booking and category
    let existingCategories = new Set();
    try {
        const { data: existingFlags, error: queryErr } = await supabaseClient
            .from("safety_flags")
            .select("category")
            .eq("booking_id", bookingId);

        if (!queryErr && Array.isArray(existingFlags)) {
            existingCategories = new Set(existingFlags.map((f) => f.category));
        }
    } catch (queryErr) {
        console.warn("Error checking existing safety flags for booking:", queryErr.message);
    }

    // Filter out duplicate categories
    const newFlagsToInsert = safetyReport.flags
        .filter((flag) => !existingCategories.has(flag.category))
        .map((flag) => ({
            booking_id: bookingId,
            student_id: resolvedStudentId || null,
            mentor_id: resolvedMentorId || null,
            category: flag.category,
            severity: flag.severity,
            excerpt: flag.excerpt,
            confidence: flag.confidence,
            status: "pending",
            created_at: new Date().toISOString()
        }));

    // 6. Save new flags to Supabase safety_flags table
    let savedFlags = [];
    if (newFlagsToInsert.length > 0) {
        try {
            const { data: inserted, error: insertErr } = await supabaseClient
                .from("safety_flags")
                .insert(newFlagsToInsert)
                .select();

            if (insertErr) {
                // If unique constraint violation occurs (race condition), log and continue
                if (insertErr.code === "23505") {
                    console.warn("Duplicate flag avoided via unique constraint:", insertErr.message);
                } else {
                    console.error("Failed to insert safety flags into database:", insertErr);
                    throw new Error(`Database error saving safety flags: ${insertErr.message}`);
                }
            } else if (inserted) {
                savedFlags = inserted;
            }
        } catch (dbErr) {
            console.error("Error executing safety flag persistence:", dbErr.message);
            throw dbErr;
        }
    }

    return {
        success: true,
        isSafe: false,
        bookingId,
        flagsCount: safetyReport.flags.length,
        flagsCreated: savedFlags.length,
        duplicatesPrevented: safetyReport.flags.length - newFlagsToInsert.length,
        flags: savedFlags.length > 0 ? savedFlags : newFlagsToInsert,
        allDetectedViolations: safetyReport.flags,
        piiDetected: piiResults.hasPII,
        piiCategories: piiResults.categories,
        message: `${savedFlags.length} safety flag(s) saved for human admin review.`
    };
}

/**
 * Integration entry point for transcript pipeline:
 * Accepts booking_id and transcript text.
 * Can be called immediately upon speech-to-text completion.
 * 
 * @param {string} bookingId - UUID of the booking
 * @param {string} transcriptText - Transcript text
 * @param {object} [options] - Optional overrides (studentId, mentorId, supabaseClient)
 * @returns {Promise<object>} Moderation outcome
 */
export async function moderateBookingTranscript(bookingId, transcriptText, options = {}) {
    return moderateSessionTranscript({
        bookingId,
        transcriptText,
        ...options
    });
}

export default {
    moderateSessionTranscript,
    moderateBookingTranscript
};

