// admin.js — fully fixed
import {
  auth, db,
  collection, addDoc, getDocs, query, where,
  doc, getDoc, deleteDoc, updateDoc,
  onAuthStateChanged, signOut
} from "./firebase-config.js";

const withdrawContainer = document.getElementById("withdrawContainer") || document.createElement("div");
const adminMatches      = document.getElementById("adminMatches");

// ── TOAST ────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

// ── NOTIFICATION HELPER ──────────────────────────────────
async function notify(userId, userEmail, title, message, type = "info") {
  await addDoc(collection(db, "notifications"), {
    userId, userEmail, title, message, type,
    read: false, time: new Date().toLocaleString(), createdAt: Date.now()
  });
}

// ── BANNER UPLOAD HANDLER ────────────────────────────────
let currentBannerBase64 = "";

function initBannerUpload() {
  const fileInput = document.getElementById("bannerFile");
  if (!fileInput) return;
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 1500000) {
      showToast("❌ Image too large (max 1.5MB). Resize it first.");
      fileInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      currentBannerBase64 = e.target.result;
      document.getElementById("bannerUrl").value = currentBannerBase64;
      const preview = document.getElementById("bannerPreview");
      const img     = document.getElementById("bannerPreviewImg");
      if (preview && img) {
        img.src = currentBannerBase64;
        preview.style.display = "block";
      }
    };
    reader.readAsDataURL(file);
  });
}

window.clearBanner = function () {
  currentBannerBase64 = "";
  document.getElementById("bannerUrl").value = "";
  const fileInput = document.getElementById("bannerFile");
  if (fileInput) fileInput.value = "";
  const preview = document.getElementById("bannerPreview");
  if (preview) preview.style.display = "none";
};

// ── AUTH CHECK ───────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  const snap = await getDocs(query(collection(db, "admins"), where("email", "==", user.email)));
  if (snap.empty) { await showError("Access Denied", "You do not have admin access.");  window.location.href = "dashboard.html"; return; }
  await loadSummary();
  await loadMatches();
  await loadWithdrawals();
  await loadDepositRequests();
  await loadUpiSetting();
  await loadAnnouncementText();
  initBannerUpload();
});

// ── SUMMARY CARDS ────────────────────────────────────────
async function loadSummary() {
  try {
    const [usersSnap, matchesSnap, txSnap, withdrawSnap, depositSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "matches")),
      getDocs(collection(db, "transactions")),
      getDocs(query(collection(db, "withdrawRequests"), where("status", "==", "pending"))),
      getDocs(collection(db, "depositRequests"))
    ]);

    const totalEntry = txSnap.docs
      .map(d => d.data()).filter(t => t.message?.includes("Joined"))
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalPaid = txSnap.docs
      .map(d => d.data()).filter(t => t.type === "credit" && t.message?.includes("Winner"))
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const pendingDep = depositSnap.docs.filter(d => d.data().status === "pending").length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set("totalUsers",          usersSnap.size);
    set("totalMatches",        matchesSnap.size);
    set("totalEntryCollection",`₹${totalEntry}`);
    set("totalPaidWinnings",   `₹${totalPaid}`);
    set("pendingWithdrawals",  withdrawSnap.size);
    set("pendingDeposits",     pendingDep);
    const wb = document.getElementById("withdrawBadge");
    const db2 = document.getElementById("depositBadge");
    if (wb)  wb.innerText  = withdrawSnap.size;
    if (db2) db2.innerText = pendingDep;
  } catch(e) { console.error(e); }
}

// ── FORM HELPER ──────────────────────────────────────────
function getFormData() {
  return {
    name:       document.getElementById("matchName").value,
    entry:      document.getElementById("entryFee").value,
    prize:      document.getElementById("prizePool").value,
    maxPlayers: Number(document.getElementById("maxPlayers").value),
    matchNote:  document.getElementById("matchNote").value,
    roomId:     document.getElementById("roomId").value,
    roomPass:   document.getElementById("roomPass").value,
    matchDate:  document.getElementById("matchDate").value,
    matchTime:  document.getElementById("matchTime").value,
    matchType:  document.getElementById("matchType").value,
    mapName:    document.getElementById("mapName").value,
    bannerUrl:  document.getElementById("bannerUrl").value,
  };
}

function clearForm() {
  ["matchName","entryFee","prizePool","maxPlayers","matchNote",
   "roomId","roomPass","matchDate","matchTime","matchType","mapName","bannerUrl"]
  .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  // Reset banner
  currentBannerBase64 = "";
  const fileInput = document.getElementById("bannerFile");
  if (fileInput) fileInput.value = "";
  const prev = document.getElementById("bannerPreview");
  if (prev) prev.style.display = "none";
}

function setCreateMode() {
  const btn = document.getElementById("submitMatchBtn");
  if (!btn) return;
  btn.innerText = "Create Match";
  btn.onclick   = createMatch;
}

function setEditMode(matchId) {
  const btn = document.getElementById("submitMatchBtn");
  if (!btn) return;
  btn.innerText = "💾 Save Changes";
  btn.onclick   = async () => {
    try {
      await updateDoc(doc(db, "matches", matchId), getFormData());
      showToast("✅ Match Updated", "success");
      clearForm(); setCreateMode(); loadMatches();
    } catch(e) { showToast(e.message); }
  };
}

// ── CREATE MATCH ─────────────────────────────────────────
async function createMatch() {
  const data = getFormData();
  if (!data.name || !data.matchDate || !data.matchTime) {
    showToast("❌ Fill match name, date and time"); return;
  }
  try {
    await addDoc(collection(db, "matches"), { ...data, status: "Upcoming", joinedPlayers: 0 });
    showToast("✅ Match Created", "success");
    clearForm(); loadMatches();
  } catch(e) { showToast(e.message); }
}
window.createMatch = createMatch;
document.getElementById("submitMatchBtn").onclick = createMatch;

// ── LOAD MATCHES ─────────────────────────────────────────
async function loadMatches() {
  if (!adminMatches) return;
  adminMatches.innerHTML = "";
  const snap = await getDocs(collection(db, "matches"));
  snap.docs.forEach(docItem => {
    const match = docItem.data();
    const id    = docItem.id;
    const card  = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      ${match.bannerUrl ? `<img src="${match.bannerUrl}" class="match-banner" style="width:100%;border-radius:10px;margin-bottom:10px;"/>` : ""}
      <h3>${match.name}</h3>
      <p>💰 Entry: ₹${match.entry} &nbsp;|&nbsp; 🏆 Prize: ₹${match.prize}</p>
      <p>👥 ${match.joinedPlayers}/${match.maxPlayers} players</p>
      <p>📅 ${match.matchDate} ${match.matchTime}</p>
      <p>Status: <strong style="color:#00ffd5;">${match.status}</strong></p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
        <button class="btn-edit">✏️ Edit</button>
        <button class="btn-delete">🗑️ Delete</button>
        <button class="btn-live">🔴 Go Live</button>
        <button class="btn-complete">✅ Complete</button>
        <button class="btn-refund">💸 Refund All</button>
        <button class="btn-players">👥 Players</button>
      </div>
      <div class="players-list" style="display:none;margin-top:15px;"></div>
    `;
    card.querySelector(".btn-edit").onclick     = () => editMatch(id, match);
    card.querySelector(".btn-delete").onclick   = () => deleteMatch(id);
    card.querySelector(".btn-live").onclick     = () => setMatchLive(id);
    card.querySelector(".btn-complete").onclick = () => completeMatch(id);
    card.querySelector(".btn-refund").onclick   = () => refundMatch(id, match.entry);
    card.querySelector(".btn-players").onclick  = () => togglePlayersList(id, card);
    adminMatches.appendChild(card);
  });
}

// ── EDIT MATCH ───────────────────────────────────────────
async function editMatch(matchId, matchData) {
  const fields = {
    matchName: matchData.name, entryFee: matchData.entry, prizePool: matchData.prize,
    maxPlayers: matchData.maxPlayers, matchNote: matchData.matchNote,
    roomId: matchData.roomId, roomPass: matchData.roomPass,
    matchDate: matchData.matchDate, matchTime: matchData.matchTime,
    matchType: matchData.matchType, mapName: matchData.mapName, bannerUrl: matchData.bannerUrl
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id); if (el) el.value = val || "";
  });
  // Show existing banner preview when editing
  if (matchData.bannerUrl) {
    currentBannerBase64 = matchData.bannerUrl;
    document.getElementById("bannerUrl").value = matchData.bannerUrl;
    const prev = document.getElementById("bannerPreview");
    const img  = document.getElementById("bannerPreviewImg");
    if (prev && img) {
      img.src = matchData.bannerUrl;
      prev.style.display = "block";
    }
  } else {
    window.clearBanner();
  }
  document.querySelectorAll(".admin-section").forEach(s => s.style.display = "none");
  const ms = document.getElementById("matchSection");
  if (ms) { ms.style.display = "block"; ms.scrollIntoView({ behavior: "smooth", block: "start" }); }
  setEditMode(matchId);
}

// ── DELETE MATCH ─────────────────────────────────────────
async function deleteMatch(matchId) {
  const _cd = await showConfirm({icon:"🗑️", title:"Delete Match?", message:"This cannot be undone.", type:"error", confirmText:"Delete"}); if (!_cd) return;
  try {
    await deleteDoc(doc(db, "matches", matchId));
    showToast("🗑️ Match Deleted", "info");
    loadMatches();
  } catch(e) { showToast(e.message); }
}

// ── MATCH STATUS ─────────────────────────────────────────
async function setMatchLive(matchId) {
  try { await updateDoc(doc(db, "matches", matchId), { status: "Live" }); showToast("🔴 Match is Live!", "success"); loadMatches(); }
  catch(e) { showToast(e.message); }
}
async function completeMatch(matchId) {
  try { await updateDoc(doc(db, "matches", matchId), { status: "Completed" }); showToast("✅ Match Completed", "success"); loadMatches(); }
  catch(e) { showToast(e.message); }
}

// ── REFUND — uses userId directly ────────────────────────
async function refundMatch(matchId, entryFee) {
  const _crr = await showConfirm({icon:"💸", title:"Refund All Players?", message:"Entry fee will be returned to all joined players.", confirmText:"Refund All"}); if (!_crr) return;
  try {
    const snap = await getDocs(query(collection(db, "joinedMatches"), where("matchId", "==", matchId)));
    let count = 0;
    for (const playerDoc of snap.docs) {
      const p = playerDoc.data();
      if (!p.userId) continue;
      const userRef  = doc(db, "users", p.userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) continue;
      const wallet = Number(userSnap.data().wallet || 0) + Number(entryFee);
      await updateDoc(userRef, { wallet });
      await addDoc(collection(db, "transactions"), {
        userId: p.userId, type: "credit", amount: Number(entryFee),
        message: "Match Refund", time: new Date().toLocaleString(), createdAt: Date.now()
      });
      await notify(p.userId, p.userEmail, "💸 Match Refund",
        `₹${entryFee} refunded — match was cancelled.`, "wallet");
      count++;
    }
    await showSuccess('Refund Complete 💸', `Entry fee refunded to <strong>${count} players</strong>.`, 'OK');
  } catch(e) { showToast(e.message); }
}

// ── DECLARE WINNER ───────────────────────────────────────
window.declareWinner = async function () {
  const winnerEmail = document.getElementById("winnerEmail").value.trim();
  const prize       = Number(document.getElementById("winnerPrize").value);
  if (!winnerEmail || !prize) { showToast("❌ Enter email and prize"); return; }
  try {
    const snap = await getDocs(query(collection(db, "users"), where("email", "==", winnerEmail)));
    if (snap.empty) { showToast("❌ User not found", "error"); return; }
    const userDoc = snap.docs[0];
    const wallet  = Number(userDoc.data().wallet || 0) + prize;
    await updateDoc(doc(db, "users", userDoc.id), { wallet });
    // FIX: save to "results" (what winners.js reads)
    await addDoc(collection(db, "results"), {
      winnerEmail, matchName: "Admin Declared", winningAmount: prize,
      time: new Date().toLocaleString(), createdAt: Date.now()
    });
    await addDoc(collection(db, "transactions"), {
      userId: userDoc.id, type: "credit", amount: prize,
      message: "Match Winner Reward", time: new Date().toLocaleString(), createdAt: Date.now()
    });
    await notify(userDoc.id, winnerEmail, "🏆 Winner Reward!",
      `₹${prize} credited to your wallet. Congratulations! 🎮`, "wallet");
    await showSuccess("Winner Declared! 🏆", "Reward has been credited to the winner's wallet.", "OK");
  } catch(e) { showToast(e.message); }
};

// ── PLAYERS LIST ─────────────────────────────────────────
async function togglePlayersList(matchId, card) {
  const listDiv = card.querySelector(".players-list");
  if (listDiv.style.display === "block") { listDiv.style.display = "none"; return; }
  listDiv.style.display = "block";
  listDiv.innerHTML = "<p style='color:#aaa;'>Loading...</p>";
  try {
    const snap = await getDocs(query(collection(db, "joinedMatches"), where("matchId", "==", matchId)));
    if (snap.empty) { listDiv.innerHTML = "<p style='color:#aaa;'>No players yet.</p>"; return; }
    listDiv.innerHTML = "";
    snap.docs.forEach(docItem => {
      const p      = docItem.data();
      const joinId = docItem.id;
      const pc     = document.createElement("div");
      pc.style.cssText = "background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:14px;margin-bottom:12px;";
      pc.innerHTML = `
        <p style="color:#00ffd5;font-weight:bold;">🎮 ${p.gameName || p.userEmail}</p>
        <p style="color:#aaa;font-size:12px;margin:4px 0 10px;">${p.userEmail}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div>
            <label style="color:#aaa;font-size:12px;">Position</label>
            <input type="number" class="inp-pos" value="${p.position||''}" placeholder="e.g. 1"
              style="width:100%;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:8px;margin-top:4px;"/>
          </div>
          <div>
            <label style="color:#aaa;font-size:12px;">Kills</label>
            <input type="number" class="inp-kills" value="${p.kills||''}" placeholder="e.g. 5"
              style="width:100%;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:8px;margin-top:4px;"/>
          </div>
        </div>
        <div style="margin-bottom:10px;padding:8px;background:#222;border-radius:8px;">
          <p style="color:#aaa;font-size:12px;">👑 Booyah auto-set YES if position = 1</p>
          <p style="color:#00ffd5;font-size:13px;margin-top:4px;">${p.booyah ? "👑 YES" : "❌ NO"}</p>
        </div>
        <input type="number" class="inp-winning" value="${p.winningAmount||0}" placeholder="Winning Amount ₹"
          style="width:100%;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:8px;margin-bottom:8px;"/>
        <button class="btn-save" style="width:100%;padding:10px;border-radius:8px;">💾 Save Result</button>
        ${p.position ? `<p style="color:#00ff88;font-size:12px;margin-top:6px;">✅ Saved — Pos:${p.position} Kills:${p.kills||0}</p>` : ""}
      `;
      pc.querySelector(".btn-save").onclick = () =>
        saveResult(joinId, pc.querySelector(".inp-pos").value,
          pc.querySelector(".inp-kills").value,
          pc.querySelector(".inp-winning").value, p, pc);
      listDiv.appendChild(pc);
    });
  } catch(e) { listDiv.innerHTML = `<p style='color:red;'>${e.message}</p>`; }
}

// ── SAVE RESULT + CREDIT WINNING ─────────────────────────
async function saveResult(joinId, position, kills, winningAmount, player, playerCard) {
  if (!position) { showToast("Enter position"); return; }
  const booyah = Number(position) === 1;
  const winning = Number(winningAmount || 0);
  try {
    await updateDoc(doc(db, "joinedMatches", joinId), {
      position: Number(position), kills: Number(kills || 0),
      booyah, winningAmount: winning,
      resultStatus: Number(position) === 1 ? "Winner 🏆" : "Completed"
    });
    // Credit winning amount if > 0
    if (winning > 0 && player.userId) {
      const uRef  = doc(db, "users", player.userId);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        const newWallet = Number(uSnap.data().wallet || 0) + winning;
        await updateDoc(uRef, { wallet: newWallet });
        await addDoc(collection(db, "transactions"), {
          userId: player.userId, type: "credit", amount: winning,
          message: `Match Winning — Pos #${position}`,
          time: new Date().toLocaleString(), createdAt: Date.now()
        });
        await notify(player.userId, player.userEmail,
          "🏆 Match Result & Winning",
          `Your result: Position #${position} | Kills: ${kills||0}${booyah ? " | 👑 BOOYAH!" : ""}. ₹${winning} credited to your wallet!`,
          "wallet");
      }
    } else if (player.userId) {
      await notify(player.userId, player.userEmail,
        "🎮 Match Result Updated",
        `Position #${position} | Kills: ${kills||0}${booyah ? " | 👑 BOOYAH!" : ""}`,
        "match");
    }
    let msg = playerCard.querySelector(".saved-msg");
    if (!msg) { msg = document.createElement("p"); msg.className = "saved-msg"; msg.style.cssText = "color:#00ff88;font-size:12px;margin-top:6px;"; playerCard.appendChild(msg); }
    msg.innerText = `✅ Saved — Pos:${position} Kills:${kills||0} Winning:₹${winning}`;
  } catch(e) { showToast(e.message); }
}

// ── WITHDRAWALS ──────────────────────────────────────────
async function loadWithdrawals() {
  withdrawContainer.replaceChildren();
  const snap = await getDocs(query(collection(db, "withdrawRequests"), where("status", "==", "pending")));
  const wb = document.getElementById("withdrawBadge");
  const wc = document.getElementById("pendingWithdrawals");
  if (wb) wb.innerText = snap.size;
  if (wc) wc.innerText = snap.size;
  if (snap.empty) {
    withdrawContainer.innerHTML = "<p style='color:#aaa;padding:10px;'>No pending withdrawals.</p>";
    return;
  }
  snap.forEach(docItem => {
    const data = docItem.data();
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3 style="color:#00ffd5;">${data.userEmail}</h3>
      <p>💰 Amount: <strong style="color:#ff4444;">₹${data.amount}</strong></p>
      <p>🏦 UPI: ${data.upi}</p>
      <p>🕒 ${data.time || ""}</p>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn-approve" style="flex:1;background:linear-gradient(135deg,#00ff88,#00ffd5);color:black;">✅ Approve</button>
        <button class="btn-reject"  style="flex:1;background:linear-gradient(135deg,#ff4444,#ff0000);color:white;">❌ Reject</button>
      </div>
    `;
    card.querySelector(".btn-approve").onclick = () => approveWithdraw(docItem.id);
    card.querySelector(".btn-reject").onclick  = () => rejectWithdraw(docItem.id);
    withdrawContainer.appendChild(card);
  });
}

// ── APPROVE WITHDRAWAL — deducts wallet here ─────────────
async function approveWithdraw(requestId) {
  try {
    const reqSnap = await getDoc(doc(db, "withdrawRequests", requestId));
    const req     = reqSnap.data();
    if (req.status !== "pending") { showToast("⚠️ Already processed", "warning"); return; }

    // CHECK + DEDUCT WALLET
    const uRef  = doc(db, "users", req.userId);
    const uSnap = await getDoc(uRef);
    const wallet = Number(uSnap.data()?.wallet || 0);
    if (wallet < Number(req.amount)) { showToast("❌ Insufficient balance", "error"); return; }

    await updateDoc(uRef, { wallet: wallet - Number(req.amount) });
    await updateDoc(doc(db, "withdrawRequests", requestId), { status: "approved", walletDeducted: true });
    await addDoc(collection(db, "transactions"), {
      userId: req.userId, amount: req.amount, type: "debit",
      message: `Withdrawal Approved — ${req.upi}`,
      time: new Date().toLocaleString(), createdAt: Date.now()
    });
    await notify(req.userId, req.userEmail, "✅ Withdrawal Approved",
      `Your withdrawal of ₹${req.amount} approved and sent to ${req.upi}.`, "wallet");
    await showSuccess("Withdrawal Approved! ✅", `<strong>₹${req.amount}</strong> sent to ${req.upi}`, "OK");
    loadWithdrawals(); loadSummary();
  } catch(e) { showToast(e.message); }
}

// ── REJECT WITHDRAWAL — NO deduction ────────────────────
async function rejectWithdraw(requestId) {
  const reason = await showPrompt({icon:"❌", title:"Reject Withdrawal", message:"Enter reason for rejection:", placeholder:"e.g. Wrong UPI ID", type:"error", confirmText:"Reject"});
  if (!reason) return;
  try {
    const reqSnap = await getDoc(doc(db, "withdrawRequests", requestId));
    const req     = reqSnap.data();
    await updateDoc(doc(db, "withdrawRequests", requestId), { status: "rejected", rejectReason: reason });
    await notify(req.userId, req.userEmail, "❌ Withdrawal Rejected",
      `Your withdrawal of ₹${req.amount} was rejected. Reason: ${reason}. Your balance was NOT deducted.`, "wallet");
    showToast("❌ Withdrawal Rejected", "error");
    loadWithdrawals(); loadSummary();
  } catch(e) { showToast(e.message); }
}

// ── DEPOSIT REQUESTS ─────────────────────────────────────
async function loadDepositRequests() {
  const container = document.getElementById("depositContainer");
  if (!container) return;
  container.innerHTML = "<p style='color:#aaa;'>Loading...</p>";
  try {
    const snap    = await getDocs(collection(db, "depositRequests"));
    const pending = snap.docs.filter(d => d.data().status === "pending");
    const db2 = document.getElementById("depositBadge");
    const dc  = document.getElementById("pendingDeposits");
    if (db2) db2.innerText = pending.length;
    if (dc)  dc.innerText  = pending.length;
    if (pending.length === 0) {
      container.innerHTML = "<p style='color:#aaa;padding:10px;'>No pending deposits.</p>"; return;
    }
    container.innerHTML = "";
    pending.forEach(docItem => {
      const data = docItem.data();
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3 style="color:#00ffd5;">${data.userEmail}</h3>
        <p>💰 Amount: <strong style="color:#00ff88;">₹${data.amount}</strong></p>
        <p>🔢 UTR: <strong>${data.utrNumber}</strong></p>
        <p>🕒 ${data.time}</p>
        ${data.screenshot ? `<img src="${data.screenshot}"
          style="width:100%;border-radius:10px;margin-top:8px;border:1px solid #333;cursor:pointer;"
          onclick="window.open('${data.screenshot}','_blank')"/>` : "<p style='color:#aaa;'>No screenshot</p>"}
        <div style="display:flex;gap:10px;margin-top:12px;">
          <button class="btn-approve-dep" style="flex:1;background:linear-gradient(135deg,#00ff88,#00ffd5);color:black;">✅ Approve</button>
          <button class="btn-reject-dep"  style="flex:1;background:linear-gradient(135deg,#ff4444,#ff0000);color:white;">❌ Reject</button>
        </div>
      `;
      card.querySelector(".btn-approve-dep").onclick = () => approveDeposit(docItem.id, data.userId, data.amount, data.userEmail);
      card.querySelector(".btn-reject-dep").onclick  = () => rejectDeposit(docItem.id, data.userId, data.amount, data.userEmail);
      container.appendChild(card);
    });
  } catch(e) { container.innerHTML = `<p style='color:red;'>${e.message}</p>`; }
}

async function approveDeposit(requestId, userId, amount, userEmail) {
  const _ca = await showConfirm({icon:"✅", title:"Approve Deposit?", message:`Credit <strong>₹${amount}</strong> to ${userEmail}?`, confirmText:"Approve"}); if (!_ca) return;
  try {
    const uRef  = doc(db, "users", userId);
    const uSnap = await getDoc(uRef);
    if (!uSnap.exists()) { showToast("User not found"); return; }
    const wallet = Number(uSnap.data().wallet || 0) + Number(amount);
    await updateDoc(uRef, { wallet });
    await updateDoc(doc(db, "depositRequests", requestId), { status: "approved" });
    await addDoc(collection(db, "transactions"), {
      userId, type: "credit", amount: Number(amount),
      message: "Wallet Deposit Approved",
      time: new Date().toLocaleString(), createdAt: Date.now()
    });
    await notify(userId, userEmail, "✅ Deposit Approved",
      `₹${amount} has been credited to your wallet. Happy gaming! 🎮`, "wallet");
    await showSuccess("Deposit Approved! ✅", `<strong>₹${amount}</strong> has been credited to <br/>${userEmail}`, "OK");
    loadDepositRequests(); loadSummary();
  } catch(e) { showToast(e.message); }
}

async function rejectDeposit(requestId, userId, amount, userEmail) {
  const reason = await showPrompt({icon:"❌", title:"Reject Deposit", message:`Reason for rejecting ${userEmail}:`, placeholder:"e.g. Wrong UTR number", type:"error", confirmText:"Reject"});
  if (!reason) return;
  try {
    await updateDoc(doc(db, "depositRequests", requestId), { status: "rejected", rejectReason: reason });
    await notify(userId, userEmail, "❌ Deposit Rejected",
      `Your deposit of ₹${amount} was rejected. Reason: ${reason}. Contact support if needed.`, "wallet");
    showToast("❌ Deposit Rejected", "error");
    loadDepositRequests(); loadSummary();
  } catch(e) { showToast(e.message); }
}

// ── UPI SETTINGS ─────────────────────────────────────────
async function loadUpiSetting() {
  try {
    const snap = await getDocs(collection(db, "settings"));
    if (!snap.empty) {
      const upi = snap.docs[0].data().upiId || "Not set";
      const el  = document.getElementById("currentUpiDisplay");
      const inp = document.getElementById("upiIdInput");
      if (el)  el.innerText = upi;
      if (inp) inp.value    = upi !== "Not set" ? upi : "";
    }
  } catch(e) { console.log(e); }
}

window.saveUpiId = async function () {
  const upi = document.getElementById("upiIdInput").value.trim();
  if (!upi) { showToast("Enter UPI ID"); return; }
  try {
    const snap = await getDocs(collection(db, "settings"));
    if (snap.empty) await addDoc(collection(db, "settings"), { upiId: upi });
    else await updateDoc(doc(db, "settings", snap.docs[0].id), { upiId: upi });
    document.getElementById("currentUpiDisplay").innerText = upi;
    showToast("✅ UPI ID Saved", "success");
  } catch(e) { showToast(e.message); }
};

// ── ANNOUNCEMENTS ─────────────────────────────────────────
async function loadAnnouncementText() {
  try {
    const snap = await getDocs(collection(db, "announcements"));
    if (!snap.empty) {
      const el = document.getElementById("announcementText");
      if (el) el.value = snap.docs[0].data().message || "";
    }
  } catch(e) { console.log(e); }
}

window.publishAnnouncement = async function () {
  const text = document.getElementById("announcementText").value.trim();
  if (!text) { showToast("Enter announcement text"); return; }
  try {
    const snap = await getDocs(collection(db, "announcements"));
    for (const d of snap.docs) await deleteDoc(doc(db, "announcements", d.id));
    await addDoc(collection(db, "announcements"), {
      message: text, active: true,
      createdAt: Date.now(), time: new Date().toLocaleString()
    });
    showToast("✅ Announcement Published!", "success");
  } catch(e) { showToast(e.message); }
};

window.deleteAnnouncement = async function () {
  const _can = await showConfirm({icon:"🗑️", title:"Delete Announcement?", message:"This will remove the announcement from dashboard.", type:"error", confirmText:"Delete"}); if (!_can) return;
  try {
    const snap = await getDocs(collection(db, "announcements"));
    for (const d of snap.docs) await deleteDoc(doc(db, "announcements", d.id));
    document.getElementById("announcementText").value = "";
    showToast("🗑️ Deleted", "info");
  } catch(e) { showToast(e.message); }
};

// ── LOGOUT ────────────────────────────────────────────────
window.logoutAdmin = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};

// ── EXPOSE ────────────────────────────────────────────────
window.editMatch    = editMatch;
window.deleteMatch  = deleteMatch;
window.setMatchLive = setMatchLive;
window.completeMatch= completeMatch;
window.refundMatch  = refundMatch;
window.loadMatches  = loadMatches;

// ── USER MANAGEMENT ──────────────────────────────────────
let allUsers = [];

window.loadUserManagement = async function () {
  const container = document.getElementById("userListContainer");
  if (!container) return;
  container.innerHTML = "<p style='color:#aaa;'>Loading users...</p>";
  try {
    const snap = await getDocs(collection(db, "users"));
    allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    renderUserList(allUsers);
  } catch(e) {
    container.innerHTML = `<p style='color:red;'>${e.message}</p>`;
  }
};

function renderUserList(users) {
  const container = document.getElementById("userListContainer");
  if (!container) return;
  if (users.length === 0) {
    container.innerHTML = "<p style='color:#aaa;'>No users found.</p>";
    return;
  }
  container.innerHTML = users.map(u => `
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <p style="color:#00ffd5;font-weight:600;margin:0 0 2px;">${u.email}</p>
          <p style="color:#666;font-size:12px;margin:0;">
            Wallet: <strong style="color:#00ff88;">₹${u.wallet||0}</strong>
            &nbsp;|&nbsp; Game: ${u.gameName||"-"}
          </p>
          <p style="color:#555;font-size:11px;margin:2px 0 0;">
            UID: ${u.uid.slice(0,12)}...
          </p>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button onclick="adjustWallet('${u.uid}','${u.email}',${u.wallet||0},'add')"
            style="padding:8px 12px;font-size:12px;background:linear-gradient(135deg,#00ff88,#00cc66);color:black;border-radius:8px;">
            + Add
          </button>
          <button onclick="adjustWallet('${u.uid}','${u.email}',${u.wallet||0},'deduct')"
            style="padding:8px 12px;font-size:12px;background:linear-gradient(135deg,#ff4444,#cc0000);color:white;border-radius:8px;">
            - Deduct
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

window.searchUsers = function () {
  const q = (document.getElementById("userSearchInput")?.value || "").toLowerCase();
  renderUserList(allUsers.filter(u =>
    u.email.toLowerCase().includes(q) ||
    (u.gameName || "").toLowerCase().includes(q)
  ));
};

window.adjustWallet = async function (uid, email, currentWallet, mode) {
  const amtStr = prompt(`${mode === "add" ? "Add" : "Deduct"} how much for ${email}?\nCurrent balance: ₹${currentWallet}`);
  if (!amtStr) return;
  const amt = Number(amtStr);
  if (isNaN(amt) || amt <= 0) { showToast("Invalid amount"); return; }
  try {
    const newWallet = mode === "add"
      ? currentWallet + amt
      : Math.max(0, currentWallet - amt);
    await updateDoc(doc(db, "users", uid), { wallet: newWallet });
    await addDoc(collection(db, "transactions"), {
      userId: uid,
      type:   mode === "add" ? "credit" : "debit",
      amount: amt,
      message: `Admin wallet ${mode === "add" ? "top-up" : "deduction"}`,
      time: new Date().toLocaleString(),
      createdAt: Date.now()
    });
    await notify(uid, email,
      mode === "add" ? "💰 Wallet Topped Up" : "💸 Wallet Adjusted",
      `Admin has ${mode === "add" ? "added" : "deducted"} ₹${amt} ${mode === "add" ? "to" : "from"} your wallet. New balance: ₹${newWallet}`,
      "wallet"
    );
    await showSuccess('Wallet Updated ✅', `New balance: <strong>₹${newWallet}</strong>`, 'OK');
    loadUserManagement();
  } catch(e) { showToast(e.message); }
};

// ── SEND NOTIFICATION TO ALL USERS ──────────────────────
window.sendNotifToAll = async function () {
  const title = await showPrompt({icon:"📣", title:"Notification Title", placeholder:"e.g. 🎉 New Tournament", confirmText:"Next"});
  if (!title) return;
  const message = await showPrompt({icon:"💬", title:"Notification Message", placeholder:"Enter your message...", confirmText:"Next"});
  if (!message) return;
  const _cn = await showConfirm({icon:"📣", title:"Notify All Players?", message:`<strong>${title}</strong><br/>${message}`, confirmText:"Send to All"}); if (!_cn) return;
  try {
    const snap = await getDocs(collection(db, "users"));
    let count = 0;
    for (const d of snap.docs) {
      const u = d.data();
      await notify(d.id, u.email || "", title, message, "info");
      count++;
    }
    await showSuccess('Notification Sent! 📣', `Sent to <strong>${count} players</strong>`, 'OK');
  } catch(e) { showToast("Error: " + e.message); }
};

// ── EXPORT TRANSACTIONS CSV ──────────────────────────────
window.exportTransactionsCSV = async function () {
  try {
    showToast("⏳ Exporting...", "info");
    const [txSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, "transactions")),
      getDocs(collection(db, "users"))
    ]);
    const emailMap = {};
    usersSnap.forEach(d => { emailMap[d.id] = d.data().email || ""; });

    const rows = [["userId","userEmail","type","amount","message","time","createdAt"]];
    txSnap.forEach(d => {
      const tx = d.data();
      rows.push([
        tx.userId || "",
        emailMap[tx.userId] || tx.userEmail || "",
        tx.type   || "",
        tx.amount || 0,
        `"${(tx.message || "").replace(/"/g, '""')}"`,
        tx.time   || "",
        tx.createdAt || ""
      ]);
    });

    const csv  = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `phantom_transactions_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✅ CSV downloaded!", "success");
  } catch(e) { showToast("Error: " + e.message); }
};

// ── REVENUE CHART ────────────────────────────────────────
let revenueChartInstance = null;

window.loadRevenueChart = async function () {
  try {
    const snap = await getDocs(collection(db, "transactions"));
    const txs  = snap.docs.map(d => d.data());

    // Totals
    const totalDeposit  = txs.filter(t => t.type === "credit").reduce((s,t) => s + Number(t.amount||0), 0);
    const totalWithdraw = txs.filter(t => t.type === "debit") .reduce((s,t) => s + Number(t.amount||0), 0);
    const el1 = document.getElementById("revTotalDeposit");
    const el2 = document.getElementById("revTotalWithdraw");
    const el3 = document.getElementById("revNetProfit");
    if (el1) el1.innerText = `₹${totalDeposit}`;
    if (el2) el2.innerText = `₹${totalWithdraw}`;
    if (el3) el3.innerText = `₹${totalDeposit - totalWithdraw}`;

    // Last 14 days grouped by day
    const dayMap = {};
    for (let i = 13; i >= 0; i--) {
      const d   = new Date(Date.now() - i * 86400000);
      const key = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      dayMap[key] = { credit: 0, debit: 0 };
    }
    txs.forEach(tx => {
      if (!tx.createdAt) return;
      const key = new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      if (!dayMap[key]) return;
      if (tx.type === "credit") dayMap[key].credit += Number(tx.amount||0);
      else                       dayMap[key].debit  += Number(tx.amount||0);
    });

    const labels  = Object.keys(dayMap);
    const credits = labels.map(l => dayMap[l].credit);
    const debits  = labels.map(l => dayMap[l].debit);

    const canvas = document.getElementById("revenueChart");
    if (!canvas) { showToast("Chart canvas not found"); return; }

    if (revenueChartInstance) revenueChartInstance.destroy();
    revenueChartInstance = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Deposits (₹)",    data: credits, backgroundColor: "rgba(0,255,136,0.7)", borderRadius: 6 },
          { label: "Withdrawals (₹)", data: debits,  backgroundColor: "rgba(255,68,68,0.7)",  borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: "#ccc" } } },
        scales: {
          x: { ticks: { color: "#888" }, grid: { color: "#222" } },
          y: { ticks: { color: "#888" }, grid: { color: "#222" } }
        }
      }
    });
  } catch(e) { showToast("Chart error: " + e.message); }
};