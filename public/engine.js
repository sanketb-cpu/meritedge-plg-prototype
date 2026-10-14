const __D = window.__APP_DATA__;
if(!__D) throw new Error('MeritEdge data was not loaded');

function hydrateFromData(){
  const a = assessments[0];
  const iv = (a && interviews.find(i=>i.assessmentId===a.id)) || interviews[0];
  const text = (id, v) => { const el = document.getElementById(id); if(el && v!=null) el.textContent = v; };
  const pad = n => String(n).padStart(2,"0");
  if(a){
    text("landJobTitle", a.title);
    text("landJobMeta", (a.role||a.title)+" · "+a.invited+" candidates invited");
  }
  if(iv){
    text("landIvTitle", iv.title);
    text("landIvMeta", "Linked to the same assessment · "+iv.completed+" sessions complete");
  }
  text("landStatA", pad(assessments.filter(x=>x.status==="Active").length));
  text("landStatB", pad(interviews.filter(x=>x.status==="Active").length));
  text("landStatC", pad(assessments.reduce((n,x)=>n+(x.shortlisted||0),0)));
  const top = (a?.candidates||[]).slice(0,2);
  const box = document.getElementById("landCandidates");
  if(box && top.length){
    box.innerHTML = top.map(c => {
      const ivc = iv?.candidates?.find(x=>x.id===c.id);
      const ivScore = ivc ? String(ivc.score).replace("/5","") : "—";
      return `<div class="candidate"><span class="avatar">${escapeHtml(initials(c.name))}</span><span><strong>${escapeHtml(c.name)}</strong><small>MeritEdge ${c.score} · AI Interviewer ${ivc?ivc.score:"—"}</small></span><span class="twoscore"><span class="as">${c.score}</span><span class="iv">${escapeHtml(ivScore)}</span></span></div>`;
    }).join("");
  }
  const hero = top[0];
  const heroIv = hero && iv?.candidates?.find(x=>x.id===hero.id);
  if(hero){
    text("landHeroName", hero.name+" · "+a.title);
    text("landHeroMatch", heroIv?.rec || hero.status || "Strong match");
    text("landHeroNote", heroIv?.note || "");
    text("landHeroScore", String(hero.score));
    text("landHeroIv", heroIv?.score || "—");
  }
  const chips = document.getElementById("landChips");
  if(chips) chips.innerHTML = __D.proofChips.map(t=>`<span>${escapeHtml(t)}</span>`).join("");
}

let landMicrocopyTimer = null;
let landMicrocopyIndex = 0;
const LAND_MICROCOPY = ["2 strong matches found", "Interview evidence ready"];

function startLandingMicrocopy(){
  document.querySelectorAll("#landCandidates .twoscore > span").forEach(el => el.classList.add("score-chip"));
  const host = document.getElementById("product");
  if(!host) return;
  let text = document.getElementById("landMicrocopyText");
  if(!text){
    const strip = document.createElement("div");
    strip.className = "land-microcopy";
    strip.id = "landMicrocopy";
    strip.setAttribute("aria-live", "polite");
    strip.innerHTML = '<span class="land-microcopy-dot" aria-hidden="true"></span><span id="landMicrocopyText">2 strong matches found</span>';
    host.querySelector(".mocktop")?.insertAdjacentElement("afterend", strip);
    text = document.getElementById("landMicrocopyText");
  }
  if(!text) return;
  if(landMicrocopyTimer) clearInterval(landMicrocopyTimer);
  const show = () => {
    text.classList.remove("is-changing");
    void text.offsetWidth;
    text.textContent = LAND_MICROCOPY[landMicrocopyIndex];
    text.classList.add("is-changing");
    landMicrocopyIndex = (landMicrocopyIndex + 1) % LAND_MICROCOPY.length;
  };
  show();
  landMicrocopyTimer = window.setInterval(show, 3200);
}

const PERSONAL = new Set(__D.personalDomains);
const DISPOSABLE = new Set(__D.disposableDomains);
const STORE = "me_plg_phase1_proto";
const DEMO_OTP = "123456";
const MILESTONES = __D.milestones;
const messages = __D.stepMessages;

function seedUsers(){ return JSON.parse(JSON.stringify(__D.users)); }
function loadState(){
  try{
    const raw = sessionStorage.getItem(STORE);
    if(raw){ const s = JSON.parse(raw); if(s.users?.length) return s; }
  }catch(e){}
  return {users: seedUsers(), otpCounts: {}, session: null, view: "landing"};
}
function saveState(){ sessionStorage.setItem(STORE, JSON.stringify(state)); }
let state = loadState();
let signupData = {};
let signupVerify = {email:"wait", company:"wait", details:"wait", confirm:""};
let signupVerifyGen = 0;
let otpAttempts = 0;
let otpResendAt = 0;
let appSection = "meritedge";

function findUser(email){ return state.users.find(u => u.email.toLowerCase() === String(email||"").toLowerCase()); }
function ensureAccountEntitlements(u){
  if(!u) return u;
  if(typeof u.freeInviteCredits !== "number") u.freeInviteCredits = 5;
  if(typeof u.freeInvitesUsed !== "number") u.freeInvitesUsed = 0;
  if(!Array.isArray(u.reports)) u.reports = [];
  return u;
}
function freeInviteBalance(u){
  u = ensureAccountEntitlements(u || currentUser());
  if(!u) return {total:5, used:0, left:5};
  const total = Math.max(0, Number(u.freeInviteCredits) || 0);
  const used = Math.max(0, Number(u.freeInvitesUsed) || 0);
  return {total, used, left:Math.max(0, total-used)};
}
function consumeFreeInvites(count){
  const u = ensureAccountEntitlements(currentUser());
  if(!u || creditsRecharged(u)) return true;
  const amount = Math.max(1, Number(count) || 1);
  const balance = freeInviteBalance(u);
  if(balance.left < amount){
    toast(`You have ${balance.left} free invite${balance.left===1?"":"s"} left. Upgrade for more.`);
    return false;
  }
  u.freeInvitesUsed = balance.used + amount;
  saveState();
  return true;
}
function domainOf(email){ return (email.split("@")[1]||"").toLowerCase(); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function initials(name){ return String(name||"U").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase(); }
function toast(msg){ const el=document.getElementById("toast"); el.textContent=msg; el.classList.add("on"); setTimeout(()=>el.classList.remove("on"), 3200); }
let appPointerSelector = "";
function hideAppClickPointer(){
  appPointerSelector = "";
}
function positionAppClickPointer(){}
function showAppClickPointer(){ appPointerSelector = ""; }

const THEME_SUN = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
const THEME_MOON = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
function currentTheme(){ return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"; }
function syncThemeChrome(){
  const t = currentTheme();
  const logo = t === "dark" ? "assets/otomeyt-ai-logo.svg" : "assets/otomeyt-ai-logo-light.svg";
  const appLogo = document.getElementById("teAppLogo");
  if(appLogo) appLogo.src = logo;
  const loginLogo = document.getElementById("loginBrandLogo");
  if(loginLogo) loginLogo.src = logo;
  const plansLogo = document.getElementById("publicPlansLogo");
  if(plansLogo) plansLogo.src = logo;
  const btn = document.getElementById("themeToggle");
  if(btn){
    btn.innerHTML = t === "dark" ? THEME_SUN : THEME_MOON;
    btn.title = t === "dark" ? "Light theme" : "Dark theme";
    btn.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
}
function applyTheme(t){
  t = t === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.classList.toggle("dark", t === "dark");
  document.documentElement.classList.toggle("light", t === "light");
  try{ localStorage.setItem("theme", t); }catch(e){}
  syncThemeChrome();
}
function toggleTheme(){ applyTheme(currentTheme() === "dark" ? "light" : "dark"); }



function syncPremiumSample(){
  const list = state.view==="workspace" && appSection==="meritedge" && !appDetail;
  const plans = state.view==="plans" || (state.view==="workspace" && appSection==="plans");
  const landing = state.view==="landing";
  document.body.classList.toggle("premium-sample", !!(list || plans || landing));
}
function showView(name){
  state.view = name;
  ["landing","login","workspace","plans"].forEach(v => document.getElementById("view-"+v)?.classList.toggle("on", v===name));
  document.body.classList.toggle("in-app", name==="workspace");
  if(name!=="workspace") document.body.classList.remove("me-wiz-on");
  syncPremiumSample();
  if(name==="workspace") renderWorkspace();
  if(name==="plans") renderPublicPlans();
  if(name==="login"){ startLoginSlides(); setTimeout(()=>document.getElementById("loginEmail")?.focus(), 40); }
  saveState();
  const nextHash = name==="landing" ? "" : name;
  if((location.hash||"").replace("#","") !== nextHash) location.hash = nextHash;
}

function selectStep(n){document.querySelectorAll('.step').forEach((el,i)=>el.classList.toggle('active',i===n));const [icon,title,desc]=messages[n];document.getElementById('stepinfo').innerHTML=`<span class="stepicon">${icon}</span><span><strong>${title}</strong> ${desc}</span>`}
document.querySelectorAll('.step').forEach(el=>el.addEventListener('click',()=>selectStep(+el.dataset.step)));

function isPreviewUser(u){ return !!(u && u.kind === "preview"); }
function intentRole(){ return (state.intent && state.intent.role) || "Senior Product Designer"; }
function intentProduct(){ return (state.intent && state.intent.product) || "both"; }
function wantsAssess(){ return intentProduct() !== "interview"; }
function wantsInterview(){ return intentProduct() !== "assess"; }
function proofChipsHtml(){
  return `<div class="proof-chips">${__D.proofChips.map(t=>`<span>${escapeHtml(t)}</span>`).join("")}</div>`;
}
const INTENT_ROLES = __D.intentRoles;
const INTENT_VOLUMES = __D.intentVolumes;
const INTENT_PRODUCTS = __D.intentProducts;
let intentDraft = {role:"Senior Product Designer", volume:"few", product:"both"};
let aha = null;
let sitin = null;
let sitinTimer = null;
let wow = null;
let pendingReady = null;

function startFlow(){
  signupReason = "preview";
  pendingInvite = null;
  closeSignup();
  openIntentPicker();
}
function openIntentPicker(){
  intentDraft = Object.assign({role:"Senior Product Designer", volume:"few", product:"both"}, state.intent||{});
  drawIntentPicker();
  document.getElementById("intentModal").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeIntentPicker(){
  document.getElementById("intentModal").classList.remove("open");
  document.body.style.overflow = "";
}
function setIntent(key, value){
  intentDraft[key] = value;
  drawIntentPicker();
}
function drawIntentPicker(){
  const body = document.getElementById("intentBody");
  if(!body) return;
  const pick = (arr, key, labelFn) => arr.map(item=>{
    const id = item.id;
    const label = labelFn ? labelFn(item) : item.id;
    return `<button type="button" class="${intentDraft[key]===id?"on":""}" onclick="setIntent('${key}','${id}')"><b>${label}</b><small>${item.copy}</small></button>`;
  }).join("");
  body.innerHTML = `<div class="pickgrid">${pick(INTENT_ROLES,"role",x=>x.id)}</div>
    <p class="modalcopy" style="margin:0 0 8px">How often are you hiring?</p>
    <div class="pickgrid">${pick(INTENT_VOLUMES,"volume",x=>x.label)}</div>
    <p class="modalcopy" style="margin:0 0 8px">What should this TalentEdge preview show?</p>
    <div class="pickgrid">${pick(INTENT_PRODUCTS,"product",x=>x.label)}</div>
    <button class="primary" type="button" style="width:100%;justify-content:center" onclick="confirmIntent()">Start the TalentEdge tour</button>
    <button class="backlink" type="button" onclick="closeIntentPicker()">Maybe later</button>`;
}
function confirmIntent(){
  state.intent = Object.assign({}, intentDraft);
  saveState();
  closeIntentPicker();
  enterSalesPreview();
}
let trialJourney = null;
let trialTimers = [];
let trialGen = 0;
function openInviteRegister(){
  openInviteYourselfGate();
}
function openInviteYourselfGate(){
  if(demoReel) closeDemoReel();
  if(tour) finishTour({skipWow:true});
  closeTrialJourney();
  closeInfo();
  openInviteSignup();
}
function openInviteSignup(){
  signupReason = "invite";
  document.getElementById("signupModal").classList.add("open");
  document.body.style.overflow = "hidden";
  showSignupStep(1);
}
function clearTrialTimers(){ (trialTimers||[]).forEach(clearTimeout); trialTimers = []; }
function trialSchedule(fn, ms){
  const t = setTimeout(fn, ms);
  trialTimers.push(t);
  return t;
}
function identifyTrialCompany(email, company){
  const domain = (email.split("@")[1]||"").toLowerCase();
  const slug = (domain.split(".")[0]||"company").replace(/[-_]/g," ");
  const name = (company||slug).replace(/\b\w/g, c=>c.toUpperCase());
  const sizes = ["48–80 people","120–220 people","400+ people"];
  return {name, domain, size: sizes[Math.abs(name.length)%3], industry:"Hiring & talent"};
}
function guessNameFromEmail(email){
  const local = (email.split("@")[0]||"").replace(/[._+\-]+/g," ").trim();
  if(!local || /^(admin|info|hr|hello|contact|team)$/i.test(local)) return "";
  return local.replace(/\b\w/g, c=>c.toUpperCase());
}
function fillSignupFromEmail(){
  const emailEl = document.getElementById("workEmail");
  const co = document.getElementById("companyName");
  const nm = document.getElementById("fullName");
  const email = (emailEl?.value||"").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const d = domainOf(email);
  if(PERSONAL.has(d) || DISPOSABLE.has(d)) return;
  const idn = identifyTrialCompany(email, "");
  if(co && !(co.value||"").trim()) co.value = idn.name;
  if(nm && !(nm.value||"").trim()){
    const guessed = guessNameFromEmail(email);
    if(guessed) nm.value = guessed;
  }
}
function trialTempPassword(company){
  const slug = (company||"Trial").replace(/[^A-Za-z0-9]/g,"").slice(0,8) || "Trial";
  return slug.charAt(0).toUpperCase()+slug.slice(1)+"-Temp-2026";
}
function openTrialJourney(){
  closeSignup();
  closeTourIntro();
  if(typeof stopTour==="function" && tour) stopTour();
  closeWow();
  clearTrialTimers();
  trialGen += 1;
  trialJourney = {
    step: "book",
    mail: "welcome",
    inbox: [],
    clock: null,
    err: "",
    data: {name:"Alex Morgan", email:"alex.morgan@acme.com", company:"Acme", title:"Head of Talent", phone:"+1 415 555 0142"},
    verify: {email:"wait", company:"wait", account:"wait", invites:"wait"},
    identified: null,
    password: ""
  };
  document.getElementById("trialJourneyOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  drawTrialJourney();
}
function closeTrialJourney(){
  clearTrialTimers();
  trialGen += 1;
  document.getElementById("trialJourneyOverlay")?.classList.remove("open");
  document.body.style.overflow = "";
  trialJourney = null;
}
function tjCurrentNode(){
  if(!trialJourney) return "book";
  if(trialJourney.step==="inbox") return trialJourney.mail==="welcome" ? "welcome" : "daily";
  return trialJourney.step;
}
function tjCheck(key, title, okCopy, waitCopy){
  const st = trialJourney.verify[key];
  const cls = st==="ok"?"ok":st==="run"?"run":"";
  const copy = st==="ok"?okCopy : st==="run"?"Checking…" : waitCopy;
  return `<div class="tj-check ${cls}"><i></i><div><b>${title}</b><span>${escapeHtml(copy)}</span></div></div>`;
}
function trialStorySteps(){
  return trialJourney?.fromSignup
    ? ["start","welcome","day1","day2","day3"]
    : ["book","verify","start","welcome","day1","day2","day3"];
}
function trialStoryId(){
  if(!trialJourney) return "book";
  if(trialJourney.step==="inbox") return trialJourney.mail || "welcome";
  return trialJourney.step;
}
function trialStoryMeta(){
  const steps = trialStorySteps();
  const id = trialStoryId();
  const i = Math.max(0, steps.indexOf(id));
  const labels = {
    book:"Book a trial", verify:"Verify details", start:"Registered",
    welcome:"Welcome email", day1:"Day 1 · 9 AM", day2:"Day 2 · 9 AM", day3:"Day 3 · last day"
  };
  const nextId = steps[i+1];
  const last = !nextId;
  return {
    i, n: steps.length, last, nextId, id,
    nextLabel: last ? "Invite yourself" : "Next · "+labels[nextId],
    pct: Math.round(((i+1)/steps.length)*100),
    canBack: i>0 && trialJourney.step!=="verify"
  };
}
function drawTrialJourney(){
  const el = document.getElementById("trialJourneyOverlay");
  if(!el || !trialJourney) return;
  const d = trialJourney.data;
  const meta = trialStoryMeta();
  let stage = "";
  if(trialJourney.step==="book"){
    stage = `<span class="tj-kicker">After invite candidates</span>
      <h2 id="tjTitleH">Book a trial</h2>
      <p class="lead">Enter contact and company details. No credit card — we validate your work email and identify the company next.</p>
      <form class="tj-form" onsubmit="event.preventDefault();submitTrialBook()">
        <label>Full name<input id="tjName" autocomplete="name" value="${escapeHtml(d.name)}"></label>
        <label>Work email<input id="tjEmail" type="email" autocomplete="email" value="${escapeHtml(d.email)}"></label>
        <label>Role <span style="text-transform:none;font-weight:500;color:#9ca3af">(optional)</span><input id="tjTitle" value="${escapeHtml(d.title)}" placeholder="e.g. Head of Talent"></label>
        <label>Company<input id="tjCompany" value="${escapeHtml(d.company)}"></label>
        <label class="full">Phone <span style="text-transform:none;font-weight:500;color:#9ca3af">(optional)</span><input id="tjPhone" value="${escapeHtml(d.phone)}"></label>
        ${trialJourney.err?`<div class="tj-err">${escapeHtml(trialJourney.err)}</div>`:""}
      </form>`;
  } else if(trialJourney.step==="verify"){
    const idn = trialJourney.identified || {};
    stage = `<span class="tj-kicker">Verify details</span>
      <h2 id="tjTitleH">Validate email and identify company</h2>
      <p class="lead">Confirming <b style="color:#fff">${escapeHtml(d.email)}</b> is a work inbox, then matching it to ${escapeHtml(d.company||"your company")}.</p>
      <div class="tj-checks">
        ${tjCheck("email","Validate email","Work domain confirmed · not a personal inbox","Waiting to validate")}
        ${tjCheck("company","Identify company",(idn.name||d.company)+" · "+(idn.domain||"")+" · "+(idn.size||""),"Waiting to identify")}
        ${tjCheck("account","Register trial account","Registered — 3-day trial ready","Waiting to register")}
        ${tjCheck("invites","Unlock candidate invites","Invites unlocked for MeritEdge and AI Interviewer","Locked until verify finishes")}
      </div>
      ${trialJourney.verify.company==="ok"?`<div class="tj-co"><b>${escapeHtml(idn.name||d.company)}</b><span>${escapeHtml(idn.domain||"")} · ${escapeHtml(idn.industry||"")} · ${escapeHtml(idn.size||"")}</span></div>`:""}`;
  } else if(trialJourney.step==="start"){
    stage = `<span class="tj-kicker">Registered</span>
      <h2 id="tjTitleH">You're registered</h2>
      <p class="lead">Trial <b style="color:#fff">day 0</b>. A welcome email with your password is next, then a daily <b style="color:#fff">9:00 AM</b> email with usage, days left, and Upgrade.</p>
      <div class="tj-pills">
        <div class="tj-pill ok"><em>Registered</em><span>Account live</span></div>
        <div class="tj-pill ok"><em>3 days</em><span>Trial window</span></div>
        <div class="tj-pill ok"><em>Day 0</em><span>Welcome email</span></div>
      </div>`;
  } else if(trialJourney.step==="emails"){
    stage = `<span class="tj-kicker">Registered</span>
      <h2 id="tjTitleH">Trial emails</h2>
      <p class="lead">All four templates. One click continues to your invite.</p>
      ${trialEmailCards()}`;
  } else {
    stage = trialInboxHtml();
  }
  const clock = trialJourney.clock ? `<div class="tj-clock" onclick="skipTrialClock()"><em>${escapeHtml(trialJourney.clock.sub)}</em><b>09:00</b><span>${escapeHtml(trialJourney.clock.label)}</span></div>` : "";
  const verifying = trialJourney.step==="verify";
  const emails = trialJourney.step==="emails";
  el.innerHTML = `<div class="tj-shell bj-shell${emails?" tj-fit":""}">
    <button class="tj-x" type="button" aria-label="Close" onclick="closeTrialJourney()">×</button>
    <section class="tj-stage">
      <div class="bj-progress"><i style="width:${emails?100:meta.pct}%"></i></div>
      ${stage}${clock}
      ${verifying?"":emails?`<div class="bj-foot tj-sendfoot">
        <span class="bj-count">4 emails</span>
        <div class="tj-sendrow">
          <label>Your email<input id="tjInviteEmail" type="email" autocomplete="email" value="${escapeHtml(trialJourney.data.email||"")}"></label>
          <label>Invite window<input value="1 day" disabled></label>
          <button class="tj-btn" type="button" onclick="sendInviteFromEmails()">Send invite</button>
        </div>
      </div>`:`<div class="bj-foot">
        <span class="bj-count">${meta.i+1} / ${meta.n}</span>
        <div class="tj-actions" style="margin:0">
          ${meta.canBack?`<button class="tj-btn ghost" type="button" onclick="prevTrialPath()">Back</button>`:""}
          <button class="tj-btn" type="button" onclick="nextTrialPath()">${escapeHtml(meta.nextLabel)}</button>
        </div>
      </div>`}
    </section>
  </div>`;
  if(trialJourney.step==="book") setTimeout(()=>document.getElementById("tjName")?.focus(), 40);
}
function goTrialPathStep(id){
  if(!trialJourney || !id) return;
  clearTrialTimers();
  trialGen += 1;
  trialJourney.clock = null;
  trialJourney.fast = false;
  if(id==="book"){ trialJourney.step = "book"; drawTrialJourney(); return; }
  if(id==="verify"){ submitTrialBook(); return; }
  if(id==="start"){
    if(!trialJourney.password) activateTrialAccount();
    trialJourney.step = "start";
    drawTrialJourney();
    return;
  }
  if(id==="welcome"){ openTrialInbox(); return; }
  if(["day1","day2","day3"].includes(id)){
    if(trialJourney.step!=="inbox") openTrialInbox();
    advanceTrialMorning(id);
  }
}
function nextTrialPath(){
  if(!trialJourney) return;
  if(trialJourney.clock){ skipTrialClock(); return; }
  if(trialJourney.step==="book"){ submitTrialBook(); return; }
  if(trialJourney.step==="verify") return;
  const meta = trialStoryMeta();
  if(meta.last){ finishTrialJourneyToInvites(); return; }
  goTrialPathStep(meta.nextId);
}
function prevTrialPath(){
  if(!trialJourney) return;
  clearTrialTimers();
  trialGen += 1;
  trialJourney.clock = null;
  const steps = trialStorySteps();
  const i = Math.max(0, steps.indexOf(trialStoryId()));
  const prev = steps[i-1];
  if(!prev) return;
  if(prev==="book"){ trialJourney.step = "book"; drawTrialJourney(); return; }
  if(prev==="verify"){ trialJourney.step = "start"; drawTrialJourney(); return; }
  if(prev==="start"){ trialJourney.step = "start"; drawTrialJourney(); return; }
  if(prev==="welcome"){ openTrialInbox(); return; }
  if(["day1","day2","day3"].includes(prev)){
    if(trialJourney.step!=="inbox") openTrialInbox();
    trialJourney.mail = prev;
    applyTrialMailStats(prev);
    drawTrialJourney();
  }
}
function submitTrialBook(){
  if(!trialJourney) return;
  const name = (document.getElementById("tjName")?.value||"").trim();
  const email = (document.getElementById("tjEmail")?.value||"").trim().toLowerCase();
  const company = (document.getElementById("tjCompany")?.value||"").trim();
  const title = (document.getElementById("tjTitle")?.value||"").trim();
  const phone = (document.getElementById("tjPhone")?.value||"").trim();
  trialJourney.data = {name, email, company, title, phone};
  trialJourney.err = "";
  if(!name || !email || !company){ trialJourney.err = "Enter contact name, work email, and company."; drawTrialJourney(); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ trialJourney.err = "Enter a valid work email."; drawTrialJourney(); return; }
  const domain = email.split("@")[1];
  if(PERSONAL.has(domain)){ trialJourney.err = "Use a work email. Personal inboxes cannot book a trial."; drawTrialJourney(); return; }
  if(title && (title.length<2 || !/[a-zA-Z]/.test(title))){ trialJourney.err = "Role is optional. If you add one, use letters."; drawTrialJourney(); return; }
  trialJourney.identified = identifyTrialCompany(email, company);
  trialJourney.data.company = trialJourney.identified.name;
  runTrialVerify();
}
function runTrialVerify(){
  trialJourney.step = "verify";
  trialJourney.verify = {email:"run", company:"wait", account:"wait", invites:"wait"};
  drawTrialJourney();
  const gen = trialGen;
  const set = (key, val, ms) => trialSchedule(()=>{
    if(gen!==trialGen || !trialJourney) return;
    trialJourney.verify[key] = val;
    drawTrialJourney();
  }, ms);
  set("email","ok",700);
  set("company","run",850);
  set("company","ok",1650);
  set("account","run",1750);
  set("account","ok",2400);
  set("invites","run",2500);
  set("invites","ok",3100);
  trialSchedule(()=>{ if(gen===trialGen && trialJourney) showTrialStart(); }, 3650);
}
function activateTrialAccount(){
  const d = trialJourney.data;
  const email = d.email.toLowerCase();
  trialJourney.password = trialTempPassword(d.company);
  const user = {
    email, name: d.name, company: d.company, kind:"trial", plan:"trial", credits:25, daysLeft:3,
    freeInviteCredits:5, freeInvitesUsed:0, reports:[],
    source:"book_trial", utm:"invite_gate", org: d.company+" Org", created:true, trialBooked:true, title:d.title, phone:d.phone
  };
  state.users = state.users.filter(u => u.email !== PREVIEW_EMAIL && u.email !== email);
  state.users.push(user);
  state.session = email;
  saveState();
  renderWorkspace();
}
function showTrialStart(){
  activateTrialAccount();
  trialJourney.step = "start";
  trialJourney.fast = false;
  drawTrialJourney();
}
function openTrialInbox(){
  if(!trialJourney) return;
  if(!trialJourney.password) activateTrialAccount();
  trialJourney.step = "inbox";
  trialJourney.mail = "welcome";
  if(!trialJourney.inbox.includes("welcome")) trialJourney.inbox.push("welcome");
  drawTrialJourney();
}
function selectTrialMail(id){
  if(!trialJourney) return;
  trialJourney.mail = id;
  drawTrialJourney();
}
function syncTrialUsage(credits, days){
  const u = currentUser();
  if(!u) return;
  u.credits = credits;
  u.daysLeft = days;
  saveState();
}
function applyTrialMailStats(id){
  if(id==="day1") syncTrialUsage(23, 2);
  if(id==="day2") syncTrialUsage(18, 1);
  if(id==="day3") syncTrialUsage(14, 0);
}
function trialIsFast(){ return !!(trialJourney && trialJourney.fast); }
function trialClockMs(){ return trialIsFast() ? 240 : 1100; }
function trialGapMs(){ return trialIsFast() ? 420 : 2500; }
function markTrialFast(){
  if(!trialJourney) return;
  trialJourney.fast = true;
}
function goTrialNode(id){
  if(!trialJourney) return;
  if(!trialJourney.fromSignup && !trialJourney.password && id!=="book" && id!=="start") return;
  markTrialFast();
  clearTrialTimers();
  trialGen += 1;
  trialJourney.clock = null;
  if(id==="book"){ trialJourney.step = "book"; drawTrialJourney(); return; }
  if(id==="verify"){ trialJourney.step = "verify"; drawTrialJourney(); return; }
  if(id==="start"){ trialJourney.step = "start"; drawTrialJourney(); return; }
  if(id==="welcome"){ openTrialInbox(); return; }
  if(id==="daily"){
    if(trialJourney.step!=="inbox") openTrialInbox();
    if(trialJourney.inbox.includes("day3")){
      trialJourney.inbox = trialJourney.inbox.filter(x => x==="welcome");
      trialJourney.mail = "welcome";
      drawTrialJourney();
    }
    playTrialDailies();
  }
}
function goTrialDay(id){
  if(!trialJourney) return;
  clearTrialTimers();
  trialGen += 1;
  trialJourney.clock = null;
  trialJourney.fast = false;
  if(trialJourney.step!=="inbox") openTrialInbox();
  if(id==="welcome"){ selectTrialMail("welcome"); return; }
  const seen = trialJourney.inbox||[];
  if(seen.includes(id)){ selectTrialMail(id); applyTrialMailStats(id); return; }
  advanceTrialMorning(id);
}
function skipTrialClock(){
  if(!trialJourney?.clock) return;
  const id = trialJourney.clock.id;
  clearTrialTimers();
  trialGen += 1;
  trialJourney.clock = null;
  if(id && !trialJourney.inbox.includes(id)) trialJourney.inbox.push(id);
  if(id){ trialJourney.mail = id; applyTrialMailStats(id); }
  drawTrialJourney();
}
function playTrialStoryFast(){
  if(!trialJourney) return;
  markTrialFast();
  clearTrialTimers();
  trialGen += 1;
  trialJourney.clock = null;
  if(trialJourney.step!=="inbox") openTrialInbox();
  trialJourney.inbox = ["welcome"];
  trialJourney.mail = "welcome";
  drawTrialJourney();
  const gen = trialGen;
  trialSchedule(()=>{ if(gen===trialGen && trialJourney) playTrialDailies(); }, 280);
}
function advanceTrialMorning(id){
  if(!trialJourney) return;
  const labels = {day1:"Trial day 1 · daily digest", day2:"Trial day 2 · daily digest", day3:"Trial day 3 · last morning"};
  trialJourney.clock = {id, label: labels[id], sub:"Daily email · 9 AM"};
  trialJourney.step = "inbox";
  drawTrialJourney();
  const gen = trialGen;
  trialSchedule(()=>{
    if(gen!==trialGen || !trialJourney) return;
    trialJourney.clock = null;
    if(!trialJourney.inbox.includes(id)) trialJourney.inbox.push(id);
    trialJourney.mail = id;
    applyTrialMailStats(id);
    drawTrialJourney();
  }, trialClockMs());
}
function playTrialSeq(seq){
  if(!seq.length) return;
  let i = 0;
  const go = ()=>{
    if(!trialJourney || i>=seq.length) return;
    advanceTrialMorning(seq[i++]);
    if(i<seq.length) trialSchedule(go, trialClockMs() + trialGapMs());
  };
  go();
}
function playTrialDailies(){
  const seq = ["day1","day2","day3"].filter(id => !(trialJourney?.inbox||[]).includes(id));
  if(!seq.length){ selectTrialMail("day3"); return; }
  playTrialSeq(seq);
}
function nextTrialMorning(){
  nextTrialPath();
}
function trialInboxHtml(){
  const items = {
    welcome: {from:"TalentEdge", subject:"Welcome to your TalentEdge trial", time:"Day 0", preview:"Password inside · invites unlocked"},
    day1: {from:"TalentEdge", subject:"Your trial · 2 days left", time:"9:00 AM", preview:"Usage digest · Upgrade"},
    day2: {from:"TalentEdge", subject:"Your trial · 1 day left", time:"9:00 AM", preview:"Usage digest · Upgrade"},
    day3: {from:"TalentEdge", subject:"Last day of your trial", time:"9:00 AM", preview:"Usage digest · Upgrade"}
  };
  const list = trialJourney.inbox.map(id=>{
    const m = items[id];
    return `<button type="button" class="${trialJourney.mail===id?"on":""}" onclick="selectTrialMail('${id}')"><span class="time">${m.time}</span><b>${escapeHtml(m.subject)}</b><small>${escapeHtml(m.from)} — ${escapeHtml(m.preview)}</small></button>`;
  }).join("");
  const dailyN = ["day1","day2","day3"].filter(id => trialJourney.inbox.includes(id)).length;
  return `<span class="tj-kicker">${trialJourney.mail==="welcome"?"Registered · Trial day 0":"Daily email · 9:00 AM"}</span>
    <h2 id="tjTitleH">${trialJourney.mail==="welcome"?"Welcome email": dailyN===1?"Day 1 · 2 days left": dailyN===2?"Day 2 · 1 day left":"Day 3 · last day"}</h2>
    <p class="lead">${trialJourney.mail==="welcome"?"Includes your password. Next: a daily 9 AM email with usage, days left, and Upgrade.":"Each morning visualizes usage, trial days left, and Upgrade."}</p>
    <div class="tj-inbox">
      <div class="tj-ilist">${list}</div>
      <div class="tj-mail">${trialMailBody(trialJourney.mail)}</div>
    </div>`;
}
function trialMailBody(id, embedded){
  const d = trialJourney.data;
  const first = (d.name||"there").split(" ")[0];
  const to = `${escapeHtml(d.name)} &lt;${escapeHtml(d.email)}&gt;`;
  const pw = trialJourney.password || trialTempPassword(d.company);
  const stats = {
    welcome: {used:0, left:25, days:3, dayLabel:"Day 0"},
    day1: {used:2, left:23, days:2, dayLabel:"Day 1"},
    day2: {used:7, left:18, days:1, dayLabel:"Day 2"},
    day3: {used:11, left:14, days:0, dayLabel:"Day 3"}
  }[id] || {used:0, left:25, days:3, dayLabel:"Day 0"};
  const sub = id==="welcome" ? "Welcome to your TalentEdge trial" :
    id==="day1" ? "Your trial · 2 days left" :
    id==="day2" ? "Your trial · 1 day left" : "Last day of your trial";
  const usedPct = Math.round((stats.used/25)*100);
  const orderIds = ["welcome","day1","day2","day3"];
  const curI = orderIds.indexOf(id);
  const track = `<div class="tj-track">${[
      {id:"welcome", n:"0", label:"Day 0", sub:"Welcome"},
      {id:"day1", n:"1", label:"Day 1", sub:"9:00 AM"},
      {id:"day2", n:"2", label:"Day 2", sub:"9:00 AM"},
      {id:"day3", n:"3", label:"Day 3", sub:"Last day"}
    ].map(d=>{
      const i = orderIds.indexOf(d.id);
      const cls = d.id===id ? "on" : i<curI ? "past" : "";
      return `<button type="button" class="tj-track-d ${cls}" onclick="goTrialDay('${d.id}')"><em>${d.n}</em><b>${d.label}</b><span>${d.sub}</span></button>`;
    }).join("")}</div>`;
  const daysDots = [3,2,1].map((left,i)=>`<i class="${stats.days>=left?"on":"off"}" title="Day ${i+1}"></i>`).join("");
  const usage = `<div class="tj-digest">
      <div class="tj-daypill">${id==="welcome"?"Registered · Trial day 0 · includes password":stats.dayLabel+" · Daily email · 9:00 AM"}</div>
      ${track}
      <div class="tj-statrow">
        <div class="tj-statbig"><span>Credits used</span><b>${stats.used} / 25</b><span class="tj-bar"><i style="width:${usedPct}%"></i></span><small>${stats.left} credits left</small></div>
        <div class="tj-statbig"><span>Trial days left</span><b>${stats.days===0?"0":stats.days}</b><small>${stats.days===0?"Last day":stats.days===1?"1 day remaining":stats.days+" days remaining"}</small><span class="tj-days">${daysDots}</span></div>
      </div>
      <div class="tj-usage">
        <div>Invites<b>5 free</b><small>candidate invites</small></div>
        <div>Window<b>1 day</b></div>
        <div class="tj-upgrow"><button class="tj-upg" type="button" onclick="upgradeFromTrialMail()">Upgrade</button></div>
      </div>
    </div>`;
  let body = "";
  if(id==="welcome"){
    body = `<p>Hi ${escapeHtml(first)},</p>
      <p>You're <b>registered</b>. This is <b>trial day 0</b> — your welcome email. The trial is live for <b>3 days</b>.</p>
      <div class="tj-pw"><div><span>Includes password</span><div>${escapeHtml(pw)}</div></div></div>
      ${usage}
      <p>Sign in with <b>${escapeHtml(d.email)}</b>. Every further morning at <b>9:00 AM</b> you'll get a daily email with usage, days left, and Upgrade.</p>
      <p>— TalentEdge</p>`;
  } else {
    body = `<p>Good morning ${escapeHtml(first)},</p>
      <p>It's <b>9:00 AM</b> — your daily trial email for <b>${stats.dayLabel}</b>. Usage and days left are below. Upgrade when you're ready.</p>
      ${usage}
      <p>— TalentEdge</p>`;
  }
  return `<div class="gmail-sub">${escapeHtml(sub)}</div>
    <div class="gmail-meta" style="padding:8px 16px 4px">
      <div class="row"><label>From</label><span>TalentEdge</span></div>
      <div class="row"><label>To</label><span>${to}</span></div>
      <div class="row"><label>When</label><span>${id==="welcome"?"Trial day 0":"9:00 AM daily"}</span></div>
    </div>
    <div class="gmail-body">${body}</div>`;
}
function trialEmailCards(){
  const d = trialJourney.data;
  const first = (d.name||"there").split(" ")[0];
  const pw = trialJourney.password || trialTempPassword(d.company);
  const to = `${d.name||"You"} · ${d.email||""}`;
  const cards = [
    {when:"Trial day 0", subject:"Welcome to your TalentEdge trial", hi:`Hi ${first},`, line:"You're registered. This is trial day 0. The trial is live for 3 days.", extra:`Password · ${pw}`, foot:"A 9:00 AM email follows each morning.", used:"0 / 25", left:"25 left", days:"3", daysNote:"3 days remaining"},
    {when:"Day 1 · 9:00 AM", subject:"Your trial · 2 days left", hi:`Good morning ${first},`, line:"It's 9:00 AM — your daily trial email for Day 1. Usage and days left are below.", extra:"", foot:"", used:"2 / 25", left:"23 left", days:"2", daysNote:"2 days remaining"},
    {when:"Day 2 · 9:00 AM", subject:"Your trial · 1 day left", hi:`Good morning ${first},`, line:"It's 9:00 AM — your daily trial email for Day 2. Usage and days left are below.", extra:"", foot:"", used:"7 / 25", left:"18 left", days:"1", daysNote:"1 day remaining"},
    {when:"Day 3 · 9:00 AM", subject:"Last day of your trial", hi:`Good morning ${first},`, line:"It's 9:00 AM — your daily trial email for Day 3. This is the last morning.", extra:"", foot:"", used:"11 / 25", left:"14 left", days:"0", daysNote:"Last day"}
  ];
  return `<div class="tj-emailgrid">${cards.map(c=>`<article class="tj-efull">
      <h3>${escapeHtml(c.subject)}</h3>
      <dl>
        <div><dt>From</dt><dd>TalentEdge</dd></div>
        <div><dt>To</dt><dd>${escapeHtml(to)}</dd></div>
        <div><dt>When</dt><dd>${escapeHtml(c.when)}</dd></div>
      </dl>
      <div class="tj-efull-body">
        <p><b>${escapeHtml(c.hi)}</b></p>
        <p>${escapeHtml(c.line)}</p>
        ${c.extra?`<p class="tj-efull-pw">${escapeHtml(c.extra)}</p>`:""}
        ${c.foot?`<p>${escapeHtml(c.foot)}</p>`:""}
        <p class="tj-efull-sign">— TalentEdge</p>
        <button type="button" class="tj-efull-up" onclick="upgradeFromTrialMail()">Upgrade</button>
      </div>
      <div class="tj-efull-stats">
        <div><span>Credits used</span><b>${escapeHtml(c.used)}</b><small>${escapeHtml(c.left)}</small></div>
        <div><span>Days left</span><b>${escapeHtml(c.days)}</b><small>${escapeHtml(c.daysNote)}</small></div>
        <div><span>Invites</span><b>5 free</b><small>candidate invites</small></div>
      </div>
    </article>`).join("")}</div>`;
}
function sendInviteFromEmails(){
  const email = (document.getElementById("tjInviteEmail")?.value || trialJourney?.data?.email || "").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast("Enter a valid email."); return; }
  const pending = pendingInvite || {kind:"assessment", id: assessments[0]?.id};
  const kind = pending.kind || "assessment";
  const id = pending.id;
  pendingInvite = null;
  closeTrialJourney();
  let firstCand = null;
  if(kind==="assessment"){
    const a = assessments.find(x=>x.id===id);
    if(!a){ toast("Assessment not found."); return; }
    if(!consumeFreeInvites(1)) return;
    firstCand = {id:"n"+Date.now(), name:nameFromInviteEmail(email), email, score:"—", status:"Invited", skills:"Invite sent", selfInvite:true};
    a.candidates.push(firstCand);
    a.invited = (a.invited||0)+1;
  } else {
    const iv = interviews.find(x=>x.id===id);
    if(!iv){ toast("Interview not found."); return; }
    if(!consumeFreeInvites(1)) return;
    firstCand = {id:"n"+Date.now(), name:nameFromInviteEmail(email), email, score:"—", rec:"Invited", status:"Invited", note:"Waiting for the candidate to start.", selfInvite:true};
    iv.candidates.push(firstCand);
    iv.invited = (iv.invited||0)+1;
  }
  wizard = null;
  appSection = kind==="interview" ? "ai-interviewer" : "meritedge";
  appDetail = null;
  showView("workspace");
  toast("Invite sent. Opening the email the candidate receives.");
  openInviteMail(kind, id, firstCand.id);
}
function sendPublishedInvite(kind, id){
  const email = (document.getElementById("pubInviteEmail")?.value || currentUser()?.email || "").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast("Enter a valid email."); return; }
  if(isPreviewUser(currentUser())){
    pendingInvite = {kind, id};
    openInviteRegister();
    return;
  }
  let firstCand = null;
  if(kind==="assessment"){
    const a = assessments.find(x=>x.id===id);
    if(!a){ toast("Assessment not found."); return; }
    if(!consumeFreeInvites(1)) return;
    firstCand = {id:"n"+Date.now(), name:nameFromInviteEmail(email), email, score:"—", status:"Invited", skills:"Invite sent", selfInvite:true};
    a.candidates.push(firstCand);
    a.invited = (a.invited||0)+1;
  } else {
    const iv = interviews.find(x=>x.id===id);
    if(!iv){ toast("Interview not found."); return; }
    if(!consumeFreeInvites(1)) return;
    firstCand = {id:"n"+Date.now(), name:nameFromInviteEmail(email), email, score:"—", rec:"Invited", status:"Invited", note:"Waiting for the candidate to start.", selfInvite:true};
    iv.candidates.push(firstCand);
    iv.invited = (iv.invited||0)+1;
  }
  wizard = null;
  appSection = kind==="interview" ? "ai-interviewer" : "meritedge";
  appDetail = null;
  showView("workspace");
  toast("Invite sent. Opening the email the candidate receives.");
  openInviteMail(kind, id, firstCand.id);
}
function finishTrialJourneyToInvites(){
  const pending = pendingInvite;
  closeTrialJourney();
  const u = currentUser();
  if(!u || isPreviewUser(u)) return;
  if(pending){
    const {kind, id} = pending;
    pendingInvite = null;
    wizard = null;
    appSection = kind==="interview" ? "ai-interviewer" : "meritedge";
    appDetail = {type:"invite", kind, id, emails: u.email || ""};
    renderWorkspace();
    toast("Trial unlocked — invite yourself, then take the candidate path.");
  } else {
    renderWorkspace();
    toast("Trial unlocked. Invites, reports, credits, and the question repository are open.");
  }
}
function openSignupEmailTemplates(){
  const u = currentUser();
  if(!u) return;
  closeSignup();
  closeReady();
  if(typeof closeTourIntro==="function") closeTourIntro();
  if(typeof closeWow==="function") closeWow();
  if(typeof stopTour==="function" && tour) stopTour();
  clearTrialTimers();
  trialGen += 1;
  u.daysLeft = 3;
  if(typeof u.credits !== "number") u.credits = 25;
  saveState();
  trialJourney = {
    fromSignup: true,
    step: "emails",
    mail: "welcome",
    inbox: ["welcome","day1","day2","day3"],
    clock: null,
    err: "",
    data: {name: u.name, email: u.email, company: u.company, title: u.title||"", phone: u.phone||""},
    verify: {email:"ok", company:"ok", account:"ok", invites:"ok"},
    identified: u.domain ? {name:u.company, domain:u.domain, size:u.companySize, industry:u.industry} : identifyTrialCompany(u.email, u.company),
    password: trialTempPassword(u.company)
  };
  document.getElementById("trialJourneyOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  drawTrialJourney();
}
function openRegisteredTrialStory(){
  const u = currentUser();
  if(!u) return;
  closeSignup();
  closeReady();
  if(typeof closeTourIntro==="function") closeTourIntro();
  if(typeof closeWow==="function") closeWow();
  if(typeof stopTour==="function" && tour) stopTour();
  clearTrialTimers();
  trialGen += 1;
  u.daysLeft = 3;
  if(typeof u.credits !== "number") u.credits = 25;
  saveState();
  trialJourney = {
    fromSignup: true,
    step: "start",
    mail: "welcome",
    inbox: [],
    clock: null,
    err: "",
    data: {name: u.name, email: u.email, company: u.company, title: u.title||"", phone: u.phone||""},
    verify: {email:"ok", company:"ok", account:"ok", invites:"ok"},
    identified: u.domain ? {name:u.company, domain:u.domain, size:u.companySize, industry:u.industry} : identifyTrialCompany(u.email, u.company),
    password: trialTempPassword(u.company)
  };
  document.getElementById("trialJourneyOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  drawTrialJourney();
}
function upgradeFromTrialMail(){
  closeTrialJourney();
  beginCheckout("starter");
}
let billJourney = null;
const BILL_MAILS = __D.billMails;
function billShiftDate(months){
  const d = new Date();
  d.setMonth(d.getMonth() + (months||1));
  return d.toLocaleDateString("en-GB", {day:"numeric", month:"short", year:"numeric"});
}
function billCtx(){
  const u = currentUser() || {name:"You", company:"Your company", email:"you@company.com"};
  if(!checkout) seedBillCheckout(billJourney?.planId || "starter");
  const t = checkoutTotals();
  return {
    u, t,
    cycle: checkout.cycle==="annual"?"Annual":"Monthly",
    method: gstPayMethodLine(),
    email: checkout.billingEmail || u.email || "you@company.com",
    next: billShiftDate(checkout.cycle==="annual"?12:1),
    later: billShiftDate(checkout.cycle==="annual"?24:2),
    retry: billShiftDate(1) 
  };
}
function seedBillCheckout(planId){
  const p = PLANS.find(x=>x.id===planId) || PLANS.find(x=>x.id==="starter");
  const u = currentUser();
  checkout = {
    planId:p.id, cycle:billCycle, step:"journey", method:"upi",
    orderId:"ME-"+Date.now().toString().slice(-8),
    status:"", applied:false, timerArmed:false, pin:"", otp:"",
    bank:PAY_BANKS[0], wallet:PAY_WALLETS[0], later:PAY_LATER[0],
    billingEmail: (u && u.kind!=="preview" && u.email) || (u && u.billingEmail) || "",
    billingName: (u && u.name) || "",
    upi: "alex@oksbi"
  };
}
function billMailIds(){
  if(billJourney?.mails?.length) return billJourney.mails;
  return BILL_MAILS.map(s=>s.id);
}
function billMailLabel(id){
  return (BILL_MAILS.find(s=>s.id===id)||{}).label || "Email";
}
function startBillMailStory(ids){
  closeSignup();
  closeTrialJourney();
  if(!checkout) seedBillCheckout("starter");
  const mails = (ids && ids.length) ? ids.slice() : ["receipt-email"];
  billJourney = {screen: mails[0], mails, planId: checkout.planId};
  checkout.step = "return";
  paintRazorpay();
  document.getElementById("billJourneyOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  drawBillJourney();
}
function openBillJourney(planId, screen){
  if(!checkout || (planId && checkout.planId!==planId)) seedBillCheckout(planId||"starter");
  if(screen==="recovery") startBillMailStory(["recovery"]);
  else if(screen==="renewal-email") startBillMailStory(["renewal-email"]);
  else if(screen==="plan-email") startBillMailStory(["plan-email"]);
  else startBillMailStory(["receipt-email","plan-email"]);
}
function closeBillJourney(){
  document.getElementById("billJourneyOverlay")?.classList.remove("open");
  document.body.style.overflow = "";
  billJourney = null;
  if(checkout?.applied){
    appSection = "billing";
    appDetail = null;
    wizard = null;
    showView("workspace");
    renderWorkspace();
  }
}
function showBillScreen(id){
  if(!billJourney) return;
  billJourney.screen = id;
  drawBillJourney();
}
function nextBillScreen(){
  if(!billJourney) return;
  const mails = billMailIds();
  const i = mails.indexOf(billJourney.screen);
  if(i < 0 || i >= mails.length-1){ finishBillJourneyToApp(); return; }
  showBillScreen(mails[i+1]);
}
function prevBillScreen(){
  if(!billJourney) return;
  const mails = billMailIds();
  const i = mails.indexOf(billJourney.screen);
  if(i <= 0){ finishBillJourneyToApp(); return; }
  showBillScreen(mails[i-1]);
}
function finishBillJourneyToApp(){
  document.getElementById("billJourneyOverlay")?.classList.remove("open");
  document.body.style.overflow = "";
  billJourney = null;
  appSection = "billing";
  appDetail = null;
  wizard = null;
  showView("workspace");
  renderWorkspace();
}
function openCreditsNav(){
  if(creditsRecharged()) appNav("billing");
  else openUpgradePlans();
}
function openAppBillingJourney(screen){
  if(screen==="receipt-email" || screen==="plan-email" || screen==="renewal-email" || screen==="recovery"){
    startBillMailStory([screen]);
    return;
  }
  appNav("billing");
}
function launchBillRazorpay(){
  if(!checkout) seedBillCheckout(billJourney?.planId || currentUser()?.plan || "starter");
  checkout.step = "methods";
  checkout.status = "";
  checkout.timerArmed = false;
  if(billJourney){
    document.getElementById("billJourneyOverlay")?.classList.remove("open");
    document.body.style.overflow = "";
    billJourney = null;
  }
  appSection = "plans";
  showView("workspace");
  renderWorkspace();
  paintRazorpay();
}
function finishRazorpayIntoJourney(){
  const st = checkout?.status;
  checkout.step = "return";
  paintRazorpay();
  if(st==="failed") startBillMailStory(["failed-email"]);
  else if(st==="pending") finishBillJourneyToApp();
  else openPaidSplit();
}
function openPaidSplit(){
  closeSignup();
  closeTrialJourney();
  if(!checkout) seedBillCheckout("starter");
  billJourney = {screen:"paid-split", mails:["paid-split"], planId: checkout.planId};
  checkout.step = "return";
  paintRazorpay();
  const el = document.getElementById("billJourneyOverlay");
  if(!el) return;
  el.classList.add("open");
  document.body.style.overflow = "hidden";
  drawBillJourney();
}
function paidSplitHtml(){
  const c = billCtx();
  const pay = moneyInr(c.t.totalInr);
  const first = escapeHtml((c.u.name||"there").split(" ")[0]);
  const to = `${c.u.name||"You"} · ${c.email||""}`;
  const feats = (c.t.p.features||[]).map(f=>`<li>${escapeHtml(f)}</li>`).join("");
  return `<div class="paid-head">
      <div>
        <span class="tj-kicker">Payment successful</span>
        <h2>GST invoice and ${escapeHtml(c.t.p.name)}</h2>
        <p class="lead">Paid ${pay} · ${escapeHtml(checkout.orderId)} · ${escapeHtml(c.method)}</p>
      </div>
      <button class="tj-btn" type="button" onclick="finishBillJourneyToApp()">Continue</button>
    </div>
    <div class="paid-grid">
      <div class="bj-inv">${gstInvoiceInner()}</div>
      <article class="tj-efull">
        <h3>Your ${escapeHtml(c.t.p.name)} plan is active</h3>
        <dl>
          <div><dt>From</dt><dd>${escapeHtml(GST_SELLER.fromName)}</dd></div>
          <div><dt>To</dt><dd>${escapeHtml(to)}</dd></div>
          <div><dt>Date</dt><dd>${escapeHtml(todayLabel())}</dd></div>
        </dl>
        <div class="tj-efull-body">
          <p>Hi ${first},</p>
          <div class="tj-efull-stats">
            <div><span>Plan</span><b>${escapeHtml(c.t.p.name)}</b><small>Active</small></div>
            <div><span>Cycle</span><b>${escapeHtml(c.cycle)}</b><small>Next ${escapeHtml(c.next)}</small></div>
            <div><span>Credits</span><b>+${c.t.p.credits}</b><small>${pay}</small></div>
          </div>
          <p>Your <b>${escapeHtml(c.t.p.name)}</b> plan is live. Credits are on the account. Manage the plan from <b>Billing</b> in TalentEdge.</p>
          <p>Paid <b>${pay}</b> by ${escapeHtml(c.method)}. Order <b>${escapeHtml(checkout.orderId)}</b>. Next billing <b>${escapeHtml(c.next)}</b>.</p>
          ${feats?`<ul class="paid-feats">${feats}</ul>`:""}
          <p class="tj-efull-sign">— TalentEdge billing</p>
          <p class="paid-mail" id="gstPayMailStatus"></p>
        </div>
      </article>
    </div>`;
}
function drawBillJourney(){
  const el = document.getElementById("billJourneyOverlay");
  if(!el || !billJourney) return;
  const split = billJourney.screen==="paid-split";
  el.innerHTML = `<div class="tj-shell bj-shell${split?" paid-split":""}">
    <button class="tj-x" type="button" aria-label="Close" onclick="closeBillJourney()">×</button>
    <section class="tj-stage">${split ? paidSplitHtml() : billMailHtml(billJourney.screen)}</section>
  </div>`;
}
function billMailActs(id){
  const mails = billMailIds();
  const i = mails.indexOf(id);
  const last = i < 0 || i >= mails.length-1;
  const nextId = last ? null : mails[i+1];
  const nextLabel = last ? "Next · Billing" : "Next · "+billMailLabel(nextId);
  return `<div class="gmail-acts">
      <button class="te-btn ghost" type="button" onclick="prevBillScreen()">Back</button>
      <button class="te-btn" type="button" onclick="nextBillScreen()">${escapeHtml(nextLabel)}</button>
    </div>`;
}
function billMailHtml(id){
  const c = billCtx();
  const pay = moneyInr(c.t.totalInr);
  const first = escapeHtml((c.u.name||"there").split(" ")[0]);
  const to = `${escapeHtml(c.u.name)} &lt;${escapeHtml(c.email)}&gt;`;
  const from = `${escapeHtml(GST_SELLER.fromName)} &lt;${escapeHtml(GST_SELLER.fromEmail)}&gt;`;
  const wrap = (sub, body, sent) => `<div class="gmail" style="margin:0">
      <div class="gmail-bar"><b>Gmail</b><span class="${sent||"sent"}">${sent==="sending"?"Reminder":"Sent"}</span></div>
      <div class="gmail-sub">${escapeHtml(sub)}</div>
      <div class="gmail-meta">
        <div class="row"><label>From</label><span>${from}</span></div>
        <div class="row"><label>To</label><span>${to}</span></div>
        <div class="row"><label>Date</label><span>${escapeHtml(todayLabel())}</span></div>
      </div>
      <div class="gmail-body">${body}</div>
      ${billMailActs(id)}
    </div>`;
  if(id==="plan-email"){
    return wrap(`Your ${c.t.p.name} plan is active`,
      `<p>Hi ${first},</p>
        <p>Your <b>${escapeHtml(c.t.p.name)}</b> plan is live. Credits are on the account. Manage the plan from <b>Billing</b> in TalentEdge.</p>
        <div class="tj-usage" style="margin:8px 0">
          <div>Plan<b>${escapeHtml(c.t.p.name)}</b></div>
          <div>Cycle<b>${escapeHtml(c.cycle)}</b></div>
          <div>Next billing<b>${escapeHtml(c.next)}</b></div>
          <div>Credits<b>+${c.t.p.credits}</b></div>
        </div>
        <p>— TalentEdge billing</p>`);
  }
  if(id==="renewal-email"){
    return wrap(`Renewal receipt · ${c.t.p.name}`,
      `<p>Hi ${first},</p>
        <p>We collected your ${escapeHtml(c.cycle.toLowerCase())} renewal for <b>${escapeHtml(c.t.p.name)}</b>.</p>
        <div class="tj-usage" style="margin:8px 0">
          <div>Payment<b>${pay}</b></div>
          <div>Method<b>${escapeHtml(c.method)}</b></div>
          <div>Next cycle<b>${escapeHtml(c.later)}</b></div>
        </div>
        <p>The plan stays on Billing in the sidebar.</p>
        <p>— TalentEdge billing</p>`);
  }
  if(id==="failed-email"){
    const why = (checkout.pin||"")==="0000" ? "PIN 0000 was declined" : (checkout.otp||"")==="000000" ? "OTP 000000 was declined" : "The bank declined this payment";
    return wrap(`Payment failed · ${c.t.p.name}`,
      `<p>Hi ${first},</p>
        <p>We couldn't complete your payment for <b>${escapeHtml(c.t.p.name)}</b>. ${escapeHtml(why)}. No amount was captured and credits were not added.</p>
        <div class="tj-usage" style="margin:8px 0">
          <div>Amount<b>${pay}</b></div>
          <div>Order<b>${escapeHtml(checkout.orderId)}</b></div>
          <div>Status<b>Failed</b></div>
        </div>
        <button class="tj-upg" type="button" onclick="launchBillRazorpay()">Try payment again</button>
        <p>— TalentEdge billing</p>`, "sending");
  }
  if(id==="recovery"){
    return wrap(`Action needed · ${c.t.p.name} renewal`,
      `<p>Hi ${first},</p>
        <p>We couldn't complete your renewal payment. Update your Razorpay method or try again to keep ${escapeHtml(c.t.p.name)} active.</p>
        <div class="tj-usage"><div>Due<b>${pay}</b></div><div>Retry<b>${escapeHtml(c.retry)}</b></div></div>
        <button class="tj-upg" type="button" onclick="launchBillRazorpay()">Update payment method</button>
        <p>The plan stays on Billing.</p>
        <p>— TalentEdge billing</p>`, "sending");
  }
  return wrap(gstMailSubject(),
    `<p>Hi ${first},</p>
      <p>Thanks for your payment. Your <b>${escapeHtml(c.t.p.name)}</b> plan is active.</p>
      <div class="tj-usage" style="margin:8px 0">
        <div>Payment<b>${pay}</b></div>
        <div>Paid on<b>${escapeHtml(todayLabel())}</b></div>
        <div>Receipt<b>${escapeHtml(checkout.orderId)}</b></div>
        <div>Credits<b>+${c.t.p.credits}</b></div>
      </div>
      <p>Your GST invoice is attached. The plan is in <b>Billing</b> in the sidebar.</p>
      <div class="bj-inv">${gstInvoiceInner()}</div>
      <p>— TalentEdge billing</p>`);
}
function enterSalesPreview(){
  stopTourVoice();
  clearTourAdvance();
  tour = null;
  closeTourIntro();
  document.body.classList.remove("tour-lock");
  document.getElementById("tourOverlay")?.classList.remove("open");
  const user = {
    email: PREVIEW_EMAIL,
    name: "You",
    company: "Your company",
    kind: "preview",
    plan: "trial",
    credits: 25,
    daysLeft: 14,
    source: "start_free",
    utm: "landing",
    org: "Product preview",
    created: true
  };
  const i = state.users.findIndex(u => u.email === PREVIEW_EMAIL);
  if(i>=0) state.users[i] = Object.assign({}, state.users[i], user);
  else state.users.push(user);
  state.session = PREVIEW_EMAIL;
  saveState();
  appSection = "meritedge";
  appDetail = null;
  wizard = null;
  checkout = null;
  showView("workspace");
  if(new URLSearchParams(location.search).get("story")==="trial") return;
  startCreateAssessment({focused:true});
}
function closeSignup(){ signupVerifyGen += 1; document.getElementById("signupModal").classList.remove("open"); document.body.style.overflow=""; }
function setProgress(n){ for(let i=1;i<=3;i++) document.getElementById("p"+i).classList.toggle("on", i<=n); }

function showSignupStep(n){
  setProgress(typeof n==="number" ? n : 1);
  const box = document.getElementById("signupContent");
  if(n===1){
    const invite = signupReason === "invite";
    box.innerHTML = `<h2 id="signupTitle">${invite ? "Sign up to invite" : "Create your account"}</h2>
      <p class="modalcopy">${invite
        ? "Sign up so you can send an invite and experience the candidate side — take the MeritEdge assessment or AI Interview the way a candidate would."
        : "Enter your details. We will send a one-time code to verify your work email, then start the product tour."}</p>
      <label class="field"><span>Full name</span><input id="fullName" placeholder="e.g. Alex Morgan" autocomplete="name" value="${escapeHtml(signupData.name||"")}"></label>
      <label class="field"><span>Work email</span><input id="workEmail" type="email" placeholder="you@company.com" autocomplete="email" value="${escapeHtml(signupData.email||"")}" oninput="fillSignupFromEmail()" onblur="fillSignupFromEmail()"></label>
      ${invite ? "" : `<label class="field"><span>Role <em class="opt">(optional)</em></span><input id="signupRole" placeholder="e.g. Head of Talent" autocomplete="organization-title" value="${escapeHtml(signupData.title||"")}"></label>`}
      <label class="field"><span>Company</span><input id="companyName" placeholder="Filled from your work email" autocomplete="organization" value="${escapeHtml(signupData.company||"")}"></label>
      ${invite ? "" : `<label class="field"><span>Referral code <em class="opt">(optional)</em></span><input id="referralCode" placeholder="e.g. TEAM20" autocomplete="off" value="${escapeHtml(signupData.referral||"")}"></label>`}
      <div class="demo-note" id="signupNote">${invite ? "No credit card. Sign up to unlock 5 free invites and save every candidate report to your account." : "5 free invites · reports saved to your account · no credit card."}</div>
      <button class="su-cta" type="button" onclick="requestDemoCode()">${invite ? "Sign up" : "Create account"}</button>`;
  } else if(n===2){
    setProgress(2);
    box.innerHTML = `<h2 id="signupTitle">Verify your email</h2>
      <p class="otp-mail">We sent a 6-digit code to <b>${escapeHtml(signupData.email)}</b></p>
      <p class="modalcopy" style="margin-bottom:8px">${signupReason==="invite"?"Enter the code to sign up. Then you can send an invite and experience the candidate side.":"Enter the code to finish creating your workspace."}</p>
      <div class="demo-note" id="otpNote">Use <b>123456</b> — nothing is emailed.</div>
      ${signupReason==="invite"
        ? `<label class="field"><span>Verification code</span><input id="otpCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" aria-label="Verification code" oninput="otpCodeInput()" onkeydown="if(event.key==='Enter')verifyDemoCode()"></label>`
        : `<div class="otp" aria-label="Email verification code">${[1,2,3,4,5,6].map(x=>`<input inputmode="numeric" maxlength="1" aria-label="Digit ${x}" id="otp${x}" oninput="otpInput(${x})" onkeydown="otpKey(event,${x})">`).join("")}</div>`}
      <button class="su-cta" type="button" onclick="verifyDemoCode()">Verify and continue</button>
      <button class="backlink" id="otpResend" type="button" onclick="requestDemoCode(true)">Resend code</button>
      <button class="backlink" type="button" onclick="showSignupStep(1)">← Edit details</button>`;
    setTimeout(()=>(document.getElementById("otpCode")||document.getElementById("otp1"))?.focus(), 50);
    startOtpTimer();
  } else if(n==="exists"){
    setProgress(1);
    box.innerHTML = `<h2 id="signupTitle">You already have an account</h2>
      <p class="modalcopy">An account with <b>${escapeHtml(signupData.email)}</b> already exists. Please log in instead — we will not create a second company.</p>
      <div class="demo-note">This is the Phase 1 “existing user” branch. Account: <b>alex@acme.com</b>.</div>
      <button class="su-cta" type="button" onclick="goExistingLogin()">Go to Login</button>
      <button class="backlink" type="button" onclick="showSignupStep(1)">← Use a different email</button>`;
  } else if(n==="verify"){
    setProgress(3);
    drawSignupVerify();
  } else {
    setProgress(3);
    box.innerHTML = `<div class="su-wait"><div class="g-spin"></div><h2 id="signupTitle">${signupReason==="invite"?"Unlocking invite":"Opening your workspace"}</h2><p class="modalcopy">${signupReason==="invite"?"Email verified. Next you can send an invite and experience the candidate side.":"Email verified. Starting the product tour."}</p></div>`;
  }
}

function signupNote(msg, warn){
  const n=document.getElementById("signupNote");
  if(!n){ toast(msg.replace(/<[^>]+>/g,"")); return; }
  n.className = warn ? "demo-note warn" : "demo-note";
  n.innerHTML = msg;
}
function suCheck(key, title, okCopy, waitCopy){
  const st = signupVerify[key];
  const cls = st==="ok"?"ok":st==="run"?"run":"";
  const copy = st==="ok"?okCopy : st==="run"?"Checking…" : waitCopy;
  return `<div class="su-check ${cls}"><i></i><div><b>${title}</b><span>${escapeHtml(copy)}</span></div></div>`;
}
function drawSignupVerify(){
  const box = document.getElementById("signupContent");
  if(!box) return;
  const idn = signupData.identified || identifyTrialCompany(signupData.email, signupData.company);
  const done = signupVerify.email==="ok" && signupVerify.company==="ok" && signupVerify.details==="ok";
  const companyCard = signupVerify.company==="ok" ? `<div class="su-co">
      <b>${escapeHtml(idn.name||signupData.company||"")}</b>
      <span>${escapeHtml(idn.domain||"")} · ${escapeHtml(idn.industry||"")} · ${escapeHtml(idn.size||"")}</span>
    </div>` : "";
  box.innerHTML = `<h2 id="signupTitle">Validate email and company</h2>
    <p class="modalcopy">Confirming <b>${escapeHtml(signupData.email||"")}</b> is a work inbox, then matching it to your company and filling the workspace details.</p>
    <div class="su-checks">
      ${suCheck("email","Validate work email","Work domain confirmed · not a personal inbox","Waiting to validate")}
      ${suCheck("company","Validate company name",(idn.name||signupData.company||"Company")+" · "+(idn.domain||""),"Waiting to identify")}
      ${suCheck("details","Fill account details","Name, company, and domain filled into your workspace","Waiting to fill")}
    </div>
    ${companyCard}
    ${done?`<div class="demo-note">Details filled. Opening your trial emails…</div>`:`<div class="su-wait" style="padding:8px 0 0"><div class="g-spin"></div></div>`}`;
}
function continueSignupDetails(){
  const gen = signupVerifyGen;
  signupVerify.details = "run";
  drawSignupVerify();
  setTimeout(()=>{
    if(gen!==signupVerifyGen) return;
    signupVerify.details = "ok";
    drawSignupVerify();
  }, 800);
  setTimeout(()=>{
    if(gen===signupVerifyGen && signupVerify.details==="ok") enterNewWorkspace();
  }, 2200);
}
function runSignupVerify(){
  const gen = ++signupVerifyGen;
  signupVerify.confirm = "";
  const set = (key, val, ms) => setTimeout(()=>{
    if(gen!==signupVerifyGen) return;
    signupVerify[key] = val;
    if(key==="company" && val==="ok"){
      const idn = identifyTrialCompany(signupData.email, signupData.company);
      signupData.identified = idn;
      signupData.company = idn.name;
      if(!signupData.name) signupData.name = guessNameFromEmail(signupData.email) || signupData.name;
      signupVerify.confirm = "yes";
      continueSignupDetails();
    }
    drawSignupVerify();
  }, ms);
  set("email","ok",700);
  set("company","run",850);
  set("company","ok",1650);
}
function requestDemoCode(isResend){
  if(!isResend){
    const name=document.getElementById("fullName")?.value.trim();
    const email=document.getElementById("workEmail")?.value.trim();
    const role=(document.getElementById("signupRole")?.value||"").trim();
    const company=document.getElementById("companyName")?.value.trim();
    const referral=document.getElementById("referralCode")?.value.trim() || "";
    if(!email){ signupNote("Enter your work email.", true); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ signupNote("Enter a valid work email.", true); return; }
    const d = domainOf(email);
    if(PERSONAL.has(d)){ signupNote("Please use your work email. Personal inboxes cannot sign up.", true); return; }
    if(DISPOSABLE.has(d)){ signupNote("Disposable email addresses are not allowed.", true); return; }
    if(role && (role.length<2 || !/[a-zA-Z]/.test(role))){ signupNote("Role is optional. If you add one, use letters.", true); return; }
    const idn = identifyTrialCompany(email, company);
    const filledCompany = (company || idn.name || "").trim();
    if(!filledCompany || filledCompany.length<2){ signupNote("Enter a company name, or use a work email so we can fill it.", true); return; }
    if(!/[a-zA-Z]/.test(filledCompany)){ signupNote("Company name must include letters.", true); return; }
    const filledName = (name || guessNameFromEmail(email) || "").trim();
    if(!filledName){ signupNote("Enter your full name.", true); return; }
    if(document.getElementById("companyName")) document.getElementById("companyName").value = filledCompany;
    if(document.getElementById("fullName")) document.getElementById("fullName").value = filledName;
    signupData = {name: filledName, email, title: role, company: filledCompany, referral, identified: idn};
    const taken = findUser(email);
    if(taken && !isPreviewUser(taken)){ showSignupStep("exists"); return; }
  }
  const key = (signupData.email||"").toLowerCase();
  state.otpCounts[key] = (state.otpCounts[key]||0) + 1;
  saveState();
  if(state.otpCounts[key] > 3){
    showSignupStep(2);
    setTimeout(()=>{
      const n=document.getElementById("otpNote");
      if(n){ n.className="demo-note warn"; n.innerHTML="Too many codes for this email. In the live product this is 3 per hour. Wait, or use another work email."; }
    }, 0);
    return;
  }
  otpAttempts = 0;
  showSignupStep(2);
  if(isResend) toast("Verification code resent: 123456");
}

function startOtpTimer(){
  otpResendAt = Date.now() + 30000;
  tickOtpTimer();
}
function tickOtpTimer(){
  const el = document.getElementById("otpResend");
  if(!el) return;
  const left = Math.max(0, Math.ceil((otpResendAt - Date.now())/1000));
  if(left){
    el.disabled = true;
    el.textContent = `Resend code in ${left}s`;
    setTimeout(tickOtpTimer, 400);
  } else {
    el.disabled = false;
    el.textContent = "Resend code";
  }
}
function otpInput(n){
  const el=document.getElementById("otp"+n);
  el.value=el.value.replace(/\D/g,"").slice(-1);
  if(el.value&&n<6) document.getElementById("otp"+(n+1)).focus();
  const code=[1,2,3,4,5,6].map(i=>document.getElementById("otp"+i)?.value||"").join("");
  if(code.length===6) verifyDemoCode();
}
function otpKey(e,n){ if(e.key==="Backspace"&&!e.target.value&&n>1) document.getElementById("otp"+(n-1)).focus(); if(e.key==="Enter") verifyDemoCode(); }

function otpCodeInput(){
  const el = document.getElementById("otpCode");
  if(!el) return;
  el.value = el.value.replace(/\D/g,"").slice(0,6);
  if(el.value.length===6) verifyDemoCode();
}
function readOtpCode(){
  const single = document.getElementById("otpCode");
  if(single) return (single.value||"").replace(/\D/g,"");
  return [1,2,3,4,5,6].map(n=>document.getElementById("otp"+n)?.value||"").join("");
}
function verifyDemoCode(){
  const key=(signupData.email||"").toLowerCase();
  if((state.otpCounts[key]||0) > 3){ toast("Rate limited. Use another email in this demo."); return; }
  const code=readOtpCode();
  if(code.length<6) return;
  if(code!==DEMO_OTP){
    otpAttempts += 1;
    const n=document.getElementById("otpNote");
    if(otpAttempts>=5){ n.className="demo-note warn"; n.innerHTML="Too many attempts. For this prototype, enter <b>123456</b>."; return; }
    n.className="demo-note warn"; n.innerHTML=`That code did not match (${otpAttempts}/5). Enter <b>123456</b>.`;
    return;
  }
  const idn = identifyTrialCompany(signupData.email, signupData.company);
  signupData.identified = idn;
  signupData.company = idn.name;
  if(!signupData.name) signupData.name = guessNameFromEmail(signupData.email) || signupData.name;
  signupVerify = {email:"run", company:"wait", details:"wait", confirm:""};
  showSignupStep("verify");
  runSignupVerify();
}

function goExistingLogin(){
  closeSignup();
  showView("login");
  document.getElementById("loginEmail").value = signupData.email || "alex@acme.com";
  document.getElementById("loginPassword").value = "";
  const err=document.getElementById("loginError");
  err.textContent = "An account with this email already exists. Please log in instead.";
  err.classList.add("on");
}

function openPendingInviteEmailAfterSignup(){
  const pending = pendingInvite;
  if(!pending) return false;
  pendingInvite = null;
  const {kind, id} = pending;
  const item = inviteItem(kind, id);
  const u = currentUser();
  if(!item || !u) return false;
  if(!consumeFreeInvites(1)) return false;
  const firstCand = kind === "assessment"
    ? {id:"n"+Date.now(), name:u.name||"You", email:u.email, score:"â€”", status:"Invited", skills:"Invite sent", selfInvite:true}
    : {id:"n"+Date.now(), name:u.name||"You", email:u.email, score:"â€”", rec:"Invited", status:"Invited", note:"Waiting for the candidate to start.", selfInvite:true};
  item.candidates = item.candidates || [];
  item.candidates.push(firstCand);
  item.invited = (item.invited||0) + 1;
  wizard = null;
  appSection = kind === "interview" ? "ai-interviewer" : "meritedge";
  appDetail = null;
  showView("workspace");
  toast(`${kind === "interview" ? "AI interview" : "Assessment"} email ready. Start it when you are ready.`);
  openInviteMail(kind, id, firstCand.id);
  return true;
}

function enterNewWorkspace(){
  signupVerifyGen += 1;
  const bonus = signupData.referral ? 5 : 0;
  signupReason = "trial";
  state.users = state.users.filter(u => u.email !== PREVIEW_EMAIL);
  const idn = signupData.identified || identifyTrialCompany(signupData.email, signupData.company);
  const company = idn.name || signupData.company;
  const name = signupData.name || guessNameFromEmail(signupData.email) || "You";
  const user = {
    email: signupData.email,
    name,
    company,
    kind: "trial",
    plan: "trial",
    credits: 25 + bonus,
    freeInviteCredits: 5,
    freeInvitesUsed: 0,
    reports: [],
    daysLeft: 3,
    source: "pilot",
    utm: pendingInvite ? "invite_register" : "landing",
    referral: signupData.referral || "",
    inviteCode: makeInviteCode({company, name}),
    org: company + " Org",
    domain: idn.domain,
    companySize: idn.size,
    industry: idn.industry,
    title: signupData.title || "",
    created: true,
    justProvisioned: true,
    unlockedAll: true
  };
  const existing = findUser(user.email);
  if(!existing) state.users.push(user);
  state.session = user.email;
  saveState();
  closeSignup();
  appSection = "meritedge";
  appDetail = null;
  wizard = null;
  checkout = null;
  showView("workspace");
  if(openPendingInviteEmailAfterSignup()) return;
  openSignupEmailTemplates();
}

function signIn(){
  const email=document.getElementById("loginEmail").value.trim();
  const password=document.getElementById("loginPassword").value;
  const err=document.getElementById("loginError");
  err.classList.remove("on");
  if(!email||!password){ err.textContent="Enter email and password."; err.classList.add("on"); return; }
  const user=findUser(email);
  if(!user || isPreviewUser(user)){
    err.innerHTML='No account with this email. <button class="forgot" onclick="startFlow()">Start free</button> to try the product.';
    err.classList.add("on");
    return;
  }
  state.session = user.email;
  saveState();
  appSection = "meritedge";
  appDetail = null;
  showView("workspace");
  beginProductTour();
}
function togglePw(){ const i=document.getElementById("loginPassword"); if(i) i.type = i.type==="password" ? "text" : "password"; }
const LOGIN_SLIDES = [
  ["AI-Powered","Screening","Screen smarter, hire faster.","Intelligent automation for candidate evaluation."],
  ["Smart","Assessments","Auto-configured for every role.","Tailored tests that match your job specs."],
  ["Team","Collaboration","Review and decide together.","Unified platform for hiring decisions."]
];
let loginSlide = 0;
let loginSlideTimer = null;
function setLoginSlide(i){
  loginSlide = i;
  const s = LOGIN_SLIDES[i];
  const title = document.getElementById("tdSlideTitle");
  if(!title) return;
  title.innerHTML = `${s[0]}<br><span class="td-grad">${s[1]}</span>`;
  const lead = document.getElementById("tdSlideLead");
  const sub = document.getElementById("tdSlideSub");
  if(lead) lead.textContent = s[2];
  if(sub) sub.textContent = s[3];
  document.querySelectorAll("#view-login .td-dot").forEach((dot, idx)=>dot.classList.toggle("active", idx===i));
}
function startLoginSlides(){
  if(loginSlideTimer) return;
  loginSlideTimer = setInterval(()=>{
    if(state.view!=="login") return;
    setLoginSlide((loginSlide+1)%LOGIN_SLIDES.length);
  }, 6000);
}
function signOut(){ stopTourVoice(); clearTourAdvance(); closeTourIntro(); closeDemoReel(); closeTrialJourney(); closeBillJourney(); closeReferShare(); closeSso(); closeWow(); tour=null; document.body.classList.remove("tour-lock"); document.getElementById("tourOverlay")?.classList.remove("open"); state.session=null; saveState(); enterSalesPreview(); }

const G_ICO = `<svg class="sso-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;
const MS_ICO = `<svg class="sso-ico" viewBox="0 0 21 21" aria-hidden="true"><rect width="10" height="10" fill="#F25022"/><rect x="11" width="10" height="10" fill="#7FBA00"/><rect y="11" width="10" height="10" fill="#00A4EF"/><rect x="11" y="11" width="10" height="10" fill="#FFB900"/></svg>`;
const SSO_ACCOUNTS = __D.ssoAccounts;
const SSO_PERMS = __D.ssoPerms;
let ssoState = null;

function startSso(provider){
  ssoState = {provider, step:"choose", account:null, perms:{}};
  const overlay = document.getElementById("ssoOverlay");
  overlay.classList.toggle("ms-skin", provider==="microsoft");
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  drawSso();
}
function closeSso(){
  ssoState = null;
  const overlay = document.getElementById("ssoOverlay");
  if(!overlay) return;
  overlay.classList.remove("open","ms-skin");
  const stage = document.getElementById("ssoStage");
  if(stage) stage.innerHTML = "";
  if(!document.getElementById("signupModal")?.classList.contains("open")) document.body.style.overflow = "";
}
function pickSsoAccount(i){
  if(!ssoState) return;
  ssoState.account = SSO_ACCOUNTS[ssoState.provider][i];
  ssoState.perms = {};
  ssoState.step = "perms";
  drawSso();
}
function toggleSsoPerm(id){
  if(!ssoState) return;
  ssoState.perms[id] = !ssoState.perms[id];
  drawSso();
}
function ssoAllPermsOn(){
  return SSO_PERMS[ssoState.provider].every(p => ssoState.perms[p.id]);
}
function confirmSsoPerms(){
  if(!ssoState?.account) return;
  if(!ssoAllPermsOn()){ toast("Tick every permission to continue."); return; }
  ssoState.step = "done";
  drawSso();
  setTimeout(finishSsoLogin, 750);
}
function finishSsoLogin(){
  if(!ssoState?.account) return;
  const a = ssoState.account;
  const provider = ssoState.provider;
  let user = findUser(a.email);
  if(!user){
    user = {
      email: a.email,
      name: a.name,
      company: a.company,
      kind: "trial",
      plan: "trial",
      credits: 25,
      freeInviteCredits: 5,
      freeInvitesUsed: 0,
      reports: [],
      daysLeft: 14,
      source: "sso",
      utm: provider,
      inviteCode: makeInviteCode({company: a.company, name: a.name}),
      org: a.company + " Org",
      created: true
    };
    state.users.push(user);
  }
  state.session = user.email;
  saveState();
  closeSso();
  appSection = "meritedge";
  appDetail = null;
  wizard = null;
  checkout = null;
  showView("workspace");
  beginProductTour();
}
function drawSso(){
  const stage = document.getElementById("ssoStage");
  if(!stage || !ssoState) return;
  if(ssoState.provider==="google") stage.innerHTML = drawGoogleSso();
  else stage.innerHTML = drawMicrosoftSso();
}
function drawGoogleSso(){
  const word = `<div class="g-word">${G_ICO} Google</div>`;
  if(ssoState.step==="choose"){
    const rows = SSO_ACCOUNTS.google.map((a,i)=>`<button type="button" class="g-acct" onclick="pickSsoAccount(${i})"><span class="g-av" style="background:${a.color}">${escapeHtml(initials(a.name))}</span><span><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.email)}</small></span></button>`).join("");
    return `<div class="g-card">${word}<h1 id="ssoTitle">Choose an account</h1><p class="g-sub">to continue to <b>MeritEdge</b></p><p class="g-app">meritedge.example</p>${rows}<button type="button" class="g-other" onclick="toast('Pick a listed Google account.')">Use another account</button><p class="g-fine">To continue, Google will share your name, email address, and profile picture with MeritEdge. Before using this app, you can review MeritEdge’s <a href="javascript:void(0)">privacy policy</a> and <a href="javascript:void(0)">terms of service</a>.</p><div class="g-actions" style="margin-top:18px"><button type="button" class="g-btn" onclick="closeSso()">Cancel</button></div></div>`;
  }
  const a = ssoState.account;
  if(ssoState.step==="done"){
    return `<div class="g-card">${word}<div class="g-wait"><div class="g-spin"></div><h1 id="ssoTitle">Signing you in…</h1><p class="g-app">${escapeHtml(a.name)} · ${escapeHtml(a.email)}</p></div></div>`;
  }
  const perms = SSO_PERMS.google.map(p=>`<label class="g-perm"><input type="checkbox" ${ssoState.perms[p.id]?"checked":""} onchange="toggleSsoPerm('${p.id}')"><span><b>${escapeHtml(p.title)}</b><span>${escapeHtml(p.copy)}</span></span></label>`).join("");
  const ready = ssoAllPermsOn();
  return `<div class="g-card">${word}<h1 id="ssoTitle">MeritEdge wants to access your Google Account</h1><div class="g-chip"><span class="g-av" style="background:${a.color}">${escapeHtml(initials(a.name))}</span><span><b>${escapeHtml(a.name)}</b><br><small style="color:#5f6368">${escapeHtml(a.email)}</small></span></div><p class="g-sub" style="font-size:14px;margin-bottom:8px">This will allow MeritEdge to:</p>${perms}<p class="g-warn">Make sure you trust MeritEdge. Tick every permission, then Allow — the same path Google shows before an app can sign you in.</p><div class="g-actions"><button type="button" class="g-btn" onclick="ssoState.step='choose';ssoState.account=null;drawSso()">Cancel</button><button type="button" class="g-btn solid" ${ready?"":"disabled"} onclick="confirmSsoPerms()">Allow</button></div></div>`;
}
function drawMicrosoftSso(){
  const word = `<div class="ms-word">${MS_ICO} Microsoft</div>`;
  if(ssoState.step==="choose"){
    const rows = SSO_ACCOUNTS.microsoft.map((a,i)=>`<button type="button" class="ms-acct" onclick="pickSsoAccount(${i})"><span class="ms-av" style="background:${a.color}">${escapeHtml(initials(a.name))}</span><span><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.email)}</small></span><span aria-hidden="true">›</span></button>`).join("");
    return `<div class="ms-card">${word}<h1 id="ssoTitle">Pick an account</h1><p class="ms-sub">to continue to MeritEdge</p>${rows}<button type="button" class="ms-acct" onclick="toast('Pick a listed Microsoft account.')"><span class="ms-av" style="background:#737373">+</span><span><b>Use another account</b><small>Work or personal Microsoft account</small></span><span></span></button><div class="ms-actions"><button type="button" class="ms-btn" onclick="closeSso()">Cancel</button></div></div>`;
  }
  const a = ssoState.account;
  if(ssoState.step==="done"){
    return `<div class="ms-card">${word}<div class="g-wait"><div class="g-spin" style="border-top-color:#0067b8"></div><h1 id="ssoTitle">Signing you in…</h1><p class="ms-sub">${escapeHtml(a.name)} · ${escapeHtml(a.email)}</p></div></div>`;
  }
  const perms = SSO_PERMS.microsoft.map(p=>`<label class="ms-perm"><input type="checkbox" ${ssoState.perms[p.id]?"checked":""} onchange="toggleSsoPerm('${p.id}')"><span><b>${escapeHtml(p.title)}</b><span>${escapeHtml(p.copy)}</span></span></label>`).join("");
  const ready = ssoAllPermsOn();
  return `<div class="ms-card">${word}<h1 id="ssoTitle">Permissions requested</h1><p class="ms-sub">MeritEdge · meritedge.example</p><div class="ms-chip"><span class="ms-av" style="background:${a.color}">${escapeHtml(initials(a.name))}</span><span><b>${escapeHtml(a.name)}</b><br><small>${escapeHtml(a.email)}</small></span></div><p class="ms-sub">This app would like to:</p>${perms}<div class="ms-actions"><button type="button" class="ms-btn" onclick="ssoState.step='choose';ssoState.account=null;drawSso()">Cancel</button><button type="button" class="ms-btn solid" ${ready?"":"disabled"} onclick="confirmSsoPerms()">Accept</button></div></div>`;
}

function openInfo(title, copy){
  document.getElementById("infoTitle").textContent=title;
  document.getElementById("infoCopy").textContent=copy;
  document.getElementById("infoActions").innerHTML = `<button class="primary" onclick="closeInfo()">Got it</button>`;
  document.getElementById("infoModal").classList.add("open");
}
function closeInfo(){ document.getElementById("infoModal").classList.remove("open"); }
function lockedFeature(){
  if(tour) return;
  if(trialUnlocked()){ appNav("questions"); return; }
  document.getElementById("infoTitle").textContent = "Unlocks after trial signup";
  document.getElementById("infoCopy").textContent = "Create and publish without payment. Invite yourself and register for the trial to unlock the full workspace — invites, reports, credits, and the question repository.";
  document.getElementById("infoActions").innerHTML = `<button class="ghost" onclick="closeInfo()">Not now</button><button class="primary" onclick="closeInfo();startInvite('assessment', assessments[0]?.id||'a1')">Invite yourself</button>`;
  document.getElementById("infoModal").classList.add("open");
}

const APP_NAV = __D.appNav;
const PAGE_TITLES = __D.pageTitles;
const assessments = __D.assessments;
const interviews = __D.interviews;
const ASSESS_STEPS = __D.assessSteps;
const INTERVIEW_STEPS = __D.interviewSteps;
let appDetail = null;
let wizard = null;
let listViewMode = "table";
let listQuery = "";
let listStatus = "all";
let listTrack = "all";
let listDateOpen = false;
let listStatusOpen = false;
let listFrom = "";
let listTo = "";
let listFromOn = "";
let listToOn = "";
let pendingCreate = null;
let openKebab = null;
let settingsTab = "proctoring";
let billCycle = "monthly";
let checkout = null;
let checkoutTimer = null;
let publishInviteTimer = null;
let publishInviteCountdownTimer = null;
let publishInviteSeconds = 0;
let autoGenerateTimer = null;
const AUTO_PAGE_WAIT = 5000;
let tour = null;
let signupReason = "trial";
let pendingInvite = null;
const PREVIEW_EMAIL = "preview@start.local";
const PAY_METHODS = __D.payMethods;
const PAY_BANKS = __D.payBanks;
const PAY_WALLETS = __D.payWallets;
const PAY_LATER = __D.payLater;
const CK_STEPS = __D.checkoutSteps;

const FEATURES = __D.features;
const PLANS = __D.plans;
const PLAN_ROWS = __D.planRows;
function tourAssessData(withJd){
  const role = intentRole();
  const jd = jdByRole(role);
  const d = {build:"ai", aiPhase:"", method:"jd", ivSource:"jd", jdId:"", jdFile:"", jdText:"", jdParsing:false, name:`${role} assessment`, role, duration:jd.duration, pass:"70", description:"", questions:sampleQuestions(role), webcam:true, tabswitch:true, fullscreen:false, copypaste:true, facedetect:false, audio:false, shuffle:true, cutoff:70, skills:jd.skills.join(", "), topics:jd.topics.map(t=>({...t}))};
  if(withJd) applyJdToData(d, jd, null, false);
  return d;
}
function tourInterviewData(withJd){
  const linked = assessments[0];
  const role = intentRole();
  const jd = jdByRole(role);
  const d = {
    assessmentId: withJd ? "" : (linked?.id || ""),
    ivSource: withJd ? "jd" : (linked ? "assessment" : "jd"),
    jdId:"", jdFile:"", jdParsing:false,
    role: linked?.role || role,
    name: `${linked?.title || role} · AI Interview`,
    duration: jd.ivDuration,
    language:"English",
    persona:"professional",
    skills: jd.skills.join(", "),
    topics: sampleTopics(linked?.role || role),
    questions: jd.questions.map(q=>({...q}))
  };
  if(withJd) applyJdToData(d, jd, null, true);
  return d;
}
function activeTourSteps(){
  const role = intentRole();
  return [
    {section:"meritedge", spot:"list", listView:"table", title:"MeritEdge Assessments", copy:"This is the MeritEdge hub. Table is the default. Search, filter by status, and switch List, Card, or Table. Each row is one assessment.", voice:`Welcome to TalentEdge. This is MeritEdge Assessments for ${role}. Cognitive and aptitude assessments live here. Search by name, filter by status, and switch List, Card, or Table. Table is the default. Each row is one assessment, with candidates and a kebab of actions.`},
    {section:"meritedge", spot:"create", listView:"table", title:"Create Assessment", copy:"Upload a job description. AI builds the assessment from that JD, then you publish.", voice:`Create Assessment. Upload a job description. TalentEdge reads the JD, creates the assessment, and you publish. Watch the ${role} JD path now.`},

    {section:"meritedge", wizard:"assessment", generator:true, jdShow:true, spot:"jd", title:"Upload a JD", copy:"Paste or drop a job description. That is the only input — AI builds the rest.", voice:`Upload a job description for ${role}. Paste it or pick a sample JD. That is the only input you need.`},
    {section:"meritedge", wizard:"assessment", creating:true, spot:"wizard", title:"AI creates the assessment", copy:"TalentEdge reads the JD and generates skills, duration, and the question bank.", voice:`AI reads the ${role} job description and creates the assessment — skills, duration, and the question bank. Next you publish.`},
    {section:"meritedge", wizard:"assessment", wizStep:4, jdShow:true, spot:"wizard", title:"Publish", copy:"The assessment from the JD is ready. Publish it to MeritEdge Assessments.", voice:`Publish. The assessment from the JD is ready. Publish and it is live in this workspace.`},
    {section:"meritedge", open:"assessment", spot:"dashboard", title:"Assessment dashboard", copy:"Identity bar, cut-off, Details, Invite yourself, and nine metrics — Invited, Attempted, Cleared, Pending, and more. Candidates sit below.", voice:`This is the MeritEdge dashboard. Title and status on the identity bar, then duration and cut-off. Invite yourself is the primary action. Nine metrics: Invited, Attempted, Cleared, Pending, average score, completion rate, no-show, average time, and credits reverted. Candidates are scored underneath.`},

    {section:"ai-interviewer", spot:"ivlist", listView:"table", title:"AI Interviewer", copy:"Structured voice and chat interviews. Same hub chrome: search, status, List, Card, Table. Each row is one interview config.", voice:`Now AI Interviewer. Real-time voice and chat interviews with AI evaluation. Same listing chrome as MeritEdge: search, status, List, Card, and Table. Each row is one interview, with invited versus completed.`},
    {section:"ai-interviewer", spot:"create", listView:"table", title:"Create AI Interview", copy:"Same short path: upload a JD, AI builds the interview, then you publish.", voice:`Create AI Interview. Upload a job description. AI builds the interview from that JD, then you publish.`},

    {section:"ai-interviewer", wizard:"interview", generator:true, jdShow:true, spot:"jd", title:"Upload a JD", copy:"Start from a job description — drop a file or pick a sample JD.", voice:`Upload a job description to generate the AI Interview for ${role}. Same first move as MeritEdge.`},
    {section:"ai-interviewer", wizard:"interview", creating:true, spot:"wizard", title:"AI creates the interview", copy:"Topics, skills, and persona are generated from the JD.", voice:`AI reads the ${role} JD and creates the interview — topics, skills, and persona. Next you publish.`},
    {section:"ai-interviewer", wizard:"interview", wizStep:5, jdShow:true, spot:"wizard", title:"Publish", copy:"The AI Interview from the JD is ready. Publish it to AI Interviewer.", voice:`Publish. The AI Interview from that JD is ready. Publish and it is live in this workspace.`},
    {section:"ai-interviewer", open:"interview", spot:"dashboard", title:"Interview dashboard", copy:"Sessions, scores, integrity, Details, Share, and Invite yourself. Evidence sits beside the MeritEdge score.", voice:`The AI Interviewer dashboard. Back, bot tile, role and duration, then Details, Share, and Invite yourself. Candidate rows show score, integrity, duration, and status.`},

    {section:"plans", spot:"plans", title:"Continue from what you built", copy:"Invites at volume sit on Starter. What you publish in this preview carries into upgrade. Nothing is charged.", voice:`When you are ready to invite at volume, Starter continues from the MeritEdge assessment and AI Interview you already walked. Nothing is charged in this preview. After the tour, try creating it yourself.`}
  ];
}
function tourDoneVoice(){
  return `You have seen TalentEdge. Try MeritEdge or AI Interviewer yourself. Register when you invite candidates.`;
}
let tourMuted = false;
let tourVoiceTimer = null;
let tourAdvanceTimer = null;
let tourSpeakGen = 0;

function planPrice(p){
  if(p.price==null) return "Custom";
  if(p.price===0) return "$0";
  const n = billCycle==="annual" ? p.annual : p.price;
  return `$${n}`;
}
function planAmount(p, cycle){
  if(!p || p.price==null || p.price===0) return 0;
  const c = cycle || checkout?.cycle || billCycle;
  return c==="annual" ? p.annual : p.price;
}
function setBillCycle(cycle){
  billCycle = cycle;
  if(state.view==="plans") renderPublicPlans();
  else if(appSection==="plans") renderWorkspace();
}
function currentPlanId(u){
  return u.plan || (u.kind==="sales" ? "sales" : "trial");
}
function creditsRecharged(u){
  if(!u) return false;
  if(u.kind==="paid") return true;
  if(checkout?.applied) return true;
  const plan = currentPlanId(u);
  return plan!=="trial" && plan!=="preview" && u.kind!=="preview" && u.kind!=="trial";
}
function paidCreateOk(){
  return true;
}
function trialUnlocked(u){
  u = u || currentUser();
  return !!(u && !isPreviewUser(u));
}
function fullProduct(u){
  if(tour || demoReel) return false;
  return creditsRecharged(u || currentUser());
}
function freeCandidate(u){
  return !creditsRecharged(u || currentUser());
}
function candAttemptLite(){
  if(candExam && candExam.lite) return true;
  if(ivSess && ivSess.lite) return true;
  return freeCandidate();
}
function requirePaidPlan(kind){
  pendingCreate = kind==="interview" ? "interview" : "assessment";
  appSection = "plans";
  appDetail = null;
  wizard = null;
  showView("workspace");
  renderWorkspace();
  toast("Purchase a plan to create and publish from a JD.");
}
function openUpgradePlans(){
  if(tour) finishTour({skipWow:true});
  if(demoReel) closeDemoReel();
  appSection = "plans";
  appDetail = null;
  wizard = null;
  showView("plans");
}
function backToCreateAssessment(){
  closeCandExam();
  closeInviteMail();
  inviteMail = null;
  appSection = "meritedge";
  appDetail = null;
  wizard = null;
  showView("workspace");
  startCreateAssessment({focused:true});
}

function backToAssessments(){
  closeCandExam();
  closeInviteMail();
  inviteMail = null;
  appSection = "account-assessments";
  appDetail = null;
  wizard = null;
  showView("workspace");
}
function resumePendingCreate(){
  const kind = pendingCreate;
  pendingCreate = null;
  if(kind==="interview") startCreateInterview();
  else if(kind==="assessment") startCreateAssessment();
  else {
    appSection = "meritedge";
    appDetail = null;
    wizard = null;
    renderWorkspace();
  }
}
function leavePlansAfterPay(){
  checkout = null;
  toast("Paid plan is live. Create Assessment and AI Interviewer use the full studio.");
  if(pendingCreate) resumePendingCreate();
  else {
    appSection = "billing";
    appDetail = null;
    wizard = null;
    renderWorkspace();
  }
}
function renderBillingPage(){
  const u = currentUser() || {};
  const paid = creditsRecharged(u);
  const p = PLANS.find(x=>x.id===currentPlanId(u)) || PLANS.find(x=>x.id==="trial");
  const inv = u.lastInvoice;
  const cycleName = (checkout?.cycle || u.billCycle || billCycle)==="annual" ? "Annual" : "Monthly";
  const method = (checkout?.applied ? gstPayMethodLine() : null) || u.payMethod || (inv ? "Saved Razorpay method" : "Not on file");
  const renew = paid ? billShiftDate((checkout?.cycle || u.billCycle)==="annual"?12:1) : (u.daysLeft!=null ? u.daysLeft+" days left on trial" : "—");
  const pay = checkout ? moneyInr(checkoutTotals().totalInr) : (inv && inv.inr!=null ? moneyInr(inv.inr) : "—");
  const feats = (p.features||[]).map(f=>`<li>${escapeHtml(f)}</li>`).join("");
  const justPaid = !!(checkout?.applied && checkout.status==="success");
  return `${moduleHeader({icon:icoBill(), title:"Billing", subtitle: paid ? "Plan and subscription" : "Trial billing — upgrade on Plans, then receipt emails", count: escapeHtml(p.name), createLabel: paid ? "Change plan" : "Upgrade", createFn:"appNav('plans')"})}
    ${justPaid?`<div class="te-card" style="margin:0 0 14px"><b>Payment received</b><p class="te-note" style="margin:6px 0 0">${escapeHtml(p.name)} is active · ${pay} via Razorpay · order ${escapeHtml(checkout.orderId)}</p></div>`:""}
    <div class="te-card" style="margin:0 0 14px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div><b>${escapeHtml(p.name)}</b><p class="te-note" style="margin:4px 0 0">${paid ? cycleName+" · auto-renew" : "Credit-free trial"}</p></div>
        <span class="te-pill">${paid?"Active":"Trial"}</span>
      </div>
      <div class="te-summary" style="margin-top:12px">
        <span>${paid?"Renews on":"Trial window"}</span><b>${escapeHtml(String(renew))}</b>
        <span>Payment method</span><b>${escapeHtml(method)}</b>
        <span>Credits</span><b>${u.credits||0}</b>
        <span>Billing email</span><b>${escapeHtml(u.billingEmail||u.email||"—")}</b>
      </div>
      <div class="te-actions" style="margin-top:14px">
        <button class="te-btn" type="button" onclick="appNav('plans')">${paid?"Buy more credits":"Upgrade"}</button>
        ${inv?`<button class="te-btn ghost" type="button" onclick="startBillMailStory(['receipt-email','plan-email'])">Open receipt emails</button>`:""}
        ${pendingCreate?`<button class="te-btn" type="button" onclick="resumePendingCreate()">Continue to create</button>`:""}
      </div>
    </div>
    <div class="te-card">
      <b>Subscription</b>
      <div class="te-summary" style="margin-top:10px">
        <span>Started</span><b>${escapeHtml(inv?.on||todayLabel())}</b>
        <span>Next billing</span><b>${escapeHtml(String(renew))}</b>
        <span>Amount</span><b>${pay}</b>
        <span>Auto-renew</span><b>${paid?"On":"Off"}</b>
      </div>
      ${feats?`<ul class="featul" style="margin:10px 0 0">${feats}</ul>`:""}
    </div>`;
}
function catalogAssessments(){
  if(tour || demoReel) return assessments.filter(a=>a.id==="a1"||a.id==="a2");
  return assessments;
}
function catalogInterviews(){
  if(tour || demoReel) return interviews.filter(iv=>iv.id==="i1"||iv.id==="i2");
  return interviews;
}
function makeInviteCode(u){
  const base = String(u.company||u.name||"TEAM").replace(/[^A-Za-z0-9]/g,"").slice(0,6).toUpperCase();
  return (base || "TEAM") + "20";
}
function userInviteCode(u){
  if(u.inviteCode) return u.inviteCode;
  u.inviteCode = makeInviteCode(u);
  saveState();
  return u.inviteCode;
}
function copyInviteCode(){
  const code = userInviteCode(currentUser());
  const done = () => toast(`Referral code ${code} copied`);
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(code).then(done).catch(done);
  } else done();
}
function referShareTo(){
  return (document.getElementById("referShareTo")?.value || "").trim();
}
function referShareSubject(u, code){
  const first = (u.name||"A teammate").split(" ")[0];
  return `${first} invited you to TalentEdge — use code ${code}`;
}
function referShareEmailInner(u, code){
  const first = escapeHtml((u.name||"A teammate").split(" ")[0]);
  const company = escapeHtml(u.company||"their team");
  const safeCode = escapeHtml(code);
  return `<div style="font-family:Inter,Arial,sans-serif;color:#202124;max-width:560px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#1e3a8a,#5b21b6 52%,#7c3aed);color:#fff;border-radius:16px 16px 0 0;padding:22px 22px 18px">
      <div style="font:800 11px Inter,sans-serif;letter-spacing:.16em;text-transform:uppercase;opacity:.8">TalentEdge</div>
      <h2 style="margin:8px 0 0;font:800 22px/1.25 Manrope,Inter,sans-serif">Assess, then interview, in one workspace.</h2>
    </div>
    <div style="border:1px solid #e8eaed;border-top:0;border-radius:0 0 16px 16px;padding:20px 22px 22px;background:#fff">
      <p style="margin:0 0 12px">Hi there,</p>
      <p style="margin:0 0 14px"><b>${first}</b> at <b>${company}</b> thought you’d hire faster with TalentEdge — MeritEdge assessments plus AI Interviewer for the same candidates.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 16px">
        <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:10px 12px"><b style="display:block;color:#5b21b6;font-size:13px">MeritEdge</b><span style="font-size:12px;color:#5f6368">Role-specific skills assessments and a ranked shortlist.</span></div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:10px 12px"><b style="display:block;color:#1d4ed8;font-size:13px">AI Interviewer</b><span style="font-size:12px;color:#5f6368">Structured voice interviews with evidence beside the score.</span></div>
      </div>
      <div style="background:#111827;color:#fff;border-radius:14px;padding:16px 18px;text-align:center;margin:0 0 14px">
        <div style="font:700 10px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#c4b5fd">Your referral code</div>
        <div style="font:800 32px/1.1 ui-monospace,Menlo,monospace;letter-spacing:.16em;margin:8px 0 6px">${safeCode}</div>
        <div style="font-size:12px;color:#9ca3af">Enter this on Sign up. ${first} earns 5 credits when you create your first assessment.</div>
      </div>
      <ol style="margin:0 0 16px;padding-left:18px;color:#3c4043;font-size:13px;line-height:1.55">
        <li>Start a free TalentEdge workspace.</li>
        <li>On Sign up, paste <b>${safeCode}</b> in Referral code.</li>
        <li>Create your first MeritEdge assessment — ${first} gets +5 credits.</li>
      </ol>
      <p style="margin:0 0 16px"><a href="#" onclick="closeReferShare();startFlow();return false" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font:700 13px Inter,sans-serif;padding:11px 16px;border-radius:10px">Start free with ${safeCode}</a></p>
      <p style="margin:0;font-size:12px;color:#5f6368">This is a preview share from ${escapeHtml(u.name||"TalentEdge")}. Nothing is emailed in this prototype.</p>
    </div>
  </div>`;
}
function openReferShare(){
  const u = currentUser();
  if(!u) return;
  const code = userInviteCode(u);
  const el = document.getElementById("referMailOverlay");
  if(!el) return;
  const fromEmail = (u.kind!=="preview" && u.email) ? u.email : "you@company.com";
  el.classList.add("open");
  el.innerHTML = `<div class="gmail">
    <div class="gmail-bar">
      <b>Gmail</b>
      <span class="sending" id="referSendState">Draft</span>
      <button class="te-btn ghost" type="button" onclick="closeReferShare()">×</button>
    </div>
    <div class="gmail-sub" id="referMailSubject">${escapeHtml(referShareSubject(u, code))}</div>
    <div class="gmail-meta">
      <div class="row"><label>From</label><span>${escapeHtml(u.name||"You")} &lt;${escapeHtml(fromEmail)}&gt;</span></div>
      <div class="row"><label>To</label><span><input id="referShareTo" type="email" placeholder="colleague@company.com" value="" style="width:100%;max-width:280px;height:30px;border:1px solid #dadce0;border-radius:6px;padding:0 8px;font:13px Roboto,Inter,sans-serif"></span></div>
      <div class="row"><label>Date</label><span>${escapeHtml(todayLabel())}</span></div>
    </div>
    <div class="gmail-body">${referShareEmailInner(u, code)}</div>
    <div class="gmail-acts">
      <button class="te-btn" type="button" onclick="sendReferShare()">Send email</button>
      <button class="te-btn ghost" type="button" onclick="copyInviteCode()">Copy code ${escapeHtml(code)}</button>
      <button class="te-btn ghost" type="button" onclick="closeReferShare()">Close</button>
    </div>
  </div>`;
  setTimeout(()=>document.getElementById("referShareTo")?.focus(), 40);
}
function closeReferShare(){
  document.getElementById("referMailOverlay")?.classList.remove("open");
}
function sendReferShare(){
  const u = currentUser();
  if(!u) return;
  const code = userInviteCode(u);
  const to = referShareTo();
  const st = document.getElementById("referSendState");
  if(!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){
    toast("Add a colleague email in To, then send.");
    document.getElementById("referShareTo")?.focus();
    return;
  }
  if(st){ st.className = "sending"; st.textContent = "Sending…"; }
  toast("Sending referral to "+to+"…");
  setTimeout(()=>{
    if(st){ st.className = "sent"; st.textContent = "Sent"; }
    toast(`Referral email sent to ${to} with code ${code}`);
  }, 900);
}
function creditCap(u){
  if(typeof u.creditsCap === "number") return u.creditsCap;
  const p = PLANS.find(x => x.id === currentPlanId(u));
  const planCredits = p && typeof p.credits === "number" ? p.credits : null;
  const left = u.credits || 0;
  if(planCredits != null) return Math.max(planCredits, left);
  return left;
}
function planValidityLabel(u){
  if(u.kind==="preview") return "Try the product";
  if(u.kind==="trial" && u.daysLeft != null) return `${u.daysLeft} day${u.daysLeft===1?"":"s"} left`;
  if(u.kind==="sales") return "No expiry";
  return "Active this cycle";
}
function planDisplayName(u){
  if(u.kind==="preview") return "Product preview";
  const p = PLANS.find(x => x.id === currentPlanId(u));
  if(p) return p.name;
  return u.kind==="sales" ? "Sales" : "Current plan";
}
function renderPublicPlans(){
  const hot = "growth";
  document.getElementById("publicBill")?.querySelectorAll("button").forEach((b,i)=>b.classList.toggle("on", (i===0 && billCycle==="monthly")||(i===1 && billCycle==="annual")));
  const cont = document.getElementById("publicPlanContinue");
  if(cont) cont.innerHTML = "";
  document.getElementById("publicPlanCards").innerHTML = PLANS.map(p=>`<div class="plancard ${p.id===hot?"hot":""}">
      ${p.tag?`<span class="badge">${p.tag}</span>`:""}
      <h3>${p.name}</h3>
      <div class="who">${p.who}</div>
      <div class="price">${planPrice(p)}${p.price?`<small> / ${billCycle==="annual"?"mo, billed yearly":"month"}</small>`:""}</div>
      <ul class="featul">${p.features.map(f=>`<li>${f}</li>`).join("")}</ul>
      ${p.id==="trial"?`<button class="primary" onclick="startFlow()">${p.cta}</button>`:
        p.id==="enterprise"?`<button class="ghost" style="width:100%" onclick="openInfo('Enterprise','In the live product this would reach sales. This prototype does not send mail.')">${p.cta}</button>`:
        `<button class="primary" onclick="beginCheckout('${p.id}', true)">${p.cta}</button>`}
    </div>`).join("");
  document.getElementById("publicFeatures").innerHTML = FEATURES.map(f=>`<div class="featbox"><b>${f.title}</b><p>${f.copy}</p></div>`).join("");
  document.getElementById("publicCompare").innerHTML = `<thead><tr><th>Feature</th>${PLANS.map(p=>`<th>${p.name}</th>`).join("")}</tr></thead><tbody>${PLAN_ROWS.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`;
}
function beginCheckout(planId, fromPublic){
  const p = PLANS.find(x=>x.id===planId);
  if(!p) return;
  if(p.id==="enterprise"){ openInfo("Enterprise","Talk to sales in the live product. This prototype does not send mail."); return; }
  if(p.id==="trial"){ startFlow(); return; }
  if(!state.session){
    toast("Sign in or start free, then choose a plan. Checkout needs a workspace.");
    showView("login");
    return;
  }
  clearCheckoutTimer();
  const u = currentUser();
  checkout = {
    planId:p.id, cycle:billCycle, step:"journey", method:"upi",
    orderId:"ME-"+Date.now().toString().slice(-8),
    status:"", applied:false, timerArmed:false, pin:"", otp:"",
    bank:PAY_BANKS[0], wallet:PAY_WALLETS[0], later:PAY_LATER[0],
    billingEmail: (u && u.kind!=="preview" && u.email) || (u && u.billingEmail) || "",
    billingName: (u && u.name) || "",
    upi: "alex@oksbi"
  };
  appSection = "plans";
  appDetail = null;
  showView("workspace");
  checkout.step = "methods";
  renderWorkspace();
  paintRazorpay();
}
function gstOf(amount){ return Math.round(amount * 0.18 * 100)/100; }
function moneyInr(n){ return "₹" + Number(n).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function checkoutTotals(){
  const p = PLANS.find(x=>x.id===checkout.planId);
  const usd = planAmount(p, checkout.cycle);
  const gstUsd = gstOf(usd);
  const totalUsd = Math.round((usd+gstUsd)*100)/100;
  const inr = Math.round(usd * 83 * 100)/100;
  const gstInr = gstOf(inr);
  const totalInr = Math.round((inr+gstInr)*100)/100;
  return {p, usd, gstUsd, totalUsd, inr, gstInr, totalInr};
}
function clearCheckoutTimer(){
  if(checkoutTimer){ clearTimeout(checkoutTimer); checkoutTimer = null; }
}
function ckStepBar(){
  const ids = CK_STEPS.map(s=>s.id);
  const at = Math.max(0, ids.indexOf(checkout.step));
  return `<div class="ck-steps">${CK_STEPS.map((s,i)=>`<div class="ck-step ${i===at?"on":i<at?"done":""}"><span>0${i+1}</span><b>${s.label}</b></div>`).join("")}</div>`;
}
function ckOrderCard(){
  const u = currentUser();
  const t = checkoutTotals();
  return `<div class="ck-box">
    <h2>Order summary</h2>
    <p class="sub">${escapeHtml(u.company)} · ${escapeHtml(t.p.name)} · ${checkout.cycle==="annual"?"Annual":"Monthly"}</p>
    <div class="ck-line"><span>Plan</span><b>${escapeHtml(t.p.name)}</b></div>
    <div class="ck-line"><span>Credits in this pack</span><b>+${t.p.credits}</b></div>
    <div class="ck-line"><span>Subtotal</span><b>${moneyInr(t.inr)}</b></div>
    <div class="ck-line"><span>GST (18%)</span><b>${moneyInr(t.gstInr)}</b></div>
    <div class="ck-line tot"><span>Total due</span><b>${moneyInr(t.totalInr)}</b></div>
    <p class="ck-hint" style="margin-top:10px">Order ${checkout.orderId} · Secured checkout · nothing is charged</p>
  </div>`;
}
function payMethodLabel(){
  return PAY_METHODS.find(m=>m.id===checkout.method)?.label || "Payment";
}
function checkoutGo(step){
  if(!checkout) return;
  checkout.step = step;
  if(step!=="processing") checkout.timerArmed = false;
  renderWorkspace();
}
function pickPayMethod(id){
  checkout.method = id;
  checkout.bank = checkout.bank || PAY_BANKS[0];
  checkout.wallet = checkout.wallet || PAY_WALLETS[0];
  checkout.later = checkout.later || PAY_LATER[0];
  checkout.step = "methods";
  renderWorkspace();
}
function closeRazorpay(){
  if(!checkout || checkout.step==="processing") return;
  clearCheckoutTimer();
  if(checkout.status==="success" && checkout.applied){
    finishRazorpayIntoJourney();
    return;
  }
  checkout = null;
  renderWorkspace();
}
function paintRazorpay(){
  const el = document.getElementById("rzpOverlay");
  if(!el) return;
  const open = !!(checkout && checkout.step && checkout.step!=="return" && checkout.step!=="journey");
  el.classList.toggle("open", open);
  el.innerHTML = open ? renderCheckout() : "";
  if(open && checkout && checkout.status==="success") paintGstMailStatus();
}
function rzpLogo(){ return `<span class="rzp-logo"><i></i>Razorpay</span>`; }
function renderCheckout(){
  const u = currentUser();
  const t = checkoutTotals();
  const close = checkout.step==="processing" ? "" : `<button class="rzp-x" type="button" aria-label="Close" onclick="closeRazorpay()">×</button>`;
  return `<div class="rzp-modal" role="dialog" aria-modal="true" aria-label="Razorpay Checkout">
    <div class="rzp-head">
      <div>
        <div class="rzp-merch">${escapeHtml(u.company)} · MeritEdge</div>
        <div class="rzp-amt">${moneyInr(t.totalInr)}</div>
        <div class="rzp-oid">${escapeHtml(t.p.name)} · +${t.p.credits} credits · ${checkout.orderId}</div>
      </div>
      ${close}
    </div>
    <div class="rzp-main">${renderCheckoutStep()}</div>
    <div class="rzp-foot"><span>PCI DSS compliant</span>${rzpLogo()}<span>Secured by Razorpay</span></div>
  </div>`;
}
function renderCheckoutStep(){
  if(checkout.step==="order" || checkout.step==="methods" || checkout.step==="details") return renderCkMethods();
  if(checkout.step==="auth") return renderCkAuth();
  if(checkout.step==="processing") return renderCkProcessing();
  if(checkout.step==="result") return renderCkResult();
  return renderCkReturn();
}
function renderCkMethods(){
  const u = currentUser();
  const t = checkoutTotals();
  const m = checkout.method || "upi";
  let body = "";
  if(m==="card"){
    body = `<h3>Card</h3><p class="sub">Visa, Mastercard, RuPay and Amex</p>
      <label class="ck-field"><span>Card number</span><input id="payCard" placeholder="ACCT-000006" maxlength="19" value="${escapeHtml(checkout.card||"")}" autocomplete="cc-number"></label>
      <div class="ck-split">
        <label class="ck-field"><span>Expiry</span><input id="payExp" placeholder="MM / YY" maxlength="7" value="${escapeHtml(checkout.exp||"")}"></label>
        <label class="ck-field"><span>CVV</span><input id="payCvc" placeholder="CVV" maxlength="4" value="${escapeHtml(checkout.cvc||"")}"></label>
      </div>
      <label class="ck-field"><span>Name on card</span><input id="payName" value="${escapeHtml(checkout.cardName||u.name)}" autocomplete="cc-name"></label>
      <p class="ck-hint">4242 succeeds · 4000 fails · 4111 pending</p>
      <button class="rzp-pay" type="button" onclick="submitPayDetails()">Pay ${moneyInr(t.totalInr)}</button>`;
  } else if(m==="upi"){
    body = `<h3>UPI</h3><p class="sub">Pay by any UPI app</p>
      <label class="ck-field"><span>UPI ID / VPA</span><input id="payUpi" placeholder="yourname@okaxis" value="${escapeHtml(checkout.upi||"")}" autocomplete="off"></label>
      <p class="ck-hint">fail@oksbi fails · pending@oksbi stays pending</p>
      <button class="rzp-pay" type="button" onclick="submitPayDetails()">Pay ${moneyInr(t.totalInr)}</button>
      <div class="rzp-or">or</div>
      <div class="rzp-qr"><i></i>Scan QR with GPay, PhonePe or Paytm</div>`;
  } else if(m==="netbanking"){
    body = `<h3>Netbanking</h3><p class="sub">Select your bank</p>
      <div class="ck-banks">${PAY_BANKS.map(b=>`<button type="button" class="ck-m ${checkout.bank===b?"on":""}" onclick="checkout.bank='${b}';renderWorkspace()"><i>🏦</i><span><b>${b}</b><small>Net banking</small></span></button>`).join("")}</div>
      <button class="rzp-pay" type="button" style="margin-top:14px" onclick="submitPayDetails()">Pay ${moneyInr(t.totalInr)}</button>`;
  } else if(m==="wallet"){
    body = `<h3>Wallet</h3><p class="sub">Pay from a linked wallet</p>
      <div class="ck-methods">${PAY_WALLETS.map(w=>`<button type="button" class="ck-m ${checkout.wallet===w?"on":""}" onclick="checkout.wallet='${w}';renderWorkspace()"><i>◇</i><span><b>${w}</b><small>Wallet + PIN</small></span></button>`).join("")}</div>
      <button class="rzp-pay" type="button" style="margin-top:14px" onclick="submitPayDetails()">Pay ${moneyInr(t.totalInr)}</button>`;
  } else {
    body = `<h3>Pay Later</h3><p class="sub">Pay in 15 days</p>
      <div class="ck-methods">${PAY_LATER.map(w=>`<button type="button" class="ck-m ${checkout.later===w?"on":""}" onclick="checkout.later='${w}';renderWorkspace()"><i>◷</i><span><b>${w}</b><small>No extra charge in this preview</small></span></button>`).join("")}</div>
      <button class="rzp-pay" type="button" style="margin-top:14px" onclick="submitPayDetails()">Pay ${moneyInr(t.totalInr)}</button>`;
  }
  const nav = PAY_METHODS.map(x=>`<button type="button" class="${m===x.id?"on":""}" onclick="captureBillEmail();pickPayMethod('${x.id}')">${x.label}<small>${x.hint}</small></button>`).join("");
  const bill = `<label class="ck-field"><span>GST billing email</span><input id="payBillEmail" type="email" value="${escapeHtml(checkout.billingEmail||u.email||"")}" placeholder="${escapeHtml(u.email||"you@company.com")}" oninput="captureBillEmail()"></label>
      <p class="ck-hint">Defaults to ${escapeHtml(u.name||"you")} · ${escapeHtml(u.email||"your account")}. Change it if the GST invoice should go elsewhere.</p>`;
  return `<div class="rzp-body"><nav class="rzp-nav">${nav}</nav><div class="rzp-pane">${bill}${body}</div></div>`;
}
function captureBillEmail(){
  if(!checkout) return;
  const el = document.getElementById("payBillEmail");
  if(el) checkout.billingEmail = el.value.trim();
}
function submitPayDetails(){
  captureBillEmail();
  if(checkout.billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(checkout.billingEmail)){ toast("Enter a valid GST billing email."); return; }
  if(!checkout.billingEmail) checkout.billingEmail = currentUser()?.email || "";
  const m = checkout.method;
  if(m==="card"){
    checkout.cardName = document.getElementById("payName")?.value.trim()||"";
    checkout.card = document.getElementById("payCard")?.value||"";
    checkout.exp = document.getElementById("payExp")?.value||"";
    checkout.cvc = document.getElementById("payCvc")?.value||"";
    if(checkout.card.replace(/\s/g,"").length<13){ toast("Enter a card number."); return; }
  } else if(m==="upi"){
    checkout.upi = document.getElementById("payUpi")?.value.trim()||"";
    if(!checkout.upi.includes("@")){ toast("Enter a UPI ID such as name@oksbi."); return; }
  } else if(m==="netbanking"){
    if(!checkout.bank){ toast("Select a bank."); return; }
  } else if(m==="wallet"){
    if(!checkout.wallet){ toast("Select a wallet."); return; }
  } else if(!checkout.later){ toast("Select a pay-later option."); return; }
  checkout.pin = "";
  checkout.otp = "";
  checkoutGo("auth");
}
function ckOtpInputs(id, n, fn){
  return `<div class="ck-otp" id="${id}">${Array.from({length:n},(_,i)=>`<input inputmode="numeric" maxlength="1" id="${id}${i+1}" oninput="ckOtpType('${id}',${i+1},${n},${fn})" onkeydown="ckOtpKey(event,'${id}',${i+1},${n})">`).join("")}</div>`;
}
function ckOtpType(id, i, n, doneFn){
  const el = document.getElementById(id+i);
  el.value = (el.value||"").replace(/\D/g,"").slice(-1);
  if(el.value && i<n) document.getElementById(id+(i+1))?.focus();
  const code = Array.from({length:n},(_,k)=>document.getElementById(id+(k+1))?.value||"").join("");
  checkout.otp = code;
  if(code.length===n && doneFn) doneFn();
}
function ckOtpKey(e, id, i, n){
  if(e.key==="Backspace" && !e.target.value && i>1) document.getElementById(id+(i-1))?.focus();
}
function pinPress(d){
  if(d==="x") checkout.pin = (checkout.pin||"").slice(0,-1);
  else if((checkout.pin||"").length<4) checkout.pin = (checkout.pin||"")+d;
  const dots = document.getElementById("ckPinDots");
  if(dots) dots.innerHTML = [0,1,2,3].map(i=>`<i class="${i<(checkout.pin||"").length?"on":""}"></i>`).join("");
  if((checkout.pin||"").length===4) submitPayAuth();
}
function renderCkAuth(){
  const t = checkoutTotals();
  const m = checkout.method;
  let headCls = "card", title = "Bank authorization", sub = "Enter the OTP sent by your bank", body = "";
  if(m==="card"){
    const last = (checkout.card||"").replace(/\s/g,"").slice(-4)||"4242";
    headCls = "card"; title = "Visa Secure"; sub = "HDFC Bank · card ending "+last;
    body = `<p class="sub">OTP sent to mobile ending 24 for ${moneyInr(t.totalInr)} to MeritEdge.</p>
      ${ckOtpInputs("ckOtp",6,"submitPayAuth")}
      <p class="ck-hint">Bank OTP · 123456 succeeds · 000000 fails · 111111 pending</p>
      <button class="te-btn" style="width:100%" type="button" onclick="submitPayAuth()">Verify OTP</button>`;
  } else if(m==="upi"){
    headCls = "upi"; title = "UPI PIN"; sub = escapeHtml(checkout.upi||"name@oksbi");
    body = `<p class="sub">Approve ${moneyInr(t.totalInr)} to meritedge@okaxis</p>
      <div class="ck-dots" id="ckPinDots">${[0,1,2,3].map(i=>`<i class="${i<(checkout.pin||"").length?"on":""}"></i>`).join("")}</div>
      <div class="ck-pin">${["1","2","3","4","5","6","7","8","9","x","0"].map(d=>`<button type="button" onclick="pinPress('${d}')">${d==="x"?"⌫":d}</button>`).join("")}</div>
      <p class="ck-hint">UPI PIN · 1234 succeeds · 0000 fails</p>`;
  } else if(m==="netbanking"){
    headCls = "nb"; title = escapeHtml(checkout.bank||"Net banking"); sub = "Customer login + OTP";
    body = `<label class="ck-field"><span>Customer ID</span><input id="nbUser" value="${escapeHtml(checkout.nbUser||"")}" placeholder="Customer ID"></label>
      <label class="ck-field"><span>Password</span><input id="nbPass" type="password" placeholder="••••••••"></label>
      <p class="sub">OTP from ${escapeHtml(checkout.bank||"your bank")}</p>
      ${ckOtpInputs("ckOtp",6,"submitPayAuth")}
      <button class="te-btn" style="width:100%" type="button" onclick="submitPayAuth()">Authorize payment</button>`;
  } else if(m==="wallet"){
    headCls = "wallet"; title = escapeHtml(checkout.wallet||"Wallet"); sub = "Enter wallet PIN";
    body = `<p class="sub">Pay ${moneyInr(t.totalInr)} from ${escapeHtml(checkout.wallet||"wallet")}</p>
      <div class="ck-dots" id="ckPinDots">${[0,1,2,3].map(i=>`<i class="${i<(checkout.pin||"").length?"on":""}"></i>`).join("")}</div>
      <div class="ck-pin">${["1","2","3","4","5","6","7","8","9","x","0"].map(d=>`<button type="button" onclick="pinPress('${d}')">${d==="x"?"⌫":d}</button>`).join("")}</div>`;
  } else {
    headCls = "later"; title = escapeHtml(checkout.later||"Pay later"); sub = "Approve this purchase";
    body = `<p class="sub">OTP to approve ${moneyInr(t.totalInr)} on ${escapeHtml(checkout.later||"pay later")}</p>
      ${ckOtpInputs("ckOtp",6,"submitPayAuth")}
      <button class="te-btn" style="width:100%" type="button" onclick="submitPayAuth()">Approve</button>`;
  }
  return `<div class="ck-auth" style="margin:18px auto 24px">
    <div class="ck-auth-h ${headCls}"><small>${title}</small><b>${moneyInr(t.totalInr)}</b><small>${sub}</small></div>
    <div class="ck-auth-b">${body}</div>
  </div>`;
}
function submitPayAuth(){
  if(checkout.method==="netbanking"){
    checkout.nbUser = document.getElementById("nbUser")?.value.trim()||checkout.nbUser||"";
    if(!checkout.nbUser){ toast("Enter your customer ID."); return; }
  }
  const needsOtp = checkout.method==="card" || checkout.method==="netbanking" || checkout.method==="paylater";
  const needsPin = checkout.method==="upi" || checkout.method==="wallet";
  if(needsOtp && (checkout.otp||"").length<6){ toast("Enter the 6-digit OTP."); return; }
  if(needsPin && (checkout.pin||"").length<4){ toast("Enter your 4-digit PIN."); return; }
  checkout.timerArmed = false;
  checkoutGo("processing");
}
function checkoutDecideStatus(){
  const m = checkout.method;
  const card = (checkout.card||"").replace(/\s/g,"");
  const upi = (checkout.upi||"").toLowerCase();
  if(m==="card" && card.startsWith("4000")) return "failed";
  if(m==="card" && card.startsWith("4111")) return "pending";
  if(m==="upi" && upi.startsWith("fail")) return "failed";
  if(m==="upi" && upi.startsWith("pending")) return "pending";
  if((checkout.otp||"")==="000000" || (checkout.pin||"")==="0000") return "failed";
  if((checkout.otp||"")==="111111") return "pending";
  return "success";
}
function applyCheckoutCredits(){
  if(checkout.applied) return;
  const {p, usd, gstUsd, totalInr} = checkoutTotals();
  const u = currentUser();
  const add = typeof p.credits === "number" ? p.credits : 0;
  const before = u.credits || 0;
  const oldCap = creditCap(u);
  u.credits = before + add;
  u.creditsCap = oldCap + add;
  u.plan = p.id;
  u.kind = "paid";
  u.daysLeft = null;
  checkout.creditsBefore = before;
  checkout.creditsAdded = add;
  checkout.applied = true;
  u.lastInvoice = {id:checkout.orderId, plan:p.name, amount:usd, gst:gstUsd, inr:totalInr, on:todayLabel(), status:"paid", email:checkout.billingEmail||u.email};
  u.billingEmail = checkout.billingEmail || u.email;
  u.payMethod = gstPayMethodLine();
  u.billCycle = checkout.cycle;
  saveState();
}
function renderCkProcessing(){
  const t = checkoutTotals();
  if(!checkout.timerArmed){
    checkout.timerArmed = true;
    clearCheckoutTimer();
    checkoutTimer = setTimeout(()=>{
      checkout.status = checkoutDecideStatus();
      const codeFail = (checkout.pin||"")==="0000" || (checkout.otp||"")==="000000";
      if(checkout.status==="success"){
        applyCheckoutCredits();
        openPaidSplit();
        sendGstSmtp();
      } else if(checkout.status==="failed" && codeFail){
        startBillMailStory(["failed-email"]);
      } else {
        checkout.step = "result";
        renderWorkspace();
      }
    }, 1400);
  }
  return `<div class="rzp-full">
    <div class="ck-spin"></div>
    <h2>Processing payment</h2>
    <p class="sub">Waiting for ${escapeHtml(payMethodLabel())} and your bank. Do not refresh.</p>
    <p class="ck-hint">${moneyInr(t.totalInr)} · ${checkout.orderId}</p>
  </div>`;
}
function renderCkResult(){
  const t = checkoutTotals();
  const st = checkout.status || "success";
  if(st==="success"){
    const after = checkout.creditsBefore + checkout.creditsAdded;
    return `<div class="rzp-full">
      <div class="ck-mark ok">✓</div>
      <h2>Payment successful</h2>
      <p class="sub">Paid ${moneyInr(t.totalInr)} · ${escapeHtml(t.p.name)} · ${checkout.orderId}</p>
      <div class="ck-plus"><span>Credits</span><b>${checkout.creditsBefore} → ${after}</b><span>+${checkout.creditsAdded}</span></div>
      <p class="ck-hint" id="gstPayMailStatus"></p>
      <button class="rzp-pay" type="button" style="max-width:280px;margin-top:8px" onclick="openPaidSplit()">GST invoice and plan</button>
    </div>`;
  }
  if(st==="pending"){
    return `<div class="rzp-full">
      <div class="ck-mark wait">…</div>
      <h2>Payment pending</h2>
      <p class="sub">Your bank or UPI app has not confirmed ${moneyInr(t.totalInr)} yet. Credits are not added until this succeeds.</p>
      <div class="te-actions" style="justify-content:center;margin-top:16px">
        <button class="te-btn ghost" type="button" onclick="checkoutGo('methods')">Try another method</button>
        <button class="rzp-pay" type="button" style="width:auto;padding:0 18px" onclick="finishBillJourneyToApp()">Go to Billing</button>
      </div>
    </div>`;
  }
  return `<div class="rzp-full">
    <div class="ck-mark bad">!</div>
    <h2>Payment failed</h2>
    <p class="sub">No amount was captured and credits were not added.</p>
    <div class="te-actions" style="justify-content:center;margin-top:16px">
      <button class="rzp-pay" type="button" style="width:auto;padding:0 18px" onclick="checkoutGo('methods')">Try again</button>
      <button class="te-btn ghost" type="button" onclick="startBillMailStory(['failed-email'])">Next · Failed payment email</button>
    </div>
  </div>`;
}
function renderCkReturn(){
  return "";
}
const GST_SELLER = __D.gstSeller;
function gstInvoiceNo(){ return "TE-INV-"+(checkout?.orderId||""); }
function gstMailSubject(){
  const t = checkoutTotals();
  return `GST Invoice · Order ${checkout.orderId} · ${t.p.name}`;
}
function gstPayMethodLine(){
  const m = checkout.method;
  if(m==="card") return "Card ending "+((checkout.card||"").replace(/\s/g,"").slice(-4)||"4242");
  if(m==="upi") return "UPI · "+(checkout.upi||"UPI");
  if(m==="netbanking") return "Netbanking · "+(checkout.bank||"Bank");
  if(m==="wallet") return "Wallet · "+(checkout.wallet||"Wallet");
  return "Pay Later · "+(checkout.later||"Pay later");
}
function gstInvoiceInner(){
  const u = currentUser();
  const t = checkoutTotals();
  const cgst = Math.round(t.gstInr/2*100)/100;
  const sgst = Math.round((t.gstInr-cgst)*100)/100;
  const cycle = checkout.cycle==="annual"?"Annual":"Monthly";
  const toEmail = checkout.billingEmail||u.email||"";
  return `<div class="inv-head">
      <div>
        <h3>Tax Invoice</h3>
        <div class="inv-muted">${escapeHtml(GST_SELLER.legal)}<br>Trade name ${escapeHtml(GST_SELLER.brand)}<br>${escapeHtml(GST_SELLER.address)}<br>GSTIN ${escapeHtml(GST_SELLER.gstin)} · PAN ${escapeHtml(GST_SELLER.pan)}</div>
      </div>
      <div class="inv-muted" style="text-align:right">
        <b>${escapeHtml(gstInvoiceNo())}</b><br>
        Date ${escapeHtml(todayLabel())}<br>
        Order ${escapeHtml(checkout.orderId)}<br>
        Place of supply ${escapeHtml(GST_SELLER.place)}
      </div>
    </div>
    <div class="inv-muted" style="margin:0 0 10px"><b>Bill to</b><br>${escapeHtml(u.name)} · ${escapeHtml(u.company)}<br>${escapeHtml(toEmail)}</div>
    <table class="inv-table">
      <thead><tr><th>Description</th><th>SAC</th><th class="r">Taxable</th><th class="r">GST 18%</th><th class="r">Amount</th></tr></thead>
      <tbody>
        <tr>
          <td>${escapeHtml(t.p.name)} · ${cycle} · +${t.p.credits} credits</td>
          <td>${GST_SELLER.sac}</td>
          <td class="r">${moneyInr(t.inr)}</td>
          <td class="r">${moneyInr(t.gstInr)}</td>
          <td class="r">${moneyInr(t.totalInr)}</td>
        </tr>
      </tbody>
    </table>
    <table class="inv-table">
      <tr><td>Taxable value</td><td class="r">${moneyInr(t.inr)}</td></tr>
      <tr><td>CGST @ 9%</td><td class="r">${moneyInr(cgst)}</td></tr>
      <tr><td>SGST @ 9%</td><td class="r">${moneyInr(sgst)}</td></tr>
      <tr><td><b>Total (INR)</b></td><td class="r"><b>${moneyInr(t.totalInr)}</b></td></tr>
    </table>
    <p class="inv-muted">Paid via ${escapeHtml(gstPayMethodLine())}. This is a computer-generated GST invoice. Dummy GSTIN for this preview only.</p>`;
}
function gstSmtpBase(){
  if(location.protocol==="http:" || location.protocol==="https:") return location.origin;
  return "http://127.0.0.1:8765";
}
function gstToEmails(){
  const u = currentUser();
  const out = [];
  const add = e => {
    e = String(e||"").trim().toLowerCase();
    if(!e || e===PREVIEW_EMAIL) return;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    if(!out.includes(e)) out.push(e);
  };
  if(u && u.kind!=="preview") add(u.email);
  add(checkout && checkout.billingEmail);
  return out;
}
function gstEmailDocument(){
  const u = currentUser();
  const t = checkoutTotals();
  const toEmail = checkout.billingEmail||u.email||"";
  const cgst = Math.round(t.gstInr/2*100)/100;
  const sgst = Math.round((t.gstInr-cgst)*100)/100;
  const cycle = checkout.cycle==="annual"?"Annual":"Monthly";
  const first = escapeHtml(u.name.split(" ")[0]||"there");
  const row = (a,b,c,d,e)=>`<tr><td style="border:1px solid #dadce0;padding:8px">${a}</td><td style="border:1px solid #dadce0;padding:8px">${b||""}</td><td style="border:1px solid #dadce0;padding:8px;text-align:right">${c||""}</td><td style="border:1px solid #dadce0;padding:8px;text-align:right">${d||""}</td><td style="border:1px solid #dadce0;padding:8px;text-align:right">${e||""}</td></tr>`;
  return `<div style="font-family:Arial,sans-serif;color:#202124;max-width:640px;margin:0 auto;font-size:14px;line-height:1.5">
    <p>Hi ${first},</p>
    <p>Thank you for your TalentEdge payment. GST invoice <b>${escapeHtml(gstInvoiceNo())}</b> is below for <b>${escapeHtml(t.p.name)}</b> (${cycle.toLowerCase()}), <b>+${t.p.credits} credits</b>.</p>
    <table style="width:100%;margin:16px 0"><tr>
      <td><b>Tax Invoice</b><br>${escapeHtml(GST_SELLER.legal)}<br>Trade name ${escapeHtml(GST_SELLER.brand)}<br>${escapeHtml(GST_SELLER.address)}<br>GSTIN ${escapeHtml(GST_SELLER.gstin)} · PAN ${escapeHtml(GST_SELLER.pan)}</td>
      <td style="text-align:right"><b>${escapeHtml(gstInvoiceNo())}</b><br>Date ${escapeHtml(todayLabel())}<br>Order ${escapeHtml(checkout.orderId)}<br>Place of supply ${escapeHtml(GST_SELLER.place)}</td>
    </tr></table>
    <p><b>Bill to</b><br>${escapeHtml(u.name)} · ${escapeHtml(u.company)}<br>${escapeHtml(toEmail)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:#f8f9fa">${row("<b>Description</b>","<b>SAC</b>","<b>Taxable</b>","<b>GST 18%</b>","<b>Amount</b>")}</tr>
      ${row(escapeHtml(t.p.name)+" · "+cycle+" · +"+t.p.credits+" credits", GST_SELLER.sac, moneyInr(t.inr), moneyInr(t.gstInr), moneyInr(t.totalInr))}
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px">
      ${row("Taxable value","","","",moneyInr(t.inr))}
      ${row("CGST @ 9%","","","",moneyInr(cgst))}
      ${row("SGST @ 9%","","","",moneyInr(sgst))}
      ${row("<b>Total (INR)</b>","","","","<b>"+moneyInr(t.totalInr)+"</b>")}
    </table>
    <p style="color:#5f6368;font-size:12px">Paid via ${escapeHtml(gstPayMethodLine())}. Computer-generated GST invoice.</p>
    <p>Questions: ${escapeHtml(GST_SELLER.fromEmail)}</p>
    <p>— TalentEdge billing</p>
  </div>`;
}
function setGstSendState(cls, text){
  const st = document.getElementById("gstSendState");
  if(!st) return;
  st.className = cls;
  st.textContent = text;
}
function paintGstMailStatus(){
  const el = document.getElementById("gstPayMailStatus");
  if(!el || !checkout) return;
  const st = checkout.mailStatus || "idle";
  const to = (checkout.mailTo||[]).join(", ") || "the registered email";
  if(st==="sending") el.innerHTML = `Emailing GST invoice to <b>${escapeHtml(to)}</b>…`;
  else if(st==="sent") el.innerHTML = `GST invoice emailed to <b>${escapeHtml(to)}</b>. Check inbox and spam.`;
  else if(st==="error") el.innerHTML = `${escapeHtml(checkout.mailError||"Email failed.")} <button class="forgot" type="button" onclick="sendGstSmtp()">Retry email</button>`;
  else if(st==="none") el.innerHTML = `No registered work email on this account. Register, or type a billing email, then retry. <button class="forgot" type="button" onclick="sendGstSmtp()">Retry email</button>`;
  else el.textContent = "";
}
async function sendGstSmtp(){
  if(!checkout || checkout.status!=="success") return;
  const tos = gstToEmails();
  checkout.mailTo = tos;
  checkout.mailStatus = tos.length ? "sending" : "none";
  checkout.mailError = "";
  setGstSendState("sending", tos.length ? "Sending via Gmail to "+tos.join(", ")+"…" : "No registered email to send to");
  paintGstMailStatus();
  if(!tos.length){
    toast("Register with a work email, or type a GST billing email, then retry.");
    return;
  }
  try{
    const base = gstSmtpBase();
    const health = await fetch(base+"/health", {method:"GET"}).then(r=>r.json());
    if(!health.ready){
      checkout.mailStatus = "error";
      checkout.mailError = "Gmail credentials missing on the dummy server.";
      setGstSendState("sending", checkout.mailError);
      paintGstMailStatus();
      return;
    }
    const res = await fetch(base+"/send-gst", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        to: tos,
        subject: gstMailSubject(),
        html: gstEmailDocument()
      })
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok || !data.ok){
      checkout.mailStatus = "error";
      checkout.mailError = data.error || ("SMTP "+res.status);
      setGstSendState("sending", "Gmail SMTP failed: "+checkout.mailError);
      paintGstMailStatus();
      toast(checkout.mailError);
      return;
    }
    checkout.mailStatus = "sent";
    const delivered = (data.to||tos).join(", ");
    setGstSendState("sent", "Sent via Gmail to "+delivered);
    paintGstMailStatus();
    toast("GST invoice emailed to "+delivered);
  }catch(e){
    checkout.mailStatus = "error";
    checkout.mailError = "Invoice email could not be sent. Check Gmail credentials in gst_smtp.env.";
    setGstSendState("sending", checkout.mailError);
    paintGstMailStatus();
    toast(checkout.mailError);
  }
}
function openGstMail(){
  if(!checkout || checkout.status!=="success") return;
  const u = currentUser();
  const t = checkoutTotals();
  const toEmail = checkout.billingEmail||u.email||"";
  const sub = gstMailSubject();
  const el = document.getElementById("gstMailOverlay");
  el.classList.add("open");
  el.innerHTML = `<div class="gmail">
    <div class="gmail-bar">
      <b>Gmail</b>
      <span class="sending" id="gstSendState">Connecting to Gmail SMTP…</span>
      <button class="te-btn ghost" type="button" onclick="closeGstMail()">×</button>
    </div>
    <div class="gmail-sub" id="gstMailSubject">${escapeHtml(sub)}</div>
    <div class="gmail-meta">
      <div class="row"><label>From</label><span>${escapeHtml(GST_SELLER.fromName)} &lt;${escapeHtml(GST_SELLER.fromEmail)}&gt;</span></div>
      <div class="row"><label>To</label><span>${escapeHtml(u.name)} &lt;${escapeHtml(toEmail)}&gt;</span></div>
      <div class="row"><label>Date</label><span>${escapeHtml(todayLabel())}</span></div>
    </div>
    <div class="gmail-body">
      <p>Hi ${escapeHtml(u.name.split(" ")[0]||"there")},</p>
      <p>Thank you for your TalentEdge payment. GST invoice <b>${escapeHtml(gstInvoiceNo())}</b> is below for <b>${escapeHtml(t.p.name)}</b> (${checkout.cycle==="annual"?"annual":"monthly"}), <b>+${t.p.credits} credits</b>.</p>
      ${gstInvoiceInner()}
      <p>Questions on this invoice: reply to ${escapeHtml(GST_SELLER.fromEmail)}.</p>
      <p>— TalentEdge billing</p>
    </div>
    <div class="gmail-acts">
      <button class="te-btn" type="button" onclick="closeGstMail();finishBillJourneyToApp()">Next · Billing</button>
      <button class="te-btn ghost" type="button" onclick="printGstInvoice()">Download GST invoice</button>
      <button class="te-btn ghost" type="button" onclick="closeGstMail()">Back to payment</button>
    </div>
  </div>`;
  sendGstSmtp();
}
function closeGstMail(){
  document.getElementById("gstMailOverlay")?.classList.remove("open");
}
function printGstInvoice(){
  if(!checkout){
    const u = currentUser();
    seedBillCheckout((u && creditsRecharged(u) && u.plan && u.plan!=="trial") ? u.plan : "starter");
    checkout.step = "return";
    checkout.status = "success";
    checkout.applied = true;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(gstInvoiceNo())}</title>
    <style>body{font-family:Inter,Arial,sans-serif;padding:32px;color:#202124;max-width:720px;margin:auto}
    .inv-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
    .inv-table th,.inv-table td{border:1px solid #dadce0;padding:8px 10px;text-align:left}
    .inv-table th{background:#f8f9fa}.inv-table .r{text-align:right}
    .inv-head{display:flex;justify-content:space-between;gap:16px;margin:0 0 12px}
    .inv-head h3{margin:0}.inv-muted{color:#5f6368;font-size:12px;line-height:1.45}</style></head>
    <body onload="window.print()">${gstInvoiceInner()}</body></html>`;
  const w = window.open("", "_blank", "width=800,height=900");
  if(!w){ toast("Allow pop-ups to download the GST invoice."); return; }
  w.document.write(html);
  w.document.close();
}
function submitPay(){ submitPayDetails(); }
let tourIntroTimer = null;
let tourIntroGen = 0;
let introVoiceStarted = false;
let introVoiceUnlock = null;
function closeTourIntro(){
  tourIntroGen += 1;
  introVoiceStarted = false;
  if(tourIntroTimer){ clearTimeout(tourIntroTimer); tourIntroTimer = null; }
  if(introVoiceUnlock){
    document.removeEventListener("pointerdown", introVoiceUnlock, true);
    document.removeEventListener("keydown", introVoiceUnlock, true);
    introVoiceUnlock = null;
  }
  try{ window.speechSynthesis?.cancel(); }catch(e){}
  document.getElementById("tourIntro")?.classList.remove("open");
  document.body.classList.remove("tour-intro-open");
}
function beginProductTour(){
  if(!state.session){ showView("login"); toast("Sign in or start free, then take the tour."); return; }
  if(tour) return;
  closeWow();
  closeSitIn();
  closeReady();
  closeSignup();
  closeTrialJourney();
  closeBillJourney();
  closeReferShare();
  closeDemoReel();
  closeIntentPicker();
  stopTourVoice();
  clearTourAdvance();
  appSection = "meritedge";
  appDetail = null;
  wizard = null;
  clearCheckoutTimer();
  checkout = null;
  showView("workspace");
  if(!hasTourUserActivation()){
    openTourIntro();
    return;
  }
  startDemoReel();
}
function hasTourUserActivation(){
  return !navigator.userActivation || navigator.userActivation.isActive;
}
function openTourIntro(){
  const el = document.getElementById("tourIntro");
  const stage = document.getElementById("tourIntroStage");
  if(!el || !stage){ startDemoReel(); return; }
  const gen = ++tourIntroGen;
  const hasActivation = hasTourUserActivation();
  if(tourIntroTimer){ clearTimeout(tourIntroTimer); tourIntroTimer = null; }
  document.body.classList.add("tour-intro-open");
  el.classList.add("open");
  stage.innerHTML = `<p class="ti-kicker">TalentEdge</p>
    <h1 id="tourIntroTitle">The future of assessments<br>&amp; AI interviewing</h1>
    <div class="ti-bar" aria-hidden="true"><i></i></div>
    <p class="ti-pill">Welcome to the future of hiring.</p>
    <p class="ti-hint ${hasActivation?"speak":""}" id="tiSpeakHint"><span class="ti-speak" aria-hidden="true"><i></i><i></i><i></i></span> ${hasActivation?"Your product tour is about to begin":"Click below to start the tour with voice"}</p>
    <button class="ti-skip" type="button" onclick="skipTourIntro()">${hasActivation?"Skip intro →":"Start tour with voice →"}</button>`;
  introVoiceStarted = false;
  if(hasActivation){
    speakTourIntro();
    tourIntroTimer = setTimeout(()=>{
      if(gen !== tourIntroGen) return;
      startDemoReel();
    }, 4200);
  }
}
function skipTourIntro(){
  closeTourIntro();
  stopTourVoice();
  clearTourAdvance();
  if(demoReel) closeDemoReel();
  tour = null;
  document.body.classList.remove("tour-lock");
  document.getElementById("tourOverlay")?.classList.remove("open");
  if(currentUser()?.kind === "preview"){
    appSection = "meritedge";
    appDetail = null;
    wizard = null;
    showView("workspace");
    startCreateAssessment({focused:true});
    toast("Tour skipped. Create your assessment to get started.");
    return;
  }
  showView("workspace");
}
const DEMO_DURATION = __D.demoDuration;
const DEMO_SCENES = __D.demoScenes;
let demoReel = null;
let demoReelTimer = null;
let demoPointerTimer = null;
let aiCreateTimer = null;
let aiCreateGen = 0;
function fmtDemoClock(ms){
  const s = Math.max(0, Math.round(ms/1000));
  return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
}
function demoLine(s){ return (s && (s.line || s.voice || s.caption)) || ""; }
function demoCueAt(i){
  let t = 0;
  for(let k=0;k<i;k++) t += DEMO_SCENES[k].ms;
  return t;
}
function demoTotalMs(){ return DEMO_SCENES.reduce((n,s)=>n+(Number(s.ms)||0),0) || DEMO_DURATION; }
function isCinemaScene(s){ return !!(s && (s.kind==="cinema" || s.cinema)); }
function demoElapsed(){
  if(!demoReel) return 0;
  if(demoReel.paused) return demoReel.frozenElapsed || 0;
  return Math.min(demoReel.total, Date.now()-demoReel.started);
}
function demoChapters(){
  const out = [];
  const seen = new Set();
  DEMO_SCENES.forEach((s,i)=>{
    const name = s.chapter || "Tour";
    if(seen.has(name)) return;
    seen.add(name);
    out.push({name, i});
  });
  return out;
}
function demoSceneIndex(id){
  return DEMO_SCENES.findIndex(s => s.id===id);
}
function speechRateFor(text, durationMs){
  const words = String(text||"").trim().split(/\s+/).filter(Boolean).length;
  const natural = words * 390 + 280;
  const target = Math.max(900, (durationMs||natural) - 260);
  return Math.round(Math.min(1.12, Math.max(0.9, natural / target)) * 100) / 100;
}
function clearDemoFrame(){
  [document.querySelector(".te-shell"), document.getElementById("sitinOverlay")].forEach(el=>{
    if(!el) return;
    el.style.top = el.style.left = el.style.width = el.style.height = el.style.right = el.style.bottom = "";
  });
  document.body.classList.remove("demo-cinema","demo-frame-tilt-left","demo-frame-tilt-right","demo-frame-rise","demo-frame-ken","demo-frame-flat");
}
function syncDemoFrame(){
  const stage = document.getElementById("dvStage");
  const shell = document.querySelector(".te-shell");
  if(!stage || !shell || !demoReel) return;
  if(demoReel.ended || isCinemaScene(DEMO_SCENES[demoReel.i])) return;
  const r = stage.getBoundingClientRect();
  const box = {top:r.top+"px", left:r.left+"px", width:r.width+"px", height:r.height+"px", right:"auto", bottom:"auto"};
  Object.assign(shell.style, box);
  const sit = document.getElementById("sitinOverlay");
  if(sit) Object.assign(sit.style, box);
}
function closeDemoReel(){
  if(demoReelTimer){ clearTimeout(demoReelTimer); demoReelTimer = null; }
  if(aiCreateTimer){ clearTimeout(aiCreateTimer); aiCreateTimer = null; }
  if(demoPointerTimer){ clearTimeout(demoPointerTimer); demoPointerTimer = null; }
  aiCreateGen += 1;
  demoReel = null;
  document.getElementById("demoReel")?.classList.remove("open");
  document.body.classList.remove("demo-open","demo-ended");
  clearDemoFrame();
  hideDemoPointer();
  closeSitIn();
  try{ window.speechSynthesis?.cancel(); }catch(e){}
}
function startDemoReel(){
  closeTourIntro();
  closeSitIn();
  if(demoReelTimer){ clearTimeout(demoReelTimer); demoReelTimer = null; }
  demoReel = {i:0, started: Date.now(), total: demoTotalMs(), ended:false, paused:false, frozenElapsed:0};
  document.body.classList.add("demo-open");
  document.body.classList.remove("demo-ended");
  const el = document.getElementById("demoReel");
  el.classList.add("open");
  showView("workspace");
  paintDemoReel(true);
  playDemoScene(0);
  armDemoVoiceUnlock();
}
function cinemaCircuitSvg(){
  return `<svg class="ti-circuit" viewBox="0 0 1200 700" aria-hidden="true"><path d="M40 620 C120 520,80 260,220 220" fill="none" stroke="#7c3aed55" stroke-width="1.2"/><path d="M1160 80 C980 140,1040 300,880 340" fill="none" stroke="#60a5fa44" stroke-width="1.2"/><path d="M80 80 C200 160,160 300,320 280" fill="none" stroke="#a78bfa33" stroke-width="1"/><circle cx="220" cy="220" r="4" fill="#a78bfa"/><circle cx="880" cy="340" r="4" fill="#60a5fa"/><circle cx="1080" cy="560" r="3" fill="#c4b5fd"/><circle cx="80" cy="120" r="3" fill="#a78bfa"/></svg>`;
}
function cinemaDeviceAssess(){
  const a = assessments[0] || {};
  const rows = (a.candidates||[]).slice(0,3).map(c=>`<div class="row"><span>${escapeHtml(c.name)}</span><b>${escapeHtml(String(c.score))}</b></div>`).join("");
  return `<article class="cin-device"><div class="bar"><span>MeritEdge</span><span>Publish</span></div><div class="body"><div class="row"><span>${escapeHtml(a.title||"Assessment")}</span><b>${a.completed||0}/${a.invited||0}</b></div>${rows}</div></article>`;
}
function cinemaDeviceInterview(){
  const iv = interviews[0] || {};
  const qs = ["Walk me through a recent tradeoff.","How do you sequence discovery?","What would you cut from this scope?"];
  return `<article class="cin-device"><div class="bar"><span>AI Interviewer</span><span>Publish</span></div><div class="body">${qs.map(q=>`<div class="q">${escapeHtml(q)}</div>`).join("")}<div class="row"><span>${escapeHtml(iv.title||"AI Interview")}</span><b>${escapeHtml(String((iv.candidates||[])[0]?.score||"4.8/5"))}</b></div></div></article>`;
}
function cinemaHtml(scene){
  const kind = scene.cinema || "hero";
  const a = assessments[0] || {};
  const iv = interviews[0] || {};
  const top = (a.candidates||[])[0] || {name:"Maya Chen", score:92};
  const topIv = (iv.candidates||[])[0] || {score:"4.8/5", rec:"Strong match"};
  if(kind==="advantages"){
    const cards = (scene.cards||[]).map(c=>`<button class="cin-card" type="button" onclick="jumpDemoById('${c.jump||""}')"><i>${escapeHtml(c.ico)}</i><b>${escapeHtml(c.title)}</b><span>${escapeHtml(c.copy)}</span></button>`).join("");
    return `<div class="cin"><p class="cin-kicker">Why TalentEdge</p><div class="cin-cards">${cards}</div></div>`;
  }
  if(kind==="insight"){
    return `<div class="cin cin-insight"><div class="cin-glass"><header>Candidate report</header><div class="cin-rings"><div><b>${escapeHtml(String(top.score||92))}</b><span>MeritEdge</span></div><div><b>${escapeHtml(String(topIv.score||"4.8").replace("/5",""))}</b><span>AI Interview</span></div><div><b>88%</b><span>Role fit</span></div></div><p>${escapeHtml(top.name)} · ${escapeHtml(topIv.rec||"Strong match")}</p></div></div>`;
  }
  if(kind==="dual"){
    return `<div class="cin"><div class="cin-dual">${cinemaDeviceAssess()}${cinemaDeviceInterview()}</div></div>`;
  }
  if(kind==="mosaic"){
    return `<div class="cin cin-mosaic">
      <div class="cin-panel"><b>MeritEdge score</b><div class="stat">${escapeHtml(String(top.score||92))}</div><span>${escapeHtml(top.name)} · Shortlisted</span></div>
      <div class="cin-panel"><b>AI Interviewer</b><div class="stat">${escapeHtml(String(topIv.score||"4.8/5"))}</div><span>${escapeHtml(topIv.rec||"Strong match")}</span></div>
      <div class="cin-panel"><b>Completion</b><div class="bars"><i style="height:70%"></i><i style="height:88%"></i><i style="height:54%"></i><i style="height:96%"></i><i style="height:62%"></i></div></div>
      <div class="cin-panel"><b>Shortlist</b><div class="stat">${a.shortlisted||2}</div><span>Ready for the next round</span></div>
    </div>`;
  }
  if(kind==="cta"){
    return `<div class="cin cin-cta"><p class="cin-kicker">TalentEdge</p><h1>${escapeHtml(scene.title||"Experience smarter assessments. Discover AI-powered interviews.")}</h1><div class="cin-actions"><button class="explore" type="button" onclick="tryDemoYourself()">Explore the platform</button><button class="ghost" type="button" onclick="replayProductTour()">Replay tour</button></div></div>`;
  }
  return `<div class="cin cin-hero"><p class="cin-kicker">TalentEdge</p><h1>${escapeHtml(scene.title||"The future of assessments & AI interviewing")}</h1></div>`;
}
function demoFloatHtml(scene){
  return (scene.floats||[]).map(f=>{
    if(f.type==="ring") return `<aside class="dv-chip ring" style="--x:${f.x};--y:${f.y}"><b>${escapeHtml(f.value)}</b><span>${escapeHtml(f.label)}</span></aside>`;
    return `<aside class="dv-chip" style="--x:${f.x};--y:${f.y}"><b>${escapeHtml(f.title)}</b><span>${escapeHtml(f.copy)}</span></aside>`;
  }).join("");
}
function demoStepsHtml(scene){
  if(!scene.steps) return "";
  const on = scene.stepOn||0;
  return `<div class="dv-steps">${scene.steps.map((label,i)=>`<span class="${i<on?"done":i===on?"on":""}">${i<on?"✓ ":""}${escapeHtml(label)}</span>`).join("")}</div>`;
}
function hideDemoPointer(){
  const ptr = document.getElementById("dvPointer");
  if(ptr){ ptr.classList.remove("on","click"); }
  if(demoPointerTimer){ clearTimeout(demoPointerTimer); demoPointerTimer = null; }
}
function aimDemoPointer(sel){
  hideDemoPointer();
}
function setDemoFrameClass(scene){
  document.body.classList.remove("demo-frame-tilt-left","demo-frame-tilt-right","demo-frame-rise","demo-frame-ken","demo-frame-flat");
  const frame = scene && !isCinemaScene(scene) ? (scene.frame || "flat") : "";
  if(frame) document.body.classList.add("demo-frame-"+frame);
  document.body.classList.toggle("demo-cinema", !!(scene && isCinemaScene(scene)));
}
function paintDemoReel(full){
  const el = document.getElementById("demoReel");
  if(!el || !demoReel) return;
  const ended = demoReel.ended;
  const scene = DEMO_SCENES[Math.min(demoReel.i, DEMO_SCENES.length-1)] || {};
  const elapsed = demoElapsed();
  const chapters = demoChapters();
  const chap = scene.chapter || "";
  if(full || !el.querySelector(".dv-world")){
    el.innerHTML = `<div class="dv-amb" aria-hidden="true"><div class="ti-orb a"></div><div class="ti-orb b"></div><div class="ti-stars"></div>${cinemaCircuitSvg()}</div>
      <div class="dv-top"><span class="dv-brand">TalentEdge <b>Product tour</b></span>
        <span id="dvClock">${fmtDemoClock(ended?demoReel.total:elapsed)} / ${fmtDemoClock(demoReel.total)}</span>
        <div class="dv-top-r">
          <button type="button" onclick="toggleDemoMute()">${tourMuted?"Unmute":"Mute"}</button>
          ${ended?"":`<button type="button" onclick="endDemoReel()">Skip</button>`}
        </div>
      </div>
      <div class="dv-world">
        <div class="dv-stage" id="dvStage" aria-hidden="true"></div>
        <div class="dv-cinema ${isCinemaScene(scene)?"on":""}" id="dvCinema">${isCinemaScene(scene)?cinemaHtml(scene):""}</div>
        <div class="dv-fx" id="dvFx">${demoFloatHtml(scene)}</div>
      </div>
      <div class="dv-caption" id="dvCaptionBox">
        <span class="dv-pill" id="dvPill">${ended?"That's the product. Try it, or watch again.":escapeHtml(scene.caption||demoLine(scene))}</span>
        <p class="dv-benefit" id="dvBenefit">${ended?"":escapeHtml(scene.benefit||"")}</p>
        <div id="dvSteps">${ended?"":demoStepsHtml(scene)}</div>
      </div>
      <div class="dv-dock">
        <div class="dv-chaps" id="dvChaps">${chapters.map(c=>`<button type="button" class="${c.name===chap?"on":""}" onclick="jumpDemoScene(${c.i})">${escapeHtml(c.name)}</button>`).join("")}</div>
        <div class="dv-prog"><i id="dvBar" style="width:${ended?100:Math.min(100, elapsed/demoReel.total*100)}%"></i></div>
        <div>
          <button type="button" onclick="demoGo(-1)">Back</button>
          <button type="button" onclick="pauseDemoReel()">${demoReel.paused?"Play":"Pause"}</button>
          <button type="button" onclick="demoGo(1)">Next</button>
          <button type="button" onclick="tryDemoYourself()">Try it yourself</button>
        </div>
      </div>
      <div class="dv-end ${ended?"on":""}" id="dvEnd">
        <div class="dv-end-card">
          <p class="cin-kicker">Ready when you are</p>
          <h2>Experience smarter assessments.</h2>
          <p>Create from a JD, publish, and invite yourself. No payment to start.</p>
          <div class="dv-cta">
            <button class="try" type="button" onclick="tryDemoYourself()">Explore the platform</button>
            <button class="replay" type="button" onclick="replayProductTour()">Replay product tour</button>
          </div>
        </div>
      </div>`;
    requestAnimationFrame(syncDemoFrame);
    return;
  }
  const clock = document.getElementById("dvClock");
  const bar = document.getElementById("dvBar");
  const pill = document.getElementById("dvPill");
  const benefit = document.getElementById("dvBenefit");
  const steps = document.getElementById("dvSteps");
  const cinema = document.getElementById("dvCinema");
  const fx = document.getElementById("dvFx");
  const chaps = document.getElementById("dvChaps");
  const end = document.getElementById("dvEnd");
  if(clock) clock.textContent = fmtDemoClock(ended?demoReel.total:elapsed)+" / "+fmtDemoClock(demoReel.total);
  if(bar) bar.style.width = (ended?100:Math.min(100, elapsed/demoReel.total*100))+"%";
  if(pill) pill.textContent = ended ? "That's the product. Try it, or watch again." : (scene.caption || demoLine(scene));
  if(benefit) benefit.textContent = ended ? "" : (scene.benefit || "");
  if(steps) steps.innerHTML = ended ? "" : demoStepsHtml(scene);
  if(cinema){
    cinema.classList.toggle("on", !ended && isCinemaScene(scene));
    if(!ended && isCinemaScene(scene) && cinema.dataset.scene !== scene.id){
      cinema.innerHTML = cinemaHtml(scene);
      cinema.dataset.scene = scene.id || "";
    }
  }
  if(fx && fx.dataset.scene !== (scene.id||"") ){
    fx.innerHTML = ended ? "" : demoFloatHtml(scene);
    fx.dataset.scene = scene.id || "";
  }
  if(chaps){
    chaps.innerHTML = chapters.map(c=>`<button type="button" class="${c.name===chap?"on":""}" onclick="jumpDemoScene(${c.i})">${escapeHtml(c.name)}</button>`).join("");
  }
  if(ended) end?.classList.add("on");
  else end?.classList.remove("on");
  requestAnimationFrame(syncDemoFrame);
}
function fillDemoJd(asInterview){
  if(!wizard) return;
  const jd = jdByRole(intentRole());
  applyJdToData(wizard.data, jd, null, !!asInterview);
  wizard.data.jdId = jd.id;
  wizard.data.jdFile = jd.file;
  wizard.data.jdParsing = false;
  wizard.data.method = "jd";
  wizard.data.aiTab = "jd";
  if(asInterview){
    wizard.data.ivSource = "jd";
  } else {
    wizard.data.build = "ai";
    wizard.data.aiPhase = "generator";
    wizard.data.aiTab = "jd";
  }
  renderWorkspace();
}
function showDemoInvitePage(){
  const item = assessments[0];
  closeDemoReel();
  openPostPublishInvite("assessment", item?.id || "a1");
}
function openPostPublishInvite(kind, id){
  const u = currentUser();
  pendingInvite = {kind, id};
  if(isPreviewUser(u)){
    openInviteYourselfGate();
    return;
  }
  wizard = null;
  pendingInvite = null;
  appSection = kind === "interview" ? "ai-interviewer" : "meritedge";
  appDetail = {type:"invite", kind, id, emails:u?.email || ""};
  showView("workspace");
  requestAnimationFrame(()=>showAppClickPointer(".te-wiz-foot .te-btn:not(.ghost)", "Invite yourself"));
  toast(`${kind === "interview" ? "AI interview" : "Assessment"} published. Invite yourself to try the candidate experience.`);
}
function applyDemoScene(s){
  aiCreateGen += 1;
  if(aiCreateTimer){ clearTimeout(aiCreateTimer); aiCreateTimer = null; }
  closeSitIn();
  setDemoFrameClass(s);
  if(isCinemaScene(s)){
    appSection = "meritedge";
    appDetail = null;
    wizard = null;
    renderWorkspace();
    hideDemoPointer();
    paintDemoReel(false);
    return;
  }
  appSection = s.section || (s.wizard==="interview" || s.open==="interview" || s.open==="report" ? "ai-interviewer" : "meritedge");
  appDetail = null;
  wizard = null;
  if(s.listView) listViewMode = s.listView;
  if(s.settingsTab) settingsTab = s.settingsTab;
  if(s.choose){
    startCreateAssessment();
  } else if(s.generator && s.wizard==="interview"){
    startCreateInterview();
    wizard.data.ivSource = "jd";
    fillDemoJd(true);
  } else if(s.generator){
    startCreateAssessment();
    pickAssessBuild("ai");
    fillDemoJd(false);
  } else if(s.creating && s.wizard==="interview"){
    wizard = {kind:"interview", step:0, publishedId:null, data:tourInterviewData(true)};
    wizard.data.ivSource = "jd";
    wizard.data.aiPhase = "creating";
    wizard.data.aiCreateAt = 0;
    wizard.data.aiPct = 12;
    appDetail = {type:"wizard"};
    renderWorkspace();
    startDemoCreatingTick(s.ms);
  } else if(s.creating){
    startCreateAssessment();
    pickAssessBuild("ai");
    pasteSampleJd();
    wizard.data.aiPhase = "creating";
    wizard.data.aiCreateAt = 0;
    wizard.data.aiPct = 12;
    renderWorkspace();
    startDemoCreatingTick(s.ms);
  } else if(s.wizard==="assessment"){
    wizard = {kind:"assessment", step:s.wizStep, publishedId:null, data:tourAssessData(!!s.jdShow)};
    appDetail = {type:"wizard"};
    renderWorkspace();
  } else if(s.wizard==="interview"){
    wizard = {kind:"interview", step:s.wizStep, publishedId:null, data:tourInterviewData(!!s.jdShow)};
    appDetail = {type:"wizard"};
    renderWorkspace();
  } else if(s.open==="assessment"){
    appDetail = {type:"assessment", id: assessments[0]?.id || "a1"};
    renderWorkspace();
  } else if(s.open==="interview"){
    appDetail = {type:"interview", id: interviews[0]?.id || "i1"};
    renderWorkspace();
  } else if(s.open==="report"){
    const iv = interviews[0];
    const cand = iv?.candidates?.find(c=>c.status==="Completed") || iv?.candidates?.[0];
    if(iv && cand) appDetail = {type:"report", kind:"interview", id: iv.id, candId: cand.id};
    renderWorkspace();
  } else {
    renderWorkspace();
  }
  paintDemoReel(false);
  syncDemoFrame();
  requestAnimationFrame(()=>{
    syncDemoFrame();
    aimDemoPointer(s.cursor);
  });
}
function startDemoCreatingTick(ms){
  const gen = ++aiCreateGen;
  const span = Math.max(4000, (ms || 8000) - 500);
  const step = Math.max(700, Math.floor(span / 5));
  const tick = i => {
    if(gen!==aiCreateGen || !wizard?.data) return;
    if(!demoReel && !tour) return;
    wizard.data.aiCreateAt = i;
    wizard.data.aiPct = Math.min(100, [12,38,62,88,100][i]||100);
    renderWorkspace();
    if(i<4) aiCreateTimer = setTimeout(()=>tick(i+1), step);
  };
  aiCreateTimer = setTimeout(()=>tick(0), 180);
}
function playDemoScene(i){
  if(!demoReel || demoReel.ended) return;
  demoReel.i = i;
  const scene = DEMO_SCENES[i];
  applyDemoScene(scene);
  paintDemoReel(true);
  const until = demoReel.started + demoCueAt(i) + scene.ms;
  const remain = Math.max(900, until - Date.now());
  const line = demoLine(scene);
  if(!tourMuted && line && !demoReel.paused) speakTour(line, null, remain);
  tickDemo();
}
function tickDemo(){
  if(!demoReel || demoReel.ended || demoReel.paused) return;
  paintDemoReel(false);
  const scene = DEMO_SCENES[demoReel.i];
  const until = demoReel.started + demoCueAt(demoReel.i) + scene.ms;
  if(Date.now() >= until - 16){
    if(scene.afterInvite){
      showDemoInvitePage();
      return;
    }
    if(demoReel.i < DEMO_SCENES.length-1) playDemoScene(demoReel.i+1);
    else endDemoReel();
    return;
  }
  demoReelTimer = setTimeout(tickDemo, 80);
}
function jumpDemoScene(i){
  if(!demoReel) return;
  i = Math.max(0, Math.min(DEMO_SCENES.length-1, Number(i)||0));
  demoReel.ended = false;
  demoReel.paused = false;
  document.body.classList.remove("demo-ended");
  demoReel.started = Date.now() - demoCueAt(i);
  if(demoReelTimer){ clearTimeout(demoReelTimer); demoReelTimer = null; }
  playDemoScene(i);
}
function jumpDemoById(id){
  const i = demoSceneIndex(id);
  if(i<0){ tryDemoYourself(); return; }
  jumpDemoScene(i);
}
function demoGo(dir){
  if(!demoReel) return;
  if(demoReel.ended && dir>0) return;
  const next = demoReel.ended ? DEMO_SCENES.length-1 : demoReel.i + dir;
  if(next < 0) return;
  if(next >= DEMO_SCENES.length){ endDemoReel(); return; }
  jumpDemoScene(next);
}
function pauseDemoReel(){
  if(!demoReel || demoReel.ended) return;
  demoReel.paused = !demoReel.paused;
  if(demoReel.paused){
    demoReel.frozenElapsed = Date.now() - demoReel.started;
    if(demoReelTimer){ clearTimeout(demoReelTimer); demoReelTimer = null; }
    try{ window.speechSynthesis?.cancel(); }catch(e){}
  } else {
    demoReel.started = Date.now() - (demoReel.frozenElapsed||0);
    const scene = DEMO_SCENES[demoReel.i];
    const remain = Math.max(900, demoReel.started + demoCueAt(demoReel.i) + scene.ms - Date.now());
    if(!tourMuted) speakTour(demoLine(scene), null, remain);
    tickDemo();
  }
  paintDemoReel(true);
}
function toggleDemoMute(){
  tourMuted = !tourMuted;
  if(tourMuted){
    try{ window.speechSynthesis?.cancel(); }catch(e){}
  } else if(demoReel && !demoReel.ended && !demoReel.paused){
    const scene = DEMO_SCENES[demoReel.i];
    const remain = Math.max(900, demoReel.started + demoCueAt(demoReel.i) + scene.ms - Date.now());
    speakTour(demoLine(scene), null, remain);
  }
  paintDemoReel(true);
}
function armDemoVoiceUnlock(){
  const once = () => {
    document.removeEventListener("pointerdown", once, true);
    if(!demoReel || demoReel.ended || tourMuted || demoReel.paused || window.speechSynthesis?.speaking || window.speechSynthesis?.pending) return;
    const scene = DEMO_SCENES[demoReel.i];
    const remain = Math.max(900, demoReel.started + demoCueAt(demoReel.i) + scene.ms - Date.now());
    speakTour(demoLine(scene), null, remain);
  };
  document.addEventListener("pointerdown", once, true);
}
function endDemoReel(){
  if(!demoReel) return;
  demoReel.ended = true;
  demoReel.paused = false;
  demoReel.i = DEMO_SCENES.length-1;
  document.body.classList.add("demo-ended","demo-cinema");
  if(demoReelTimer){ clearTimeout(demoReelTimer); demoReelTimer = null; }
  hideDemoPointer();
  try{ window.speechSynthesis?.cancel(); }catch(e){}
  paintDemoReel(true);
  if(!tourMuted) speakTour("That's the product tour. Explore the platform, or replay from the start.");
}
function tryDemoYourself(){
  closeDemoReel();
  tour = null;
  document.body.classList.remove("tour-lock");
  document.getElementById("tourOverlay")?.classList.remove("open");
  startCreateAssessment();
  toast("Create Assessment — upload a JD, AI creates questions, then publish. No payment.");
}
function replayProductTour(){
  closeDemoReel();
  beginProductTour();
}
function startTour(opts){
  opts = opts || {};
  if(tour) return;
  if(!state.session){ showView("login"); toast("Sign in or start free, then take the tour."); return; }
  if(!opts.skipIntro){ beginProductTour(); return; }
  closeTourIntro();
  tour = {i:0, auto:true, paused:false, waitFor:null};
  wizard = null;
  clearCheckoutTimer();
  checkout = null;
  appDetail = null;
  showView("workspace");
  applyTourStep();
}
function clearTourAdvance(){
  if(tourAdvanceTimer){ clearTimeout(tourAdvanceTimer); tourAdvanceTimer = null; }
}
function tourStepMs(text){
  const words = String(text||"").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(5000, Math.min(16000, words * 430 + 1400));
}
function scheduleTourAdvance(ms){
  clearTourAdvance();
  tourAdvanceTimer = setTimeout(()=>{
    tourAdvanceTimer = null;
    if(!tour) return;
    tourAutoNext();
  }, ms);
}
function tourAutoNext(){
  if(!tour || tour.paused) return;
  if(tour.waitFor) return;
  const steps = activeTourSteps();
  if(tour.i==="done"){ finishTour(); return; }
  if(typeof tour.i==="number" && tour.i >= steps.length-1){
    tour.i = "done";
    tour.waitFor = null;
    drawTourCard();
    speakCurrentTour();
    return;
  }
  tour.i += 1;
  applyTourStep();
}
function tourGoBack(){
  if(!tour) return;
  clearTourAdvance();
  stopTourVoice();
  tour.i = tour.i==="done" ? activeTourSteps().length-1 : Math.max(0, tour.i-1);
  applyTourStep();
}
function tourJumpProctor(){
  if(!tour) return;
  const steps = activeTourSteps();
  const i = steps.findIndex(s => s.section==="meritedge" && s.wizStep===4);
  if(i<0){ toast("Publish is next after the JD is created."); return; }
  tour.i = i;
  applyTourStep();
}
function tourJumpAi(){
  if(!tour) return;
  const steps = activeTourSteps();
  const i = steps.findIndex(s => s.section==="ai-interviewer");
  if(i<0){ toast("AI Interviewer is next in this tour."); return; }
  tour.i = i;
  applyTourStep();
}
function pauseTour(){
  if(!tour) return;
  tour.paused = !tour.paused;
  if(tour.paused){ clearTourAdvance(); stopTourVoice(); }
  else if(!tour.waitFor) speakCurrentTour();
  drawTourCard();
}
function tourDidAction(){
  if(!tour || !tour.waitFor) return;
  tour.waitFor = null;
  scheduleTourAdvance(700);
}
function finishTour(opts){
  opts = opts || {};
  stopTourVoice();
  clearTourAdvance();
  tour = null;
  document.body.classList.remove("tour-lock");
  document.getElementById("tourOverlay")?.classList.remove("open");
  const card = document.getElementById("tourCard");
  if(card) card.innerHTML = "";
  document.querySelectorAll(".tour-hl").forEach(el=>el.classList.remove("tour-hl"));
  appSection = "meritedge";
  appDetail = null;
  wizard = null;
  if(opts.openCreate){
    if(opts.kind==="interview") startCreateInterview();
    else startCreateAssessment();
    toast("Create Assessment — upload a JD, AI creates questions, then publish. No payment.");
    return;
  }
  renderWorkspace();
  if(!opts.skipWow && isPreviewUser(currentUser())) toast("Try creating from a JD. Register when you invite yourself to unlock the rest.");
}
function finishTourAndTry(){
  finishTour({openCreate:true, kind: wantsInterview() && !wantsAssess() ? "interview" : "assessment"});
}
function stopTourVoice(){
  tourSpeakGen += 1;
  if(tourVoiceTimer){ clearTimeout(tourVoiceTimer); tourVoiceTimer = null; }
  try{ window.speechSynthesis?.cancel(); }catch(e){}
  document.getElementById("tourVoiceState")?.classList.remove("on");
}
function scoreTourVoice(v){
  const name = (v.name||"").toLowerCase();
  const lang = (v.lang||"").toLowerCase();
  if(!/en/.test(lang)) return -100;
  let s = /en-us/.test(lang) ? 10 : /en-gb|en-uk/.test(lang) ? 8 : 4;
  if(/online \(natural\)|natural|neural|premium|enhanced|wavenet|studio/.test(name)) s += 40;
  if(/\baria\b/.test(name)) s += 32;
  else if(/\bjenny\b/.test(name)) s += 28;
  else if(/\bsonia\b/.test(name)) s += 24;
  else if(/\bsamantha\b/.test(name)) s += 22;
  else if(/google uk english female/.test(name)) s += 20;
  else if(/google us english/.test(name)) s += 16;
  else if(/\bkaren\b/.test(name)) s += 16;
  else if(/\bmoira\b/.test(name)) s += 14;
  else if(/\bguy\b/.test(name)) s += 14;
  else if(/\bandrew\b/.test(name)) s += 12;
  else if(/\bzira\b/.test(name)) s += 6;
  if(/desktop/.test(name) && !/natural|online/.test(name)) s -= 10;
  if(/\b(david|mark|hazel|susan|compact|espeak)\b/.test(name) && !/natural/.test(name)) s -= 16;
  return s;
}
function pickTourVoice(){
  const voices = window.speechSynthesis?.getVoices?.() || [];
  if(!voices.length) return null;
  return voices.slice().sort((a,b)=>scoreTourVoice(b)-scoreTourVoice(a))[0] || null;
}
function setIntroSpeakHint(speaking){
  const hint = document.getElementById("tiSpeakHint");
  if(!hint) return;
  if(speaking){
    hint.classList.add("speak");
    hint.innerHTML = `<span class="ti-speak" aria-hidden="true"><i></i><i></i><i></i></span> Speaking`;
  }else{
    hint.classList.remove("speak");
    hint.textContent = "Starting in a moment";
  }
}
function speakTourIntro(){
  if(tourMuted || !window.speechSynthesis) return;
  const gen = tourIntroGen;
  const line = "Welcome to TalentEdge. The future of assessments and AI interviewing.";
  const start = () => {
    if(gen !== tourIntroGen || tourMuted) return;
    try{ window.speechSynthesis.cancel(); }catch(e){}
    if(gen !== tourIntroGen || tourMuted) return;
    const u = new SpeechSynthesisUtterance(line);
    u.rate = 0.9;
    u.pitch = 1;
    u.volume = 1;
    const v = pickTourVoice();
    if(v){ u.voice = v; u.lang = v.lang || "en-US"; }
    else u.lang = "en-US";
    u.onstart = () => {
      if(gen !== tourIntroGen) return;
      introVoiceStarted = true;
      setIntroSpeakHint(true);
    };
    u.onend = () => {
      if(gen !== tourIntroGen) return;
      setIntroSpeakHint(false);
    };
    try{ window.speechSynthesis.speak(u); }catch(e){}
  };
  const voices = window.speechSynthesis.getVoices() || [];
  if(voices.length){ start(); return; }
  start();
}
function armIntroVoiceUnlock(){
  if(introVoiceUnlock){
    document.removeEventListener("pointerdown", introVoiceUnlock, true);
    document.removeEventListener("keydown", introVoiceUnlock, true);
  }
  introVoiceUnlock = () => {
    if(introVoiceStarted) return;
    if(window.speechSynthesis?.speaking || window.speechSynthesis?.pending) return;
    if(!document.getElementById("tourIntro")?.classList.contains("open")) return;
    speakTourIntro();
  };
  document.addEventListener("pointerdown", introVoiceUnlock, true);
  document.addEventListener("keydown", introVoiceUnlock, true);
}
function speakTour(text, onDone, durationMs){
  const gen = ++tourSpeakGen;
  if(tourVoiceTimer){ clearTimeout(tourVoiceTimer); tourVoiceTimer = null; }
  try{ window.speechSynthesis?.cancel(); }catch(e){}
  document.getElementById("tourVoiceState")?.classList.remove("on");
  if(tour && !tour.waitFor && !tour.paused && tour.i!=="done") scheduleTourAdvance(tourStepMs(text) + 1600);
  const finish = () => {
    if(gen !== tourSpeakGen) return;
    document.getElementById("tourVoiceState")?.classList.remove("on");
    if(typeof onDone === "function"){
      const cb = onDone;
      onDone = null;
      cb();
    }
    if(!tour) return;
    scheduleTourAdvance(900);
  };
  if(tourMuted || !text || !window.speechSynthesis){
    if(typeof onDone === "function"){ const cb = onDone; onDone = null; setTimeout(cb, 0); }
    return;
  }
  const utter = new SpeechSynthesisUtterance(String(text).trim());
  utter.rate = durationMs ? speechRateFor(text, durationMs) : 0.96;
  utter.pitch = 1;
  utter.lang = "en-US";
  const voice = pickTourVoice();
  if(voice){ utter.voice = voice; utter.lang = voice.lang || "en-US"; }
  utter.onstart = () => {
    if(gen !== tourSpeakGen) return;
    document.getElementById("tourVoiceState")?.classList.add("on");
  };
  utter.onend = finish;
  utter.onerror = finish;
  if(gen !== tourSpeakGen) return;
  try{ window.speechSynthesis.speak(utter); }catch(e){ finish(); }
}
function currentTourVoiceText(){
  if(!tour) return "";
  if(tour.i==="done") return tourDoneVoice();
  const s = activeTourSteps()[tour.i];
  return s ? (s.voice || `${s.title}. ${s.copy}`) : "";
}
function speakCurrentTour(){ speakTour(currentTourVoiceText()); }
function toggleTourMute(){
  if(!tour) return;
  tourMuted = !tourMuted;
  if(tourMuted){
    stopTourVoice();
    scheduleTourAdvance(Math.max(2800, Math.round(tourStepMs(currentTourVoiceText())*0.55)));
  }
  drawTourCard();
  if(!tourMuted) speakCurrentTour();
}
function stopTour(){
  finishTour();
}
function applyTourStep(){
  const s = activeTourSteps()[tour.i];
  if(!s){ finishTour(); return; }
  aiCreateGen += 1;
  if(aiCreateTimer){ clearTimeout(aiCreateTimer); aiCreateTimer = null; }
  tour.waitFor = s.waitFor || null;
  appSection = s.section;
  appDetail = null;
  wizard = null;
  if(s.listView) listViewMode = s.listView;
  if(s.settingsTab) settingsTab = s.settingsTab;
  if(s.creating && (s.wizard==="interview" || s.section==="ai-interviewer")){
    wizard = {kind:"interview", step:0, publishedId:null, data:tourInterviewData(true)};
    wizard.data.ivSource = "jd";
    wizard.data.aiPhase = "creating";
    wizard.data.aiCreateAt = 0;
    wizard.data.aiPct = 12;
    appDetail = {type:"wizard"};
  } else if(s.creating){
    wizard = {kind:"assessment", step:0, publishedId:null, data:tourAssessData(true)};
    wizard.data.build = "ai";
    wizard.data.aiPhase = "creating";
    wizard.data.aiCreateAt = 0;
    wizard.data.aiPct = 12;
    appDetail = {type:"wizard"};
  } else if(s.generator && (s.wizard==="interview" || s.section==="ai-interviewer")){
    wizard = {kind:"interview", step:0, publishedId:null, data:tourInterviewData(!!s.jdShow)};
    wizard.data.ivSource = "jd";
    appDetail = {type:"wizard"};
  } else if(s.generator){
    const d = tourAssessData(!!s.jdShow);
    d.build = "ai";
    d.aiPhase = "generator";
    d.aiTab = "jd";
    wizard = {kind:"assessment", step:0, publishedId:null, data:d};
    appDetail = {type:"wizard"};
  } else if(s.wizard==="assessment"){
    wizard = {kind:"assessment", step:s.wizStep, publishedId:null, data:tourAssessData(!!s.jdShow)};
    appDetail = {type:"wizard"};
  } else if(s.wizard==="interview"){
    wizard = {kind:"interview", step:s.wizStep, publishedId:null, data:tourInterviewData(!!s.jdShow)};
    appDetail = {type:"wizard"};
  } else if(s.open==="assessment"){
    appDetail = {type:"assessment", id: assessments[0]?.id || "a1"};
  } else if(s.open==="interview"){
    appDetail = {type:"interview", id: interviews[0]?.id || "i1"};
  }
  renderWorkspace();
  if(s.creating) startDemoCreatingTick(10000);
  drawTourCard();
  speakCurrentTour();
  requestAnimationFrame(()=>{
    document.querySelectorAll("[data-tour]").forEach(el=>el.classList.toggle("tour-hl", el.dataset.tour===s.spot));
  });
}
function drawTourCard(){
  const el = document.getElementById("tourCard");
  const overlay = document.getElementById("tourOverlay");
  overlay.classList.add("open");
  document.body.classList.add("tour-lock");
  const muteLabel = tourMuted ? "Unmute voice" : "Mute voice";
  const muteBtn = `<button class="tour-ico" type="button" title="${muteLabel}" onclick="toggleTourMute()">${tourMuted?"🔇":"🔊"}</button>`;
  const voiceRow = `<div class="tour-voice ${tourMuted||tour.paused?"":"on"}" id="tourVoiceState"><i><b></b><b></b><b></b></i><span>${tour.paused?"Paused":tourMuted?"Voice off":"Speaking with text"}</span>
    ${muteBtn}
  </div>`;
  const steps = activeTourSteps();
  if(tour.i==="done"){
    el.innerHTML = `<div class="tour-meta">Tour complete</div>
      ${voiceRow}
      <h3>Now try it yourself in TalentEdge</h3>
      <p>Create Assessment: upload a JD, AI creates questions, then publish. No payment. Register when you invite yourself to unlock the rest.</p>
      <div class="te-actions">
        <button class="te-btn" type="button" onclick="finishTourAndTry()">Create Assessment</button>
        <button class="te-btn ghost" type="button" onclick="finishTour({skipWow:true});appNav('ai-interviewer')">Open AI Interviewer</button>
      </div>`;
    return;
  }
  const s = steps[tour.i];
  el.innerHTML = `<div class="tour-meta">${tour.paused?"Paused":"Playing"} · ${tour.i+1} / ${steps.length}</div>
    ${voiceRow}
    ${s.doHint?`<div class="tour-do">${s.doHint}</div>`:""}
    <h3>${s.title}</h3>
    <p>${s.copy}</p>
    <p class="te-note" style="margin:0 0 12px">${s.waitFor?"Click the highlighted control to continue.":"Auto-playing MeritEdge and AI Interviewer, step by step. Pause, skip, or jump to proctoring."}</p>
    <div class="te-actions" style="flex-wrap:wrap">
      <button class="te-btn ghost" type="button" onclick="tourGoBack()" ${tour.i===0?"disabled":""}>← Back</button>
      <button class="te-btn ghost" type="button" onclick="pauseTour()">${tour.paused?"Resume":"Pause"}</button>
      <button class="te-btn ghost" type="button" onclick="tourJumpProctor()">Show me proctoring</button>
      <button class="te-btn ghost" type="button" onclick="tourJumpAi()">Show me AI Interviewer</button>
      <button class="te-btn" type="button" onclick="tour.waitFor=null;tourAutoNext()">Next →</button>
    </div>
    <div class="te-actions" style="margin-top:8px">
      <button class="te-btn ghost" type="button" onclick="finishTour({openCreate:true})">Try it yourself</button>
    </div>`;
}

function currentUser(){ return ensureAccountEntitlements(findUser(state.session)); }
function hydrateAccountReports(){
  const u = currentUser();
  if(!u?.reports?.length) return;
  u.reports.forEach(saved=>{
    const item = inviteItem(saved.kind, saved.itemId);
    if(!item) return;
    item.candidates = item.candidates || [];
    let cand = item.candidates.find(c=>c.id===saved.candidateId || (saved.candidateEmail && c.email===saved.candidateEmail));
    if(!cand){
      cand = {id:saved.candidateId, name:saved.candidateName||"Candidate", email:saved.candidateEmail||u.email, selfInvite:true};
      item.candidates.push(cand);
      item.invited = Math.max(item.invited||0, item.candidates.length);
    }
    const wasCompleted = cand.status === "Completed";
    Object.assign(cand, {name:saved.candidateName||cand.name, email:saved.candidateEmail||cand.email, score:saved.score, status:"Completed", report:saved.data});
    if(!wasCompleted) item.completed = (item.completed||0) + 1;
  });
}
function openAccountReport(reportId){
  const u = currentUser();
  const saved = u?.reports?.find(r=>r.id===reportId);
  if(!saved) return;
  hydrateAccountReports();
  openCandidateReport(saved.kind, saved.itemId, saved.candidateId);
}
function accountReportsHtml(u, compact=false){
  if(!u || isPreviewUser(u)) return "";
  const balance = freeInviteBalance(u);
  const reports = u?.reports || [];
  const reportRows = reports.length
    ? reports.slice(0,5).map(r=>`<div class="te-account-report-row"><span class="te-account-report-icon">${r.kind==="interview"?"AI":"M"}</span><span><b>${escapeHtml(r.title)}</b><small>${escapeHtml(r.candidateName||"Candidate")} · ${escapeHtml(r.completedAt||"Completed")}</small></span><strong>${escapeHtml(String(r.score==null?"—":r.score))}${typeof r.score==="number"?"%":""}</strong><button class="te-btn ghost" type="button" onclick="openAccountReport('${escapeHtml(r.id)}')">View report</button></div>`).join("")
    : `<p class="te-note" style="margin:0">Complete an invite and the report will be saved here automatically.</p>`;
  if(compact) return `<section class="te-account-card focused-account-card"><div class="te-account-card-head"><div><label>Saved reports</label><h2>${reports.length ? `${reports.length} report${reports.length===1?"":"s"} from your free invites` : "No saved reports yet"}</h2></div><button class="te-btn ghost" type="button" onclick="openUpgradePlans()">Upgrade to paid plan</button></div><div class="te-account-reports">${reportRows}</div></section>`;
  return `<section class="te-account-card"><div class="te-account-card-head"><div><label>Your free workspace</label><h2>${balance.left} free invite${balance.left===1?"":"s"} remaining</h2><p>Every completed invite creates a report saved to ${escapeHtml(u?.email||"your account")}.</p></div><button class="te-btn ghost" type="button" onclick="openUpgradePlans()">Upgrade to paid plan</button></div><div class="te-account-stats"><span><b>${balance.left}</b> invites left</span><span><b>${reports.length}</b> reports saved</span><span><b>5</b> free invites included</span></div><div class="te-account-reports">${reportRows}</div><p class="te-note" style="margin:12px 0 0">Upgrade to unlock the full platform experience, including unlimited workspace access and advanced insights.</p></section>`;
}
function accountAssessmentsPageHtml(u){
  const reports = u?.reports || [];
  const reportIds = new Set(reports.map(r=>r.itemId));
  const created = assessments.filter(a=>a.userBuilt || a.createdBy===u?.name || reportIds.has(a.id));
  const items = created.length ? created : assessments.slice(0,6);
  const balance = freeInviteBalance(u);
  const rows = items.map(a=>{
    const report = reports.find(r=>r.itemId===a.id);
    const questionCount = a.qcount || a.questions?.length || 5;
    return `<article class="account-assessment-row">
      <div class="account-assessment-icon">${escapeHtml(initials(a.title||"A"))}</div>
      <div class="account-assessment-copy">
        <div class="account-assessment-title"><h3>${escapeHtml(a.title)}</h3><span>${escapeHtml(a.status||"Published")}</span></div>
        <p>${escapeHtml(a.role||"Role-based assessment")} · ${questionCount} questions · ${escapeHtml(a.duration||"45 min")}</p>
        <small>Created ${escapeHtml(a.created||"Recently")}</small>
      </div>
      <div class="account-assessment-actions">
        <button class="te-btn ghost" type="button" onclick="startInvite('assessment','${escapeHtml(a.id)}')">Invite</button>
        ${report ? `<button class="te-btn account-report-button" type="button" onclick="openAccountReport('${escapeHtml(report.id)}')">View report</button>` : `<span class="account-report-pending">No report yet</span>`}
      </div>
    </article>`;
  }).join("");
  return `<div class="account-focus-page">
    <header class="account-focus-header">
      <div><span class="account-focus-kicker">MERITEDGE</span><h1>Your assessments</h1><p>Manage created assessments, invite candidates, and open saved reports.</p></div>
      <div class="account-focus-header-actions"><span class="account-focus-user">Logged in as ${escapeHtml(u?.email||u?.name||"your account")}</span><button class="te-btn ghost" type="button" onclick="openUpgradePlans()">Upgrade plan</button><button class="te-btn ghost" type="button" onclick="signOut()">Log out</button></div>
    </header>
    <section class="account-focus-summary"><div><span>Free invite credits</span><strong>${balance.left}</strong><small>remaining</small></div><div><span>Saved reports</span><strong>${reports.length}</strong><small>candidate reports</small></div><div class="account-focus-summary-copy"><b>Keep exploring your hiring workflow</b><small>Invite candidates with your free credits and view each completed report here.</small></div></section>
    <section class="account-focus-list"><div class="account-focus-section-head"><div><span class="account-focus-kicker">CREATED ASSESSMENTS</span><h2>Ready to invite candidates</h2></div><button class="te-btn" type="button" onclick="startCreateAssessment({focused:true})">Create assessment</button></div><div class="account-assessment-list">${rows || `<div class="account-focus-empty">No assessments created yet.</div>`}</div></section>
  </div>`;
}
function appNav(section){
  if(tour) return;
  openKebab = null;
  hideAppClickPointer();
  if(section==="home") section = "meritedge";
  aiCreateGen += 1;
  if(aiCreateTimer){ clearTimeout(aiCreateTimer); aiCreateTimer = null; }
  if(autoGenerateTimer){ clearTimeout(autoGenerateTimer); autoGenerateTimer = null; }
  if(publishInviteTimer){ clearTimeout(publishInviteTimer); publishInviteTimer = null; }
  if(publishInviteCountdownTimer){ clearInterval(publishInviteCountdownTimer); publishInviteCountdownTimer = null; }
  publishInviteSeconds = 0;
  appSection = section;
  appDetail = null;
  wizard = null;
  if(section!=="billing" && section!=="plans"){
    clearCheckoutTimer();
    checkout = null;
  }
  renderWorkspace();
}
function openAssessment(id){ if(tour && tour.waitFor!=="list") return; if(tour && tour.waitFor==="list") tourDidAction(); wizard=null; appSection="meritedge"; appDetail={type:"assessment", id}; renderWorkspace(); }
function openInterview(id){ if(tour && !tour.paused) return; wizard=null; appSection="ai-interviewer"; appDetail={type:"interview", id}; renderWorkspace(); }
function later(label){ toast(label + ". Nothing is saved."); }
function todayLabel(){
  return new Date().toLocaleDateString("en-GB", {day:"numeric", month:"short", year:"numeric"});
}
function normalizeRoleQuestions(questions, role){
  const r = role || "this role";
  const existing = Array.isArray(questions) ? questions.map(q=>({...q})) : [];
  const fallbacks = [
    {type:"MCQ", title:`Which skill is most critical for a ${r}?`},
    {type:"MCQ", title:`How would you prioritize work when two ${r} deadlines collide?`},
    {type:"Written", title:`Walk through a recent problem you solved as a ${r}.`},
    {type:"MCQ", title:`What signal tells you the work is on track for a ${r}?`},
    {type:"Written", title:`Describe a tradeoff you would make as a ${r}.`}
  ];
  return existing.concat(fallbacks.slice(existing.length)).slice(0, 5);
}
const SAMPLE_JDS = (__D.sampleJds || []).map(j=>({...j, questions:normalizeRoleQuestions(j.questions, j.role)}));
let jdParseTimer = null;
function jdById(id){ return SAMPLE_JDS.find(j=>j.id===id); }
function jdByRole(role){
  const r = String(role||"").toLowerCase();
  return SAMPLE_JDS.find(j => r.includes(j.role.toLowerCase()))
    || SAMPLE_JDS.find(j => r.includes(j.match))
    || SAMPLE_JDS[0];
}
function applyJdToData(d, jd, fileName, asInterview){
  if(!d || !jd) return;
  const interview = asInterview === true || (asInterview !== false && wizard && wizard.kind==="interview");
  d.method = "jd";
  d.ivSource = "jd";
  d.jdId = jd.id;
  d.jdFile = fileName || jd.file;
  d.role = jd.role;
  d.name = interview ? `${jd.role} · AI Interview` : `${jd.role} assessment`;
  d.duration = interview ? jd.ivDuration : jd.duration;
  d.description = `Generated from ${d.jdFile}. ${jd.excerpt}`;
  d.jdText = `${jd.role}\n\n${jd.excerpt}\n\nSkills: ${jd.skills.join(", ")}\nDuration: ${interview ? jd.ivDuration : jd.duration} minutes.`;
  d.skills = jd.skills.join(", ");
  d.questions = jd.questions.map(q=>({...q}));
  d.topics = jd.topics.map(t=>({...t}));
  d.jdParsing = false;
}
function jdCardHtml(j, selectedId){
  return `<button type="button" class="jd-card ${selectedId===j.id?"on":""}" data-tour="jd" onclick="selectSampleJd('${j.id}',null,true)">
    <span class="kind">${j.kind==="tech"?"Tech":"Non-tech"}</span>
    <b>${escapeHtml(j.role)}</b>
    <small>${escapeHtml(j.file)} · ${j.questions.length} questions · ${j.topics.length} interview topics</small>
  </button>`;
}
function jdPickerHtml(selectedId, parsing){
  const tech = SAMPLE_JDS.filter(j=>j.kind==="tech");
  const nontech = SAMPLE_JDS.filter(j=>j.kind!=="tech");
  const jd = jdById(selectedId);
  return `<div class="jd-drop">
      <p>Drop a JD or pick a default. AI creates it, then you publish.</p>
      <button class="te-btn ghost" type="button" onclick="document.getElementById('jdFileInput').click()">Upload JD</button>
      <input id="jdFileInput" type="file" accept=".pdf,.doc,.docx,.txt" style="display:none" onchange="onJdFile(event)">
      <small>PDF, DOC, DOCX, TXT · preview only, the file is not stored</small>
    </div>
    <div class="jd-group" data-tour="jd">
      <h4>Tech · ${tech.length} defaults</h4>
      <div class="jd-grid five">${tech.map(j=>jdCardHtml(j, selectedId)).join("")}</div>
    </div>
    <div class="jd-group">
      <h4>Non-tech · ${nontech.length} defaults</h4>
      <div class="jd-grid five">${nontech.map(j=>jdCardHtml(j, selectedId)).join("")}</div>
    </div>
    ${parsing?`<div class="jd-parse"><em></em> AI is reading the job description…</div>`:""}
    ${jd&&!parsing?`<div class="jd-file"><span>Attached · ${escapeHtml(wizard.data.jdFile||jd.file)}</span><button class="te-btn ghost" type="button" onclick="clearJd()">Remove</button></div>
      <div class="jd-skills">${jd.skills.map(s=>`<i>${escapeHtml(s)}</i>`).join("")}</div>
      <p class="te-note" style="margin:0">${escapeHtml(jd.excerpt)}</p>`:""}`;
}
function selectSampleJd(id, fileName, autoGen){
  if(!wizard) return;
  const jd = jdById(id);
  if(!jd) return;
  if(tour && tour.waitFor==="jd") tourDidAction();
  wizard.data.method = "jd";
  wizard.data.ivSource = "jd";
  wizard.data.jdId = id;
  wizard.data.jdFile = fileName || jd.file;
  wizard.data.jdParsing = true;
  renderWorkspace();
  if(jdParseTimer) clearTimeout(jdParseTimer);
  jdParseTimer = setTimeout(()=>{
    if(!wizard) return;
    applyJdToData(wizard.data, jd, fileName, wizard.kind==="interview");
    const go = autoGen && !tour && !demoReel && !fullProduct();
    if(go){
      if(wizard.kind==="interview") generateAiInterview();
      else generateAiAssessment();
    } else {
      renderWorkspace();
      toast("Questions prefilled from the job description.");
    }
  }, 1100);
}
function onJdFile(ev){
  const f = ev.target.files && ev.target.files[0];
  if(!f || !wizard) return;
  const name = f.name.toLowerCase();
  const hit = SAMPLE_JDS.find(j => name.includes(j.match) || name.includes(j.id)) || jdByRole(intentRole());
  selectSampleJd(hit.id, f.name, !fullProduct() && wizard.kind==="interview");
}
function clearJd(){
  if(!wizard) return;
  wizard.data.jdId = "";
  wizard.data.jdFile = "";
  wizard.data.jdParsing = false;
  wizard.data.questions = sampleQuestions(wizard.data.role||"this role");
  wizard.data.topics = sampleTopics(wizard.data.role||"this role");
  renderWorkspace();
}
function sampleQuestions(role){
  const r = role || "this role";
  return [
    {type:"MCQ", title:`Which skill is most critical for a ${r}?`},
    {type:"MCQ", title:`How would you prioritize work when two ${r} deadlines collide?`},
    {type:"Written", title:`Walk through a recent problem you solved as a ${r}.`},
    {type:"MCQ", title:`What signal tells you the work is on track for a ${r}?`},
    {type:"Written", title:`Describe a tradeoff you would make as a ${r}.`}
  ];
}
function sampleTopics(role){
  return [
    {title:"Role depth", mins:8, prompt:`What does strong performance look like for a ${role||"candidate"}?`},
    {title:"Collaboration", mins:7, prompt:"Tell me about a disagreement you worked through with a teammate."},
    {title:"Judgment", mins:10, prompt:"Walk through a tradeoff you made when time or information was limited."}
  ];
}
function startCreateAssessment(opts){
  opts = opts || {};
  if(tour){
    if(tour.waitFor==="create") tourDidAction();
    return;
  }
  const role = intentRole();
  const full = fullProduct();
  const focused = !!opts.focused && !full;
  wizard = {
    kind:"assessment",
    step:0,
    publishedId:null,
    data:{
      build: full ? "" : "ai",
      aiPhase: full ? "choose" : focused ? "focused" : "generator",
      aiTab:"jd",
      aiCreateAt:0,
      aiPct:0,
      method:"jd",
      ivSource:"",
      jdId:"",
      jdFile:"",
      jdText:"",
      jdParsing:false,
      name:`${role} assessment`,
      role:role,
      duration:"45",
      pass:"70",
      description:"",
      skills:"",
      questions:sampleQuestions(role),
      topics:sampleTopics(role),
      webcam:true,
      tabswitch:true,
      fullscreen:false,
      copypaste:true,
      facedetect:false,
      audio:false,
      shuffle:true,
      shuffleOpts:true,
      reminders:true,
      experience:"Senior",
      windowDays:"30d",
      cutoff:70
    }
  };
  if(!full){
    applyJdToData(wizard.data, jdByRole(role), null, false);
    wizard.data.build = "ai";
    wizard.data.aiPhase = focused ? "focused" : "generator";
    wizard.data.aiTab = "jd";
    wizard.data.focusedCreate = focused;
    wizard.data.focusedFilter = "all";
    wizard.data.focusedPanel = "";
    if(focused){
      wizard.data.focusedDomain = "";
      wizard.data.focusedRoleId = "";
      wizard.data.jdId = "";
      wizard.data.jdFile = "";
      wizard.data.jdText = "";
      wizard.data.focusedCustomText = "";
    }
  }
  appSection = "meritedge";
  appDetail = {type:"wizard"};
  renderWorkspace();
  if(!full && !focused) scheduleAutoAssessmentGeneration();
  if(focused) requestAnimationFrame(()=>showAppClickPointer(".focused-primary", "Create assessment"));
}
function startCreateInterview(assessmentId){
  if(tour){
    if(tour.waitFor==="create") tourDidAction();
    return;
  }
  const linked = assessmentId ? assessments.find(a=>a.id===assessmentId) : null;
  const full = fullProduct();
  wizard = {
    kind:"interview",
    step:0,
    publishedId:null,
    data:{
      assessmentId: linked ? linked.id : "",
      ivSource: full ? (linked ? "skills" : "jd") : "jd",
      jdId:"",
      jdFile:"",
      jdText:"",
      jdParsing:false,
      role: linked ? linked.role || linked.title : intentRole(),
      name: linked ? `${linked.title} · AI Interview` : `${intentRole()} · AI Interview`,
      duration:"20",
      language:"English",
      accent:"Neutral",
      ivType:"Voice",
      persona:"professional",
      interviewer:"Alex",
      voice:2,
      photo:0,
      expLevel:"Junior",
      expFrom:0,
      expTo:5,
      skills:"Role depth, Collaboration, Judgment",
      followups:true,
      star:true,
      encourage:true,
      allowQ:true,
      webcam:true,
      tabswitch:true,
      screenRec:false,
      headset:false,
      codingRound:false,
      snr:15,
      dims:{tech:25, comm:25, solve:20, conf:15, rel:15},
      questions: sampleQuestions(linked ? linked.role || linked.title : intentRole()),
      topics: sampleTopics(linked ? linked.role || linked.title : "this role")
    }
  };
  if(!full){
    applyJdToData(wizard.data, jdByRole(intentRole()), null, true);
    wizard.data.ivSource = "jd";
  }
  appSection = "ai-interviewer";
  appDetail = {type:"wizard"};
  renderWorkspace();
  if(!full) scheduleAutoInterviewGeneration();
}
function startInvite(kind, id){
  pendingInvite = {kind, id};
  if(document.getElementById("trialJourneyOverlay")?.classList.contains("open")) return;
  const u = currentUser();
  if(isPreviewUser(u)){
    openInviteRegister();
    return;
  }
  wizard = null;
  appSection = kind==="interview" ? "ai-interviewer" : "meritedge";
  appDetail = {type:"invite", kind, id, emails: u?.email || ""};
  renderWorkspace();
  requestAnimationFrame(()=>showAppClickPointer(".te-wiz-foot .te-btn:not(.ghost)", "Invite yourself"));
}
function wizVal(id){ return document.getElementById(id)?.value ?? ""; }
function captureWizard(){
  if(!wizard || wizard.step==="done") return;
  const d = wizard.data;
  if(document.getElementById("wName")) d.name = wizVal("wName").trim();
  if(document.getElementById("wRole")) d.role = wizVal("wRole").trim();
  if(document.getElementById("wDuration")) d.duration = wizVal("wDuration");
  if(document.getElementById("wPass")) d.pass = wizVal("wPass");
  if(document.getElementById("wDesc")) d.description = wizVal("wDesc");
  if(document.getElementById("wSkills")) d.skills = wizVal("wSkills");
  if(document.getElementById("wJdRole")) d.role = wizVal("wJdRole").trim() || d.role;
  if(document.getElementById("wWebcam")) d.webcam = document.getElementById("wWebcam").checked;
  if(document.getElementById("wTab")) d.tabswitch = document.getElementById("wTab").checked;
  if(document.getElementById("wFull")) d.fullscreen = document.getElementById("wFull").checked;
  if(document.getElementById("wCopy")) d.copypaste = document.getElementById("wCopy").checked;
  if(document.getElementById("wFace")) d.facedetect = document.getElementById("wFace").checked;
  if(document.getElementById("wAudio")) d.audio = document.getElementById("wAudio").checked;
  if(document.getElementById("wShuffle")) d.shuffle = document.getElementById("wShuffle").checked;
  if(document.getElementById("wCutoff")) d.cutoff = wizVal("wCutoff");
  if(document.getElementById("wIvName")) d.name = wizVal("wIvName").trim();
  if(document.getElementById("wIvRole")) d.role = wizVal("wIvRole").trim();
  if(document.getElementById("wIvDuration")) d.duration = wizVal("wIvDuration");
  if(document.getElementById("wIvLang")) d.language = wizVal("wIvLang");
  if(document.getElementById("wIvSkills")) d.skills = wizVal("wIvSkills");
  if(document.getElementById("wJdText")) d.jdText = wizVal("wJdText");
  if(document.getElementById("wAiJd")) d.jdText = wizVal("wAiJd");
  if(document.getElementById("wIvInterviewer")) d.interviewer = wizVal("wIvInterviewer");
  if(document.getElementById("wTopicTitle")) { d.topics = d.topics||[{}]; d.topics[0] = Object.assign({}, d.topics[0], {title: wizVal("wTopicTitle"), prompt: wizVal("wTopicPrompt")||d.topics[0].prompt}); }
  if(document.getElementById("wIvAssess")){
    d.assessmentId = wizVal("wIvAssess");
    const linked = assessments.find(a=>a.id===d.assessmentId);
    if(linked && !d.role) d.role = linked.role || linked.title;
    if(linked && !d.name) d.name = `${linked.title} · AI Interview`;
  }
  const persona = document.querySelector("input[name='wPersona']:checked");
  if(persona) d.persona = persona.value;
}
function wizSetMethod(method){
  wizard.data.method = method;
  if(method==="template"){
    wizard.data.jdId = "";
    wizard.data.jdFile = "";
    wizard.data.name = "Customer Success Manager";
    wizard.data.role = "Customer Success Manager";
    wizard.data.duration = "45";
    wizard.data.description = "Template: evaluate communication, prioritization, and customer judgment.";
    wizard.data.questions = sampleQuestions("Customer Success Manager");
  } else if(method==="blank"){
    wizard.data.jdId = "";
    wizard.data.jdFile = "";
    wizard.data.name = "";
    wizard.data.role = "";
    wizard.data.description = "";
    wizard.data.questions = sampleQuestions("this role");
  } else if(method==="jd"){
    wizard.data.ivSource = "jd";
  }
  renderWorkspace();
}
function wizSetIvSource(mode){
  wizard.data.ivSource = mode;
  if(mode==="jd") wizard.data.method = "jd";
  if(mode==="assessment" || mode==="skills") wizard.data.method = "skills";
  if(mode==="role" || mode==="manual"){ wizard.data.jdId=""; wizard.data.jdFile=""; }
  renderWorkspace();
}
function wizGenerateFromRole(){
  const role = (document.getElementById("wJdRole")?.value || "").trim();
  if(!role){ toast("Enter a job title first."); return; }
  const jd = jdByRole(role);
  if(jd && (role.toLowerCase().includes(jd.match) || role.toLowerCase()===jd.role.toLowerCase())){
    applyJdToData(wizard.data, jd, null, wizard.kind==="interview");
  } else {
    wizard.data.method = "jd";
    wizard.data.jdId = "title";
    wizard.data.jdFile = "Role title";
    wizard.data.role = role;
    wizard.data.name = wizard.kind==="interview" ? `${role} · AI Interview` : `${role} assessment`;
    wizard.data.duration = "45";
    wizard.data.description = `Assessment generated from the ${role} role.`;
    wizard.data.questions = sampleQuestions(role);
    wizard.data.topics = sampleTopics(role);
    wizard.data.jdParsing = false;
  }
  wizard.step = 1;
  renderWorkspace();
}
function wizUseTemplate(title){
  wizard.data.method = "template";
  wizard.data.name = title;
  wizard.data.role = title;
  wizard.data.duration = title.includes("Engineer") ? "60" : "45";
  wizard.data.description = `Template based on ${title}.`;
  wizard.data.questions = sampleQuestions(title);
  wizard.step = 1;
  renderWorkspace();
}
function wizGoto(i){
  if(wizard.step==="done") return;
  captureWizard();
  if(i <= wizard.step){ wizard.step = i; renderWorkspace(); }
}
function wizBack(){
  captureWizard();
  if(wizard.data?.aiPhase==="creating") return;
  if(isShortAssessCreate() && wizard.data.aiPhase==="generator"){
    appNav("meritedge");
    return;
  }
  if(isShortAssessCreate() && wizard.step===4){
    wizard.data.aiPhase = "generator";
    wizard.step = 0;
    renderWorkspace();
    return;
  }
  if(isShortInterviewCreate() && wizard.step===0){
    appNav("ai-interviewer");
    return;
  }
  if(isShortInterviewCreate() && wizard.step===INTERVIEW_STEPS.length-1){
    wizard.step = 0;
    wizard.data.aiPhase = "";
    renderWorkspace();
    return;
  }
  if(wizard.kind==="assessment" && wizard.data.build && wizard.step<=1){
    wizard.data.build = "";
    wizard.data.aiPhase = "choose";
    wizard.step = 0;
    renderWorkspace();
    return;
  }
  if(wizard.kind==="assessment" && wizard.data.aiPhase==="generator"){
    wizard.data.aiPhase = "choose";
    wizard.data.build = "";
    renderWorkspace();
    return;
  }
  if(wizard.step > 0) wizard.step -= 1;
  renderWorkspace();
}
function wizNext(){
  captureWizard();
  const steps = wizard.kind==="assessment" ? ASSESS_STEPS : INTERVIEW_STEPS;
  const id = steps[wizard.step].id;
  if(wizard.kind==="assessment"){
    if(id==="method" && !wizard.data.method){ toast("Choose how you want to start."); return; }
    if(id==="method" && wizard.data.method==="jd" && !wizard.data.jdId && !wizard.data.name){ toast("Upload a JD or enter an assessment name."); return; }
    if(id==="method" && wizard.data.jdParsing){ toast("Wait for the JD to finish reading."); return; }
    if(id==="basic" && !wizard.data.name){ toast("Give the assessment a name."); return; }
    if(id==="basic" && !wizard.data.jdId) wizard.data.questions = sampleQuestions(wizard.data.role || wizard.data.name);
  } else {
    if(id==="source" && !wizard.data.ivSource && !wizard.data.assessmentId && !wizard.data.role){ toast("Choose a JD, a linked assessment, or a role."); return; }
    if(id==="source" && wizard.data.ivSource==="jd" && !wizard.data.jdId && (wizard.data.jdText||"").length<20){ toast("Paste a job description or pick a sample JD."); return; }
    if(id==="source" && wizard.data.jdParsing){ toast("Wait for the JD to finish reading."); return; }
    if(id==="source"){
      const linked = assessments.find(a=>a.id===wizard.data.assessmentId);
      if(wizard.data.ivSource==="assessment" && linked){
        wizard.data.role = wizard.data.role || linked.role || linked.title;
        wizard.data.name = wizard.data.name || `${linked.title} · AI Interview`;
        if(!wizard.data.jdId) wizard.data.topics = sampleTopics(wizard.data.role);
      } else if(wizard.data.ivSource==="role"){
        wizard.data.name = wizard.data.name || `${wizard.data.role} · AI Interview`;
        wizard.data.topics = sampleTopics(wizard.data.role);
      } else {
        wizard.data.name = wizard.data.name || `${wizard.data.role} · AI Interview`;
      }
    }
    if(id==="configure" && !wizard.data.name){ toast("Give the interview a name."); return; }
  }
  if(wizard.step < steps.length-1) wizard.step += 1;
  renderWorkspace();
}
function publishAssessment(options){
  captureWizard();
  const d = wizard.data;
  if(!d.name){ toast("Give the assessment a name."); renderWorkspace(); return; }
  const id = "a"+Date.now();
  assessments.unshift({
    id, title:d.name, status:"Active", duration:`${d.duration} min`, created:todayLabel(),
    invited:0, completed:0, shortlisted:0, role:d.role||d.name, passing:Number(d.pass)||70,
    qcount:(d.questions||[]).length, sections:1, createdBy:currentUser()?.name||"You",
    track:(jdById(d.jdId)||{}).kind || "tech",
    candidates:[], questions:d.questions.slice(), userBuilt:true
  });
  state.publishedCount = (state.publishedCount||0) + 1;
  saveState();
  wizard.publishedId = id;
  wizard.step = "done";
  toast("MeritEdge assessment published.");
  if(publishInviteTimer) clearTimeout(publishInviteTimer);
  if(publishInviteCountdownTimer) clearInterval(publishInviteCountdownTimer);
  publishInviteSeconds = 5;
  renderWorkspace();
  if(options?.openInvite){
    openPostPublishInvite("assessment", id);
    return;
  }
  publishInviteCountdownTimer = setInterval(()=>{
    if(appDetail?.type!=="wizard" || wizard?.publishedId!==id || wizard.step!=="done"){
      clearInterval(publishInviteCountdownTimer);
      publishInviteCountdownTimer = null;
      publishInviteSeconds = 0;
      return;
    }
    publishInviteSeconds = Math.max(0, publishInviteSeconds-1);
    renderWorkspace();
  }, 1000);
  publishInviteTimer = setTimeout(()=>{
    publishInviteTimer = null;
    if(publishInviteCountdownTimer){ clearInterval(publishInviteCountdownTimer); publishInviteCountdownTimer = null; }
    publishInviteSeconds = 0;
    if(appDetail?.type!=="wizard" || wizard?.publishedId!==id || wizard.step!=="done") return;
    openPostPublishInvite("assessment", id);
  }, 5000);
}
function clearAha(){
  if(aha?.timers) aha.timers.forEach(t=>clearTimeout(t));
  aha = null;
}
function startAhaRun(id){
  if(tour) finishTour({skipWow:true});
  clearAha();
  const a = assessments.find(x=>x.id===id);
  if(!a) return;
  a.candidates = [
    {id:"aha1", name:"Alex Kim", email:"alex.k@example.com", score:"—", status:"Invited", skills:"Invite sent"},
    {id:"aha2", name:"Riya Shah", email:"riya.s@example.com", score:"—", status:"Invited", skills:"Invite sent"},
    {id:"aha3", name:"Noah Blake", email:"noah.b@example.com", score:"—", status:"Invited", skills:"Invite sent"}
  ];
  a.invited = 3; a.completed = 0; a.shortlisted = 0; a.ahaPhase = 0;
  wizard = null;
  openAssessment(id);
  const timers = [];
  timers.push(setTimeout(()=>{
    a.candidates[0].status="In progress"; a.candidates[1].status="In progress"; a.ahaPhase=1;
    if(appDetail?.id===id) renderWorkspace();
  }, 3500));
  timers.push(setTimeout(()=>{
    a.candidates[0].status="Completed"; a.candidates[0].score=91; a.candidates[0].skills="Strong match";
    a.candidates[1].status="Completed"; a.candidates[1].score=84; a.candidates[1].skills="Recommend";
    a.completed=2; a.ahaPhase=2;
    if(appDetail?.id===id) renderWorkspace();
  }, 8000));
  timers.push(setTimeout(()=>{
    a.candidates[0].status="Shortlisted"; a.candidates[1].status="Shortlisted";
    a.shortlisted=2; a.ahaPhase=3;
    if(appDetail?.id===id) renderWorkspace();
  }, 12500));
  aha = {id, timers};
  setTimeout(()=>startWowReel("assess"), 400);
}
function ahaBanner(a){
  if(!a || a.ahaPhase==null) return "";
  const msgs = [
    "Three sample candidates just received the MeritEdge invite.",
    "Two candidates are in the assessment now.",
    "Two finished. Scores just landed on the shortlist.",
    "Two shortlisted. Invite more, or open the linked AI Interviewer for the same people."
  ];
  return `<div class="aha-live">Live candidate run · TalentEdge preview<span>${msgs[a.ahaPhase]||msgs[3]}</span></div>`;
}
function showWorkspaceReady(){
  const built = assessments.filter(a=>a.userBuilt);
  const role = intentRole();
  const body = document.getElementById("readyBody");
  const u = currentUser();
  body.innerHTML = `<h2 id="readyTitle" style="margin-top:20px">Your TalentEdge workspace is ready</h2>
    <p class="modalcopy">Registered as ${escapeHtml(u?.name||"you")} at ${escapeHtml(u?.company||"your company")}. You can now invite yourself and experience the candidate side.</p>
    <div class="ready-built">
      <b>What you already have</b>
      <div style="margin-top:6px">${built.length ? built.map(a=>`MeritEdge · ${escapeHtml(a.title)}`).join("<br>") : `Sample ${escapeHtml(role)} assessment and AI Interviewer session`}</div>
    </div>
    <div class="te-actions" style="flex-wrap:wrap">
      <button class="te-btn" type="button" onclick="continueReadyInvites()">Invite yourself</button>
      <button class="te-btn ghost" type="button" onclick="closeReady();appNav('ai-interviewer')">Open AI Interviewer</button>
      <button class="te-btn ghost" type="button" onclick="openInfo('Talk to TalentEdge','In the live product this reaches the TalentEdge team about MeritEdge and AI Interviewer.')">Talk to us</button>
    </div>`;
  document.getElementById("readyModal").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeReady(){
  document.getElementById("readyModal").classList.remove("open");
  document.body.style.overflow = "";
}
function continueReadyInvites(){
  const next = pendingReady;
  pendingReady = null;
  closeReady();
  if(next) startInvite(next.kind, next.id);
  else startInvite("assessment", assessments[0].id);
}
function sitInBeats(role){
  return [
    {at:400, who:"ai", label:"AI Interviewer", text:`For this ${role} role in TalentEdge, walk through a recent tradeoff you made under a deadline.`},
    {at:5200, who:"c", label:"Candidate", text:"I cut visual polish to protect a research week so the launch date still held."},
    {at:10000, who:"ai", label:"AI Interviewer", text:"How did that land with engineering and design?"},
    {at:14800, who:"c", label:"Candidate", text:"Engineering unblocked the date. Design signed off once they saw the risk in the roadmap."},
    {at:19600, result:true}
  ];
}
function startSitIn(interviewId, candidateId, opts){
  opts = opts || {};
  closeReady();
  if(tour && !demoReel) finishTour({skipWow:true});
  const iv = interviews.find(x=>x.id===interviewId) || interviews[0];
  const cand = iv?.candidates.find(c=>c.id===candidateId) || iv?.candidates.find(c=>c.status==="Completed") || iv?.candidates[0];
  const linked = assessments.find(a=>a.id===iv.assessmentId);
  const meScore = linked?.candidates.find(c=>c.name===cand?.name)?.score || 92;
  (sitin?.timers||[]).forEach(t=>clearTimeout(t));
  sitin = {iv, cand, meScore, log:[], done:false, timers:[]};
  if(sitinTimer) clearTimeout(sitinTimer);
  document.getElementById("sitinOverlay").classList.add("open");
  const beats = sitInBeats(iv.role||intentRole());
  const silent = !!(opts.silent || demoReel);
  if(opts.done){
    sitin.log = beats.filter(b=>!b.result);
    sitin.done = true;
    drawSitIn();
    return;
  }
  drawSitIn();
  beats.forEach((beat,i)=>{
    const at = Array.isArray(opts.beatAt) && opts.beatAt[i]!=null ? opts.beatAt[i] : beat.at;
    const t = setTimeout(()=>{
      if(!sitin) return;
      if(beat.result){
        sitin.done = true; drawSitIn();
        try{ if(!silent && !tourMuted && window.speechSynthesis){ const u=new SpeechSynthesisUtterance(`MeritEdge ${meScore}. AI Interviewer ${cand?.score||"4.8 out of 5"}. Strong match.`); window.speechSynthesis.speak(u); } }catch(e){}
        return;
      }
      sitin.log.push(beat);
      drawSitIn();
      try{
        if(!silent && !tourMuted && window.speechSynthesis){
          const u = new SpeechSynthesisUtterance(beat.text);
          u.rate = beat.who==="ai"?1.02:1.05;
          window.speechSynthesis.speak(u);
        }
      }catch(e){}
    }, at);
    sitin.timers.push(t);
  });
}
function drawSitIn(){
  const el = document.getElementById("sitinCard");
  if(!el || !sitin) return;
  const c = sitin.cand;
  const log = sitin.log.map(b=>`<div class="sitin-b ${b.who}"><b>${b.label}</b>${escapeHtml(b.text)}</div>`).join("");
  el.innerHTML = `<h2>Sit in · AI Interviewer</h2>
    <p class="te-note" style="margin:0">${escapeHtml(c?.name||"Candidate")} · ${escapeHtml(sitin.iv?.role||intentRole())} · TalentEdge sample session</p>
    <div class="sitin-log">${log || `<div class="sitin-b ai"><b>AI Interviewer</b>Starting the session…</div>`}</div>
    ${sitin.done?`<div class="sitin-result">
      <div><label>MeritEdge</label><b>${sitin.meScore}</b></div>
      <div><label>AI Interviewer</label><b>${escapeHtml(c?.score||"4.8/5")}</b></div>
    </div>
    <div class="te-reco" style="margin:0 0 12px"><span>✳</span><div><b>Strong match</b><p>${escapeHtml(c?.note||"Strong MeritEdge assessment and thoughtful tradeoffs in AI Interviewer.")}</p></div></div>
    <div class="te-actions">
      <button class="te-btn" type="button" onclick="closeSitIn();startInvite('interview','${sitin.iv.id}')">Invite this path</button>
      <button class="te-btn ghost" type="button" onclick="closeSitIn()">Back to TalentEdge</button>
    </div>`:`<button class="te-btn ghost" type="button" onclick="closeSitIn()">Close</button>`}`;
}
function closeSitIn(){
  (sitin?.timers||[]).forEach(t=>clearTimeout(t));
  sitin = null;
  try{ window.speechSynthesis?.cancel(); }catch(e){}
  document.getElementById("sitinOverlay").classList.remove("open");
}
const WOW_TICKER = __D.wowTicker;
let tickerIdx = 0;
let tickerTimer = null;
function startHomeTicker(){
  const el = document.getElementById("liveTickerText");
  if(!el) return;
  if(tickerTimer) clearInterval(tickerTimer);
  tickerTimer = setInterval(()=>{
    tickerIdx = (tickerIdx + 1) % WOW_TICKER.length;
    const t = document.getElementById("liveTickerText");
    if(t) t.textContent = WOW_TICKER[tickerIdx];
  }, 3800);
}
function animateCounts(){
  document.querySelectorAll(".count-up").forEach(el=>{
    const to = Number(el.getAttribute("data-to")||0);
    const start = performance.now();
    const dur = 900;
    const tick = now => {
      const p = Math.min(1, (now - start) / dur);
      const n = Math.round(to * (1 - Math.pow(1-p, 3)));
      el.textContent = String(n).padStart(2, "0");
      if(p<1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
function wowSpeak(text){
  if(tourMuted || !text || !window.speechSynthesis) return;
  try{
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    window.speechSynthesis.speak(u);
  }catch(e){}
}
function clearWow(){
  (wow?.timers||[]).forEach(t=>clearTimeout(t));
  wow = null;
  document.getElementById("wowOverlay")?.classList.remove("open");
}
function closeWow(){
  const after = wow?.after;
  clearWow();
  if(typeof after === "function") after();
}
function wowFromCta(action){
  clearWow();
  if(action==="interview-open"){ appNav("ai-interviewer"); openInterview("i1"); }
  else if(action==="assess"){ appNav("meritedge"); startCreateAssessment(); }
  else if(action==="interview"){ appNav("ai-interviewer"); startCreateInterview(); }
}
function startWowReel(mode, opts){
  opts = opts || {};
  if(tour) return;
  if(opts.once && sessionStorage.getItem("me_plg_wow_hire")) return;
  if(wow) clearWow();
  closeSitIn();
  closeReady();
  if(opts.once || mode==="hire") sessionStorage.setItem("me_plg_wow_hire","1");
  const role = intentRole();
  wow = {mode: mode||"hire", phase:0, canSkip:false, timers:[], after:opts.after||null, role};
  document.getElementById("wowOverlay").classList.add("open");
  drawWow();
  wowSpeak(mode==="interview"
    ? `Watch ${role} live in AI Interviewer.`
    : `Watch a live hire. Maya Chen is in the MeritEdge assessment for ${role}.`);
  const t = (ms, fn) => wow.timers.push(setTimeout(()=>{ if(!wow) return; fn(); }, ms));
  if(mode==="interview"){
    t(1600, ()=>{ wow.phase = 2; drawWow(); });
    t(4200, ()=>{ wow.phase = 3; drawWow(); wowSpeak("How did that tradeoff land with engineering and design?"); });
    t(5000, ()=>{ wow.canSkip = true; drawWow(); });
    t(7800, ()=>{ wow.phase = 4; drawWow(); wowSpeak("MeritEdge ninety two. AI Interviewer four point eight. Strong match."); });
  } else {
    t(1800, ()=>{ wow.phase = 1; drawWow(); });
    t(4000, ()=>{ wow.phase = 2; drawWow(); wowSpeak("Ninety two. Shortlisted."); });
    t(5500, ()=>{ wow.canSkip = true; drawWow(); });
    t(7200, ()=>{ wow.phase = 3; drawWow(); wowSpeak("AI Interviewer is asking the same candidate about a tradeoff under a deadline."); });
    t(11000, ()=>{ wow.phase = 4; drawWow(); wowSpeak("MeritEdge ninety two. AI Interviewer four point eight. Strong match."); });
  }
}
function drawWow(){
  const el = document.getElementById("wowStage");
  if(!el || !wow) return;
  const role = wow.role || intentRole();
  const p = wow.phase;
  const q0 = `Which tradeoff would you make to ship ${role} work on a hard date?`;
  const q1 = "Protect discovery time, even if visual polish slips.";
  const bar = p===0 ? 18 : p===1 ? 48 : 100;
  const optOn = p>=1;
  const chat = p<2
    ? `<p class="ai">Waiting for the MeritEdge score before this interview starts…</p>`
    : p===2
    ? `<p class="ai">For this ${escapeHtml(role)} role, walk through a recent tradeoff you made under a deadline.</p>`
    : `<p class="ai">For this ${escapeHtml(role)} role, walk through a recent tradeoff you made under a deadline.</p>
       <p class="c">I cut visual polish to protect a research week so the launch date still held.</p>`
      + (p>=3 ? `<p class="ai">How did that land with engineering and design?</p><p class="c">Engineering unblocked the date. Design signed off once they saw the risk.</p>` : "");
  const scores = p>=2
    ? `<div class="wow-scores ${p>=2?"slam":""}">
        <div><label>MeritEdge</label><b>${p>=2?"92":"—"}</b></div>
        <div><label>AI Interviewer</label><b>${p>=4?"4.8/5":p>=3?"…":"—"}</b></div>
      </div>
      ${p>=2?`<span class="wow-stamp">${p>=4?"Strong match · shortlisted":"Shortlisted from MeritEdge"}</span>`:""}`
    : `<div class="wow-scores"><div><label>MeritEdge</label><b>—</b></div><div><label>AI Interviewer</label><b>—</b></div></div>`;
  const ctas = p>=4
    ? `<div class="te-actions" style="margin:0">
        <button class="te-btn" type="button" onclick="wowFromCta('interview-open')">Open AI Interviewer</button>
        ${wantsAssess()?`<button class="te-btn ghost" type="button" onclick="wowFromCta('assess')">Create my assessment</button>`:""}
        ${wantsInterview()?`<button class="te-btn ghost" type="button" onclick="wowFromCta('interview')">Create AI interview</button>`:""}
        <button class="te-btn ghost" type="button" onclick="closeWow()">Enter workspace</button>
      </div>`
    : `<span class="lead" style="margin:0">${wow.canSkip?"You can skip now — or watch the scores land.":"Watch this live hire. Skip unlocks in a few seconds."}</span>`;
  const kicker = wow.mode==="assess" ? "Live MeritEdge run" : wow.mode==="interview" ? "Live AI Interviewer" : "Live hire · MeritEdge + AI Interviewer";
  el.innerHTML = `<div class="wow-kicker">${kicker}</div>
    <h2 id="wowTitle">${escapeHtml(role)} · Maya Chen is in session</h2>
    <p class="lead">You cannot miss this. A candidate is taking MeritEdge on the left. The same person is in AI Interviewer on the right. Scores land in front of you.</p>
    <div class="wow-grid">
      <div class="wow-pane">
        <h3><i class="wow-dot"></i> MeritEdge</h3>
        <div class="wow-cand"><span class="wow-av">MC</span><div><b>Maya Chen</b><div class="lead" style="margin:0">Question ${p>=2?"12":p>=1?"5":"3"} of 12</div></div></div>
        <div class="wow-q">${escapeHtml(q0)}</div>
        <div class="wow-opts">
          <span class="${optOn?"on":""}">${escapeHtml(q1)}</span>
          <span>Ship the visual polish and skip research.</span>
          <span>Slip the date to keep both.</span>
        </div>
        <div class="wow-bar"><i style="width:${bar}%"></i></div>
      </div>
      <div class="wow-pane">
        <h3><i class="wow-dot"></i> AI Interviewer</h3>
        <div class="wow-chat">${chat}</div>
      </div>
    </div>
    ${scores}
    <div class="wow-foot">
      ${ctas}
      <button class="te-btn ghost wow-skip" type="button" ${wow.canSkip?"":"disabled"} onclick="closeWow()">${wow.canSkip?"Skip":"Skip locked"}</button>
    </div>`;
}
function publishInterview(){
  captureWizard();
  const d = wizard.data;
  if(!d.name) d.name = `${d.role||"Role"} · AI Interview`;
  const id = "i"+Date.now();
  interviews.unshift({
    id, title:d.name, role:d.role||"Role", assessmentId:d.assessmentId||"",
    status:"Active", duration:`${d.duration} min`, invited:0, completed:0, created:todayLabel(), createdBy:currentUser()?.name||"You",
    track:(jdById(d.jdId)||{}).kind || "tech",
    candidates:[], persona:d.persona, topics:(d.topics||[]).slice(), questions:(d.questions||[]).slice()
  });
  wizard.publishedId = id;
  wizard.step = "done";
  if(publishInviteTimer) clearTimeout(publishInviteTimer);
  if(publishInviteCountdownTimer) clearInterval(publishInviteCountdownTimer);
  publishInviteSeconds = 5;
  toast("AI interview published. Redirecting to Invite yourself...");
  renderWorkspace();
  publishInviteCountdownTimer = setInterval(()=>{
    if(!wizard || wizard.step!=="done" || wizard.publishedId!==id || appDetail?.type!=="wizard"){
      clearInterval(publishInviteCountdownTimer);
      publishInviteCountdownTimer = null;
      return;
    }
    publishInviteSeconds = Math.max(0, publishInviteSeconds - 1);
    renderWorkspace();
  }, 1000);
  publishInviteTimer = setTimeout(()=>{
    publishInviteTimer = null;
    if(publishInviteCountdownTimer) clearInterval(publishInviteCountdownTimer);
    publishInviteCountdownTimer = null;
    if(!wizard || wizard.step!=="done" || wizard.publishedId!==id || appDetail?.type!=="wizard") return;
    publishInviteSeconds = 0;
    openPostPublishInvite("interview", id);
  }, 5000);
}
let inviteMail = null;
function inviteStamp(offsetDays){
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays||0));
  return d.toLocaleString("en-US", {month:"long", day:"2-digit", year:"numeric", hour:"numeric", minute:"2-digit", hour12:true})+" IST";
}
function nameFromInviteEmail(email){
  const u = currentUser();
  if(u && (u.email||"").toLowerCase()===(email||"").toLowerCase() && u.name) return u.name;
  const local = (email||"you").split("@")[0].replace(/[._]/g," ");
  return local.replace(/\b\w/g, c=>c.toUpperCase());
}
function sendInvites(){
  if(isPreviewUser(currentUser())){
    pendingInvite = {kind: appDetail?.kind, id: appDetail?.id};
    openInviteRegister();
    return;
  }
  const emails = (document.getElementById("wEmails")?.value||"").split(/[\n,;]+/).map(s=>s.trim()).filter(Boolean);
  if(emails.length<1){ toast("Add at least one email."); return; }
  const kind = appDetail.kind;
  const id = appDetail.id;
  let firstCand = null;
  if(kind==="assessment"){
    const a = assessments.find(x=>x.id===id);
    if(!a){ toast("Assessment not found."); return; }
    if(!consumeFreeInvites(emails.length)) return;
    emails.forEach((email,i)=>{
      const cand = {id:"n"+Date.now()+i, name:nameFromInviteEmail(email), email, score:"—", status:"Invited", skills:"Invite sent", selfInvite:true};
      a.candidates.push(cand);
      if(!firstCand) firstCand = cand;
    });
    a.invited += emails.length;
  } else {
    const iv = interviews.find(x=>x.id===id);
    if(!iv){ toast("Interview not found."); return; }
    if(!consumeFreeInvites(emails.length)) return;
    emails.forEach((email,i)=>{
      const cand = {id:"n"+Date.now()+i, name:nameFromInviteEmail(email), email, score:"—", rec:"Invited", status:"Invited", note:"Waiting for the candidate to start.", selfInvite:true};
      iv.candidates.push(cand);
      if(!firstCand) firstCand = cand;
    });
    iv.invited += emails.length;
  }
  if(!firstCand){ toast("Could not send invite."); return; }
  toast("Invite sent. Opening the email the candidate receives.");
  openInviteMail(kind, id, firstCand.id);
}
function inviteItem(kind, id){
  return kind==="interview" ? interviews.find(x=>x.id===id) : assessments.find(x=>x.id===id);
}
function inviteCandidate(kind, id, candId){
  const item = inviteItem(kind, id);
  return (item?.candidates||[]).find(c=>c.id===candId);
}
function assessmentInviteBannerHtmlLegacy(cand, fromName, role, qn, mins, isFree){
  return `<div class="assessment-invite-shell" role="dialog" aria-modal="true" aria-labelledby="assessment-invite-title">
    <button class="assessment-invite-close" type="button" onclick="closeInviteMail()" aria-label="Close invitation">×</button>
    <article class="assessment-invite-banner">
      <div class="assessment-invite-brand">
        <img src="assets/otomeyt-ai-logo.svg" alt="Otomeyt AI">
        <span>Assessment invitation</span>
      </div>
      <div class="assessment-invite-content">
        <span class="assessment-invite-kicker">You’re invited</span>
        <h1 id="assessment-invite-title">Complete your assessment</h1>
        <p>Hi ${escapeHtml(cand.name)}, ${escapeHtml(fromName)} invited you to show your skills for the <b>${escapeHtml(role)}</b> role.</p>
        <div class="assessment-invite-details">
          <div><span>Assessment</span><b>${escapeHtml(role)}</b></div>
          <div><span>Questions</span><b>${qn}</b></div>
          <div><span>Duration</span><b>${mins} minutes</b></div>
        </div>
        <section class="assessment-invite-before" aria-labelledby="assessment-invite-before-title">
          <b id="assessment-invite-before-title">Before you begin</b>
          <div>
            <span>&#10003; Stable internet required</span>
            <span>&#10003; Don’t switch tabs</span>
            <span>&#10003; Timer starts on begin</span>
            <span>&#10003; Answer each question before continuing</span>
          </div>
        </section>
        <button class="assessment-invite-start" type="button" onclick="startInvitedAttempt()">Start Assessment <span>→</span></button>
        <small>${isFree?"Sample assessment · Your results will be ready after you finish.":"Take your time and answer each question carefully."}</small>
      </div>
    </article>
  </div>`;
}
function assessmentInviteBannerHtml(cand, fromName, role, qn, mins, isFree){
  const durationLabel = `${mins} minutes`;
  return `<div class="assessment-invite-shell assessment-invite-v2-shell" role="dialog" aria-modal="true" aria-labelledby="assessment-invite-title">
    <div class="assessment-invite-v2-combined">
    <article class="assessment-invite-banner assessment-invite-v2-banner">
      <button class="assessment-invite-close" type="button" onclick="closeInviteMail()" aria-label="Close invitation">&#215;</button>
      <header class="assessment-invite-v2-header">
        <div class="assessment-invite-v2-brand">
          <img src="assets/otomeyt-ai-logo.svg" alt="Otomeyt AI">
        </div>
        <div class="assessment-invite-v2-badge"><span>&#9889;</span> No live time slot to coordinate</div>
      </header>
      <nav class="assessment-invite-v2-steps" aria-label="Assessment progress">
        <div class="active"><i>01</i><b>DETAILS</b></div><span></span>
        <div><i>02</i><b>ASSESSMENT</b></div><span></span>
        <div><i>03</i><b>REPORT</b></div>
      </nav>
      <div class="assessment-invite-v2-layout">
        <section class="assessment-invite-v2-intro">
          <span class="assessment-invite-v2-kicker">STEP 1 OF 3</span>
          <h1 id="assessment-invite-title">Know what to expect<br>before you begin</h1>
          <p>A focused, fair assessment to evaluate your skills for the <b>${escapeHtml(role)}</b> role.</p>
          <div class="assessment-invite-v2-summary">
            <div><span class="assessment-invite-v2-icon">&#128203;</span><b>${escapeHtml(role)}</b><small>ASSESSMENT</small></div>
            <div><span class="assessment-invite-v2-icon">?</span><b>${qn}</b><small>QUESTIONS</small></div>
            <div><span class="assessment-invite-v2-icon">&#9716;</span><b>${mins} minutes</b><small>DURATION</small></div>
          </div>
        </section>
        <section class="assessment-invite-v2-form" aria-labelledby="assessment-invite-details-title">
          <div class="assessment-invite-v2-form-heading">
            <span>YOUR DETAILS</span>
            <h2 id="assessment-invite-details-title">Ready to get started?</h2>
            <p>Confirm the details linked to your invitation before beginning.</p>
          </div>
          <label>Full Name<input value="${escapeHtml(cand.name||"")}" readonly></label>
          <label>Email<input value="${escapeHtml(cand.email||"")}" readonly></label>
          <label class="assessment-invite-v2-consent"><input type="checkbox" onchange="inviteAgree(this.checked)"> <span>I agree to the Terms &amp; Conditions and consent to data collection for this assessment.</span></label>
        </section>
      </div>
      <button class="assessment-invite-start assessment-invite-v2-start" type="button" disabled onclick="startInvitedAttempt(true)">Start ${escapeHtml(durationLabel)} assessment <span>&#8594;</span></button>
      <div class="assessment-invite-v2-footer"><span>&#128272;</span> Your responses are evaluated fairly and securely.</div>
    </article>
    <section class="assessment-invite-before assessment-invite-v2-before" aria-labelledby="assessment-invite-before-title">
      <b id="assessment-invite-before-title">BEFORE YOU BEGIN</b>
      <div class="assessment-invite-v2-before-item">
        <i>&#10003;</i><div><strong>Timer starts when you begin</strong><p>You’ll have ${escapeHtml(durationLabel)} to complete the assessment once you start.</p></div>
      </div>
      <div class="assessment-invite-v2-before-item">
        <i>&#10003;</i><div><strong>Keep this page open</strong><p>For the best experience, avoid switching tabs during the assessment.</p></div>
      </div>
      <div class="assessment-invite-v2-before-item">
        <i>&#10003;</i><div><strong>Assessment monitoring settings are shown before start</strong><p>You’ll see a clear summary of what’s enabled before the assessment begins.</p></div>
      </div>
    </section>
    </div>
  </div>`;
}
function openInviteMail(kind, id, candId){
  const item = inviteItem(kind, id);
  const cand = inviteCandidate(kind, id, candId);
  if(!item || !cand) return;
  inviteMail = {kind, id, candId, agree:false};
  const el = document.getElementById("inviteMailOverlay");
  if(!el) return;
  const u = currentUser() || {};
  const isFree = freeCandidate();
  const isIv = kind==="interview";
  const mins = isFree ? (isIv ? 5 : 10) : (parseInt(String(item.duration||"30"),10) || 30);
  const qn = isFree && !isIv ? 3 : (item.qcount || (item.topics||[]).length || 12);
  const secs = isFree ? 1 : (item.sections || 1);
  const first = (cand.name||"there").split(" ")[0];
  const fromName = u.company || "Otomeyt AI";
  const alex = item.interviewer || "Alex";
  const topics = isFree ? 1 : ((item.topics&&item.topics.length) || 5);
  const role = item.role || item.title || "this role";
  const sub = isIv ? `${fromName} invited you to an AI interview` : "Otomeyt AI — Complete Your Assessment";
  const body = isIv ? `<div class="imail">
        <div class="imail-hero">
          <img src="assets/otomeyt-ai-logo-light.svg" alt="Otomeyt AI">
          <small>AI interview invitation</small>
        </div>
        <div class="imail-pad">
          <h3>Hi ${escapeHtml(cand.name)},</h3>
          <p><b>${escapeHtml(fromName)}</b> has invited you to ${isFree?"a short sample voice interview":"an AI powered interview"} for the <b>${escapeHtml(role)}</b> position. ${isFree?"One spoken answer — microphone only, no camera.":`No need to coordinate schedules — ${escapeHtml(alex)} is ready whenever you are.`}</p>
          <div class="imail-alex"><label>Your interviewer</label><b>${escapeHtml(alex)}</b><small>${escapeHtml(role)}<br>${isFree?`AI-powered · Voice · 1 answer · ${mins} minutes`:`AI-powered · Voice conversation · ${topics} topics · ${mins} minutes`}</small></div>
          <div class="imail-steps">
            <div><i>1</i><b>Click &amp; Set Up</b><span>${isFree?"Allow your microphone":"Allow camera &amp; mic"}</span></div>
            <div><i>2</i><b>Have a Chat</b><span>${isFree?"Speak one answer":"Speak naturally about your work"}</span></div>
            <div><i>3</i><b>That's It!</b><span>Results reviewed by hiring</span></div>
          </div>
          <div class="imail-box">
            <div class="kv"><span>Duration</span><b>${mins} minutes</b></div>
            <div class="kv"><span>Valid From</span><b class="from">${escapeHtml(inviteStamp(0))}</b></div>
            <div class="kv"><span>Complete By</span><b class="until">${escapeHtml(inviteStamp(1))}</b></div>
            <div class="kv"><span>Format</span><b>${isFree?"1 voice answer with AI":"Voice conversation with AI"}</b></div>
          </div>
          <button class="imail-cta" type="button" onclick="startInvitedAttempt()">Start Interview</button>
          <p style="text-align:center;color:#6b7280;font-size:12px;margin:0">${isFree?`Voice · 1 answer · ${mins} minutes`:`Voice conversation · ${topics} topics · ${mins} minutes`}</p>
          <div class="imail-ok"><b>Before You Start</b>${isFree?"✓ Working microphone<br>✓ Chrome, Edge, or Firefox browser<br>✓ Stable internet connection":"✓ Working microphone &amp; camera<br>✓ Quiet, well-lit space<br>✓ Chrome, Edge, or Firefox browser<br>✓ Stable internet connection"}</div>
          <div class="imail-tip"><b>Tip:</b> ${isFree?`Speak one answer. Upgrade to Starter for a full voice interview with ${escapeHtml(alex)}.`:`Just speak naturally — this is a friendly conversation, not a test. ${escapeHtml(alex)} will guide you through each topic.`}</div>
        </div>
        <div class="imail-foot">Questions? Reach out to <a href="#">candidatesupport@otomeyt.ai</a><br>© 2026 Otomeyt AI</div>
      </div>` : `<div class="imail">
        <div class="imail-hero">
          <img src="assets/otomeyt-ai-logo-light.svg" alt="Otomeyt AI">
          <small>Assessment invitation</small>
        </div>
        <div class="imail-pad">
          <h3>Hi ${escapeHtml(cand.name)},</h3>
          <p><b>${escapeHtml(fromName)}</b> has invited you to complete a ${mins}-minute ${isFree?"sample ":""}assessment.</p>
          <div class="imail-box">
            <div class="kv"><span>Duration</span><b>${mins} minutes</b></div>
            <div class="kv"><span>Valid From</span><b class="from">${escapeHtml(inviteStamp(0))}</b></div>
            <div class="kv"><span>Valid Until</span><b class="until">${escapeHtml(inviteStamp(1))}</b></div>
            <div class="kv"><span>Format</span><b>${isFree?"Sample MCQ test":"Online Assessment"}</b></div>
          </div>
          <button class="imail-cta" type="button" onclick="startInvitedAttempt()">Start Assessment</button>
          <p style="text-align:center;color:#6b7280;font-size:12px;margin:0">${qn} questions · ${mins} minutes</p>
          <div class="imail-ov">
            <b>Assessment Overview</b>
            <p style="margin:4px 0 8px;color:#6b7280;font-size:12px">${secs} ${secs===1?"section":"sections"} · ${qn} questions</p>
            <table><thead><tr><th>Section</th><th>Questions</th><th>Duration</th></tr></thead>
            <tbody><tr><td>Section 1</td><td>${qn} ${qn===1?"question":"questions"}</td><td>${mins} min</td></tr></tbody></table>
          </div>
          <div class="imail-req"><b>✦ Requirements</b>✓ Stable internet connection<br>✓ Chrome, Firefox, or Edge browser${isFree?"":"<br>✓ Quiet environment"}</div>
          ${isFree?`<div class="imail-tip"><b>Free plan:</b> This is a 3-question sample. Webcam, coding, and proctoring unlock on paid plans.</div>`:`<div class="imail-req warn">⚠ This assessment is proctored. Your webcam and screen will be monitored.</div>`}
        </div>
        <div class="imail-foot">Questions? Reach out to <a href="#">candidatesupport@otomeyt.ai</a><br>© 2026 Otomeyt AI</div>
      </div>`;
  el.classList.add("open");
  el.classList.toggle("assessment-banner-mode", !isIv);
  document.body.style.overflow = "hidden";
  el.innerHTML = isIv ? `<div class="gmail">
    <div class="gmail-bar"><b>Gmail</b><span class="sent">Sent</span><button class="te-btn ghost" type="button" onclick="closeInviteMail()">×</button></div>
    <div class="gmail-sub" id="inviteMailSubject">${escapeHtml(sub)}</div>
    <div class="gmail-meta">
      <div class="row"><label>From</label><span>Otomeyt AI &lt;noreply@otomeyt.ai&gt;</span></div>
      <div class="row"><label>To</label><span>${escapeHtml(cand.name)} &lt;${escapeHtml(cand.email||"candidate@otomeyt.ai")}&gt;</span></div>
      <div class="row"><label>Date</label><span>${escapeHtml(todayLabel())}</span></div>
    </div>
    <div class="gmail-body">${body}</div>
    <div class="gmail-acts">
      <button class="te-btn" type="button" onclick="startInvitedAttempt()">${isIv?"Start Interview":"Start Assessment"}</button>
      <button class="te-btn ghost" type="button" onclick="openInvitedReport()">View report</button>
      <button class="te-btn ghost" type="button" onclick="closeInviteMail()">Close</button>
    </div>
  </div>` : assessmentInviteBannerHtml(cand, fromName, role, qn, mins, isFree);
}
function closeInviteMail(){
  const overlay = document.getElementById("inviteMailOverlay");
  overlay?.classList.remove("open","assessment-banner-mode");
  document.body.style.overflow = "";
}
function finishSelfInviteAttempt(){
  if(!inviteMail) return;
  const {kind, id, candId} = inviteMail;
  const item = inviteItem(kind, id);
  const cand = inviteCandidate(kind, id, candId);
  if(!item || !cand) return;
  const wasDone = cand.status==="Completed";
  if(kind==="assessment"){
    if(!wasDone){
      cand.status = "Completed";
      cand.score = typeof cand.score==="number" ? cand.score : 78;
      cand.skills = cand.skills && cand.skills!=="Invite sent" ? cand.skills : "Role depth · Collaboration";
      item.completed = (item.completed||0)+1;
      if(cand.score >= (item.passing||70)) item.shortlisted = (item.shortlisted||0)+1;
    }
    cand.report = cand.report || buildAssessReport(item, cand);
  } else {
    if(!wasDone){
      cand.status = "Completed";
      cand.score = 72;
      cand.rec = "Recommend";
      cand.note = cand.note || "Self-invite session completed. Structured evidence is ready on the report.";
      item.completed = (item.completed||0)+1;
    }
    cand.report = cand.report || buildInterviewReport(item, cand);
  }
  if(cand.selfInvite) saveAccountReport(kind, id, candId, item, cand);
}
function saveAccountReport(kind, itemId, candidateId, item, cand){
  const u = ensureAccountEntitlements(currentUser());
  if(!u) return;
  const key = `${kind}:${itemId}:${candidateId}`;
  const report = {
    id:key,
    kind,
    itemId,
    candidateId,
    title:item.title || item.role || "Candidate report",
    candidateName:cand.name || "Candidate",
    candidateEmail:cand.email || "",
    score:cand.score,
    completedAt:todayLabel(),
    data:cand.report
  };
  const index = u.reports.findIndex(x=>x.id===key);
  if(index>=0) u.reports[index] = report;
  else u.reports.unshift(report);
  saveState();
}
function inviteAgree(value){
  if(!inviteMail) return;
  inviteMail.agree = !!value;
  document.querySelector(".assessment-invite-v2-start")?.toggleAttribute("disabled", !inviteMail.agree);
}
function startInvitedAttempt(requireConsent=false){
  if(!inviteMail) return;
  if(requireConsent && !inviteMail.agree){ toast("Please accept the terms before starting."); return; }
  const cand = inviteCandidate(inviteMail.kind, inviteMail.id, inviteMail.candId);
  if(cand && cand.status==="Invited") cand.status = "In progress";
  document.getElementById("inviteMailOverlay")?.classList.remove("open");
  if(inviteMail.kind==="interview") openIvSession();
  else openCandExam(true);
}
let candExam = null;
let ivSess = null;
let ivReportTab = "session";
const CX_QS = __D.examQuestions;
function openCandExam(startAssessment=false){
  if(!inviteMail) return;
  clearTimeout(candExam?._t);
  clearTimeout(candExam?._auto);
  const lite = freeCandidate();
  candExam = {step:startAssessment ? (lite ? "q1" : "sec1") : "details", checks:Array(lite?3:5).fill(0), pick:{}, agree:startAssessment, photo:false, qn:0, tab:false, lite, auto:lite, _auto:null};
  const el = document.getElementById("candExamOverlay");
  if(!el) return;
  el.classList.add("open");
  document.body.style.overflow = "hidden";
  drawCandExam();
}
function closeCandExam(){
  hideAppClickPointer();
  clearTimeout(candExam?._t);
  clearTimeout(candExam?._auto);
  clearTimeout(ivSess?._t);
  try{ window.speechSynthesis?.cancel(); }catch(e){}
  candExam = null;
  ivSess = null;
  document.getElementById("candExamOverlay")?.classList.remove("open");
  document.body.style.overflow = "";
}
function openCandidateUpgrade(){
  closeCandExam();
  closeInviteMail();
  openUpgradePlans();
}
function cxCtx(){
  if(!inviteMail) return {};
  const item = inviteItem(inviteMail.kind, inviteMail.id);
  const cand = inviteCandidate(inviteMail.kind, inviteMail.id, inviteMail.candId);
  return {item, cand, isIv: inviteMail.kind==="interview", company:(currentUser()||{}).company||"Otomeyt AI"};
}
function cxGo(step){
  if(!candExam) return;
  candExam._advancing = false;
  if(step==="sec2"){
    cxFinishExam();
    return;
  }
  candExam.step = step;
  if(step==="check"){
    candExam.checks = Array(candExam.lite?3:5).fill(0);
    candExam.ready = false;
    setTimeout(cxTickCheck, AUTO_PAGE_WAIT);
  }
  if(step==="q3" && !candExam.lite) candExam.tab = true;
  drawCandExam();
  if(candExam.auto && step==="sec1"){
    clearTimeout(candExam._auto);
    candExam._auto = setTimeout(()=>{ if(candExam?.step==="sec1") cxGo("q1"); }, AUTO_PAGE_WAIT);
  }
  if(candExam.auto && /^q[123]$/.test(step)) cxAutoAnswer(step);
}
function cxAutoAnswer(step){
  if(!candExam?.auto || candExam.step!==step || candExam.pick[step]) return;
  const qi = step==="q1" ? 0 : step==="q2" ? 1 : 2;
  const answer = CX_QS[qi]?.opts?.[0]?.k;
  if(!answer) return;
  clearTimeout(candExam._auto);
  showAppClickPointer(`[data-cx-option="${answer}"]`, "Selecting answer");
  candExam._auto = setTimeout(()=>{
    if(!candExam || candExam.step!==step) return;
    cxPick(answer);
  }, AUTO_PAGE_WAIT);
}
function cxTickCheck(){
  if(!candExam || candExam.step!=="check") return;
  const i = candExam.checks.findIndex(v=>v===0);
  if(i<0){
    candExam.ready = true;
    candExam.step = "details";
    drawCandExam();
    if(candExam.auto){
      clearTimeout(candExam._auto);
      candExam._auto = setTimeout(()=>{
        if(!candExam || candExam.step!=="details") return;
        candExam.agree = true;
        cxGo("sec1");
      }, AUTO_PAGE_WAIT);
    }
    return;
  }
  candExam.checks[i] = 1;
  drawCandExam();
  candExam._t = setTimeout(cxTickCheck, 420);
}
function cxPick(k){
  if(!candExam || !/^q[123]$/.test(candExam.step) || candExam._advancing) return;
  const step = candExam.step;
  const {cand} = cxCtx();
  candExam.pick[step] = k;
  candExam._advancing = true;
  candExam.savedAt = Date.now();
  if(cand){
    cand.answers = Object.assign({}, cand.answers || {}, {[step]:k});
    saveState();
  }
  drawCandExam();
  clearTimeout(candExam._auto);
  candExam._auto = setTimeout(()=>{
    if(!candExam || candExam.step!==step) return;
    candExam._advancing = false;
    if(step==="q3") cxFinishExam();
    else cxNextQ();
  }, 320);
}
function cxAgree(){ candExam.agree = !candExam.agree; drawCandExam(); }
function cxNextQ(){
  const order = ["q1","q2","q3"];
  const i = order.indexOf(candExam.step);
  if(i<2) cxGo(order[i+1]);
  else cxGo("fin1");
}
function cxFinishExam(){
  hideAppClickPointer();
  finishSelfInviteAttempt();
  cxGo("report");
}
function drawCandExam(){
  const el = document.getElementById("candExamOverlay");
  if(!el || !candExam) return;
  const {item, cand, isIv, company} = cxCtx();
  if(!item || !cand){ el.innerHTML = ""; return; }
  const name = cand.name || "Candidate";
  const first = name.split(" ")[0];
  const email = cand.email || "you@company.com";
  const lite = !!candExam.lite;
  const mins = lite ? 10 : (parseInt(String(item.duration||"30"),10) || 30);
  const qn = lite ? 3 : (item.qcount || 12);
  const step = candExam.step;
  const checks = [
    ["device","Device Information","desktop • Windows 10/11 • 1536×864"],
    ["browser","Browser Compatibility","Chrome 155.0.0.0"],
    ["net","Internet Connection","10 Mbps • 68ms latency"],
    ["camera","Camera Access","Permission granted"],
    ["gpu","Graphics Acceleration","ANGLE (AMD, AMD Radeon(TM) Graphics) 0"]
  ].slice(0, lite ? 3 : 5);
  if(step==="verify"){
    el.innerHTML = `<div class="cx-stage"><div class="cx-verify">
      <div class="cx-brain">🧠</div>
      <h2>MeritEdge</h2><div class="sub">AI Powered Assessment</div>
      <div class="cx-vcard"><div class="cx-spin"></div>
        <b>Verifying Identity</b><p style="margin:6px 0 0;color:#c4b5fd;font-size:13px">Analyzing your invitation…</p></div>
      <p style="margin-top:18px;color:#6b7280;font-size:12px">This preview continues in a moment.</p>
    </div></div>`;
    return;
  }
  if(step==="check"){
    const icon = {
      device:`<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>`,
      browser:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M3 12h18M12 4a14 14 0 0 1 0 16M12 4a14 14 0 0 0 0 16"/></svg>`,
      net:`<svg viewBox="0 0 24 24"><path d="M5 12.5a7 7 0 0 1 14 0"/><path d="M8 15.5a3.5 3.5 0 0 1 8 0"/><circle cx="12" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>`,
      camera:`<svg viewBox="0 0 24 24"><path d="M4 8h4l2-2h4l2 2h4v10H4z"/><circle cx="12" cy="13" r="3"/></svg>`,
      gpu:`<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 17v2M12 17v2M17 17v2M7 7V5M12 7V5M17 7V5"/></svg>`
    };
    const rows = checks.map((c,i)=>{
      const st = candExam.checks[i];
      return `<div class="syscheck-item${i?" line":""}">
        <span class="syscheck-glyph">${icon[c[0]]||""}</span>
        <span><b>${c[1]}</b><small>${c[2]}</small></span>
        <span class="syscheck-ok${st?" on":""}"><svg viewBox="0 0 24 24"><path d="M5 12.5 9.2 17 19 7"/></svg></span>
      </div>`;
    }).join("");
    el.innerHTML = `<div class="syscheck">
      <div class="syscheck-card">
        <div class="syscheck-head">
          <span class="syscheck-badge"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></span>
          <div>
            <h1>System Check</h1>
            <p>We check this device and browser. Required items must pass before you continue. Failed items can be retried from their row.</p>
          </div>
        </div>
        <div class="syscheck-list">${rows}</div>
        <button class="syscheck-go" type="button" onclick="if(candExam&&candExam.checks.every(function(v){return v===1}))cxGo('details')">Continue →</button>
      </div>
    </div>`;
    return;
  }
  if(step==="details"){
    el.innerHTML = `<div class="cx-stage cx-details-version"><div class="cx-lobby-shell">
      <div class="cx-lobby-top">
        <img src="assets/otomeyt-ai-logo-light.svg" alt="Otomeyt AI">
        <span><i></i> Secure candidate experience</span>
      </div>
      <div class="cx-lobby-progress" aria-label="Assessment progress">
        <span class="on"><b>01</b> Details</span><i></i><span><b>02</b> Assessment</span><i></i><span><b>03</b> Report</span>
      </div>
      <div class="cx-details">
      <div class="cx-side">
        <div class="cx-candidate-brand"><span>Candidate assessment</span></div>
        ${lite?`<span class="cx-sample">Free plan sample</span>`:""}
        <p class="cx-eyebrow">You’re about to begin</p>
        <h3 style="margin:8px 0 8px">${escapeHtml(item.title)}</h3>
        <p class="cx-intro">A focused, fair way to show how you think. Take your time, read each question carefully, and submit when you’re ready.</p>
        <div class="cx-kpis"><div><b>1</b><span>SECTIONS</span></div><div><b>${qn}</b><span>QUESTIONS</span></div><div><b>${mins}</b><span>MINUTES</span></div></div>
        <p class="cx-section-label">Assessment overview</p>
        <div class="cx-row"><b>1 · ${lite?"Sample MCQ":"Section 1"}</b><small>${qn}q · ${mins}m</small></div>
        <div class="cx-warn"><b>Before you begin</b><div>✓ Stable internet required<br>✓ Don't switch tabs<br>✓ Timer starts on begin${lite?"":"<br>✓ This test is proctored"}</div></div>
      </div>
      <div class="cx-side cx-form">
        <div class="cx-form-heading"><span>Step 1 of 3</span><h3>Confirm your details</h3></div>
        <p class="hint">These details are linked to your invite and will appear on your report.</p>
        <label>Full Name</label><input value="${escapeHtml(name)}" readonly>
        <p class="hint">Locked from your profile.</p>
        <label>Email</label><input value="${escapeHtml(email)}" readonly>
        <p class="hint">Locked from your invite.</p>
        <label>Phone</label><input placeholder="Optional">
        <label style="display:flex;gap:8px;align-items:flex-start;margin-top:14px;color:#d1d5db"><input type="checkbox" ${candExam.agree?"checked":""} onclick="cxAgree()" style="width:auto;height:auto;margin-top:3px"> I have read and agree to the Terms &amp; Conditions and consent to data collection as described.</label>
        <button class="cx-cta" type="button" ${candExam.agree?"":"disabled"} onclick="cxGo('${lite?"q1":"photo"}')">${lite?"Begin assessment →":"Continue to Photo →"}</button>
        <p class="cx-form-note"><span>⌁</span> Your responses are evaluated fairly and securely.</p>
      </div>
      </div>
      <p class="cx-lobby-foot">Powered by Otomeyt AI <span>•</span> Your progress is saved automatically</p>
    </div></div>`;
    return;
  }
  if(step==="photo"){
    el.innerHTML = `<div class="cx-stage grid"><div class="cx-photo">
      <h3>Photo capture</h3>
      <p style="color:#9ca3af;font-size:13px">Center your face in the frame. This is used for proctoring.</p>
      <div class="cx-face">${escapeHtml(initials(name))}</div>
      <button class="cx-cta" type="button" onclick="cxGo('${isIv?"q1":"sec1"}')">Looks good — Continue</button>
    </div></div>`;
    return;
  }
  if(step==="sec1"){
    el.innerHTML = `<div class="bsec">
      <div class="bsec-card">
        <div class="bsec-brand candidate-workspace-brand">
          <span class="candidate-workspace-mark">✓</span>
          <b>Candidate workspace</b>
          <span>Secure session</span>
        </div>
        <p class="bsec-name">${escapeHtml(item.title||"Assessment")}</p>
        <div class="bsec-ico">📝</div>
        <p class="bsec-kicker">${lite?"Section 1 of 1":"Section 1 of 3"}</p>
        <h1>Section 1</h1>
        <p class="bsec-sub">${qn} questions</p>
        <div class="bsec-stats">
          <div><b>${qn}</b><span>Questions</span></div>
          <div><b>${mins} minutes</b><span>Minutes remaining</span></div>
        </div>
        <p class="bsec-timer">The timer starts when you begin this section.</p>
        <div class="bsec-box">
          <p>Instructions</p>
          <ul>
            <li><span>•</span>Read each question carefully before answering</li>
            <li><span>•</span>${lite?"Stay on this tab until you submit":"You can flag questions to review later"}</li>
            <li><span>•</span>Make sure to save your answer before moving on</li>
          </ul>
        </div>
        <button class="bsec-go" type="button" onclick="cxGo('q1')">Begin Section <span>→</span></button>
      </div>
    </div>`;
    return;
  }
  if(step==="q1"||step==="q2"||step==="q3"){
    const qi = step==="q1"?0:step==="q2"?1:2;
    const q = CX_QS[qi];
    const sel = candExam.pick[step];
    const questionTotal = 3;
    const answered = ["q1","q2","q3"].filter(k=>candExam.pick[k]).length;
    const assessmentRole = item.role || item.title || "Assessment";
    const roleLabel = String(assessmentRole).replace(/\s*assessment$/i, "").trim() || "Assessment";
    const roleTerm = roleLabel.replace(/\s*engineer$/i, "").trim().toLowerCase() || "backend";
    const topicLabel = item.topics && item.topics[0] && (item.topics[0].title || item.topics[0].name) || "API design";
    const timer = `${String(Math.max(1, mins-qi)).padStart(2,"0")}:${String(35-qi*4).padStart(2,"0")}`;
    const progress = Math.round(((qi+1)/questionTotal)*100);
    const opts = q.opts.map(o=>`<button class="qtest-merit-option ${sel===o.k?"on":""}" data-cx-option="${o.k}" type="button" role="radio" aria-checked="${sel===o.k}" onclick="cxPick('${o.k}')"><span class="qtest-merit-option-key">${o.k}</span><span class="qtest-merit-option-copy">${escapeHtml(o.t)}</span><span class="qtest-merit-radio" aria-hidden="true"></span></button>`).join("");
    const last = qi===2;
    el.innerHTML = `<div class="qtest qtest-merit">
      <header class="qtest-merit-head">
        <div class="qtest-merit-head-inner">
          <div class="qtest-merit-brand"><span class="qtest-merit-logo">A</span><b>MeritEdge</b></div>
          <div class="qtest-merit-progress"><span>Section 1 of 3</span><div class="qtest-merit-progress-track"><i style="width:${progress}%"></i></div></div>
          <div class="qtest-merit-progress"><span>Question ${qi+1} of ${questionTotal}</span><div class="qtest-merit-progress-track"><i style="width:${progress}%"></i></div></div>
          <div class="qtest-merit-timer"><span aria-hidden="true">&#9673;</span><div><b>${timer}</b><small>Time remaining</small></div></div>
        </div>
      </header>
      ${!lite && q.tab && candExam.tab?`<div class="cx-tab qtest-merit-tab">Tab switch 0/3 &mdash; 3 remaining. Return to the exam window.</div>`:""}
      <main class="qtest-merit-main">
        <aside class="qtest-merit-sidebar">
          <h2>Your assessment</h2>
          <div class="qtest-merit-meta"><span aria-hidden="true">&#128188;</span><span>${escapeHtml(roleLabel)}</span></div>
          <div class="qtest-merit-meta"><span aria-hidden="true">&#9776;</span><span>${questionTotal} questions</span></div>
          <div class="qtest-merit-meta"><span aria-hidden="true">&#9673;</span><span>${mins} minutes</span></div>
          <div class="qtest-merit-divider"></div>
          <nav class="qtest-merit-questions" aria-label="Assessment questions">
            <button type="button" class="qtest-merit-question ${qi===0?"on":""}" onclick="cxGo('q1')"><span class="qtest-merit-question-num">1</span><span class="qtest-merit-question-copy"><b>Question 1</b><small>${qi===0?"Current question":candExam.pick.q1?"Completed":"Later"}</small></span></button>
            <button type="button" class="qtest-merit-question ${qi===1?"on":""}" onclick="cxGo('q2')"><span class="qtest-merit-question-num">2</span><span class="qtest-merit-question-copy"><b>Question 2</b><small>${qi===1?"Current question":candExam.pick.q2?"Completed":qi<1?"Next":"Later"}</small></span></button>
            <button type="button" class="qtest-merit-question ${qi===2?"on":""}" onclick="cxGo('q3')"><span class="qtest-merit-question-num">3</span><span class="qtest-merit-question-copy"><b>Question 3</b><small>${qi===2?"Current question":candExam.pick.q3?"Completed":"Later"}</small></span></button>
          </nav>
        </aside>
        <section class="qtest-merit-content">
          <h1>Show how you approach <span class="qtest-merit-accent">real ${escapeHtml(roleTerm)} decisions.</span></h1>
          <p class="qtest-merit-subtitle">A role-relevant scenario about evolving an API without disrupting teams that rely on it.</p>
          <div class="qtest-merit-chips"><span class="qtest-merit-chip role">${escapeHtml(roleLabel)}</span><span class="qtest-merit-chip">&#8599;&nbsp; ${escapeHtml(topicLabel)}</span></div>
          <div class="qtest-merit-grid">
            <div>
              <article class="qtest-merit-question-panel"><span class="qtest-merit-question-label">QUESTION</span><p>${escapeHtml(q.q)}</p></article>
              <div class="qtest-merit-options">${opts}</div>
            </div>
            <aside class="qtest-merit-insight"><span class="qtest-merit-insight-icon">ⓘ</span><h2>Choose your approach</h2><p>Choose the approach you think best minimizes client breakage. You can mark this question for review.</p></aside>
          </div>
        </section>
      </main>
      <footer class="qtest-merit-footer">
        <div class="qtest-merit-footer-inner">
          <button class="qtest-merit-button" type="button" onclick="candExam.step==='q1'?cxGo('sec1'):cxGo(candExam.step==='q3'?'q2':'q1')">←&nbsp; Back</button>
          <div class="qtest-merit-note">ⓘ&nbsp; Your answer will be included in your candidate report</div>
          <div class="qtest-merit-actions">
            <button class="qtest-merit-button" type="button" onclick="toast('Flagged for review.')">♧&nbsp; Mark for review</button>
            ${last?"":`<button class="qtest-merit-button" type="button" onclick="cxNextQ()">Skip</button>`}
            <button class="qtest-merit-button next" type="button" onclick="${last?"cxFinishExam()":"cxNextQ()"}">${last?"Submit assessment":"Next"}&nbsp; →</button>
          </div>
        </div>
      </footer>
    </div>`;
    return;
  }
  if(false && step==="q1"||false && step==="q2"||false && step==="q3"){
    const qi = step==="q1"?0:step==="q2"?1:2;
    const q = CX_QS[qi];
    const sel = candExam.pick[step];
    const totalQ = lite ? 3 : 12;
    const answered = ["q1","q2","q3"].filter(k=>candExam.pick[k]).length;
    const pills = Array.from({length:totalQ},(_,i)=>{
      const id = i<3 ? ["q1","q2","q3"][i] : "";
      const cls = i===qi ? "on" : id && candExam.pick[id] ? "done" : "";
      const go = i<3 ? `onclick="cxGo('${["q1","q2","q3"][i]}')"` : "";
      return `<button type="button" class="qnav-n ${cls}" ${go}>${i+1}</button>`;
    }).join("");
    const opts = q.opts.map(o=>`<button class="qopt ${sel===o.k?"on":""}" data-cx-option="${o.k}" type="button" role="radio" onclick="cxPick('${o.k}')"><b>${o.k}</b><span>${escapeHtml(o.t)}</span><em>${o.k}</em></button>`).join("");
    const last = qi===2;
    el.innerHTML = `<div class="qtest">
      <header class="qtest-head">
        <div class="qtest-bar">
          <div class="qtest-brand">
            <span class="qtest-brand-name">Candidate assessment</span>
            <span>Q <b>${qi+1}</b> <i>/</i> ${totalQ}</span>
          </div>
          <div class="qtest-status">
            <span class="qtest-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            <div class="qtest-clock"><b>${String(Math.max(1, mins-qi)).padStart(2,"0")}:${String(35-qi*4).padStart(2,"0")}</b><small>Section</small></div>
          </div>
        </div>
        <nav class="qtest-nav" aria-label="Questions">
          <span class="qtest-count"><i></i>${answered}/${totalQ}</span>
          <div class="qtest-pills">${pills}</div>
        </nav>
      </header>
      ${!lite && q.tab && candExam.tab?`<div class="cx-tab">Tab switch 0/3 — 3 remaining. Return to the exam window.</div>`:""}
      <div class="qtest-body">
        <div class="qtest-prompt">
          <div class="qtest-kind"><b>◉ Single Choice</b><p>Select one correct answer from the options.</p></div>
          <div class="qtest-stem"><p>${escapeHtml(q.q)}</p></div>
        </div>
        <div class="qtest-opts">
          ${opts}
          <div class="qtest-keys"><kbd>A</kbd><span>-</span><kbd>D</kbd><em>select</em></div>
        </div>
      </div>
      <footer class="qtest-foot">
        <div class="qtest-left">
          <button type="button" onclick="candExam.step==='q1'?cxGo('sec1'):cxGo(candExam.step==='q3'?'q2':'q1')">← Back</button>
        </div>
        <div class="qtest-mid">
          <button type="button" onclick="toast('Flagged for review.')">🚩 Mark for Review</button>
          ${last?"":`<button type="button" onclick="cxNextQ()">Skip</button>`}
          <div class="qtest-qtime"><b>00:${String(40-qi*8).padStart(2,"0")}</b></div>
        </div>
        <button class="qtest-next" type="button" onclick="${last?"cxFinishExam()":"cxNextQ()"}">${last?"Submit assessment":"Skip & Next →"}</button>
      </footer>
    </div>`;
    const nextButton = el.querySelector(".qtest-next");
    if(nextButton && !last && sel) nextButton.textContent = "Next →";
    return;
  }
  if(step==="fin1"){
    el.innerHTML = `<div class="cx-exam" style="position:relative"><div class="cx-dim"><div class="cx-modal">
      <div class="isucc-mark">✓</div>
      <h2>${lite?"Submit sample?":"Finish This Section?"}</h2>
      <p style="color:#9ca3af">Knowledge Assessment</p>
      <p class="te-note">${lite?"Overall progress · 3/3 questions":"Overall progress · 3/12 questions · Section 1/3"}</p>
      <div class="cx-kpis"><div><b>3</b><span>Answered</span></div><div><b>0</b><span>Flagged</span></div><div><b>0</b><span>Skipped</span></div></div>
      ${lite?`<p class="te-note">Coding and extra sections unlock on Starter, Growth, and Enterprise.</p>`:`<div class="cx-box" style="text-align:left"><b>UP NEXT</b>💻 Coding Challenge · 1 question · 43 min</div>
      <p style="font-size:12px;color:#9ca3af">You cannot return to this section after proceeding.</p>`}
      <div class="te-actions" style="justify-content:center;margin-top:12px">
        <button class="te-btn ghost" type="button" onclick="cxGo('q3')">Go Back</button>
        <button class="te-btn" type="button" onclick="${lite || (inviteMail&&inviteMail.kind==="interview")?"cxFinishExam()":"cxGo('sec2')"}">${lite?"Submit sample →":"Submit & Continue →"}</button>
      </div>
    </div></div></div>`;
    return;
  }
  if(step==="sec2"){
    el.innerHTML = `<div class="cx-stage" style="background:#c5c7ce"><div class="cx-sec">
      <span class="chip">SECTION 2 OF 3</span>
      <div class="doc">💻</div>
      <h2 style="margin:6px 0">Coding Challenge</h2>
      <p style="color:#9ca3af">Write and run code in the browser. Timer starts when you begin.</p>
      <div class="cx-stats"><div><b>1</b><span>Question</span></div><div><b>43</b><span>Minutes</span></div></div>
      <button class="cx-cta" type="button" onclick="cxGo('code')">Begin Section →</button>
    </div></div>`;
    return;
  }
  if(step==="code"){
    el.innerHTML = `<div class="cx-exam">
      <div class="cx-top"><span>S2 / 3</span><span>Coding Challenge</span><span style="margin-left:auto">⏱ 42:31</span></div>
      <div class="cx-code">
        <div class="cx-prob"><b>Query singers by city or by age from JSON data</b>
          <p>Given a list of singer records (name, city, dob in MM/DD/YYYY, salary), implement queries:</p>
          <p>1) If the query is a city name, return singer names from that city in input order.</p>
          <p>2) If the query is an integer age, return singers older than that age.</p></div>
        <div class="cx-ed">from typing import List, Dict, Optional
def query_singers(singers: list[dict], query: str, current_year: int = 2021) -> list[str]:
    # Implement your solution here.
    return None</div>
      </div>
      <div class="cx-cam">CAM · ${escapeHtml(first)}</div>
      <div class="cx-foot">
        <button class="te-btn ghost" type="button" onclick="toast('Ran sample tests. 2 passed.')">Run tests</button>
        <button class="te-btn" type="button" onclick="cxGo('fin2')">Finish Section →</button>
      </div>
    </div>`;
    return;
  }
  if(step==="fin2"){
    el.innerHTML = `<div class="cx-exam" style="position:relative"><div class="cx-dim"><div class="cx-modal">
      <div class="isucc-mark">✓</div>
      <h2>Finish This Section?</h2>
      <p style="color:#9ca3af">Coding Challenge</p>
      <p class="te-note">Overall progress · 4/16 questions · Section 2/3</p>
      <div class="cx-box" style="text-align:left"><b>UP NEXT</b>🧠 Analytical Thinking · 3 questions · 9 min</div>
      <div class="te-actions" style="justify-content:center;margin-top:12px">
        <button class="te-btn ghost" type="button" onclick="cxGo('code')">Go Back</button>
        <button class="te-btn" type="button" onclick="cxFinishExam()">Submit & Continue →</button>
      </div>
    </div></div></div>`;
    return;
  }
  if(step==="report"){
    const r = cand.report || {};
    const score = typeof r.score === "number" ? r.score : 78;
    const skills = (r.skills||[]).slice(0,3).map(s=>`<article class="cx-report-skill"><div><b>${escapeHtml(s.name||"Skill")}</b><span>${escapeHtml(String(s.pct||0))}%</span></div><i><em style="width:${Math.max(0,Math.min(100,Number(s.pct)||0))}%"></em></i></article>`).join("");
    const passLabel = score >= 70 ? "Above passing" : "Preview score";
    el.innerHTML = `<div class="cx-report-page">
      <header class="cx-report-top"><button class="cx-report-back" type="button" onclick="backToAssessments()">← Back to Assessments</button><div class="cx-report-brand"><span class="cx-report-brand-mark">✓</span><div><b>Candidate report</b><small>Private assessment preview</small></div></div><div class="cx-report-top-meta"><span>Logged in as ${escapeHtml(email)}</span><b>5 free invite credits included</b></div></header>
      <main class="cx-report-main">
        <div class="cx-report-crumb">Assessment result <span>·</span> ${escapeHtml(item.title||"Assessment")}</div>
        <section class="cx-report-hero">
          <div class="cx-report-person"><div class="cx-report-avatar">${escapeHtml(initials(name))}</div><div><span class="cx-report-label">Candidate</span><h1>${escapeHtml(name)}</h1><p>${escapeHtml(email)}</p><strong>${escapeHtml(item.title||"Assessment")}</strong><small>${escapeHtml(r.time||"8m")} · ${escapeHtml(String(r.questions||3))} questions answered</small></div></div>
          <div class="cx-report-ring"><b>${score}%</b><span>Raw knowledge</span></div>
          <div class="cx-report-summary"><b>${passLabel} (${score}%)</b><span>AI Analysis: Preview</span><p>${escapeHtml(name)} completed the assessment preview. Unlock the detailed evidence and full hiring report when you upgrade.</p></div>
        </section>
        <section class="cx-report-info"><h2>Candidate information</h2><p>Details submitted during registration</p><div><article><span>FULL NAME</span><b>${escapeHtml(name)}</b></article><article><span>EMAIL</span><b>${escapeHtml(email)}</b></article><article><span>INVITES</span><b>5 free invites</b></article></div></section>
        <section class="cx-report-preview"><div class="cx-report-section-head"><div><span class="cx-report-section-icon">✓</span><div><h2>Preview report</h2><p>Early signal from your completed assessment</p></div></div><span class="cx-report-preview-pill">FREE PREVIEW</span></div><div class="cx-report-skill-grid">${skills}</div></section>
        <section class="cx-report-lock"><div class="cx-report-lock-icon">🔒</div><div><span>FULL REPORT LOCKED</span><h2>Upgrade to view the full report</h2><p>Unlock section insights, detailed skill breakdown, question evidence, and proctoring details.</p><small>Your free plan includes 5 invites. Upgrade when you are ready to use the full MeritEdge workspace.</small></div><button type="button" onclick="openCandidateUpgrade()">Upgrade plans <span>→</span></button></section>
      </main>
    </div>`;
    return;
  }
  const r = cand.report || {};
  el.innerHTML = `<div class="cx-stage"><div class="isucc">
    <div class="isucc-mark">✓</div>
    <h2>Great job, ${escapeHtml(first)}!</h2>
    <p>You've successfully completed your ${lite?"sample ":""}assessment</p>
    <div class="isucc-grid">
      <div><label>Assessment</label><b>${escapeHtml(item.title)}</b><span>${escapeHtml(company)} · ${escapeHtml(todayLabel())}</span></div>
      <div><label>Summary</label><b>${r.questions||qn} questions</b><span>${escapeHtml(r.time||(lite?"8m":"4m"))} taken<br>+ Submitted successfully</span></div>
    </div>
    <p>${lite?"Open the report for your score and shortlist. Webcam, coding, and full proctoring unlock on a paid plan.":"Otomeyt AI will review your responses. Open the report for score, skills, and proctoring."}</p>
    <button class="te-btn" type="button" onclick="openInvitedReport()">View report</button>
  </div></div>`;
}
const IV_TURNS = __D.interviewTurns;
function ivAlex(item){ return (item && item.interviewer) || "Alex"; }
function openIvSession(){
  if(!inviteMail) return;
  clearTimeout(ivSess?._t);
  clearTimeout(ivSess?._auto);
  const cand = inviteCandidate(inviteMail.kind, inviteMail.id, inviteMail.candId) || {};
  const parts = String(cand.name||"Candidate").trim().split(/\s+/);
  const lite = freeCandidate();
  ivSess = {
    step:"name",
    first:parts[0]||"Candidate",
    last:parts.slice(1).join(" "),
    turn:0,
    said:false,
    lite,
    auto:lite,
    _auto:null,
    checks: lite
      ? {auth:1, mic:0, browser:1, session:1}
      : {auth:1,mic:0,cam:0,audio:1,server:1,session:1}
  };
  const el = document.getElementById("candExamOverlay");
  if(!el) return;
  el.classList.add("open");
  document.body.style.overflow = "hidden";
  drawIvSession();
  if(lite){
    showAppClickPointer(".cx-photo .cx-cta", "Confirm name");
    ivSess._auto = setTimeout(()=>{
      if(ivSess?.step==="name") ivUseName();
    }, AUTO_PAGE_WAIT);
  }
}
function ivGo(step){
  if(!ivSess) return;
  ivSess.step = step;
  if(step==="mic"){
    ivSess.heard=false;
    setTimeout(()=>{
      if(ivSess?.step!=="mic") return;
      ivSess.heard=true;
      drawIvSession();
      if(ivSess.auto){
        showAppClickPointer(".ivs-mic .cx-cta", "Continue");
        ivSess._auto = setTimeout(()=>{
          if(ivSess?.step==="mic" && ivSess.heard) ivMicOk();
        }, 1500);
      }
    }, AUTO_PAGE_WAIT - 1500);
  }
  if(step==="face"){ ivSess.faced=false; setTimeout(()=>{ if(ivSess?.step==="face"){ ivSess.faced=true; drawIvSession(); } }, 1100); }
  if(step==="connect"){ ivSess._t = setTimeout(()=>{ if(ivSess?.step==="connect") ivGo("live"); }, ivSess.lite?600:1400); }
  if(step==="live"){
    ivSess.said=false;
    ivSess.speaking=false;
    ivSpeakCurrent();
    if(ivSess.auto){
      ivSess._auto = setTimeout(()=>{
        if(ivSess?.step!=="live" || ivSess.said) return;
        ivAnswer();
        showAppClickPointer(".ailive-go", "Submit answer");
        ivSess._auto = setTimeout(()=>{
          if(ivSess?.step==="live" && ivSess.said) ivFinish();
        }, AUTO_PAGE_WAIT);
      }, AUTO_PAGE_WAIT);
    }
  }
  if(step==="lobby" && ivSess.auto && ivSess.checks.mic){
    showAppClickPointer(".ivs-panel .cx-cta", "Start interview");
    ivSess._auto = setTimeout(()=>{
      if(ivSess?.step==="lobby") ivGo("live");
    }, AUTO_PAGE_WAIT);
  }
  drawIvSession();
}
function ivSpeakCurrent(){
  try{
    window.speechSynthesis?.cancel();
    const t = IV_TURNS[ivSess.turn];
    if(!t) return;
    const u = new SpeechSynthesisUtterance(t.ai.replace("{first}", ivSess.first).replace("{name}", ivSess.first+" "+(ivSess.last||"")));
    u.rate = 1.02;
    window.speechSynthesis.speak(u);
  }catch(e){}
}
function ivUseName(){
  const f = document.getElementById("ivFirst")?.value.trim() || ivSess.first;
  const l = document.getElementById("ivLast")?.value.trim() || ivSess.last;
  ivSess.first = f; ivSess.last = l;
  if(inviteMail){
    const cand = inviteCandidate(inviteMail.kind, inviteMail.id, inviteMail.candId);
    if(cand) cand.name = [f,l].filter(Boolean).join(" ");
  }
  ivGo("lobby");
}
function ivRunMic(){ ivGo("mic"); }
function ivMicOk(){ ivSess.checks.mic = 1; if(ivSess.lite){ ivGo("lobby"); return; } ivGo("face"); }
function ivVoiceAnswer(){
  if(!ivSess || ivSess.said || ivSess.speaking) return;
  ivSess.speaking = true;
  drawIvSession();
  const t = IV_TURNS[ivSess.turn] || IV_TURNS[0];
  const text = t.you.replace("{first}", ivSess.first).replace("{name}", [ivSess.first, ivSess.last].filter(Boolean).join(" "));
  const done = () => { if(!ivSess || ivSess.said) return; ivSess.speaking = false; ivSess.said = true; drawIvSession(); };
  try{
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.onend = done;
    window.speechSynthesis.speak(u);
    ivSess._t = setTimeout(done, 9000);
  }catch(e){ done(); }
}
function ivFaceOk(){ ivSess.checks.cam = 1; ivSess.checks.audio = 1; ivGo("lobby"); }
function ivAnswer(){ ivSess.said = true; drawIvSession(); }
function ivNextTurn(){
  if(ivSess.lite || ivSess.turn >= IV_TURNS.length-1){ ivGo("endask"); return; }
  ivSess.turn++;
  ivSess.said=false;
  ivSpeakCurrent();
  drawIvSession();
}
function ivFinish(){
  finishSelfInviteAttempt();
  ivGo("thanks");
  if(ivSess?.auto){
    ivSess._auto = setTimeout(()=>{
      if(ivSess?.step==="thanks") openInvitedReport();
    }, AUTO_PAGE_WAIT);
    showAppClickPointer(".ivs-thanks .te-btn", "View report");
  }
}
function drawIvSession(){
  const el = document.getElementById("candExamOverlay");
  if(!el || !ivSess) return;
  const {item, cand} = cxCtx();
  if(!item || !cand){ el.innerHTML=""; return; }
  const alex = ivAlex(item);
  const lite = !!ivSess.lite;
  const mins = lite ? 5 : (parseInt(String(item.duration||"25"),10) || 25);
  const topics = lite ? 1 : ((item.topics&&item.topics.length) || 5);
  const name = [ivSess.first, ivSess.last].filter(Boolean).join(" ");
  const step = ivSess.step;
  const nOk = Object.values(ivSess.checks).filter(Boolean).length;
  const nNeed = lite ? 4 : 6;
  const ready = nOk>=nNeed;
  if(step==="name"){
    el.innerHTML = `<div class="cx-stage"><div class="cx-photo" style="width:min(440px,100%)">
      <div class="cx-brain" style="margin-bottom:10px">✦</div>
      ${lite?`<span class="cx-sample">Free plan sample</span>`:""}
      <h3>Confirm Your Name</h3>
      <p style="color:#9ca3af;font-size:13px">We have your name from the invite. Confirm or update it below.</p>
      <div class="cx-form" style="text-align:left">
        <label>First Name *</label><input id="ivFirst" value="${escapeHtml(ivSess.first)}">
        <label>Last Name (optional)</label><input id="ivLast" value="${escapeHtml(ivSess.last||"")}">
      </div>
      <button class="cx-cta" type="button" onclick="ivUseName()">Use This Name →</button>
      <p class="hint" style="margin-top:10px;color:#6b7280;font-size:12px">Your name will only be used during this interview session.</p>
    </div></div>`;
    return;
  }
  if(step==="lobby"){
    const rows = (lite
      ? [["auth","Authentication"],["mic","Microphone"],["browser","Browser"],["session","Session Available"]]
      : [["auth","Authentication"],["mic","Microphone"],["cam","Camera"],["audio","Audio"],["server","Server"],["session","Session Available"]]
    ).map(([id,label])=>{
      const ok = ivSess.checks[id];
      const micWait = id==="mic" && !ok;
      const camWait = id==="cam" && !ok;
      return `<div class="cx-row"><span><b>${escapeHtml(label)}</b>${camWait?`<small>Complete the microphone check first</small>`:micWait?`<small>Run mic check to verify your audio environment</small>`:""}</span>
        ${micWait?`<button class="te-btn" type="button" onclick="ivRunMic()">Run check</button>`:camWait?`<span class="cx-dot"></span>`:`<span class="cx-dot ok">✓</span>`}</div>`;
    }).join("");
    el.innerHTML = `<div class="cx-stage"><div class="ivs-lobby">
      <div>
        <div class="cx-brain">💼</div>
        ${lite?`<span class="cx-sample">Free plan sample</span>`:""}
        <h2 style="margin:0">AI Interview</h2>
        <p style="color:#c4b5fd">${escapeHtml(alex)} is ready</p>
        <div class="ivs-kpis"><div><b>${mins} min</b><span>Duration</span></div><div><b>${topics}</b><span>${lite?"Answer":"Topics"}</span></div><div><b>Voice</b><span>Type</span></div></div>
        <div class="ivs-tips"><b>Quick Tips</b><div>${lite?"✓ Allow the microphone<br>✓ Speak one clear answer<br>✓ No camera on the free plan":"✓ Find a quiet place with good lighting<br>✓ Speak clearly at a natural pace<br>✓ Use specific examples from experience"}</div></div>
      </div>
      <div class="ivs-panel">
        <div style="display:flex;justify-content:space-between"><b>System Check</b><span>${nOk}/${nNeed}</span></div>
        <div class="ivs-bar"><i style="width:${Math.round(nOk/nNeed*100)}%"></i></div>
        ${rows}
        <button class="cx-cta ${ready?"on":""}" type="button" ${ready?`onclick="ivGo('${lite?"live":"connect"}')"`:"disabled"}>${ready?"Start Interview →":"Complete checks above"}</button>
        <p style="text-align:center;color:#6b7280;font-size:12px;margin:8px 0 0">${lite?"One voice answer begins after you click start":"Interview begins immediately after clicking start"}</p>
      </div>
    </div></div>`;
    return;
  }
  if(step==="mic"){
    el.innerHTML = `<div class="cx-stage"><div class="ivs-mic">
      <div style="display:flex;gap:10px;align-items:center"><span class="cx-brain" style="width:44px;height:44px;margin:0;border-radius:12px">🎤</span>
        <div><b>Reading now — speak up</b><p style="margin:4px 0 0;color:#9ca3af;font-size:13px">“The quick brown fox jumps over the lazy dog.” Watch the level meter — the green dot confirms we hear you.</p></div></div>
      <div class="ivs-meter"><i></i></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#9ca3af"><span>Microphone level</span><span style="color:${ivSess.heard?"#34d399":"#a78bfa"}">${ivSess.heard?"● We hear you":"Listening…"}</span></div>
      <button class="cx-cta" type="button" ${ivSess.heard?"":"disabled"} onclick="ivMicOk()">Continue</button>
    </div></div>`;
    return;
  }
  if(step==="face"){
    el.innerHTML = `<div class="cx-stage"><div class="ivs-face">
      <div class="cx-brain" style="margin-bottom:8px">📷</div>
      <h3>Checking Face Detection</h3>
      <p style="color:#9ca3af">Please position yourself in front of the camera.</p>
      <div class="shot"><div class="ring"></div>
        <span style="position:absolute;top:10px;right:10px;background:#052e16;color:#86efac;border-radius:99px;padding:4px 8px;font-size:11px">${ivSess.faced?"Face Detected":"Looking…"}</span>
      </div>
      <p style="color:#9ca3af;font-size:12px">${ivSess.faced?"Face presence verified.":"Verifying face presence…"}</p>
      <button class="cx-cta" type="button" ${ivSess.faced?"":"disabled"} onclick="ivFaceOk()">Continue</button>
    </div></div>`;
    return;
  }
  if(step==="connect"){
    el.innerHTML = `<div class="cx-stage" style="background:linear-gradient(180deg,#1e1b4b,#4c1d95)"><div style="text-align:center">
      <div class="cx-brain">🔊</div>
      <h2>Connecting to ${escapeHtml(alex)}</h2>
    </div></div>`;
    return;
  }
  if(step==="live" || step==="endask"){
    const t = IV_TURNS[ivSess.turn] || IV_TURNS[0];
    const ai = t.ai.replace("{first}", ivSess.first).replace("{name}", name);
    const you = t.you.replace("{first}", ivSess.first).replace("{name}", name);
    const endask = step==="endask"?`<div class="cx-dim"><div class="cx-modal">
        <div style="width:48px;height:48px;border-radius:50%;background:#7f1d1d;color:#fecaca;display:grid;place-items:center;margin:0 auto 10px">☎</div>
        <h3>End Interview?</h3>
        <p style="color:#fbbf24">${lite?"You will not be able to resume this voice answer.":"This action cannot be undone. You will not be able to resume or retake this interview."}</p>
        <div class="te-actions" style="justify-content:center;margin-top:12px">
          <button class="te-btn ghost" type="button" onclick="ivGo('live')">Continue Interview</button>
          <button class="ivs-end" type="button" onclick="ivFinish()">End Interview</button>
        </div>
      </div></div>`:"";
    const act = lite
      ? (ivSess.said
        ? `<button class="ailive-go" type="button" onclick="ivFinish()">Submit answer</button>`
        : `<button class="ailive-go" type="button" ${ivSess.speaking?"disabled":""} onclick="ivVoiceAnswer()">${ivSess.speaking?"Speaking…":"Speak my answer"}</button>`)
      : (ivSess.said
        ? `<button class="ailive-go" type="button" onclick="ivNextTurn()">${ivSess.turn<IV_TURNS.length-1?"Next question":"Finish"}</button>`
        : `<button class="ailive-go" type="button" onclick="ivAnswer()">Answer</button>`);
    el.innerHTML = `<div class="ailive">
      <header class="ailive-top">
        <div class="ailive-id">
          <img src="https://interviewer.otomeyt.ai/ai-interviewer/portraits/portrait-m-01.webp" alt="${escapeHtml(alex)}">
          <div><b>${escapeHtml(alex)}</b><small>AI Interviewer</small></div>
        </div>
        <div class="ailive-pills">
          ${lite?`<span class="ailive-sample">Free plan</span>`:""}
          <span class="ailive-live">Live</span>
          <span class="ailive-rec">REC</span>
          <span class="ailive-time">${String(mins).padStart(2,"0")}:00</span>
        </div>
      </header>
      <main class="ailive-main">
        <section class="ailive-ai">
          <div class="ailive-orb">
            <img src="https://interviewer.otomeyt.ai/ai-interviewer/portraits/portrait-m-01.webp" alt="">
          </div>
          <h3>${escapeHtml(alex)}</h3>
          <div class="ailive-q">
            <small>Current question</small>
            <p>${escapeHtml(ai)}</p>
          </div>
          ${ivSess.speaking?`<p class="ailive-note">Speaking your answer…</p>`:""}
          ${ivSess.said?`<div class="ailive-q"><small>${escapeHtml(ivSess.first)}</small><p>${escapeHtml(you)}</p></div>`:""}
        </section>
        <section class="ailive-you">
          <span class="ailive-face">No Face</span>
          <span class="ailive-name">You</span>
        </section>
      </main>
      <footer class="ailive-bar">
        <button type="button" title="Microphone">🎤</button>
        <button type="button" title="Camera">📷</button>
        <button type="button" title="Mute interviewer" onclick="toast('Interviewer audio muted.')">🔇</button>
        <label>Vol <input type="range" min="0" max="200" value="140" aria-label="Interviewer volume"><span>140%</span></label>
        <button type="button" onclick="ivSpeakCurrent()">Repeat question</button>
        ${act}
        <i></i>
        <button class="ailive-end" type="button" onclick="ivGo('endask')">End</button>
      </footer>
      ${endask}
    </div>`;
    return;
  }
  el.innerHTML = `<div class="cx-stage grid"><div class="ivs-thanks">
    <div class="isucc-mark">✓</div>
    <span class="te-pill">Interview Complete</span>
    <h2>Thank You!</h2>
    <p>${lite?"Your voice answer has been submitted.":"Your interview has been successfully recorded and submitted."}</p>
    <div class="isucc-grid" style="grid-template-columns:repeat(3,1fr)">
      <div><label>Duration</label><b>${lite?"1m 12s":"3m 38s"}</b></div>
      <div><label>Interviewed by</label><b>${escapeHtml(alex)}</b></div>
      <div><label>Status</label><b>Submitted</b></div>
    </div>
    <p class="te-note" style="text-align:left">${lite?"What happens next? Open the report for this one voice answer. A full recorded interview unlocks on a paid plan.":"What happens next? The hiring team will review your recording. This typically takes 2–5 business days."}</p>
    <button class="te-btn" type="button" onclick="openInvitedReport()">View report</button>
  </div></div>`;
}
function openInvitedReport(){
  finishSelfInviteAttempt();
  closeInviteMail();
  if(!inviteMail) return;
  const reportInvite = Object.assign({}, inviteMail);
  closeCandExam();
  inviteMail = reportInvite;
  const item = inviteItem(reportInvite.kind, reportInvite.id);
  const cand = inviteCandidate(reportInvite.kind, reportInvite.id, reportInvite.candId);
  if(!item || !cand) return;
  candExam = {step:"report", pick:{}, lite:freeCandidate(), auto:false, _auto:null};
  const el = document.getElementById("candExamOverlay");
  if(!el) return;
  el.classList.add("open");
  document.body.style.overflow = "hidden";
  drawCandExam();
}
function buildAssessReport(a, cand){
  const lite = candAttemptLite();
  const qa = [
    {q:"Your product team needs to add a new optional field without breaking clients. What approach best minimizes breakage?", type:"Single choice", pick:"C", ok:true, opts:[
      {k:"A", t:"Modify the existing field in place"},
      {k:"B", t:"Flip a backend flag globally without informing frontends"},
      {k:"C", t:"Create a new API version and keep optional fields on the current version", good:true, sel:true},
      {k:"D", t:"Remove the old field immediately"}
    ]},
    {q:"A public REST API needs a breaking change. Which versioning strategy should you adopt?", type:"Single choice", pick:"B", ok:false, opts:[
      {k:"A", t:"Introduce /v2 and keep /v1 until clients migrate", good:true},
      {k:"B", t:"Keep the URI identical but change the response format", sel:true},
      {k:"C", t:"Only document the change"},
      {k:"D", t:"Add a query parameter ?version=2"}
    ]}
  ];
  if(lite && CX_QS[2]){
    qa.push({q:CX_QS[2].q, type:"Single choice", pick:"A", ok:true, opts:CX_QS[2].opts.map((o,i)=>({k:o.k, t:o.t, good:i===0, sel:i===0}))});
  }
  return {
    lite,
    title: a.title,
    company: (currentUser()||{}).company || "Otomeyt AI",
    score: typeof cand.score==="number" ? cand.score : 78,
    cutoff: a.passing||70,
    questions: lite ? 3 : (a.qcount||12),
    answered: lite ? 3 : Math.max(4, Math.round((a.qcount||12)*0.7)),
    time: lite ? "8m" : "4m",
    duration: lite ? "10 min" : (a.duration || "45 min"),
    proctoring: lite ? null : 95,
    risk: lite ? "Not monitored" : "Low",
    faceMatch: lite ? null : 92,
    violations: 0,
    phone: cand.phone || "—",
    status: cand.status || "Completed",
    effectiveness: 95,
    gaps: 0,
    skills: [
      {name:"Role depth", pct:82, tag:"Exceeds"},
      {name:"Collaboration", pct:74, tag:"Meets"},
      {name:"Systems thinking", pct:41, tag:"Gap"}
    ],
    sections: Array.from({length: Math.max(1, a.sections||1)}, (_,i)=>{
      const n = Math.max(1, a.sections||1);
      const base = typeof cand.score==="number" ? cand.score : 78;
      return {name:`Section ${i+1}`, q:Math.max(1, Math.round((lite?3:(a.qcount||12))/n)), pct:Math.max(0, base - i*4), weight:Math.round(100/n)+"%"};
    }),
    flags: lite ? [] : [
      {label:"Face Always Visible", state:"CLEAN"},
      {label:"No Tab Switches", state:"CLEAN"},
      {label:"No Copy/Paste", state:"CLEAN"},
      {label:"Audio Normal", state:"CLEAN"}
    ],
    qa
  };
}
function buildInterviewReport(iv, cand){
  const first = (cand.name||"Candidate").split(" ")[0];
  const alex = iv.interviewer || "Alex";
  const lite = candAttemptLite();
  const turns = lite ? IV_TURNS.slice(0,1) : IV_TURNS;
  return {
    lite,
    title: iv.title,
    score: 72,
    rec: "Recommend",
    note: lite
      ? "One voice answer submitted. Upgrade for a full recorded interview, transcript, and scoring."
      : (cand.note || "Structured voice evidence is ready. Topic coverage and next-round probes sit below."),
    duration: lite ? "1m 12s" : "3m 38s",
    integrity: lite ? "Not monitored" : "Medium",
    overall: 72,
    band: "Meets",
    alex,
    topicsCovered: lite ? 1 : 3,
    topicsTotal: lite ? 1 : 5,
    answered: lite ? 1 : 3,
    questions: lite ? 1 : 3,
    breakdown: [
      {name:"Technical Accuracy", pct:72},
      {name:"Communication", pct:70},
      {name:"Problem Solving", pct:65},
      {name:"Confidence", pct:58},
      {name:"Relevance", pct:80}
    ],
    skills: [
      {name:"Python Lists and Tuples", pct:70, tag:"Basic"},
      {name:"Data Structures in Python", pct:55, tag:"Surface"},
      {name:"Basic Algorithms", pct:62, tag:"Basic"}
    ],
    topics: lite
      ? [{name:"Basic Python Concepts", q:1, pct:70, ok:true}]
      : [
          {name:"Basic Python Concepts", q:1, pct:70, ok:true},
          {name:"Data Structures in Python", q:1, pct:55, ok:true},
          {name:"Basic Algorithms", q:1, pct:62, ok:true},
          {name:"Working with Libraries", q:0, pct:0, ok:false},
          {name:"Debugging Skills", q:0, pct:0, ok:false}
        ],
    qa: lite
      ? [{q:"Can you explain the difference between a list and a tuple in Python, and when you'd choose one over the other?", score:"3/5", topic:"Topic 1"}]
      : [
          {q:"Can you explain the difference between a list and a tuple in Python, and when you'd choose one over the other?", score:"3/5", topic:"Topic 1"},
          {q:"How would you implement a stack using a Python list, and what operations would you use to add and remove items?", score:"2/5", topic:"Topic 2"}
        ],
    transcript: turns.map(t=>({ai:t.ai.replace("{first}", first).replace("{name}", cand.name||first), you:t.you.replace("{first}", first).replace("{name}", cand.name||first)})),
    events: lite ? [] : [
      {label:"Tab Switch", level:"medium", at:"1:31", note:"Left the interview tab for 3s"},
      {label:"No Face", level:"medium", at:"1:51 — 3:13", note:"Face not in frame"}
    ],
    handoff: lite ? [] : [
      {area:"Academic / Project Experience", tag:"Partial", conf:"Medium", note:"1 verified quote · surface depth"},
      {area:"Algorithms / Problem Solving", tag:"Partial", conf:"Low", note:"1 verified quote · surface depth"},
      {area:"Communication", tag:"Partial", conf:"Low", note:"1 verified quote"}
    ]
  };
}
function openCandidateReport(kind, id, candId){
  hideAppClickPointer();
  wizard = null;
  appSection = kind==="interview" ? "ai-interviewer" : "meritedge";
  appDetail = {type:"report", kind, id, candId};
  renderWorkspace();
}
function openCandidateFromDash(kind, id, candId){
  const cand = inviteCandidate(kind, id, candId);
  if(!cand) return;
  if(cand.status==="Invited"){ openInviteMail(kind, id, candId); return; }
  if(cand.status==="In progress"){
    inviteMail = {kind, id, candId};
    if(kind==="interview") openIvSession(); else openCandExam();
    return;
  }
  if(!cand.report){
    inviteMail = {kind, id, candId};
    finishSelfInviteAttempt();
  }
  openCandidateReport(kind, id, candId);
}
function renderInterviewSessionReport(item, cand, r, back){
  const reportLocked = !fullProduct();
  const topics = r.topics || [];
  const qa = r.qa || [];
  const covered = topics.filter(t=>t.ok).length;
  const totalTopics = r.topicsTotal || topics.length || 0;
  const avgRubric = qa.length ? Math.round(qa.reduce((sum,q)=>{
    const parts = String(q.score||"").split("/");
    return sum + (parts.length===2 ? (Number(parts[0])/Number(parts[1]))*100 : 0);
  },0)/qa.length) : 0;
  const topicCards = topics.map(t=>`<article class="mrep-topic ${t.ok?"":"empty"}">
      <div class="mrep-topic-title"><span class="mrep-topic-check">${t.ok?"&#10003;":"&minus;"}</span><b>${escapeHtml(t.name)}</b></div>
      <span class="mrep-topic-score">${t.ok?escapeHtml(String(t.pct))+"%":"no evidence"}</span>
      <small>${t.q||0} question${t.q===1?"":"s"}${t.ok?"":" · no scored answer captured"}</small>
    </article>`).join("");
  const qaRows = qa.map((q,i)=>{
    const parts = String(q.score||"").split("/");
    const aiPct = parts.length===2 ? Math.round((Number(parts[0])/Number(parts[1]))*100) : 0;
    return `<article class="mrep-qa-row">
      <span class="mrep-qno">Q${String(i+1).padStart(2,"0")}</span>
      <div class="mrep-qcopy"><p>${escapeHtml(q.q)}</p><div><span class="mrep-ai-score">&#10022; AI ${aiPct}%</span><span class="mrep-qtopic"> · ${escapeHtml(q.topic||"Interview evidence")}</span></div></div>
      <b class="mrep-qscore">${escapeHtml(q.score||"-")}</b>
    </article>`;
  }).join("");
  const handoffRows = (r.handoff||[]).map(h=>`<div class="mrep-handoff-row"><div><b>${escapeHtml(h.area)}</b><span>${escapeHtml(h.note||"")}</span></div><em>${escapeHtml(h.tag||"Review")}</em><small>${escapeHtml(h.conf||"Medium")} confidence</small></div>`).join("");
  const handoff = handoffRows ? `<section class="mrep-card">
      <header class="mrep-card-head"><div class="mrep-head-icon">&#9744;</div><div><h2>Next-round handoff</h2><p>${(r.handoff||[]).length} areas demonstrated · suggested probes ready</p></div></header>
      <div class="mrep-handoff">${handoffRows}</div>
    </section>` : "";
  const upgrade = reportLocked ? `<section class="rpt-upgrade-lock mrep-upgrade" aria-label="Upgrade to view the full interview report">
      <div class="rpt-upgrade-lock-icon" aria-hidden="true">&#128274;</div>
      <div class="rpt-upgrade-copy"><span class="rpt-upgrade-kicker">Full report locked</span><h2>Upgrade to view the full interview report</h2><p>Unlock the complete recording, transcript, scoring insights, and next-round handoff.</p></div>
      <button class="rpt-upgrade-btn" type="button" onclick="openUpgradePlans()">Upgrade plans <span aria-hidden="true">&rarr;</span></button>
    </section>` : "";
  return `<div class="mrep">
    <nav class="mrep-crumb" aria-label="Breadcrumb"><button type="button" onclick="appNav('ai-interviewer')">AI Interviewer</button><span>&rsaquo;</span><button type="button" onclick="${back}">${escapeHtml(item.title)}</button><span>&rsaquo;</span><b>Session Detail</b></nav>
    <header class="mrep-bar">
      <button class="mrep-back" type="button" onclick="${back}">&larr; <span>Back</span></button>
      <div><h1>Session Detail</h1><p>${escapeHtml(item.title)}</p></div>
      <div class="mrep-acts"><button class="mrep-topbtn" type="button" onclick="toast('Share link copied.')">&#9671; Share</button><button class="mrep-topbtn" type="button" onclick="toast('PDF export is available on a paid plan.')">&#8595; Export PDF &#9662;</button><button class="mrep-iconbtn" type="button" aria-label="Print" onclick="toast('Print preview is available on a paid plan.')">&#9113;</button><button class="mrep-review" type="button" onclick="toast('Review workflow opened.')">&#9998; Review</button></div>
    </header>
    <section class="mrep-id">
      <div class="mrep-who"><div class="mrep-av">${escapeHtml(initials(cand.name))}</div><div><div class="mrep-name-row"><h2>${escapeHtml(cand.name)}</h2><span class="mrep-status">Completed</span><span class="mrep-voice">&#9835; Voice</span></div><p>${escapeHtml(item.title)} · Completed ${escapeHtml(todayLabel())}</p><div class="mrep-meta"><span>&#9201; <b>${escapeHtml(r.duration||"3m 38s")}</b></span><span>&#9671; ${covered}/${totalTopics} topics probed</span><span>&#9632; ${r.answered||qa.length} answered</span><span>&#9633; ${r.questions||qa.length} questions</span></div></div></div>
    </section>
    <section class="mrep-card">
      <header class="mrep-card-head"><div class="mrep-head-icon">&#10003;</div><div><h2>Topic coverage</h2><p>${covered} of ${totalTopics} configured topics evidenced</p></div></header>
      <div class="mrep-topic-grid">${topicCards}</div>
    </section>
    <section class="mrep-card mrep-qa-card">
      <header class="mrep-card-head"><div class="mrep-head-icon">&#9633;</div><div><h2>Q&amp;A evidence</h2><p>${qa.length} questions · avg AI rubric ${avgRubric}%</p></div></header>
      <div class="mrep-qa-list">${qaRows || `<p class="mrep-empty">No interview answers are available yet.</p>`}</div>
    </section>
    ${handoff}
    ${upgrade}
  </div>`;
}
function renderCandidateReport(){
  const kind = appDetail.kind;
  const item = inviteItem(kind, appDetail.id);
  const cand = inviteCandidate(kind, appDetail.id, appDetail.candId);
  if(!item || !cand) return `<p class="te-note">Report not found.</p>`;
  if(cand.status!=="Completed" || !cand.report){
    inviteMail = {kind, id: appDetail.id, candId: cand.id};
    finishSelfInviteAttempt();
  }
  const r = cand.report || {};
  const lite = !!r.lite;
  const back = kind==="interview" ? `openInterview('${item.id}')` : `openAssessment('${item.id}')`;
  if(kind==="interview"){
    return renderInterviewSessionReport(item, cand, r, back);
    const tab = lite ? "session" : (ivReportTab || "session");
    const tabs = lite ? "" : [["session","Session"],["record","Recording"],["transcript","Transcript"],["scoring","Scoring"]].map(([id,label])=>
      `<button type="button" class="${tab===id?"on":""}" onclick="ivReportTab='${id}';renderWorkspace()">${label}</button>`).join("");
    const menu = lite
      ? `<span class="te-pill">Sample report</span>`
      : `<div class="crep-dl"><button class="te-btn" type="button" onclick="event.stopPropagation();this.nextElementSibling.classList.toggle('open')">Export PDF ▾</button>
      <div class="crep-menu"><button type="button" onclick="toast('PDF preview — nothing is downloaded.')">Full session report</button></div></div>`;
    let body = "";
    if(tab==="record"){
      body = `<div class="crep-card"><b>Recording playback</b><p class="te-note">3 recordings on file</p>
        <div style="background:#000;border-radius:12px;aspect-ratio:16/7;display:grid;place-items:center;margin:10px 0;color:#9ca3af">Interview recording (video + audio) · 3m 29s</div>
        <p class="te-note">Candidate audio only · used for transcription · 3m 29s</p></div>`;
    } else if(tab==="transcript"){
      body = `<div class="crep-card"><b>Interview Transcript</b><p class="te-note">${(r.transcript||[]).length} turns</p>
        ${(r.transcript||[]).map(t=>`<div class="ivs-b ai"><b>AI Interviewer</b><p style="margin:6px 0 0">${escapeHtml(t.ai)}</p></div>
        <div class="ivs-b you"><b>${escapeHtml(cand.name)}</b><p style="margin:6px 0 0">${escapeHtml(t.you)}</p></div>`).join("")}</div>`;
    } else if(tab==="scoring"){
      const bars = (r.breakdown||[]).map(s=>`<div class="crep-skill"><div class="row"><b>${escapeHtml(s.name)}</b><span>${s.pct}%</span></div>
        <div class="crep-bar"><i style="width:${s.pct}%;background:${s.pct>=70?"#34d399":s.pct>=50?"#fbbf24":"#f87171"}"></i></div></div>`).join("");
      const skills = (r.skills||[]).map(s=>`<div class="crep-skill"><div class="row"><b>${escapeHtml(s.name)}</b><span>${s.pct}% · ${escapeHtml(s.tag)}</span></div>
        <div class="crep-bar"><i style="width:${s.pct}%;background:#a855f7"></i></div></div>`).join("");
      body = `<div class="crep-card"><b>Detailed scoring</b>
        <div class="crep-scorehero"><div><span>Overall score</span><b>${r.overall||72}<span> /100</span></b></div><span class="te-pill">${escapeHtml(r.band||"Meets")}</span></div>
        <b>Scoring breakdown</b>${bars}<b>Skill &amp; concept matrix</b>${skills}</div>
        <div class="crep-card"><b>Proctoring events</b>${(r.events||[]).map(e=>`<div class="bj-kv" style="border-color:rgba(255,255,255,.08)"><span>● ${escapeHtml(e.label)} · ${escapeHtml(e.level)}</span><b>${escapeHtml(e.at)}</b></div><p class="te-note">${escapeHtml(e.note||"")}</p>`).join("")}</div>
        <div class="crep-card"><b>Next-round handoff</b>${(r.handoff||[]).map(h=>`<div class="cx-box" style="text-align:left"><b>${escapeHtml(h.area)} · ${escapeHtml(h.tag)}</b>${escapeHtml(h.note)} · ${escapeHtml(h.conf)} confidence</div>`).join("")}</div>`;
    } else {
      body = `<div class="crep-card crep-hero" style="grid-template-columns:1fr auto">
        <div class="crep-who"><div class="av">${escapeHtml(initials(cand.name))}</div>
          <div><b>${escapeHtml(cand.name)}</b><small>${escapeHtml(cand.email||"")}<br>${escapeHtml(item.title)} · Completed · Voice</small></div></div>
        <div class="te-pill">${escapeHtml(r.rec||"Recommend")}</div></div>
      <div class="crep-kpis" style="grid-template-columns:repeat(${lite?3:4},1fr)">
        <div class="crep-kpi"><label>Score</label><b>${r.overall||72}/100</b></div>
        <div class="crep-kpi"><label>Duration</label><b>${escapeHtml(r.duration||"3m 38s")}</b></div>
        <div class="crep-kpi"><label>Topics</label><b>${r.topicsCovered||3}/${r.topicsTotal||5}</b></div>
        ${lite?"":`<div class="crep-kpi"><label>Integrity</label><b>${escapeHtml(r.integrity||"Medium")}</b></div>`}
      </div>
      <div class="crep-card"><b>Topic coverage</b>${(r.topics||[]).map(t=>`<div class="crep-skill"><div class="row"><b>${t.ok?"✓":"○"} ${escapeHtml(t.name)}</b><span>${t.ok?t.pct+"%":"no evidence"} · ${t.q} q</span></div>
        <div class="crep-bar"><i style="width:${t.pct}%;background:${t.ok?"#34d399":"#4b5563"}"></i></div></div>`).join("")}</div>
      <div class="crep-card"><b>Q&amp;A evidence</b>${(r.qa||[]).map((q,i)=>`<p style="margin:10px 0"><b>Q${i+1}</b> ${escapeHtml(q.q)}<br><span class="te-note">${escapeHtml(q.topic)} · ${escapeHtml(q.score)}</span></p>`).join("")}</div>
      ${lite?`<div class="crep-lock">This free plan includes one spoken answer. A full recording, transcript, and PDF export unlock on Starter, Growth, and Enterprise.</div>`:""}`;
    }
    return `<div class="crep">
      <div class="crep-head"><div><button class="te-back" type="button" onclick="${back}">← Back to interview</button>
        <h1 style="margin:8px 0 0">${lite?"Sample report":"Session detail"}</h1><p class="te-note">${escapeHtml(item.title)}</p></div>${menu}</div>
      ${tabs?`<div class="crep-tabs">${tabs}</div>`:""}
      ${body}
    </div>`;
  }
  const reportLocked = !fullProduct();
  const score = typeof r.score==="number" ? r.score : (cand.score||0);
  const cutoff = r.cutoff || item.passing || 70;
  const pass = score >= cutoff;
  const skillAvg = (r.skills||[]).length ? Math.round((r.skills||[]).reduce((s,x)=>s+x.pct,0)/(r.skills||[]).length) : null;
  const sections = r.sections && r.sections.length ? r.sections : [{name:"Section 1", q:r.questions||1, pct:score, weight:"100%"}];
  const first = (cand.name||"Candidate").split(" ")[0];
  const analysis = pass
    ? `${first} cleared the ${item.title} cutoff with consistent evidence across the scored sections. The result is strong enough to shortlist or move into an AI interview.`
    : `${first} is below the ${item.title} cutoff. The attempt shows gaps against the role bar, so review the section scores and Q&A before deciding on a next step.`;
  const pdf = lite
    ? `<span class="te-pill">Sample report</span>`
    : `<div class="crep-dl"><button class="crep-pdf" type="button" onclick="event.stopPropagation();this.nextElementSibling.classList.toggle('open')">Download PDF</button>
    <div class="crep-menu"><button type="button" onclick="toast('Executive summary — preview only.')">Executive Summary</button>
    <button class="on" type="button" onclick="toast('Full technical report — preview only.')">Full Technical Report</button>
    <button type="button" onclick="toast('Print dialog is not opened in this preview.')">Print Current Page</button></div></div>`;
  const band = pct => pct>=cutoff ? "Pass" : pct>=Math.round(cutoff*0.6) ? "Near Pass" : "Below";
  const track = (pct, ok) => `<div class="rpt-track" title="Benchmark: ${cutoff}%"><i class="tick" style="left:${Math.min(96,cutoff)}%"></i><i class="${ok?"ok":"bad"}" style="width:${Math.max(2,Math.min(100,pct))}%"></i></div>`;
  const sectionCards = sections.map(s=>`<article class="rpt-sec">
      <div class="rpt-sec-top">
        <div><div class="rpt-sec-name">${escapeHtml(s.name)} <span>${escapeHtml(String(s.weight||"100%").replace(" weight",""))} wt</span></div><em class="${band(s.pct)==="Pass"?"ok":band(s.pct)==="Near Pass"?"near":"bad"}">${band(s.pct)}</em></div>
        <b class="${s.pct>=cutoff?"ok":"bad"}">${s.pct}%</b>
      </div>
      ${track(s.pct, s.pct>=cutoff)}
    </article>`).join("");
  const breakdown = sections.map(s=>`<div class="rpt-brow">
      <div><b>${escapeHtml(s.name)}</b><span>${escapeHtml(s.weight||"100%")} weight</span><small>${s.q||0} questions · contributes</small></div>
      ${track(s.pct, s.pct>=cutoff)}
      <strong class="${s.pct>=cutoff?"ok":"bad"}">${s.pct}%</strong>
    </div>`).join("");
  const skills = (r.skills||[]).map(s=>`<div class="rpt-skill"><div><b>${escapeHtml(s.name)}</b><span class="${s.pct>=70?"ok":"bad"}">${s.pct}%</span></div>${track(s.pct, s.pct>=70)}</div>`).join("");
  const qa = (r.qa||[]).map((q,i)=>`<article class="rpt-q">
      <header><b>Q${i+1}</b><span>${escapeHtml(q.type||"single_choice")}</span><em class="${q.ok?"ok":"bad"}">${q.ok?"correct":"incorrect"}</em></header>
      <p>${escapeHtml(q.q)}</p>
      <div class="rpt-opts">${(q.opts||[]).map(o=>`<div class="${o.good?"ok":o.sel?"bad":""}"><b>${escapeHtml(o.k)}</b><span>${escapeHtml(o.t)}</span></div>`).join("")}</div>
    </article>`).join("");
  const flagRows = (r.flags&&r.flags.length?r.flags:[{label:"Face Always Visible",state:"CLEAN"},{label:"No Tab Switches",state:"CLEAN"}]).map(f=>`<div class="rpt-flag ${f.state==="FLAG"?"flag":"clean"}"><span>${escapeHtml(f.label)}</span><em>${f.state==="FLAG"?"—":"100%"}</em><b>${f.state==="FLAG"?"FLAG":"CLEAN"}</b></div>`).join("");
  const procScore = r.proctoring||94;
  const proctor = `<section class="rpt-card">
      <header class="rpt-head"><div class="rpt-ico"></div><div><h2>Proctoring evidence</h2><p>${(r.flags||[]).length||2} events · ${r.violations||0} critical · risk: ${escapeHtml(String(r.risk||"low").toLowerCase())}</p></div><span class="rpt-count">${(r.flags||[]).length||2}</span></header>
      <div class="rpt-proc">
        <div><div class="crep-ring pass" style="--p:${procScore}%"><span>${procScore}%</span></div><small>Proctoring Score</small></div>
        <div><b>VERIFIED - ${escapeHtml(String(r.risk||"Low").toUpperCase())} RISK</b><p>Proctoring score: ${procScore}%. Risk level: ${escapeHtml(String(r.risk||"low").toLowerCase())}.</p></div>
      </div>
      <div class="rpt-sub"><h3>Verification Summary</h3>${flagRows}</div>
      <div class="rpt-sub"><h3>Recordings Available</h3><div class="rpt-recs"><div><b>Webcam</b><span>${escapeHtml(r.time||"5m")}</span></div><div><b>Screen</b><span>${escapeHtml(r.time||"5m")}</span></div><div><b>Audio</b><span>${escapeHtml(r.time||"5m")}</span></div></div></div>
      <div class="rpt-viols"><div><b>Video Violations</b><strong>${r.violations||0}</strong><span>at 13:29 into exam</span></div><div><b>Audio Violations</b><strong>0</strong><span>none recorded</span></div></div>
    </section>`;
  const strengths = (r.skills||[]).filter(s=>s.pct>=70);
  const growth = (r.skills||[]).filter(s=>s.pct<70);
  const vs = score - cutoff;
  const lang = (r.skills||[]).map(s=>`<div class="rpt-lang"><b>${escapeHtml(s.name)}</b><span>${s.pct>=80?"B2":s.pct>=60?"B1":"A2"}</span><em>${s.pct}</em></div>`).join("");
  const suggest = (growth.length?growth:[{name:"role tools"}]).slice(0,3).map((s,i)=>`<li><b>${i+1}</b>${escapeHtml("What evidence do you have for "+s.name+"?")}</li>`).join("");
  if(reportLocked) return `<div class="rpt">
    <nav class="rpt-crumb" aria-label="Breadcrumb">
      <button type="button" onclick="appNav('meritedge')">MeritEdge</button>
      <span>&rsaquo;</span>
      <button type="button" onclick="${back}">Reports</button>
      <span>&rsaquo;</span>
      <b>${escapeHtml(cand.name)}</b>
    </nav>
    <header class="rpt-bar">
      <div class="rpt-bar-row">
        <button class="rpt-back" type="button" aria-label="Back" onclick="${back}">&larr;</button>
        <div class="rpt-titles"><h1>Candidate Report</h1><p>${escapeHtml(item.title)}</p></div>
        <div class="rpt-acts"><span class="te-pill">Preview report</span></div>
      </div>
      <div class="rpt-policy">
        <span>Raw knowledge: <b>${score}%</b></span>
        <em>Advisory policy: proctoring does not deduct from score.</em>
      </div>
    </header>
    <div class="rpt-wrap">
      <section class="rpt-card rpt-overview">
        <div class="rpt-who">
          <div class="rpt-av">${escapeHtml(initials(cand.name))}</div>
          <div>
            <h2>${escapeHtml(cand.name)}</h2>
            <p>${escapeHtml(cand.email||"")}</p>
            <p>${escapeHtml(item.title)}</p>
            <div class="rpt-meta"><span>${escapeHtml(todayLabel())}</span><span>${escapeHtml(r.time||"4m")}</span></div>
          </div>
        </div>
        <div class="rpt-score">
          <div class="crep-ring ${pass?"pass":"fail"} ${score?"":"zero"}" style="--p:${Math.min(100,Math.max(score,4))}%"><span>${score}%</span></div>
          <div class="rpt-verdict ${pass?"pass":"fail"}">
            <b>${pass?"Above passing":"Below Passing"} (${score}% / ${cutoff}% required)</b>
            <span>AI Analysis: ${pass?"High":"Moderate"} confidence</span>
            <p>${escapeHtml(analysis)}</p>
          </div>
        </div>
      </section>
      <section class="rpt-card">
        <header class="rpt-h"><h2>Candidate information</h2><p>Details the candidate submitted during registration</p></header>
        <dl class="rpt-info">
          <div><dt>Full Name <i>*</i> &middot; Candidate entered</dt><dd>${escapeHtml(cand.name)}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(cand.email||"-")}</dd></div>
          <div><dt>Phone</dt><dd>${escapeHtml(r.phone||cand.phone||"-")}</dd></div>
        </dl>
      </section>
      <section class="rpt-upgrade-lock" aria-label="Upgrade to view the full report">
        <div class="rpt-upgrade-lock-icon" aria-hidden="true">&#128274;</div>
        <div class="rpt-upgrade-copy">
          <span class="rpt-upgrade-kicker">Full report locked</span>
          <h2>Upgrade to view the full report</h2>
          <p>Unlock section insights, skills breakdown, Q&amp;A evidence, and proctoring details.</p>
        </div>
        <button class="rpt-upgrade-btn" type="button" onclick="openUpgradePlans()">Upgrade plans <span aria-hidden="true">&rarr;</span></button>
      </section>
    </div>
  </div>`;
  return `<div class="rpt">
    <nav class="rpt-crumb" aria-label="Breadcrumb">
      <button type="button" onclick="appNav('meritedge')">MeritEdge</button>
      <span>›</span>
      <button type="button" onclick="${back}">Reports</button>
      <span>›</span>
      <b>${escapeHtml(cand.name)}</b>
    </nav>
    <header class="rpt-bar">
      <div class="rpt-bar-row">
        <button class="rpt-back" type="button" aria-label="Back" onclick="${back}">←</button>
        <div class="rpt-titles"><h1>Candidate Report</h1><p>${escapeHtml(item.title)}</p></div>
        <div class="rpt-acts">
          <button type="button" class="rpt-btn" ${pass?"":"disabled"} title="${pass?"Schedule an interview":"Shortlist this candidate first to schedule an interview"}" onclick="startCreateInterview('${item.id}')">Schedule Interview</button>
          <button type="button" class="rpt-btn" onclick="toast('Full technical report — preview only.')">Download PDF</button>
        </div>
      </div>
      <div class="rpt-policy">
        <span>Raw knowledge: <b>${score}%</b></span>
        <em>Advisory policy: proctoring does not deduct from score.</em>
      </div>
    </header>
    <div class="rpt-wrap">
      <section class="rpt-card rpt-overview">
        <div class="rpt-who">
          <div class="rpt-av">${escapeHtml(initials(cand.name))}</div>
          <div>
            <h2>${escapeHtml(cand.name)}</h2>
            <p>${escapeHtml(cand.email||"")}</p>
            <p>${escapeHtml(item.title)}</p>
            <div class="rpt-meta"><span>${escapeHtml(todayLabel())}</span><span>${escapeHtml(r.time||"4m")}</span></div>
          </div>
        </div>
        <div class="rpt-score">
          <div class="crep-ring ${pass?"pass":"fail"} ${score?"":"zero"}" style="--p:${Math.min(100,Math.max(score,4))}%" ><span>${score}%</span></div>
          <div class="rpt-verdict ${pass?"pass":"fail"}">
            <b>${pass?"Above passing":"Below Passing"} (${score}% / ${cutoff}% required)</b>
            <span>AI Analysis: ${pass?"High":"Moderate"} confidence</span>
            <p>${escapeHtml(analysis)}</p>
          </div>
        </div>
      </section>
      <section class="rpt-card">
        <header class="rpt-h"><h2>Candidate information</h2><p>Details the candidate submitted during registration</p></header>
        <dl class="rpt-info">
          <div><dt>Full Name <i>*</i> · Candidate entered</dt><dd>${escapeHtml(cand.name)}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(cand.email||"—")}</dd></div>
          <div><dt>Phone</dt><dd>${escapeHtml(r.phone||cand.phone||"—")}</dd></div>
        </dl>
      </section>
      <div class="rpt-metrics">
        <article class="${pass?"ok":"bad"}"><div class="rpt-metric-h"><i>%</i><label>Overall Score</label></div><b>${score}<small>%</small></b><em>${vs>=0?"+":""}${vs}% vs cutoff</em>${track(score, pass)}</article>
        <article class="ok"><div class="rpt-metric-h"><i>✓</i><label>Proctoring</label></div><b>${lite?"—":(r.proctoring||94)}<small>${lite?"":"%"}</small></b><em>${lite?"Not monitored":"Verified"}</em>${lite?"":track(r.proctoring||94, true)}</article>
        <article><div class="rpt-metric-h"><i>#</i><label>Questions</label></div><b>${r.answered||0}<small>/${r.questions||0}</small></b><em>Answered</em></article>
        <article><div class="rpt-metric-h"><i>⏱</i><label>Time taken</label></div><b>${escapeHtml(r.time||"—")}</b><em>of ${escapeHtml(r.duration||item.duration||"—")}</em></article>
        <article><div class="rpt-metric-h"><i>✦</i><label>Skill fit</label></div><b>${skillAvg==null?"—":skillAvg}<small>${skillAvg==null?"":"%"}</small></b><em>${(r.skills||[]).length} skills</em>${skillAvg==null?"":track(skillAvg, skillAvg>=70)}</article>
        <article><div class="rpt-metric-h"><i>◉</i><label>Trust score</label></div><b>${lite?"—":(r.proctoring||95)}<small>${lite?"":"%"}</small></b><em>${lite?"Not monitored":escapeHtml(String(r.risk||"Low").toLowerCase())+" risk"}</em></article>
      </div>
      <section class="rpt-block">
        <div class="rpt-block-h"><h2>Section Performance</h2><span>${sections.length} section${sections.length===1?"":"s"}</span></div>
        <div class="rpt-secs">${sectionCards}</div>
      </section>
      <section class="rpt-card">
        <header class="rpt-h"><h2>Score Breakdown</h2><p>Weighted average → <b class="${pass?"ok":"bad"}">${score}%</b></p></header>
        ${breakdown}
      </section>
      <section class="rpt-card">
        <header class="rpt-h"><h2>Skills breakdown</h2><p>${(r.skills||[]).length} skills</p></header>
        ${skills||`<p class="rpt-empty">No skill scores on this attempt.</p>`}
      </section>
      <section class="rpt-card">
        <header class="rpt-h"><h2>CEFR Language Proficiency</h2><p>Based on ${(r.qa||[]).length||r.questions||0} questions</p></header>
        <div class="rpt-langs">${lang||`<p class="rpt-empty">No language evidence on this attempt.</p>`}</div>
      </section>
      <section class="rpt-card">
        <header class="rpt-head"><div class="rpt-ico"></div><div><h2>AI insights &amp; skill gap</h2><p>${strengths.length} strengths · ${growth.length} growth areas · 0 risk flags</p></div></header>
        <div class="rpt-strength"><h3>Key Strengths <span>${strengths.length} identified</span></h3><ul>${strengths.map(s=>`<li>${escapeHtml(s.name)}</li>`).join("")||`<li>None above the bar.</li>`}</ul></div>
        <div class="rpt-growth"><h3>Growth Areas <span>${growth.length} identified</span></h3>${growth.map(s=>`<div class="rpt-grow"><b>${escapeHtml(s.name)}</b><em>moderate gap</em><small>~4w</small></div>`).join("")||`<p class="rpt-empty">No gaps flagged.</p>`}</div>
        <div class="rpt-suggest"><h3>Suggested Interview Questions <span>${Math.max(suggest?3:0,1)} suggested</span></h3><ol>${suggest}</ol></div>
      </section>
      ${lite?`<section class="rpt-card"><header class="rpt-h"><h2>Proctoring evidence</h2><p>Not monitored on the free plan</p></header><p class="rpt-empty">Webcam, tab-switch capture, and proctoring evidence unlock on a paid plan.</p></section>`:proctor}
      <section class="rpt-block">
        <div class="rpt-block-h"><h2>Q&amp;A evidence</h2><span>${(r.qa||[]).length} questions</span></div>
        ${qa}
      </section>
      <section class="rpt-card"><header class="rpt-h"><h2>Audit timeline &amp; report access</h2></header><p class="rpt-empty">No audit events or external viewers recorded for this attempt yet.</p></section>
      <section class="rpt-card"><header class="rpt-h"><h2>Proctoring review history</h2></header><p class="rpt-empty">No proctoring actions have been taken on this attempt.</p></section>
      <footer class="rpt-foot">Generated ${escapeHtml(todayLabel())} · attempt <span>${escapeHtml(String(cand.id||"preview").slice(0,8))}</span></footer>
    </div>
  </div>`;
}
function svgIco(d){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`; }
function icoFile(){ return svgIco('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'); }
function icoBot(){ return svgIco('<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>'); }
function icoBrain(){ return svgIco('<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>'); }
function icoMsg(){ return svgIco('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'); }
function icoDash(){ return svgIco('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'); }
function icoLib(){ return svgIco('<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>'); }
function icoCard(){ return svgIco('<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>'); }
function icoBill(){ return svgIco('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>'); }
function icoGift(){ return svgIco('<polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>'); }
function icoCog(){ return svgIco('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'); }
function icoPlus(){ return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>`; }
function icoSpark(){ return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z"/></svg>`; }
function icoSearch(){ return svgIco('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/>'); }
function icoUsers(){ return svgIco('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'); }
function icoClock(){ return svgIco('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'); }
function icoRefresh(){ return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>`; }
function icoList(){ return svgIco('<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>'); }
function icoGrid(){ return svgIco('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'); }
function icoTableV(){ return svgIco('<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>'); }
function icoMail(){ return svgIco('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'); }
function icoUserCheck(){ return svgIco('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>'); }
function icoCheck(){ return svgIco('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'); }
function icoTrend(){ return svgIco('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'); }
function icoTrendDown(){ return svgIco('<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>'); }
function icoPercent(){ return svgIco('<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'); }
function icoTimer(){ return svgIco('<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>'); }
function icoRotate(){ return svgIco('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'); }
function icoUserPlus(){ return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>`; }
function actorName(){ return currentUser()?.name || "You"; }
function statusPill(st){
  const k = (st||"").toLowerCase();
  const cls = k==="draft"?"draft":k==="archived"?"archived":k==="scheduled"?"scheduled":"";
  return `<span class="te-pill ${cls}">${escapeHtml(st||"")}</span>`;
}
function funnel(done, invited){
  const pct = invited ? Math.min(100, Math.round(done/invited*100)) : 0;
  return `<span class="funnel">${icoUsers()} ${done}/${invited}<span class="bar"><i style="width:${pct}%"></i></span></span>`;
}
function nameBlock(icon, title, sub){
  return `<div style="display:flex;align-items:center;gap:10px"><span class="mh-ico">${icon}</span><span class="mname"><b>${escapeHtml(title)}</b><small>${escapeHtml(sub||"—")}</small></span></div>`;
}
function assessActions(a){
  const linked = interviews.find(i=>i.assessmentId===a.id);
  return [
    {label:"Invite yourself", fn:`startInvite('assessment','${a.id}')`},
    {label:"View Details", fn:`openAssessment('${a.id}')`},
    {label:"View Questions", fn:`later('View questions')`},
    {label:"View Candidates", fn:`openAssessment('${a.id}')`},
    linked ? {label:"View AI Interview", fn:`openInterview('${linked.id}')`} : {label:"Create AI Interview", fn:`startCreateInterview('${a.id}')`},
    {label:"Clone", fn:`later('Clone')`}
  ];
}
function interviewActions(iv){
  return [
    {label:"Invite yourself", fn:`startInvite('interview','${iv.id}')`},
    {label:"View Details", fn:`openInterview('${iv.id}')`},
    {label:"View Sessions", fn:`openInterview('${iv.id}')`},
    {label:"Clone", fn:`later('Clone')`}
  ];
}
function setListView(mode){ listViewMode = mode; openKebab = null; renderWorkspace(); }
function setListStatus(v){ listStatus = v; renderWorkspace(); }
function setListQuery(v){
  listQuery = v;
  const caret = document.getElementById("mSearch")?.selectionStart;
  renderWorkspace();
  const el = document.getElementById("mSearch");
  if(el){ el.focus(); try{ el.setSelectionRange(caret, caret); }catch(e){} }
}
function toggleKebab(id, ev){
  ev?.stopPropagation();
  openKebab = openKebab===id ? null : id;
  renderWorkspace();
}
function moduleHeader({icon, title, subtitle, count, createLabel, createFn, tourSpot, spark, accent}){
  return `<div class="mh">
    <div class="mh-left">
      <span class="mh-ico ${accent||""}">${icon}</span>
      <div>
        <h1>${title}</h1>
        <p class="sub">${subtitle}</p>
        <div class="meta">${count}</div>
      </div>
    </div>
    <div class="mh-right">
      <button class="te-btn ghost" type="button" onclick="later('Refresh')">${icoRefresh()} Refresh</button>
      <button class="te-btn" type="button" ${tourSpot?`data-tour="${tourSpot}"`:""} onclick="${createFn}">${spark?icoSpark():icoPlus()} ${createLabel}</button>
    </div>
  </div>`;
}
function moduleToolbar(kind){
  const ph = kind==="interview" ? "Search interviews..." : "Search by assessment name...";
  const status = kind==="assessment" ? meritStatusMenu() : `<select class="mstatus" aria-label="Filter by status" onchange="setListStatus(this.value)">
        <option value="all" ${listStatus==="all"?"selected":""}>All Status</option>
        <option value="active" ${listStatus==="active"?"selected":""}>Active</option>
        <option value="draft" ${listStatus==="draft"?"selected":""}>Draft</option>
        <option value="archived" ${listStatus==="archived"?"selected":""}>Archived</option>
      </select>`;
  const search = `<label class="msearch">${icoSearch()} <input id="mSearch" value="${escapeHtml(listQuery)}" placeholder="${ph}" oninput="setListQuery(this.value)"></label>`;
  const toggle = `<div class="mseg" role="group" aria-label="View mode">
        <button type="button" class="${listViewMode==="list"?"on":""}" onclick="setListView('list')" aria-label="List">${icoList()} <span>List</span></button>
        <button type="button" class="${listViewMode==="card"?"on":""}" onclick="setListView('card')" aria-label="Cards">${icoGrid()} <span>Cards</span></button>
        <button type="button" class="${listViewMode==="table"?"on":""}" onclick="setListView('table')" aria-label="Table">${icoTableV()} <span>Table</span></button>
      </div>`;
  const pool = kind==="interview" ? catalogInterviews() : catalogAssessments();
  const techN = pool.filter(i=>i.track==="tech").length;
  const nonN = pool.filter(i=>i.track==="nontech").length;
  const track = `<div class="mseg" role="group" aria-label="Role type">
        <button type="button" class="${listTrack==="all"?"on":""}" onclick="setListTrack('all')">All</button>
        <button type="button" class="${listTrack==="tech"?"on":""}" onclick="setListTrack('tech')">Tech (${techN})</button>
        <button type="button" class="${listTrack==="nontech"?"on":""}" onclick="setListTrack('nontech')">Non-tech (${nonN})</button>
      </div>`;
  const tracks = (tour||demoReel) ? "" : track;
  const date = kind==="assessment" ? meritDatePop() : "";
  if(kind==="interview"){
    return `<div class="mtb">${status}${search}<div class="mfilters">${tracks}${toggle}</div></div>`;
  }
  return `<div class="mtb">${search}<div class="mfilters">${date}${status}${tracks}${toggle}</div></div>`;
}
const LIST_STATUSES = [["all","All current"],["active","Active"],["scheduled","Scheduled"],["draft","Draft"],["archived","Archived"],["expired","Expired"]];
function listStatusLabel(){ return (LIST_STATUSES.find(s=>s[0]===listStatus)||LIST_STATUSES[0])[1]; }
function listDateLabel(){
  if(!listFromOn && !listToOn) return "Custom Date";
  const fmt = s => { if(!s) return "…"; const d = new Date(s+"T00:00:00"); return d.toLocaleDateString("en-GB",{day:"numeric",month:"short"}); };
  return `${fmt(listFromOn)} – ${fmt(listToOn)}`;
}
function meritDatePop(){
  return `<div class="me-popwrap">
    <button class="me-chip" type="button" onclick="toggleListPop('date', event)">${icoCalendar()} ${escapeHtml(listDateLabel())}</button>
    <div class="me-pop me-datepop ${listDateOpen?"open":""}" onclick="event.stopPropagation()">
      <div class="me-pop-h"><b>Select Date Range</b><button type="button" aria-label="Close" onclick="closeListPops()">×</button></div>
      <div class="me-dategrid">
        <label>From<input type="date" value="${escapeHtml(listFrom)}" oninput="listFrom=this.value"></label>
        <label>To<input type="date" value="${escapeHtml(listTo)}" oninput="listTo=this.value"></label>
      </div>
      <div class="me-pop-acts">
        <button class="me-reset" type="button" onclick="resetListDates()">Reset</button>
        <button class="me-apply" type="button" onclick="applyListDates()">Apply</button>
      </div>
    </div>
  </div>`;
}
function meritStatusMenu(){
  const items = LIST_STATUSES.map(([id,label])=>`<button type="button" class="${listStatus===id?"on":""}" onclick="pickListStatus('${id}', event)"><span>${label}</span>${listStatus===id?"<i>✓</i>":""}</button>`).join("");
  return `<div class="me-popwrap">
    <button class="me-chip" type="button" onclick="toggleListPop('status', event)">${icoFilter()} ${escapeHtml(listStatusLabel())} <span class="me-caret">▾</span></button>
    <div class="me-pop me-statpop ${listStatusOpen?"open":""}">${items}</div>
  </div>`;
}
function toggleListPop(which, ev){
  ev.stopPropagation();
  if(which==="date"){ listDateOpen = !listDateOpen; listStatusOpen = false; }
  else { listStatusOpen = !listStatusOpen; listDateOpen = false; }
  renderWorkspace();
}
function closeListPops(){ listDateOpen = false; listStatusOpen = false; renderWorkspace(); }
function pickListStatus(id, ev){
  ev.stopPropagation();
  listStatus = id;
  listStatusOpen = false;
  renderWorkspace();
}
function applyListDates(){
  listFromOn = listFrom;
  listToOn = listTo;
  listDateOpen = false;
  renderWorkspace();
}
function resetListDates(){
  listFrom = ""; listTo = ""; listFromOn = ""; listToOn = "";
  renderWorkspace();
}
function icoCalendar(){ return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`; }
function icoFilter(){ return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h18l-7 8v5l-4 2v-7L3 5z"/></svg>`; }
function setListTrack(v){ listTrack = v; renderWorkspace(); }
function filterItems(items, nameKey){
  const q = listQuery.trim().toLowerCase();
  return items.filter(it=>{
    const st = (it.status||"").toLowerCase();
    if(listStatus!=="all" && st!==listStatus) return false;
    if(listFromOn || listToOn){
      const created = new Date(it.created);
      if(isNaN(created.getTime())) return false;
      if(listFromOn && created < new Date(listFromOn+"T00:00:00")) return false;
      if(listToOn && created > new Date(listToOn+"T23:59:59")) return false;
    }
    if(listTrack!=="all" && it.track!==listTrack) return false;
    if(q && !(it[nameKey]||"").toLowerCase().includes(q) && !(it.role||"").toLowerCase().includes(q)) return false;
    return true;
  });
}
function kebab(id, items){
  return `<span style="position:relative">
    <button class="kebab" type="button" aria-label="More actions" onclick="toggleKebab('${id}',event)">⋯</button>
    <div class="kmenu ${openKebab===id?"open":""}">${items.map(it=>`<button type="button" onclick="event.stopPropagation();openKebab=null;${it.fn}">${it.label}</button>`).join("")}</div>
  </span>`;
}
function avgScore(cands){
  const n = (cands||[]).filter(c=>typeof c.score==="number");
  if(!n.length) return null;
  return Math.round(n.reduce((s,c)=>s+c.score,0)/n.length);
}
function stepperHtml(steps, current){
  return `<div class="te-stepper">${steps.map((s,i)=>{
    const on = i===current;
    const done = current==="done" || i<current;
    return `<button class="te-wstep ${on?"on":""} ${done?"done":""}" type="button" onclick="wizGoto(${i})"><span class="wnum">${i+1}</span><span><b>${s.label}</b><small>${s.hint}</small></span></button>`;
  }).join("")}</div>`;
}
function wizardChrome(kind, title, inner, last, lastLabel, lastFn){
  const back = kind==="assessment" ? "meritedge" : "ai-interviewer";
  return `<div class="wiz-shell" data-tour="wizard">
    <div class="wiz-head">
      <div class="wiz-head-l">
        <button class="wiz-x" type="button" aria-label="Close" onclick="appNav('${back}')">×</button>
        <b>${title}</b>
      </div>
      ${stepperHtml(kind==="assessment"?ASSESS_STEPS:INTERVIEW_STEPS, wizard.step)}
      <div class="te-actions">
        ${last
          ? `<button class="te-btn" type="button" onclick="${lastFn}">${lastLabel}</button>`
          : `<button class="te-btn" type="button" onclick="wizNext()">Continue</button>`}
      </div>
    </div>
    <div class="wiz-body">${inner}${wizFoot(last?lastLabel:"", last?lastFn:"")}</div>
  </div>`;
}
function wizFoot(lastLabel, lastFn){
  const first = wizard.step===0;
  return `<div class="te-wiz-foot">
    <button class="te-btn ghost" type="button" ${first?"disabled style='opacity:.45'":""} onclick="wizBack()">Back</button>
    <div class="te-actions">
      <button class="te-btn ghost" type="button" onclick="appNav(wizard.kind==='assessment'?'meritedge':'ai-interviewer')">Cancel</button>
      ${lastFn
        ? `<button class="te-btn" type="button" onclick="${lastFn}">${lastLabel}</button>`
        : `<button class="te-btn" type="button" onclick="wizNext()">Continue</button>`}
    </div>
  </div>`;
}
function renderInvite(){
  const item = appDetail.kind==="assessment"
    ? assessments.find(x=>x.id===appDetail.id)
    : interviews.find(x=>x.id===appDetail.id);
  const back = appDetail.kind==="assessment" ? `openAssessment('${item.id}')` : `openInterview('${item.id}')`;
  return `<div class="dash-id">
      <div class="dash-id-l"><button class="te-back" style="padding:0" onclick="${back}">← Back</button>
        <span class="mh-ico">${appDetail.kind==="assessment"?icoFile():icoBot()}</span>
        <div><h1>Invite yourself</h1><p class="te-note" style="margin:0">${escapeHtml(item.title)}</p></div>
      </div>
    </div>
    <div class="te-card">
      <p class="te-note" style="margin:0 0 14px">Your email is prefilled so you can take this ${appDetail.kind==="interview"?"interview":"assessment"} yourself. Nothing is emailed in this preview.</p>
      <label class="field"><span>Your email</span><input id="wEmails" type="email" autocomplete="email" value="${escapeHtml(appDetail.emails||"")}"></label>
      <label class="field"><span>Invite window</span><input value="1 day" disabled></label>
      <div class="te-wiz-foot">
        <button class="te-btn ghost" onclick="${back}">Cancel</button>
        <button class="te-btn" onclick="sendInvites()">Invite yourself</button>
      </div>
    </div>`;
}
function ensureMeBank(d){
  if(d.bank && d.bank.length) return d.bank;
  const qs = (d.questions && d.questions.length) ? d.questions : sampleQuestions(d.role||"this role");
  const bank = qs.map((q,i)=>{
    const coding = /written|code|coding/i.test(q.type||"");
    return {
      id:"q"+i,
      section: coding ? "Coding" : "Mcq",
      type: coding ? "CODE" : "MCQ",
      title: q.title,
      difficulty: i%4===0 ? "Med" : "Easy",
      mins: coding ? 30 : 1,
      stem: q.title,
      options: coding ? [] : [
        {k:"A", text:"The most practical production-safe choice for this role.", ok:true},
        {k:"B", text:"A faster shortcut that skips validation and review.", ok:false},
        {k:"C", text:"Defer the decision until after the launch date.", ok:false}
      ]
    };
  });
  if(!bank.some(q=>q.section==="Coding")){
    bank.push({id:"c1", section:"Coding", type:"CODE", title:"3D Geometry", difficulty:"Med", mins:30, stem:"Implement a helper that classifies points relative to a plane and returns the supporting test cases.", options:[]});
    bank.push({id:"c2", section:"Coding", type:"CODE", title:"Python error handling", difficulty:"Easy", mins:10, stem:"Write a small function that retries a flaky API call with backoff and logs the final error.", options:[]});
  }
  d.bank = bank;
  d.qIndex = d.qIndex||0;
  return bank;
}
function meVisualStep(){
  const i = wizard.step;
  if(i===0 || i===1) return 0;
  if(i===2) return 1;
  if(i===3) return 2;
  return 3;
}
function isShortAssessCreate(){
  return wizard?.kind==="assessment" && wizard.data?.build==="ai" && !fullProduct();
}
function isShortInterviewCreate(){
  return wizard?.kind==="interview" && !fullProduct();
}
function shortCreateVis(){
  if(!wizard) return 0;
  if(wizard.step==="done") return 3;
  if(wizard.data?.aiPhase==="creating") return 2;
  if(wizard.kind==="assessment" && wizard.step===4) return 3;
  if(wizard.kind==="interview" && wizard.step===INTERVIEW_STEPS.length-1) return 3;
  if(wizard.data?.aiPhase==="generator" || (wizard.kind==="interview" && wizard.step===0)) return 1;
  return 0;
}
function shortCreateStepsHtml(kind){
  const names = kind==="interview"
    ? ["Create Interview","Upload","Creating questions","Publish"]
    : ["Create Assessment","Upload","Creating questions","Publish"];
  const vis = shortCreateVis();
  return names.map((label,i)=>`<button class="mew-step ${i===vis?"on":""} ${i<vis?"done":""}" type="button" ${i===1&&vis!==2&&wizard.step!=="done"?`onclick="shortCreateBackToUpload()"`:"disabled"}><i>${i<vis?"✓":i+1}</i><span>${label}</span></button>`).join("");
}
function shortCreateBackToUpload(){
  if(!wizard || wizard.data?.aiPhase==="creating") return;
  if(wizard.kind==="assessment"){
    wizard.data.aiPhase = "generator";
    wizard.step = 0;
  } else {
    wizard.data.aiPhase = "";
    wizard.step = 0;
  }
  renderWorkspace();
}
function pickAssessBuild(mode){
  if(!wizard) return;
  wizard.data.build = mode;
  if(mode==="manual"){
    wizard.data.aiPhase = "";
    wizard.data.method = "blank";
    wizard.step = 1;
    renderWorkspace();
    return;
  }
  wizard.data.aiPhase = "generator";
  wizard.data.aiTab = wizard.data.aiTab || "jd";
  if(!wizard.data.jdId && !(wizard.data.jdText||"").trim()){
    applyJdToData(wizard.data, jdByRole(intentRole()), null, false);
  }
  wizard.step = 0;
  renderWorkspace();
  scheduleAutoAssessmentGeneration();
}
function scheduleAutoAssessmentGeneration(){
  if(demoReel || tour || !wizard || wizard.kind!=="assessment") return;
  if(autoGenerateTimer) clearTimeout(autoGenerateTimer);
  autoGenerateTimer = setTimeout(()=>{
    autoGenerateTimer = null;
    if(!wizard || wizard.kind!=="assessment" || wizard.data.build!=="ai" || wizard.data.aiPhase!=="generator" || !wizard.data.jdId) return;
    generateAiAssessment();
  }, AUTO_PAGE_WAIT);
}
function scheduleAutoInterviewGeneration(){
  if(demoReel || tour || !wizard || wizard.kind!=="interview") return;
  if(autoGenerateTimer) clearTimeout(autoGenerateTimer);
  autoGenerateTimer = setTimeout(()=>{
    autoGenerateTimer = null;
    if(!wizard || wizard.kind!=="interview" || wizard.data.ivSource!=="jd" || !wizard.data.jdId) return;
    if(wizard.data.aiPhase==="creating") return;
    generateAiInterview();
  }, AUTO_PAGE_WAIT);
}
function setAiTab(tab){
  if(!wizard) return;
  wizard.data.aiTab = tab;
  renderWorkspace();
}
function pasteSampleJd(){
  if(!wizard) return;
  const jd = jdByRole(intentRole());
  wizard.data.jdText = `${jd.role}\n\n${jd.excerpt}\n\nSkills: ${jd.skills.join(", ")}\nDuration: ${jd.duration} minutes.`;
  wizard.data.jdId = jd.id;
  wizard.data.jdFile = jd.file;
  renderWorkspace();
  if(!fullProduct() && wizard.kind==="interview") generateAiInterview();
  else if(!fullProduct() && wizard.kind==="assessment" && wizard.data.aiPhase==="generator") generateAiAssessment();
}
function onAiJdFile(ev){
  const f = ev.target.files && ev.target.files[0];
  if(!f || !wizard) return;
  const hit = SAMPLE_JDS.find(j => f.name.toLowerCase().includes(j.match) || f.name.toLowerCase().includes(j.id)) || jdByRole(intentRole());
  wizard.data.jdText = `${hit.role}\n\n${hit.excerpt}\n\nSkills: ${hit.skills.join(", ")}`;
  wizard.data.jdId = hit.id;
  wizard.data.jdFile = f.name;
  renderWorkspace();
  if(!fullProduct() && wizard.kind==="assessment" && wizard.data.aiPhase==="generator") generateAiAssessment();
}
function focusedJdCardHtml(j, selectedId){
  return `<button type="button" class="focused-jd ${selectedId===j.id?"on":""}" onclick="focusedSelectJd('${j.id}')">
    <span class="focused-jd-kind">${j.kind==="tech"?"Tech":"Non-tech"}</span>
    <b>${escapeHtml(j.role)}</b>
    <small>${escapeHtml(j.skills.slice(0,3).join(" · "))}</small>
    <span class="focused-jd-meta">${j.questions.length} questions · ${j.duration} min</span>
  </button>`;
}
function focusedDomainGroups(){
  const rolesByDomain = {
    product: ["spd", "pm", "uxeng"],
    engineering: ["swe", "fe", "be", "devops", "qa", "security", "ml"],
    data: ["da"],
    customer: ["csm", "sales", "account"],
    people: ["hrbp", "recruiter"],
    finance: ["finance"],
    marketing: ["marketing"],
    operations: ["operations", "project"]
  };
  const rolesFor = ids => ids.map(id => jdById(id)).filter(Boolean);
  return [
    {id:"all",label:"All Domains",roles:SAMPLE_JDS},
    {id:"product",label:"Product & design",roles:rolesFor(rolesByDomain.product)},
    {id:"engineering",label:"Engineering & IT",roles:rolesFor(rolesByDomain.engineering)},
    {id:"data",label:"Data & analytics",roles:rolesFor(rolesByDomain.data)},
    {id:"customer",label:"Customer & revenue",roles:rolesFor(rolesByDomain.customer)},
    {id:"people",label:"People & talent",roles:rolesFor(rolesByDomain.people)},
    {id:"finance",label:"Finance",roles:rolesFor(rolesByDomain.finance)},
    {id:"marketing",label:"Marketing & growth",roles:rolesFor(rolesByDomain.marketing)},
    {id:"operations",label:"Operations & delivery",roles:rolesFor(rolesByDomain.operations)}
  ];
}
function focusedDomainForRole(roleId){
  return focusedDomainGroups().find(group=>group.id!=="all" && group.roles.some(j=>j.id===roleId))?.id || "all";
}
function focusedChooseDomain(domain){
  if(!wizard?.data?.focusedCreate) return;
  if(!domain){
    wizard.data.focusedDomain = "";
    wizard.data.focusedRoleId = "";
    wizard.data.jdId = "";
    wizard.data.focusedAutoStart = false;
    renderWorkspace();
    return;
  }
  const group = focusedDomainGroups().find(item=>item.id===domain);
  if(!group) return;
  wizard.data.focusedDomain = group.id;
  wizard.data.focusedRoleId = "";
  wizard.data.jdId = "";
  wizard.data.focusedAutoStart = false;
  renderWorkspace();
}
function focusedRoleFocus(){
  if(!wizard?.data?.focusedCreate || wizard.data.focusedDomain) return;
  const roleSelect = document.getElementById("focusedRole");
  const roleError = document.getElementById("focusedRoleError");
  if(roleSelect) roleSelect.classList.add("focused-select-error");
  if(roleError) roleError.hidden = false;
}
function focusedRoleMouseDown(event){
  if(!wizard?.data?.focusedCreate || wizard.data.focusedDomain) return;
  event.preventDefault();
  focusedRoleFocus();
}
function focusedChooseRole(roleId){
  if(!wizard?.data?.focusedCreate) return;
  if(!wizard.data.focusedDomain){
    focusedRoleFocus();
    return;
  }
  const jd = jdById(roleId);
  if(!jd) return;
  wizard.data.focusedDomain = wizard.data.focusedDomain || focusedDomainForRole(roleId);
  wizard.data.focusedRoleId = roleId;
  wizard.data.focusedAutoStart = false;
  applyJdToData(wizard.data, jd, null, false);
  wizard.data.focusedCustomText = "";
  renderWorkspace();
}
function setFocusedFilter(filter){
  if(!wizard?.data?.focusedCreate) return;
  wizard.data.focusedFilter = filter;
  renderWorkspace();
}
function focusedSelectJd(id){
  if(!wizard?.data?.focusedCreate) return;
  const jd = jdById(id);
  if(!jd) return;
  if(autoGenerateTimer){ clearTimeout(autoGenerateTimer); autoGenerateTimer = null; }
  applyJdToData(wizard.data, jd, null, false);
  wizard.data.focusedCustomText = "";
  wizard.data.focusedAutoStart = false;
  focusedCreateAssessment();
}
function scheduleFocusedAssessmentGeneration(){
  if(!wizard?.data?.focusedCreate || wizard.data.aiPhase!=="focused") return;
  if(autoGenerateTimer) clearTimeout(autoGenerateTimer);
  wizard.data.focusedAutoStart = true;
  wizard.data.focusedAutoStartAt = Date.now() + AUTO_PAGE_WAIT;
  renderWorkspace();
  requestAnimationFrame(()=>showAppClickPointer(".focused-primary", "Creating soon"));
  toast("Your assessment will be created in 5 seconds.");
  autoGenerateTimer = setTimeout(()=>{
    autoGenerateTimer = null;
    if(!wizard?.data?.focusedCreate || wizard.data.aiPhase!=="focused") return;
    focusedCreateAssessment();
  }, AUTO_PAGE_WAIT);
}
function onFocusedJdFile(ev){
  const f = ev.target.files && ev.target.files[0];
  if(!f || !wizard?.data?.focusedCreate) return;
  const name = f.name.toLowerCase();
  const hit = SAMPLE_JDS.find(j => name.includes(j.match) || name.includes(j.id)) || jdByRole(intentRole());
  if(autoGenerateTimer) clearTimeout(autoGenerateTimer);
  applyJdToData(wizard.data, hit, f.name, false);
  wizard.data.focusedCustomText = "";
  wizard.data.focusedAutoStart = false;
  focusedCreateAssessment();
}
function focusedCreateAssessment(){
  if(!wizard?.data?.focusedCreate) return;
  const d = wizard.data;
  const custom = (document.getElementById("focusedJdText")?.value || d.focusedCustomText || "").trim();
  d.focusedCustomText = custom;
  if(custom){
    const jd = jdById(d.jdId) || jdByRole(d.role || intentRole());
    applyJdToData(d, jd, d.jdFile || "Uploaded job description", false);
    d.jdText = custom;
  }
  if(!d.jdId){
    toast("Choose a role template or upload a job description first.");
    return;
  }
  if(autoGenerateTimer) clearTimeout(autoGenerateTimer);
  d.focusedAutoStart = false;
  d.build = "ai";
  d.aiPhase = "generator";
  generateAiAssessment();
}
function focusedTogglePanel(panel){
  if(!wizard?.data?.focusedCreate) return;
  wizard.data.focusedPanel = wizard.data.focusedPanel===panel ? "" : panel;
  hideAppClickPointer();
  renderWorkspace();
}
function focusedBackToCreate(){
  if(!wizard?.data?.focusedCreate) return;
  wizard.data.aiPhase = "focused";
  wizard.data.focusedPanel = "";
  renderWorkspace();
  requestAnimationFrame(()=>showAppClickPointer(".focused-primary", "Create assessment"));
}
function generateAiAssessment(){
  if(!wizard) return;
  const text = (document.getElementById("wAiJd")?.value || wizard.data.jdText || "").trim();
  wizard.data.jdText = text;
  if(wizard.data.aiTab==="jd" && text.length<50 && !wizard.data.jdId){
    toast("Paste or upload a job description (50+ characters), or pick Sample JD.");
    return;
  }
  if(wizard.data.aiTab==="skills" && !(wizard.data.skills||"").trim()){
    toast("Add skills to generate from experience.");
    return;
  }
  if(aiCreateTimer) clearTimeout(aiCreateTimer);
  const gen = ++aiCreateGen;
  wizard.data.aiPhase = "creating";
  wizard.data.aiCreateAt = 0;
  wizard.data.aiPct = 12;
  wizard.data.aiCreateStartedAt = Date.now();
  wizard.data.aiCreateDeadline = Date.now() + 25000;
  renderWorkspace();
  const tick = i => {
    if(gen!==aiCreateGen || !wizard) return;
    wizard.data.aiCreateAt = i;
    wizard.data.aiPct = Math.min(100, [12,38,62,88,100][i]||100);
    renderWorkspace();
    if(i<4) aiCreateTimer = setTimeout(()=>tick(i+1), 5500);
    else aiCreateTimer = setTimeout(()=>{
      if(gen!==aiCreateGen || !wizard) return;
      const jd = jdById(wizard.data.jdId) || jdByRole(intentRole());
      applyJdToData(wizard.data, jd, wizard.data.jdFile, false);
      wizard.data.build = "ai";
      wizard.data.aiPhase = "";
      if(wizard.data.focusedCreate){
        wizard.data.aiPhase = "preview";
        wizard.data.focusedPanel = "";
        toast("Assessment ready. Review the defaults, then publish.");
        renderWorkspace();
        requestAnimationFrame(()=>showAppClickPointer(".focused-publish", "Publish assessment"));
      } else if(fullProduct()){
        wizard.step = 1;
        toast("AI generated the assessment. Continue through Basic Info, Questions, and Settings.");
        renderWorkspace();
      } else {
        publishAssessment();
      }
    }, 2600);
  };
  aiCreateTimer = setTimeout(()=>tick(0), 350);
}
function generateAiInterview(){
  if(!wizard) return;
  const text = (document.getElementById("wJdText")?.value || wizard.data.jdText || "").trim();
  wizard.data.jdText = text;
  if(wizard.data.ivSource==="jd" && text.length<50 && !wizard.data.jdId){
    toast("Paste or upload a job description, or pick Sample JD.");
    return;
  }
  if(wizard.data.ivSource==="skills" && !(wizard.data.skills||"").trim()){
    toast("Add skills to generate the interview.");
    return;
  }
  if(aiCreateTimer) clearTimeout(aiCreateTimer);
  const gen = ++aiCreateGen;
  wizard.data.aiPhase = "creating";
  wizard.data.aiCreateAt = 0;
  wizard.data.aiPct = 12;
  wizard.data.aiCreateStartedAt = Date.now();
  wizard.data.aiCreateDeadline = Date.now() + 25000;
  renderWorkspace();
  const tick = i => {
    if(gen!==aiCreateGen || !wizard) return;
    wizard.data.aiCreateAt = i;
    wizard.data.aiPct = Math.min(100, [12,38,62,88,100][i]||100);
    renderWorkspace();
    if(i<4) aiCreateTimer = setTimeout(()=>tick(i+1), 5500);
    else aiCreateTimer = setTimeout(()=>{
      if(gen!==aiCreateGen || !wizard) return;
      const jd = jdById(wizard.data.jdId) || jdByRole(wizard.data.role || intentRole());
      applyJdToData(wizard.data, jd, wizard.data.jdFile, true);
      wizard.data.aiPhase = "";
      if(fullProduct()){
        wizard.step = 1;
        toast("AI generated the interview. Continue through Configure, Persona, Topics, and Evaluation.");
        renderWorkspace();
      } else {
        publishInterview();
      }
    }, 2600);
  };
  aiCreateTimer = setTimeout(()=>tick(0), 350);
}
function meCta(){
  if(wizard?.data?.aiPhase==="creating") return {label:"Creating questions…", fn:"void 0"};
  if(wizard?.data?.aiPhase==="generator") return {label:"Generate Assessment", fn:"generateAiAssessment()"};
  if(!wizard?.data?.build) return {label:"Continue →", fn:"toast('Choose AI-Powered or Manual Creation.')"};
  const step = ASSESS_STEPS[wizard.step]?.id;
  if(step==="review") return {label:"Publish", fn:"publishAssessment()", green:true};
  if(step==="settings"){
    if(settingsTab==="setup") return {label:"Proctoring →", fn:"meSettingsNext()"};
    if(settingsTab==="proctoring") return {label:"Scoring →", fn:"meSettingsNext()"};
    if(settingsTab==="scoring") return {label:"Emails →", fn:"meSettingsNext()"};
    return {label:"Review →", fn:"meSettingsNext()"};
  }
  return {label:"Continue →", fn:"wizNext()"};
}
function meSettingsNext(){
  captureWizard();
  const order = ["setup","proctoring","scoring","emails"];
  const i = order.indexOf(settingsTab);
  if(i<order.length-1){ settingsTab = order[i+1]; renderWorkspace(); return; }
  wizNext();
}
function meSetExp(v){ wizard.data.experience = v; renderWorkspace(); }
function meSetWindow(v){ wizard.data.windowDays = v; renderWorkspace(); }
function mePickQ(i){ wizard.data.qIndex = i; renderWorkspace(); }
function meToggle(key){ wizard.data[key] = !wizard.data[key]; renderWorkspace(); }
function meWizardChrome(title, body){
  const short = isShortAssessCreate();
  const vis = short ? shortCreateVis() : meVisualStep();
  const names = [
    {label:"Basic Info", ico:"📄"},
    {label:"Questions", ico:"☰"},
    {label:"Settings", ico:"🛡"},
    {label:"Review", ico:"◉"}
  ];
  const cta = meCta();
  const first = short ? vis<=1 : (wizard.step===0 && wizard.data.aiPhase!=="generator");
  const steps = short
    ? shortCreateStepsHtml("assessment")
    : names.map((s,i)=>`<button class="mew-step ${i===vis?"on":""} ${i<vis?"done":""}" type="button" onclick="wizGoto(${i===0?1:i+1})"><i>${i<vis?"✓":s.ico}</i><span>${s.label}</span></button>`).join("");
  return `<div class="mew" data-tour="wizard">
    <div class="mew-head">
      <div class="mew-head-l">
        <button class="mew-x" type="button" aria-label="Close" onclick="appNav('meritedge')">×</button>
        <b>${title}</b>
      </div>
      <div class="mew-steps">${steps}</div>
      <div class="mew-head-r">
        <span class="mew-save">Saved just now</span>
        <button class="mew-back" type="button" ${first?"disabled style='opacity:.35'":""} onclick="wizBack()">← Back</button>
        <button class="mew-cta ${cta.green?"green":""}" type="button" ${wizard.data.aiPhase==="creating"?"disabled":""} onclick="${cta.fn}">${cta.label}</button>
      </div>
    </div>
    <div class="mew-body">${body}</div>
  </div>`;
}
function creatingScreenHtmlLegacy(title, steps, lines){
  const d = wizard.data;
  const at = d.aiCreateAt||0;
  const pct = d.aiPct||12;
  const secs = d.aiCreateDeadline ? Math.max(0, Math.ceil((d.aiCreateDeadline-Date.now())/1000)) : Math.min(59, at * 2 + 1);
  const creatingPreview = !!d.focusedCreate;
  const subject = title.includes("Interview") ? "interview" : "assessment";
  const slowSecs = Math.max(0, 7200 - Math.floor((Date.now() - (d.aiCreateStartedAt || Date.now())) / 1000));
  const slowTimer = [Math.floor(slowSecs / 3600), Math.floor((slowSecs % 3600) / 60), slowSecs % 60].map(n => String(n).padStart(2,"0")).join(":");
  const elapsedSeconds = d.aiCreateStartedAt ? Math.max(0, Math.floor((Date.now() - d.aiCreateStartedAt) / 1000)) : 0;
  const savedMinutes = Math.max(0, Math.floor((7200 - elapsedSeconds) / 60));
  const savedTime = `${Math.floor(savedMinutes / 60)}h ${String(savedMinutes % 60).padStart(2,"0")}m`;
  const outputItems = title.includes("Interview")
    ? ["3 topics mapped", "5 probes drafted", "Evaluation rubric ready"]
    : ["18 skills extracted", "5 questions calibrated", "Quality check passed"];
  const outputChips = outputItems.map((item,i)=>`<span class="${i<at?"done":i===at?"active":""}">${i<at?"OK":i===at?"LIVE":"WAIT"} ${item}</span>`).join("");
  const assessmentBenefits = [
    ["AI-powered assessment generation", "Create a complete assessment from the job description in seconds."],
    ["JD-based skill identification", "Surface the capabilities that matter most for this role."],
    ["Automated question selection", "Choose relevant questions with balanced skill coverage."]
  ];
  const benefits = assessmentBenefits.map(([label, detail], i)=>`<article class="cya-benefit"><i>${String(i+1).padStart(2,"0")}</i><div><b>${label}</b><p>${detail}</p></div></article>`).join("");
  const rows = steps.map((s,i)=>{
    return `<div class="cya-step ${i<at?"ok":i===at?"on":""}">
      <i>${i<at?"✓":i===at?"✦":""}</i>
      <div><b>${s.label}</b>${i<at?`<small class="cya-step-result">${outputItems[i]||"Complete"}</small>`:i===at?`<small>${s.sub}</small>`:""}</div>
    </div>`;
  }).join("");
  return `<div class="cya" data-tour="wizard">
    <div class="cya-glow a"></div><div class="cya-glow b"></div>
    <div class="cya-panel">
      <div class="cya-orb">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 3A2.5 2.5 0 0 0 7 5.2 2.5 2.5 0 0 0 4.6 7 2.5 2.5 0 0 0 4 9.5 2.5 2.5 0 0 0 5.4 12 2.5 2.5 0 0 0 7 14.6V16a2.5 2.5 0 0 0 2.5 2.5h.5V20h1.2v-1.2h1.6V20H14v-1.5h.5A2.5 2.5 0 0 0 17 16v-1.2A2.5 2.5 0 0 0 19.2 12 2.5 2.5 0 0 0 20 9.5 2.5 2.5 0 0 0 17.8 7 2.5 2.5 0 0 0 15.5 4.6 2.5 2.5 0 0 0 12.8 3H9.5z"/><path d="M12 7v9"/></svg>
        <span class="cya-time">✦ 0:${String(secs).padStart(2,"0")}</span>
      </div>
      <h1><span>✦</span> ${escapeHtml(title)} <span>✦</span></h1>
      <p class="cya-sub">${lines[Math.min(at, lines.length-1)]}</p>
      <div class="cya-compare" aria-label="Generation speed comparison">
        <article class="cya-compare-card slow">
          <div class="cya-compare-top"><span class="cya-compare-label">Other platforms</span><span class="cya-compare-icon">2h</span></div>
          <strong class="cya-compare-time">${slowTimer}</strong>
          <p>Manual setup, question review, and configuration</p>
          <div class="cya-slow-track"><i></i></div>
          <small>Still preparing...</small>
        </article>
        <div class="cya-compare-vs">VS</div>
        <article class="cya-compare-card fast">
          <div class="cya-compare-top"><span class="cya-compare-label">MeritEdge</span><span class="cya-compare-icon">25s</span></div>
          <strong class="cya-compare-time">00:${String(Math.min(25, secs)).padStart(2,"0")}</strong>
          <p>JD to skills to questions to ready ${subject}</p>
          <div class="cya-fast-track"><i style="width:${pct}%"></i></div>
          <small>Ready in seconds</small>
        </article>
      </div>
      <p class="cya-countdown">${creatingPreview?"Preparing your preview":"Auto-publishing"} in ${secs} seconds</p>
      <div class="cya-progress" aria-label="Assessment generation progress">
        <div class="cya-progress-meta"><span>Generation progress</span><b class="cya-pct">${pct}%</b></div>
        <div class="cya-track"><i style="width:${pct}%"></i></div>
      </div>
      ${title.includes("Assessment") ? `<div class="cya-why"><span>WHY MERITEDGE</span><b>From job description to a ready-to-use assessment in seconds.</b></div><div class="cya-benefits" aria-label="Assessment benefits">${benefits}</div>` : `<div class="cya-steps">${rows}</div>`}
      <div class="cya-fact">
        <i>💡</i>
        <div><b>Did you know?</b><p>Skills-based hiring increases diversity by 50% and reduces time-to-hire by 40%.</p></div>
      </div>
    </div>
  </div>`;
}
function creatingScreenHtml(title, steps, lines){
  const d = wizard.data;
  const at = d.aiCreateAt||0;
  const pct = d.aiPct||12;
  const secs = d.aiCreateDeadline ? Math.max(0, Math.ceil((d.aiCreateDeadline-Date.now())/1000)) : Math.min(59, at * 2 + 1);
  const creatingPreview = !!d.focusedCreate;
  const isInterview = title.includes("Interview");
  const subject = isInterview ? "interview" : "assessment";
  const outcomeHeadline = isInterview ? "AI interview ready to launch in seconds." : "published assessment in seconds.";
  const publishLabel = isInterview ? "AI interview ready to publish" : "Assessment ready to publish";
  const slowSecs = Math.max(0, 7200 - Math.floor((Date.now() - (d.aiCreateStartedAt || Date.now())) / 1000));
  const slowTimer = [Math.floor(slowSecs / 3600), Math.floor((slowSecs % 3600) / 60), slowSecs % 60].map(n => String(n).padStart(2,"0")).join(":");
  const elapsedSeconds = d.aiCreateStartedAt ? Math.max(0, Math.floor((Date.now() - d.aiCreateStartedAt) / 1000)) : 0;
  const savedMinutes = Math.max(0, Math.floor((7200 - elapsedSeconds) / 60));
  const savedTime = `${Math.floor(savedMinutes / 60)}h ${String(savedMinutes % 60).padStart(2,"0")}m`;
  const outputItems = isInterview
    ? ["3 topics mapped", "5 probes drafted", "Evaluation rubric ready"]
    : ["18 skills extracted", "5 questions calibrated", "Quality check passed"];
  const outputChips = outputItems.map((item,i)=>`<span class="${i<at?"done":i===at?"active":""}">${i<at?"OK":i===at?"LIVE":"WAIT"} ${item}</span>`).join("");
  const processingCopy = isInterview
    ? ["Reading your job description...","Extracting interview topics from the JD...","Preparing balanced interview probes...","Running the quality check...","Interview draft ready to review."][Math.min(at,4)]
    : ["Reading your job description...","Extracting skills from the JD...","Preparing balanced assessment questions...","Running the quality check...","Assessment ready to publish."][Math.min(at,4)];
  const skills = isInterview ? ["Technical depth","Communication","Judgment","+2 more"] : ["Product Strategy","Stakeholder Management","Data Analysis","Roadmapping","Analytical Thinking","+2 more"];
  const skillRevealCount = Math.min(skills.length, Math.max(1, at + 1));
  const skillHtml = skills.map((skill,i)=>`<span class="cya-skill-pill ${i<skillRevealCount?"revealed":""} ${i%3===1?"violet":""}">${skill}</span>`).join("");
  const questionRows = isInterview
    ? [["Scenario probe","Medium"],["Follow-up question","Easy"],["Role-specific case","Medium"],["Situational judgement","Medium"],["Evaluation checkpoint","Hard"]]
    : [["Scenario based question","Medium"],["Multiple choice question","Easy"],["Case study question","Medium"],["Situational judgement","Medium"],["Domain specific question","Hard"]];
  const questionRevealCount = at >= 3 ? questionRows.length : Math.max(1, at);
  const questionHtml = questionRows.map(([label, level], i)=>`<div class="cya-question-row ${i<questionRevealCount?"revealed":""}"><span class="cya-question-icon">&#9670;</span><span>${label}</span><em class="${level.toLowerCase()}">${level}</em></div>`).join("");
  const selected = jdById(d.jdId);
  const fileName = d.jdFileName || selected?.file || selected?.role || "Job Description.pdf";
  const questionCount = (d.questions||[]).length || 5;
  const duration = d.duration || selected?.duration || 45;
  const jdStatus = at===0 ? "Reading document..." : "JD understood";
  const engineStatus = at===0 ? "Waiting for JD" : at===1 ? "Extracting skills..." : at===2 ? "Sending skills to AI engine..." : "Skill map ready";
  const draftStatus = at<2 ? "Waiting for skill map" : at===2 ? "Preparing assessment..." : isInterview ? "Ready to launch" : "Ready to publish";
  return `<div class="cya cya-combined" data-tour="wizard">
    <div class="cya-glow a"></div><div class="cya-glow b"></div>
    <div class="cya-panel">
      <div class="cya-generation-brandbar">
        <img src="assets/otomeyt-ai-logo.svg" alt="Otomeyt AI">
        <div class="cya-generation-step"><b>2</b><span>Creating Your ${isInterview?"AI Interview":"Assessment"}</span></div>
      </div>
      <h1>From job description to <span class="cya-ready-word">${outcomeHeadline}</span></h1>
      <p class="cya-sub cya-invigilator-note"><span>Traditional invigilator-led setup takes hours of manual work.</span><b> MeritEdge AI builds a publish-ready ${subject} in seconds.</b></p>
      <div class="cya-processing-state" aria-live="polite"><span class="cya-processing-dot"></span><b>${processingCopy}</b></div>
      <div class="cya-compare" aria-label="Generation speed comparison">
        <article class="cya-compare-card slow">
          <div class="cya-compare-top"><span class="cya-compare-label">Other platforms</span><span class="cya-compare-icon">2h</span></div>
          <strong class="cya-compare-time">${slowTimer}</strong>
          <p>Manual setup, question review, and configuration</p>
          <div class="cya-slow-track"><i></i></div><small>Still preparing...</small>
        </article>
        <div class="cya-compare-vs">VS</div>
        <article class="cya-compare-card fast">
          <div class="cya-compare-top"><span class="cya-compare-label">MeritEdge</span><span class="cya-compare-icon">25s</span></div>
          <strong class="cya-compare-time">00:${String(Math.min(25, secs)).padStart(2,"0")}</strong>
          <p>JD to skills to questions to publish-ready ${subject}</p>
          <div class="cya-fast-track"><i style="width:${pct}%"></i></div><small>Ready in seconds</small>
        </article>
      </div>
      <p class="cya-countdown">Preparing your ${subject} for publish in ${secs} seconds</p>
      <div class="cya-progress" aria-label="Assessment generation progress">
        <div class="cya-progress-meta"><span>Generation progress</span><b class="cya-pct">${pct}%</b></div>
        <div class="cya-track"><i style="width:${pct}%"></i></div>
      </div>
      <div class="cya-preview-heading"><span>WHAT MERITEDGE IS BUILDING</span><b>From job description to a publish-ready ${subject} in seconds.</b></div>
      <div class="cya-output-grid cya-process-board">
        <article class="cya-output-card cya-jd-card ${at===0?"is-active":"is-done"}"><div class="cya-output-card-head"><span class="cya-output-icon">&#9633;</span><b>Job Description</b></div><div class="cya-document-icon"><span class="cya-document-sheet"><i></i><i></i><i></i><b>JD</b><em></em></span></div><strong>${escapeHtml(String(fileName))}</strong><small class="cya-flow-status">${jdStatus}</small></article>
        <div class="cya-flow-connector ${at>=1?"is-on":""}"><span>&rarr;</span><i></i></div>
        <article class="cya-output-card cya-skills-card ${at===1||at===2?"is-active":at>=3?"is-done":""}"><div class="cya-output-card-head"><span class="cya-output-icon cya-engine-icon">AI</span><b>AI skill engine</b></div><div class="cya-engine-core"><span>AI</span><i></i><i></i><i></i></div><div class="cya-skill-pills">${skillHtml}</div><small class="cya-flow-status">${engineStatus}</small></article>
        <div class="cya-flow-connector ${at>=2?"is-on":""}"><span>&rarr;</span><i></i></div>
        <article class="cya-output-card cya-questions-card ${at===2?"is-active":at>=3?"is-done":""}"><div class="cya-output-card-head"><span class="cya-output-icon">&#9776;</span><b>${publishLabel} <small>(Preview)</small></b></div><div class="cya-question-list">${questionHtml}</div><small class="cya-flow-status">${draftStatus}</small></article>
      </div>
    </div>
  </div>`;
}
function focusedCreateHtmlLegacy(){
  const d = wizard.data;
  const selected = jdById(d.jdId);
  const domainGroups = focusedDomainGroups();
  const activeDomain = d.focusedDomain || "";
  const activeGroup = domainGroups.find(group=>group.id===activeDomain);
  const activeRoleId = d.focusedRoleId || selected?.id || "";
  const availableRoles = activeGroup?.roles || [];
  const custom = d.focusedCustomText || "";
  const focusedUser = currentUser();
  const reportsPanel = accountReportsHtml(focusedUser, true);
  const focusedLogo = isPreviewUser(focusedUser) ? `<img src="assets/otomeyt-ai-logo.svg" alt="Otomeyt AI">` : "";
  const autoNote = d.focusedAutoStart
    ? "Selected. We’ll start creating your assessment in 5 seconds."
    : selected
      ? `Ready to create ${selected.role} with recommended defaults.`
      : "Choose a configured role or upload your own job description.";
  return `<div class="mew focused-create">
    <div class="focused-brandbar ${focusedLogo?"has-logo":""}">
      ${focusedLogo}
      <button class="focused-demo" type="button" onclick="beginProductTour()"><span class="focused-demo-play">&#9654;</span><span><b>See how it works</b><small>Watch the interactive demo</small></span></button>
    </div>
    <div class="focused-head">
      <div>
        <h1>Create your assessment</h1>
        <p>Pick a ready-to-use role setup or upload a job description. We’ll configure the questions, duration, scoring, and candidate settings for you.</p>
      </div>
    </div>
    ${reportsPanel}
    <div class="focused-body">
      <section class="focused-templates focused-role-picker">
        <span class="focused-kicker">Configured assessments</span>
        <h2>Select a Domain and Role</h2>
        <p>Choose a ready-made setup and we’ll create the assessment with recommended defaults.</p>
        <label class="focused-control-label" for="focusedDomain">Domain</label>
        <select id="focusedDomain" class="focused-select" onchange="focusedChooseDomain(this.value)">
          <option value="" ${!activeDomain?"selected":""} disabled>Select Domain</option>
          ${domainGroups.map(group=>`<option value="${group.id}" ${activeGroup?.id===group.id?"selected":""}>${escapeHtml(group.label)}</option>`).join("")}
        </select>
        <label class="focused-control-label" for="focusedRole">Role</label>
        <select id="focusedRole" class="focused-select" onmousedown="focusedRoleMouseDown(event)" onfocus="focusedRoleFocus()" onchange="focusedChooseRole(this.value)">
          <option value="" ${!activeRoleId?"selected":""} disabled>Select Role</option>
          ${availableRoles.map(j=>`<option value="${j.id}" ${activeRoleId===j.id?"selected":""}>${escapeHtml(j.role)}</option>`).join("")}
        </select>
        <div id="focusedRoleError" class="focused-field-error" role="alert" hidden>Please select domain first</div>
        <div class="focused-role-selected"><span>Selected setup</span><b>${escapeHtml(selected?.role || activeGroup?.roles.find(j=>j.id===activeRoleId)?.role || "Choose a role")}</b><small>Questions, duration, scoring, and candidate settings are prefilled.</small></div>
        <button class="focused-primary focused-role-create" type="button" onclick="focusedCreateAssessment()" ${d.focusedAutoStart || !selected?"disabled":""}>${d.focusedAutoStart?"Creating soon…":"Create assessment"} <span>→</span></button>
      </section>
      <aside class="focused-upload">
        <div class="focused-upload-icon">↑</div>
        <span class="focused-kicker">Your own role</span>
        <h2>Upload a job description</h2>
        <p>Use a PDF, DOC, DOCX, or TXT file and we’ll match it to the closest assessment setup.</p>
        <button class="focused-upload-btn" type="button" onclick="document.getElementById('focusedJdFile').click()">Upload JD</button>
        <input id="focusedJdFile" type="file" accept=".pdf,.doc,.docx,.txt" style="display:none" onchange="onFocusedJdFile(event)">
        <div class="focused-or"><span>or paste it here</span></div>
        <textarea id="focusedJdText" placeholder="Paste your job description..." oninput="wizard.data.focusedCustomText=this.value">${escapeHtml(custom)}</textarea>
        <small>Preview only · your file is not stored</small>
      </aside>
    </div>
    <div class="focused-bottom">
      <div><b>${selected ? escapeHtml(selected.role) : "No role selected"}</b><span>${autoNote}</span></div>
      <button class="focused-primary" type="button" onclick="focusedCreateAssessment()" ${d.focusedAutoStart?"disabled":""}>${d.focusedAutoStart?"Creating soon…":"Create assessment"} <span>→</span></button>
    </div>
  </div>`;
}
function focusedCreateHtml(){
  const d = wizard.data;
  const previewUser = currentUser();
  const previewLogin = previewUser?.kind === "preview" ? `<button class="focused-login" type="button" onclick="showView('login')">Log in</button>` : "";
  const selected = jdById(d.jdId);
  const domainGroups = focusedDomainGroups();
  const activeDomain = d.focusedDomain || "";
  const activeGroup = domainGroups.find(group=>group.id===activeDomain);
  const activeRoleId = d.focusedRoleId || selected?.id || "";
  const availableRoles = activeGroup?.roles || [];
  const custom = d.focusedCustomText || "";
  const roleName = selected?.role || activeGroup?.roles.find(j=>j.id===activeRoleId)?.role || "Choose a role";
  return `<div class="mew focused-create focused-create-v2">
    <div class="focused-brandbar has-logo">
      <img src="assets/otomeyt-ai-logo.svg" alt="Otomeyt AI">
      <div class="focused-brand-actions">${previewLogin}<div class="focused-step-badge"><b>1</b><span>Create Your Assessment</span></div></div>
    </div>
    <div class="focused-head">
      <div>
        <h1>Skip building every question <span>manually.</span></h1>
        <p>Upload a job description or pick a role &mdash; we&rsquo;ll create a role-mapped assessment with recommended questions, duration, scoring, and candidate settings.</p>
      </div>
    </div>
    <div class="focused-speed-compare" aria-label="Assessment generation speed comparison">
      <article class="focused-speed-card manual"><div class="focused-speed-icon">◷</div><div><b>Manual setup</b><small>Write questions · Set scoring · Configure rules</small><strong>Typically takes <em>hours</em></strong></div></article>
      <span class="focused-speed-vs">VS</span>
      <article class="focused-speed-card merit"><div class="focused-speed-icon">ϟ</div><div><b>MeritEdge</b><small>Generate a role-mapped draft</small><strong>Ready in <em>seconds</em></strong></div></article>
    </div>
    <p class="focused-speed-note">Illustrative comparison; actual setup time varies by role.</p>
    <div class="focused-body">
      <aside class="focused-upload">
        <div class="focused-upload-icon">↑</div>
        <span class="focused-kicker">Your own role</span>
        <h2>Upload a job description</h2>
        <p>Use a PDF, DOC, DOCX, or TXT file and we&rsquo;ll match it to the closest assessment setup.</p>
        <button class="focused-upload-btn" type="button" onclick="document.getElementById('focusedJdFile').click()">Upload JD</button>
        <input id="focusedJdFile" type="file" accept=".pdf,.doc,.docx,.txt" style="display:none" onchange="onFocusedJdFile(event)">
        <div class="focused-or"><span>or paste it here</span></div>
        <textarea id="focusedJdText" placeholder="Paste your job description..." oninput="wizard.data.focusedCustomText=this.value">${escapeHtml(custom)}</textarea>
        <small>Preview only · your file is not stored</small>
      </aside>
      <section class="focused-templates focused-role-picker">
        <span class="focused-kicker">Configured assessments</span>
        <h2>Select a Domain and Role</h2>
        <p>Choose a ready-made setup and we&rsquo;ll create the assessment with recommended defaults.</p>
        <label class="focused-control-label" for="focusedDomain">Domain</label>
        <select id="focusedDomain" class="focused-select" onchange="focusedChooseDomain(this.value)">
          <option value="" ${!activeDomain?"selected":""} disabled>Select Domain</option>
          ${domainGroups.map(group=>`<option value="${group.id}" ${activeGroup?.id===group.id?"selected":""}>${escapeHtml(group.label)}</option>`).join("")}
        </select>
        <label class="focused-control-label" for="focusedRole">Role</label>
        <select id="focusedRole" class="focused-select" onmousedown="focusedRoleMouseDown(event)" onfocus="focusedRoleFocus()" onchange="focusedChooseRole(this.value)">
          <option value="" ${!activeRoleId?"selected":""} disabled>Select Role</option>
          ${availableRoles.map(j=>`<option value="${j.id}" ${activeRoleId===j.id?"selected":""}>${escapeHtml(j.role)}</option>`).join("")}
        </select>
        <div id="focusedRoleError" class="focused-field-error" role="alert" hidden>Please select domain first</div>
        <div class="focused-role-selected"><span>Selected setup</span><b>${escapeHtml(roleName)}</b><small>Questions, duration, scoring, and candidate settings are prefilled.</small></div>
        <button class="focused-primary focused-role-create" type="button" onclick="focusedCreateAssessment()" ${d.focusedAutoStart || !selected?"disabled":""}>${d.focusedAutoStart?"Creating soon…":"Generate my assessment"} <span>→</span></button>
      </section>
    </div>
  </div>`;
}
function focusedDetailsModalHtml(d,qs){
  const questionCards = qs.map((q,i)=>"<article class='focused-modal-qcard'><i>"+String(i+1).padStart(2,"0")+"</i><div><b>"+escapeHtml(q.type||"Question")+"</b><h4>"+escapeHtml(q.title||"Assessment question")+"</h4><small>Scored response</small></div></article>").join("");
  const assessmentName = escapeHtml(d.name||"Configured assessment");
  const proctoring = "<div class='focused-modal-proctoring'><div class='focused-modal-proctoring-head'><div><span class='focused-modal-shield'>◈</span><h3>Security &amp; Proctoring</h3></div><span>3 features</span></div><div class='focused-modal-proctoring-label'>◉ IN-TEST MONITORING</div><div class='focused-modal-proctoring-row'><i>◉</i><b>Webcam monitoring</b><small>Enabled</small><strong>&check;</strong></div><div class='focused-modal-proctoring-row'><i>▣</i><b>Tab switch detection</b><small>Enabled</small><strong>&check;</strong></div><div class='focused-modal-proctoring-row'><i>▢</i><b>Copy/paste block</b><small>Enabled</small><strong>&check;</strong></div><div class='focused-modal-violations'><span>VIOLATION HANDLING</span><div><b>6<small>MAX WARNINGS</small></b><b>Auto submit<small>ON MAX VIOLATIONS</small></b></div></div></div>";
  return "<div class='focused-modal-backdrop' role='presentation' onclick='focusedTogglePanel(\"details\")'><section class='focused-detail-modal' role='dialog' aria-modal='true' aria-labelledby='focused-details-title' onclick='event.stopPropagation()'>"+
    "<div class='focused-modal-header'><div><span class='focused-kicker'>Assessment details</span><p>Your assessment is configured and ready for candidates.</p></div><button class='focused-modal-close' type='button' aria-label='Close assessment details' onclick='focusedTogglePanel(\"details\")'>&times;</button></div>"+
    "<div class='focused-modal-layout'><section class='focused-modal-blueprint'><div class='focused-modal-section-head'><div><span class='focused-modal-eyebrow'>ASSESSMENT BLUEPRINT</span><h3>Question set</h3><p>Focused questions selected for this role.</p></div><span class='focused-modal-count'>"+qs.length+" questions</span></div><div class='focused-modal-question-grid'>"+questionCards+"</div></section>"+
    "<aside class='focused-modal-ready'><div class='focused-modal-ready-head'><span class='focused-modal-check'>&check;</span><div><h3>Assessment published</h3><p>Ready for your candidate invite.</p></div><strong>100%</strong></div><div class='focused-modal-checklist'><div><i>&check;</i><span><b>Assessment name</b><small>"+assessmentName+"</small></span></div><div><i>&check;</i><span><b>Questions added</b><small>"+qs.length+" questions</small></span></div><div><i>&check;</i><span><b>Duration calculated</b><small>Configured assessment duration</small></span></div></div>"+proctoring+"</aside></div>"+
    "</section></div>";
}
function focusedDetailsModalHtmlV2(d,qs){
  const skillLabels = String(d.skills||"").split(",").map(skill=>skill.trim()).filter(Boolean);
  const questionCards = qs.map((q,i)=>{
    const skill = skillLabels[i % Math.max(skillLabels.length,1)] || "Role alignment";
    const type = String(q.type||((i % 2) ? "Written" : "MCQ")).toUpperCase();
    return "<article class='focused-modal-v2-qcard "+(i===0?"is-highlighted":"")+"'><i>"+String(i+1).padStart(2,"0")+"</i><div class='focused-modal-v2-qbody'><div class='focused-modal-v2-qmeta'><b>"+escapeHtml(type)+"</b><span>"+escapeHtml(skill)+"</span></div><h4>"+escapeHtml(q.title||"Assessment question")+"</h4></div></article>";
  }).join("");
  const questionSkill = skillLabels[0] || "role-aligned skills";
  const proctoring = "<section class='focused-modal-v2-proctoring'><div class='focused-modal-v2-side-head'><div><span class='focused-modal-v2-shield'>&#9670;</span><h3>Security &amp; Proctoring</h3></div><span>3 features</span></div><div class='focused-modal-v2-info'><b>&#9432;</b><span>Review monitoring settings before inviting candidates.</span></div><div class='focused-modal-v2-monitor-label'>IN-TEST MONITORING</div><div class='focused-modal-v2-monitor-row'><i>&#9673;</i><b>Webcam monitoring</b><small>Enabled</small><strong>&check;</strong></div><div class='focused-modal-v2-monitor-row'><i>&#9633;</i><b>Tab switch detection</b><small>Enabled</small><strong>&check;</strong></div><div class='focused-modal-v2-monitor-row'><i>&#9635;</i><b>Copy/paste block</b><small>Enabled</small><strong>&check;</strong></div></section>";
  return "<div class='focused-modal-backdrop' role='presentation' onclick='focusedTogglePanel(\"details\")'><section class='focused-detail-modal focused-modal-v2' role='dialog' aria-modal='true' aria-labelledby='focused-details-title' onclick='event.stopPropagation()'>"+
    "<div class='focused-modal-v2-header'><div class='focused-modal-v2-title-wrap'><div class='focused-modal-v2-step'><span>2</span><b>ASSESSMENT DETAILS</b></div><h2 id='focused-details-title'>Review the <em>skill coverage</em> without manually checking every question.</h2><p>See how each question maps to the key skills from the role description.</p></div><button class='focused-modal-close' type='button' aria-label='Close assessment details' onclick='focusedTogglePanel(\"details\")'>&times;</button></div>"+
    "<div class='focused-modal-v2-layout'><section class='focused-modal-v2-blueprint'><div class='focused-modal-v2-blueprint-head'><span>ASSESSMENT BLUEPRINT</span><strong>"+qs.length+" questions</strong></div><div class='focused-modal-v2-question-list'>"+questionCards+"</div></section><aside class='focused-modal-v2-sidebar'><section class='focused-modal-v2-why'><div class='focused-modal-v2-side-head'><div><span class='focused-modal-v2-spark'>&#10022;</span><h3>Why this question?</h3></div><button type='button' aria-label='Close explanation' onclick='focusedTogglePanel(\"details\")'>&times;</button></div><p>It checks <b>"+escapeHtml(questionSkill)+"</b> from the role description.</p><p>Evaluates your ability to choose the right metric to investigate growth and retention trends.</p></section>"+proctoring+"</aside></div>"+
    "</section></div>";
}
function focusedPreviewHtmlLegacy(){
  const d = wizard.data;
  const qs = d.questions || [];
  const panel = d.focusedPanel || "";
  const detailsPanelHtml = panel==="details" ? focusedDetailsModalHtml(d,qs) : "";
  const panelHtml = panel==="questions"
    ? `<section class="focused-detail-panel"><div class="focused-detail-head"><div><span class="focused-kicker">Included by default</span><h2>Questions</h2></div><button type="button" onclick="focusedTogglePanel('questions')">Close</button></div>${qs.map((q,i)=>`<div class="focused-question"><span>${String(i+1).padStart(2,"0")}</span><div><b>${escapeHtml(q.type||"Question")}</b><p>${escapeHtml(q.title||"")}</p></div></div>`).join("")}</section>`
    : panel==="settings"
      ? `<section class="focused-detail-panel"><div class="focused-detail-head"><div><span class="focused-kicker">Recommended defaults</span><h2>Settings</h2></div><button type="button" onclick="focusedTogglePanel('settings')">Close</button></div><div class="focused-settings"><div><b>Duration</b><span>${escapeHtml(String(d.duration||45))} minutes</span></div><div><b>Passing score</b><span>${escapeHtml(String(d.pass||70))}%</span></div><div><b>Integrity</b><span>Webcam and tab monitoring on</span></div><div><b>Candidate experience</b><span>Randomized question order</span></div></div></section>`
      : "";
  return `<div class="mew focused-preview">
    <div class="focused-head">
      <div><h1>Assessment has been published</h1><p>Your assessment is ready. View the details or invite someone to take the assessment.</p></div>
      <button class="focused-skip" type="button" onclick="focusedBackToCreate()">← Change role</button>
    </div>
    <div class="focused-preview-card">
      <div class="focused-preview-mark">✓</div>
      <div class="focused-preview-copy"><span class="focused-kicker">Published assessment</span><h2>${escapeHtml(d.name||"Assessment")}</h2><p>${escapeHtml(d.description||`A role-specific assessment for ${d.role||"your next hire"}.`)}</p><div class="focused-meta"><span>${qs.length} questions</span><span>${escapeHtml(String(d.duration||45))} min</span><span>${escapeHtml(d.role||"Configured role")}</span></div></div>
    </div>
    <div class="focused-details-below"><button type="button" onclick="focusedTogglePanel('details')">See assessment details</button></div>
    <div class="focused-skill-row">${skills.slice(0,6).map(s=>`<span>${escapeHtml(s)}</span>`).join("")}</div>
    <div class="focused-review-actions"><div class="focused-review-copy"><span>Ready to launch</span><small>Publish the assessment and invite yourself in one step.</small></div><div class="focused-review-tools"><button type="button" onclick="focusedTogglePanel('questions')">View questions <span>${qs.length}</span></button><button type="button" onclick="focusedTogglePanel('settings')">View settings</button><button class="focused-publish" type="button" onclick="publishAssessment({openInvite:true})">Publish assessment &amp; invite <span>→</span></button></div></div>
    <div class="focused-published-actions"><div class="focused-review-copy"><span>Assessment published</span><small>Choose what you want to do next.</small></div><div class="focused-invite-note">Click on the Invite button to experience the assessment.</div><div class="focused-review-tools"><button type="button" onclick="focusedTogglePanel('details')">See assessment details</button><button class="focused-publish" type="button" onclick="publishAssessment({openInvite:true})">Invite <span>â†’</span></button></div></div>
    ${detailsPanelHtml || panelHtml}
    <div class="focused-next"><span>Next step after publishing</span><b>Invite yourself to try the candidate experience</b><small>We’ll take you to the invite page after publishing.</small></div>
  </div>`;
}
function focusedPreviewHtml(){
  const d = wizard.data;
  const qs = d.questions || [];
    const panel = d.focusedPanel || "";
  const detailsPanelHtml = panel==="details" ? focusedDetailsModalHtml(d,qs) : "";
  const panelHtml = panel==="questions"
    ? `<section class="focused-detail-panel"><div class="focused-detail-head"><div><span class="focused-kicker">Included by default</span><h2>Questions</h2></div><button type="button" onclick="focusedTogglePanel('questions')">Close</button></div>${qs.map((q,i)=>`<div class="focused-question"><span>${String(i+1).padStart(2,"0")}</span><div><b>${escapeHtml(q.type||"Question")}</b><p>${escapeHtml(q.title||"")}</p></div></div>`).join("")}</section>`
    : panel==="settings"
      ? `<section class="focused-detail-panel"><div class="focused-detail-head"><div><span class="focused-kicker">Recommended defaults</span><h2>Settings</h2></div><button type="button" onclick="focusedTogglePanel('settings')">Close</button></div><div class="focused-settings"><div><b>Duration</b><span>${escapeHtml(String(d.duration||45))} minutes</span></div><div><b>Passing score</b><span>${escapeHtml(String(d.pass||70))}%</span></div><div><b>Integrity</b><span>Webcam and tab monitoring on</span></div><div><b>Candidate experience</b><span>Randomized question order</span></div></div></section>`
      : "";
  const publishedId = wizard.publishedId || "";
  const inviteAction = `openPostPublishInvite('assessment','${publishedId}')`;
  const aboutCopy = d.description || `Generated from ${d.jdFile || "your job description"}. A focused assessment configured for the ${d.role || "selected role"}.`;
  const skillPills = (skills.length ? skills : ["Role depth", "Communication", "Problem solving", "Domain knowledge"])
    .slice(0,4)
    .map(skill=>`<span>${escapeHtml(skill)}</span>`)
    .join("");
  return `<div class="mew focused-preview published-page-shell">
    <main class="published-page-main">
      <header class="published-page-hero">
        <div>
          <span class="published-page-kicker">Published</span>
          <h1>Your assessment is ready to <span>invite your first candidate</span></h1>
          <p>Your assessment is published and ready. View the details or invite your first candidate to take the assessment.</p>
          <div class="published-page-actions">
            <button class="published-page-secondary" type="button" onclick="focusedTogglePanel('details')"><span>◉</span> View Assessment details</button>
            <button class="published-page-primary" type="button" onclick="${inviteAction}"><span>♙</span> Invite candidate</button>
          </div>
        </div>
        <button class="focused-skip published-page-change" type="button" onclick="focusedBackToCreate()">&#8592; Change role</button>
      </header>
      <section class="published-page-stats">
        <div class="published-stat"><span class="published-stat-icon">▣</span><strong>${qs.length || 5}</strong><small>questions</small></div>
        <div class="published-stat"><span class="published-stat-icon">◷</span><strong>${escapeHtml(String(d.duration||45))}</strong><small>minutes</small></div>
        <div class="published-stat published-skills"><span class="published-stat-icon">▥</span><div><strong>Skills covered</strong><div class="published-skill-pills">${skillPills}</div></div></div>
      </section>
      <section class="published-page-about"><span class="published-about-icon">◉</span><div><h2>About this assessment</h2><p>${escapeHtml(aboutCopy)}</p></div></section>
      ${detailsPanelHtml || panelHtml}
    </main>
  </div>`;
}
function focusedPublishedReferenceHtml(){
  const d = wizard.data;
  const qs = d.questions || [];
  const panel = d.focusedPanel || "";
  const detailsPanelHtml = panel==="details" ? focusedDetailsModalHtmlV2(d,qs) : "";
  const publishedId = wizard.publishedId || "";
  const inviteAction = `openPostPublishInvite('assessment','${publishedId}')`;
  const questionCount = qs.length || 5;
  const duration = String(d.duration||45);
  const aboutCopy = d.description || `Generated from ${d.jdFile || "your job description"}. A focused assessment configured for the ${d.role || "selected role"}.`;
  return `<div class="mew focused-preview published-page-shell">
    <main class="published-reference-main">
      <div class="published-reference-topline">
        <img class="published-reference-logo" src="assets/otomeyt-ai-logo.svg" alt="Otomeyt AI">
        <div class="published-reference-step"><span>3</span><b>Assessment published</b></div>
      </div>
      <header class="published-reference-hero">
        <div>
          <span class="published-page-kicker">Published assessment</span>
          <h1>Your assessment is ready to <span>invite your first candidate</span></h1>
          <p>Your assessment is published and ready. View the details or invite your first candidate to take the assessment.</p>
        </div>
        <button class="focused-skip published-page-change" type="button" onclick="focusedBackToCreate()">&larr; Change role</button>
      </header>
        <article class="published-reference-card">
        <div class="published-reference-card-copy">
          <div class="published-reference-check">&check;</div>
          <div>
            <span class="published-page-kicker">Published assessment</span>
            <h2>${escapeHtml(d.name||"Assessment")}</h2>
            <p>${escapeHtml(aboutCopy)}</p>
            <div class="published-reference-meta"><span>${questionCount} questions</span><span>${escapeHtml(duration)} minutes</span><span>${escapeHtml(d.role||"Configured role")}</span></div>
          </div>
        </div>
        <div class="published-reference-actions">
          <button class="published-page-secondary" type="button" onclick="focusedTogglePanel('details')"><span>&#9673;</span> View Assessment details</button>
          <button class="published-page-primary" type="button" onclick="${inviteAction}"><span>&#10148;</span> Invite a candidate</button>
        </div>
      </article>
      ${detailsPanelHtml}
    </main>
  </div>`;
}
function renderAssessWizard(){
  const d = wizard.data;
  d.experience = d.experience || "Senior";
  d.windowDays = d.windowDays || "30d";
  d.instructions = d.instructions || "";
  const bank = ensureMeBank(d);
  if(d.aiPhase==="creating"){
    const steps = [
      {label:"Analyzing Job Description", sub:"Understanding requirements"},
      {label:"Matching Skills & Questions", sub:"Selecting relevant questions"},
      {label:"Generating Custom Questions", sub:"Identifying knowledge gaps"},
      {label:"Finalizing Assessment", sub:"Preparing your assessment"}
    ];
    return creatingScreenHtml("Creating Your Assessment", steps, ["Reading the job description...","Selecting questions...","Selecting questions...","Preparing your assessment","Finishing up..."]);
  }
  if(d.focusedCreate && d.aiPhase==="focused") return focusedCreateHtml();
  if(d.focusedCreate && d.aiPhase==="preview") return focusedPublishedReferenceHtml();
  if(!d.build || d.aiPhase==="choose"){
    return meWizardChrome("Create Assessment", `<div class="mec">
      <h2>Choose how you'd like to build your assessment</h2>
      <p>AI generates from a job description. Manual lets you pick every question.</p>
      <div class="mec-grid">
        <article class="mec-card ai">
          <div class="mec-ico">🧠</div>
          <h3>AI-Powered</h3>
          <p class="sub">Let AI analyze your requirements and generate questions</p>
          <ul>
            <li>From Job Description to Skills</li>
            <li>Auto-selects questions</li>
            <li>One-click configuration</li>
          </ul>
          <div class="mec-mins">2–3 minutes</div>
          <button class="mec-go" type="button" onclick="pickAssessBuild('ai')">✦ Start with AI</button>
        </article>
        <article class="mec-card man">
          <div class="mec-ico">📄</div>
          <h3>Manual Creation</h3>
          <p class="sub">Choose specific questions and customize every detail yourself</p>
          <ul>
            <li>Choose specific questions</li>
            <li>Full control</li>
            <li>Step-by-step</li>
          </ul>
          <div class="mec-mins">8–10 minutes</div>
          <button class="mec-go" type="button" onclick="pickAssessBuild('manual')">Start Manual</button>
        </article>
      </div>
      <div class="mec-quick">
        <label>Quick Start Templates</label>
        <div class="mec-quick-row">
          <button type="button" onclick="wizUseTemplate('Senior Product Designer')">Senior Product Designer</button>
          <button type="button" onclick="wizUseTemplate('Software Engineer')">Software Engineer</button>
          <button type="button" onclick="wizUseTemplate('Data Analyst')">Data Analyst</button>
        </div>
      </div>
    </div>`);
  }
  if(d.build==="ai" && d.aiPhase==="generator"){
    const text = d.jdText||"";
    const n = text.length;
    const full = fullProduct();
    return meWizardChrome("Create Assessment", `<div class="meg">
      <div class="meg-title"><i>${full?"🧠":"📄"}</i> ${full?"AI Assessment Generator":"Upload a job description"}</div>
      ${full?`<div class="meg-tabs">
        <button type="button" class="${d.aiTab!=="skills"?"on":""}" onclick="setAiTab('jd')">From Job Description</button>
        <button type="button" class="${d.aiTab==="skills"?"on":""}" onclick="setAiTab('skills')">From Skills & Experience</button>
      </div>`:`<p class="te-note" style="margin:0 0 12px">Select a job description. Questions are created and published for you, and you can still read them.</p>`}
      ${full && d.aiTab==="skills"
        ? `<label class="mew-lab">Skills & experience</label>
           <input class="mew-in" id="wSkills" value="${escapeHtml(d.skills||"")}" placeholder="React, Python, SQL, stakeholder management…">
           <p class="te-note">AI will map these skills to a question bank for ${escapeHtml(d.role||intentRole())}.</p>`
        : `<div class="meg-box">
            <div class="meg-tools">
              <button type="button" onclick="document.getElementById('aiJdFile').click()">Upload</button>
              <button type="button" onclick="pasteSampleJd()">Paste</button>
              <button type="button" onclick="pasteSampleJd()">Sample JD</button>
            </div>
            <input id="aiJdFile" type="file" accept=".pdf,.doc,.docx,.txt" style="display:none" onchange="onAiJdFile(event)">
            <textarea id="wAiJd" placeholder="Paste or upload your job description. Supports TXT, PDF, and DOCX files." oninput="wizard.data.jdText=this.value;document.getElementById('aiJdCount').textContent=this.value.length+'/50 min'">${escapeHtml(text)}</textarea>
            <div class="meg-count"><span>Supports TXT, PDF, DOCX</span><span id="aiJdCount">${n}/50 min</span></div>
          </div>
          ${jdPickerHtml(d.jdId, d.jdParsing)}`}
      <button class="meg-go" type="button" onclick="generateAiAssessment()">${full?"Generate Assessment":"Create questions →"}</button>
    </div>`);
  }
  if(wizard.step==="done"){
    const a = assessments.find(x=>x.id===wizard.publishedId);
    const qs = a?.questions || wizard.data.questions || [];
    const title = a?.title || wizard.data.name || "Assessment";
    const role = a?.role || wizard.data.role || "";
    const duration = a?.duration || (wizard.data.duration ? wizard.data.duration+" min" : "");
    const cards = qs.map((q,i)=>{
      const kind = (q.type||"Q").toUpperCase();
      return `<article class="pubq ${kind==="MCQ"?"mcq":"written"}">
        <div class="pubq-n">${String(i+1).padStart(2,"0")}</div>
        <div>
          <em>${escapeHtml(q.type||"Question")}</em>
          <p>${escapeHtml(q.title||"")}</p>
        </div>
      </article>`;
    }).join("");
    const redirectNotice = publishInviteSeconds > 0
      ? `<div class="aha-live pub-redirect pub-success-banner" role="status"><i>OK</i><div><b>Assessment published</b><span>Redirecting to Invite yourself in ${publishInviteSeconds} seconds...</span></div><strong>${publishInviteSeconds}s</strong></div>`
      : "";
    return `<div class="mew me-published">
      ${redirectNotice}
      <header class="pub-hero">
        <div class="pub-mark">✓</div>
        <div class="pub-copy">
          <span class="pub-ok">Published</span>
          <h2>${escapeHtml(title)}</h2>
          <div class="pub-meta">
            <span>${qs.length} questions</span>
            ${duration?`<span>${escapeHtml(String(duration))}</span>`:""}
            ${role?`<span>${escapeHtml(role)}</span>`:""}
          </div>
        </div>
        <div class="pub-actions">
          <button class="te-btn ghost" type="button" onclick="openAssessment('${a?.id||""}')">I'll do it later</button>
          <button class="mew-cta" type="button" onclick="startInvite('assessment','${a?.id||""}')">Invite yourself</button>
        </div>
      </header>
      <div class="pub-grid">${cards}</div>
    </div>`;
  }
  const step = ASSESS_STEPS[wizard.step].id;
  let body = "";
  if(step==="method" || step==="basic"){
    const skills = String(d.skills||"").split(",").map(s=>s.trim()).filter(Boolean);
    body = `<div class="mew-form">
      ${step==="method"?`<div class="mew-card" data-tour="jd">
        <h3>Start from a job description</h3>
        <div class="te-choice" style="margin:0">
          <button type="button" class="${d.method==="jd"?"on":""}" onclick="wizSetMethod('jd')"><b>Upload JD</b><span>AI fills the bank</span></button>
          <button type="button" class="${d.method==="template"?"on":""}" onclick="wizSetMethod('template')"><b>Template</b><span>Sample role</span></button>
          <button type="button" class="${d.method==="blank"?"on":""}" onclick="wizSetMethod('blank')"><b>Start blank</b><span>Name it yourself</span></button>
        </div>
        ${d.method==="jd"?jdPickerHtml(d.jdId, d.jdParsing):""}
      </div>`:""}
      <div>
        <label class="mew-lab">Assessment Name <em>*</em></label>
        <input class="mew-in" id="wName" value="${escapeHtml(d.name)}" placeholder="e.g., Senior React Developer Assessment">
        ${d.name?"":`<p class="mew-hint">Assessment name is required</p>`}
      </div>
      <div class="mew-row2">
        <div>
          <label class="mew-lab">Role / Position</label>
          <input class="mew-in" id="wRole" value="${escapeHtml(d.role)}" placeholder="e.g., Frontend Developer">
        </div>
        <div>
          <label class="mew-lab">Experience</label>
          <div class="mew-exp">${[["Entry","0-2 yrs"],["Mid","2-5 yrs"],["Senior","5-8 yrs"],["Expert","8+ yrs"]].map(([id,sub])=>`<button type="button" class="${d.experience===id?"on":""}" onclick="meSetExp('${id}')">${id}<small>${sub}</small></button>`).join("")}</div>
        </div>
      </div>
      <div>
        <label class="mew-lab">Skills to Assess</label>
        <input class="mew-in" id="wSkills" value="${escapeHtml(d.skills||"")}" placeholder="Type skill name (React, Python, SQL...)">
        <div class="mew-chips">${skills.map(s=>`<span>${escapeHtml(s)}</span>`).join("")}</div>
      </div>
      <div>
        <label class="mew-lab">Description</label>
        <div class="mew-editor">
          <div class="mew-toolbar">B &nbsp; I &nbsp; • &nbsp; Size &nbsp; px &nbsp; H+ &nbsp; <b>✦ AI format</b></div>
          <textarea class="mew-area" id="wDesc" placeholder="Describe the purpose and scope of this assessment...">${escapeHtml(d.description||"")}</textarea>
        </div>
        <div class="mew-footlink"><span>${(d.description||"").length} characters</span><span>Candidate Instructions <button type="button">Auto generate</button></span></div>
      </div>
    </div>`;
  } else if(step==="questions"){
    const qi = Math.min(d.qIndex||0, bank.length-1);
    const q = bank[qi] || bank[0];
    const mcq = bank.filter(x=>x.section==="Mcq");
    const code = bank.filter(x=>x.section==="Coding");
    const mins = bank.reduce((s,x)=>s+(x.mins||1),0);
    body = `<div class="mew-qwrap">
      <aside class="mew-qside">
        <div class="mew-qmeta">${bank.length} questions · ${mins}m · 2 sections</div>
        <div class="mew-sec"><button type="button">▾ Mcq <em>${mcq.length}</em></button>
          ${mcq.map(item=>`<button class="mew-qitem ${item.id===q.id?"on":""}" type="button" onclick="mePickQ(${bank.indexOf(item)})"><span>MCQ</span> ${escapeHtml(item.title.slice(0,28))}${item.title.length>28?"…":""} <small>${item.difficulty} · ${item.mins}m</small></button>`).join("")}
        </div>
        <div class="mew-sec"><button type="button">▾ Coding <em>${code.length}</em></button>
          ${code.map(item=>`<button class="mew-qitem ${item.id===q.id?"on":""}" type="button" onclick="mePickQ(${bank.indexOf(item)})"><span>CODE</span> ${escapeHtml(item.title.slice(0,24))} <small>${item.difficulty} · ${item.mins}m</small></button>`).join("")}
        </div>
      </aside>
      <div class="mew-qpane">
        <div class="mew-qtop">
          <h3>${escapeHtml(q.title)}</h3>
          <div class="mew-tags"><span>Objective</span><span>${q.type}</span><span>${q.difficulty}</span><span>${q.mins}m</span></div>
        </div>
        <p class="mew-stem">${escapeHtml(q.stem)}</p>
        ${(q.options||[]).length?`<p class="te-note" style="margin:0 0 10px;color:#93c5fd">Select one answer</p>${q.options.map(o=>`<div class="mew-opt ${o.ok?"ok":""}"><i>${o.k}</i><span>${escapeHtml(o.text)}</span></div>`).join("")}`:`<div class="mew-card"><p class="te-note" style="margin:0">Coding prompt. Candidates write and run code in the live product.</p></div>`}
      </div>
    </div>`;
  } else if(step==="settings"){
    const tab = settingsTab||"setup";
    const stab = (id, title, sub) => `<button class="mew-stab ${tab===id?"on":""}" type="button" onclick="settingsTab='${id}';captureWizard();renderWorkspace()"><b>${title}</b><small>${sub}</small></button>`;
    const tog = (key, title, copy) => `<div class="mew-tog"><div><b>${title}</b><span>${copy}</span></div><button class="mew-sw ${d[key]?"on":""}" type="button" onclick="meToggle('${key}')"></button></div>`;
    body = `${`<div class="mew-stabs">${stab("setup","Setup","Oct 7 – Nov 6")}${stab("proctoring","Proctoring", (d.webcam?1:0)+(d.tabswitch?1:0)+(d.copypaste?1:0)+" features")}${stab("scoring","Scoring","2 sections")}${stab("emails","Emails","Configured")}</div>`}
      ${tab==="setup"?`<div class="mew-grid2">
        <div class="mew-card">
          <h3>Assessment Timeframe</h3>
          <div class="mew-pills">${["30d","60d","90d"].map(x=>`<button type="button" class="${d.windowDays===x?"on":""}" onclick="meSetWindow('${x}')">${x}</button>`).join("")}</div>
          <label class="mew-lab">Timezone</label>
          <input class="mew-in" value="India (IST) · UTC+05:30" readonly>
        </div>
        <div class="mew-card">
          <h3>Candidate Information</h3>
          <div class="mew-chips"><span>Full Name Required</span><span>Email Required</span><span>Phone Optional</span><span>LinkedIn Optional</span></div>
          <p class="te-note">Resume, current company, and experience years can be added as custom fields.</p>
        </div>
      </div>`:""}
      ${tab==="proctoring"?`<div data-tour="proctor">
        <div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 12px"><b>Proctoring</b><span class="te-pill">Standard</span></div>
        <div class="mew-proc">
          ${tog("webcam","Webcam Monitoring","Real-time face & gaze flagging with violation capture")}
          ${tog("facedetect","Face, Gaze & Object Detection","Continuous video recording for server-side analysis")}
          ${tog("fullscreen","Screen Recording","Full session capture")}
          ${tog("audio","Audio Monitoring","Background sound detection")}
          ${tog("copypaste","Copy/Paste Prevention","Block clipboard access")}
          ${tog("tabswitch","Screenshot Capture","Random screen snapshots")}
        </div>
      </div>`:""}
      ${tab==="scoring"?`<div class="mew-card">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin:0 0 14px">
          ${tog("shuffle","Shuffle Sections","")}
          ${tog("shuffleOpts","Shuffle Options","")}
          ${tog("allowReview","Allow Review","")}
          ${tog("showResults","Show Results to Candidate","")}
        </div>
        <label class="mew-lab">Passing / cutoff %</label>
        <input class="mew-in" id="wCutoff" value="${escapeHtml(String(d.cutoff||d.pass||70))}" style="max-width:160px">
        <table class="mtable" style="margin-top:14px;background:transparent;border-color:rgba(255,255,255,.08)"><thead><tr><th>Section</th><th>Weight %</th><th>Cutoff %</th><th>Timer</th><th>Questions</th></tr></thead>
        <tbody>
          <tr><td>Mcq</td><td>50</td><td>50</td><td>6m</td><td>${bank.filter(x=>x.section==="Mcq").length}</td></tr>
          <tr><td>Coding</td><td>50</td><td>50</td><td>86m</td><td>${bank.filter(x=>x.section==="Coding").length}</td></tr>
        </tbody></table>
      </div>`:""}
      ${tab==="emails"?`<div class="mew-mail">
        <div class="mew-card">
          <h3>Invitation Email Template</h3>
          <input class="mew-in" value="Default Invitation" readonly>
          <p class="te-note">Default invite language: English (US)</p>
          ${tog("reminders","Automatic Reminders","Send reminder before deadline")}
          <div class="mew-pills"><button class="on" type="button">1 day</button><button type="button">3 days</button><button type="button">5 days</button></div>
        </div>
        <div class="mew-preview">
          <div class="bar">Otomeyt AI<b>ASSESSMENT INVITATION</b></div>
          <div class="body">
            <p><b>Hi Candidate Name,</b></p>
            <p>${escapeHtml(d.name||"ABC")} has invited you to complete a ${escapeHtml(String(d.duration||45))}-minute assessment.</p>
            <p>Duration: ${escapeHtml(String(d.duration||45))} minutes<br>Valid From: Oct 7, 2026<br>Valid Until: Friday, November 6, 2026</p>
          </div>
        </div>
      </div>`:""}`;
  } else if(isShortAssessCreate()){
    const qs = d.questions||[];
    body = `<div class="mew-card">
      <span class="te-pill">Publish</span>
      <h2 style="margin:8px 0 6px">${escapeHtml(d.name||"Untitled assessment")}</h2>
      <p class="te-note">AI created ${qs.length} questions from the JD. Publish to make it live.</p>
      <div class="mew-statrow" style="margin:12px 0">
        <span><b>${qs.length}</b>Questions</span>
        <span><b>${escapeHtml(String(d.duration||45))}</b>Minutes</span>
        <span><b>${escapeHtml(d.role||"")}</b>Role</span>
      </div>
      ${qs.slice(0,5).map(q=>`<div class="te-q"><span>${escapeHtml(q.type||"Q")} · ${escapeHtml(q.title||"")}</span></div>`).join("")}
      <div class="te-actions" style="margin-top:16px">
        <button class="te-btn ghost" type="button" onclick="shortCreateBackToUpload()">← Upload again</button>
        <button class="mew-cta green" type="button" onclick="publishAssessment()">Publish</button>
      </div>
    </div>`;
  } else {
    const mcqN = bank.filter(x=>x.section==="Mcq").length;
    const codeN = bank.filter(x=>x.section==="Coding").length;
    const mins = bank.reduce((s,x)=>s+(x.mins||1),0);
    body = `<div class="mew-card" style="margin:0 0 14px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <span class="te-pill">Final Review</span>
            <h2 style="margin:8px 0 6px">${escapeHtml(d.name||"Untitled assessment")}</h2>
            <div class="mew-chips">${String(d.skills||d.role||"").split(",").slice(0,5).map(s=>s.trim()?`<span>${escapeHtml(s.trim())}</span>`:"").join("")}</div>
          </div>
          <div class="mew-statrow">
            <span><b>2</b>Sections</span><span><b>${bank.length}</b>Questions</span><span><b>${mins}</b>Minutes</span><span><b>218</b>Points</span>
          </div>
        </div>
      </div>
      <div class="mew-rev">
        <div class="mew-card">
          <h3>Assessment Blueprint</h3>
          <div class="mew-grid2">
            <div class="mew-card" style="margin:0"><b>1 Mcq</b><p class="te-note">${mcqN} questions · 6 min · 50%</p></div>
            <div class="mew-card" style="margin:0"><b>2 Coding</b><p class="te-note">${codeN} questions · 86 min · 50%</p></div>
          </div>
          <p class="te-note" style="margin-top:12px">Question distribution by type and difficulty is ready.</p>
        </div>
        <div class="mew-card">
          <h3>Ready to Publish?</h3>
          <div class="mew-check">
            <div>✓ Assessment name</div>
            <div>✓ Questions added</div>
            <div>✓ Duration calculated</div>
            <div>✓ Sections configured</div>
          </div>
          <div class="te-actions" style="margin-top:16px">
            <button class="te-btn ghost" type="button" onclick="appNav('meritedge')">Save Draft</button>
            <button class="mew-cta green" type="button" onclick="publishAssessment()">Publish Assessment</button>
          </div>
        </div>
      </div>`;
  }
  const editing = !!(d.jdFile || d.name);
  return meWizardChrome(editing ? "Edit Assessment" : "Create Assessment", body);
}
function ivEnsure(d){
  d.dims = d.dims || {tech:25, comm:25, solve:20, conf:15, rel:15};
  d.voice = d.voice || 2;
  d.photo = d.photo || 0;
  d.interviewer = d.interviewer || "Alex";
  d.expLevel = d.expLevel || "Junior";
  d.language = d.language || "English";
  d.accent = d.accent || "Neutral";
  d.ivType = d.ivType || "Voice";
  d.snr = d.snr==null ? 15 : d.snr;
  if(d.followups==null) d.followups = true;
  if(d.star==null) d.star = true;
  if(d.encourage==null) d.encourage = true;
  if(d.allowQ==null) d.allowQ = true;
  if(d.webcam==null) d.webcam = true;
  if(d.tabswitch==null) d.tabswitch = true;
  d.topics = d.topics && d.topics.length ? d.topics : sampleTopics(d.role||"this role");
  return d;
}
function ivToggle(key){ wizard.data[key] = !wizard.data[key]; renderWorkspace(); }
function ivSet(key, val){ wizard.data[key] = val; renderWorkspace(); }
function ivDim(key, val){
  wizard.data.dims = wizard.data.dims || {};
  wizard.data.dims[key] = Number(val);
  const el = document.getElementById("ivdim-"+key);
  if(el) el.textContent = val + "%";
}
function ivSrcOn(d){
  const s = d.ivSource;
  if(s==="skills" || s==="assessment") return "skills";
  if(s==="manual" || s==="role") return "manual";
  return "jd";
}
const IV_VOICES = __D.interviewVoices;
const IV_PHOTOS = __D.interviewPhotos;
function aisTog(key, title, copy){
  const on = !!wizard.data[key];
  return `<div class="ais-tog"><div><b>${title}</b><span>${copy}</span></div><button class="ais-sw ${on?"on":""}" type="button" onclick="ivToggle('${key}')"></button></div>`;
}
function aisStudio(body, last){
  const short = isShortInterviewCreate();
  if(short){
    return `<div class="ais" data-tour="wizard">
      <div class="mew-head" style="position:relative">
        <div class="mew-head-l">
          <button class="mew-x" type="button" aria-label="Close" onclick="appNav('ai-interviewer')">×</button>
          <b>Create Interview</b>
        </div>
        <div class="mew-steps">${shortCreateStepsHtml("interview")}</div>
        <div class="mew-head-r">
          ${last?`<button class="ais-pub" type="button" onclick="publishInterview()">Publish</button>`:`<button class="ais-go" type="button" onclick="generateAiInterview()">Create questions →</button>`}
        </div>
      </div>
      <div class="ais-main" style="padding:22px">${body}</div>
    </div>`;
  }
  const i = typeof wizard.step==="number" ? wizard.step : INTERVIEW_STEPS.length-1;
  const pct = Math.round((i / (INTERVIEW_STEPS.length-1)) * 100);
  const steps = INTERVIEW_STEPS.map((s,n)=>`<button class="ais-s ${n===i?"on":""} ${n<i?"done":""}" type="button" onclick="wizGoto(${n})"><i>${n<i?"✓":n+1}</i>${s.label}</button>`).join("");
  return `<div class="ais" data-tour="wizard">
    <div class="ais-top">
      <div>
        <div class="ais-crumb">AI Interviewer › Create Interview</div>
        <h2>AI Interview Studio</h2>
        <p>${last?"Edit Interview":"Create New Interview"}</p>
      </div>
      <div class="te-actions">
        ${last?`<button class="ais-pub" type="button" onclick="publishInterview()">Publish</button>`:""}
        <button class="ais-exit" type="button" onclick="appNav('ai-interviewer')">Save & Exit</button>
      </div>
    </div>
    <div class="ais-layout">
      <aside class="ais-rail">
        ${steps}
        <div class="ais-prog"><label>${i} of 6 completed</label><div class="bar"><i style="width:${pct}%"></i></div></div>
      </aside>
      <div class="ais-main">${body}</div>
    </div>
    <div class="ais-foot">
      <button class="mew-back" type="button" ${i===0?"disabled style='opacity:.35'":""} onclick="wizBack()">← Back</button>
      ${last
        ? `<button class="ais-pub" type="button" onclick="publishInterview()">Publish</button>`
        : `<button class="ais-go" type="button" onclick="wizNext()">Continue →</button>`}
    </div>
  </div>`;
}
function renderInterviewWizard(){
  const d = ivEnsure(wizard.data);
  if(d.aiPhase==="creating"){
    const steps = [
      {label:"Analyzing Job Description", sub:"Understanding the role"},
      {label:"Matching Skills & Questions", sub:"Selecting relevant questions"},
      {label:"Generating Custom Questions", sub:"Identifying knowledge gaps"},
      {label:"Finalizing Interview", sub:"Preparing your interview"}
    ];
    return creatingScreenHtml("Creating Your Interview", steps, ["Reading the job description...","Selecting questions...","Selecting questions...","Preparing your interview","Finishing up..."]);
  }
  if(wizard.step==="done"){
    const iv = interviews.find(x=>x.id===wizard.publishedId);
    const topics = iv?.topics || d.topics || [];
    const qs = topics.length
      ? topics.map(t=>({type:t.title||"Topic", title:t.prompt||t.title||""}))
      : (iv?.questions || d.questions || []).map(q=>({type:q.type||"Voice", title:q.title||""}));
    const title = iv?.title || d.name || "AI Interview";
    const role = iv?.role || d.role || "";
    const duration = iv?.duration || (d.duration ? d.duration+" min" : "");
    const cards = qs.map((q,i)=>`<article class="pubq written">
        <div class="pubq-n">${String(i+1).padStart(2,"0")}</div>
        <div>
          <em>${escapeHtml(q.type||"Topic")}</em>
          <p>${escapeHtml(q.title||"")}</p>
        </div>
      </article>`).join("");
    const redirectNotice = publishInviteSeconds > 0
      ? `<div class="aha-live pub-redirect" role="status">AI Interview published<span>Redirecting to Sign up to invite yourself in ${publishInviteSeconds} seconds...</span></div>`
      : "";
    return `<div class="mew me-published">
      ${redirectNotice}
      <header class="pub-hero">
        <div class="pub-mark">✓</div>
        <div class="pub-copy">
          <span class="pub-ok">Published</span>
          <h2>${escapeHtml(title)}</h2>
          <div class="pub-meta">
            <span>${qs.length} questions</span>
            ${duration?`<span>${escapeHtml(String(duration))}</span>`:""}
            ${role?`<span>${escapeHtml(role)}</span>`:""}
          </div>
        </div>
        <div class="pub-actions">
          <div class="pub-send">
            <label>Invite window<input value="1 day" disabled></label>
            <label>Email<input id="pubInviteEmail" type="email" value="${escapeHtml(currentUser()?.email||"")}"></label>
            <button class="mew-cta" type="button" onclick="sendPublishedInvite('interview','${iv?.id||""}')">Send invite</button>
          </div>
          <button class="te-btn ghost" type="button" onclick="openInterview('${iv?.id||""}')">I'll do it later</button>
        </div>
      </header>
      <div class="pub-grid">${cards}</div>
    </div>`;
  }
  const step = INTERVIEW_STEPS[wizard.step].id;
  let body = "";
  if(step==="source"){
    const src = ivSrcOn(d);
    body = isShortInterviewCreate()
      ? `<div class="ais-card" data-tour="jd">
      <h3>Upload a job description</h3>
      <p class="sub">Select a job description. Questions are created and published for you, and you can still read them.</p>
      <label class="ais-lab">Job Description</label>
      <textarea class="ais-area" id="wJdText" placeholder="Paste or upload your job description (min 50 characters)...">${escapeHtml(d.jdText||"")}</textarea>
      <div class="te-actions" style="margin-top:10px;flex-wrap:wrap">
        <button class="te-btn ghost" type="button" onclick="document.getElementById('jdFileInput').click()">Upload</button>
        <button class="te-btn ghost" type="button" onclick="pasteSampleJd()">Paste</button>
        <button class="te-btn ghost" type="button" onclick="pasteSampleJd()">Sample JD</button>
      </div>
      ${jdPickerHtml(d.jdId, d.jdParsing)}
      <button class="ais-ai" type="button" style="margin-top:12px" onclick="generateAiInterview()">Create questions →</button>
    </div>`
      : `<div class="ais-card" data-tour="jd">
      <h3>Interview Source</h3>
      <p class="sub">Choose how to create this interview</p>
      <div class="ais-src">
        <button type="button" class="${src==="jd"?"on":""}" onclick="wizSetIvSource('jd')">From Job Description<span class="rec">RECOMMENDED</span><small>Upload or paste a JD</small></button>
        <button type="button" class="${src==="skills"?"on":""}" onclick="wizSetIvSource('skills')">From Skills<small>Skills and experience level</small></button>
        <button type="button" class="${src==="manual"?"on":""}" onclick="wizSetIvSource('manual')">Manual Setup<small>Build the interview yourself</small></button>
      </div>
      ${src==="jd"?`<label class="ais-lab">Job Description</label>
        <textarea class="ais-area" id="wJdText" placeholder="Paste or upload your job description (min 50 characters)...">${escapeHtml(d.jdText||"")}</textarea>
        <div class="te-actions" style="margin-top:10px;flex-wrap:wrap">
          <button class="te-btn ghost" type="button" onclick="document.getElementById('jdFileInput').click()">Upload</button>
          <button class="te-btn ghost" type="button" onclick="pasteSampleJd()">Paste</button>
          <button class="te-btn ghost" type="button" onclick="pasteSampleJd()">Sample JD</button>
        </div>
        ${jdPickerHtml(d.jdId, d.jdParsing)}
        <button class="ais-ai" type="button" style="margin-top:12px" onclick="generateAiInterview()">✦ Generate with AI</button>`:""}
      ${src==="skills"?`<label class="ais-lab">Experience Level</label>
        <div class="ais-chips">${[["Fresher","0-1 yrs"],["Junior","1-3 yrs"],["Mid-Level","3-6 yrs"],["Senior","6-10 yrs"],["Lead/Principal","10+ yrs"]].map(([id,sub])=>`<button type="button" class="${d.expLevel===id?"on":""}" onclick="ivSet('expLevel','${id}')">${id}<small style="display:block;color:#6b7280">${sub}</small></button>`).join("")}</div>
        <label class="ais-lab" style="margin-top:14px">Skills to Assess</label>
        <input class="ais-in" id="wIvSkills" value="${escapeHtml(d.skills||"")}" placeholder="Skill + Enter (e.g. Python, React)...">
        <button class="ais-ai" type="button" style="margin-top:14px" onclick="generateAiInterview()">✦ Generate with AI</button>`:""}
      ${src==="manual"?`<label class="ais-lab">Role</label><input class="ais-in" id="wIvRole" value="${escapeHtml(d.role||"")}" placeholder="e.g. Senior Software Engineer">
        <p class="te-note">Configure name, topics, and persona on the next steps.</p>`:""}
    </div>`;
  } else if(step==="configure"){
    body = `<div class="ais-split">
      <div class="ais-card">
        <h3>Configure Interview</h3>
        <p class="sub">Basic details, skills, and interview format</p>
        <label class="ais-lab">Interview Name <em>*</em></label>
        <input class="ais-in" id="wIvName" value="${escapeHtml(d.name||"")}" placeholder="e.g., Senior Software Engineer Interview">
        <label class="ais-lab" style="margin-top:12px">Role Title <em>*</em></label>
        <input class="ais-in" id="wIvRole" value="${escapeHtml(d.role||"")}" placeholder="e.g., Senior Software Engineer">
        <div class="ais-row" style="margin-top:12px">
          <div><label class="ais-lab">Interview Type</label><select class="ais-sel" id="wIvType"><option>Voice (default)</option><option>Chat</option></select></div>
          <div><label class="ais-lab">Duration (minutes)</label>
            <select class="ais-sel" id="wIvDuration"><option ${d.duration==="20"?"selected":""}>20</option><option ${d.duration==="25"?"selected":""}>25</option><option ${d.duration==="30"?"selected":""}>30</option><option ${d.duration==="45"?"selected":""}>45</option></select>
          </div>
        </div>
        <label class="ais-lab" style="margin-top:12px">Experience Range</label>
        <p class="te-note">Suggested: fresher 0–1 · junior 1–3 · mid 3–6 · senior 6–10</p>
      </div>
      <div class="ais-card">
        <h3>Skills</h3>
        <p class="sub">Primary skills · core capabilities to emphasize</p>
        <input class="ais-in" id="wIvSkills" value="${escapeHtml(d.skills||"")}" placeholder="Add skill, press Enter">
        <p class="te-note" style="margin-top:12px">Secondary skills optional — related or adjacent capabilities.</p>
      </div>
    </div>`;
  } else if(step==="persona"){
    const colors = ["#7c3aed","#2563eb","#059669","#ea580c","#db2777","#0891b2","#4f46e5","#ca8a04"];
    body = `<div class="ais-card">
      <h3>AI Interviewer Persona</h3>
      <p class="sub">Voice, language, and style</p>
      <div class="ais-split">
        <div>
          <label class="ais-lab">Interviewer Name</label>
          <input class="ais-in" id="wIvInterviewer" value="${escapeHtml(d.interviewer)}">
          <div class="ais-row" style="margin-top:12px">
            <div><label class="ais-lab">Interview Language</label><input class="ais-in" value="${escapeHtml(d.language)}" readonly></div>
            <div><label class="ais-lab">Accent</label><input class="ais-in" value="${escapeHtml(d.accent)}" readonly></div>
          </div>
          <div style="margin-top:14px;width:160px;height:160px;border-radius:16px;background:${colors[d.photo%8]};display:grid;place-items:center;font:800 42px Inter;color:#fff">${escapeHtml((d.interviewer||"A")[0])}</div>
        </div>
        <div>
          <label class="ais-lab">Voice (English)</label>
          <div class="ais-voices">${IV_VOICES.map(([id,name,g,copy])=>`<button class="ais-v ${d.voice===id?"on":""}" type="button" onclick="ivSet('voice',${id})"><b>${name} <span class="g">${g}</span></b><small>${copy}</small></button>`).join("")}</div>
          <label class="ais-lab" style="margin-top:12px">Interviewer photo</label>
          <div class="ais-photos">${IV_PHOTOS.map((p,i)=>`<button type="button" class="${d.photo===i?"on":""}" style="background:${p[0]}" onclick="ivSet('photo',${i})">${p[1]}</button>`).join("")}</div>
        </div>
      </div>
    </div>`;
  } else if(step==="topics"){
    const t = d.topics[0] || {title:"", prompt:"", mins:8};
    body = `<div class="ais-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 12px">
        <div><h3>Interview Topics</h3><p class="sub">Discussion areas your AI interviewer will explore · ${d.topics.length} topic</p></div>
        <button class="ais-go" type="button" onclick="wizard.data.topics.push({title:'New topic',prompt:'',mins:8});renderWorkspace()">+ Add Topic</button>
      </div>
      <div class="ais-topic">
        <div class="ais-row">
          <input class="ais-in" id="wTopicTitle" value="${escapeHtml(t.title||"")}" placeholder="Topic title (e.g. Stakeholder management)">
          <div class="ais-chips"><button class="on" type="button">Moderate depth</button><button type="button">Optional</button></div>
        </div>
        <input class="ais-in" id="wTopicPrompt" style="margin-top:10px" value="${escapeHtml(t.prompt||"")}" placeholder="What should the AI probe in this area?">
        <p class="te-note">EXAMPLE QUESTIONS · MUST-ASK QUESTIONS · SKILLS PROBED</p>
      </div>
      ${aisTog("codingRound","Include coding round","Optional live coding after the conversational interview")}
    </div>`;
  } else if(step==="evaluation"){
    const dims = [["tech","Technical Accuracy","Correctness and depth of technical knowledge"],["comm","Communication","Clarity, articulation, and structure"],["solve","Problem Solving","Analytical thinking and approach"],["conf","Confidence","Composure and self-assurance"],["rel","Relevance","On-role answers"]];
    body = `<div class="ais-split">
      <div class="ais-card">
        <h3>Evaluation & Settings</h3>
        <p class="sub">Scoring rules, proctoring guardrails, and interviewer behaviour</p>
        <div class="ais-dim">${dims.map(([k,title,copy])=>`<div class="row"><div><b>${title}</b><span style="display:block;color:#9ca3af;font-size:11px">${copy}</span></div><input type="range" min="5" max="40" value="${d.dims[k]}" oninput="ivDim('${k}',this.value)"><b id="ivdim-${k}">${d.dims[k]}%</b></div>`).join("")}</div>
      </div>
      <div class="ais-card">
        <h3>Proctoring</h3>
        ${aisTog("webcam","Webcam monitoring","Face detection and webcam recording")}
        ${aisTog("tabswitch","Tab-switch detection","Flag when the candidate leaves the interview tab")}
        ${aisTog("screenRec","Screen recording","Require screen share and record the candidate's screen")}
      </div>
    </div>
    <div class="ais-card">
      <h3>Interviewer behaviour</h3>
      ${aisTog("followups","Enable follow-up questions","AI asks clarifying questions based on responses")}
      ${aisTog("star","STAR method probing","Prompt for Situation, Task, Action, Result")}
      ${aisTog("encourage","Enable encouragement","Positive reinforcement during the interview")}
      ${aisTog("strictTime","Strict time limits","Enforce hard time limits per topic")}
      ${aisTog("explore","Explore beyond the listed topics","When every topic is demonstrated, raise difficulty")}
      ${aisTog("allowQ","Allow candidate questions","Let candidates ask the AI questions")}
    </div>
    <div class="ais-card">
      <h3>Audio & language</h3>
      ${aisTog("headset","Require headset","Block laptop-mic candidates")}
      <div class="ais-tog"><div><b>Minimum SNR (dB)</b><span>15 dB — quiet office. 18 dB rejects most cafes.</span></div><b>${d.snr}</b></div>
      <label class="ais-lab">Transcription language</label>
      <input class="ais-in" value="Auto-detect" readonly style="max-width:220px">
    </div>`;
  } else if(isShortInterviewCreate()){
    const qs = d.questions||d.topics||[];
    body = `<div class="ais-card">
      <span class="te-pill">Publish</span>
      <h3 style="margin:8px 0 6px">${escapeHtml(d.name||"Untitled interview")}</h3>
      <p class="sub">AI created ${qs.length} questions from the JD. Publish to make it live.</p>
      <div class="ais-kpis">
        <div><b>${qs.length}</b><span>Questions</span></div>
        <div><b>${escapeHtml(d.duration)}m</b><span>Duration</span></div>
        <div><b>${escapeHtml(d.role||"—")}</b><span>Role</span></div>
      </div>
      ${(d.topics||[]).slice(0,4).map(t=>`<div class="te-q"><span>${escapeHtml(t.title||"Topic")} · ${escapeHtml(t.prompt||"")}</span></div>`).join("")}
      <div class="te-actions" style="margin-top:16px">
        <button class="te-btn ghost" type="button" onclick="shortCreateBackToUpload()">← Upload again</button>
        <button class="ais-pub" type="button" onclick="publishInterview()">Publish</button>
      </div>
    </div>`;
  } else {
    const t0 = (d.topics[0]&&d.topics[0].title) || "Untitled topic";
    body = `<div class="ais-card">
      <h3>Review & Publish</h3>
      <p class="sub">Confirm every setting before publishing</p>
      <div class="ais-kpis">
        <div><b>${d.topics.length}</b><span>Topics</span></div>
        <div><b>${escapeHtml(d.duration)}m</b><span>Duration</span></div>
        <div><b>Voice</b><span>${escapeHtml(IV_VOICES.find(v=>v[0]===d.voice)?.[1]||"Voice 2")}</span></div>
        <div><b>100%</b><span>Weights</span></div>
      </div>
      <div class="ais-split">
        <div class="ais-card" style="margin:0">
          <h3>Configuration</h3>
          <div class="ais-kv">
            <span>Name</span><b>${escapeHtml(d.name||"—")}</b>
            <span>Role</span><b>${escapeHtml(d.role||"—")}</b>
            <span>Experience</span><b>${escapeHtml(d.expLevel||"—")}</b>
            <span>Duration</span><b>${escapeHtml(d.duration)} minutes</b>
            <span>Type</span><b>Voice</b>
          </div>
        </div>
        <div class="ais-card" style="margin:0">
          <h3>AI Persona</h3>
          <div class="ais-kv">
            <span>Name</span><b>${escapeHtml(d.interviewer)}</b>
            <span>Voice</span><b>Voice ${d.voice}</b>
            <span>Language</span><b>${escapeHtml(d.language)}</b>
            <span>Accent</span><b>${escapeHtml(d.accent)}</b>
          </div>
        </div>
      </div>
      <div class="ais-card" style="margin-top:14px">
        <h3>Topics (${d.topics.length})</h3>
        <p>${escapeHtml(t0)} · Moderate</p>
      </div>
    </div>`;
  }
  return aisStudio(body, step==="review");
}
function greeting(name){
  const h = new Date().getHours();
  const when = h<12 ? "Good morning" : h<17 ? "Good afternoon" : "Good evening";
  return `${when}, ${name.split(" ")[0]}`;
}
function renderNav(){
  const nav = document.getElementById("teNav");
  if(!nav) return;
  const navIco = {dash:icoDash, brain:icoBrain, msg:icoMsg, lib:icoLib, card:icoCard, bill:icoBill, gift:icoGift};
  nav.innerHTML = APP_NAV.map(item => {
    if(item.cat) return `<div class="te-cat">${item.cat}</div>`;
    const ico = item.icon && navIco[item.icon] ? navIco[item.icon]() : "";
    if(item.locked && !trialUnlocked()) return `<button class="te-item locked" type="button" onclick="lockedFeature()">${ico}<span>${item.label}</span><span class="te-prem">Premium</span><span class="te-lock" title="Locked">🔒</span></button>`;
    const on = appSection===item.id;
    return `<button class="te-item ${item.sub?"sub":""} ${on?"on":""}" data-nav="${item.id}" onclick="appNav('${item.id}')">${ico}<span>${item.label}</span></button>`;
  }).join("");
  document.querySelectorAll(".te-foot .te-item[data-nav]").forEach(b=>b.classList.toggle("on", b.dataset.nav===appSection));
  const setBtn = document.querySelector('.te-foot .te-item[data-nav="settings"]');
  if(setBtn && !setBtn.querySelector("svg")) setBtn.insertAdjacentHTML("afterbegin", icoCog());
  const outBtn = document.querySelector('.te-foot .te-item:not([data-nav])');
  if(outBtn && !outBtn.querySelector("svg")) outBtn.insertAdjacentHTML("afterbegin", svgIco('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>'));
}
function dashTabs(active){
  return [["home","Overview"],["meritedge","MeritEdge"],["ai-interviewer","AI Interviewer"]]
    .map(([id,label]) => `<button class="te-tab ${id===active?"on":""}" onclick="appNav('${id}')">${label}</button>`).join("");
}
function candidateRows(list, kind, id){
  return list.map(c => `<tr onclick="openCandidateFromDash('${kind}','${id}','${c.id}')">
    <td><span class="te-av">${escapeHtml(initials(c.name))}</span></td>
    <td><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.email||c.skills||"")}</small></td>
    <td class="te-score">${c.score}</td>
    <td><span class="te-pill ${c.status==="In progress"?"warn":c.status==="Completed"&&!c.rec?"idle":""}">${escapeHtml(c.status||c.rec||"")}</span></td>
  </tr>`).join("");
}

function renderWorkspace(){
  const u = currentUser();
  if(!u){ showView("login"); return; }
  hydrateAccountReports();
  const focusedCreate = !!(appDetail?.type==="wizard" && wizard?.data?.focusedCreate);
  document.body.classList.toggle("me-wiz-on", !!(appDetail?.type==="wizard" && wizard));
  document.body.classList.toggle("create-focus", focusedCreate);
  document.body.classList.toggle("account-focus", appSection==="account-assessments");
  document.body.classList.toggle("preview-focus", !!(u.kind==="preview" && appDetail?.type==="wizard" && wizard?.data?.focusedCreate));
  syncPremiumSample();
  renderNav();
  document.getElementById("teHello").innerHTML = greeting(u.name);
  document.getElementById("teCompany").innerHTML = `<span>${escapeHtml(u.company)}</span>`;
  const creditEl = document.getElementById("teCredits");
  const showCredits = trialUnlocked(u);
  creditEl.hidden = !showCredits;
  if(showCredits){
    creditEl.textContent = creditsRecharged(u)
      ? `${u.credits} credits · ${currentPlanId(u)}`
      : `${freeInviteBalance(u).left} free invite credits · Upgrade`;
    creditEl.classList.toggle("plus", !!(checkout?.applied && (checkout.step==="result"||checkout.step==="return")));
  } else {
    creditEl.textContent = "";
    creditEl.classList.remove("plus");
  }
  const title = PAGE_TITLES[appSection] || "Dashboard";
  let crumbs = `<b>Dashboard</b>`;
  if(appSection==="meritedge" || appSection==="ai-interviewer") crumbs = "";
  if(appSection==="plans") crumbs = `Dashboard / <b>Plans</b>`;
  if(appSection==="billing") crumbs = `Dashboard / <b>Billing</b>`;
  if(appSection==="refer") crumbs = `Dashboard / <b>Refer and earn</b>`;
  if(appSection==="questions") crumbs = `Dashboard / <b>Question repository</b>`;
  if(checkout && checkout.step && checkout.step!=="return" && appSection==="plans") crumbs = `Dashboard / Plans / <b>Razorpay</b>`;
  if(appDetail?.type==="wizard" && wizard?.kind==="assessment") crumbs = "";
  if(appDetail?.type==="wizard" && wizard?.kind==="interview") crumbs = "";
  if(appDetail?.type==="invite") crumbs = "";
  if(appDetail?.type==="assessment") crumbs = "";
  if(appDetail?.type==="interview") crumbs = "";
  if(appDetail?.type==="report") crumbs = "";
  document.getElementById("teCrumbs").innerHTML = crumbs;

  const check = document.getElementById("teChecklist");
  if(appSection==="home" && !appDetail){
    const cap = creditCap(u);
    const left = u.credits || 0;
    const used = Math.max(0, cap - left);
    const pct = cap ? Math.min(100, Math.round(used / cap * 100)) : 0;
    let html = "";
    if(u.kind==="preview"){
      html += `<div class="te-refer-banner">
        <label>TalentEdge preview · ${escapeHtml(intentRole())}</label>
        <p>After the tour, create from a JD with no payment. Invite yourself and register for the trial to unlock the rest.</p>
      </div>`;
    }
    html += `<div class="te-actions" style="margin:0 0 12px">
      <button class="te-btn" onclick="beginProductTour()" ${tour?"disabled":""}>Take platform tour</button>
      <button class="te-btn ghost" onclick="appNav('plans')">View plans</button>
    </div>
    <div class="te-banner">
      <div class="te-banner-stat">
        <label>Credits</label>
        <b>${used} used · ${left} left</b>
        <span>of ${cap} on ${escapeHtml(planDisplayName(u))}</span>
        <div class="te-banner-bar"><i style="width:${pct}%"></i></div>
      </div>
      <div class="te-banner-stat">
        <label>Plan validity</label>
        <b>${escapeHtml(planValidityLabel(u))}</b>
        <span>${u.kind==="preview"?"Product preview":u.kind==="trial"?"Trial access":escapeHtml(planDisplayName(u))}</span>
      </div>
      <button class="te-btn" type="button" onclick="appNav('plans')">Upgrade</button>
    </div>
    ${proofChipsHtml()}`;
    if(u.kind==="trial" || u.kind==="preview"){
      const list = MILESTONES.map(m => `<button class="te-step" onclick="milestoneGo('${m.id}')"><span class="te-dot"></span><span><b>${m.label}</b><small>${m.desc}</small></span></button>`).join("");
      html += `<div class="te-check">
      <div class="te-check-h"><div><p>${u.kind==="preview"?"Welcome — try the product":"Welcome to TalentEdge"}</p><span>${u.kind==="preview"?"Tour, try it yourself, then register to invite candidates":"Complete these steps to get the most out of your trial"}</span></div><span class="te-days">${u.daysLeft} days remaining</span></div>
      <div class="te-bar"><i></i></div>
      <div class="te-steps">${list}</div>
    </div>`;
    }
    check.innerHTML = html;
  } else check.innerHTML = "";
  paintRazorpay();

  const content = document.getElementById("appContent");
  if(appSection==="refer"){
    const code = userInviteCode(u);
    content.innerHTML = `<div class="te-refer-banner">
        <label>Refer and earn</label>
        <p>Invite a person and get free 5 credits when they sign up and create their first assessment through your referral code.</p>
      </div>
      <div class="te-refcard">
        <div>
          <label>Your referral code</label>
          <div class="te-refcode" id="teInviteCode">${escapeHtml(code)}</div>
        </div>
        <div class="te-refacts">
          <button class="te-btn ghost" type="button" onclick="copyInviteCode()">Copy code</button>
          <button class="te-btn" type="button" onclick="openReferShare()">Share</button>
        </div>
      </div>
      <p class="te-note">Share opens an email they can send. The other person enters this code on Sign up. You get 5 credits after they create their first assessment.</p>`;
    return;
  }
  if(appSection==="settings"){
    content.innerHTML = `<div class="te-card"><b>Settings</b>
      <p class="te-note">Company profile. Logo and SSO are not in this prototype.</p>
      <div class="te-summary">
        <span>Company</span><b>${escapeHtml(u.company)}</b>
        <span>Plan</span><b>${escapeHtml(currentPlanId(u))}</b>
        <span>Credits</span><b>${u.credits}</b>
      </div>
      <div class="te-actions"><button class="te-btn" onclick="appNav('plans')">View plans</button><button class="te-btn ghost" onclick="appNav('billing')">Billing</button></div>
    </div>`;
    return;
  }
  if(appSection==="questions"){
    if(!trialUnlocked(u)){
      lockedFeature();
      return;
    }
    const rows = SAMPLE_JDS.flatMap(j => (j.questions||[]).map(q => `<tr>
      <td><b>${escapeHtml(q.title)}</b><small>${escapeHtml(j.role)} · ${j.kind==="tech"?"Tech":"Non-tech"}</small></td>
      <td>${escapeHtml(q.type||"MCQ")}</td>
    </tr>`)).join("");
    content.innerHTML = `${moduleHeader({icon:icoLib(), title:"Question repository", subtitle:"Unlocked on trial — items generated from the sample JDs", count:`${SAMPLE_JDS.reduce((n,j)=>n+(j.questions||[]).length,0)} questions`, createLabel:"Create Assessment", createFn:"startCreateAssessment()"})}
      <table class="mtable"><thead><tr><th>Question</th><th>Type</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="te-note">Trial access. Create Assessment still goes Upload JD → Creating questions → Publish.</p>`;
    return;
  }
  if(appSection==="billing"){
    content.innerHTML = renderBillingPage();
    return;
  }
  if(appSection==="plans"){
    const mine = currentPlanId(u);
    const ret = (checkout && checkout.step==="return") ? `<div class="ck-box ck-result plans-return">
        <span class="te-pill ${checkout.status==="success"?"":"warn"}">${checkout.status==="success"?"Paid":checkout.status==="failed"?"Failed":"Pending"} · returned to MeritEdge</span>
        <h2>Order ${checkout.orderId}</h2>
        <p class="sub">${escapeHtml(checkoutTotals().p.name)} · ${moneyInr(checkoutTotals().totalInr)} · ${u.credits} credits</p>
        ${checkout.status==="success"?`<div class="ck-plus"><span>Credits now</span><b>${u.credits}</b><span>+${checkout.creditsAdded||0} added</span></div>`:""}
        <div class="te-actions" style="justify-content:center;margin-top:12px">
          <button class="te-btn ghost" type="button" onclick="checkout=null;renderWorkspace()">Stay on plans</button>
          <button class="te-btn" type="button" onclick="leavePlansAfterPay()">${pendingCreate?"Continue to create":"Go to Billing"}</button>
        </div>
      </div>` : "";
    const continueNote = pendingCreate
      ? `<div class="aha-live">Create is already open without payment.<span>Upgrade when you want volume invites and extra credits.</span></div>`
      : `<p class="te-note">Pay with Razorpay · GST 18% · receipt emails after payment · plan and invoices on Billing</p>`;
    content.innerHTML = `<div class="plans-center" data-tour="plans">${ret}
      <div class="te-modhead"><div><h2>Plans</h2>${continueNote}</div>
      <div class="te-actions">
        <div class="planbill">
          <button type="button" class="${billCycle==="monthly"?"on":""}" onclick="setBillCycle('monthly')">Monthly</button>
          <button type="button" class="${billCycle==="annual"?"on":""}" onclick="setBillCycle('annual')">Annual · save 20%</button>
        </div>
      </div></div>
      <div class="te-plans">${PLANS.map(p=>`<div class="te-plancard ${p.id==="growth"?"hot":""} ${p.id===mine?"mine":""}">
        <h3>${p.name}${p.id===mine?` <span class="te-pill">Current</span>`:""}</h3>
        <div class="who">${p.who}</div>
        <div class="price">${planPrice(p)}${p.price?`<small> / mo</small>`:""}</div>
        <ul class="featul">${p.features.map(f=>`<li>${f}</li>`).join("")}</ul>
        ${p.id==="enterprise"?`<button class="te-btn ghost" onclick="openInfo('Enterprise','In the live product this would reach sales.')">${p.cta}</button>`:
          p.id==="trial"?`<button class="te-btn ghost" disabled style="opacity:.6">Trial</button>`:
          `<button class="te-btn" onclick="beginCheckout('${p.id}')">${p.id===mine?"Buy more credits":p.cta}</button>`}
      </div>`).join("")}</div>
      <div class="te-card" style="margin-top:16px;text-align:left"><b>Features</b>
        <div class="featgrid" style="margin-top:10px">${FEATURES.map(f=>`<div class="featbox"><b>${f.title}</b><p>${f.copy}</p></div>`).join("")}</div>
      </div>
      <table class="comptable">${`<thead><tr><th>Feature</th>${PLANS.map(p=>`<th>${p.name}</th>`).join("")}</tr></thead><tbody>${PLAN_ROWS.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`}</table>
      ${u.lastInvoice?`<p class="te-note">Last invoice ${u.lastInvoice.id} · ${u.lastInvoice.plan} · ${u.lastInvoice.on}</p>`:`<p class="te-note">Card 4242 succeeds · 4000 fails · Razorpay preview only.</p>`}
    </div>`;
    return;
  }
  if(appDetail?.type==="wizard" && wizard?.kind==="assessment"){
    content.innerHTML = renderAssessWizard();
    return;
  }
  if(appDetail?.type==="wizard" && wizard?.kind==="interview"){
    content.innerHTML = renderInterviewWizard();
    return;
  }
  if(appDetail?.type==="invite"){
    content.innerHTML = renderInvite();
    return;
  }
  if(appDetail?.type==="report"){
    content.innerHTML = renderCandidateReport();
    return;
  }

  if(appSection==="account-assessments"){
    content.innerHTML = accountAssessmentsPageHtml(u);
    return;
  }

  if(appDetail?.type==="assessment"){
    const a = assessments.find(x=>x.id===appDetail.id);
    const linked = interviews.find(i=>i.assessmentId===a.id);
    const pct = a.invited ? Math.round(a.completed/a.invited*100) : 0;
    const avg = avgScore(a.candidates);
    const pending = Math.max(0, (a.invited||0) - (a.completed||0));
    const noshow = a.invited ? Math.max(0, 100-pct) : 0;
    const rows = a.candidates.length
      ? a.candidates.map(c=>`<tr onclick="openCandidateFromDash('assessment','${a.id}','${c.id}')">
          <td><span class="te-av">${escapeHtml(initials(c.name))}</span></td>
          <td><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.email||c.skills||"")}</small></td>
          <td class="te-score">${c.score}${typeof c.score==="number"?"%":""}</td>
          <td><span class="te-pill ${c.status==="Invited"?"idle":c.status==="In progress"?"warn":""}">${escapeHtml(c.status)}</span></td>
        </tr>`).join("")
      : `<tr><td colspan="4" style="color:#6b7280;cursor:default">No candidates yet. Invite to start.</td></tr>`;
    const clearPct = a.completed ? Math.round((a.shortlisted||0)/a.completed*100) : 0;
    content.innerHTML = `${ahaBanner(a)}
      <div class="dash-id" data-tour="dashboard">
        <div class="dash-id-l">
          <button class="te-iconback" type="button" aria-label="Back" onclick="appNav('meritedge')">←</button>
          <h1 title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</h1>
          ${statusPill(a.status)}
        </div>
        <select class="period" aria-label="Trend period"><option>Last 30 days</option><option>Last 90 days</option><option>All time</option></select>
      </div>
      <div class="dash-meta"><span>${a.created}</span><span>${a.duration}</span><span>${a.passing||70}% cut-off</span></div>
      <div class="dash-act">
        <button class="te-btn ghost" type="button" onclick="later('Details')">Details</button>
        <button class="te-btn" type="button" onclick="startInvite('assessment','${a.id}')">Invite yourself</button>
        ${kebab("dash-"+a.id, [
          {label:"View Questions", fn:`later('View questions')`},
          {label:"View Candidates", fn:""},
          {label:"Share public link", fn:`later('Share public link')`},
          {label:"Export results", fn:`later('Export results')`},
          linked ? {label:"View AI Interview", fn:`openInterview('${linked.id}')`} : {label:"Create AI Interview", fn:`startCreateInterview('${a.id}')`},
          {label:"Watch live candidate run", fn:`startAhaRun('${a.id}')`}
        ].filter(Boolean))}
      </div>
      <div class="metric-grid">
        <div class="metric"><div class="mcopy"><label>Invited</label><b>${a.invited}</b><span>total</span></div><span class="mico blue">${icoMail()}</span></div>
        <div class="metric"><div class="mcopy"><label>Attempted</label><b>${a.completed}</b><span>completed</span></div><span class="mico green">${icoUserCheck()}</span></div>
        <div class="metric"><div class="mcopy"><label>Cleared</label><b>${a.shortlisted||0}</b><span>${clearPct}% clear rate</span></div><span class="mico emerald">${icoCheck()}</span></div>
        <div class="metric"><div class="mcopy"><label>Pending</label><b>${pending}</b><span>not started</span></div><span class="mico orange">${icoClock()}</span></div>
        <div class="metric"><div class="mcopy"><label>Credits Reverted</label><b>0</b><span>refunded unused invites</span></div><span class="mico sky">${icoRotate()}</span></div>
        <div class="metric"><div class="mcopy"><label>Avg Score</label><b>${avg==null?"—":avg+"%"}</b><span>average</span></div><span class="mico purple">${icoTrend()}</span></div>
        <div class="metric"><div class="mcopy"><label>Completion Rate</label><b>${a.invited?pct+"%":"—"}</b><span>of invited</span></div><span class="mico cyan">${icoPercent()}</span></div>
        <div class="metric"><div class="mcopy"><label>No Show Rate</label><b>${a.invited?noshow+"%":"—"}</b><span>not completed</span></div><span class="mico red">${icoTrendDown()}</span></div>
        <div class="metric"><div class="mcopy"><label>Avg Completion Time</label><b>${a.duration}</b><span>average</span></div><span class="mico amber">${icoTimer()}</span></div>
      </div>
      <div class="te-card" style="margin-top:14px">
        <b>Candidates</b>
        <table class="mtable" style="margin-top:10px;border:0"><thead><tr><th></th><th>Name</th><th>Score</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <p class="te-note">Click a row to open the invite email or the candidate report.${linked?" A linked AI Interview is also available from the menu.":""}</p>
      </div>`;
    return;
  }

  if(appDetail?.type==="interview"){
    const iv = interviews.find(x=>x.id===appDetail.id);
    const a = assessments.find(x=>x.id===iv.assessmentId);
    const rows = iv.candidates.length
      ? iv.candidates.map(c=>`<tr onclick="openCandidateFromDash('interview','${iv.id}','${c.id}')">
          <td><span class="te-av">${escapeHtml(initials(c.name))}</span></td>
          <td><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.email||c.status)}</small></td>
          <td class="te-score">${c.score}</td>
          <td><span class="te-pill">${c.status==="Completed"?"High":c.status==="In progress"?"Medium":"—"}</span></td>
          <td>${iv.duration}</td>
          <td><span class="te-pill ${c.status==="In progress"?"warn":c.status==="Invited"?"idle":""}">${escapeHtml(c.status)}</span></td>
        </tr>`).join("")
      : `<tr><td colspan="6" style="color:#6b7280;cursor:default">No sessions yet. Invite candidates to start.</td></tr>`;
    content.innerHTML = `<div class="dash-id" data-tour="dashboard">
        <div class="dash-id-l">
          <button class="te-iconback" type="button" aria-label="Back" onclick="appNav('ai-interviewer')">←</button>
          <span class="mh-ico blue">${icoMsg()}</span>
          <div>
            <h1>${escapeHtml(iv.title)}</h1>
            <p class="te-note" style="margin:0">${escapeHtml(iv.role)} · ${iv.duration}</p>
          </div>
          ${statusPill(iv.status)}
        </div>
        <div class="te-actions">
          <button class="te-btn ghost" type="button" onclick="later('Details')">Details</button>
          <button class="te-btn ghost" type="button" onclick="later('Share')">Share</button>
          <button class="te-btn" type="button" onclick="startInvite('interview','${iv.id}')">Invite yourself</button>
        </div>
      </div>
      <div class="dash-meta">${a?`<span>Linked to ${escapeHtml(a.title)}</span>`:""}<span>${iv.created}</span></div>
      <div class="metric-grid">
        <div class="metric"><div class="mcopy"><label>Invited</label><b>${iv.invited}</b><span>Interview invites</span></div><span class="mico blue">${icoMail()}</span></div>
        <div class="metric"><div class="mcopy"><label>Completed</label><b>${iv.completed}</b><span>Sessions done</span></div><span class="mico green">${icoUserCheck()}</span></div>
        <div class="metric"><div class="mcopy"><label>Duration</label><b>${iv.duration}</b><span>Per candidate</span></div><span class="mico amber">${icoTimer()}</span></div>
        <div class="metric"><div class="mcopy"><label>Integrity</label><b>High</b><span>Session average</span></div><span class="mico emerald">${icoCheck()}</span></div>
      </div>
      <div class="te-card" style="margin-top:14px">
        <b>Candidates</b>
        <table class="mtable" style="margin-top:10px;border:0"><thead><tr><th></th><th>Candidate</th><th>Score</th><th>Integrity</th><th>Duration</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <p class="te-note">Click a row to open the invite email or the candidate report.</p>
      </div>`;
    return;
  }

  if(appSection==="meritedge"){
    const items = filterItems(catalogAssessments(), "title");
    const empty = !items.length ? `<p class="te-note">No assessments match.</p>` : "";
    const list = listViewMode==="table"
      ? `<table class="mtable" data-tour="list"><thead><tr><th>Assessment Name</th><th>Status</th><th>Duration</th><th>Candidates</th><th>Questions</th><th>Created</th><th class="right">Actions</th></tr></thead><tbody>${
          items.map(a=>`<tr onclick="openAssessment('${a.id}')">
            <td>${nameBlock(icoFile(), a.title, a.createdBy||actorName())}</td>
            <td>${statusPill(a.status)}</td>
            <td>${icoClock()} ${a.duration}</td>
            <td>${funnel(a.completed, a.invited)}</td>
            <td>${a.qcount||a.questions?.length||0}</td>
            <td>${a.created}</td>
            <td class="right" onclick="event.stopPropagation()"><span class="actrow"><button class="invite-mini" type="button" onclick="startInvite('assessment','${a.id}')">${icoUserPlus()} Invite yourself</button>${kebab(a.id, assessActions(a))}</span></td>
          </tr>`).join("") || `<tr><td colspan="7" style="color:#6b7280">No assessments match.</td></tr>`
        }</tbody></table>`
      : listViewMode==="card"
      ? `<div class="mgrid" data-tour="list">${items.map(a=>`<div class="mcard" onclick="openAssessment('${a.id}')">
          <div class="mcard-h"><span class="mh-ico">${icoFile()}</span>${statusPill(a.status)}${kebab(a.id, assessActions(a))}</div>
          <div class="mcard-b"><b>${escapeHtml(a.title)}</b><small>${a.sections||1} section${(a.sections||1)===1?"":"s"} · ${a.qcount||a.questions?.length||0} questions</small></div>
          <div class="mcard-s"><span>${icoClock()} ${a.duration}</span><span>${icoUsers()} ${a.invited} invited</span></div>
          <div class="mcard-f"><span>${a.created}</span><button class="invite-mini" type="button" onclick="event.stopPropagation();startInvite('assessment','${a.id}')">Invite yourself</button></div>
        </div>`).join("")}${empty}</div>`
      : `<div class="mlist" data-tour="list">
          <div class="mgroup-h">▾ Active <span>${items.filter(a=>a.status==="Active").length}</span></div>
          ${items.map(a=>`<div class="mlist-row" onclick="openAssessment('${a.id}')">
            <span class="mh-ico">${icoFile()}</span>
            <span class="mname" style="flex:1"><b>${escapeHtml(a.title)}</b><small>${escapeHtml(a.role||"")} · ${a.duration}</small></span>
            ${funnel(a.completed, a.invited)}
            ${statusPill(a.status)}
            <button class="invite-mini" type="button" onclick="event.stopPropagation();startInvite('assessment','${a.id}')">Invite yourself</button>
            <span onclick="event.stopPropagation()">${kebab(a.id, assessActions(a))}</span>
          </div>`).join("")}${empty}
        </div>`;
    content.innerHTML = `<div class="me-first">${accountReportsHtml(u)}${moduleHeader({icon:icoBrain(), title:"MeritEdge Assessments", subtitle:"Cognitive & aptitude assessments", count:`${catalogAssessments().length} assessments`, createLabel:"Create Assessment", createFn:"startCreateAssessment()", tourSpot:"create"})}
      ${moduleToolbar("assessment")}
      ${list}</div>`;
    return;
  }

  if(appSection==="ai-interviewer"){
    const items = filterItems(catalogInterviews(), "title");
    const empty = !items.length ? `<p class="te-note">No interviews match.</p>` : "";
    const list = listViewMode==="table"
      ? `<table class="mtable" data-tour="ivlist"><thead><tr><th>Interview Name</th><th>Status</th><th>Duration</th><th>Candidates</th><th>Created</th><th class="right">Actions</th></tr></thead><tbody>${
          items.map(iv=>`<tr onclick="openInterview('${iv.id}')">
            <td>${nameBlock(icoBot(), iv.title, iv.createdBy||actorName())}</td>
            <td>${statusPill(iv.status)}</td>
            <td>${icoClock()} ${iv.duration}</td>
            <td>${funnel(iv.completed, iv.invited)}</td>
            <td>${iv.created}</td>
            <td class="right" onclick="event.stopPropagation()"><span class="actrow"><button class="invite-mini" type="button" onclick="startInvite('interview','${iv.id}')">${icoUserPlus()} Invite yourself</button>${kebab(iv.id, interviewActions(iv))}</span></td>
          </tr>`).join("") || `<tr><td colspan="6" style="color:#6b7280">No interviews match.</td></tr>`
        }</tbody></table>`
      : listViewMode==="card"
      ? `<div class="mgrid" data-tour="ivlist">${items.map(iv=>`<div class="mcard" onclick="openInterview('${iv.id}')">
          <div class="mcard-h"><span class="mh-ico">${icoBot()}</span>${statusPill(iv.status)}${kebab(iv.id, interviewActions(iv))}</div>
          <div class="mcard-b"><b>${escapeHtml(iv.title)}</b><small>${escapeHtml(iv.role||"No role specified")}</small></div>
          <div class="mcard-s"><span>${icoClock()} ${iv.duration}</span><span>${icoUsers()} ${iv.invited} invited</span><span>${iv.completed} done</span></div>
          <div class="mcard-f"><span>${iv.created}</span><button class="invite-mini" type="button" onclick="event.stopPropagation();startInvite('interview','${iv.id}')">Invite yourself</button></div>
        </div>`).join("")}${empty}</div>`
      : `<div class="mlist" data-tour="ivlist">${items.map(iv=>`<div class="mlist-row" onclick="openInterview('${iv.id}')">
          <span class="mh-ico">${icoBot()}</span>
          <span class="mname" style="flex:1"><b>${escapeHtml(iv.title)}</b><small>${escapeHtml(iv.role)} · ${iv.duration}</small></span>
          ${funnel(iv.completed, iv.invited)}
          ${statusPill(iv.status)}
          <button class="invite-mini" type="button" onclick="event.stopPropagation();startInvite('interview','${iv.id}')">Invite yourself</button>
          <span onclick="event.stopPropagation()">${kebab(iv.id, interviewActions(iv))}</span>
        </div>`).join("")}${empty}</div>`;
    content.innerHTML = `${accountReportsHtml(u)}${moduleHeader({icon:icoMsg(), title:"AI Interviewer", subtitle:"Real-time voice & chat interviews with AI-powered evaluation", count:`${catalogInterviews().length} interviews`, createLabel:"Create AI Interview", createFn:"startCreateInterview()", tourSpot:"create", spark:true, accent:"blue"})}
      ${moduleToolbar("interview")}
      ${list}`;
    return;
  }

  const tabs = dashTabs("home");
  const listedA = catalogAssessments();
  const listedIv = catalogInterviews();
  const shortlisted = listedA.reduce((n,a)=>n+(a.shortlisted||0),0);
  content.innerHTML = `<div class="te-mast">
      <h1 class="te-co-name">${escapeHtml(u.company)}</h1>
      <p class="te-tag">TalentEdge · MeritEdge + AI Interviewer${state.intent?` · ${escapeHtml(intentRole())}`:""}</p>
      ${proofChipsHtml()}
      <div class="te-tabs">${tabs}</div>
    </div>
    <div class="te-kpis" data-tour="kpis">
      <div class="te-kpi"><label>MeritEdge</label><b class="count-up" data-to="${listedA.length}">00</b><span>Published assessments</span></div>
      <div class="te-kpi"><label>AI Interviewer</label><b class="count-up" data-to="${listedIv.length}">00</b><span>Active interviews</span></div>
      <div class="te-kpi"><label>Shortlisted</label><b class="count-up" data-to="${shortlisted}">00</b><span>Ready for next round</span></div>
    </div>
    <div class="te-card" style="margin-top:14px">
      <div class="te-modhead" style="margin:0 0 8px"><div><h2 style="font-size:15px">MeritEdge</h2></div><button class="te-btn ghost" onclick="appNav('meritedge')">View all</button></div>
      ${listedA.map(a=>`<button class="te-row" onclick="openAssessment('${a.id}')">
        <span class="te-ico-mod">M</span>
        <span><b>${escapeHtml(a.title)}</b><small>${a.completed}/${a.invited} completed</small></span>
        <span class="te-meta">${a.shortlisted} shortlisted</span>
        <span class="te-pill">${a.status}</span>
      </button>`).join("")}
    </div>
    <div class="te-card" style="margin-top:12px">
      <div class="te-modhead" style="margin:0 0 8px"><div><h2 style="font-size:15px">AI Interviewer</h2></div><button class="te-btn ghost" onclick="appNav('ai-interviewer')">View all</button></div>
      ${listedIv.map(iv=>`<button class="te-row" onclick="openInterview('${iv.id}')">
        <span class="te-ico-mod">AI</span>
        <span><b>${escapeHtml(iv.title)}</b><small>${iv.completed}/${iv.invited} sessions complete</small></span>
        <span class="te-meta">${iv.duration}</span>
        <span class="te-pill">${iv.status}</span>
      </button>`).join("")}
    </div>
    <p class="te-note">${u.kind==="preview"?"Product preview":u.kind==="trial"?"Trial sample data":"Sales sample data"} · create-to-publish is clickable · not saved to MeritEdge</p>`;
    requestAnimationFrame(animateCounts);
}

function milestoneGo(id){
  if(id==="assessment_created") startCreateAssessment();
  else if(id==="candidate_invited") startInvite("assessment", assessments[0].id);
  else if(id==="report_viewed"){
    const a = assessments[0];
    const cand = a?.candidates?.find(c=>c.status==="Completed"||c.status==="Shortlisted") || a?.candidates?.[0];
    if(cand) openCandidateFromDash("assessment", a.id, cand.id);
    else openAssessment(a.id);
  }
  else later(MILESTONES.find(m=>m.id===id)?.label || id);
}

document.addEventListener("keydown", e => {
  const demoOpen = document.getElementById("demoReel")?.classList.contains("open");
  if(demoOpen && !/input|textarea|select/i.test(e.target.tagName||"")){
    if(e.key===" " || e.code==="Space"){ e.preventDefault(); pauseDemoReel(); return; }
    if(e.key==="ArrowRight"){ e.preventDefault(); demoGo(1); return; }
    if(e.key==="ArrowLeft"){ e.preventDefault(); demoGo(-1); return; }
  }
  if(e.key==="Escape"){
    if(document.getElementById("tourIntro")?.classList.contains("open")){ skipTourIntro(); return; }
    if(demoOpen){
      if(demoReel && !demoReel.ended) endDemoReel();
      else tryDemoYourself();
      return;
    }
    if(document.getElementById("rzpOverlay")?.classList.contains("open")){ closeRazorpay(); return; }
    if(document.getElementById("trialJourneyOverlay")?.classList.contains("open")){ closeTrialJourney(); return; }
    if(document.getElementById("billJourneyOverlay")?.classList.contains("open")){ closeBillJourney(); return; }
    if(document.getElementById("referMailOverlay")?.classList.contains("open")){ closeReferShare(); return; }
    if(document.getElementById("inviteMailOverlay")?.classList.contains("open")){ closeInviteMail(); return; }
    if(document.getElementById("candExamOverlay")?.classList.contains("open")){ closeCandExam(); return; }
    closeSignup(); closeInfo(); closeIntentPicker(); closeReady(); closeSitIn(); closeGstMail(); closeReferShare(); if(wow?.canSkip) closeWow(); openKebab=null; if(tour) stopTour();
  }
});
window.addEventListener("resize", ()=>{ if(demoReel) syncDemoFrame(); positionAppClickPointer(); });
window.addEventListener("scroll", positionAppClickPointer, true);
document.addEventListener("click", e => {
  if(openKebab && !e.target.closest(".kebab, .kmenu")){ openKebab = null; renderWorkspace(); }
  if(!e.target.closest(".crep-dl")) document.querySelectorAll(".crep-menu.open").forEach(el=>el.classList.remove("open"));
  if((listDateOpen||listStatusOpen) && !e.target.closest(".me-popwrap")){ listDateOpen = false; listStatusOpen = false; renderWorkspace(); }
});
["loginEmail","loginPassword"].forEach(id => {
  document.getElementById(id)?.addEventListener("keydown", e => { if(e.key==="Enter") signIn(); });
});

Object.assign(window, {
  applyListDates, appNav, beginCheckout, beginProductTour, captureBillEmail,
  clearJd, closeBillJourney, closeGstMail, closeInfo, closeIntentPicker, closeInviteMail,
  closeListPops, closeRazorpay, closeReady, closeReferShare, closeSignup, closeSitIn,
  closeSso, closeTourIntro, closeTrialJourney, closeWow, confirmIntent, confirmSsoPerms,
  continueReadyInvites, copyInviteCode, cxAgree, cxFinishExam, cxGo, cxNextQ, cxPick, inviteAgree,
  demoGo, endDemoReel, finishBillJourneyToApp, finishTour, finishTourAndTry,
  generateAiAssessment, generateAiInterview, goExistingLogin, goTrialDay, ivAnswer,
  ivFaceOk, ivFinish, ivGo, ivMicOk, ivNextTurn, ivReportTab, ivRunMic, ivSet,
  ivSpeakCurrent, ivToggle, ivUseName, ivVoiceAnswer, jumpDemoById, jumpDemoScene,
  launchBillRazorpay, leavePlansAfterPay, lockedFeature, mePickQ, meSetExp, meSetWindow,
  meToggle, milestoneGo, nextBillScreen, nextTrialPath, openAssessment, openCandidateFromDash,
  backToAssessments, backToCreateAssessment, openAccountReport, openCreditsNav, openInfo, openInterview, openInvitedReport, openPaidSplit, openReferShare,
  openUpgradePlans, pasteSampleJd, pauseDemoReel, pauseTour, pickAssessBuild, pickListStatus,
  pickSsoAccount, pinPress, prevBillScreen, prevTrialPath, printGstInvoice, publishAssessment,
  publishInterview, replayProductTour, requestDemoCode, resetListDates, resumePendingCreate,
  selectSampleJd, selectTrialMail, sendGstSmtp, sendInviteFromEmails, sendInvites,
  sendPublishedInvite, sendReferShare, setAiTab, setBillCycle, setIntent, setListTrack,
  setListView, setLoginSlide, showSignupStep, showView, signOut, skipTourIntro,
  skipTrialClock, startBillMailStory, startCreateAssessment, startCreateInterview, startFlow,
  startInvite, startInvitedAttempt, startSso, submitPayAuth, submitPayDetails, toast,
  toggleDemoMute, toggleKebab, toggleListPop, togglePw, toggleTheme, toggleTourMute,
  tourGoBack, tourJumpAi, tourJumpProctor, tryDemoYourself, upgradeFromTrialMail,
  verifyDemoCode, wizBack, wizGoto, wizNext, wizSetIvSource, wizSetMethod, wizUseTemplate,
  focusedBackToCreate, focusedCreateAssessment, focusedRoleFocus, focusedRoleMouseDown, focusedSelectJd, focusedTogglePanel,
  onFocusedJdFile, setFocusedFilter,
  wowFromCta
});

(function boot(){
  try{ window.speechSynthesis?.getVoices(); window.speechSynthesis?.addEventListener("voiceschanged", ()=>window.speechSynthesis.getVoices()); }catch(e){}
  applyTheme(currentTheme());
  hydrateFromData();
  startLandingMicrocopy();
  enterSalesPreview();
  if(new URLSearchParams(location.search).get("story")==="trial"){
    closeTourIntro();
    openRegisteredTrialStory();
  }
})();
