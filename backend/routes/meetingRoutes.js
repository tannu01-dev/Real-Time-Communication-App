const express = require("express");

const {
  createMeeting,
  joinMeeting,
  admitParticipant,
  denyParticipant,
  getMeeting,
  endMeeting,
} = require("../controllers/meetingController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/create", protect, createMeeting);

router.post("/join", protect, joinMeeting);
router.post( "/:meetingId/admit", protect, admitParticipant ); 
router.post( "/:meetingId/deny", protect, denyParticipant );

router.get("/:meetingId", protect, getMeeting);

router.patch("/:meetingId/end", protect, endMeeting);

module.exports = router;