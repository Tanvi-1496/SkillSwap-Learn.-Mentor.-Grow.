import authRoutes from "./routes/auth.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import profileRoutes from "./routes/profile.js";
import mentorRoutes from "./routes/mentor.js";
import recommendationRoutes from "./routes/recommendations.js";
import bookingRoutes from "./routes/bookings.js";
import adminRoutes from "./routes/admin.js";
import reviewRoutes from "./routes/reviews.js";
import moderationRoutes from "./routes/moderation.js";
import chatbotRoutes from "./routes/chatbot.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/mentors", mentorRoutes);
app.use("/recommendations", recommendationRoutes);
app.use("/bookings", bookingRoutes);
app.use("/admin", adminRoutes);
app.use("/reviews", reviewRoutes);
app.use("/moderation", moderationRoutes);
app.use("/chatbot", chatbotRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "SkillSwap backend is running"
    });
});

// 404 JSON fallback handler
app.use((req, res) => {
    res.status(404).json({
        error: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// Global JSON error handler
app.use((err, req, res, next) => {
    console.error("Server error:", err);
    res.status(err.status || 500).json({
        error: err.message || "Internal server error"
    });
});

const PORT = process.env.PORT || 5000;

const isTest = process.env.NODE_ENV === "test" || process.argv.some((arg) => arg.includes("test"));

if (!isTest) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

export { app };
export default app;
