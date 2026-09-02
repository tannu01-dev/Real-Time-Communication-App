import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
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
  const [participants, setParticipants] = useState([]);
  const [participantsOpen, setParticipantsOpen] = useState(false);

  // IMPORTANT:
  // Count is ALWAYS derived from participants.
  // No separate participantCount state.
  const participantCount = participants.length;

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

  // ================= SOCKET =================
  const socketJoinedRef = useRef(false);

  // =========================================================
  // GET USER ID
  // =========================================================

  const getUserId = useCallback(() => {
    return (
      user?._id ||
      user?.id
    )?.toString();
  }, [user]);

  // =========================================================
  // GET PARTICIPANT ID
  // =========================================================

  const getParticipantId = useCallback((participant) => {
    if (!participant) return null;

    if (typeof participant === "string") {
      return participant.toString();
    }

    return (
      participant?._id ||
      participant?.id ||
      participant?.user?._id ||
      participant?.user?.id ||
      participant?.userId
    )?.toString();
  }, []);

  // =========================================================
  // GET PARTICIPANT NAME
  // =========================================================

  const getParticipantName = useCallback((participant) => {
    if (!participant) {
      return "Participant";
    }

    if (typeof participant === "string") {
      return "Participant";
    }

    return (
      participant?.name ||
      participant?.userName ||
      participant?.username ||
      participant?.user?.name ||
      participant?.user?.username ||
      "Participant"
    );
  }, []);

  // =========================================================
  // GET USER
  // =========================================================

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    if (!storedUser) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    try {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
    } catch (error) {
      console.error(
        "USER PARSE ERROR:",
        error
      );

      navigate("/login", {
        replace: true,
      });
    }
  }, [navigate]);

  // =========================================================
  // LOAD MEETING
  // =========================================================

  const loadMeeting = useCallback(async () => {
    if (!meetingId) {
      return null;
    }

    try {
      const response = await api.get(
        `/meetings/${meetingId}`
      );

      if (!response.data?.success) {
        throw new Error(
          "Meeting not found"
        );
      }

      const data =
        response.data.meeting;

      console.log(
        "📋 MEETING DATA:",
        data
      );

      setMeeting(data);

      return data;
    } catch (error) {
      console.error(
        "GET MEETING ERROR:",
        error.response?.data || error
      );

      alert(
        error.response?.data?.message ||
          "Unable to load meeting"
      );

      navigate("/dashboard", {
        replace: true,
      });

      return null;
    }
  }, [meetingId, navigate]);

  // =========================================================
  // INITIAL MEETING LOAD
  // =========================================================

  useEffect(() => {
    if (!meetingId || !user) {
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);

      try {
        const response = await api.get(
          `/meetings/${meetingId}`
        );

        if (!response.data?.success) {
          throw new Error(
            "Meeting not found"
          );
        }

        if (mounted) {
          console.log(
            "📋 INITIAL MEETING:",
            response.data.meeting
          );

          setMeeting(
            response.data.meeting
          );
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
  }, [
    meetingId,
    user,
    navigate,
  ]);

  // =========================================================
  // HOST CHECK
  // =========================================================

  useEffect(() => {
    if (!user || !meeting) {
      setIsHost(false);
      return;
    }

    const currentUserId = (
      user._id ||
      user.id
    )?.toString();

    const hostId = (
      typeof meeting.host === "object"
        ? meeting.host?._id ||
          meeting.host?.id
        : meeting.host
    )?.toString();

    const host =
      currentUserId === hostId;

    console.log(
      "========== HOST CHECK =========="
    );

    console.log(
      "Current User:",
      currentUserId
    );

    console.log(
      "Meeting Host:",
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
  }, [user, meeting]);

  // =========================================================
  // BUILD PARTICIPANT LIST
  // =========================================================

  useEffect(() => {
    if (!meeting || !user) {
      return;
    }

    const currentUserId = (
      user._id ||
      user.id
    )?.toString();

    const hostObject =
      typeof meeting.host === "object"
        ? meeting.host
        : null;

    const hostId = (
      hostObject?._id ||
      hostObject?.id ||
      meeting.host
    )?.toString();

    const meetingParticipants =
      Array.isArray(
        meeting.participants
      )
        ? meeting.participants
        : [];

    const list = [];

    // =======================================================
    // ADD HOST
    // =======================================================

    if (hostId) {
      let hostName =
        hostObject?.name ||
        hostObject?.username ||
        hostObject?.userName;

      if (hostId === currentUserId) {
        hostName =
          user?.name ||
          user?.username ||
          "You";
      }

      list.push({
        id: hostId,
        name: hostName || "Host",
        isHost: true,
        online: true,
        socketId: null,
      });
    }

    // =======================================================
    // ADD ADMITTED PARTICIPANTS
    // =======================================================

    meetingParticipants.forEach(
      (participant) => {
        const id =
          getParticipantId(
            participant
          );

        if (!id) {
          return;
        }

        // Host already exists in list.
        if (id === hostId) {
          return;
        }

        // Don't duplicate users.
        const exists =
          list.some(
            (item) =>
              item.id === id
          );

        if (exists) {
          return;
        }

        list.push({
          id,
          name:
            getParticipantName(
              participant
            ),
          isHost: false,
          online: true,
          socketId: null,
        });
      }
    );

    // =======================================================
    // IMPORTANT:
    // DO NOT BLINDLY ADD CURRENT USER.
    //
    // If current user is not host and not in
    // meeting.participants, they are waiting/pending.
    // They should NOT appear in participant list.
    // =======================================================

    console.log(
      "👥 ACTUAL PARTICIPANTS:",
      list
    );

    setParticipants(list);
  }, [
    meeting,
    user,
    getParticipantId,
    getParticipantName,
  ]);

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
          await navigator.mediaDevices.getUserMedia(
            {
              video: true,
              audio: true,
            }
          );

        if (!mounted) {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            );

          return;
        }

        localStreamRef.current =
          stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject =
            stream;

          try {
            await localVideoRef.current.play();
          } catch (error) {
            console.log(
              "VIDEO PLAY:",
              error
            );
          }
        }

        setCameraOn(
          stream
            .getVideoTracks()
            .some(
              (track) =>
                track.enabled
            )
        );

        setMicOn(
          stream
            .getAudioTracks()
            .some(
              (track) =>
                track.enabled
            )
        );

        console.log(
          "✅ CAMERA + MIC READY"
        );
      } catch (error) {
        console.error(
          "❌ MEDIA ERROR:",
          error
        );

        alert(
          "Camera/Microphone access nahi mila. Browser permissions check karo."
        );
      }
    };

    startMedia();

    return () => {
      mounted = false;

      if (
        localStreamRef.current
      ) {
        localStreamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }
    };
  }, []);

  // =========================================================
  // ADD REMOTE STREAM
  // =========================================================

  const addRemoteStream = useCallback(
    (
      socketId,
      stream,
      userName = "Participant"
    ) => {
      setRemoteStreams(
        (prev) => {
          const exists =
            prev.some(
              (item) =>
                item.socketId ===
                socketId
            );

          if (exists) {
            return prev.map(
              (item) =>
                item.socketId ===
                socketId
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
        }
      );
    },
    []
  );

  // =========================================================
  // REMOVE PEER
  // =========================================================

  const removePeer = useCallback(
    (socketId) => {
      const pc =
        peerConnectionsRef.current[
          socketId
        ];

      if (pc) {
        try {
          pc.close();
        } catch {}

        delete peerConnectionsRef.current[
          socketId
        ];
      }

      delete pendingCandidatesRef.current[
        socketId
      ];

      setRemoteStreams(
        (prev) =>
          prev.filter(
            (item) =>
              item.socketId !==
              socketId
          )
      );
    },
    []
  );

  // =========================================================
  // CREATE PEER CONNECTION
  // =========================================================

  const createPeerConnection =
    useCallback(
      (
        targetSocketId,
        userName = "Participant"
      ) => {
        if (
          peerConnectionsRef.current[
            targetSocketId
          ]
        ) {
          return peerConnectionsRef.current[
            targetSocketId
          ];
        }

        const pc =
          new RTCPeerConnection(
            ICE_SERVERS
          );

        peerConnectionsRef.current[
          targetSocketId
        ] = pc;

        pendingCandidatesRef.current[
          targetSocketId
        ] = [];

        if (
          localStreamRef.current
        ) {
          localStreamRef.current
            .getTracks()
            .forEach((track) => {
              pc.addTrack(
                track,
                localStreamRef.current
              );
            });
        }

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

        pc.onicecandidate = (
          event
        ) => {
          if (event.candidate) {
            socket.emit(
              "ice-candidate",
              {
                target:
                  targetSocketId,
                candidate:
                  event.candidate,
              }
            );
          }
        };

        pc.onconnectionstatechange =
          () => {
            console.log(
              `WEBRTC ${targetSocketId}:`,
              pc.connectionState
            );

            if (
              pc.connectionState ===
                "failed" ||
              pc.connectionState ===
                "closed" ||
              pc.connectionState ===
                "disconnected"
            ) {
              removePeer(
                targetSocketId
              );
            }
          };

        return pc;
      },
      [
        addRemoteStream,
        removePeer,
      ]
    );

  // =========================================================
  // CREATE OFFER
  // =========================================================

  const createOffer = useCallback(
    async (
      targetSocketId,
      userName
    ) => {
      try {
        const pc =
          createPeerConnection(
            targetSocketId,
            userName
          );

        const offer =
          await pc.createOffer();

        await pc.setLocalDescription(
          offer
        );

        socket.emit("offer", {
          target:
            targetSocketId,
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
    const handleOffer = async (
      data
    ) => {
      try {
        if (
          !data?.sender ||
          !data?.offer
        ) {
          return;
        }

        console.log(
          "📥 OFFER RECEIVED:",
          data.sender
        );

        const pc =
          createPeerConnection(
            data.sender,
            data.userName ||
              "Participant"
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

    const handleAnswer = async (
      data
    ) => {
      try {
        if (
          !data?.sender ||
          !data?.answer
        ) {
          return;
        }

        const pc =
          peerConnectionsRef.current[
            data.sender
          ];

        if (!pc) {
          return;
        }

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

    const handleIceCandidate =
      async (data) => {
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

      if (!data?.socketId) {
        return;
      }

      // WebRTC
      createOffer(
        data.socketId,
        data.userName ||
          data.name ||
          "Participant"
      );

      // =====================================================
      // PARTICIPANT LIST
      // =====================================================

      const joinedUserId = (
        data.userId ||
        data.id
      )?.toString();

      if (!joinedUserId) {
        return;
      }

      setParticipants(
        (prev) => {
          // Already exists by USER ID
          const existsById =
            prev.some(
              (participant) =>
                participant.id ===
                joinedUserId
            );

          // Already exists by SOCKET ID
          const existsBySocket =
            prev.some(
              (participant) =>
                participant.socketId ===
                data.socketId
            );

          if (
            existsById ||
            existsBySocket
          ) {
            return prev;
          }

          const currentId =
            getUserId();

          // Current user should never
          // be inserted twice.
          if (
            joinedUserId ===
            currentId
          ) {
            return prev;
          }

          const hostId = (
            typeof meeting?.host ===
            "object"
              ? meeting?.host?._id
              : meeting?.host
          )?.toString();

          return [
            ...prev,
            {
              id: joinedUserId,
              socketId:
                data.socketId,
              name:
                data.userName ||
                data.name ||
                "Participant",
              isHost:
                joinedUserId ===
                hostId ||
                Boolean(data.isHost),
              online: true,
            },
          ];
        }
      );
    };

    const handleUserLeft = (
      data
    ) => {
      if (!data?.socketId) {
        return;
      }

      console.log(
        "👋 USER LEFT:",
        data
      );

      removePeer(
        data.socketId
      );

      const leftUserId =
        data?.userId?.toString();

      setParticipants(
        (prev) =>
          prev.filter(
            (participant) => {
              const sameSocket =
                participant.socketId ===
                data.socketId;

              const sameUser =
                leftUserId &&
                participant.id ===
                  leftUserId;

              return (
                !sameSocket &&
                !sameUser
              );
            }
          )
      );
    };

    socket.on(
      "offer",
      handleOffer
    );

    socket.on(
      "answer",
      handleAnswer
    );

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
      socket.off(
        "offer",
        handleOffer
      );

      socket.off(
        "answer",
        handleAnswer
      );

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
  }, [
    createOffer,
    createPeerConnection,
    removePeer,
    getUserId,
    meeting,
  ]);

  // =========================================================
  // SOCKET CONNECTION + JOIN ROOM
  // =========================================================

  useEffect(() => {
    if (
      !meetingId ||
      !user ||
      !meeting ||
      loading
    ) {
      return;
    }

    const currentUserId = (
      user._id ||
      user.id
    )?.toString();

    if (!currentUserId) {
      console.error(
        "❌ USER ID NOT FOUND"
      );

      return;
    }

    const hostId = (
      typeof meeting.host ===
      "object"
        ? meeting.host?._id
        : meeting.host
    )?.toString();

    const userIsHost =
      currentUserId === hostId;

    const isParticipant =
      Array.isArray(
        meeting.participants
      ) &&
      meeting.participants.some(
        (participant) => {
          const id = (
            participant?._id ||
            participant?.id ||
            participant
          )?.toString();

          return (
            id === currentUserId
          );
        }
      );

    console.log(
      "================================="
    );

    console.log(
      "🔌 SOCKET MEETING CHECK"
    );

    console.log(
      "Meeting:",
      meetingId
    );

    console.log(
      "Current User:",
      currentUserId
    );

    console.log(
      "Host:",
      hostId
    );

    console.log(
      "Is Host:",
      userIsHost
    );

    console.log(
      "Is Participant:",
      isParticipant
    );

    console.log(
      "================================="
    );

    // =======================================================
    // NOT ADMITTED
    // =======================================================

    if (
      !userIsHost &&
      !isParticipant
    ) {
      if (
        !joinRequestedRef.current
      ) {
        joinRequestedRef.current =
          true;

        api
          .post(
            "/meetings/join",
            {
              meetingId,
            }
          )
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

            joinRequestedRef.current =
              false;
          });
      }

      return;
    }

    // =======================================================
    // JOIN SOCKET
    // =======================================================

    const joinSocketRoom = () => {
      if (!socket.connected) {
        console.log(
          "❌ SOCKET NOT CONNECTED"
        );

        return;
      }

      if (
        socketJoinedRef.current
      ) {
        console.log(
          "⚠️ SOCKET ALREADY JOINED"
        );

        return;
      }

      console.log(
        "================================="
      );

      console.log(
        "🟢 SOCKET READY"
      );

      console.log(
        "Socket ID:",
        socket.id
      );

      console.log(
        "User ID:",
        currentUserId
      );

      console.log(
        "Meeting ID:",
        meetingId
      );

      console.log(
        "Is Host:",
        userIsHost
      );

      console.log(
        "================================="
      );

      // =====================================================
      // REGISTER USER
      // =====================================================

      socket.emit(
        "register-user",
        {
          userId:
            currentUserId,
          userName:
            user.name ||
            user.username ||
            "User",
        }
      );

      console.log(
        "✅ REGISTER-USER SENT:",
        currentUserId
      );

      // =====================================================
      // HOST
      // =====================================================

      if (userIsHost) {
        console.log(
          "👑 HOST ENTERING MEETING"
        );

        socket.emit(
          "host-join-room",
          {
            meetingId,
            userId:
              currentUserId,
            userName:
              user.name ||
              user.username ||
              "Host",
          }
        );

        console.log(
          "👑 HOST-JOIN-ROOM SENT:",
          meetingId
        );
      }

      // =====================================================
      // PARTICIPANT
      // =====================================================

      else {
        socket.emit(
          "join-room",
          {
            meetingId,
            userId:
              currentUserId,
            userName:
              user.name ||
              user.username ||
              "User",
          }
        );

        console.log(
          "🚪 JOIN-ROOM SENT:",
          meetingId
        );
      }

      socketJoinedRef.current =
        true;
    };

    // =======================================================
    // SOCKET CONNECT
    // =======================================================

    const handleSocketConnect =
      () => {
        console.log(
          "🟢 SOCKET CONNECT:",
          socket.id
        );

        joinSocketRoom();
      };

    if (!socket.connected) {
      console.log(
        "🔄 CONNECTING SOCKET..."
      );

      socket.once(
        "connect",
        handleSocketConnect
      );

      socket.connect();
    } else {
      joinSocketRoom();
    }

    return () => {
      socket.off(
        "connect",
        handleSocketConnect
      );
    };
  }, [
    meetingId,
    user,
    meeting,
    loading,
  ]);

  // =========================================================
  // HOST JOIN REQUEST
  // =========================================================

  useEffect(() => {
    if (
      !isHost ||
      !meetingId ||
      !user
    ) {
      return;
    }

    const handleJoinRequest = (
      data
    ) => {
      console.log(
        "🔔 JOIN REQUEST RECEIVED BY HOST:",
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

    return () => {
      socket.off(
        "join-request",
        handleJoinRequest
      );
    };
  }, [
    isHost,
    meetingId,
    user,
  ]);

  // =========================================================
  // PARTICIPANT ADMITTED / DENIED
  // =========================================================

  useEffect(() => {
    const handleAdmitted =
      async (data) => {
        if (
          data?.meetingId?.toString() !==
          meetingId?.toString()
        ) {
          return;
        }

        const myId = (
          user?._id ||
          user?.id
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

        joinRequestedRef.current =
          false;

        socketJoinedRef.current =
          false;

        const updatedMeeting =
          await loadMeeting();

        if (updatedMeeting) {
          setMeeting(
            updatedMeeting
          );
        }
      };

    const handleDenied = (
      data
    ) => {
      if (
        data?.meetingId?.toString() !==
        meetingId?.toString()
      ) {
        return;
      }

      const myId = (
        user?._id ||
        user?.id
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
  // IMPORTANT:
  // NO participant-count SOCKET LISTENER HERE.
  //
  // participantCount is calculated from:
  //
  // participants.length
  //
  // So count and list can NEVER disagree.
  // =========================================================

  // =========================================================
  // CHAT RECEIVE
  // =========================================================

  useEffect(() => {
    const receiveMessage = (
      data
    ) => {
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

  // =========================================================
  // SEND MESSAGE
  // =========================================================

  const sendMessage = (e) => {
    e.preventDefault();

    if (!message.trim()) {
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
          user?.username ||
          "User",
        message:
          message.trim(),
      }
    );

    setMessage("");
  };

  // =========================================================
  // RECEIVE FILE
  // =========================================================

  useEffect(() => {
    const receiveFile = (
      data
    ) => {
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

  // =========================================================
  // UPLOAD FILE
  // =========================================================

  const uploadFile = async (
    file
  ) => {
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
              user?.username ||
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
        error.response?.data?.message ||
          "File upload failed"
      );
    }
  };

  // =========================================================
  // FILE SELECT
  // =========================================================

  const handleFileSelect = async (
    e
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    await uploadFile(file);

    e.target.value = "";
  };

  // =========================================================
  // MIC
  // =========================================================

  const toggleMic = () => {
    const stream =
      localStreamRef.current;

    if (!stream) {
      return;
    }

    const track =
      stream.getAudioTracks()[0];

    if (!track) {
      return;
    }

    track.enabled =
      !track.enabled;

    setMicOn(
      track.enabled
    );
  };

  // =========================================================
  // CAMERA
  // =========================================================

  const toggleCamera = () => {
    const stream =
      localStreamRef.current;

    if (!stream) {
      return;
    }

    const track =
      stream.getVideoTracks()[0];

    if (!track) {
      return;
    }

    track.enabled =
      !track.enabled;

    setCameraOn(
      track.enabled
    );
  };

  // =========================================================
  // REPLACE VIDEO TRACK
  // =========================================================

  const replaceVideoTrack =
    async (newTrack) => {
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

          if (
            localStreamRef.current
          ) {
            localStreamRef.current
              .getTracks()
              .forEach(
                (track) => {
                  if (
                    track.kind ===
                    "video"
                  ) {
                    track.stop();
                  }
                }
              );
          }

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

        if (
          localVideoRef.current
        ) {
          localVideoRef.current.srcObject =
            combined;
        }

        setScreenSharing(true);

        screenTrack.onended =
          () => {
            toggleScreenShare();
          };
      } catch (error) {
        console.error(
          "SCREEN SHARE ERROR:",
          error
        );
      }
    };

  // =========================================================
  // ADMIT USER
  // =========================================================

  const admitUser = async () => {
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

        setJoinRequest(null);

        const updatedMeeting =
          await loadMeeting();

        if (updatedMeeting) {
          setMeeting(
            updatedMeeting
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
        error.response?.data?.message ||
          "Unable to admit user"
      );
    }
  };

  // =========================================================
  // DENY USER
  // =========================================================

  const denyUser = async () => {
    if (!joinRequest) {
      return;
    }

    try {
      const response =
        await api.post(
          `/meetings/${meetingId}/deny`,
          {
            userId:
              joinRequest.userId,
          }
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

        setJoinRequest(null);
      }
    } catch (error) {
      console.error(
        "DENY ERROR:",
        error.response?.data ||
          error
      );

      alert(
        error.response?.data?.message ||
          "Unable to deny user"
      );
    }
  };

  // =========================================================
  // CLEANUP
  // =========================================================

  const cleanup = () => {
    if (socket.connected) {
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

    socketJoinedRef.current =
      false;

    Object.values(
      peerConnectionsRef.current
    ).forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });

    peerConnectionsRef.current = {};

    pendingCandidatesRef.current = {};

    setRemoteStreams([]);

    if (
      localStreamRef.current
    ) {
      localStreamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      localStreamRef.current =
        null;
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
        error.response?.data?.message ||
          "Unable to end meeting"
      );
    }
  };

  // =========================================================
  // LEAVE MEETING
  // =========================================================

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

        <p>
          Loading meeting...
        </p>
      </div>
    );
  }

  // =========================================================
  // CURRENT USER ID
  // =========================================================

  const currentUserId = (
    user?._id ||
    user?.id
  )?.toString();

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="meeting-page">

      {/* =====================================================
          HEADER
      ====================================================== */}

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

          {/* PARTICIPANTS */}

          <button
            type="button"
            className="participant-count"
            onClick={() =>
              setParticipantsOpen(
                (prev) => !prev
              )
            }
            style={{
              cursor: "pointer",
              border: "none",
              padding:
                "10px 15px",
              borderRadius:
                "10px",
              fontSize: "15px",
            }}
            title="View participants"
          >
            👥 {participantCount}
          </button>

        </div>

      </header>

      {/* =====================================================
          PARTICIPANTS PANEL
      ====================================================== */}

      {participantsOpen && (
        <div
          style={{
            position: "fixed",
            top: "75px",
            right: "20px",
            width: "320px",
            maxHeight: "450px",
            overflowY: "auto",
            background:
              "#ffffff",
            borderRadius:
              "16px",
            boxShadow:
              "0 15px 45px rgba(0,0,0,0.25)",
            zIndex: 9999,
            padding: "18px",
            color: "#111",
          }}
        >

          {/* PANEL HEADER */}

          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom:
                "15px",
            }}
          >

            <div>

              <h3
                style={{
                  margin: 0,
                  fontSize:
                    "18px",
                }}
              >
                👥 Participants
              </h3>

              <span
                style={{
                  fontSize:
                    "13px",
                  color:
                    "#777",
                }}
              >
                {participantCount}{" "}
                {participantCount ===
                1
                  ? "person"
                  : "people"}{" "}
                in meeting
              </span>

            </div>

            <button
              type="button"
              onClick={() =>
                setParticipantsOpen(
                  false
                )
              }
              style={{
                border:
                  "none",
                background:
                  "transparent",
                fontSize:
                  "20px",
                cursor:
                  "pointer",
              }}
            >
              ✕
            </button>

          </div>

          {/* =================================================
              PARTICIPANT LIST
          ================================================== */}

          {participants.length ===
          0 ? (
            <div
              style={{
                textAlign:
                  "center",
                padding:
                  "25px 10px",
                color:
                  "#777",
              }}
            >
              No participants
              in meeting.
            </div>
          ) : (
            <div>

              {participants.map(
                (
                  participant,
                  index
                ) => {

                  const participantId =
                    participant.id?.toString();

                  const isCurrentUser =
                    participantId ===
                    currentUserId;

                  return (
                    <div
                      key={
                        participantId ||
                        participant.socketId ||
                        index
                      }
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap:
                          "12px",
                        padding:
                          "12px 6px",
                        borderBottom:
                          "1px solid #eeeeee",
                      }}
                    >

                      {/* AVATAR */}

                      <div
                        style={{
                          width:
                            "40px",
                          height:
                            "40px",
                          minWidth:
                            "40px",
                          borderRadius:
                            "50%",
                          background:
                            "linear-gradient(135deg, #667eea, #764ba2)",
                          color:
                            "#fff",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          fontWeight:
                            "700",
                          fontSize:
                            "16px",
                        }}
                      >
                        {(
                          participant.name ||
                          "P"
                        )
                          .charAt(
                            0
                          )
                          .toUpperCase()}
                      </div>

                      {/* USER INFO */}

                      <div
                        style={{
                          flex: 1,
                          minWidth:
                            0,
                        }}
                      >

                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap:
                              "6px",
                            fontWeight:
                              "600",
                          }}
                        >

                          <span
                            style={{
                              overflow:
                                "hidden",
                              textOverflow:
                                "ellipsis",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {participant.name ||
                              "Participant"}
                          </span>

                          {isCurrentUser && (
                            <span
                              style={{
                                fontSize:
                                  "11px",
                                color:
                                  "#777",
                                fontWeight:
                                  "500",
                              }}
                            >
                              You
                            </span>
                          )}

                        </div>

                        <div
                          style={{
                            fontSize:
                              "12px",
                            color:
                              participant.isHost
                                ? "#6c63ff"
                                : "#777",
                            marginTop:
                              "3px",
                          }}
                        >
                          {participant.isHost
                            ? "👑 Host"
                            : "Participant"}
                        </div>

                      </div>

                      {/* ONLINE */}

                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap:
                            "5px",
                          fontSize:
                            "11px",
                          color:
                            "#16a34a",
                        }}
                      >

                        <span
                          style={{
                            width:
                              "8px",
                            height:
                              "8px",
                            borderRadius:
                              "50%",
                            background:
                              "#22c55e",
                            display:
                              "inline-block",
                          }}
                        ></span>

                        Online

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </div>
      )}

      {/* =====================================================
          JOIN REQUEST
      ====================================================== */}

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

      {/* =====================================================
          VIDEO
      ====================================================== */}

      <main className="meeting-main">

        <div className="video-grid">

          {/* LOCAL VIDEO */}

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
                user?.username ||
                "You"}{" "}
              (You)
            </div>

          </div>

          {/* REMOTE VIDEOS */}

          {remoteStreams.map(
            (
              participant
            ) => (
              <div
                className="video-card"
                key={
                  participant.socketId
                }
              >

                <video
                  ref={(
                    element
                  ) => {
                    if (
                      element
                    ) {
                      remoteVideoRefs.current[
                        participant.socketId
                      ] =
                        element;
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

      {/* =====================================================
          CHAT
      ====================================================== */}

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
              (
                msg,
                index
              ) => {

                const ownMessage =
                  msg.userId
                    ?.toString() ===
                  (
                    user?._id ||
                    user?.id
                  )?.toString();

                return (
                  <div
                    key={
                      index
                    }
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
                        href={`http://localhost:5000/${msg.fileUrl}`}
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
            value={
              message
            }
            onChange={(
              e
            ) =>
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

      {/* =====================================================
          FILE INPUT
      ====================================================== */}

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

      {/* =====================================================
          WHITEBOARD
      ====================================================== */}

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

      {/* =====================================================
          CONTROLS
      ====================================================== */}

      <footer className="meeting-controls-bar">

        <div className="control-group">

          {/* MIC */}

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

          {/* CAMERA */}

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

          {/* SCREEN SHARE */}

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

          {/* PARTICIPANTS */}

          <button
            className={`control-btn ${
              participantsOpen
                ? "screen-active"
                : ""
            }`}
            onClick={() =>
              setParticipantsOpen(
                (prev) =>
                  !prev
              )
            }
            title="Participants"
          >
            👥

            <span
              style={{
                fontSize:
                  "11px",
                marginLeft:
                  "2px",
              }}
            >
              {participantCount}
            </span>

          </button>

          {/* CHAT */}

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

          {/* FILE */}

          <button
            className="control-btn"
            onClick={() =>
              fileInputRef.current?.click()
            }
            title="Share file"
          >
            📎
          </button>

          {/* WHITEBOARD */}

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

        {/* RIGHT CONTROLS */}

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