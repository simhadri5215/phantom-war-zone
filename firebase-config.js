// Firebase imports
import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {

  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail

}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {

  getFirestore,

  collection,
  addDoc,
  getDocs,

  query,
  where,
  orderBy,

  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc

}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// FIREBASE CONFIG
const firebaseConfig = {

  apiKey:
  "AIzaSyCGS2Fm52jh_YnqPcNMTa7F0Je-__-Cw6k",

  authDomain:
  "phantom-warzone.firebaseapp.com",

  projectId:
  "phantom-warzone",

  storageBucket:
  "phantom-warzone.firebasestorage.app",

  messagingSenderId:
  "719399912176",

  appId:
  "1:719399912176:web:553e5f9926d21a7e5cb835"

};

// INITIALIZE
const app =
initializeApp(firebaseConfig);

// AUTH
const auth =
getAuth(app);

// DATABASE
const db =
getFirestore(app);

// EXPORTS
export {

  auth,
  db,

  collection,
  addDoc,
  getDocs,

  query,
  where,
  orderBy,

  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,

  onAuthStateChanged,
  signOut,

  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail

};