const G_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzeXfwbFMaC8WH3th-aw5_PtMGTlz6UHMC5S5tWs9j1FW-G_Fszldy9QqiY5Zps-mFGQg/exec";

const floor = document.getElementById("floor");
const container = document.getElementById("floorContainer");
const searchBox = document.getElementById("searchBox");
const suggestions = document.getElementById("suggestions");
const panel = document.getElementById("sidePanel");
const panelContent = document.getElementById("panelContent");

let allData = [];
let zoomLevel = 1;

/* SAFE CLEAN */
function clean(v){
    return (v || "").toString().trim();
}

function norm(id){
    return clean(id).replace(/\s+/g,"").toLowerCase();
}

/* STATUS */
function getStatus(row){
    const s = clean(row.status).toLowerCase();
    if(["available","sold","booked","agent"].includes(s)) return s;
    return "available";
}

/* LOAD */
async function loadData(){
    try{
        const res = await fetch(G_SCRIPT_URL);
        const raw = await res.json();

        allData = [];

        raw.forEach(row=>{
            if(!row.boothid) return;

            const booths = String(row.boothid)
                .replace(/\n/g,"")
                .split(",")
                .map(x=>x.trim())
                .filter(Boolean);

            const size = parseFloat(row.size) || 0;
            const each = booths.length ? size / booths.length : 0;

            booths.forEach(id=>{
                allData.push({
                    boothid: norm(id),
                    raw: id,
                    exhibitor: clean(row.exhibitor),
                    status: getStatus(row),
                    sqm: each,
                    type: clean(row.type) || "space"
                });
            });
        });

        renderFloor();

    }catch(e){
        console.error("DATA ERROR", e);
    }
}

/* HALLS */
const halls = [
  {name:"Hall 5", start:5001, end:5078},
  {name:"Hall 6", start:6001, end:6189},
  {name:"Hall 7", start:7001, end:7196},
  {name:"Hall 8", start:8001, end:8181},
  {name:"Hall 9", start:9001, end:9191},
  {name:"Hall 10", start:1001, end:1151},
  {name:"Ambulance", start:"A", end:"Z"}
];

/* MATCH (VERY SAFE) */
function getMatches(id){
    const n = norm(id);
    return allData.filter(x =>
        x.boothid === n ||
        x.boothid.startsWith(n + "-")
    );
}

/* RENDER */
function renderFloor(){
    floor.innerHTML = "";

    halls.forEach(h=>{
        const wrap = document.createElement("div");
        wrap.className = "hall";

        const header = document.createElement("div");
        header.className = "hall-header";

        const title = document.createElement("h3");
        title.innerText = h.name;

        const indicator = document.createElement("div");
        indicator.className = "hall-indicator";

        const counts = {available:0,sold:0,booked:0,agent:0};

        const grid = document.createElement("div");
        grid.className = "grid";

        if(h.name === "Ambulance"){
            for(let i=65;i<=90;i++){
                const id = String.fromCharCode(i);
                const booth = createBooth(id);
                grid.appendChild(booth);
                counts[booth.dataset.status]++;
            }
        } else {
            for(let i=h.start;i<=h.end;i++){
                const id = String(i);
                const booth = createBooth(id);
                grid.appendChild(booth);
                counts[booth.dataset.status]++;
            }
        }

        ["available","sold","booked","agent"].forEach(s=>{
            const chip = document.createElement("div");
            chip.className = `chip ${s}`;
            chip.innerHTML = `<span></span>${counts[s]}`;
            indicator.appendChild(chip);
        });

        header.appendChild(title);
        header.appendChild(indicator);

        wrap.appendChild(header);
        wrap.appendChild(grid);

        floor.appendChild(wrap);
    });
}

/* CREATE BOOTH */
function createBooth(id){

    const matches = getMatches(id);

    let status="available";
    let exhibitor="-";
    let sqm=0;
    let type="space";

    if(matches.length){
        if(matches.some(x=>x.status==="agent")) status="agent";
        else if(matches.some(x=>x.status==="sold")) status="sold";
        else if(matches.some(x=>x.status==="booked")) status="booked";

        exhibitor = matches.map(x=>x.exhibitor).filter(Boolean).join(", ");
        sqm = matches[0].sqm;
        type = matches[0].type.toLowerCase();
    }

    const el = document.createElement("div");
    el.className = `booth ${status}`;
    el.innerText = id;
    el.dataset.id = norm(id);
    el.dataset.status = status;

    if(type.includes("shell")) el.classList.add("type-shell");
    else el.classList.add("type-space");

    el.dataset.tooltip = `${exhibitor} [ ${sqm} Sqm ] [ ${type} ]`;

    el.onclick = (e)=>{
        e.stopPropagation();
        blink(el);

        panel.classList.remove("hidden");
        panelContent.innerHTML = `
            <b>Booth:</b> ${id}<br>
            <b>Size:</b> ${sqm} Sqm<br>
            <b>Type:</b> ${type}<br>
            <b>Status:</b> ${status.toUpperCase()}<br>
            <b>Exhibitor:</b> ${exhibitor}
        `;
    };

    return el;
}

/* BLINK */
function blink(el){
    document.querySelectorAll(".blink").forEach(x=>x.classList.remove("blink"));
    el.classList.add("blink");
    setTimeout(()=>el.classList.remove("blink"),4000);
}

/* SEARCH */
searchBox.addEventListener("input",()=>{
    const val = searchBox.value.toLowerCase();

    const result = allData.filter(x =>
        x.boothid.includes(val) ||
        x.exhibitor.toLowerCase().includes(val)
    );

    suggestions.innerHTML="";
    suggestions.style.display = result.length ? "block":"none";

    result.slice(0,50).forEach(x=>{
        const div = document.createElement("div");
        div.className="suggestionItem";
        div.innerHTML = `<b>${x.raw}</b> — ${x.exhibitor}`;

        div.onclick=()=>{
            const el = document.querySelector(`[data-id='${x.boothid}']`);
            if(el){
                el.scrollIntoView({behavior:"smooth",block:"center"});
                blink(el);
                el.click();
            }
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
    if(!isDown)return;
    container.scrollLeft = scrollLeft - (e.pageX-startX);
    container.scrollTop = scrollTop - (e.pageY-startY);
});

/* ZOOM */
zoomIn.onclick=()=>{ zoomLevel+=0.1; floor.style.transform=`scale(${zoomLevel})`; };
zoomOut.onclick=()=>{ zoomLevel=Math.max(0.3,zoomLevel-0.1); floor.style.transform=`scale(${zoomLevel})`; };

document.addEventListener("click",()=>{
    panel.classList.add("hidden");
    suggestions.style.display="none";
});

loadData();
