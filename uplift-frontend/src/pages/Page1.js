import React from "react";
import "./Page1.css"; // if you had CSS, place it in src/pages/Page1.css

function Page1() {
  return (
    <div>
  <div className="container">
    {/* Header */}
    <header>
      <img src="logo.png" alt="Website Logo" className="logo" />
      <h1>Welcome Back</h1>
      <p>Your journey towards self-upliftment begins here</p>
    </header>

    {/* Sign-In Form */}
    <main>
      <div className="signin-box">
        <h2>Sign In</h2>
        <p>Please enter your credentials to continue your journey</p>
        <form action="/signin" method="post">
          <div className="input-group">
            <label htmlFor="username">E-Mail</label>
            <input
              type="text"
              id="username"
              name="username"
              placeholder="Enter your E-Mail ID"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Enter your password"
              required
            />
          </div>

          <div className="remember-me">
            <input type="checkbox" id="remember" name="remember" />
            <label htmlFor="remember">Remember me on this device</label>
          </div>

          <button type="submit" className="signin-btn">Sign In</button>
        </form>

        <a href="/forgot-password" className="forgot-password">
          Forgot your password?
        </a>
        <p>
          New here? <a href="/signup">Create an Account</a>
        </p>
      </div>
    </main>

    {/* Footer */}
    <footer>
      <a href="/terms">Terms of Service</a> |{" "}
      <a href="/privacy">Privacy Policy</a>
      <p>&copy; 2024 YourWebsiteName. Uplifting you, one step at a time.</p>
    </footer>
  </div>
      <h1>Welcome to Uplift</h1>
      <p>This is Page 1, built from the old HTML version.</p>
    </div>
  );
}

export default Page1;
