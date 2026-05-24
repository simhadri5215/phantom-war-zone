import { db, collection, getDocs } from "./firebase-config.js";

const container = document.getElementById("leaderboardContainer");
let allPlayers = [];

async function loadLeaderboard() {
  container.innerHTML = "<p style='padding:20px;color:#aaa;'>Loading...</p>";
  try {
    // Load users
    const usersSnap = await getDocs(collection(db, "users"));
    const usersMap  = {};
    usersSnap.forEach(d => { usersMap[d.id] = { uid: d.id, ...d.data() }; });

    // Load joined matches to get wins + kills per player
    const joinedSnap = await getDocs(collection(db, "joinedMatches"));
    const statsMap   = {};

    joinedSnap.forEach(d => {
      const m = d.data();
      const uid = m.userId;
      if (!uid) return;
      if (!statsMap[uid]) statsMap[uid] = { wins: 0, kills: 0, booyahs: 0, matches: 0 };
      statsMap[uid].matches++;
      statsMap[uid].kills += Number(m.kills || 0);
      if (m.position === 1) statsMap[uid].wins++;
      if (m.booyah === true || m.booyah === "true") statsMap[uid].booyahs++;
    });

    // Merge
    allPlayers = Object.values(usersMap).map(u => ({
      ...u,
      ...(statsMap[u.uid] || { wins: 0, kills: 0, booyahs: 0, matches: 0 })
    }));

    renderLeaderboard("wins");
  } catch(e) {
    container.innerHTML = `<p style='color:red;padding:20px;'>${e.message}</p>`;
  }
}

window.renderLeaderboard = function(mode) {
  let sorted;
  if      (mode === "wins")   sorted = [...allPlayers].sort((a,b) => (b.wins   || 0) - (a.wins   || 0));
  else if (mode === "kills")  sorted = [...allPlayers].sort((a,b) => (b.kills  || 0) - (a.kills  || 0));
  else                        sorted = [...allPlayers].sort((a,b) => (b.wallet || 0) - (a.wallet || 0));

  container.innerHTML = "";
  const medals = ["🥇","🥈","🥉"];
  const rankClass = ["rank-1","rank-2","rank-3"];

  sorted.slice(0, 50).forEach((p, i) => {
    const rank     = i + 1;
    const rankDisp = rank <= 3 ? medals[rank-1] : `#${rank}`;
    const valDisp  = mode === "wins"  ? `${p.wins || 0}<small>wins</small>`
                   : mode === "kills" ? `${p.kills || 0}<small>kills</small>`
                   :                    `₹${p.wallet || 0}<small>wallet</small>`;
    const cardCls  = rank <= 3 ? rankClass[rank-1] : "";
    // Show game name — never show email publicly
    const name     = p.gameName || "Player" + p.uid.slice(0, 4).toUpperCase();
    const avatar   = p.avatarBase64
      ? `<img class="lb-avatar" src="${p.avatarBase64}"/>`
      : `<div class="lb-avatar" style="background:#222;display:flex;align-items:center;justify-content:center;font-size:18px;">🎮</div>`;

    container.innerHTML += `
      <div class="lb-card ${cardCls}">
        <div class="lb-rank">${rankDisp}</div>
        ${avatar}
        <div class="lb-info">
          <div class="lb-name">${name}</div>
          <div class="lb-stats">
            <span class="lb-stat">🏆 <strong>${p.wins||0}</strong> wins</span>
            <span class="lb-stat">💀 <strong>${p.kills||0}</strong> kills</span>
            <span class="lb-stat">👑 <strong>${p.booyahs||0}</strong> booyahs</span>
          </div>
        </div>
        <div class="lb-val">${valDisp}</div>
      </div>
    `;
  });

  if (sorted.length === 0) {
    container.innerHTML = "<p style='padding:20px;color:#aaa;'>No players yet.</p>";
  }
};

loadLeaderboard();