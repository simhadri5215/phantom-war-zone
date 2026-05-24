import {
  db,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc
} from "./firebase-config.js";

// UPLOAD RESULT
window.uploadResult =
async function(){

  const winnerEmail =
  document.getElementById("winnerEmail").value;

  const matchName =
  document.getElementById("matchName").value;

  const winningAmount =
  Number(
    document.getElementById("winningAmount").value
  );

  try{

    // FIND USER
    const q = query(
      collection(db, "users"),
      where("email", "==", winnerEmail)
    );

    const querySnapshot =
    await getDocs(q);

    if(querySnapshot.empty){

      alert("User Not Found");

      return;
    }

    // GET USER DOC
    const userDoc =
    querySnapshot.docs[0];

    const userData =
    userDoc.data();

    let wallet =
    userData?.wallet || 0;

    // ADD WINNING
    wallet += winningAmount;

    // UPDATE WALLET
    await updateDoc(
      doc(db, "users", userDoc.id),
      {

        wallet: wallet

      }
    );
    // SAVE TRANSACTION
await addDoc(
  collection(db, "transactions"),
  {

    userId:
    userDoc.id,

    type:
    "credit",

    amount:
    winningAmount,

    message:
    `Won ${matchName}`,

    time:
    new Date().toLocaleString()

  }
);

    // SAVE RESULT
    await addDoc(
      collection(db, "results"),
      {

        winnerEmail:
        winnerEmail,

        matchName:
        matchName,

        winningAmount:
        winningAmount

      }
    );

    alert("Winner Uploaded");

  }catch(error){

    alert(error.message);

  }

}