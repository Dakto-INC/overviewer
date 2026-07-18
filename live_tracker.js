/**
 * Live Tracker for Minecraft Overviewer
 * Manages player positions, dimension filtering, and UI synchronization.
 * Pulls live positions directly from Dynmap's public JSON endpoint.
 *
 * Dynmap's /up/world/<any>/0 endpoint returns ALL online players globally,
 * each tagged with their true current world — so we only need to query
 * ONE endpoint (doesn't matter which) and map each player's real world
 * back to the matching Overviewer world.
 *
 * To add a new world: add an entry to DYNMAP_TO_OVERVIEWER below.
 * key   = Dynmap's internal world name (from /up/configuration -> worlds[].name)
 * value = exact Overviewer "world" string (matches settings.py worlds[...] key,
 *         which is what window.overviewer.current_world reports)
 */
console.log("[Live Tracker] Initializing...");

var map = null;
var playerMarkers = {};
var sidebarDiv = null;

// Any world name works here — the endpoint returns global player data regardless.
var DYNMAP_ENDPOINT = "/dynmap-api/world/world/0";

// -------------------------------------------------------------------
// WORLD REGISTRY — add/remove worlds here only
// -------------------------------------------------------------------
var DYNMAP_TO_OVERVIEWER = {
    "world": "SMP - Overworld",
    "world_nether": "SMP - Nether",
    "world_the_end": "SMP - The End",
    "RunecraftGenesis_Dakto_": "SMP - Void World"
    // "some_dynmap_world": "Overviewer World Name",  // example: add more here
};

function initTracker() {
    if (!window.overviewer || !window.overviewer.map || !window.overviewer.current_world) {
        setTimeout(initTracker, 500);
        return;
    }
    map = window.overviewer.map;
    createSidebar();
    updateLivePositions();
    setInterval(updateLivePositions, 4000);
}

function createSidebar() {
    sidebarDiv = L.DomUtil.create('div', 'leaflet-bar', map.getContainer());
    sidebarDiv.style.position = 'absolute';
    sidebarDiv.style.top = '260px';
    sidebarDiv.style.right = '10px';
    sidebarDiv.style.zIndex = '1000';
    sidebarDiv.style.backgroundColor = 'white';
    sidebarDiv.style.padding = '8px';
    sidebarDiv.style.minWidth = '160px';
    sidebarDiv.style.maxHeight = '300px';
    sidebarDiv.style.overflowY = 'auto';
    sidebarDiv.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
    sidebarDiv.style.borderRadius = '4px';
    sidebarDiv.innerHTML = `
        <h4 style="margin:0 0 5px 0; font-size:12px;">Online Players (<span id="p-count">0</span>)</h4>
        <ul id="p-list" style="list-style:none; padding:0; margin:0;"></ul>
    `;
    L.DomEvent.disableClickPropagation(sidebarDiv);
}

function switchWorld(worldKey, x, y, z) {
    if (window.overviewer.current_world !== worldKey) {
        var select = window.overviewer.worldCtrl.select;
        if (select) {
            select.value = worldKey;
            select.dispatchEvent(new Event('change'));
        }
    }
    setTimeout(() => {
        var tileset = window.overviewer.current_layer[worldKey];
        if (tileset && tileset.tileSetConfig) {
            map.panTo(window.overviewer.util.fromWorldToLatLng(x, y, z, tileset.tileSetConfig));
        }
    }, 500);
}

function buildPopupHtml(p) {
    var nick = p.nickname && p.nickname !== p.account ? ("~" + p.nickname) : null;
    var rows = [];
    rows.push("<strong>" + p.account + "</strong>");
    if (nick) {
        rows.push("<span>" + nick + "</span>");
    }
    rows.push("X: " + Math.round(p.x) + ", Y: " + Math.round(p.y) + ", Z: " + Math.round(p.z));
    rows.push("Health: " + (p.health != null ? p.health : "?") + " / 20");
    return "<div style='font-size:12px; line-height:1.4;'>" + rows.join("<br>") + "</div>";
}

function updateLivePositions() {
    var activeWorld = window.overviewer.current_world;
    var activeTileset = window.overviewer.current_layer[activeWorld];

    fetch(DYNMAP_ENDPOINT + '?t=' + Date.now())
        .then(res => res.json())
        .then(data => {
            var allPlayers = {};
            (data.players || []).forEach(p => {
                var overviewerWorld = DYNMAP_TO_OVERVIEWER[p.world];
                if (!overviewerWorld) return; // unmapped world, skip
                var realName = p.account || p.name;
                allPlayers[realName] = {
                    name: realName,
                    nickname: p.name,
                    account: p.account,
                    x: p.x,
                    y: p.y,
                    z: p.z,
                    health: p.health,
                    world: overviewerWorld
                };
            });

            var list = document.getElementById('p-list');
            var count = document.getElementById('p-count');
            list.innerHTML = "";

            for (var name in playerMarkers) {
                map.removeLayer(playerMarkers[name]);
                delete playerMarkers[name];
            }

            var activeCount = 0;
            for (var name in allPlayers) {
                var p = allPlayers[name];

                var li = document.createElement('li');
                li.style.cursor = 'pointer';
                li.style.padding = '2px 0';
                li.innerHTML = `<b>${name}</b> <small>(${p.world.replace('SMP - ', '')})</small>`;
                li.onclick = () => switchWorld(p.world, p.x, p.y, p.z);
                list.appendChild(li);

                if (p.world === activeWorld && activeTileset && activeTileset.tileSetConfig) {
                    try {
                        activeCount++;
                        var marker = L.marker(window.overviewer.util.fromWorldToLatLng(p.x, p.y, p.z, activeTileset.tileSetConfig), {
                            icon: L.icon({ iconUrl: 'https://crafthead.net/avatar/' + name + '/32', iconSize: [24, 24] })
                        }).addTo(map);
                        marker.bindPopup(buildPopupHtml(p));
                        playerMarkers[name] = marker;
                    } catch (e) {
                        console.error("Failed to place marker for", name, e);
                        activeCount--;
                    }
                }
            }
            count.innerText = activeCount;
        })
        .catch(e => console.error("Live tracker fetch failed:", e));
}

initTracker();
