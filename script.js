/* FINAL script.js — Advanced Currency Converter (Sharvani)
   This version uses stable API (open.er-api.com), supports:
   ✔ Real-time conversion
   ✔ 160+ currencies + fallback symbols
   ✔ Flags
   ✔ Favorites (★)
   ✔ CSV / PDF export
   ✔ Conversion suggestions
   ✔ History (localStorage)
   ✔ Dark/Light theme
   ✔ PWA support
*/

const FLAG_BASE = "https://flagcdn.com/w40/";
const MAX_HISTORY = 5;

// DOM REFS
const amountInput = document.getElementById("amount");
const fromSel = document.getElementById("fromCurrency");
const toSel = document.getElementById("toCurrency");
const convertBtn = document.getElementById("convertBtn");
const swapBtn = document.getElementById("swapBtn");
const resultDiv = document.getElementById("result");
const exchangeRateDiv = document.getElementById("exchangeRate");
const historyList = document.getElementById("history");
const emptyHistory = document.getElementById("emptyHistory");
const refreshBtn = document.getElementById("refreshRates");
const populateExample = document.getElementById("populateExample");
const clearHistoryBtn = document.getElementById("clearHistory");
const downloadCSV = document.getElementById("downloadCSV");
const downloadPDF = document.getElementById("downloadPDF");
const themeSwitch = document.getElementById("themeSwitch");
const favFromBtn = document.getElementById("favFrom");
const favToBtn = document.getElementById("favTo");
const loader = document.getElementById("loader");
const menuToggle = document.getElementById("menuToggle");
const navbar = document.getElementById("navbar");

// DATA VARIABLES
let symbols = {};
let favorites = JSON.parse(localStorage.getItem("fav_currencies") || "[]");
let latestRates = {};
let baseSymbol = "USD";

// currency → country code for flags
let currencyToCountry = {
  USD: "us",
  EUR: "eu",
  INR: "in",
  GBP: "gb",
  AED: "ae",
  SAR: "sa",
  AUD: "au",
  CAD: "ca",
  SGD: "sg",
  NZD: "nz",
  CHF: "ch",
  JPY: "jp",
  CNY: "cn",
  HKD: "hk",
  SEK: "se",
  NOK: "no",
  TRY: "tr",
  BRL: "br",
  ZAR: "za",
  MXN: "mx",
  PHP: "ph",
  THB: "th",
  IDR: "id",
  PKR: "pk",
  BDT: "bd",
  LKR: "lk"
};

// ---------------------------
// UI helpers
// ---------------------------
function showLoader() {
  loader.style.display = "block";
}
function hideLoader() {
  loader.style.display = "none";
}

// Create a flag element
function flagImg(code) {
  const cc = currencyToCountry[code];
  if (cc) {
    const img = document.createElement("img");
    img.src = `${FLAG_BASE}${cc}.png`;
    img.className = "flag";
    img.alt = code;
    img.onerror = () => (img.style.display = "none");
    return img;
  }
  const span = document.createElement("span");
  span.textContent = "🌐";
  span.style.marginRight = "8px";
  return span;
}

// ---------------------------
// Load currency list
// ---------------------------
async function loadSymbols() {
  try {
    showLoader();
    // exchangerate.host symbols can fail, so fallback automatically
    const res = await fetch("https://api.exchangerate.host/symbols?format=json");
    const data = await res.json();
    if (data && data.symbols) {
      symbols = data.symbols;
    }

    // If symbols empty → fallback list
    if (!symbols || Object.keys(symbols).length === 0) {
      const fallback = {
        USD: "United States Dollar",
        INR: "Indian Rupee",
        EUR: "Euro",
        GBP: "British Pound",
        JPY: "Japanese Yen",
        AED: "UAE Dirham",
        SAR: "Saudi Riyal",
        AUD: "Australian Dollar",
        CAD: "Canadian Dollar",
        SGD: "Singapore Dollar",
        CNY: "Chinese Yuan"
      };
      symbols = {};
      for (const c in fallback) {
        symbols[c] = { description: fallback[c] };
      }
      console.warn("Using fallback currency list");
    }

    populateSelects();
  } catch (e) {
    console.error("loadSymbols error", e);
  } finally {
    hideLoader();
  }
}

// ---------------------------
// Populate dropdowns
// ---------------------------
function populateSelects() {
  fromSel.innerHTML = "";
  toSel.innerHTML = "";

  const codes = Object.keys(symbols).sort((a, b) => {
    if (favorites.includes(a) && !favorites.includes(b)) return -1;
    if (!favorites.includes(a) && favorites.includes(b)) return 1;
    return a.localeCompare(b);
  });

  codes.forEach((code) => {
    const desc = symbols[code]?.description || "";

    const optA = document.createElement("option");
    optA.value = code;
    optA.innerText = `${code} — ${desc}`;
    fromSel.appendChild(optA);

    const optB = optA.cloneNode(true);
    toSel.appendChild(optB);
  });

  // defaults
  fromSel.value = "USD";
  toSel.value = "INR";

  fetchRates(fromSel.value);
  renderFavoritesUI();
}

// ---------------------------
// Fetch base currency rates (new API)
// ---------------------------
async function fetchRates(base = "USD") {
  try {
    showLoader();
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const data = await res.json();

    if (!data.rates) {
      exchangeRateDiv.textContent = `Base: 1 ${base} — rate unavailable`;
      return;
    }

    latestRates = data.rates;
    exchangeRateDiv.textContent = `Base: 1 ${base} — updated ${data.time_last_update_utc}`;
  } catch (e) {
    console.error("fetchRates error", e);
    exchangeRateDiv.textContent = `Base: 1 ${base} — unavailable`;
  } finally {
    hideLoader();
  }
}

// ---------------------------
// Convert
// ---------------------------
async function convert() {
  let raw = amountInput.value.trim();

  // Handle "10 USD to INR" smart input
  if (raw.toLowerCase().includes(" to ")) {
    const parts = raw.split(" ");
    if (parts.length >= 4) {
      amountInput.value = parts[0];
      fromSel.value = parts[1].toUpperCase();
      toSel.value = parts[3].toUpperCase();
      raw = amountInput.value;
    }
  }

  const amount = parseFloat(raw) || 0;
  const from = fromSel.value;
  const to = toSel.value;

  if (amount <= 0) return alert("Enter a number > 0");

  try {
    showLoader();
    resultDiv.textContent = "Converting...";

    // NEW stable API
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const data = await res.json();

    if (!data.rates || !data.rates[to]) throw new Error("Rate missing");

    const rate = data.rates[to];
    const converted = amount * rate;

    displayResult(from, to, amount, converted, rate);
    saveHistory({ from, to, amount, converted, rate, time: Date.now() });
  } catch (e) {
    console.error("convert error", e);
    alert("Conversion failed.");
    resultDiv.textContent = "—";
  } finally {
    hideLoader();
  }
}

// Show result
function displayResult(from, to, amount, converted, rate) {
  resultDiv.innerHTML = `
    ${amount.toLocaleString()} <strong>${from}</strong>
    →
    <strong>${converted.toLocaleString(undefined,{maximumFractionDigits:4})} ${to}</strong>
  `;

  exchangeRateDiv.textContent = `1 ${from} = ${rate.toFixed(6)} ${to}`;
}

// ---------------------------
// History
// ---------------------------
function saveHistory(entry) {
  const raw = localStorage.getItem("conv_history_v2");
  const arr = raw ? JSON.parse(raw) : [];
  arr.unshift(entry);
  while (arr.length > MAX_HISTORY) arr.pop();
  localStorage.setItem("conv_history_v2", JSON.stringify(arr));
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  const raw = localStorage.getItem("conv_history_v2");
  const arr = raw ? JSON.parse(raw) : [];

  if (!arr.length) {
    emptyHistory.style.display = "block";
    return;
  }

  emptyHistory.style.display = "none";

  arr.forEach((item) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "8px";

    left.appendChild(flagImg(item.from));

    const txt = document.createElement("div");
    txt.innerHTML = `
      <div style="font-weight:600">
        ${item.amount} ${item.from} →
        ${item.converted.toFixed(4)} ${item.to}
      </div>
      <div style="font-size:12px;color:var(--muted)">
        Rate: ${item.rate.toFixed(6)}
      </div>
    `;
    left.appendChild(txt);

    const right = document.createElement("div");
    right.style.fontSize = "12px";
    right.style.color = "var(--muted)";
    right.textContent = new Date(item.time).toLocaleString();

    li.appendChild(left);
    li.appendChild(right);
    historyList.appendChild(li);
  });
}

function clearHistory() {
  localStorage.removeItem("conv_history_v2");
  renderHistory();
}

// ---------------------------
// CSV download
// ---------------------------
function downloadHistoryCSV() {
  const raw = localStorage.getItem("conv_history_v2");
  if (!raw) return alert("No history");

  const arr = JSON.parse(raw);
  const rows = [
    ["Time", "From", "Amount", "To", "Converted", "Rate"],
    ...arr.map((r) => [
      new Date(r.time).toLocaleString(),
      r.from,
      r.amount,
      r.to,
      r.converted,
      r.rate
    ])
  ];

  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `history_${Date.now()}.csv`;
  a.click();
}

// ---------------------------
// PDF download
// ---------------------------
async function downloadHistoryPDF() {
  const raw = localStorage.getItem("conv_history_v2");
  if (!raw) return alert("No history");

  const arr = JSON.parse(raw);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Conversion History", 14, 20);

  let y = 30;
  doc.setFontSize(10);

  arr.forEach((item, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.text(
      `${i + 1}. ${new Date(item.time).toLocaleString()} — ${item.amount} ${
        item.from
      } → ${item.converted.toFixed(4)} ${item.to} (rate ${item.rate.toFixed(
        6
      )})`,
      14,
      y
    );

    y += 8;
  });

  doc.save(`history_${Date.now()}.pdf`);
}

// ---------------------------
// Favorites
// ---------------------------
function toggleFavorite(cur) {
  if (!cur) return;

  if (favorites.includes(cur)) {
    favorites = favorites.filter((x) => x !== cur);
  } else {
    favorites.push(cur);
  }

  localStorage.setItem("fav_currencies", JSON.stringify(favorites));
  populateSelects();
}

function renderFavoritesUI() {
  favFromBtn.textContent = favorites.includes(fromSel.value) ? "★" : "☆";
  favToBtn.textContent = favorites.includes(toSel.value) ? "★" : "☆";
}

// ---------------------------
// UI Events
// ---------------------------
convertBtn.onclick = convert;
swapBtn.onclick = () => {
  const temp = fromSel.value;
  fromSel.value = toSel.value;
  toSel.value = temp;
  fetchRates(fromSel.value);
  renderFavoritesUI();
};

refreshBtn.onclick = () => fetchRates(fromSel.value);
populateExample.onclick = () => {
  amountInput.value = "10";
  fromSel.value = "USD";
  toSel.value = "INR";
  convert();
};

clearHistoryBtn.onclick = () => {
  if (confirm("Clear history?")) clearHistory();
};

downloadCSV.onclick = downloadHistoryCSV;
downloadPDF.onclick = downloadHistoryPDF;

themeSwitch.onchange = (e) => {
  document.body.setAttribute("data-theme", e.target.value);
  localStorage.setItem("conv_theme", e.target.value);
};

favFromBtn.onclick = () => toggleFavorite(fromSel.value);
favToBtn.onclick = () => toggleFavorite(toSel.value);

menuToggle.onclick = () => navbar.classList.toggle("show");

// ---------------------------
// INIT
// ---------------------------
(function init() {
  const savedTheme = localStorage.getItem("conv_theme");
  if (savedTheme) {
    themeSwitch.value = savedTheme;
    document.body.setAttribute("data-theme", savedTheme);
  }

  loadSymbols();
  renderHistory();
})();

// ---------------------------
// PWA service worker
// ---------------------------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch((e) =>
    console.warn("SW failed:", e)
  );
}
