import {
  db,
  collection,
  getDocs
} from "./firebase-config.js";

const winnersContainer =
document.getElementById("winnersContainer");

// LOAD WINNERS
async function loadWinners(){

  const querySnapshot =
  await getDocs(collection(db, "results"));

  querySnapshot.forEach((docItem) => {

    const result =
    docItem.data();

    winnersContainer.innerHTML += `

      <div class="card">

        <h3>
          ${result.winnerEmail}
        </h3>

        <p>
          Match:
          ${result.matchName}
        </p>

        <p>
          Won:
          ₹${result.winningAmount}
        </p>

      </div>

    `;

  });

}

loadWinners();