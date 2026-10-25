// Headless browser checks. No packages required: node verify-ui.cjs
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const reference = require('./reference/animation-reference.json');
const planeAssets = require('./reference/plane-assets.json');
const { createHash } = require('node:crypto');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  // Verify that the bundled art is byte-for-byte the original fetched asset.
  for (const frame of planeAssets.frames) {
    const bytes = fs.readFileSync(path.join(__dirname,frame.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),frame.sha256);
  }
  const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  if (!executable) throw new Error('Chrome or Edge is required for the UI check.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aviator-ui-'));
  const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--in-process-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let diagnostics = '';
  browser.stderr.on('data', chunk => { diagnostics += chunk; });
  let socket;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await delay(100);
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl.replace('localhost', '127.0.0.1'));
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = event => reject(event.error || new Error(event.message || 'Unable to connect to headless browser')); });
    let id = 0;
    const pending = new Map(), errors = [];
    socket.onclose = event => { for (const callback of pending.values()) callback.reject(new Error(`Browser connection closed: ${event.code} ${event.reason}`)); pending.clear(); };
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
      if (message.id) {
        const callback = pending.get(message.id); pending.delete(message.id);
        if (message.error) callback.reject(new Error(message.error.message)); else callback.resolve(message.result);
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error(`Timed out: ${method}`)); }, 8000);
      pending.set(requestId, { resolve: result => { clearTimeout(timeout); resolve(result); }, reject: error => { clearTimeout(timeout); reject(error); } });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__time = 0; window.__frames = []; window.__timers = new Map(); let timerId = 0;
      Object.defineProperty(performance, 'now', { value: () => window.__time });
      window.requestAnimationFrame = callback => window.__frames.push(callback);
      window.setTimeout = (callback, delay, ...args) => { const id = ++timerId; window.__timers.set(id, {at:window.__time + delay, callback:() => callback(...args)}); return id; };
      window.clearTimeout = id => window.__timers.delete(id);
      window.__advance = time => { window.__time = time; for (const [id,timer] of window.__timers) { if(timer.at <= time) { window.__timers.delete(id); timer.callback(); } } const frames = window.__frames.splice(0); frames.forEach(callback => callback(time)); };
    ` });
    const open = async () => {
      await send('Page.navigate', { url: pathToFileURL(path.join(__dirname, 'index.html')).href });
      for (let i = 0; i < 100; i++) {
        if (await evaluate("!!document.getElementById('action0') && !!window.__advance")) break;
        await delay(50);
      }
      await evaluate('__advance(0)');
      const dimensions = await evaluate(`Promise.all([...document.querySelectorAll('#planeShape image')].map(async el => { const image = new Image(); image.src = el.href.baseVal; await image.decode(); return [image.naturalWidth,image.naturalHeight]; }))`);
      assert.deepEqual(dimensions,[[150,74],[150,74],[150,74],[150,74]]);
    };
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const change = (selector, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const wallet = () => evaluate("Number(document.getElementById('wallet').textContent.replaceAll(',', ''))");
    const screenshot = async name => {
      await evaluate('document.getAnimations().forEach(animation => animation.finish())');
      const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.mkdirSync(path.join(__dirname, 'preview'), { recursive: true });
      fs.writeFileSync(path.join(__dirname, 'preview', name), Buffer.from(image.data, 'base64'));
    };

    if (process.argv.includes('--plane-reference')) {
      await send('Emulation.setDeviceMetricsOverride', { width:900,height:640,deviceScaleFactor:1,mobile:false });
      await send('Page.navigate', { url:pathToFileURL(path.join(__dirname,'preview','plane-frames.html')).href });
      for (let i=0;i<100;i++) {
        if (await evaluate("document.images.length===4 && [...document.images].every(img=>img.complete && img.naturalWidth===150)")) break;
        await delay(50);
      }
      assert.equal(await evaluate("[...document.images].filter(img=>img.complete && img.naturalWidth===150).length"),4);
      await screenshot('plane-frames.png');
      await send('Browser.close');
      return;
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 1903, height: 1031, deviceScaleFactor: 1, mobile: false });
    await open();
    assert.equal(await wallet(), 29999);
    await change('#stake0', '5'); await click('#action0');
    assert.equal(await wallet(), 29994);
    assert.equal(await evaluate("document.getElementById('stake0').disabled"), true);
    await change('#stake0', '999');
    assert.equal(await evaluate("document.getElementById('stake0').value"), '5.00');
    await click('#action0'); assert.equal(await wallet(), 29999);

    await evaluate('SIM_CONFIG.crashPoints[0] = 2.56; __advance(4000); __advance(4000 + Math.log(1.47) / SIM_CONFIG.growthRate * 1000)');
    assert.equal(await evaluate("document.querySelector('.mult').textContent"), '1.47x');
    await change('#stake0', '1');
    await screenshot('desktop.png');
    const desktop = await evaluate(`(() => { const box = el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; }; return { viewport:[innerWidth,innerHeight], page:[document.documentElement.scrollWidth,document.documentElement.scrollHeight], arena:box(document.querySelector('.arena')), sidebar:box(document.querySelector('.bets')), controls:box(document.querySelector('.controlRow')) }; })()`);
    assert.equal(desktop.page[0], 1903); assert.equal(desktop.page[1], 1031);

    // The original propeller poses advance at the client's 7.5 frames/second.
    const blade = await evaluate("Number(document.getElementById('planeShape').dataset.frame)");
    const background = await evaluate("[document.getElementById('backgroundGlow').getAttribute('fill'), getComputedStyle(document.querySelector('.flightStage'), '::before').backgroundImage]");
    await evaluate('__advance(window.__time + 1000 / 7.5)');
    assert.equal(await evaluate("Number(document.getElementById('planeShape').dataset.frame)"), (blade+1)%4);
    // Color changes are deliberately gradual; allow a second for visible change.
    await evaluate('__advance(window.__time + 1000)');
    const movingBackground = await evaluate("[document.getElementById('backgroundGlow').getAttribute('fill'), getComputedStyle(document.querySelector('.flightStage'), '::before').backgroundImage]");
    assert.equal(movingBackground[0], background[0]); // Blue stays blue below 2x.
    assert.notEqual(movingBackground[1], background[1]);
    await click('#menuButton'); await click('#pause');
    const stoppedBlade = await evaluate("document.getElementById('planeShape').dataset.frame");
    await evaluate('__advance(window.__time + 100)');
    assert.equal(await evaluate("document.getElementById('planeShape').dataset.frame"), stoppedBlade);
    assert.deepEqual(await evaluate("[document.getElementById('backgroundGlow').getAttribute('fill'), getComputedStyle(document.querySelector('.flightStage'), '::before').backgroundImage]"), movingBackground);
    await click('#pause'); await click('#menuButton');
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await evaluate('__advance(window.__time + 20)');
    const reducedBlade = await evaluate("document.getElementById('planeShape').dataset.frame");
    const reducedBackground = await evaluate("getComputedStyle(document.querySelector('.flightStage'), '::before').backgroundImage");
    await evaluate('__advance(window.__time + 20)');
    assert.equal(await evaluate("document.getElementById('planeShape').dataset.frame"), reducedBlade);
    assert.equal(reducedBlade,'0');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.flightStage'), '::before').backgroundImage"), reducedBackground);
    await send('Emulation.setEmulatedMedia', { features: [] });
    await change('#stake0', '5');
    await click('#action0'); assert.equal(await wallet(), 29994); // Queued next-round stake.
    await click('#action0'); assert.equal(await wallet(), 29999);
    await click('#historyButton'); assert.equal(await evaluate("document.getElementById('historyPopover').hidden"), false);
    await click('#tab-top'); assert.equal(await evaluate("document.getElementById('tab-top').getAttribute('aria-selected')"), 'true');
    await click('#tab-previous'); assert.match(await evaluate("document.getElementById('betrows').textContent"), /Completed round/);

    // Independent placement, automatic cash out, manual cash out, and crash settlement.
    await open();
    await change('#stake0', '5'); await click('#action0');
    await change('#stake1', '2'); await click('#action1');
    await click('[data-mode="auto"][data-panel="1"]');
    await click('#autoCash1'); await change('#cashAt1', '1.10');
    await evaluate('__advance(4000); __advance(6000)');
    assert.match(await evaluate("document.getElementById('action1').textContent"), /Cashed out/);
    assert.equal(await evaluate("document.querySelector('.winPrize strong').textContent"), '2.20');
    assert.equal(await evaluate("document.querySelector('.winMessage strong').textContent"), '1.10x');
    assert.equal(await wallet(), 29994.2);
    await click('#action0'); assert.equal(await wallet(), 30000);
    assert.equal(await evaluate("document.querySelectorAll('.winNotification').length"), 2);
    assert.equal(await evaluate("document.querySelector('.winNotification:last-child .winPrize strong').textContent"), '5.80');
    await evaluate('__advance(7000); __advance(7001)');
    assert.match(await evaluate("document.getElementById('status').textContent"), /FLEW AWAY/);
    assert.equal(await evaluate("document.querySelector('#history .pill').textContent"), '1.24x');

    // Pause freezes the multiplier; skipping refunds unsettled stakes.
    await click('#menuButton'); await click('#next'); await click('#action0');
    const beforeRefund = await wallet();
    await click('#next'); assert.equal(await wallet(), beforeRefund + 5);
    await click('#pause');
    const frozen = await evaluate("document.getElementById('status').textContent");
    await evaluate('__advance(15000)');
    assert.equal(await evaluate("document.getElementById('status').textContent"), frozen);
    await click('#pause');

    // The reference win: 10.00 at 1.53x must display and credit exactly 15.30.
    await open();
    await evaluate('SIM_CONFIG.crashPoints[0] = 2.56');
    await change('#stake0', '10'); await click('#action0');
    await evaluate('__advance(4000); __advance(4000 + Math.log(1.53) / SIM_CONFIG.growthRate * 1000)');
    await click('#action0');
    assert.equal(await evaluate("document.querySelector('.winMessage strong').textContent"), '1.53x');
    assert.equal(await evaluate("document.querySelector('.winPrize strong').textContent"), '15.30');
    assert.equal(await wallet(), 30004.3);
    await screenshot('desktop-win.png');
    await change('#stake0', '99');
    assert.match(await evaluate("document.getElementById('action0').textContent"), /15.30/);
    await click('.winClose');
    assert.equal(await evaluate("document.querySelectorAll('.winNotification').length"), 0);

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await open();
    await evaluate('SIM_CONFIG.crashPoints[0] = 2.56; __advance(4000); __advance(9000)');
    await screenshot('mobile.png');
    const mobile = await evaluate(`({ width:innerWidth, scroll:document.documentElement.scrollWidth, actions:[...document.querySelectorAll('.action')].map(el => { const r=el.getBoundingClientRect(); return {x:r.x,right:r.right,width:r.width}; }) })`);
    assert.equal(mobile.scroll, 390);
    mobile.actions.forEach(box => { assert.ok(box.x >= 0 && box.right <= 390 && box.width > 60); });

    await open();
    await evaluate('SIM_CONFIG.crashPoints[0] = 2.56');
    await change('#stake0', '10'); await click('#action0');
    await evaluate('__advance(4000); __advance(4000 + Math.log(1.53) / SIM_CONFIG.growthRate * 1000)');
    await click('#action0');
    await screenshot('mobile-win.png');
    const winBox = await evaluate("(() => { const r = document.querySelector('.winNotification').getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width,height:r.height}; })()");
    assert.ok(Math.abs(winBox.width - 344) < .01); assert.ok(Math.abs(winBox.height - 48) < .01);
    assert.ok(winBox.left >= 0 && winBox.right <= 390);
    await evaluate('__advance(window.__time + 5001)');
    assert.equal(await evaluate("document.querySelectorAll('.winNotification').length"), 0);

    // Code-gated preview uses the same preset/round as the running simulation.
    await send('Emulation.setDeviceMetricsOverride', { width:1903,height:1031,deviceScaleFactor:1,mobile:false });
    await open();
    await evaluate('SIM_CONFIG.crashPoints[0]=8.17');
    await click('#predictLauncher');
    assert.equal(await evaluate("document.activeElement.id"), 'predictCode');
    assert.equal(await evaluate("document.getElementById('predictPreview').hidden"), true);
    await screenshot('prediction-access.png');
    await click('#predictUnlock');
    assert.match(await evaluate("document.getElementById('predictCodeError').textContent"), /Enter your access code/);
    const submitCode = value => evaluate(`(() => { document.getElementById('predictCode').value=${JSON.stringify(value)}; document.getElementById('predictCodeForm').requestSubmit(); })()`);
    await submitCode('WRONG');
    await evaluate('__advance(1800)');
    assert.equal(await evaluate("document.getElementById('predictPercent').textContent"), '100%');
    assert.equal(await evaluate("document.getElementById('predictionDialog').dataset.accessState"), 'checking');
    await evaluate('__advance(2100)');
    assert.equal(await evaluate("document.getElementById('predictionDialog').dataset.accessState"), 'failed');
    assert.equal(await evaluate("document.getElementById('predictAdmin').hidden"), false);
    assert.equal(await evaluate("document.getElementById('predictPreview').hidden"), true);
    await submitCode(' DMFIRST ');
    await evaluate('__advance(4200)');
    assert.equal(await evaluate("document.getElementById('predictPreview').hidden"), false);
    assert.equal(await evaluate("document.activeElement.id"), 'predictGameName');
    await click('#predictRun'); await click('#predictRun');
    assert.equal(await evaluate("document.getElementById('predictRun').disabled"), true);
    await evaluate('__advance(6000)');
    assert.equal(await evaluate("document.getElementById('predictValue').textContent"), '8.17x');
    assert.equal(await evaluate("document.getElementById('predictReady').hidden"), false);
    await screenshot('prediction-desktop.png');
    await click('#predictRun'); await evaluate('__advance(7800)');
    assert.equal(await evaluate("document.getElementById('predictValue').textContent"), '8.17x');
    assert.equal(await wallet(), 29999);
    await send('Emulation.setDeviceMetricsOverride', { width:390,height:844,deviceScaleFactor:1,mobile:true });
    await screenshot('prediction-mobile.png');
    const predictionBox = await evaluate("(() => { const r=document.getElementById('predictionDialog').getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:document.documentElement.scrollWidth}; })()");
    assert.ok(predictionBox.left>=0 && predictionBox.right<=390 && predictionBox.top>=0 && predictionBox.bottom<=844);
    assert.equal(predictionBox.scroll,390);
    // Advancing the game invalidates a previous result and cancels pending reveals.
    await click('#next'); await evaluate('__advance(7801)');
    assert.equal(await evaluate("document.getElementById('predictRoundLabel').textContent"), 'Round 2');
    assert.equal(await evaluate("document.getElementById('predictValue').textContent"), '—x');
    await click('#predictRun'); await evaluate('__advance(9601)');
    assert.equal(await evaluate("document.getElementById('predictValue').textContent"), '2.56x');
    await evaluate('__advance(11801); __advance(25000)');
    assert.equal(await evaluate("document.getElementById('predictRoundLabel').textContent"), 'Round 3');
    await click('#predictRun'); await evaluate('__advance(26800); __advance(27600)');
    assert.equal(await evaluate("document.getElementById('predictValue').textContent"), '5.80x');
    await click('#predictRun'); await click('#next'); await evaluate('__advance(27601)');
    assert.equal(await evaluate("document.getElementById('predictValue').textContent"), '—x');
    assert.equal(await evaluate("document.getElementById('predictResult').getAttribute('aria-busy')"), 'false');
    await click('#predictClose'); await click('#predictLauncher');
    assert.equal(await evaluate("document.getElementById('predictPreview').hidden"), true);
    await submitCode('DMFIRST'); await click('#predictClose'); await click('#predictLauncher');
    await evaluate('__advance(30000)');
    assert.equal(await evaluate("document.getElementById('predictPreview').hidden"), true);
    await submitCode('DMFIRST'); await evaluate('__advance(32100)');
    await send('Emulation.setEmulatedMedia', { features:[{name:'prefers-reduced-motion',value:'reduce'}] });
    await click('#predictRun');
    assert.equal(await evaluate("document.getElementById('predictValue').textContent"), '1.08x');
    await send('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await send('Input.dispatchKeyEvent', {type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await delay(50); // Native dialog cancellation and close events are queued.
    assert.equal(await evaluate("document.getElementById('predictionDialog').open"), false);
    assert.equal(await evaluate("document.activeElement.id"), 'predictLauncher');
    await send('Emulation.setEmulatedMedia', {features:[]});

    // A config override is applied before app startup, as it would be in config.js.
    const overrides = await send('Page.addScriptToEvaluateOnNewDocument', {source:`
      Object.defineProperty(window,'SIM_CONFIG',{configurable:true,set(value){
        value.prediction={...value.prediction,accessCode:'CUSTOM42',unlockDurationMs:0,unlockHoldMs:0,revealDurationMs:0,text:{widgetLabel:'PREVIEW'},adminContact:{text:'Support',url:'javascript:alert(1)'}};
        Object.defineProperty(window,'SIM_CONFIG',{value,writable:true,configurable:true});
      }});
    `});
    await open();
    await send('Page.removeScriptToEvaluateOnNewDocument', {identifier:overrides.identifier});
    assert.equal(await evaluate("document.querySelector('#predictLauncher span').textContent"), 'PREVIEW');
    await click('#predictLauncher'); await submitCode('DMFIRST'); await evaluate('__advance(1)');
    assert.equal(await evaluate("document.getElementById('predictPreview').hidden"), true);
    assert.equal(await evaluate("document.getElementById('predictAdminLink').hidden"), true);
    await submitCode('CUSTOM42'); await evaluate('__advance(2)'); await click('#predictRun');
    assert.equal(await evaluate("document.getElementById('predictValue').textContent"), '1.24x');
    await click('#predictClose');
    const disabled = await send('Page.addScriptToEvaluateOnNewDocument', {source:`
      Object.defineProperty(window,'SIM_CONFIG',{configurable:true,set(value){
        value.prediction.enabled=false;
        Object.defineProperty(window,'SIM_CONFIG',{value,writable:true,configurable:true});
      }});
    `});
    await open();
    await send('Page.removeScriptToEvaluateOnNewDocument', {identifier:disabled.identifier});
    await click('#predictLauncher');
    assert.equal(await evaluate("document.getElementById('predictLauncher').hidden"), true);
    assert.equal(await evaluate("document.getElementById('predictionDialog').open"), false);

    const motion = await evaluate(`(() => {
      const fixtures = ${JSON.stringify(reference.positionFixtures)};
      const stage = document.createElement('div');
      stage.className = 'flightStage';
      stage.style.cssText = 'position:absolute;left:0;top:0;width:1484px;height:730px;opacity:0;pointer-events:none';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 1000 500');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      stage.append(svg); document.body.append(stage);
      const renderer = new FlightRenderer(svg, { ...SIM_CONFIG.flight, growthRate:SIM_CONFIG.growthRate });
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const near = (a,b,message) => check(Math.abs(a-b)<.01,message+': '+a+' vs '+b);
      let samples=0, fixturePositions=0, boundedFrames=0;
      try {
        for (const fixture of fixtures) {
          stage.style.width=fixture.width+'px'; stage.style.height=fixture.height+'px'; renderer.resize();
          for (const [time,x,y] of fixture.positions) {
            const p=renderer.point(time);
            near(p.x*fixture.width/1000,x,'Reference x at '+time+'s');
            near(p.y*fixture.height/500,y,'Reference y at '+time+'s');
            fixturePositions++;
          }
        }
        for (const [width,height] of [[1484,730],[382,434],[312,430],[700,260]]) {
          stage.style.width=width+'px'; stage.style.height=height+'px'; renderer.resize(); renderer.beginRound();
          for (let t=0;t<=180;t+=.05) {
            const p=renderer.point(t),next=renderer.point(t+1/60);
            check(Number.isFinite(p.x)&&Number.isFinite(p.y),'Non-finite flight position');
            check(Math.hypot(next.x-p.x,next.y-p.y)<10,'Abrupt frame-to-frame movement');
            check(p.x>=0&&p.x<=1000&&p.y>=0&&p.y<=500,'Flight endpoint out of bounds');
            samples++;
          }
          const top=renderer.point(8),bottom=renderer.point(12),again=renderer.point(16);
          check(bottom.y>top.y+50,'Missing full glide descent');
          near(again.x,top.x,'Glide return x'); near(again.y,top.y,'Glide return y');
          for (const boundary of [8,12,16,20]) {
            const a=renderer.point(boundary-.0001),b=renderer.point(boundary+.0001);
            check(Math.hypot(a.x-b.x,a.y-b.y)<.001,'Discontinuous glide reversal');
          }
          for (const t of [1,3,5,8,10,12,16,24,40,80,180]) {
            renderer.draw(t);
            // Original sprite rectangles preserve the exact reference size and anchor.
            const box=renderer.planeShape.getBoundingClientRect();
            const scale=Math.max(.65,Math.min(1,width/900))*SIM_CONFIG.flight.planeScale;
            near(box.width,150*scale,'Aircraft width'); near(box.height,74*scale,'Aircraft height');
            check(box.left>=-2&&box.top>=-2&&box.right<=width+2&&box.bottom<=height+2,'Aircraft frame clipped');
            check(!renderer.plane.getAttribute('transform').includes('rotate('),'Original artwork angle altered');
            boundedFrames++;
          }
          renderer.draw(8); const firstArc=renderer.curve.getAttribute('d');
          const highMid=renderer.curve.getPointAtLength(renderer.curve.getTotalLength()/2);
          renderer.draw(12); const lowArc=renderer.curve.getAttribute('d');
          const lowMid=renderer.curve.getPointAtLength(renderer.curve.getTotalLength()/2);
          check(/^M0,500 Q/.test(firstArc)&&!firstArc.includes(' L'),'Curve is not one quadratic arc');
          check(firstArc!==lowArc&&lowMid.y>highMid.y,'Whole arc did not settle during glide');
          renderer.draw(12,'crashed',.25);
          check(renderer.curve.getAttribute('d')===''&&renderer.fill.getAttribute('d')==='','Fly-away curve not cleared');
          near(Number(renderer.glow.getAttribute('opacity')),.5625,'Glow fade-out at quarter second');
          check(renderer.plane.getAttribute('opacity')==='1','Aircraft faded instead of flying out');
          renderer.draw(12,'crashed',.5);
          check(renderer.plane.getAttribute('opacity')==='0','Aircraft failed to exit after half second');
          renderer.draw(12,'crashed',1);
          near(Number(renderer.glow.getAttribute('opacity')),0,'Glow failed to fade out');
        }
        const tint=(value,seconds)=>{renderer.draw(seconds??Math.log(value)/SIM_CONFIG.growthRate,'flying',0,value);return renderer.glow.getAttribute('fill');};
        check(tint(1.99)==='rgb(52,180,255)','Low multiplier should stay blue');
        check(tint(2)==='rgb(52,180,255)','2x should begin color blend from blue');
        const middle=tint(2*Math.exp(SIM_CONFIG.growthRate*.25)).slice(4,-1).split(',').map(Number);
        check(middle.every((v,i)=>Math.abs(v-[122,92,250][i])<=1),'Purple midpoint blend incorrect');
        check(tint(2*Math.exp(SIM_CONFIG.growthRate*.51))==='rgb(145,62,248)','Purple endpoint incorrect');
        check(tint(9.99)==='rgb(145,62,248)','Purple should persist below 10x');
        check(tint(10*Math.exp(SIM_CONFIG.growthRate*.51))==='rgb(192,23,180)','Magenta endpoint incorrect');
        renderer.beginRound(); renderer.draw(0,'waiting');
        const rayStart=Number.parseFloat(stage.style.getPropertyValue('--ray-angle'));
        renderer.draw(1); const rayAfter=Number.parseFloat(stage.style.getPropertyValue('--ray-angle'));
        near(rayAfter-rayStart,10,'Ray rotation must be 10 degrees per second');
        renderer.draw(1,'crashed',.4);
        near(Number.parseFloat(stage.style.getPropertyValue('--ray-angle')),rayAfter,'Rays moved after round end');
        renderer.beginRound(); renderer.draw(0,'waiting');
        near(Number.parseFloat(stage.style.getPropertyValue('--ray-angle')),rayAfter,'Ray angle reset between rounds');
        renderer.draw(0,'waiting');
        const firstFrame=Number(renderer.planeShape.dataset.frame);
        const sequence=[];
        for(let step=0;step<=8;step++) {
          renderer.draw(0,'waiting',step/7.5);
          const index=Number(renderer.planeShape.dataset.frame);
          check(index===(firstFrame+step)%4,'Original propeller cadence/order incorrect');
          const visible=renderer.planeFrames.filter(image=>image.getAttribute('visibility')==='visible');
          check(visible.length===1&&visible[0].getAttribute('href').endsWith('plane-'+index+'.svg'),'Wrong or overlapping sprite frames');
          sequence.push(index);
        }
        renderer.draw(0,'flying');
        check(Number(renderer.planeShape.dataset.frame)===sequence.at(-1),'Propeller sequence restarted at takeoff');
        return {samples,fixturePositions,boundedFrames,viewports:4,propellerFrames:sequence,referenceVersion:'v4.2.116-hotfix-3'};
      } finally { renderer.observer?.disconnect(); stage.remove(); }
    })()`);

    // Reviewable examples of the real climb, descent, return and color tiers.
    await send('Emulation.setDeviceMetricsOverride', { width:1903,height:1031,deviceScaleFactor:1,mobile:false });
    await open();
    await evaluate('SIM_CONFIG.crashPoints[0]=30; __advance(4000); __advance(12000)');
    await screenshot('climb.png');
    await evaluate('__advance(16000)');
    await screenshot('descent.png');
    await evaluate('__advance(20000)');
    await screenshot('recovery.png');
    await evaluate('__advance(4000+(Math.log(10)/SIM_CONFIG.growthRate+.6)*1000)');
    await screenshot('high-multiplier.png');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ status: 'PASS', checks: ['public-reference desktop and mobile position fixtures', 'smooth 8-second climb and 4-second glide each way', 'single quadratic arc reshapes during descent', '2x and 10x palette thresholds with smooth blending', 'curve clears and glow fades on fly-away', '36-second ray revolution and continuity between rounds', 'original plane asset hashes and decoding', 'original four-frame propeller sequence at 7.5 fps', 'propeller pause and reduced motion', 'stake locking and cancellation', 'queued bets', 'history and tabs', 'independent panel balances', 'automatic and manual cash out', 'win notifications from both panels', 'exact displayed payout and balance credit', 'notification dismissal and expiry', 'settled payout survives stake changes', 'crash settlement', 'skip refunds', 'pause and resume', 'desktop and mobile overflow', 'prediction code gate, progress hold, retry, and focus', 'prediction config overrides and disabled widget', 'round-matched preset multiplier and stale-result cancellation', 'prediction reduced motion and desktop/mobile dialog bounds', 'no runtime exceptions'], motion, desktop, mobile, winBox, screenshots: ['preview/desktop.png', 'preview/mobile.png', 'preview/desktop-win.png', 'preview/mobile-win.png', 'preview/prediction-access.png', 'preview/prediction-desktop.png', 'preview/prediction-mobile.png'] }, null, 2));
    await send('Browser.close');
  } catch (error) {
    console.error(diagnostics.slice(-4000));
    throw error;
  } finally {
    socket?.close();
    browser.kill();
    // The profile is disposable and restricted to the directory created above.
    for (let i = 0; i < 20; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await delay(100); }
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
