# UPLIFT — Deployment Guide

This guide outlines the steps, environment variables, and configuration adjustments needed to deploy the **UPLIFT** application (React frontend and Node/Express/Socket.io backend) to production.

---

## 1. Backend Deployment

The backend runs on **Node.js**, **Express**, and **Socket.io**, and connects to a **MongoDB** database.
Recommended platforms: **Render**, **Fly.io**, or **Heroku**.

### A. Database Hosting
In production, you cannot use a local MongoDB instance (`mongodb://localhost:27017`).
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database).
2. Obtain your MongoDB Connection String (e.g., `mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/uplift?retryWrites=true&w=majority`).
3. Safely store this connection string to use as the `MONGO_URI` environment variable.

### B. Environment Variables to Configure
When setting up your backend application in your hosting dashboard, add these environment variables:

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Sets production mode | `production` |
| `PORT` | The port the server binds to | `5000` (or assigned automatically by host) |
| `MONGO_URI` | Your production MongoDB Atlas string | `mongodb+srv://...` |
| `ALLOWED_ORIGIN` | The exact URL of your deployed frontend | `https://uplift-app.vercel.app` |
| `SMTP_USER` | Gmail address for OTP password resets (Optional) | `your-email@gmail.com` |
| `SMTP_PASS` | Gmail App Password (not your account password) | `xxxx xxxx xxxx xxxx` |

---

## 2. Frontend Deployment

The frontend is a **Create React App** project that compiles to static assets.
Recommended platforms: **Vercel**, **Netlify**, or **Render Static Site**.

### A. Environment Variables to Configure
During the frontend build settings setup in your hosting dashboard, define these variables:

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `REACT_APP_API` | The production URL of your backend API endpoints | `https://uplift-backend.onrender.com/api` |
| `REACT_APP_SOCKET_URL` | The production URL of your backend (no `/api` path) | `https://uplift-backend.onrender.com` |

> **Note:** Create React App requires frontend environment variables to be prefixed with `REACT_APP_`. These variables are baked into the compiled static files during build time. If you update them, you must trigger a re-build.

### B. Build Commands and Settings
- **Build Command:** `npm run build`
- **Output/Publish Directory:** `build`
- **Single Page App Routing Redirects (Crucial):**
  Since React Router handles paths on the client side, you must configure your host to redirect all non-file requests to `index.html`:
  - **Vercel:** Handled automatically.
  - **Netlify:** Create a file named `_redirects` inside the `public` folder containing:
    ```text
    /*   /index.html   200
    ```
  - **Render:** Set up a redirect rule: Source: `/*`, Destination: `/index.html`, Action: `Rewrite`.

---

## 3. Production Optimizations Already Added

We have already updated [server.js](file:///c:/Users/167be/Desktop/uplift-project/uplift-backend/server.js) to support dynamic production routing. The backend now reads the allowed CORS origin dynamically:
```javascript
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
```
This ensures Socket.io and standard API endpoints accept requests securely from your deployed frontend.

---

## 4. Verification Check
Before deploying:
1. Ensure all code changes are pushed to your remote repository (e.g. GitHub).
2. Connect your GitHub repository to your Vercel/Render accounts for automatic git-push deployments.
3. Test your build command locally by running `npm run build` in the `uplift-frontend` directory to verify there are no errors.
