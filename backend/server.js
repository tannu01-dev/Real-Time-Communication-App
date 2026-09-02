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

const allowedOrigins = [
  "http://localhost:5173",
  "https://real-time-communication-app-eight.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("❌ CORS BLOCKED:", origin);

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// =====================================================
// BODY PARSER
// =====================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

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
  res.status(200).json({
    success: true,
    message:
      "Real-Time Communication Server Running",
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

// =====================================================
// SOCKET.IO
// =====================================================

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },

  transports: [
    "websocket",
    "polling",
  ],
});

// =====================================================
// CONNECTED USERS
// userId -> socketId
// =====================================================

const connectedUsers = new Map();

// =====================================================
// HELPER
// =====================================================

const findHostSocket = async (
  meetingId,
  hostId
) => {
  const hostIdString = String(hostId);
  const roomId = String(meetingId);

  // ---------------------------------------------------
  // 1. First check connectedUsers map
  // ---------------------------------------------------

  const mappedSocketId =
    connectedUsers.get(hostIdString);

  if (mappedSocketId) {
    const mappedSocket =
      io.sockets.sockets.get(
        mappedSocketId
      );

    if (mappedSocket) {
      return mappedSocket;
    }

    // Stale socket
    connectedUsers.delete(
      hostIdString
    );
  }

  // ---------------------------------------------------
  // 2. Check actual meeting room
  // ---------------------------------------------------

  const room =
    io.sockets.adapter.rooms.get(
      roomId
    );

  if (room) {
    for (const socketId of room) {
      const socket =
        io.sockets.sockets.get(
          socketId
        );

      if (
        socket &&
        socket.userId &&
        String(socket.userId) ===
          hostIdString
      ) {
        connectedUsers.set(
          hostIdString,
          socket.id
        );

        return socket;
      }
    }
  }

  // ---------------------------------------------------
  // 3. Check all connected sockets
  // ---------------------------------------------------

  for (const [
    socketId,
    socket,
  ] of io.sockets.sockets) {
    if (
      socket.userId &&
      String(socket.userId) ===
        hostIdString &&
      socket.meetingId &&
      String(socket.meetingId) ===
        roomId
    ) {
      connectedUsers.set(
        hostIdString,
        socketId
      );

      return socket;
    }
  }

  return null;
};

// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on("connection", (socket) => {
  console.log(
    "================================="
  );

  console.log(
    "🔌 SOCKET CONNECTED:",
    socket.id
  );

  console.log(
    "================================="
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
    async ({
      meetingId,
      userId,
      userName,
    }) => {
      try {
        if (
          !meetingId ||
          !userId
        ) {
          console.log(
            "❌ HOST JOIN: Missing data"
          );

          return;
        }

        const id =
          userId.toString();

        const roomId =
          meetingId.toString();

        const hostRoom =
          `host-${roomId}`;

        // ------------------------------------------------
        // Verify from database
        // ------------------------------------------------

        const meeting =
          await Meeting.findOne({
            meetingId: roomId,
          });

        if (!meeting) {
          console.log(
            "❌ HOST JOIN: Meeting not found"
          );

          return;
        }

        if (
          String(meeting.host) !==
          String(id)
        ) {
          console.log(
            "❌ HOST JOIN: User is not host"
          );

          return;
        }

        // ------------------------------------------------
        // Register host
        // ------------------------------------------------

        connectedUsers.set(
          id,
          socket.id
        );

        socket.userId = id;

        socket.userName =
          userName || "Host";

        socket.meetingId =
          roomId;

        socket.isHost = true;

        socket.join(
          hostRoom
        );

        socket.join(
          roomId
        );

        console.log(
          "================================="
        );

        console.log(
          "👑 HOST REGISTERED"
        );

        console.log(
          "Meeting ID:",
          roomId
        );

        console.log(
          "Host ID:",
          id
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
          "Meeting Room:",
          roomId
        );

        console.log(
          "================================="
        );

        const room =
          io.sockets.adapter.rooms.get(
            roomId
          );

        io.to(roomId).emit(
          "participant-count",
          {
            count: room
              ? room.size
              : 0,
          }
        );
      } catch (error) {
        console.error(
          "❌ HOST JOIN ERROR:",
          error
        );
      }
    }
  );

  // ===================================================
  // JOIN ROOM
  // ===================================================

  socket.on(
    "join-room",
    async ({
      meetingId,
      userId,
      userName,
    }) => {
      try {
        if (
          !meetingId ||
          !userId
        ) {
          console.log(
            "❌ JOIN ROOM: Missing data"
          );

          return;
        }

        const roomId =
          meetingId.toString();

        const id =
          userId.toString();

        // ------------------------------------------------
        // Find meeting
        // ------------------------------------------------

        const meeting =
          await Meeting.findOne({
            meetingId: roomId,
          });

        if (!meeting) {
          console.log(
            "❌ JOIN ROOM: Meeting not found"
          );

          return;
        }

        // ------------------------------------------------
        // Set socket information
        // ------------------------------------------------

        socket.userId = id;

        socket.userName =
          userName || "User";

        socket.meetingId =
          roomId;

        // ------------------------------------------------
        // IMPORTANT:
        // Automatically detect host
        // ------------------------------------------------

        const isHost =
          String(meeting.host) ===
          String(id);

        if (isHost) {
          socket.isHost = true;

          connectedUsers.set(
            id,
            socket.id
          );

          console.log(
            "👑 HOST AUTO-REGISTERED THROUGH join-room"
          );

          console.log(
            "Host ID:",
            id
          );

          console.log(
            "Host Socket:",
            socket.id
          );

          // Host-specific room
          socket.join(
            `host-${roomId}`
          );
        } else {
          socket.isHost = false;
        }

        // ------------------------------------------------
        // Check if already inside
        // ------------------------------------------------

        const roomBeforeJoin =
          io.sockets.adapter.rooms.get(
            roomId
          );

        const alreadyInside =
          roomBeforeJoin?.has(
            socket.id
          );

        // ------------------------------------------------
        // Join meeting room
        // ------------------------------------------------

        socket.join(
          roomId
        );

        console.log(
          "================================="
        );

        console.log(
          "🚪 USER JOINED MEETING ROOM"
        );

        console.log(
          "Meeting ID:",
          roomId
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
          "Is Host:",
          isHost
        );

        console.log(
          "Already Inside:",
          alreadyInside
        );

        console.log(
          "================================="
        );

        // ------------------------------------------------
        // Notify others
        // ------------------------------------------------

        if (!alreadyInside) {
          socket
            .to(roomId)
            .emit(
              "user-joined",
              {
                userId: id,
                userName:
                  socket.userName,
                socketId:
                  socket.id,
              }
            );
        }

        // ------------------------------------------------
        // Participant count
        // ------------------------------------------------

        const room =
          io.sockets.adapter.rooms.get(
            roomId
          );

        io.to(roomId).emit(
          "participant-count",
          {
            count: room
              ? room.size
              : 0,
          }
        );
      } catch (error) {
        console.error(
          "❌ JOIN ROOM ERROR:",
          error
        );
      }
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

        console.log(data);

        console.log(
          "================================="
        );

        const {
          meetingId,
          userId,
          userName,
          userEmail,
        } = data || {};

        if (
          !meetingId ||
          !userId
        ) {
          console.log(
            "❌ INVALID JOIN REQUEST"
          );

          socket.emit(
            "join-request-error",
            {
              message:
                "Invalid join request.",
            }
          );

          return;
        }

        // ------------------------------------------------
        // Find meeting
        // ------------------------------------------------

        const meeting =
          await Meeting.findOne({
            meetingId,
          });

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

        if (
          meeting.status ===
          "ended"
        ) {
          socket.emit(
            "join-request-error",
            {
              message:
                "This meeting has ended.",
            }
          );

          return;
        }

        // ------------------------------------------------
        // Host ID
        // ------------------------------------------------

        const hostId =
          meeting.host?.toString();

        console.log(
          "👑 HOST ID:",
          hostId
        );

        if (!hostId) {
          console.log(
            "❌ HOST ID NOT FOUND"
          );

          socket.emit(
            "join-request-error",
            {
              message:
                "Meeting host not found.",
            }
          );

          return;
        }

        // ------------------------------------------------
        // Find host socket
        // ------------------------------------------------

        const hostSocket =
          await findHostSocket(
            meetingId,
            hostId
          );

        if (!hostSocket) {
          console.log(
            "❌ HOST SOCKET NOT FOUND"
          );

          console.log(
            "Connected users:"
          );

          console.log(
            [...connectedUsers.entries()]
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

        // ------------------------------------------------
        // Save participant socket info
        // ------------------------------------------------

        socket.userId =
          userId.toString();

        socket.userName =
          userName || "User";

        socket.userEmail =
          userEmail || "";

        socket.meetingId =
          meetingId.toString();

        console.log(
          "================================="
        );

        console.log(
          "📨 SENDING REQUEST TO HOST"
        );

        console.log(
          "Host Socket:",
          hostSocket.id
        );

        console.log(
          "Participant Socket:",
          socket.id
        );

        console.log(
          "Participant:",
          userName
        );

        console.log(
          "================================="
        );

        // ------------------------------------------------
        // Send request to host
        // ------------------------------------------------

        hostSocket.emit(
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

          userId:
            userId?.toString(),

          userName:
            userName || "Participant",
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
        "================================="
      );

      console.log(
        "❌ PARTICIPANT DENIED"
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
        "participant-denied",
        {
          meetingId:
            meetingId.toString(),

          userId:
            userId?.toString(),

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
      if (
        !target ||
        !offer
      ) {
        return;
      }

      console.log(
        "📤 OFFER:",
        socket.id,
        "->",
        target
      );

      io.to(target).emit(
        "offer",
        {
          sender:
            socket.id,

          userId:
            socket.userId,

          userName:
            socket.userName ||
            "Participant",

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
      if (
        !target ||
        !answer
      ) {
        return;
      }

      console.log(
        "📤 ANSWER:",
        socket.id,
        "->",
        target
      );

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

      console.log(
        "📤 ICE:",
        socket.id,
        "->",
        target
      );

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
        meetingId.toString()
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
        data.meetingId.toString()
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
        .to(
          data.meetingId.toString()
        )
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
        .to(
          data.meetingId.toString()
        )
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

      const roomId =
        meetingId.toString();

      console.log(
        `🚪 USER LEFT: ${userId} -> ${roomId}`
      );

      socket.leave(
        roomId
      );

      socket
        .to(roomId)
        .emit(
          "user-left",
          {
            userId,
            socketId:
              socket.id,
          }
        );

      if (socket.isHost) {
        socket.leave(
          `host-${roomId}`
        );
      }

      const room =
        io.sockets.adapter.rooms.get(
          roomId
        );

      io.to(roomId).emit(
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
    ({
      meetingId,
    }) => {
      if (!meetingId) {
        return;
      }

      const roomId =
        meetingId.toString();

      console.log(
        "🛑 MEETING ENDED:",
        roomId
      );

      io.to(roomId).emit(
        "meeting-ended",
        {
          meetingId:
            roomId,

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
    (reason) => {
      console.log(
        "================================="
      );

      console.log(
        "🔌 SOCKET DISCONNECTED:",
        socket.id
      );

      console.log(
        "Reason:",
        reason
      );

      console.log(
        "================================="
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

      if (
        socket.meetingId
      ) {
        const roomId =
          socket.meetingId.toString();

        socket
          .to(roomId)
          .emit(
            "user-left",
            {
              userId:
                socket.userId,

              socketId:
                socket.id,
            }
          );

        const room =
          io.sockets.adapter.rooms.get(
            roomId
          );

        io.to(roomId).emit(
          "participant-count",
          {
            count: room
              ? room.size
              : 0,
          }
        );
      }
    }
  );
});

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use(
  (err, req, res, next) => {
    console.error(
      "❌ SERVER ERROR:",
      err
    );

    if (
      err.message ===
      "Not allowed by CORS"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "CORS origin not allowed",
      });
    }

    res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
);

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
      "🚀 Communication App Server Running"
    );

    console.log(
      `🌐 Port: ${PORT}`
    );

    console.log(
      `🏠 Local: http://localhost:${PORT}`
    );

    console.log(
      "🔌 Socket.io Ready"
    );

    console.log(
      "🌍 Allowed Frontends:"
    );

    allowedOrigins.forEach(
      (origin) => {
        console.log(
          "   →",
          origin
        );
      }
    );

    console.log(
      "================================="
    );
  }
);