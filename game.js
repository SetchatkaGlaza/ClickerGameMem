const SAVE_KEY = "brainrot67_save_v2";

let ysdk = null;
let state = {
  coins: 0,
  clickPower: 1,
  autoPower: 0,
  critLevel: 0,
  factoryLevel: 0,
  prestige: 0,
  boostUntil: 0,
  combo: 1,
  comboUntil: 0,
  totalClicks: 0,
  totalEarned: 0,
  sound: true,
  unlocked: [true, false, false, false, false, false, false],
  achievements: []
};

const EVOLUTIONS = [
  {at:0, name:"67", emoji:"🟡", sub:"Самое начало."},
  {at:100, name:"67+", emoji:"🟠", sub:"Что-то уже происходит."},
  {at:1000, name:"67 ULTRA", emoji:"🔥", sub:"Мемная температура повышена."},
  {at:10000, name:"BRAINROT 67", emoji:"🧠", sub:"Мозг начинает сдавать."},
  {at:100000, name:"MEGA BRAINROT", emoji:"💀", sub:"Обратной дороги нет."},
  {at:1000000, name:"GIGA 67", emoji:"👑", sub:"Ты стал частью фабрики."},
  {at:10000000, name:"???", emoji:"❓", sub:"Секрет пока не раскрыт."}
];

const ACHIEVEMENTS = [
  ["👆","Первый клик","Сделать 1 клик",()=>state.totalClicks>=1],
  ["6️⃣7️⃣","67","Сделать 67 кликов",()=>state.totalClicks>=67],
  ["🔥","Разогрев","Получить комбо x5",()=>state.combo>=5],
  ["💰","Тысяча","Заработать 1 000",()=>state.totalEarned>=1000],
  ["🏭","Фабрика","Купить первый уровень фабрики",()=>state.factoryLevel>=1],
  ["💥","КРИТ","Купить критический клик",()=>state.critLevel>=1],
  ["♻️","Перерождение","Сделать престиж",()=>state.prestige>=1],
  ["🧠","BRAINROT","Открыть BRAINROT 67",()=>state.coins>=10000]
];

const $ = id => document.getElementById(id);
const fmt = n => {
  if (n < 1000) return Math.floor(n).toString();
  const units=["K","M","B","T","Qa","Qi"];
  let i=-1,x=n;
  while(x>=1000&&i<units.length-1){x/=1000;i++;}
  return x.toFixed(x>=100?0:x>=10?1:2)+units[i];
};

function load(){
  try{
    const saved=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(saved) state={...state,...saved};
  }catch{}
  unlockEvolution();
}
function save(){localStorage.setItem(SAVE_KEY,JSON.stringify(state));}

async function initYandexSDK(){
  try{
    if(!window.YaGames)return;
    ysdk=await YaGames.init();
    if(ysdk.features?.LoadingAPI)ysdk.features.LoadingAPI.ready();
    console.log("Yandex Games SDK initialized");
  }catch(e){console.warn("SDK init failed:",e);}
}

function baseMultiplier(){return (1+state.prestige*.1)*(1+state.factoryLevel*.1);}
function multiplier(){return baseMultiplier()*(Date.now()<state.boostUntil?3:1);}
function clickValue(){return state.clickPower*multiplier();}
function incomePerSecond(){return state.autoPower*multiplier();}
function powerPrice(){return Math.floor(10*Math.pow(1.55,state.clickPower-1));}
function autoPrice(){return Math.floor(50*Math.pow(1.65,state.autoPower));}
function critPrice(){return Math.floor(250*Math.pow(2.1,state.critLevel));}
function factoryPrice(){return Math.floor(1000*Math.pow(2.5,state.factoryLevel));}
function prestigeCost(){return 100000*Math.pow(10,state.prestige);}

function currentEvolution(){
  let idx=0;
  for(let i=0;i<EVOLUTIONS.length;i++)if(state.coins>=EVOLUTIONS[i].at)idx=i;
  return {idx,...EVOLUTIONS[idx],next:EVOLUTIONS[Math.min(idx+1,EVOLUTIONS.length-1)]};
}
function unlockEvolution(){
  const evo=currentEvolution();
  state.unlocked[evo.idx]=true;
}
function rankName(){
  const c=state.coins;
  if(c>=1000000)return "GIGA";
  if(c>=100000)return "МЕГА";
  if(c>=10000)return "BRAINROT";
  if(c>=1000)return "ЗАРАЗНЫЙ";
  if(c>=100)return "РАЗОГРЕТ";
  return "НОВИЧОК";
}
function render(){
  unlockEvolution();
  const evo=currentEvolution();
  $("coins").textContent=fmt(state.coins);
  $("income").textContent=fmt(incomePerSecond());
  $("level").textContent=Math.max(1,Math.floor(Math.log10(Math.max(1,state.coins)))+1);
  $("rank").textContent=rankName();

  $("powerPrice").textContent=fmt(powerPrice());
  $("autoPrice").textContent=fmt(autoPrice());
  $("critPrice").textContent=fmt(critPrice());
  $("factoryPrice").textContent=fmt(factoryPrice());

  $("powerLevel").textContent=`LVL ${state.clickPower}`;
  $("autoLevel").textContent=`LVL ${state.autoPower}`;
  $("critLevel").textContent=`LVL ${state.critLevel}`;
  $("factoryLevel").textContent=`LVL ${state.factoryLevel}`;

  $("powerUpgrade").disabled=state.coins<powerPrice();
  $("autoUpgrade").disabled=state.coins<autoPrice();
  $("critUpgrade").disabled=state.coins<critPrice();
  $("factoryUpgrade").disabled=state.coins<factoryPrice();

  $("prestige").textContent=`Престиж: ${state.prestige}`;
  $("prestigeBonus").textContent=`+${state.prestige*10}%`;

  const next=evo.next;
  $("evolution").textContent=`${evo.emoji} ${evo.name}`;
  $("evolutionSub").textContent=evo.idx<EVOLUTIONS.length-1
    ? `Следующая мутация: ${fmt(next.at)}`
    : "Ты дошёл до неизвестного.";
  $("nextUnlock").textContent=evo.idx<EVOLUTIONS.length-1?fmt(next.at):"MAX";
  const span=Math.max(1,next.at-evo.at);
  $("progressBar").style.width=Math.min(100,Math.max(0,(state.coins-evo.at)/span*100))+"%";

  $("prestigeBtn").disabled=state.coins<prestigeCost();
  $("prestigeBtn").textContent=`ПРЕСТИЖ — ${fmt(prestigeCost())}`;

  const remain=Math.max(0,Math.ceil((state.boostUntil-Date.now())/1000));
  $("boostActive").textContent=remain?`×3 ещё ${remain}с`:"";

  const comboRemain=Math.max(0,state.comboUntil-Date.now());
  $("combo").textContent=`x${state.combo}`;
  $("comboBar").style.width=Math.min(100,comboRemain/1800*100)+"%";

  const done=ACHIEVEMENTS.filter((_,i)=>state.achievements.includes(i)).length;
  $("achievementCount").textContent=`${done}/${ACHIEVEMENTS.length}`;
  $("collectionCount").textContent=`${state.unlocked.filter(Boolean).length}/${EVOLUTIONS.length}`;
}

function toast(text){
  const el=$("toast");el.textContent=text;el.classList.add("show");
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),1200);
}
function floatText(text,x,y,crit=false){
  const el=document.createElement("div");el.className="float"+(crit?" crit":"");
  el.textContent=text;el.style.left=x+"px";el.style.top=y+"px";
  document.body.appendChild(el);setTimeout(()=>el.remove(),700);
}
function beep(freq=440,duration=.04){
  if(!state.sound)return;
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    const ctx=beep.ctx||(beep.ctx=new C());
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.value=freq;o.type="square";g.gain.value=.025;
    o.connect(g);g.connect(ctx.destination);o.start();
    g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);
    o.stop(ctx.currentTime+duration);
  }catch{}
}
function checkAchievements(){
  ACHIEVEMENTS.forEach((a,i)=>{
    if(!state.achievements.includes(i)&&a[3]()){
      state.achievements.push(i);
      toast("🏆 "+a[1]);
      beep(880,.1);
    }
  });
}
function click(){
  const now=Date.now();
  if(now<state.comboUntil) state.combo=Math.min(10,state.combo+1);
  else state.combo=1;
  state.comboUntil=now+1800;

  let gain=clickValue()*state.combo;
  let crit=false;
  const critChance=Math.min(.35,state.critLevel*.025);
  if(Math.random()<critChance){
    gain*=10;
    crit=true;
  }
  state.coins+=gain;
  state.totalEarned+=gain;
  state.totalClicks++;

  const r=$("clicker").getBoundingClientRect();
  floatText((crit?"💥 CRIT! +":"+")+fmt(gain),r.left+r.width/2,r.top+r.height*.42,crit);
  beep(crit?900:300+(state.combo*25),crit?.09:.025);
  checkAchievements();save();render();
}
function buy(type){
  const map={
    power:["powerPrice","clickPower"],
    auto:["autoPrice","autoPower"],
    crit:["critPrice","critLevel"],
    factory:["factoryPrice","factoryLevel"]
  };
  const [priceFn,field]=map[type];
  const price=window[priceFn] ? window[priceFn]() : 0;
  if(state.coins<price)return;
  state.coins-=price;
  state[field]++;
  toast("КУПЛЕНО ✓");
  beep(650,.06);
  checkAchievements();save();render();
}
function prestige(){
  const cost=prestigeCost();
  if(state.coins<cost)return;
  state.prestige++;
  state.coins=0;state.clickPower=1;state.autoPower=0;state.critLevel=0;state.factoryLevel=0;
  state.combo=1;state.comboUntil=0;
  checkAchievements();save();render();toast("♻️ ПЕРЕРОЖДЕНИЕ!");
}
function showRewarded(){
  if(!ysdk?.adv?.showRewardedVideo){
    toast("Реклама появится после загрузки в Яндекс Игры");
    return;
  }
  $("rewardedBtn").disabled=true;
  ysdk.adv.showRewardedVideo({
    callbacks:{
      onOpen:()=>{},
      onRewarded:()=>{state.boostUntil=Date.now()+60000;save();render();toast("🔥 БУСТ ×3 НА 60 СЕКУНД!");},
      onClose:()=>{$("rewardedBtn").disabled=false;render();},
      onError:e=>{$("rewardedBtn").disabled=false;console.warn(e);}
    }
  });
}
function openModal(kind){
  $("modal").classList.remove("hidden");
  if(kind==="collection"){
    $("modalContent").innerHTML=`<h2 class="modal-title">🧠 КОЛЛЕКЦИЯ</h2>
    <div class="grid">${EVOLUTIONS.map((e,i)=>`
      <div class="card ${state.unlocked[i]?"":"locked"}">
        <div class="emoji">${state.unlocked[i]?e.emoji:"🔒"}</div>
        <b>${state.unlocked[i]?e.name:"???"}</b>
        <small>${state.unlocked[i]?e.sub:`Открывается на ${fmt(e.at)}`}</small>
      </div>`).join("")}</div>`;
  }else{
    $("modalContent").innerHTML=`<h2 class="modal-title">🏆 ДОСТИЖЕНИЯ</h2>
    ${ACHIEVEMENTS.map((a,i)=>{const done=state.achievements.includes(i);return`
      <div class="achievement ${done?"done":""}">
        <div class="emoji">${a[0]}</div>
        <div><b>${a[1]}</b><small>${a[2]}</small></div>
        <div class="check">${done?"✓":"🔒"}</div>
      </div>`}).join("")}`;
  }
}
function closeModal(){$("modal").classList.add("hidden");}

$("clicker").addEventListener("click",click);
$("powerUpgrade").addEventListener("click",()=>buy("power"));
$("autoUpgrade").addEventListener("click",()=>buy("auto"));
$("critUpgrade").addEventListener("click",()=>buy("crit"));
$("factoryUpgrade").addEventListener("click",()=>buy("factory"));
$("prestigeBtn").addEventListener("click",prestige);
$("rewardedBtn").addEventListener("click",showRewarded);
$("collectionBtn").addEventListener("click",()=>openModal("collection"));
$("achievementsBtn").addEventListener("click",()=>openModal("achievements"));
$("modalClose").addEventListener("click",closeModal);
$("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});

$("soundBtn").addEventListener("click",()=>{
  state.sound=!state.sound;
  $("soundBtn").textContent=state.sound?"🔊 Звук":"🔇 Звук";save();
});
$("resetBtn").addEventListener("click",()=>{
  if(!confirm("Сбросить весь прогресс?"))return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
});

load();render();

let last=performance.now(),saveClock=0;
function tick(now){
  const dt=Math.min(1,(now-last)/1000);last=now;
  const income=incomePerSecond();
  if(income>0){
    const gain=income*dt;
    state.coins+=gain;state.totalEarned+=gain;
    checkAchievements();
  }
  saveClock+=dt;
  if(saveClock>=5){saveClock=0;save();}
  render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
