
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/Landing.css";

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      // IMPORTANT:
      // Remove old login session before new login
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      const response = await api.post(
        "/auth/login",
        {
          email: formData.email.trim(),
          password: formData.password,
        }
      );

      console.log(
        "LOGIN USER:",
        response.data.user
      );

      console.log(
        "LOGIN TOKEN:",
        response.data.token
      );

      if (
        !response.data.success ||
        !response.data.token
      ) {
        throw new Error(
          "Invalid login response"
        );
      }

      // Save NEW token
      localStorage.setItem(
        "token",
        response.data.token
      );

      // Save NEW user
      localStorage.setItem(
        "user",
        JSON.stringify(
          response.data.user
        )
      );

      navigate("/dashboard", {
        replace: true,
      });

    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      setError(
        error.response?.data?.message ||
          error.message ||
          "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-card">

        <Link
          to="/"
          className="auth-logo"
        >
          Connect<span>Hub</span>
        </Link>

        <h1>
          Welcome Back
        </h1>

        <p className="auth-subtitle">
          Login to continue to your
          meetings.
        </p>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
        >

          <div className="input-group">

            <label>
              Email
            </label>

            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
            />

          </div>

          <div className="input-group">

            <label>
              Password
            </label>

            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required
            />

          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Login"}
          </button>

        </form>

        <p className="auth-footer">
          Don't have an account?{" "}
          <Link to="/register">
            Create Account
          </Link>
        </p>

      </div>

    </div>
  );
};

export default Login;
