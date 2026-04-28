const G_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzeXfwbFMaC8WH3th-aw5_PtMGTlz6UHMC5S5tWs9j1FW-G_Fszldy9QqiY5Zps-mFGQg/exec";

const floor = document.getElementById("floor");
const container = document.getElementById("floorContainer");
const searchBox = document.getElementById("searchBox");
const suggestions = document.getElementById("suggestions");
const panel = document.getElementById("sidePanel");
const panelContent = document.getElementById("panelContent");
const legend = document.getElementById("legend");

let allData = [];
let zoomLevel = 0.4; // Default zoom to show ~3 halls
let activeFilters = {status: {available:true, sold:true, booked:true, agent:true}, type: {shell:true, space:true}, all: true};

/* =========================
   CLEAN TEXT
========================= */
function cleanText(val) {
    if (!val) return "";
    return String(val).replace(/\s+/g, " ").trim();
}

/* =========================
   NORMALIZE ID (only for internal matching)
========================= */
function normalizeId(id) {
    return String(id || "").replace(/\s+/g, "").toLowerCase();
}

/* =========================
   STATUS
========================= */
function getStatus(row) {
    const s = cleanText(row.status).toLowerCase();
    if (["available","sold","booked","agent"].includes(s)) return s;
    return "available";
}

/* =========================
   GET BOOTH TYPE
========================= */
function getBoothType(row) {
    if (!row || !row.type) return "shell"; // default to shell
    const t = cleanText(row.type).toLowerCase();
    return t.includes("space") ? "space" : "shell";
}

/* =========================
   LOAD DATA (FIXED 100%)
========================= */
async function loadData() {
    try {
        const res = await fetch(`${G_SCRIPT_URL}?cmd=read&t=${Date.now()}`);

        console.log("HTTP STATUS:", res.status);

        const text = await res.text();

        console.log("RAW RESPONSE:", text);

        // ❌ If Apps Script returns HTML or empty
        if (!text || text.startsWith("<")) {
            throw new Error("Invalid response (HTML or empty)");
        }

        let raw;
        try {
            raw = JSON.parse(text);
        } catch (e) {
            throw new Error("Response is not valid JSON");
        }

        const expanded = [];

        raw.forEach(row => {
            if (!row.boothid) return;

            const booths = String(row.boothid)
                .split(",")
                .map(x => x.trim())
                .filter(Boolean);

            const size = parseFloat(row.size) || 0;
            const each = booths.length ? size / booths.length : 0;

            booths.forEach(id => {
                expanded.push({
                    boothid: normalizeId(id),
                    display: id, // Keep original name with suffixes like 5072-A
                    exhibitor: cleanText(row.exhibitor),
                    status: getStatus(row),
                    type: getBoothType(row),
                    sqm: each
                });
            });
        });

        allData = expanded;
        renderFloor();
        
        // Apply default zoom after rendering
        floor.style.transform = `scale(${zoomLevel})`;

    } catch (err) {
        console.error("LOAD ERROR:", err);
        alert("❌ Data failed to load\n" + err.message);
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
   SHOULD BOOTH BE VISIBLE
========================= */
function shouldShowBooth(booth) {
    if (activeFilters.all) return true;
    const statusMatch = activeFilters.status[booth.status];
    const typeMatch = activeFilters.type[booth.type];
    return statusMatch && typeMatch;
}

/* =========================
   CREATE BOOTH
========================= */
function createBooth(id) {
    const norm = normalizeId(id);
    let match = allData.find(x => x.boothid === norm);
    
    // If no exact match, try to find a booth with a suffix (e.g., 5072-A for 5072)
    if (!match) {
        match = allData.find(x => x.boothid.startsWith(norm + "-") || x.boothid.startsWith(norm + "a"));
    }

    const b = document.createElement("div");
    b.className = "booth";
    b.dataset.id = norm;
    b.dataset.status = match ? match.status : "available";
    b.dataset.type = match ? match.type : "shell";

    const displayName = match ? match.display : id;

    if (!match) {
        b.classList.add("available");
        const textSpan = document.createElement("span");
        textSpan.innerText = displayName;
        b.appendChild(textSpan);
        b.style.display = shouldShowBooth({status: "available", type: "shell"}) ? "flex" : "none";
        return b;
    }

    b.classList.add(match.status);
    
    const textSpan = document.createElement("span");
    textSpan.innerText = displayName;
    b.appendChild(textSpan);

    const indicator = document.createElement("div");
    indicator.className = `booth-indicator type-${match.type}`;
    b.appendChild(indicator);

    b.dataset.tooltip = match.exhibitor
        ? `${match.exhibitor} • ${match.sqm} Sqm`
        : `AVAILABLE • ${match.sqm} Sqm`;

    b.style.display = shouldShowBooth(match) ? "flex" : "none";

    b.onclick = (e) => {
        e.stopPropagation();

        document.querySelectorAll(".highlight, .blink")
            .forEach(x => x.classList.remove("highlight","blink"));

        b.classList.add("highlight","blink");

        setTimeout(() => b.classList.remove("blink"), 5000);

        panel.classList.remove("hidden");
        panelContent.innerHTML = `
            <b>Booth:</b> ${displayName}<br>
            <b>Size:</b> ${match.sqm} Sqm<br>
            <b>Status:</b> ${match.status.toUpperCase()}<br>
            <b>Type:</b> ${match.type === 'space' ? 'Space Only' : 'Standard Booth'}<br>
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

        const header = document.createElement("div");
        header.className = "hall-header";

        const title = document.createElement("h3");
        title.innerText = hall.name;

        const summary = document.createElement("div");
        summary.className = "hall-summary";

        const counts = {available:0,sold:0,booked:0,agent:0};

        const grid = document.createElement("div");
        grid.className = "grid";

        let ids = [];

        if (hall.name === "Ambulance") {
            for (let i=65;i<=90;i++) ids.push(String.fromCharCode(i));
        } else {
            for (let i=hall.start;i<=hall.end;i++) ids.push(String(i));
        }

        ids.forEach(id => {
            const booth = createBooth(id);
            grid.appendChild(booth);

            const s = booth.dataset.status;
            if(counts[s] !== undefined) counts[s]++;
        });

        ["available","sold","booked","agent"].forEach(s=>{
            const chip = document.createElement("div");
            chip.className="count-chip";
            chip.innerHTML=`<span class="dot ${s}"></span> <strong>${counts[s]}</strong>`;
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
   LEGEND CLICK HANDLING
========================= */
legend.addEventListener("click", (e) => {
    const item = e.target.closest(".legend-item");
    if (!item) return;

    const filter = item.dataset.filter;
    const type = item.dataset.type;

    if (filter) {
        if (filter === "all") {
            // Toggle all status filters
            const allActive = Object.values(activeFilters.status).every(v => v);
            activeFilters.status = {available: !allActive, sold: !allActive, booked: !allActive, agent: !allActive};
            activeFilters.all = !allActive;
            
            // Update all legend items
            document.querySelectorAll(".legend-item[data-filter]").forEach(el => {
                if (el.dataset.filter !== "all") {
                    el.classList.toggle("active");
                }
            });
        } else {
            activeFilters.status[filter] = !activeFilters.status[filter];
            activeFilters.all = Object.values(activeFilters.status).every(v => v);
        }
        item.classList.toggle("active");
    }

    if (type) {
        activeFilters.type[type] = !activeFilters.type[type];
        item.classList.toggle("active");
    }

    // Re-render booths with visibility toggle
    document.querySelectorAll(".booth").forEach(booth => {
        const boothData = {
            status: booth.dataset.status,
            type: booth.dataset.type
        };
        booth.style.display = shouldShowBooth(boothData) ? "flex" : "none";
    });
});

/* =========================
   SEARCH
========================= */
searchBox.addEventListener("input", () => {
    const val = searchBox.value.toLowerCase();
    suggestions.innerHTML = "";

    const result = allData.filter(x =>
        x.boothid.includes(val) ||
        (x.exhibitor || "").toLowerCase().includes(val)
    );

    suggestions.style.display = result.length ? "block" : "none";

    result.forEach(x => {
        const div = document.createElement("div");
        div.className = "suggestionItem";
        div.innerText = `${x.display} - ${x.exhibitor}`;

        div.onclick = () => {
            const el = document.querySelector(`[data-id='${x.boothid}']`);
            if (el) {
                // Make sure booth is visible (handle filters)
                el.style.display = "flex";
                
                // Force a small delay to ensure element is rendered
                setTimeout(() => {
                    // Scroll to booth position
                    const rect = el.getBoundingClientRect();
                    const parentRect = floor.getBoundingClientRect();
                    
                    // Get position relative to floor
                    let booth = el;
                    let offsetX = 0;
                    let offsetY = 0;
                    
                    while (booth && booth !== floor) {
                        offsetX += booth.offsetLeft;
                        offsetY += booth.offsetTop;
                        booth = booth.offsetParent;
                    }
                    
                    // Account for zoom level and container dimensions
                    const boothCenterX = offsetX + (el.offsetWidth / 2);
                    const boothCenterY = offsetY + (el.offsetHeight / 2);
                    
                    const containerCenterX = container.clientWidth / 2;
                    const containerCenterY = container.clientHeight / 2;
                    
                    const targetScrollX = (boothCenterX * zoomLevel) - containerCenterX;
                    const targetScrollY = (boothCenterY * zoomLevel) - containerCenterY;
                    
                    container.scrollLeft = targetScrollX;
                    container.scrollTop = targetScrollY;
                    
                    // Trigger booth click to show panel
                    setTimeout(() => {
                        el.click();
                    }, 100);
                }, 50);
            }
            searchBox.value = "";
            suggestions.style.display = "none";
        };
            searchBox.value = "";
            suggestions.style.display = "none";
        };

        suggestions.appendChild(div);
    });
});

/* =========================
   DRAG
========================= */
let isDown=false,startX,startY,scrollLeft,scrollTop;

container.addEventListener("mousedown",e=>{
    isDown=true;
    startX=e.pageX;
    startY=e.pageY;
    scrollLeft=container.scrollLeft;
    scrollTop=container.scrollTop;
});
container.addEventListener("mouseup",()=>isDown=false);
container.addEventListener("mouseleave",()=>isDown=false);

container.addEventListener("mousemove",e=>{
    if(!isDown) return;
    container.scrollLeft=scrollLeft-(e.pageX-startX);
    container.scrollTop=scrollTop-(e.pageY-startY);
});

/* =========================
   ZOOM
========================= */
// Button zoom
document.getElementById("zoomIn").onclick=()=>{
    zoomLevel+=0.1;
    floor.style.transform=`scale(${zoomLevel})`;
};
document.getElementById("zoomOut").onclick=()=>{
    zoomLevel=Math.max(0.3,zoomLevel-0.1);
    floor.style.transform=`scale(${zoomLevel})`;
};

// Mouse wheel zoom
container.addEventListener("wheel", (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        zoomLevel = Math.max(0.3, Math.min(3, zoomLevel + delta));
        floor.style.transform = `scale(${zoomLevel})`;
    }
}, {passive: false});

/* =========================
   CLOSE PANEL
========================= */
document.addEventListener("click",()=>{
    panel.classList.add("hidden");
    suggestions.style.display="none";
});

/* INIT */
loadData();
