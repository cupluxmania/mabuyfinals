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
function cleanText(val){
    return (val || "").toString().trim();
}

function normalizeId(id){
    return (id || "").toString().replace(/\s+/g,"").toLowerCase();
}

/* STATUS */
function getStatus(row){
    const s = cleanText(row.status).toLowerCase();
    if(["available","sold","booked","agent"].includes(s)) return s;
    return "available";
}

/* LOAD DATA */
async function loadData(){
    try{
        const res = await fetch(`${G_SCRIPT_URL}?t=${Date.now()}`);
        const raw = await res.json();

        const expanded = [];

        raw.forEach(row=>{
            if(!row.boothid) return;

            const booths = String(row.boothid)
                .split(",")
                .map(x=>x.replace(/\n/g,"").trim())
                .filter(Boolean);

            const count = booths.length;
            const totalSize = parseFloat(row.size) || 0;
            const eachSize = count ? totalSize / count : 0;

            booths.forEach(id=>{
                expanded.push({
                    boothid: normalizeId(id),
                    displayId: id,
                    exhibitor: cleanText(row.exhibitor),
                    status: getStatus(row),
                    sqm: eachSize,
                    type: cleanText(row.type) || "space"
                });
            });
        });

        allData = expanded;
        renderFloor();

    }catch(err){
        console.error("LOAD ERROR:", err);
    }
}

/* HALL CONFIG */
const halls = [
  {name:"Hall 5", start:5001, end:5078},
  {name:"Hall 6", start:6001, end:6189},
  {name:"Hall 7", start:7001, end:7196},
  {name:"Hall 8", start:8001, end:8181},
  {name:"Hall 9", start:9001, end:9191},
  {name:"Hall 10", start:1001, end:1151},
  {name:"Ambulance", start:"A", end:"Z"}
];

/* RENDER */
function renderFloor(){
    floor.innerHTML = "";

    halls.forEach(h=>{
        const hallDiv = document.createElement("div");
        hallDiv.className = "hall";

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

                const matches = allData.filter(x =>
                    x.boothid === normalizeId(id) ||
                    x.boothid.startsWith(normalizeId(id)+"-")
                );

                let data = null;

                if(matches.length){
                    data = {
                        status:
                            matches.some(x=>x.status==="agent") ? "agent" :
                            matches.some(x=>x.status==="sold") ? "sold" :
                            matches.some(x=>x.status==="booked") ? "booked" : "available",

                        exhibitor: matches.map(x=>x.exhibitor).filter(Boolean).join(", "),
                        sqm: matches[0].sqm,
                        type: matches[0].type
                    };
                }

                const booth = createBooth(id, data);
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

        hallDiv.appendChild(header);
        hallDiv.appendChild(grid);

        floor.appendChild(hallDiv);
    });
}

/* CREATE BOOTH */
function createBooth(id,data){
    const el = document.createElement("div");
    el.className = "booth";
    el.innerText = id;
    el.dataset.id = normalizeId(id);

    let status="available", exhibitor="-", sqm=0, type="space";

    if(data){
        status = data.status;
        exhibitor = data.exhibitor;
        sqm = data.sqm;
        type = (data.type || "").toLowerCase();
    }

    el.dataset.status = status;
    el.classList.add(status);

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
        (x.exhibitor || "").toLowerCase().includes(val)
    );

    suggestions.innerHTML="";
    suggestions.style.display = result.length ? "block":"none";

    result.forEach(x=>{
        const div = document.createElement("div");
        div.className = "suggestionItem";
        div.innerHTML = `<b>${x.displayId}</b> — ${x.exhibitor}`;

        div.onclick = ()=>{
            const el = document.querySelector(`[data-id='${x.boothid}']`);
            if(el){
                el.scrollIntoView({behavior:"smooth",block:"center"});
                blink(el);
                el.click();
            }
            suggestions.style.display="none";
        };

        suggestions.appendChild(div);
    });
});

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
    if(!isDown) return;
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
