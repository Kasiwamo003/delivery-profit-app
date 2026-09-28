const supabaseClient = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_PUBLISHABLE_KEY
);
async function checkProStatus() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    applyProStatus(false);
    return;
  }

  const { data } = await supabaseClient
    .from("profiles")
    .select("is_pro")
    .eq("id", user.id)
    .maybeSingle();

  applyProStatus(data?.is_pro === true);
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
    $("authStatus").textContent = "送信できませんでした";
    return;
  }

  $("authStatus").textContent = "ログイン用メールを送りました";
}
const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "delivery-profit-records-v1";
const SETTINGS_KEY = "delivery-profit-settings-v1";

const yen = (n) => "¥" + Math.round(Number(n || 0)).toLocaleString("ja-JP");
const val = (id) => Number($(id).value || 0);
const todayKey = () => new Date().toISOString().slice(0,10);

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

  setSettings({targetHourly: val("targetHourly"), monthlyTarget: val("monthlyTarget")});
}

function saveToday(){
  const c = calcFromForm();
  const record = {
    id: Date.now(),
    date: todayKey(),
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
  renderHistory();
  renderMonth();
  renderBreakdown();
  alert("保存しました");
}

function renderHistory(){
  const records = getRecords();
  const box = $("history");
  if(!records.length){ box.innerHTML = '<div class="muted">まだ記録がありません</div>'; return; }
  box.innerHTML = records.map(r => `
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

function deleteRecord(id){
  if(!confirm("この記録を削除しますか？")) return;
  setRecords(getRecords().filter(r => r.id !== id));
  renderHistory();
  renderMonth();
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
  $("monthHourly").textContent = yen(avgHourly)+"/h";

  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const forecast = day > 0 ? profit/day*daysInMonth : 0;
  $("monthForecast").textContent = yen(forecast);
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

function clearAll(){
  if(!confirm("履歴をすべて削除しますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory(); renderMonth();
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
  const records = getRecords();

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
        <div class="history-item">
          <div class="history-main">
            <strong>${name}</strong>
            <div class="history-meta">
              利益 ${yen(s.profit)} ・ 時給 ${yen(hourly)} ・ ${s.deliveries}件
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  makeStats("area", "areaStats");
  makeStats("timeSlot", "timeStats");
}

renderBreakdown();
function applyProStatus(isPro) {
  document.body.classList.toggle("is-pro", isPro === true);
}
checkProStatus();
