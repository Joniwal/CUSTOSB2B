(() => {
  "use strict";

  const page = document.body.dataset.page;
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
  const currencyNumber = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const statusColors = ["#DD7FD4", "#19A565", "#E0A126", "#4A7FC1", "#8993A5", "#B4233B"];

  const iconEdit = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
  const iconCalculator = '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 18h2M14 18h2"/></svg>';
  const iconPlus = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
  const iconEmpty = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h8M8 13h5"/></svg>';
  const iconTrash = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>';

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const parseLocaleNumber = (value) => {
    const text = String(value ?? "").replace("R$", "").replace(/\s/g, "").trim();
    if (!text) return 0;
    const normalized = text.includes(",") ? text.replaceAll(".", "").replace(",", ".") : text;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const setGapIndicator = (element, value) => {
    if (!element) return;
    const gap = Number(value || 0);
    const state = gap > 0 ? "positive" : gap < 0 ? "negative" : "neutral";
    const arrow = state === "positive" ? "↑" : state === "negative" ? "↓" : "→";
    const stateLabel = state === "positive" ? "positivo" : state === "negative" ? "negativo" : "neutro";
    [element, element.closest(".service-summary__gap")].filter(Boolean).forEach((target) => {
      target.classList.remove("is-positive", "is-negative", "is-neutral");
      target.classList.add(`is-${state}`);
    });
    element.textContent = `${arrow} ${money.format(gap)}`;
    element.setAttribute("aria-label", `GAP ${stateLabel}: ${money.format(gap)}`);
  };
  const percent = (value, total) => total ? `${Math.round((value / total) * 100)}%` : "0%";
  const debounce = (fn, wait = 280) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  function statusClass(status) {
    const value = normalize(status);
    if (value.includes("conclu")) return "success";
    if (value.includes("andamento") || value.includes("planeja")) return "warning";
    if (value.includes("cancela") || value.includes("inativ")) return "neutral";
    if (value.includes("risco") || value.includes("atras")) return "error";
    return "info";
  }

  function badge(status) {
    return `<span class="badge badge--${statusClass(status)}">${escapeHtml(status || "Sem status")}</span>`;
  }

  function shortSource(source) {
    const parts = String(source || "Excel").split("·").map((part) => part.trim());
    return parts.length > 1 ? parts.slice(1).join(" · ") : parts[0];
  }

  function setConnection(ok, source) {
    const pill = document.querySelector("#sync-pill");
    if (pill) {
      pill.classList.toggle("is-online", ok);
      pill.classList.toggle("is-error", !ok);
      const label = pill.querySelector(".sync-pill__text");
      if (label) label.textContent = ok ? "Excel conectado" : "Falha na conexão";
    }
    const sourceLabel = document.querySelector("#source-label");
    if (sourceLabel && source) {
      sourceLabel.textContent = shortSource(source);
      sourceLabel.title = source;
    }
  }

  function toast(title, message = "", error = false) {
    const region = document.querySelector("#toast-region");
    if (!region) return;
    const item = document.createElement("div");
    item.className = `toast${error ? " toast--error" : ""}`;
    item.innerHTML = `<div><strong>${escapeHtml(title)}</strong>${message ? `<span>${escapeHtml(message)}</span>` : ""}</div>`;
    region.append(item);
    setTimeout(() => item.remove(), 4200);
  }

  async function getJson(url, options = {}) {
    const response = await fetch(url, { headers: { Accept: "application/json", ...(options.headers || {}) }, ...options });
    const payload = await response.json().catch(() => ({ error: "Resposta inválida do servidor." }));
    if (!response.ok || payload.ok === false) {
      const error = new Error(payload.error || `Erro HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function setupShell() {
    const toggle = document.querySelector("[data-sidebar-toggle]");
    const close = document.querySelector("[data-sidebar-close]");
    const setOpen = (open) => {
      document.body.classList.toggle("sidebar-open", open);
      toggle?.setAttribute("aria-expanded", String(open));
    };
    toggle?.addEventListener("click", () => setOpen(!document.body.classList.contains("sidebar-open")));
    close?.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) setOpen(false);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        const search = document.querySelector("#global-search, #list-search");
        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
    });
  }

  function setupGlobalActions() {
    const refreshButton = document.querySelector("#refresh-button");
    refreshButton?.addEventListener("click", async () => {
      refreshButton.disabled = true;
      refreshButton.classList.add("is-loading");
      try {
        if (page === "dashboard") await loadDashboard();
        if (page === "activities") await loadActivities({ announce: true });
        if (page === "settings") await loadSettings();
      } finally {
        refreshButton.disabled = false;
        refreshButton.classList.remove("is-loading");
      }
    });

    document.querySelector("#shutdown-button")?.addEventListener("click", async () => {
      const confirmed = window.confirm("Encerrar o B2B CTACUSTOS neste computador? Para usar novamente, será necessário abrir o aplicativo outra vez.");
      if (!confirmed) return;
      try {
        await getJson("/api/shutdown", { method: "POST" });
        document.body.innerHTML = `
          <main class="shutdown-screen">
            <section class="shutdown-card">
              <div class="shutdown-card__icon"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v9M6.6 5.8a8 8 0 1 0 10.8 0"/></svg></div>
              <h1>Aplicativo encerrado</h1>
              <p>Você já pode fechar esta janela. Para voltar, abra o B2B CTACUSTOS novamente.</p>
            </section>
          </main>`;
      } catch (error) {
        toast("Não foi possível encerrar", error.message, true);
      }
    });
  }

  const dashboardState = {
    mode: "month",
    month: "",
    start: "",
    end: "",
    technology: "",
    data: null,
    chartMetrics: { type: "quantity", technician: "quantity", company: "quantity" },
  };

  function localIsoDate(value = new Date()) {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function setupDashboardFilters() {
    const now = new Date();
    dashboardState.month = localIsoDate(now).slice(0, 7);
    dashboardState.start = `${dashboardState.month}-01`;
    dashboardState.end = localIsoDate(now);
    document.querySelector("#period-month").value = dashboardState.month;
    document.querySelector("#period-start").value = dashboardState.start;
    document.querySelector("#period-end").value = dashboardState.end;

    const syncMode = () => {
      dashboardState.mode = document.querySelector("#period-mode").value;
      document.querySelector("#month-field").hidden = dashboardState.mode !== "month";
      document.querySelector("#start-field").hidden = dashboardState.mode !== "custom";
      document.querySelector("#end-field").hidden = dashboardState.mode !== "custom";
    };
    document.querySelector("#period-mode").addEventListener("change", syncMode);
    document.querySelector("#period-filter").addEventListener("submit", (event) => {
      event.preventDefault();
      syncMode();
      dashboardState.month = document.querySelector("#period-month").value;
      dashboardState.start = document.querySelector("#period-start").value;
      dashboardState.end = document.querySelector("#period-end").value;
      dashboardState.technology = document.querySelector("#period-technology").value;
      loadDashboard();
    });
    document.querySelectorAll("[data-chart-metric]").forEach((select) => {
      select.addEventListener("change", () => {
        dashboardState.chartMetrics[select.dataset.chartMetric] = select.value;
        renderDashboardCharts();
      });
    });
    syncMode();
  }

  async function loadDashboard() {
    try {
      const params = new URLSearchParams({ mode: dashboardState.mode });
      if (dashboardState.mode === "month") params.set("month", dashboardState.month);
      else {
        params.set("start", dashboardState.start);
        params.set("end", dashboardState.end);
      }
      if (dashboardState.technology) params.set("technology", dashboardState.technology);
      const data = await getJson(`/api/dashboard?${params}`);
      dashboardState.data = data;
      const technologySelect = document.querySelector("#period-technology");
      const technologyValues = data.filters?.technologies || [];
      technologySelect.innerHTML = '<option value="">Todas as tecnologias</option>' + technologyValues
        .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
        .join("");
      if (dashboardState.technology && !technologyValues.includes(dashboardState.technology)) {
        technologySelect.add(new Option(dashboardState.technology, dashboardState.technology));
      }
      technologySelect.value = dashboardState.technology;
      setConnection(true, data.source);
      const metrics = data.metrics;
      renderKpis(data.kpis);
      renderCategoryKpis(data.category_kpis || []);
      renderDashboardCharts();
      renderDashboardSummaries(data.charts.by_type, data.charts.by_technology);
      document.querySelector("#nav-total").textContent = metrics.total;
      const exactProgress = data.status_counts.find((item) => normalize(item.label) === "em andamento")?.value || 0;
      document.querySelector("#nav-progress").textContent = exactProgress;
      document.querySelector("#nav-complete").textContent = metrics.concluidas;
      document.querySelector("#period-activity-count").textContent = `${number.format(metrics.total)} ${metrics.total === 1 ? "atividade" : "atividades"}`;
      const formatPeriod = (start, end) => {
        const options = { day: "2-digit", month: "short", year: "numeric" };
        return `${new Date(`${start}T12:00:00`).toLocaleDateString("pt-BR", options)} – ${new Date(`${end}T12:00:00`).toLocaleDateString("pt-BR", options)}`;
      };
      document.querySelector("#period-label").textContent = formatPeriod(data.period.start, data.period.end);
      document.querySelector("#comparison-label").textContent = `Comparado com ${formatPeriod(data.period.previous_start, data.period.previous_end)}`;
      document.querySelector("#updated-at").textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    } catch (error) {
      setConnection(false);
      toast("Não foi possível carregar o dashboard", error.message, true);
      document.querySelector("#updated-at").textContent = "Dados indisponíveis";
    }
  }

  function renderKpis(items) {
    const targets = {
      custo_mo: ["#kpi-labor", "#trend-labor"],
      custo_material: ["#kpi-material", "#trend-material"],
      custo_total: ["#kpi-total", "#trend-total"],
      gap: ["#kpi-gap", "#trend-gap"],
    };
    items.forEach((item) => {
      const target = targets[item.key];
      if (!target) return;
      document.querySelector(target[0]).textContent = money.format(item.current || 0);
      const trend = document.querySelector(target[1]);
      trend.classList.remove("is-up", "is-down", "is-flat");
      if (item.change_percent === null) {
        trend.textContent = "Sem base no período anterior";
        trend.classList.add("is-flat");
      } else {
        const direction = item.delta > 0 ? "is-up" : item.delta < 0 ? "is-down" : "is-flat";
        const arrow = item.delta > 0 ? "↑" : item.delta < 0 ? "↓" : "→";
        trend.textContent = `${arrow} ${number.format(Math.abs(item.change_percent))}% vs. período anterior`;
        trend.classList.add(direction);
      }
      trend.title = `Anterior: ${money.format(item.previous || 0)}`;
    });
  }

  const categoryMetricIcons = {
    service: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14.7 6.3 3-3a4 4 0 0 1-5 5L6 15l-3 1 1-3 6.7-6.7a4 4 0 0 1 5-5l-3 3"/></svg>',
    material: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 8 8-4 8 4v8l-8 4-8-4Z"/><path d="m4 8 8 4 8-4M12 12v8"/></svg>',
    total: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3h12v18H6zM9 7h6M9 11h2M14 11h1M9 15h2M14 15h1"/></svg>',
    gap: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v18M5 6h14M7 6l-4 7h8L7 6ZM17 6l-4 7h8l-4-7ZM8 21h8"/></svg>',
  };

  function categoryTrend(trend) {
    if (!trend || trend.change_percent === null) {
      return '<span class="category-metric__trend is-flat">Sem base anterior</span>';
    }
    const direction = trend.delta > 0 ? "is-up" : trend.delta < 0 ? "is-down" : "is-flat";
    const arrow = trend.delta > 0 ? "↑" : trend.delta < 0 ? "↓" : "→";
    return `<span class="category-metric__trend ${direction}" title="Anterior: ${escapeHtml(money.format(trend.previous || 0))}">${arrow} ${escapeHtml(number.format(Math.abs(trend.change_percent)))}% vs. anterior</span>`;
  }

  function renderCategoryKpis(categories) {
    const target = document.querySelector("#category-kpi-groups");
    if (!target) return;
    if (!categories.length) {
      target.innerHTML = `<div class="empty-state">${iconEmpty}<p>Nenhuma categoria disponível.</p></div>`;
      return;
    }
    const metrics = [
      ["service", "Total Serviços"],
      ["material", "Materiais"],
      ["total", "Custo total"],
      ["gap", "GAP"],
    ];
    target.innerHTML = categories.map((category) => `
      <article class="category-kpi-group">
        <header class="category-kpi-group__header">
          <div><span>${escapeHtml(number.format(category.activity_count || 0))} atividade(s)</span><h3>${escapeHtml(category.label)}</h3></div>
          <p><strong>${escapeHtml(number.format(category.technicians || 0))} técnico(s)</strong><span>Vlr. equipe: ${escapeHtml(money.format(category.team_value || 0))}</span></p>
        </header>
        <div class="category-kpi-grid">
          ${metrics.map(([key, label]) => {
            const value = Number(category[key] || 0);
            const gapState = key === "gap" ? (value > 0 ? " is-positive" : value < 0 ? " is-negative" : " is-neutral") : "";
            const arrow = key === "gap" ? (value > 0 ? "↑ " : value < 0 ? "↓ " : "→ ") : "";
            return `<div class="category-metric category-metric--${key}${gapState}">
              <span class="category-metric__icon">${categoryMetricIcons[key]}</span>
              <div><span class="category-metric__label">${label}</span><strong>${arrow}${escapeHtml(money.format(value))}</strong>${categoryTrend(category.trends?.[key])}</div>
            </div>`;
          }).join("")}
        </div>
      </article>`).join("");
  }

  function renderDashboardCharts() {
    if (!dashboardState.data) return;
    renderRankChart("#chart-by-type", dashboardState.data.charts.by_type, dashboardState.chartMetrics.type);
    renderRankChart("#chart-by-technician", dashboardState.data.charts.by_technician, dashboardState.chartMetrics.technician);
    renderRankChart("#chart-by-company", dashboardState.data.charts.by_company, dashboardState.chartMetrics.company);
  }

  function renderRankChart(selector, items, metric) {
    const chart = document.querySelector(selector);
    const rows = (items || []).slice(0, 8);
    if (!rows.length) {
      chart.innerHTML = `<div class="empty-state">${iconEmpty}<p>Nenhum dado no período.</p></div>`;
      return;
    }
    const maximum = Math.max(1, ...rows.map((item) => Math.abs(Number(item[metric] || 0))));
    chart.innerHTML = rows.map((item, index) => {
      const value = Number(item[metric] || 0);
      const formatted = metric === "quantity" ? number.format(value) : money.format(value);
      return `<div class="rank-chart__row">
        <span class="rank-chart__index">${index + 1}</span>
        <span class="rank-chart__label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
        <span class="rank-chart__track"><span style="width:${Math.max(2, Math.abs(value) / maximum * 100)}%"></span></span>
        <strong>${escapeHtml(formatted)}</strong>
      </div>`;
    }).join("");
  }

  function renderDonut(items, total) {
    const donut = document.querySelector("#status-donut");
    const legend = document.querySelector("#status-legend");
    let cursor = 0;
    const slices = items.map((item, index) => {
      const start = cursor;
      cursor += total ? (item.value / total) * 100 : 0;
      return `${statusColors[index % statusColors.length]} ${start}% ${cursor}%`;
    });
    donut.style.background = slices.length ? `conic-gradient(${slices.join(",")})` : "#EEEAEF";
    legend.innerHTML = items.slice(0, 5).map((item, index) => `
      <li><span class="legend__swatch" style="background:${statusColors[index % statusColors.length]}"></span><span>${escapeHtml(item.label)}</span><strong>${item.value} · ${percent(item.value, total)}</strong></li>
    `).join("") || "<li>Nenhum registro disponível.</li>";
  }

  function renderFinancial(financial) {
    const chart = document.querySelector("#financial-chart");
    const rows = [
      ["Custo total", Number(financial.custo_total || 0), "#DD7FD4"],
      ["Custo evitado", Number(financial.custo_evitado || 0), "#19A565"],
      ["GAP", Number(financial.gap || 0), Number(financial.gap || 0) >= 0 ? "#4A7FC1" : "#B4233B"],
    ];
    const max = Math.max(1, ...rows.map((row) => Math.abs(row[1])));
    chart.innerHTML = rows.map(([label, value, color]) => `
      <div class="bar-chart__item">
        <span class="bar-chart__value" title="${money.format(value)}">${money.format(value)}</span>
        <div class="bar-chart__track"><div class="bar-chart__bar" style="height:${Math.max(3, Math.abs(value) / max * 100)}%;--bar-color:${color}"></div></div>
        <span class="bar-chart__label">${label}</span>
      </div>
    `).join("");
  }

  function renderRecent(items) {
    const body = document.querySelector("#recent-table");
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="5"><div class="empty-state">${iconEmpty}<p>Nenhuma atividade cadastrada.</p></div></td></tr>`;
      return;
    }
    body.innerHTML = items.map((item) => `
      <tr>
        <td><span class="cell-id">${escapeHtml(item.id)}</span></td>
        <td><span class="cell-primary">${escapeHtml(item.tipo_atividade)}</span><small class="cell-secondary">${escapeHtml(item.material_utilizado || "Sem material informado")}</small></td>
        <td>${badge(item.status)}</td>
        <td><span class="cell-situation">${escapeHtml(item.situacao)}</span></td>
        <td><span class="cell-primary">${money.format(item.custo_total || 0)}</span></td>
      </tr>
    `).join("");
  }

  function renderDashboardSummaries(byType, byTechnology) {
    renderSummaryTable("#summary-by-type", byType, "tipo de atividade");
    renderSummaryTable("#summary-by-technology", byTechnology, "tecnologia");
  }

  function renderSummaryTable(selector, items, label) {
    const body = document.querySelector(selector);
    const rows = [...(items || [])].sort((left, right) => {
      const laborDifference = Math.abs(Number(right.labor || 0)) - Math.abs(Number(left.labor || 0));
      return laborDifference || String(left.label).localeCompare(String(right.label), "pt-BR");
    });
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="3"><div class="summary-empty">Nenhum total por ${escapeHtml(label)} no período.</div></td></tr>`;
      return;
    }
    body.innerHTML = rows.map((item) => {
      const gap = Number(item.gap || 0);
      const gapClass = gap > 0 ? "is-positive" : gap < 0 ? "is-negative" : "is-neutral";
      const gapArrow = gap > 0 ? "↑" : gap < 0 ? "↓" : "→";
      return `<tr>
        <td><span class="cell-primary">${escapeHtml(item.label)}</span><small class="cell-secondary">${number.format(item.quantity || 0)} atividade(s)</small></td>
        <td class="summary-money">${escapeHtml(money.format(Number(item.labor || 0)))}</td>
        <td><span class="summary-gap ${gapClass}">${gapArrow} ${escapeHtml(money.format(gap))}</span></td>
      </tr>`;
    }).join("");
  }

  function renderTypes(items) {
    const list = document.querySelector("#type-list");
    list.innerHTML = items.slice(0, 5).map((item) => `
      <li>
        <span class="category-list__icon">${escapeHtml(String(item.label).slice(0, 2).toUpperCase())}</span>
        <span><strong>${escapeHtml(item.label)}</strong><small>${item.value === 1 ? "1 atividade" : `${item.value} atividades`}</small></span>
        <span class="category-list__count">${item.value}</span>
      </li>
    `).join("") || `<li><span>Nenhuma categoria disponível.</span></li>`;
  }

  const listState = {
    items: [], page: 1, pages: 1, perPage: 5, total: 0,
    q: "", status: "", type: "", technology: "", sort: "id", direction: "asc", selectedKey: null,
    filtersLoaded: false, options: {}, calculationMode: "direct_costs", creationOpened: false,
  };

  const activityKey = (item) => String(item?.record_key || item?.id || "");

  function queryFromLocation() {
    const params = new URLSearchParams(location.search);
    listState.q = params.get("q") || "";
    listState.status = params.get("status") || "";
    listState.type = params.get("type") || "";
    listState.technology = params.get("technology") || "";
    document.querySelector("#list-search").value = listState.q;
  }

  async function loadActivities({ announce = false } = {}) {
    const params = new URLSearchParams({
      q: listState.q, status: listState.status, type: listState.type, technology: listState.technology,
      sort: listState.sort, direction: listState.direction,
      page: String(listState.page), per_page: String(listState.perPage),
    });
    try {
      const data = await getJson(`/api/activities?${params}`);
      setConnection(true, data.source);
      listState.items = data.items;
      Object.assign(listState, data.pagination);
      listState.options = data.filters;
      listState.calculationMode = data.items[0]?.calculation_mode || listState.calculationMode;
      if (!listState.filtersLoaded) {
        populateFilter("#status-filter", data.filters.statuses, listState.status);
        populateFilter("#type-filter", data.filters.types, listState.type);
        populateFilter("#technology-filter", data.filters.technologies, listState.technology);
        populateFormOptions(data.filters);
        listState.filtersLoaded = true;
      }
      renderActivities();
      renderPagination();
      document.querySelector("#nav-total").textContent = data.pagination.total;
      document.querySelector("#result-count").textContent = `${data.pagination.total} ${data.pagination.total === 1 ? "resultado" : "resultados"}`;
      if (announce) toast("Lista atualizada", `${data.pagination.total} registros encontrados.`);
      if (!listState.creationOpened && new URLSearchParams(location.search).get("action") === "new") {
        listState.creationOpened = true;
        openCreate();
      }
    } catch (error) {
      setConnection(false);
      document.querySelector("#activities-body").innerHTML = `<tr><td colspan="7"><div class="empty-state">${iconEmpty}<p>${escapeHtml(error.message)}</p></div></td></tr>`;
      toast("Falha ao carregar atividades", error.message, true);
    }
  }

  function populateFilter(selector, values, selected) {
    const select = document.querySelector(selector);
    const first = select.options[0].outerHTML;
    select.innerHTML = first + values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
    select.value = selected;
  }

  function renderActivities() {
    const body = document.querySelector("#activities-body");
    if (!listState.items.length) {
      body.innerHTML = `<tr><td colspan="7"><div class="empty-state">${iconEmpty}<p>Nenhuma atividade corresponde aos filtros.</p></div></td></tr>`;
      return;
    }
    body.innerHTML = listState.items.map((item) => {
      const key = activityKey(item);
      const selected = key === String(listState.selectedKey || "");
      const disabled = statusClass(item.status) === "neutral";
      return `
        <tr class="${selected ? "row--selected" : ""} ${disabled ? "row--disabled" : ""}" data-row-key="${escapeHtml(key)}" aria-selected="${selected}">
          <td data-label="Custos" class="calculator-cell"><button class="icon-button calculator-button" type="button" data-service-calculator="${escapeHtml(key)}" aria-label="Calcular materiais e serviços da atividade ${escapeHtml(item.id)}" title="Calcular materiais e serviços">${iconCalculator}</button></td>
          <td data-label="ID"><span class="cell-id">${escapeHtml(item.id)}</span></td>
          <td data-label="Tipo de Atividade"><span class="cell-primary">${escapeHtml(item.tipo_atividade)}</span><small class="cell-secondary">${escapeHtml(item.material_utilizado || item.servico_mo || "Sem detalhe adicional")}</small></td>
          <td data-label="Status">${badge(item.status)}</td>
          <td data-label="Situação"><span class="cell-situation">${escapeHtml(item.situacao)}</span></td>
          <td data-label="Ações" class="actions-cell"><button class="icon-button edit-button" type="button" data-edit-key="${escapeHtml(key)}" aria-label="Editar atividade ${escapeHtml(item.id)}" title="Editar">${iconEdit}</button></td>
          <td data-label="DRAFT"><span class="cell-primary">${escapeHtml(item.draft || "—")}</span></td>
        </tr>`;
    }).join("");

    body.querySelectorAll("[data-row-key]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        selectRow(row.dataset.rowKey);
      });
    });
    body.querySelectorAll("[data-edit-key]").forEach((button) => button.addEventListener("click", () => openEdit(button.dataset.editKey)));
    body.querySelectorAll("[data-service-calculator]").forEach((button) => button.addEventListener("click", () => openServiceCalculator(button.dataset.serviceCalculator)));
  }

  function selectRow(key) {
    listState.selectedKey = String(listState.selectedKey) === String(key) ? null : key;
    const bar = document.querySelector("#selection-bar");
    const activity = listState.items.find((item) => activityKey(item) === String(listState.selectedKey || ""));
    bar.hidden = !activity;
    document.querySelector("#selected-id").textContent = activity ? `Atividade ${activity.id}` : "";
    renderActivities();
  }

  function renderPagination() {
    const start = listState.total ? (listState.page - 1) * listState.perPage + 1 : 0;
    const end = Math.min(listState.page * listState.perPage, listState.total);
    document.querySelector("#pagination-summary").textContent = `Exibindo ${start}–${end} de ${listState.total}`;
    document.querySelector("#previous-page").disabled = listState.page <= 1;
    document.querySelector("#next-page").disabled = listState.page >= listState.pages;
    const pages = pageWindow(listState.page, listState.pages);
    document.querySelector("#page-buttons").innerHTML = pages.map((pageNumber) => pageNumber === "…"
      ? `<span class="page-button" aria-hidden="true">…</span>`
      : `<button class="page-button ${pageNumber === listState.page ? "is-current" : ""}" type="button" data-page-number="${pageNumber}" ${pageNumber === listState.page ? 'aria-current="page"' : ""}>${pageNumber}</button>`
    ).join("");
    document.querySelectorAll("#page-buttons [data-page-number]").forEach((button) => button.addEventListener("click", () => goPage(Number(button.dataset.pageNumber))));
  }

  function pageWindow(current, total) {
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    const candidates = new Set([1, total, current - 1, current, current + 1].filter((value) => value >= 1 && value <= total));
    const result = [];
    [...candidates].sort((a, b) => a - b).forEach((value, index, sorted) => {
      if (index && value - sorted[index - 1] > 1) result.push("…");
      result.push(value);
    });
    return result;
  }

  function goPage(pageNumber) {
    listState.page = Math.min(Math.max(1, pageNumber), listState.pages);
    loadActivities();
    document.querySelector("#activities-table").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setupListControls() {
    const search = document.querySelector("#list-search");
    search.addEventListener("input", debounce(() => {
      listState.q = search.value.trim();
      listState.page = 1;
      loadActivities();
    }));
    document.querySelector("#status-filter").addEventListener("change", (event) => {
      listState.status = event.target.value; listState.page = 1; loadActivities();
    });
    document.querySelector("#type-filter").addEventListener("change", (event) => {
      listState.type = event.target.value; listState.page = 1; loadActivities();
    });
    document.querySelector("#technology-filter").addEventListener("change", (event) => {
      listState.technology = event.target.value; listState.page = 1; loadActivities();
    });
    document.querySelector("#clear-filters").addEventListener("click", () => {
      listState.q = ""; listState.status = ""; listState.type = ""; listState.technology = ""; listState.page = 1;
      search.value = "";
      document.querySelector("#status-filter").value = "";
      document.querySelector("#type-filter").value = "";
      document.querySelector("#technology-filter").value = "";
      history.replaceState(null, "", "/atividades");
      loadActivities({ announce: true });
    });
    document.querySelector("#previous-page").addEventListener("click", () => goPage(listState.page - 1));
    document.querySelector("#next-page").addEventListener("click", () => goPage(listState.page + 1));
    document.querySelector("#create-button").addEventListener("click", openCreate);
    document.querySelectorAll("[data-sort]").forEach((button) => button.addEventListener("click", () => {
      const key = button.dataset.sort;
      listState.direction = listState.sort === key && listState.direction === "asc" ? "desc" : "asc";
      listState.sort = key;
      listState.page = 1;
      document.querySelectorAll("#activities-table th[aria-sort]").forEach((th) => th.setAttribute("aria-sort", "none"));
      button.closest("th").setAttribute("aria-sort", listState.direction === "asc" ? "ascending" : "descending");
      loadActivities();
    }));
    document.querySelector("#edit-selected").addEventListener("click", () => openEdit(listState.selectedKey));
  }

  let editingActivity = null;

  const activityFields = [
    "id", "data", "tipo_atividade", "status", "situacao", "empresa", "eps",
    "tecnico_nome", "matricula", "regiao", "cluster", "tecnologia",
    "custo_mo", "custo_mat", "custo_evitado", "draft",
  ];

  function populateFormOptions(options) {
    const setOptions = (selector, values, placeholder = "Selecione") => {
      const select = document.querySelector(selector);
      if (!select) return;
      select.innerHTML = `<option value="">${placeholder}</option>` + (values || []).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
    };
    setOptions("#form-status", options.statuses);
    setOptions("#form-company", options.companies);
    setOptions("#form-eps", options.eps);
    const technology = document.querySelector("#form-technology");
    technology.innerHTML = '<option value="">Selecione</option>' + (options.technology_rates || []).map((item) => (
      `<option value="${escapeHtml(item.name)}"${item.configured === false ? "" : ` data-service-cost="${escapeHtml(Number(item.service_cost || 0))}"`}>${escapeHtml(item.name)} · ${item.configured === false ? "valor não configurado" : escapeHtml(money.format(Number(item.service_cost || 0)))}</option>`
    )).join("");
    const technician = document.querySelector("#form-technician");
    technician.innerHTML = '<option value="">Selecione</option>' + (options.technicians || []).map((item) => `<option value="${escapeHtml(item.name)}" data-registration="${escapeHtml(item.registration)}">${escapeHtml(item.name)}${item.registration ? ` · ${escapeHtml(item.registration)}` : ""}</option>`).join("");
    const fillDatalist = (selector, values) => {
      const list = document.querySelector(selector);
      if (list) list.innerHTML = (values || []).map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
    };
    fillDatalist("#type-options", options.types);
    fillDatalist("#region-options", options.regions);
    fillDatalist("#cluster-options", options.clusters);
  }

  function ensureSelectValue(select, value) {
    if (!select || !value) return;
    if (![...select.options].some((option) => option.value === String(value))) {
      select.add(new Option(String(value), String(value)));
    }
    select.value = String(value);
  }

  function openCreate() {
    const form = document.querySelector("#edit-form");
    form.reset();
    editingActivity = { _new: true, calculation_mode: listState.calculationMode };
    document.querySelector("#create-id-field").hidden = false;
    form.elements.data.value = localIsoDate();
    document.querySelector("#modal-eyebrow").textContent = "Inclusão na planilha";
    document.querySelector("#modal-title").childNodes[0].textContent = "Incluir atividade ";
    document.querySelector("#modal-activity-id").textContent = "";
    document.querySelector("#save-button").textContent = "Incluir atividade";
    document.querySelector("#save-status").textContent = "";
    formatCurrencyFields();
    recalculate();
    showActivityModal();
  }

  function openEdit(reference) {
    const activity = listState.items.find((item) => activityKey(item) === String(reference));
    if (!activity) return;
    editingActivity = activity;
    const form = document.querySelector("#edit-form");
    form.reset();
    document.querySelector("#create-id-field").hidden = true;
    document.querySelector("#modal-eyebrow").textContent = "Edição da planilha";
    document.querySelector("#modal-title").childNodes[0].textContent = "Editar atividade ";
    document.querySelector("#modal-activity-id").textContent = `#${activity.id}`;
    document.querySelector("#save-button").textContent = "Salvar alterações";
    activityFields.forEach((field) => {
      if (!form.elements[field] || field === "id") return;
      if (form.elements[field].tagName === "SELECT") ensureSelectValue(form.elements[field], activity[field]);
      else form.elements[field].value = activity[field] ?? "";
    });
    applyTechnologyServiceCost();
    document.querySelector("#save-status").textContent = "";
    formatCurrencyFields();
    recalculate();
    showActivityModal();
  }

  function showActivityModal() {
    const modal = document.querySelector("#edit-modal");
    if (typeof modal.showModal === "function") modal.showModal(); else modal.setAttribute("open", "");
    setTimeout(() => document.querySelector("#edit-form").elements.tipo_atividade.focus(), 50);
  }

  function closeModal() {
    const modal = document.querySelector("#edit-modal");
    if (typeof modal.close === "function") modal.close(); else modal.removeAttribute("open");
    editingActivity = null;
  }

  function formNumber(name) {
    const field = document.querySelector("#edit-form").elements[name];
    return parseLocaleNumber(field?.value);
  }

  function formatCurrencyFields() {
    document.querySelectorAll("#edit-form [data-currency-input]").forEach((input) => {
      input.value = currencyNumber.format(parseLocaleNumber(input.value));
    });
  }

  function recalculate() {
    const material = formNumber("custo_mat");
    const labor = formNumber("custo_mo");
    const total = material + labor;
    document.querySelector("#calc-total").value = money.format(total);
    document.querySelector("#calc-total").textContent = money.format(total);
    document.querySelector("#calc-avoided").value = money.format(labor);
    document.querySelector("#calc-avoided").textContent = money.format(labor);
    document.querySelector("#edit-form").elements.custo_evitado.value = labor.toFixed(2);
    const gap = document.querySelector("#calc-gap");
    gap.classList.remove("is-positive", "is-negative");
    gap.classList.add("is-neutral");
    gap.textContent = "Por categoria";
    gap.setAttribute("aria-label", "GAP calculado por categoria no Dashboard");
    document.querySelector("#calc-gap-detail").textContent = "Serviços menos o valor mensal da equipe configurada.";
  }

  function applyTechnologyServiceCost() {
    const technology = document.querySelector("#form-technology");
    const selected = technology?.selectedOptions?.[0];
    if (!selected || !technology.value || selected.dataset.serviceCost === undefined) return;
    const labor = document.querySelector("#edit-form").elements.custo_mo;
    labor.value = currencyNumber.format(Number(selected.dataset.serviceCost || 0));
    recalculate();
  }

  function setupModal() {
    const form = document.querySelector("#edit-form");
    form.querySelectorAll("input[type=number]").forEach((input) => input.addEventListener("input", recalculate));
    form.querySelectorAll("[data-currency-input]").forEach((input) => {
      input.addEventListener("input", recalculate);
      input.addEventListener("blur", () => {
        input.value = currencyNumber.format(parseLocaleNumber(input.value));
        recalculate();
      });
      input.addEventListener("focus", () => input.select());
    });
    document.querySelector("#form-technician").addEventListener("change", (event) => {
      const option = event.target.selectedOptions[0];
      if (option?.dataset.registration) document.querySelector("#form-registration").value = option.dataset.registration;
    });
    document.querySelector("#form-technology").addEventListener("change", applyTechnologyServiceCost);
    document.querySelectorAll("[data-modal-close]").forEach((button) => button.addEventListener("click", closeModal));
    document.querySelector("#edit-modal").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
    document.querySelector("#edit-modal").addEventListener("cancel", () => {
      editingActivity = null;
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!editingActivity || !form.reportValidity()) return;
      const saveButton = document.querySelector("#save-button");
      const saveStatus = document.querySelector("#save-status");
      const payload = Object.fromEntries(new FormData(form));
      saveButton.disabled = true;
      saveButton.textContent = "Salvando…";
      saveStatus.textContent = "Atualizando a planilha…";
      try {
        const creating = Boolean(editingActivity._new);
        const savedReference = editingActivity.record_key || editingActivity.id;
        const response = await getJson(creating ? "/api/activities" : `/api/activities/${encodeURIComponent(savedReference)}`, {
          method: creating ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        closeModal();
        toast(creating ? "Atividade incluída" : "Atividade salva", `O registro ${response.activity.id} foi ${creating ? "incluído" : "atualizado"} no Excel.`);
        listState.selectedKey = null;
        listState.filtersLoaded = false;
        document.querySelector("#selection-bar").hidden = true;
        await loadActivities();
      } catch (error) {
        saveStatus.textContent = error.message;
        toast("Não foi possível salvar", error.message, true);
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = editingActivity?._new ? "Incluir atividade" : "Salvar alterações";
      }
    });
  }

  const serviceCalculatorState = {
    activity: null,
    activeTab: "materials",
    materials: [],
    selectedMaterials: [],
    materialSource: "",
    materialQuery: "",
    materialsChanged: false,
    materialsError: "",
    services: [],
    selected: [],
    source: "",
    query: "",
    standardLaborCost: 0,
    standardDailyRate: 0,
    technicians: 0,
    days: 0,
  };

  function showServiceCalculator() {
    const modal = document.querySelector("#service-calculator-modal");
    if (typeof modal.showModal === "function") modal.showModal(); else modal.setAttribute("open", "");
  }

  function closeServiceCalculator() {
    const modal = document.querySelector("#service-calculator-modal");
    if (typeof modal.close === "function") modal.close(); else modal.removeAttribute("open");
    serviceCalculatorState.activity = null;
  }

  function selectedMaterialTotal() {
    return serviceCalculatorState.selectedMaterials.reduce((sum, item) => {
      const quantity = Number(item.quantity || 0);
      return sum + Number(item.unit_price || 0) * (Number.isFinite(quantity) ? quantity : 0);
    }, 0);
  }

  function materialTotal() {
    if (serviceCalculatorState.materialsChanged || serviceCalculatorState.selectedMaterials.length) {
      return selectedMaterialTotal();
    }
    return Number(serviceCalculatorState.activity?.custo_mat || 0);
  }

  function serviceTotal() {
    const selectedTotal = serviceCalculatorState.selected.reduce((sum, item) => {
      const quantity = Number(item.quantity || 0);
      return sum + Number(item.unit_price || 0) * (Number.isFinite(quantity) ? quantity : 0);
    }, 0);
    return serviceCalculatorState.selected.length ? selectedTotal : serviceCalculatorState.standardLaborCost;
  }

  function syncServiceTotals() {
    serviceCalculatorState.standardLaborCost = serviceCalculatorState.standardDailyRate
      * Number(serviceCalculatorState.technicians || 0)
      * Number(serviceCalculatorState.days || 0);
    const total = serviceTotal();
    const materials = materialTotal();
    const gap = total - serviceCalculatorState.standardLaborCost;
    const count = serviceCalculatorState.selected.length;
    document.querySelector("#service-total").textContent = money.format(total);
    document.querySelector("#material-total").textContent = money.format(materials);
    document.querySelector("#service-material-total").textContent = money.format(materials);
    document.querySelector("#service-grand-total").textContent = money.format(total + materials);
    document.querySelector("#materials-tab-total").textContent = money.format(materials);
    document.querySelector("#services-tab-total").textContent = money.format(total);
    document.querySelector("#material-summary-count").textContent = number.format(serviceCalculatorState.selectedMaterials.length);
    document.querySelector("#service-summary-count").textContent = number.format(count);
    document.querySelector("#service-standard-total").textContent = money.format(serviceCalculatorState.standardLaborCost);
    document.querySelector("#service-standard-detail").textContent = `${money.format(serviceCalculatorState.standardDailyRate)} × ${number.format(serviceCalculatorState.technicians || 0)} técnico(s) × ${number.format(serviceCalculatorState.days || 0)} dia(s)`;
    setGapIndicator(document.querySelector("#service-gap"), gap);
    document.querySelector("#service-gap-detail").textContent = `${money.format(total)} − ${money.format(serviceCalculatorState.standardLaborCost)}`;
    document.querySelector("#selected-services-count").textContent = count === 0
      ? "Nenhum serviço · custo padrão ativo"
      : count === 1 ? "1 serviço" : `${count} serviços`;
    document.querySelector("#clear-selected-services").disabled = count === 0;
    const materialCount = serviceCalculatorState.selectedMaterials.length;
    document.querySelector("#selected-materials-count").textContent = materialCount === 0
      ? (materials > 0 && !serviceCalculatorState.materialsChanged ? "Valor atual preservado" : "Nenhum material")
      : materialCount === 1 ? "1 material" : `${materialCount} materiais`;
    document.querySelector("#clear-selected-materials").disabled = materialCount === 0
      && (serviceCalculatorState.materialsChanged || materials <= 0);
    const invalidQuantity = serviceCalculatorState.selected.some((item) => {
      const quantity = Number(item.quantity);
      return !Number.isInteger(quantity) || quantity <= 0;
    });
    const invalidDrivers = !Number.isInteger(Number(serviceCalculatorState.technicians))
      || Number(serviceCalculatorState.technicians) <= 0
      || !Number.isInteger(Number(serviceCalculatorState.days))
      || Number(serviceCalculatorState.days) <= 0;
    const invalidMaterialQuantity = serviceCalculatorState.selectedMaterials.some((item) => {
      const quantity = Number(item.quantity);
      return !Number.isFinite(quantity) || quantity <= 0;
    });
    document.querySelector("#calculator-next").disabled = !serviceCalculatorState.activity || invalidMaterialQuantity;
    document.querySelector("#save-service-calculation").disabled = !serviceCalculatorState.activity || invalidQuantity || invalidMaterialQuantity || invalidDrivers;
    document.querySelectorAll("[data-selected-service]").forEach((row) => {
      const item = serviceCalculatorState.selected.find((selected) => selected.key === row.dataset.selectedService);
      const subtotal = row.querySelector("[data-service-subtotal]");
      if (item && subtotal) subtotal.textContent = money.format(Number(item.unit_price || 0) * Number(item.quantity || 0));
    });
    document.querySelectorAll("[data-selected-material]").forEach((row) => {
      const item = serviceCalculatorState.selectedMaterials.find((selected) => selected.key === row.dataset.selectedMaterial);
      const subtotal = row.querySelector("[data-material-subtotal]");
      if (item && subtotal) subtotal.textContent = money.format(Number(item.unit_price || 0) * Number(item.quantity || 0));
    });
  }

  function setCalculatorTab(tab, focus = true) {
    serviceCalculatorState.activeTab = tab === "services" ? "services" : "materials";
    const isMaterials = serviceCalculatorState.activeTab === "materials";
    document.querySelector("#materials-panel").hidden = !isMaterials;
    document.querySelector("#services-panel").hidden = isMaterials;
    document.querySelector("#materials-tab").classList.toggle("is-active", isMaterials);
    document.querySelector("#services-tab").classList.toggle("is-active", !isMaterials);
    document.querySelector("#materials-tab").setAttribute("aria-selected", String(isMaterials));
    document.querySelector("#services-tab").setAttribute("aria-selected", String(!isMaterials));
    document.querySelector("#calculator-next").hidden = !isMaterials;
    document.querySelector("#calculator-back").hidden = isMaterials;
    document.querySelector("#save-service-calculation").hidden = isMaterials;
    const source = isMaterials
      ? serviceCalculatorState.materialSource || "Carregando catálogo de materiais…"
      : serviceCalculatorState.source || "Carregando catálogo de serviços…";
    document.querySelector("#service-source").textContent = `Base: ${source}`;
    syncServiceTotals();
    if (focus) setTimeout(() => document.querySelector(isMaterials ? "#material-search" : "#service-search")?.focus(), 30);
  }

  function renderMaterialCatalog() {
    const list = document.querySelector("#material-catalog-list");
    const query = normalize(serviceCalculatorState.materialQuery);
    const filtered = serviceCalculatorState.materials.filter((item) => {
      const haystack = normalize(`${item.code || ""} ${item.description || ""} ${item.unit || ""}`);
      return !query || haystack.includes(query);
    });
    document.querySelector("#material-catalog-count").textContent = `${filtered.length} de ${serviceCalculatorState.materials.length} materiais`;
    if (!filtered.length) {
      const message = serviceCalculatorState.materialsError || "Nenhum material encontrado na planilha.";
      list.innerHTML = `<div class="service-loading${serviceCalculatorState.materialsError ? " service-loading--error" : ""}">${iconEmpty}<p>${escapeHtml(message)}</p></div>`;
      return;
    }
    const selectedKeys = new Set(serviceCalculatorState.selectedMaterials.map((item) => item.key));
    list.innerHTML = filtered.map((item) => `
      <article class="service-catalog-item${selectedKeys.has(item.key) ? " is-selected" : ""}">
        <div><strong>${escapeHtml(item.description)}</strong><span>${item.code ? `Cód. ${escapeHtml(item.code)} · ` : ""}${escapeHtml(item.unit || "Sem unidade")}</span></div>
        <div class="service-catalog-item__action"><span>${escapeHtml(money.format(Number(item.unit_price || 0)))}</span><button class="icon-button service-add-button" type="button" data-material-add="${escapeHtml(item.key)}" aria-label="Adicionar ${escapeHtml(item.description)}" title="Adicionar material">${iconPlus}</button></div>
      </article>`).join("");
  }

  function renderSelectedMaterials() {
    const list = document.querySelector("#selected-materials-list");
    const empty = document.querySelector("#selected-materials-empty");
    const hasItems = serviceCalculatorState.selectedMaterials.length > 0;
    empty.hidden = hasItems;
    list.hidden = !hasItems;
    list.innerHTML = serviceCalculatorState.selectedMaterials.map((item) => `
      <div class="selected-service-row" role="row" data-selected-material="${escapeHtml(item.key)}">
        <div class="selected-service-description" role="cell"><strong>${escapeHtml(item.description)}</strong><span>${escapeHtml(item.unit || "Sem unidade")}${item.code ? ` · ${escapeHtml(item.code)}` : ""}</span></div>
        <span class="selected-service-price" role="cell">${escapeHtml(money.format(Number(item.unit_price || 0)))}</span>
        <label class="selected-service-quantity" role="cell"><span class="sr-only">Quantidade de ${escapeHtml(item.description)}</span><input type="number" min="0.0001" max="1000000000" step="0.0001" inputmode="decimal" value="${escapeHtml(Number(item.quantity || 0))}" data-material-quantity="${escapeHtml(item.key)}" required></label>
        <strong class="selected-service-subtotal" role="cell" data-material-subtotal>${escapeHtml(money.format(Number(item.unit_price || 0) * Number(item.quantity || 0)))}</strong>
        <div class="selected-service-remove-cell" role="cell"><button class="icon-button selected-service-remove" type="button" data-material-remove="${escapeHtml(item.key)}" aria-label="Excluir ${escapeHtml(item.description)} do cálculo" title="Excluir material">${iconTrash}</button></div>
      </div>`).join("");
    syncServiceTotals();
  }

  function addMaterial(materialKey) {
    const existing = serviceCalculatorState.selectedMaterials.find((item) => item.key === materialKey);
    if (existing) existing.quantity = Number(existing.quantity || 0) + 1;
    else {
      const material = serviceCalculatorState.materials.find((item) => item.key === materialKey);
      if (!material) return;
      serviceCalculatorState.selectedMaterials.push({ ...material, quantity: 1, subtotal: Number(material.unit_price || 0) });
    }
    serviceCalculatorState.materialsChanged = true;
    document.querySelector("#service-calculator-status").textContent = "";
    renderMaterialCatalog();
    renderSelectedMaterials();
  }

  function renderServiceCatalog() {
    const list = document.querySelector("#service-catalog-list");
    const query = normalize(serviceCalculatorState.query);
    const filtered = serviceCalculatorState.services.filter((item) => {
      const haystack = normalize(`${item.code || ""} ${item.description || ""} ${item.unit || ""}`);
      return !query || haystack.includes(query);
    });
    document.querySelector("#service-catalog-count").textContent = `${filtered.length} de ${serviceCalculatorState.services.length} serviços`;
    if (!filtered.length) {
      list.innerHTML = `<div class="service-loading">${iconEmpty}<p>Nenhum serviço encontrado.</p></div>`;
      return;
    }
    const selectedKeys = new Set(serviceCalculatorState.selected.map((item) => item.key));
    list.innerHTML = filtered.map((item) => `
      <article class="service-catalog-item${selectedKeys.has(item.key) ? " is-selected" : ""}">
        <div>
          <strong>${escapeHtml(item.description)}</strong>
          <span>${item.code ? `Cód. ${escapeHtml(item.code)} · ` : ""}${escapeHtml(item.unit || "Sem unidade")}</span>
        </div>
        <div class="service-catalog-item__action">
          <span>${escapeHtml(money.format(Number(item.unit_price || 0)))}</span>
          <button class="icon-button service-add-button" type="button" data-service-add="${escapeHtml(item.key)}" aria-label="Adicionar ${escapeHtml(item.description)}" title="Adicionar serviço">${iconPlus}</button>
        </div>
      </article>`).join("");
  }

  function renderSelectedServices() {
    const list = document.querySelector("#selected-services-list");
    const empty = document.querySelector("#selected-services-empty");
    const hasItems = serviceCalculatorState.selected.length > 0;
    empty.hidden = hasItems;
    list.hidden = !hasItems;
    list.innerHTML = serviceCalculatorState.selected.map((item) => `
      <div class="selected-service-row" role="row" data-selected-service="${escapeHtml(item.key)}">
        <div class="selected-service-description" role="cell"><strong>${escapeHtml(item.description)}</strong><span>${escapeHtml(item.unit || "Sem unidade")}${item.code ? ` · ${escapeHtml(item.code)}` : ""}</span></div>
        <span class="selected-service-price" role="cell">${escapeHtml(money.format(Number(item.unit_price || 0)))}</span>
        <label class="selected-service-quantity" role="cell"><span class="sr-only">Quantidade inteira de ${escapeHtml(item.description)}</span><input type="number" min="1" max="1000000000" step="1" inputmode="numeric" value="${escapeHtml(item.quantity)}" data-service-quantity="${escapeHtml(item.key)}" required></label>
        <strong class="selected-service-subtotal" role="cell" data-service-subtotal>${escapeHtml(money.format(Number(item.unit_price || 0) * Number(item.quantity || 0)))}</strong>
        <div class="selected-service-remove-cell" role="cell"><button class="icon-button selected-service-remove" type="button" data-service-remove="${escapeHtml(item.key)}" aria-label="Excluir ${escapeHtml(item.description)} do cálculo" title="Excluir serviço">${iconTrash}</button></div>
      </div>`).join("");
    syncServiceTotals();
  }

  function addService(serviceKey) {
    const existing = serviceCalculatorState.selected.find((item) => item.key === serviceKey);
    if (existing) {
      existing.quantity = Number(existing.quantity || 0) + 1;
    } else {
      const service = serviceCalculatorState.services.find((item) => item.key === serviceKey);
      if (!service) return;
      serviceCalculatorState.selected.push({ ...service, quantity: 1, subtotal: Number(service.unit_price || 0) });
    }
    document.querySelector("#service-calculator-status").textContent = "";
    renderServiceCatalog();
    renderSelectedServices();
  }

  async function openServiceCalculator(reference) {
    serviceCalculatorState.activity = null;
    serviceCalculatorState.activeTab = "materials";
    serviceCalculatorState.materials = [];
    serviceCalculatorState.selectedMaterials = [];
    serviceCalculatorState.materialSource = "";
    serviceCalculatorState.materialQuery = "";
    serviceCalculatorState.materialsChanged = false;
    serviceCalculatorState.materialsError = "";
    serviceCalculatorState.services = [];
    serviceCalculatorState.selected = [];
    serviceCalculatorState.query = "";
    serviceCalculatorState.standardLaborCost = 0;
    serviceCalculatorState.standardDailyRate = 0;
    serviceCalculatorState.technicians = 0;
    serviceCalculatorState.days = 0;
    document.querySelector("#material-search").value = "";
    document.querySelector("#service-search").value = "";
    document.querySelector("#service-calculator-id").textContent = "";
    document.querySelector("#service-summary-id").textContent = "—";
    document.querySelector("#material-summary-id").textContent = "—";
    document.querySelector("#service-current-total").textContent = money.format(0);
    document.querySelector("#service-standard-total").textContent = money.format(0);
    document.querySelector("#service-standard-detail").textContent = "Aguardando dados da atividade";
    document.querySelector("#service-technicians").value = "";
    document.querySelector("#service-days").value = "";
    document.querySelector("#service-source").textContent = "Carregando bases de materiais e serviços…";
    document.querySelector("#service-calculator-status").textContent = "";
    document.querySelector("#service-catalog-count").textContent = "—";
    document.querySelector("#material-catalog-count").textContent = "—";
    document.querySelector("#service-catalog-list").innerHTML = '<div class="service-loading"><div class="spinner" aria-hidden="true"></div><p>Lendo SERVICOS.xlsx…</p></div>';
    document.querySelector("#material-catalog-list").innerHTML = '<div class="service-loading"><div class="spinner" aria-hidden="true"></div><p>Lendo MATERIAL.xlsx…</p></div>';
    renderSelectedMaterials();
    renderSelectedServices();
    showServiceCalculator();
    setCalculatorTab("materials", false);

    try {
      const data = await getJson(`/api/service-calculation?activity=${encodeURIComponent(reference)}`);
      serviceCalculatorState.activity = data.activity;
      serviceCalculatorState.materials = data.materials || [];
      serviceCalculatorState.selectedMaterials = (data.selected_materials || []).map((item) => ({
        ...item,
        quantity: Number(item.quantity || 1),
      }));
      serviceCalculatorState.materialSource = data.material_source || "MATERIAL.xlsx";
      serviceCalculatorState.materialsError = data.materials_error || "";
      serviceCalculatorState.materialsChanged = false;
      serviceCalculatorState.services = data.services || [];
      serviceCalculatorState.selected = (data.selected || []).map((item) => ({
        ...item,
        quantity: Math.max(1, Math.trunc(Number(item.quantity || 1))),
      }));
      serviceCalculatorState.source = data.source || "SERVICOS.xlsx";
      serviceCalculatorState.standardLaborCost = Number(data.standard_labor_cost || 0);
      serviceCalculatorState.standardDailyRate = Number(data.standard_daily_rate || 0);
      serviceCalculatorState.technicians = Number(data.activity.qtde_tecnicos || 0);
      serviceCalculatorState.days = Number(data.activity.qtde_dias || 0);
      document.querySelector("#service-calculator-id").textContent = `#${data.activity.id}`;
      document.querySelector("#service-summary-id").textContent = `#${data.activity.id}`;
      document.querySelector("#material-summary-id").textContent = `#${data.activity.id}`;
      document.querySelector("#service-current-total").textContent = money.format(Number(data.activity.custo_mo || 0));
      document.querySelector("#service-technicians").value = serviceCalculatorState.technicians || "";
      document.querySelector("#service-days").value = serviceCalculatorState.days || "";
      renderMaterialCatalog();
      renderSelectedMaterials();
      renderServiceCatalog();
      renderSelectedServices();
      setCalculatorTab("materials");
    } catch (error) {
      document.querySelector("#service-catalog-list").innerHTML = `<div class="service-loading service-loading--error">${iconEmpty}<p>${escapeHtml(error.message)}</p></div>`;
      document.querySelector("#service-calculator-status").textContent = error.message;
      toast("Não foi possível abrir a calculadora", error.message, true);
    }
  }

  function setupServiceCalculator() {
    const modal = document.querySelector("#service-calculator-modal");
    const form = document.querySelector("#service-calculator-form");
    document.querySelectorAll("[data-service-modal-close]").forEach((button) => button.addEventListener("click", closeServiceCalculator));
    modal.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeServiceCalculator();
    });
    modal.addEventListener("cancel", () => {
      serviceCalculatorState.activity = null;
    });
    document.querySelectorAll("[data-calculator-tab]").forEach((button) => button.addEventListener("click", () => setCalculatorTab(button.dataset.calculatorTab)));
    document.querySelector("#calculator-next").addEventListener("click", () => setCalculatorTab("services"));
    document.querySelector("#calculator-back").addEventListener("click", () => setCalculatorTab("materials"));
    document.querySelector("#material-search").addEventListener("input", (event) => {
      serviceCalculatorState.materialQuery = event.target.value;
      renderMaterialCatalog();
    });
    document.querySelector("#service-search").addEventListener("input", (event) => {
      serviceCalculatorState.query = event.target.value;
      renderServiceCatalog();
    });
    document.querySelector("#service-technicians").addEventListener("input", (event) => {
      serviceCalculatorState.technicians = Number(event.target.value || 0);
      syncServiceTotals();
    });
    document.querySelector("#service-days").addEventListener("input", (event) => {
      serviceCalculatorState.days = Number(event.target.value || 0);
      syncServiceTotals();
    });
    document.querySelector("#material-catalog-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-material-add]");
      if (button) addMaterial(button.dataset.materialAdd);
    });
    document.querySelector("#selected-materials-list").addEventListener("input", (event) => {
      const input = event.target.closest("[data-material-quantity]");
      if (!input) return;
      const item = serviceCalculatorState.selectedMaterials.find((selected) => selected.key === input.dataset.materialQuantity);
      if (!item) return;
      item.quantity = Number(input.value || 0);
      serviceCalculatorState.materialsChanged = true;
      syncServiceTotals();
    });
    document.querySelector("#selected-materials-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-material-remove]");
      if (!button) return;
      serviceCalculatorState.selectedMaterials = serviceCalculatorState.selectedMaterials.filter((item) => item.key !== button.dataset.materialRemove);
      serviceCalculatorState.materialsChanged = true;
      renderMaterialCatalog();
      renderSelectedMaterials();
    });
    document.querySelector("#clear-selected-materials").addEventListener("click", () => {
      serviceCalculatorState.selectedMaterials = [];
      serviceCalculatorState.materialsChanged = true;
      document.querySelector("#service-calculator-status").textContent = "Materiais limpos. O Custo Material será salvo como R$ 0,00.";
      renderMaterialCatalog();
      renderSelectedMaterials();
    });
    document.querySelector("#service-catalog-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-service-add]");
      if (button) addService(button.dataset.serviceAdd);
    });
    document.querySelector("#selected-services-list").addEventListener("input", (event) => {
      const input = event.target.closest("[data-service-quantity]");
      if (!input) return;
      const item = serviceCalculatorState.selected.find((selected) => selected.key === input.dataset.serviceQuantity);
      if (!item) return;
      item.quantity = Number(input.value || 0);
      syncServiceTotals();
    });
    document.querySelector("#selected-services-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-service-remove]");
      if (!button) return;
      serviceCalculatorState.selected = serviceCalculatorState.selected.filter((item) => item.key !== button.dataset.serviceRemove);
      renderServiceCatalog();
      renderSelectedServices();
    });
    document.querySelector("#clear-selected-services").addEventListener("click", () => {
      serviceCalculatorState.selected = [];
      document.querySelector("#service-calculator-status").textContent = "Lista limpa. Ao salvar, será usado o custo padrão da equipe.";
      renderServiceCatalog();
      renderSelectedServices();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!serviceCalculatorState.activity || !form.reportValidity()) return;
      const saveButton = document.querySelector("#save-service-calculation");
      const status = document.querySelector("#service-calculator-status");
      const reference = serviceCalculatorState.activity.record_key || serviceCalculatorState.activity.id;
      const activityId = serviceCalculatorState.activity.id;
      saveButton.disabled = true;
      saveButton.textContent = "Salvando…";
      status.textContent = "Atualizando materiais, serviços e a memória do cálculo…";
      try {
        const result = await getJson(`/api/service-calculation?activity=${encodeURIComponent(reference)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technicians: Number(serviceCalculatorState.technicians),
            days: Number(serviceCalculatorState.days),
            items: serviceCalculatorState.selected.map((item) => ({ key: item.key, quantity: Number(item.quantity) })),
            materials_changed: serviceCalculatorState.materialsChanged,
            material_items: serviceCalculatorState.selectedMaterials.map((item) => ({ key: item.key, quantity: Number(item.quantity) })),
          }),
        });
        closeServiceCalculator();
        listState.filtersLoaded = false;
        await loadActivities();
        toast("Cálculo salvo", `Atividade ${activityId}: materiais ${money.format(result.material_total || 0)} e serviços ${money.format(result.labor_total || 0)}.`);
      } catch (error) {
        status.textContent = error.message;
        toast("Não foi possível salvar o cálculo", error.message, true);
      } finally {
        saveButton.textContent = "Salvar cálculo";
        if (serviceCalculatorState.activity) syncServiceTotals();
      }
    });
  }

  const catalogDefinitions = {
    statuses: { singular: "status", plural: "status", empty: "Nenhum status cadastrado." },
    types: { singular: "tipo de atividade", plural: "tipos de atividade", empty: "Nenhum tipo de atividade cadastrado." },
    technologies: { singular: "tecnologia", plural: "tecnologias", empty: "Nenhuma tecnologia cadastrada." },
    technicians: { singular: "técnico", plural: "técnicos", empty: "Nenhum técnico cadastrado." },
    companies: { singular: "empresa", plural: "empresas", empty: "Nenhuma empresa cadastrada." },
    eps: { singular: "EPS", plural: "EPS", empty: "Nenhuma EPS cadastrada." },
  };

  function catalogRow(key, item = "") {
    if (key === "technologies") {
      const technology = item && typeof item === "object" ? item : { name: item, service_cost: 0 };
      return `
        <div class="catalog-row catalog-row--technology" data-catalog-row>
          <input class="catalog-input" data-catalog-field="name" value="${escapeHtml(technology.name || "")}" maxlength="160" aria-label="Tecnologia" placeholder="Ex.: GPON" required>
          <div class="catalog-money"><span>R$</span><input class="catalog-input" data-catalog-field="service_cost" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(Number(technology.service_cost || 0).toFixed(2))}" aria-label="Valor do serviço para ${escapeHtml(technology.name || "a tecnologia")}" required></div>
          <button class="icon-button icon-button--bordered catalog-remove" type="button" data-catalog-remove aria-label="Excluir tecnologia" title="Excluir tecnologia">${iconTrash}</button>
        </div>`;
    }
    if (key === "technicians") {
      const technician = item && typeof item === "object" ? item : {};
      return `
        <div class="catalog-row catalog-row--technician" data-catalog-row>
          <input class="catalog-input" data-catalog-field="registration" value="${escapeHtml(technician.registration || "")}" maxlength="120" aria-label="Matrícula do técnico" placeholder="Matrícula">
          <input class="catalog-input" data-catalog-field="name" value="${escapeHtml(technician.name || "")}" maxlength="160" aria-label="Nome do técnico" placeholder="Nome do técnico" required>
          <button class="icon-button icon-button--bordered catalog-remove" type="button" data-catalog-remove aria-label="Excluir técnico" title="Excluir técnico">${iconTrash}</button>
        </div>`;
    }
    const labels = { statuses: "Status", types: "Tipo de atividade", technologies: "Tecnologia", companies: "Empresa", eps: "EPS" };
    const label = labels[key];
    return `
      <div class="catalog-row" data-catalog-row>
        <input class="catalog-input" data-catalog-field="value" value="${escapeHtml(item || "")}" maxlength="160" aria-label="${label}" placeholder="${label}" required>
        <button class="icon-button icon-button--bordered catalog-remove" type="button" data-catalog-remove aria-label="Excluir ${label.toLowerCase()}" title="Excluir ${label.toLowerCase()}">${iconTrash}</button>
      </div>`;
  }

  function updateCatalogCount(key) {
    const definition = catalogDefinitions[key];
    const total = document.querySelectorAll(`#${key}-catalog [data-catalog-row]`).length;
    const count = document.querySelector(`#${key}-count`);
    if (count) count.textContent = `${total} ${total === 1 ? definition.singular : definition.plural}`;
  }

  function renderCatalog(key, items) {
    const list = document.querySelector(`#${key}-catalog`);
    const values = Array.isArray(items) ? items : [];
    list.innerHTML = values.length
      ? values.map((item) => catalogRow(key, item)).join("")
      : `<div class="catalog-empty" data-catalog-empty>${iconEmpty}<p>${catalogDefinitions[key].empty}</p></div>`;
    updateCatalogCount(key);
  }

  const settingsState = { uploads: { services: {}, materials: {} } };

  function businessDaysInMonth(monthValue) {
    const [year, month] = String(monthValue || "").split("-").map(Number);
    if (!year || !month) return 0;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    let total = 0;
    for (let day = 1; day <= days; day += 1) {
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      if (weekday !== 0 && weekday !== 6) total += 1;
    }
    return total;
  }

  function recalculateDailyRate() {
    const monthlyCost = Number(document.querySelector("#monthly-technician-cost")?.value || 0);
    const businessDays = Number(document.querySelector("#business-days")?.value || 0);
    const dailyRate = businessDays > 0 ? monthlyCost / businessDays : 0;
    document.querySelector("#computed-daily-rate").textContent = money.format(dailyRate);
    document.querySelector("#daily-rate-formula").textContent = `${money.format(monthlyCost)} ÷ ${businessDays} ${businessDays === 1 ? "dia útil" : "dias úteis"}`;
  }

  function renderUpload(kind, metadata = {}) {
    const status = document.querySelector(`#${kind}-upload-status`);
    if (!status) return;
    if (metadata.filename) {
      status.textContent = metadata.uploaded_at
        ? `${metadata.filename} · ${new Date(metadata.uploaded_at).toLocaleString("pt-BR")}`
        : metadata.filename;
      status.title = metadata.path || metadata.filename;
    } else {
      status.textContent = "Nenhuma planilha enviada.";
      status.removeAttribute("title");
    }
  }

  function renderSettings(settings) {
    document.querySelector("#reference-month").value = settings.reference_month || "";
    document.querySelector("#monthly-technician-cost").value = Number(settings.monthly_technician_cost || 0).toFixed(2);
    document.querySelector("#business-days").value = Number(settings.business_days || 0);
    document.querySelector("#calculation-status").textContent = settings.calculation_status;
    const teams = Object.fromEntries((settings.category_teams || []).map((item) => [item.category, Number(item.technicians || 0)]));
    ["implantacao", "reparo", "ativacao"].forEach((category) => {
      const input = document.querySelector(`#category-team-${category}`);
      if (input) input.value = teams[category] || 0;
    });
    document.querySelector("#upload-directory").textContent = settings.upload_directory || "—";
    settingsState.uploads = settings.uploads || { services: {}, materials: {} };
    renderUpload("services", settingsState.uploads.services);
    renderUpload("materials", settingsState.uploads.materials);
    recalculateDailyRate();
    Object.keys(catalogDefinitions).forEach((key) => {
      renderCatalog(key, key === "technologies" ? settings.technology_rates : settings[key]);
    });
  }

  function collectCatalog(key) {
    const rows = [...document.querySelectorAll(`#${key}-catalog [data-catalog-row]`)];
    if (key === "technologies") {
      return rows.map((row) => ({
        name: row.querySelector('[data-catalog-field="name"]').value.trim(),
        service_cost: Number(row.querySelector('[data-catalog-field="service_cost"]').value || 0),
      }));
    }
    if (key === "technicians") {
      return rows.map((row) => ({
        registration: row.querySelector('[data-catalog-field="registration"]').value.trim(),
        name: row.querySelector('[data-catalog-field="name"]').value.trim(),
      }));
    }
    return rows.map((row) => row.querySelector('[data-catalog-field="value"]').value.trim());
  }

  function showAdminLogin(message = "") {
    document.querySelector("#admin-login").hidden = false;
    document.querySelector("#admin-content").hidden = true;
    document.querySelector("#admin-login-status").textContent = message;
    document.querySelector("#admin-password").value = "";
    setTimeout(() => document.querySelector("#admin-password")?.focus(), 50);
  }

  function showAdminContent() {
    document.querySelector("#admin-login").hidden = true;
    document.querySelector("#admin-content").hidden = false;
    document.querySelector("#admin-login-status").textContent = "";
  }

  async function loadSettings() {
    try {
      const data = await getJson("/api/settings");
      setConnection(true, data.source);
      renderSettings(data.settings);
      showAdminContent();
    } catch (error) {
      if (error.status === 401) {
        showAdminLogin();
        return;
      }
      setConnection(false);
      toast("Não foi possível carregar as configurações", error.message, true);
    }
  }

  async function uploadReference(kind, file) {
    const labels = { services: "serviços", materials: "materiais" };
    const button = document.querySelector(`[data-upload-trigger="${kind}"]`);
    const status = document.querySelector(`#${kind}-upload-status`);
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      toast("Arquivo não aceito", "Selecione uma planilha .xlsx ou .xlsm.", true);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast("Arquivo muito grande", "A planilha deve ter no máximo 25 MB.", true);
      return;
    }
    button.disabled = true;
    status.textContent = "Enviando para a pasta sincronizada…";
    try {
      const data = await getJson(`/api/admin/upload?kind=${encodeURIComponent(kind)}&filename=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      settingsState.uploads[kind] = data.upload;
      renderUpload(kind, data.upload);
      document.querySelector("#upload-directory").textContent = data.upload.directory;
      toast("Planilha enviada", `A base de ${labels[kind]} foi salva na pasta sincronizada.`);
    } catch (error) {
      if (error.status === 401) showAdminLogin("Sua sessão terminou. Entre novamente.");
      else {
        status.textContent = "Não foi possível enviar a planilha.";
        toast("Falha no envio", error.message, true);
      }
    } finally {
      button.disabled = false;
      document.querySelector(`#${kind}-upload`).value = "";
    }
  }

  function setupSettings() {
    const form = document.querySelector("#settings-form");
    const loginForm = document.querySelector("#admin-login-form");

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = document.querySelector("#admin-login-button");
      const status = document.querySelector("#admin-login-status");
      button.disabled = true;
      status.textContent = "Verificando acesso…";
      try {
        await getJson("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(loginForm))),
        });
        await loadSettings();
      } catch (error) {
        status.textContent = error.message;
        document.querySelector("#admin-password").select();
      } finally {
        button.disabled = false;
      }
    });

    document.querySelector("#admin-logout-button").addEventListener("click", async () => {
      try {
        await getJson("/api/admin/logout", { method: "POST" });
      } finally {
        showAdminLogin("Sessão encerrada.");
      }
    });

    document.querySelectorAll("[data-upload-trigger]").forEach((button) => button.addEventListener("click", () => {
      document.querySelector(`#${button.dataset.uploadTrigger}-upload`).click();
    }));
    document.querySelectorAll("[data-reference-file]").forEach((input) => input.addEventListener("change", () => {
      if (input.files?.[0]) uploadReference(input.dataset.referenceFile, input.files[0]);
    }));

    document.querySelector("#reference-month").addEventListener("change", (event) => {
      document.querySelector("#business-days").value = businessDaysInMonth(event.target.value);
      recalculateDailyRate();
    });
    document.querySelector("#monthly-technician-cost").addEventListener("input", recalculateDailyRate);
    document.querySelector("#business-days").addEventListener("input", recalculateDailyRate);

    form.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-catalog-add]");
      if (addButton) {
        const key = addButton.dataset.catalogAdd;
        const list = document.querySelector(`#${key}-catalog`);
        list.querySelector("[data-catalog-empty]")?.remove();
        list.insertAdjacentHTML("beforeend", catalogRow(key));
        updateCatalogCount(key);
        list.lastElementChild?.querySelector("input")?.focus();
        return;
      }

      const removeButton = event.target.closest("[data-catalog-remove]");
      if (removeButton) {
        const list = removeButton.closest("[data-catalog-list]");
        const key = list.dataset.catalogList;
        removeButton.closest("[data-catalog-row]").remove();
        if (!list.querySelector("[data-catalog-row]")) {
          list.innerHTML = `<div class="catalog-empty" data-catalog-empty>${iconEmpty}<p>${catalogDefinitions[key].empty}</p></div>`;
        }
        updateCatalogCount(key);
        document.querySelector("#settings-status").textContent = "Alteração pendente. Salve para atualizar o Excel.";
      }
    });

    form.addEventListener("input", () => {
      document.querySelector("#settings-status").textContent = "Alteração pendente. Salve para atualizar o Excel.";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const saveButton = document.querySelector("#settings-save");
      const status = document.querySelector("#settings-status");
      saveButton.disabled = true;
      status.textContent = "Salvando na aba Config do Excel…";
      try {
        const data = await getJson("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference_month: document.querySelector("#reference-month").value,
            monthly_technician_cost: Number(document.querySelector("#monthly-technician-cost").value || 0),
            business_days: Number(document.querySelector("#business-days").value || 0),
            statuses: collectCatalog("statuses"),
            types: collectCatalog("types"),
            technology_rates: collectCatalog("technologies"),
            category_teams: ["implantacao", "reparo", "ativacao"].map((category) => ({
              category,
              technicians: Number(document.querySelector(`#category-team-${category}`).value || 0),
            })),
            technicians: collectCatalog("technicians"),
            companies: collectCatalog("companies"),
            eps: collectCatalog("eps"),
            uploads: settingsState.uploads,
          }),
        });
        renderSettings(data.settings);
        status.textContent = "Configurações salvas no Excel.";
        toast("Configurações salvas", "O valor padrão e os cadastros foram atualizados.");
      } catch (error) {
        if (error.status === 401) showAdminLogin("Sua sessão terminou. Entre novamente.");
        status.textContent = error.message;
        toast("Não foi possível salvar", error.message, true);
      } finally {
        saveButton.disabled = false;
      }
    });
  }

  setupShell();
  setupGlobalActions();
  if (page === "dashboard") {
    setupDashboardFilters();
    loadDashboard();
  }
  if (page === "activities") {
    queryFromLocation();
    setupListControls();
    setupModal();
    setupServiceCalculator();
    loadActivities();
  }
  if (page === "settings") {
    setupSettings();
    loadSettings();
  }
})();
