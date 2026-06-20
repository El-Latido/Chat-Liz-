import admin from "firebase-admin";
import fs from "fs";
import { getFirestore } from "firebase-admin/firestore";

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

import { applicationDefault } from 'firebase-admin/app';

admin.initializeApp({
  credential: applicationDefault(),
  projectId: firebaseConfig.projectId
});

const db = getFirestore(undefined, firebaseConfig.firestoreDatabaseId);

async function test() {
  await db.collection('test').doc('test').set({ hello: 'world' });
  const doc = await db.collection('test').doc('test').get();
  console.log(doc.data());
}

test().catch(console.error);
