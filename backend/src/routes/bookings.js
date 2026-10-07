import express from "express";
import supabase from "../config/supabase.js";

const router = express.Router();

// Create a booking
router.post("/", async (req, res) => {
    try {
        const {
            mentor_id,
            student_id,
            topic,
            date,
            time,
            status = "pending"
        } = req.body;

        if (!mentor_id || !student_id || !topic || !date || !time) {
            return res.status(400).json({
                error: "mentor_id, student_id, topic, date and time are required"
            });
        }

        const { data, error } = await supabase
            .from("bookings")
            .insert([
                {
                    mentor_id,
                    student_id,
                    topic,
                    date,
                    time,
                    status
                }
            ])
            .select()
            .single();

        if (error) {
            console.error("Booking insert error:", error);

            return res.status(500).json({
                error: error.message
            });
        }

        res.status(201).json({
            message: "Booking created successfully",
            booking: data
        });

    } catch (error) {
        console.error("Booking route error:", error);

        res.status(500).json({
            error: "Internal server error"
        });
    }
});

export default router;