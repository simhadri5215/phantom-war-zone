import {
  auth, db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setDoc, doc,
  collection, query, where, getDocs
} from "./firebase-config.js";

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function createReferralCode(user) {
  const emailName = user.email.split("@")[0].replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `${emailName.slice(0, 5)}${user.uid.slice(0, 5).toUpperCase()}`;
}

// ── SIGNUP ──────────────────────────────────────────────
window.signup = async function () {
  // Supports both old single-form IDs and new tabbed IDs
  const emailEl    = document.getElementById("signupEmail")    || document.getElementById("email");
  const passwordEl = document.getElementById("signupPassword") || document.getElementById("password");
  const referralEl = document.getElementById("referralCode");

  const email        = emailEl?.value.trim();
  const password     = passwordEl?.value.trim();
  const referralCode = referralEl?.value.trim().toUpperCase() || "";

  if (!email)    { showToast("❌ Enter your email");    return; }
  if (!password) { showToast("❌ Enter a password");   return; }
  if (password.length < 6) { showToast("❌ Password must be at least 6 characters"); return; }

  try {
    let referredByUid   = "";
    let referredByEmail = "";

    // VALIDATE REFERRAL CODE
    if (referralCode) {
      const referralSnap = await getDocs(
        query(collection(db, "users"), where("referralCode", "==", referralCode))
      );
      if (referralSnap.empty) {
        showToast("❌ Invalid Referral Code");
        return;
      }
      referredByUid   = referralSnap.docs[0].id;
      referredByEmail = referralSnap.docs[0].data().email || "";
    }

    // CREATE USER IN FIREBASE AUTH
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user           = userCredential.user;
    const myReferralCode = createReferralCode(user);

    // SAVE USER TO FIRESTORE
    await setDoc(doc(db, "users", user.uid), {
      email,
      wallet:              0,
      referralCode:        myReferralCode,
      referredByUid,
      referredByEmail,
      referralBonusPaid:   false,
      referralBonusAmount: 0,
      createdAt:           Date.now()
    });

    showToast("✅ Signup successful! Logging you in...");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1200);

  } catch (error) {
    // Friendly error messages
    if (error.code === "auth/email-already-in-use") {
      showToast("❌ Email already registered. Please login.");
    } else if (error.code === "auth/invalid-email") {
      showToast("❌ Invalid email address.");
    } else if (error.code === "auth/weak-password") {
      showToast("❌ Password too weak. Use at least 6 characters.");
    } else {
      showToast("❌ " + error.message);
    }
  }
};

// ── LOGIN ────────────────────────────────────────────────
window.login = async function () {
  const emailEl    = document.getElementById("loginEmail")    || document.getElementById("email");
  const passwordEl = document.getElementById("loginPassword") || document.getElementById("password");

  const email    = emailEl?.value.trim();
  const password = passwordEl?.value.trim();

  if (!email)    { showToast("❌ Enter your email");    return; }
  if (!password) { showToast("❌ Enter your password"); return; }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user           = userCredential.user;

    // CHECK IF ADMIN
    const adminSnap = await getDocs(
      query(collection(db, "admins"), where("email", "==", user.email))
    );

    if (!adminSnap.empty) {
      window.location.href = "admin.html";
    } else {
      window.location.href = "dashboard.html";
    }

  } catch (error) {
    if (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential") {
      showToast("❌ Email not registered. Please sign up first.");
    } else if (error.code === "auth/wrong-password") {
      showToast("❌ Wrong password. Try again.");
    } else if (error.code === "auth/invalid-email") {
      showToast("❌ Invalid email address.");
    } else if (error.code === "auth/too-many-requests") {
      showToast("❌ Too many attempts. Try again later.");
    } else {
      showToast("❌ " + error.message);
    }
  }
};

// ── FORGOT PASSWORD ──────────────────────────────────────
window.forgotPassword = async function () {
  const emailEl = document.getElementById("loginEmail") || document.getElementById("email");
  let email     = emailEl?.value.trim();
  if (!email)   email = prompt("Enter your registered email:");
  if (!email)   return;

  try {
    await sendPasswordResetEmail(auth, email);
    showToast("✅ Password reset email sent! Check your inbox.");
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      showToast("❌ No account found with this email.");
    } else {
      showToast("❌ " + error.message);
    }
  }
};