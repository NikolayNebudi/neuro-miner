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

// Генерация случайного графа с минимальным остовным деревом и безопасными доп. связями
function generateRandomNetwork() {
    const nodes = {};
    const nodeCount = Math.floor(Math.random() * 11) + 25; // 25-35
    // HUB в центре
    const hub = new Node(canvas.width / 2, canvas.height / 2, 'hub', 'hub');
    nodes['hub'] = hub;
    // Остальные ноды
    for (let i = 0; i < nodeCount - 1; i++) {
        const pos = generateRandomPosition(nodes);
        const node = new Node(pos.x, pos.y, 'node' + i, 'data');
        nodes[node.id] = node;
    }
    // Минимальное остовное дерево (случайное присоединение)
    const nodeIds = Object.keys(nodes);
    let connected = ['hub'];
    let unconnected = nodeIds.filter(id => id !== 'hub');
    let connections = [];
    while (unconnected.length > 0) {
        const from = connected[Math.floor(Math.random() * connected.length)];
        const to = unconnected[Math.floor(Math.random() * unconnected.length)];
        nodes[from].addNeighbor(to);
        nodes[to].addNeighbor(from);
        connections.push([from, to]);
        connected.push(to);
        unconnected = unconnected.filter(id => id !== to);
    }
    // Добавляем несколько случайных безопасных связей
    const maxExtra = Math.floor(nodeCount * 0.3);
    let added = 0;
    for (let attempt = 0; attempt < 100 && added < maxExtra; attempt++) {
        const a = nodeIds[Math.floor(Math.random() * nodeIds.length)];
        const b = nodeIds[Math.floor(Math.random() * nodeIds.length)];
        if (a === b) continue;
        if (nodes[a].neighbors.includes(b)) continue;
        if (!isConnectionSafe(a, b, nodes, connections)) continue;
        nodes[a].addNeighbor(b);
        nodes[b].addNeighbor(a);
        connections.push([a, b]);
        added++;
    }
    return nodes;
}

game_state.nodes = generateRandomNetwork();

// --- Пульсация ---
let pulseTime = 0;
function drawNetwork() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw connections
    for (const nodeId in game_state.nodes) {
        const node = game_state.nodes[nodeId];
        for (const neighborId of node.neighbors) {
            if (nodeId < neighborId) {
                const neighbor = game_state.nodes[neighborId];
                // Ослабленная пульсация
                const t = (pulseTime * 1.2 + node.randomPhase) % 1;
                ctx.beginPath();
                ctx.moveTo(node.x, node.y);
                ctx.lineTo(neighbor.x, neighbor.y);
                ctx.strokeStyle = `rgba(79,195,247,${0.55 + 0.15 * Math.sin(pulseTime + node.randomPhase)})`;
                ctx.lineWidth = 2.2 + 0.6 * Math.abs(Math.sin(pulseTime + node.randomPhase));
                ctx.stroke();
                // Анимация "энергии"
                const dx = neighbor.x - node.x, dy = neighbor.y - node.y;
                const px = node.x + dx * t;
                const py = node.y + dy * t;
                ctx.save();
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, 2 * Math.PI);
                ctx.globalAlpha = 0.18 + 0.12 * Math.abs(Math.sin(pulseTime + node.randomPhase));
                ctx.fillStyle = '#ffe066';
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 3;
                ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.restore();
            }
        }
    }
    // Draw nodes
    for (const nodeId in game_state.nodes) {
        drawNode(game_state.nodes[nodeId]);
    }
}

function drawNode(node) {
    ctx.save();
    // Ослабленная пульсация размера
    let base = node.size;
    let amp = node.type === 'hub' ? 4 : 1.2;
    let freq = node.type === 'hub' ? 1.2 : 0.7;
    let size = base + Math.sin(pulseTime * freq + node.randomPhase) * amp;
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = node.type === 'hub' ? '#ff4444' : '#ffd700';
    ctx.globalAlpha = (game_state.selectedNode === node.id) ? 0.7 : 1.0;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = 4;
    ctx.strokeStyle = node.type === 'hub' ? '#fff' : '#bfa600';
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(node.id, node.x, node.y + 5);
    ctx.restore();
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

function draw() {
    drawNetwork();
    drawUI();
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
    draw();
});

// --- Main Loop ---
function mainLoop() {
    pulseTime += 0.03;
    draw();
    requestAnimationFrame(mainLoop);
}
mainLoop();
