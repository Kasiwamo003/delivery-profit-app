const supabaseClient = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_PUBLISHABLE_KEY
);
async function checkProStatus() {
  const { data: { user } } = await supabaseClient.auth.getUser();

const authBox = $("authBox");
const logoutBtn = $("logoutBtn");
const authStatus = $("authStatus");
const purchaseButtons = $("proPurchaseButtons");
const proLoginNotice = $("proLoginNotice");
if (!user) {
  if (authBox) authBox.style.display = "";
  if (logoutBtn) logoutBtn.style.display = "none";
  if (authStatus) authStatus.textContent = "";

  applyProStatus(false);
  if (purchaseButtons) purchaseButtons.style.display = "none";
if (proLoginNotice) proLoginNotice.style.display = "";
  return;
}

if (authBox) authBox.style.display = "";
if (logoutBtn) logoutBtn.style.display = "";
if (purchaseButtons) purchaseButtons.style.display = "";
if (proLoginNotice) proLoginNotice.style.display = "none";
  const { data } = await supabaseClient
    .from("profiles")
    .select("is_pro")
    .eq("id", user.id)
    .maybeSingle();

  applyProStatus(data?.is_pro === true);
  if (data?.is_pro === true) {
  await restoreRecordsFromCloud();
}
}
async function restoreRecordsFromCloud() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from("delivery_records")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("クラウド復元失敗", error);
    return;
  }

  if (!data || data.length === 0) return;

  const cloudRecords = data.map(r => ({
    id: Number(r.id),
    date: r.date,
    platform: r.platform,
    sales: Number(r.sales || 0),
    gross: Number(r.gross || 0),
    profit: Number(r.profit || 0),
    hours: Number(r.hours || 0),
    deliveries: Number(r.deliveries || 0),
    distance: Number(r.distance || 0),
    expenses: Number(r.expenses || 0),
    quest: Number(r.quest || 0),
    area: r.area || "",
    timeSlot: r.time_slot || "",
    questTarget: Number(r.quest_target || 0),
    questCurrent: Number(r.quest_current || 0)
  }));

  const localRecords = getRecords();
  const merged = [...cloudRecords, ...localRecords]
    .filter((record, index, array) =>
      index === array.findIndex(r => r.id === record.id)
    );

  setRecords(merged);
  renderHistory();
  renderMonth();
  renderBreakdown();
}
async function sendLoginLink() {
  const email = $("loginEmail").value.trim();

  if (!email) {
    $("authStatus").textContent = "メールアドレスを入力してください";
    return;
  }

  $("authStatus").textContent = "送信中...";

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: "https://kasiwamo003.github.io/delivery-profit-app/"
    }
  });

  if (error) {
    $("authStatus").textContent = error.message;
    return;
  }

  $("authStatus").textContent = "ログイン用メールを送りました";
}
async function startProCheckout(plan) {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    alert("Pro購入にはログインが必要です");
    return;
  }

  const { data, error } = await supabaseClient.functions.invoke(
    "create-checkout",
    {
      body: { plan }
    }
  );

  if (error) {
    let message = "決済画面を開けませんでした";

    try {
      const body = await error.context.json();
      if (body?.error) message = body.error;
    } catch {}

    alert(message);
    return;
  }

  if (data?.url) {
    window.location.href = data.url;
  }
}
const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "delivery-profit-records-v1";
const SETTINGS_KEY = "delivery-profit-settings-v1";

const yen = (n) => "¥" + Math.round(Number(n || 0)).toLocaleString("ja-JP");
const val = (id) => Number($(id).value || 0);
const todayKey = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function getRecords(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function setRecords(records){ localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function getSettings(){
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch { return {}; }
}
function setSettings(s){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

function calcFromForm(){
  const sales = val("sales");
  const hours = val("hours");
  const deliveries = val("deliveries");
  const distance = val("distance");
  const expenses = val("expenses");
  const streakQuest = val("streakQuest");
  const peakQuest = val("peakQuest");
  const otherQuest = val("otherQuest");
  const quest = streakQuest + peakQuest + otherQuest;
  const gross = sales + quest;
  const profit = gross - expenses;
  const hourlyNoQuest = hours > 0 ? (sales - expenses) / hours : 0;
  const hourlyWithQuest = hours > 0 ? profit / hours : 0;
  const boost = hourlyWithQuest - hourlyNoQuest;
  return {sales,hours,deliveries,distance,expenses,streakQuest,peakQuest,otherQuest,quest,gross,profit,hourlyNoQuest,hourlyWithQuest,boost};
}

function refreshLive(){
  const c = calcFromForm();
  $("todayProfit").textContent = yen(c.profit);
  $("deliveryCountMini").textContent = c.deliveries + "件";
$("workHoursMini").textContent = c.hours + "h";
$("distanceMini").textContent = c.distance + "km";
  $("hourlyWithQuest").textContent = yen(c.hourlyWithQuest)+"/h";
  $("hourlyNoQuest").textContent = yen(c.hourlyNoQuest)+"/h";
  $("questBoost").textContent = "+"+yen(Math.max(0,c.boost))+"/h";
  $("questTotal").textContent = yen(c.quest);
  $("grossSales").textContent = yen(c.gross);
  $("perDelivery").textContent = c.deliveries ? yen(c.gross/c.deliveries) : yen(0);
  $("perKm").textContent = c.distance ? yen(c.profit/c.distance) : yen(0);

  const target = val("targetHourly");
  const gap = c.hourlyWithQuest - target;
  $("targetGap").textContent = "目標との差 " + (gap >= 0 ? "+" : "") + yen(gap) + "/h";

  const targetQ = val("questTarget");
  const currentQ = val("questCurrent");
  const p = targetQ > 0 ? Math.min(100, Math.max(0, currentQ / targetQ * 100)) : 0;
  $("questProgressBar").style.width = p + "%";
  $("questProgressText").textContent = Math.round(p) + "%";
  $("questRemaining").textContent = "残り " + Math.max(0, targetQ-currentQ) + "件";
const remainingQ = Math.max(0, targetQ - currentQ);
const deliveryPace = c.hours > 0 ? c.deliveries / c.hours : 0;
const etaQ = deliveryPace > 0 ? remainingQ / deliveryPace : 0;

const proRemaining = $("questRemainingPro");
if (proRemaining) {
  proRemaining.textContent = remainingQ + "件";
}

const proEta = $("questEtaPro");
if (proEta) {
  proEta.textContent =
    remainingQ === 0
      ? "達成"
      : deliveryPace > 0
        ? etaQ.toFixed(1) + "時間"
        : "計算不可";
}
  const proWithQuest = $("proHourlyWithQuest");
if (proWithQuest) {
  proWithQuest.textContent = yen(c.hourlyWithQuest) + "/h";
}

const proNoQuest = $("proHourlyNoQuest");
if (proNoQuest) {
  proNoQuest.textContent = yen(c.hourlyNoQuest) + "/h";
}
  const questDependency =
  c.hourlyWithQuest > 0
    ? Math.max(0, ((c.hourlyWithQuest - c.hourlyNoQuest) / c.hourlyWithQuest) * 100)
    : 0;

const questDependencyEl = $("questDependencyPro");
if (questDependencyEl) {
  questDependencyEl.textContent = questDependency.toFixed(1) + "%";
}
  setSettings({targetHourly: val("targetHourly"), monthlyTarget: val("monthlyTarget")});
}
async function backupRecordToCloud(record) {
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) return;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("is_pro")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_pro !== true) return;

  const { error } = await supabaseClient
    .from("delivery_records")
    .upsert({
      id: record.id,
      user_id: user.id,
      date: record.date,
      platform: record.platform,
      sales: Number(record.sales || 0),
      gross: Number(record.gross || 0),
      profit: Number(record.profit || 0),
      hours: Number(record.hours || 0),
      deliveries: Number(record.deliveries || 0),
      distance: Number(record.distance || 0),
      expenses: Number(record.expenses || 0),
      quest: Number(record.quest || 0),
      area: record.area || "",
      time_slot: record.timeSlot || "",
      quest_target: Number(record.questTarget || 0),
      quest_current: Number(record.questCurrent || 0)
    });

  if (error) {
    console.error("クラウドバックアップ失敗", error);
  }
}
function saveToday(){
  const c = calcFromForm();
  const record = {
    id: Date.now(),
    date: $("dashboardDateInput")?.value || todayKey(),
    platform: $("platform").value,
    ...c,
    area: $("area").value,
timeSlot: $("timeSlot").value,
    questTarget: val("questTarget"),
    questCurrent: val("questCurrent"),
  };
  const records = getRecords();
  records.unshift(record);
  setRecords(records);
  backupRecordToCloud(record);
  renderHistory();
  renderMonth();
  renderBreakdown();
  alert("保存しました");
}

function renderHistory(){
  const records = getRecords();
  const box = $("history");
  if(!records.length){ box.innerHTML = '<div class="muted">まだ記録がありません</div>'; return; }
  box.innerHTML = (document.body.classList.contains("is-pro") ? records : records.slice(0, 7)).map(r => `
    <div class="history-item">
      <div class="history-main">
        <strong>${r.date} / ${r.platform}</strong>
        <div class="history-meta">${r.deliveries}件・${r.hours}h・${r.distance}km / クエスト ${yen(r.quest)}</div>
      </div>
      <div class="history-profit">
        ${yen(r.profit)}
        <div class="history-meta">${yen(r.hourlyWithQuest)}/h</div>
      </div>
      <div class="history-actions">
        <button class="ghost" onclick="deleteRecord(${r.id})">削除</button>
      </div>
    </div>`).join("");
}

async function deleteRecord(id) {
  if (!confirm("この記録を削除しますか？")) return;

  const { data: { user } } = await supabaseClient.auth.getUser();

  if (user) {
    const { error } = await supabaseClient
      .from("delivery_records")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("クラウド削除失敗", error);
      alert("クラウドから削除できませんでした");
      return;
    }
  }

  setRecords(getRecords().filter(r => r.id !== id));

  renderHistory();
  renderMonth();
  renderBreakdown();
}

function renderMonth(){
  const now = new Date();
  const ym = now.toISOString().slice(0,7);
  const records = getRecords().filter(r => r.date.startsWith(ym));
  const sales = records.reduce((a,r)=>a+r.gross,0);
  const profit = records.reduce((a,r)=>a+r.profit,0);
  const hours = records.reduce((a,r)=>a+r.hours,0);
  const avgHourly = hours ? profit/hours : 0;
  $("monthSales").textContent = yen(sales);
  $("monthProfit").textContent = yen(profit);
  const homeMonthSales = $("homeMonthSales");
if (homeMonthSales) homeMonthSales.textContent = yen(sales);

const homeMonthProfit = $("homeMonthProfit");
if (homeMonthProfit) homeMonthProfit.textContent = yen(profit);
  $("monthHourly").textContent = yen(avgHourly)+"/h";

  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const forecast = day > 0 ? profit/day*daysInMonth : 0;
  $("monthForecast").textContent = yen(forecast);
  const monthlyTarget = val("monthlyTarget");
const targetRemaining = Math.max(0, monthlyTarget - profit);
const targetHours =
  avgHourly > 0 ? targetRemaining / avgHourly : 0;

const targetRemainingEl = $("targetRemainingPro");
if (targetRemainingEl) {
  targetRemainingEl.textContent = yen(targetRemaining);
}

const targetHoursEl = $("targetHoursPro");
if (targetHoursEl) {
  targetHoursEl.textContent =
    targetRemaining === 0
      ? "達成"
      : avgHourly > 0
        ? targetHours.toFixed(1) + "時間"
        : "計算不可";
}
  const forecastCurrentEl = $("forecastCurrentPro");
if (forecastCurrentEl) {
  forecastCurrentEl.textContent = yen(forecast);
}

const forecastGap = Math.max(0, monthlyTarget - forecast);

const forecastGapEl = $("forecastGapPro");
if (forecastGapEl) {
  forecastGapEl.textContent = yen(forecastGap);
}

const remainingDays = Math.max(0, daysInMonth - day);

const forecastDailyNeed =
  remainingDays > 0 ? forecastGap / remainingDays : forecastGap;

const forecastDailyNeedEl = $("forecastDailyNeedPro");
if (forecastDailyNeedEl) {
  forecastDailyNeedEl.textContent = yen(forecastDailyNeed);
}
}

function exportCSV(){
  const rows = getRecords();
  if(!rows.length){ alert("記録がありません"); return; }
  const headers = ["date","platform","sales","quest","gross","expenses","profit","hours","deliveries","distance","hourlyWithQuest","hourlyNoQuest"];
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "delivery-profit.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function clearAll(){
  if(!confirm("履歴をすべて削除しますか？")) return;

  const { data: { user } } = await supabaseClient.auth.getUser();

  if (user) {
    const { error } = await supabaseClient
      .from("delivery_records")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("クラウド全削除失敗", error);
      alert("クラウドの履歴を削除できませんでした");
      return;
    }
  }

  localStorage.removeItem(STORAGE_KEY);

  renderHistory();
  renderMonth();
  renderBreakdown();
}

function loadSettings(){
  const s = getSettings();
  if(s.targetHourly) $("targetHourly").value = s.targetHourly;
  if(s.monthlyTarget) $("monthlyTarget").value = s.monthlyTarget;
}

document.querySelectorAll("input,select").forEach(el=>el.addEventListener("input",refreshLive));
$("saveBtn").addEventListener("click",saveToday);
$("exportBtn").addEventListener("click",exportCSV);
$("clearBtn").addEventListener("click",clearAll);
$("themeBtn").addEventListener("click",()=>document.body.classList.toggle("light"));
document.querySelectorAll(".bottom-nav button").forEach(btn=>btn.addEventListener("click",()=>{
  const target = btn.dataset.scroll;
  if(target==="top") window.scrollTo({top:0,behavior:"smooth"});
  if(target==="record") document.querySelectorAll(".card")[1].scrollIntoView({behavior:"smooth"});
  if(target==="history") $("history").scrollIntoView({behavior:"smooth"});
}));

loadSettings();
refreshLive();
renderHistory();
renderMonth();

window.deleteRecord = deleteRecord;
function renderBreakdown() {
  const records = getRecords().map(r => ({
  ...r,
  weekday: ["日","月","火","水","木","金","土"][new Date(r.date + "T00:00:00").getDay()],
  areaTime: `${r.area || "未設定"} × ${r.timeSlot || "未設定"}`
}));

  function makeStats(key, boxId) {
    const box = $(boxId);
    if (!box) return;

    const groups = {};

    records.forEach(r => {
      const name = r[key] || "未設定";

      if (!groups[name]) {
        groups[name] = {
          sales: 0,
          profit: 0,
          hours: 0,
          deliveries: 0
        };
      }

      groups[name].sales += Number(r.gross || 0);
      groups[name].profit += Number(r.profit || 0);
      groups[name].hours += Number(r.hours || 0);
      groups[name].deliveries += Number(r.deliveries || 0);
    });

    if (!records.length) {
      box.innerHTML = '<p class="muted">まだ配達データがありません</p>';
      return;
    }

    box.innerHTML = Object.entries(groups).map(([name, s]) => {
      const hourly = s.hours > 0 ? s.profit / s.hours : 0;

      return `
  <div class="history-item analysis-rank-item">
    <div class="rank-content">

      <div class="rank-copy">
        <strong class="rank-name">${name}</strong>
        <div class="history-meta">
          ${s.deliveries}件 ・ 時給 ${yen(hourly)}
        </div>
      </div>

      <div class="rank-profit">
        <span>利益</span>
        <strong>${yen(s.profit)}</strong>
      </div>

      <span class="rank-chevron">›</span>

    </div>
  </div>
`;
    }).join("");
  }

  makeStats("area", "areaStats");
  makeStats("timeSlot", "timeStats");
  makeStats("platform", "platformStats");
  makeStats("weekday", "weekdayStats");
  makeStats("areaTime", "areaTimeStats");
  const rankingBox = $("rankingStats");

if (rankingBox) {
  const ranking = records
    .filter(r => Number(r.hours || 0) > 0)
    .map(r => ({
      name: `${r.area || "未設定"} × ${r.timeSlot || "未設定"} × ${r.platform || "未設定"}`,
      hourly: Number(r.profit || 0) / Number(r.hours || 0)
    }))
    .sort((a, b) => b.hourly - a.hourly)
    .slice(0, 5);

  rankingBox.innerHTML = ranking.length
    ? ranking.map((r, i) => `
        <div class="history-item">
          <div class="history-main">
            <strong>${i + 1}位 ${r.name}</strong>
            <div class="history-meta">時給 ${yen(r.hourly)}</div>
          </div>
        </div>
      `).join("")
    : '<p class="muted">まだランキングデータがありません</p>';
}
}

renderBreakdown();
function applyProStatus(isPro) {
  document.body.classList.toggle("is-pro", isPro === true);

  const upgrade = $("proUpgrade");
  if (upgrade) {
    upgrade.style.display = isPro ? "none" : "";
  }

  const active = $("proActive");
  if (active) {
    active.style.display = isPro ? "" : "none";
  }
  const proNav = document.querySelector('.bottom-nav button:last-child');

if (proNav) {
  proNav.dataset.scroll = isPro ? "proActive" : "proUpgrade";
}
}
  
checkProStatus();
$("loginBtn").addEventListener("click", sendLoginLink);
$("proMonthlyBtn")?.addEventListener("click", () => {
  startProCheckout("monthly");
});

$("proLifetimeBtn")?.addEventListener("click", () => {
  startProCheckout("lifetime");
});
supabaseClient.auth.onAuthStateChange(() => {
  checkProStatus();
});
$("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  await checkProStatus();
});
document.querySelectorAll(".bottom-nav .nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".bottom-nav .nav-item").forEach((item) => {
      item.classList.remove("active");
    });

    btn.classList.add("active");

    const targetId = btn.dataset.scroll;
    const target = document.getElementById(targetId);

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });
});
const dashboardDate = $("dashboardDate");

if (dashboardDate) {
  const now = new Date();

  dashboardDate.textContent = now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  });
}
function renderSelectedDateSummary(date) {
  const records = getRecords().filter(r => r.date === date);

  const total = records.reduce((sum, r) => {
    sum.profit += Number(r.profit || 0);
    sum.hours += Number(r.hours || 0);
    sum.deliveries += Number(r.deliveries || 0);
    sum.distance += Number(r.distance || 0);
    sum.quest += Number(r.quest || 0);
    return sum;
  }, {
    profit: 0,
    hours: 0,
    deliveries: 0,
    distance: 0,
    quest: 0
  });

  const hourlyWithQuest =
    total.hours > 0 ? total.profit / total.hours : 0;

  const hourlyNoQuest =
    total.hours > 0 ? (total.profit - total.quest) / total.hours : 0;

  const questBoost = hourlyWithQuest - hourlyNoQuest;

  $("todayProfit").textContent = yen(total.profit);
  $("deliveryCountMini").textContent = total.deliveries + "件";
  $("workHoursMini").textContent = total.hours + "h";
  $("distanceMini").textContent = total.distance + "km";
  $("hourlyWithQuest").textContent = yen(hourlyWithQuest) + "/h";
  $("hourlyNoQuest").textContent = yen(hourlyNoQuest) + "/h";
  $("questBoost").textContent = "+" + yen(Math.max(0, questBoost)) + "/h";
}
const dashboardDateInput = $("dashboardDateInput");
const dateLabel = $("dashboardDate");

function updateDashboardDate(dateValue) {
  if (!dateLabel || !dateValue) return;

  const selected = new Date(dateValue + "T00:00:00");

  dateLabel.textContent = selected.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  });

  renderSelectedDateSummary(dateValue);
}

if (dashboardDateInput) {
  dashboardDateInput.value = todayKey();

  updateDashboardDate(dashboardDateInput.value);

  dashboardDateInput.addEventListener("change", () => {
    updateDashboardDate(dashboardDateInput.value);
  });
}
