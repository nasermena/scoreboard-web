    // ======= تخزين محلي (يمكن إطفاؤه بتعيين USE_STORAGE=false) =======
    const USE_STORAGE = true;
    const KEY = "scoreboard_state_v1";

    const defaultState = () => ({
      totalRounds: 0,
      currentRound: 0,
      players: [],              // [{name, points}]
      gameIndex: 0,
      roundHistory: [],         // [ {name: pts,...}, ... ]
      summaryTotalPoints: {},   // name -> total points across games
      summaryWins: {},          // name -> wins across games
      summaryGamesPlayed: {}    // name -> games played
    });

    let S = loadState();

    function saveState() {
      if (!USE_STORAGE) return;
      localStorage.setItem(KEY, JSON.stringify(S));
    }
    function loadState() {
      if (USE_STORAGE) {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          try { return JSON.parse(raw); } catch {}
        }
      }
      return defaultState();
    }
    function resetSession() {
      S = defaultState();
      saveState();
      showPage("page-setup");
    }

    // ======= Helpers =======
    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);
    function showPage(id) {
      $$("section").forEach(s => s.classList.add("hidden"));
      $("#" + id).classList.remove("hidden");
      window.scrollTo({top:0, behavior:"smooth"});
    }
    function sortPointsAsc(map) {
      // input: {name: points} -> array [ [name, pts], ... ] sorted by (pts asc, name)
      return Object.entries(map).sort((a,b) => (a[1]-b[1]) || a[0].localeCompare(b[0]));
    }
    function playersMap() {
      const m = {};
      S.players.forEach(p => m[p.name] = p.points);
      return m;
    }
    function ensureSummaryNames(names) {
      names.forEach(n => {
        if (!(n in S.summaryTotalPoints)) S.summaryTotalPoints[n] = 0;
        if (!(n in S.summaryWins)) S.summaryWins[n] = 0;
        if (!(n in S.summaryGamesPlayed)) S.summaryGamesPlayed[n] = 0;
      });
    }
    function colorizeRows(tbody) {
      const rows = Array.from(tbody.querySelectorAll("tr"));
      if (rows.length === 0) return;
      rows.forEach((tr,i) => {
        tr.classList.remove("leader","last","odd","even");
        if (i===0) tr.classList.add("leader");
        if (i===rows.length-1 && rows.length>1) tr.classList.add("last");
        tr.classList.add(i%2 ? "odd":"even");
      });
    }

    // ======= UI Bindings =======

    // Setup
    $("#setup-continue").addEventListener("click", () => {
      const nPlayers = parseInt($("#setup-players").value,10);
      const nRounds  = parseInt($("#setup-rounds").value,10);
      if (!nPlayers || nPlayers<1 || !nRounds || nRounds<1) return alert("أدخل أعداداً صحيحة موجبة.");

      // Build names form
      $("#names-form").innerHTML = "";
      for (let i=0;i<nPlayers;i++){
        const row = document.createElement("div");
        row.innerHTML = `
          <label class="block mb-1">اسم اللاعب ${i+1}</label>
          <input type="text" id="name-${i}" class="w-full border rounded-xl p-2 text-right" required />
        `;
        $("#names-form").appendChild(row);
      }
      $("#names-rounds-badge").textContent = nRounds;
      $("#names-start").onclick = () => {
        const names = [];
        for (let i=0;i<nPlayers;i++){
          const v = $("#name-"+i).value.trim();
          if (!v) return alert("الرجاء إدخال اسم لكل لاعب.");
          names.push(v);
        }
        if ((new Set(names)).size !== names.length) return alert("هناك أسماء مكررة. اجعل كل اسم فريداً.");

        S.totalRounds = nRounds;
        S.currentRound = 1;
        S.players = names.map(n => ({name:n, points:0}));
        S.gameIndex = 1;
        S.roundHistory = [];
        ensureSummaryNames(names);
        saveState();
        renderScoreboard();
        showPage("page-scoreboard");
      };
      showPage("page-names");
    });

    // Back buttons
    $$(".btn-back").forEach(btn=>{
      btn.addEventListener("click",()=>{
        showPage(btn.dataset.backTo);
      });
    });

    // Scoreboard rendering
    function renderScoreboard(){
      $("#game-index").textContent = S.gameIndex;

    // header players in rounds table
    const headRow = document.getElementById("rounds-head-row");
    // امسح أي أعمدة لاعبين قديمة (اترك أول th كما هو)
    while (headRow.children.length > 1) headRow.removeChild(headRow.lastElementChild);

    // أضف th لكل لاعب داخل نفس الصف
    S.players.forEach(p => {
      const th = document.createElement("th");
      th.className = "p-2 border";
      th.textContent = p.name;
      headRow.appendChild(th);
    });

      // body rounds
      const rb = $("#rounds-body");
      rb.innerHTML = "";
      S.roundHistory.forEach((roundMap, idx)=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `<td class="p-2 border text-center">${idx+1}</td>`;
        S.players.forEach(p=>{
          const td = document.createElement("td");
          td.className = "p-2 border text-center";
          td.textContent = roundMap[p.name] ?? 0;
          tr.appendChild(td);
        });
        rb.appendChild(tr);
      });
      colorizeRows(rb);

      // rank table (least first)
      const map = playersMap();
      const sorted = sortPointsAsc(map);
      const rankBody = $("#rank-body");
      rankBody.innerHTML = "";
      sorted.forEach(([name,pts], i)=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="p-2 border text-center">${i+1}</td>
          <td class="p-2 border text-right">${name}</td>
          <td class="p-2 border text-center">${pts}</td>
        `;
        rankBody.appendChild(tr);
      });
      colorizeRows(rankBody);

      // round label + button text
      $("#current-round").textContent = S.currentRound + (S.currentRound===S.totalRounds ? " (الأخيرة)" : "");
      $("#finish-round").textContent = (S.currentRound===S.totalRounds) ? "إنهاء القيم" : "إنهاء الجولة";
    }

    // Finish round -> go to round input
    $("#finish-round").addEventListener("click", ()=>{
      renderRoundInput();
      showPage("page-round-input");
    });

    function renderRoundInput(){
      $("#round-input-title").textContent = (S.currentRound===S.totalRounds) ? "إدخال نقاط الجولة (الأخيرة)" : "إدخال نقاط الجولة";
      $("#ri-round").textContent = S.currentRound;
      $("#ri-rounds").textContent = S.totalRounds;
      $("#ri-game").textContent = S.gameIndex;

      const tbody = $("#round-input-body");
      tbody.innerHTML = "";
      S.players.forEach((p, idx)=>{
        const tr = document.createElement("tr");
        tr.className = (idx%2 ? "odd":"even");
        tr.innerHTML = `
          <td class="p-2 border text-right">${p.name}</td>
          <td class="p-2 border text-center"><input type="number" class="border rounded-xl p-2 w-24 text-center" id="ri-score-${idx}" value="0"/></td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Confirm round points
    $("#round-confirm").addEventListener("click", ()=>{
      const addMap = {};
      S.players.forEach((p,idx)=>{
        const v = parseInt( ($("#ri-score-"+idx).value||"0"), 10);
        addMap[p.name] = isNaN(v) ? 0 : v;
      });

      // Update totals
      S.players = S.players.map(p => ({...p, points: p.points + (addMap[p.name]||0)}));
      S.roundHistory.push(addMap);
      saveState();

      // Next step
      if (S.currentRound < S.totalRounds){
        S.currentRound += 1;
        saveState();
        renderScoreboard();
        showPage("page-scoreboard");
      } else {
        // End game
        // + games played
        S.players.forEach(p=>{
          S.summaryGamesPlayed[p.name] = (S.summaryGamesPlayed[p.name]||0) + 1;
        });
        // winners (min points)
        const sorted = sortPointsAsc(playersMap());
        const minPts = sorted[0]?.[1] ?? 0;
        sorted.forEach(([name,pts])=>{
          if (pts===minPts){
            S.summaryWins[name] = (S.summaryWins[name]||0) + 1;
          }
        });
        // total points to summary
        S.players.forEach(p=>{
          S.summaryTotalPoints[p.name] = (S.summaryTotalPoints[p.name]||0) + p.points;
        });
        saveState();
        renderEndGame();
        showPage("page-end-game");
      }
    });

    // End game page
    function renderEndGame(){
      $("#eg-index").textContent = S.gameIndex;
      const body = $("#eg-rank-body");
      body.innerHTML = "";
      const sorted = sortPointsAsc(playersMap());
      sorted.forEach(([name,pts],i)=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="p-2 border text-right">${name}</td>
          <td class="p-2 border text-center">${pts}</td>
        `;
        body.appendChild(tr);
      });
      colorizeRows(body);

      // reset secondary box
      $("#eg-add-box").classList.add("hidden");
      $("#eg-primary").classList.remove("hidden");
      $("#eg-add-count-wrap").classList.add("hidden");
      $("#eg-add-names-form").classList.add("hidden");
      $("#eg-add-names-actions").classList.add("hidden");
      $("#eg-add-names-form").innerHTML = "";
    }

    $("#eg-yes").addEventListener("click", ()=>{
      // hide primary question, show add players box
      $("#eg-primary").classList.add("hidden");
      $("#eg-add-box").classList.remove("hidden");
    });
    $("#eg-add-cancel").addEventListener("click", ()=>{
      // return to primary question
      $("#eg-add-box").classList.add("hidden");
      $("#eg-primary").classList.remove("hidden");
    });
    $("#eg-no-summary").addEventListener("click", ()=>{
      renderSummary();
      showPage("page-summary");
    });

    $("#eg-add-yes").addEventListener("click", ()=>{
      $("#eg-add-count-wrap").classList.remove("hidden");
      $("#eg-add-names-form").classList.add("hidden");
      $("#eg-add-names-actions").classList.add("hidden");
      $("#eg-add-names-form").innerHTML = "";
    });
    $("#eg-add-count-continue").addEventListener("click", ()=>{
      const c = parseInt($("#eg-add-count").value,10);
      if (!c || c<1 || c>50) return alert("رقم غير صالح.");
      const form = $("#eg-add-names-form");
      form.innerHTML = "";
      for (let i=0;i<c;i++){
        const div = document.createElement("div");
        div.innerHTML = `
          <label class="block mb-1">اسم اللاعب الجديد ${i+1}</label>
          <input type="text" class="w-full border rounded-xl p-2 text-right" id="eg-new-${i}" required />
        `;
        form.appendChild(div);
      }
      $("#eg-add-names-actions").classList.remove("hidden");
      form.classList.remove("hidden");
    });
    $("#eg-add-names-cancel").addEventListener("click", ()=>{
      $("#eg-add-count-wrap").classList.add("hidden");
      $("#eg-add-names-form").classList.add("hidden");
      $("#eg-add-names-actions").classList.add("hidden");
      $("#eg-add-names-form").innerHTML = "";
    });
    $("#eg-add-names-submit").addEventListener("click", ()=>{
      // collect names
      const inputs = Array.from($$("#eg-add-names-form input"));
      const newNames = inputs.map(i=>i.value.trim()).filter(Boolean);
      if (newNames.length !== inputs.length) return alert("يجب إدخال اسم لكل لاعب جديد.");
      const current = new Set(S.players.map(p=>p.name));
      if (newNames.some(n=>current.has(n))) return alert("هناك أسماء موجودة مسبقاً. أدخل أسماء جديدة غير مكررة.");

      // add players
      newNames.forEach(n=>{
        if (!(n in S.summaryTotalPoints)) S.summaryTotalPoints[n] = 0;
        if (!(n in S.summaryWins)) S.summaryWins[n] = 0;
        if (!(n in S.summaryGamesPlayed)) S.summaryGamesPlayed[n] = 0;
        S.players.push({name:n, points:0});
      });

      // start new game with updated list
      S.gameIndex += 1;
      S.currentRound = 1;
      S.roundHistory = [];
      S.players = S.players.map(p=>({name:p.name, points:0}));
      saveState();
      renderScoreboard();
      showPage("page-scoreboard");
    });
    $("#eg-add-no").addEventListener("click", ()=>{
      // same players, just new game
      S.gameIndex += 1;
      S.currentRound = 1;
      S.roundHistory = [];
      S.players = S.players.map(p=>({name:p.name, points:0}));
      saveState();
      renderScoreboard();
      showPage("page-scoreboard");
    });

    // Summary page
    function renderSummary(){
      // wins rows: تصاعدي = الأكثر → الأقل
      const allNames = new Set([
        ...Object.keys(S.summaryTotalPoints),
        ...Object.keys(S.summaryWins),
        ...Object.keys(S.summaryGamesPlayed),
        ...S.players.map(p=>p.name)
      ]);

      const winsRows = Array.from(allNames).map(n=>({
        name:n,
        wins:S.summaryWins[n]||0,
        games:S.summaryGamesPlayed[n]||0
      })).sort((a,b)=> (b.wins - a.wins) || a.name.localeCompare(b.name));

      const wb = $("#sum-wins-body");
      wb.innerHTML = "";
      winsRows.forEach((r,i)=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="p-2 border text-right">${r.name}</td>
          <td class="p-2 border text-center">${r.wins}</td>
          <td class="p-2 border text-center">${r.games}</td>
        `;
        wb.appendChild(tr);
      });
      colorizeRows(wb);

      // total points rows: تنازلي = الأقل → الأكثر
      const sumRows = Array.from(allNames).map(n=>({
        name:n,
        sum:S.summaryTotalPoints[n]||0,
        games:S.summaryGamesPlayed[n]||0
      })).sort((a,b)=> (a.sum - b.sum) || a.name.localeCompare(b.name));

      const pb = $("#sum-points-body");
      pb.innerHTML = "";
      sumRows.forEach((r,i)=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="p-2 border text-right">${r.name}</td>
          <td class="p-2 border text-center">${r.sum}</td>
          <td class="p-2 border text-center">${r.games}</td>
        `;
        pb.appendChild(tr);
      });
      colorizeRows(pb);
    }
    $("#reset-session").addEventListener("click", resetSession);

    // ======= Launch =======
    // ابدأ من الوضع الحالي إن وُجد، وإلا ارجع للإعداد
    (function init(){
      if (S.currentRound>0 && S.players.length>0) {
        renderScoreboard();
        showPage("page-scoreboard");
      } else {
        showPage("page-setup");
      }
    })();
  