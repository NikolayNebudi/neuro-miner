// --- CANVAS NETWORK SYSTEM ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// --- Node Class ---
class Node {
    constructor(x, y, id, type = 'data', owner = 'neutral') {
        this.x = x;
        this.y = y;
        this.id = id;
        this.type = type;
        this.owner = owner; // 'neutral', 'player', 'enemy'
        this.resistance = Math.floor(Math.random() * 41) + 10; // 10-50
        this.program = null; // { type: 'miner', level: 1 } или null
        this.isCapturing = false;
        this.captureProgress = 0;
        this.neighbors = [];
        this.randomPhase = Math.random() * Math.PI * 2;
        this.shieldHealth = 0; // новое свойство
        this.maxShieldHealth = 100; // новое свойство
        this.isTargeted = false;
        this.targetedUntil = 0;
    }
    addNeighbor(nodeId) {
        if (!this.neighbors.includes(nodeId)) this.neighbors.push(nodeId);
    }
}

// --- Enemy Class ---
class Enemy {
    constructor(id, currentNodeId, path, type = 'patrol') {
        this.id = id;
        this.currentNodeId = currentNodeId;
        this.path = path; // массив id
        this.pathStep = 0;
        this.decapturing = false;
        this.health = type === 'hunter' ? 90 : 50; // больше здоровья у hunter
        this.type = type;
    }
}

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function angleBetweenEdges(ax, ay, bx, by, cx, cy) {
    const v1x = bx - ax, v1y = by - ay;
    const v2x = cx - ax, v2y = cy - ay;
    const dot = v1x * v2x + v1y * v2y;
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
    if (len1 === 0 || len2 === 0) return 180;
    let angle = Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2))));
    return angle * 180 / Math.PI;
}

function generateCanvasNetwork() {
    const width = canvas.width, height = canvas.height;
    const nodes = [];
    nodes.push(new Node(Math.random() * (width - 200) + 100, Math.random() * (height - 200) + 100, 'hub', 'hub'));
    const count = Math.floor(Math.random() * 11) + 25; // 25-35
    for (let i = 0; i < count; i++) {
        let x, y, tries = 0;
        do {
            x = Math.random() * (width - 200) + 100;
            y = Math.random() * (height - 200) + 100;
            tries++;
        } while (nodes.some(n => getDistance(n.x, n.y, x, y) < 40) && tries < 100);
        nodes.push(new Node(x, y, 'node'+i, 'data'));
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
            nodes[a].addNeighbor(nodes[b].id);
            nodes[b].addNeighbor(nodes[a].id);
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
        // Глобальная проверка на пересечение с любым существующим ребром
        let crosses = false;
        for (const [i1, j1] of allEdges) {
            const n1 = nodes[i1], n2 = nodes[j1];
            if (edgeCrosses(nodes[a], nodes[b], n1, n2)) {
                crosses = true; break;
            }
        }
        if (crosses) continue;
        // Проверка "сквозного" прохождения через другие ноды
        let passesThroughNode = false;
        for (const n of nodes) {
            if (n === nodes[a] || n === nodes[b]) continue;
            // Расстояние от точки до отрезка
            const px = n.x, py = n.y;
            const x1 = nodes[a].x, y1 = nodes[a].y, x2 = nodes[b].x, y2 = nodes[b].y;
            const dx = x2 - x1, dy = y2 - y1;
            const len2 = dx*dx + dy*dy;
            let t = ((px - x1) * dx + (py - y1) * dy) / len2;
            t = Math.max(0, Math.min(1, t));
            const projx = x1 + t * dx;
            const projy = y1 + t * dy;
            const dist = Math.sqrt((px - projx) ** 2 + (py - projy) ** 2);
            if (dist < 26) { passesThroughNode = true; break; }
        }
        if (passesThroughNode) continue;
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
        nodes[a].addNeighbor(nodes[b].id);
        nodes[b].addNeighbor(nodes[a].id);
        allEdges.push([a, b]);
    }
    // --- Формируем nodesObj для визуализации ---
    const nodesObj = {};
    for (const n of nodes) nodesObj[n.id] = n;
    // --- Спец.ноды ---
    // cpu_node
    let candidates = nodes.filter(n => n.type === 'data');
    for (let i = 0; i < Math.floor(Math.random()*2)+1; i++) {
        if (candidates.length === 0) break;
        let idx = Math.floor(Math.random()*candidates.length);
        candidates[idx].type = 'cpu_node';
        candidates.splice(idx,1);
    }
    // data_cache
    candidates = nodes.filter(n => n.type === 'data');
    for (let i = 0; i < Math.floor(Math.random()*2)+1; i++) {
        if (candidates.length === 0) break;
        let idx = Math.floor(Math.random()*candidates.length);
        candidates[idx].type = 'data_cache';
        candidates.splice(idx,1);
    }
    return nodesObj;
}

// --- Force simulation для canvas ---
function runForceSimulation(nodesObj, maxSteps = 200) {
    const nodes = Object.values(nodesObj);
    const edges = [];
    for (const n of nodes) {
        for (const nid of n.neighbors) {
            if (n.id < nid) edges.push([n, nodesObj[nid]]);
        }
    }
    // Параметры сил
    const repulsion = 12000; // сила отталкивания
    const springLength = 120; // желаемая длина ребра
    const springK = 0.08; // сила пружины
    const damping = 0.75; // затухание
    for (const n of nodes) {
        n.vx = 0;
        n.vy = 0;
    }
    for (let step = 0; step < maxSteps; step++) {
        // 1. Отталкивание
        for (let i = 0; i < nodes.length; i++) {
            let n1 = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
                let n2 = nodes[j];
                let dx = n1.x - n2.x, dy = n1.y - n2.y;
                let dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
                let force = repulsion / (dist * dist);
                let fx = force * dx / dist;
                let fy = force * dy / dist;
                n1.vx += fx;
                n1.vy += fy;
                n2.vx -= fx;
                n2.vy -= fy;
            }
        }
        // 2. Притяжение по рёбрам
        for (const [n1, n2] of edges) {
            let dx = n2.x - n1.x, dy = n2.y - n1.y;
            let dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
            let force = springK * (dist - springLength);
            let fx = force * dx / dist;
            let fy = force * dy / dist;
            n1.vx += fx;
            n1.vy += fy;
            n2.vx -= fx;
            n2.vy -= fy;
        }
        // 3. Обновление координат
        let maxMove = 0;
        for (const n of nodes) {
            if (n.type === 'hub') continue; // HUB фиксирован
            n.x += n.vx * damping;
            n.y += n.vy * damping;
            // Ограничение в пределах canvas
            n.x = Math.max(60, Math.min(canvas.width - 60, n.x));
            n.y = Math.max(60, Math.min(canvas.height - 60, n.y));
            maxMove = Math.max(maxMove, Math.abs(n.vx * damping) + Math.abs(n.vy * damping));
            n.vx = 0; n.vy = 0;
        }
        if (maxMove < 0.2) break; // если сеть почти не двигается — стоп
    }
}

function fixEdgeIntersectionsAndReconnect(nodesObj) {
    let changed = true;
    let maxTries = 1000;
    const nodes = Object.values(nodesObj);
    function doLinesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        function ccw(ax, ay, bx, by, cx, cy) {
            return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
        }
        return ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
               ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4);
    }
    while (changed && maxTries-- > 0) {
        changed = false;
        // Собираем все рёбра
        let allEdges = [];
        for (const n of nodes) {
            for (const nid of n.neighbors) {
                if (n.id < nid) allEdges.push([n, nodesObj[nid]]);
            }
        }
        outer: for (let i = 0; i < allEdges.length; i++) {
            for (let j = i + 1; j < allEdges.length; j++) {
                const [a1, b1] = allEdges[i];
                const [a2, b2] = allEdges[j];
                if ([a1.id, b1.id].some(x => x === a2.id || x === b2.id)) continue;
                if (doLinesIntersect(a1.x, a1.y, b1.x, b1.y, a2.x, a2.y, b2.x, b2.y)) {
                    // Удаляем одно из рёбер (выбираем случайно)
                    let [from, to] = Math.random() < 0.5 ? [a1, b1] : [a2, b2];
                    from.neighbors = from.neighbors.filter(nid => nid !== to.id);
                    to.neighbors = to.neighbors.filter(nid => nid !== from.id);
                    // Пробуем переподключить from к новому соседу
                    let candidates = nodes.filter(n =>
                        n.id !== from.id &&
                        !from.neighbors.includes(n.id) &&
                        from.neighbors.length < 3 && n.neighbors.length < 3
                    );
                    // Сортируем по расстоянию
                    candidates.sort((n1, n2) => getDistance(from.x, from.y, n1.x, n1.y) - getDistance(from.x, from.y, n2.x, n2.y));
                    for (const n of candidates) {
                        // Проверяем, что новое ребро не пересекает другие
                        let ok = true;
                        for (const [x, y] of allEdges) {
                            if ((x.id === from.id && y.id === to.id) || (x.id === to.id && y.id === from.id)) continue;
                            if (doLinesIntersect(from.x, from.y, n.x, n.y, x.x, x.y, y.x, y.y)) { ok = false; break; }
                        }
                        if (!ok) continue;
                        from.neighbors.push(n.id);
                        n.neighbors.push(from.id);
                        break;
                    }
                    changed = true;
                    break outer;
                }
            }
        }
    }
}

function attachTailsToNetwork(nodesObj) {
    const nodes = Object.values(nodesObj);
    let changed = true;
    let maxTries = 100;
    function doLinesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        function ccw(ax, ay, bx, by, cx, cy) {
            return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
        }
        return ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
               ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4);
    }
    while (changed && maxTries-- > 0) {
        changed = false;
        // 1. Находим все листья (ноды с одной связью)
        const leaves = nodes.filter(n => n.neighbors.length === 1);
        if (leaves.length === 0) break;
        for (const leaf of leaves) {
            // 2. Ищем ближайшую подходящую ноду (не сосед, не сам, <3 связей)
            let minDist = Infinity, best = null;
            for (const n of nodes) {
                if (n.id === leaf.id) continue;
                if (leaf.neighbors.includes(n.id)) continue;
                if (n.neighbors.length >= 3 || leaf.neighbors.length >= 3) continue;
                // Проверка на пересечение
                let ok = true;
                for (const n1 of nodes) {
                    for (const n2id of n1.neighbors) {
                        if (n1.id < n2id) {
                            const n2 = nodesObj[n2id];
                            if ([n.id, leaf.id].some(x => x === n1.id || x === n2.id)) continue;
                            if (doLinesIntersect(leaf.x, leaf.y, n.x, n.y, n1.x, n1.y, n2.x, n2.y)) {
                                ok = false; break;
                            }
                        }
                    }
                    if (!ok) break;
                }
                if (!ok) continue;
                const d = getDistance(leaf.x, leaf.y, n.x, n.y);
                if (d < minDist) {
                    minDist = d;
                    best = n;
                }
            }
            if (best) {
                leaf.neighbors.push(best.id);
                best.neighbors.push(leaf.id);
                changed = true;
            }
        }
        if (!changed) break;
    }
}

// --- Визуализация и анимация на canvas ---
let game_state = {
    nodes: {},
    dp: 100, // Data Packets
    cpu: 50, // CPU Time
    traceLevel: 0,
    playerRootNodeId: null,
    enemies: [],
    selectedNodeId: null,
    hubCaptureActive: false,
    hubCaptureProgress: 0,
    empCooldown: 0,
};
let hoveredNodeId = null;
let pathAnim = { path: null, startTime: 0, hovered: null };
let lastMinerTick = 0;
let lastEnemySpawn = 0;
let enemyIdCounter = 1;
let uiButtons = {};
let sentryShots = [];
let sentryFlashes = [];
let enemyExplosions = [];
let gameOver = false;
let screenShake = { duration: 0, magnitude: 0, x: 0, y: 0 };
let isRendering = false;

// --- Централизованный UI state ---
let uiState = {
    selectedNodeId: null,
    uiButtons: {}
};

function triggerScreenShake(magnitude, duration) {
    screenShake.duration = duration;
    screenShake.magnitude = magnitude;
}

let godMode = false;
window.addEventListener('keydown', (e) => {
    if (e.key === 'g' || e.key === 'G') {
        godMode = !godMode;
        alert('God Mode: ' + (godMode ? 'ON' : 'OFF'));
        if (!godMode) {
            // Сбросить traceLevel, если ушёл в минус
            if (game_state.traceLevel < 0) game_state.traceLevel = 0;
            // Можно добавить сброс других временных флагов, если появятся
        }
    }
    if (e.key === 'Escape') {
        uiState.selectedNodeId = null;
        uiButtons = {};
    }
});

canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    hoveredNodeId = null;
    for (const id in game_state.nodes) {
        const node = game_state.nodes[id];
        let base = node.type === 'hub' ? 36 : 18;
        let amp = node.type === 'hub' ? 6 : 1.5;
        let freq = node.type === 'hub' ? 1.5 : 0.7;
        let phase = node.randomPhase || 0;
        let time = performance.now() / 1000;
        let size = base + Math.sin(time * freq + phase) * amp;
        if ((mx - node.x) ** 2 + (my - node.y) ** 2 < size * size) {
            hoveredNodeId = id;
            break;
        }
    }
    // Сброс анимации пути, если наведённая нода изменилась
    if (hoveredNodeId !== pathAnim.hovered) {
        pathAnim.hovered = hoveredNodeId;
        pathAnim.startTime = performance.now();
        pathAnim.path = null;
    }
});

canvas.addEventListener('click', function(e) {
    if (gameOver) return;
    if (isRendering) return;
    // --- uiButtons всегда актуальны ---
    uiButtons = {};
    if (uiState.selectedNodeId) {
        const selectedNode = game_state.nodes[uiState.selectedNodeId];
        if (selectedNode) drawProgramUI(ctx, selectedNode);
    }
    // --- EMP Blast ---
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (uiState.uiButtons['emp']) {
        const btn = uiState.uiButtons['emp'];
        if (
            mx >= btn.x && mx <= btn.x + btn.w &&
            my >= btn.y && my <= btn.y + btn.h
        ) {
            if (game_state.cpu >= 50 && game_state.empCooldown <= 0) {
                game_state.cpu -= 50;
                game_state.empCooldown = 30000;
                for (const enemy of game_state.enemies) {
                    enemy.isStunnedUntil = Date.now() + 5000;
                }
            }
            return;
        }
    }
    // --- Priority 0: UI-кнопки (если нода выбрана) ---
    let uiButtonClicked = false;
    if (uiState.selectedNodeId) {
        for (const btnType in uiButtons) {
            const btn = uiButtons[btnType];
            if (
                mx >= btn.x && mx <= btn.x + btn.w &&
                my >= btn.y && my <= btn.y + btn.h
            ) {
                let node = game_state.nodes[uiState.selectedNodeId];
                // --- Upgrade ---
                if (btn.type === 'upgrade') {
                    let prog = node.program;
                    if (node.owner !== 'player') return;
                    let baseCost = prog.type === 'miner' ? 20 : prog.type === 'shield' ? 30 : 40;
                    let cost = baseCost * prog.level;
                    let cpuCost = 5 * prog.level;
                    if (game_state.dp >= cost && game_state.cpu >= cpuCost) {
                        game_state.dp -= cost;
                        game_state.cpu -= cpuCost;
                        prog.level++;
                        if (prog.type === 'shield') {
                            node.maxShieldHealth = 100 * prog.level;
                            node.shieldHealth = node.maxShieldHealth;
                        }
                        uiState.selectedNodeId = null;
                        uiButtons = {};
                    } else {
                        console.log('Недостаточно DP или CPU для апгрейда', prog.type);
                    }
                    uiButtonClicked = true;
                    return;
                }
                // --- Установка программ ---
                let cost = 0;
                if (btn.type === 'miner') cost = 20;
                if (btn.type === 'shield') cost = 30;
                if (btn.type === 'sentry') cost = 40;
                if (btn.type === 'overclocker') cost = 50;
                // --- Проверка типа ноды ---
                if (btn.type === 'overclocker' && node.type !== 'cpu_node') return;
                if ((btn.type === 'miner' || btn.type === 'shield' || btn.type === 'sentry') && node.type === 'cpu_node') return;
                if (node.program) {
                    console.log('На этой ноде уже установлена программа!');
                    uiButtonClicked = true;
                    return;
                }
                if (game_state.dp >= cost) {
                    if (node.owner !== 'player') return;
                    game_state.dp -= cost;
                    node.program = { type: btn.type, level: 1 };
                    if (btn.type === 'shield') {
                        node.maxShieldHealth = 100;
                        node.shieldHealth = node.maxShieldHealth;
                    }
                    uiState.selectedNodeId = null;
                    uiButtons = {};
                } else {
                    console.log('Недостаточно DP для установки', btn.type);
                }
                uiButtonClicked = true;
                return;
            }
        }
    }

    // --- Сбор потенциальных целей ---
    let potentialPlayerTargets = [];
    let potentialNeutralTargets = [];
    let potentialHubTargets = [];
    for (const id in game_state.nodes) {
        const node = game_state.nodes[id];
        if (!node) continue;
        const dx = mx - node.x;
        const dy = my - node.y;
        const r = node.type === 'hub' ? 32 : 22;
        if (dx * dx + dy * dy < r * r) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (node.type === 'hub') potentialHubTargets.push({node, dist});
            else if (node.owner === 'player') potentialPlayerTargets.push({node, dist});
            else if (node.owner === 'neutral') potentialNeutralTargets.push({node, dist});
        }
    }
    // Сортировка по расстоянию (ближайшая — первая)
    potentialPlayerTargets.sort((a, b) => a.dist - b.dist);
    potentialNeutralTargets.sort((a, b) => a.dist - b.dist);
    potentialHubTargets.sort((a, b) => a.dist - b.dist);
    // --- Ключевой фикс: если была выбрана нода, но клик не по UI-кнопке, сбросить UI ---
    if (uiState.selectedNodeId && !uiButtonClicked) {
        uiState.selectedNodeId = null;
        uiButtons = {};
    }
    // --- Priority 1: Захват нейтральной ноды ---
    for (const obj of potentialNeutralTargets) {
        const node = obj.node;
        const canCapture = node.neighbors.some(nid => {
            const n = game_state.nodes[nid];
            return n && n.owner === 'player';
        });
        if (canCapture) {
            if (!godMode && game_state.dp < 10) return;
            if (!godMode) game_state.dp -= 10;
            node.isCapturing = true;
            node.captureProgress = 0.01;
            node.owner = 'player';
            node.program = null;
            node.shieldHealth = 0;
            uiState.selectedNodeId = node.id;
            return;
        }
    }
    // --- Priority 2: Выбор своей ноды ---
    if (potentialPlayerTargets.length > 0) {
        const node = potentialPlayerTargets[0].node;
        const hasEnemy = game_state.enemies.some(enemy => enemy.currentNodeId === node.id);
        if (hasEnemy) {
            // Визуальный фидбек: shake
            triggerScreenShake(8, 180);
            return;
        }
        uiState.selectedNodeId = node.id;
        return;
    }
    // --- Priority 3: Клик по HUB для финального захвата ---
    for (const obj of potentialHubTargets) {
        const node = obj.node;
        if (node.owner === 'player' && !game_state.hubCaptureActive) {
            game_state.hubCaptureActive = true;
            game_state.hubCaptureProgress = 0;
            return;
        }
    }
    // --- Priority 4: Снять выделение ---
    uiState.selectedNodeId = null;
    uiButtons = {};
});

function findPathBFS(nodesObj, startId, endId) {
    if (!startId || !endId) return null;
    const queue = [[startId]];
    const visited = new Set([startId]);
    while (queue.length) {
        const path = queue.shift();
        const last = path[path.length - 1];
        if (last === endId) return path;
        for (const neighbor of nodesObj[last].neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push([...path, neighbor]);
            }
        }
    }
    return null;
}

function drawConnection(ctx, n1, n2, time, highlight = false) {
    // Цвет соединения по owner
    let sameOwner = n1.owner === n2.owner && n1.owner !== 'neutral';
    let color, shadow;
    if (sameOwner && n1.owner === 'player') {
        color = '#ff9100'; shadow = '#ffb347';
    } else if (sameOwner && n1.owner === 'enemy') {
        color = '#ff1744'; shadow = '#ff668a';
    } else if (highlight) {
        color = `rgba(255,23,68,0.95)`; shadow = '#ff1744';
    } else {
        color = `rgba(0,234,255,0.85)`; shadow = '#00eaff';
    }
    const pulse = 0.5 + 0.5 * Math.sin(time / 250 + (n1.x + n2.x + n1.y + n2.y) / 200);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.strokeStyle = color;
    ctx.shadowColor = shadow;
    ctx.shadowBlur = highlight ? 18 + 10 * pulse : (sameOwner ? 14 : 6 + 6 * pulse);
    ctx.lineWidth = highlight ? 5 + 2 * pulse : (sameOwner ? 4 : 3.5 + 1.2 * pulse);
    ctx.stroke();
    // Внутренняя "нить"
    ctx.shadowBlur = 0;
    ctx.lineWidth = highlight ? 2.5 : 1.5;
    ctx.strokeStyle = highlight ? '#fff0fa' : '#fff';
    ctx.globalAlpha = highlight ? 1 : (0.7 + 0.3 * pulse);
    ctx.stroke();
    ctx.restore();
}

function drawEnemy(ctx, node, type = 'patrol', enemy = null) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, 13, 0, 2 * Math.PI);
    if (type === 'hunter') {
        ctx.fillStyle = '#b388ff';
        ctx.shadowColor = '#b388ff';
    } else {
        ctx.fillStyle = '#ff1744';
        ctx.shadowColor = '#ff1744';
    }
    ctx.shadowBlur = 16;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type === 'hunter' ? 'H' : 'E', node.x, node.y+1);
    // --- stun/glitch effect ---
    if (enemy && enemy.isStunnedUntil && enemy.isStunnedUntil > Date.now()) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = '#00eaff';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 7; i++) {
            ctx.beginPath();
            let angle = Math.random() * 2 * Math.PI;
            let r1 = 10 + Math.random() * 6;
            let r2 = r1 + 7 + Math.random() * 7;
            ctx.moveTo(node.x + Math.cos(angle) * r1, node.y + Math.sin(angle) * r1);
            ctx.lineTo(node.x + Math.cos(angle) * r2, node.y + Math.sin(angle) * r2);
            ctx.stroke();
        }
        ctx.restore();
    }
    ctx.restore();
}

function drawProgramIcon(ctx, node) {
    if (!node.program) return;
    ctx.save();
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Цвет иконки по типу
    let icon = '?', color = '#fff';
    if (node.program.type === 'miner') { icon = 'M'; color = '#ffd600'; }
    if (node.program.type === 'shield') { icon = 'S'; color = '#00eaff'; }
    if (node.program.type === 'sentry') { icon = 'T'; color = '#00ff90'; }
    ctx.fillStyle = color;
    ctx.fillText(icon, node.x, node.y + 18);
    // Индикатор уровня
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#ffd600';
    ctx.fillText(node.program.level, node.x + 13, node.y + 13);
    ctx.restore();
}

function drawResourcePanel(ctx, game_state) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#222b';
    ctx.fillRect(18, 18, 170, 70);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('DP: ' + game_state.dp, 32, 40);
    ctx.fillText('CPU: ' + game_state.cpu, 32, 62);
    ctx.fillText('TRACE: ' + Math.floor(game_state.traceLevel) + ' / 200', 32, 80);
    // HUB CAPTURE
    if (game_state.hubCaptureActive) {
        ctx.font = 'bold 17px sans-serif';
        ctx.fillStyle = '#ff1744';
        ctx.fillText('HUB CAPTURE: ' + Math.floor(game_state.hubCaptureProgress*100) + '%', 32, 110);
    }
    // EMP Blast button
    const x = 32, y = 120, w = 180, h = 38;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fillStyle = game_state.cpu >= 50 && game_state.empCooldown <= 0 ? '#232b33ee' : '#232b3344';
    ctx.shadowColor = '#00eaff';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00eaff';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    let label = 'EMP Blast (50 CPU)';
    if (game_state.empCooldown > 0) {
        label += ` (${Math.ceil(game_state.empCooldown/1000)}s)`;
    }
    ctx.fillText(label, x + 16, y + h/2);
    uiState.uiButtons['emp'] = { x, y, w, h, type: 'emp' };
    ctx.restore();
    ctx.restore();
}

function drawNode(ctx, node, selected = false, highlight = false) {
    ctx.save();
    // Пульсация размера
    let base = node.type === 'hub' ? 36 : 18;
    let amp = node.type === 'hub' ? 6 : 1.5;
    let freq = node.type === 'hub' ? 1.5 : 0.7;
    let phase = node.randomPhase || 0;
    let time = performance.now() / 1000;
    if (highlight) { amp *= 1.7; base += 2; }
    let size = base + Math.sin(time * freq + phase) * amp;
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    // Цвет и свечение по owner и типу
    let fill, shadow, stroke;
    if (node.type === 'cpu_node') {
        fill = '#b388ff'; shadow = '#e1bfff'; stroke = '#b388ff';
    } else if (node.type === 'data_cache') {
        fill = '#fff'; shadow = '#00eaff'; stroke = '#00eaff';
    } else if (node.owner === 'player') {
        fill = '#ff9100'; shadow = '#ffb347'; stroke = '#ff9100';
    } else if (node.owner === 'enemy') {
        fill = '#ff1744'; shadow = '#ff668a'; stroke = '#ff1744';
    } else {
        fill = '#00eaff'; shadow = '#66f6ff'; stroke = '#fff';
    }
    if (highlight) {
        shadow = '#ff1744'; fill = node.type === 'hub' ? '#ff9100' : '#ff1744'; stroke = '#ff1744';
    }
    ctx.shadowColor = shadow;
    ctx.shadowBlur = highlight ? 32 : (node.type === 'hub' ? 24 : 18);
    ctx.fillStyle = fill;
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = highlight ? 4 : 3;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    // Подпись для спец.ноды
    if (node.type === 'cpu_node') {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CPU', node.x, node.y);
    }
    if (node.type === 'data_cache') {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#00eaff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DATA', node.x, node.y);
    }
    // Прогресс-бар захвата
    if (node.isCapturing) {
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#fff';
        ctx.globalAlpha = 0.85;
        ctx.arc(node.x, node.y, size + 6, -Math.PI/2, -Math.PI/2 + 2 * Math.PI * node.captureProgress);
        ctx.stroke();
        ctx.restore();
    }
    // Decapturing (врагом)
    if (node.owner === 'player' && node.captureProgress < 1 && !node.isCapturing) {
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#ff1744';
        ctx.globalAlpha = 0.85;
        ctx.arc(node.x, node.y, size + 10, -Math.PI/2, -Math.PI/2 + 2 * Math.PI * (1 - node.captureProgress));
        ctx.stroke();
        ctx.restore();
    }
    // Прогресс-бар щита
    if (node.owner === 'player' && node.program && node.program.type === 'shield' && node.shieldHealth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 6.5;
        ctx.strokeStyle = '#00eaff';
        ctx.globalAlpha = 0.92;
        let shieldFrac = node.shieldHealth / node.maxShieldHealth;
        ctx.setLineDash([8, 7]);
        ctx.lineDashOffset = -performance.now()/18;
        ctx.arc(node.x, node.y, size + 16, -Math.PI/2, -Math.PI/2 + 2 * Math.PI * shieldFrac);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
    // Прогресс-бар Sentry (зелёный, если установлен)
    if (node.owner === 'player' && node.program && node.program.type === 'sentry') {
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 5.5;
        ctx.strokeStyle = '#00ff90';
        ctx.globalAlpha = 0.7;
        ctx.setLineDash([3, 7]);
        ctx.lineDashOffset = -performance.now()/10;
        ctx.arc(node.x, node.y, size + 12, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
    // Прогресс-бар Miner (жёлтый, пульсирующий)
    if (node.owner === 'player' && node.program && node.program.type === 'miner') {
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#ffd600';
        ctx.globalAlpha = 0.55 + 0.25 * Math.sin(performance.now()/300 + node.x);
        ctx.setLineDash([2, 10]);
        ctx.lineDashOffset = -performance.now()/12;
        ctx.arc(node.x, node.y, size + 8, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
    // Текст для HUB
    if (node.type === 'hub') {
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HUB', node.x, node.y);
    }
    ctx.restore();
    // Программа
    drawProgramIcon(ctx, node);
    // Прогресс-бар финального захвата HUB
    if (node.type === 'hub' && game_state.hubCaptureActive) {
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 11;
        ctx.strokeStyle = '#fff';
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 24;
        ctx.globalAlpha = 0.92;
        ctx.arc(node.x, node.y, size + 26, -Math.PI/2, -Math.PI/2 + 2 * Math.PI * game_state.hubCaptureProgress);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#ff1744';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 32, -Math.PI/2, -Math.PI/2 + 2 * Math.PI * game_state.hubCaptureProgress);
        ctx.stroke();
        ctx.restore();
    }
    // Индикатор угрозы (Hunter targeting)
    if (node.isTargeted) {
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 7.5;
        ctx.strokeStyle = '#ff1744';
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(performance.now()/120);
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 18;
        ctx.arc(node.x, node.y, size + 22 + 4*Math.sin(performance.now()/180), 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
    }
}

function getRandomPath(nodesObj, startId, length = 5) {
    // Простой случайный путь по соседям
    let path = [startId];
    let current = startId;
    for (let i = 0; i < length; i++) {
        const neighbors = nodesObj[current].neighbors.filter(nid => !path.includes(nid));
        if (neighbors.length === 0) break;
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        path.push(next);
        current = next;
    }
    return path;
}

function drawProgramUI(ctx, selectedNode) {
    if (!selectedNode) return;
    ctx.save();
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // --- Смещение UI внутрь canvas ---
    let offsetX = 40;
    let offsetY = 0;
    const btnW = 140, btnH = 38, btnW2 = 120, btnH2 = 36, spacing = 12;
    let totalHeight = btnH2 * 3 + spacing * 2;
    if (selectedNode.type === 'cpu_node') totalHeight += btnH2 + spacing;
    let menuRight = selectedNode.x + offsetX + btnW;
    let menuTop = selectedNode.y - totalHeight/2;
    let menuBottom = selectedNode.y + totalHeight/2;
    if (menuRight > canvas.width - 10) offsetX -= (menuRight - (canvas.width - 10));
    if (menuTop < 10) offsetY += (10 - menuTop);
    if (menuBottom > canvas.height - 10) offsetY -= (menuBottom - (canvas.height - 10));
    uiButtons = {};
    if (selectedNode.program) {
        let prog = selectedNode.program;
        let baseCost = prog.type === 'miner' ? 20 : prog.type === 'shield' ? 30 : 40;
        let cost = baseCost * prog.level;
        let cpuCost = 5 * prog.level;
        const x = selectedNode.x + offsetX;
        const y = selectedNode.y - btnH/2 + offsetY;
        ctx.beginPath();
        ctx.roundRect(x, y, btnW, btnH, 10);
        ctx.fillStyle = '#232b33ee';
        ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00eaff';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        let label = prog.type === 'miner' ? 'Miner' : prog.type === 'shield' ? 'Shield' : 'Sentry';
        ctx.fillText(`Upgrade ${label} (Lvl ${prog.level+1}, ${cost} DP, ${cpuCost} CPU)`, x + 16, y + btnH/2);
        uiButtons['upgrade'] = { x, y, w: btnW, h: btnH, type: 'upgrade', cost, cpuCost };
    }
    // Кнопки установки
    const buttonData = [];
    if (selectedNode.type !== 'cpu_node') {
        buttonData.push({ label: 'Miner', cost: 20, type: 'miner' });
        buttonData.push({ label: 'Shield', cost: 30, type: 'shield' });
        buttonData.push({ label: 'Sentry', cost: 40, type: 'sentry' });
    }
    if (selectedNode.type === 'cpu_node') {
        buttonData.push({ label: 'Overclocker', cost: 50, type: 'overclocker' });
    }
    const startX = selectedNode.x + offsetX;
    const startY = selectedNode.y - ((btnH2 + spacing) * buttonData.length - spacing) / 2 + offsetY;
    for (let i = 0; i < buttonData.length; i++) {
        const btn = buttonData[i];
        const x = startX;
        const y = startY + i * (btnH2 + spacing);
        ctx.beginPath();
        ctx.roundRect(x, y, btnW2, btnH2, 10);
        ctx.fillStyle = '#232b33ee';
        ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00eaff';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillText(`${btn.label} (${btn.cost} DP)`, x + 16, y + btnH2 / 2);
        uiButtons[btn.type] = { x, y, w: btnW2, h: btnH2, type: btn.type };
    }
    ctx.restore();
}

function render() {
    isRendering = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const time = Date.now();
    // Соединения
    for (const id in game_state.nodes) {
        const node = game_state.nodes[id];
        for (const nId of node.neighbors) {
            if (id < nId) {
                drawConnection(ctx, node, game_state.nodes[nId], time, false);
            }
        }
    }
    // Ноды
    for (const id in game_state.nodes) {
        let selected = (id === uiState.selectedNodeId);
        drawNode(ctx, game_state.nodes[id], selected, false);
    }
    // Враги
    for (const enemy of game_state.enemies) {
        const node = game_state.nodes[enemy.currentNodeId];
        if (node) drawEnemy(ctx, node, enemy.type, enemy);
    }
    // Панель ресурсов
    drawResourcePanel(ctx, game_state);
    // --- UI программ ---
    if (uiState.selectedNodeId) {
        const selectedNode = game_state.nodes[uiState.selectedNodeId];
        drawProgramUI(ctx, selectedNode);
    }
    // --- Визуальные эффекты Sentry ---
    for (const shot of sentryShots) {
        const t = (performance.now() - shot.time) / 200;
        if (t > 1) continue;
        // Неоново-зелёный лазер
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = '#00ff90'; // ярко-зелёный
        ctx.shadowColor = '#00ff90';
        ctx.shadowBlur = 22;
        ctx.lineWidth = 5 + 7 * (1 - t);
        ctx.beginPath();
        ctx.moveTo(shot.from.x, shot.from.y);
        ctx.lineTo(shot.to.x, shot.to.y);
        ctx.stroke();
        // Брутальные бегущие волны
        const waveCount = 7;
        const dx = shot.to.x - shot.from.x;
        const dy = shot.to.y - shot.from.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx);
        for (let i = 0; i < waveCount; i++) {
            const frac = (i + ((performance.now()/90) % 1)) / waveCount;
            const px = shot.from.x + dx * frac;
            const py = shot.from.y + dy * frac;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.arc(0, 0, 6 + 3 * Math.sin(performance.now()/60 + i), 0, 2 * Math.PI);
            ctx.globalAlpha = 0.45 * (1 - t);
            ctx.fillStyle = '#00ff90';
            ctx.shadowColor = '#00ff90';
            ctx.shadowBlur = 16;
            ctx.fill();
            ctx.restore();
        }
        // Внутренняя белая нить
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.globalAlpha = 0.7 * (1 - t);
        ctx.beginPath();
        ctx.moveTo(shot.from.x, shot.from.y);
        ctx.lineTo(shot.to.x, shot.to.y);
        ctx.stroke();
        ctx.restore();
    }
    // --- Вспышки на врагах ---
    for (const flash of sentryFlashes) {
        const t = (performance.now() - flash.time) / 180;
        if (t > 1) continue;
        ctx.save();
        ctx.globalAlpha = 0.7 * (1 - t);
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, 18 + 10 * (1 - t), 0, 2 * Math.PI);
        ctx.fillStyle = '#00eaff';
        ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.restore();
    }
    // --- Взрывы врагов ---
    for (const boom of enemyExplosions) {
        const t = (performance.now() - boom.time) / 420;
        if (t > 1) continue;
        ctx.save();
        ctx.globalAlpha = 0.7 * (1 - t);
        ctx.beginPath();
        ctx.arc(boom.x, boom.y, 22 + 38 * t, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255,255,255,${0.18 * (1-t)})`;
        ctx.shadowColor = '#00ff90';
        ctx.shadowBlur = 32;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(boom.x, boom.y, 12 + 18 * t, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(0,255,144,${0.45 * (1-t)})`;
        ctx.shadowColor = '#00ff90';
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.restore();
    }
    // Очищаем старые взрывы
    enemyExplosions = enemyExplosions.filter(boom => (performance.now() - boom.time) < 420);
    // --- Screen shake ---
    let shakeX = 0, shakeY = 0;
    if (screenShake.duration > 0) {
        shakeX = (Math.random() - 0.5) * 2 * screenShake.magnitude;
        shakeY = (Math.random() - 0.5) * 2 * screenShake.magnitude;
        ctx.save();
        ctx.translate(shakeX, shakeY);
    }
    if (screenShake.duration > 0) {
        ctx.restore();
    }
    // --- Очистка массивов эффектов ---
    sentryShots = sentryShots.filter(shot => (performance.now() - shot.time) < 400);
    sentryFlashes = sentryFlashes.filter(flash => (performance.now() - flash.time) < 300);
    enemyExplosions = enemyExplosions.filter(boom => (performance.now() - boom.time) < 420);
    isRendering = false;
}

function mainLoop() {
    if (gameOver) {
        uiState.selectedNodeId = null;
        uiButtons = {};
        return;
    }
    // --- God mode: пропуск затрат, атак, traceLevel ---
    if (godMode) {
        // Не увеличиваем traceLevel, не тратим ресурсы, не атакуют враги
        game_state.traceLevel = Math.max(game_state.traceLevel, 0);
    }
    // --- Победа: захват HUB ---
    if (game_state.hubCaptureActive) {
        // Усиливаем угрозу
        game_state.traceLevel = Math.max(game_state.traceLevel, 90);
        // Ускоряем спавн врагов
        lastEnemySpawn -= 2500; // ускоряем таймер (спавн каждые ~2.5 сек)
        // Прогресс захвата
        game_state.hubCaptureProgress += 1 / (60 * 60); // ~60 сек до победы
        if (game_state.hubCaptureProgress >= 1) {
            game_state.hubCaptureProgress = 1;
            gameOver = true;
            alert('YOU WIN!');
            return;
        }
    }
    // --- Проверка Game Over ---
    if (game_state.traceLevel >= 200) {
        alert('GAME OVER: TraceLevel достиг максимума!');
        gameOver = true;
        return;
    }
    if (game_state.playerRootNodeId) {
        const root = game_state.nodes[game_state.playerRootNodeId];
        if (!root || root.owner !== 'player') {
            alert('GAME OVER: Потеряна корневая нода!');
            gameOver = true;
            return;
        }
    }
    // --- Захват нод
    for (const id in game_state.nodes) {
        const node = game_state.nodes[id];
        if (!node) continue;
        if (node.isCapturing) {
            node.captureProgress += 0.012;
            if (node.captureProgress >= 1) {
                node.isCapturing = false;
                node.captureProgress = 0;
                node.owner = 'player';
                if (!game_state.playerRootNodeId) game_state.playerRootNodeId = node.id;
                game_state.traceLevel += 1; // +1 за захват
                // --- Data Cache бонус ---
                if (node.type === 'data_cache') {
                    game_state.dp += 100;
                    node.type = 'data'; // чтобы бонус не выдавался повторно
                }
                console.log('Node captured:', node.id);
            }
        }
    }
    // --- Ресурсы от miner ---
    const now = Date.now();
    if (now - lastMinerTick > 1000) {
        let miners = 0;
        for (const id in game_state.nodes) {
            const node = game_state.nodes[id];
            if (!node) continue;
            if (node.owner === 'player' && node.program && node.program.type === 'miner') {
                game_state.dp += 3 + 2 * (node.program.level - 1);
                miners++;
            }
        }
        if (miners > 0) console.log('DP from miners:', miners, 'Total DP:', game_state.dp);
        lastMinerTick = now;
    }
    // --- Враги ---
    if (now - lastEnemySpawn > (game_state.hubCaptureActive ? 2500 : 5000)) {
        // Спавним врага только на нейтральных или вражеских нодах, не на HUB, и не ближе 4 шагов от HUB
        function bfsDistance(nodes, from, to) {
            if (from === to) return 0;
            const queue = [[from, 0]];
            const visited = new Set([from]);
            while (queue.length) {
                const [curr, dist] = queue.shift();
                for (const nId of nodes[curr].neighbors) {
                    if (nId === to) return dist + 1;
                    if (!visited.has(nId)) {
                        visited.add(nId);
                        queue.push([nId, dist + 1]);
                    }
                }
            }
            return Infinity;
        }
        const spawnableNodes = Object.values(game_state.nodes).filter(n => n.owner !== 'player' && n.type !== 'hub' && bfsDistance(game_state.nodes, n.id, 'hub') >= 4);
        if (spawnableNodes.length > 0) {
            const start = spawnableNodes[Math.floor(Math.random() * spawnableNodes.length)].id;
            if (!game_state.hubCaptureActive && game_state.traceLevel < 40) {
                // Обычный патрульный враг
                const path = getRandomPath(game_state.nodes, start, 6 + Math.floor(Math.random()*4));
                const enemy = new Enemy('enemy' + (enemyIdCounter++), start, path, 'patrol');
                game_state.enemies.push(enemy);
                console.log('Enemy spawned:', enemy.id, 'path:', path);
            } else {
                // Hunter: ищет ближайшую ноду игрока (или соседа HUB в финале)
                let targets;
                if (game_state.hubCaptureActive) {
                    // Все новые враги идут к соседям HUB
                    const hub = game_state.nodes['hub'];
                    targets = hub.neighbors.filter(nid => game_state.nodes[nid].owner === 'player');
                } else {
                    targets = Object.values(game_state.nodes).filter(n => n.owner === 'player').map(n => n.id);
                }
                if (targets.length > 0) {
                    // Находим ближайшую к старту
                    let minDist = Infinity, target = null;
                    for (const tid of targets) {
                        const n = game_state.nodes[tid];
                        const d = getDistance(game_state.nodes[start].x, game_state.nodes[start].y, n.x, n.y);
                        if (d < minDist) { minDist = d; target = n.id; }
                    }
                    const path = findPathBFS(game_state.nodes, start, target) || [start];
                    // --- Threat indicator ---
                    if (game_state.nodes[target]) {
                        game_state.nodes[target].isTargeted = true;
                        game_state.nodes[target].targetedUntil = Date.now() + 1000;
                    }
                    const enemy = new Enemy('hunter' + (enemyIdCounter++), start, path, 'hunter');
                    game_state.enemies.push(enemy);
                    console.log('Hunter spawned:', enemy.id, 'path:', path);
                }
            }
        }
        lastEnemySpawn = now;
    }
    // --- Движение врагов ---
    for (const enemy of game_state.enemies) {
        if (!enemy) continue;
        // --- Диагностика зависания ---
        if (enemy.pathStep >= enemy.path.length - 1) {
            // Если враг не может двигаться дальше, но цель ещё существует — пробуем пересчитать путь
            if (enemy.type === 'hunter') {
                // Найти новую цель (ближайшая нода игрока)
                let targets = Object.values(game_state.nodes).filter(n => n && n.owner === 'player').map(n => n.id);
                if (targets.length > 0) {
                    let minDist = Infinity, target = null;
                    for (const tid of targets) {
                        const n = game_state.nodes[tid];
                        if (!n) continue;
                        const d = getDistance(game_state.nodes[enemy.currentNodeId].x, game_state.nodes[enemy.currentNodeId].y, n.x, n.y);
                        if (d < minDist) { minDist = d; target = n.id; }
                    }
                    const newPath = findPathBFS(game_state.nodes, enemy.currentNodeId, target);
                    if (newPath && newPath.length > 1) {
                        enemy.path = newPath;
                        enemy.pathStep = 0;
                        console.log('Hunter', enemy.id, 'recalculated path:', newPath);
                    } else {
                        // Если путь невозможен — удаляем врага
                        enemy.health = 0;
                        console.log('Enemy', enemy.id, 'stuck and removed (no path)');
                    }
                } else {
                    // Нет целей — удаляем врага
                    enemy.health = 0;
                    console.log('Enemy', enemy.id, 'stuck and removed (no targets)');
                }
            } else {
                // Патрульный: пробуем случайный путь
                const newPath = getRandomPath(game_state.nodes, enemy.currentNodeId, 5 + Math.floor(Math.random()*3));
                if (newPath && newPath.length > 1) {
                    enemy.path = newPath;
                    enemy.pathStep = 0;
                    console.log('Patrol', enemy.id, 'recalculated path:', newPath);
                } else {
                    enemy.health = 0;
                    console.log('Enemy', enemy.id, 'stuck and removed (no random path)');
                }
            }
            continue;
        }
        if (enemy.pathStep < enemy.path.length - 1) {
            if (!enemy.lastMove || now - enemy.lastMove > 1200) {
                enemy.pathStep++;
                enemy.currentNodeId = enemy.path[enemy.pathStep];
                enemy.lastMove = now;
                console.log('Enemy', enemy.id, 'moved to', enemy.currentNodeId);
            }
        }
        // Проверка на de-capturing
        const node = game_state.nodes[enemy.currentNodeId];
        if (!node) continue;
        if (node.owner === 'player') {
            const enemiesOnNode = game_state.enemies.filter(enemy => enemy.currentNodeId === node.id);
            if (enemiesOnNode.length > 0) {
                // Суммарный урон по щиту
                if (node.program && node.program.type === 'shield' && node.shieldHealth > 0) {
                    if (!godMode) node.shieldHealth -= 0.7 * enemiesOnNode.length;
                    if (node.shieldHealth < 0) node.shieldHealth = 0;
                    enemiesOnNode.forEach(enemy => enemy.decapturing = true);
                    continue;
                }
                // Decapturing прогресс
                if (!node.program || (node.program.type !== 'sentry')) {
                    node.isCapturing = false;
                    if (!godMode) node.captureProgress -= 0.02 * enemiesOnNode.length;
                    if (node.captureProgress < 0) node.captureProgress = 0;
                    if (node.captureProgress === 0) {
                        // --- 4. Жёсткий сброс статусов при потере ---
                        node.owner = 'neutral';
                        node.program = null;
                        node.shieldHealth = 0;
                        node.maxShieldHealth = 100;
                        node.isCapturing = false;
                        node.captureProgress = 0;
                        if (uiState.selectedNodeId === node.id) {
                            uiState.selectedNodeId = null;
                            uiButtons = {};
                        }
                        recalcAllEnemyPaths();
                        triggerScreenShake(7, 250);
                    }
                    enemiesOnNode.forEach(enemy => enemy.decapturing = true);
                    continue;
                } else {
                    enemiesOnNode.forEach(enemy => enemy.decapturing = false);
                }
            }
        }
    }
    // --- Логика Sentry с diminishing returns ---
    sentryShots = [];
    sentryFlashes = [];
    const sentryRange = 200;
    for (const id in game_state.nodes) {
        const node = game_state.nodes[id];
        if (!node) continue;
        if (node.owner === 'player' && node.program && node.program.type === 'sentry') {
            // Считаем nearbySentryCount
            let nearbySentryCount = 0;
            for (const otherId in game_state.nodes) {
                if (otherId === id) continue;
                const other = game_state.nodes[otherId];
                if (!other) continue;
                if (other.owner === 'player' && other.program && other.program.type === 'sentry') {
                    const dist = getDistance(node.x, node.y, other.x, other.y);
                    if (dist < 120) nearbySentryCount++;
                }
            }
            let nearest = null;
            let minDist = Infinity;
            for (const enemy of game_state.enemies) {
                if (!enemy) continue;
                const enemyNode = game_state.nodes[enemy.currentNodeId];
                if (!enemyNode) continue;
                const dist = getDistance(node.x, node.y, enemyNode.x, enemyNode.y);
                if (dist < sentryRange && dist < minDist) {
                    minDist = dist;
                    nearest = enemy;
                }
            }
            if (nearest) {
                // Diminishing returns + апгрейд-бафф
                let baseDmg = 2.5 + 2 * (node.program.level - 1);
                let dmg = baseDmg * (1 / (1 + nearbySentryCount * 0.5));
                nearest.health -= dmg;
                const targetNode = game_state.nodes[nearest.currentNodeId];
                if (targetNode) {
                    sentryShots.push({
                        from: { x: node.x, y: node.y },
                        to: { x: targetNode.x, y: targetNode.y },
                        time: performance.now()
                    });
                    sentryFlashes.push({
                        x: targetNode.x,
                        y: targetNode.y,
                        time: performance.now()
                    });
                }
            }
        }
    }
    // --- Удаление уничтоженных врагов и награда ---
    const before = game_state.enemies.length;
    game_state.enemies = game_state.enemies.filter(enemy => {
        if (!enemy) return false;
        if (enemy.health > 0) return true;
        // Награда за уничтожение врага
        game_state.dp += 10;
        // Взрыв на месте врага
        const node = game_state.nodes[enemy.currentNodeId];
        if (node) {
            enemyExplosions.push({
                x: node.x,
                y: node.y,
                time: performance.now()
            });
            triggerScreenShake(5, 150);
        }
        game_state.traceLevel += 2; // +2 за уничтожение врага Sentry
        return false;
    });
    // --- Shield: сила щита зависит от уровня ---
    for (const id in game_state.nodes) {
        const node = game_state.nodes[id];
        if (node.owner === 'player' && node.program && node.program.type === 'shield') {
            node.maxShieldHealth = 100 * node.program.level;
            if (node.shieldHealth > node.maxShieldHealth) node.shieldHealth = node.maxShieldHealth;
        }
    }
    // --- Overclocker: +1 CPU/сек на cpu_node ---
    if (now - (mainLoop.lastCpuTick || 0) > 1000) {
        for (const id in game_state.nodes) {
            const node = game_state.nodes[id];
            if (node.owner === 'player' && node.program && node.program.type === 'overclocker') {
                game_state.cpu += 1 * node.program.level;
            }
        }
        mainLoop.lastCpuTick = now;
    }
    // --- Сброс угрозы с нод ---
    for (const id in game_state.nodes) {
        const node = game_state.nodes[id];
        if (node && node.isTargeted && Date.now() > node.targetedUntil) node.isTargeted = false;
    }
    // --- God mode: пропуск затрат, атак, traceLevel ---
    if (godMode) {
        // Не увеличиваем traceLevel, не тратим ресурсы, не атакуют враги
        game_state.traceLevel = Math.max(game_state.traceLevel, 0);
    } else {
        // Обычный рост traceLevel
        game_state.traceLevel += 0.005;
    }
    // --- В mainLoop ---
    if (game_state.empCooldown > 0) {
        game_state.empCooldown -= 16;
        if (game_state.empCooldown < 0) game_state.empCooldown = 0;
    }
    render();
    if (screenShake.duration > 0) {
        screenShake.duration -= 16; // ~1 кадр
        if (screenShake.duration < 0) screenShake.duration = 0;
    }
    requestAnimationFrame(mainLoop);
}

function recalcAllEnemyPaths() {
    for (const enemy of game_state.enemies) {
        if (!enemy) continue;
        // Найти ближайшую цель (игрока) для hunter, случайную для patrol
        if (enemy.type === 'hunter') {
            let targets = Object.values(game_state.nodes).filter(n => n && n.owner === 'player').map(n => n.id);
            if (targets.length > 0) {
                let minDist = Infinity, target = null;
                for (const tid of targets) {
                    const n = game_state.nodes[tid];
                    if (!n) continue;
                    const d = getDistance(game_state.nodes[enemy.currentNodeId].x, game_state.nodes[enemy.currentNodeId].y, n.x, n.y);
                    if (d < minDist) { minDist = d; target = n.id; }
                }
                const newPath = findPathBFS(game_state.nodes, enemy.currentNodeId, target);
                if (newPath && newPath.length > 1) {
                    enemy.path = newPath;
                    enemy.pathStep = 0;
                }
            }
        } else {
            const newPath = getRandomPath(game_state.nodes, enemy.currentNodeId, 5 + Math.floor(Math.random()*3));
            if (newPath && newPath.length > 1) {
                enemy.path = newPath;
                enemy.pathStep = 0;
            }
        }
    }
}

function startNewGame() {
    game_state.nodes = generateCanvasNetwork();
    if (game_state.nodes['hub']) {
        game_state.nodes['hub'].owner = 'player';
        game_state.playerRootNodeId = 'hub';
    }
    game_state.dp = 100;
    game_state.cpu = 50;
    game_state.traceLevel = 0;
    game_state.enemies = [];
    game_state.hubCaptureActive = false;
    game_state.hubCaptureProgress = 0;
    uiState.selectedNodeId = null;
    uiButtons = {};
    sentryShots = [];
    sentryFlashes = [];
    enemyExplosions = [];
    gameOver = false;
    lastMinerTick = 0;
    lastEnemySpawn = 0;
    enemyIdCounter = 1;
    render();
}

game_state.nodes = generateCanvasNetwork();
// Делаем HUB стартовой нодой игрока
if (game_state.nodes['hub']) {
    game_state.nodes['hub'].owner = 'player';
    game_state.playerRootNodeId = 'hub';
}
runForceSimulation(game_state.nodes, 250);
fixEdgeIntersectionsAndReconnect(game_state.nodes);
attachTailsToNetwork(game_state.nodes);
mainLoop();

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
}); 