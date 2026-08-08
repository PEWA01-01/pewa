import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK for backend administrative actions
let adminApp: ReturnType<typeof initializeApp> | null = null;
if (!getApps().length) {
  try {
    adminApp = initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || "pewa-1",
    });
    console.log("[Server] Firebase Admin SDK initialized with project ID:", process.env.VITE_FIREBASE_PROJECT_ID || "pewa-1");
  } catch (err) {
    console.warn("[Server] Firebase Admin SDK initialization note:", err);
  }
} else {
  adminApp = getApps()[0];
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Cloudinary & Server Config Status Route
  app.get("/api/config", (req, res) => {
    res.json({ status: "ok", message: "Backend is running!" });
  });

  // Admin API Route: Permanently delete Firebase Authentication user
  app.post("/api/admin/delete-user", async (req, res) => {
    const { uid } = req.body || {};
    if (!uid) {
      return res.status(400).json({ success: false, error: "Missing user UID" });
    }

    console.log(`[Server] Processing request to delete Firebase Auth user: ${uid}`);

    try {
      if (getApps().length > 0) {
        const adminAuth = getAuth();
        await adminAuth.deleteUser(uid);
        console.log(`[Server] Successfully deleted user ${uid} from Firebase Auth`);
        return res.json({ success: true, message: `Successfully deleted user ${uid} from Firebase Auth` });
      } else {
        console.warn(`[Server] Firebase Admin SDK not initialized, skipping Auth delete for ${uid}`);
        return res.json({ success: true, message: "Firebase Admin not initialized, skipped Auth delete" });
      }
    } catch (err: any) {
      console.warn(`[Server] Firebase Auth deleteUser note/error for ${uid}:`, err?.code, err?.message);
      if (err?.code === 'auth/user-not-found') {
        return res.json({ success: true, message: `User ${uid} not found in Firebase Auth (already removed)` });
      }
      return res.json({ success: false, error: err?.message || 'Failed to delete user from Firebase Auth' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
