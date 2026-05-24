import {
  auth,
  db,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onAuthStateChanged
} from "./firebase-config.js";

const matchesContainer = document.getElementById("allMatchCards");
const notificationsContainer   = document.getElementById("notificationsContainer");
const clearNotificationsBtn    = document.getElementById("clearNotificationsBtn");
const scrollAnnouncement       = document.getElementById("scrollAnnouncement");
const announcementTextDisplay  = document.getElementById("announcementTextDisplay");
const REFERRAL_BONUS = 10;

let currentUser  = null;
let joiningMatch = false; // 🔒 LOCK to prevent double-clicks

// AUTH CHECK
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const playerEmail = document.getElementById("playerEmail");
    if (playerEmail) playerEmail.innerText = user.email;
    await loadWallet(user);
    await loadNotifications(user);
    await loadScrollingAnnouncement();
    loadMatches();
  } else {
    window.location.href = "login.html";
  }
});

async function loadScrollingAnnouncement() {
  if (!scrollAnnouncement || !announcementTextDisplay) return;
  const snap = await getDocs(collection(db, "announcements"));
  const announcements = snap.docs
    .map(d => d.data())
    .filter(item => item.active !== false && item.message)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  if (announcements.length === 0) { scrollAnnouncement.style.display = "none"; return; }
  announcementTextDisplay.innerText = announcements[0].message;
  scrollAnnouncement.style.display = "block";
}

async function createNotification(user, title, message, type = "info") {
  await addDoc(collection(db, "notifications"), {
    userId: user.uid, userEmail: user.email,
    title, message, type, read: false,
    time: new Date().toLocaleString(), createdAt: Date.now()
  });
}

async function createNotificationByUserId(userId, userEmail, title, message, type = "info") {
  await addDoc(collection(db, "notifications"), {
    userId, userEmail, title, message, type, read: false,
    time: new Date().toLocaleString(), createdAt: Date.now()
  });
}

async function loadNotifications(user) {
  if (!notificationsContainer) return;
  const snap = await getDocs(
    query(collection(db, "notifications"), where("userId", "==", user.uid))
  );
  const notifications = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 5);

  // UPDATE BADGE
  const unread = notifications.filter(n => !n.read).length;
  const badge  = document.getElementById("notifBadge");
  if (badge) {
    badge.style.display = unread > 0 ? "flex" : "none";
    badge.innerText     = unread > 9 ? "9+" : unread;
  }

  if (notifications.length === 0) {
    notificationsContainer.innerHTML = `<p>No notifications yet.</p>`;
    return;
  }
  notificationsContainer.innerHTML = notifications.map(item => `
    <div class="notification-item ${item.read ? "read" : ""}">
      <strong>${item.title}</strong>
      <p>${item.message}</p>
      <small>${item.time || ""}</small>
    </div>
  `).join("");
}

if (clearNotificationsBtn) {
  clearNotificationsBtn.onclick = async () => {
    if (!currentUser) return;
    const snap = await getDocs(
      query(collection(db, "notifications"), where("userId", "==", currentUser.uid))
    );
    for (const item of snap.docs) await deleteDoc(doc(db, "notifications", item.id));
    await loadNotifications(currentUser);
    showToast("Notifications cleared");
  };
}

async function loadWallet(user) {
  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (userSnap.exists()) {
      document.getElementById("walletBalance").innerText =
        `₹${Number(userSnap.data().wallet || 0)}`;
    }
  } catch (error) { console.log(error); }
}

async function payReferralBonusIfEligible(user, userData, matchId, matchName, entry) {
  if (Number(entry) <= 0) return;
  if (!userData.referredByUid) return;
  if (userData.referralBonusPaid) return;
  const referrerSnap = await getDoc(doc(db, "users", userData.referredByUid));
  if (!referrerSnap.exists()) return;
  const referrerData = referrerSnap.data();
  await updateDoc(doc(db, "users", userData.referredByUid), {
    wallet: Number(referrerData.wallet || 0) + REFERRAL_BONUS
  });
  await updateDoc(doc(db, "users", user.uid), {
    referralBonusPaid: true,
    referralBonusAmount: REFERRAL_BONUS,
    referralFirstPaidMatchId: matchId,
    referralFirstPaidMatchName: matchName
  });
  await addDoc(collection(db, "transactions"), {
    userId: userData.referredByUid, type: "credit", amount: REFERRAL_BONUS,
    message: `Referral Bonus: ${user.email} joined ${matchName}`,
    time: new Date().toLocaleString(), createdAt: Date.now()
  });
  await createNotificationByUserId(
    userData.referredByUid, referrerData.email || "",
    "Referral Bonus Credited",
    `Rs.${REFERRAL_BONUS} credited because ${user.email} joined their first paid match.`,
    "wallet"
  );
}

function getCountdown(date) {
  const diff = date - new Date();
  if (diff <= -60 * 60 * 1000) return "Completed";
  if (diff <= 0) return "Live now";
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function getMatchStatus(matchDateTime, joinedPlayers, maxPlayers) {
  if (joinedPlayers >= maxPlayers) return "🚫 Full";
  const diff = matchDateTime - new Date();
  if (diff <= 0 && diff > -3600000) return "🔴 Live";
  if (diff <= -3600000) return "⚫ Completed";
  return "🟢 Upcoming";
}

async function loadMatches() {
  matchesContainer.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "matches"));

  for (const docItem of querySnapshot.docs) {
    const match        = docItem.data();
    const matchDateTime = new Date(`${match.matchDate}T${match.matchTime}`);

    // CHECK JOINED — use deterministic doc ID (uid_matchId)
    const joinRef  = doc(db, "joinedMatches", `${currentUser.uid}_${docItem.id}`);
    const joinSnap = await getDoc(joinRef);
    const joined   = joinSnap.exists();

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${match.bannerUrl}" class="match-banner"/>
      <div class="badges">
        <span class="badge">${match.matchType}</span>
        <span class="badge">${match.mapName}</span>
      </div>
      <h3>${match.name}</h3>
      <p>💰 Entry: ₹${match.entry}</p>
      <p>🏆 Prize: ₹${match.prize}</p>
      <p>⏰ ${match.matchDate} ${match.matchTime}</p>
      <p>🔥 Starts In: <span id="timer-${docItem.id}">${getCountdown(matchDateTime)}</span></p>
      <p class="match-note">📢 ${match.matchNote || "No Instructions"}</p>
      <p>👥 Players: ${match.joinedPlayers}/${match.maxPlayers}</p>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${(match.joinedPlayers / match.maxPlayers) * 100}%"></div>
      </div>
      <p class="match-status">${getMatchStatus(matchDateTime, match.joinedPlayers, match.maxPlayers)}</p>
      ${joined
        ? `<div class="room-box">
             <p>Room ID: ${match.roomId}</p>
             <button class="copy-id-btn">Copy ID</button>
           </div>
           <div class="room-box">
             <p>Password: ${match.roomPass}</p>
             <button class="copy-pass-btn">Copy Password</button>
           </div>`
        : `<button class="join-btn">Join Match</button>`
      }
    `;
    // Data attrs for client-side filtering
    card.dataset.type   = (match.matchType || "").toLowerCase();
    card.dataset.entry  = match.entry || 0;
    const _diff = matchDateTime - new Date();
    card.dataset.status = match.joinedPlayers >= match.maxPlayers ? "full"
      : (_diff <= 0 && _diff > -3600000) ? "live"
      : _diff <= -3600000 ? "completed" : "upcoming";

    if (joined) {
      card.querySelector(".copy-id-btn").onclick   = () => copyText(match.roomId);
      card.querySelector(".copy-pass-btn").onclick = () => copyText(match.roomPass);
    } else {
      card.querySelector(".join-btn").onclick = () =>
        joinMatch(docItem.id, match.name, match.entry, match.prize,
                  match.joinedPlayers, match.maxPlayers);
    }

    matchesContainer.appendChild(card);

    setInterval(() => {
      const timer = document.getElementById(`timer-${docItem.id}`);
      if (timer) timer.innerText = getCountdown(matchDateTime);
    }, 1000);
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

window.copyText = function (text) {
  navigator.clipboard.writeText(text);
  showToast("Copied Successfully");
};

window.joinMatch = async function (matchId, matchName, entry, prize, joinedPlayers, maxPlayers) {

  // 🔒 PREVENT DOUBLE CLICK
  if (joiningMatch) { showToast("Please wait..."); return; }
  joiningMatch = true;

  try {
    const gameName = prompt(
      "Enter Exact In-Game Name\n\n⚠ If your game name does not match your profile, admin may remove you from room."
    );
    if (!gameName) { showToast("Enter Game Name"); joiningMatch = false; return; }

    if (Number(joinedPlayers) >= Number(maxPlayers)) {
      showToast("🚫 Match Full"); joiningMatch = false; return;
    }

    // ✅ SINGLE DETERMINISTIC CHECK — uid_matchId as document ID
    // This makes it impossible to join twice even with double clicks
    const joinRef  = doc(db, "joinedMatches", `${currentUser.uid}_${matchId}`);
    const joinSnap = await getDoc(joinRef);
    if (joinSnap.exists()) {
      showToast("⚠ Already Joined"); joiningMatch = false; return;
    }

    // USER WALLET
    const userRef  = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    let wallet     = Number(userData.wallet || 0);

    if (wallet < Number(entry)) {
      showToast("❌ Insufficient Balance"); joiningMatch = false; return;
    }

    wallet -= Number(entry);
    await updateDoc(userRef, { wallet });
    await payReferralBonusIfEligible(currentUser, userData, matchId, matchName, entry);

    // TRANSACTION
    await addDoc(collection(db, "transactions"), {
      userId: currentUser.uid, type: "debit", amount: entry,
      message: `Joined ${matchName}`,
      time: new Date().toLocaleString(), createdAt: Date.now()
    });

    // GET MATCH DATA
    const matchRef  = doc(db, "matches", matchId);
    const matchSnap = await getDoc(matchRef);
    const matchData = matchSnap.data();

    // SAVE JOIN — setDoc with fixed ID prevents duplicates at database level too
    await setDoc(joinRef, {
      userId:     currentUser.uid,
      userEmail:  currentUser.email,
      matchId:    matchId,
      matchName:  matchName,
      entry:      entry,
      prize:      prize,
      roomId:     matchData.roomId,
      roomPass:   matchData.roomPass,
      matchDate:  matchData.matchDate,
      matchTime:  matchData.matchTime,
      joinedTime: Date.now(),
      gameName:   gameName
    });

    // UPDATE PLAYER COUNT
    await updateDoc(matchRef, { joinedPlayers: Number(joinedPlayers) + 1 });

    await createNotification(
      currentUser,
      "Match Joined",
      `You joined ${matchName}. Room details will be available when admin makes the match live.`,
      "match"
    );

    showToast("✅ Match Joined");
    await loadWallet(currentUser);
    await loadNotifications(currentUser);
    loadMatches();

  } catch (error) {
    console.log(error);
    alert(error.message);
  } finally {
    joiningMatch = false; // 🔓 ALWAYS UNLOCK
  }
};

window.goMyMatches   = () => { window.location.href = "mymatches.html"; };
window.goAddMoney    = () => { window.location.href = "addmoney.html"; };
window.goWithdraw    = () => { window.location.href = "withdraw.html"; };
window.goWinners     = () => { window.location.href = "winners.html"; };
window.goHistory     = () => { window.location.href = "history.html"; };
window.goLeaderboard = () => { window.location.href = "leaderboard.html"; };