import {
  auth,
  db,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  onAuthStateChanged
} from "./firebase-config.js";

let currentUser = null;

// CHECK LOGIN
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadUpiId();
    checkDepositTiming();
  } else {
    window.location.href = "login.html";
  }
});

// LOAD UPI ID FROM FIREBASE
async function loadUpiId() {
  try {
    const snap = await getDocs(collection(db, "settings"));
    if (!snap.empty) {
      const settings = snap.docs[0].data();
      const upiId = settings.upiId || "Not set by admin";
      document.getElementById("upiIdText").innerText = upiId;
    } else {
      document.getElementById("upiIdText").innerText = "Contact admin for UPI";
    }
  } catch (e) {
    document.getElementById("upiIdText").innerText = "Contact admin for UPI";
  }
}

// CHECK DEPOSIT TIMING (8 AM - 9 PM)
function checkDepositTiming() {
  const now  = new Date();
  const hour = now.getHours();
  const isOpen = hour >= 8 && hour < 21; // 8am to 9pm

  if (!isOpen) {
    document.getElementById("depositForm").innerHTML = `
      <div style="text-align:center;padding:20px;">
        <div style="font-size:50px;margin-bottom:15px;">🔒</div>
        <h2 style="color:#ff4444;">Deposits Closed</h2>
        <p style="color:#aaa;margin-top:10px;">
          Deposit window is<br/>
          <strong style="color:#00ffd5;">8:00 AM – 9:00 PM</strong> only
        </p>
        <p style="color:#aaa;margin-top:10px;">Please come back during deposit hours.</p>
      </div>
    `;
  }
}

// COPY UPI
window.copyUPI = function () {
  const upi = document.getElementById("upiIdText").innerText;
  navigator.clipboard.writeText(upi);
  showToast("UPI ID Copied!");
};

// SUBMIT DEPOSIT
window.submitDeposit = async function () {
  const amount    = Number(document.getElementById("amount").value);
  const utrNumber = document.getElementById("utrNumber").value.trim();
  const screenshot = document.getElementById("screenshot").files[0];

  // TIMING CHECK
  const hour = new Date().getHours();
  if (hour < 8 || hour >= 21) {
    showToast("❌ Deposits only allowed 8 AM – 9 PM");
    return;
  }

  // MINIMUM CHECK
  if (!amount || amount < 30) {
    showToast("❌ Minimum deposit is ₹30");
    return;
  }

  // UTR CHECK
  if (!utrNumber) {
    showToast("❌ Enter UTR / Transaction Number");
    return;
  }

  // SCREENSHOT CHECK
  if (!screenshot) {
    showToast("❌ Upload payment screenshot");
    return;
  }

  try {
    // CHECK FOR EXISTING PENDING REQUEST
    const pendingSnap = await getDocs(query(
      collection(db, "depositRequests"),
      where("userId", "==", currentUser.uid),
      where("status", "==", "pending")
    ));
    if (!pendingSnap.empty) {
      showToast("⚠️ You already have a pending deposit request. Wait for admin to approve it.");
      return;
    }

    // CONVERT SCREENSHOT TO BASE64
    const base64 = await fileToBase64(screenshot);

    // SAVE DEPOSIT REQUEST TO FIREBASE
    await addDoc(collection(db, "depositRequests"), {
      userId:     currentUser.uid,
      userEmail:  currentUser.email,
      amount:     amount,
      utrNumber:  utrNumber,
      screenshot: base64,
      status:     "pending",
      time:       new Date().toLocaleString(),
      createdAt:  Date.now()
    });

    // SHOW SUCCESS POPUP
    document.getElementById("successPopup").style.display = "flex";

    // CLEAR FORM
    document.getElementById("amount").value    = "";
    document.getElementById("utrNumber").value = "";
    document.getElementById("screenshot").value = "";

  } catch (e) {
    console.error(e);
    showToast("Error submitting request: " + e.message);
  }
};

// CLOSE POPUP
window.closePopup = function () {
  document.getElementById("successPopup").style.display = "none";
  window.location.href = "dashboard.html";
};

// FILE TO BASE64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// TOAST
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerText = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}