/* AZA UNIVERSE Social Hub v1 — global chat, friends, DMs, online/last-seen.
   Lightweight vanilla JS. Requires the existing Supabase browser SDK/config and signed-in session. */
(() => {
  "use strict";
  if (window.__AZA_SOCIAL_HUB__) return;
  window.__AZA_SOCIAL_HUB__ = true;

  const cfg = window.AZA_SUPABASE_CONFIG || {};
  const API = String(cfg.projectUrl || "").replace(/\/$/, "");
  const KEY = String(cfg.publishableKey || "");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(API) || !KEY.startsWith("sb_publishable_")) {
    console.warn("AZA Social Hub: Supabase config is not available.");
    return;
  }

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const lang = () => localStorage.getItem("aza-lang") || document.documentElement.lang || "ky";
  const t = (ky, ru) => lang() === "ru" ? ru : ky;
  const validId = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
  const FOUNDER_ID = "362b8778-de25-4846-9bf7-c514842d159e";
  const frameIds = ["bronze","silver","gold","platinum","diamond","master","ace","conqueror"];
  const ranks = [
    {id:"bronze",min:0,ky:"Коло",ru:"Бронза"},{id:"silver",min:500,ky:"Күмүш",ru:"Серебро"},
    {id:"gold",min:1500,ky:"Алтын",ru:"Золото"},{id:"platinum",min:3000,ky:"Платина",ru:"Платина"},
    {id:"diamond",min:5000,ky:"Алмаз",ru:"Алмаз"},{id:"master",min:8000,ky:"Мастер",ru:"Мастер"},
    {id:"ace",min:12000,ky:"Эйс",ru:"Эйс"},{id:"conqueror",min:20000,ky:"Космостук жеңүүчү",ru:"Завоеватель"}
  ];
  const copy = {
    global: ["Жалпы чат","Общий чат"], friends: ["Достор","Друзья"], dms: ["Жеке чаттар","Личные чаты"],
    title: ["AZA SOCIAL HUB","AZA SOCIAL HUB"], intro: ["Достор менен байланыш, жалпы чат жана оюнчулардын абалы.","Общий чат, друзья и статус игроков в одном месте."],
    online: ["Онлайн","В сети"], offline: ["Оффлайн","Не в сети"], lastSeen: ["Акыркы жолу: ","Был(а): "],
    globalHint: ["Сылык сүйлөш. HTML жана активдүү шилтемелер иштетилбейт.","Общайся уважительно. HTML и активные ссылки не выполняются."],
    placeholder: ["Билдирүү жаз…","Напиши сообщение…"], send: ["Жөнөтүү","Отправить"],
    loadError: ["Жүктөлгөн жок. Кайра аракет кыл.","Не удалось загрузить. Попробуй ещё раз."],
    login: ["Чат жана достор үчүн аккаунтка кир.","Войди в аккаунт, чтобы пользоваться чатом и друзьями."],
    openProfile: ["Аккаунтка кирүү","Войти в аккаунт"], search: ["Колдонуучунун атын издөө","Найти пользователя по имени"],
    searchHint: ["Атын кеминде 3 белги менен жаз.","Введи имя длиной от 3 символов."], find: ["Издөө","Найти"], add: ["Доско кошуу","Добавить в друзья"],
    requestSent: ["Сурам жөнөтүлдү.","Заявка отправлена."], requestAccepted: ["Достук сурамы кабыл алынды.","Заявка принята."],
    incoming: ["Келген сурамдар","Входящие заявки"], outgoing: ["Жөнөтүлгөн сурамдар","Отправленные заявки"],
    accept: ["Кабыл алуу","Принять"], decline: ["Баш тартуу","Отклонить"], pending: ["Күтүүдө","Ожидает"],
    myFriends: ["Менин досторум","Мои друзья"], openChat: ["Чат ачуу","Открыть чат"], remove: ["Достордон өчүрүү","Удалить из друзей"], block: ["Блоктоо","Заблокировать"],
    blocked: ["Блоктолгондор","Заблокированные"], unblock: ["Блоктон чыгаруу","Разблокировать"],
    emptyFriends: ["Азырынча достор жок. Колдонуучуну издеп, сурам жибер.","Пока нет друзей. Найди пользователя и отправь заявку."],
    noMessages: ["Азырынча билдирүү жок. Биринчи болуп жаз!","Сообщений пока нет. Напиши первым!"],
    noResults: ["Колдонуучу табылган жок.","Пользователи не найдены."],
    noRequests: ["Жаңы сурам жок.","Новых заявок нет."],
    confirmRemove: ["Бул колдонуучуну достордон өчүрөсүңбү?","Удалить этого пользователя из друзей?"],
    confirmBlock: ["Колдонуучуну блоктойсуңбу? Достук жана жеке чат жабылат.","Заблокировать пользователя? Дружба и личный чат будут закрыты."],
    confirmDecline: ["Достук сурамынан баш тартасыңбы?","Отклонить заявку в друзья?"],
    confirmUnblock: ["Блоктон чыгаргың келеби?","Разблокировать пользователя?"],
    blockedToast: ["Колдонуучу блоктолду.","Пользователь заблокирован."], removedToast: ["Дос өчүрүлдү.","Друг удалён."],
    messageError: ["Билдирүү жөнөтүлгөн жок. Достук/блок абалын текшер.","Сообщение не отправлено. Проверь дружбу и блокировки."],
    rateError: ["Өтө бат жазып жатасың. Бир аз күтө тур.","Слишком быстро. Подожди немного."],
    report: ["Билдирүүгө даттануу","Пожаловаться на сообщение"], reportPrompt: ["Себебин жаз (3–300 белги):","Укажи причину (3–300 символов):"],
    reportSent: ["Даттануу кабыл алынды.","Жалоба отправлена."],
    chatWith: [" менен жеке чат"," — личный чат"], noPrivateFriends: ["Жеке чат үчүн дос кош.","Добавь друга, чтобы начать личный чат."],
    points: ["упай","очков"], rank: ["Ранг","Ранг"],
    sent: ["Жөнөтүлдү","Отправлено"], retry: ["Кайра жүктөө","Повторить"], close: ["Жабуу","Закрыть"],
    onlineFriends: ["Достор онлайн: ","Друзей в сети: "], messageLen: ["Билдирүү 1–1000 белгиден турушу керек.","Сообщение должно содержать 1–1000 символов."]
  };
  const txt = key => { const a = copy[key] || [key,key]; return t(a[0],a[1]); };

  function readSession() {
    try {
      for (let i=0;i<localStorage.length;i++) {
        const key=localStorage.key(i);
        if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
        const raw=localStorage.getItem(key); if(!raw) continue;
        const parsed=JSON.parse(raw); const s=parsed?.currentSession||parsed?.session||parsed;
        if(s?.access_token && s?.user?.id && validId(s.user.id)) return {access_token:s.access_token,refresh_token:s.refresh_token,user:s.user};
      }
    } catch(e) { console.warn("AZA social session read failed",e); }
    return null;
  }
  function authHeaders(session, extra={}) {
    const h={apikey:KEY,Accept:"application/json",...extra};
    if(session?.access_token) h.Authorization=`Bearer ${session.access_token}`;
    return h;
  }
  async function api(path, options={}, explicitSession=null) {
    const session=explicitSession||readSession();
    const headers=authHeaders(session,options.headers||{});
    const fetchOptions={...options,headers}; delete fetchOptions.session;
    const response=await fetch(`${API}${path}`,fetchOptions);
    const raw=await response.text(); let body=null;
    try { body=raw?JSON.parse(raw):null; } catch { body=raw; }
    if(!response.ok) throw new Error(String(body?.message||body?.details||body?.hint||body?.error_description||body?.error||`HTTP ${response.status}`));
    return body;
  }
  const rpc=(name,body,session=readSession())=>api(`/rest/v1/rpc/${name}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})},session);
  const rankFor = points => [...ranks].reverse().find(r=>Number(points||0)>=r.min)||ranks[0];
  function safeAvatar(value) {
    if(!value)return "";
    try {
      const u=new URL(String(value),location.href);
      const sameSite=u.origin===location.origin && /(?:^|\/)avatar-[a-z0-9-]+\.svg$/i.test(u.pathname);
      const storage=u.origin===new URL(API).origin && u.pathname.startsWith("/storage/v1/object/public/profile-avatars/") && /\.(?:webp|png|jpe?g)$/i.test(u.pathname);
      return sameSite||storage?u.href:"";
    } catch { return ""; }
  }
  function initials(name){return esc(String(name||"A").trim().slice(0,1).toUpperCase()||"A");}
  function avatar(p,size="") {
    const isFounder=String(p?.id||"").toLowerCase()===FOUNDER_ID;
    const frame=isFounder?"founder":(frameIds.includes(p?.avatar_frame)?p.avatar_frame:"bronze");
    const url=safeAvatar(p?.avatar_url); const label=isFounder?"AZAMAT AKMATOV · @AZAUNIVERSE":esc(p?.username||"AZA Player");
    return `<span class="aza-social-avatar aza-profile-avatar aza-frame-${frame} ${size}" title="${label}">${url?`<img src="${esc(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:`<span class="aza-avatar-initial">${initials(p?.username)}</span>`}</span>`;
  }
  function formatLastSeen(value, isOnline=false) {
    const d=value?new Date(value):null;
    const online=!!isOnline&&d&&Number.isFinite(d.getTime())&&(Date.now()-d.getTime()<4*60*1000);
    if(online)return `<span class="aza-presence-dot is-online"></span>${txt("online")}`;
    if(!d||!Number.isFinite(d.getTime()))return `<span class="aza-presence-dot"></span>${txt("offline")}`;
    const min=Math.max(0,Math.floor((Date.now()-d.getTime())/60000));
    let ago;
    if(min<1) ago=t("азыр эле","только что");
    else if(min<60) ago=t(`${min} мүнөт мурун`,`${min} мин. назад`);
    else if(min<1440) ago=t(`${Math.floor(min/60)} саат мурун`,`${Math.floor(min/60)} ч. назад`);
    else ago=t(`${Math.floor(min/1440)} күн мурун`,`${Math.floor(min/1440)} дн. назад`);
    return `<span class="aza-presence-dot"></span>${txt("lastSeen")}${esc(ago)}`;
  }
  const profileCache=new Map();
  async function getProfiles(ids,session=readSession()) {
    const clean=[...new Set(ids.filter(validId))];
    const missing=clean.filter(id=>!profileCache.has(id));
    if(missing.length) {
      const path=`/rest/v1/profiles?select=id,username,avatar_url,avatar_frame,total_points,created_at&id=in.(${missing.join(",")})&limit=${Math.min(100,missing.length)}`;
      const rows=await api(path,{},session);
      for(const p of rows||[]) profileCache.set(p.id,p);
      for(const id of missing) if(!profileCache.has(id)) profileCache.set(id,{id,username:"AZA Player",total_points:0,avatar_frame:"bronze",avatar_url:null});
    }
    return clean.map(id=>profileCache.get(id));
  }
  async function getPresence(ids,session=readSession()) {
    const clean=[...new Set(ids.filter(validId))]; if(!clean.length)return new Map();
    const rows=await api(`/rest/v1/aza_user_presence?select=user_id,is_online,last_seen_at&user_id=in.(${clean.join(",")})&limit=${Math.min(200,clean.length)}`,{},session);
    return new Map((rows||[]).map(x=>[x.user_id,x]));
  }

  let overlay=null, content=null, activeTab="global", currentFriend=null, currentFriendData=null;
  let rtClient=null, rtChannel=null, realtimeUserId=null, heartbeatTimer=null, pollTimer=null, isBusy=false;
  let currentSession=null, blockedIds=new Set(), relationRows=[], activeMessages=[], friendProfiles=new Map(), presenceMap=new Map(), lastMessageFetchKey="";

  function ensureOverlay() {
    if(overlay)return;
    overlay=document.createElement("div"); overlay.id="aza-social-overlay"; overlay.className="aza-social-overlay"; overlay.hidden=true;
    overlay.innerHTML=`<div class="aza-social-backdrop" data-social-close></div><section class="aza-social-window" role="dialog" aria-modal="true" aria-labelledby="azaSocialTitle"><header class="aza-social-head"><div><span class="aza-social-eyebrow">AZA UNIVERSE · COMMUNITY</span><h2 id="azaSocialTitle">AZA SOCIAL HUB</h2><p>${esc(txt("intro"))}</p></div><button class="aza-social-close" type="button" data-social-close aria-label="${esc(txt("close"))}">×</button></header><nav class="aza-social-tabs" aria-label="Social Hub"><button type="button" data-social-tab="global">🌐 ${esc(txt("global"))}</button><button type="button" data-social-tab="friends">♧ ${esc(txt("friends"))} <span id="azaSocialFriendBadge" class="aza-social-badge" hidden></span></button><button type="button" data-social-tab="dms">✉ ${esc(txt("dms"))}</button></nav><div class="aza-social-content" id="azaSocialContent"><div class="aza-social-loading">${esc(t("Жүктөлүүдө…","Загрузка…"))}</div></div></section>`;
    document.body.appendChild(overlay); content=$("#azaSocialContent",overlay);
    overlay.addEventListener("click",onOverlayClick);
    overlay.addEventListener("submit",onOverlaySubmit);
    overlay.addEventListener("keydown",e=>{if(e.key==="Escape")closeSocial();});
  }
  function socialToast(message) {
    const old=$("#azaSocialToast"); if(old)old.remove();
    const el=document.createElement("div");el.id="azaSocialToast";el.className="aza-social-toast";el.textContent=message;document.body.appendChild(el);
    setTimeout(()=>el.remove(),2800);
  }
  function openSocial(tab="global", friendId=null) {
    const session=readSession();
    if(!session) { const profile=$('[data-open="profile"]'); if(profile)profile.click(); else socialToast(txt("login")); return; }
    currentSession=session; activeTab=tab; currentFriend=validId(friendId)?friendId:null;
    ensureOverlay(); overlay.hidden=false; document.body.classList.add("aza-social-open");
    refreshSocialText(); updateTabButtons(); startPresence(session); connectRealtime(session);
    renderActiveTab();
    if(pollTimer)clearInterval(pollTimer);
    pollTimer=setInterval(()=>{
      if(overlay && !overlay.hidden && activeTab==="friends") void loadFriends(true);
    },45000);
  }
  function closeSocial() {
    if(overlay)overlay.hidden=true;
    document.body.classList.remove("aza-social-open");
    if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
    if(rtClient&&rtChannel){try{rtClient.removeChannel(rtChannel);}catch{} rtChannel=null;}
    currentFriend=null;currentFriendData=null;activeMessages=[];lastMessageFetchKey="";
  }
  function refreshSocialText() {
    if(!overlay)return;
    const head=$("#azaSocialTitle",overlay);if(head)head.textContent=txt("title");
    const p=$(".aza-social-head p",overlay);if(p)p.textContent=txt("intro");
    const labels={global:`🌐 ${txt("global")}`,friends:`♧ ${txt("friends")}`,dms:`✉ ${txt("dms")}`};
    $$("[data-social-tab]",overlay).forEach(b=>{const key=b.dataset.socialTab;const badge=$("#azaSocialFriendBadge",overlay);b.childNodes[0].textContent=labels[key]+" ";if(key==="friends"&&badge)b.appendChild(badge);});
  }
  function updateTabButtons(){
    if(!overlay)return;
    $$("[data-social-tab]",overlay).forEach(b=>{const is=b.dataset.socialTab===activeTab;b.classList.toggle("active",is);b.setAttribute("aria-selected",String(is));});
  }
  async function renderActiveTab() {
    if(!content||!overlay||overlay.hidden)return;
    updateTabButtons();content.innerHTML=`<div class="aza-social-loading"><span class="aza-social-spinner"></span><p>${esc(t("Маалымат жүктөлүүдө…","Загружаем данные…"))}</p></div>`;
    const session=readSession();if(!session){content.innerHTML=loginPanel();return;}currentSession=session;
    try {
      if(activeTab==="global") await renderGlobalChat(session);
      else if(activeTab==="friends") await loadFriends(false,session);
      else await renderDMs(session);
    } catch(error) {
      console.warn("AZA Social Hub load",error);
      if(content)content.innerHTML=`<div class="aza-social-error"><p>${esc(txt("loadError"))}</p><small>${esc(error.message||"")}</small><button type="button" class="btn btn-outline" data-social-retry>${esc(txt("retry"))}</button></div>`;
    }
  }
  function loginPanel(){return `<div class="aza-social-empty"><div class="aza-social-empty-icon">✦</div><h3>${esc(txt("login"))}</h3><button type="button" class="btn btn-primary" data-social-login>${esc(txt("openProfile"))}</button></div>`;}

  async function connectRealtime(session) {
    if(!window.supabase||typeof window.supabase.createClient!=="function")return;
    if(rtClient&&realtimeUserId===session.user.id&&rtChannel){try{rtClient.realtime.setAuth(session.access_token);}catch{}return;}
    if(rtClient&&rtChannel){try{await rtClient.removeChannel(rtChannel);}catch{}rtChannel=null;}
    try {
      rtClient=window.supabase.createClient(API,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      rtClient.realtime.setAuth(session.access_token);realtimeUserId=session.user.id;
      rtChannel=rtClient.channel("aza-social-chat-live")
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"aza_chat_messages"},payload=>{void receiveRealtimeMessage(payload.new).catch(e=>console.warn("Social realtime row",e));})
        .subscribe(status=>{if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")console.warn("AZA Social realtime status",status);});
    } catch(error) { console.warn("AZA Social realtime unavailable",error); }
  }
  async function receiveRealtimeMessage(row) {
    if(!row||!overlay||overlay.hidden)return;
    if(row.sender_id && blockedIds.has(row.sender_id))return;
    const globalMatch=activeTab==="global"&&row.room_type==="global";
    const dmMatch=activeTab==="dms"&&currentFriend&&row.room_type==="direct"&&((row.sender_id===currentFriend&&row.recipient_id===currentSession?.user.id)||(row.recipient_id===currentFriend&&row.sender_id===currentSession?.user.id));
    if(!globalMatch&&!dmMatch)return;
    if(activeMessages.some(x=>String(x.id)===String(row.id)))return;
    await getProfiles([row.sender_id]);activeMessages.push(row);activeMessages=activeMessages.slice(-80);renderMessageList();
  }
  async function startPresence(session=readSession()) {
    if(!session)return;
    currentSession=session;
    try { await rpc("aza_touch_presence",{},session); } catch(error) { console.warn("AZA presence touch",error.message); }
    if(heartbeatTimer)clearInterval(heartbeatTimer);
    heartbeatTimer=setInterval(async()=>{
      const latest=readSession();
      if(!latest){clearInterval(heartbeatTimer);heartbeatTimer=null;return;}
      currentSession=latest;
      try { await rpc("aza_touch_presence",{},latest); if(rtClient)rtClient.realtime.setAuth(latest.access_token); }
      catch(error){console.warn("AZA presence heartbeat",error.message);}
    },120000);
  }
  async function setOffline() {
    const session=readSession();if(!session)return;
    try {
      const headers=authHeaders(session,{"Content-Type":"application/json"});
      await fetch(`${API}/rest/v1/rpc/aza_set_offline`,{method:"POST",headers,body:"{}",keepalive:true});
    } catch {}
  }
  window.addEventListener("pagehide",()=>{void setOffline();});

  async function renderGlobalChat(session=readSession()) {
    activeTab="global";currentFriend=null;currentFriendData=null;lastMessageFetchKey="global";
    content.innerHTML=`<section class="aza-social-chat-panel"><div class="aza-social-chat-title"><div><span class="aza-social-eyebrow">PUBLIC ROOM</span><h3>🌐 ${esc(txt("global"))}</h3><p>${esc(txt("globalHint"))}</p></div><span class="aza-social-live-pill"><i></i>${esc(t("Түз эфир","Live"))}</span></div><div class="aza-social-message-list" id="azaSocialMessages" aria-live="polite"><div class="aza-social-loading">${esc(t("Билдирүүлөр жүктөлүүдө…","Загружаем сообщения…"))}</div></div><form class="aza-social-composer" id="azaSocialComposer"><textarea id="azaSocialMessageInput" name="body" maxlength="1000" rows="2" placeholder="${esc(txt("placeholder"))}" required></textarea><div class="aza-social-composer-foot"><small><span id="azaSocialCharCount">0</span>/1000</small><button class="btn btn-primary" type="submit">${esc(txt("send"))} ↗</button></div></form></section>`;
    const blockRows=await api(`/rest/v1/aza_blocked_users?select=blocked_user_id&blocker_id=eq.${session.user.id}&limit=200`,{},session).catch(()=>[]);
    blockedIds=new Set((blockRows||[]).map(x=>x.blocked_user_id));
    const rows=await api(`/rest/v1/aza_chat_messages?select=id,room_type,sender_id,recipient_id,body,created_at&room_type=eq.global&order=created_at.desc&limit=40`,{},session);
    const list=(rows||[]).reverse();await getProfiles(list.map(m=>m.sender_id),session);
    activeMessages=list.filter(m=>!blockedIds.has(m.sender_id));renderMessageList();
    const input=$("#azaSocialMessageInput",content);input?.addEventListener("input",()=>{const n=$("#azaSocialCharCount",content);if(n)n.textContent=String(input.value.length);});
  }
  function renderMessageList() {
    const list=$("#azaSocialMessages",content);if(!list)return;
    const me=currentSession?.user?.id;
    if(!activeMessages.length){list.innerHTML=`<div class="aza-social-empty-inline"><span>✦</span><p>${esc(txt("noMessages"))}</p></div>`;return;}
    list.innerHTML=activeMessages.map(m=>{
      const p=profileCache.get(m.sender_id)||{username:"AZA Player",total_points:0,avatar_frame:"bronze"};
      const mine=m.sender_id===me;const r=rankFor(p.total_points);
      return `<article class="aza-social-message ${mine?"is-mine":""}" data-user-id="${esc(m.sender_id)}"><div class="aza-social-message-avatar">${avatar(p,"small")}</div><div class="aza-social-message-main"><div class="aza-social-message-meta"><strong>${esc(p.username||"AZA Player")}</strong><span class="aza-social-rank aza-rank-${r.id}">${esc(t(r.ky,r.ru))}</span><time datetime="${esc(m.created_at)}">${esc(formatTime(m.created_at))}</time>${!mine?`<button type="button" class="aza-social-report" data-social-report="${Number(m.id)}" aria-label="${esc(txt("report"))}">⚑</button>`:""}</div><p>${esc(m.body).replace(/\n/g,"<br>")}</p></div></article>`;
    }).join("");
    list.scrollTop=list.scrollHeight;
  }
  function formatTime(v){const d=new Date(v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat(lang()==="ru"?"ru-RU":"ky-KG",{hour:"2-digit",minute:"2-digit"}).format(d):"";}
  async function sendCurrentMessage(body) {
    const session=readSession();if(!session)throw new Error(txt("login"));
    const clean=String(body||"").trim();if(!clean||clean.length>1000)throw new Error(txt("messageLen"));
    const global=activeTab==="global";const recipient=global?null:currentFriend;
    if(!global&&!validId(recipient))throw new Error(txt("noPrivateFriends"));
    const row={room_type:global?"global":"direct",sender_id:session.user.id,recipient_id:recipient,body:clean};
    const inserted=await api("/rest/v1/aza_chat_messages?select=id,room_type,sender_id,recipient_id,body,created_at",{method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify(row)},session);
    for(const m of inserted||[]) if(!activeMessages.some(x=>String(x.id)===String(m.id)))activeMessages.push(m);
    activeMessages=activeMessages.slice(-80);renderMessageList();
  }

  async function loadRelationships(session=readSession()) {
    if(!session)throw new Error(txt("login"));
    const uid=session.user.id;
    const path=`/rest/v1/aza_friendships?select=id,requester_id,addressee_id,status,created_at,updated_at&or=${encodeURIComponent(`(requester_id.eq.${uid},addressee_id.eq.${uid})`)}&order=updated_at.desc&limit=100`;
    relationRows=await api(path,{},session)||[];
    const ids=relationRows.flatMap(x=>[x.requester_id,x.addressee_id]).filter(id=>id!==uid);
    await getProfiles(ids,session);friendProfiles=new Map(ids.map(id=>[id,profileCache.get(id)]).filter(x=>x[1]));
    const bl=await api(`/rest/v1/aza_blocked_users?select=blocked_user_id&blocker_id=eq.${uid}&limit=200`,{},session).catch(()=>[]);
    blockedIds=new Set((bl||[]).map(x=>x.blocked_user_id));
    await getProfiles([...ids,...blockedIds],session).catch(()=>{});
    presenceMap=await getPresence(ids,session).catch(()=>new Map());
    const incoming=relationRows.filter(x=>x.status==="pending"&&x.addressee_id===uid).length;
    const badge=$("#azaSocialFriendBadge",overlay);if(badge){badge.textContent=incoming?String(incoming):"";badge.hidden=!incoming;}
    return relationRows;
  }
  const otherId=(row,uid)=>row.requester_id===uid?row.addressee_id:row.requester_id;
  function personCard(p, presence, actions, extra="") {
    const r=rankFor(p?.total_points||0);const online=presence?.is_online&&presence?.last_seen_at&&Date.now()-new Date(presence.last_seen_at).getTime()<4*60*1000;
    return `<article class="aza-social-person ${extra}" data-user-id="${esc(p?.id||"")}">${avatar(p)}<div class="aza-social-person-info"><strong>${esc(p?.username||"AZA Player")}</strong><span class="aza-social-person-rank aza-rank-${r.id}">${esc(t(r.ky,r.ru))} · ${Number(p?.total_points||0).toLocaleString(lang()==="ru"?"ru-RU":"ky-KG")} ${esc(txt("points"))}</span><small>${formatLastSeen(presence?.last_seen_at,online)}</small></div><div class="aza-social-person-actions">${actions}</div></article>`;
  }
  async function loadFriends(isRefresh=false,session=readSession()) {
    currentSession=session;await loadRelationships(session);
    const uid=session.user.id;
    const accepted=relationRows.filter(x=>x.status==="accepted");
    const incoming=relationRows.filter(x=>x.status==="pending"&&x.addressee_id===uid);
    const outgoing=relationRows.filter(x=>x.status==="pending"&&x.requester_id===uid);
    const blockedRows=[...blockedIds].map(id=>profileCache.get(id)).filter(Boolean);
    const onlineFriends=accepted.filter(x=>{const p=presenceMap.get(otherId(x,uid));return p?.is_online&&Date.now()-new Date(p.last_seen_at).getTime()<4*60*1000;}).length;
    content.innerHTML=`<div class="aza-social-friends-head"><div><span class="aza-social-eyebrow">PLAYER NETWORK</span><h3>${esc(txt("friends"))}</h3><p>${esc(txt("onlineFriends"))}<b>${onlineFriends}</b></p></div><span class="aza-social-online-total"><i></i>${onlineFriends} ${esc(txt("online"))}</span></div><form class="aza-social-search" id="azaSocialSearchForm"><input id="azaSocialSearchInput" name="username" type="search" maxlength="20" autocomplete="off" placeholder="${esc(txt("search"))}"><button class="btn btn-primary" type="submit">${esc(txt("find"))}</button></form><div id="azaSocialSearchResults" class="aza-social-search-results" hidden></div><section class="aza-social-subsection"><h4>${esc(txt("incoming"))} <span>${incoming.length}</span></h4>${incoming.length?incoming.map(row=>{const id=row.requester_id,p=friendProfiles.get(id)||profileCache.get(id);return personCard(p,presenceMap.get(id),`<button class="aza-social-mini primary" data-social-respond="${esc(row.id)}" data-accept="true">${esc(txt("accept"))}</button><button class="aza-social-mini" data-social-respond="${esc(row.id)}" data-accept="false">${esc(txt("decline"))}</button>`);}).join(""):`<p class="aza-social-muted">${esc(txt("noRequests"))}</p>`}</section><section class="aza-social-subsection"><h4>${esc(txt("outgoing"))} <span>${outgoing.length}</span></h4>${outgoing.length?outgoing.map(row=>{const id=row.addressee_id,p=friendProfiles.get(id)||profileCache.get(id);return personCard(p,presenceMap.get(id),`<span class="aza-social-pending">${esc(txt("pending"))}</span><button class="aza-social-mini" data-social-remove="${esc(id)}">×</button>`);}).join(""):`<p class="aza-social-muted">${esc(txt("noRequests"))}</p>`}</section><section class="aza-social-subsection"><h4>${esc(txt("myFriends"))} <span>${accepted.length}</span></h4>${accepted.length?accepted.map(row=>{const id=otherId(row,uid),p=friendProfiles.get(id)||profileCache.get(id);return personCard(p,presenceMap.get(id),`<button class="aza-social-mini primary" data-social-chat="${esc(id)}">${esc(txt("openChat"))}</button><button class="aza-social-mini" data-social-remove="${esc(id)}" title="${esc(txt("remove"))}">−</button><button class="aza-social-mini danger" data-social-block="${esc(id)}" title="${esc(txt("block"))}">⊘</button>`);}).join(""):`<p class="aza-social-muted">${esc(txt("emptyFriends"))}</p>`}</section><section class="aza-social-subsection"><h4>${esc(txt("blocked"))} <span>${blockedRows.length}</span></h4>${blockedRows.length?blockedRows.map(p=>personCard(p,null,`<button class="aza-social-mini" data-social-unblock="${esc(p.id)}">${esc(txt("unblock"))}</button>`)).join(""):`<p class="aza-social-muted">—</p>`}</section>`;
  }
  async function renderDMs(session=readSession()) {
    await loadRelationships(session);const uid=session.user.id;
    const accepted=relationRows.filter(x=>x.status==="accepted");
    if(currentFriend&&!accepted.some(x=>otherId(x,uid)===currentFriend)){currentFriend=null;currentFriendData=null;}
    if(currentFriend){
      const p=profileCache.get(currentFriend)||{id:currentFriend,username:"AZA Player",total_points:0};currentFriendData=p;
      const r=rankFor(p.total_points||0);
      content.innerHTML=`<section class="aza-social-chat-panel"><div class="aza-social-chat-title aza-social-dm-title"><button type="button" class="aza-social-back" data-social-back>‹ ${esc(txt("dms"))}</button><div class="aza-social-dm-person" data-user-id="${esc(p.id||"")}">${avatar(p,"small")}<div><h3>${esc(p.username||"AZA Player")}</h3><p class="aza-social-dm-rank">${esc(t(r.ky,r.ru))} · ${esc(txt("chatWith").replace(/^ /,""))}</p></div></div><button type="button" class="aza-social-more" data-social-block="${esc(p.id)}" aria-label="${esc(txt("block"))}">⋯</button></div><div class="aza-social-message-list" id="azaSocialMessages" aria-live="polite"><div class="aza-social-loading">${esc(t("Билдирүүлөр жүктөлүүдө…","Загружаем сообщения…"))}</div></div><form class="aza-social-composer" id="azaSocialComposer"><textarea id="azaSocialMessageInput" name="body" maxlength="1000" rows="2" placeholder="${esc(txt("placeholder"))}" required></textarea><div class="aza-social-composer-foot"><small><span id="azaSocialCharCount">0</span>/1000</small><button class="btn btn-primary" type="submit">${esc(txt("send"))} ↗</button></div></form></section>`;
      lastMessageFetchKey=`direct:${uid}:${currentFriend}`;
      const expr=`(and(sender_id.eq.${uid},recipient_id.eq.${currentFriend}),and(sender_id.eq.${currentFriend},recipient_id.eq.${uid}))`;
      const rows=await api(`/rest/v1/aza_chat_messages?select=id,room_type,sender_id,recipient_id,body,created_at&room_type=eq.direct&or=${encodeURIComponent(expr)}&order=created_at.desc&limit=40`,{},session);
      const list=(rows||[]).reverse();await getProfiles(list.map(m=>m.sender_id),session);activeMessages=list;renderMessageList();
      const input=$("#azaSocialMessageInput",content);input?.addEventListener("input",()=>{const n=$("#azaSocialCharCount",content);if(n)n.textContent=String(input.value.length);});
      return;
    }
    if(!accepted.length){content.innerHTML=`<div class="aza-social-empty"><div class="aza-social-empty-icon">✉</div><h3>${esc(txt("dms"))}</h3><p>${esc(txt("noPrivateFriends"))}</p><button type="button" class="btn btn-primary" data-social-switch="friends">${esc(txt("friends"))}</button></div>`;return;}
    content.innerHTML=`<div class="aza-social-friends-head"><div><span class="aza-social-eyebrow">PRIVATE ROOMS</span><h3>${esc(txt("dms"))}</h3><p>${esc(txt("noPrivateFriends"))}</p></div></div><div class="aza-social-person-list">${accepted.map(row=>{const id=otherId(row,uid),p=profileCache.get(id);return personCard(p,presenceMap.get(id),`<button class="aza-social-mini primary" data-social-chat="${esc(id)}">${esc(txt("openChat"))} ↗</button>`);}).join("")}</div>`;
  }
  async function runSearch(query) {
    const session=readSession();if(!session)return;
    const q=String(query||"").normalize("NFKC").trim();
    if(q.length<3){const result=$("#azaSocialSearchResults",content);if(result){result.hidden=false;result.innerHTML=`<p class="aza-social-muted">${esc(txt("searchHint"))}</p>`;}return;}
    const safe=q.replace(/[^\p{L}\p{N}_]/gu,"").slice(0,20);if(safe.length<3)return;
    const results=$("#azaSocialSearchResults",content);if(!results)return;
    results.hidden=false;results.innerHTML=`<p class="aza-social-muted">${esc(t("Издеп жатам…","Ищем…"))}</p>`;
    const rows=await api(`/rest/v1/profiles?select=id,username,avatar_url,avatar_frame,total_points&username=ilike.${encodeURIComponent(`*${safe}*`)}&limit=12`,{},session);
    for(const p of rows||[])profileCache.set(p.id,p);
    const found=(rows||[]).filter(p=>p.id!==session.user.id&&!blockedIds.has(p.id));
    results.innerHTML=found.length?found.map(p=>{const rel=relationRows.find(x=>(x.requester_id===p.id&&x.addressee_id===session.user.id)||(x.requester_id===session.user.id&&x.addressee_id===p.id));let action=`<button class="aza-social-mini primary" data-social-add="${esc(p.username)}">${esc(txt("add"))} +</button>`;if(rel?.status==="accepted")action=`<span class="aza-social-pending">✓ ${esc(txt("friends"))}</span>`;else if(rel?.status==="pending")action=`<span class="aza-social-pending">${esc(txt("pending"))}</span>`;return personCard(p,null,action);}).join(""):`<p class="aza-social-muted">${esc(txt("noResults"))}</p>`;
  }

  async function onOverlaySubmit(event) {
    if(event.target.id==="azaSocialComposer") {
      event.preventDefault();if(isBusy)return;
      const input=$("#azaSocialMessageInput",content),button=$("button[type=submit]",event.target);const value=input?.value||"";
      if(!value.trim()||value.trim().length>1000){socialToast(txt("messageLen"));return;}
      isBusy=true;if(button)button.disabled=true;
      try{await sendCurrentMessage(value);if(input)input.value="";const counter=$("#azaSocialCharCount",content);if(counter)counter.textContent="0";}
      catch(error){console.warn("AZA social send",error);socialToast(error.message.includes("quickly")||error.message.includes("быстро")?txt("rateError"):txt("messageError"));}
      finally{isBusy=false;if(button)button.disabled=false;}
    }
    if(event.target.id==="azaSocialSearchForm") {
      event.preventDefault();try{await runSearch($("#azaSocialSearchInput",content)?.value||"");}catch(error){socialToast(error.message||txt("loadError"));}
    }
  }
  async function onOverlayClick(event) {
    const close=event.target.closest("[data-social-close]");if(close){closeSocial();return;}
    const tab=event.target.closest("[data-social-tab]");if(tab){activeTab=tab.dataset.socialTab;currentFriend=null;currentFriendData=null;activeMessages=[];renderActiveTab();return;}
    if(event.target.closest("[data-social-login]")){closeSocial();$('[data-open="profile"]')?.click();return;}
    if(event.target.closest("[data-social-retry]")){await renderActiveTab();return;}
    if(event.target.closest("[data-social-switch='friends']")){activeTab="friends";renderActiveTab();return;}
    if(event.target.closest("[data-social-back]")){currentFriend=null;currentFriendData=null;activeMessages=[];activeTab="dms";renderDMs();return;}
    const chat=event.target.closest("[data-social-chat]");if(chat){currentFriend=chat.dataset.socialChat;activeTab="dms";activeMessages=[];await renderDMs();updateTabButtons();return;}
    const add=event.target.closest("[data-social-add]");if(add){add.disabled=true;try{await rpc("aza_send_friend_request",{p_username:add.dataset.socialAdd});socialToast(txt("requestSent"));await loadFriends();}catch(e){socialToast(e.message||txt("loadError"));add.disabled=false;}return;}
    const respond=event.target.closest("[data-social-respond]");if(respond){respond.disabled=true;const accept=respond.dataset.accept==="true";if(!accept&&!confirm(txt("confirmDecline"))){respond.disabled=false;return;}try{await rpc("aza_respond_friend_request",{p_request_id:respond.dataset.socialRespond,p_accept:accept});socialToast(accept?txt("requestAccepted"):txt("sent"));await loadFriends();}catch(e){socialToast(e.message||txt("loadError"));respond.disabled=false;}return;}
    const remove=event.target.closest("[data-social-remove]");if(remove){if(!confirm(txt("confirmRemove")))return;try{await rpc("aza_remove_friend",{p_friend_id:remove.dataset.socialRemove});socialToast(txt("removedToast"));if(currentFriend===remove.dataset.socialRemove){currentFriend=null;activeTab="friends";}await loadFriends();}catch(e){socialToast(e.message||txt("loadError"));}return;}
    const block=event.target.closest("[data-social-block]");if(block){if(!confirm(txt("confirmBlock")))return;try{await rpc("aza_block_user",{p_blocked_user_id:block.dataset.socialBlock});socialToast(txt("blockedToast"));blockedIds.add(block.dataset.socialBlock);if(currentFriend===block.dataset.socialBlock){currentFriend=null;activeTab="friends";}await loadFriends();}catch(e){socialToast(e.message||txt("loadError"));}return;}
    const unblock=event.target.closest("[data-social-unblock]");if(unblock){if(!confirm(txt("confirmUnblock")))return;try{await rpc("aza_unblock_user",{p_blocked_user_id:unblock.dataset.socialUnblock});blockedIds.delete(unblock.dataset.socialUnblock);await loadFriends();}catch(e){socialToast(e.message||txt("loadError"));}return;}
    const report=event.target.closest("[data-social-report]");if(report){const reason=prompt(txt("reportPrompt"));if(reason===null)return;try{await rpc("aza_report_chat_message",{p_message_id:Number(report.dataset.socialReport),p_reason:reason});socialToast(txt("reportSent"));}catch(e){socialToast(e.message||txt("loadError"));}return;}
  }

  function addEntryButton() {
    const copyBlock=$(".feature-card.feature-community .feature-card-copy");if(!copyBlock||$("[data-open='aza-social']",copyBlock))return;
    const btn=document.createElement("button");btn.type="button";btn.className="card-arrow aza-social-entry";btn.dataset.open="aza-social";
    const label=document.createElement("span");label.textContent=t("Чат жана достор","Чат и друзья");const arrow=document.createElement("b");arrow.textContent="→";btn.append(label,arrow);copyBlock.appendChild(btn);
    $("#langToggle")?.addEventListener("click",()=>{label.textContent=t("Чат жана достор","Чат и друзья");if(overlay&&!overlay.hidden)refreshSocialText();});
  }
  document.addEventListener("click",event=>{
    const trigger=event.target.closest('[data-open="aza-social"]');if(!trigger)return;
    event.preventDefault();event.stopImmediatePropagation();openSocial("global");
  },true);

  // Update online status lightly while the website is open. No global presence list is polled.
  function presenceBoot() {
    const session=readSession();if(session)void startPresence(session);
    setInterval(()=>{const s=readSession();if(s&&!heartbeatTimer)void startPresence(s);},30000);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{addEntryButton();presenceBoot();});
  else {addEntryButton();presenceBoot();}
})();
