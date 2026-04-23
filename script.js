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
    return String(val).replace(/\s+/g," ").trim();
}

/* STATUS */
function getStatus(row){
    const s = cleanText(row.status).toLowerCase();
    if(s==="sold") return "sold";
    if(s==="booked") return "booked";
    if(s==="agent") return "agent";
    return "available";
}

/* LOAD DATA */
async function loadData(){
    const res = await fetch(`${G_SCRIPT_URL}?t=${Date.now()}`);
    const raw = await res.json();

    const expanded = [];

    raw.forEach(row=>{
        if(!row.boothid) return;

        const booths = String(row.boothid)
            .split(",")
            .map(x=>x.trim())
            .filter(Boolean);

        const size = parseFloat(row.size) || 0;
        const each = booths.length ? size/booths.length : size;

        booths.forEach(id=>{
            expanded.push({
                id,
                status:getStatus(row),
                exhibitor:cleanText(row.exhibitor),
                sqm:each,
                type:cleanText(row.type)
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

/* RENDER */
function renderFloor(){
    floor.innerHTML="";

    hallConfig.forEach(hall=>{
        const hallDiv = document.createElement("div");
        hallDiv.className="hall";

        const title = document.createElement("h3");
        title.innerText = hall.name;
        hallDiv.appendChild(title);

        const grid = document.createElement("div");
        grid.className="grid";

        for(let i=hall.start;i<=hall.end;i++){
            const id = String(i);
            grid.appendChild(createBooth(id));
        }

        hallDiv.appendChild(grid);
        floor.appendChild(hallDiv);
    });
}

/* CREATE BOOTH */
function createBooth(id){

    const data = allData.find(x=>x.id===id);

    const b = document.createElement("div");
    b.className="booth";

    let status="available";
    let exhibitor="";
    let sqm=0;
    let type="";

    if(data){
        status=data.status;
        exhibitor=data.exhibitor;
        sqm=data.sqm;
        type=data.type;
    }

    b.classList.add(status);

    // FILTER
    if(activeFilter !== "all" && status !== activeFilter){
        b.classList.add("hidden-booth");
    }

    // TYPE PATTERN (ARSIR)
    if(type.toLowerCase().includes("space")){
        b.classList.add("type-space");
    }
    if(type.toLowerCase().includes("shell")){
        b.classList.add("type-shell");
    }

    b.innerText=id;

    // HOVER TEXT (CLEAN)
    b.dataset.tooltip = exhibitor 
        ? `${exhibitor} [ ${sqm} Sqm ] [ ${type} ]`
        : `AVAILABLE [ ${sqm} Sqm ]`;

    // CLICK PANEL
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

/* LEGEND FILTER */
document.querySelectorAll(".legend-item").forEach(item=>{
    item.onclick = ()=>{
        document.querySelectorAll(".legend-item").forEach(i=>i.classList.remove("active"));
        item.classList.add("active");

        activeFilter = item.dataset.filter;
        renderFloor();
    };
});

/* DRAG */
let isDown=false, startX, startY, scrollLeft, scrollTop;

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

document.addEventListener("click",()=>{
    panel.classList.add("hidden");
});

loadData();
