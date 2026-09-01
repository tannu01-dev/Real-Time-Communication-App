const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const fileRoutes = require("./routes/fileRoutes");

const Meeting = require("./models/Meeting");

dotenv.config();

connectDB();

const app = express();
const server = http.createServer(app);

// =====================================================
// CORS
// =====================================================

const CLIENT_URL = "https://real-time-communication-app-beige.vercel.app";

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

// =====================================================
// API ROUTES
// =====================================================

app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/files", fileRoutes);

// =====================================================
// UPLOADS
// =====================================================

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads")
  )
);

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "Real-Time Communication Server Running",
  });
});

// =====================================================
// SOCKET.IO
// =====================================================

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// userId -> socketId
const connectedUsers = new Map();

// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on("connection", (socket) => {
  console.log(
    "🔌 SOCKET CONNECTED:",
    socket.id
  );

  // ===================================================
  // REGISTER USER
  // ===================================================

  socket.on(
    "register-user",
    ({ userId, userName }) => {
      if (!userId) {
        console.log(
          "❌ REGISTER USER: Missing userId"
        );
        return;
      }

      const id = userId.toString();

      connectedUsers.set(
        id,
        socket.id
      );

      socket.userId = id;
      socket.userName =
        userName || "User";

      console.log(
        "================================="
      );

      console.log(
        "👤 USER REGISTERED"
      );

      console.log(
        "User ID:",
        id
      );

      console.log(
        "User Name:",
        socket.userName
      );

      console.log(
        "Socket ID:",
        socket.id
      );

      console.log(
        "================================="
      );
    }
  );

  // ===================================================
  // HOST JOINS HOST ROOM
  // ===================================================

  socket.on(
    "host-join-room",
    ({
      meetingId,
      userId,
      userName,
    }) => {
      if (!meetingId || !userId) {
        console.log(
          "❌ HOST JOIN: Missing data"
        );
        return;
      }

      const id =
        userId.toString();

      const hostRoom =
        `host-${meetingId}`;

      // Register host
      connectedUsers.set(
        id,
        socket.id
      );

      socket.userId = id;
      socket.userName =
        userName || "Host";
      socket.meetingId =
        meetingId;
      socket.isHost = true;

      // Join host-specific room
      socket.join(hostRoom);

      console.log(
        "================================="
      );

      console.log(
        "👑 HOST REGISTERED"
      );

      console.log(
        "Meeting ID:",
        meetingId
      );

      console.log(
        "Host ID:",
        id
      );

      console.log(
        "Host Name:",
        socket.userName
      );

      console.log(
        "Host Socket:",
        socket.id
      );

      console.log(
        "Host Room:",
        hostRoom
      );

      console.log(
        "================================="
      );
    }
  );

  // ===================================================
  // PARTICIPANT JOINS ACTUAL ROOM
  // ===================================================

  socket.on(
    "join-room",
    ({
      meetingId,
      userId,
      userName,
    }) => {
      if (!meetingId || !userId) {
        return;
      }

      const id =
        userId.toString();

      socket.join(meetingId);

      socket.meetingId =
        meetingId;

      socket.userId = id;

      socket.userName =
        userName || "User";

      socket.isHost = false;

      console.log(
        `👤 USER JOINED ROOM: ${socket.userName} (${id}) -> ${meetingId}`
      );

      socket.to(meetingId).emit(
        "user-joined",
        {
          userId: id,
          userName:
            userName || "User",
          socketId:
            socket.id,
        }
      );

      const room =
        io.sockets.adapter.rooms.get(
          meetingId
        );

      io.to(meetingId).emit(
        "participant-count",
        {
          count: room
            ? room.size
            : 0,
        }
      );
    }
  );

  // ===================================================
  // JOIN REQUEST
  // ===================================================

  socket.on(
    "join-request",
    async (data) => {
      try {
        console.log(
          "================================="
        );

        console.log(
          "🔔 JOIN REQUEST RECEIVED"
        );

        console.log(
          data
        );

        console.log(
          "================================="
        );

        const {
          meetingId,
          userId,
          userName,
          userEmail,
        } = data || {};

        if (!meetingId || !userId) {
          console.log(
            "❌ INVALID JOIN REQUEST"
          );
          return;
        }

        // Find meeting
        const meeting =
          await Meeting.findOne({
            meetingId,
          }).populate(
            "host",
            "name email"
          );

        if (!meeting) {
          console.log(
            "❌ MEETING NOT FOUND:",
            meetingId
          );

          socket.emit(
            "join-request-error",
            {
              message:
                "Meeting not found.",
            }
          );

          return;
        }

        // Host ID
        const hostId =
          meeting.host?._id
            ?.toString() ||
          meeting.host?.toString();

        console.log(
          "👑 HOST ID:",
          hostId
        );

        if (!hostId) {
          console.log(
            "❌ HOST ID NOT FOUND"
          );
          return;
        }

        // Find host socket
        const hostSocketId =
          connectedUsers.get(
            hostId
          );

        console.log(
          "👑 HOST SOCKET:",
          hostSocketId
        );

        if (!hostSocketId) {
          console.log(
            "❌ HOST SOCKET NOT FOUND"
          );

          socket.emit(
            "join-request-error",
            {
              message:
                "Host is not connected. Please ask the host to enter the meeting first.",
            }
          );

          return;
        }

        console.log(
          "📨 SENDING REQUEST TO HOST"
        );

        io.to(
          hostSocketId
        ).emit(
          "join-request",
          {
            meetingId:
              meetingId.toString(),

            userId:
              userId.toString(),

            userName:
              userName || "User",

            userEmail:
              userEmail || "",

            socketId:
              socket.id,
          }
        );
      } catch (error) {
        console.error(
          "❌ JOIN REQUEST SOCKET ERROR:",
          error
        );

        socket.emit(
          "join-request-error",
          {
            message:
              "Unable to send join request.",
          }
        );
      }
    }
  );

  // ===================================================
  // PARTICIPANT ADMITTED
  // ===================================================

  socket.on(
    "participant-admitted",
    ({
      meetingId,
      userId,
      socketId,
      userName,
    }) => {
      if (
        !meetingId ||
        !socketId
      ) {
        return;
      }

      console.log(
        "================================="
      );

      console.log(
        "✅ PARTICIPANT ADMITTED"
      );

      console.log(
        "Meeting:",
        meetingId
      );

      console.log(
        "User:",
        userId
      );

      console.log(
        "Socket:",
        socketId
      );

      console.log(
        "================================="
      );

      io.to(
        socketId
      ).emit(
        "participant-admitted",
        {
          meetingId:
            meetingId.toString(),

          userId,

          userName:
            userName || "User",
        }
      );
    }
  );

  // ===================================================
  // PARTICIPANT DENIED
  // ===================================================

  socket.on(
    "participant-denied",
    ({
      meetingId,
      userId,
      socketId,
    }) => {
      if (
        !meetingId ||
        !socketId
      ) {
        return;
      }

      console.log(
        "❌ PARTICIPANT DENIED:",
        {
          meetingId,
          userId,
          socketId,
        }
      );

      io.to(
        socketId
      ).emit(
        "participant-denied",
        {
          meetingId:
            meetingId.toString(),

          userId,

          message:
            "The host denied your request to join.",
        }
      );
    }
  );

  // ===================================================
  // WEBRTC OFFER
  // ===================================================

  socket.on(
    "offer",
    ({
      target,
      offer,
    }) => {
      if (!target || !offer) {
        return;
      }

      io.to(target).emit(
        "offer",
        {
          sender:
            socket.id,
          offer,
        }
      );
    }
  );

  // ===================================================
  // WEBRTC ANSWER
  // ===================================================

  socket.on(
    "answer",
    ({
      target,
      answer,
    }) => {
      if (!target || !answer) {
        return;
      }

      io.to(target).emit(
        "answer",
        {
          sender:
            socket.id,
          answer,
        }
      );
    }
  );

  // ===================================================
  // ICE CANDIDATE
  // ===================================================

  socket.on(
    "ice-candidate",
    ({
      target,
      candidate,
    }) => {
      if (
        !target ||
        !candidate
      ) {
        return;
      }

      io.to(target).emit(
        "ice-candidate",
        {
          sender:
            socket.id,
          candidate,
        }
      );
    }
  );

  // ===================================================
  // CHAT
  // ===================================================

  socket.on(
    "send-message",
    ({
      meetingId,
      userId,
      userName,
      message,
    }) => {
      if (
        !meetingId ||
        !message ||
        !message.trim()
      ) {
        return;
      }

      const messageData = {
        userId,
        userName:
          userName || "User",
        message:
          message.trim(),
        time:
          new Date().toISOString(),
      };

      io.to(
        meetingId
      ).emit(
        "receive-message",
        messageData
      );
    }
  );

  // ===================================================
  // FILE SHARING
  // ===================================================

  socket.on(
    "send-file",
    (data) => {
      if (!data?.meetingId) {
        return;
      }

      io.to(
        data.meetingId
      ).emit(
        "receive-file",
        {
          ...data,
          time:
            data.time ||
            new Date().toISOString(),
        }
      );
    }
  );

  // ===================================================
  // WHITEBOARD DRAW
  // ===================================================

  socket.on(
    "whiteboard-draw",
    (data) => {
      if (!data?.meetingId) {
        return;
      }

      socket
        .to(data.meetingId)
        .emit(
          "whiteboard-draw",
          data
        );
    }
  );

  // ===================================================
  // WHITEBOARD CLEAR
  // ===================================================

  socket.on(
    "whiteboard-clear",
    (data) => {
      if (!data?.meetingId) {
        return;
      }

      socket
        .to(data.meetingId)
        .emit(
          "whiteboard-clear",
          data
        );
    }
  );

  // ===================================================
  // LEAVE ROOM
  // ===================================================

  socket.on(
    "leave-room",
    ({
      meetingId,
      userId,
    }) => {
      if (!meetingId) {
        return;
      }

      console.log(
        `🚪 USER LEFT: ${userId} -> ${meetingId}`
      );

      socket.leave(
        meetingId
      );

      socket
        .to(meetingId)
        .emit(
          "user-left",
          {
            userId,
            socketId:
              socket.id,
          }
        );

      const room =
        io.sockets.adapter.rooms.get(
          meetingId
        );

      io.to(meetingId).emit(
        "participant-count",
        {
          count: room
            ? room.size
            : 0,
        }
      );
    }
  );

  // ===================================================
  // MEETING ENDED
  // ===================================================

  socket.on(
    "meeting-ended",
    ({ meetingId }) => {
      if (!meetingId) {
        return;
      }

      console.log(
        "🛑 MEETING ENDED:",
        meetingId
      );

      io.to(
        meetingId
      ).emit(
        "meeting-ended",
        {
          meetingId,
          message:
            "The host ended the meeting.",
        }
      );
    }
  );

  // ===================================================
  // DISCONNECT
  // ===================================================

  socket.on(
    "disconnect",
    () => {
      console.log(
        "🔌 SOCKET DISCONNECTED:",
        socket.id
      );

      if (socket.userId) {
        const currentSocket =
          connectedUsers.get(
            socket.userId
          );

        if (
          currentSocket ===
          socket.id
        ) {
          connectedUsers.delete(
            socket.userId
          );
        }
      }
    }
  );
});

// =====================================================
// SERVER START
// =====================================================

const PORT =
  process.env.PORT || 5000;

server.listen(
  PORT,
  () => {
    console.log(
      "================================="
    );

    console.log(
      "Communication App Server Running"
    );

    console.log(
      `http://localhost:${PORT}`
    );

    console.log(
      "Socket.io Ready"
    );

    console.log(
      "================================="
    );
  }
);