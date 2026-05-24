import {
  auth, db,
  collection, getDocs, query, where,
  onAuthStateChanged
} from "./firebase-config.js";

const container = document.getElementById("historyContainer");
let allTransactions = [];

onAuthStateChanged(auth, async (user) => {
  if (user) await loadHistory(user);
  else window.location.href = "login.html";
});

async function loadHistory(user) {
  container.innerHTML = "<p style='padding:20px;color:#aaa;'>Loading...</p>";
  try {
    // No orderBy — avoids composite index requirement
    const snap = await getDocs(query(
      collection(db, "transactions"),
      where("userId", "==", user.uid)
    ));
    // Sort client-side instead
    allTransactions = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    updateSummary();
    applyFilters();
  } catch(e) {
    container.innerHTML = `<p style='color:red;padding:20px;'>${e.message}</p>`;
  }
}

function updateSummary() {
  const totalCredit = allTransactions.filter(t => t.type === "credit").reduce((s,t) => s + Number(t.amount||0), 0);
  const totalDebit  = allTransactions.filter(t => t.type === "debit") .reduce((s,t) => s + Number(t.amount||0), 0);
  const el1 = document.getElementById("totalCredit");
  const el2 = document.getElementById("totalDebit");
  if (el1) el1.innerText = `₹${totalCredit}`;
  if (el2) el2.innerText = `₹${totalDebit}`;
}

window.applyFilters = function () {
  const filter   = window.currentFilter || "all";
  const fromVal  = document.getElementById("dateFrom")?.value;
  const toVal    = document.getElementById("dateTo")?.value;
  const fromDate = fromVal ? new Date(fromVal).setHours(0,0,0,0)    : null;
  const toDate   = toVal   ? new Date(toVal).setHours(23,59,59,999) : null;

  const filtered = allTransactions.filter(tx => {
    if (filter !== "all" && tx.type !== filter) return false;
    if (fromDate && tx.createdAt < fromDate)    return false;
    if (toDate   && tx.createdAt > toDate)      return false;
    return true;
  });

  container.innerHTML = "";
  if (filtered.length === 0) {
    container.innerHTML = `<div class="no-tx"><div style="font-size:40px;margin-bottom:10px;">📭</div><p>No transactions found</p></div>`;
    return;
  }
  filtered.forEach(tx => {
    const isCredit = tx.type === "credit";
    container.innerHTML += `
      <div class="tx-card">
        <div class="tx-icon ${tx.type}">${isCredit ? "✅" : "🔴"}</div>
        <div class="tx-info">
          <h4>${tx.message || "Transaction"}</h4>
          <p>🕒 ${tx.time || ""}</p>
        </div>
        <div class="tx-amount ${tx.type}">${isCredit ? "+" : "-"}₹${tx.amount}</div>
      </div>`;
  });
};