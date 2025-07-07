const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const drawCubeButton = document.getElementById('draw-cube');
const clearCanvasButton = document.getElementById('clear-canvas');
const createGraphButton = document.getElementById('create-graph');
const numberOfGraphsInput = document.getElementById('number-of-graphs');
const generateNetworkButton = document.getElementById('generate-network');

// --- Game State ---
const game_state = {
    dp: 100, // Data Packets
    energy: 50,
    energy_max: 50,
    wave: 1,
    nodes: {},
    enemies: [],
    selectedNode: null,
};

// --- Node Class ---
class Node {
    constructor(x, y, id, type = 'neutral') {
        this.x = x;
        this.y = y;
        this.id = id;
        this.type = type; // 'hub', 'data', 'neutral'
        this.owner = (type === 'hub') ? 'player' : 'neutral';
        this.program = null; // 'miner', 'shield', 'sentry', 'booster', null
        this.health = 100;
        this.neighbors = [];
        this.randomPhase = Math.random() * Math.PI * 2;
        this.size = (type === 'hub') ? 38 : 28;
    }
    addNeighbor(nodeId) {
        if (!this.neighbors.includes(nodeId)) this.neighbors.push(nodeId);
    }
}

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function isNodeOverlapping(newX, newY, existingNodes, minDistance = 60) {
    for (const nodeId in existingNodes) {
        const node = existingNodes[nodeId];
        const distance = getDistance(newX, newY, node.x, node.y);
        if (distance < minDistance) return true;
    }
    return false;
}

function generateRandomPosition(existingNodes) {
    for (let attempt = 0; attempt < 100; attempt++) {
        const x = Math.random() * (canvas.width - 60) + 30;
        const y = Math.random() * (canvas.height - 60) + 30;
        if (!isNodeOverlapping(x, y, existingNodes)) return { x, y };
    }
    return { x: Math.random() * (canvas.width - 60) + 30, y: Math.random() * (canvas.height - 60) + 30 };
}

// Проверка пересечения двух отрезков
function doLinesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denominator === 0) return false;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Проверка, пересекает ли линия другие соединения
function isConnectionSafe(fromId, toId, nodes, existingConnections) {
    const fromNode = nodes[fromId];
    const toNode = nodes[toId];
    for (const conn of existingConnections) {
        const n1 = nodes[conn[0]];
        const n2 = nodes[conn[1]];
        if (
            fromId !== conn[0] && fromId !== conn[1] &&
            toId !== conn[0] && toId !== conn[1] &&
            doLinesIntersect(fromNode.x, fromNode.y, toNode.x, toNode.y, n1.x, n1.y, n2.x, n2.y)
        ) {
            return false;
        }
    }
    return true;
}

// --- MST (Крускал) ---
function buildMST(nodes) {
    const nodeIds = Object.keys(nodes);
    // Собираем все возможные рёбра
    let edges = [];
    for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
            const a = nodeIds[i], b = nodeIds[j];
            const dist = getDistance(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y);
            edges.push({ a, b, dist });
        }
    }
    edges.sort((e1, e2) => e1.dist - e2.dist);
    // Крускал
    class DSU {
        constructor(ids) { this.p = {}; ids.forEach(x => this.p[x] = x); }
        find(x) { return this.p[x] === x ? x : (this.p[x] = this.find(this.p[x])); }
        union(x, y) { this.p[this.find(x)] = this.find(y); }
        connected(x, y) { return this.find(x) === this.find(y); }
    }
    const dsu = new DSU(nodeIds);
    let mst = [];
    for (const { a, b } of edges) {
        if (!dsu.connected(a, b)) {
            mst.push([a, b]);
            dsu.union(a, b);
        }
    }
    return mst;
}

function generateSmartOrganicNetwork() {
    const nodes = {};
    const nodeCount = Math.floor(Math.random() * 11) + 25; // 25-35
    // HUB в центре
    const hub = new Node(canvas.width / 2, canvas.height / 2, 'hub', 'hub');
    nodes['hub'] = hub;
    let connections = [];
    // 1. Случайно размещаем остальные ноды без наложений
    for (let i = 0; i < nodeCount - 1; i++) {
        let pos;
        let attempts = 0;
        do {
            pos = generateRandomPosition(nodes);
            attempts++;
        } while ((isNodeOverlapping(pos.x, pos.y, nodes, 80) || isNodeNearEdge(pos.x, pos.y, nodes, connections, 60)) && attempts < 100);
        const node = new Node(pos.x, pos.y, 'node' + i, 'data');
        nodes[node.id] = node;
    }
    // 2. Строим MST (гарантированная связность)
    const mst = buildMST(nodes);
    for (const [a, b] of mst) {
        nodes[a].addNeighbor(b);
        nodes[b].addNeighbor(a);
        connections.push([a, b]);
    }
    // 3. Добавляем дополнительные безопасные связи для органичности
    const nodeIds = Object.keys(nodes);
    let extraEdges = [];
    for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
            const a = nodeIds[i], b = nodeIds[j];
            if (nodes[a].neighbors.includes(b)) continue;
            const dist = getDistance(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y);
            if (dist > 120 && dist < 320) { // не слишком близко, не слишком далеко
                // Проверка на пересечение
                let ok = true;
                for (const [c, d] of connections) {
                    if (doLinesIntersect(
                        nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y,
                        nodes[c].x, nodes[c].y, nodes[d].x, nodes[d].y
                    )) { ok = false; break; }
                }
                if (ok) extraEdges.push({ a, b, dist });
            }
        }
    }
    // Добавляем часть дополнительных связей
    extraEdges.sort((e1, e2) => e1.dist - e2.dist);
    let added = 0;
    for (const { a, b } of extraEdges) {
        if (!nodes[a].neighbors.includes(b) && added < nodeCount * 0.5) {
            nodes[a].addNeighbor(b);
            nodes[b].addNeighbor(a);
            connections.push([a, b]);
            added++;
        }
    }
    return nodes;
}

function generateOrganicNetwork() {
    const nodes = {};
    const nodeCount = Math.floor(Math.random() * 11) + 25; // 25-35
    // HUB в центре
    const hub = new Node(canvas.width / 2, canvas.height / 2, 'hub', 'hub');
    nodes['hub'] = hub;
    let connections = [];
    // 1. Случайно размещаем остальные ноды без наложений и без близости к пересечениям
    for (let i = 0; i < nodeCount - 1; i++) {
        let pos;
        let attempts = 0;
        do {
            pos = generateRandomPosition(nodes);
            attempts++;
        } while ((isNodeOverlapping(pos.x, pos.y, nodes, 60)) && attempts < 100);
        const node = new Node(pos.x, pos.y, 'node' + i, 'data');
        nodes[node.id] = node;
    }
    const nodeIds = Object.keys(nodes);
    // 2. Для каждой ноды соединяем с 2 ближайшими (если нет пересечений)
    for (const id of nodeIds) {
        let dists = [];
        for (const other of nodeIds) {
            if (id === other) continue;
            dists.push({ id: other, dist: getDistance(nodes[id].x, nodes[id].y, nodes[other].x, nodes[other].y) });
        }
        dists.sort((a, b) => a.dist - b.dist);
        let added = 0;
        for (const { id: other } of dists) {
            if (nodes[id].neighbors.includes(other)) continue;
            // Проверка на пересечение
            let ok = true;
            for (const conn of connections) {
                if (doLinesIntersect(
                    nodes[id].x, nodes[id].y, nodes[other].x, nodes[other].y,
                    nodes[conn[0]].x, nodes[conn[0]].y, nodes[conn[1]].x, nodes[conn[1]].y
                )) { ok = false; break; }
            }
            if (!ok) continue;
            nodes[id].addNeighbor(other);
            nodes[other].addNeighbor(id);
            connections.push([id, other]);
            added++;
            if (added >= 2) break;
        }
    }
    return nodes;
}

function generateStrictSpecialNetwork() {
    const nodes = {};
    // 1. Размещаем HUB, ключи, Firewall, System
    const hub = new Node(canvas.width * 0.5, canvas.height * 0.5, 'hub', 'hub');
    const key1 = new Node(canvas.width * 0.2, canvas.height * 0.3, 'key_node1', 'key');
    const key2 = new Node(canvas.width * 0.8, canvas.height * 0.3, 'key_node2', 'key');
    const key3 = new Node(canvas.width * 0.5, canvas.height * 0.8, 'key_node3', 'key');
    const firewall = new Node(canvas.width * 0.5, canvas.height * 0.15, 'firewall', 'firewall');
    const system = new Node(canvas.width * 0.5, canvas.height * 0.05, 'system', 'system');
    nodes[hub.id] = hub;
    nodes[key1.id] = key1;
    nodes[key2.id] = key2;
    nodes[key3.id] = key3;
    nodes[firewall.id] = firewall;
    nodes[system.id] = system;
    // 2. Строим MST между HUB и ключами
    const mstNodes = [hub, key1, key2, key3];
    let pairs = [
        [hub, key1], [hub, key2], [hub, key3],
        [key1, key2], [key1, key3], [key2, key3]
    ];
    pairs = pairs.map(([a, b]) => ({ a, b, dist: getDistance(a.x, a.y, b.x, b.y) }));
    pairs.sort((e1, e2) => e1.dist - e2.dist);
    class DSU { constructor(ids) { this.p = {}; ids.forEach(x => this.p[x] = x); } find(x) { return this.p[x] === x ? x : (this.p[x] = this.find(this.p[x])); } union(x, y) { this.p[this.find(x)] = this.find(y); } connected(x, y) { return this.find(x) === this.find(y); } }
    const dsu = new DSU(mstNodes.map(n => n.id));
    let mstEdges = [];
    for (const { a, b } of pairs) {
        if (!dsu.connected(a, b)) {
            a.addNeighbor(b.id);
            b.addNeighbor(a.id);
            mstEdges.push([a.id, b.id]);
            dsu.union(a.id, b.id);
        }
    }
    // 3. Firewall соединяем только с ключами и System
    for (const key of [key1, key2, key3]) {
        firewall.addNeighbor(key.id);
        key.addNeighbor(firewall.id);
    }
    firewall.addNeighbor(system.id);
    system.addNeighbor(firewall.id);
    // 4. Добавляем остальные ноды и соединяем только с HUB или между собой
    const nodeCount = Math.floor(Math.random() * 11) + 15; // 15-25 обычных
    for (let i = 0; i < nodeCount; i++) {
        let pos;
        let attempts = 0;
        do {
            pos = generateRandomPosition(nodes);
            attempts++;
        } while ((isNodeOverlapping(pos.x, pos.y, nodes, 60)) && attempts < 100);
        const node = new Node(pos.x, pos.y, 'node' + i, 'data');
        nodes[node.id] = node;
    }
    const nodeIds = Object.keys(nodes);
    for (const id of nodeIds) {
        if (["hub","key_node1","key_node2","key_node3","firewall","system"].includes(id)) continue;
        let dists = [];
        for (const other of nodeIds) {
            if (id === other) continue;
            // Можно соединять только с HUB или с другими обычными нодами
            if (["key_node1","key_node2","key_node3","firewall","system"].includes(other)) continue;
            dists.push({ id: other, dist: getDistance(nodes[id].x, nodes[id].y, nodes[other].x, nodes[other].y) });
        }
        dists.sort((a, b) => a.dist - b.dist);
        let added = 0;
        for (const { id: other } of dists) {
            if (nodes[id].neighbors.includes(other)) continue;
            nodes[id].addNeighbor(other);
            nodes[other].addNeighbor(id);
            added++;
            if (added >= 2) break;
        }
    }
    // --- Сборка skeletonEdges ---
    const skeletonEdges = new Set();
    for (const [a, b] of mstEdges) {
        skeletonEdges.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    }
    for (const key of [key1, key2, key3]) {
        skeletonEdges.add(firewall.id < key.id ? `${firewall.id}-${key.id}` : `${key.id}-${firewall.id}`);
    }
    skeletonEdges.add(firewall.id < system.id ? `${firewall.id}-${system.id}` : `${system.id}-${firewall.id}`);
    // --- Устраняем пересечения ---
    fixEdgeIntersections(nodes, skeletonEdges);
    return nodes;
}

function findAllConnectedNodes(startId, nodesObj) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length) {
        const cur = queue.shift();
        visited.add(cur);
        for (const n of nodesObj[cur].neighbors) {
            if (!visited.has(n)) queue.push(n);
        }
    }
    return visited;
}

// --- Удаление мусорных веток и изолированных нод ---
function pruneAndCleanNetwork(nodesObj, specialNodeIds) {
    let changed = true;
    // A. Обрезаем листья (не специальные)
    while (changed) {
        changed = false;
        for (const [id, node] of Object.entries(nodesObj)) {
            if (specialNodeIds.includes(id)) continue;
            if (node.neighbors.length === 1) {
                // Удаляем связь у соседа
                const neighborId = node.neighbors[0];
                nodesObj[neighborId].neighbors = nodesObj[neighborId].neighbors.filter(nid => nid !== id);
                delete nodesObj[id];
                changed = true;
                break;
            }
        }
    }
    // B. Удаляем изолированные (не специальные)
    for (const [id, node] of Object.entries(nodesObj)) {
        if (specialNodeIds.includes(id)) continue;
        if (node.neighbors.length === 0) {
            delete nodesObj[id];
        }
    }
    return nodesObj;
}

function generateLogicalGameNetwork() {
    // 1. Unified Node Creation
    const width = canvas.width, height = canvas.height;
    const minDist = 60;
    // Спец-ноды
    const nodes = [];
    nodes.push({id: 'hub', type: 'hub'});
    nodes.push({id: 'firewall', type: 'firewall'});
    nodes.push({id: 'system', type: 'system'});
    nodes.push({id: 'key_node1', type: 'key'});
    nodes.push({id: 'key_node2', type: 'key'});
    nodes.push({id: 'key_node3', type: 'key'});
    // Filler nodes
    const fillerCount = Math.floor(Math.random() * 11) + 18; // 18-28
    for (let i = 0; i < fillerCount; i++) {
        nodes.push({id: 'node' + i, type: 'data'});
    }
    // Случайные стартовые позиции
    for (const n of nodes) {
        let attempts = 0;
        do {
            n.x = Math.random() * (width - 80) + 40;
            n.y = Math.random() * (height - 80) + 40;
            attempts++;
        } while (nodes.some(other => other !== n && getDistance(n.x, n.y, other.x, other.y) < minDist) && attempts < 100);
    }
    // 2. Delaunay Triangulation
    const delaunay = d3.Delaunay.from(nodes, d => d.x, d => d.y);
    const delaunayEdges = new Set();
    for (let e = 0; e < delaunay.halfedges.length; e++) {
        const p = delaunay.triangles[e];
        const q = delaunay.triangles[delaunay.halfedges[e]];
        if (q === undefined || p === q) continue;
        const a = nodes[p].id, b = nodes[q].id;
        const edge = a < b ? `${a}|${b}` : `${b}|${a}`;
        delaunayEdges.add(edge);
    }
    // 3. Minimum Spanning Tree (Kruskal)
    const edgesArr = Array.from(delaunayEdges).map(e => {
        const [a, b] = e.split('|');
        const na = nodes.find(n => n.id === a);
        const nb = nodes.find(n => n.id === b);
        return {a, b, dist: getDistance(na.x, na.y, nb.x, nb.y)};
    });
    edgesArr.sort((e1, e2) => e1.dist - e2.dist);
    class DSU { constructor(ids) { this.p = {}; ids.forEach(x => this.p[x] = x); } find(x) { return this.p[x] === x ? x : (this.p[x] = this.find(this.p[x])); } union(x, y) { this.p[this.find(x)] = this.find(y); } connected(x, y) { return this.find(x) === this.find(y); } }
    const dsu = new DSU(nodes.map(n => n.id));
    const mstEdges = [];
    for (const {a, b} of edgesArr) {
        if (!dsu.connected(a, b)) {
            mstEdges.push([a, b]);
            dsu.union(a, b);
        }
    }
    // 4. Add Richness: часть оставшихся рёбер
    const mstSet = new Set(mstEdges.map(([a, b]) => a < b ? `${a}|${b}` : `${b}|${a}`));
    const extraEdges = Array.from(delaunayEdges).filter(e => !mstSet.has(e));
    const extraCount = Math.floor(extraEdges.length * 0.2);
    const shuffled = extraEdges.sort(() => Math.random() - 0.5);
    const finalEdges = [...mstEdges];
    for (let i = 0; i < extraCount; i++) {
        const [a, b] = shuffled[i].split('|');
        finalEdges.push([a, b]);
    }
    // 5. Enforce Game Rules
    // a) system только с firewall
    let systemEdges = finalEdges.filter(([a, b]) => a === 'system' || b === 'system');
    finalEdges.push(['system', 'firewall']);
    for (const [a, b] of systemEdges) {
        if ((a === 'system' && b !== 'firewall') || (b === 'system' && a !== 'firewall')) {
            // Удаляем лишние связи
            const idx = finalEdges.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
            if (idx !== -1) finalEdges.splice(idx, 1);
        }
    }
    // b) все key_nodes соединены с firewall
    for (const kid of ['key_node1','key_node2','key_node3']) {
        if (!finalEdges.some(([a, b]) => (a === kid && b === 'firewall') || (b === kid && a === 'firewall'))) {
            finalEdges.push([kid, 'firewall']);
        }
    }
    // --- Формируем структуру для рендера ---
    const nodesObj = {};
    for (const n of nodes) {
        nodesObj[n.id] = {...n, neighbors: []};
    }
    for (const [a, b] of finalEdges) {
        nodesObj[a].neighbors.push(b);
        nodesObj[b].neighbors.push(a);
    }
    // --- Исправление островков ---
    while (true) {
        const connected = findAllConnectedNodes('hub', nodesObj);
        if (connected.size === Object.keys(nodesObj).length) break;
        const all = new Set(Object.keys(nodesObj));
        const islands = [...all].filter(id => !connected.has(id));
        let minDist = Infinity, bridge = null;
        for (const iso of islands) {
            for (const main of connected) {
                const d = getDistance(nodesObj[iso].x, nodesObj[iso].y, nodesObj[main].x, nodesObj[main].y);
                if (d < minDist) {
                    minDist = d;
                    bridge = [iso, main];
                }
            }
        }
        if (bridge) {
            nodesObj[bridge[0]].neighbors.push(bridge[1]);
            nodesObj[bridge[1]].neighbors.push(bridge[0]);
        } else {
            break;
        }
    }
    // --- Пиннинг только для hub, system, firewall ---
    nodesObj['hub'].fx = width / 2;
    nodesObj['hub'].fy = height - 50;
    nodesObj['system'].fx = width / 2;
    nodesObj['system'].fy = 50;
    nodesObj['firewall'].fx = width / 2;
    nodesObj['firewall'].fy = height / 2.7;
    // --- Очистка связей firewall ---
    const allowedNeighbors = ['system', 'key_node1', 'key_node2', 'key_node3'];
    const fw = nodesObj['firewall'];
    fw.neighbors = fw.neighbors.filter(nid => allowedNeighbors.includes(nid));
    for (const nid of Object.keys(nodesObj)) {
        if (nid === 'firewall') continue;
        if (!allowedNeighbors.includes(nid)) {
            nodesObj[nid].neighbors = nodesObj[nid].neighbors.filter(x => x !== 'firewall');
        }
    }
    for (const n of allowedNeighbors) {
        if (!fw.neighbors.includes(n)) {
            fw.neighbors.push(n);
        }
        if (!nodesObj[n].neighbors.includes('firewall')) {
            nodesObj[n].neighbors.push('firewall');
        }
    }
    // --- Обрезка мусорных веток и чистка ---
    const specialNodeIds = ['hub', 'system', 'firewall', 'key_node1', 'key_node2', 'key_node3'];
    pruneAndCleanNetwork(nodesObj, specialNodeIds);
    return nodesObj;
}

function angleBetweenEdges(ax, ay, bx, by, cx, cy) {
    // угол между AB и AC
    const v1x = bx - ax, v1y = by - ay;
    const v2x = cx - ax, v2y = cy - ay;
    const dot = v1x * v2x + v1y * v2y;
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
    if (len1 === 0 || len2 === 0) return 180;
    let angle = Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2))));
    return angle * 180 / Math.PI;
}

function generateSimpleNetwork() {
    // 1. Генерация нод
    const width = canvas.width, height = canvas.height;
    const nodes = [];
    nodes.push({id: 'hub', type: 'hub', x: Math.random() * (width - 80) + 40, y: Math.random() * (height - 80) + 40, neighbors: []});
    const count = Math.floor(Math.random() * 11) + 25; // 25-35
    for (let i = 0; i < count; i++) {
        let x, y, tries = 0;
        do {
            x = Math.random() * (width - 80) + 40;
            y = Math.random() * (height - 80) + 40;
            tries++;
        } while (nodes.some(n => getDistance(n.x, n.y, x, y) < 40) && tries < 100);
        nodes.push({id: 'node'+i, type: 'data', x, y, neighbors: []});
    }
    // 2. MST (Крускал)
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i+1; j < nodes.length; j++) {
            edges.push({a: i, b: j, dist: getDistance(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y)});
        }
    }
    edges.sort((e1, e2) => e1.dist - e2.dist);
    class DSU { constructor(n) { this.p = Array(n).fill(0).map((_,i)=>i); } find(x) { return this.p[x]===x?x:this.p[x]=this.find(this.p[x]); } union(x,y){this.p[this.find(x)]=this.find(y);} connected(x,y){return this.find(x)===this.find(y);} }
    const dsu = new DSU(nodes.length);
    const mstEdges = [];
    for (const {a, b} of edges) {
        if (!dsu.connected(a, b)) {
            mstEdges.push([a, b]);
            dsu.union(a, b);
            nodes[a].neighbors.push(nodes[b].id);
            nodes[b].neighbors.push(nodes[a].id);
        }
    }
    // 3. Добавляем дополнительные рёбра (не более 3 связей, без пересечений, с ограничением углов)
    function edgeCrosses(a1, b1, a2, b2) {
        function ccw(ax, ay, bx, by, cx, cy) {
            return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
        }
        return (a1 !== a2 && a1 !== b2 && b1 !== a2 && b1 !== b2) &&
            ccw(a1.x, a1.y, a2.x, a2.y, b2.x, b2.y) !== ccw(b1.x, b1.y, a2.x, a2.y, b2.x, b2.y) &&
            ccw(a1.x, a1.y, b1.x, b1.y, a2.x, a2.y) !== ccw(a1.x, a1.y, b1.x, b1.y, b2.x, b2.y);
    }
    const allEdges = [...mstEdges];
    for (const {a, b} of edges) {
        if (nodes[a].neighbors.length >= 3 || nodes[b].neighbors.length >= 3) continue;
        if (nodes[a].neighbors.includes(nodes[b].id)) continue;
        // Проверка на пересечение
        let crosses = false;
        for (const [i1, j1] of allEdges) {
            const n1 = nodes[i1], n2 = nodes[j1];
            if (edgeCrosses(nodes[a], nodes[b], n1, n2)) {
                crosses = true; break;
            }
        }
        if (crosses) continue;
        // Проверка углов для обеих нод
        let angleTooSmall = false;
        for (const n of [a, b]) {
            const node = nodes[n];
            for (const neighborId of node.neighbors) {
                const neighbor = nodes.find(x => x.id === neighborId);
                const angle = angleBetweenEdges(node.x, node.y, neighbor.x, neighbor.y, nodes[a === n ? b : a].x, nodes[a === n ? b : a].y);
                if (angle < 25) { angleTooSmall = true; break; }
            }
            if (angleTooSmall) break;
        }
        if (angleTooSmall) continue;
        nodes[a].neighbors.push(nodes[b].id);
        nodes[b].neighbors.push(nodes[a].id);
        allEdges.push([a, b]);
    }
    // --- Формируем nodesObj для визуализации ---
    const nodesObj = {};
    for (const n of nodes) nodesObj[n.id] = n;
    return nodesObj;
}

// --- D3.js визуализация ---
function renderD3Network(nodesObj) {
    const svg = d3.select('#network');
    svg.selectAll('*').remove();
    const width = +svg.attr('width');
    const height = +svg.attr('height');
    const margin = 48;
    // Преобразуем nodesObj в массивы nodes/links
    const nodes = Object.values(nodesObj);
    const links = [];
    for (const node of nodes) {
        for (const nId of node.neighbors) {
            if (node.id < nId) links.push({ source: node.id, target: nId });
        }
    }
    // D3 force simulation с группирующими силами для key_nodes и forceCollide
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links)
            .id(d => d.id)
            .distance(d => 140 + 20 * (Math.max(d.source.neighbors.length, d.target.neighbors.length) - 1))
            .strength(0.9))
        .force('charge', d3.forceManyBody().strength(-120))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.01))
        .force('forceX', d3.forceX(d => {
            if (d.id === 'key_node1') return width * 0.25;
            if (d.id === 'key_node2') return width * 0.75;
            return width / 2;
        }).strength(d => (d.type === 'key' ? 0.05 : 0.01)))
        .force('forceY', d3.forceY(d => {
            if (d.id === 'key_node1' || d.id === 'key_node2') return height * 0.3;
            if (d.id === 'key_node3') return height * 0.6;
            return height / 2;
        }).strength(d => (d.type === 'key' ? 0.05 : 0.01)))
        .force('collide', d3.forceCollide().radius(d => {
            if (d.type === 'hub') return 36 + 8;
            if (d.type === 'system') return 32 + 8;
            if (d.type === 'firewall') return 24 + 8;
            if (d.type === 'key') return 24 + 8;
            return 24 + 8;
        }).strength(1));
    // Рёбра
    const link = svg.append('g')
        .attr('stroke', '#00eaff')
        .attr('stroke-opacity', 0.7)
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke-width', 2);
    // Узлы
    const node = svg.append('g')
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', d => d.type === 'hub' ? 36 : d.type === 'system' ? 32 : 24)
        .attr('fill', d => {
            if (d.type === 'hub') return '#ff9100';
            if (d.type === 'system') return '#00ff90';
            if (d.type === 'firewall') return '#ff1744';
            if (d.type === 'key') return '#ffe066';
            return '#00eaff';
        })
        .attr('stroke', d => {
            if (d.type === 'key') return '#ffe066';
            if (d.type === 'hub') return '#ff9100';
            if (d.type === 'system') return '#00ff90';
            if (d.type === 'firewall') return '#ff1744';
            return '#fff';
        })
        .attr('stroke-width', 3)
        .call(drag(simulation));
    // Текстовые подписи
    const labels = svg.append('g')
        .selectAll('text')
        .data(nodes)
        .join('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .attr('font-family', 'sans-serif')
        .attr('font-weight', 'bold')
        .attr('font-size', d => d.type === 'hub' || d.type === 'system' ? 18 : 13)
        .attr('fill', d => d.type === 'system' || d.type === 'hub' ? '#fff' : '#222')
        .text(d => {
            if (d.type === 'hub') return 'HUB';
            if (d.type === 'system') return 'SYS';
            return '';
        });
    simulation.on('tick', () => {
        link
            .attr('x1', d => Math.max(margin, Math.min(width - margin, d.source.x)))
            .attr('y1', d => Math.max(margin, Math.min(height - margin, d.source.y)))
            .attr('x2', d => Math.max(margin, Math.min(width - margin, d.target.x)))
            .attr('y2', d => Math.max(margin, Math.min(height - margin, d.target.y)));
        node
            .attr('cx', d => d.x = Math.max(margin, Math.min(width - margin, d.x)))
            .attr('cy', d => d.y = Math.max(margin, Math.min(height - margin, d.y)));
        labels
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    });
    function drag(simulation) {
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        function dragged(event, d) {
            d.fx = Math.max(margin, Math.min(width - margin, event.x));
            d.fy = Math.max(margin, Math.min(height - margin, event.y));
        }
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
        return d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended);
    }
}

// --- Используем новый генератор ---
game_state.nodes = generateSimpleNetwork();
renderD3Network(game_state.nodes);

// --- Пульсация ---
let pulseTime = 0;

// Цвета для неонового синего и красного
const NEON_BLUE = '#00eaff';
const NEON_RED = '#ff0055';

// --- Рендер ноды ---
function drawNode(ctx, node, selected = false) {
    ctx.save();
    // Пульсация размера
    let base = node.type === 'hub' ? 36 : node.type === 'system' ? 32 : 24;
    let amp = node.type === 'hub' ? 6 : node.type === 'system' ? 4 : 2.5;
    let freq = node.type === 'hub' ? 1.5 : node.type === 'system' ? 1.1 : 0.7;
    let phase = node.randomPhase || 0;
    let time = performance.now() / 1000;
    let size = base + Math.sin(time * freq + phase) * amp;
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    // --- SYSTEM ---
    if (node.type === 'system') {
        ctx.shadowColor = '#00ff90'; // неоново-зелёный
        ctx.shadowBlur = selected ? 20 : 12;
        ctx.fillStyle = 'rgba(0,255,144,0.92)';
        ctx.globalAlpha = 1;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = selected ? 6 : 3;
        ctx.strokeStyle = '#00ff90';
        ctx.stroke();
        // Надпись SYS
        let fontSize = 16;
        ctx.font = `bold ${fontSize}px sans-serif`;
        let text = 'SYS';
        while (ctx.measureText(text).width > size * 1.6 && fontSize > 8) {
            fontSize -= 1;
            ctx.font = `bold ${fontSize}px sans-serif`;
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(text, node.x, node.y);
        ctx.restore();
        return;
    }
    // --- FIREWALL ---
    if (node.type === 'firewall') {
        ctx.shadowColor = '#ff1744'; // неоново-красный
        ctx.shadowBlur = selected ? 22 : 14;
        ctx.fillStyle = 'rgba(255,23,68,0.85)';
        ctx.globalAlpha = 1;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = selected ? 6 : 3;
        ctx.strokeStyle = '#ff1744';
        ctx.stroke();
        // Значок щита
        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.scale(size/32, size/32);
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(12, -8);
        ctx.lineTo(8, 12);
        ctx.lineTo(0, 16);
        ctx.lineTo(-8, 12);
        ctx.lineTo(-12, -8);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.restore();
        return;
    }
    // --- HUB ---
    if (node.type === 'hub') {
        ctx.shadowColor = '#ff9100'; // неоново-оранжевый
        ctx.shadowBlur = selected ? 20 : 12;
        ctx.fillStyle = 'rgba(255,145,0,0.95)';
        ctx.globalAlpha = 1;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = selected ? 6 : 3;
        ctx.strokeStyle = '#ff9100';
        ctx.stroke();
        // Динамический размер текста, чтобы не вылезал за пределы ноды
        let fontSize = 18;
        ctx.font = `bold ${fontSize}px sans-serif`;
        let text = 'HUB';
        while (ctx.measureText(text).width > size * 1.6 && fontSize > 8) {
            fontSize -= 1;
            ctx.font = `bold ${fontSize}px sans-serif`;
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(text, node.x, node.y);
        ctx.restore();
        return;
    }
    // --- KEY NODE ---
    if (node.type === 'key') {
        ctx.shadowColor = '#ffe066'; // неоново-жёлтый
        ctx.shadowBlur = selected ? 16 : 10;
        ctx.fillStyle = 'rgba(255,224,102,0.18)'; // почти прозрачный
        ctx.globalAlpha = 1;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = selected ? 5 : 2.5;
        ctx.strokeStyle = '#ffe066';
        ctx.stroke();
        // Значок ключа (или дискеты)
        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.scale(size/32, size/32);
        // Ключ
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, 2 * Math.PI);
        ctx.moveTo(7, 0);
        ctx.lineTo(14, 0);
        ctx.moveTo(12, -2);
        ctx.lineTo(12, 2);
        ctx.moveTo(14, -2);
        ctx.lineTo(14, 2);
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.restore();
        return;
    }
    // --- Обычные ноды ---
    ctx.shadowColor = NEON_BLUE;
    ctx.shadowBlur = selected ? 14 : 8;
    ctx.fillStyle = NEON_BLUE;
    ctx.globalAlpha = selected ? 1 : 0.85;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.lineWidth = selected ? 6 : 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    // Пульсирующий неоново-сиреневый кружок
    let dotBase = size * 0.32;
    let dotAmp = 2;
    let dotSize = dotBase + Math.sin(time * freq + phase + 1.1) * dotAmp;
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, dotSize, 0, 2 * Math.PI);
    ctx.shadowColor = '#b388ff';
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#b388ff';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.restore();
}

// --- Пульсация соединений ---
function drawConnection(ctx, n1, n2, time) {
    // Неоновая голубая пульсация с "бегущей волной"
    const pulse = 0.5 + 0.5 * Math.sin(time / 250 + (n1.x + n2.x + n1.y + n2.y) / 200);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.strokeStyle = `rgba(0,234,255,${0.45 + 0.3 * pulse})`;
    ctx.shadowColor = NEON_BLUE;
    ctx.shadowBlur = 6 + 6 * pulse; // уменьшено
    ctx.lineWidth = 3.5 + 1.2 * pulse;
    ctx.stroke();
    // Внутренняя "нить"
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
}

// --- Основной рендер ---
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const time = Date.now();
    // Соединения
    for (const id in game_state.nodes) {
        const node = game_state.nodes[id];
        for (const nId of node.neighbors) {
            if (id < nId) {
                drawConnection(ctx, node, game_state.nodes[nId], time);
            }
        }
    }
    // Ноды
    for (const id in game_state.nodes) {
        drawNode(ctx, game_state.nodes[id], id === game_state.selectedNode);
    }
    drawUI();
}

function drawUI() {
    ctx.save();
    ctx.fillStyle = '#222';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(canvas.width - 210, 0, 210, 90);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('DP: ' + game_state.dp, canvas.width - 100, 30);
    ctx.fillText('Энергия: ' + game_state.energy + '/' + game_state.energy_max, canvas.width - 100, 55);
    ctx.fillText('Волна: ' + game_state.wave, canvas.width - 100, 80);
    ctx.restore();
}

// --- Interaction (выделение узла) ---
canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let found = null;
    for (const nodeId in game_state.nodes) {
        const node = game_state.nodes[nodeId];
        const dx = node.x - mx, dy = node.y - my;
        if (Math.sqrt(dx*dx + dy*dy) < node.size + 4) {
            found = nodeId;
            break;
        }
    }
    game_state.selectedNode = found;
    render();
});

// --- Main Loop ---
function mainLoop() {
    pulseTime += 0.03;
    render();
    requestAnimationFrame(mainLoop);
}
mainLoop();

// При создании ноды добавляем случайную фазу для пульсации
const oldNode = window.Node;
window.Node = function(x, y, id, type) {
    const n = new oldNode(x, y, id, type);
    n.randomPhase = Math.random() * Math.PI * 2;
    return n;
};

function fixEdgeIntersections(nodes, skeletonEdges) {
    let changed = true;
    let maxTries = 1000;
    // skeletonEdges — массив строк вида 'a-b' (a < b), которые нельзя разрывать
    function isSkeletonEdge(a, b) {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        return skeletonEdges.has(key);
    }
    while (changed && maxTries-- > 0) {
        changed = false;
        let allEdges = [];
        for (const id in nodes) {
            for (const nId of nodes[id].neighbors) {
                if (id < nId) allEdges.push([id, nId]);
            }
        }
        outer: for (let i = 0; i < allEdges.length; i++) {
            for (let j = i + 1; j < allEdges.length; j++) {
                const [a1, b1] = allEdges[i];
                const [a2, b2] = allEdges[j];
                if ([a1, b1].some(x => x === a2 || x === b2)) continue;
                if (doLinesIntersect(
                    nodes[a1].x, nodes[a1].y, nodes[b1].x, nodes[b1].y,
                    nodes[a2].x, nodes[a2].y, nodes[b2].x, nodes[b2].y
                )) {
                    // Не трогаем скелетные связи
                    let canBreak1 = !isSkeletonEdge(a1, b1);
                    let canBreak2 = !isSkeletonEdge(a2, b2);
                    if (!canBreak1 && !canBreak2) continue;
                    // Разрываем одну из разрешённых связей
                    let [from, to] = (canBreak1 && canBreak2) ? (Math.random() < 0.5 ? [a1, b1] : [a2, b2]) : (canBreak1 ? [a1, b1] : [a2, b2]);
                    nodes[from].neighbors = nodes[from].neighbors.filter(n => n !== to);
                    nodes[to].neighbors = nodes[to].neighbors.filter(n => n !== from);
                    // Пробуем переподключить from к другому соседу
                    let nodeIds = Object.keys(nodes);
                    let candidates = nodeIds.filter(nid =>
                        nid !== from &&
                        !nodes[from].neighbors.includes(nid) &&
                        !isSkeletonEdge(from, nid)
                    );
                    // Оставляем только тех, кто не создаёт пересечений
                    candidates = candidates.filter(nid => {
                        for (const [x, y] of allEdges) {
                            if ((x === from && y === to) || (x === to && y === from)) continue;
                            if (doLinesIntersect(
                                nodes[from].x, nodes[from].y, nodes[nid].x, nodes[nid].y,
                                nodes[x].x, nodes[x].y, nodes[y].x, nodes[y].y
                            )) return false;
                        }
                        return true;
                    });
                    if (candidates.length > 0) {
                        let newTo = candidates[Math.floor(Math.random() * candidates.length)];
                        nodes[from].addNeighbor(newTo);
                        nodes[newTo].addNeighbor(from);
                    }
                    changed = true;
                    break outer;
                }
            }
        }
    }
}

function fixNodeOverlaps(nodes, minDist = 60, maxTries = 1000) {
    let nodeIds = Object.keys(nodes);
    let tries = 0;
    let changed = true;
    while (changed && tries < maxTries) {
        changed = false;
        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                const a = nodes[nodeIds[i]];
                const b = nodes[nodeIds[j]];
                if (a.type === 'system' || a.type === 'firewall' || a.type === 'hub' || a.type === 'key') continue;
                if (b.type === 'system' || b.type === 'firewall' || b.type === 'hub' || b.type === 'key') continue;
                const dist = getDistance(a.x, a.y, b.x, b.y);
                if (dist < minDist) {
                    // Сдвигаем одну из нод в случайном направлении
                    const angle = Math.random() * 2 * Math.PI;
                    const dx = Math.cos(angle) * (minDist - dist + 2);
                    const dy = Math.sin(angle) * (minDist - dist + 2);
                    b.x += dx;
                    b.y += dy;
                    // Ограничиваем в пределах canvas
                    b.x = Math.max(30, Math.min(canvas.width - 30, b.x));
                    b.y = Math.max(30, Math.min(canvas.height - 30, b.y));
                    changed = true;
                }
            }
        }
        tries++;
    }
}

function fixEdgeIntersectionsStrict(nodes) {
    let changed = true;
    let maxTries = 1000;
    // system-firewall и key-firewall не трогаем
    function isProtectedEdge(a, b) {
        const protectedPairs = [
            ['system', 'firewall'],
            ['firewall', 'system'],
            ['key_node1', 'firewall'], ['firewall', 'key_node1'],
            ['key_node2', 'firewall'], ['firewall', 'key_node2'],
            ['key_node3', 'firewall'], ['firewall', 'key_node3'],
        ];
        return protectedPairs.some(([x, y]) => (a === x && b === y));
    }
    while (changed && maxTries-- > 0) {
        changed = false;
        let allEdges = [];
        for (const id in nodes) {
            for (const nId of nodes[id].neighbors) {
                if (id < nId) allEdges.push([id, nId]);
            }
        }
        outer: for (let i = 0; i < allEdges.length; i++) {
            for (let j = i + 1; j < allEdges.length; j++) {
                const [a1, b1] = allEdges[i];
                const [a2, b2] = allEdges[j];
                if ([a1, b1].some(x => x === a2 || x === b2)) continue;
                if (doLinesIntersect(
                    nodes[a1].x, nodes[a1].y, nodes[b1].x, nodes[b1].y,
                    nodes[a2].x, nodes[a2].y, nodes[b2].x, nodes[b2].y
                )) {
                    // Не трогаем защищённые связи
                    let canBreak1 = !isProtectedEdge(a1, b1) && !isProtectedEdge(b1, a1);
                    let canBreak2 = !isProtectedEdge(a2, b2) && !isProtectedEdge(b2, a2);
                    if (!canBreak1 && !canBreak2) continue;
                    // Разрываем одну из разрешённых связей
                    let [from, to] = (canBreak1 && canBreak2) ? (Math.random() < 0.5 ? [a1, b1] : [a2, b2]) : (canBreak1 ? [a1, b1] : [a2, b2]);
                    nodes[from].neighbors = nodes[from].neighbors.filter(n => n !== to);
                    nodes[to].neighbors = nodes[to].neighbors.filter(n => n !== from);
                    // Пробуем переподключить from к другому соседу
                    let nodeIds = Object.keys(nodes);
                    let candidates = nodeIds.filter(nid =>
                        nid !== from &&
                        !nodes[from].neighbors.includes(nid) &&
                        !isProtectedEdge(from, nid) &&
                        !isProtectedEdge(nid, from)
                    );
                    // Оставляем только тех, кто не создаёт пересечений
                    candidates = candidates.filter(nid => {
                        for (const [x, y] of allEdges) {
                            if ((x === from && y === to) || (x === to && y === from)) continue;
                            if (doLinesIntersect(
                                nodes[from].x, nodes[from].y, nodes[nid].x, nodes[nid].y,
                                nodes[x].x, nodes[x].y, nodes[y].x, nodes[y].y
                            )) return false;
                        }
                        return true;
                    });
                    if (candidates.length > 0) {
                        let newTo = candidates[Math.floor(Math.random() * candidates.length)];
                        nodes[from].addNeighbor(newTo);
                        nodes[newTo].addNeighbor(from);
                    }
                    changed = true;
                    break outer;
                }
            }
        }
    }
}

// После генерации сети вызываем fixEdgeIntersectionsStrict(nodes)
