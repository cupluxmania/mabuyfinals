const G_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzeXfwbFMaC8WH3th-aw5_PtMGTlz6UHMC5S5tWs9j1FW-G_Fszldy9QqiY5Zps-mFGQg/exec";

const floor = document.getElementById("floor");
const container = document.getElementById("floorContainer");
const searchBox = document.getElementById("searchBox");
const suggestions = document.getElementById("suggestions");
const panel = document.getElementById("sidePanel");
const panelContent = document.getElementById("panelContent");

let allData = [];
let zoomLevel = 1;
let activeFilter = "all";

/* CLEAN */
function cleanText(val){
    if(!val) return "";
    return String(val).replace(/\u00A0/g," ").replace(/\s+/g," ").trim();
}

/* NORMALIZE */
function normalizeId(id){
    return String(id).replace(/\s+/g,"").toLowerCase();
}

/* STATUS */
function getStatus(row){
    const s = cleanText(row.status).toLowerCase();
    if(s==="sold") return "sold";
    if(s==="booked") return "booked";
    if(s.includes("agent")) return "agent";
    return "available";
}

/* LOAD DATA */
async function loadData(){
    const res = await fetch(`${G_SCRIPT_URL}?cmd=read&t=${Date.now()}`);
    const raw = await res.json();

    const expanded = [];

    raw.forEach(row=>{
        if(!row.boothid) return;

        const booths = String(row.boothid)
            .replace(/\n/g,"")
            .split(",")
            .map(x=>x.trim())
            .filter(Boolean);

        const totalSize = parseFloat(row.size) || 0;
        const eachSize = booths.length ? totalSize / booths.length : totalSize;

        booths.forEach(id=>{
            expanded.push({
                rawId: id,
                normId: normalizeId(id),
                status: getStatus(row),
                exhibitor: cleanText(row.exhibitor),
                sqm: eachSize,
                type: cleanText(row.type)
            });
        });
    });

    allData = expanded;
    renderFloor();
}

/* HALL CONFIG */
const hallConfig = [
  {name:"Hall 5", start:5001, end:5078},
  {name:"Hall 6", start:6001, end:6189},
  {name:"Hall 7", start:7001, end:7196},
  {name:"Hall 8", start:8001, end:8181},
  {name:"Hall 9", start:9001, end:9191},
  {name:"Hall 10", start:1001, end:1151},
];

/* FIND */
function findBooth(id){
    const norm = normalizeId(id);
    return allData.filter(x =>
        x.normId === norm || x.normId.startsWith(norm + "-")
    );
}

/* RENDER */
function renderFloor(){
    floor.innerHTML="";

    hallConfig.forEach(hall=>{
        const hallDiv = document.createElement("div");
        hallDiv.className="hall";

        const header = document.createElement("div");
        header.className = "hall-header";

        const title = document.createElement("h3");
        title.innerText = hall.name;

        const summary = document.createElement("div");
        summary.className = "hall-summary";

        const counts = {available:0,sold:0,booked:0,agent:0};

        const grid = document.createElement("div");
        grid.className="grid";

        for(let i=hall.start;i<=hall.end;i++){
            const booth = createBooth(String(i));
            grid.appendChild(booth);

            const status = booth.classList[1];
            if(counts[status] !== undefined) counts[status]++;
        }

        Object.keys(counts).forEach(k=>{
            const chip = document.createElement("div");
            chip.className="count-chip";
            chip.innerHTML = `<span class="dot ${k}"></span>${counts[k]}`;
            summary.appendChild(chip);
        });

        header.appendChild(title);
        header.appendChild(summary);

        hallDiv.appendChild(header);
        hallDiv.appendChild(grid);
        floor.appendChild(hallDiv);
    });
}

/* CREATE */
function createBooth(id){
    const matches = findBooth(id);

    const b = document.createElement("div");
    b.className="booth available";

    let status="available";
    let exhibitor="";
    let sqm=0;
    let type="";

    if(matches.length){
        if(matches.some(x=>x.status==="agent")) status="agent";
        else if(matches.some(x=>x.status==="sold")) status="sold";
        else if(matches.some(x=>x.status==="booked")) status="booked";

        exhibitor = matches.map(x=>x.exhibitor).filter(Boolean).join(", ");
        sqm = matches[0].sqm;
        type = matches[0].type;
    }

    b.className = "booth " + status;

    if(activeFilter !== "all" && status !== activeFilter){
        b.classList.add("hidden-booth");
    }

    if(type.toLowerCase().includes("space")) b.classList.add("type-space");
    if(type.toLowerCase().includes("shell")) b.classList.add("type-shell");

    b.innerText = id;

    b.dataset.tooltip = exhibitor
        ? `${exhibitor} [ ${sqm} Sqm ] [ ${type} ]`
        : `AVAILABLE [ ${sqm} Sqm ]`;

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

/* SEARCH */
searchBox.addEventListener("input",()=>{
    const val = searchBox.value.toLowerCase();

    const result = allData.filter(x =>
        x.rawId.toLowerCase().includes(val) ||
        (x.exhibitor || "").toLowerCase().includes(val)
    );

    suggestions.innerHTML="";
    suggestions.style.display = result.length ? "block":"none";

    result.forEach(x=>{
        const div = document.createElement("div");
        div.className="suggestionItem";
        div.innerText = `${x.rawId} - ${x.exhibitor}`;
        div.onclick=()=>{
            const el = [...document.querySelectorAll(".booth")]
                .find(b => b.innerText === x.rawId.split("-")[0]);

            if(el){
                el.scrollIntoView({behavior:"smooth",block:"center"});
                el.click();
            }

            suggestions.style.display="none";
        };
        suggestions.appendChild(div);
    });
});

/* LEGEND */
document.querySelectorAll(".legend-item").forEach(item=>{
    item.onclick=()=>{
        document.querySelectorAll(".legend-item").forEach(i=>i.classList.remove("active"));
        item.classList.add("active");
        activeFilter = item.dataset.filter;
        renderFloor();
    };
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
    container.scrollLeft = scrollLeft-(e.pageX-startX);
    container.scrollTop = scrollTop-(e.pageY-startY);
});

/* ZOOM */
zoomIn.onclick=()=>{zoomLevel+=0.1;floor.style.transform=`scale(${zoomLevel})`;}
zoomOut.onclick=()=>{zoomLevel=Math.max(0.5,zoomLevel-0.1);floor.style.transform=`scale(${zoomLevel})`;}

/* CLOSE */
document.addEventListener("click",()=>{
    panel.classList.add("hidden");
    suggestions.style.display="none";
});

loadData();
