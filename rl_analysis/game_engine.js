// Headless RL game engine for network strategy

// --- Node Class ---
class Node {
    constructor(x, y, id, type = 'data', owner = 'neutral') {
        this.x = x;
        this.y = y;
        this.id = id;
        this.type = type;
        this.owner = owner;
        this.resistance = Math.floor(Math.random() * 5) + 3;
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

// --- Enemy Class ---
class Enemy {
    constructor(id, currentNodeId, path, type = 'patrol', armor = 0) {
        this.id = id;
        this.currentNodeId = currentNodeId;
        this.path = path;
        this.pathStep = 0;
        this.decapturing = false;
        this.health = type === 'hunter' ? 90 : 50;
        this.type = type;
        this.stunned = 0;
        this.slowed = 0;
        this.targetNodeId = null; // для hunter/disruptor
        this.armor = armor;
    }
}

// --- Helpers ---
function getDistance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}
function angleBetweenEdges(x1, y1, x2, y2, x3, y3) {
    const v1x = x2 - x1, v1y = y2 - y1;
    const v2x = x3 - x1, v2y = y3 - y1;
    const dot = v1x * v2x + v1y * v2y;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
    return Math.acos(dot / (mag1 * mag2));
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
// --- Network generation (stub, to be replaced with real logic) ---
function generateCanvasNetwork() {
    // TODO: Copy and adapt your real network generation logic here
    // For now, create a small test network
    const nodes = {};
    nodes['hub'] = new Node(0, 0, 'hub', 'hub', 'player');
    for (let i = 1; i <= 5; i++) {
        nodes['n' + i] = new Node(i * 50, 0, 'n' + i);
        nodes['hub'].addNeighbor('n' + i);
        nodes['n' + i].addNeighbor('hub');
    }
    return nodes;
}

// --- RL API ---
function initGame(config = {}) {
    const nodes = generateCanvasNetwork();
    const game_state = {
        nodes,
        dp: 150,
        cpu: 50,
        traceLevel: 0,
        playerRootNodeId: 'hub',
        enemies: [],
        selectedNodeId: null,
        hubCaptureActive: false,
        hubCaptureProgress: 0,
        empCooldown: 0,
        gameOver: false,
        win: false,
        tick: 0,
        game_time: 0,
        builtTypes: {},
        mode: config.mode || 'standard',
        config: config,
        hubLevel: 1
    };
    return game_state;
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
                    // лимиты
                    if (prog === 'miner' && (builtTypes['miner'] || 0) >= MAX_MINERS) continue;
                    if (prog === 'sentry' && (builtTypes['sentry'] || 0) >= MAX_SENTRIES) continue;
                    if (prog === 'shield' && (builtTypes['shield'] || 0) >= MAX_SHIELDS) continue;
                    if (prog === 'overclocker' && (builtTypes['overclocker'] || 0) >= MAX_OVERCLOCKERS) continue;
                    // стоимость
                    let baseCost = prog === 'miner' ? 20 : prog === 'shield' ? 30 : prog === 'sentry' ? 40 : 50;
                    let cpuCost = prog === 'overclocker' ? 10 : 0;
                    let count = builtTypes[prog] || 0;
                    let cost = baseCost + (baseCost * 0.5 * count);
                    // скидка для первого экземпляра
                    if (count === 0) cost = Math.floor(baseCost * 0.5);
                    actions.push({ action: 'build', nodeId, program: prog, cost, cpuCost });
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
        // Стоимость апгрейда HUB: 50 CPU для 2 уровня, 150 CPU для 3 уровня, 300 CPU для 4 уровня
        let nextLevel = (gameState.hubLevel || 1) + 1;
        let hubUpgradeCost = 200 * (gameState.hubLevel || 1);
        let hubUpgradeCpu = nextLevel === 2 ? 50 : nextLevel === 3 ? 150 : 300;
        actions.push({ action: 'upgrade_hub', nodeId: 'hub', cost: hubUpgradeCost, cpuCost: hubUpgradeCpu });
    }
    // EMP Blast
    if (gameState.cpu >= 50 && (!gameState.empCooldown || gameState.empCooldown <= 0)) {
        actions.push({ action: 'emp_blast' });
    }
    return actions;
}

function step(gameState, action) {
    // --- Инициализация временных переменных ---
    if (!gameState.lastMinerTick) gameState.lastMinerTick = 0;
    if (!gameState.lastEnemySpawn) gameState.lastEnemySpawn = 0;
    if (!gameState.enemyIdCounter) gameState.enemyIdCounter = 1;
    if (!gameState.sentryShots) gameState.sentryShots = [];
    if (!gameState.sentryFlashes) gameState.sentryFlashes = [];
    if (!gameState.enemyExplosions) gameState.enemyExplosions = [];
    if (!gameState.mainLoop_lastCpuTick) gameState.mainLoop_lastCpuTick = 0;
    if (!gameState.hubCaptureActive) gameState.hubCaptureActive = false;
    if (!gameState.hubCaptureProgress) gameState.hubCaptureProgress = 0;
    if (!gameState.empCooldown) gameState.empCooldown = 0;
    if (!gameState.win) gameState.win = false;
    if (!gameState.lost) gameState.lost = false;
    if (!gameState.rewardEvents) gameState.rewardEvents = [];
    if (!gameState.logEvents) gameState.logEvents = [];
    if (!gameState.builtTypes) gameState.builtTypes = {};
    let sentryDamageDealt = 0;
    let shieldDamageAbsorbed = 0;
    let mode = gameState.mode || 'standard';
    // --- Применяем действие игрока ---
    let reward = 0;
    let destroyedEnemies = 0;
    let capturedNodes = 0;
    let lostNodes = 0;
    let dpGenerated = 0;
    let traceInc = 0;
    let builtPrograms = 0;
    let upgrades = 0;
    let empUsed = 0;
    let upgradePerformed = false;
    let hubUpgradedThisStep = false;
    switch (action.action) {
        case 'capture': {
            const node = gameState.nodes[action.nodeId];
            if (node && node.owner !== 'player' && !node.isCapturing && gameState.dp >= 10) {
                node.isCapturing = true;
                node.captureProgress = 0.01;
                gameState.dp -= 10;
                gameState.logEvents.push({tick: gameState.tick, type: 'capture_start', nodeId: node.id});
            }
            break;
        }
        case 'build': {
            const node = gameState.nodes[action.nodeId];
            if (node && !node.program) {
                let baseCost = action.program === 'miner' ? 20 : action.program === 'shield' ? 30 : action.program === 'sentry' ? 40 : 50;
                let cpuCost = action.program === 'overclocker' ? 10 : 0;
                let count = gameState.builtTypes[action.program] || 0;
                let cost = baseCost + (baseCost * 0.5 * count);
                // скидка для первого экземпляра
                if (count === 0) cost = Math.floor(baseCost * 0.5);
                if (gameState.dp >= cost && gameState.cpu >= cpuCost) {
                    gameState.dp -= cost;
                    gameState.cpu -= cpuCost;
                    node.program = { type: action.program, level: 1 };
                    if (action.program === 'shield') {
                        node.maxShieldHealth = 100;
                        node.shieldHealth = node.maxShieldHealth;
                    }
                    gameState.builtTypes[action.program] = (gameState.builtTypes[action.program] || 0) + 1;
                    builtPrograms++;
                    gameState.logEvents.push({tick: gameState.tick, type: 'build', nodeId: node.id, program: action.program, cost, cpuCost});
                }
            }
            break;
        }
        case 'upgrade': {
            const node = gameState.nodes[action.nodeId];
            if (node && node.program) {
                // Ограничение по hubLevel: upgrade только если hubLevel >= целевого уровня
                if (node.program.level >= (gameState.hubLevel || 1)) break;
                let baseCost = node.program.type === 'miner' ? 20 : node.program.type === 'shield' ? 30 : 40;
                let cost = baseCost * node.program.level;
                let cpuCost = 5 * node.program.level;
                if (gameState.dp >= cost && gameState.cpu >= cpuCost) {
                    gameState.dp -= cost;
                    gameState.cpu -= cpuCost;
                    node.program.level++;
                    if (node.program.type === 'shield') {
                        node.maxShieldHealth = 100 * node.program.level;
                        node.shieldHealth = node.maxShieldHealth;
                    }
                    upgradePerformed = true;
                    upgrades++;
                    gameState.logEvents.push({tick: gameState.tick, type: 'upgrade', nodeId: node.id, program: node.program.type, level: node.program.level});
                }
            }
            break;
        }
        case 'upgrade_hub': {
            // Только для HUB, только если hubLevel < 4
            if (action.nodeId === 'hub' && (gameState.hubLevel || 1) < 4) {
                let nextLevel = (gameState.hubLevel || 1) + 1;
                let hubUpgradeCost = 200 * (gameState.hubLevel || 1);
                let hubUpgradeCpu = nextLevel === 2 ? 50 : nextLevel === 3 ? 150 : 300;
                if (gameState.dp >= hubUpgradeCost && gameState.cpu >= hubUpgradeCpu) {
                    gameState.dp -= hubUpgradeCost;
                    gameState.cpu -= hubUpgradeCpu;
                    gameState.hubLevel = nextLevel;
                    gameState.logEvents.push({tick: gameState.tick, type: 'upgrade_hub', newLevel: gameState.hubLevel, cost: hubUpgradeCost, cpuCost: hubUpgradeCpu});
                    hubUpgradedThisStep = true;
                }
            }
            break;
        }
        case 'emp_blast': {
            if (gameState.cpu >= 50 && (!gameState.empCooldown || gameState.empCooldown <= 0)) {
                gameState.cpu -= 50;
                gameState.empCooldown = 30 * 60;
                for (const enemy of gameState.enemies) {
                    enemy.stunned = 60;
                }
                empUsed++;
                gameState.logEvents.push({tick: gameState.tick, type: 'emp_blast'});
            }
            break;
        }
        case 'wait':
        default:
            break;
    }
    // --- Основной игровой цикл ---
    // --- Победа: захват HUB ---
    if (gameState.hubCaptureActive) {
        gameState.traceLevel = Math.max(gameState.traceLevel, 90);
        gameState.lastEnemySpawn -= 2500;
        gameState.hubCaptureProgress += 1 / (60 * 60);
        if (gameState.hubCaptureProgress >= 1) {
            gameState.hubCaptureProgress = 1;
            gameState.win = true;
            gameState.gameOver = true;
        }
    }
    // --- Проверка Game Over ---
    if (gameState.traceLevel >= 200) {
        gameState.lost = true;
        gameState.gameOver = true;
    }
    if (gameState.playerRootNodeId) {
        const root = gameState.nodes[gameState.playerRootNodeId];
        if (!root || root.owner !== 'player') {
            gameState.lost = true;
            gameState.gameOver = true;
        }
    }
    // --- Захват нод ---
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (!node) continue;
        if (node.isCapturing) {
            node.captureProgress += 0.012;
            if (node.captureProgress >= 1) {
                node.isCapturing = false;
                node.captureProgress = 0;
                if (node.owner !== 'player') {
                    node.owner = 'player';
                    capturedNodes++;
                    gameState.logEvents.push({tick: gameState.tick, type: 'capture_complete', nodeId: node.id});
                    if (!gameState.playerRootNodeId) gameState.playerRootNodeId = node.id;
                    gameState.traceLevel += 1;
                    if (node.type === 'data_cache') {
                        gameState.dp += 100;
                        node.type = 'data';
                    }
                }
            }
        }
    }
    // --- Ресурсы от miner ---
    gameState.lastMinerTick++;
    if (gameState.lastMinerTick > 60) {
        let miners = 0;
        for (const id in gameState.nodes) {
            const node = gameState.nodes[id];
            if (!node) continue;
            if (node.owner === 'player' && node.program && node.program.type === 'miner') {
                let dpAdd = 3 + 2 * (node.program.level - 1);
                gameState.dp += dpAdd;
                dpGenerated += dpAdd;
                miners++;
                // Miner 2+: шанс +1 CPU
                if (node.program.level >= 2 && Math.random() < 0.05) {
                    gameState.cpu += 1;
                    gameState.logEvents.push({tick: gameState.tick, type: 'miner_cpu_bonus', nodeId: node.id});
                }
            }
        }
        gameState.lastMinerTick = 0;
    }
    // --- Overclocker: +1 CPU/сек на cpu_node ---
    gameState.mainLoop_lastCpuTick++;
    if (gameState.mainLoop_lastCpuTick > 60) {
        for (const id in gameState.nodes) {
            const node = gameState.nodes[id];
            if (node.owner === 'player' && node.program && node.program.type === 'overclocker') {
                gameState.cpu += 1 * node.program.level;
            }
        }
        gameState.mainLoop_lastCpuTick = 0;
    }
    // --- Враги ---
    gameState.lastEnemySpawn++;
    let enemySpawnInterval = gameState.hubCaptureActive ? 150 : 300;
    // Враги не спавнятся первые 4 минуты (240 шагов)
    if (gameState.game_time < 240) {
        // не спавним врагов
    } else if (gameState.lastEnemySpawn > enemySpawnInterval) {
        const spawnableNodes = Object.values(gameState.nodes).filter(n => n.owner !== 'player' && n.type !== 'hub');
        if (spawnableNodes.length > 0) {
            const start = spawnableNodes[Math.floor(Math.random() * spawnableNodes.length)].id;
            // Armored Hunter: если traceLevel > 80, 10% шанс
            let r = Math.random();
            if (gameState.traceLevel > 80 && r > 0.9) {
                const targetId = selectHunterTarget(gameState);
                const path = findPathBFS(gameState.nodes, start, targetId) || [start];
                const enemy = new Enemy('enemy' + (gameState.enemyIdCounter++), start, path, 'hunter', 2);
                enemy.targetNodeId = targetId;
                gameState.enemies.push(enemy);
                gameState.logEvents.push({tick: gameState.tick, type: 'spawn_armored_hunter', enemyId: enemy.id});
            } else if (r < 0.7) {
                const path = [start];
                const enemy = new Enemy('enemy' + (gameState.enemyIdCounter++), start, path, 'patrol');
                gameState.enemies.push(enemy);
            } else if (r < 0.9) {
                // Hunter
                const targetId = selectHunterTarget(gameState);
                const path = findPathBFS(gameState.nodes, start, targetId) || [start];
                const enemy = new Enemy('enemy' + (gameState.enemyIdCounter++), start, path, 'hunter');
                enemy.targetNodeId = targetId;
                gameState.enemies.push(enemy);
            } else {
                // Disruptor
                const targetId = selectDisruptorTarget(gameState);
                const path = findPathBFS(gameState.nodes, start, targetId) || [start];
                const enemy = new Enemy('enemy' + (gameState.enemyIdCounter++), start, path, 'disruptor');
                enemy.targetNodeId = targetId;
                gameState.enemies.push(enemy);
            }
        }
        gameState.lastEnemySpawn = 0;
    }
    // --- Движение врагов ---
    for (const enemy of gameState.enemies) {
        if (!enemy) continue;
        if (enemy.stunned && enemy.stunned > 0) { enemy.stunned--; continue; }
        let speed = 1;
        if (enemy.slowed && enemy.slowed > 0) { enemy.slowed--; speed = 0.5; }
        // Движение по пути
        if (enemy.path && enemy.path.length > 1 && enemy.pathStep < enemy.path.length - 1) {
            if (!enemy._moveProgress) enemy._moveProgress = 0;
            enemy._moveProgress += speed;
            if (enemy._moveProgress >= 1) {
                enemy.pathStep++;
                enemy.currentNodeId = enemy.path[enemy.pathStep];
                enemy._moveProgress = 0;
            }
        }
        // Hunter: если цель изменилась, пересчитать путь
        if (enemy.type === 'hunter') {
            const newTarget = selectHunterTarget(gameState);
            if (newTarget !== enemy.targetNodeId) {
                enemy.targetNodeId = newTarget;
                enemy.path = findPathBFS(gameState.nodes, enemy.currentNodeId, newTarget) || [enemy.currentNodeId];
                enemy.pathStep = 0;
            }
        }
        // Disruptor: если цель отключена, выбрать новую
        if (enemy.type === 'disruptor') {
            const node = gameState.nodes[enemy.currentNodeId];
            if (node.owner === 'player' && node.program && !node.programDisabledTicks) {
                node.programDisabledTicks = 1200; // 20 сек
                gameState.logEvents.push({tick: gameState.tick, type: 'disrupt', nodeId: node.id});
                enemy.health = 0; // исчезает
            } else if (enemy.path && enemy.pathStep === enemy.path.length - 1) {
                // цель недоступна — выбрать новую
                const newTarget = selectDisruptorTarget(gameState);
                enemy.targetNodeId = newTarget;
                enemy.path = findPathBFS(gameState.nodes, enemy.currentNodeId, newTarget) || [enemy.currentNodeId];
                enemy.pathStep = 0;
            }
        }
    }
    // --- Удаление уничтоженных врагов ---
    const before = gameState.enemies.length;
    gameState.enemies = gameState.enemies.filter(enemy => {
        if (!enemy) return false;
        if (enemy.health > 0) return true;
        destroyedEnemies++;
        gameState.logEvents.push({tick: gameState.tick, type: 'enemy_destroyed', enemyId: enemy.id});
        gameState.dp += 10;
        return false;
    });
    // --- Shield: сила щита зависит от уровня ---
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.owner === 'player' && node.program && node.program.type === 'shield') {
            node.maxShieldHealth = 100 * node.program.level;
            if (node.shieldHealth > node.maxShieldHealth) node.shieldHealth = node.maxShieldHealth;
            // Shield 2+: EMP при разрушении
            if (node.program.level >= 2 && node.shieldHealth <= 0 && !node._empTriggered) {
                // Однажды при разрушении
                node._empTriggered = true;
                // ОГЛУШАЕМ врагов на соседних нодах
                for (const neighborId of node.neighbors) {
                    const neighbor = gameState.nodes[neighborId];
                    if (!neighbor) continue;
                    for (const enemy of gameState.enemies) {
                        if (enemy.currentNodeId === neighborId) {
                            enemy.stunned = 180; // 3 сек
                            gameState.logEvents.push({tick: gameState.tick, type: 'shield_emp', nodeId: node.id, stunnedEnemy: enemy.id});
                        }
                    }
                }
            }
            // Сбросить _empTriggered если shield восстановлен
            if (node.shieldHealth > 0) node._empTriggered = false;
        }
    }
    // --- Sentry logic ---
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (!node) continue;
        if (node.owner === 'player' && node.program && node.program.type === 'sentry') {
            // ... поиск врага ...
            let nearest = null;
            let minDist = Infinity;
            for (const enemy of gameState.enemies) {
                if (!enemy) continue;
                const enemyNode = gameState.nodes[enemy.currentNodeId];
                if (!enemyNode) continue;
                const dist = getDistance(node.x, node.y, enemyNode.x, enemyNode.y);
                if (dist < 200 && dist < minDist) {
                    minDist = dist;
                    nearest = enemy;
                }
            }
            if (nearest) {
                let baseDmg = 2.5;
                let level = node.program.level || 1;
                let dmg = baseDmg * Math.pow(level, 1.5);
                // Armor mechanic: если у врага есть armor и он больше уровня Sentry, урон снижается до 10%
                if (nearest.armor && nearest.armor > level) {
                    dmg *= 0.1;
                }
                nearest.health -= dmg;
                sentryDamageDealt += dmg;
                // Sentry 3+: замедляет врага
                if (level >= 3) {
                    nearest.slowed = 180; // 3 секунды
                    gameState.logEvents.push({tick: gameState.tick, type: 'sentry_slow', enemyId: nearest.id, nodeId: node.id});
                }
            }
        }
    }
    // --- TraceLevel ---
    let prevTrace = gameState.traceLevel;
    gameState.traceLevel += 0.005;
    traceInc = gameState.traceLevel - prevTrace;
    if (gameState.traceLevel > 50) {
        reward -= 0.2;
    } else {
        reward -= 0.05;
    }
    // --- EMP cooldown ---
    if (gameState.empCooldown > 0) {
        gameState.empCooldown--;
        if (gameState.empCooldown < 0) gameState.empCooldown = 0;
    }
    // --- Reward function ---
    reward += destroyedEnemies * 10;
    reward += capturedNodes * 20;
    reward -= lostNodes * 1;
    reward -= 0.1 * traceInc;
    reward += 0.1 * Math.floor(dpGenerated / 10);
    reward += sentryDamageDealt * 0.2;
    reward += shieldDamageAbsorbed * 0.1;
    // --- HUB passive income ---
    if (gameState.nodes['hub'] && gameState.nodes['hub'].owner === 'player') {
        gameState.dp += 3; // как Miner 1 уровня
    }
    // --- Reward for upgrade ---
    if (upgradePerformed) {
        reward += 50.0;
    }
    // --- Reward for HUB upgrade ---
    if (hubUpgradedThisStep) {
        reward += 200.0;
    }
    if (gameState.win) reward += 1000;
    if (gameState.lost) reward -= 1000;
    // --- Survival bonus ---
    if (!gameState.gameOver) {
        reward += 0.01;
    }
    // --- Economy tutorial mode ---
    if (mode === 'economy_tutorial') {
        // Не спавним врагов, traceLevel не растёт
        gameState.traceLevel = 0;
        // Победа, если накоплено 1000 dp
        if (gameState.dp >= 1000) {
            gameState.win = true;
            gameState.gameOver = true;
        }
        // survival bonus и остальная логика
        let reward = 0.01;
        if (gameState.win) reward += 1000;
        return { newState: gameState, reward, done: !!gameState.gameOver };
    }
    // --- Defense tutorial mode ---
    if (mode === 'defense_tutorial') {
        // Враги: health=10, спавн по одному, всегда атакуют ближайшую к HUB ноду
        if (!gameState.defenseTargetId) {
            // Найти ближайшую к HUB ноду
            const hub = gameState.nodes['hub'];
            let minDist = Infinity, targetId = null;
            for (const id in gameState.nodes) {
                if (id === 'hub') continue;
                const n = gameState.nodes[id];
                const d = getDistance(hub.x, hub.y, n.x, n.y);
                if (d < minDist) { minDist = d; targetId = id; }
            }
            gameState.defenseTargetId = targetId;
        }
        // Спавн врага раз в 10 секунд, если нет врагов
        if (!gameState.lastEnemySpawn) gameState.lastEnemySpawn = 0;
        gameState.lastEnemySpawn++;
        if (gameState.enemies.length === 0 && gameState.lastEnemySpawn > 600) {
            const path = findPathBFS(gameState.nodes, 'hub', gameState.defenseTargetId) || ['hub', gameState.defenseTargetId];
            const enemy = new Enemy('enemy' + (gameState.enemyIdCounter || 1), 'hub', path, 'patrol');
            enemy.health = 10;
            gameState.enemies.push(enemy);
            gameState.enemyIdCounter = (gameState.enemyIdCounter || 1) + 1;
            gameState.lastEnemySpawn = 0;
        }
        // Победа, если выжить 5 минут (game_time >= 300)
        if (gameState.game_time >= 300) {
            gameState.win = true;
            gameState.gameOver = true;
        }
        // survival bonus и остальная логика
        let reward = 0.01;
        if (gameState.win) reward += 1000;
        return { newState: gameState, reward, done: !!gameState.gameOver };
    }
    // --- В конце эпизода: финальное логирование ---
    if (gameState.gameOver) {
        gameState.logEvents.push({
            tick: gameState.tick,
            type: 'final_stats',
            capturedNodes,
            destroyedEnemies,
            lostNodes,
            builtPrograms,
            upgrades,
            empUsed,
            dp: gameState.dp,
            cpu: gameState.cpu,
            traceLevel: gameState.traceLevel
        });
    }
    // --- Отключение программ ---
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.programDisabledTicks && node.programDisabledTicks > 0) {
            node.programDisabledTicks--;
            // Программа не работает: miner не добывает, sentry не стреляет, shield не защищает
        }
    }
    // --- Done ---
    let done = !!gameState.gameOver;
    return { newState: gameState, reward, done, logEvents: gameState.logEvents };
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