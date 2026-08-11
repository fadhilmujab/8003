/**
 * Malaysia Macroeconomic Dashboard - Application Logic
 * Integrates live Google Sheets data and renders interactive visualizations.
 */

// Application State
let dashboardData = {};
const currentSheetUrl = "https://docs.google.com/spreadsheets/d/1bTfW9RIot6i44Pg19xkAuYvzODZWoYZQibIkkryX0UQ/edit?usp=sharing";
let activeChart = null;

// Predefined metadata for the 17 indicators in 3x3 sequential ordering
const indicatorMetadata = {
  cpi_monthly: {
    name: "CPI - Monthly",
    shortName: "CPI M",
    unit: "% y-o-y",
    description: "Consumer Price Index (CPI) measure the percentage change through time in the cost of puchasing a constant basket of goods and services.",
    color: "#6366f1"
  },
  cpi_quarterly: {
    name: "CPI - Quarterly",
    shortName: "CPI Q",
    unit: "% y-o-y",
    description: "Consumer Price Index (CPI) measure the percentage change through time in the cost of puchasing a constant basket of goods and services.",
    color: "#a855f7"
  },
  cpi_annual: {
    name: "CPI - Annual",
    shortName: "CPI A",
    unit: "% y-o-y",
    description: "Consumer Price Index (CPI) measure the percentage change through time in the cost of puchasing a constant basket of goods and services.",
    color: "#4f46e5"
  },
  core_inflation_monthly: {
    name: "Core Inflation - Monthly",
    shortName: "Core M",
    unit: "% y-o-y",
    description: "Core Inflation measure changes in the prices of all goods and services excluding volatile prices of items for fresh food as well as administered prices of goods by the government.",
    sheetTabName: "core.inflation_monthly",
    color: "#6366f1"
  },
  core_inflation_quarterly: {
    name: "Core Inflation - Quarterly",
    shortName: "Core Q",
    unit: "% y-o-y",
    description: "Core Inflation measure changes in the prices of all goods and services excluding volatile prices of items for fresh food as well as administered prices of goods by the government.",
    sheetTabName: "core.inflation_quarter",
    color: "#a855f7"
  },
  core_inflation_annual: {
    name: "Core Inflation - Annual",
    shortName: "Core A",
    unit: "% y-o-y",
    description: "Core Inflation measure changes in the prices of all goods and services excluding volatile prices of items for fresh food as well as administered prices of goods by the government.",
    sheetTabName: "core.inflation_annual",
    color: "#4f46e5"
  },
  ppi_monthly: {
    name: "PPI - Monthly",
    shortName: "PPI M",
    unit: "% y-o-y",
    description: "Producer Price Index (PPI) presents statistics covering five main sectors.",
    color: "#06b6d4"
  },
  ppi_quarterly: {
    name: "PPI - Quarterly",
    shortName: "PPI Q",
    unit: "% y-o-y",
    description: "Producer Price Index (PPI) presents statistics covering five main sectors.",
    color: "#0ea5e9"
  },
  ppi_annual: {
    name: "PPI - Annual",
    shortName: "PPI A",
    unit: "% y-o-y",
    description: "Producer Price Index (PPI) presents statistics covering five main sectors.",
    color: "#3b82f6"
  },
  sppi_quarter: {
    name: "SPPI - Quarterly",
    shortName: "SPPI Q",
    unit: "points",
    description: "Services Producer Price Index (SPPI) is compiled to measure the average change in the prices of services charged by the local services industry.",
    color: "#10b981"
  },
  sppi_annual: {
    name: "SPPI - Annual",
    shortName: "SPPI A",
    unit: "points",
    description: "Services Producer Price Index (SPPI) is compiled to measure the average change in the prices of services charged by the local services industry.",
    color: "#14b8a6"
  },
  opr: {
    name: "OPR",
    shortName: "Overnight Policy Rate",
    unit: "%",
    description: "Overnight Policy Rate (OPR) is a key interest rate set by Bank Negara Malaysia (BNM) through its Monetary Policy Committee",
    color: "#f59e0b"
  },
  gdp_deflator_quarterly: {
    name: "GDP Deflator - Quarterly",
    shortName: "GDP Defl Q",
    unit: "points",
    description: "GDP deflator is computed as the ratio of nominal GDP (at current prices) to real GDP (at constant prices).",
    sheetTabName: "gdp.deflator_quarter",
    color: "#10b981"
  },
  gdp_deflator_annual: {
    name: "GDP Deflator - Annual",
    shortName: "GDP Defl A",
    unit: "points",
    description: "GDP deflator is computed as the ratio of nominal GDP (at current prices) to real GDP (at constant prices).",
    sheetTabName: "gdp.deflator_annual",
    color: "#14b8a6"
  }
};

// -------------------------------------------------------------
// App Initialization
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadData();
});

// Setup Event Bindings
function setupEventListeners() {
  // Refresh data trigger
  document.getElementById("refresh-btn").addEventListener("click", loadData);

  // Detail Modal controls
  const detailModal = document.getElementById("detail-modal");
  const closeDetail = document.getElementById("close-detail");

  const closeDetailModal = () => {
    detailModal.classList.remove("active");
    detailModal.setAttribute("aria-hidden", "true");
    if (activeChart) {
      activeChart.destroy();
      activeChart = null;
    }
  };

  closeDetail.addEventListener("click", closeDetailModal);
  detailModal.addEventListener("click", (e) => {
    if (e.target === detailModal) closeDetailModal();
  });

  // Esc key closure for detail modal
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDetailModal();
    }
  });

  // Card click bindings for detail view
  Object.keys(indicatorMetadata).forEach(key => {
    const card = document.getElementById(`card-${key}`);
    if (card) {
      card.addEventListener("click", () => showDetailView(key));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          showDetailView(key);
        }
      });
    }
  });
}

// -------------------------------------------------------------
// Core Data Fetch & State Management
// -------------------------------------------------------------
async function loadData() {
  updateStatusUI("loading", "Updating data...");

  try {
    await fetchFromGoogleSheets(currentSheetUrl);
  } catch (error) {
    console.error("Data load failed: ", error);
    updateStatusUI("error", "Sync Error (Check Connection)");
    // Load mock data as fallback on error
    await fetchMockData(true);
  }
}

// Load Mock Data
async function fetchMockData(isErrorFallback = false) {
  try {
    const response = await fetch("mock_data.json?t=" + new Date().getTime());
    if (!response.ok) throw new Error("Mock file not found");
    const mockData = await response.json();
    dashboardData = mockData;
    renderDashboard();
    
    if (isErrorFallback) {
      updateStatusUI("error", "Error loading sheet. Using fallback mock data.");
    } else {
      updateStatusUI("mock", "Using Local Mock Data");
    }
  } catch (e) {
    console.error("Fallback fetch failed: ", e);
    updateStatusUI("error", "Critical: Failed to load data sources.");
  }
}

// Fetch from Google Sheet CSV
async function fetchFromGoogleSheets(url) {
  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) {
    throw new Error("Could not extract Spreadsheet ID. Ensure URL matches browser format.");
  }

  // Load baseline mock data so we have metadata and fallback curves for sheets that are not set up
  let baselineData = {};
  try {
    const mockResponse = await fetch("mock_data.json?t=" + new Date().getTime());
    if (mockResponse.ok) {
      baselineData = await mockResponse.json();
    }
  } catch (e) {
    console.warn("Failed to load baseline mock data:", e);
  }

  const keys = Object.keys(indicatorMetadata);
  
  // Stagger fetches slightly to prevent Google API rate limiter triggers
  const fetchPromises = keys.map(async (key, idx) => {
    await new Promise(resolve => setTimeout(resolve, idx * 50));
    const meta = indicatorMetadata[key];
    const sheetName = encodeURIComponent(meta.sheetTabName || key);
    const fetchUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
    
    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const csvText = await response.text();
      const history = parseSheetCSV(csvText);
      
      if (history.length === 0) {
        return { key, success: false, reason: "No data rows found" };
      }
      return { key, history, success: true };
    } catch (error) {
      return { key, success: false, reason: error.message };
    }
  });

  const results = await Promise.all(fetchPromises);
  const updatedData = {};
  let successfulCount = 0;

  results.forEach(res => {
    const key = res.key;
    const meta = indicatorMetadata[key];
    const baseline = baselineData[key] || {};

    if (res.success && res.history.length > 0) {
      successfulCount++;
      const history = res.history;
      // Sort history chronologically
      history.sort((a, b) => a.date.localeCompare(b.date));

      const latest = history[history.length - 1];
      const previous = history.length > 1 ? history[history.length - 2] : null;
      
      const valNum = latest.value;
      const displayVal = valNum + (meta.unit === "%" || meta.unit.startsWith("%") ? "%" : "");
      
      let trend = "stable";
      let changeText = "No previous data";
      
      if (previous) {
        const prevFormattedDate = formatDisplayDate(previous.date);
        const prevDisplayVal = formatIndicatorValue(previous.value, key) + (meta.unit === "%" || meta.unit.startsWith("%") ? "%" : "");
        changeText = `${prevDisplayVal}, ${prevFormattedDate}`;
        
        const diff = valNum - previous.value;
        if (diff > 0.005) {
          trend = "up";
        } else if (diff < -0.005) {
          trend = "down";
        } else {
          trend = "stable";
        }
      }

      updatedData[key] = {
        key: key,
        name: meta.name,
        shortName: meta.shortName,
        currentValue: displayVal,
        unit: meta.unit,
        trend: trend,
        change: changeText,
        description: meta.description,
        history: history,
        isLive: true
      };
    } else {
      console.log(`Using mock fallback for "${key}" because: ${res.reason}`);
      updatedData[key] = {
        ...baseline,
        isLive: false
      };
    }
  });

  dashboardData = updatedData;
  renderDashboard();
  
  if (successfulCount > 0) {
    updateStatusUI("live", `Live: ${successfulCount}/${keys.length} sheets loaded`);
  } else {
    throw new Error("No custom sheets could be loaded from your spreadsheet. Check your sheet names.");
  }
}

// Extract Spreadsheet ID from standard Google Sheets URL
function extractSpreadsheetId(url) {
  const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return matches ? matches[1] : null;
}

// -------------------------------------------------------------
// CSV Parsing & Data Processing
// -------------------------------------------------------------
function parseSheetCSV(csvText) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
  const dateIdx = headers.indexOf('date');
  const valueIdx = headers.indexOf('value');

  if (dateIdx === -1 || valueIdx === -1) {
    return parseSheetCSVFallback(lines);
  }

  const history = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = splitCSVLine(line).map(p => p.replace(/"/g, '').trim());
    if (parts.length <= Math.max(dateIdx, valueIdx)) continue;

    const dateVal = parts[dateIdx];
    const parsedVal = parseFloat(parts[valueIdx]);

    if (dateVal && !isNaN(parsedVal)) {
      history.push({
        date: dateVal,
        value: parsedVal
      });
    }
  }
  return history;
}

function parseSheetCSVFallback(lines) {
  const history = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = splitCSVLine(line).map(p => p.replace(/"/g, '').trim());
    if (parts.length < 2) continue;

    const dateVal = parts[0];
    const parsedVal = parseFloat(parts[1]);

    if (dateVal && !isNaN(parsedVal)) {
      history.push({
        date: dateVal,
        value: parsedVal
      });
    }
  }
  return history;
}

function splitCSVLine(line) {
  const result = [];
  let insideQuote = false;
  let currentPart = '';
  
  for (let char of line) {
    if (char === '"') {
      insideQuote = !insideQuote;
    } else if (char === ',' && !insideQuote) {
      result.push(currentPart);
      currentPart = '';
    } else {
      currentPart += char;
    }
  }
  result.push(currentPart);
  return result;
}

// -------------------------------------------------------------
// UI Rendering Logic
// -------------------------------------------------------------
function renderDashboard() {
  Object.keys(dashboardData).forEach(key => {
    const data = dashboardData[key];
    const meta = indicatorMetadata[key];

    if (data.history && data.history.length > 0) {
      const sortedHistory = [...data.history].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sortedHistory[sortedHistory.length - 1];
      const previous = sortedHistory.length > 1 ? sortedHistory[sortedHistory.length - 2] : null;

      const latestFormatted = formatIndicatorValue(latest.value, key);
      data.currentValue = latestFormatted + (meta.unit === "%" || meta.unit.startsWith("%") ? "%" : "");

      if (previous) {
        const prevFormattedDate = formatDisplayDate(previous.date);
        const prevFormattedVal = formatIndicatorValue(previous.value, key);
        const prevDisplayVal = prevFormattedVal + (meta.unit === "%" || meta.unit.startsWith("%") ? "%" : "");
        data.change = `${prevDisplayVal}, ${prevFormattedDate}`;

        const diff = latest.value - previous.value;
        if (diff > 0.005) {
          data.trend = "up";
        } else if (diff < -0.005) {
          data.trend = "down";
        } else {
          data.trend = "stable";
        }
      } else {
        data.change = "No previous data";
        data.trend = "stable";
      }
    }
    
    // Update value element
    const valEl = document.getElementById(`val-${key}`);
    if (valEl) {
      valEl.textContent = data.currentValue;
      
      let latestDateStr = "";
      if (data.history && data.history.length > 0) {
        latestDateStr = data.history[data.history.length - 1].date;
      }
      const formattedDate = formatDisplayDate(latestDateStr);

      let dateEl = valEl.parentNode.querySelector('.card-date');
      if (!dateEl) {
        dateEl = document.createElement('span');
        dateEl.className = 'card-date';
        valEl.parentNode.insertBefore(dateEl, valEl.nextSibling);
      }
      dateEl.textContent = formattedDate ? " " + formattedDate : "";
    }

    // Update change description
    const changeEl = document.getElementById(`change-${key}`);
    if (changeEl) changeEl.textContent = data.change;

    // Update trend arrow
    const trendEl = document.getElementById(`trend-${key}`);
    if (trendEl) {
      trendEl.className = "card-trend";
      if (data.trend === "up") {
        trendEl.classList.add("trend-up");
        trendEl.innerHTML = `▲`;
      } else if (data.trend === "down") {
        trendEl.classList.add("trend-down");
        trendEl.innerHTML = `▼`;
      } else {
        trendEl.classList.add("trend-stable");
        trendEl.innerHTML = `●`;
      }
    }

    // Render Sparklines
    renderSparkline(`spark-${key}`, data.history, data.trend, meta.color);
  });
}

function renderSparkline(elementId, history, trend, color) {
  const container = document.getElementById(elementId);
  if (!container) return;
  if (!history || history.length < 2) {
    container.innerHTML = `<span style="font-size: 11px; color: var(--text-muted);">Awaiting data history</span>`;
    return;
  }

  const width = container.clientWidth || 240;
  const height = 50;
  const values = history.map(h => h.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min === 0 ? 1 : max - min;

  const points = history.map((h, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - ((h.value - min) / range) * (height - 12) - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathData = `M ${points.join(' L ')}`;
  
  let strokeColor = color || "var(--primary)";
  if (trend === "up") strokeColor = "var(--accent-emerald)";
  if (trend === "down") strokeColor = "var(--accent-rose)";
  if (trend === "stable") strokeColor = "var(--text-muted)";

  const svgHtml = `
    <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="grad-${elementId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.25" />
          <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <path class="sparkline-gradient" d="${pathData} L ${width},${height} L 0,${height} Z" fill="url(#grad-${elementId})"></path>
      <path class="sparkline-path-glow" d="${pathData}" stroke="${strokeColor}"></path>
      <path class="sparkline-path" d="${pathData}" stroke="${strokeColor}"></path>
    </svg>
  `;

  container.innerHTML = svgHtml;
}

// -------------------------------------------------------------
// Detail Modal Presentation (Chart.js Rendering)
// -------------------------------------------------------------
function showDetailView(key) {
  const data = dashboardData[key];
  if (!data) return;

  const detailModal = document.getElementById("detail-modal");
  
  document.getElementById("detail-code").textContent = data.shortName;
  document.getElementById("detail-title").textContent = data.name;
  document.getElementById("detail-value").textContent = data.currentValue;
  document.getElementById("detail-description").textContent = data.description;
  document.getElementById("detail-change").textContent = data.change;

  const badge = document.getElementById("detail-trend-badge");
  badge.textContent = data.trend === "up" ? "UP" : data.trend === "down" ? "DOWN" : "STABLE";
  badge.className = "trend-badge";
  if (data.trend === "up") badge.classList.add("trend-badge-up");
  else if (data.trend === "down") badge.classList.add("trend-badge-down");
  else badge.classList.add("trend-badge-stable");

  const tbody = document.getElementById("historical-table-body");
  tbody.innerHTML = "";
  
  const reversedHistory = [...data.history].reverse();
  reversedHistory.forEach(item => {
    const tr = document.createElement("tr");
    const formattedVal = formatIndicatorValue(item.value, data.key);
    tr.innerHTML = `
      <td>${item.date}</td>
      <td style="font-weight: 600;">${formattedVal}${data.unit.includes('%') ? '%' : ''}</td>
    `;
    tbody.appendChild(tr);
  });

  detailModal.classList.add("active");
  detailModal.setAttribute("aria-hidden", "false");

  renderChart(data);
}

function renderChart(data) {
  const ctx = document.getElementById("historical-chart").getContext("2d");
  
  if (activeChart) {
    activeChart.destroy();
  }

  const labels = data.history.map(item => item.date);
  const values = data.history.map(item => item.value);

  let lineColor = indicatorMetadata[data.key].color || "#6366f1";
  if (data.trend === "up") lineColor = "#10b981";
  if (data.trend === "down") lineColor = "#f43f5e";

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, hexToRgba(lineColor, 0.3));
  gradient.addColorStop(1, hexToRgba(lineColor, 0.0));

  activeChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: data.name,
        data: values,
        borderColor: lineColor,
        borderWidth: 3,
        pointBackgroundColor: lineColor,
        pointBorderColor: "#ffffff",
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
        backgroundColor: gradient
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          titleColor: "#ffffff",
          bodyColor: "#e2e8f0",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          font: { family: "Plus Jakarta Sans" },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += formatIndicatorValue(context.parsed.y, data.key) + (data.unit.includes('%') ? '%' : ' ' + data.unit);
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#94a3b8", font: { family: "Plus Jakarta Sans" } }
        },
        y: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#94a3b8", font: { family: "Plus Jakarta Sans" } }
        }
      }
    }
  });
}

// -------------------------------------------------------------
// Utilities
// -------------------------------------------------------------
function hexToRgba(hex, alpha) {
  if (hex.startsWith("var")) {
    if (hex.includes("emerald")) return `rgba(16, 185, 129, ${alpha})`;
    if (hex.includes("rose")) return `rgba(244, 63, 94, ${alpha})`;
    if (hex.includes("amber")) return `rgba(245, 158, 11, ${alpha})`;
    if (hex.includes("cyan")) return `rgba(6, 182, 212, ${alpha})`;
    return `rgba(99, 102, 241, ${alpha})`;
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function updateStatusUI(status, text) {
  const badge = document.getElementById("data-status-badge");
  const textEl = document.getElementById("data-status-text");

  if (!badge || !textEl) return;

  textEl.textContent = text;
  badge.className = "status-badge";

  if (status === "live") {
    badge.classList.add("status-live");
  } else if (status === "mock") {
    badge.classList.add("status-mock");
  } else if (status === "error") {
    badge.classList.add("status-error");
  } else if (status === "loading") {
    badge.classList.add("status-mock");
  }
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  
  const monthlyMatch = dateStr.match(/^(\d{4})-(\d{2})$/);
  if (monthlyMatch) {
    return `${monthlyMatch[2]}-${monthlyMatch[1]}`;
  }
  
  const fullMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullMatch) {
    return `${fullMatch[2]}-${fullMatch[1]}`;
  }
  
  const quarterlyMatch = dateStr.match(/^(\d{4})-Q(\d)$/i);
  if (quarterlyMatch) {
    return `Q${quarterlyMatch[2]} ${quarterlyMatch[1]}`;
  }
  
  return dateStr;
}

function formatIndicatorValue(val, key) {
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  if (key === "opr") {
    return num.toFixed(2);
  }
  return num.toFixed(1);
}
