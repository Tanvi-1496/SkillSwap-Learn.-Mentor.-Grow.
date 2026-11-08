/**
 * Live Gnani.ai Vachana STT Verification Script
 * Tests an actual recorded speech audio clip (< 30 seconds) against the live Gnani REST STT v3 endpoint.
 *
 * Usage:
 *   node --env-file=backend/.env backend/scripts/testGnaniLive.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { transcribeAudio, estimateAudioDuration } from "../src/services/gnaniService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runLiveVerification() {
    console.log("==================================================================");
    console.log("   Gnani.ai Vachana STT Live Speech Verification Runner (< 30s)   ");
    console.log("==================================================================");

    const apiKey = (process.env.GNANI_API_KEY || "").trim();
    console.log(`Configured GNANI_API_KEY: ${apiKey ? "[Configured: " + apiKey.slice(0, 6) + "..." + apiKey.slice(-4) + "]" : "[NOT SET]"}`);

    // Load actual spoken audio file
    const speechFilePath = path.resolve(__dirname, "sample_speech.wav");
    let audioBuffer;
    let fileName = "sample_speech.wav";

    if (fs.existsSync(speechFilePath)) {
        audioBuffer = fs.readFileSync(speechFilePath);
        console.log(`Loaded real spoken audio file: ${speechFilePath} (${audioBuffer.length} bytes)`);
    } else {
        console.error("Speech file not found at:", speechFilePath);
        process.exit(1);
    }

    // Validate duration
    const estimated = estimateAudioDuration(audioBuffer, "audio/wav", fileName);
    console.log(`Spoken clip duration detected by parser: ${estimated} seconds (Limit: 30.0s)`);

    if (estimated > 30.0) {
        console.error("FAIL: Estimated duration exceeds 30-second ceiling!");
        process.exit(1);
    }

    if (!apiKey) {
        console.warn("\n[WARNING] GNANI_API_KEY is not configured in backend/.env.");
        console.warn("Simulated test mode cannot be counted as live integration success.");
        return;
    }

    console.log("\nSubmitting spoken audio clip to live Gnani STT API (https://api.vachana.ai/stt/v3)...");
    const startTime = Date.now();
    const result = await transcribeAudio({
        fileBuffer: audioBuffer,
        fileName,
        mimeType: "audio/wav",
        languageCode: "en-IN"
    });
    const elapsedMs = Date.now() - startTime;

    console.log(`Response received from Gnani in ${elapsedMs}ms`);
    console.log("\n======================== TRANSCRIPTION RESULT ========================");
    console.log("Success:", result.success);
    console.log("Is Mock:", !!result.isMock);
    console.log("Language Detected / Used:", result.language);
    console.log("Transcript Returned by Gnani:\n");
    console.log(`"${result.transcript || result.error}"`);
    console.log("======================================================================");

    if (result.success && !result.isMock && result.transcript) {
        console.log("\n>>> LIVE STT INTEGRATION TEST CONFIRMED SUCCESSFUL! <<<");
    } else if (!result.success) {
        console.error("\n>>> LIVE STT CALL FAILED <<<", result.error);
    }
}

runLiveVerification().catch(console.error);
