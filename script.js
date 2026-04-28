const G_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzeXfwbFMaC8WH3th-aw5_PtMGTlz6UHMC5S5tWs9j1FW-G_Fszldy9QqiY5Zps-mFGQg/exec";

const floor = document.getElementById("floor");
const container = document.getElementById("floorContainer");
const searchBox = document.getElementById("searchBox");
const suggestions = document.getElementById("suggestions");
const panel = document.getElementById("sidePanel");
const panelContent = document.getElementById("panelContent");
const legend = document.getElementById("legend");

let allData = [];
let zoomLevel = 0.4;
let activeFilters = {
    status: {available:true, sold:true, booked:true, agent:true},
    type: {shell:true, space:true},
    all: true
};

/* CLEAN */
function cleanText(val) {
    if (!val) return "";
    return String(val).replace(/\s+/g, " ").trim();
}

/* NORMALIZE */
function normalizeId(id) {
    return String(id || "").replace(/\s+/g, "").toLowerCase();
}

/* STATUS */
function getStatus(row) {
    const s = cleanText(row.status).toLowerCase();
    if (["available","sold","booked","agent"].includes(s)) return s;
    return "available";
}

/* TYPE */
function getBoothType(row) {
    if (!row || !row.type) return "shell";
    const t = cleanText(row.type).toLowerCase();
    return t.includes("space") ? "space" : "shell";
}

/* LOAD DATA (FIXED) */
async function loadData() {
    try {
        const res = await fetch(`${G_SCRIPT_URL}?cmd=read&t=${Date.now()}`);
        const raw = await res.json(); // ✅ FIXED

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
                    display: id,
                    exhibitor: cleanText(row.exhibitor),
                    status: getStatus(row),
                    type: getBoothType(row),
                    sqm: each
                });
            });
        });

        allData = expanded;
        renderFloor();

        floor.style.transform = `scale(${zoomLevel})`;

    } catch (err) {
        console.error("LOAD ERROR:", err);
        alert("❌ Data failed to load\n" + err.message);
    }
}

/* HALL CONFIG */
const hallConfig = [
  {name:"Hall 5", start:5001, end:5078},
  {name:"Hall 6", start:6001, end:6189},
  {name:"Hall 7", start:7001, end:7196},
  {name:"Hall 8", start:8001, end:8181},
  {name:"Hall 9", start:9001, end:9191},
  {name:"Hall 10", start:1001, end:1151},
  {name:"Ambulance", start:"A", end:"Z"}
];

/* FILTER */
function shouldShowBooth(booth) {
    if (activeFilters.all) return true;
    return activeFilters.status[booth.status] && activeFilters.type[booth.type];
}

/* CREATE BOOTH */
function createBooth(id) {
    const norm = normalizeId(id);
    let match = allData.find(x => x.boothid === norm);

    if (!match) {
        match = allData.find(x => x.boothid.startsWith(norm + "-"));
    }

    const b = document.createElement("div");
    b.className = "booth";
    b.dataset.id = norm;
    b.dataset.status = match ? match.status : "available";
    b.dataset.type = match ? match.type : "shell";

    const displayName = match ? match.display : id;

    b.classList.add(match ? match.status : "available");

    const textSpan = document.createElement("span");
    textSpan.innerText = displayName;
    b.appendChild(textSpan);

    if (match) {
        const indicator = document.createElement("div");
        indicator.className = `booth-indicator type-${match.type}`;
        b.appendChild(indicator);

        b.dataset.tooltip = match.exhibitor
            ? `${match.exhibitor} • ${match.sqm} Sqm`
            : `AVAILABLE • ${match.sqm} Sqm`;
    }

    b.style.display = shouldShowBooth({
        status: b.dataset.status,
        type: b.dataset.type
    }) ? "flex" : "none";

    b.onclick = (e) => {
        e.stopPropagation();

        document.querySelectorAll(".highlight, .blink")
            .forEach(x => x.classList.remove("highlight","blink"));

        b.classList.add("highlight","blink");

        panel.classList.remove("hidden");
        panelContent.innerHTML = `
            <b>Booth:</b> ${displayName}<br>
            <b>Size:</b> ${match?.sqm || "-"} Sqm<br>
            <b>Status:</b> ${b.dataset.status.toUpperCase()}<br>
            <b>Type:</b> ${b.dataset.type === 'space' ? 'Space Only' : 'Standard Booth'}<br>
            <b>Exhibitor:</b> ${match?.exhibitor || "-"}
        `;
    };

    return b;
}

/* RENDER */
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

        ids.forEach(id=>{
            const booth = createBooth(id);
            grid.appendChild(booth);

            counts[booth.dataset.status]++;
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

/* SEARCH (FIXED) */
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
            if (el) el.click();

            searchBox.value = "";
            suggestions.style.display = "none";
        };

        suggestions.appendChild(div);
    });
});

/* DRAG */
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

/* ZOOM */
document.getElementById("zoomIn").onclick=()=>{
    zoomLevel+=0.1;
    floor.style.transform=`scale(${zoomLevel})`;
};
document.getElementById("zoomOut").onclick=()=>{
    zoomLevel=Math.max(0.3,zoomLevel-0.1);
    floor.style.transform=`scale(${zoomLevel})`;
};

/* CLOSE PANEL */
document.addEventListener("click",()=>{
    panel.classList.add("hidden");
    suggestions.style.display="none";
});

/* INIT */
loadData();
