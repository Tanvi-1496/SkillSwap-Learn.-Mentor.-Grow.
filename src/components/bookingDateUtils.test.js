import assert from "node:assert/strict";
import test from "node:test";
import { getDateForWeekday, getWeekdayForDate, isSlotBookable } from "./bookingDateUtils.js";

const now = new Date("2026-11-12T12:43:45Z"); // 18:13:45 in Asia/Kolkata

test("includes today's date when the mentor is available today", () => {
    assert.equal(getDateForWeekday("Thursday", now), "2026-11-12");
    assert.equal(getWeekdayForDate("2026-11-12"), "Thursday");
});

test("calculates the next occurrence for future and already-passed weekdays", () => {
    assert.equal(getDateForWeekday("Friday", now), "2026-11-13");
    assert.equal(getDateForWeekday("Wednesday", now), "2026-11-18");
});

test("rejects past slots today and allows future slots in Asia/Kolkata", () => {
    assert.equal(isSlotBookable("2026-11-12", "18:13:00", now), false);
    assert.equal(isSlotBookable("2026-11-12", "18:14:00", now), true);
    assert.equal(isSlotBookable("2026-11-13", "09:00:00", now), true);
    assert.equal(isSlotBookable("2026-11-11", "23:59:00", now), false);
});
