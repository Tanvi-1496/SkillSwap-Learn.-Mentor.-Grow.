import authRoutes from "./routes/auth.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import profileRoutes from "./routes/profile.js";
import mentorRoutes from "./routes/mentor.js";
import moderationRoutes from "./routes/moderation.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/mentors", mentorRoutes);
app.use("/moderation", moderationRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "SkillSwap backend is running"
    });
});

const PORT = process.env.PORT || 5000;

const isTest = process.env.NODE_ENV === "test" || process.argv.some((arg) => arg.includes("test"));

if (!isTest) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

export default app;
