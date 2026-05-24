import {
  auth, db,
  collection, addDoc, getDocs, query, where,
  doc, getDoc, updateDoc,
  onAuthStateChanged
} from "./firebase-config.js";

let currentUser = null;

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
    await loadWallet();
    await loadWithdrawHistory();
  } else {
    window.location.href = "login.html";
  }
});

async function loadWallet() {
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  if (snap.exists()) {
    const bal = Number(snap.data().wallet || 0);
    document.getElementById("walletDisplay").innerText = `₹${bal}`;
  }
}

async function loadWithdrawHistory() {
  const histDiv = document.getElementById("withdrawHistory");
  if (!histDiv) return;
  try {
    const snap = await getDocs(query(
      collection(db, "withdrawRequests"),
      where("userId", "==", currentUser.uid)
    ));
    const requests = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5);

    if (requests.length === 0) {
      histDiv.innerHTML = `<p style='color:#555;font-size:13px;'>No withdrawal requests yet.</p>`;
      return;
    }

    histDiv.innerHTML = requests.map(r => {
      const statusClass = r.status === "approved" ? "status-approved"
                        : r.status === "rejected"  ? "status-rejected"
                        : "status-pending";
      const statusLabel = r.status === "approved" ? "✅ Approved"
                        : r.status === "rejected"  ? "❌ Rejected"
                        : "⏳ Pending";
      const rejectNote  = r.status === "rejected" && r.rejectReason
        ? `<p style='color:#ff4444;font-size:11px;margin-top:4px;'>Reason: ${r.rejectReason}</p>` : "";
      return `
        <div class="pending-card">
          <div class="pc-left">
            <h4>₹${r.amount} → ${r.upi}</h4>
            <p>${r.time || ""}</p>
            ${rejectNote}
          </div>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </div>`;
    }).join("");
  } catch(e) {
    console.error(e);
  }
}

// SUBMIT — only saves request, NO wallet deduction
// Wallet is deducted ONLY when admin approves
window.sendWithdraw = async function () {
  const amount = Number(document.getElementById("amount").value);
  const upi    = document.getElementById("upi").value.trim();

  if (amount < 60) { showToast("❌ Minimum withdrawal is ₹60"); return; }
  if (!upi)        { showToast("❌ Enter your UPI ID"); return; }

  try {
    // CHECK BALANCE — but do NOT deduct yet
    const userRef  = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    const wallet   = Number(userSnap.data()?.wallet || 0);

    if (wallet < amount) {
      showToast("❌ Insufficient balance");
      return;
    }

    // CHECK: no duplicate pending request
    const pendingSnap = await getDocs(query(
      collection(db, "withdrawRequests"),
      where("userId", "==", currentUser.uid),
      where("status", "==", "pending")
    ));
    if (!pendingSnap.empty) {
      showToast("⚠️ You already have a pending withdrawal request");
      return;
    }

    // SAVE REQUEST ONLY — wallet stays untouched until admin approves
    await addDoc(collection(db, "withdrawRequests"), {
      userEmail:     currentUser.email,
      userId:        currentUser.uid,
      amount,
      upi,
      status:        "pending",
      rejectReason:  "",
      walletDeducted: false,  // will be set true when admin approves
      time:          new Date().toLocaleString(),
      createdAt:     Date.now()
    });

    showToast("✅ Withdrawal request submitted! Wait for admin approval.");
    document.getElementById("amount").value = "";
    document.getElementById("upi").value    = "";
    await loadWallet();
    await loadWithdrawHistory();

  } catch(e) {
    console.error(e);
    showToast("Error: " + e.message);
  }
};