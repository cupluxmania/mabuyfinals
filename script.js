const G_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzeXfwbFMaC8WH3th-aw5_PtMGTlz6UHMC5S5tWs9j1FW-G_Fszldy9QqiY5Zps-mFGQg/exec";

const floor = document.getElementById("floor");
const container = document.getElementById("floorContainer");
const searchBox = document.getElementById("searchBox");
const suggestions = document.getElementById("suggestions");
const panel = document.getElementById("sidePanel");
const panelContent = document.getElementById("panelContent");

let allData = [];
let zoomLevel = 1;
let activeFilters = ["available","sold","booked","agent"];

/* LOAD DATA (UNCHANGED CORE) */
async function loadData() {
    try {
        const res = await fetch(`${G_SCRIPT_URL}?t=${Date.now()}`);
        const raw = await res.json();

        const expanded = [];

        raw.forEach(r => {
            if (!r.boothid) return;

            const booths = r.boothid.split(",").map(x => x.trim());
            const size = parseFloat(r.size) || 0;
            const each = booths.length ? size / booths.length : 0;

            booths.forEach(id => {
                expanded.push({
                    boothid: id.toLowerCase(),
                    display: id,
                    exhibitor: r.exhibitor || "",
                    status: (r.status || "available").toLowerCase(),
                    type: r.type || "Space Only",
                    sqm: each
                });
            });
        });

        allData = expanded;
        renderFloor();

    } catch (e) {
        alert("Data failed to load.");
        console.error(e);
    }
}

/* CREATE BOOTH */
function createBooth(id) {
    const match = allData.find(x => x.boothid === id.toLowerCase());

    const b = document.createElement("div");
    b.className = "booth";
    b.dataset.id = id.toLowerCase();

    if (!match) {
        b.classList.add("available");
        b.innerText = id;
        return b;
    }

    b.classList.add(match.status);

    if (match.type.toLowerCase().includes("space")) b.classList.add("type-space");
    else b.classList.add("type-shell");

    b.innerText = match.display;

    b.dataset.tooltip = match.exhibitor
        ? `${match.exhibitor} [ ${match.sqm} Sqm ] [ ${match.type} ]`
        : `AVAILABLE [ ${match.sqm} Sqm ]`;

    b.onclick = (e) => {
        e.stopPropagation();

        document.querySelectorAll(".blink").forEach(x => x.classList.remove("blink"));
        b.classList.add("blink");

        panel.classList.remove("hidden");
        panelContent.innerHTML = `
            Booth: ${match.display}<br>
            Size: ${match.sqm} Sqm<br>
            Type: ${match.type}<br>
            Status: ${match.status}<br>
            Exhibitor: ${match.exhibitor}
        `;
    };

    return b;
}

/* RENDER FLOOR (UNCHANGED STRUCTURE) */
function renderFloor() {
    floor.innerHTML = "";

    const halls = [
        {name:"Hall 5", start:5001, end:5078},
        {name:"Hall 6", start:6001, end:6189},
        {name:"Hall 7", start:7001, end:7196},
        {name:"Hall 8", start:8001, end:8181},
        {name:"Hall 9", start:9001, end:9191},
        {name:"Hall 10", start:1001, end:1151}
    ];

    halls.forEach(h => {
        const hallDiv = document.createElement("div");
        hallDiv.className = "hall";

        const header = document.createElement("div");
        header.className = "hall-header";

        const title = document.createElement("h3");
        title.innerText = h.name;

        const summary = document.createElement("div");
        summary.className = "hall-summary";

        const counts = {available:0,sold:0,booked:0,agent:0};

        const grid = document.createElement("div");
        grid.className = "grid";

        for (let i = h.start; i <= h.end; i++) {
            const booth = createBooth(String(i));
            grid.appendChild(booth);

            const s = booth.classList[1];
            if (counts[s] !== undefined) counts[s]++;
        }

        ["available","sold","booked","agent"].forEach(s=>{
            const chip = document.createElement("div");
            chip.className="count-chip";
            chip.innerHTML=`<span class="dot ${s}"></span>${counts[s]}`;
            summary.appendChild(chip);
        });

        header.appendChild(title);
        header.appendChild(summary);

        hallDiv.appendChild(header);
        hallDiv.appendChild(grid);

        floor.appendChild(hallDiv);
    });

    applyFilter();
}

/* FILTER (SAFE) */
function applyFilter() {
    document.querySelectorAll(".booth").forEach(b => {
        const s = b.classList[1];
        b.style.opacity = activeFilters.includes(s) ? 1 : 0.15;
    });
}

/* LEGEND CLICK */
document.addEventListener("click", (e) => {
    if (!e.target.closest(".legend-item")) return;

    const item = e.target.closest(".legend-item");
    const filter = item.dataset.filter;

    if (filter === "all") {
        activeFilters = ["available","sold","booked","agent"];
        document.querySelectorAll(".legend-item").forEach(i=>i.classList.add("active"));
    } else {
        item.classList.toggle("active");

        activeFilters = Array.from(document.querySelectorAll(".legend-item.active"))
            .map(i => i.dataset.filter)
            .filter(f => f && f !== "all");
    }

    applyFilter();
});

/* SEARCH (UNCHANGED) */
searchBox.oninput = () => {
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
        div.innerHTML = `<b>${x.display}</b><br>${x.exhibitor}`;

        div.onclick = () => {
            const el = document.querySelector(`[data-id='${x.boothid}']`);
            if (el) {
                el.scrollIntoView({behavior:"smooth",block:"center"});
                el.click();
            }
            suggestions.style.display = "none";
        };

        suggestions.appendChild(div);
    });
};

/* DRAG */
let isDown=false,startX,startY,scrollLeft,scrollTop;

container.addEventListener("mousedown",(e)=>{
    isDown=true;
    startX=e.pageX;
    startY=e.pageY;
    scrollLeft=container.scrollLeft;
    scrollTop=container.scrollTop;
});
container.addEventListener("mouseup",()=>isDown=false);
container.addEventListener("mouseleave",()=>isDown=false);
container.addEventListener("mousemove",(e)=>{
    if(!isDown)return;
    container.scrollLeft = scrollLeft - (e.pageX-startX);
    container.scrollTop = scrollTop - (e.pageY-startY);
});

/* ZOOM */
document.getElementById("zoomIn").onclick=()=> {
    zoomLevel+=0.1;
    floor.style.transform=`scale(${zoomLevel})`;
};
document.getElementById("zoomOut").onclick=()=> {
    zoomLevel=Math.max(0.4,zoomLevel-0.1);
    floor.style.transform=`scale(${zoomLevel})`;
};

/* INIT */
loadData();
