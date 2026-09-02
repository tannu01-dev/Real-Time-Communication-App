const crypto = require("crypto");
const Meeting = require("../models/Meeting");

const generateMeetingId = () => {
  return crypto.randomBytes(6).toString("hex");
};

// Get logged-in user's ID safely
const getUserId = (req) => {
  return req.user?._id || req.user?.id;
};

// ===============================
// CREATE MEETING
// ===============================
const createMeeting = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const meetingId = generateMeetingId();

    const meeting = await Meeting.create({
      meetingId,
      host: userId,
      participants: [userId],
      pendingRequests: [],
    });

    console.log("MEETING CREATED");
    console.log("Meeting ID:", meeting.meetingId);
    console.log("Host ID:", String(meeting.host));

    res.status(201).json({
      success: true,
      message: "Meeting created successfully",

      meeting: {
        meetingId: meeting.meetingId,
        host: meeting.host,
        status: meeting.status,
      },
    });
  } catch (error) {
    console.error("CREATE MEETING ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create meeting",
    });
  }
};

// ===============================
// JOIN MEETING
// ===============================
const joinMeeting = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { meetingId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message: "Meeting ID is required",
      });
    }

    const meeting = await Meeting.findOne({
      meetingId,
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    if (meeting.status === "ended") {
      return res.status(400).json({
        success: false,
        message: "This meeting has ended",
      });
    }

    // ===============================
    // HOST
    // ===============================
    if (String(meeting.host) === String(userId)) {
      console.log("HOST JOINED");
      console.log("Meeting Host:", String(meeting.host));
      console.log("Current User:", String(userId));

      return res.status(200).json({
        success: true,
        admitted: true,
        isHost: true,
        message: "You are the host",

        meeting: {
          meetingId: meeting.meetingId,
          host: meeting.host,
          participants: meeting.participants,
          status: meeting.status,
        },
      });
    }

    // ===============================
    // ALREADY PARTICIPANT
    // ===============================
    const alreadyParticipant = meeting.participants.some(
      (participant) =>
        String(participant) === String(userId)
    );

    if (alreadyParticipant) {
      return res.status(200).json({
        success: true,
        admitted: true,
        isHost: false,
        message: "You are already admitted",

        meeting: {
          meetingId: meeting.meetingId,
          host: meeting.host,
          participants: meeting.participants,
          status: meeting.status,
        },
      });
    }

    // ===============================
    // ALREADY REQUESTED
    // ===============================
    const alreadyRequested = meeting.pendingRequests.some(
      (request) =>
        String(request.user) === String(userId)
    );

    if (alreadyRequested) {
      return res.status(200).json({
        success: true,
        admitted: false,
        pending: true,
        message: "Your join request is already pending",
      });
    }

    // ===============================
    // CREATE JOIN REQUEST
    // ===============================
    meeting.pendingRequests.push({
      user: userId,
    });

    await meeting.save();

    await meeting.populate(
      "pendingRequests.user",
      "name email"
    );

    const newRequest =
      meeting.pendingRequests[
        meeting.pendingRequests.length - 1
      ];

    res.status(200).json({
      success: true,
      admitted: false,
      pending: true,

      message:
        "Join request sent. Please wait for the host.",

      request: {
        userId: newRequest.user._id,
        name: newRequest.user.name,
        email: newRequest.user.email,
      },
    });
  } catch (error) {
    console.error("JOIN MEETING ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to send join request",
    });
  }
};

// ===============================
// ADMIT PARTICIPANT
// ===============================
const admitParticipant = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { meetingId } = req.params;
    const { userId: participantId } = req.body;

    console.log("\n========== ADMIT REQUEST ==========");
    console.log("Meeting ID:", meetingId);
    console.log("Logged User ID:", userId ? String(userId) : "NO USER");
    console.log("Participant ID:", participantId || "NO PARTICIPANT");

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const meeting = await Meeting.findOne({
      meetingId,
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    console.log("Meeting Host ID:", String(meeting.host));
    console.log(
      "Is Host:",
      String(meeting.host) === String(userId)
    );

    // ===============================
    // ONLY HOST CAN ADMIT
    // ===============================
    if (String(meeting.host) !== String(userId)) {
      console.log("❌ ADMIT DENIED - USER IS NOT HOST");
      console.log("Host:", String(meeting.host));
      console.log("User:", String(userId));

      return res.status(403).json({
        success: false,
        message: "Only host can admit participants",
      });
    }

    // ===============================
    // FIND REQUEST
    // ===============================
    const requestIndex =
      meeting.pendingRequests.findIndex(
        (request) =>
          String(request.user) === String(participantId)
      );

    if (requestIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Join request not found",
      });
    }

    // ===============================
    // CHECK ALREADY PARTICIPANT
    // ===============================
    const alreadyParticipant =
      meeting.participants.some(
        (participant) =>
          String(participant) === String(participantId)
      );

    // ===============================
    // ADD PARTICIPANT
    // ===============================
    if (!alreadyParticipant) {
      meeting.participants.push(participantId);
    }

    // Remove only this request
    meeting.pendingRequests.splice(
      requestIndex,
      1
    );

    await meeting.save();

    console.log("✅ PARTICIPANT ADMITTED");
    console.log("Participant:", participantId);
    console.log(
      "Total Participants:",
      meeting.participants.length
    );
    console.log("=================================\n");

    return res.status(200).json({
      success: true,
      message: "Participant admitted successfully",

      userId: participantId,

      participantCount:
        meeting.participants.length,
    });
  } catch (error) {
    console.error(
      "ADMIT PARTICIPANT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to admit participant",
    });
  }
};

// ===============================
// DENY PARTICIPANT
// ===============================
const denyParticipant = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { meetingId } = req.params;
    const { userId: participantId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const meeting = await Meeting.findOne({
      meetingId,
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // ONLY HOST CAN DENY
    if (String(meeting.host) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only host can deny participants",
      });
    }

    const requestIndex =
      meeting.pendingRequests.findIndex(
        (request) =>
          String(request.user) === String(participantId)
      );

    if (requestIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Join request not found",
      });
    }

    meeting.pendingRequests.splice(
      requestIndex,
      1
    );

    await meeting.save();

    return res.status(200).json({
      success: true,
      message: "Join request denied",
      userId: participantId,
    });
  } catch (error) {
    console.error(
      "DENY PARTICIPANT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to deny participant",
    });
  }
};

// ===============================
// GET MEETING
// ===============================
const getMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting =
      await Meeting.findOne({
        meetingId,
      })
        .populate(
          "host",
          "name email"
        )
        .populate(
          "participants",
          "name email"
        )
        .populate(
          "pendingRequests.user",
          "name email"
        );

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    res.status(200).json({
      success: true,
      meeting,
    });
  } catch (error) {
    console.error(
      "GET MEETING ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ===============================
// END MEETING
// ===============================
const endMeeting = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { meetingId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const meeting =
      await Meeting.findOne({
        meetingId,
      });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // ONLY HOST CAN END
    if (String(meeting.host) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message:
          "Only host can end the meeting",
      });
    }

    meeting.status = "ended";

    await meeting.save();

    res.status(200).json({
      success: true,
      message:
        "Meeting ended successfully",
    });
  } catch (error) {
    console.error(
      "END MEETING ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Unable to end meeting",
    });
  }
};

module.exports = {
  createMeeting,
  joinMeeting,
  admitParticipant,
  denyParticipant,
  getMeeting,
  endMeeting,
};