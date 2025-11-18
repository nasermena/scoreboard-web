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

    // مراجع الحقول
    const playersInput = document.getElementById("setup-players");
    const roundsInput  = document.getElementById("setup-rounds");
    const setupBtn     = document.getElementById("setup-continue");

    // دالة تحقّق رقم صحيح ضمن مدى
    function isIntInRange(raw, min, max){
      if (raw === "" || raw === null || raw === undefined) return false;
      const n = parseInt(raw, 10);
      return Number.isInteger(n) && n >= min && n <= max;
    }

    // تحديث حالة زر المتابعة
    function updateSetupContinue(){
      const okPlayers = isIntInRange(playersInput.value, 2, 6);
      const okRounds  = isIntInRange(roundsInput.value, 1, 5);
      const ok = okPlayers && okRounds;

      setupBtn.disabled = !ok;
      setupBtn.classList.toggle("opacity-50", !ok);
      setupBtn.classList.toggle("cursor-not-allowed", !ok);
    }

    // استماع لتغيّر الإدخال
    playersInput.addEventListener("input", updateSetupContinue);
    roundsInput.addEventListener("input", updateSetupContinue);

    // استدعاء أولي
    updateSetupContinue();

    document.getElementById("setup-continue").addEventListener("click", () => {
      const nPlayers = parseInt(playersInput.value, 10);
      const nRounds  = parseInt(roundsInput.value, 10);

      if (!isIntInRange(playersInput.value, 2, 6) || !isIntInRange(roundsInput.value, 1, 5)) {
        alert("أدخل أعداداً صحيحة: عدد اللاعبين بين 2 و6، وعدد الجولات بين 1 و5.");
        return;
      }
    });

    // ======= UI Bindings =======

    // Setup
    $("#setup-continue").addEventListener("click", () => {
      const nPlayers = parseInt($("#setup-players").value,10);
      const nRounds  = parseInt($("#setup-rounds").value,10);
      if (nPlayers < 2 || nPlayers > 6) return alert("عدد اللاعبين يجب أن يكون بين 2 و6.");
      if (nRounds < 1 || nRounds > 5) return alert("عدد الجولات يجب أن يكون بين 1 و5.");

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
          <td class="p-2 border text-center"><input type="number" class="border rounded-xl p-2 w-24 text-center" id="ri-score-${idx}" value="0" inputmode="numeric"  pattern="[0-9]*"/></td>
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

  // ===== End game rendering =====
function renderEndGame(){
  // تحديث رقم القيم وعرض ترتيب النهاية (الأقل → الأكثر)
  document.getElementById("eg-index").textContent = S.gameIndex;
  const body = document.getElementById("eg-rank-body");
  body.innerHTML = "";
  const sorted = sortPointsAsc(playersMap());
  sorted.forEach(([name, pts]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="border px-2 py-2 sm:px-3 sm:py-2 text-right">${name}</td>
      <td class="border px-2 py-2 sm:px-3 sm:py-2 text-center">${pts}</td>
    `;
    body.appendChild(tr);
  });
  colorizeRows(body);

  // إعادة ضبط العرض: أظهر بطاقة "بدء قيم جديد؟" وأخفِ بطاقتي اللاعبين والجولات
  const primaryCard = document.getElementById("eg-primary-card");
  primaryCard.classList.remove("hidden");
  primaryCard.style.display = "";

  const playersFlow = document.getElementById("eg-players-flow");
  playersFlow.classList.add("hidden");
  playersFlow.style.display = "none";

  const roundsFlow = document.getElementById("eg-rounds-flow");
  roundsFlow.classList.add("hidden");
  roundsFlow.style.display = "none";

  // تصفير واجهات التحكم الداخلية
  resetPlayersFlowUI();
  resetRoundsFlowUI();
}


  // افتح “هل تريد بدء قيم جديد؟” → نعم
document.getElementById("eg-yes").addEventListener("click", (e)=>{
  e.preventDefault();
  const primary = document.getElementById("eg-primary-card");
  const pflow   = document.getElementById("eg-players-flow");
  const rflow   = document.getElementById("eg-rounds-flow");

  if (primary){ primary.classList.add("hidden"); primary.style.display = "none"; }
  if (rflow){   rflow.classList.add("hidden");   rflow.style.display   = "none"; }

  if (pflow){
    pflow.classList.remove("hidden");
    pflow.style.display = "";
    pflow.scrollIntoView({behavior:"smooth", block:"start"});
  }
});



  $("#eg-no-summary").addEventListener("click", ()=>{
    renderSummary();
    showPage("page-summary");
  });

  // ===== Players flow =====
function resetPlayersFlowUI(){
  const q = document.getElementById("eg-p-question");
  if (q){ q.style.display = ""; q.classList.remove("hidden"); }

  document.getElementById("eg-p-controls").classList.add("hidden");
  document.getElementById("eg-p-add-wrap").classList.add("hidden");
  document.getElementById("eg-p-remove-wrap").classList.add("hidden");
  document.getElementById("eg-p-add-names-form").classList.add("hidden");
  document.getElementById("eg-p-add-names-actions").classList.add("hidden");
  document.getElementById("eg-p-add-names-form").innerHTML = "";

  // إعادة تفعيل زر المتابعة وحقل العدد
  const cntInput = document.getElementById("eg-p-add-count");
  const btn      = document.getElementById("eg-p-add-continue");
  if (cntInput){
    cntInput.disabled = false;
    cntInput.classList.remove("opacity-50","cursor-not-allowed");
    cntInput.value = "";
  }
  if (btn){
    btn.disabled = false;
    btn.classList.remove("opacity-50","cursor-not-allowed");
  }

  // إظهار رسالة الحالة وأزرار التحكم عند الفتح التالي
  const status = document.getElementById("eg-p-status");
  if (status){ status.classList.remove("hidden"); status.textContent = ""; }
  document.getElementById("eg-p-add").classList.remove("hidden");
  document.getElementById("eg-p-remove").classList.remove("hidden");
}




function startPlayersFlow(){
  const primary = document.getElementById("eg-primary-card");
  if (primary){ primary.classList.add("hidden"); primary.style.display = "none"; }

  const pflow = document.getElementById("eg-players-flow");
  pflow.classList.remove("hidden");
  pflow.style.display = "";

  // عند كل فتح، نرجّع السؤال ظاهر ونخفي التحكّم
  resetPlayersFlowUI();
}


  // سؤال: هل تريد تغيير عدد اللاعبين؟
document.getElementById("eg-p-yes").addEventListener("click", ()=>{
  // أظهر عناصر التحكم
  document.getElementById("eg-p-controls").classList.remove("hidden");

  // إظهار رسالة الحالة (قد تكون مخفية من خطوة سابقة)
  const status = document.getElementById("eg-p-status");
  status.classList.remove("hidden");

  const count = S.players.length;
  const maxTotal = 6, minTotal = 2;
  const canAdd = count < maxTotal;
  const canRemove = count > minTotal;

  const maxAdd = Math.max(0, maxTotal - count);
  const maxRemove = Math.max(0, count - minTotal);

  const st = [];
  st.push(`عدد اللاعبين الحالي: ${count}`);
  if (canAdd)    st.push(`يمكنك إضافة حتى ${maxAdd} لاعب${maxAdd===1?'':'ين'}.`);
  if (canRemove) st.push(`يمكنك الإزالة حتى ${maxRemove} لاعب${maxRemove===1?'':'ين'}.`);
  if (!canAdd)   st.push("لا يمكنك الإضافة (الحد الأقصى 6).");
  if (!canRemove)st.push("لا يمكنك الإزالة (الحد الأدنى 2).");
  status.textContent = st.join(" | ");

  document.getElementById("eg-p-add").classList.toggle("hidden", !canAdd);
  document.getElementById("eg-p-remove").classList.toggle("hidden", !canRemove);

  // إخفِ العنوان+الأزرار
  const q = document.getElementById("eg-p-question");
  if (q){ q.classList.add("hidden"); q.style.display = "none"; }

  // إخفِ أي أقسام فرعية مفتوحة
  document.getElementById("eg-p-add-wrap").classList.add("hidden");
  document.getElementById("eg-p-remove-wrap").classList.add("hidden");
  document.getElementById("eg-p-add-names-form").classList.add("hidden");
  document.getElementById("eg-p-add-names-actions").classList.add("hidden");
  document.getElementById("eg-p-add-names-form").innerHTML = "";
});




  document.getElementById("eg-p-no").addEventListener("click", ()=>{
    // أخفِ بطاقة البداية بالكامل
    const primary = document.getElementById("eg-primary-card");
    if (primary){
      primary.classList.add("hidden");
      primary.style.display = "none";
    }

    // أخفِ بطاقة تغيير عدد اللاعبين بالكامل
    const pflow = document.getElementById("eg-players-flow");
    if (pflow){
      pflow.classList.add("hidden");
      pflow.style.display = "none";
    }

    // أظهر بطاقة تغيير عدد الجولات فقط
    startRoundsFlow();
  });


  document.getElementById("eg-p-cancel").addEventListener("click", ()=>{
    document.getElementById("eg-players-flow").classList.add("hidden");
    resetPlayersFlowUI();

    const card = document.getElementById("eg-primary-card");
    card.style.display = "";                 // إزالة inline style
    card.classList.remove("hidden");
  });

    document.getElementById("eg-p-cancel").addEventListener("click", ()=>{
    document.getElementById("eg-rounds-flow").classList.add("hidden");
    resetPlayersFlowUI();

    const card = document.getElementById("eg-primary-card");
    card.style.display = "";                 // إزالة inline style
    card.classList.remove("hidden");
  });

  // إضافة لاعبين
document.getElementById("eg-p-add").addEventListener("click", ()=>{
  // أخفِ جملة الحالة وأزرار التحكم
  document.getElementById("eg-p-status").classList.add("hidden");
  document.getElementById("eg-p-add").classList.add("hidden");
  document.getElementById("eg-p-remove").classList.add("hidden");

  // أظهر قسم "كم لاعب تريد إضافته؟"
  const count = S.players.length;
  const maxAdd = Math.max(0, 6 - count);
  const wrap = document.getElementById("eg-p-add-wrap");
  wrap.classList.remove("hidden");
  document.getElementById("eg-p-add-hint").textContent = `(يمكنك إضافة حتى ${maxAdd})`;
  const inp = document.getElementById("eg-p-add-count");
  inp.value = "";
  inp.min = "1";
  inp.max = String(maxAdd);
});


document.getElementById("eg-p-add-continue").addEventListener("click", ()=>{
  const cntInput = document.getElementById("eg-p-add-count");
  const btn      = document.getElementById("eg-p-add-continue");
  const maxAdd   = parseInt(cntInput.max, 10) || 0;
  const cnt      = parseInt(cntInput.value || "0", 10);

  if (!cnt || cnt < 1 || cnt > maxAdd) {
    alert(`العدد غير صالح. الحد الأقصى للإضافة: ${maxAdd}.`);
    return;
  }

  // عطّل الإدخال والزر بعد قبول العدد
  btn.disabled = true;
  btn.classList.add("opacity-50","cursor-not-allowed");
  cntInput.disabled = true;
  cntInput.classList.add("opacity-50","cursor-not-allowed");

  // أظهر حقول أسماء اللاعبين فقط
  const form = document.getElementById("eg-p-add-names-form");
  form.innerHTML = "";
  for (let i = 0; i < cnt; i++) {
    const div = document.createElement("div");
    div.innerHTML = `
      <label class="block mb-1 text-sm">اسم اللاعب الجديد ${i+1}</label>
      <input type="text" class="w-full border rounded-xl p-2 text-right" id="eg-p-new-${i}" required />
    `;
    form.appendChild(div);
  }
  document.getElementById("eg-p-add-names-actions").classList.remove("hidden");
  form.classList.remove("hidden");
});



  // $("#eg-p-add-names-cancel").addEventListener("click", ()=>{
  //   $("#eg-p-add-names-actions").classList.add("hidden");
  //   $("#eg-p-add-names-form").classList.add("hidden");
  //   $("#eg-p-add-names-form").innerHTML = "";
  // });

document.getElementById("eg-p-add-names-submit").addEventListener("click", ()=>{
  const inputs = Array.from(document.querySelectorAll("#eg-p-add-names-form input"));
  const newNames = inputs.map(i=>i.value.trim()).filter(Boolean);
  if (newNames.length !== inputs.length) return alert("أدخل اسمًا لكل لاعب جديد.");
  const current = new Set(S.players.map(p=>p.name));
  if (newNames.some(n=>current.has(n))) return alert("هناك أسماء موجودة مسبقًا.");

  newNames.forEach(n=>{
    if (!(n in S.summaryTotalPoints)) S.summaryTotalPoints[n] = 0;
    if (!(n in S.summaryWins)) S.summaryWins[n] = 0;
    if (!(n in S.summaryGamesPlayed)) S.summaryGamesPlayed[n] = 0;
    S.players.push({name:n, points:0});
  });
  saveState();

  // أخفِ بطاقة اللاعبين ثم انتقل للجولات
  document.getElementById("eg-players-flow").classList.add("hidden");
  document.getElementById("eg-players-flow").style.display = "none";
  resetPlayersFlowUI();
  startRoundsFlow();
});


  // إزالة لاعبين
document.getElementById("eg-p-remove").addEventListener("click", ()=>{
  // أخفِ جملة الحالة وأزرار التحكم
  document.getElementById("eg-p-status").classList.add("hidden");
  document.getElementById("eg-p-add").classList.add("hidden");
  document.getElementById("eg-p-remove").classList.add("hidden");

  // أظهر نموذج الإزالة فقط
  const wrap = document.getElementById("eg-p-remove-wrap");
  wrap.classList.remove("hidden");
  const form = document.getElementById("eg-p-remove-form");
  form.innerHTML = "";

  S.players.forEach((p, idx)=>{
    const row = document.createElement("div");
    row.className = "flex items-center gap-2";
    row.innerHTML = `
      <input type="checkbox" id="eg-p-rem-${idx}" />
      <label for="eg-p-rem-${idx}" class="text-sm">${p.name}</label>
    `;
    form.appendChild(row);
  });

  form.onchange = ()=>{
    const checks = Array.from(form.querySelectorAll("input[type='checkbox']"));
    const checked = checks.filter(c=>c.checked).length;
    const maxRemove = Math.max(0, S.players.length - 2);
    if (checked > maxRemove){
      // ألغي آخر اختيار
      const active = document.activeElement;
      if (active && active.type==="checkbox") active.checked = false;
      alert(`لا يمكن إزالة أكثر من ${maxRemove} لاعبين (يجب أن يبقى على الأقل 2).`);
    }
  };
});


document.getElementById("eg-p-remove-save").addEventListener("click", ()=>{
  const form = document.getElementById("eg-p-remove-form");
  const checks = Array.from(form.querySelectorAll("input[type='checkbox']"));
  const toRemoveIdx = checks.map((c,i)=> c.checked ? i : -1).filter(i=>i>=0);
  const maxRemove = Math.max(0, S.players.length - 2);
  if (toRemoveIdx.length > maxRemove) return alert(`لا يمكن إزالة أكثر من ${maxRemove} لاعبين.`);

  const remain = S.players.filter((_,i)=> !toRemoveIdx.includes(i));
  if (remain.length < 2) return alert("يجب أن يبقى على الأقل لاعبان.");

  S.players = remain.map(p=>({name:p.name, points:0}));
  saveState();

  // أخفِ بطاقة اللاعبين ثم انتقل للجولات
  document.getElementById("eg-players-flow").classList.add("hidden");
  document.getElementById("eg-players-flow").style.display = "none";
  resetPlayersFlowUI();
  startRoundsFlow();
});

  // ===== Rounds flow =====
  function resetRoundsFlowUI(){
    $("#eg-r-controls").classList.add("hidden");
    $("#eg-r-add-wrap").classList.add("hidden");
    $("#eg-r-remove-wrap").classList.add("hidden");
    $("#eg-start-new").classList.add("hidden");
  }

  function startRoundsFlow(){
    const rflow = document.getElementById("eg-rounds-flow");
    rflow.classList.remove("hidden");
    rflow.style.display = ""; // تأكيد إظهار البطاقة
  }

  $("#eg-r-yes").addEventListener("click", ()=>{
    $("#eg-r-controls").classList.remove("hidden");

    const n = S.totalRounds;
    const maxTotal = 5, minTotal = 1;
    const canAdd = n < maxTotal;
    const canRemove = n > minTotal;

    // رسائل الحالة
    const st = [];
    st.push(`عدد الجولات الحالي: ${n}`);
    if (canAdd)   st.push(`يمكنك الزيادة حتى ${maxTotal}.`);
    if (canRemove)st.push(`يمكنك التخفيض حتى ${minTotal}.`);
    if (!canAdd)  st.push("لا يمكنك الإضافة (وصلت للحد الأقصى 5).");
    if (!canRemove)st.push("لا يمكنك الإزالة (الحد الأدنى 1).");
    $("#eg-r-status").textContent = st.join(" | ");

    // إظهار الأزرار
    $("#eg-r-add").classList.toggle("hidden", !canAdd);
    $("#eg-r-remove").classList.toggle("hidden", !canRemove);
  });

  $("#eg-r-no").addEventListener("click", ()=>{
    // بدون تغيير الجولات → ابدأ القيم الجديدة مباشرة
    finalizeStartNewGame();
  });

  // إضافة جولات: ضع العدد الجديد (>= القديم وبحده الأقصى 5)
  $("#eg-r-add").addEventListener("click", ()=>{
    $("#eg-r-add-wrap").classList.remove("hidden");
    const cur = S.totalRounds;
    const inp = $("#eg-r-add-new");
    inp.value = "";
    inp.min = String(cur);
    inp.max = "5";
    $("#eg-r-add-hint").textContent = `(القديم: ${cur}, الحد الأقصى: 5)`;
  });

  $("#eg-r-add-save").addEventListener("click", ()=>{
    const cur = S.totalRounds;
    const v = parseInt($("#eg-r-add-new").value||"0",10);
    if (!v || v < cur || v > 5) return alert(`يجب أن يكون العدد الجديد بين ${cur} و 5.`);
    S.totalRounds = v;
    saveState();
    $("#eg-start-new").classList.remove("hidden");
  });

  // إزالة جولات: ضع العدد الجديد (<= القديم وبحده الأدنى 1)
  $("#eg-r-remove").addEventListener("click", ()=>{
    $("#eg-r-remove-wrap").classList.remove("hidden");
    const cur = S.totalRounds;
    const inp = $("#eg-r-remove-new");
    inp.value = "";
    inp.min = "1";
    inp.max = String(cur);
    $("#eg-r-remove-hint").textContent = `(القديم: ${cur}, الحد الأدنى: 1)`;
  });

  $("#eg-r-remove-save").addEventListener("click", ()=>{
    const cur = S.totalRounds;
    const v = parseInt($("#eg-r-remove-new").value||"0",10);
    if (!v || v > cur || v < 1) return alert(`يجب أن يكون العدد الجديد بين 1 و ${cur}.`);
    S.totalRounds = v;
    saveState();
    $("#eg-start-new").classList.remove("hidden");
  });

  // بدء القيم الجديدة بعد الانتهاء من الخطوات
  $("#eg-start-new").addEventListener("click", finalizeStartNewGame);

  function finalizeStartNewGame(){
    S.gameIndex += 1;
    S.currentRound = 1;
    S.roundHistory = [];
    // صفّر نقاط القيم فقط، احتفِظ بالأسماء كما هي بعد التعديل
    S.players = S.players.map(p=>({name:p.name, points:0}));
    saveState();
    renderScoreboard();
    showPage("page-scoreboard");
  }
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
  