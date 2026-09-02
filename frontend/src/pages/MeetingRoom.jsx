import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import socket from "../services/socket";
import Whiteboard from "../components/Whiteboard";
import "../styles/meetingRoom.css";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const MeetingRoom = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  // ================= USER =================
  const [user, setUser] = useState(null);

  // ================= MEETING =================
  const [meeting, setMeeting] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);

  // ================= MEDIA =================
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  // ================= WEBRTC =================
  const peerConnectionsRef = useRef({});
  const pendingCandidatesRef = useRef({});
  const remoteVideoRefs = useRef({});

  const [remoteStreams, setRemoteStreams] = useState([]);

  // ================= PARTICIPANTS =================
  const [participantCount, setParticipantCount] = useState(1);

  // ================= CHAT =================
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");

  // ================= FILE =================
  const fileInputRef = useRef(null);

  // ================= WHITEBOARD =================
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);

  // ================= JOIN REQUEST =================
  const [joinRequest, setJoinRequest] = useState(null);
  const joinRequestedRef = useRef(false);

  // =========================================================
  // USER ID
  // =========================================================

  const getUserId = useCallback(() => {
    return (user?._id || user?.id)?.toString();
  }, [user]);

  // =========================================================
  // GET USER
  // =========================================================

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
      } catch (error) {
        console.error("USER PARSE ERROR:", error);
        navigate("/login", { replace: true });
      }
    } else {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // =========================================================
  // GET MEETING
  // =========================================================

  const loadMeeting = useCallback(async () => {
    if (!meetingId) return null;

    try {
      const response = await api.get(`/meetings/${meetingId}`);

      if (!response.data?.success) {
        throw new Error("Meeting not found");
      }

      const data = response.data.meeting;
      setMeeting(data);

      return data;
    } catch (error) {
      console.error("GET MEETING ERROR:", error.response?.data || error);

      alert(
        error.response?.data?.message ||
          "Unable to load meeting"
      );

      navigate("/dashboard", { replace: true });
      return null;
    }
  }, [meetingId, navigate]);

  useEffect(() => {
    if (!meetingId || !user) return;

    let mounted = true;

    const load = async () => {
      setLoading(true);

      try {
        const response = await api.get(`/meetings/${meetingId}`);

        if (!response.data?.success) {
          throw new Error("Meeting not found");
        }

        if (mounted) {
          setMeeting(response.data.meeting);
        }
      } catch (error) {
        console.error(
          "MEETING LOAD ERROR:",
          error.response?.data || error
        );

        if (mounted) {
          alert(
            error.response?.data?.message ||
              "Unable to load meeting"
          );

          navigate("/dashboard", {
            replace: true,
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [meetingId, user, navigate]);

  // =========================================================
  // HOST CHECK
  // =========================================================

  useEffect(() => {
    if (!user || !meeting) {
      setIsHost(false);
      return;
    }

    const currentUserId = (
      user._id || user.id
    )?.toString();

    const hostId = (
      typeof meeting.host === "object"
        ? meeting.host?._id
        : meeting.host
    )?.toString();

    const host = currentUserId === hostId;

    console.log("========== HOST CHECK ==========");
    console.log("Current User:", currentUserId);
    console.log("Meeting Host:", hostId);
    console.log("IS HOST:", host);
    console.log("================================");

    setIsHost(host);
  }, [user, meeting]);

  // =========================================================
  // START CAMERA + MIC
  // =========================================================

  useEffect(() => {
    let mounted = true;

    const startMedia = async () => {
      try {
        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            "Camera/microphone is not supported."
          );
        }

        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });

        if (!mounted) {
          stream.getTracks().forEach((track) =>
            track.stop()
          );
          return;
        }

        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;

          try {
            await localVideoRef.current.play();
          } catch (error) {
            console.log("VIDEO PLAY:", error);
          }
        }

        setCameraOn(
          stream.getVideoTracks().some(
            (track) => track.enabled
          )
        );

        setMicOn(
          stream.getAudioTracks().some(
            (track) => track.enabled
          )
        );

        console.log("✅ CAMERA + MIC READY");
      } catch (error) {
        console.error("❌ MEDIA ERROR:", error);

        alert(
          "Camera/Microphone access nahi mila. Browser permissions check karo."
        );
      }
    };

    startMedia();

    return () => {
      mounted = false;

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  // =========================================================
  // ADD REMOTE STREAM
  // =========================================================

  const addRemoteStream = useCallback(
    (socketId, stream, userName = "Participant") => {
      setRemoteStreams((prev) => {
        const exists = prev.some(
          (item) => item.socketId === socketId
        );

        if (exists) {
          return prev.map((item) =>
            item.socketId === socketId
              ? {
                  ...item,
                  stream,
                  userName,
                }
              : item
          );
        }

        return [
          ...prev,
          {
            socketId,
            stream,
            userName,
          },
        ];
      });
    },
    []
  );

  // =========================================================
  // CREATE PEER CONNECTION
  // =========================================================

  const createPeerConnection = useCallback(
    (targetSocketId, userName = "Participant") => {
      if (
        peerConnectionsRef.current[targetSocketId]
      ) {
        return peerConnectionsRef.current[
          targetSocketId
        ];
      }

      const pc = new RTCPeerConnection(
        ICE_SERVERS
      );

      peerConnectionsRef.current[
        targetSocketId
      ] = pc;

      pendingCandidatesRef.current[
        targetSocketId
      ] = [];

      // Add local tracks
      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => {
            pc.addTrack(
              track,
              localStreamRef.current
            );
          });
      }

      // Remote stream
      pc.ontrack = (event) => {
        console.log(
          "📹 REMOTE TRACK:",
          targetSocketId
        );

        const stream =
          event.streams?.[0];

        if (stream) {
          addRemoteStream(
            targetSocketId,
            stream,
            userName
          );
        }
      };

      // ICE
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            target: targetSocketId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(
          `WEBRTC ${targetSocketId}:`,
          pc.connectionState
        );

        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed" ||
          pc.connectionState === "disconnected"
        ) {
          removePeer(targetSocketId);
        }
      };

      return pc;
    },
    [addRemoteStream]
  );

  // =========================================================
  // REMOVE PEER
  // =========================================================

  const removePeer = useCallback(
    (socketId) => {
      const pc =
        peerConnectionsRef.current[socketId];

      if (pc) {
        pc.close();
        delete peerConnectionsRef.current[
          socketId
        ];
      }

      delete pendingCandidatesRef.current[
        socketId
      ];

      setRemoteStreams((prev) =>
        prev.filter(
          (item) => item.socketId !== socketId
        )
      );
    },
    []
  );

  // =========================================================
  // CREATE OFFER
  // =========================================================

  const createOffer = useCallback(
    async (targetSocketId, userName) => {
      try {
        const pc = createPeerConnection(
          targetSocketId,
          userName
        );

        const offer =
          await pc.createOffer();

        await pc.setLocalDescription(
          offer
        );

        socket.emit("offer", {
          target: targetSocketId,
          offer,
        });

        console.log(
          "📤 OFFER SENT:",
          targetSocketId
        );
      } catch (error) {
        console.error(
          "OFFER ERROR:",
          error
        );
      }
    },
    [createPeerConnection]
  );

  // =========================================================
  // WEBRTC SIGNALING
  // =========================================================

  useEffect(() => {
    const handleOffer = async (data) => {
      try {
        if (!data?.sender || !data?.offer) {
          return;
        }

        console.log(
          "📥 OFFER RECEIVED:",
          data.sender
        );

        const pc = createPeerConnection(
          data.sender,
          data.userName || "Participant"
        );

        await pc.setRemoteDescription(
          new RTCSessionDescription(
            data.offer
          )
        );

        const candidates =
          pendingCandidatesRef.current[
            data.sender
          ] || [];

        for (const candidate of candidates) {
          try {
            await pc.addIceCandidate(
              candidate
            );
          } catch (error) {
            console.error(
              "QUEUED ICE ERROR:",
              error
            );
          }
        }

        pendingCandidatesRef.current[
          data.sender
        ] = [];

        const answer =
          await pc.createAnswer();

        await pc.setLocalDescription(
          answer
        );

        socket.emit("answer", {
          target: data.sender,
          answer,
        });

        console.log(
          "📤 ANSWER SENT:",
          data.sender
        );
      } catch (error) {
        console.error(
          "OFFER HANDLER ERROR:",
          error
        );
      }
    };

    const handleAnswer = async (data) => {
      try {
        if (!data?.sender || !data?.answer) {
          return;
        }

        const pc =
          peerConnectionsRef.current[
            data.sender
          ];

        if (!pc) return;

        await pc.setRemoteDescription(
          new RTCSessionDescription(
            data.answer
          )
        );

        const candidates =
          pendingCandidatesRef.current[
            data.sender
          ] || [];

        for (const candidate of candidates) {
          try {
            await pc.addIceCandidate(
              candidate
            );
          } catch (error) {
            console.error(
              "ICE QUEUE ERROR:",
              error
            );
          }
        }

        pendingCandidatesRef.current[
          data.sender
        ] = [];

        console.log(
          "✅ ANSWER APPLIED:",
          data.sender
        );
      } catch (error) {
        console.error(
          "ANSWER ERROR:",
          error
        );
      }
    };

    const handleIceCandidate = async (
      data
    ) => {
      try {
        if (
          !data?.sender ||
          !data?.candidate
        ) {
          return;
        }

        const pc =
          peerConnectionsRef.current[
            data.sender
          ];

        const candidate =
          new RTCIceCandidate(
            data.candidate
          );

        if (
          pc &&
          pc.remoteDescription
        ) {
          await pc.addIceCandidate(
            candidate
          );
        } else {
          if (
            !pendingCandidatesRef.current[
              data.sender
            ]
          ) {
            pendingCandidatesRef.current[
              data.sender
            ] = [];
          }

          pendingCandidatesRef.current[
            data.sender
          ].push(candidate);
        }
      } catch (error) {
        console.error(
          "ICE ERROR:",
          error
        );
      }
    };

    const handleUserJoined = (
      data
    ) => {
      console.log(
        "👤 USER JOINED:",
        data
      );

      if (!data?.socketId) return;

      // Existing user creates offer
      createOffer(
        data.socketId,
        data.userName
      );
    };

    const handleUserLeft = (
      data
    ) => {
      if (!data?.socketId) return;

      console.log(
        "👋 USER LEFT:",
        data.socketId
      );

      removePeer(data.socketId);
    };

    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on(
      "ice-candidate",
      handleIceCandidate
    );
    socket.on(
      "user-joined",
      handleUserJoined
    );
    socket.on(
      "user-left",
      handleUserLeft
    );

    return () => {
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off(
        "ice-candidate",
        handleIceCandidate
      );
      socket.off(
        "user-joined",
        handleUserJoined
      );
      socket.off(
        "user-left",
        handleUserLeft
      );
    };
  }, [createOffer, createPeerConnection, removePeer]);

  // =========================================================
  // JOIN ACTUAL ROOM
  // =========================================================

  useEffect(() => {
    if (!meetingId || !user || !meeting) {
      return;
    }

    const currentUserId = (
      user._id || user.id
    )?.toString();

    const hostId = (
      typeof meeting.host === "object"
        ? meeting.host?._id
        : meeting.host
    )?.toString();

    const userIsHost =
      currentUserId === hostId;

    const isParticipant =
      meeting.participants?.some(
        (participant) => {
          const id = (
            participant?._id ||
            participant
          )?.toString();

          return id === currentUserId;
        }
      );

    // ---------------------------------------------------------
    // NOT ADMITTED
    // ---------------------------------------------------------

    if (!userIsHost && !isParticipant) {
      if (!joinRequestedRef.current) {
        joinRequestedRef.current = true;

        api
          .post("/meetings/join", {
            meetingId,
          })
          .then((response) => {
            console.log(
              "JOIN RESPONSE:",
              response.data
            );
          })
          .catch((error) => {
            console.error(
              "JOIN REQUEST ERROR:",
              error.response?.data ||
                error
            );

            joinRequestedRef.current = false;
          });
      }

      return;
    }

    // ---------------------------------------------------------
    // CONNECT SOCKET
    // ---------------------------------------------------------

    const joinRoom = () => {
      if (!socket.connected) return;

      socket.emit("join-room", {
        meetingId,
        userId: currentUserId,
        userName:
          user.name || "User",
      });

      console.log(
        "🚪 JOINED ACTUAL ROOM:",
        meetingId
      );
    };

    if (!socket.connected) {
      socket.connect();
      socket.once(
        "connect",
        joinRoom
      );
    } else {
      joinRoom();
    }

    return () => {
      socket.off(
        "connect",
        joinRoom
      );
    };
  }, [meetingId, user, meeting]);

  // =========================================================
  // HOST SOCKET + JOIN REQUEST
  // =========================================================

  useEffect(() => {
    if (
      !isHost ||
      !meetingId ||
      !user
    ) {
      return;
    }

    const hostUserId = (
      user._id || user.id
    )?.toString();

    const registerHost = () => {
      if (!socket.connected) return;

      console.log(
        "👑 REGISTERING HOST:",
        hostUserId
      );

      socket.emit("register-user", {
        userId: hostUserId,
        userName:
          user.name || "Host",
      });

      socket.emit("host-join-room", {
        meetingId,
        userId: hostUserId,
        userName:
          user.name || "Host",
      });
    };

    const handleJoinRequest = (
      data
    ) => {
      console.log(
        "🔔 JOIN REQUEST:",
        data
      );

      if (
        data?.meetingId?.toString() !==
        meetingId?.toString()
      ) {
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
          data.socketId || "",
      });
    };

    socket.on(
      "join-request",
      handleJoinRequest
    );

    if (!socket.connected) {
      socket.connect();
      socket.once(
        "connect",
        registerHost
      );
    } else {
      registerHost();
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

  // =========================================================
  // PARTICIPANT ADMITTED
  // =========================================================

  useEffect(() => {
    const handleAdmitted = async (
      data
    ) => {
      if (
        data?.meetingId?.toString() !==
        meetingId?.toString()
      ) {
        return;
      }

      const myId = (
        user?._id || user?.id
      )?.toString();

      if (
        data?.userId?.toString() !==
        myId
      ) {
        return;
      }

      console.log(
        "🎉 YOU ARE ADMITTED"
      );

      joinRequestedRef.current = false;

      const updatedMeeting =
        await loadMeeting();

      if (updatedMeeting) {
        setMeeting(updatedMeeting);
      }
    };

    const handleDenied = (data) => {
      if (
        data?.meetingId?.toString() !==
        meetingId?.toString()
      ) {
        return;
      }

      const myId = (
        user?._id || user?.id
      )?.toString();

      if (
        data?.userId?.toString() !==
        myId
      ) {
        return;
      }

      alert(
        data.message ||
          "Host denied your request."
      );

      navigate("/dashboard", {
        replace: true,
      });
    };

    socket.on(
      "participant-admitted",
      handleAdmitted
    );

    socket.on(
      "participant-denied",
      handleDenied
    );

    return () => {
      socket.off(
        "participant-admitted",
        handleAdmitted
      );

      socket.off(
        "participant-denied",
        handleDenied
      );
    };
  }, [
    meetingId,
    user,
    loadMeeting,
    navigate,
  ]);

  // =========================================================
  // PARTICIPANT COUNT
  // =========================================================

  useEffect(() => {
    const handleCount = (data) => {
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

  // =========================================================
  // CHAT
  // =========================================================

  useEffect(() => {
    const receiveMessage = (
      data
    ) => {
      setMessages((prev) => [
        ...prev,
        {
          ...data,
          type: "message",
        },
      ]);
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

  const sendMessage = (e) => {
    e.preventDefault();

    if (!message.trim()) return;

    socket.emit("send-message", {
      meetingId,
      userId:
        user?._id || user?.id,
      userName:
        user?.name || "User",
      message: message.trim(),
    });

    setMessage("");
  };

  // =========================================================
  // FILE
  // =========================================================

  useEffect(() => {
    const receiveFile = (data) => {
      setMessages((prev) => [
        ...prev,
        {
          ...data,
          type: "file",
          time:
            data.time ||
            new Date().toISOString(),
        },
      ]);
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

  const uploadFile = async (file) => {
    try {
      const formData = new FormData();

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

      if (response.data?.success) {
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
              user?.name || "User",
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

  const handleFileSelect = async (
    e
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    await uploadFile(file);

    e.target.value = "";
  };

  // =========================================================
  // MIC
  // =========================================================

  const toggleMic = () => {
    const stream =
      localStreamRef.current;

    if (!stream) return;

    const track =
      stream.getAudioTracks()[0];

    if (!track) return;

    track.enabled =
      !track.enabled;

    setMicOn(track.enabled);
  };

  // =========================================================
  // CAMERA
  // =========================================================

  const toggleCamera = () => {
    const stream =
      localStreamRef.current;

    if (!stream) return;

    const track =
      stream.getVideoTracks()[0];

    if (!track) return;

    track.enabled =
      !track.enabled;

    setCameraOn(track.enabled);
  };

  // =========================================================
  // SCREEN SHARE
  // =========================================================

  const toggleScreenShare =
    async () => {
      try {
        if (screenSharing) {
          const cameraStream =
            await navigator.mediaDevices.getUserMedia(
              {
                video: true,
                audio: true,
              }
            );

          await replaceVideoTrack(
            cameraStream.getVideoTracks()[0]
          );

          if (localStreamRef.current) {
            localStreamRef.current
              .getTracks()
              .forEach((track) => {
                if (
                  track.kind === "video"
                ) {
                  track.stop();
                }
              });
          }

          localStreamRef.current =
            cameraStream;

          if (localVideoRef.current) {
            localVideoRef.current.srcObject =
              cameraStream;
          }

          setScreenSharing(false);
          setCameraOn(true);
          setMicOn(true);

          return;
        }

        const screenStream =
          await navigator.mediaDevices.getDisplayMedia(
            {
              video: true,
              audio: false,
            }
          );

        const screenTrack =
          screenStream.getVideoTracks()[0];

        await replaceVideoTrack(
          screenTrack
        );

        const oldVideo =
          localStreamRef.current?.getVideoTracks()[0];

        if (oldVideo) {
          oldVideo.stop();
        }

        const audioTrack =
          localStreamRef.current?.getAudioTracks()[0];

        const combined =
          new MediaStream();

        combined.addTrack(
          screenTrack
        );

        if (audioTrack) {
          combined.addTrack(
            audioTrack
          );
        }

        localStreamRef.current =
          combined;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject =
            combined;
        }

        setScreenSharing(true);

        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (error) {
        console.error(
          "SCREEN SHARE ERROR:",
          error
        );
      }
    };

  const replaceVideoTrack = async (
    newTrack
  ) => {
    const peers =
      Object.values(
        peerConnectionsRef.current
      );

    for (const pc of peers) {
      const sender =
        pc
          .getSenders()
          .find(
            (s) =>
              s.track?.kind ===
              "video"
          );

      if (sender) {
        await sender.replaceTrack(
          newTrack
        );
      }
    }
  };

  // =========================================================
  // ADMIT
  // =========================================================

  const admitUser = async () => {
    if (!joinRequest) return;

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

      if (response.data?.success) {
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

        setJoinRequest(null);

        await loadMeeting();
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

  // =========================================================
  // DENY
  // =========================================================

  const denyUser = async () => {
    if (!joinRequest) return;

    try {
      const response =
        await api.post(
          `/meetings/${meetingId}/deny`,
          {
            userId:
              joinRequest.userId,
          }
        );

      if (response.data?.success) {
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

        setJoinRequest(null);
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

  // =========================================================
  // END MEETING
  // =========================================================

  const endMeeting = async () => {
    const confirmed =
      window.confirm(
        "Are you sure you want to end this meeting?"
      );

    if (!confirmed) return;

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

      cleanup();

      navigate("/dashboard", {
        replace: true,
      });
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

  // =========================================================
  // CLEANUP
  // =========================================================

  const cleanup = () => {
    if (socket.connected) {
      socket.emit("leave-room", {
        meetingId,
        userId:
          user?._id || user?.id,
      });
    }

    Object.values(
      peerConnectionsRef.current
    ).forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });

    peerConnectionsRef.current = {};

    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop()
        );
    }
  };

  const leaveMeeting = () => {
    cleanup();

    navigate("/dashboard", {
      replace: true,
    });
  };

  // =========================================================
  // MEETING ENDED
  // =========================================================

  useEffect(() => {
    const handleMeetingEnded = (
      data
    ) => {
      alert(
        data?.message ||
          "The host ended the meeting."
      );

      cleanup();

      navigate("/dashboard", {
        replace: true,
      });
    };

    socket.on(
      "meeting-ended",
      handleMeetingEnded
    );

    return () => {
      socket.off(
        "meeting-ended",
        handleMeetingEnded
      );
    };
  }, [meetingId]);

  // =========================================================
  // REMOTE VIDEO ATTACH
  // =========================================================

  useEffect(() => {
    remoteStreams.forEach(
      (item) => {
        const video =
          remoteVideoRefs.current[
            item.socketId
          ];

        if (
          video &&
          video.srcObject !==
            item.stream
        ) {
          video.srcObject =
            item.stream;

          video
            .play()
            .catch(() => {});
        }
      }
    );
  }, [remoteStreams]);

  // =========================================================
  // LOADING
  // =========================================================

  if (loading || !meeting) {
    return (
      <div className="meeting-loading">
        <div className="meeting-loader"></div>
        <p>Loading meeting...</p>
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="meeting-page">

      {/* HEADER */}
      <header className="meeting-header">

        <div className="meeting-title">
          <div className="meeting-logo">
            VC
          </div>

          <div>
            <h2>Meeting Room</h2>

            <span>
              {meetingId}
            </span>
          </div>
        </div>

        <div className="meeting-header-right">
          <div className="participant-count">
            👥 {participantCount}
          </div>
        </div>

      </header>

      {/* JOIN REQUEST */}
      {isHost && joinRequest && (
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
                {joinRequest.name ||
                  "Someone"}
              </strong>{" "}
              wants to join this
              meeting.
            </p>

            {joinRequest.email && (
              <small>
                {joinRequest.email}
              </small>
            )}

            <div className="join-popup-actions">

              <button
                className="popup-deny-btn"
                onClick={denyUser}
              >
                Deny
              </button>

              <button
                className="popup-admit-btn"
                onClick={admitUser}
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

          {/* LOCAL */}
          <div className="video-card local-video-card">

            <video
              ref={localVideoRef}
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
              {user?.name || "You"}{" "}
              (You)
            </div>

          </div>

          {/* REMOTE */}
          {remoteStreams.map(
            (participant) => (
              <div
                className="video-card"
                key={
                  participant.socketId
                }
              >

                <video
                  ref={(element) => {
                    if (element) {
                      remoteVideoRefs.current[
                        participant.socketId
                      ] = element;
                    }
                  }}
                  autoPlay
                  playsInline
                />

                <div className="video-name">
                  {participant.userName ||
                    "Participant"}
                </div>

              </div>
            )
          )}

        </div>

      </main>

      {/* CHAT */}
      <aside
        className={`chat-drawer ${
          chatOpen ? "open" : ""
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
              setChatOpen(false)
            }
          >
            ✕
          </button>

        </div>

        <div className="chat-messages">

          {messages.length === 0 ? (
            <div className="empty-chat">
              <div>💬</div>
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
                      {msg.userName ||
                        "User"}
                    </div>

                    {msg.type ===
                    "file" ? (
                      <a
                        className="chat-file"
                        href={`https://real-time-communication-app-1-dniy.onrender.com/${msg.fileUrl}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        📎{" "}
                        {msg.fileName}
                      </a>
                    ) : (
                      <div className="chat-text">
                        {msg.message}
                      </div>
                    )}

                    <div className="chat-time">
                      {msg.time
                        ? new Date(
                            msg.time
                          ).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
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
          onSubmit={sendMessage}
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
        ref={fileInputRef}
        type="file"
        hidden
        onChange={
          handleFileSelect
        }
      />

      {/* WHITEBOARD */}
      {whiteboardOpen && (
        <Whiteboard
          meetingId={meetingId}
          onClose={() =>
            setWhiteboardOpen(false)
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
            onClick={toggleMic}
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
            onClick={toggleCamera}
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
                (prev) => !prev
              )
            }
            title="Chat"
          >
            💬

            {messages.length > 0 && (
              <span className="message-badge">
                {messages.length}
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
                (prev) => !prev
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