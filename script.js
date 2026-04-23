const G_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzeXfwbFMaC8WH3th-aw5_PtMGTlz6UHMC5S5tWs9j1FW-G_Fszldy9QqiY5Zps-mFGQg/exec";

const floor = document.getElementById("floor");
const container = document.getElementById("floorContainer");
const searchBox = document.getElementById("searchBox");
const suggestions = document.getElementById("suggestions");
const panel = document.getElementById("sidePanel");
const panelContent = document.getElementById("panelContent");

let allData = [];
let activeFilter = new Set(["available","sold","booked","agent"]);

/* CLEAN */
function cleanText(val){
    if(!val) return "";
    return String(val).replace(/\s+/g," ").trim();
}

/* STATUS */
function getStatus(row){
    let s = cleanText(row.status).toLowerCase();
    if(["available","sold","booked","agent"].includes(s)) return s;
    return "available";
}

/* LOAD */
async function loadData(){
    const res = await fetch(`${G_SCRIPT_URL}?cmd=read&t=${Date.now()}`);
    const raw = await res.json();

    const expanded = [];

    raw.forEach(row=>{
        if(!row.boothid) return;

        const booths = String(row.boothid).split(",").map(x=>x.trim()).filter(Boolean);
        const size = parseFloat(row.size)||0;
        const each = booths.length ? size/booths.length : 0;

        booths.forEach(id=>{
            expanded.push({
                boothid:id.toLowerCase(),
                display:id,
                status:getStatus(row),
                exhibitor:cleanText(row.exhibitor),
                sqm:each,
                type:cleanText(row.type)
            });
        });
    });

    allData = expanded;
    updateLegendCount();
    render();
}

/* LEGEND FILTER */
document.querySelectorAll(".legend-item").forEach(el=>{
    el.onclick = ()=>{
        const status = el.dataset.status;

        if(activeFilter.has(status)){
            activeFilter.delete(status);
            el.classList.remove("active");
        }else{
            activeFilter.add(status);
            el.classList.add("active");
        }

        render();
    };
});

/* COUNT */
function updateLegendCount(){
    const count = {available:0,sold:0,booked:0,agent:0};
    allData.forEach(x=>count[x.status]++);

    document.querySelectorAll(".legend-item").forEach(el=>{
        const s = el.dataset.status;
        el.querySelector(".count").innerText = count[s]||0;
    });
}

/* RENDER */
function render(){
    floor.innerHTML="";

    const grid = document.createElement("div");
    grid.className="grid";

    allData.forEach(x=>{
        if(!activeFilter.has(x.status)) return;

        const b = document.createElement("div");
        b.className = "booth "+x.status;

        if(x.type.toLowerCase().includes("space")) b.classList.add("type-space");
        if(x.type.toLowerCase().includes("shell")) b.classList.add("type-shell");

        b.innerHTML = `<span>${x.display}</span>`;

        b.dataset.tooltip = `${x.exhibitor || "Available"} [ ${x.sqm} Sqm ] [ ${x.type||"-"} ]`;

        b.onclick = ()=>{
            panel.classList.remove("hidden");
            panelContent.innerHTML = `
                <b>Booth:</b> ${x.display}<br>
                <b>Size:</b> ${x.sqm} Sqm<br>
                <b>Type:</b> ${x.type}<br>
                <b>Status:</b> ${x.status}<br>
                <b>Exhibitor:</b> ${x.exhibitor || "-"}
            `;
        };

        grid.appendChild(b);
    });

    floor.appendChild(grid);
}

loadData();
