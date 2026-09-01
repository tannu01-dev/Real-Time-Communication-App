import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import api from "../services/api";
import socket from "../services/socket";

import "../styles/waitingRoom.css";

const WaitingRoom = () => {
  const { meetingId } =
    useParams();

  const navigate =
    useNavigate();

  const [user, setUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [requestSent, setRequestSent] =
    useState(false);

  const [status, setStatus] =
    useState("Connecting...");

  const [error, setError] =
    useState("");

  // ==================================================
  // GET CURRENT USER
  // ==================================================

  useEffect(() => {
  const storedUser = localStorage.getItem("user");
  const token = localStorage.getItem("token");

  console.log("========== WAITING USER CHECK ==========");
  console.log("TOKEN EXISTS:", !!token);
  console.log("STORED USER:", storedUser);
  console.log("=========================================");

  if (!token) {
    console.log("❌ NO TOKEN -> LOGIN");
    navigate("/login", { replace: true });
    return;
  }

  if (!storedUser) {
    console.log("❌ NO USER -> LOGIN");
    navigate("/login", { replace: true });
    return;
  }

  try {
    const parsedUser = JSON.parse(storedUser);

    if (!parsedUser?._id && !parsedUser?.id) {
      console.log("❌ INVALID USER -> LOGIN");
      navigate("/login", { replace: true });
      return;
    }

    console.log("✅ WAITING USER LOADED:", parsedUser);

    setUser(parsedUser);
  } catch (error) {
    console.error("USER PARSE ERROR:", error);
    navigate("/login", { replace: true });
  } finally {
    setLoading(false);
  }
}, [navigate]);

  // ==================================================
  // CHECK MEETING
  // ==================================================

  useEffect(() => {
    if (
      !meetingId ||
      !user
    ) {
      return;
    }

    let cancelled = false;

    const checkMeeting =
      async () => {
        try {
          const response =
            await api.get(
              `/meetings/${meetingId}`
            );

          if (
            !response.data?.success
          ) {
            throw new Error(
              "Meeting not found"
            );
          }

          const meeting =
            response.data.meeting;

          if (cancelled) {
            return;
          }

          const currentUserId = (
            user._id ||
            user.id
          )?.toString();

          const hostId = (
            typeof meeting.host ===
            "object"
              ? meeting.host?._id
              : meeting.host
          )?.toString();

          // ========================================
          // HOST
          // ========================================

          if (
            currentUserId &&
            hostId &&
            currentUserId ===
              hostId
          ) {
            console.log(
              "👑 USER IS HOST"
            );

            navigate(
              `/meeting/${meetingId}`,
              {
                replace: true,
              }
            );

            return;
          }

          // ========================================
          // ALREADY ADMITTED
          // ========================================

          const isParticipant =
            meeting.participants?.some(
              (participant) => {
                const participantId =
                  (
                    participant?._id ||
                    participant
                  )?.toString();

                return (
                  participantId ===
                  currentUserId
                );
              }
            );

          if (
            isParticipant
          ) {
            console.log(
              "✅ USER ALREADY ADMITTED"
            );

            navigate(
              `/meeting/${meetingId}`,
              {
                replace: true,
              }
            );

            return;
          }

          console.log(
            "⏳ USER IS WAITING"
          );
        } catch (error) {
          console.error(
            "CHECK MEETING ERROR:",
            error.response?.data ||
              error
          );

          if (!cancelled) {
            setError(
              error.response?.data
                ?.message ||
                error.message ||
                "Unable to check meeting"
            );
          }
        }
      };

    checkMeeting();

    return () => {
      cancelled = true;
    };
  }, [
    meetingId,
    user,
    navigate,
  ]);

  // ==================================================
  // SOCKET + JOIN REQUEST
  // ==================================================

  useEffect(() => {
    if (
      !meetingId ||
      !user
    ) {
      return;
    }

    const userId = (
      user._id ||
      user.id
    )?.toString();

    const userName =
      user.name ||
      "User";

    const userEmail =
      user.email ||
      "";

    if (!userId) {
      console.error(
        "❌ USER ID NOT FOUND"
      );

      setError(
        "User ID not found."
      );

      return;
    }

    console.log(
      "================================="
    );

    console.log(
      "🚪 WAITING ROOM ACTIVE"
    );

    console.log(
      "Meeting ID:",
      meetingId
    );

    console.log(
      "User ID:",
      userId
    );

    console.log(
      "User:",
      userName
    );

    console.log(
      "================================="
    );

    // =================================================
    // SEND JOIN REQUEST
    // =================================================

    const sendJoinRequest =
      () => {
        if (
          !socket.connected
        ) {
          console.log(
            "❌ SOCKET NOT CONNECTED"
          );
          return;
        }

        if (!socket.id) {
          console.log(
            "❌ SOCKET ID NOT AVAILABLE"
          );
          return;
        }

        console.log(
          "================================="
        );

        console.log(
          "📨 SENDING JOIN REQUEST"
        );

        console.log(
          "Socket ID:",
          socket.id
        );

        console.log(
          "Meeting ID:",
          meetingId
        );

        console.log(
          "User ID:",
          userId
        );

        console.log(
          "User Name:",
          userName
        );

        console.log(
          "================================="
        );

        socket.emit(
          "join-request",
          {
            meetingId:
              meetingId.toString(),

            userId,

            userName,

            userEmail,

            socketId:
              socket.id,
          }
        );

        setRequestSent(
          true
        );

        setStatus(
          "Waiting for host to admit you..."
        );
      };

    // =================================================
    // SOCKET CONNECT
    // =================================================

    const handleConnect =
      () => {
        console.log(
          "================================="
        );

        console.log(
          "🔌 WAITING ROOM SOCKET CONNECTED"
        );

        console.log(
          "Socket ID:",
          socket.id
        );

        console.log(
          "================================="
        );

        // Register user
        socket.emit(
          "register-user",
          {
            userId,
            userName,
          }
        );

        // Send request
        sendJoinRequest();
      };

    // =================================================
    // CONNECT ERROR
    // =================================================

    const handleConnectError =
      (error) => {
        console.error(
          "❌ SOCKET CONNECTION ERROR:",
          error
        );

        setStatus(
          "Unable to connect to server."
        );

        setError(
          "Socket connection failed. Make sure backend is running."
        );
      };

    // =================================================
    // JOIN REQUEST ERROR
    // =================================================

    const handleJoinRequestError =
      (data) => {
        console.error(
          "❌ JOIN REQUEST ERROR:",
          data
        );

        setStatus(
          "Unable to send join request."
        );

        setError(
          data?.message ||
            "Unable to send join request."
        );

        setRequestSent(
          false
        );
      };

    // =================================================
    // ADMITTED
    // =================================================

    const handleAdmitted =
      (data) => {
        console.log(
          "================================="
        );

        console.log(
          "✅ PARTICIPANT ADMITTED"
        );

        console.log(
          data
        );

        console.log(
          "================================="
        );

        if (
          data?.meetingId?.toString() !==
          meetingId?.toString()
        ) {
          return;
        }

        setStatus(
          "You have been admitted. Entering meeting..."
        );

        setTimeout(
          () => {
            navigate(
              `/meeting/${meetingId}`,
              {
                replace: true,
              }
            );
          },
          300
        );
      };

    // =================================================
    // DENIED
    // =================================================

    const handleDenied =
      (data) => {
        console.log(
          "❌ PARTICIPANT DENIED:",
          data
        );

        if (
          data?.meetingId?.toString() !==
          meetingId?.toString()
        ) {
          return;
        }

        setStatus(
          "The host denied your request."
        );

        alert(
          data?.message ||
            "The host denied your request to join."
        );

        navigate(
          "/dashboard",
          {
            replace: true,
          }
        );
      };

    // =================================================
    // MEETING ENDED
    // =================================================

    const handleMeetingEnded =
      (data) => {
        console.log(
          "🛑 MEETING ENDED:",
          data
        );

        alert(
          data?.message ||
            "The host ended the meeting."
        );

        navigate(
          "/dashboard",
          {
            replace: true,
          }
        );
      };

    // =================================================
    // LISTENERS FIRST
    // =================================================

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "connect_error",
      handleConnectError
    );

    socket.on(
      "join-request-error",
      handleJoinRequestError
    );

    socket.on(
      "participant-admitted",
      handleAdmitted
    );

    socket.on(
      "participant-denied",
      handleDenied
    );

    socket.on(
      "meeting-ended",
      handleMeetingEnded
    );

    // =================================================
    // CONNECT
    // =================================================

    if (
      socket.connected &&
      socket.id
    ) {
      console.log(
        "🔌 SOCKET ALREADY CONNECTED:",
        socket.id
      );

      handleConnect();
    } else {
      console.log(
        "🔌 CONNECTING WAITING ROOM SOCKET..."
      );

      socket.connect();
    }

    // =================================================
    // CLEANUP
    // =================================================

    return () => {
      console.log(
        "🧹 WAITING ROOM CLEANUP"
      );

      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "connect_error",
        handleConnectError
      );

      socket.off(
        "join-request-error",
        handleJoinRequestError
      );

      socket.off(
        "participant-admitted",
        handleAdmitted
      );

      socket.off(
        "participant-denied",
        handleDenied
      );

      socket.off(
        "meeting-ended",
        handleMeetingEnded
      );
    };
  }, [
    meetingId,
    user,
    navigate,
  ]);

  // ==================================================
  // CANCEL
  // ==================================================

  const cancelWaiting =
    () => {
      if (
        socket.connected
      ) {
        socket.emit(
          "leave-room",
          {
            meetingId,

            userId:
              user?._id ||
              user?.id,
          }
        );
      }

      navigate(
        "/dashboard",
        {
          replace: true,
        }
      );
    };

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <div className="waiting-room-page">
        <div className="waiting-card">
          <div className="waiting-icon">
            ⏳
          </div>

          <h1>
            Loading...
          </h1>

          <p>
            Please wait.
          </p>
        </div>
      </div>
    );
  }

  // ==================================================
  // UI
  // ==================================================

  return (
    <div className="waiting-room-page">

      <div className="waiting-card">

        <div className="waiting-icon">
          ⏳
        </div>

        <h1>
          Waiting to join
        </h1>

        <p className="waiting-user">
          Hi{" "}
          <strong>
            {user?.name ||
              "User"}
          </strong>
        </p>

        <div className="waiting-meeting-id">
          <span>
            Meeting ID
          </span>

          <strong>
            {meetingId}
          </strong>
        </div>

        <div className="waiting-status">
          <div className="waiting-spinner"></div>

          <p>
            {status}
          </p>
        </div>

        {requestSent && (
          <div className="request-sent">

            <span>
              ✓
            </span>

            <div>
              <strong>
                Join request sent
              </strong>

              <p>
                The host has been
                notified.
              </p>
            </div>

          </div>
        )}

        {error && (
          <div className="waiting-error">
            {error}
          </div>
        )}

        <button
          className="waiting-cancel-btn"
          onClick={
            cancelWaiting
          }
        >
          Leave waiting room
        </button>

      </div>

    </div>
  );
};

export default WaitingRoom;