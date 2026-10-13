/* AZA UNIVERSE — secure username editor overlay patch.
   Loads after profile-customization.js; database RPC enforces the 30-day rule. */
(() => {
  "use strict";
  if (window.__AZA_USERNAME_CHANGE__) return;
  window.__AZA_USERNAME_CHANGE__ = true;

  const cfg = window.AZA_SUPABASE_CONFIG || {};
  const API = String(cfg.projectUrl || "").replace(/\/$/, "");
  const KEY = String(cfg.publishableKey || "");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(API) || !KEY.startsWith("sb_publishable_")) {
    console.warn("AZA username editor: Supabase config is unavailable.");
    return;
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const t = (ky, ru) => (localStorage.getItem("aza-lang") || document.documentElement.lang || "ky") === "ru" ? ru : ky;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const namePattern = /^[A-Za-z0-9_]{3,20}$/;
  const DAY_MS = 24 * 60 * 60 * 1000;

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
    } catch (error) { console.warn("AZA username session read failed", error); }
    return null;
  }

  function headers(session, extra = {}) {
    return { apikey: KEY, Authorization: `Bearer ${session.access_token}`, ...extra };
  }

  async function api(path, options, session) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: headers(session, options?.headers || {})
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) {
      const error = new Error(String(data?.message || data?.details || data || `HTTP ${response.status}`));
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function localDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(langIsRu() ? "ru-RU" : "ky-KG", {
      year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date);
  }
  const langIsRu = () => (localStorage.getItem("aza-lang") || document.documentElement.lang) === "ru";

  function cooldownInfo(changedAt) {
    if (!changedAt) {
      return { locked: false, next: null, text: t(
        "Атыңды биринчи жолу өзгөртө аласың. Андан кийин 30 күн күтөсүң.",
        "Первое изменение имени доступно сейчас. После него действует ожидание 30 дней."
      ) };
    }
    const next = new Date(new Date(changedAt).getTime() + 30 * DAY_MS);
    const left = next.getTime() - Date.now();
    if (left <= 0) {
      return { locked: false, next, text: t(
        `Кийинки өзгөртүү жеткиликтүү. Мурунку өзгөртүү: ${localDate(changedAt)}.`,
        `Имя снова можно изменить. Предыдущее изменение: ${localDate(changedAt)}.`
      ) };
    }
    const days = Math.ceil(left / DAY_MS);
    return { locked: true, next, text: t(
      `Кийинки жолу ${localDate(next)} күнү өзгөртө аласың (дагы ${days} күн).`,
      `Следующее изменение доступно ${localDate(next)} (через ${days} дн.).`
    ) };
  }

  function renderEditor(profileEditor) {
    if (!profileEditor || $(".aza-username-editor", profileEditor)) return;
    const summary = $(".aza-profile-summary", profileEditor);
    if (!summary) return;

    const section = document.createElement("section");
    section.className = "aza-profile-section aza-username-editor";
    section.innerHTML = `
      <div class="aza-section-heading">
        <div>
          <h3>${esc(t("Колдонуучунун атын өзгөртүү", "Изменить имя"))}</h3>
          <p>${esc(t("Атың 3–20 белги болушу керек. Тамгалар, сандар жана _ колдон.", "Имя должно содержать 3–20 символов: латинские буквы, цифры и _ ."))}</p>
        </div>
        <span class="aza-username-icon" aria-hidden="true">✎</span>
      </div>
      <form id="azaUsernameChangeForm" class="aza-username-form">
        <label for="azaUsernameChangeInput">${esc(t("Жаңы ат", "Новое имя"))}</label>
        <div class="aza-username-input-row">
          <input id="azaUsernameChangeInput" name="username" type="text" minlength="3" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" autocomplete="nickname" autocapitalize="off" spellcheck="false" required>
          <button class="btn btn-primary" type="submit" id="azaUsernameChangeButton">${esc(t("Өзгөртүү", "Изменить"))}</button>
        </div>
      </form>
      <p class="aza-username-cooldown" id="azaUsernameChangeCooldown" role="status" aria-live="polite">${esc(t("Чектөө текшерилүүдө…", "Проверяем ограничение…"))}</p>
      <p class="aza-profile-status" id="azaUsernameChangeStatus" role="status" aria-live="polite"></p>`;
    summary.insertAdjacentElement("afterend", section);
    const form = $("#azaUsernameChangeForm", section);
    form?.addEventListener("submit", onSubmit);
    void loadState(section);
  }

  async function loadState(section) {
    const session = readSession();
    const input = $("#azaUsernameChangeInput", section);
    const button = $("#azaUsernameChangeButton", section);
    const note = $("#azaUsernameChangeCooldown", section);
    if (!session) {
      if (note) note.textContent = t("Аккаунтка кайра кир.", "Войди в аккаунт снова.");
      if (button) button.disabled = true;
      return;
    }
    try {
      const rows = await api(`/rest/v1/profiles?select=username,username_changed_at&id=eq.${encodeURIComponent(session.user.id)}&limit=1`, { method: "GET" }, session);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) throw new Error("PROFILE_NOT_FOUND");
      if (input) input.value = row.username || "";
      const cooldown = cooldownInfo(row.username_changed_at);
      if (note) note.textContent = cooldown.text;
      if (button) button.disabled = cooldown.locked;
      section.dataset.changedAt = row.username_changed_at || "";
      section.dataset.currentUsername = row.username || "";
    } catch (error) {
      console.warn("AZA username cooldown status failed", error);
      if (note) note.textContent = t(
        "Чектөөнү жүктөө мүмкүн болгон жок. username-change-migration.sql иштетилгенин текшер.",
        "Не удалось загрузить ограничение. Проверь, что username-change-migration.sql выполнен."
      );
      if (button) button.disabled = true;
    }
  }

  function friendlyError(error) {
    const message = String(error?.message || "");
    if (message.includes("USERNAME_CHANGE_COOLDOWN")) return t(
      "Атыңды өзгөртүү үчүн акыркы өзгөртүүдөн кийин 30 күн өтүшү керек.",
      "Имя можно менять только через 30 дней после предыдущего изменения."
    );
    if (message.includes("USERNAME_ALREADY_TAKEN") || /duplicate key|unique constraint/i.test(message)) return t(
      "Бул ат бош эмес. Башка ат танда.",
      "Это имя уже занято. Выбери другое."
    );
    if (message.includes("USERNAME_INVALID")) return t(
      "3–20 белгиден турган латын тамгаларын, сандарды жана _ колдон.",
      "Используй 3–20 символов: латинские буквы, цифры и _."
    );
    if (message.includes("PROFILE_NOT_FOUND")) return t("Профиль табылган жок.", "Профиль не найден.");
    if (message.includes("AUTHENTICATION_REQUIRED")) return t("Кайра аккаунтка кир.", "Войди в аккаунт снова.");
    if (/column .* does not exist|Could not find the/i.test(message)) return t(
      "Алгач Supabase'те username-change-migration.sql иштет.",
      "Сначала выполни username-change-migration.sql в Supabase."
    );
    return `${t("Ката: ", "Ошибка: ")}${message || "unknown"}`;
  }

  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const section = form.closest(".aza-username-editor");
    const input = $("#azaUsernameChangeInput", section);
    const button = $("#azaUsernameChangeButton", section);
    const status = $("#azaUsernameChangeStatus", section);
    const note = $("#azaUsernameChangeCooldown", section);
    const session = readSession();
    if (!session) { if (status) status.textContent = t("Кайра аккаунтка кир.", "Войди в аккаунт снова."); return; }
    const username = String(input?.value || "").trim();
    if (!namePattern.test(username)) {
      if (status) status.textContent = t(
        "Атың 3–20 белгиден туруп, латын тамгаларын, сандарды же _ камтысын.",
        "Имя должно содержать 3–20 символов: латинские буквы, цифры и _."
      );
      input?.focus();
      return;
    }
    const oldName = section.dataset.currentUsername || "";
    if (username.toLowerCase() === oldName.toLowerCase()) {
      if (status) status.textContent = t("Жаңы ат мурунку ат менен бирдей.", "Новое имя совпадает с текущим.");
      return;
    }
    if (button) { button.disabled = true; button.textContent = t("Сакталууда…", "Сохранение…"); }
    if (status) status.textContent = "";
    try {
      const result = await api("/rest/v1/rpc/aza_change_username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_new_username: username })
      }, session);
      const changed = result?.changed === true;
      if (!changed) {
        if (status) status.textContent = t("Атың өзгөргөн жок.", "Имя не изменилось.");
        await loadState(section);
        return;
      }
      if (status) status.textContent = t("Атың ийгиликтүү өзгөрдү! Профиль жаңыланууда…", "Имя успешно изменено! Обновляем профиль…");
      if (note) note.textContent = cooldownInfo(result.username_changed_at).text;
      if (input) input.value = result.username || username;
      // Reload lets the existing app/profile modules read the saved username consistently.
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      if (status) status.textContent = friendlyError(error);
      await loadState(section);
    } finally {
      if (button && status?.textContent !== t("Атың ийгиликтүү өзгөрдү! Профиль жаңыланууда…", "Имя успешно изменено! Обновляем профиль…")) {
        button.disabled = false;
        button.textContent = t("Өзгөртүү", "Изменить");
      }
    }
  }

  function scan() {
    const editor = $("#modalContent .aza-profile-editor");
    if (editor) renderEditor(editor);
  }

  const root = $("#modalContent");
  if (root) {
    const observer = new MutationObserver(scan);
    observer.observe(root, { childList: true, subtree: true });
    scan();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan, { once: true });
  }
})();
