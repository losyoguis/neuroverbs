document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("leaderboard");
  fetch(NEUROVERBS_SHEETS.WEB_APP_URL + "?action=leaderboard&limit=50")
    .then(r => r.json())
    .then(data => {
      container.innerHTML = "";
      data.rows.forEach(u => {
        const row = document.createElement("div");
        row.className = "rank-row";
        if (u.rank === 1) row.classList.add("gold");
        if (u.rank === 2) row.classList.add("silver");
        if (u.rank === 3) row.classList.add("bronze");
        row.innerHTML = `
          <span class="rank">#${u.rank}</span>
          <img src="${u.picture}" />
          <span class="name">${u.name}</span>
          <span class="xp">${u.xp} XP</span>
        `;
        container.appendChild(row);
      });
    })
    .catch(err => {
      container.innerHTML = "<p>Error cargando ranking</p>";
      console.error(err);
    });
});