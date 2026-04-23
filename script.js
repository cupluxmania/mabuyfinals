const G_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzeXfwbFMaC8WH3th-aw5_PtMGTlz6UHMC5S5tWs9j1FW-G_Fszldy9QqiY5Zps-mFGQg/exec";

const floor = document.getElementById("floor");
const container = document.getElementById("floorContainer");
const searchBox = document.getElementById("searchBox");
const suggestions = document.getElementById("suggestions");
const panel = document.getElementById("sidePanel");
const panelContent = document.getElementById("panelContent");

let allData = [];
let zoomLevel = 1;

/* CLEAN */
function cleanText(val) {
    if (!val) return "";
    return String(val).replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

/* NORMALIZE (ONLY FOR MATCHING) */
function normalizeId(id) {
    return String(id || "").replace(/\s+/g, "").toLowerCase();
}

/* STATUS */
function getStatus(row) {
    const s = cleanText(row.status).toLowerCase();
    if (s === "available") return "available";
    if (s === "booked") return "booked";
    if (s === "sold") return "sold";
    if (s.includes("agent")) return "agent";
    return "available";
}

/* LOAD DATA */
async function loadData() {
    const res = await fetch(`${G_SCRIPT_URL}?cmd=read&t=${Date.now()}`);
    const raw = await res.json();

    const expanded = [];

    raw.forEach(row => {
        if (!row.boothid) return;

        const booths = String(row.boothid)
            .replace(/\n/g, ",")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);

        const count = booths.length;
        const totalSize = parseFloat(row.size) || 0;
        const eachSize = count > 0 ? totalSize / count : 0;

        booths.forEach(id => {
            expanded.push({
                rawId: id, // KEEP ORIGINAL (5035-A stays)
                normId: normalizeId(id),
                baseId: normalizeId(id).split("-")[0],
                status: getStatus(row),
                exhibitor: cleanText(row.exhibitor),
                sqm: eachSize,
                groupSize: count,
                type: cleanText(row.type || "")
            });
        });
    });

    allData = expanded;
    renderFloor();
}

/* GROUP DETECTOR */
function getGroup(baseId) {
    return allData.filter(x => x.baseId === baseId);
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

/* RENDER */
function renderFloor() {
    floor.innerHTML = "";

    hallConfig.forEach(hall => {
        const hallDiv = document.createElement("div");
        hallDiv.className = "hall";

        const title = document.createElement("h3");
        title.innerText = hall.name;
        hallDiv.appendChild(title);

        const grid = document.createElement("div");
        grid.className = "grid";

        if (hall.name === "Ambulance") {
            for (let i = 65; i <= 90; i++) {
                grid.appendChild(createBooth(String.fromCharCode(i)));
            }
        } else {
            for (let i = hall.start; i <= hall.end; i++) {

                const baseId = String(i);
                const group = getGroup(baseId);

                if (group.length > 0) {
                    group.forEach((item, index) => {
                        grid.appendChild(createBooth(item.rawId, group.length, index));
                    });
                } else {
                    grid.appendChild(createBooth(baseId, 1, 0));
                }
            }
        }

        hallDiv.appendChild(grid);
        floor.appendChild(hallDiv);
    });
}

/* CREATE BOOTH */
function createBooth(id, groupCount = 1, index = 0) {

    const norm = normalizeId(id);
    const matches = allData.filter(x => x.normId === norm);

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
    b.className = "booth " + status;

    /* MERGE VISUAL */
    if (groupCount > 1) {
        b.classList.add("merged");
        if (index === 0) b.classList.add("merge-start");
        if (index === groupCount - 1) b.classList.add("merge-end");
    }

    /* TYPE ARSIR */
    if (type.toLowerCase().includes("space")) b.classList.add("type-space");
    if (type.toLowerCase().includes("shell")) b.classList.add("type-shell");

    b.innerText = id;
    b.dataset.id = norm;

    /* TOOLTIP */
    const typeLabel = type ? `[ ${type} ]` : "";
    b.dataset.tooltip = `${exhibitor || "-"} [ ${sqm} Sqm ] ${typeLabel}`;

    /* BADGE */
    if (groupCount > 1 && index === 0) {
        const badge = document.createElement("div");
        badge.className = "badge";
        badge.innerText = groupCount;
        b.appendChild(badge);
    }

    b.onclick = (e) => {
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

/* SEARCH */
searchBox.addEventListener("input", () => {
    const val = searchBox.value.toLowerCase();

    const result = allData.filter(x =>
        x.normId.includes(val) ||
        (x.exhibitor || "").toLowerCase().includes(val)
    );

    suggestions.innerHTML = "";
    suggestions.style.display = result.length ? "block" : "none";

    result.forEach(x => {
        const div = document.createElement("div");
        div.className = "suggestionItem";
        div.innerText = `${x.rawId} - ${x.exhibitor}`;

        div.onclick = () => {
            const el = document.querySelector(`[data-id='${x.normId}']`);
            if (!el) return;

            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("highlight", "blink");

            setTimeout(() => el.classList.remove("blink"), 5000);
            setTimeout(() => el.classList.remove("highlight"), 6000);

            el.click();
            suggestions.style.display = "none";
        };

        suggestions.appendChild(div);
    });
});

/* DRAG */
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

/* ZOOM */
document.getElementById("zoomIn").onclick = () => {
    zoomLevel += 0.1;
    floor.style.transform = `scale(${zoomLevel})`;
};
document.getElementById("zoomOut").onclick = () => {
    zoomLevel = Math.max(0.3, zoomLevel - 0.1);
    floor.style.transform = `scale(${zoomLevel})`;
};

/* CLOSE */
document.addEventListener("click", () => {
    panel.classList.add("hidden");
    suggestions.style.display = "none";
});

/* INIT */
loadData();
