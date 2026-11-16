
"use strict";

/* =========================================================
   SMART METER ANALYTICS
   Visualizations are limited to the project PPT scope.
   ========================================================= */

const COLORS = {
    positive: "#43df91",
    negative: "#fb7185",
    neutral: "#64a5ff",
    cyan: "#42e5ef",
    purple: "#a78bfa",
    orange: "#ffb45e",
    text: "#eaf1ff",
    muted: "#9cafcb",
    grid: "rgba(145, 170, 210, 0.13)",
    surface: "#111c30"
};

const SENTIMENT_ORDER = ["Positive", "Negative", "Neutral"];
const PLATFORM_ORDER = ["Reddit", "Instagram", "Twitter", "LinkedIn", "Facebook"];

const SENTIMENT_COLORS = {
    Positive: COLORS.positive,
    Negative: COLORS.negative,
    Neutral: COLORS.neutral
};

const COUNTRY_CODES = {
    "India": "IND",
    "USA": "USA",
    "United States": "USA",
    "United States of America": "USA",
    "UK": "GBR",
    "United Kingdom": "GBR",
    "Germany": "DEU",
    "Canada": "CAN",
    "Australia": "AUS"
};

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

let allRows = [];
let filteredRows = [];
let currentPage = 1;
let selectedCountryFromMap = null;

const $ = (id) => document.getElementById(id);

const formatNumber = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 1
    });

const numeric = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const cleanText = (value) =>
    value === null || value === undefined || String(value).trim() === ""
        ? "Unknown"
        : String(value).trim();

const normalizeSentiment = (value) => {
    const v = cleanText(value).toLowerCase();
    if (v === "positive") return "Positive";
    if (v === "negative") return "Negative";
    if (v === "neutral") return "Neutral";
    return "Unknown";
};

const getMonthKey = (row) => {
    const raw = row.Timestamp || row.timestamp || "";
    if (!raw) return "Unknown";

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "Unknown";

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthLabel = (key) => {
    if (!key || key === "Unknown") return "Unknown";

    const [year, month] = key.split("-").map(Number);
    if (!year || !month || !MONTH_NAMES[month - 1]) return key;

    return `${MONTH_NAMES[month - 1]} ${year}`;
};

function normalizeRow(row, index) {
    const likes = numeric(row.Likes ?? row.likes);
    const retweets = numeric(row.Retweets ?? row.retweets);
    const sentiment = normalizeSentiment(row.Sentiment ?? row.sentiment);

    return {
        ...row,
        _id: index,
        Timestamp: cleanText(row.Timestamp ?? row.timestamp),
        Country: cleanText(row.Country ?? row.country),
        Platform: cleanText(row.Platform ?? row.platform),
        Sentiment: sentiment,
        Hashtags: cleanText(row.Hashtags ?? row.hashtags),
        Text: cleanText(row.Text ?? row.text),
        Likes: likes,
        Retweets: retweets,
        Engagement: likes + retweets,
        _monthKey: getMonthKey(row)
    };
}

/* ---------- Theme ---------- */

function applyPlotTheme() {
    const light = document.body.classList.contains("light-mode");

    return {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: {
            family: "Inter, Segoe UI, Arial, sans-serif",
            color: light ? "#263852" : COLORS.text,
            size: 12
        },
        margin: { t: 25, r: 20, b: 55, l: 55 },
        hoverlabel: {
            bgcolor: light ? "#ffffff" : "#17243b",
            bordercolor: light ? "#cbd7e8" : "#304664",
            font: {
                color: light ? "#17243b" : "#ffffff",
                size: 12
            }
        },
        xaxis: {
            gridcolor: light ? "#e2e8f1" : COLORS.grid,
            zerolinecolor: light ? "#d8e1ee" : COLORS.grid,
            linecolor: light ? "#d8e1ee" : COLORS.grid,
            automargin: true
        },
        yaxis: {
            gridcolor: light ? "#e2e8f1" : COLORS.grid,
            zerolinecolor: light ? "#d8e1ee" : COLORS.grid,
            linecolor: light ? "#d8e1ee" : COLORS.grid,
            automargin: true
        },
        legend: {
            orientation: "h",
            x: 0,
            y: -0.18,
            font: { size: 11 }
        }
    };
}

const chartConfig = {
    responsive: true,
    displaylogo: false,
    scrollZoom: false,
    modeBarButtonsToRemove: [
        "select2d",
        "lasso2d",
        "autoScale2d"
    ]
};

function drawChart(id, data, layout) {
    const element = $(id);
    if (!element || typeof Plotly === "undefined") return;

    Plotly.react(
        element,
        data,
        { ...applyPlotTheme(), ...layout },
        chartConfig
    );
}

/* ---------- Dropdown options ---------- */

function setOptions(id, values, firstLabel) {
    const select = $(id);
    if (!select) return;

    const previous = select.value;
    const unique = [...new Set(values)]
        .filter(v => v && v !== "Unknown")
        .sort((a, b) => a.localeCompare(b));

    select.innerHTML = "";

    const first = document.createElement("option");
    first.value = "All";
    first.textContent = firstLabel;
    select.appendChild(first);

    unique.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });

    if (unique.includes(previous)) {
        select.value = previous;
    }
}

function populateFilters() {
    setOptions(
        "countryFilter",
        allRows.map(r => r.Country),
        "All countries"
    );

    setOptions(
        "platformFilter",
        allRows.map(r => r.Platform),
        "All platforms"
    );

    setOptions(
        "sentimentFilter",
        allRows.map(r => r.Sentiment).filter(s => s !== "Unknown"),
        "All sentiments"
    );

    const months = [...new Set(allRows.map(r => r._monthKey))]
        .filter(m => m !== "Unknown")
        .sort();

    const monthSelect = $("monthFilter");
    const oldMonth = monthSelect.value;

    monthSelect.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "All";
    allOption.textContent = "All months";
    monthSelect.appendChild(allOption);

    months.forEach(month => {
        const option = document.createElement("option");
        option.value = month;
        option.textContent = getMonthLabel(month);
        monthSelect.appendChild(option);
    });

    if (months.includes(oldMonth)) {
        monthSelect.value = oldMonth;
    }
}

/* ---------- Filtering ---------- */

function applyFilters() {
    const month = $("monthFilter").value;
    const country = $("countryFilter").value;
    const platform = $("platformFilter").value;
    const sentiment = $("sentimentFilter").value;

    filteredRows = allRows.filter(row => {
        return (
            (month === "All" || row._monthKey === month) &&
            (country === "All" || row.Country === country) &&
            (platform === "All" || row.Platform === platform) &&
            (sentiment === "All" || row.Sentiment === sentiment)
        );
    });

    currentPage = 1;

    const summary = `${formatNumber(filteredRows.length)} of ${formatNumber(allRows.length)} posts shown`;
    $("filterSummary").textContent = summary;

    updateDashboard();
}

/* ---------- KPI cards ---------- */

function updateKPIs(rows) {
    const total = rows.length;
    const positive = rows.filter(r => r.Sentiment === "Positive").length;
    const likes = rows.reduce((sum, r) => sum + r.Likes, 0);
    const retweets = rows.reduce((sum, r) => sum + r.Retweets, 0);
    const engagement = likes + retweets;
    const positivePercent = total ? positive / total * 100 : 0;

    $("kpiPosts").textContent = formatNumber(total);
    $("kpiPositive").textContent = formatNumber(positive);
    $("kpiPositiveFoot").textContent =
        `${positivePercent.toFixed(1)}% of current posts`;
    $("kpiLikes").textContent = formatNumber(likes);
    $("kpiRetweets").textContent = formatNumber(retweets);
    $("kpiEngagement").textContent = formatNumber(engagement);
}

/* ---------- 1. Sentiment distribution ---------- */

function renderSentiment(rows) {
    const counts = SENTIMENT_ORDER.map(sentiment =>
        rows.filter(r => r.Sentiment === sentiment).length
    );

    drawChart("sentimentChart", [{
        type: "pie",
        hole: 0.66,
        labels: SENTIMENT_ORDER,
        values: counts,
        sort: false,
        direction: "clockwise",
        marker: {
            colors: SENTIMENT_ORDER.map(s => SENTIMENT_COLORS[s]),
            line: {
                color: document.body.classList.contains("light-mode")
                    ? "#ffffff" : "#111c30",
                width: 4
            }
        },
        textinfo: "label+percent",
        textposition: "inside",
        insidetextfont: { color: "#ffffff", size: 12 },
        hovertemplate:
            "<b>%{label}</b><br>" +
            "Posts: %{value:,}<br>" +
            "Share: %{percent}<extra></extra>"
    }], {
        margin: { t: 20, r: 15, b: 35, l: 15 },
        showlegend: true,
        legend: { orientation: "h", x: 0.02, y: -0.08 },
        uniformtext: { minsize: 10, mode: "hide" }
    });
}

/* ---------- 2. Platform-wise sentiment ---------- */

function renderPlatform(rows) {
    const platforms = [...new Set(rows.map(r => r.Platform))]
        .filter(p => p !== "Unknown")
        .sort((a, b) => {
            const ai = PLATFORM_ORDER.indexOf(a);
            const bi = PLATFORM_ORDER.indexOf(b);
            if (ai < 0 && bi < 0) return a.localeCompare(b);
            if (ai < 0) return 1;
            if (bi < 0) return -1;
            return ai - bi;
        });

    const traces = SENTIMENT_ORDER.map(sentiment => ({
        type: "bar",
        name: sentiment,
        x: platforms,
        y: platforms.map(platform =>
            rows.filter(r =>
                r.Platform === platform && r.Sentiment === sentiment
            ).length
        ),
        marker: { color: SENTIMENT_COLORS[sentiment] },
        hovertemplate:
            "<b>%{x}</b><br>" + sentiment +
            " posts: %{y:,}<extra></extra>"
    }));

    drawChart("platformChart", traces, {
        barmode: "stack",
        margin: { t: 20, r: 15, b: 70, l: 55 },
        xaxis: { title: "Platform", tickangle: -15 },
        yaxis: { title: "Number of posts", rangemode: "tozero" },
        legend: { orientation: "h", x: 0, y: -0.24 }
    });
}

/* ---------- 3. Monthly discussion trend ---------- */

function renderMonthly(rows) {
    const monthly = {};

    rows.forEach(row => {
        if (row._monthKey === "Unknown") return;

        if (!monthly[row._monthKey]) {
            monthly[row._monthKey] = {
                total: 0,
                Positive: 0,
                Negative: 0,
                Neutral: 0
            };
        }

        monthly[row._monthKey].total += 1;

        if (SENTIMENT_ORDER.includes(row.Sentiment)) {
            monthly[row._monthKey][row.Sentiment] += 1;
        }
    });

    const keys = Object.keys(monthly).sort();

    const traces = [
        {
            type: "scatter",
            mode: "lines+markers",
            name: "Total posts",
            x: keys.map(getMonthLabel),
            y: keys.map(k => monthly[k].total),
            line: { color: COLORS.cyan, width: 3, shape: "spline" },
            marker: {
                size: 9,
                color: COLORS.cyan,
                line: { color: "#102039", width: 2 }
            },
            hovertemplate:
                "<b>%{x}</b><br>Total posts: %{y:,}<extra></extra>"
        }
    ];

    drawChart("monthlyChart", traces, {
        margin: { t: 20, r: 20, b: 65, l: 55 },
        xaxis: { title: "Month", tickangle: -15 },
        yaxis: { title: "Number of posts", rangemode: "tozero" },
        showlegend: false
    });
}

/* ---------- 4. Country-wise sentiment map ---------- */

function renderCountryMap(rows) {
    const countryMap = {};

    rows.forEach(row => {
        const country = row.Country;
        if (country === "Unknown") return;

        if (!countryMap[country]) {
            countryMap[country] = {
                posts: 0,
                likes: 0,
                retweets: 0,
                engagement: 0,
                Positive: 0,
                Negative: 0,
                Neutral: 0,
                platforms: {}
            };
        }

        const item = countryMap[country];
        item.posts += 1;
        item.likes += row.Likes;
        item.retweets += row.Retweets;
        item.engagement += row.Engagement;

        if (SENTIMENT_ORDER.includes(row.Sentiment)) {
            item[row.Sentiment] += 1;
        }

        item.platforms[row.Platform] =
            (item.platforms[row.Platform] || 0) + 1;
    });

    const countries = Object.keys(countryMap).filter(
        country => COUNTRY_CODES[country]
    );

    if (!countries.length) {
        drawChart("countryChart", [], {
            title: { text: "No recognized country data available" }
        });
        return;
    }

    const codes = countries.map(country => COUNTRY_CODES[country]);
    const details = countries.map(country => countryMap[country]);

    const hoverText = countries.map((country, i) => {
        const d = details[i];
        const positivePct = d.posts ? d.Positive / d.posts * 100 : 0;
        const negativePct = d.posts ? d.Negative / d.posts * 100 : 0;
        const neutralPct = d.posts ? d.Neutral / d.posts * 100 : 0;

        const topPlatform = Object.entries(d.platforms)
            .sort((a, b) => b[1] - a[1])[0];

        return [
            `<b>${country}</b>`,
            `Total posts: ${formatNumber(d.posts)}`,
            `Positive: ${formatNumber(d.Positive)} (${positivePct.toFixed(1)}%)`,
            `Negative: ${formatNumber(d.Negative)} (${negativePct.toFixed(1)}%)`,
            `Neutral: ${formatNumber(d.Neutral)} (${neutralPct.toFixed(1)}%)`,
            `Total likes: ${formatNumber(d.likes)}`,
            `Total retweets: ${formatNumber(d.retweets)}`,
            `Total engagement: ${formatNumber(d.engagement)}`,
            `Leading platform: ${topPlatform ? topPlatform[0] : "Unknown"}`
        ].join("<br>");
    });

    drawChart("countryChart", [{
        type: "choropleth",
        locationmode: "ISO-3",
        locations: codes,
        z: details.map(d => d.posts),
        text: hoverText,
        customdata: countries,
        colorscale: [
            [0, "#243e69"],
            [0.25, "#356eb1"],
            [0.50, "#4e9de0"],
            [0.75, "#43c9bc"],
            [1, "#43df91"]
        ],
        marker: {
            line: {
                color: document.body.classList.contains("light-mode")
                    ? "#ffffff" : "#17243b",
                width: 1
            }
        },
        colorbar: {
            title: { text: "Posts" },
            thickness: 12,
            outlinewidth: 0
        },
        hovertemplate: "%{text}<extra></extra>"
    }], {
        margin: { t: 5, r: 5, b: 5, l: 5 },
        geo: {
            projection: { type: "natural earth" },
            showframe: false,
            showcoastlines: true,
            coastlinecolor: "#435675",
            showcountries: true,
            countrycolor: "#344966",
            showland: document.body.classList.contains("light-mode"),
            landcolor: document.body.classList.contains("light-mode")
                ? "#edf2f9" : "#142139",
            showocean: true,
            oceancolor: document.body.classList.contains("light-mode")
                ? "#f6f9fd" : "#0d1728",
            bgcolor: "rgba(0,0,0,0)"
        }
    });

    const mapElement = $("countryChart");

    mapElement.removeAllListeners?.("plotly_click");
    mapElement.on("plotly_click", event => {
        const point = event.points?.[0];
        if (!point) return;

        const country = point.customdata;
        const countrySelect = $("countryFilter");

        if (countrySelect && [...countrySelect.options].some(
            option => option.value === country
        )) {
            countrySelect.value = country;
            selectedCountryFromMap = country;
            applyFilters();
        }
    });
}

/* ---------- 5. Hashtag engagement ---------- */

function extractHashtags(value) {
    if (!value || value === "Unknown") return [];

    return [...new Set(
        String(value)
            .split(/[,;\s]+/)
            .map(tag => tag.trim())
            .filter(Boolean)
            .map(tag => tag.startsWith("#") ? tag : `#${tag}`)
    )];
}

function renderHashtags(rows) {
    const groups = {};

    rows.forEach(row => {
        extractHashtags(row.Hashtags).forEach(tag => {
            if (!groups[tag]) {
                groups[tag] = { total: 0, count: 0 };
            }

            groups[tag].total += row.Engagement;
            groups[tag].count += 1;
        });
    });

    const top = Object.entries(groups)
        .map(([tag, values]) => ({
            tag,
            average: values.count ? values.total / values.count : 0,
            posts: values.count,
            total: values.total
        }))
        .sort((a, b) => b.average - a.average)
        .slice(0, 10)
        .reverse();

    drawChart("hashtagChart", [{
        type: "bar",
        orientation: "h",
        x: top.map(item => Number(item.average.toFixed(2))),
        y: top.map(item => item.tag),
        customdata: top.map(item => [item.posts, item.total]),
        marker: {
            color: top.map((_, i) =>
                `hsl(${205 + i * 11}, 75%, ${62 - i * 1.5}%)`
            ),
            line: { width: 0 },
            cornerradius: 6
        },
        text: top.map(item => item.average.toFixed(1)),
        textposition: "outside",
        cliponaxis: false,
        hovertemplate:
            "<b>%{y}</b><br>" +
            "Average engagement: %{x:.1f}<br>" +
            "Posts: %{customdata[0]:,}<br>" +
            "Total engagement: %{customdata[1]:,}<extra></extra>"
    }], {
        margin: { t: 15, r: 55, b: 45, l: 120 },
        xaxis: {
            title: "Average engagement per post",
            rangemode: "tozero"
        },
        yaxis: { title: "" },
        showlegend: false
    });
}

/* ---------- Detailed table ---------- */

function getTableRows() {
    const search = $("tableSearch").value.trim().toLowerCase();

    if (!search) return filteredRows;

    return filteredRows.filter(row => [
        row.Timestamp, row.Country, row.Platform, row.Sentiment,
        row.Hashtags, row.Text
    ].join(" ").toLowerCase().includes(search));
}

function addCell(tr, value) {
    const td = document.createElement("td");
    td.textContent = value;
    tr.appendChild(td);
    return td;
}

function renderTable() {
    const rows = getTableRows();
    const pageSize = Number($("pageSize").value) || 10;
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

    currentPage = Math.min(currentPage, pageCount);

    const start = (currentPage - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);
    const tbody = $("postsTableBody");

    tbody.replaceChildren();

    if (!pageRows.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 9;
        td.textContent = "No matching records found.";
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        pageRows.forEach(row => {
            const tr = document.createElement("tr");

            addCell(tr, row.Timestamp);
            addCell(tr, row.Country);
            addCell(tr, row.Platform);

            const sentimentCell = addCell(tr, row.Sentiment);
            sentimentCell.className =
                "sentiment-cell sentiment-" +
                row.Sentiment.toLowerCase();

            addCell(tr, row.Hashtags);
            addCell(tr, formatNumber(row.Likes));
            addCell(tr, formatNumber(row.Retweets));
            addCell(tr, formatNumber(row.Engagement));
            addCell(tr, row.Text);

            tbody.appendChild(tr);
        });
    }

    $("tableCount").textContent =
        `${formatNumber(rows.length)} matching records`;

    $("pageInfo").textContent =
        `Page ${currentPage} of ${pageCount}`;

    $("previousPage").disabled = currentPage <= 1;
    $("nextPage").disabled = currentPage >= pageCount;
}

/* ---------- CSV export ---------- */

function csvEscape(value) {
    const str = String(value ?? "");
    return `"${str.replace(/"/g, '""')}"`;
}

function exportCSV() {
    if (!filteredRows.length) {
        alert("There are no records to export in the current view.");
        return;
    }

    const columns = [
        "Timestamp", "Country", "Platform", "Sentiment",
        "Hashtags", "Likes", "Retweets", "Engagement", "Text"
    ];

    const lines = [
        columns.map(csvEscape).join(","),
        ...filteredRows.map(row =>
            columns.map(column => csvEscape(row[column])).join(",")
        )
    ];

    const blob = new Blob(
        ["\uFEFF" + lines.join("\r\n")],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "smart_meter_analytics_filtered.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

/* ---------- Dashboard refresh ---------- */

function updateDashboard() {
    updateKPIs(filteredRows);
    renderSentiment(filteredRows);
    renderPlatform(filteredRows);
    renderMonthly(filteredRows);
    renderCountryMap(filteredRows);
    renderHashtags(filteredRows);
    renderTable();
}

function resetFilters() {
    $("monthFilter").value = "All";
    $("countryFilter").value = "All";
    $("platformFilter").value = "All";
    $("sentimentFilter").value = "All";
    $("tableSearch").value = "";

    selectedCountryFromMap = null;
    applyFilters();
}

async function loadDataset() {
    $("dataStatus").textContent = "Loading dataset...";

    try {
        const response = await fetch("/api/data", {
            headers: { "Accept": "application/json" }
        });

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        const payload = await response.json();

        if (!payload.loaded || !Array.isArray(payload.rows)) {
            allRows = [];
            filteredRows = [];
            updateDashboard();

            $("dataStatus").textContent =
                "No dataset loaded. Upload your cleaned CSV to begin.";
            return;
        }

        allRows = payload.rows.map(normalizeRow);
        populateFilters();
        applyFilters();

        $("dataStatus").textContent =
            `Dataset loaded successfully · ${formatNumber(allRows.length)} records`;
    } catch (error) {
        console.error("Dataset loading error:", error);
        $("dataStatus").textContent =
            "Could not load the dataset. Check that Flask is running and /api/data is available.";
    }
}

/* ---------- Events ---------- */

["monthFilter", "countryFilter", "platformFilter", "sentimentFilter"]
    .forEach(id => {
        $(id).addEventListener("change", () => {
            selectedCountryFromMap = null;
            applyFilters();
        });
    });

$("resetFilters").addEventListener("click", resetFilters);
$("exportButton").addEventListener("click", exportCSV);

$("tableSearch").addEventListener("input", () => {
    currentPage = 1;
    renderTable();
});

$("pageSize").addEventListener("change", () => {
    currentPage = 1;
    renderTable();
});

$("previousPage").addEventListener("click", () => {
    currentPage = Math.max(1, currentPage - 1);
    renderTable();
});

$("nextPage").addEventListener("click", () => {
    currentPage += 1;
    renderTable();
});

$("themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    $("themeToggle").textContent =
        document.body.classList.contains("light-mode") ? "☾" : "☼";
    updateDashboard();
});

$("datasetFile").addEventListener("change", event => {
    const file = event.target.files?.[0];
    $("fileName").textContent = file
        ? file.name
        : "Choose a CSV dataset";
});

/* Start */
document.addEventListener("DOMContentLoaded", loadDataset);
