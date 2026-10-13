/* AZA UNIVERSE — Profile cosmetics V1
 * Adds profile image upload, unlocked animated frames, avatar presets, leaderboard avatars and rank-up celebrations.
 * Uses the existing Supabase session stored by app.js; no extra Supabase client is created.
 */
(() => {
  "use strict";
  const cfg = window.AZA_SUPABASE_CONFIG || {};
  const API = String(cfg.projectUrl || "").replace(/\/$/, "");
  const KEY = String(cfg.publishableKey || "");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(API) || !KEY.startsWith("sb_publishable_")) {
    console.warn("AZA Profile Cosmetics: Supabase config is not available.");
    return;
  }

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));
  const t = (ky, ru) => (localStorage.getItem("aza-lang") || document.documentElement.lang || "ky") === "ru" ? ru : ky;
  const fileBase = new URL("./", location.href).href;
  const storageBucket = "profile-avatars";
  const maxInputBytes = 5 * 1024 * 1024;
  const maxAvatarSide = 512;
  let currentUser = null, currentProfile = null, draftAvatarUrl = null, pendingBlob = null, pendingObjectUrl = null, draftFrame = "bronze", saveBusy = false;
  const publicAvatarCache = new Map();
  const frameRanks = [
    {id:"bronze", min:0, ky:"Коло", ru:"Бронза", color:"bronze"},
    {id:"silver", min:500, ky:"Күмүш", ru:"Серебро", color:"silver"},
    {id:"gold", min:1500, ky:"Алтын", ru:"Золото", color:"gold"},
    {id:"platinum", min:3000, ky:"Платина", ru:"Платина", color:"platinum"},
    {id:"diamond", min:5000, ky:"Алмаз", ru:"Алмаз", color:"diamond"},
    {id:"master", min:8000, ky:"Мастер", ru:"Мастер", color:"master"},
    {id:"ace", min:12000, ky:"Эйс", ru:"Эйс", color:"ace"},
    {id:"conqueror", min:20000, ky:"Космостук жеңүүчү", ru:"Завоеватель", color:"conqueror"}
  ];
  const presets = [
    {id:"cosmic", file:"avatar-cosmic.svg", ky:"Космос баатыры", ru:"Космический герой"},
    {id:"robot", file:"avatar-robot.svg", ky:"AI-робот", ru:"AI-робот"},
    {id:"cat", file:"avatar-neon-cat.svg", ky:"Неон мышык", ru:"Неоновый кот"},
    {id:"phoenix", file:"avatar-phoenix.svg", ky:"Феникс", ru:"Феникс"},
    {id:"astronaut", file:"avatar-astronaut.svg", ky:"Космонавт", ru:"Космонавт"},
    {id:"shadow", file:"avatar-shadow.svg", ky:"Көлөкө баатыр", ru:"Теневой герой"}
  ].map(p => ({...p, url:new URL(p.file,fileBase).href}));

  function readStoredSession() {
    try {
      for (let i=0; i<localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const session = parsed?.currentSession || parsed?.session || parsed;
        if (session?.access_token && session?.user?.id) return {access_token:session.access_token, refresh_token:session.refresh_token, user:session.user};
      }
    } catch (error) { console.warn("AZA profile session could not be read", error); }
    return null;
  }
  function headers(session, extra={}) {
    const h = { apikey:KEY, ...extra };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }
  async function request(path, options={}, session=readStoredSession()) {
    const response = await fetch(`${API}${path}`, { ...options, headers:headers(session, options.headers || {}) });
    const raw = await response.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
    if (!response.ok) {
      const message = body && (body.message || body.error_description || body.error) || `HTTP ${response.status}`;
      throw new Error(String(message));
    }
    return body;
  }
  function safeAvatarUrl(value) {
    if (!value) return "";
    try {
      const u = new URL(String(value), location.href);
      const siteAvatarPath = "/azauniverse/avatar-";
      const publicObjectPath = "/storage/v1/object/public/profile-avatars/";
      const siteOk = u.origin === location.origin && (u.pathname.includes(siteAvatarPath) && u.pathname.endsWith(".svg") || /^\/avatar-[a-z0-9-]+\.svg$/i.test(u.pathname));
      const storageOk = u.origin === new URL(API).origin && u.pathname.startsWith(publicObjectPath);
      return siteOk || storageOk ? u.href : "";
    } catch { return ""; }
  }
  function rankFor(points) {
    let rank = frameRanks[0];
    for (const r of frameRanks) if (Number(points||0) >= r.min) rank = r;
    return rank;
  }
  function frameUnlocked(frameId, points) {
    const frame = frameRanks.find(r=>r.id===frameId);
    return !!frame && Number(points||0) >= frame.min;
  }
  function initials(username) { return escapeHtml(String(username||"A").trim().slice(0,1).toUpperCase() || "A"); }
  function avatarBody(url, username, extraClass="") {
    const safe = (pendingObjectUrl && url === pendingObjectUrl) ? pendingObjectUrl : safeAvatarUrl(url);
    return safe ? `<img src="${escapeHtml(safe)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<span class="aza-avatar-initial">${initials(username)}</span>`;
  }
  function ownedUploadPath(value, uid) {
    try {
      const u=new URL(String(value||""));
      if(u.origin!==new URL(API).origin)return "";
      const prefix=`/storage/v1/object/public/${storageBucket}/${uid}/`;
      if(!u.pathname.startsWith(prefix))return "";
      return u.pathname.slice(`/storage/v1/object/public/${storageBucket}/`.length).split("/").map(decodeURIComponent).join("/");
    } catch { return ""; }
  }
  function publicProfileUrl(name) {
    const u = String(name||"").replace(/([\\"])/g,"\\$1");
    return `/rest/v1/profiles?select=username,avatar_url,avatar_frame,total_points&username=in.(${encodeURIComponent(`"${u}"`)})`;
  }
  async function getOwnProfile(session) {
    const list = await request(`/rest/v1/profiles?select=id,username,total_points,avatar_url,avatar_frame&id=eq.${encodeURIComponent(session.user.id)}&limit=1`, {}, session);
    return Array.isArray(list) ? list[0] || null : null;
  }
  function showModal() {
    const modal = $("#modal");
    if (modal) { modal.classList.add("show"); modal.setAttribute("aria-hidden","false"); }
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    const modal = $("#modal");
    if (modal) { modal.classList.remove("show"); modal.setAttribute("aria-hidden","true"); }
    document.body.style.overflow = "";
    if (pendingObjectUrl) { URL.revokeObjectURL(pendingObjectUrl); pendingObjectUrl=null; }
    pendingBlob = null;
  }
  function profileAvatarMarkup(url, name, frame) {
    return `<span class="aza-profile-avatar aza-frame-${escapeHtml(frame||"bronze")}" id="azaProfilePreview">${avatarBody(url,name)}</span>`;
  }
  function frameCard(frame, points) {
    const unlocked = frameUnlocked(frame.id, points);
    const selected = draftFrame === frame.id;
    return `<button type="button" class="aza-frame-choice aza-frame-${frame.id}${selected?" is-selected":""}${unlocked?"":" is-locked"}" data-aza-frame="${frame.id}" ${unlocked?"":"disabled"} aria-pressed="${selected}"><span class="aza-frame-demo aza-frame-${frame.id}"><i></i></span><strong>${escapeHtml(t(frame.ky,frame.ru))}</strong><small>${unlocked ? (selected?t("Тандалды","Выбрана"):t("Ачылган","Открыта")) : `${escapeHtml(frame.min.toLocaleString("ru-RU"))} ${t("упайдан","очков")}`}</small>${unlocked?"":"<b class=\"aza-lock\">🔒</b>"}</button>`;
  }
  function renderProfile() {
    if (!currentProfile || !currentUser) return;
    const name = currentProfile.username || currentUser.email || "AZA Player";
    const points = Number(currentProfile.total_points || 0);
    const rank = rankFor(points);
    const safeUrl = (pendingObjectUrl && draftAvatarUrl === pendingObjectUrl) ? pendingObjectUrl : safeAvatarUrl(draftAvatarUrl);
    const content = $("#modalContent");
    if (!content) return;
    content.innerHTML = `
      <section class="aza-profile-editor">
        <header class="aza-profile-top"><span class="eyebrow">AZA UNIVERSE · ${escapeHtml(t("ПРОФИЛЬ","ПРОФИЛЬ"))}</span><h2 id="modalTitle">${escapeHtml(t("Менин профилим","Мой профиль"))}</h2><p>${escapeHtml(t("Сүрөтүңдү жана анимациялуу рамкаңды өзгөрт.","Настрой аватар и анимированную рамку."))}</p></header>
        <div class="aza-profile-summary">${profileAvatarMarkup(safeUrl,name,draftFrame)}<div class="aza-profile-summary-text"><strong>${escapeHtml(name)}</strong><span class="aza-rank-label aza-rank-${rank.id}">${escapeHtml(t(rank.ky,rank.ru))}</span><small>${points.toLocaleString(localStorage.getItem("aza-lang")==="ru"?"ru-RU":"ky-KG")} ${escapeHtml(t("упай","очков"))}</small><div class="aza-rank-progress"><i style="width:${Math.max(0,Math.min(100,((points-rank.min)/Math.max(1,((frameRanks[frameRanks.indexOf(rank)+1]?.min||rank.min+1)-rank.min)))*100))}%"></i></div><small>${escapeHtml(t("Кийинки рангга чейин прогресс","Прогресс до следующего ранга"))}</small></div></div>
        <div class="aza-profile-columns">
          <section class="aza-profile-section"><div class="aza-section-heading"><div><h3>${escapeHtml(t("Аватарды тандоо","Выбор аватара"))}</h3><p>${escapeHtml(t("Даяр аватар же телефонуңдагы сүрөт.","Готовый аватар или фото с телефона."))}</p></div></div>
            <div class="aza-preset-grid">${presets.map(p=>`<button type="button" class="aza-preset${draftAvatarUrl===p.url?" is-selected":""}" data-aza-preset="${p.id}" aria-label="${escapeHtml(t(p.ky,p.ru))}" aria-pressed="${draftAvatarUrl===p.url}"><img src="${p.url}" alt="" loading="lazy" decoding="async"><span>${escapeHtml(t(p.ky,p.ru))}</span></button>`).join("")}</div>
            <label class="aza-upload-btn" for="azaProfileFile">${escapeHtml(t("📷 Галереядан сүрөт тандоо","📷 Выбрать фото из галереи"))}</label><input id="azaProfileFile" class="aza-file-input" type="file" accept="image/jpeg,image/png,image/webp"/><p class="aza-public-note">${escapeHtml(t("Сүрөт рейтингде башка оюнчуларга көрүнөт. 5 МБга чейинки сүрөт автоматтык кысылат.","Фото будет видно другим игрокам в рейтинге. Изображения до 5 МБ автоматически сжимаются."))}</p>
          </section>
          <section class="aza-profile-section"><div class="aza-section-heading"><div><h3>${escapeHtml(t("Анимациялуу рамкалар","Анимированные рамки"))}</h3><p>${escapeHtml(t("Ранг көтөрүлгөн сайын жаңы рамкалар ачылат.","Новые рамки открываются с повышением ранга."))}</p></div></div><div class="aza-frame-grid">${frameRanks.map(f=>frameCard(f,points)).join("")}</div></section>
        </div>
        <footer class="aza-profile-actions"><button type="button" class="btn btn-outline" id="azaProfileCancel">${escapeHtml(t("Жабуу","Закрыть"))}</button><button type="button" class="btn btn-primary" id="azaProfileSave">${escapeHtml(t("Өзгөртүүлөрдү сактоо","Сохранить изменения"))}</button></footer>
        <p id="azaProfileStatus" class="aza-profile-status" role="status" aria-live="polite"></p>
      </section>`;
    $("#azaProfileCancel")?.addEventListener("click",closeModal);
    $("#azaProfileSave")?.addEventListener("click",saveProfile);
    $$("[data-aza-preset]",content).forEach(button=>button.addEventListener("click",()=>{
      const preset=presets.find(p=>p.id===button.dataset.azaPreset); if(!preset)return;
      draftAvatarUrl=preset.url; pendingBlob=null;
      if(pendingObjectUrl){URL.revokeObjectURL(pendingObjectUrl);pendingObjectUrl=null;}
      renderProfile();
    }));
    $$("[data-aza-frame]",content).forEach(button=>button.addEventListener("click",()=>{
      if(!frameUnlocked(button.dataset.azaFrame,points))return;
      draftFrame=button.dataset.azaFrame;renderProfile();
    }));
    $("#azaProfileFile")?.addEventListener("change",onChooseFile);
  }
  async function openProfileEditor(session) {
    const content = $("#modalContent");
    if(content) content.innerHTML = `<div class="aza-loading"><span class="aza-spinner"></span><p>${escapeHtml(t("Профиль жүктөлүүдө…","Загружаем профиль…"))}</p></div>`;
    showModal();
    try {
      const response = await fetch(`${API}/auth/v1/user`,{headers:headers(session)});
      if (!response.ok) throw new Error("AUTH_EXPIRED");
      currentUser = await response.json();
      currentProfile = await getOwnProfile(session);
      if (!currentProfile) throw new Error(t("Профиль табылган жок. Supabase миграциясын текшер.","Профиль не найден. Проверьте миграцию Supabase."));
      draftAvatarUrl = safeAvatarUrl(currentProfile.avatar_url) || "";
      draftFrame = currentProfile.avatar_frame || "bronze";
      pendingBlob=null;
      renderProfile();
    } catch (error) {
      console.warn("AZA profile editor",error);
      const contentNow=$("#modalContent");
      if(contentNow) contentNow.innerHTML=`<div class="aza-profile-error"><h2>${escapeHtml(t("Профиль ачылган жок","Не удалось открыть профиль"))}</h2><p>${escapeHtml(error.message==="AUTH_EXPIRED"?t("Аккаунт сессиясы эскирип калган болушу мүмкүн. Баракты жаңылап, кайра кир.","Сессия аккаунта могла истечь. Обнови страницу и войди снова."):error.message)}</p><button type="button" class="btn btn-primary full" id="azaProfileErrorClose">${escapeHtml(t("Жабуу","Закрыть"))}</button></div>`;
      $("#azaProfileErrorClose")?.addEventListener("click",closeModal);
    }
  }
  async function onChooseFile(event) {
    const file=event.target.files?.[0]; if(!file)return;
    const status=$("#azaProfileStatus");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){if(status)status.textContent=t("JPG, PNG же WebP сүрөт танда.","Выбери изображение JPG, PNG или WebP.");event.target.value="";return;}
    if(file.size>maxInputBytes){if(status)status.textContent=t("Сүрөт 5 МБдан чоң болбошу керек.","Размер фото не должен превышать 5 МБ.");event.target.value="";return;}
    try {
      if(status)status.textContent=t("Сүрөт оптималдаштырылууда…","Оптимизируем фото…");
      const bitmap=await createImageBitmap(file);
      const scale=Math.min(1,maxAvatarSide/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext("2d");ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(out=>out?resolve(out):reject(new Error("IMAGE_COMPRESS_FAILED")),"image/webp",.82));
      pendingBlob=blob;
      if(pendingObjectUrl)URL.revokeObjectURL(pendingObjectUrl);
      pendingObjectUrl=URL.createObjectURL(blob);draftAvatarUrl=pendingObjectUrl;
      renderProfile();
      const statusAgain=$("#azaProfileStatus");if(statusAgain)statusAgain.textContent=t("Сүрөт даяр. Сактоону бас.","Фото готово. Нажми «Сохранить изменения». ");
    } catch(error) {
      console.warn("Avatar image processing failed",error);
      if(status)status.textContent=t("Бул сүрөттү иштетүү мүмкүн болгон жок.","Не удалось обработать это изображение.");
    }
  }
  async function saveProfile() {
    if(saveBusy||!currentUser||!currentProfile)return;
    const session=readStoredSession(); if(!session?.access_token){const s=$("#azaProfileStatus");if(s)s.textContent=t("Сессия жок. Кайра кир.","Нет активной сессии. Войди снова.");return;}
    saveBusy=true;
    const btn=$("#azaProfileSave"),status=$("#azaProfileStatus");if(btn){btn.disabled=true;btn.textContent=t("Сакталууда…","Сохранение…");}
    try {
      let avatarUrl=draftAvatarUrl;
      if(pendingBlob){
        if(pendingBlob.size>3*1024*1024)throw new Error(t("Кысылган сүрөт өтө чоң.","Сжатое изображение слишком большое."));
        const path=`${currentUser.id}/avatar-${Date.now()}.webp`;
        // Use a fresh object path instead of x-upsert; this avoids overwrite-specific Storage policy edge cases.
        await request(`/storage/v1/object/${storageBucket}/${path}`,{method:"POST",headers:{"Content-Type":"image/webp","cache-control":"3600"},body:pendingBlob},session);
        avatarUrl=`${API}/storage/v1/object/public/${storageBucket}/${path}`;
      }
      avatarUrl=avatarUrl && avatarUrl.startsWith("blob:") ? currentProfile.avatar_url : avatarUrl;
      if(avatarUrl && !safeAvatarUrl(avatarUrl))throw new Error(t("Сүрөттүн дареги жараксыз.","Недопустимый адрес изображения."));
      const previousAvatarUrl=currentProfile.avatar_url;
      const updated=await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(currentUser.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json","Prefer":"return=representation"},body:JSON.stringify({avatar_url:avatarUrl||null,avatar_frame:draftFrame})},session);
      currentProfile={...currentProfile,avatar_url:avatarUrl||null,avatar_frame:draftFrame};
      // Cleanup old uploads only after the new profile URL has been saved successfully.
      const oldPath=ownedUploadPath(previousAvatarUrl,currentUser.id);
      if(oldPath && oldPath!==ownedUploadPath(avatarUrl,currentUser.id)) {
        try { await request(`/storage/v1/object/${storageBucket}/${oldPath.split("/").map(encodeURIComponent).join("/")}`,{method:"DELETE"},session); }
        catch(cleanupError) { console.warn("Old avatar cleanup skipped",cleanupError); }
      }
      pendingBlob=null;if(pendingObjectUrl){URL.revokeObjectURL(pendingObjectUrl);pendingObjectUrl=null;}
      if(status)status.textContent=t("Профиль ийгиликтүү сакталды!","Профиль успешно сохранён!");
      publicAvatarCache.delete(currentProfile.username);
      decorateLeaderboard(true);
      setTimeout(()=>{if($("#azaProfileSave")){closeModal();}},650);
    } catch(error) {
      console.warn("AZA profile save failed",error);
      if(status){
        const message=String(error.message||"");
        status.textContent=/row-level security|permission denied|violates row-level|column .* does not exist|Could not find the/i.test(message)
          ? t("Supabase миграциясын текшер: supabase/profile-customization-migration.sql файлын SQL Editor'де иштет.","Проверь миграцию Supabase: выполни supabase/profile-customization-migration.sql в SQL Editor.")
          : `${t("Сактоо ишке ашкан жок: ","Не удалось сохранить: ")}${message}`;
      }
    } finally {
      saveBusy=false;
      const now=$("#azaProfileSave");if(now){now.disabled=false;now.textContent=t("Өзгөртүүлөрдү сактоо","Сохранить изменения");}
    }
  }

  async function fetchPublicProfiles(names, force=false) {
    const now=Date.now();
    const need=[...new Set(names)].filter(name=>{const cached=publicAvatarCache.get(name);return !!name && (force || !cached || (cached.expiresAt||0)<=now);});
    if(!need.length)return;
    // Keep leaderboard network calls small: only ask for profiles currently visible.
    const chunk=need.slice(0,20);
    const inFilter=chunk.map(n=>`"${String(n).replace(/[\\"]/g,"\\$&")}"`).join(",");
    try {
      const rows=await request(`/rest/v1/profiles?select=username,avatar_url,avatar_frame,total_points&username=in.(${encodeURIComponent(inFilter)})`,{headers:{"Accept":"application/json"}},null);
      for(const row of rows||[]) publicAvatarCache.set(row.username,{...row,expiresAt:now+10*60*1000});
      for(const n of chunk) if(!publicAvatarCache.has(n)) publicAvatarCache.set(n,{username:n,avatar_url:null,avatar_frame:"bronze",total_points:0,expiresAt:now+60*1000});
    } catch(error) { console.warn("Could not decorate public leaderboard avatars",error); }
  }
  async function decorateLeaderboard(force=false) {
    const list=$("#ranking .ranking-list");if(!list)return;
    const rows=$$(".ranking-item",list);
    const names=rows.map(row=>row.querySelector("strong")?.childNodes[0]?.textContent?.trim() || row.querySelector("strong")?.textContent?.trim()).filter(Boolean);
    await fetchPublicProfiles(names,force);
    for(const row of rows) {
      const nameEl=row.querySelector("strong");const avatar=row.querySelector(".avatar");if(!nameEl||!avatar)continue;
      const name=nameEl.childNodes[0]?.textContent?.trim() || nameEl.textContent.trim();
      const data=publicAvatarCache.get(name);if(!data)continue;
      const url=safeAvatarUrl(data.avatar_url);const frame=frameRanks.some(f=>f.id===data.avatar_frame)?data.avatar_frame:"bronze";
      avatar.classList.add("aza-profile-avatar",`aza-frame-${frame}`);avatar.title=t("Ранг: ","Ранг: ")+t(rankFor(data.total_points).ky,rankFor(data.total_points).ru);
      const expected=url||"";
      if(expected && avatar.querySelector("img")?.src!==expected){avatar.innerHTML=`<img src="${escapeHtml(expected)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;}
      else if(!expected && avatar.querySelector("img")){avatar.textContent=(name||"A").slice(0,1).toUpperCase();}
      const rank=rankFor(data.total_points);
      let tag=nameEl.querySelector(".aza-rank-title");if(!tag){tag=document.createElement("small");tag.className="aza-rank-title";nameEl.appendChild(tag);}
      tag.textContent=t(rank.ky,rank.ru);tag.className=`aza-rank-title aza-rank-${rank.id}`;
      row.dataset.azaProfileDone="1";
    }
  }
  function setupLeaderboardObserver() {
    const list=$("#ranking .ranking-list");if(!list)return;
    const mo=new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length||r.removedNodes.length))void decorateLeaderboard();});
    mo.observe(list,{childList:true});
    void decorateLeaderboard();
  }

  let promotionOverlay=null;
  function closePromotion() { if(promotionOverlay){promotionOverlay.remove();promotionOverlay=null;} }
  function showPromotion(from,to) {
    closePromotion();
    const overlay=document.createElement("div");overlay.className="aza-rankup-overlay";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-label",t("Ранг көтөрүлдү","Повышение ранга"));
    const medal=document.createElement("div");medal.className=`aza-rankup-emblem aza-frame-${to.id}`;medal.innerHTML='<span>★</span><i></i>';
    const eyebrow=document.createElement("small");eyebrow.textContent="AZA UNIVERSE · RANK UP";
    const title=document.createElement("h2");title.textContent=t("РАНГ КӨТӨРҮЛДҮ!","РАНГ ПОВЫШЕН!");
    const text=document.createElement("p");text.textContent=`${t(from.ky,from.ru)} → ${t(to.ky,to.ru)}`;
    const button=document.createElement("button");button.className="btn btn-primary";button.textContent=t("Улантуу","Продолжить");button.addEventListener("click",closePromotion);
    overlay.append(eyebrow,medal,title,text,button);overlay.addEventListener("click",e=>{if(e.target===overlay)closePromotion();});document.body.appendChild(overlay);promotionOverlay=overlay;
  }
  function setupRankObserver() {
    const pointsEl=$("#pointsTotal");if(!pointsEl)return;
    let previousText=pointsEl.textContent.trim();
    let first=true;
    const observer=new MutationObserver(()=>{
      const points=Number(String(pointsEl.textContent||"0").replace(/[^0-9]/g,""))||0;
      const session=readStoredSession();const uid=session?.user?.id;
      if(!uid)return;
      const modeLabel=$("#pointsModeBadge")?.textContent || "";
      // Wait for the existing app to load the authenticated server profile, not local guest points.
      if(!/онлайн/i.test(modeLabel))return;
      const storageKey=`aza-universe-rank-seen:${uid}`;
      const current=rankFor(points);const currentIndex=frameRanks.findIndex(r=>r.id===current.id);
      const oldValue=localStorage.getItem(storageKey);
      if(oldValue===null){localStorage.setItem(storageKey,current.id);previousText=pointsEl.textContent.trim();first=false;return;}
      const oldIndex=frameRanks.findIndex(r=>r.id===oldValue);
      if(oldIndex>=0&&currentIndex>oldIndex){localStorage.setItem(storageKey,current.id);showPromotion(frameRanks[oldIndex],current);}
      else if(oldIndex<0||currentIndex>oldIndex||first){localStorage.setItem(storageKey,current.id);}
      previousText=pointsEl.textContent.trim();first=false;
    });
    observer.observe(pointsEl,{childList:true,characterData:true,subtree:true});
  }

  // Capture phase wins over app.js's existing profile click handler only for already signed-in users.
  document.addEventListener("click", event=>{
    const trigger=event.target.closest('[data-open="profile"]');if(!trigger)return;
    const session=readStoredSession();if(!session?.access_token||!session?.user?.id)return;
    event.preventDefault();event.stopImmediatePropagation();void openProfileEditor(session);
  },true);
  // Shared modal's own close controls continue to work; add an idempotent cleanup for ours.
  document.addEventListener("click",event=>{if(event.target.closest("#modal [data-close]")){pendingBlob=null;if(pendingObjectUrl){URL.revokeObjectURL(pendingObjectUrl);pendingObjectUrl=null;}}});
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>{setupLeaderboardObserver();setupRankObserver();});
  else { setupLeaderboardObserver();setupRankObserver(); }
})();
