const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function element() {
  return {
    textContent: "", innerHTML: "", style: {}, dataset: {}, hidden: false, disabled: false, src: "", onerror: null,
    classList: { values: new Set(["hidden"]), add(...items) { items.forEach(item => this.values.add(item)); }, remove(...items) { items.forEach(item => this.values.delete(item)); }, contains(item) { return this.values.has(item); } },
    addEventListener() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }, scrollIntoView() {}, remove() {}
  };
}

const elements = new Map();
let rewardedCallbacks;
let intervalId = 0;
const clearedIntervals = [];
const document = {
  hidden: false,
  body: { append() {} },
  getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
  querySelectorAll() { return []; },
  createElement() { return element(); },
  addEventListener() {}
};
const context = {
  console, document, Date, Math, JSON, Number, Array, Object, Set,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  performance: { now() { return 0; } }, confirm() { return false; },
  setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return ++intervalId; }, clearInterval(id) { if (id) clearedIntervals.push(id); }, requestAnimationFrame() {},
  window: {}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("game.js", "utf8"), context);

const run = source => vm.runInContext(source, context);
run("state = defaultState(); render();");
assert.equal(run("state.money"), 0, "new game starts with no money");
run("click({ clientX: 10, clientY: 10 });");
assert.ok(run("state.money") > 0 && run("state.parts") > 0 && run("state.totalClicks") === 1, "repair click pays money and parts");
run("state.money = 100000; const beforeWorkshop = state.workshops[0]; buyWorkshop(0);");
assert.equal(run("state.workshops[0]"), 1, "workshop purchase works");
run("const beforePower = state.clickPower; buyUpgrade('power');");
assert.equal(run("state.clickPower"), 2, "power upgrade works");
run("state.lastDaily = ''; const beforeDaily = state.money; claimDaily();");
assert.ok(run("state.money") > run("beforeDaily"), "daily reward pays out");
run("state.lastCrate = 0; const beforeCrate = state.parts; claimCrate();");
assert.ok(run("state.parts") > run("beforeCrate"), "crate pays parts");
run("state.parts = order().need; const beforeOrders = state.ordersDone; completeOrder();");
assert.equal(run("state.ordersDone"), 1, "order completes when enough parts exist");
run("state.parts = CARS[0].parts; finishAssembly(0, 70);");
assert.equal(run("state.cars[0]"), true, "car assembly unlocks car");
assert.equal(run("state.equippedCar"), 0, "first built car becomes active");
assert.equal(run("state.carQuality[0]"), .5, "perfect assembly grants quality bonus");
run("state.totalEarned = GARAGES[3].at; selectGarage(3);");
assert.equal(run("state.selectedGarage"), 3, "unlocked garage can be selected");
assert.ok(run("garageBonus()") > 0, "selected garage affects multiplier");
run("state.specialUntil = Date.now() + 1; $('specialBtn').classList.remove('hidden'); const beforeSpecial = state.money; catchSpecial();");
assert.ok(run("state.money") > run("beforeSpecial"), "special car event pays out");
run("ysdk = { adv: { showRewardedVideo({ callbacks }) { rewardedCallbacks = callbacks; } } }; showRewarded('turbo'); rewardedCallbacks.onRewarded();");
assert.ok(run("state.boostUntil") > Date.now(), "rewarded turbo enables timed boost");
run("openModal('assembly', { index: 1 }); closeModal();");
assert.ok(clearedIntervals.length > 0, "closing modal clears assembly timer");
run("state.totalEarned = prestigeCost(); state.cars[0] = true; state.technologies[0] = 2; prestige();");
assert.equal(run("state.prestige"), 1, "prestige increments");
assert.equal(run("state.cars[0]"), true, "prestige retains cars");
assert.equal(run("state.technologies[0]"), 2, "prestige retains technologies");
assert.equal(run("state.equippedCar"), 0, "prestige retains the active car");
assert.equal(run("state.selectedGarage"), 3, "prestige retains the selected garage");
console.log("All Garage Tycoon mechanics tests passed.");
