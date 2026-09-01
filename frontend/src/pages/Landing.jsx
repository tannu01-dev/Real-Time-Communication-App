import { Link } from "react-router-dom";
import "../styles/Landing.css";

const Landing = () => {
  return (
    <div className="landing-page">

      <nav className="navbar">
        <div className="logo">
          Connect<span>Hub</span>
        </div>

        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </div>
      </nav>

      <main className="hero">

        <div className="hero-content">

          <div className="badge">
            ⚡ Real-Time Communication
          </div>

          <h1>
            Connect.
            <br />
            Collaborate.
            <br />
            <span>Communicate.</span>
          </h1>

          <p>
            A powerful real-time communication platform for
            video meetings, screen sharing, file sharing and
            collaborative work.
          </p>

          <div className="hero-buttons">
            <Link to="/register" className="primary-btn">
              Get Started →
            </Link>

            <Link to="/login" className="secondary-btn">
              Login
            </Link>
          </div>

        </div>

        <div className="hero-card">

          <div className="window-top">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div className="video-preview">

            <div className="person">
              👩🏻‍💻
              <small>You</small>
            </div>

            <div className="person">
              👨🏻‍💻
              <small>Alex</small>
            </div>

            <div className="person">
              👩🏻‍💼
              <small>Sarah</small>
            </div>

            <div className="person">
              👨🏻‍🎨
              <small>John</small>
            </div>

          </div>

          <div className="call-controls">
            <button>🎤</button>
            <button>📹</button>
            <button>🖥️</button>
            <button>💬</button>
            <button className="end-call">📞</button>
          </div>

        </div>

      </main>

      <section className="features">

        <div className="feature">
          <div>🎥</div>
          <h3>HD Video Calls</h3>
          <p>Real-time multi-user video meetings.</p>
        </div>

        <div className="feature">
          <div>🖥️</div>
          <h3>Screen Sharing</h3>
          <p>Share your screen instantly with everyone.</p>
        </div>

        <div className="feature">
          <div>🎨</div>
          <h3>Collaborative</h3>
          <p>Work together using our live whiteboard.</p>
        </div>

        <div className="feature">
          <div>🔒</div>
          <h3>Secure</h3>
          <p>Authentication and protected communication.</p>
        </div>

      </section>

    </div>
  );
};

export default Landing;