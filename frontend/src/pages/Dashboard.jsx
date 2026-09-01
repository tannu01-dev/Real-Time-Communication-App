import { useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";

import "../styles/dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();

  const user = JSON.parse(
    localStorage.getItem("user")
  );

  const [meetingId, setMeetingId] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [joinLoading, setJoinLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [createdMeeting, setCreatedMeeting] =
    useState(null);

  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login");
  };

  // ==========================================
  // CREATE MEETING
  // ==========================================

  const createMeeting = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.post(
          "/meetings/create"
        );

      console.log(
        "CREATE MEETING RESPONSE:",
        response.data
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.message ||
            "Unable to create meeting"
        );
      }

      setCreatedMeeting(
        response.data.meeting
      );

    } catch (error) {
      console.error(
        "CREATE MEETING ERROR:",
        error
      );

      setError(
        error.response?.data?.message ||
          error.message ||
          "Unable to create meeting"
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // JOIN MEETING
  // ==========================================

  const joinMeeting = async (e) => {
    e.preventDefault();

    const id = meetingId.trim();

    if (!id) {
      alert(
        "Please enter a meeting ID"
      );
      return;
    }

    try {
      setJoinLoading(true);
      setError("");

      console.log(
        "JOINING MEETING:",
        id
      );

      const response =
        await api.post(
          "/meetings/join",
          {
            meetingId: id,
          }
        );

      console.log(
        "JOIN MEETING RESPONSE:",
        response.data
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.message ||
            "Unable to join meeting"
        );
      }

      // ======================================
      // HOST
      // ======================================

      if (
        response.data.isHost === true
      ) {
        console.log(
          "👑 USER IS HOST"
        );

        navigate(
          `/meeting/${id}`
        );

        return;
      }

      // ======================================
      // ALREADY ADMITTED
      // ======================================

      if (
        response.data.admitted === true
      ) {
        console.log(
          "✅ USER ALREADY ADMITTED"
        );

        navigate(
          `/meeting/${id}`
        );

        return;
      }

      // ======================================
      // PENDING
      // ======================================

      if (
        response.data.pending === true
      ) {
        console.log(
          "⏳ USER IS WAITING"
        );

        navigate(
          `/meeting/${id}/waiting`
        );

        return;
      }

      alert(
        response.data.message ||
          "Unable to join meeting"
      );

    } catch (error) {
      console.error(
        "JOIN MEETING ERROR:",
        error
      );

      const message =
        error.response?.data?.message ||
        error.message ||
        "Unable to join meeting";

      setError(message);

      alert(message);

    } finally {
      setJoinLoading(false);
    }
  };

  // ==========================================
  // ENTER CREATED MEETING
  // ==========================================

  const enterCreatedMeeting = () => {
    if (
      !createdMeeting?.meetingId
    ) {
      return;
    }

    navigate(
      `/meeting/${createdMeeting.meetingId}`
    );
  };

  // ==========================================
  // COPY MEETING ID
  // ==========================================

  const copyMeetingId = async () => {
    if (
      !createdMeeting?.meetingId
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        createdMeeting.meetingId
      );

      alert(
        "Meeting ID copied!"
      );
    } catch (error) {
      console.error(
        "COPY ERROR:",
        error
      );
    }
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="dashboard-page">

      {/* ====================================
          NAVBAR
      ==================================== */}

      <nav className="dashboard-nav">

        <div className="logo">
          Connect<span>Hub</span>
        </div>

        <div className="dashboard-user">

          <div className="user-avatar">
            {user?.name
              ?.charAt(0)
              ?.toUpperCase() || "U"}
          </div>

          <span>
            {user?.name || "User"}
          </span>

          <button
            className="logout-btn"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </nav>

      {/* ====================================
          MAIN
      ==================================== */}

      <main className="dashboard-content">

        <div className="welcome-section">

          <p className="dashboard-label">
            YOUR WORKSPACE
          </p>

          <h1>
            Welcome back,{" "}
            <span>
              {user?.name || "User"}
            </span>{" "}
            👋
          </h1>

          <p>
            Start a meeting or join your
            team instantly.
          </p>

        </div>

        {/* ERROR */}

        {error && (
          <div className="dashboard-error">
            {error}
          </div>
        )}

        {/* ==================================
            MEETING ACTIONS
        ================================== */}

        <div className="meeting-actions">

          {/* ==================================
              CREATE
          ================================== */}

          <div className="meeting-card">

            <div className="meeting-icon create-icon">
              +
            </div>

            <h2>
              Create a Meeting
            </h2>

            <p>
              Start a new video meeting
              and invite others to
              collaborate.
            </p>

            <button
              className="primary-meeting-btn"
              onClick={
                createMeeting
              }
              disabled={loading}
            >
              {loading
                ? "Creating..."
                : "Create Meeting"}
            </button>

            {createdMeeting && (

              <div className="created-meeting">

                <p>
                  Meeting ID
                </p>

                <div className="meeting-id-box">

                  <strong>
                    {
                      createdMeeting.meetingId
                    }
                  </strong>

                  <button
                    type="button"
                    onClick={
                      copyMeetingId
                    }
                    title="Copy"
                  >
                    📋
                  </button>

                </div>

                <button
                  className="enter-meeting-btn"
                  onClick={
                    enterCreatedMeeting
                  }
                >
                  Enter Meeting →
                </button>

              </div>

            )}

          </div>

          {/* ==================================
              JOIN
          ================================== */}

          <div className="meeting-card">

            <div className="meeting-icon join-icon">
              ↗
            </div>

            <h2>
              Join a Meeting
            </h2>

            <p>
              Have a meeting ID? Enter
              it below to join an
              existing meeting.
            </p>

            <form
              onSubmit={
                joinMeeting
              }
            >

              <input
                type="text"
                placeholder="Enter meeting ID"
                value={meetingId}
                onChange={(e) =>
                  setMeetingId(
                    e.target.value
                  )
                }
                disabled={joinLoading}
              />

              <button
                type="submit"
                className="secondary-meeting-btn"
                disabled={joinLoading}
              >
                {joinLoading
                  ? "Checking..."
                  : "Join Meeting →"}
              </button>

            </form>

          </div>

        </div>

        {/* ==================================
            FEATURES
        ================================== */}

        <section className="dashboard-features">

          <div>
            <span>🎥</span>
            <h3>
              Video Calls
            </h3>
            <p>
              Crystal clear real-time
              communication.
            </p>
          </div>

          <div>
            <span>🖥️</span>
            <h3>
              Screen Share
            </h3>
            <p>
              Present your screen to
              participants.
            </p>
          </div>

          <div>
            <span>💬</span>
            <h3>
              Live Chat
            </h3>
            <p>
              Send messages during
              meetings.
            </p>
          </div>

          <div>
            <span>🎨</span>
            <h3>
              Whiteboard
            </h3>
            <p>
              Collaborate on a shared
              canvas.
            </p>
          </div>

        </section>

      </main>

    </div>
  );
};

export default Dashboard;