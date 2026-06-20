import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  await addDoc(collection(db, "test"), { hello: "world" });
  console.log("Added doc");
  const snapshot = await getDocs(collection(db, "test"));
  snapshot.forEach(doc => console.log(doc.id, "=>", doc.data()));
  process.exit(0);
}
test().catch(e => {
  console.error(e);
  process.exit(1);
});
