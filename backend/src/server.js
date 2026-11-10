
import authRoutes from "./routes/auth.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import profileRoutes from "./routes/profile.js";
import mentorRoutes from "./routes/mentor.js";
import moderationRoutes from "./routes/moderation.js";
import recommendationRoutes from "./routes/recommendations.js";
import bookingRoutes from "./routes/bookings.js";
import adminRoutes from "./routes/admin.js";
import reviewRoutes from "./routes/reviews.js";
import chatbotRoutes from "./routes/chatbot.js";

dotenv.config();

const app = express();

const allowedOrigins = [
    "https://skill-swap-learn-mentor-grow.vercel.app"
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.options(/.*/, cors());

app.use(express.json());

// API routes
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/mentors", mentorRoutes);
app.use("/recommendations", recommendationRoutes);
app.use("/bookings", bookingRoutes);
app.use("/admin", adminRoutes);
app.use("/reviews", reviewRoutes);
app.use("/moderation", moderationRoutes);
app.use("/chatbot", chatbotRoutes);

// Health check
app.get("/", (req, res) => {
    res.json({
        message: "SkillSwap backend is running"
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Server error:", err);
    res.status(err.status || 500).json({
        error: err.message || "Internal server error"
    });
});

export { app };
export default app;

// Start server only when executed directly
const isDirectExecution =
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`SkillSwap backend running on port ${PORT}`);
    });
}
