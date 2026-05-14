import { initializeApp, getApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));

async function setupSystemUser() {
  try {
    if (getApps().length === 0) {
      initializeApp({ projectId: firebaseConfig.projectId });
    }
    const auth = getAuth();
    const email = "system-server@servicehub.com";
    const password = "SystemServerPassword123!"; // Should be a secret in .env in real app
    
    try {
      const user = await auth.getUserByEmail(email);
      console.log("System user already exists:", user.uid);
    } catch (e) {
      const user = await auth.createUser({
        email,
        password,
        displayName: "System Server"
      });
      console.log("System user created:", user.uid);
    }
  } catch (e: any) {
    console.log("Setup failed:", e.message);
  }
}
setupSystemUser();
