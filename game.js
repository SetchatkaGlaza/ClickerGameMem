const SAVE_KEY = "brainrot67_save_v3";
const SAVE_INTERVAL = 5;
const OFFLINE_CAP_SECONDS = 4 * 60 * 60;
const EVENT_COOLDOWN = 30000;

let ysdk = null;
let gameplayActive = false;
let state = {
  coins: 0, clickPower: 1, autoPower: 0, critLevel: 0, factoryLevel: 0, prestige: 0,
  boostUntil: 0, combo: 1, comboUntil: 0, totalClicks: 0, totalEarned: 0,
  sound: true, unlocked: [true, false, false, false, false, false], achievements: [],
  lastSave: Date.now(), lastDaily: 0, lastEvent: 0, eventCount: 0
};

const EVOLUTIONS = [
  { at: 0, name: "67", emoji: "🟡", art: "67", era: "starter", sub: "Первый закон фабрики: нажми 67 раз." },
  { at: 5000, name: "67 ULTRA", emoji: "🟠", art: "67+", era: "ultra", sub: "Конвейер начал шептать цифры." },
  { at: 60000, name: "BRAINROT", emoji: "🧠", art: "BR", era: "brainrot", sub: "Абсурд стабильно производится серийно." },
  { at: 500000, name: "GIGA 67", emoji: "🔥", art: "GIGA", era: "giga", sub: "Цех виден из космоса. Наверное." },
  { at: 5000000, name: "ABSOLUTE", emoji: "💀", art: "?!", era: "absolute", sub: "Счётчик перестал быть просто счётчиком." },
  { at: 50000000, name: "SECRET 67", emoji: "👑", art: "∞", era: "secret", sub: "Ты нашёл главный предохранитель." }
];

const ACHIEVEMENTS = [
  ["👆", "Первый импульс", "Сделать 1 клик", () => state.totalClicks >= 1],
  ["6️⃣7️⃣", "Ритм 67", "Сделать 67 кликов", () => state.totalClicks >= 67],
  ["🔥", "На скорости", "Достичь комбо ×5", () => state.combo >= 5],
  ["💰", "Первая пачка", "Заработать 5 000 энергии", () => state.totalEarned >= 5000],
  ["⚙️", "Конвейер запущен", "Купить первый конвейер", () => state.autoPower >= 1],
  ["💥", "Перегрузка", "Купить первый уровень перегрузки", () => state.critLevel >= 1],
  ["🏭", "Есть производство", "Купить мемную фабрику", () => state.factoryLevel >= 1],
  ["🎁", "Полная смена", "Забрать фабричную смену", () => state.lastDaily > 0],
  ["♻️", "Новый цикл", "Сделать престиж", () => state.prestige >= 1],
  ["👑", "Выше нормы", "Открыть GIGA 67", () => state.unlocked[3]]
];

const $ = id => document.getElementById(id);
const fmt = number => {
  if (!Number.isFinite(number)) return "0";
  if (number < 1000) return Math.floor(number).toString();
  const units = ["K", "M", "B", "T", "Qa", "Qi"];
  let unit = -1, value = number;
  while (value >= 1000 && unit < units.length - 1) { value /= 1000; unit++; }
  return value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2) + units[unit];
};
const pluralSeconds = seconds => `${seconds} сек`;

function powerPrice() { return Math.floor(35 * Math.pow(1.72, state.clickPower - 1)); }
function autoPrice() { return Math.floor(180 * Math.pow(1.82, state.autoPower)); }
function critPrice() { return Math.floor(1200 * Math.pow(2.15, state.critLevel)); }
function factoryPrice() { return Math.floor(7500 * Math.pow(2.75, state.factoryLevel)); }
function prestigeCost() { return 2000000 * Math.pow(8, state.prestige); }
function baseMultiplier() { return (1 + state.prestige * 0.1) * (1 + state.factoryLevel * 0.12); }
function multiplier() { return baseMultiplier() * (Date.now() < state.boostUntil ? 3 : 1); }
function clickValue() { return state.clickPower * multiplier(); }
function incomePerSecond() { return state.autoPower * multiplier(); }
function evolutionMetric() { return Math.max(state.coins, state.totalEarned); }

function currentEvolution() {
  const metric = evolutionMetric(); let index = 0;
  EVOLUTIONS.forEach((evo, i) => { if (metric >= evo.at) index = i; });
  return { index, ...EVOLUTIONS[index], next: EVOLUTIONS[index + 1] };
}
function unlockEvolution() { state.unlocked[currentEvolution().index] = true; }
function rankName() {
  const value = evolutionMetric();
  if (value >= 5000000) return "АБСОЛЮТ";
  if (value >= 500000) return "GIGA-МАСТЕР";
  if (value >= 60000) return "BRAINROT-ИНЖЕНЕР";
  if (value >= 5000) return "УЛЬТРА-СБОРЩИК";
  if (value >= 500) return "РАЗОГРЕТ";
  return "НОВИЧОК";
}
function canClaimDaily() { return Date.now() - state.lastDaily >= 20 * 60 * 60 * 1000; }

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem("brainrot67_save_v2"));
    if (saved && typeof saved === "object") state = { ...state, ...saved };
  } catch (error) { console.warn("Не удалось прочитать сохранение", error); }
  unlockEvolution();
  const awaySeconds = Math.min(OFFLINE_CAP_SECONDS, Math.max(0, (Date.now() - state.lastSave) / 1000));
  const offlineGain = state.autoPower * baseMultiplier() * awaySeconds;
  if (offlineGain >= 1) {
    state.coins += offlineGain; state.totalEarned += offlineGain;
    setTimeout(() => showOfflineReward(offlineGain, Math.floor(awaySeconds)), 350);
  }
}
function save() { state.lastSave = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }

async function initYandexSDK() {
  try {
    if (!window.YaGames) return;
    ysdk = await window.YaGames.init();
    ysdk.features?.LoadingAPI?.ready();
    startGameplay();
  } catch (error) { console.warn("Yandex Games SDK недоступен:", error); }
}
function startGameplay() { if (!gameplayActive) { ysdk?.features?.GameplayAPI?.start(); gameplayActive = true; } }
function stopGameplay() { if (gameplayActive) { ysdk?.features?.GameplayAPI?.stop(); gameplayActive = false; } }

function render() {
  unlockEvolution();
  const evo = currentEvolution(), next = evo.next;
  $("game").dataset.era = evo.era;
  $("coins").textContent = fmt(state.coins); $("income").textContent = fmt(incomePerSecond());
  $("level").textContent = Math.max(1, Math.floor(Math.log10(Math.max(1, state.totalEarned))) + 1); $("rank").textContent = rankName();
  [["power", powerPrice(), state.clickPower], ["auto", autoPrice(), state.autoPower], ["crit", critPrice(), state.critLevel], ["factory", factoryPrice(), state.factoryLevel]].forEach(([name, price, level]) => {
    $(`${name}Price`).textContent = fmt(price); $(`${name}Level`).textContent = `LVL ${level}`; $(`${name}Upgrade`).disabled = state.coins < price;
  });
  $("powerDescription").textContent = `+1 к касанию · сейчас ${fmt(clickValue())}`;
  $("autoDescription").textContent = `+1/сек · сейчас ${fmt(incomePerSecond())}/сек`;
  $("critDescription").textContent = `Шанс ${Math.min(35, state.critLevel * 2.5).toFixed(state.critLevel ? 1 : 0)}% · награда ×10`;
  $("factoryDescription").textContent = `+12% ко всему · сейчас +${state.factoryLevel * 12}%`;
  $("prestige").textContent = `Престиж: ${state.prestige}`; $("prestigeBonus").textContent = `+${state.prestige * 10}%`;
  $("prestigeBtn").disabled = state.coins < prestigeCost(); $("prestigeBtn").textContent = `ПЕРЕЗАПУСК — ${fmt(prestigeCost())}`;
  $("evolution").textContent = `${evo.emoji} ${evo.name}`; $("evolutionArt").textContent = evo.art;
  $("evolutionSub").textContent = next ? `Следующая мутация: ${fmt(next.at)} · ${next.name}` : "Все мутации стабилизированы.";
  $("nextUnlock").textContent = next ? fmt(next.at) : "MAX";
  const start = evo.at, end = next?.at ?? evo.at;
  $("progressBar").style.width = next ? `${Math.min(100, Math.max(0, (evolutionMetric() - start) / (end - start) * 100))}%` : "100%";
  const remain = Math.max(0, Math.ceil((state.boostUntil - Date.now()) / 1000)); $("boostActive").textContent = remain ? `×3 · ${pluralSeconds(remain)}` : "";
  const comboRemain = Math.max(0, state.comboUntil - Date.now()); $("combo").textContent = `×${state.combo}`; $("comboBar").style.width = `${Math.min(100, comboRemain / 1800 * 100)}%`;
  $("achievementCount").textContent = `${state.achievements.length}/${ACHIEVEMENTS.length}`; $("collectionCount").textContent = `${state.unlocked.filter(Boolean).length}/${EVOLUTIONS.length}`;
  $("dailyStatus").textContent = canClaimDaily() ? "ГОТОВО" : "ЗАВТРА"; $("dailyBtn").classList.toggle("ready", canClaimDaily());
}

function toast(text) { const element = $("toast"); element.textContent = text; element.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove("show"), 1800); }
function floatText(text, x, y, critical = false) { const element = document.createElement("div"); element.className = `float${critical ? " crit" : ""}`; element.textContent = text; element.style.left = `${x}px`; element.style.top = `${y}px`; document.body.appendChild(element); setTimeout(() => element.remove(), 800); }
function beep(frequency = 440, duration = .04) {
  if (!state.sound) return;
  try { const Audio = window.AudioContext || window.webkitAudioContext, context = beep.context || (beep.context = new Audio()), osc = context.createOscillator(), gain = context.createGain(); osc.frequency.value = frequency; osc.type = "square"; gain.gain.value = .018; osc.connect(gain); gain.connect(context.destination); osc.start(); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration); osc.stop(context.currentTime + duration); } catch (_) { /* audio is optional */ }
}
function checkAchievements() { ACHIEVEMENTS.forEach((achievement, index) => { if (!state.achievements.includes(index) && achievement[3]()) { state.achievements.push(index); toast(`🏆 ${achievement[1]}`); beep(880, .1); } }); }
function award(amount) { state.coins += amount; state.totalEarned += amount; unlockEvolution(); checkAchievements(); }

function click() {
  const now = Date.now(); state.combo = now < state.comboUntil ? Math.min(10, state.combo + 1) : 1; state.comboUntil = now + 1800;
  let gain = clickValue() * state.combo; const critical = Math.random() < Math.min(.35, state.critLevel * .025); if (critical) gain *= 10;
  award(gain); state.totalClicks++;
  const rect = $("clicker").getBoundingClientRect(); floatText(`${critical ? "💥 КРИТ! +" : "+"}${fmt(gain)}`, rect.left + rect.width / 2, rect.top + rect.height * .42, critical);
  beep(critical ? 900 : 300 + state.combo * 25, critical ? .09 : .025); maybeEvent(now); save(); render();
}
function buy(type) {
  const data = { power: [powerPrice, "clickPower"], auto: [autoPrice, "autoPower"], crit: [critPrice, "critLevel"], factory: [factoryPrice, "factoryLevel"] }[type];
  const [priceFunction, field] = data, price = priceFunction(); if (state.coins < price) return;
  state.coins -= price; state[field]++; toast("КУПЛЕНО ✓"); beep(650, .06); checkAchievements(); save(); render();
}
function prestige() {
  const cost = prestigeCost(); if (state.coins < cost) return;
  state.prestige++; state.coins = 0; state.clickPower = 1; state.autoPower = 0; state.critLevel = 0; state.factoryLevel = 0; state.combo = 1; state.comboUntil = 0;
  checkAchievements(); save(); render(); toast("♻️ ЦЕХ ПЕРЕЗАПУЩЕН!"); beep(220, .15);
}
function maybeEvent(now) { if (now - state.lastEvent > EVENT_COOLDOWN && state.totalClicks > 20 && Math.random() < .028) { state.lastEvent = now; state.eventCount++; save(); showEvent(); } }
function showEvent() { stopGameplay(); openModal("event"); }
function showOfflineReward(amount, seconds) { openModal("offline", { amount, seconds }); }
function claimDaily() { if (!canClaimDaily()) { toast("Смена уже завершена — возвращайся завтра"); return; } const reward = Math.max(150, incomePerSecond() * 120 + clickValue() * 25); state.lastDaily = Date.now(); award(reward); save(); render(); toast(`🎁 СМЕНА: +${fmt(reward)}`); beep(740, .12); }
function showRewarded() {
  if (!ysdk?.adv?.showRewardedVideo) { toast("Реклама будет доступна в Яндекс Играх"); return; }
  $("rewardedBtn").disabled = true; stopGameplay();
  ysdk.adv.showRewardedVideo({ callbacks: { onRewarded: () => { state.boostUntil = Date.now() + 60000; save(); render(); toast("🔥 БУСТ ×3 НА 60 СЕКУНД!"); }, onClose: () => { $("rewardedBtn").disabled = false; startGameplay(); render(); }, onError: error => { console.warn(error); $("rewardedBtn").disabled = false; startGameplay(); } } });
}

function openModal(kind, data = {}) {
  stopGameplay(); $("modal").classList.remove("hidden");
  if (kind === "collection") $("modalContent").innerHTML = `<h2 class="modal-title">🧠 КОЛЛЕКЦИЯ МУТАЦИЙ</h2><p class="modal-lead">Открытия сохраняются между перезапусками фабрики.</p><div class="grid">${EVOLUTIONS.map((evo, i) => `<div class="card ${state.unlocked[i] ? "" : "locked"}"><div class="emoji">${state.unlocked[i] ? evo.emoji : "🔒"}</div><b>${state.unlocked[i] ? evo.name : "???"}</b><small>${state.unlocked[i] ? evo.sub : `Нужно заработать ${fmt(evo.at)} за всё время`}</small></div>`).join("")}</div>`;
  else if (kind === "achievements") $("modalContent").innerHTML = `<h2 class="modal-title">🏆 ДОСТИЖЕНИЯ</h2>${ACHIEVEMENTS.map((a, i) => { const done = state.achievements.includes(i); return `<div class="achievement ${done ? "done" : ""}"><div class="emoji">${a[0]}</div><div><b>${a[1]}</b><small>${a[2]}</small></div><div class="check">${done ? "✓" : "🔒"}</div></div>`; }).join("")}`;
  else if (kind === "event") { const reward = Math.max(333, clickValue() * 67); $("modalContent").innerHTML = `<div class="event-icon">⚠️</div><h2 class="modal-title">СБОЙ 67</h2><p class="modal-lead">Конвейер выдал нестабильную капсулу. Забрать <b>${fmt(reward)}</b> энергии?</p><button class="event-claim" id="eventClaim">ЗАБРАТЬ ×67</button><small class="event-note">Редкое событие. Никакой рекламы и подвоха.</small>`; $("eventClaim").addEventListener("click", () => { award(reward); save(); render(); closeModal(); toast(`⚠️ СБОЙ: +${fmt(reward)}`); beep(980, .12); }); }
  else if (kind === "offline") { $("modalContent").innerHTML = `<div class="event-icon">🌙</div><h2 class="modal-title">ФАБРИКА РАБОТАЛА</h2><p class="modal-lead">За ${pluralSeconds(data.seconds)} офлайн-конвейер собрал <b>${fmt(data.amount)}</b> энергии.</p><button class="event-claim" id="offlineClaim">ЗАБРАТЬ</button>`; $("offlineClaim").addEventListener("click", closeModal); }
  else $("modalContent").innerHTML = `<h2 class="modal-title">КАК ИГРАТЬ</h2><div class="help"><p><b>1. Производи 67.</b> Быстрые клики повышают комбо до ×10.</p><p><b>2. Вкладывай энергию.</b> Сила клика, конвейер и фабрика ускоряют рост. Цены специально растут: не нужно покупать всё сразу.</p><p><b>3. Лови мутации.</b> Коллекция открывается по суммарно заработанной энергии и не сбрасывается при престиже.</p><p><b>4. Перезапускай цех.</b> На 2M можно начать новый цикл с постоянным бонусом.</p><p><b>5. Забирай добровольный буст.</b> Видео-реклама появится только в версии внутри Яндекс Игр.</p></div>`;
}
function closeModal() { $("modal").classList.add("hidden"); startGameplay(); }

$("clicker").addEventListener("click", click); $("powerUpgrade").addEventListener("click", () => buy("power")); $("autoUpgrade").addEventListener("click", () => buy("auto")); $("critUpgrade").addEventListener("click", () => buy("crit")); $("factoryUpgrade").addEventListener("click", () => buy("factory")); $("prestigeBtn").addEventListener("click", prestige); $("rewardedBtn").addEventListener("click", showRewarded);
$("collectionBtn").addEventListener("click", () => openModal("collection")); $("achievementsBtn").addEventListener("click", () => openModal("achievements")); $("dailyBtn").addEventListener("click", claimDaily); $("helpBtn").addEventListener("click", () => openModal("help")); $("modalClose").addEventListener("click", closeModal); $("modal").addEventListener("click", event => { if (event.target.id === "modal") closeModal(); });
$("soundBtn").addEventListener("click", () => { state.sound = !state.sound; $("soundBtn").textContent = state.sound ? "🔊 Звук" : "🔇 Звук"; save(); });
$("resetBtn").addEventListener("click", () => { if (confirm("Сбросить весь прогресс? Это нельзя отменить.")) { localStorage.removeItem(SAVE_KEY); location.reload(); } });
document.addEventListener("visibilitychange", () => { if (document.hidden) { save(); stopGameplay(); } else { startGameplay(); } });

load(); render(); initYandexSDK();
let last = performance.now(), saveClock = 0;
function tick(now) { const delta = Math.min(1, (now - last) / 1000); last = now; const income = incomePerSecond(); if (income > 0 && !document.hidden) award(income * delta); saveClock += delta; if (saveClock >= SAVE_INTERVAL) { saveClock = 0; save(); } render(); requestAnimationFrame(tick); }
requestAnimationFrame(tick);
