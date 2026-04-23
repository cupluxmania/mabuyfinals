const G_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzeXfwbFMaC8WH3th-aw5_PtMGTlz6UHMC5S5tWs9j1FW-G_Fszldy9QqiY5Zps-mFGQg/exec";

const floor = document.getElementById("floor");
const container = document.getElementById("floorContainer");
const searchBox = document.getElementById("searchBox");
const suggestions = document.getElementById("suggestions");
const panel = document.getElementById("sidePanel");
const panelContent = document.getElementById("panelContent");

let allData = [];
let boothMap = {};
let zoomLevel = 1;

/* ================= UTIL ================= */
function cleanText(val) {
    if (!val) return "";
    return String(val).replace(/\s+/g, " ").trim();
}

function normalizeId(id) {
    return String(id || "").replace(/\s+/g, "").toLowerCase();
}

/* ================= STATUS ================= */
function getStatus(row) {
    const s = cleanText(row.status).toLowerCase();
    if (s === "available") return "available";
    if (s === "booked") return "booked";
    if (s === "sold") return "sold";
    if (s.includes("agent")) return "agent";
    return "available";
}

/* ================= LOAD ================= */
async function loadData() {

    floor.innerHTML = "<div style='padding:40px'>Loading booths...</div>";

    try {
        const res = await fetch(`${G_SCRIPT_URL}?cmd=read&t=${Date.now()}`);
        const raw = await res.json();

        const expanded = [];

        raw.forEach(row => {
            if (!row.boothid) return;

            const booths = String(row.boothid)
                .split(/,|\n/)
                .map(x => x.trim())
                .filter(Boolean);

            const count = booths.length;
            const totalSize = Number(row.size || 0);
            const perBooth = count ? totalSize / count : 0;

            booths.forEach(id => {
                expanded.push({
                    boothid: id, // KEEP ORIGINAL
                    key: normalizeId(id),
                    status: getStatus(row),
                    exhibitor: cleanText(row.exhibitor),
                    sqm: perBooth,
                    type: cleanText(row.type)
                });
            });
        });

        allData = expanded;
        buildMap();
        renderFloor();

    } catch (err) {
        floor.innerHTML = "<div style='padding:40px;color:red'>Failed to load data</div>";
        console.error(err);
    }
}

/* ================= MAP ================= */
function buildMap() {
    boothMap = {};
    allData.forEach(x => {
        if (!boothMap[x.key]) boothMap[x.key] = [];
        boothMap[x.key].push(x);
    });
}

/* ================= HALL ================= */
const hallConfig = [
  {name:"Hall 5", start:5001, end:5078},
  {name:"Hall 6", start:6001, end:6189},
  {name:"Hall 7", start:7001, end:7196},
  {name:"Hall 8", start:8001, end:8181},
  {name:"Hall 9", start:9001, end:9191},
  {name:"Hall 10", start:1001, end:1151},
  {name:"Ambulance", start:"A", end:"Z"}
];

/* ================= RENDER ================= */
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

        header.appendChild(title);
        header.appendChild(summary);
        hallDiv.appendChild(header);

        const grid = document.createElement("div");
        grid.className = "grid";

        if (hall.name === "Ambulance") {
            for (let i = 65; i <= 90; i++) {
                grid.appendChild(createBooth(String.fromCharCode(i)));
            }
        } else {

            for (let i = hall.start; i <= hall.end; i++) {

                const base = String(i);

                const variants = allData.filter(x =>
                    x.key.startsWith(normalizeId(base) + "-")
                );

                if (variants.length > 0) {

                    const group = document.createElement("div");
                    group.className = "booth-group";

                    variants.forEach(v => {
                        const el = createBooth(v.boothid);
                        counts[el.dataset.status]++;
                        group.appendChild(el);
                    });

                    grid.appendChild(group);

                } else {

                    const el = createBooth(base);
                    counts[el.dataset.status]++;
                    grid.appendChild(el);
                }
            }
        }

        Object.keys(counts).forEach(k=>{
            const chip = document.createElement("div");
            chip.className = "count-chip";
            chip.innerHTML = `<span class="dot ${k}"></span><strong>${counts[k]}</strong>`;
            summary.appendChild(chip);
        });

        hallDiv.appendChild(grid);
        floor.appendChild(hallDiv);
    });
}

/* ================= CREATE BOOTH ================= */
function createBooth(id) {

    const key = normalizeId(id);
    const matches = boothMap[key] || [];

    let status = "available";
    let exhibitor = "";
    let sqm = 0;
    let type = "";

    if (matches.length) {
        if (matches.some(x => x.status === "agent")) status = "agent";
        else if (matches.some(x => x.status === "sold")) status = "sold";
        else if (matches.some(x => x.status === "booked")) status = "booked";

        exhibitor = matches.map(x => x.exhibitor).filter(Boolean).join(", ");
        sqm = matches[0].sqm;
        type = matches[0].type;
    }

    const b = document.createElement("div");
    b.className = `booth ${status} ${type === "Space Only" ? "type-space" : "type-shell"}`;
    b.innerText = id;
    b.dataset.id = key;
    b.dataset.status = status;

    b.dataset.tooltip = exhibitor
        ? `${exhibitor} [ ${sqm} Sqm ] [ ${type || "-"} ]`
        : `Available [ ${sqm} Sqm ]`;

    b.onclick = (e)=>{
        e.stopPropagation();
        panel.classList.remove("hidden");
        panelContent.innerHTML = `
            <b>Booth:</b> ${id}<br>
            <b>Size:</b> ${sqm} Sqm<br>
            <b>Type:</b> ${type || "-"}<br>
            <b>Status:</b> ${status.toUpperCase()}<br>
            <b>Exhibitor:</b> ${exhibitor || "-"}
        `;
    };

    return b;
}

/* ================= SEARCH ================= */
searchBox.addEventListener("input", ()=>{
    const val = searchBox.value.toLowerCase();

    const result = allData.filter(x =>
        x.key.includes(val) ||
        x.exhibitor.toLowerCase().includes(val)
    );

    suggestions.innerHTML="";
    suggestions.style.display = result.length ? "block":"none";

    result.forEach(x=>{
        const div = document.createElement("div");
        div.className="suggestionItem";
        div.innerText = `${x.boothid} - ${x.exhibitor}`;

        div.onclick = ()=>{
            const el = document.querySelector(`[data-id='${x.key}']`);
            if (!el) return;

            el.scrollIntoView({behavior:"smooth",block:"center"});
            el.classList.add("highlight","blink");

            setTimeout(()=>el.classList.remove("highlight","blink"),5000);
            el.click();
            suggestions.style.display="none";
        };

        suggestions.appendChild(div);
    });
});

/* ================= DRAG ================= */
let isDown=false,startX,startY,scrollLeft,scrollTop;

container.addEventListener("mousedown",(e)=>{
    isDown=true;
    container.classList.add("dragging");
    startX=e.pageX;
    startY=e.pageY;
    scrollLeft=container.scrollLeft;
    scrollTop=container.scrollTop;
});

document.addEventListener("mouseup",()=>{
    isDown=false;
    container.classList.remove("dragging");
});

document.addEventListener("mousemove",(e)=>{
    if(!isDown) return;
    container.scrollLeft = scrollLeft - (e.pageX - startX);
    container.scrollTop = scrollTop - (e.pageY - startY);
});

/* ================= ZOOM ================= */
document.getElementById("zoomIn").onclick = ()=>{
    zoomLevel += 0.1;
    floor.style.transform = `scale(${zoomLevel})`;
};

document.getElementById("zoomOut").onclick = ()=>{
    zoomLevel = Math.max(0.3, zoomLevel - 0.1);
    floor.style.transform = `scale(${zoomLevel})`;
};

document.addEventListener("click", ()=>{
    panel.classList.add("hidden");
    suggestions.style.display="none";
});

loadData();
