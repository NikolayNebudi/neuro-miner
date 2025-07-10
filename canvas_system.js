// --- Глобальные переменные ---
let gameState = {
    nodes: {},
    dp: 0,
    cpu: 0,
    traceLevel: 0,
    playerRootNodeId: 'hub',
    enemies: [],
    selectedNodeId: null,
    hubCaptureActive: false,
    hubCaptureProgress: 0,
    empCooldown: 0,
    techLevel: 1,
    game_time: 0,
    lastMinerTick: 0,
    lastEnemySpawn: 0,
    enemyIdCounter: 1,
    win: false,
    phase: 'MENU', // FSM: 'MENU', 'PLAYING', 'END_SCREEN'
    hubLevel: 1,
};
let uiButtons = {};
let visualEffects = { sentryShots: [], sentryFlashes: [], enemyExplosions: [] };
let screenShake = { duration: 0, magnitude: 0 };
let godMode = false;
let lastTimestamp = 0;
let lastHint = '';
let hoveredNodeId = null;

// --- CANVAS NETWORK SYSTEM ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
});

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
let pathAnim = { path: null, startTime: 0, hovered: null };

function triggerScreenShake(magnitude, duration) {
    screenShake.duration = duration;
    screenShake.magnitude = magnitude;
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'g' || e.key === 'G') {
        godMode = !godMode;
        alert('God Mode: ' + (godMode ? 'ON' : 'OFF'));
        if (!godMode) {
            // Сбросить traceLevel, если ушёл в минус
            if (gameState.traceLevel < 0) gameState.traceLevel = 0;
            // Можно добавить сброс других временных флагов, если появятся
        }
    }
    if (e.key === 'Escape') {
        gameState.selectedNodeId = null;
        uiButtons = {};
    }
});

canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    hoveredNodeId = null;
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
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
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // --- END_SCREEN ---
    if (gameState.phase === 'END_SCREEN') {
        // Play Again кнопка
        const x = canvas.width/2-80, y = canvas.height/2+30, w = 160, h = 44;
        if (mx >= x && mx <= x+w && my >= y && my <= y+h) {
            gameState.phase = 'MENU';
            return;
        }
    }
    // --- MENU ---
    if (gameState.phase === 'MENU') {
        // Start New Game кнопка
        const x = canvas.width/2-90, y = canvas.height/2+60, w = 180, h = 48;
        if (mx >= x && mx <= x+w && my >= y && my <= y+h) {
            startNewGame();
            gameState.phase = 'PLAYING';
            return;
        }
    }
    // --- PLAYING ---
    if (gameState.phase !== 'PLAYING') return;
    // EMP Blast
    if (uiButtons['emp']) {
        const b = uiButtons['emp'];
        if (mx >= b.x && mx <= b.x+b.w && my >= b.y && my <= b.y+b.h) {
            if (gameState.cpu >= 50 && gameState.empCooldown <= 0) {
                gameState.cpu -= 50;
                gameState.empCooldown = 8000;
                for (const enemy of gameState.enemies) {
                    enemy.isStunnedUntil = performance.now() + 3500;
                }
                return;
            }
        }
    }
    // UI-кнопки программ
    for (const key in uiButtons) {
        const b = uiButtons[key];
        if (mx >= b.x && mx <= b.x+b.w && my >= b.y && my <= b.y+b.h) {
            if (key === 'upgrade' && gameState.selectedNodeId) {
                const node = gameState.nodes[gameState.selectedNodeId];
                if (node && node.program) {
                    let baseCost = node.program.type === 'miner' ? 20 : node.program.type === 'shield' ? 30 : 40;
                    let cost = baseCost * node.program.level;
                    let cpuCost = 5 * node.program.level;
                    if (gameState.dp >= cost && gameState.cpu >= cpuCost && node.program.level < gameState.hubLevel) {
                        gameState.dp -= cost;
                        gameState.cpu -= cpuCost;
                        node.program.level++;
                        sound.play('upgrade');
                        gameState.selectedNodeId = null;
                        return;
                    }
                }
            }
            if (key === 'upgrade_hub' && gameState.selectedNodeId) {
                const node = gameState.nodes[gameState.selectedNodeId];
                if (node && node.type === 'hub') {
                    // --- Стоимость апгрейда HUB: ручной UX-тест ---
                    let cost = 30 * gameState.hubLevel; // Было: 50 * hubLevel. Для RL-анализа заменить формулу на RL-оптимальную.
                    if (gameState.cpu >= cost) {
                        gameState.cpu -= cost;
                        gameState.hubLevel++;
                        sound.play('upgrade');
                        gameState.selectedNodeId = null;
                        return;
                    }
                }
            }
            if ((key === 'miner' || key === 'shield' || key === 'sentry') && gameState.selectedNodeId) {
                const node = gameState.nodes[gameState.selectedNodeId];
                if (node && !node.program && node.owner === 'player') {
                    let cost = key === 'miner' ? 20 : key === 'shield' ? 30 : 40;
                    if (gameState.dp >= cost) {
                        gameState.dp -= cost;
                        node.program = { type: key, level: 1 };
                        gameState.selectedNodeId = null;
                        return;
                    }
                }
            }
            if (key === 'overclocker' && gameState.selectedNodeId) {
                const node = gameState.nodes[gameState.selectedNodeId];
                if (node && node.type === 'cpu_node' && node.owner === 'player') {
                    if (gameState.dp >= 50) {
                        gameState.dp -= 50;
                        node.program = { type: 'overclocker', level: 1 };
                        gameState.cpu += 30;
                        gameState.selectedNodeId = null;
                        return;
                    }
                }
            }
        }
    }
    // --- Захват/выделение ноды ---
    let found = false;
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        let base = node.type === 'hub' ? 36 : 18;
        let amp = node.type === 'hub' ? 6 : 1.5;
        let freq = node.type === 'hub' ? 1.5 : 0.7;
        let phase = node.randomPhase || 0;
        let time = performance.now() / 1000;
        let size = base + Math.sin(time * freq + phase) * amp;
        let dx = mx - node.x, dy = my - node.y;
        if (dx*dx + dy*dy <= (size+8)*(size+8)) {
            // Если клик по своей — просто выделяем
            if (node.owner === 'player') {
                gameState.selectedNodeId = id;
                found = true;
                break;
            }
            // Если клик по нейтральной/вражеской, и есть сосед-союзник — захват
            if ((node.owner !== 'player' && !node.isCapturing)) {
                let hasPlayerNeighbor = node.neighbors.some(nid => gameState.nodes[nid] && gameState.nodes[nid].owner === 'player');
                if (hasPlayerNeighbor && gameState.dp >= 10) {
                    node.isCapturing = true;
                    node.captureProgress = 0;
                    gameState.dp -= 10;
                    sound.play('capture_start');
                    gameState.selectedNodeId = id;
                    found = true;
                    break;
                }
            }
            // В остальных случаях — просто выделяем
            gameState.selectedNodeId = id;
            found = true;
            break;
        }
    }
    if (!found) gameState.selectedNodeId = null;
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

// --- RENDERING FUNCTIONS ---
function drawConnection(ctx, n1, n2, time) {
    let sameOwner = n1.owner === n2.owner && n1.owner !== 'neutral';
    let color, shadow;
    if (sameOwner && n1.owner === 'player') { color = '#ff9100'; shadow = '#ffb347'; }
    else if (sameOwner && n1.owner === 'enemy') { color = '#ff1744'; shadow = '#ff668a'; }
    else { color = `rgba(0,234,255,0.85)`; shadow = '#00eaff'; }
    const pulse = 0.5 + 0.5 * Math.sin(time / 250 + (n1.x + n2.x + n1.y + n2.y) / 200);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.strokeStyle = color;
    ctx.shadowColor = shadow;
    ctx.shadowBlur = sameOwner ? 14 : 6 + 6 * pulse;
    ctx.lineWidth = sameOwner ? 4 : 3.5 + 1.2 * pulse;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    ctx.stroke();
    ctx.restore();
}

function drawEnemy(ctx, node, type, enemy) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, 13, 0, 2 * Math.PI);
    if (type === 'hunter') { ctx.fillStyle = '#b388ff'; ctx.shadowColor = '#b388ff'; }
    else { ctx.fillStyle = '#ff1744'; ctx.shadowColor = '#ff1744'; }
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
    if (enemy && enemy.isStunnedUntil && enemy.isStunnedUntil > performance.now()) {
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
    let icon = '?', color = '#fff';
    let time = performance.now() / 1000;
    if (node.program.type === 'miner') {
        icon = 'M'; color = '#ffd600';
        // Анимация: пульсирующее кольцо
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.12 * Math.sin(time*3 + node.x);
        ctx.beginPath();
        ctx.arc(node.x, node.y, 22 + 4*Math.sin(time*2 + node.y), 0, 2 * Math.PI);
        ctx.fillStyle = '#ffd600';
        ctx.shadowColor = '#ffd600';
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.restore();
    }
    if (node.program.type === 'shield') {
        icon = 'S'; color = '#00eaff';
        // Анимация: вращающийся глоу
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.translate(node.x, node.y);
        ctx.rotate(time);
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, 20, i * Math.PI/2, i * Math.PI/2 + Math.PI/4);
            ctx.strokeStyle = '#00eaff';
            ctx.lineWidth = 5;
            ctx.shadowColor = '#00eaff';
            ctx.shadowBlur = 12;
            ctx.stroke();
        }
        ctx.restore();
    }
    if (node.program.type === 'sentry') {
        icon = 'T'; color = '#00ff90';
        // Анимация: пульсирующее кольцо
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.12 * Math.sin(time*4 + node.x + node.y);
        ctx.beginPath();
        ctx.arc(node.x, node.y, 26 + 6*Math.abs(Math.sin(time*2 + node.x)), 0, 2 * Math.PI);
        ctx.strokeStyle = '#00ff90';
        ctx.lineWidth = 4.5;
        ctx.shadowColor = '#00ff90';
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.restore();
    }
    if (node.program.type === 'overclocker') { icon = 'C'; color = '#b388ff'; }
    ctx.fillStyle = color;
    ctx.fillText(icon, node.x, node.program.level > 1 ? node.y + 12 : node.y + 18);
    if (node.program.level > 1) {
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#ffd600';
        ctx.fillText(node.program.level, node.x + 13, node.y + 22);
    }
    ctx.restore();
}

function drawResourcePanel(ctx) {
    if (!gameState || !gameState.nodes) return;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#222b';
    ctx.fillRect(18, 18, 220, 150);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('DP: ' + Math.floor(gameState.dp), 32, 40);
    ctx.fillText('CPU: ' + gameState.cpu, 32, 62);
    ctx.fillText('TRACE: ' + Math.floor(gameState.traceLevel) + ' / 200', 32, 84);
    if (gameState.hubCaptureActive) {
        ctx.font = 'bold 17px sans-serif';
        ctx.fillStyle = '#ff1744';
        ctx.fillText('HUB CAPTURE: ' + Math.floor(gameState.hubCaptureProgress*100) + '%', 32, 110);
    }
    const x = 32, y = 125, w = 180, h = 38;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fillStyle = gameState.cpu >= 50 && gameState.empCooldown <= 0 ? '#232b33ee' : '#232b3344';
    ctx.shadowColor = '#00eaff'; ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = '#00eaff'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif';
    let label = 'EMP Blast (50 CPU)';
    if (gameState.empCooldown > 0) {
        label = `Cooldown (${Math.ceil(gameState.empCooldown/1000)}s)`;
    }
    ctx.fillText(label, x + 10, y + h/2 + 2);
    ctx.restore();
}

function drawNode(ctx, node) {
    if (!node) return;
    ctx.save();
    let time = performance.now() / 1000;
    let isSelected = (gameState.selectedNodeId === node.id);
    let base = node.type === 'hub' ? 36 : 18;
    let amp = isSelected ? 4 : (node.type === 'hub' ? 6 : 1.5);
    let freq = node.type === 'hub' ? 1.5 : 0.7;
    let size = base + Math.sin(time * freq + node.randomPhase) * amp;
    
    // Цвета по умолчанию
    let fill, shadow, stroke;
    if (node.type === 'cpu_node')   { fill = '#b388ff'; shadow = '#e1bfff'; stroke = '#b388ff'; }
    else if (node.type === 'data_cache') { fill = '#fff'; shadow = '#00eaff'; stroke = '#00eaff'; }
    else if (node.owner === 'player')    { fill = '#ff9100'; shadow = '#ffb347'; stroke = '#ff9100'; }
    else                                 { fill = '#00eaff'; shadow = '#66f6ff'; stroke = '#fff'; }

    // --- Особые цвета и эффекты для программ ---
    if (node.owner === 'player' && node.program) {
        let lvl = node.program.level || 1;
        if (node.program.type === 'miner') {
            // Цвет и глоу усиливаются с уровнем
            const minerColors = ['#ffd600', '#ffe066', '#fff2b2'];
            fill = minerColors[Math.min(lvl-1, minerColors.length-1)];
            shadow = fill;
            stroke = '#fffbe7';
            // Яркое пульсирующее кольцо
            for (let i = 0; i < lvl; i++) {
                ctx.save();
                ctx.globalAlpha = 0.18 + 0.08*i;
                ctx.beginPath();
                ctx.arc(node.x, node.y, size + 12 + 6*i + 3*Math.sin(time*2 + i), 0, 2 * Math.PI);
                ctx.strokeStyle = minerColors[Math.min(i, minerColors.length-1)];
                ctx.lineWidth = 4 + 2*i;
                ctx.shadowColor = minerColors[Math.min(i, minerColors.length-1)];
                ctx.shadowBlur = 18 + 8*i;
                ctx.stroke();
                ctx.restore();
            }
        }
        if (node.program.type === 'shield') {
            const shieldColors = ['#00eaff', '#33f6ff', '#b2faff'];
            fill = shieldColors[Math.min(lvl-1, shieldColors.length-1)];
            shadow = fill;
            stroke = '#e0f7fa';
            // Вращающийся глоу и кольца
            for (let i = 0; i < lvl; i++) {
                ctx.save();
                ctx.globalAlpha = 0.18 + 0.08*i;
                ctx.translate(node.x, node.y);
                ctx.rotate(time * (1 + i*0.5));
                ctx.beginPath();
                ctx.arc(0, 0, size + 10 + 7*i, 0, 2 * Math.PI);
                ctx.strokeStyle = shieldColors[Math.min(i, shieldColors.length-1)];
                ctx.lineWidth = 5 + 2*i;
                ctx.shadowColor = shieldColors[Math.min(i, shieldColors.length-1)];
                ctx.shadowBlur = 16 + 8*i;
                ctx.stroke();
                ctx.restore();
            }
        }
        if (node.program.type === 'sentry') {
            const sentryColors = ['#00ff90', '#00ffcc', '#b2ffe7'];
            fill = sentryColors[Math.min(lvl-1, sentryColors.length-1)];
            shadow = fill;
            stroke = '#e0ffe7';
            // Пульсирующие кольца и вспышки
            for (let i = 0; i < lvl; i++) {
                ctx.save();
                ctx.globalAlpha = 0.18 + 0.08*i;
                ctx.beginPath();
                ctx.arc(node.x, node.y, size + 14 + 7*i + 4*Math.abs(Math.sin(time*2 + i)), 0, 2 * Math.PI);
                ctx.strokeStyle = sentryColors[Math.min(i, sentryColors.length-1)];
                ctx.lineWidth = 4.5 + 2*i;
                ctx.shadowColor = sentryColors[Math.min(i, sentryColors.length-1)];
                ctx.shadowBlur = 18 + 8*i;
                ctx.stroke();
                ctx.restore();
            }
        }
    }
    if (node.type === 'cpu_node' && node.owner === 'player') {
        // CPU-нода под контролем игрока
        let lvl = node.program?.level || 1;
        const cpuColors = ['#b388ff', '#d1aaff', '#f3e6ff'];
        fill = cpuColors[Math.min(lvl-1, cpuColors.length-1)];
        shadow = fill;
        stroke = '#fffbe7';
        // Яркое пульсирующее фиолетовое кольцо
        for (let i = 0; i < lvl; i++) {
            ctx.save();
            ctx.globalAlpha = 0.22 + 0.09*i;
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 16 + 7*i + 4*Math.sin(time*2 + i), 0, 2 * Math.PI);
            ctx.strokeStyle = cpuColors[Math.min(i, cpuColors.length-1)];
            ctx.lineWidth = 5 + 2*i;
            ctx.shadowColor = cpuColors[Math.min(i, cpuColors.length-1)];
            ctx.shadowBlur = 22 + 10*i;
            ctx.stroke();
            ctx.restore();
        }
        // Пульсация внутреннего свечения
        ctx.save();
        ctx.globalAlpha = 0.13 + 0.09 * Math.abs(Math.sin(time*2));
        ctx.beginPath();
        ctx.arc(node.x, node.y, size - 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#b388ff';
        ctx.shadowColor = '#b388ff';
        ctx.shadowBlur = 18 + 8*lvl;
        ctx.fill();
        ctx.restore();
    }
    if (isSelected) { shadow = '#ff1744'; stroke = '#ff1744'; }

    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.shadowColor = shadow; ctx.shadowBlur = isSelected ? 32 : (node.type === 'hub' ? 24 : 18);
    ctx.fillStyle = fill; ctx.fill();
    ctx.shadowBlur = 0; ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke();
    
    if (node.type === 'cpu_node') { ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CPU', node.x, node.y); }
    if (node.type === 'data_cache') { ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#00eaff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('DATA', node.x, node.y); }
    
    if (node.isCapturing) {
        ctx.save(); ctx.lineWidth = 4.5; ctx.strokeStyle = '#fff';
        ctx.beginPath(); ctx.arc(node.x, node.y, size + 6, -Math.PI/2, -Math.PI/2 + 2 * Math.PI * node.captureProgress); ctx.stroke(); ctx.restore();
    }
    
    if (node.owner === 'player' && node.program?.type === 'shield' && node.shieldHealth > 0) {
        ctx.save(); ctx.lineWidth = 6.5; ctx.strokeStyle = '#00eaff';
        let frac = node.shieldHealth / node.maxShieldHealth;
        ctx.setLineDash([8, 7]); ctx.lineDashOffset = -time*10;
        ctx.beginPath(); ctx.arc(node.x, node.y, size + 16, -Math.PI/2, -Math.PI/2 + 2 * Math.PI * frac); ctx.stroke(); ctx.restore();
    }

    if (node.type === 'hub') { ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('HUB', node.x, node.y); }
    ctx.restore();
    drawProgramIcon(ctx, node);

    if (node.type === 'hub' && gameState.hubCaptureActive) {
        ctx.save(); ctx.beginPath(); ctx.lineWidth = 11; ctx.strokeStyle = '#fff'; ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 24;
        ctx.arc(node.x, node.y, size + 26, -Math.PI/2, -Math.PI/2 + 2 * Math.PI * gameState.hubCaptureProgress); ctx.stroke();
        ctx.restore();
    }
    if (node.isTargeted) {
        ctx.save(); ctx.lineWidth = 7.5; ctx.strokeStyle = '#ff1744'; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time*5);
        ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(node.x, node.y, size + 22 + 4*Math.sin(time*5), 0, 2 * Math.PI); ctx.stroke();
        ctx.restore();
    }
}

function calculateProgramUIButtons(selectedNode) {
    if (!selectedNode) return {};
    const buttons = {};
    let offsetX = 40, offsetY = 0;
    const btnW = 210, btnH = 38, btnW2 = 180, btnH2 = 36, spacing = 12; // увеличил ширину
    if(selectedNode.x + offsetX + btnW > canvas.width) offsetX = - (btnW + 40);

    // --- HUB: только апгрейд ---
    if (selectedNode.type === 'hub') {
        const x = selectedNode.x + offsetX;
        const y = selectedNode.y - btnH/2 + offsetY;
        buttons['upgrade_hub'] = { x, y, w: btnW, h: btnH, type: 'upgrade_hub' };
        return buttons;
    }

    if (selectedNode.program) {
        const x = selectedNode.x + offsetX;
        const y = selectedNode.y - btnH/2 + offsetY;
        // --- Ограничение: апгрейд только если hubLevel >= целевого уровня ---
        if (selectedNode.program.level < gameState.hubLevel) {
            buttons['upgrade'] = { x, y, w: btnW, h: btnH, type: 'upgrade'};
        }
    } else {
        const buttonData = [];
        if (selectedNode.type === 'cpu_node') {
            buttonData.push({ label: 'Overclocker', cost: 50, type: 'overclocker' });
        } else {
            buttonData.push({ label: 'Miner', cost: 20, type: 'miner' });
            buttonData.push({ label: 'Shield', cost: 30, type: 'shield' });
            buttonData.push({ label: 'Sentry', cost: 40, type: 'sentry' });
        }
        const totalHeight = buttonData.length * (btnH2 + spacing) - spacing;
        const startY = selectedNode.y - totalHeight/2 + offsetY;
        for (let i = 0; i < buttonData.length; i++) {
            const btn = buttonData[i];
            buttons[btn.type] = { x: selectedNode.x + offsetX, y: startY + i * (btnH2 + spacing), w: btnW2, h: btnH2, type: btn.type, cost: btn.cost, label: btn.label };
        }
    }
    return buttons;
}

function drawProgramUI(ctx, selectedNode) {
    if (!selectedNode) return;
    ctx.save();
    ctx.font = 'bold 15px sans-serif'; ctx.textBaseline = 'middle'; // уменьшил шрифт
    uiButtons = calculateProgramUIButtons(selectedNode); // Recalculate for drawing
    for (const key in uiButtons) {
        const btn = uiButtons[key];
        ctx.beginPath(); ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 10);
        ctx.fillStyle = '#232b33ee'; ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
        ctx.lineWidth = 2; ctx.strokeStyle = '#00eaff'; ctx.stroke();
        ctx.fillStyle = '#fff';
        let label = '';
        if (btn.type === 'upgrade') {
            let prog = selectedNode.program;
            let baseCost = prog.type === 'miner' ? 20 : prog.type === 'shield' ? 30 : 40;
            let cost = Math.round(baseCost * 1.5 * prog.level);
            let cpuCost = 10 * prog.level;
            label = `Upgrade Lvl ${prog.level+1}\n(${cost}DP, ${cpuCost}CPU)`;
        } else if (btn.type === 'upgrade_hub') {
            // --- Отображение стоимости апгрейда HUB ---
            let cost = 30 * gameState.hubLevel; // Было: 50 * hubLevel. Для RL-анализа заменить формулу на RL-оптимальную.
            label = `Upgrade HUB\n(${cost} CPU)`;
        } else {
            let btnLabel = btn.label || '';
            let btnCost = btn.cost !== undefined ? btn.cost : '?';
            label = `${btnLabel} (${btnCost} DP)`;
        }
        ctx.textAlign = 'center';
        // Перенос строки, если есть \n
        if (label.includes('\n')) {
            const [l1, l2] = label.split('\n');
            ctx.fillText(l1, btn.x + btn.w/2, btn.y + btn.h/2 - 8);
            ctx.fillText(l2, btn.x + btn.w/2, btn.y + btn.h/2 + 8);
        } else {
            ctx.fillText(label, btn.x + btn.w/2, btn.y + btn.h/2);
        }
    }
    ctx.restore();
}

function drawMenu(ctx) {
    ctx.save();
    ctx.fillStyle = '#181c22ee'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 48px sans-serif'; ctx.fillStyle = '#ffd600'; ctx.textAlign = 'center';
    ctx.fillText('NETWORK ECHO', canvas.width/2, canvas.height/2 - 80);
    ctx.font = '22px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('AI-Driven Balance Edition', canvas.width/2, canvas.height/2 - 40);
    
    const btn = { x: canvas.width/2-120, y: canvas.height/2+20, w: 240, h: 50 };
    ctx.beginPath(); ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 15);
    ctx.fillStyle = '#ffd600'; ctx.fill();
    ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#232b33'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Start New Game', btn.x + btn.w/2, btn.y + btn.h/2);
    ctx.restore();
}

function drawEndScreen(ctx, isWin, score) {
    ctx.save();
    ctx.fillStyle = isWin ? 'rgba(0, 255, 144, 0.85)' : 'rgba(255, 23, 68, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 48px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(isWin ? 'YOU WIN!' : 'GAME OVER', canvas.width/2, canvas.height/2 - 60);
    ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('Final DP: ' + Math.floor(score), canvas.width/2, canvas.height/2 - 10);
    
    const btn = { x: canvas.width/2 - 80, y: canvas.height/2 + 30, w: 160, h: 44 };
    ctx.beginPath(); ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 10);
    ctx.fillStyle = '#232b33'; ctx.fill();
    ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#ffd600'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Main Menu', btn.x + btn.w/2, btn.y + btn.h/2);
    ctx.restore();
}

function drawHint(ctx, text) {
    if (!text) return;
    ctx.save();
    ctx.globalAlpha = 0.92; ctx.fillStyle = '#232b33ee';
    ctx.font = 'bold 16px sans-serif';
    const textWidth = ctx.measureText(text).width;
    ctx.fillRect(20, canvas.height-70, textWidth + 30, 44);
    ctx.fillStyle = '#ffd600'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 35, canvas.height - 48);
    ctx.restore();
}

function render() {
    isRendering = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const time = Date.now();
    // Соединения
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        for (const nId of node.neighbors) {
            if (id < nId) {
                drawConnection(ctx, node, gameState.nodes[nId], time);
            }
        }
    }
    // Ноды
    for (const id in gameState.nodes) {
        let selected = (id === gameState.selectedNodeId);
        drawNode(ctx, gameState.nodes[id]);
    }
    // Враги
    for (const enemy of gameState.enemies) {
        const node = gameState.nodes[enemy.currentNodeId];
        if (node) drawEnemy(ctx, node, enemy.type, enemy);
    }
    // Панель ресурсов
    drawResourcePanel(ctx);
    // --- UI программ ---
    if (gameState.selectedNodeId) {
        const selectedNode = gameState.nodes[gameState.selectedNodeId];
        drawProgramUI(ctx, selectedNode);
    }
    // --- Визуальные эффекты Sentry ---
    for (const shot of visualEffects.sentryShots) {
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
    for (const flash of visualEffects.sentryFlashes) {
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
    for (const boom of visualEffects.enemyExplosions) {
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
    visualEffects.enemyExplosions = visualEffects.enemyExplosions.filter(boom => (performance.now() - boom.time) < 420);
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
    visualEffects.sentryShots = visualEffects.sentryShots.filter(shot => (performance.now() - shot.time) < 400);
    visualEffects.sentryFlashes = visualEffects.sentryFlashes.filter(flash => (performance.now() - flash.time) < 300);
    visualEffects.enemyExplosions = visualEffects.enemyExplosions.filter(boom => (performance.now() - boom.time) < 420);
    isRendering = false;
}

function update(dt, now) {
    // --- Управление состоянием игры ---
    if (gameState.phase !== 'PLAYING') return;

    gameState.game_time += dt;

    // --- Win/Loss Conditions ---
    if (!godMode) {
        if (gameState.traceLevel >= 200) {
            gameState.phase = 'END_SCREEN'; gameState.win = false; sound.play('lose'); return;
        }
        if (gameState.playerRootNodeId && (!gameState.nodes[gameState.playerRootNodeId] || gameState.nodes[gameState.playerRootNodeId].owner !== 'player')) {
            gameState.phase = 'END_SCREEN'; gameState.win = false; sound.play('lose'); return;
        }
    }

    // --- Финальный захват HUB ---
    if (gameState.hubCaptureActive) {
        gameState.traceLevel = Math.max(gameState.traceLevel, 180);
        gameState.hubCaptureProgress += dt / 60; // ~60 секунд до победы
        if (gameState.hubCaptureProgress >= 1) {
            gameState.phase = 'END_SCREEN'; gameState.win = true; sound.play('win'); return;
        }
    }
    
    // --- Глобальный рост TraceLevel ---
    if (!godMode) {
        gameState.traceLevel += (0.1 + gameState.traceLevel * 0.001) * dt; // Растет все быстрее
    }

    // --- Логика для каждого узла ---
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (!node) continue;

        // 1. Захват узлов
        if (node.isCapturing) {
            node.captureProgress += dt; // 1 секунда на захват
            if (node.captureProgress >= 1) {
                node.isCapturing = false;
                node.captureProgress = 0;
                node.owner = 'player';
                node.program = null;
                if (!godMode) gameState.traceLevel += 5; // Значительный штраф за расширение
                sound.play('capture_success');
                if (node.type === 'data_cache') {
                    gameState.dp += 100;
                    node.type = 'data'; // Бонус выдается один раз
                }
            }
        }

        // 2. Логика программ игрока
        if (node.owner === 'player' && node.program) {
            // Регенерация щита
            if (node.program.type === 'shield') {
                node.maxShieldHealth = 100 * Math.pow(1.5, node.program.level - 1);
                if (node.shieldHealth < node.maxShieldHealth) {
                    node.shieldHealth += (10 * node.program.level) * dt;
                    if (node.shieldHealth > node.maxShieldHealth) node.shieldHealth = node.maxShieldHealth;
                }
            }
            // Атака Sentry
            if (node.program.type === 'sentry') {
                if (!node.program.cooldown || now > node.program.cooldown) {
                    let sentryRange = 200 + 20 * (node.program.level - 1);
                    let nearestEnemy = null, minDist = sentryRange;
                    for (const enemy of gameState.enemies) {
                        const enemyNode = gameState.nodes[enemy.currentNodeId];
                        if (!enemyNode) continue;
                        const dist = getDistance(node.x, node.y, enemyNode.x, enemyNode.y);
                        if (dist < minDist) { minDist = dist; nearestEnemy = enemy; }
                    }
                    if (nearestEnemy) {
                        let baseDmg = 5 * Math.pow(2, node.program.level - 1); // Урон удваивается с уровнем
                        const enemyNode = gameState.nodes[nearestEnemy.currentNodeId];
                        nearestEnemy.health -= baseDmg;
                        visualEffects.sentryShots.push({ from: {x:node.x, y:node.y}, to: {x:enemyNode.x, y:enemyNode.y}, time: now });
                        visualEffects.sentryFlashes.push({ x:enemyNode.x, y:enemyNode.y, time: now });
                        sound.play('sentry_shoot');
                        node.program.cooldown = now + (1000 / node.program.level);
                    }
                }
            }
        }
    }

    // --- Ресурсы (раз в секунду) ---
    gameState.lastMinerTick += dt;
    if (gameState.lastMinerTick > 1) {
        let dpIncome = 0, cpuIncome = 0;
        if(gameState.nodes['hub'] && gameState.nodes['hub'].owner === 'player') dpIncome += 2; // Базовый доход от HUB
        for (const id in gameState.nodes) {
            const node = gameState.nodes[id];
            if (node.owner === 'player' && node.program) {
                const level = node.program.level;
                if (node.program.type === 'miner') dpIncome += 3 * Math.pow(1.8, level - 1);
                if (node.program.type === 'overclocker') cpuIncome += 1 * level;
            }
        }
        gameState.dp += Math.floor(dpIncome);
        gameState.cpu += Math.floor(cpuIncome);
        gameState.lastMinerTick = 0;
    }
    
    // --- Враги ---
    gameState.lastEnemySpawn += dt;
    const spawnInterval = gameState.hubCaptureActive ? 2 : Math.max(1.5, (10 - (gameState.traceLevel * 0.02)) ); // секунды
    if (gameState.lastEnemySpawn > spawnInterval) {
        const spawnableNodes = Object.values(gameState.nodes).filter(n => n.owner !== 'player' && n.type !== 'hub');
        if (spawnableNodes.length > 0) {
            const startNode = spawnableNodes[Math.floor(Math.random() * spawnableNodes.length)];
            let enemyType = (gameState.traceLevel > 50 || gameState.hubCaptureActive) ? 'hunter' : 'patrol';
            let path;
            if (enemyType === 'hunter') {
                let targets = Object.values(gameState.nodes).filter(n => n.owner === 'player' && n.program?.type === 'miner' || n.type === 'cpu_node');
                if (targets.length === 0) targets = Object.values(gameState.nodes).filter(n => n.owner === 'player');
                
                if (targets.length > 0) {
                    let targetNode = targets[Math.floor(Math.random() * targets.length)];
                    path = findPathBFS(gameState.nodes, startNode.id, targetNode.id);
                    if (gameState.nodes[targetNode.id]) {
                        gameState.nodes[targetNode.id].isTargeted = true;
                        gameState.nodes[targetNode.id].targetedUntil = performance.now() + 3000;
                    }
                }
            }
            if (!path || path.length < 2) path = getRandomPath(gameState.nodes, startNode.id, 10);
            
            const enemy = new Enemy('e' + gameState.enemyIdCounter++, startNode.id, path, enemyType);
            enemy.lastMove = 0; // таймер движения
            gameState.enemies.push(enemy);
        }
        gameState.lastEnemySpawn = 0;
    }

    // Логика врагов (движение, атака)
    for (const enemy of gameState.enemies) {
        if (enemy.isStunnedUntil > performance.now()) continue;
        if (!enemy.path || enemy.pathStep >= enemy.path.length - 1) {
            recalcAllEnemyPaths();
            continue;
        }
        if (enemy.lastMove === undefined) enemy.lastMove = 0;
        enemy.lastMove += dt;
        let moveInterval = (enemy.type === 'hunter' ? 0.9 : 1.4); // секунды
        if (enemy.lastMove > moveInterval) {
            enemy.pathStep++; enemy.currentNodeId = enemy.path[enemy.pathStep]; enemy.lastMove = 0;
        }
        const node = gameState.nodes[enemy.currentNodeId];
        if (node && node.owner === 'player' && !godMode) {
            let damage = 30 * dt;
            if (node.program?.type === 'shield' && node.shieldHealth > 0) {
                node.shieldHealth -= damage;
            } else if (node.program?.type !== 'sentry') {
                node.captureProgress -= 0.3 * dt;
                if (node.captureProgress <= 0) {
                    node.owner = 'neutral'; node.program = null; node.captureProgress = 0; node.shieldHealth = 0;
                    if(gameState.selectedNodeId === node.id) gameState.selectedNodeId = null;
                    triggerScreenShake(7, 250); sound.play('node_lost');
                }
            }
        }
    }
    
    // --- Очистка и таймеры ---
    const killedEnemies = gameState.enemies.filter(e => e.health <= 0);
    if(killedEnemies.length > 0) {
        if (!godMode) gameState.traceLevel += 3 * killedEnemies.length;
        gameState.dp += 15 * killedEnemies.length;
        for(const enemy of killedEnemies) {
            const node = gameState.nodes[enemy.currentNodeId];
            if (node) visualEffects.enemyExplosions.push({x:node.x, y:node.y, time: now});
        }
        triggerScreenShake(5, 150); sound.play('enemy_explode');
    }
    gameState.enemies = gameState.enemies.filter(e => e.health > 0);
    
    if (gameState.empCooldown > 0) gameState.empCooldown -= dt * 1000;
    if (screenShake.duration > 0) screenShake.duration -= dt * 1000;
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.isTargeted && now > node.targetedUntil) node.isTargeted = false;
    }
}

function mainLoop() {
    if (gameState.phase === 'MENU') {
        drawMenu(ctx);
        requestAnimationFrame(mainLoop);
        return;
    }
    if (gameState.phase === 'END_SCREEN') {
        render();
        drawEndScreen(ctx, gameState.win, gameState.dp);
        requestAnimationFrame(mainLoop);
        return;
    }
    // PLAYING
    const now = performance.now();
    const dt = (now - lastTimestamp) / 1000;
    lastTimestamp = now;
    update(dt, now);
    render();
    requestAnimationFrame(mainLoop);
}

function startNewGame() {
    gameState.nodes = generateCanvasNetwork();
    if (gameState.nodes['hub']) {
        gameState.nodes['hub'].owner = 'player';
        gameState.playerRootNodeId = 'hub';
    }
    runForceSimulation(gameState.nodes, 250);
    fixEdgeIntersectionsAndReconnect(gameState.nodes);
    attachTailsToNetwork(gameState.nodes);
    gameState.dp = 100;
    gameState.cpu = 50;
    gameState.traceLevel = 0;
    gameState.enemies = [];
    gameState.selectedNodeId = null;
    gameState.hubCaptureActive = false;
    gameState.hubCaptureProgress = 0;
    gameState.empCooldown = 0;
    gameState.techLevel = 1;
    gameState.lastMinerTick = 0;
    gameState.lastEnemySpawn = 0;
    gameState.enemyIdCounter = 1;
    gameState.win = false;
    gameState.phase = 'PLAYING';
    lastTimestamp = performance.now();
    uiButtons = {};
    visualEffects = { sentryShots: [], sentryFlashes: [], enemyExplosions: [] };
}

// --- SOUND SYSTEM ---
const sound = {
    play: function(name) {
        // TODO: подключить реальные звуки
        console.log('[SOUND]', name);
    }
};

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ВРАГОВ ---
function getRandomPath(nodesObj, startId, length = 5) {
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

function recalcAllEnemyPaths() {
    for (const enemy of gameState.enemies) {
        if (!enemy.currentNodeId) continue;
        // Попробуем найти ближайшую player-ноду
        let targets = Object.values(gameState.nodes).filter(n => n.owner === 'player');
        if (targets.length === 0) continue;
        let targetNode = targets[Math.floor(Math.random() * targets.length)];
        let path = findPathBFS(gameState.nodes, enemy.currentNodeId, targetNode.id);
        if (!path || path.length < 2) path = getRandomPath(gameState.nodes, enemy.currentNodeId, 8);
        enemy.path = path;
        enemy.pathStep = 0;
    }
}

mainLoop();
 