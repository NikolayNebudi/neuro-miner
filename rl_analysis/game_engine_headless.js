#!/usr/bin/env node
/**
 * Headless Game Engine для RL-обучения
 * Точная копия canvas_system.js без визуализации
 * Сохраняет всю игровую логику и механики
 */

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
    phase: 'PLAYING',
    hubLevel: 1,
};

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
        this.lastMove = 0;
        this.moveInterval = type === 'hunter' ? 0.9 : 1.4; // секунды
    }

    update(deltaTime) {
        if (!this.path || this.pathStep >= this.path.length - 1) {
            // Пересчитываем путь
            this.recalcPath();
            return;
        }

        this.lastMove += deltaTime / 1000; // конвертируем в секунды
        if (this.lastMove > this.moveInterval) {
            this.pathStep++;
            this.currentNodeId = this.path[this.pathStep];
            this.lastMove = 0;
        }

        // Атака текущей ноды
        const node = gameState.nodes[this.currentNodeId];
        if (node && node.owner === 'player') {
            let damage = 30 * deltaTime / 1000; // 30 урона в секунду
            if (node.program && node.program.type === 'shield' && node.shieldHealth > 0) {
                node.shieldHealth -= damage;
            } else if (node.program && node.program.type !== 'sentry') {
                node.captureProgress -= 0.3 * deltaTime / 1000;
                if (node.captureProgress <= 0) {
                    node.owner = 'neutral';
                    node.program = null;
                    node.captureProgress = 0;
                    node.shieldHealth = 0;
                }
            }
        }
        
        // Специальная атака hub
        const hub = gameState.nodes['hub'];
        if (hub && this.currentNodeId === 'hub' && hub.owner === 'player') {
            let damage = 50 * deltaTime / 1000; // 50 урона в секунду hub
            hub.health -= damage;
            if (hub.health <= 0) {
                hub.owner = 'enemy';
                hub.health = 50;
            }
        }
    }

    recalcPath() {
        // Находим ближайшую player-ноду
        let targets = Object.values(gameState.nodes).filter(n => n.owner === 'player');
        if (targets.length === 0) return;
        
        let targetNode = targets[Math.floor(Math.random() * targets.length)];
        let path = this.findPath(gameState.nodes, this.currentNodeId, targetNode.id);
        if (!path || path.length < 2) {
            path = this.getRandomPath(gameState.nodes, this.currentNodeId, 8);
        }
        this.path = path;
        this.pathStep = 0;
    }

    findPath(nodesObj, startId, endId) {
        const queue = [{id: startId, path: [startId]}];
        const visited = new Set();
        
        while (queue.length > 0) {
            const current = queue.shift();
            if (current.id === endId) return current.path;
            
            if (visited.has(current.id)) continue;
            visited.add(current.id);
            
            const node = nodesObj[current.id];
            if (!node) continue;
            
            for (const neighborId of node.neighbors) {
                if (!visited.has(neighborId)) {
                    queue.push({
                        id: neighborId,
                        path: [...current.path, neighborId]
                    });
                }
            }
        }
        return null;
    }

    getRandomPath(nodesObj, startId, length = 5) {
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

function generateCanvasNetwork() {
    const width = 1200, height = 800; // Фиксированные размеры для headless
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
    class DSU { 
        constructor(n) { 
            this.p = Array(n).fill(0).map((_,i)=>i); 
        } 
        find(x) { 
            return this.p[x]===x?x:this.p[x]=this.find(this.p[x]); 
        } 
        union(x,y){
            this.p[this.find(x)]=this.find(y);
        } 
        connected(x,y){
            return this.find(x)===this.find(y);
        } 
    }
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

function initializeGame() {
    gameState.nodes = generateCanvasNetwork();
    gameState.nodes['hub'].owner = 'player';
    gameState.dp = 50;
    gameState.cpu = 20;
    gameState.traceLevel = 0;
    gameState.enemies = [];
    gameState.phase = 'PLAYING';
    gameState.win = false;
    gameState.hubCaptureActive = false;
    gameState.hubCaptureProgress = 0;
    gameState.empCooldown = 0;
    gameState.hubLevel = 1;
    gameState.game_time = 0;
    gameState.lastMinerTick = 0;
    gameState.lastEnemySpawn = 0;
    gameState.enemyIdCounter = 1;
    
    // Инициализация переменных для capture web
    gameState.captureWebStarted = null;
    gameState.captureWebDuration = 60000; // 60 секунд
}

function updateGame(deltaTime) {
    if (gameState.phase !== 'PLAYING') return;

    gameState.game_time += deltaTime;

    // --- Win/Loss Conditions ---
    if (gameState.traceLevel >= 400) {
        gameState.phase = 'END_SCREEN'; 
        gameState.win = false; 
        return;
    }
    if (gameState.playerRootNodeId && (!gameState.nodes[gameState.playerRootNodeId] || gameState.nodes[gameState.playerRootNodeId].owner !== 'player')) {
        gameState.phase = 'END_SCREEN'; 
        gameState.win = false; 
        return;
    }

    // --- Финальный захват HUB ---
    if (gameState.hubCaptureActive) {
        gameState.traceLevel = Math.max(gameState.traceLevel, 180);
        gameState.hubCaptureProgress += deltaTime / 60; // ~60 секунд до победы
        if (gameState.hubCaptureProgress >= 1) {
            gameState.phase = 'END_SCREEN'; 
            gameState.win = true; 
            return;
        }
    }

    // --- Глобальный рост TraceLevel ---
    let baseTraceGrowth = (0.1 + gameState.traceLevel * 0.001) * deltaTime / 1000;
    
    // Замедление от overclocker'ов
    let overclockerCount = 0;
    let totalOverclockerLevels = 0;
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.owner === 'player' && node.program && node.program.type === 'overclocker') {
            overclockerCount++;
            totalOverclockerLevels += node.program.level;
        }
    }
    
    // Каждый уровень overclocker замедляет рост trace на 3%
    let traceSlowdown = totalOverclockerLevels * 0.03;
    let finalTraceGrowth = baseTraceGrowth * (1 - traceSlowdown);
    
    gameState.traceLevel += finalTraceGrowth;

    // --- Логика для каждого узла ---
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (!node) continue;

        // 1. Захват узлов
        if (node.isCapturing) {
            node.captureProgress += deltaTime / 1000; // 1 секунда на захват
            console.error(`DEBUG: Захват ноды ${id}, прогресс: ${node.captureProgress.toFixed(3)}`);
            if (node.captureProgress >= 1) {
                node.isCapturing = false;
                node.captureProgress = 0;
                node.owner = 'player';
                node.program = null;
                console.error(`DEBUG: Нода ${id} захвачена!`);
                gameState.traceLevel += 5; // Значительный штраф за расширение
                // Снижаем trace level на 20% при захвате новой ноды
                gameState.traceLevel = Math.max(0, gameState.traceLevel * 0.8);
                console.error(`DEBUG: Trace level снижен на 20% после захвата ноды ${id}, новый уровень: ${gameState.traceLevel.toFixed(2)}`);
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
                    node.shieldHealth += (10 * node.program.level) * deltaTime / 1000;
                    if (node.shieldHealth > node.maxShieldHealth) node.shieldHealth = node.maxShieldHealth;
                }
            }
            // Атака Sentry
            if (node.program.type === 'sentry') {
                if (!node.program.cooldown || Date.now() > node.program.cooldown) {
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
                        nearestEnemy.health -= baseDmg;
                        node.program.cooldown = Date.now() + (1000 / node.program.level);
                    }
                }
            }
        }
    }

    // --- Ресурсы (раз в секунду) ---
    gameState.lastMinerTick += deltaTime / 1000;
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
    gameState.lastEnemySpawn += deltaTime / 1000;
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
                        gameState.nodes[targetNode.id].targetedUntil = Date.now() + 3000;
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
        if (enemy.isStunnedUntil > Date.now()) continue;
        if (!enemy.path || enemy.pathStep >= enemy.path.length - 1) {
            // Пересчитываем путь
            let targets = Object.values(gameState.nodes).filter(n => n.owner === 'player');
            if (targets.length > 0) {
                let targetNode = targets[Math.floor(Math.random() * targets.length)];
                let path = findPathBFS(gameState.nodes, enemy.currentNodeId, targetNode.id);
                if (!path || path.length < 2) path = getRandomPath(gameState.nodes, enemy.currentNodeId, 8);
                enemy.path = path;
                enemy.pathStep = 0;
}
            continue;
        }
        if (enemy.lastMove === undefined) enemy.lastMove = 0;
        enemy.lastMove += deltaTime / 1000;
        let moveInterval = (enemy.type === 'hunter' ? 0.9 : 1.4); // секунды
        if (enemy.lastMove > moveInterval) {
            enemy.pathStep++; 
            enemy.currentNodeId = enemy.path[enemy.pathStep]; 
            enemy.lastMove = 0;
        }
        const node = gameState.nodes[enemy.currentNodeId];
        if (node && node.owner === 'player') {
            let damage = 30 * deltaTime / 1000;
            if (node.program?.type === 'shield' && node.shieldHealth > 0) {
                node.shieldHealth -= damage;
            } else if (node.program?.type !== 'sentry') {
                node.captureProgress -= 0.3 * deltaTime / 1000;
                if (node.captureProgress <= 0) {
                    node.owner = 'neutral'; 
                    node.program = null; 
                    node.captureProgress = 0; 
                    node.shieldHealth = 0;
                }
            }
        }
    }
    
    // --- Проверка условия для capture web (60% нод захвачено) ---
    const totalNodes = Object.keys(gameState.nodes).length;
    const playerNodes = Object.values(gameState.nodes).filter(n => n.owner === 'player').length;
    const capturePercentage = (playerNodes / totalNodes) * 100;
    
    // Если достигли 60% захвата и на hub нет программы capture_web
    if (capturePercentage >= 60 && gameState.nodes['hub'] && gameState.nodes['hub'].owner === 'player') {
        const hubNode = gameState.nodes['hub'];
        if (!hubNode.program || hubNode.program.type !== 'capture_web') {
            console.error(`DEBUG: Достигнуто 60% захвата! Добавляем capture_web на hub`);
            hubNode.program = { type: 'capture_web', level: 1 };
        }
    }
    
    // --- Проверка победы в режиме capture web ---
    if (gameState.phase === 'CAPTURE_WEB_DEFENSE') {
        const elapsedTime = Date.now() - gameState.captureWebStarted;
        if (elapsedTime >= gameState.captureWebDuration) {
            console.error(`DEBUG: Победа! Capture web завершен успешно`);
        gameState.phase = 'END_SCREEN';
        gameState.win = true;
            return;
    }
    
        // Проверяем, не проиграли ли мы (hub захвачен врагами)
        if (gameState.nodes['hub'].owner !== 'player') {
            console.error(`DEBUG: Поражение! Hub захвачен врагами во время capture web`);
        gameState.phase = 'END_SCREEN';
        gameState.win = false;
            return;
        }
    }
    
    // --- Очистка и таймеры ---
            const killedEnemies = gameState.enemies.filter(e => e.health <= 0);
        if(killedEnemies.length > 0) {
            gameState.traceLevel = Math.max(0, gameState.traceLevel - 2 * killedEnemies.length); // Снижаем trace level за убийство врагов
            gameState.dp += 15 * killedEnemies.length;
        }
    gameState.enemies = gameState.enemies.filter(e => e.health > 0);
    
    if (gameState.empCooldown > 0) gameState.empCooldown -= deltaTime;
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.isTargeted && Date.now() > node.targetedUntil) node.isTargeted = false;
    }
}

// --- Действия игрока ---
function performAction(action) {
    console.error(`DEBUG: performAction вызвана с:`, JSON.stringify(action));
    if (gameState.phase !== 'PLAYING') {
        return { success: false, reason: `Игра не в фазе PLAYING, текущая фаза: ${gameState.phase}` };
    }
    const actionType = action.action;
    const targetNodeId = action.targetNodeId;
    let result = { success: false, reason: '' };
    switch (actionType) {
        case 'wait':
            result = { success: true };
            break;
        case 'build_miner':
            result = buildProgram('miner', targetNodeId) ? { success: true } : { success: false, reason: 'Не удалось построить miner' };
            break;
        case 'build_sentry':
            result = buildProgram('sentry', targetNodeId) ? { success: true } : { success: false, reason: 'Не удалось построить sentry' };
            break;
        case 'build_shield':
            result = buildProgram('shield', targetNodeId) ? { success: true } : { success: false, reason: 'Не удалось построить shield' };
            break;
        case 'build_overclocker':
            result = buildProgram('overclocker', targetNodeId) ? { success: true } : { success: false, reason: 'Не удалось построить overclocker' };
            break;
        case 'upgrade':
            result = upgradeProgram(targetNodeId) ? { success: true } : { success: false, reason: 'Не удалось апгрейдить программу' };
            break;
        case 'upgrade_hub':
            result = upgradeHub() ? { success: true } : { success: false, reason: 'Не удалось апгрейдить HUB' };
            break;
        case 'capture_web':
            result = captureWeb() ? { success: true } : { success: false, reason: 'Не удалось выполнить capture web' };
            break;
        case 'network_capture':
            result = networkCapture() ? { success: true } : { success: false, reason: 'Не удалось выполнить network_capture' };
            break;
        case 'emp_blast':
            result = empBlast() ? { success: true } : { success: false, reason: 'Не удалось выполнить emp_blast' };
            break;
        case 'capture':
            result = captureNode(targetNodeId) ? { success: true } : { success: false, reason: 'Не удалось захватить ноду' };
            break;
        default:
            result = { success: false, reason: `Неизвестный тип действия: ${actionType}` };
    }
    return result;
}

function buildProgram(programType, nodeId) {
    const node = gameState.nodes[nodeId];
    if (!node || node.owner !== 'player') return false;

    // Точные стоимости из основного движка
    const costs = {
        'miner': 20,
        'sentry': 40,
        'shield': 30,
        'overclocker': 50
    };

    if (programType === 'overclocker' && node.type !== 'cpu_node') return false;
    if (node.program) return false;

    const cost = costs[programType];
    if (gameState.dp < cost) return false;

    gameState.dp -= cost;
    node.program = { type: programType, level: 1 };
    return true;
}

function upgradeProgram(nodeId) {
    const node = gameState.nodes[nodeId];
    if (!node || !node.program) return false;

    // Точная логика апгрейда из основного движка
    let baseCost = node.program.type === 'miner' ? 20 : node.program.type === 'shield' ? 30 : 40;
    let cost = baseCost * node.program.level;
    let cpuCost = 5 * node.program.level;
    
    if (gameState.dp < cost || gameState.cpu < cpuCost || node.program.level >= gameState.hubLevel) return false;

    gameState.dp -= cost;
    gameState.cpu -= cpuCost;
    node.program.level++;
    return true;
}

function upgradeHub() {
    // Точная стоимость из основного движка
    let cost = 30 * gameState.hubLevel;
    if (gameState.cpu < cost) return false;

    gameState.cpu -= cost;
    gameState.hubLevel++;
    return true;
}

function captureWeb() {
    const hubNode = gameState.nodes['hub'];
    if (!hubNode || !hubNode.program || hubNode.program.type !== 'capture_web') {
        return false;
    }
    
    // Проверяем, что захвачено 60% нод
    const totalNodes = Object.keys(gameState.nodes).length;
    const playerNodes = Object.values(gameState.nodes).filter(n => n.owner === 'player').length;
    const capturePercentage = (playerNodes / totalNodes) * 100;
    
    if (capturePercentage < 60) {
        return false;
    }
    
    // Запускаем режим защиты - нужно продержаться 60 секунд
    gameState.captureWebStarted = Date.now();
    gameState.captureWebDuration = 60000; // 60 секунд в миллисекундах
    gameState.phase = 'CAPTURE_WEB_DEFENSE';
    
    console.error(`DEBUG: Capture web активирован! Нужно продержаться 60 секунд`);
    return true;
}

function networkCapture() {
    if (gameState.dp < 20) return false;
    
    gameState.dp -= 20;
    gameState.traceLevel = Math.max(0, gameState.traceLevel - 10); // Увеличиваем снижение trace
    
    // Проверяем условие победы через network capture
    const totalNodes = Object.keys(gameState.nodes).length;
    const playerNodes = Object.values(gameState.nodes).filter(n => n.owner === 'player').length;
    const capturePercentage = (playerNodes / totalNodes) * 100;
    
    // Победа через network capture при 70% захвата и низком trace
    if (capturePercentage >= 70 && gameState.traceLevel < 100) {
        console.error(`DEBUG: Победа через Network Capture! Захват: ${capturePercentage.toFixed(1)}%, Trace: ${gameState.traceLevel.toFixed(2)}`);
        gameState.phase = 'END_SCREEN';
        gameState.win = true;
        return true;
    }
    
    // Стратегические бонусы
    gameState.dp += 20; // Увеличиваем бонус
    gameState.cpu += 10; // Увеличиваем CPU бонус
    
    // Дополнительный бонус за низкий trace level
    if (gameState.traceLevel < 100) {
        gameState.dp += 15; // Увеличиваем бонус за скрытность
    }
    
    return true;
}

function empBlast() {
    if (gameState.empCooldown > 0) return false;
    if (gameState.cpu < 50) return false;

    gameState.cpu -= 50;
    gameState.empCooldown = 8000; // 8 секунд

    // Оглушаем всех врагов на более долгое время
    for (const enemy of gameState.enemies) {
        enemy.isStunnedUntil = Date.now() + 5000; // Увеличиваем время оглушения
    }
    
    // Стратегические бонусы за EMP blast
    gameState.traceLevel = Math.max(0, gameState.traceLevel - 3); // Небольшое снижение trace
    gameState.dp += 20; // Бонус за успешную атаку
    
    return true;
}

function captureNode(nodeId) {
    console.error(`DEBUG: captureNode вызвана для ноды ${nodeId}`);
    const node = gameState.nodes[nodeId];
    if (!node || node.owner !== 'neutral') {
        console.error(`DEBUG: Нода ${nodeId} не найдена или не нейтральная (owner: ${node?.owner})`);
        return false;
    }

    // Если уже идет захват — не сбрасываем прогресс, просто возвращаем true
    if (node.isCapturing) {
        console.error(`DEBUG: Node ${nodeId} уже захватывается, прогресс: ${node.captureProgress}`);
        return true;
    }

    // Проверяем, есть ли сосед-союзник
    let hasPlayerNeighbor = node.neighbors.some(nid => gameState.nodes[nid] && gameState.nodes[nid].owner === 'player');
    if (!hasPlayerNeighbor) {
        console.error(`DEBUG: У ноды ${nodeId} нет соседей-игроков`);
        return false;
    }

    const cost = 10; // Точная стоимость из основного движка
    if (gameState.dp < cost) {
        console.error(`DEBUG: Недостаточно DP для захвата ${nodeId} (нужно: ${cost}, есть: ${gameState.dp})`);
        return false;
    }

    gameState.dp -= cost;
    node.isCapturing = true;
    node.captureProgress = 0;
    console.error(`DEBUG: Начинаем захват ноды ${nodeId}, isCapturing=${node.isCapturing}, progress=${node.captureProgress}`);
    return true;
}

// --- Получение захватываемых нод ---
function get_capturable_nodes() {
    const capturable = [];
    for (const nodeId in gameState.nodes) {
        const node = gameState.nodes[nodeId];
        if (node.owner === 'neutral') {
            // Проверяем, есть ли сосед-союзник
            let hasPlayerNeighbor = node.neighbors.some(nid => gameState.nodes[nid] && gameState.nodes[nid].owner === 'player');
            if (hasPlayerNeighbor) {
                capturable.push(nodeId);
            }
        }
    }
    return capturable;
}

// --- Получение состояния игры ---
function getGameState() {
    const stats = {
        playerNodes: Object.values(gameState.nodes).filter(n => n.owner === 'player').length,
        totalNodes: Object.keys(gameState.nodes).length,
        dp: gameState.dp,
        cpu: gameState.cpu,
        traceLevel: gameState.traceLevel,
        hubLevel: gameState.hubLevel,
        enemies: gameState.enemies.length,
        win: gameState.win,
        phase: gameState.phase
    };

    return {
        nodes: gameState.nodes,
        stats: stats,
        enemies: gameState.enemies,
        win: gameState.win,
        done: gameState.phase === 'END_SCREEN'
    };
}

// --- Получение возможных действий ---
function getPossibleActions() {
    const actions = [{action: 'wait'}];
    
    // Строительство
    for (const nodeId in gameState.nodes) {
        const node = gameState.nodes[nodeId];
        if (node.owner === 'player' && !node.program) {
            // Проверяем условия для каждой программы
            if (gameState.dp >= 20) {
                actions.push({action: 'build_miner', targetNodeId: nodeId});
            }
            if (gameState.dp >= 40) {
                actions.push({action: 'build_sentry', targetNodeId: nodeId});
            }
            if (gameState.dp >= 30) {
                actions.push({action: 'build_shield', targetNodeId: nodeId});
            }
            if (node.type === 'cpu_node' && gameState.dp >= 50) {
                actions.push({action: 'build_overclocker', targetNodeId: nodeId});
            }
        }
    }

    // Апгрейд
    for (const nodeId in gameState.nodes) {
        const node = gameState.nodes[nodeId];
        if (node.owner === 'player' && node.program) {
            // Проверяем, можно ли реально апгрейдить программу
            let baseCost = node.program.type === 'miner' ? 20 : node.program.type === 'shield' ? 30 : 40;
            let cost = baseCost * node.program.level;
            let cpuCost = 5 * node.program.level;
            
            // Проверяем все условия для апгрейда
            if (gameState.dp >= cost && gameState.cpu >= cpuCost && node.program.level < gameState.hubLevel) {
                actions.push({action: 'upgrade', targetNodeId: nodeId});
            }
        }
    }

    // Захват
    for (const nodeId in gameState.nodes) {
        const node = gameState.nodes[nodeId];
        if (node.owner === 'neutral') {
            let hasPlayerNeighbor = node.neighbors.some(nid => gameState.nodes[nid] && gameState.nodes[nid].owner === 'player');
            if (hasPlayerNeighbor && gameState.dp >= 10) {
                actions.push({action: 'capture', targetNodeId: nodeId});
            }
        }
    }

    // Стратегические действия
    if (gameState.dp >= 20) {
        actions.push({action: 'network_capture'});
    }
    if (gameState.empCooldown <= 0 && gameState.cpu >= 50) {
        actions.push({action: 'emp_blast'});
    }
    // Проверяем условия для апгрейда hub
    let hubCost = 30 * gameState.hubLevel;
    const hubNode = gameState.nodes['hub'];
    
    // Hub можно апгрейдить только если на нем есть программа
    if (gameState.cpu >= hubCost && hubNode && hubNode.program) {
        actions.push({action: 'upgrade_hub'});
    }
    
    // Проверяем условие для capture web (60% нод захвачено)
    const totalNodes = Object.keys(gameState.nodes).length;
    const playerNodes = Object.values(gameState.nodes).filter(n => n.owner === 'player').length;
    const capturePercentage = (playerNodes / totalNodes) * 100;
    
    if (capturePercentage >= 60 && hubNode && hubNode.program && hubNode.program.type === 'capture_web') {
        actions.push({action: 'capture_web'});
    }

    return actions;
}

// --- Интерфейс для RL ---
function reset() {
    initializeGame();
    return getGameState();
}

function step(command) {
    console.error(`DEBUG: step вызвана с действием: ${JSON.stringify(command)}`);
    let executed_actions = [];
    let success = false;

    if (Array.isArray(command.actions)) {
        // Обрабатываем массив действий
        for (const action of command.actions) {
            console.error(`DEBUG: Выполняем действие: ${JSON.stringify(action)}`);
            let res = performAction(action);
            executed_actions.push({
                action: action,
                success: res.success,
                reason: res.reason || '',
                executed: res.success
            });
            console.error(`DEBUG: Результат выполнения: ${res.success}`);
        }
        success = executed_actions.some(r => r.success);
    } else if (command.action) {
        // Обрабатываем одиночное действие (для обратной совместимости)
        let res = performAction(command.action);
        executed_actions.push({
            action: command.action,
            success: res.success,
            reason: res.reason || '',
            executed: res.success
        });
        success = res.success;
    }

    const reward = success ? 1 : -1;
    updateGame(16); // 60 FPS
    
    console.error(`DEBUG: Возвращаем результат: ${JSON.stringify({
        newState: getGameState(),
        reward: reward,
        done: gameState.phase === 'END_SCREEN',
        win: gameState.win,
        performedActions: executed_actions
    })}`);
    
    return {
        newState: getGameState(),
        reward: reward,
        done: gameState.phase === 'END_SCREEN',
        win: gameState.win,
        executed_actions: executed_actions
    };
}

// --- Интерфейс команд для Python ---
function handleCommand(command) {
    switch (command.cmd) {
        case 'reset':
            return reset();
        case 'step':
            return step(command);
        case 'get_state':
            return getGameState();
        case 'get_actions':
            return { actions: getPossibleActions() };
        case 'get_capturable_nodes':
            return { capturable_nodes: get_capturable_nodes() };
        default:
            return { error: 'Unknown command' };
    }
}

// --- Чтение команд из stdin ---
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.on('line', (line) => {
    try {
        const command = JSON.parse(line);
        const result = handleCommand(command);
        console.log(JSON.stringify(result));
    } catch (error) {
        console.log(JSON.stringify({ error: error.message }));
    }
});

// Инициализация при запуске
initializeGame(); 