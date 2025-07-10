// RL game engine: полная логика как в canvas_system.js, но без canvas и DOM

// --- Классы ---
class Node {
    constructor(x, y, id, type = 'data', owner = 'neutral') {
        this.x = x;
        this.y = y;
        this.id = id;
        this.type = type;
        this.owner = owner;
        this.resistance = Math.floor(Math.random() * 41) + 10;
        this.program = null;
        this.isCapturing = false;
        this.captureProgress = 0;
        this.neighbors = [];
        this.randomPhase = Math.random() * Math.PI * 2;
        this.shieldHealth = 0;
        this.maxShieldHealth = 100;
        this.isTargeted = false;
        this.targetedUntil = 0;
    }
    addNeighbor(nodeId) {
        if (!this.neighbors.includes(nodeId)) this.neighbors.push(nodeId);
    }
}
class Enemy {
    constructor(id, currentNodeId, path, type = 'patrol') {
        this.id = id;
        this.currentNodeId = currentNodeId;
        this.path = path;
        this.pathStep = 0;
        this.decapturing = false;
        this.health = type === 'hunter' ? 90 : 50;
        this.type = type;
        this.lastMove = 0;
        this.isStunnedUntil = 0;
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
    const width = 1000, height = 700;
    const nodes = [];
    nodes.push(new Node(Math.random() * (width - 200) + 100, Math.random() * (height - 200) + 100, 'hub', 'hub', 'player'));
    const count = Math.floor(Math.random() * 11) + 25;
    for (let i = 0; i < count; i++) {
        let x, y, tries = 0;
        do {
            x = Math.random() * (width - 200) + 100;
            y = Math.random() * (height - 200) + 100;
            tries++;
        } while (nodes.some(n => getDistance(n.x, n.y, x, y) < 40) && tries < 100);
        nodes.push(new Node(x, y, 'node'+i, 'data'));
    }
    // MST (Крускал)
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
    // Доп. рёбра (до 3 связей, без пересечений, с ограничением углов)
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
        let crosses = false;
        for (const [i1, j1] of allEdges) {
            const n1 = nodes[i1], n2 = nodes[j1];
            if (edgeCrosses(nodes[a], nodes[b], n1, n2)) { crosses = true; break; }
        }
        if (crosses) continue;
        let passesThroughNode = false;
        for (const n of nodes) {
            if (n === nodes[a] || n === nodes[b]) continue;
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
    // Спец.ноды
    const nodesObj = {};
    for (const n of nodes) nodesObj[n.id] = n;
    let candidates = nodes.filter(n => n.type === 'data');
    for (let i = 0; i < Math.floor(Math.random()*2)+1; i++) {
        if (candidates.length === 0) break;
        let idx = Math.floor(Math.random()*candidates.length);
        candidates[idx].type = 'cpu_node';
        candidates.splice(idx,1);
    }
    candidates = nodes.filter(n => n.type === 'data');
    for (let i = 0; i < Math.floor(Math.random()*2)+1; i++) {
        if (candidates.length === 0) break;
        let idx = Math.floor(Math.random()*candidates.length);
        candidates[idx].type = 'data_cache';
        candidates.splice(idx,1);
    }
    return nodesObj;
}

// --- Вспомогательные функции для врагов ---
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

function getNetworkCaptureAvailable(gameState) {
    // Считаем процент захваченных нод
    const totalNodes = Object.keys(gameState.nodes).length;
    const playerNodes = Object.values(gameState.nodes).filter(n => n.owner === 'player').length;
    return (playerNodes / totalNodes) >= 0.6;
}

// --- RL API ---
function initGame(config = {}) {
    const nodes = generateCanvasNetwork();
    // Инициализация состояния игры
    const gameState = {
        nodes, // объект с нодами
        dp: 100,
        cpu: 50,
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
        phase: 'PLAYING',
        hubLevel: 1,
        logEvents: [],
        actionLog: [],
        upgradeLog: [],
        // RL-специфичные поля:
        mode: config.mode || 'standard',
        config: config,
        builtTypes: {},
        rewardEvents: [],
        sentryTotalDamage: 0,
        monsterTypes: {},
        mapData: null,
        // Для финального захвата
        networkCaptureAttempted: false,
        networkCaptureProgressMax: 0,
        hubLevelMax: 1,
        stepsToHub4: -1,
        stepsToNetworkCapture: -1,
        enemiesSpawnedTotal: 0,
        enemiesKilledTotal: 0,
        _lastNodeOwnership: {}
    };
    return gameState;
}

const MAX_MINERS = 5;
const MAX_SENTRIES = 10;
const MAX_SHIELDS = 10;
const MAX_OVERCLOCKERS = 3;

function getPossibleActions(gameState) {
    const actions = [{ action: 'wait' }];
    // Подсчёт построенных программ по типам
    const builtTypes = {};
    for (const nodeId in gameState.nodes) {
        const node = gameState.nodes[nodeId];
        if (node.owner === 'player' && node.program) {
            builtTypes[node.program.type] = (builtTypes[node.program.type] || 0) + 1;
        }
    }
    // Захват
    for (const nodeId in gameState.nodes) {
        const node = gameState.nodes[nodeId];
        if (node.owner === 'player') {
            for (const neighborId of node.neighbors) {
                const neighbor = gameState.nodes[neighborId];
                if (neighbor && neighbor.owner !== 'player' && !neighbor.isCapturing) {
                    actions.push({ action: 'capture', nodeId: neighborId });
                }
            }
        }
    }
    // Build/Upgrade
    const programTypes = ['miner', 'shield', 'sentry', 'overclocker'];
    for (const nodeId in gameState.nodes) {
        const node = gameState.nodes[nodeId];
        if (node.owner === 'player') {
            if (!node.program) {
                for (const prog of programTypes) {
                    if (prog === 'overclocker' && node.type !== 'cpu_node') continue;
                    if ((prog === 'miner' || prog === 'shield' || prog === 'sentry') && node.type === 'cpu_node') continue;
                    actions.push({ action: 'build', nodeId, program: prog });
                }
            } else {
                // Ограничение по hubLevel: upgrade только если hubLevel >= целевого уровня
                if (node.program.level < (gameState.hubLevel || 1) && (gameState.hubLevel || 1) > node.program.level) {
                    actions.push({ action: 'upgrade', nodeId });
                }
            }
        }
    }
    // Upgrade HUB (если hubLevel < 4)
    if (gameState.nodes['hub'] && gameState.nodes['hub'].owner === 'player' && (gameState.hubLevel || 1) < 4) {
        actions.push({ action: 'upgrade_hub', nodeId: 'hub' });
    }
    // Network Capture (Захват сети)
    if (
        gameState.nodes['hub'] &&
        gameState.nodes['hub'].owner === 'player' &&
        (gameState.hubLevel || 1) === 4 &&
        !gameState.hubCaptureActive &&
        !gameState.win &&
        getNetworkCaptureAvailable(gameState)
    ) {
        actions.push({ action: 'network_capture', nodeId: 'hub' });
    }
    // EMP Blast
    if (gameState.cpu >= 50 && (!gameState.empCooldown || gameState.empCooldown <= 0)) {
        actions.push({ action: 'emp_blast' });
    }
    return actions;
}

function step(gameState, action) {
    gameState = JSON.parse(JSON.stringify(gameState));
    const logEvents = [];
    let reward = 0;
    let done = false;
    let now = Date.now();

    // --- 1. Применяем действие игрока ---
    switch (action?.action) {
        case 'build': {
            const node = gameState.nodes[action.nodeId];
            if (node && !node.program) {
                const prog = action.program;
                if (prog === 'overclocker' && node.type !== 'cpu_node') break;
                if ((prog === 'miner' || prog === 'shield' || prog === 'sentry') && node.type === 'cpu_node') break;
                // Стоимость
                let baseCost = prog === 'miner' ? 20 : prog === 'shield' ? 30 : prog === 'sentry' ? 35 : 50; // sentry дешевле на 5
                let cpuCost = prog === 'overclocker' ? 10 : 0;
                let count = gameState.builtTypes?.[prog] || 0;
                let cost = baseCost + (baseCost * 0.5 * count);
                if (count === 0) cost = Math.floor(baseCost * 0.5);
                if (gameState.dp >= cost && gameState.cpu >= cpuCost) {
                    gameState.dp -= cost;
                    gameState.cpu -= cpuCost;
                    node.program = { type: prog, level: 1, armor: 5 };
                    if (prog === 'shield') {
                        node.maxShieldHealth = 100;
                        node.shieldHealth = node.maxShieldHealth;
                    }
                    gameState.builtTypes[prog] = (gameState.builtTypes[prog] || 0) + 1;
                    logEvents.push({type: 'build', nodeId: node.id, program: prog, cost, cpuCost});
                }
            }
            break;
        }
        case 'upgrade': {
            const node = gameState.nodes[action.nodeId];
            if (node && node.program && node.program.level < (gameState.hubLevel || 1)) {
                node.program.level += 1;
                // Пересчитываем броню
                node.program.armor = Math.round(5 * (1 + 0.03 * (node.program.level - 1)) * 100) / 100;
                logEvents.push({type: 'upgrade', nodeId: node.id, program: node.program.type, newLevel: node.program.level});
            }
            break;
        }
        case 'upgrade_hub': {
            if (action.nodeId === 'hub' && (gameState.hubLevel || 1) < 4) {
                let nextLevel = (gameState.hubLevel || 1) + 1;
                let hubUpgradeCpu = nextLevel === 2 ? 50 : nextLevel === 3 ? 150 : 300;
                if (gameState.dp >= hubUpgradeCpu && gameState.cpu >= hubUpgradeCpu) {
                    gameState.dp -= hubUpgradeCpu;
                    gameState.cpu -= hubUpgradeCpu;
                    gameState.hubLevel = nextLevel;
                    logEvents.push({type: 'upgrade_hub', newLevel: gameState.hubLevel, cost: hubUpgradeCpu});
                }
            }
            break;
        }
        case 'capture': {
            const node = gameState.nodes[action.nodeId];
            if (node && node.owner !== 'player' && !node.isCapturing && gameState.dp >= 10) {
                node.isCapturing = true;
                node.captureProgress = 0.01;
                gameState.dp -= 10;
                logEvents.push({type: 'capture_start', nodeId: node.id});
            }
            break;
        }
        case 'network_capture': {
            if (action.nodeId === 'hub' && (gameState.hubLevel || 1) === 4 && !gameState.hubCaptureActive && !gameState.win) {
                gameState.hubCaptureActive = true;
                gameState.hubCaptureProgress = 0;
                logEvents.push({type: 'network_capture_start'});
            }
            break;
        }
        case 'emp_blast': {
            if (gameState.cpu >= 50 && (!gameState.empCooldown || gameState.empCooldown <= 0)) {
                gameState.cpu -= 50;
                gameState.empCooldown = 1800; // 30 сек
                for (const enemy of gameState.enemies) {
                    enemy.isStunnedUntil = now + 3000;
                }
                logEvents.push({type: 'emp_blast'});
            }
            break;
        }
        case 'wait':
        default:
            break;
    }

    // --- 2. Ресурсы (раз в "секунду") ---
    gameState.lastMinerTick += 1;
    if (gameState.lastMinerTick > 60) {
        let dpIncome = 0, cpuIncome = 0;
        if(gameState.nodes['hub'] && gameState.nodes['hub'].owner === 'player') dpIncome += 2;
        for (const id in gameState.nodes) {
            const node = gameState.nodes[id];
            if (node.owner === 'player' && node.program) {
                const level = node.program.level || 1;
                if (node.program.type === 'miner') dpIncome += 3 * Math.pow(1.8, level - 1);
                if (node.program.type === 'overclocker') cpuIncome += 1 * level;
            }
        }
        gameState.dp += Math.floor(dpIncome);
        gameState.cpu += Math.floor(cpuIncome);
        logEvents.push({type: 'resource', dpIncome, cpuIncome});
        gameState.lastMinerTick = 0;
    }

    // --- 2.1 Логика программ (sentry, shield) ---
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.owner === 'player' && node.program) {
            // Sentry: атака ближайшего врага
            if (node.program.type === 'sentry') {
                let sentryRange = 200 + 20 * ((node.program.level || 1) - 1);
                let nearestEnemy = null, minDist = sentryRange;
                for (const enemy of gameState.enemies) {
                    const enemyNode = gameState.nodes[enemy.currentNodeId];
                    if (!enemyNode) continue;
                    const dist = getDistance(node.x, node.y, enemyNode.x, enemyNode.y);
                    if (dist < minDist) { minDist = dist; nearestEnemy = enemy; }
                }
                if (nearestEnemy) {
                    let baseDmg = 5 * Math.pow(2, (node.program.level || 1) - 1);
                    nearestEnemy.health -= baseDmg;
                    logEvents.push({type: 'sentry_attack', nodeId: node.id, enemyId: nearestEnemy.id, damage: baseDmg});
                }
            }
            // Shield: регенерация
            if (node.program.type === 'shield') {
                node.maxShieldHealth = 100 * Math.pow(1.5, (node.program.level || 1) - 1);
                if (node.shieldHealth < node.maxShieldHealth) {
                    node.shieldHealth += (10 * (node.program.level || 1));
                    if (node.shieldHealth > node.maxShieldHealth) node.shieldHealth = node.maxShieldHealth;
                }
            }
        }
    }

    // --- Sentry logic: урон и броня ---
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.program && node.program.type === 'sentry') {
            let sentryDamage = 20; // базовый урон +5
            for (const enemy of gameState.enemies) {
                if (enemy.targetNodeId === id) {
                    let damage = sentryDamage;
                    // Armor врага снижает урон
                    if (enemy.armor) {
                        damage = Math.max(0, damage - enemy.armor);
                    }
                    enemy.health -= damage;
                }
            }
        }
    }
    // --- Враги атакуют программы: броня программ снижает урон ---
    for (const enemy of gameState.enemies) {
        if (enemy.targetNodeId && gameState.nodes[enemy.targetNodeId]) {
            const node = gameState.nodes[enemy.targetNodeId];
            if (node.program) {
                let damage = enemy.attack || 10;
                // Armor программ снижает урон (процентная защита)
                let baseArmor = 5;
                let level = node.program.level || 1;
                let armor = Math.round(baseArmor * (1 + 0.03 * (level - 1)) * 100) / 100;
                let reduction = armor / 100; // процент снижения
                damage = Math.max(0, damage * (1 - reduction));
                // Применяем урон (пример: shield, sentry и т.д.)
                // ... существующий код применения урона ...
            }
        }
    }

    // --- 3. Спавн врагов ---
    gameState.lastEnemySpawn += 1;
    const spawnInterval = gameState.hubCaptureActive ? 120 : Math.max(90, (600 - (gameState.traceLevel * 1.2)) );
    if (gameState.lastEnemySpawn > spawnInterval) {
        const spawnableNodes = Object.values(gameState.nodes).filter(n => n.owner !== 'player' && n.type !== 'hub');
        if (spawnableNodes.length > 0) {
            const startNode = spawnableNodes[Math.floor(Math.random() * spawnableNodes.length)];
            let enemyType = (gameState.traceLevel > 50 || gameState.hubCaptureActive) ? 'hunter' : 'patrol';
            let path = null;
            if (enemyType === 'hunter') {
                let targets = Object.values(gameState.nodes).filter(n => (n.owner === 'player' && n.program && n.program.type === 'miner') || n.type === 'cpu_node');
                if (targets.length === 0) targets = Object.values(gameState.nodes).filter(n => n.owner === 'player');
                if (targets.length > 0) {
                    let targetNode = targets[Math.floor(Math.random() * targets.length)];
                    path = findPathBFS(gameState.nodes, startNode.id, targetNode.id);
                }
            }
            if (!path || path.length < 2) path = getRandomPath(gameState.nodes, startNode.id, 10);
            const enemy = new Enemy('e' + gameState.enemyIdCounter++, startNode.id, path, enemyType);
            enemy.lastMove = 0;
            gameState.enemies.push(enemy);
            logEvents.push({
                type: 'enemy_spawn', 
                enemyId: enemy.id, 
                enemyType, 
                startNode: startNode.id,
                health: enemy.health,
                target: path[path.length - 1]
            });
        }
        gameState.lastEnemySpawn = 0;
    }
    // --- 4. Движение и атака врагов ---
    for (const enemy of gameState.enemies) {
        if (enemy.isStunnedUntil > now) continue;
        if (!enemy.path || enemy.pathStep >= enemy.path.length - 1) {
            // Пересчёт пути
            let targets = Object.values(gameState.nodes).filter(n => n.owner === 'player');
            if (targets.length === 0) continue;
            let targetNode = targets[Math.floor(Math.random() * targets.length)];
            let path = findPathBFS(gameState.nodes, enemy.currentNodeId, targetNode.id);
            if (!path || path.length < 2) path = getRandomPath(gameState.nodes, enemy.currentNodeId, 8);
            enemy.path = path;
            enemy.pathStep = 0;
        }
        enemy.lastMove += 1;
        let moveInterval = (enemy.type === 'hunter' ? 54 : 84); // ~0.9/1.4 сек
        if (enemy.lastMove > moveInterval) {
            enemy.pathStep++; 
            enemy.currentNodeId = enemy.path[enemy.pathStep]; 
            enemy.lastMove = 0;
        }
        const node = gameState.nodes[enemy.currentNodeId];
        if (node && node.owner === 'player') {
            let damage = 0.5;
            if (node.program && node.program.type === 'shield' && node.shieldHealth > 0) {
                node.shieldHealth -= damage;
                logEvents.push({type: 'shield_hit', nodeId: node.id, damage, remainingShield: node.shieldHealth});
            } else if (!node.program || node.program.type !== 'sentry') {
                node.captureProgress = (node.captureProgress || 1) - 0.01;
                if (node.captureProgress <= 0) {
                    node.owner = 'neutral'; 
                    node.program = null; 
                    node.captureProgress = 0; 
                    node.shieldHealth = 0;
                    logEvents.push({type: 'node_lost', nodeId: node.id, reason: 'enemy_attack'});
                }
            }
        }
    }
    // --- 5. Очистка убитых врагов ---
    const killedEnemies = gameState.enemies.filter(e => e.health <= 0);
    if(killedEnemies.length > 0) {
        gameState.traceLevel += 3 * killedEnemies.length;
        gameState.dp += 15 * killedEnemies.length;
        for(const enemy of killedEnemies) {
            logEvents.push({type: 'enemy_killed', enemyId: enemy.id, enemyType: enemy.type});
        }
    }
    gameState.enemies = gameState.enemies.filter(e => e.health > 0);

    // --- 5.1 Shaping rewards ---
    let capturedNodes = 0, lostNodes = 0, upgradePerformed = false, hubUpgraded = false;
    
    // Подсчёт захваченных/потерянных нод
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.owner === 'player' && !gameState._lastNodeOwnership?.[id]) {
            capturedNodes++;
        }
        if (node.owner !== 'player' && gameState._lastNodeOwnership?.[id] === 'player') {
            lostNodes++;
        }
    }
    
    // Сохраняем текущее состояние владения нодами
    gameState._lastNodeOwnership = {};
    for (const id in gameState.nodes) {
        gameState._lastNodeOwnership[id] = gameState.nodes[id].owner;
    }
    
    // Проверяем апгрейды
    if (logEvents.some(e => e.type === 'upgrade')) upgradePerformed = true;
    if (logEvents.some(e => e.type === 'upgrade_hub')) hubUpgraded = true;
    
    // Применяем shaping rewards
    reward += capturedNodes * 20;
    reward += killedEnemies.length * 10;
    reward -= lostNodes * 15;
    if (upgradePerformed) reward += 50;
    if (hubUpgraded) reward += 200;

    // --- 6. Финальный захват сети (network_capture) ---
    if (gameState.hubCaptureActive) {
        gameState.traceLevel = Math.max(gameState.traceLevel, 180);
        gameState.hubCaptureProgress += 1 / 1800; // 30 сек (1800 шагов)
        logEvents.push({type: 'network_capture_progress', progress: gameState.hubCaptureProgress});
        if (gameState.hubCaptureProgress >= 1) {
            gameState.win = true;
            done = true;
            logEvents.push({type: 'win', reason: 'network_capture'});
        }
    }
    // --- 7. Победа/поражение ---
    if (gameState.traceLevel >= 300) { done = true; reward -= 1000; logEvents.push({type: 'lose', reason: 'trace'}); } // лимит увеличен до 300
    if (gameState.nodes['hub'] && gameState.nodes['hub'].owner !== 'player') { done = true; reward -= 1000; logEvents.push({type: 'lose', reason: 'hub_lost'}); }
    if (gameState.win) { done = true; reward += 1000; logEvents.push({type: 'win', reason: 'victory'}); }
    // --- 8. Захват нод ---
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.isCapturing) {
            node.captureProgress += 0.012;
            if (node.captureProgress >= 1) {
                node.isCapturing = false;
                node.captureProgress = 0;
                if (node.owner !== 'player') {
                    node.owner = 'player';
                    logEvents.push({type: 'capture_complete', nodeId: node.id});
                    if (node.type === 'data_cache') {
                        gameState.dp += 100;
                        node.type = 'data';
                    }
                }
            }
        }
    }
    // --- 9. EMP cooldown ---
    if (gameState.empCooldown > 0) gameState.empCooldown--;
    // --- 10. Survival bonus ---
    if (!done) reward += 0.01;
    // --- 11. Возврат результата ---
    return {
        newState: gameState,
        reward,
        done,
        logEvents,
        stats: {
            dp: gameState.dp,
            cpu: gameState.cpu,
            traceLevel: gameState.traceLevel,
            enemiesCount: gameState.enemies.length,
            playerNodes: Object.values(gameState.nodes).filter(n => n.owner === 'player').length,
            hubLevel: gameState.hubLevel,
            networkCaptureProgress: gameState.hubCaptureProgress,
            capturedNodes,
            lostNodes,
            killedEnemies: killedEnemies.length,
            upgradePerformed,
            hubUpgraded
        }
    };
}

// --- Hunter target selection ---
function selectHunterTarget(gameState) {
    // 1. cpu_node
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.type === 'cpu_node' && node.owner === 'player') return id;
    }
    // 2. Высокоуровневые программы
    let best = null, bestScore = -1;
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.owner === 'player' && node.program) {
            let score = node.program.level * 10;
            if (node.program.type === 'overclocker') score += 5;
            if (score > bestScore) { best = id; bestScore = score; }
        }
    }
    if (best) return best;
    // 3. Захватывающие ноды
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.owner === 'player' && node.isCapturing) return id;
    }
    // 4. Любая player-нода
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.owner === 'player') return id;
    }
    return null;
}

// --- Disruptor target selection ---
function selectDisruptorTarget(gameState) {
    // Любая player-нода с программой, не отключённой
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.owner === 'player' && node.program && !node.programDisabledTicks) return id;
    }
    // fallback: любая player-нода
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.owner === 'player') return id;
    }
    return null;
}

if (require.main === module && process.argv[2] === 'subproc') {
    const readline = require('readline');
    let gameState = null;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('line', (line) => {
        try {
            const msg = JSON.parse(line);
            if (msg.cmd === 'reset') {
                const config = msg.config || {};
                gameState = initGame(config);
                process.stdout.write(JSON.stringify(gameState) + '\n');
            } else if (msg.cmd === 'step') {
                const result = step(msg.state, msg.action);
                gameState = result.newState;
                process.stdout.write(JSON.stringify(result) + '\n');
            } else if (msg.cmd === 'get_actions') {
                const actions = getPossibleActions(msg.state);
                process.stdout.write(JSON.stringify({ actions: actions }) + '\n');
            }
        } catch (e) {
            process.stdout.write(JSON.stringify({ error: e.message }) + '\n');
        }
    });
}

module.exports = {
    Node,
    Enemy,
    getDistance,
    angleBetweenEdges,
    findPathBFS,
    getRandomPath,
    generateCanvasNetwork,
    initGame,
    getPossibleActions,
    step
}; 