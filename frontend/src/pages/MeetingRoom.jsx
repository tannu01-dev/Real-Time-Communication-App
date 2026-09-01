import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import api from "../services/api";
import socket from "../services/socket";

import Whiteboard from "../components/Whiteboard";

import "../styles/meetingRoom.css";

const MeetingRoom = () => {
  const { meetingId } =
    useParams();

  const navigate =
    useNavigate();

  // ==================================================
  // USER
  // ==================================================

  const [user, setUser] =
    useState(null);

  // ==================================================
  // MEETING
  // ==================================================

  const [meeting, setMeeting] =
    useState(null);

  const [isHost, setIsHost] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  // ==================================================
  // MEDIA
  // ==================================================

  const localVideoRef =
    useRef(null);

  const localStreamRef =
    useRef(null);

  const [cameraOn, setCameraOn] =
    useState(true);

  const [micOn, setMicOn] =
    useState(true);

  const [screenSharing, setScreenSharing] =
    useState(false);

  // ==================================================
  // PARTICIPANTS
  // ==================================================

  const [participants, setParticipants] =
    useState([]);

  const [participantCount, setParticipantCount] =
    useState(1);

  // ==================================================
  // CHAT
  // ==================================================

  const [chatOpen, setChatOpen] =
    useState(false);

  const [messages, setMessages] =
    useState([]);

  const [message, setMessage] =
    useState("");

  // ==================================================
  // FILE
  // ==================================================

  const fileInputRef =
    useRef(null);

  // ==================================================
  // WHITEBOARD
  // ==================================================

  const [whiteboardOpen, setWhiteboardOpen] =
    useState(false);

  // ==================================================
  // JOIN REQUEST
  // ==================================================

  const [joinRequest, setJoinRequest] =
    useState(null);

  // ==================================================
  // GET USER
  // ==================================================

  useEffect(() => {
  const storedUser = localStorage.getItem("user");
  const token = localStorage.getItem("token");

  console.log("========== MEETING USER CHECK ==========");
  console.log("TOKEN EXISTS:", !!token);
  console.log("STORED USER:", storedUser);
  console.log("========================================");

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

    console.log("✅ MEETING USER LOADED:", parsedUser);

    setUser(parsedUser);
  } catch (error) {
    console.error("USER PARSE ERROR:", error);
    navigate("/login", { replace: true });
  }
}, [navigate]);

  // ==================================================
  // GET MEETING
  // ==================================================

  useEffect(() => {
    if (!meetingId) {
      return;
    }

    let mounted = true;

    const getMeeting =
      async () => {
        try {
          setLoading(true);

          const response =
            await api.get(
              `/meetings/${meetingId}`
            );

          console.log(
            "GET MEETING:",
            response.data
          );

          if (
            !response.data?.success
          ) {
            throw new Error(
              "Meeting not found"
            );
          }

          if (mounted) {
            setMeeting(
              response.data.meeting
            );
          }
        } catch (error) {
          console.error(
            "GET MEETING ERROR:",
            error.response?.data ||
              error
          );

          if (mounted) {
            alert(
              error.response?.data
                ?.message ||
                "Unable to load meeting"
            );

            navigate(
              "/dashboard",
              {
                replace: true,
              }
            );
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    getMeeting();

    return () => {
      mounted = false;
    };
  }, [
    meetingId,
    navigate,
  ]);

  // ==================================================
  // CHECK HOST
  // ==================================================

  useEffect(() => {
    if (
      !user ||
      !meeting
    ) {
      setIsHost(false);
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

    const host =
      Boolean(
        currentUserId &&
        hostId &&
        currentUserId ===
          hostId
      );

    console.log(
      "========== HOST CHECK =========="
    );

    console.log(
      "Current User ID:",
      currentUserId
    );

    console.log(
      "Host ID:",
      hostId
    );

    console.log(
      "IS HOST:",
      host
    );

    console.log(
      "================================"
    );

    setIsHost(host);
  }, [
    user,
    meeting,
  ]);

  // ==================================================
  // START MEDIA
  // ==================================================

  useEffect(() => {
    const startMedia =
      async () => {
        try {
          const stream =
            await navigator.mediaDevices.getUserMedia(
              {
                video: true,
                audio: true,
              }
            );

          localStreamRef.current =
            stream;

          if (
            localVideoRef.current
          ) {
            localVideoRef.current.srcObject =
              stream;
          }
        } catch (error) {
          console.error(
            "MEDIA ERROR:",
            error
          );
        }
      };

    startMedia();

    return () => {
      if (
        localStreamRef.current
      ) {
        localStreamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );
      }
    };
  }, []);

  // ==================================================
  // ACTUAL ROOM
  // ==================================================

  useEffect(() => {
    if (
      !meetingId ||
      !user ||
      !meeting
    ) {
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

    const userIsHost =
      currentUserId ===
      hostId;

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

    console.log(
      "ACTUAL ROOM CHECK:",
      {
        userIsHost,
        isParticipant,
      }
    );

    if (
      !userIsHost &&
      !isParticipant
    ) {
      console.log(
        "❌ USER IS NOT ADMITTED"
      );

      return;
    }

    // =================================================
    // SOCKET CONNECT
    // =================================================

    if (!socket.connected) {
      socket.connect();
    }

    const joinActualRoom =
      () => {
        if (!socket.connected) {
          return;
        }

        console.log(
          "================================="
        );

        console.log(
          "🚪 JOINING ACTUAL MEETING ROOM"
        );

        console.log(
          "Meeting ID:",
          meetingId
        );

        console.log(
          "User ID:",
          currentUserId
        );

        console.log(
          "Socket ID:",
          socket.id
        );

        console.log(
          "================================="
        );

        socket.emit(
          "join-room",
          {
            meetingId,
            userId:
              currentUserId,
            userName:
              user.name ||
              "User",
          }
        );
      };

    if (socket.connected) {
      joinActualRoom();
    } else {
      socket.once(
        "connect",
        joinActualRoom
      );
    }

    return () => {
      socket.off(
        "connect",
        joinActualRoom
      );

      if (
        socket.connected
      ) {
        socket.emit(
          "leave-room",
          {
            meetingId,
            userId:
              currentUserId,
          }
        );
      }
    };
  }, [
    meetingId,
    user,
    meeting,
  ]);

  // ==================================================
  // HOST SOCKET
  // ==================================================

  useEffect(() => {
    if (
      !isHost ||
      !meetingId ||
      !user
    ) {
      return;
    }

    const hostUserId = (
      user._id ||
      user.id
    )?.toString();

    const hostUserName =
      user.name ||
      "Host";

    console.log(
      "================================="
    );

    console.log(
      "👑 HOST SOCKET ACTIVE"
    );

    console.log(
      "Meeting ID:",
      meetingId
    );

    console.log(
      "Host ID:",
      hostUserId
    );

    console.log(
      "Host Name:",
      hostUserName
    );

    console.log(
      "================================="
    );

    // =================================================
    // HOST CONNECT
    // =================================================

    const registerHost =
      () => {
        if (!socket.connected) {
          return;
        }

        console.log(
          "👑 REGISTERING HOST SOCKET:",
          socket.id
        );

        // Register host
        socket.emit(
          "register-user",
          {
            userId:
              hostUserId,
            userName:
              hostUserName,
          }
        );

        // Join host room
        socket.emit(
          "host-join-room",
          {
            meetingId,
            userId:
              hostUserId,
            userName:
              hostUserName,
          }
        );
      };

    // =================================================
    // JOIN REQUEST
    // =================================================

    const handleJoinRequest =
      (data) => {
        console.log(
          "================================="
        );

        console.log(
          "🔔 HOST RECEIVED JOIN REQUEST"
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
          console.log(
            "❌ WRONG MEETING REQUEST"
          );

          return;
        }

        setJoinRequest({
          meetingId:
            data.meetingId,

          userId:
            data.userId,

          name:
            data.userName ||
            data.name ||
            "Someone",

          email:
            data.userEmail ||
            data.email ||
            "",

          socketId:
            data.socketId ||
            "",
        });
      };

    socket.on(
      "join-request",
      handleJoinRequest
    );

    // =================================================
    // CONNECT
    // =================================================

    if (
      socket.connected
    ) {
      registerHost();
    } else {
      socket.connect();

      socket.once(
        "connect",
        registerHost
      );
    }

    return () => {
      socket.off(
        "join-request",
        handleJoinRequest
      );

      socket.off(
        "connect",
        registerHost
      );
    };
  }, [
    isHost,
    meetingId,
    user,
  ]);

  // ==================================================
  // PARTICIPANT COUNT
  // ==================================================

  useEffect(() => {
    const handleCount =
      (data) => {
        setParticipantCount(
          data?.count || 0
        );
      };

    socket.on(
      "participant-count",
      handleCount
    );

    return () => {
      socket.off(
        "participant-count",
        handleCount
      );
    };
  }, []);

  // ==================================================
  // USER JOINED
  // ==================================================

  useEffect(() => {
    const handleUserJoined =
      (data) => {
        console.log(
          "USER JOINED:",
          data
        );

        setParticipants(
          (prev) => {
            const exists =
              prev.some(
                (item) =>
                  item.socketId ===
                  data.socketId
              );

            if (exists) {
              return prev;
            }

            return [
              ...prev,
              data,
            ];
          }
        );
      };

    socket.on(
      "user-joined",
      handleUserJoined
    );

    return () => {
      socket.off(
        "user-joined",
        handleUserJoined
      );
    };
  }, []);

  // ==================================================
  // USER LEFT
  // ==================================================

  useEffect(() => {
    const handleUserLeft =
      (data) => {
        setParticipants(
          (prev) =>
            prev.filter(
              (item) =>
                item.socketId !==
                data.socketId
            )
        );
      };

    socket.on(
      "user-left",
      handleUserLeft
    );

    return () => {
      socket.off(
        "user-left",
        handleUserLeft
      );
    };
  }, []);

  // ==================================================
  // CHAT RECEIVE
  // ==================================================

  useEffect(() => {
    const receiveMessage =
      (data) => {
        setMessages(
          (prev) => [
            ...prev,
            {
              ...data,
              type: "message",
            },
          ]
        );
      };

    socket.on(
      "receive-message",
      receiveMessage
    );

    return () => {
      socket.off(
        "receive-message",
        receiveMessage
      );
    };
  }, []);

  // ==================================================
  // FILE RECEIVE
  // ==================================================

  useEffect(() => {
    const receiveFile =
      (data) => {
        setMessages(
          (prev) => [
            ...prev,
            {
              ...data,
              type: "file",
              time:
                data.time ||
                new Date().toISOString(),
            },
          ]
        );
      };

    socket.on(
      "receive-file",
      receiveFile
    );

    return () => {
      socket.off(
        "receive-file",
        receiveFile
      );
    };
  }, []);

  // ==================================================
  // MIC
  // ==================================================

  const toggleMic =
    () => {
      const stream =
        localStreamRef.current;

      if (!stream) {
        return;
      }

      const audioTrack =
        stream.getAudioTracks()[0];

      if (!audioTrack) {
        return;
      }

      audioTrack.enabled =
        !audioTrack.enabled;

      setMicOn(
        audioTrack.enabled
      );
    };

  // ==================================================
  // CAMERA
  // ==================================================

  const toggleCamera =
    () => {
      const stream =
        localStreamRef.current;

      if (!stream) {
        return;
      }

      const videoTrack =
        stream.getVideoTracks()[0];

      if (!videoTrack) {
        return;
      }

      videoTrack.enabled =
        !videoTrack.enabled;

      setCameraOn(
        videoTrack.enabled
      );
    };

  // ==================================================
  // SCREEN SHARE
  // ==================================================

  const toggleScreenShare =
    async () => {
      try {
        if (
          screenSharing
        ) {
          const cameraStream =
            await navigator.mediaDevices.getUserMedia(
              {
                video: true,
                audio: true,
              }
            );

          localStreamRef.current =
            cameraStream;

          if (
            localVideoRef.current
          ) {
            localVideoRef.current.srcObject =
              cameraStream;
          }

          setScreenSharing(
            false
          );

          setCameraOn(
            true
          );

          setMicOn(
            true
          );

          return;
        }

        const screenStream =
          await navigator.mediaDevices.getDisplayMedia(
            {
              video: true,
              audio: true,
            }
          );

        localStreamRef.current =
          screenStream;

        if (
          localVideoRef.current
        ) {
          localVideoRef.current.srcObject =
            screenStream;
        }

        setScreenSharing(
          true
        );

        const screenTrack =
          screenStream.getVideoTracks()[0];

        screenTrack.onended =
          async () => {
            try {
              const cameraStream =
                await navigator.mediaDevices.getUserMedia(
                  {
                    video: true,
                    audio: true,
                  }
                );

              localStreamRef.current =
                cameraStream;

              if (
                localVideoRef.current
              ) {
                localVideoRef.current.srcObject =
                  cameraStream;
              }

              setScreenSharing(
                false
              );
            } catch (error) {
              console.error(
                "CAMERA RESTORE ERROR:",
                error
              );
            }
          };
      } catch (error) {
        console.error(
          "SCREEN SHARE ERROR:",
          error
        );
      }
    };

  // ==================================================
  // SEND MESSAGE
  // ==================================================

  const sendMessage =
    (e) => {
      e.preventDefault();

      if (
        !message.trim()
      ) {
        return;
      }

      socket.emit(
        "send-message",
        {
          meetingId,

          userId:
            user?._id ||
            user?.id,

          userName:
            user?.name ||
            "User",

          message:
            message.trim(),
        }
      );

      setMessage("");
    };

  // ==================================================
  // FILE SELECT
  // ==================================================

  const handleFileSelect =
    async (e) => {
      const file =
        e.target.files?.[0];

      if (!file) {
        return;
      }

      await uploadFile(
        file
      );

      e.target.value = "";
    };

  // ==================================================
  // UPLOAD FILE
  // ==================================================

  const uploadFile =
    async (file) => {
      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        formData.append(
          "meetingId",
          meetingId
        );

        const response =
          await api.post(
            "/files/upload",
            formData,
            {
              headers: {
                "Content-Type":
                  "multipart/form-data",
              },
            }
          );

        if (
          response.data?.success
        ) {
          const fileData =
            response.data.file;

          socket.emit(
            "send-file",
            {
              meetingId,

              userId:
                user?._id ||
                user?.id,

              userName:
                user?.name ||
                "User",

              fileName:
                fileData.originalName,

              fileUrl:
                fileData.url,

              size:
                fileData.size,
            }
          );
        }
      } catch (error) {
        console.error(
          "FILE UPLOAD ERROR:",
          error
        );

        alert(
          error.response?.data
            ?.message ||
            "File upload failed"
        );
      }
    };

  // ==================================================
  // ADMIT
  // ==================================================

  const admitUser =
    async () => {
      if (!joinRequest) {
        return;
      }

      try {
        console.log(
          "👑 ADMITTING:",
          joinRequest
        );

        const response =
          await api.post(
            `/meetings/${meetingId}/admit`,
            {
              userId:
                joinRequest.userId,
            }
          );

        console.log(
          "ADMIT RESPONSE:",
          response.data
        );

        if (
          response.data?.success
        ) {
          socket.emit(
            "participant-admitted",
            {
              meetingId,

              userId:
                joinRequest.userId,

              socketId:
                joinRequest.socketId,

              userName:
                joinRequest.name,
            }
          );

          setJoinRequest(
            null
          );

          // Refresh meeting
          const meetingResponse =
            await api.get(
              `/meetings/${meetingId}`
            );

          if (
            meetingResponse.data
              ?.success
          ) {
            setMeeting(
              meetingResponse.data.meeting
            );
          }
        }
      } catch (error) {
        console.error(
          "ADMIT ERROR:",
          error.response?.data ||
            error
        );

        alert(
          error.response?.data
            ?.message ||
            "Unable to admit user"
        );
      }
    };

  // ==================================================
  // DENY
  // ==================================================

  const denyUser =
    async () => {
      if (!joinRequest) {
        return;
      }

      try {
        console.log(
          "❌ DENYING:",
          joinRequest
        );

        const response =
          await api.post(
            `/meetings/${meetingId}/deny`,
            {
              userId:
                joinRequest.userId,
            }
          );

        console.log(
          "DENY RESPONSE:",
          response.data
        );

        if (
          response.data?.success
        ) {
          socket.emit(
            "participant-denied",
            {
              meetingId,

              userId:
                joinRequest.userId,

              socketId:
                joinRequest.socketId,
            }
          );

          setJoinRequest(
            null
          );
        }
      } catch (error) {
        console.error(
          "DENY ERROR:",
          error.response?.data ||
            error
        );

        alert(
          error.response?.data
            ?.message ||
            "Unable to deny user"
        );
      }
    };

  // ==================================================
  // END MEETING
  // ==================================================

  const endMeeting =
    async () => {
      const confirmed =
        window.confirm(
          "Are you sure you want to end this meeting?"
        );

      if (!confirmed) {
        return;
      }

      try {
        await api.patch(
          `/meetings/${meetingId}/end`
        );

        socket.emit(
          "meeting-ended",
          {
            meetingId,
          }
        );

        if (
          localStreamRef.current
        ) {
          localStreamRef.current
            .getTracks()
            .forEach(
              (track) =>
                track.stop()
            );
        }

        navigate(
          "/dashboard",
          {
            replace: true,
          }
        );
      } catch (error) {
        console.error(
          "END MEETING ERROR:",
          error
        );

        alert(
          error.response?.data
            ?.message ||
            "Unable to end meeting"
        );
      }
    };

  // ==================================================
  // LEAVE
  // ==================================================

  const leaveMeeting =
    () => {
      socket.emit(
        "leave-room",
        {
          meetingId,

          userId:
            user?._id ||
            user?.id,
        }
      );

      if (
        localStreamRef.current
      ) {
        localStreamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
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

  if (
    loading ||
    !meeting
  ) {
    return (
      <div className="meeting-loading">

        <div className="meeting-loader"></div>

        <p>
          Loading meeting...
        </p>

      </div>
    );
  }

  // ==================================================
  // UI
  // ==================================================

  return (
    <div className="meeting-page">

      {/* HEADER */}

      <header className="meeting-header">

        <div className="meeting-title">

          <div className="meeting-logo">
            VC
          </div>

          <div>
            <h2>
              Meeting Room
            </h2>

            <span>
              {meetingId}
            </span>
          </div>

        </div>

        <div className="meeting-header-right">

          <div className="participant-count">
            👥{" "}
            {participantCount}
          </div>

        </div>

      </header>

      {/* JOIN REQUEST */}

      {isHost &&
        joinRequest && (
          <div className="join-request-popup">

            <div className="join-popup-icon">
              👋
            </div>

            <div className="join-popup-content">

              <h3>
                Someone wants to join
              </h3>

              <p>
                <strong>
                  {
                    joinRequest.name ||
                    "Someone"
                  }
                </strong>{" "}
                wants to join this
                meeting.
              </p>

              {joinRequest.email && (
                <small>
                  {
                    joinRequest.email
                  }
                </small>
              )}

              <div className="join-popup-actions">

                <button
                  className="popup-deny-btn"
                  onClick={
                    denyUser
                  }
                >
                  Deny
                </button>

                <button
                  className="popup-admit-btn"
                  onClick={
                    admitUser
                  }
                >
                  Admit
                </button>

              </div>

            </div>

          </div>
        )}

      {/* VIDEO */}

      <main className="meeting-main">

        <div className="video-grid">

          <div className="video-card local-video-card">

            <video
              ref={
                localVideoRef
              }
              autoPlay
              muted
              playsInline
            />

            {!cameraOn && (
              <div className="camera-off">
                📷
              </div>
            )}

            <div className="video-name">
              {user?.name ||
                "You"}{" "}
              (You)
            </div>

          </div>

          {participants.map(
            (participant) => (
              <div
                className="video-card"
                key={
                  participant.socketId
                }
              >

                <div className="remote-placeholder">
                  👤
                </div>

                <div className="video-name">
                  {
                    participant.userName ||
                    "Participant"
                  }
                </div>

              </div>
            )
          )}

        </div>

      </main>

      {/* CHAT */}

      <aside
        className={`chat-drawer ${
          chatOpen
            ? "open"
            : ""
        }`}
      >

        <div className="chat-header">

          <div>

            <h3>
              In-call messages
            </h3>

            <span>
              Everyone can see these
              messages
            </span>

          </div>

          <button
            onClick={() =>
              setChatOpen(
                false
              )
            }
          >
            ✕
          </button>

        </div>

        <div className="chat-messages">

          {messages.length ===
          0 ? (
            <div className="empty-chat">

              <div>
                💬
              </div>

              <p>
                No messages yet
              </p>

              <span>
                Send a message to
                everyone
              </span>

            </div>
          ) : (
            messages.map(
              (msg, index) => {
                const ownMessage =
                  msg.userId
                    ?.toString() ===
                  (
                    user?._id ||
                    user?.id
                  )?.toString();

                return (
                  <div
                    key={index}
                    className={`chat-message ${
                      ownMessage
                        ? "own"
                        : ""
                    }`}
                  >

                    <div className="chat-user">
                      {
                        msg.userName ||
                        "User"
                      }
                    </div>

                    {msg.type ===
                    "file" ? (
                      <a
                        className="chat-file"
                        href={`http://localhost:5000${msg.fileUrl}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        📎{" "}
                        {
                          msg.fileName
                        }
                      </a>
                    ) : (
                      <div className="chat-text">
                        {
                          msg.message
                        }
                      </div>
                    )}

                    <div className="chat-time">
                      {msg.time
                        ? new Date(
                            msg.time
                          ).toLocaleTimeString(
                            [],
                            {
                              hour:
                                "2-digit",
                              minute:
                                "2-digit",
                            }
                          )
                        : ""}
                    </div>

                  </div>
                );
              }
            )
          )}

        </div>

        <form
          className="chat-input-area"
          onSubmit={
            sendMessage
          }
        >

          <input
            type="text"
            placeholder="Send a message..."
            value={message}
            onChange={(e) =>
              setMessage(
                e.target.value
              )
            }
          />

          <button
            type="button"
            className="chat-file-btn"
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            📎
          </button>

          <button
            type="submit"
            className="chat-send-btn"
          >
            ➤
          </button>

        </form>

      </aside>

      {/* FILE INPUT */}

      <input
        ref={
          fileInputRef
        }
        type="file"
        hidden
        onChange={
          handleFileSelect
        }
      />

      {/* WHITEBOARD */}

      {whiteboardOpen && (
        <Whiteboard
          meetingId={
            meetingId
          }
          onClose={() =>
            setWhiteboardOpen(
              false
            )
          }
        />
      )}

      {/* CONTROLS */}

      <footer className="meeting-controls-bar">

        <div className="control-group">

          <button
            className={`control-btn ${
              micOn
                ? ""
                : "control-off"
            }`}
            onClick={
              toggleMic
            }
            title="Microphone"
          >
            {micOn
              ? "🎤"
              : "🔇"}
          </button>

          <button
            className={`control-btn ${
              cameraOn
                ? ""
                : "control-off"
            }`}
            onClick={
              toggleCamera
            }
            title="Camera"
          >
            {cameraOn
              ? "📹"
              : "📷"}
          </button>

          <button
            className={`control-btn ${
              screenSharing
                ? "screen-active"
                : ""
            }`}
            onClick={
              toggleScreenShare
            }
            title="Share screen"
          >
            🖥️
          </button>

          <button
            className={`control-btn ${
              chatOpen
                ? "screen-active"
                : ""
            }`}
            onClick={() =>
              setChatOpen(
                (prev) =>
                  !prev
              )
            }
            title="Chat"
          >
            💬

            {messages.length >
              0 && (
              <span className="message-badge">
                {
                  messages.length
                }
              </span>
            )}

          </button>

          <button
            className="control-btn"
            onClick={() =>
              fileInputRef.current?.click()
            }
            title="Share file"
          >
            📎
          </button>

          <button
            className={`control-btn ${
              whiteboardOpen
                ? "screen-active"
                : ""
            }`}
            onClick={() =>
              setWhiteboardOpen(
                (prev) =>
                  !prev
              )
            }
            title="Whiteboard"
          >
            🎨
          </button>

        </div>

        <div className="control-group right-controls">

          {isHost ? (
            <button
              className="end-meeting-btn"
              onClick={
                endMeeting
              }
            >
              End meeting
            </button>
          ) : (
            <button
              className="leave-meeting-btn"
              onClick={
                leaveMeeting
              }
            >
              Leave
            </button>
          )}

        </div>

      </footer>

    </div>
  );
};

export default MeetingRoom;