/* AZA UNIVERSE — founder showcase add-on
 * Official founder identity is tied to the owner's Supabase auth UUID.
 * UI only: never trust client-side badges for server permissions.
 */
(() => {
  "use strict";
  if (window.__AZA_FOUNDER_SHOWCASE_V1__) return;
  window.__AZA_FOUNDER_SHOWCASE_V1__ = true;

  const FOUNDER_ID = "362b8778-de25-4846-9bf7-c514842d159e";
  const cfg = window.AZA_SUPABASE_CONFIG || {};
  const API = String(cfg.projectUrl || "").replace(/\/$/, "");
  const KEY = String(cfg.publishableKey || "");
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));

  function lang() {
    return (localStorage.getItem("aza-lang") || document.documentElement.lang || "ky").toLowerCase().startsWith("ru") ? "ru" : "ky";
  }
  function t(ky, ru) { return lang() === "ru" ? ru : ky; }

  function readSession() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const session = parsed?.currentSession || parsed?.session || parsed;
        if (session?.access_token && session?.user?.id) return session;
      }
    } catch (error) {
      console.warn("AZA founder add-on: session read failed", error);
    }
    return null;
  }

  function isFounderSession() {
    return readSession()?.user?.id?.toLowerCase() === FOUNDER_ID;
  }

  function founderBadge(extraClass = "") {
    return `<span class="aza-founder-chip ${extraClass}" title="AZA UNIVERSE official founder"><span aria-hidden="true">♛</span> FOUNDER <small>${esc(t("Негиздөөчү", "Основатель"))}</small></span>`;
  }

  function homeFounderMarkup() {
    return `
      <section id="azaFounderHome" class="aza-founder-home" aria-labelledby="azaFounderHomeTitle">
        <div class="aza-founder-aurora" aria-hidden="true"><span></span><i></i><b>✦</b></div>
        <div class="aza-founder-home-orb" aria-hidden="true"><img src="assets/aza-emblem.svg" alt="" loading="lazy" decoding="async"></div>
        <div class="aza-founder-home-copy">
          <span class="aza-founder-eyebrow"><i></i> AZA UNIVERSE · OFFICIAL</span>
          <h2 id="azaFounderHomeTitle">AZA UNIVERSE</h2>
          ${founderBadge("aza-founder-chip-large")}
          <p class="aza-founder-role">${esc(t("Негиздөөчү · Долбоордун автору", "Основатель · Автор проекта"))}</p>
          <blockquote>${esc(t("«Билим, логика жана жаңы мүмкүнчүлүктөр дүйнөсү.»", "«Знания, логика и новые возможности — в одном пространстве.»"))}</blockquote>
          <p class="aza-founder-description">${esc(t(
            "AZA UNIVERSE — тесттерди, оюндарды, AI куралдарын жана коомчулукту бириктирген платформа.",
            "AZA UNIVERSE — платформа, объединяющая тесты, игры, AI-инструменты и сообщество."
          ))}</p>
          <a class="aza-founder-link" href="#azaFounderAbout">${esc(t("Долбоор жөнүндө", "О проекте"))}<span aria-hidden="true">↗</span></a>
        </div>
        <div class="aza-founder-vertical-label" aria-hidden="true">FOUNDATION · COSMIC COMMUNITY</div>
      </section>`;
  }

  function aboutFounderMarkup() {
    return `
      <section id="azaFounderAbout" class="aza-founder-about" aria-labelledby="azaFounderAboutTitle">
        <div class="aza-founder-about-head">
          <span class="aza-founder-eyebrow"><i></i> AZA UNIVERSE · OUR MISSION</span>
          <h2 id="azaFounderAboutTitle">${esc(t("Долбоордун идеясы", "Идея проекта"))}</h2>
          <p>${esc(t(
            "Билимди кызыктуу кылып, оюндарды жана адамдарды бир коомчулукка бириктирүү.",
            "Сделать обучение интереснее и объединить игры, знания и людей в одном сообществе."
          ))}</p>
        </div>
        <div class="aza-founder-pillars">
          <article><span aria-hidden="true">✧</span><h3>${esc(t("Билим жана өнүгүү", "Знания и развитие"))}</h3><p>${esc(t("Тесттер, логика жана жаңы көндүмдөр.", "Тесты, логика и новые навыки."))}</p></article>
          <article><span aria-hidden="true">⌘</span><h3>${esc(t("Оюн жана чакырык", "Игры и вызовы"))}</h3><p>${esc(t("Өзүңдү сына, рекорддоруңду жакшырт.", "Проверяй себя и улучшай личные результаты."))}</p></article>
          <article><span aria-hidden="true">♧</span><h3>${esc(t("Коомчулук", "Сообщество"))}</h3><p>${esc(t("Достор менен баарлашып, бирге өнүк.", "Общайся с друзьями и развивайся вместе."))}</p></article>
        </div>
      </section>`;
  }

  function renderFounderSections() {
    const hero = $("#home");
    const footer = $("footer.site-footer");
    let home = $("#azaFounderHome");
    if (!home && hero) {
      hero.insertAdjacentHTML("afterend", homeFounderMarkup());
      home = $("#azaFounderHome");
    } else if (home) {
      const old = home;
      old.outerHTML = homeFounderMarkup();
      home = $("#azaFounderHome");
    }
    let about = $("#azaFounderAbout");
    if (!about && footer) {
      footer.insertAdjacentHTML("beforebegin", aboutFounderMarkup());
    } else if (about) {
      const old = about;
      old.outerHTML = aboutFounderMarkup();
    }
  }

  function decorateFounderProfile() {
    if (!isFounderSession()) return;
    document.body.classList.add("aza-is-founder");
    const editor = $("#modalContent .aza-profile-editor");
    if (!editor) return;
    const summary = $(".aza-profile-summary", editor);
    const text = $(".aza-profile-summary-text", editor);
    if (!summary || !text) return;

    // Founder is outside the competitive ranks: hide only the founder's visible rank/score UI.
    $$(".aza-rank-label, .aza-rank-progress", text).forEach(el => el.remove());
    $$('small', text).forEach(el => el.remove());
    const name = $("strong", text);
    if (name && !$(".aza-founder-chip-profile", text)) {
      name.insertAdjacentHTML("afterend", founderBadge("aza-founder-chip-profile"));
    }
    summary.classList.add("aza-founder-summary");
  }

  function decorateSocialHub() {
    const overlay = $("#aza-social-overlay");
    if (!overlay) return;

    // Global/private chat messages: show founder identity rather than a normal game rank.
    $$(".aza-social-message", overlay).forEach(row => {
      const meta = $(".aza-social-message-meta", row);
      const name = $("strong", meta);
      if (!name || name.textContent.trim().toUpperCase() !== "AZAUNIVERSE") return;
      $(".aza-social-rank", meta)?.remove();
      if (!$(".aza-founder-chip-chat", meta)) name.insertAdjacentHTML("afterend", founderBadge("aza-founder-chip-chat"));
    });

    // Friend/search cards: avoid presenting the founder as a competitive-ranked participant.
    $$(".aza-social-person", overlay).forEach(row => {
      const info = $(".aza-social-person-info", row);
      const name = $("strong", info);
      if (!name || name.textContent.trim().toUpperCase() !== "AZAUNIVERSE") return;
      $(".aza-social-person-rank", info)?.remove();
      if (!$(".aza-founder-chip-person", info)) name.insertAdjacentHTML("afterend", founderBadge("aza-founder-chip-person"));
    });
  }

  let lastRenderedLeaderboard = "";
  let leaderboardBusy = false;
  async function refreshPublicLeaderboard() {
    const list = $("#ranking .ranking-list");
    if (!list || !API || !KEY || leaderboardBusy) return;
    leaderboardBusy = true;
    try {
      const params = new URLSearchParams({
        select: "username,total_points,created_at",
        order: "total_points.desc,created_at.asc",
        limit: "5"
      });
      const headers = { apikey: KEY, Accept: "application/json" };
      // Prefer the database view that excludes the founder; fall back to the same UUID filter
      // while PostgREST refreshes its schema cache after the SQL migration.
      let response = await fetch(`${API}/rest/v1/aza_leaderboard_public?${params.toString()}`, {
        headers,
        cache: "no-store"
      });
      if (!response.ok) {
        const fallbackParams = new URLSearchParams({
          ...Object.fromEntries(params.entries()),
          id: `neq.${FOUNDER_ID}`
        });
        response = await fetch(`${API}/rest/v1/profiles?${fallbackParams.toString()}`, {
          headers,
          cache: "no-store"
        });
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const players = await response.json();
      const avatarClasses = ["avatar-one", "avatar-two", "avatar-three", "avatar-four", "avatar-five"];
      const html = (players || []).map((player, i) => `
        <div class="ranking-item" data-aza-public-rank="${i + 1}">
          <span class="rank-medal ${i === 0 ? "gold-medal" : i === 1 ? "silver-medal" : i === 2 ? "bronze-medal" : ""}">${i + 1}</span>
          <span class="avatar ${avatarClasses[i] || "avatar-one"}">${esc((player.username || "A").slice(0, 1).toUpperCase())}</span>
          <strong>${esc(player.username || "AZA Player")}</strong>
          <b>${Number(player.total_points || 0).toLocaleString(lang() === "ru" ? "ru-RU" : "ky-KG")}</b>
        </div>`).join("");
      if (!html) {
        list.innerHTML = `<p class="aza-founder-ranking-empty">${esc(t("Азырынча катышуучулар жок.", "Пока нет участников рейтинга."))}</p>`;
      } else {
        list.innerHTML = html;
      }
      lastRenderedLeaderboard = list.innerHTML;
      const note = $("#rankingNote");
      if (note) note.textContent = t(
        "Негиздөөчү рейтингге катышпайт — рейтинг катышуучулар үчүн.",
        "Основатель не участвует в рейтинге — рейтинг предназначен для участников."
      );
    } catch (error) {
      // Fail gracefully: don't blank the working site's existing leaderboard if API fails.
      console.warn("AZA founder leaderboard filter failed", error);
    } finally {
      leaderboardBusy = false;
    }
  }

  function setupLeaderboardFilter() {
    const list = $("#ranking .ranking-list");
    if (!list) return;
    void refreshPublicLeaderboard();
    const observer = new MutationObserver(() => {
      if (list.innerHTML === lastRenderedLeaderboard) return;
      window.clearTimeout(setupLeaderboardFilter.timer);
      setupLeaderboardFilter.timer = window.setTimeout(() => void refreshPublicLeaderboard(), 140);
    });
    // Observe only direct child changes, so avatar decoration inside rows doesn't trigger a loop.
    observer.observe(list, { childList: true });
  }

  function setupLanguageRefresh() {
    document.addEventListener("click", event => {
      const target = event.target.closest("[data-lang], .lang-toggle, #langToggle");
      if (!target) return;
      window.setTimeout(renderFounderSections, 40);
    });
    const htmlObserver = new MutationObserver(() => renderFounderSections());
    htmlObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    window.addEventListener("storage", event => {
      if (event.key === "aza-lang") renderFounderSections();
    });
  }

  function init() {
    renderFounderSections();
    setupLeaderboardFilter();
    setupLanguageRefresh();

    const profileRoot = $("#modalContent");
    if (profileRoot) {
      const observer = new MutationObserver(() => {
        decorateFounderProfile();
      });
      observer.observe(profileRoot, { childList: true, subtree: true });
    }
    const socialObserver = new MutationObserver(() => decorateSocialHub());
    socialObserver.observe(document.body, { childList: true, subtree: true });
    document.body.classList.toggle("aza-is-founder", isFounderSession());
    decorateFounderProfile();
    decorateSocialHub();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
