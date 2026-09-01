const crypto = require("crypto");
const Meeting = require("../models/Meeting");
const generateMeetingId = () => {
  return crypto.randomBytes(6).toString("hex");
};
const createMeeting = async (req, res) => {
  try {
    const meetingId = generateMeetingId();

    const meeting = await Meeting.create({
      meetingId,
      host: req.user._id,
      participants: [req.user._id],
      pendingRequests: [],
    });

    res.status(201).json({
      success: true,
      message:
        "Meeting created successfully",

      meeting: {
        meetingId: meeting.meetingId,
        host: meeting.host,
        status: meeting.status,
      },
    });
  } catch (error) {
    console.error(
      "CREATE MEETING ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Unable to create meeting",
    });
  }
};

const joinMeeting = async (req, res) => {
  try {
    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message:
          "Meeting ID is required",
      });
    }

    const meeting =
      await Meeting.findOne({
        meetingId,
      });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message:
          "Meeting not found",
      });
    }

    if (meeting.status === "ended") {
      return res.status(400).json({
        success: false,
        message:
          "This meeting has ended",
      });
    }
    if (
      meeting.host.toString() ===
      req.user._id.toString()
    ) {
      return res.status(200).json({
        success: true,
        admitted: true,
        isHost: true,
        message:
          "You are the host",
        meeting: {
          meetingId:
            meeting.meetingId,
          host: meeting.host,
          participants:
            meeting.participants,
          status:
            meeting.status,
        },
      });
    }
    const alreadyParticipant =
      meeting.participants.some(
        (participant) =>
          participant.toString() ===
          req.user._id.toString()
      );

    if (alreadyParticipant) {
      return res.status(200).json({
        success: true,
        admitted: true,
        isHost: false,
        message:
          "You are already admitted",
        meeting: {
          meetingId:
            meeting.meetingId,
          host: meeting.host,
          participants:
            meeting.participants,
          status:
            meeting.status,
        },
      });
    }
    const alreadyRequested =
      meeting.pendingRequests.some(
        (request) =>
          request.user.toString() ===
          req.user._id.toString()
      );

    if (alreadyRequested) {
      return res.status(200).json({
        success: true,
        admitted: false,
        pending: true,
        message:
          "Your join request is already pending",
      });
    }

    meeting.pendingRequests.push({
      user: req.user._id,
    });

    await meeting.save();

    // Populate user information
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
        userId:
          newRequest.user._id,
        name:
          newRequest.user.name,
        email:
          newRequest.user.email,
      },
    });
  } catch (error) {
    console.error(
      "JOIN MEETING ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Unable to send join request",
    });
  }
};

const admitParticipant = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { userId } = req.body;

    if (!userId) {
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

    // ONLY HOST CAN ADMIT
    if (
      String(meeting.host) !==
      String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only host can admit participants",
      });
    }

    // FIND USER REQUEST
    const requestIndex =
      meeting.pendingRequests.findIndex(
        (request) =>
          String(request.user) ===
          String(userId)
      );

    if (requestIndex === -1) {
      return res.status(404).json({
        success: false,
        message:
          "Join request not found",
      });
    }

    // CHECK IF ALREADY PARTICIPANT
    const alreadyParticipant =
      meeting.participants.some(
        (participant) =>
          String(participant) ===
          String(userId)
      );

    // ADD USER
    if (!alreadyParticipant) {
      meeting.participants.push(userId);
    }

    // REMOVE ONLY THIS REQUEST
    meeting.pendingRequests.splice(
      requestIndex,
      1
    );

    await meeting.save();

    return res.status(200).json({
      success: true,
      message:
        "Participant admitted successfully",
      userId,
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
      message:
        "Unable to admit participant",
    });
  }
};


const denyParticipant = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { userId } = req.body;

    if (!userId) {
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
    if (
      String(meeting.host) !==
      String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only host can deny participants",
      });
    }

    const requestIndex =
      meeting.pendingRequests.findIndex(
        (request) =>
          String(request.user) ===
          String(userId)
      );

    if (requestIndex === -1) {
      return res.status(404).json({
        success: false,
        message:
          "Join request not found",
      });
    }

    // REMOVE THIS USER ONLY
    meeting.pendingRequests.splice(
      requestIndex,
      1
    );

    await meeting.save();

    return res.status(200).json({
      success: true,
      message:
        "Join request denied",
      userId,
    });
  } catch (error) {
    console.error(
      "DENY PARTICIPANT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to deny participant",
    });
  }
};

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
        message:
          "Meeting not found",
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
      message:
        "Server error",
    });
  }
};

const endMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting =
      await Meeting.findOne({
        meetingId,
      });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message:
          "Meeting not found",
      });
    }

    if (
      meeting.host.toString() !==
      req.user._id.toString()
    ) {
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

