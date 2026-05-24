import {
  auth, db,
  doc, getDoc, updateDoc,
  collection, getDocs, query, where,
  onAuthStateChanged, signOut
} from "./firebase-config.js";

let currentUser = null;
let userData    = null;
let userRef     = null;

function createReferralCode(user) {
  const emailName = user.email.split("@")[0].replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `${emailName.slice(0,5)}${user.uid.slice(0,5).toUpperCase()}`;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userRef     = doc(db, "users", user.uid);
    await loadProfile(user);
    initAvatarUpload();
  } else {
    window.location.href = "login.html";
  }
});

async function loadProfile(user) {
  // Basic info
  document.getElementById("profileEmail").innerText = user.email;
  document.getElementById("profileUid").innerText   = `UID: ${user.uid.slice(0,8)}`;

  // User document
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;
  userData = userSnap.data();

  // Ensure referral code exists
  if (!userData.referralCode) {
    userData.referralCode = createReferralCode(user);
    await updateDoc(userRef, {
      referralCode:        userData.referralCode,
      referralBonusPaid:   false,
      referralBonusAmount: 0
    });
  }

  // Fill UI
  document.getElementById("profileWallet").innerText      = `₹${userData.wallet || 0}`;
  document.getElementById("referralCodeText").innerText   = userData.referralCode;
  document.getElementById("referralBonusEarned").innerText = `₹${userData.referralBonusAmount || 0}`;
  document.getElementById("profileGameName").innerText    = `🎮 ${userData.gameName || "No game name set"}`;
  document.getElementById("editGameName").value           = userData.gameName || "";
  document.getElementById("editPhone").value              = userData.phone    || "";

  if (userData.avatarBase64) {
    document.getElementById("profileImage").src = userData.avatarBase64;
  }

  // ── MATCH STATS — query by userId (works with Firestore rules) ──
  try {
    const joinedSnap = await getDocs(query(
      collection(db, "joinedMatches"),
      where("userId", "==", user.uid)
    ));
    const myMatches = joinedSnap.docs.map(d => d.data());

    document.getElementById("matchesJoined").innerText =
      myMatches.length;
    document.getElementById("winsCount").innerText =
      myMatches.filter(m => m.position === 1).length;
    document.getElementById("booyahCount").innerText =
      myMatches.filter(m => m.booyah === true || m.booyah === "true").length;
    document.getElementById("totalKills").innerText =
      myMatches.reduce((s, m) => s + Number(m.kills || 0), 0);
  } catch(e) {
    console.warn("joinedMatches read error:", e.message);
  }

  // ── TOTAL EARNINGS — query by userId ──
  try {
    const txSnap = await getDocs(query(
      collection(db, "transactions"),
      where("userId", "==", user.uid)
    ));
    const earned = txSnap.docs
      .map(d => d.data())
      .filter(tx => tx.type === "credit")
      .reduce((s, tx) => s + Number(tx.amount || 0), 0);
    document.getElementById("totalEarned").innerText = `₹${earned}`;
  } catch(e) {
    console.warn("transactions read error:", e.message);
  }
}

// SAVE PROFILE
window.saveProfile = async function () {
  if (!currentUser) return;
  const gameName = document.getElementById("editGameName").value.trim();
  const phone    = document.getElementById("editPhone").value.trim();
  if (!gameName) { showToast("❌ Enter your in-game name"); return; }
  try {
    await updateDoc(userRef, { gameName, phone });
    document.getElementById("profileGameName").innerText = `🎮 ${gameName}`;
    showToast("✅ Profile saved!");
  } catch(e) {
    showToast("Error: " + e.message);
  }
};

// AVATAR UPLOAD
function initAvatarUpload() {
  const fileInput = document.getElementById("avatarFile");
  if (!fileInput) return;
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) { showToast("❌ Image too large (max 500KB)"); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      try {
        await updateDoc(userRef, { avatarBase64: base64 });
        document.getElementById("profileImage").src = base64;
        showToast("✅ Avatar updated!");
      } catch(e) {
        showToast("Error: " + e.message);
      }
    };
    reader.readAsDataURL(file);
  });
}

// COPY REFERRAL
window.copyReferral = async function () {
  const code = document.getElementById("referralCodeText").innerText;
  await navigator.clipboard.writeText(code);
  showToast("✅ Referral code copied!");
};

// SHARE REFERRAL
window.shareReferral = function () {
  const code = document.getElementById("referralCodeText").innerText;
  const msg  = `🎮 Join Phantom Warzone and win real cash!\nUse my referral code: ${code}\nhttps://phantomwarzone.web.app/login.html`;
  if (navigator.share) {
    navigator.share({ title: "Phantom Warzone", text: msg });
  } else {
    navigator.clipboard.writeText(msg);
    showToast("✅ Share link copied!");
  }
};

// LOGOUT
window.logout = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};