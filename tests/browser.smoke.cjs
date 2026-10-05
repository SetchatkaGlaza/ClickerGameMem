const assert=require("node:assert/strict");
const {chromium}=require("playwright");

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
    await page.addInitScript(() => localStorage.setItem("garage_tycoon_idle_v3", JSON.stringify({tutorialDone:true,lastSave:Date.now()})));
    const errors=[];
    page.on("pageerror",e=>errors.push("pageerror: "+e.message));
    page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text())});
    await page.route("**/sdk.js",route=>route.fulfill({status:200,contentType:"application/javascript",body:""}));
    await page.goto("http://127.0.0.1:4173/index.html",{waitUntil:"domcontentloaded"});
    await page.locator("#startBtn").waitFor({state:"visible",timeout:10000});
    await page.locator("#startBtn").click();
    assert.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),0,"browser page must not scroll");
    await page.locator("#clicker").click();
    assert.notEqual(await page.locator("#money").innerText(),"0 ₽","first click must pay");
    await page.locator("#clicker").click({clickCount:150});
    await page.waitForTimeout(350);
    await page.locator('[data-tab="tools"]').click();
    assert.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),0,"tab navigation must not scroll the browser page");
    assert.equal(await page.evaluate(()=>document.querySelector("#game").scrollTop),0,"tab navigation must reset the in-game scroll");
    const firstTool=page.locator('[data-tool="0"]');
    assert.equal(await firstTool.isDisabled(),false,"first tool should become available");
    await firstTool.click();
    await page.waitForTimeout(250);
    const toolLevel=await page.evaluate(()=>JSON.parse(localStorage.getItem("garage_tycoon_idle_v3")).tools[0]);
    assert.equal(toolLevel,1,"tool purchase should persist");
    await page.reload({waitUntil:"domcontentloaded"});
    await page.locator("#startBtn").waitFor({state:"visible",timeout:10000});
    await page.locator("#startBtn").click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("garage_tycoon_idle_v3")).tools[0]),1,"tool level should survive reload");
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("garage_tycoon_idle_v3")).tutorialDone),true,"save should survive reload");
    if(errors.length)throw new Error(errors.join("\n"));
    console.log("Browser smoke test passed.");
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
