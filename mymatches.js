import {
  auth,
  db,
  collection,
  getDocs,
  query,
  where,
  onAuthStateChanged
} from "./firebase-config.js";

const matchesContainer = document.getElementById("matchesContainer");

function getMatchDateTime(match) {
  if (!match.matchDate || !match.matchTime) return null;
  return new Date(`${match.matchDate}T${match.matchTime}`);
}

function getCountdownText(matchDateTime) {
  if (!matchDateTime || isNaN(matchDateTime.getTime())) return "Time not set";
  const diff = matchDateTime - new Date();
  if (diff <= -3600000) return "⚫ Completed";
  if (diff <= 0) return "🔴 Live now";
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerText = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  await loadMyMatches(user);
});

async function loadMyMatches(user) {
  matchesContainer.innerHTML = "<p style='padding:20px;color:#aaa;'>Loading matches...</p>";

  try {
    // Query only this user's joined matches using userId
    const q = query(
      collection(db, "joinedMatches"),
      where("userId", "==", user.uid)
    );
    const snap = await getDocs(q);
    const myDocs = snap.docs;

    if (myDocs.length === 0) {
      matchesContainer.innerHTML = `
        <div class="card" style="text-align:center;padding:30px;">
          <h3 style="color:#aaa;">No Joined Matches Yet</h3>
          <p style="color:#666;margin-top:8px;">Join a match from the dashboard!</p>
          <button onclick="window.location.href='dashboard.html'" style="margin-top:15px;">
            Browse Matches
          </button>
        </div>
      `;
      return;
    }

    // Sort newest first
    myDocs.sort((a, b) => (b.data().joinedTime || 0) - (a.data().joinedTime || 0));

    matchesContainer.innerHTML = "";

    for (const docItem of myDocs) {
      const match       = docItem.data();
      const matchDateTime = getMatchDateTime(match);
      const timerId     = `timer-${docItem.id}`;

      let statusColor = "#aaa";
      let statusIcon  = "✅";
      if (match.position === 1)     { statusColor = "gold";    statusIcon = "🏆"; }
      else if (match.position <= 3) { statusColor = "silver";  statusIcon = "🥈"; }
      else if (match.booyah === true || match.booyah === 'true') { statusColor = "#00ffd5"; statusIcon = "👑"; }

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3 style="color:#00ffd5;">${match.matchName || "Match"}</h3>

        <div class="countdown-box">
          <span style="color:#aaa;font-size:13px;">⏰ Match Countdown</span><br/>
          <strong id="${timerId}" style="color:#00ffd5;">${getCountdownText(matchDateTime)}</strong>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;">
          <div style="background:#1a1a1a;padding:10px;border-radius:10px;text-align:center;">
            <p style="color:#aaa;font-size:12px;">Position</p>
            <h3 style="color:${statusColor};">${match.position || "-"}</h3>
          </div>
          <div style="background:#1a1a1a;padding:10px;border-radius:10px;text-align:center;">
            <p style="color:#aaa;font-size:12px;">Kills</p>
            <h3 style="color:#00ffd5;">${match.kills || 0}</h3>
          </div>
          <div style="background:#1a1a1a;padding:10px;border-radius:10px;text-align:center;">
            <p style="color:#aaa;font-size:12px;">Booyah</p>
            <h3>${(match.booyah === true || match.booyah === "true") ? "👑 Yes" : "❌ No"}</h3>
          </div>
          <div style="background:#1a1a1a;padding:10px;border-radius:10px;text-align:center;">
            <p style="color:#aaa;font-size:12px;">Winning</p>
            <h3 style="color:#00ff88;">₹${Number(match.winningAmount || 0)}</h3>
          </div>
        </div>

        <p>💰 Entry: ₹${match.entry}</p>
        <p>🏆 Prize Pool: ₹${match.prize}</p>
        <p>📅 Date: ${match.matchDate || "-"}</p>
        <p>⏰ Time: ${match.matchTime || "-"}</p>
        <p>🎮 Game Name: ${match.gameName || "-"}</p>

        ${match.roomId ? `
        <div class="room-box">
          <p>🔑 Room ID: ${match.roomId}</p>
          <button class="copy-room-btn">Copy ID</button>
        </div>
        <div class="room-box">
          <p>🔒 Password: ${match.roomPass}</p>
          <button class="copy-pass-btn">Copy Password</button>
        </div>` : ""}

        <p style="margin-top:10px;font-weight:bold;color:${statusColor};">
          ${statusIcon} Status: ${match.resultStatus || "Joined"}
        </p>
      `;

      if (match.roomId) {
        card.querySelector(".copy-room-btn").onclick = () => {
          navigator.clipboard.writeText(match.roomId);
          showToast("Room ID Copied!");
        };
        card.querySelector(".copy-pass-btn").onclick = () => {
          navigator.clipboard.writeText(match.roomPass);
          showToast("Password Copied!");
        };
      }

      matchesContainer.appendChild(card);

      // Start countdown timer
      setInterval(() => {
        const el = document.getElementById(timerId);
        if (el) el.innerText = getCountdownText(matchDateTime);
      }, 1000);
    }

  } catch (error) {
    console.error("Error:", error);
    matchesContainer.innerHTML = `
      <div class="card">
        <p style="color:red;">Error loading matches: ${error.message}</p>
      </div>
    `;
  }
}