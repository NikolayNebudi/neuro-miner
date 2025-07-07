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
        if (!dsu.connected(a.id, b.id)) {
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

function generateCorridorNetwork() {
    const nodes = {};
    // 1. Размещаем Firewall в центре
    const centerX = canvas.width * 0.5;
    const centerY = canvas.height * 0.4;
    const firewall = new Node(centerX, centerY, 'firewall', 'firewall');
    nodes[firewall.id] = firewall;
    // 2. Размещаем три key_node по кругу вокруг firewall
    const keyNodes = [];
    const keyRadius = 140;
    for (let i = 0; i < 3; i++) {
        const angle = Math.PI * (1.5 + i * 2 / 3); // равномерно по кругу
        const x = centerX + Math.cos(angle) * keyRadius;
        const y = centerY + Math.sin(angle) * keyRadius;
        const key = new Node(x, y, `key_node${i+1}`, 'key');
        nodes[key.id] = key;
        keyNodes.push(key);
        // Прямая связь с firewall
        key.addNeighbor(firewall.id);
        firewall.addNeighbor(key.id);
    }
    // 3. Размещаем hub ниже firewall
    const hub = new Node(centerX, centerY + 200, 'hub', 'hub');
    nodes[hub.id] = hub;
    // 4. Размещаем system выше firewall
    const system = new Node(centerX, centerY - 170, 'system', 'system');
    nodes[system.id] = system;
    firewall.addNeighbor(system.id);
    system.addNeighbor(firewall.id);
    // 5. Для каждого key_node строим коридор к hub через 1-2 обычные ноды
    let fillerCount = 0;
    for (const key of keyNodes) {
        const corridorLen = 1 + Math.floor(Math.random() * 2); // 1 или 2
        let prev = hub;
        for (let i = 0; i < corridorLen; i++) {
            // Позиция между hub и key
            const t = (i + 1) / (corridorLen + 1);
            const x = hub.x * (1 - t) + key.x * t + (Math.random() - 0.5) * 20;
            const y = hub.y * (1 - t) + key.y * t + (Math.random() - 0.5) * 20;
            const filler = new Node(x, y, `corridor_${key.id}_${i}`, 'data');
            nodes[filler.id] = filler;
            prev.addNeighbor(filler.id);
            filler.addNeighbor(prev.id);
            prev = filler;
            fillerCount++;
        }
        // Соединяем последний filler с key_node (но не трогаем связь key_node-firewall)
        prev.addNeighbor(key.id);
        key.addNeighbor(prev.id);
    }
    // 6. Добавляем остальные ноды и соединяем как обычно
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
        if (id.startsWith('corridor_')) continue;
        let dists = [];
        for (const other of nodeIds) {
            if (id === other) continue;
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
    // 7. Проверка связности (BFS от hub)
    function isAllConnected() {
        const visited = new Set();
        const queue = ['hub'];
        while (queue.length > 0) {
            const cur = queue.shift();
            visited.add(cur);
            for (const n of nodes[cur].neighbors) {
                if (!visited.has(n)) queue.push(n);
            }
        }
        return Object.keys(nodes).every(id => visited.has(id));
    }
    if (!isAllConnected()) {
        console.warn('Внимание: сеть не связная!');
    }
    fixNodeOverlaps(nodes, 60, 1000);
    return nodes;
}

game_state.nodes = generateCorridorNetwork();

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

// После генерации сети вызываем fixNodeOverlaps(nodes)
