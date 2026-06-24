import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import fs from "fs";
import path from "path";

let fdb: any = null;
let fStorage: any = null;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const appInfo = initializeApp(firebaseConfig);
    fdb = getFirestore(appInfo, firebaseConfig.firestoreDatabaseId || undefined);
    fStorage = getStorage(appInfo);
    console.log("Firebase initialized");
  }
} catch(e) {
  console.error("Firebase initialization failed:", e);
}

export { fdb, fStorage };
