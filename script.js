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

game_state.nodes = generateOrganicNetwork();

// --- Пульсация ---
let pulseTime = 0;

// Цвета для неонового синего и красного
const NEON_BLUE = '#00eaff';
const NEON_RED = '#ff0055';

// --- Рендер ноды ---
function drawNode(ctx, node, selected = false) {
    ctx.save();
    // Пульсация размера
    let base = node.type === 'hub' ? 36 : 24;
    let amp = node.type === 'hub' ? 6 : 2.5;
    let freq = node.type === 'hub' ? 1.5 : 0.7;
    let phase = node.randomPhase || 0;
    let time = performance.now() / 1000;
    let size = base + Math.sin(time * freq + phase) * amp;
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    // Цвет и свечение по типу
    if (node.type === 'hub') {
        ctx.shadowColor = NEON_RED;
        ctx.shadowBlur = selected ? 18 : 12;
        ctx.fillStyle = NEON_RED;
    } else {
        ctx.shadowColor = NEON_BLUE;
        ctx.shadowBlur = selected ? 14 : 8;
        ctx.fillStyle = NEON_BLUE;
    }
    ctx.globalAlpha = selected ? 1 : 0.85;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.lineWidth = selected ? 6 : 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    if (node.type === 'hub') {
        // Динамический размер текста, чтобы не вылезал за пределы ноды
        let fontSize = 16;
        ctx.font = `bold ${fontSize}px sans-serif`;
        let text = node.id;
        while (ctx.measureText(text).width > size * 1.6 && fontSize > 8) {
            fontSize -= 1;
            ctx.font = `bold ${fontSize}px sans-serif`;
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#111';
        ctx.fillText(text, node.x, node.y);
    } else {
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
    }
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
