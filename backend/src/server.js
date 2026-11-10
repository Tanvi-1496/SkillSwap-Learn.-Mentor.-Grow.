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

app.get("/", (req, res) => {
    res.json({
        message: "SkillSwap backend is running"
    });
});

export { app };

const isDirectExecution =
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`SkillSwap backend running on port ${PORT}`);
    });
}