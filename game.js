const SAVE_KEY = "brainrot_vault_v5";
const SAVE_EVERY_SECONDS = 5;
const OFFLINE_CAP = 4 * 60 * 60;
const COMBO_WINDOW = 1800;
const EXPEDITION_SECONDS = 30;

let ysdk = null;
let gameplayActive = false;
let audioContext = null;
let state = defaultState();

function defaultState() {
  return {
    coins: 0, vault: 0, safeLevel: 0, clickPower: 1, critLevel: 0, prestige: 0,
    generators: [0, 0, 0, 0, 0], research: [0, 0, 0], relics: [false, false, false, false, false, false],
    totalGenerated: 0, totalClicks: 0, combo: 1, comboUntil: 0, boostUntil: 0,
    dailyKey: "", dailyClaimed: false, dailyClicks: 0, dailyCollected: 0, dailyGenerated: 0,
    expeditionUntil: 0, expeditionClaimable: false, expeditionCooldownUntil: 0,
    goldenUntil: 0, goldenCooldownUntil: 0, achievements: [], sound: true, lastSave: Date.now()
  };
}

const GENERATORS = [
  { icon: "🧃", name: "67-ларёк", desc: "Банкует базовый мем", base: 800, growth: 1.17, rate: 1 },
  { icon: "🤖", name: "Кринж-бот", desc: "Жмёт за тебя", base: 8000, growth: 1.19, rate: 8 },
  { icon: "🖨️", name: "Мем-принтер", desc: "Печатает абсурд", base: 90000, growth: 1.22, rate: 65 },
  { icon: "🧠", name: "Нейро-цех", desc: "Дистиллирует брейнрот", base: 1200000, growth: 1.25, rate: 540 },
  { icon: "🛸", name: "Гига-сервер", desc: "Шлёт мемы из космоса", base: 20000000, growth: 1.28, rate: 4800 }
];
const EVOLUTIONS = [
  { at: 0, icon: "🧃", name: "67-ЛАРЁК", sub: "Первый цех только открылся.", theme: "starter" },
  { at: 50000, icon: "🤖", name: "УЛЬТРА-КОНВЕЙЕР", sub: "Роботы знают слово «ещё». ", theme: "ultra" },
  { at: 2000000, icon: "🧠", name: "BRAINROT БАНК", sub: "Сейф начал думать самостоятельно.", theme: "brain" },
  { at: 100000000, icon: "🛸", name: "GIGA-МЕМПОЛИС", sub: "Фабрика захватила ночной город.", theme: "giga" },
  { at: 5000000000, icon: "💀", name: "АБСОЛЮТНЫЙ СЕЙФ", sub: "Числа больше не имеют смысла.", theme: "absolute" },
  { at: 250000000000, icon: "👑", name: "СЕКРЕТНЫЙ 67", sub: "Ты дошёл до финального протокола.", theme: "secret" }
];
const ACHIEVEMENTS = [
  ["👆", "Первая монета", "Сделать первый жмак", () => state.totalClicks >= 1],
  ["🔐", "Инкассатор", "Забрать 500 из сейфа", () => state.dailyCollected >= 500 || state.totalGenerated >= 500],
  ["🤖", "Автоматизация", "Купить Кринж-бота", () => state.generators[1] >= 1],
  ["📋", "Контрактник", "Выполнить сменный контракт", () => state.dailyClaimed],
  ["🛸", "Экспедитор", "Забрать первую вылазку", () => state.relics[0]],
  ["⚡", "Перегрузка", "Получить критический жмак", () => state.critLevel > 0],
  ["🧪", "Лаборант", "Купить исследование", () => state.research.some(Boolean)],
  ["💰", "Первая сотня K", "Создать 100K энергии", () => state.totalGenerated >= 100000],
  ["♻️", "Перерождение", "Перезапустить фабрику", () => state.prestige >= 1],
  ["👑", "Мемный магнат", "Открыть GIGA-МЕМПОЛИС", () => state.totalGenerated >= 100000000]
];

const $ = id => document.getElementById(id);
const fmt = number => {
  if (!Number.isFinite(number)) return "0";
  if (number < 1000) return Math.floor(number).toString();
  const units = ["K", "M", "B", "T", "Qa"]; let value = number; let unit = -1;
  while (value >= 1000 && unit < units.length - 1) { value /= 1000; unit++; }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)}${units[unit]}`;
};
const today = () => new Date().toISOString().slice(0, 10);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function generatorPrice(index) { const g = GENERATORS[index]; return Math.floor(g.base * Math.pow(g.growth, state.generators[index])); }
function powerPrice() { return Math.floor(100 * Math.pow(1.8, state.clickPower - 1)); }
function safePrice() { return Math.floor(400 * Math.pow(1.95, state.safeLevel)); }
function critPrice() { return Math.floor(7500 * Math.pow(2.15, state.critLevel)); }
function prestigeCost() { return 500000000 * Math.pow(8, state.prestige); }
function safeCapacity() { return 500 * Math.pow(2, state.safeLevel); }
function researchCost(index) { return 10 + state.research[index] * 10 + index * 8; }
function relicMultiplier() { return 1 + state.relics.filter(Boolean).length * .03; }
function baseMultiplier() { return (1 + state.prestige * .12) * (1 + state.research[0] * .07 + state.research[1] * .04 + state.research[2] * .025) * relicMultiplier(); }
function multiplier() { return baseMultiplier() * (Date.now() < state.boostUntil ? 3 : 1); }
function productionPerSecond() { return GENERATORS.reduce((sum, g, i) => sum + g.rate * state.generators[i], 0) * multiplier(); }
function clickValue() { return state.clickPower * multiplier(); }
function currentEvolution() { let current = EVOLUTIONS[0]; for (const evo of EVOLUTIONS) if (state.totalGenerated >= evo.at) current = evo; return current; }
function nextEvolution() { const current = currentEvolution(); return EVOLUTIONS[EVOLUTIONS.indexOf(current) + 1]; }
function rankName() { const value = state.totalGenerated; if (value >= 5000000000) return "АБСОЛЮТ"; if (value >= 100000000) return "GIGA"; if (value >= 2000000) return "BRAINROT"; if (value >= 50000) return "УЛЬТРА"; if (value >= 5000) return "ЖМАКЕР"; return "НОВИЧОК"; }

function normalizeState() {
  state.generators = Array.isArray(state.generators) ? [...state.generators, 0, 0, 0, 0, 0].slice(0, 5) : [0, 0, 0, 0, 0];
  state.research = Array.isArray(state.research) ? [...state.research, 0, 0, 0].slice(0, 3) : [0, 0, 0];
  state.relics = Array.isArray(state.relics) ? [...state.relics, false, false, false, false, false, false].slice(0, 6) : [false, false, false, false, false, false];
  if (state.dailyKey !== today()) { state.dailyKey = today(); state.dailyClaimed = false; state.dailyClicks = 0; state.dailyCollected = 0; state.dailyGenerated = 0; }
  state.vault = clamp(Number(state.vault) || 0, 0, safeCapacity());
}
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved && typeof saved === "object") state = { ...state, ...saved };
  } catch (error) { console.warn("Сохранение не прочитано", error); }
  normalizeState();
  const seconds = clamp((Date.now() - state.lastSave) / 1000, 0, OFFLINE_CAP);
  addToVault(productionPerSecond() * seconds, false);
  if (seconds >= 20 && productionPerSecond() > 0) setTimeout(() => openModal("offline", { seconds, gain: productionPerSecond() * seconds }), 300);
}
function save() { state.lastSave = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }

async function initYandexSDK() { try { if (!window.YaGames) return; ysdk = await window.YaGames.init(); ysdk.features?.LoadingAPI?.ready(); startGameplay(); } catch (error) { console.warn("Yandex SDK недоступен", error); } }
function startGameplay() { if (!gameplayActive) { ysdk?.features?.GameplayAPI?.start(); gameplayActive = true; } }
function stopGameplay() { if (gameplayActive) { ysdk?.features?.GameplayAPI?.stop(); gameplayActive = false; } }

function addToVault(amount, countGenerated = true) {
  if (amount <= 0 || state.vault >= safeCapacity()) return 0;
  const added = Math.min(amount, safeCapacity() - state.vault); state.vault += added;
  if (countGenerated) { state.totalGenerated += added; state.dailyGenerated += added; }
  checkAchievements(); return added;
}
function collectVault() {
  if (state.vault < .5) { toast("Сейф пока пуст — запускай мемомёт"); return; }
  const gain = state.vault; state.coins += gain; state.dailyCollected += gain; state.vault = 0;
  toast(`🔐 В КОШЕЛЁК: +${fmt(gain)}`); beep(620, .09); checkAchievements(); save(); render();
}
function click(event) {
  if (state.vault >= safeCapacity()) { toast("🔐 СЕЙФ ПОЛОН — забери партию!"); return; }
  const now = Date.now(); state.combo = now < state.comboUntil ? Math.min(10, state.combo + 1) : 1; state.comboUntil = now + COMBO_WINDOW;
  const critical = Math.random() < Math.min(.4, state.critLevel * .025); const gain = clickValue() * state.combo * (critical ? 10 : 1);
  const added = addToVault(gain); state.totalClicks++; state.dailyClicks++;
  const rect = $("clicker").getBoundingClientRect(); floatText(`${critical ? "⚡ GIGA +" : "+"}${fmt(added)}`, rect.left + rect.width / 2, rect.top + rect.height / 2, critical);
  beep(critical ? 980 : 360 + state.combo * 24, critical ? .08 : .025); maybeGolden(now); save(); render();
}
function buyGenerator(index) { const price = generatorPrice(index); if (state.coins < price) return; state.coins -= price; state.generators[index]++; toast(`${GENERATORS[index].icon} ЦЕХ УЛУЧШЕН`); beep(720, .06); save(); render(); }
function buyUpgrade(type) {
  const map = { power: [powerPrice, "clickPower"], safe: [safePrice, "safeLevel"], crit: [critPrice, "critLevel"] }; const [getPrice, field] = map[type]; const price = getPrice();
  if (state.coins < price) return; state.coins -= price; state[field]++; toast("УЛУЧШЕНИЕ УСТАНОВЛЕНО ✓"); beep(760, .06); save(); render();
}
function quest() {
  const options = [
    { name: "Ритм 67", text: "Сделай 67 жмаков", current: () => state.dailyClicks, target: 67, reward: 12 },
    { name: "Инкассация", text: "Забери 10K из сейфа", current: () => state.dailyCollected, target: 10000, reward: 18 },
    { name: "Мемный заказ", text: "Создай 50K энергии", current: () => state.dailyGenerated, target: 50000, reward: 24 }
  ]; return options[Math.floor(Date.now() / 86400000) % options.length];
}
function claimQuest() { const q = quest(); if (state.dailyClaimed) return toast("Контракт уже закрыт сегодня"); if (q.current() < q.target) return toast("Контракт ещё не выполнен"); state.dailyClaimed = true; state.research[0] += 0; state.coins += q.reward * 100; state.relics[0] = true; toast(`📋 КОНТРАКТ: +${q.reward * 100} коинов`); save(); render(); }
function claimDaily() { if (state.lastDaily === today()) return toast("Смена уже получена — завтра будет новая"); const gain = Math.max(350, clickValue() * 35 + productionPerSecond() * 90); state.lastDaily = today(); state.coins += gain; toast(`🎁 СМЕНА: +${fmt(gain)}`); beep(830, .12); save(); render(); }
function startExpedition() { if (state.expeditionClaimable) return claimExpedition(); if (Date.now() < state.expeditionCooldownUntil) return toast("Вылазка готовится — попробуй чуть позже"); state.expeditionUntil = Date.now() + EXPEDITION_SECONDS * 1000; state.expeditionCooldownUntil = state.expeditionUntil + 90 * 1000; toast("🛸 ВЫЛАЗКА ОТПРАВЛЕНА!"); save(); render(); }
function claimExpedition() { if (!state.expeditionClaimable) return; const gain = Math.max(1500, productionPerSecond() * 180 + clickValue() * 100); state.expeditionClaimable = false; state.coins += gain; const relicIndex = state.relics.findIndex(value => !value); if (relicIndex >= 0) state.relics[relicIndex] = true; toast(`🛸 ДОБЫЧА: +${fmt(gain)}`); beep(900, .12); save(); render(); }
function buyResearch(index) { const cost = researchCost(index); if (state.coins < cost * 500) return toast(`Нужно ${fmt(cost * 500)} коинов`); state.coins -= cost * 500; state.research[index]++; toast("🧪 ТЕХНОЛОГИЯ УСИЛЕНА"); save(); render(); openModal("lab"); }
function prestige() { const cost = prestigeCost(); if (state.totalGenerated < cost) return; state.prestige++; const relic = state.relics.findIndex(value => !value); if (relic >= 0) state.relics[relic] = true; const meta = { prestige: state.prestige, research: state.research, relics: state.relics, totalGenerated: state.totalGenerated, achievements: state.achievements, sound: state.sound }; state = { ...defaultState(), ...meta, dailyKey: today() }; toast("♻️ ФАБРИКА ПЕРЕЗАПУЩЕНА"); save(); render(); }
function maybeGolden(now) { if (now < state.goldenCooldownUntil || $("goldenBtn").classList.contains("hidden") || Math.random() > .018) return; state.goldenUntil = now + 6500; state.goldenCooldownUntil = now + 70000; $("goldenBtn").classList.remove("hidden"); }
function catchGolden() { if ($("goldenBtn").classList.contains("hidden")) return; $("goldenBtn").classList.add("hidden"); const gain = Math.max(300, clickValue() * 67); addToVault(gain); toast(`✨ ЗОЛОТОЙ МЕМ: +${fmt(gain)} в сейф`); beep(1040, .13); save(); render(); }
function showRewarded() { if (!ysdk?.adv?.showRewardedVideo) return toast("Буст-видео будет доступно в Яндекс Играх"); stopGameplay(); ysdk.adv.showRewardedVideo({ callbacks: { onRewarded: () => { state.boostUntil = Date.now() + 60000; toast("🔥 БУСТ ×3 НА 60 СЕКУНД"); }, onClose: startGameplay, onError: startGameplay } }); }

function renderGenerators() { $("generators").innerHTML = GENERATORS.map((g, index) => { const price = generatorPrice(index); return `<button class="generator" data-generator="${index}" ${state.coins < price ? "disabled" : ""}><span class="generator-icon">${g.icon}</span><span><b>${g.name} <em>×${state.generators[index]}</em></b><small>${g.desc} · +${fmt(g.rate * multiplier())}/сек</small></span><strong>${fmt(price)}</strong></button>`; }).join(""); document.querySelectorAll("[data-generator]").forEach(button => button.addEventListener("click", () => buyGenerator(Number(button.dataset.generator)))); }
function render() {
  normalizeState(); const capacity = safeCapacity(); const evo = currentEvolution(); const next = nextEvolution(); const full = state.vault >= capacity - .01;
  $("game").dataset.theme = evo.theme; $("coins").textContent = fmt(state.coins); $("income").textContent = `${fmt(productionPerSecond())}/сек`; $("multiplierLabel").textContent = `множитель ×${multiplier().toFixed(2)}`;
  $("rank").textContent = rankName(); $("prestige").textContent = state.prestige;
  $("vaultStored").textContent = fmt(state.vault); $("vaultCapacity").textContent = fmt(capacity); $("vaultPercent").textContent = `${Math.floor(state.vault / capacity * 100)}%`; $("vaultBar").style.width = `${state.vault / capacity * 100}%`; $("vaultStatus").classList.toggle("full", full); $("vaultHint").textContent = full ? "СЕЙФ ПОЛОН — ЗАБЕРИ!" : `Свободно ${fmt(capacity - state.vault)}`;
  $("combo").textContent = `×${state.combo}`; $("comboBar").style.width = `${clamp((state.comboUntil - Date.now()) / COMBO_WINDOW * 100, 0, 100)}%`;
  $("powerPrice").textContent = fmt(powerPrice()); $("safePrice").textContent = fmt(safePrice()); $("critPrice").textContent = fmt(critPrice()); $("powerInfo").textContent = `+1 · сейчас ${fmt(clickValue())}`; $("safeInfo").textContent = `вместимость ${fmt(capacity)}`; $("critInfo").textContent = `${(state.critLevel * 2.5).toFixed(1)}% шанс ×10`; $("labInfo").textContent = `${state.research.reduce((a, b) => a + b, 0)} технологий`;
  $("powerUpgrade").disabled = state.coins < powerPrice(); $("safeUpgrade").disabled = state.coins < safePrice(); $("critUpgrade").disabled = state.coins < critPrice();
  $("dailyStatus").textContent = state.lastDaily === today() ? "ЗАВТРА" : "ГОТОВО"; const q = quest(); $("questStatus").textContent = state.dailyClaimed ? "ВЫПОЛНЕНО" : `${fmt(Math.min(q.current(), q.target))} / ${fmt(q.target)}`;
  if (state.expeditionClaimable) $("expeditionStatus").textContent = "ЗАБРАТЬ"; else if (Date.now() < state.expeditionUntil) $("expeditionStatus").textContent = `${Math.ceil((state.expeditionUntil - Date.now()) / 1000)}с`; else if (Date.now() < state.expeditionCooldownUntil) $("expeditionStatus").textContent = `${Math.ceil((state.expeditionCooldownUntil - Date.now()) / 1000)}с`; else $("expeditionStatus").textContent = "ГОТОВО";
  $("collectionCount").textContent = `${state.relics.filter(Boolean).length} / 6`; $("evolutionIcon").textContent = evo.icon; $("evolution").textContent = evo.name; $("evolutionSub").textContent = next ? `${evo.sub} Следующая цель: ${fmt(next.at)}.` : evo.sub; $("nextUnlock").textContent = next ? fmt(next.at) : "MAX"; const span = next ? next.at - evo.at : 1; $("evolutionBar").style.width = `${next ? clamp((state.totalGenerated - evo.at) / span * 100, 0, 100) : 100}%`;
  $("prestigeCost").textContent = fmt(prestigeCost()); $("prestigeBonus").textContent = `+${state.prestige * 12}%`; $("prestigeBtn").disabled = state.totalGenerated < prestigeCost(); renderGenerators(); checkAchievements();
}

function toast(text) { const el = $("toast"); el.textContent = text; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 1900); }
function floatText(text, x, y, critical) { const el = document.createElement("div"); el.className = `float${critical ? " critical" : ""}`; el.textContent = text; el.style.left = `${x}px`; el.style.top = `${y}px`; document.body.appendChild(el); setTimeout(() => el.remove(), 750); }
function beep(frequency, duration) { if (!state.sound) return; try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); const osc = audioContext.createOscillator(); const gain = audioContext.createGain(); osc.frequency.value = frequency; gain.gain.value = .02; osc.connect(gain); gain.connect(audioContext.destination); osc.start(); gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration); osc.stop(audioContext.currentTime + duration); } catch (_) {} }
function checkAchievements() { ACHIEVEMENTS.forEach((achievement, index) => { if (!state.achievements.includes(index) && achievement[3]()) { state.achievements.push(index); toast(`🏆 ${achievement[1]}`); } }); }

function openModal(kind, data = {}) {
  stopGameplay(); $("modal").classList.remove("hidden");
  if (kind === "quest") { const q = quest(); const progress = clamp(q.current() / q.target * 100, 0, 100); $("modalContent").innerHTML = `<div class="modal-hero">📋</div><h2>${q.name}</h2><p>${q.text}. Награда: <b>+${fmt(q.reward * 100)} коинов</b> и артефакт.</p><div class="meter"><i style="width:${progress}%"></i></div><p>${fmt(Math.min(q.current(), q.target))} / ${fmt(q.target)}</p><button class="primary" id="modalAction" ${q.current() >= q.target && !state.dailyClaimed ? "" : "disabled"}>${state.dailyClaimed ? "ВЫПОЛНЕНО" : q.current() >= q.target ? "ЗАБРАТЬ НАГРАДУ" : "В РАБОТУ"}</button>`; $("modalAction").addEventListener("click", () => { if (q.current() >= q.target && !state.dailyClaimed) { claimQuest(); closeModal(); } }); }
  else if (kind === "lab") { const techs = [["⚡", "Импульсная катушка", "+7% к производству"], ["🧲", "Сейфовый магнит", "+4% к производству"], ["🧠", "Мем-нейросеть", "+2.5% к производству"]]; $("modalContent").innerHTML = `<div class="modal-hero">🧪</div><h2>Лаборатория</h2><p>Технологии переживают престиж. Оплата — коинами.</p>${techs.map((tech, index) => `<button class="tech" data-tech="${index}"><span>${tech[0]}</span><span><b>${tech[1]} · LVL ${state.research[index]}</b><small>${tech[2]}</small></span><em>${fmt(researchCost(index) * 500)}</em></button>`).join("")}`; document.querySelectorAll("[data-tech]").forEach(button => button.addEventListener("click", () => buyResearch(Number(button.dataset.tech)))); }
  else if (kind === "collection") { const names = ["Ядро 67", "Билет в кринж", "Кассета бота", "Глаз фабрики", "Диск GIGA", "Корона сбоя"]; $("modalContent").innerHTML = `<div class="modal-hero"><img src="assets/ui/golden-meme.svg" alt=""></div><h2>Архив артефактов</h2><p>Каждый артефакт даёт <b>+3% к производству</b>.</p><div class="cards">${state.relics.map((owned, index) => `<div class="card ${owned ? "" : "locked"}"><b>${owned ? ["🧿", "🎟️", "📼", "👁️", "💿", "👑"][index] : "🔒"}</b><strong>${owned ? names[index] : "???"}</strong><small>${owned ? "+3% к производству" : "Вылазка, контракт или престиж"}</small></div>`).join("")}</div>`; }
  else if (kind === "achievements") $("modalContent").innerHTML = `<div class="modal-hero">🏆</div><h2>Достижения</h2>${ACHIEVEMENTS.map((a, i) => `<div class="achievement ${state.achievements.includes(i) ? "done" : ""}"><span>${a[0]}</span><div><b>${a[1]}</b><small>${a[2]}</small></div><em>${state.achievements.includes(i) ? "✓" : "🔒"}</em></div>`).join("")}`;
  else if (kind === "offline") { $("modalContent").innerHTML = `<div class="modal-hero">🌙</div><h2>Сейф работал без тебя</h2><p>За ${Math.floor(data.seconds)} сек производство принесло <b>${fmt(data.gain)}</b> в сейф. Не забудь забрать накопления.</p><button class="primary" id="modalAction">КРУТО</button>`; $("modalAction").addEventListener("click", closeModal); }
  else $("modalContent").innerHTML = `<div class="modal-hero">💡</div><h2>Как играть</h2><ol><li>Жми мемомёт: энергия попадает в сейф.</li><li>Забирай полные партии из сейфа в кошелёк.</li><li>Покупай генераторы, чтобы сейф заполнялся сам.</li><li>Возвращайся за сменой, контрактом и вылазкой.</li><li>Копи до перезапуска — он даёт постоянный бонус.</li></ol><button class="primary" id="modalAction">ПОНЯТНО</button>`; $("modalAction").addEventListener("click", closeModal);
}
function closeModal() { $("modal").classList.add("hidden"); startGameplay(); }

$("clicker").addEventListener("click", click); $("collectBtn").addEventListener("click", collectVault); $("dailyBtn").addEventListener("click", claimDaily); $("questBtn").addEventListener("click", () => openModal("quest")); $("expeditionBtn").addEventListener("click", startExpedition); $("collectionBtn").addEventListener("click", () => openModal("collection")); $("powerUpgrade").addEventListener("click", () => buyUpgrade("power")); $("safeUpgrade").addEventListener("click", () => buyUpgrade("safe")); $("critUpgrade").addEventListener("click", () => buyUpgrade("crit")); $("labBtn").addEventListener("click", () => openModal("lab")); $("prestigeBtn").addEventListener("click", prestige); $("achievementsBtn").addEventListener("click", () => openModal("achievements")); $("helpBtn").addEventListener("click", () => openModal("help")); $("goldenBtn").addEventListener("click", catchGolden); $("modalClose").addEventListener("click", closeModal); $("modal").addEventListener("click", event => { if (event.target.id === "modal") closeModal(); });
$("soundBtn").addEventListener("click", () => { state.sound = !state.sound; $("soundBtn").textContent = state.sound ? "🔊 Звук" : "🔇 Звук"; save(); }); $("resetBtn").addEventListener("click", () => { if (confirm("Сбросить весь прогресс?")) { localStorage.removeItem(SAVE_KEY); location.reload(); } });
document.addEventListener("visibilitychange", () => { if (document.hidden) { save(); stopGameplay(); } else startGameplay(); });

load(); render(); initYandexSDK();
let lastTick = performance.now(); let saveTimer = 0;
function tick(now) { const dt = Math.min(1, (now - lastTick) / 1000); lastTick = now; const clock = Date.now(); if (!document.hidden) addToVault(productionPerSecond() * dt); if (state.expeditionUntil && clock >= state.expeditionUntil && !state.expeditionClaimable) { state.expeditionClaimable = true; toast("🛸 ВЫЛАЗКА ВЕРНУЛАСЬ!"); } if (state.goldenUntil && clock > state.goldenUntil) $("goldenBtn").classList.add("hidden"); saveTimer += dt; if (saveTimer >= SAVE_EVERY_SECONDS) { saveTimer = 0; save(); } render(); requestAnimationFrame(tick); }
requestAnimationFrame(tick);
