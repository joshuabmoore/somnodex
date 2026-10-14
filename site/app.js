(() => {
  "use strict";

  const CFG = window.CATALOGUE_CONFIG || {};
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en") : "–");

  const ACCESS_LABEL = { open: "open", registration: "registration", dua: "DUA", "on-request": "on request" };
  const STAGING_LABEL = { aasm: "AASM", rk: "R&K", both: "AASM + R&K", other: "other", none: "none", unknown: "–" };

  const pop = (e) => e.population || {};
  const rec = (e) => e.recording || {};
  const ann = (e) => e.annotations || {};

  // Filter definitions. mode "all" = dataset must have every selected value.
  const FILTERS = [
    { key: "access", label: "Access", get: (e) => [e.access], mode: "any", fmt: (v) => ACCESS_LABEL[v] || v },
    { key: "modality", label: "Modalities", get: (e) => rec(e).modalities || [], mode: "all" },
    { key: "host", label: "Host", get: (e) => [e.host], mode: "any" },
    { key: "group", label: "Population", get: (e) => pop(e).groups || [], mode: "any" },
    { key: "type", label: "Recording type", get: (e) => rec(e).type || [], mode: "any" },
    { key: "setting", label: "Setting", get: (e) => rec(e).setting || [], mode: "any" },
    { key: "staging", label: "Staging", get: (e) => [ann(e).staging || "unknown"], mode: "any", fmt: (v) => STAGING_LABEL[v] || v },
    { key: "event", label: "Annotated events", get: (e) => ann(e).events || [], mode: "all" },
    { key: "format", label: "Format", get: (e) => e.formats || [], mode: "any" },
    { key: "tag", label: "Tags", get: (e) => e.tags || [], mode: "all" },
  ];

  const state = {
    data: [],
    q: "",
    sel: Object.fromEntries(FILTERS.map((f) => [f.key, new Set()])),
    verifiedOnly: false,
    sort: { key: "name", dir: 1 },
    open: null,
    tab: "catalogue",
  };

  // ---------- URL state ----------
  function readURL() {
    const p = new URLSearchParams(location.search);
    state.q = p.get("q") || "";
    FILTERS.forEach((f) => { const v = p.get(f.key); if (v) v.split(",").forEach((x) => state.sel[f.key].add(x)); });
    state.verifiedOnly = p.get("verified") === "1";
    if (p.get("sort")) { const [k, d] = p.get("sort").split(":"); state.sort = { key: k, dir: d === "desc" ? -1 : 1 }; }
    if (p.get("tab") === "stats") state.tab = "stats";
    state.open = decodeURIComponent(location.hash.slice(1)) || null;
  }
  function writeURL() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    FILTERS.forEach((f) => { if (state.sel[f.key].size) p.set(f.key, [...state.sel[f.key]].join(",")); });
    if (state.verifiedOnly) p.set("verified", "1");
    if (!(state.sort.key === "name" && state.sort.dir === 1)) p.set("sort", `${state.sort.key}:${state.sort.dir < 0 ? "desc" : "asc"}`);
    if (state.tab === "stats") p.set("tab", "stats");
    const qs = p.toString();
    history.replaceState(null, "", `${location.pathname}${qs ? "?" + qs : ""}${state.open ? "#" + encodeURIComponent(state.open) : ""}`);
  }

  // ---------- filtering ----------
  function haystack(e) {
    if (!e._hay) {
      e._hay = [e.id, e.name, e.short_name, e.description, e.host, e.license, e.access, e.doi, e.notes,
        rec(e).eeg_montage, ...(rec(e).modalities || []), ...(pop(e).groups || []), ...(e.tags || []),
        ...(ann(e).events || []), ...(e.formats || []), ...(e.citations || []).map((c) => c.text)]
        .filter(Boolean).join(" ").toLowerCase();
    }
    return e._hay;
  }

  function matches(e, skipKey = null) {
    if (state.verifiedOnly && !e.verified) return false;
    if (state.q) {
      const h = haystack(e);
      if (!state.q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => h.includes(t))) return false;
    }
    for (const f of FILTERS) {
      if (f.key === skipKey) continue;
      const sel = state.sel[f.key];
      if (!sel.size) continue;
      const vals = new Set(f.get(e));
      const ok = f.mode === "all" ? [...sel].every((v) => vals.has(v)) : [...sel].some((v) => vals.has(v));
      if (!ok) return false;
    }
    return true;
  }

  const filtered = () => state.data.filter((e) => matches(e));

  function sortVal(e, key) {
    switch (key) {
      case "name": return (e.short_name || e.name).toLowerCase();
      case "n_subjects": return pop(e).n_subjects ?? -1;
      case "n_recordings": return pop(e).n_recordings ?? -1;
      case "staging": return ann(e).staging || "~";
      default: return (e[key] ?? "").toString().toLowerCase();
    }
  }

  // ---------- rendering ----------
  function renderKPIs(rows) {
    const subj = rows.reduce((a, e) => a + (pop(e).n_subjects || 0), 0);
    const recs = rows.reduce((a, e) => a + (pop(e).n_recordings || 0), 0);
    const open = rows.filter((e) => e.access === "open").length;
    $("#kpis").innerHTML = [
      [fmt(rows.length), rows.length === state.data.length ? "datasets" : `of ${state.data.length} datasets`],
      [fmt(subj), "subjects (reported)"],
      [fmt(recs), "recordings (reported)"],
      [rows.length ? Math.round((100 * open) / rows.length) + "%" : "–", "fully open download"],
    ].map(([v, l]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join("");
  }

  function renderFilters() {
    const wrap = $("#filters");
    const openKey = wrap.querySelector(".menu")?.dataset.key;
    wrap.innerHTML = "";
    for (const f of FILTERS) {
      // facet counts: computed with all *other* filters applied
      const counts = new Map();
      state.data.filter((e) => matches(e, f.key)).forEach((e) => f.get(e).forEach((v) => v && counts.set(v, (counts.get(v) || 0) + 1)));
      state.sel[f.key].forEach((v) => counts.has(v) || counts.set(v, 0));
      if (!counts.size) continue;

      const g = document.createElement("div");
      g.className = "fgroup";
      const n = state.sel[f.key].size;
      g.innerHTML = `<button type="button" class="${n ? "on" : ""}" aria-expanded="false">${esc(f.label)}${n ? ` · ${n}` : ""} ▾</button>`;
      const btn = g.firstElementChild;
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const existing = g.querySelector(".menu");
        closeMenus();
        if (!existing) openMenu(g, f, counts);
      });
      wrap.appendChild(g);
      if (openKey === f.key) openMenu(g, f, counts);
    }
  }

  function openMenu(g, f, counts) {
    const m = document.createElement("div");
    m.className = "menu";
    m.dataset.key = f.key;
    const items = [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
    m.innerHTML = (f.mode === "all" ? `<div class="mode">Datasets must include all selected</div>` : "") +
      items.map(([v, c]) => `<label><input type="checkbox" value="${esc(v)}" ${state.sel[f.key].has(v) ? "checked" : ""}> ${esc(f.fmt ? f.fmt(v) : v)}<span class="cnt">${c}</span></label>`).join("");
    m.addEventListener("click", (ev) => ev.stopPropagation());
    m.addEventListener("change", (ev) => {
      const v = ev.target.value;
      ev.target.checked ? state.sel[f.key].add(v) : state.sel[f.key].delete(v);
      update();
    });
    g.appendChild(m);
    g.firstElementChild.setAttribute("aria-expanded", "true");
  }
  function closeMenus() {
    document.querySelectorAll(".fgroup .menu").forEach((m) => { m.previousElementSibling?.setAttribute("aria-expanded", "false"); m.remove(); });
  }

  function renderTable(rows) {
    const { key, dir } = state.sort;
    rows = [...rows].sort((a, b) => {
      const x = sortVal(a, key), y = sortVal(b, key);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
    document.querySelectorAll("th[data-sort]").forEach((th) => {
      th.classList.toggle("asc", th.dataset.sort === key && dir > 0);
      th.classList.toggle("desc", th.dataset.sort === key && dir < 0);
    });

    const tb = $("#table tbody");
    tb.innerHTML = rows.map((e) => {
      const isOpen = state.open === e.id;
      const mods = (rec(e).modalities || []).map((m) => `<span class="chip">${esc(m)}</span>`).join("");
      const row = `<tr class="row${isOpen ? " open" : ""}" data-id="${esc(e.id)}" tabindex="0">
        <td><span class="dname">${esc(e.short_name || e.name)}</span>${e.verified ? "" : ` <span class="badge unverified" title="Not yet checked against source">unverified</span>`}
          ${e.short_name && e.short_name !== e.name ? `<span class="dsub">${esc(e.name)}</span>` : ""}</td>
        <td>${esc(e.host)}</td>
        <td><span class="badge ${esc(e.access)}">${esc(ACCESS_LABEL[e.access] || e.access)}</span></td>
        <td class="num">${fmt(pop(e).n_subjects)}</td>
        <td class="num hide-sm">${fmt(pop(e).n_recordings)}</td>
        <td class="hide-sm"><div class="chips">${mods}</div></td>
        <td class="hide-sm">${esc(STAGING_LABEL[ann(e).staging || "unknown"])}</td>
        <td class="mute hide-sm nowrap">${esc(e.date_added || "")}</td>
      </tr>`;
      return row + (isOpen ? `<tr class="detail"><td colspan="8">${detail(e)}</td></tr>` : "");
    }).join("");
    $("#empty").hidden = rows.length > 0;
  }

  function dl(pairs) {
    const rows = pairs.filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length));
    if (!rows.length) return `<p class="mute">–</p>`;
    return `<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${Array.isArray(v) ? esc(v.join(", ")) : esc(v)}</dd>`).join("")}</dl>`;
  }

  function detail(e) {
    const p = pop(e), r = rec(e), a = ann(e);
    const age = p.age_range ? `${p.age_range[0]}–${p.age_range[1]} y` : null;
    const cites = (e.citations || []).map((c) =>
      `<li>${esc(c.text)}${c.doi ? ` <a href="https://doi.org/${esc(c.doi)}" target="_blank" rel="noopener">doi:${esc(c.doi)}</a>` : ""}</li>`).join("");
    const repo = repoSlug();
    const editURL = repo ? `https://github.com/${repo}/edit/main/datasets/${encodeURIComponent(e.id)}.yaml` : null;
    return `<div class="detail">
      ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ""}
      <div class="detail-grid">
        <div><h3>Population</h3>${dl([["Species", p.species], ["Subjects", fmt(p.n_subjects)], ["Recordings", fmt(p.n_recordings)], ["Total hours", p.total_hours], ["Age", age], ["Groups", p.groups]])}</div>
        <div><h3>Recording</h3>${dl([["Type", r.type], ["Setting", r.setting], ["Modalities", r.modalities], ["EEG channels", r.eeg_channels], ["Montage", r.eeg_montage], ["EEG fs (Hz)", Array.isArray(r.sampling_rate_hz) ? r.sampling_rate_hz : r.sampling_rate_hz], ["Nights", r.nights_per_subject]])}</div>
        <div><h3>Annotations</h3>${dl([["Staging", STAGING_LABEL[a.staging] || a.staging], ["Epoch (s)", a.epoch_s], ["Scorers", a.n_scorers], ["Events", a.events]])}</div>
        <div><h3>Access</h3>${dl([["Host", e.host], ["Access", ACCESS_LABEL[e.access] || e.access], ["License", e.license], ["Formats", e.formats], ["Size (GB)", e.size_gb], ["Released", e.year_released], ["Tags", e.tags], ["Added", e.date_added], ["Last checked", e.last_checked]])}</div>
      </div>
      ${e.notes ? `<p class="desc" style="margin-top:16px"><strong>Notes.</strong> ${esc(e.notes)}</p>` : ""}
      ${cites ? `<h3 style="margin-top:16px">Cite</h3><ul class="cites">${cites}</ul>` : ""}
      <div class="links">
        <a class="btn primary" href="${esc(e.url)}" target="_blank" rel="noopener">Go to dataset ↗</a>
        ${e.doi ? `<a class="btn" href="https://doi.org/${esc(e.doi)}" target="_blank" rel="noopener">DOI</a>` : ""}
        <a class="btn" href="#${encodeURIComponent(e.id)}" data-permalink>Permalink</a>
        ${editURL ? `<a class="btn" href="${editURL}" target="_blank" rel="noopener">Suggest an edit</a>` : ""}
      </div>
    </div>`;
  }

  function bars(title, counts, filterKey, labelFmt) {
    const items = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    if (!items.length) return "";
    const max = Math.max(...items.map(([, c]) => c));
    return `<div class="chart"><h3>${esc(title)}</h3><div class="bars">${items.map(([k, c]) => `
      ${filterKey ? `<button class="lab" data-f="${filterKey}" data-v="${esc(k)}" title="Filter by ${esc(k)}">${esc(labelFmt ? labelFmt(k) : k)}</button>` : `<span class="lab">${esc(k)}</span>`}
      <div class="track"><div class="fill" style="width:${((100 * c) / max).toFixed(1)}%"></div></div>
      <span class="val">${c}</span>`).join("")}</div></div>`;
  }

  function renderStats(rows) {
    const count = (get) => { const c = {}; rows.forEach((e) => get(e).forEach((v) => v && (c[v] = (c[v] || 0) + 1))); return c; };
    const bins = [["1–10", 1, 10], ["11–100", 11, 100], ["101–1k", 101, 1000], ["1k–10k", 1001, 10000], [">10k", 10001, Infinity]];
    const sizeCounts = {};
    bins.forEach(([l]) => (sizeCounts[l] = 0));
    let unknown = 0;
    rows.forEach((e) => {
      const n = pop(e).n_subjects;
      if (typeof n !== "number") { unknown++; return; }
      const b = bins.find(([, lo, hi]) => n >= lo && n <= hi); sizeCounts[b[0]]++;
    });
    if (unknown) sizeCounts["not reported"] = unknown;
    // keep bin order for size chart
    const sizeChart = (() => {
      const items = Object.entries(sizeCounts);
      const max = Math.max(1, ...items.map(([, c]) => c));
      return `<div class="chart"><h3>Subjects per dataset</h3><div class="bars">${items.map(([k, c]) =>
        `<span class="lab">${esc(k)}</span><div class="track"><div class="fill" style="width:${((100 * c) / max).toFixed(1)}%"></div></div><span class="val">${c}</span>`).join("")}</div></div>`;
    })();

    const byF = (key) => FILTERS.find((f) => f.key === key);
    $("#charts").innerHTML = [
      bars("Modalities", count(byF("modality").get), "modality"),
      bars("Access", count(byF("access").get), "access", byF("access").fmt),
      bars("Host", count(byF("host").get), "host"),
      bars("Population groups", count(byF("group").get), "group"),
      bars("Staging rules", count(byF("staging").get), "staging", byF("staging").fmt),
      sizeChart,
      bars("Recording setting", count(byF("setting").get), "setting"),
      bars("Annotated events", count(byF("event").get), "event"),
      bars("Tags", count(byF("tag").get), "tag"),
    ].join("") || `<p class="empty">No datasets to summarise.</p>`;
  }

  function update() {
    const rows = filtered();
    const active = FILTERS.reduce((a, f) => a + state.sel[f.key].size, 0) + (state.q ? 1 : 0) + (state.verifiedOnly ? 1 : 0);
    $("#count").textContent = `${rows.length} of ${state.data.length} datasets`;
    $("#clear").hidden = !active;
    renderKPIs(rows);
    renderFilters();
    if (state.tab === "catalogue") renderTable(rows); else renderStats(rows);
    writeURL();
  }

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll(".tab").forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on);
    });
    $("#tab-catalogue").hidden = tab !== "catalogue";
    $("#tab-stats").hidden = tab !== "stats";
    update();
  }

  function repoSlug() {
    if (CFG.repo) return CFG.repo;
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (!m) return null;
    const seg = location.pathname.split("/").filter(Boolean)[0];
    return seg ? `${m[1]}/${seg}` : `${m[1]}/${m[1]}.github.io`;
  }

  // ---------- wiring ----------
  function wire() {
    const q = $("#q");
    q.value = state.q;
    let t;
    q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.q = q.value.trim(); update(); }, 120); });
    $("#verified-only").checked = state.verifiedOnly;
    $("#verified-only").addEventListener("change", (e) => { state.verifiedOnly = e.target.checked; update(); });
    $("#clear").addEventListener("click", () => {
      state.q = ""; q.value = ""; state.verifiedOnly = false; $("#verified-only").checked = false;
      FILTERS.forEach((f) => state.sel[f.key].clear());
      update();
    });
    document.querySelectorAll("th[data-sort]").forEach((th) => th.addEventListener("click", () => {
      const k = th.dataset.sort;
      state.sort = state.sort.key === k ? { key: k, dir: -state.sort.dir } : { key: k, dir: k.startsWith("n_") || k === "date_added" ? -1 : 1 };
      update();
    }));
    const toggleRow = (tr) => { const id = tr.dataset.id; state.open = state.open === id ? null : id; update(); };
    $("#table tbody").addEventListener("click", (ev) => {
      if (ev.target.closest("a")) {
        if (ev.target.closest("[data-permalink]")) {
          ev.preventDefault();
          navigator.clipboard?.writeText(location.href).then(() => { ev.target.textContent = "Link copied"; });
        }
        return;
      }
      const tr = ev.target.closest("tr.row");
      if (tr) toggleRow(tr);
    });
    $("#table tbody").addEventListener("keydown", (ev) => {
      const tr = ev.target.closest("tr.row");
      if (tr && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); toggleRow(tr); }
    });
    document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));
    $("#charts").addEventListener("click", (ev) => {
      const b = ev.target.closest("button.lab");
      if (!b) return;
      state.sel[b.dataset.f].add(b.dataset.v);
      setTab("catalogue");
    });
    document.addEventListener("click", closeMenus);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenus(); });
    window.addEventListener("hashchange", () => { state.open = decodeURIComponent(location.hash.slice(1)) || null; update(); });

    const repo = repoSlug();
    if (repo) {
      $("#link-repo").href = `https://github.com/${repo}`;
      $("#link-add").href = `https://github.com/${repo}/issues/new?template=add-dataset.yml`;
    } else {
      $("#link-repo").hidden = true;
      $("#link-add").hidden = true;
    }
    if (CFG.title) { $("#site-title").textContent = CFG.title; document.title = CFG.title; }
    if (CFG.tagline) $("#site-tagline").textContent = CFG.tagline;
  }

  async function init() {
    readURL();
    wire();
    try {
      const res = await fetch("data/datasets.json", { cache: "no-cache" });
      const payload = await res.json();
      state.data = payload.datasets || [];
      if (payload.generated_at) $("#generated").textContent = `Last built ${new Date(payload.generated_at).toLocaleString()}`;
    } catch (err) {
      $("#empty").hidden = false;
      $("#empty").textContent = "Could not load data/datasets.json. Build the site with scripts/build.py.";
      return;
    }
    setTab(state.tab);
    if (state.open) document.querySelector(`tr.row[data-id="${CSS.escape(state.open)}"]`)?.scrollIntoView({ block: "center" });
  }

  init();
})();
