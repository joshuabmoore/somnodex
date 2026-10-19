// Pipelines tab: list of preprocessing pipelines with filters, and a
// side-by-side step comparison. app.js owns tab switching and the URL;
// this module owns everything inside #tab-pipelines.
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const has = (v) => v !== undefined && v !== null && v !== "";

  const SCHEME = { "aasm-5": "AASM 5-class", "rk-6": "R&K 6-class", "4-class": "4-class", "3-class": "3-class", "wake-sleep": "wake / sleep", other: "other" };
  const SCOPE = { epoch: "per epoch", recording: "per recording", subject: "per subject", dataset: "per dataset", "training-set": "training-set statistics" };
  const STATUS = { none: "not done", not_reported: "not reported" };

  const splitLabel = (s) => [
    s.scheme === "k-fold" && s.k ? `${s.k}-fold` : s.scheme === "nested-k-fold" && s.k ? `nested ${s.k}-fold` : s.scheme,
    s.unit && `by ${s.unit}`,
  ].filter(Boolean).join(", ");

  function mappingLines(mapping) {
    const byTarget = new Map();
    Object.entries(mapping || {}).forEach(([from, to]) => byTarget.set(to, [...(byTarget.get(to) || []), from]));
    return [...byTarget].map(([to, froms]) => `${froms.join(", ")} → ${to === "drop" ? "dropped" : to}`);
  }

  // Each step's parameters as display lines. Order here is the order in the comparison.
  const STEPS = [
    { key: "channels", label: "Channels", lines: (s) => [
      s.channels && (s.evaluated_separately ? `${s.channels.join(" | ")} (each separately)` : s.channels.join(" + ")),
      s.selection && s.selection !== "fixed" && `selection: ${s.selection}`,
      s.rereferencing && `reference: ${s.rereferencing}`,
    ] },
    { key: "filtering", label: "Filtering", lines: (s) => [
      [has(s.highpass_hz) && `high-pass ${s.highpass_hz} Hz`, has(s.lowpass_hz) && `low-pass ${s.lowpass_hz} Hz`,
        s.notch_hz?.length && `notch ${s.notch_hz.join(", ")} Hz`].filter(Boolean).join(" · "),
      s.design,
    ] },
    { key: "resampling", label: "Resampling", lines: (s) => [has(s.target_hz) && `→ ${s.target_hz} Hz`, s.method] },
    { key: "epoching", label: "Epoching", lines: (s) => [
      [has(s.epoch_s) && `${s.epoch_s} s epochs`,
        has(s.context_epochs) && (s.context_epochs === 1 ? "single-epoch input" : `${s.context_epochs}-epoch input`),
        has(s.overlap_s) && `${s.overlap_s} s overlap`].filter(Boolean).join(" · "),
    ] },
    { key: "label_mapping", label: "Label mapping", lines: (s) => [SCHEME[s.scheme] || s.scheme, ...mappingLines(s.mapping)] },
    { key: "wake_trimming", label: "Wake trimming", lines: (s) => [
      (has(s.keep_before_min) || has(s.keep_after_min)) &&
        `keep ${s.keep_before_min ?? "?"} min before / ${s.keep_after_min ?? "?"} min after sleep`,
      s.other,
    ] },
    { key: "normalisation", label: "Normalisation", lines: (s) => [
      [s.method, SCOPE[s.scope] || s.scope, s.per_channel && "per channel"].filter(Boolean).join(" · "),
      s.clip && `clip ${s.clip}`,
    ] },
    { key: "artefact_rejection", label: "Artefact rejection", lines: (s) => [s.method] },
    { key: "exclusion", label: "Exclusion", lines: (s) => [s.criteria, has(s.n_excluded) && `${s.n_excluded} excluded`] },
    { key: "split", label: "Train / test split", lines: (s) => [splitLabel(s), s.validation && `validation: ${s.validation}`] },
    { key: "class_balancing", label: "Class balancing", lines: (s) => [[s.method, s.applied_to].filter(Boolean).join(" — ")] },
  ];
  const STEP = Object.fromEntries(STEPS.map((d) => [d.key, d]));
  const META_KEYS = new Set(["status", "source", "notes", "discrepancy", "_from"]);

  const P = {
    all: [], byId: {}, datasets: {}, loaded: false, error: null, onChange: () => {},
    q: "", sel: {}, verifiedOnly: false, cmp: [], view: "list", diffOnly: false,
  };

  // ---------- data helpers ----------
  const ds = (p) => P.datasets[p.dataset] || {};
  const dsName = (id) => { const d = P.datasets[id]; return d ? d.short_name || d.name : id; };
  const pName = (p) => p.source?.short_name || p.source?.title || p.id;

  function nativeHz(p) {
    const r = (ds(p).recording || {}).sampling_rate_hz;
    return Array.isArray(r) ? r.join("/") : r;
  }

  // Steps with based_on inheritance applied; inherited steps carry _from.
  function eff(p, seen = new Set()) {
    if (p._eff) return p._eff;
    const parent = p.based_on && P.byId[p.based_on];
    const out = {};
    if (parent && !seen.has(p.id)) {
      seen.add(p.id);
      Object.entries(eff(parent, seen)).forEach(([k, s]) => (out[k] = { ...s, _from: s._from || parent.id }));
    }
    Object.entries(p.steps || {}).forEach(([k, s]) => (out[k] = { ...s }));
    return (p._eff = out);
  }

  function stepLines(p, key) {
    const s = eff(p)[key];
    if (!s) return null;
    if (s.status !== "done") return null;
    return STEP[key].lines(s).filter((l) => has(l) && l !== false && l !== 0);
  }

  // Values a step contributes to a filter facet.
  function stepFacet(p, key, fn, overrides = {}) {
    const s = eff(p)[key];
    if (!s) return ["not extracted"];
    if (s.status !== "done") return [overrides[s.status] || STATUS[s.status]];
    const v = fn(s).filter(has);
    return v.length ? v : ["done"];
  }

  const FILTERS = [
    { key: "dataset", label: "Dataset", get: (p) => [p.dataset], fmt: dsName },
    { key: "subset", label: "Subset", get: (p) => [p.subset?.name || "unspecified"] },
    { key: "task", label: "Task", get: (p) => p.task || [] },
    { key: "channel", label: "Channels", get: (p) => stepFacet(p, "channels", (s) => s.channels || []) },
    { key: "fs", label: "Sampling rate", get: (p) => stepFacet(p, "resampling", (s) => [has(s.target_hz) ? `${s.target_hz} Hz` : null], { none: "native" }) },
    { key: "labels", label: "Label scheme", get: (p) => stepFacet(p, "label_mapping", (s) => [SCHEME[s.scheme] || s.scheme]) },
    { key: "wake", label: "Wake trimming", get: (p) => stepFacet(p, "wake_trimming", () => ["trimmed"]) },
    { key: "norm", label: "Normalisation", get: (p) => stepFacet(p, "normalisation", (s) => [s.method]) },
    { key: "split", label: "Split", get: (p) => stepFacet(p, "split", (s) => [splitLabel(s)]) },
    { key: "balance", label: "Class balancing", get: (p) => stepFacet(p, "class_balancing", (s) => [s.method]) },
  ];
  FILTERS.forEach((f) => (P.sel[f.key] = new Set()));

  function haystack(p) {
    if (!p._hay) {
      const src = p.source || {};
      p._hay = [p.id, src.title, src.short_name, src.authors, src.venue, src.doi, src.year, p.dataset, dsName(p.dataset),
        p.subset?.name, p.subset?.description, ...(p.task || []), p.notes, JSON.stringify(eff(p))]
        .filter(has).join(" ").toLowerCase();
    }
    return p._hay;
  }

  function matches(p, skipKey = null) {
    if (P.verifiedOnly && !p.verified) return false;
    if (P.q) {
      const h = haystack(p);
      if (!P.q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => h.includes(t))) return false;
    }
    for (const f of FILTERS) {
      if (f.key === skipKey || !P.sel[f.key].size) continue;
      const vals = new Set(f.get(p));
      if (![...P.sel[f.key]].some((v) => vals.has(v))) return false;
    }
    return true;
  }

  // ---------- list view ----------
  function renderFilters() {
    const wrap = $("#p-filters");
    const openKey = wrap.querySelector(".menu")?.dataset.key;
    wrap.innerHTML = "";
    for (const f of FILTERS) {
      const counts = new Map();
      P.all.filter((p) => matches(p, f.key)).forEach((p) => f.get(p).forEach((v) => has(v) && counts.set(v, (counts.get(v) || 0) + 1)));
      P.sel[f.key].forEach((v) => counts.has(v) || counts.set(v, 0));
      if (!counts.size) continue;
      const g = document.createElement("div");
      g.className = "fgroup";
      const n = P.sel[f.key].size;
      g.innerHTML = `<button type="button" class="${n ? "on" : ""}" aria-expanded="false">${esc(f.label)}${n ? ` · ${n}` : ""} ▾</button>`;
      g.firstElementChild.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const existing = g.querySelector(".menu");
        document.querySelectorAll(".fgroup .menu").forEach((m) => m.remove());
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
    m.innerHTML = items.map(([v, c]) => `<label><input type="checkbox" value="${esc(v)}" ${P.sel[f.key].has(v) ? "checked" : ""}> ${esc(f.fmt ? f.fmt(v) : v)}<span class="cnt">${c}</span></label>`).join("");
    m.addEventListener("click", (ev) => ev.stopPropagation());
    m.addEventListener("change", (ev) => {
      const v = ev.target.value;
      ev.target.checked ? P.sel[f.key].add(v) : P.sel[f.key].delete(v);
      P.onChange();
    });
    g.appendChild(m);
    g.firstElementChild.setAttribute("aria-expanded", "true");
  }

  function summary(p, key) {
    const s = eff(p)[key];
    if (!s) return `<span class="mute">–</span>`;
    if (s.status === "not_reported") return `<span class="st nr">not reported</span>`;
    if (s.status === "none") return `<span class="st none">${key === "resampling" && nativeHz(p) ? `native ${esc(nativeHz(p))} Hz` : "not done"}</span>`;
    const text = (stepLines(p, key) || []).join("; ") || "done";
    return `<span class="clip" title="${esc(text)}">${esc(text)}</span>`;
  }

  function renderList(rows) {
    const groups = new Map();
    rows.forEach((p) => groups.set(p.dataset, [...(groups.get(p.dataset) || []), p]));
    const ordered = [...groups].sort((a, b) => dsName(a[0]).localeCompare(dsName(b[0])));
    const cols = [["channels", "Channels", ""], ["resampling", "Sampling", "hide-sm"], ["label_mapping", "Labels", "hide-sm"],
      ["wake_trimming", "Wake trim", "hide-sm"], ["split", "Split", "hide-sm"]];

    const body = ordered.map(([id, ps]) => {
      ps.sort((a, b) => pName(a).localeCompare(pName(b)));
      const head = `<tr class="group"><td colspan="${cols.length + 3}">
        <span class="gname">${esc(dsName(id))}</span>
        <span class="mute">${ps.length} pipeline${ps.length === 1 ? "" : "s"}</span>
        <button type="button" class="linkish" data-group="${esc(id)}">${ps.length > 1 ? "Compare all" : "View"}</button></td></tr>`;
      return head + ps.map((p) => {
        const on = P.cmp.includes(p.id);
        return `<tr class="row prow${on ? " open" : ""}" data-id="${esc(p.id)}" tabindex="0">
          <td class="selcell"><input type="checkbox" ${on ? "checked" : ""} aria-label="Select ${esc(pName(p))} for comparison" tabindex="-1"></td>
          <td><span class="dname">${esc(pName(p))}</span>${p.source?.year ? ` <span class="mute">${esc(p.source.year)}</span>` : ""}${p.verified ? "" : ` <span class="badge unverified">unverified</span>`}
            ${p.source?.title && p.source.title !== pName(p) ? `<span class="dsub">${esc(p.source.title)}</span>` : ""}</td>
          <td class="hide-sm">${p.subset?.name ? `<span class="chip">${esc(p.subset.name)}</span>` : `<span class="mute">–</span>`}</td>
          ${cols.map(([k, , cls]) => `<td class="${cls} pcell">${summary(p, k)}</td>`).join("")}
        </tr>`;
      }).join("");
    }).join("");

    $("#p-list").innerHTML = rows.length ? `<div class="table-wrap"><table class="ptable">
      <thead><tr><th class="selcell"><span class="sr">Select</span></th><th>Pipeline</th><th class="hide-sm">Subset</th>
        ${cols.map(([, l, cls]) => `<th class="${cls}">${l}</th>`).join("")}</tr></thead>
      <tbody>${body}</tbody></table></div>`
      : `<p class="empty">${P.all.length ? "No pipelines match these filters." : esc(P.error || "No pipelines yet.")}</p>`;

    const tray = $("#p-tray");
    tray.hidden = !P.cmp.length;
    tray.innerHTML = P.cmp.length ? `<span><strong>${P.cmp.length}</strong> selected</span>
      <button type="button" class="btn primary" data-act="compare">Compare ${P.cmp.length > 1 ? "side by side" : ""} →</button>
      <button type="button" class="linkish" data-act="clear-sel">clear</button>` : "";
  }

  // ---------- comparison view ----------
  function sig(p, key) {
    const s = eff(p)[key];
    if (!s) return null;
    const core = Object.fromEntries(Object.entries(s).filter(([k]) => !META_KEYS.has(k)).sort());
    core.status = s.status;
    if (key === "resampling" && s.status === "none") core.native = nativeHz(p);
    return JSON.stringify(core);
  }

  function stepCell(p, key) {
    const s = eff(p)[key];
    if (!s) return `<td class="na"><span class="mute">not extracted</span></td>`;
    let body;
    if (s.status === "not_reported") body = `<span class="st nr">not reported</span>`;
    else if (s.status === "none") body = `<span class="st none">${key === "resampling" && nativeHz(p) ? `none (native ${esc(nativeHz(p))} Hz)` : "not done"}</span>`;
    else {
      const ls = stepLines(p, key);
      body = ls.length ? ls.map((l, i) => `<div class="${i ? "sub" : "main"}">${esc(l)}</div>`).join("") : `<div class="main">done</div>`;
    }
    return `<td>${body}
      ${s.discrepancy ? `<div class="disc"><strong>Paper vs code:</strong> ${esc(s.discrepancy)}</div>` : ""}
      ${s.notes ? `<div class="cnote">${esc(s.notes)}</div>` : ""}
      ${s.source?.length ? `<div class="src">Source: ${esc(s.source.join("; "))}</div>` : ""}
      ${s._from ? `<div class="inh">Inherited from ${esc(pName(P.byId[s._from] || { id: s._from }))}</div>` : ""}
    </td>`;
  }

  function sourceCell(p) {
    const s = p.source || {};
    const links = [
      s.doi && `<a href="https://doi.org/${esc(s.doi)}" target="_blank" rel="noopener">DOI</a>`,
      s.url && `<a href="${esc(s.url)}" target="_blank" rel="noopener">Link</a>`,
      s.code?.url && `<a href="${esc(s.code.url)}" target="_blank" rel="noopener">Code${s.code.commit ? ` @${esc(s.code.commit.slice(0, 7))}` : ""}</a>`,
    ].filter(Boolean).join(" · ");
    return `<td><div class="main">${esc(s.title)}</div>
      <div class="sub">${esc([s.authors, s.venue, s.year].filter(has).join(" · "))}</div>
      ${links ? `<div class="sub">${links}</div>` : ""}</td>`;
  }

  function renderCompare() {
    const ps = P.cmp.map((id) => P.byId[id]).filter(Boolean);
    const root = $("#p-compare");
    if (!ps.length) {
      root.innerHTML = `<p class="empty">Nothing selected. <button type="button" class="linkish" data-act="back">Back to all pipelines</button></p>`;
      return;
    }
    const rows = [
      { label: "Source", cell: sourceCell },
      { label: "Dataset", sig: (p) => p.dataset, cell: (p) => `<td><a href="./#${encodeURIComponent(p.dataset)}">${esc(dsName(p.dataset))}</a></td>` },
      // Subsets are compared by name: one entry recording counts and another not isn't a difference.
      { label: "Subset", sig: (p) => p.subset?.name ?? (p.subset ? JSON.stringify(p.subset) : null), cell: (p) => {
        const s = p.subset;
        if (!s) return `<td class="na"><span class="mute">not specified</span></td>`;
        const n = [has(s.n_subjects) && `${s.n_subjects} subjects`, has(s.n_recordings) && `${s.n_recordings} recordings`].filter(Boolean).join(", ");
        return `<td>${s.name ? `<div class="main"><span class="chip">${esc(s.name)}</span></div>` : ""}${n ? `<div class="sub">${esc(n)}</div>` : ""}${s.description ? `<div class="cnote">${esc(s.description)}</div>` : ""}</td>`;
      } },
      { label: "Task", sig: (p) => JSON.stringify(p.task || []), cell: (p) => `<td>${esc((p.task || []).join(", "))}</td>` },
      { label: "Based on", cell: (p) => `<td>${p.based_on ? esc(pName(P.byId[p.based_on] || { id: p.based_on })) : `<span class="mute">–</span>`}</td>` },
      ...STEPS.map((d) => ({ label: d.label, sig: (p) => sig(p, d.key), cell: (p) => stepCell(p, d.key), step: true })),
      { label: "Notes", cell: (p) => `<td>${p.notes ? `<div class="cnote">${esc(p.notes)}</div>` : `<span class="mute">–</span>`}</td>` },
      { label: "Checked", cell: (p) => `<td>${p.verified ? `<span class="badge open">verified</span>` : `<span class="badge unverified">unverified</span>`}
        ${p.last_checked ? `<div class="sub">last checked ${esc(p.last_checked)}</div>` : ""}</td>` },
    ];

    let nDiff = 0;
    const body = rows.map((r) => {
      const sigs = r.sig && ps.length > 1 ? ps.map(r.sig).filter((x) => x !== null) : [];
      const differs = new Set(sigs).size > 1;
      if (differs) nDiff++;
      if (P.diffOnly && r.step && !differs) return "";
      return `<tr class="${differs ? "differs" : ""}"><th scope="row" class="rowh">${esc(r.label)}${differs ? `<span class="diffmark">differs</span>` : ""}</th>${ps.map(r.cell).join("")}</tr>`;
    }).join("");

    root.innerHTML = `
      <div class="cmp-bar">
        <button type="button" class="linkish" data-act="back">← All pipelines</button>
        <span class="mute">${ps.length} pipeline${ps.length === 1 ? "" : "s"}${ps.length > 1 ? ` · ${nDiff} row${nDiff === 1 ? "" : "s"} differ` : ""}</span>
        ${ps.length > 1 ? `<label class="toggle"><input type="checkbox" id="p-diff" ${P.diffOnly ? "checked" : ""}> only steps that differ</label>` : ""}
        <button type="button" class="linkish" data-act="copy">Copy link</button>
      </div>
      <p class="legend"><span class="st nr">not reported</span> the source is silent ·
        <span class="st none">not done</span> the source says it skips this step ·
        <span class="mute">not extracted</span> nobody has recorded this step yet</p>
      <div class="table-wrap"><table class="cmp">
        <thead><tr><th class="rowh"></th>${ps.map((p) => `<th scope="col"><div class="ctitle">${esc(pName(p))}${p.source?.year ? ` <span class="mute">${esc(p.source.year)}</span>` : ""}</div>
          <div class="dsub">${esc(dsName(p.dataset))}${p.subset?.name ? ` · ${esc(p.subset.name)}` : ""}</div>
          <button type="button" class="linkish rm" data-rm="${esc(p.id)}" aria-label="Remove ${esc(pName(p))} from comparison">remove</button></th>`).join("")}</tr></thead>
        <tbody>${body}</tbody>
      </table></div>`;
  }

  // ---------- public ----------
  function render() {
    if (!P.loaded) return;
    $("#p-compare").hidden = P.view !== "compare";
    $("#p-list-view").hidden = P.view === "compare";
    if (P.view === "compare") {
      $("#p-tray").hidden = true;
      renderCompare();
      return;
    }
    const rows = P.all.filter((p) => matches(p));
    const active = FILTERS.reduce((a, f) => a + P.sel[f.key].size, 0) + (P.q ? 1 : 0) + (P.verifiedOnly ? 1 : 0);
    $("#p-count").textContent = `${rows.length} of ${P.all.length} pipelines`;
    $("#p-clear").hidden = !active;
    renderFilters();
    renderList(rows);
  }

  function readURL(params) {
    P.q = params.get("pq") || "";
    FILTERS.forEach((f) => { P.sel[f.key].clear(); const v = params.get(`p_${f.key}`); if (v) v.split(",").forEach((x) => P.sel[f.key].add(x)); });
    P.verifiedOnly = params.get("pv") === "1";
    P.cmp = (params.get("cmp") || "").split(",").filter(Boolean);
    P.view = params.get("view") === "compare" ? "compare" : "list";
    P.diffOnly = params.get("diff") === "1";
  }

  function writeURL(params) {
    if (P.view === "compare") {
      params.set("view", "compare");
      if (P.cmp.length) params.set("cmp", P.cmp.join(","));
      if (P.diffOnly) params.set("diff", "1");
      return;
    }
    if (P.q) params.set("pq", P.q);
    FILTERS.forEach((f) => { if (P.sel[f.key].size) params.set(`p_${f.key}`, [...P.sel[f.key]].join(",")); });
    if (P.verifiedOnly) params.set("pv", "1");
    if (P.cmp.length) params.set("cmp", P.cmp.join(","));
  }

  const countFor = (datasetId) => P.all.filter((p) => p.dataset === datasetId).length;

  function showDataset(datasetId) {
    FILTERS.forEach((f) => P.sel[f.key].clear());
    P.q = "";
    $("#pq").value = "";
    P.sel.dataset.add(datasetId);
    P.view = "list";
  }

  function toggle(id) {
    P.cmp = P.cmp.includes(id) ? P.cmp.filter((x) => x !== id) : [...P.cmp, id];
    P.onChange();
  }

  function wire() {
    const q = $("#pq");
    q.value = P.q;
    let t;
    q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { P.q = q.value.trim(); P.onChange(); }, 120); });
    $("#p-verified").checked = P.verifiedOnly;
    $("#p-verified").addEventListener("change", (e) => { P.verifiedOnly = e.target.checked; P.onChange(); });
    $("#p-clear").addEventListener("click", () => {
      P.q = ""; q.value = ""; P.verifiedOnly = false; $("#p-verified").checked = false;
      FILTERS.forEach((f) => P.sel[f.key].clear());
      P.onChange();
    });

    const panel = $("#tab-pipelines");
    panel.addEventListener("click", (ev) => {
      const act = ev.target.closest("[data-act]")?.dataset.act;
      const group = ev.target.closest("[data-group]")?.dataset.group;
      const rm = ev.target.closest("[data-rm]")?.dataset.rm;
      if (act === "compare") { P.view = "compare"; P.onChange(); window.scrollTo({ top: panel.offsetTop - 12 }); }
      else if (act === "back") { P.view = "list"; P.onChange(); }
      else if (act === "clear-sel") { P.cmp = []; P.onChange(); }
      else if (act === "copy") {
        navigator.clipboard?.writeText(location.href).then(() => { ev.target.textContent = "Link copied"; });
      } else if (group) {
        P.cmp = P.all.filter((p) => p.dataset === group && matches(p)).map((p) => p.id);
        P.view = "compare";
        P.onChange();
        window.scrollTo({ top: panel.offsetTop - 12 });
      } else if (rm) { P.cmp = P.cmp.filter((x) => x !== rm); P.onChange(); }
      else {
        const tr = ev.target.closest("tr.prow");
        if (tr && !ev.target.closest("a")) toggle(tr.dataset.id);
      }
    });
    panel.addEventListener("keydown", (ev) => {
      const tr = ev.target.closest("tr.prow");
      if (tr && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); toggle(tr.dataset.id); }
    });
    panel.addEventListener("change", (ev) => {
      if (ev.target.id === "p-diff") { P.diffOnly = ev.target.checked; P.onChange(); }
    });
  }

  async function load(datasets, onChange) {
    P.datasets = datasets;
    P.onChange = onChange;
    try {
      const res = await fetch("data/pipelines.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      P.all = (await res.json()).pipelines || [];
    } catch (err) {
      P.all = [];
      P.error = "Could not load data/pipelines.json. Build the site with scripts/build.py.";
    }
    P.byId = Object.fromEntries(P.all.map((p) => [p.id, p]));
    P.cmp = P.cmp.filter((id) => P.byId[id]);
    P.loaded = true;
    wire();
  }

  window.SomnoPipelines = { load, render, readURL, writeURL, countFor, showDataset };
})();
