// UPDATE THIS with your own latest Web App URL (must end with /exec)
const G_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzeXfwbFMaC8WH3th-aw5_PtMGTlz6UHMC5S5tWs9j1FW-G_Fszldy9QqiY5Zps-mFGQg/exec";

const floor = document.getElementById("floor");
const container = document.getElementById("floorContainer");
const searchBox = document.getElementById("searchBox");
const suggestions = document.getElementById("suggestions");
const panel = document.getElementById("sidePanel");
const panelContent = document.getElementById("panelContent");

let allData = [];
let zoomLevel = 1;

/* =========================
   CLEAN TEXT
========================= */
function cleanText(val) {
    if (!val) return "";
    return String(val).replace(/\s+/g, " ").trim();
}

/* =========================
   NORMALIZE ID (KEEP -A)
========================= */
function normalizeId(id) {
    return String(id || "").replace(/\s+/g, "").toLowerCase();
}

/* =========================
   FORMAT DISPLAY ID (-a to -A)
========================= */
function formatDisplayId(id) {
    return id.replace(/-([a-z])$/, (_, c) => "-" + c.toUpperCase());
}

/* =========================
   GET VARIANTS (for -A, -B, etc)
========================= */
function getVariants(baseId) {
    const normalized = normalizeId(baseId);
    return allData.filter(x => normalizeId(x.boothid).startsWith(normalized + "-"));
}

/* =========================
   STATUS
========================= */
function getStatus(row) {
    const s = cleanText(row.status).toLowerCase();
    if (["available", "sold", "booked", "agent"].includes(s)) return s;
    return "available";
}

/* =========================
   LOAD DATA (SAFE)
========================= */
async function loadData() {
    try {
        const res = await fetch(`${G_SCRIPT_URL}?cmd=read&t=${Date.now()}`);

        if (!res.ok) {
            throw new Error("HTTP " + res.status + " " + res.statusText);
        }

        const raw = await res.json();

        const expanded = [];

        raw.forEach(row => {
            if (!row.boothid) return;

            const booths = String(row.boothid)
                .split(",")
                .map(x => x.trim())
                .filter(Boolean);

            const size = parseFloat(row.size) || 0;
            const eachSize = booths.length ? size / booths.length : 0;

            booths.forEach(id => {
                expanded.push({
                    boothid: normalizeId(id),
                    display: id.trim(),
                    exhibitor: cleanText(row.exhibitor),
                    status: getStatus(row),
                    type: cleanText(row.type) || "Space Only",
                    sqm: eachSize
                });
            });
        });

        allData = expanded;
        renderFloor();

    } catch (err) {
        console.error("LOAD ERROR:", err);
        alert("Data failed to load: " + err.message);
    }
}

/* =========================
   HALL CONFIG
========================= */
const hallConfig = [
  {name:"Hall 5", start:5001, end:5078},
  {name:"Hall 6", start:6001, end:6189},
  {name:"Hall 7", start:7001, end:7196},
  {name:"Hall 8", start:8001, end:8181},
  {name:"Hall 9", start:9001, end:9191},
  {name:"Hall 10", start:1001, end:1151},
  {name:"Ambulance", start:"A", end:"Z"}
];

/* =========================
   CREATE BOOTH
========================= */
function createBooth(id) {
    const norm = normalizeId(id);
    const displayId = formatDisplayId(id);

    const match = allData.find(x => x.boothid === norm);

    const b = document.createElement("div");
    b.className = "booth";

    // for search scrollIntoView
    b.dataset.id = norm;

    if (!match) {
        b.classList.add("available");
        b.innerText = displayId;
        return b;
    }

    b.classList.add(match.status);

    // TYPE ARSIR
    if (match.type.toLowerCase().includes("space")) {
        b.classList.add("type-space");
    } else {
        b.classList.add("type-shell");
    }

    b.innerText = displayId;

    // TOOLTIP (clean)
    b.dataset.tooltip = match.exhibitor
        ? `${match.exhibitor} [ ${match.sqm} Sqm ] [ ${match.type} ]`
        : `AVAILABLE [ ${match.sqm} Sqm ]`;

    // CLICK PANEL + BLINK + HIGHLIGHT
    b.onclick = (e) => {
        e.stopPropagation();

        document.querySelectorAll(".highlight, .blink").forEach(x => x.classList.remove("highlight", "blink"));
        b.classList.add("highlight", "blink");

        setTimeout(() => b.classList.remove("highlight", "blink"), 5000);

        panel.classList.remove("hidden");
        panelContent.innerHTML = `
            <b>Booth:</b> ${displayId}<br>
            <b>Size:</b> ${match.sqm} Sqm<br>
            <b>Type:</b> ${match.type}<br>
            <b>Status:</b> ${match.status.toUpperCase()}<br>
            <b>Exhibitor:</b> ${match.exhibitor || "-"}
        `;
    };

    return b;
}

/* =========================
   RENDER FLOOR
========================= */
function renderFloor() {
    floor.innerHTML = "";

    hallConfig.forEach(hall => {

        const hallDiv = document.createElement("div");
        hallDiv.className = "hall";

        // HEADER
        const header = document.createElement("div");
        header.className = "hall-header";

        const title = document.createElement("h3");
        title.innerText = hall.name;

        const summary = document.createElement("div");
        summary.className = "hall-summary";

        const counts = { available: 0, sold: 0, booked: 0, agent: 0 };

        const grid = document.createElement("div");
        grid.className = "grid";

        let ids = [];

        if (hall.name === "Ambulance") {
            for (let i = 65; i <= 90; i++) ids.push(String.fromCharCode(i));
        } else {
            for (let i = hall.start; i <= hall.end; i++) ids.push(String(i));
        }

        ids.forEach(id => {
            const variants = getVariants(String(id));
            if (variants.length > 0) {
                variants.forEach(v => {
                    const booth = createBooth(v.boothid);
                    grid.appendChild(booth);
                    const status = booth.classList[1];
                    if (counts[status] !== undefined) counts[status]++;
                });
            } else {
                const booth = createBooth(id);
                grid.appendChild(booth);
                const status = booth.classList[1];
                if (counts[status] !== undefined) counts[status]++;
            }
        });

        // HORIZONTAL INDICATOR
        ["available", "sold", "booked", "agent"].forEach(s => {
            const chip = document.createElement("div");
            chip.className = "count-chip";
            chip.innerHTML = `
                <span class="dot ${s}"></span>
                <span>${counts[s]}</span>
            `;
            summary.appendChild(chip);
        });

        header.appendChild(title);
        header.appendChild(summary);

        hallDiv.appendChild(header);
        hallDiv.appendChild(grid);

        floor.appendChild(hallDiv);
    });
}

/* =========================
   SEARCH
========================= */
searchBox.addEventListener("input", () => {
    const val = searchBox.value.toLowerCase();
    suggestions.innerHTML = "";

    if (!val) {
        suggestions.style.display = "none";
        return;
    }

    const result = allData.filter(x =>
        x.boothid.includes(val) ||
        (x.exhibitor || "").toLowerCase().includes(val)
    );

    suggestions.style.display = result.length ? "block" : "none";

    result.forEach(x => {
        const div = document.createElement("div");
        div.className = "suggestionItem";
        div.innerHTML = `<b>${formatDisplayId(x.display)}</b><br><small>${x.exhibitor}</small>`;

        div.onclick = () => {
            const el = document.querySelector(`[data-id='${x.boothid}']`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                document.querySelectorAll(".highlight, .blink").forEach(b => b.classList.remove("highlight", "blink"));
                el.classList.add("highlight", "blink");
                setTimeout(() => el.classList.remove("highlight", "blink"), 5000);
                el.click();
            }
            suggestions.style.display = "none";
        };

        suggestions.appendChild(div);
    });
});

/* =========================
   DRAG
========================= */
let isDown = false, startX, startY, scrollLeft, scrollTop;

container.addEventListener("mousedown", (e) => {
    isDown = true;
    startX = e.pageX;
    startY = e.pageY;
    scrollLeft = container.scrollLeft;
    scrollTop = container.scrollTop;
});

container.addEventListener("mouseup", () => isDown = false);
container.addEventListener("mouseleave", () => isDown = false);

container.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    container.scrollLeft = scrollLeft - (e.pageX - startX);
    container.scrollTop = scrollTop - (e.pageY - startY);
});

/* =========================
   ZOOM
========================= */
document.getElementById("zoomIn").onclick = () => {
    zoomLevel += 0.1;
    floor.style.transform = `scale(${zoomLevel})`;
};

document.getElementById("zoomOut").onclick = () => {
    zoomLevel = Math.max(0.4, zoomLevel - 0.1);
    floor.style.transform = `scale(${zoomLevel})`;
};

/* =========================
   CLOSE PANEL
========================= */
document.addEventListener("click", () => {
    panel.classList.add("hidden");
    suggestions.style.display = "none";
});

/* =========================
   INIT
========================= */
loadData();
