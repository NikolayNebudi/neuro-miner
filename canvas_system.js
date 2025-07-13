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
    // Новые переменные для системы волн и событий
    currentWave: 1,
    waveEnemiesSpawned: 0,
    waveEnemiesTotal: 5,
    waveTimer: 0,
    waveBreakTimer: 0,
    isWaveBreak: false,
    waveBreakDuration: 10, // секунды между волнами
    randomEvents: [],
    activeEvents: [],
    lastEventCheck: 0,
    eventCheckInterval: 30, // проверка событий каждые 30 секунд
    achievementPoints: 0,
    comboKills: 0,
    lastKillTime: 0,
    comboTimeout: 3000, // 3 секунды для комбо
    
    // Система адаптивной сложности
    adaptiveDifficulty: {
        playerPerformance: 0,      // Оценка производительности игрока (0-100)
        difficultyMultiplier: 1.0, // Множитель сложности
        lastAdjustment: 0,         // Время последней корректировки
        adjustmentInterval: 30000,  // Интервал корректировки (30 сек)
        performanceHistory: [],     // История производительности
        maxHistorySize: 10,        // Максимальный размер истории
        targetPerformance: 70      // Целевая производительность (70%)
    },
    
    // Система анализа угроз
    threatAnalysis: {
        lastAnalysis: 0,
        analysisInterval: 5000,    // Анализ каждые 5 секунд
        threatMap: {},             // Карта угроз по нодам
        bypassRoutes: {}           // Альтернативные маршруты
    }
};
let uiButtons = {};
let visualEffects = { 
    sentryShots: [], 
    sentryFlashes: [], 
    enemyExplosions: [], 
    teleportEffects: [], 
    tankRamEffects: [], 
    comboEffects: [],
    achievementEffects: [], // Новые эффекты для достижений
    hubUpgradeEffects: [],  // Эффекты апгрейда Hub
    taxEffects: [],         // Эффекты налога на miner'ы
    waveEffects: [],        // Эффекты волн
    eventEffects: []        // Эффекты случайных событий
};
let gameLogs = [];
let gameStats = {
    enemiesKilled: 0,
    nodesCaptured: 0,
    startTime: Date.now(),
    wavesCompleted: 0,
    maxCombo: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    achievements: {
        masterMiner: false,      // 10 miner'ов уровня 3+
        networkDefender: false,   // 5 sentry уровня 2+
        enemyHunter: false,       // 50 убийств
        hubMaster: false,         // Hub уровня 5+
        antiExeMaster: false,     // 3 ANTI.EXE одновременно
        longSurvivor: false,      // 20 минут игры
        waveMaster: false,        // 10 волн подряд
        comboMaster: false,       // Комбо из 10 убийств
        eventSurvivor: false,     // Пережить 5 случайных событий
        perfectWave: false        // Волна без потерь
    }
};

// Система волн врагов
const WAVE_CONFIG = {
    1: { enemies: 5, types: ['patrol'], difficulty: 1.0 },
    2: { enemies: 7, types: ['patrol', 'hunter'], difficulty: 1.2 },
    3: { enemies: 8, types: ['patrol', 'hunter', 'infector'], difficulty: 1.4 },
    4: { enemies: 10, types: ['hunter', 'infector', 'blitzer'], difficulty: 1.6 },
    5: { enemies: 12, types: ['hunter', 'infector', 'blitzer', 'tank'], difficulty: 1.8 },
    6: { enemies: 15, types: ['hunter', 'infector', 'blitzer', 'tank', 'saboteur', 'shield'], difficulty: 2.0 },
    7: { enemies: 18, types: ['hunter', 'infector', 'blitzer', 'tank', 'saboteur', 'bomber', 'emp'], difficulty: 2.3 },
    8: { enemies: 20, types: ['hunter', 'infector', 'blitzer', 'tank', 'saboteur', 'bomber', 'stealth', 'swarm'], difficulty: 2.6 },
    9: { enemies: 25, types: ['hunter', 'infector', 'blitzer', 'tank', 'saboteur', 'bomber', 'stealth', 'healer', 'juggernaut'], difficulty: 3.0 },
    10: { enemies: 30, types: ['hunter', 'infector', 'blitzer', 'tank', 'saboteur', 'bomber', 'stealth', 'healer', 'commander', 'shield', 'emp'], difficulty: 3.5 }
};

// Система случайных событий
const RANDOM_EVENTS = [
    {
        id: 'enemy_boost',
        name: 'Усиление врагов',
        description: 'Враги получают +50% здоровья и +30% урона на 30 секунд',
        duration: 30,
        effect: (gameState) => {
            gameState.enemies.forEach(enemy => {
                enemy.health *= 1.5;
                enemy.damageMultiplier = (enemy.damageMultiplier || 1) * 1.3;
            });
            addGameLog('⚠️ Враги усилены!', 'warning');
            visualEffects.eventEffects.push({
                type: 'enemy_boost',
                time: performance.now(),
                duration: 30
            });
        }
    },
    {
        id: 'player_boost',
        name: 'Бонус игрока',
        description: '+100 DP, +50 CPU, все программы работают на 150%',
        duration: 20,
        effect: (gameState) => {
            gameState.dp += 100;
            gameState.cpu += 50;
            gameState.playerBoostActive = true;
            gameState.playerBoostEnd = performance.now() + 20000;
            addGameLog('🎁 Бонус получен!', 'success');
            visualEffects.eventEffects.push({
                type: 'player_boost',
                time: performance.now(),
                duration: 20
            });
        }
    },
    {
        id: 'miner_tax',
        name: 'Налог на майнеры',
        description: 'Все miner\'ы работают на 50% эффективности на 15 секунд',
        duration: 15,
        effect: (gameState) => {
            gameState.minerTaxActive = true;
            gameState.minerTaxEnd = performance.now() + 15000;
            addGameLog('💰 Налог на майнеры!', 'warning');
            visualEffects.eventEffects.push({
                type: 'miner_tax',
                time: performance.now(),
                duration: 15
            });
        }
    },
    {
        id: 'sentry_overcharge',
        name: 'Перегрузка турелей',
        description: 'Sentry стреляют в 3 раза быстрее на 10 секунд',
        duration: 10,
        effect: (gameState) => {
            gameState.sentryOverchargeActive = true;
            gameState.sentryOverchargeEnd = performance.now() + 10000;
            addGameLog('⚡ Турели перегружены!', 'success');
            visualEffects.eventEffects.push({
                type: 'sentry_overcharge',
                time: performance.now(),
                duration: 10
            });
        }
    },
    {
        id: 'hub_vulnerability',
        name: 'Уязвимость Hub',
        description: 'Hub получает двойной урон на 20 секунд',
        duration: 20,
        effect: (gameState) => {
            gameState.hubVulnerabilityActive = true;
            gameState.hubVulnerabilityEnd = performance.now() + 20000;
            addGameLog('⚠️ Hub уязвим!', 'warning');
            visualEffects.eventEffects.push({
                type: 'hub_vulnerability',
                time: performance.now(),
                duration: 20
            });
        }
    }
];

// Новые типы врагов с улучшенным поведением
const ENEMY_BEHAVIORS = {
    'saboteur': {
        name: '🛠️ Саботажник',
        health: 60,
        speed: 1.2,
        targetPriority: ['miner', 'overclocker', 'hub'],
        special: 'disables_programs',
        description: 'Отключает программы на нодах',
        threatLevel: 0.7,
        coordinationType: 'support'
    },
    'bomber': {
        name: '💣 Бомбардировщик',
        health: 80,
        speed: 0.8,
        targetPriority: ['hub', 'sentry'],
        special: 'explodes_on_death',
        description: 'Взрывается при смерти, нанося урон соседним нодам',
        threatLevel: 0.9,
        coordinationType: 'sacrifice'
    },
    'stealth': {
        name: '👻 Стелс',
        health: 40,
        speed: 1.5,
        targetPriority: ['miner', 'hub'],
        special: 'invisible_to_sentry',
        description: 'Невидим для Sentry, может проходить незамеченным',
        threatLevel: 0.6,
        coordinationType: 'scout'
    },
    'healer': {
        name: '💚 Лекарь',
        health: 100,
        speed: 0.7,
        targetPriority: ['enemy_healing'],
        special: 'heals_other_enemies',
        description: 'Лечит других врагов',
        threatLevel: 0.8,
        coordinationType: 'support'
    },
    'commander': {
        name: '👑 Командир',
        health: 150,
        speed: 0.9,
        targetPriority: ['hub'],
        special: 'boosts_other_enemies',
        description: 'Усиливает других врагов в радиусе',
        threatLevel: 1.0,
        coordinationType: 'leader'
    },
    'shield': {
        name: '🛡️ Щитоносец',
        health: 120,
        speed: 0.6,
        targetPriority: ['hub'],
        special: 'blocks_sentry_shots',
        description: 'Блокирует выстрелы Sentry для других врагов',
        threatLevel: 0.8,
        coordinationType: 'tank'
    },
    'juggernaut': {
        name: '⚔️ Джаггернаут',
        health: 200,
        speed: 0.5,
        targetPriority: ['sentry', 'hub'],
        special: 'high_armor_piercing',
        description: 'Высокая броня, пробивает оборону',
        threatLevel: 1.2,
        coordinationType: 'tank'
    },
    'swarm': {
        name: '🐝 Рой',
        health: 30,
        speed: 2.0,
        targetPriority: ['miner', 'hub'],
        special: 'swarm_attack',
        description: 'Атакует роем, обходит Sentry',
        threatLevel: 0.5,
        coordinationType: 'swarm'
    },
    'emp': {
        name: '⚡ ЭМИ',
        health: 70,
        speed: 1.0,
        targetPriority: ['sentry', 'hub'],
        special: 'disables_sentry',
        description: 'Временно отключает Sentry',
        threatLevel: 0.9,
        coordinationType: 'support'
    }
};

// Система анализа угроз для AI врагов
const THREAT_ANALYSIS = {
    // Веса различных угроз
    weights: {
        sentry: 10.0,      // Высокая угроза от турелей
        anti_exe: 8.0,     // Высокая угроза от ANTI.EXE
        hub_level: 2.0,    // Угроза от уровня Hub
        player_nodes: 1.0, // Угроза от количества нод игрока
        nearby_enemies: 0.5 // Поддержка от других врагов
    },
    
    // Радиус анализа угроз
    analysisRadius: 300,
    
    // Порог для обхода
    bypassThreshold: 15.0,
    
    // Коэффициенты для разных типов врагов
    bypassMultipliers: {
        stealth: 0.3,    // Стелс легче обходит угрозы
        swarm: 0.5,      // Рой может рисковать
        tank: 1.5,       // Танки игнорируют некоторые угрозы
        scout: 0.4,      // Разведчики обходят угрозы
        default: 1.0
    }
};

// Система координации врагов
const ENEMY_COORDINATION = {
    // Радиус координации
    coordinationRadius: 200,
    
    // Типы координации
    types: {
        leader: {
            radius: 250,
            effect: 'boost_allies',
            description: 'Усиливает союзников в радиусе'
        },
        support: {
            radius: 150,
            effect: 'heal_allies',
            description: 'Лечит союзников'
        },
        tank: {
            radius: 120,
            effect: 'protect_allies',
            description: 'Защищает союзников'
        },
        scout: {
            radius: 300,
            effect: 'reveal_threats',
            description: 'Обнаруживает угрозы'
        },
        swarm: {
            radius: 100,
            effect: 'group_attack',
            description: 'Атакует группой'
        },
        sacrifice: {
            radius: 180,
            effect: 'suicide_attack',
            description: 'Жертвует собой ради группы'
        }
    }
};

let screenShake = { duration: 0, magnitude: 0 };
let godMode = false;
let lastTimestamp = 0;
let lastHint = '';
let hoveredNodeId = null;

// --- CANVAS NETWORK SYSTEM ---
let canvas, ctx;

// В начало initCanvas
function initCanvas() {
    canvas = document.getElementById('canvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
    }
}
// Адаптивный размер canvas
function resizeCanvas() {
    if (!canvas) return;
    const container = document.getElementById('game-area');
    if (container) {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    } else {
        canvas.width = 1000;
        canvas.height = 700;
    }
}

// resizeCanvas() будет вызван после инициализации canvas
window.addEventListener('resize', () => {
    if (canvas) {
        resizeCanvas();
        render();
    }
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
        this.type = type;
        
        // Получаем настройки из ENEMY_BEHAVIORS или используем стандартные
        const behavior = ENEMY_BEHAVIORS[type];
        if (behavior) {
            this.health = behavior.health;
            this.speed = behavior.speed;
            this.targetPriority = behavior.targetPriority;
            this.special = behavior.special;
            this.name = behavior.name;
        } else {
            // Стандартные настройки для существующих типов
            switch(type) {
                case 'hunter':
                    this.health = 90;
                    this.speed = 1.0;
                    this.targetPriority = ['miner', 'hub'];
                    break;
                case 'patrol':
                    this.health = 50;
                    this.speed = 1.0;
                    this.targetPriority = ['hub'];
                    break;
                case 'infector':
                    this.health = 40;
                    this.speed = 0.8;
                    this.infectionRadius = 150;
                    this.infectionDamage = 2;
                    this.targetPriority = ['miner', 'hub'];
                    break;
                case 'blitzer':
                    this.health = 30;
                    this.speed = 2.5;
                    this.teleportCooldown = 0;
                    this.teleportRange = 200;
                    this.targetPriority = ['hub', 'sentry'];
                    break;
                case 'tank':
                    this.health = 300;
                    this.speed = 0.8;
                    this.armor = 0.5;
                    this.ramDamage = 50;
                    this.targetPriority = ['hub', 'sentry'];
                    break;
                default:
                    this.health = 50;
                    this.speed = 1.0;
                    this.targetPriority = ['hub'];
            }
        }
        
        // Дополнительные свойства
        this.lastMove = 0;
        this.isStunnedUntil = 0;
        this.armor = this.armor || 1.0;
        this.damageMultiplier = 1.0;
        this.isInvisible = type === 'stealth';
        this.lastHealTime = 0;
        this.healCooldown = 5000; // 5 секунд между исцелениями
        this.boostRadius = 150; // Радиус усиления для командира
        this.maxHealth = this.health; // Сохраняем максимальное здоровье
        
        // Новые свойства для противодействия
        this.shieldActive = type === 'shield';
        this.shieldRadius = 80; // Радиус щита
        this.empActive = false;
        this.empEndTime = 0;
        this.swarmCount = type === 'swarm' ? 3 : 1; // Количество в рое
        this.piercingDamage = type === 'juggernaut' ? 2.0 : 1.0; // Пробитие брони
        this.armorType = type === 'juggernaut' ? 'heavy' : 
                         type === 'shield' ? 'medium' : 'light';
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
    if (!canvas) return {};
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
    if (!gameState) return;
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

// --- RENDERING FUNCTIONS ---
function drawConnection(ctx, n1, n2, time) {
    if (!canvas || !ctx || !n1 || !n2) return;
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
    if (!canvas || !ctx || !node) return;
    ctx.save();
    
    // Рисуем основную форму врага в зависимости от типа
    switch(type) {
        case 'hunter':
            drawHunterIcon(ctx, node.x, node.y);
            break;
        case 'patrol':
            drawPatrolIcon(ctx, node.x, node.y);
            break;
        case 'infector':
            drawInfectorIcon(ctx, node.x, node.y);
            break;
        case 'blitzer':
            drawBlitzerIcon(ctx, node.x, node.y);
            break;
        case 'tank':
            drawTankIcon(ctx, node.x, node.y);
            break;
        case 'saboteur':
            drawSaboteurIcon(ctx, node.x, node.y);
            break;
        case 'bomber':
            drawBomberIcon(ctx, node.x, node.y);
            break;
        case 'stealth':
            drawStealthIcon(ctx, node.x, node.y);
            break;
        case 'healer':
            drawHealerIcon(ctx, node.x, node.y);
            break;
        case 'commander':
            drawCommanderIcon(ctx, node.x, node.y);
            break;
        case 'shield':
            drawShieldIcon(ctx, node.x, node.y);
            break;
        case 'juggernaut':
            drawJuggernautIcon(ctx, node.x, node.y);
            break;
        case 'swarm':
            drawSwarmIcon(ctx, node.x, node.y);
            break;
        case 'emp':
            drawEmpIcon(ctx, node.x, node.y);
            break;
        default:
            // Стандартная отрисовка для неизвестных типов
            ctx.beginPath();
            ctx.arc(node.x, node.y, 13, 0, 2 * Math.PI);
            ctx.fillStyle = '#ff1744';
            ctx.shadowColor = '#ff1744';
            ctx.shadowBlur = 16;
            ctx.globalAlpha = 0.85;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            ctx.font = 'bold 15px sans-serif';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('E', node.x, node.y+1);
    }
    
    // Эффект оглушения для всех типов
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
    
    // Специальные эффекты для новых типов врагов
    if (type === 'stealth') {
        // Эффект стелса - полупрозрачность
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(node.x, node.y, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
    
    if (type === 'commander') {
        // Аура командования
        ctx.save();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    
    if (type === 'healer') {
        // Эффект исцеления
        ctx.save();
        ctx.strokeStyle = '#32CD32';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    
    // Полоска здоровья для всех врагов
    if (enemy && enemy.health < enemy.maxHealth) {
        const healthPercent = enemy.health / enemy.maxHealth;
        const barWidth = 20;
        const barHeight = 3;
        
        ctx.save();
        ctx.fillStyle = '#333';
        ctx.fillRect(node.x - barWidth/2, node.y - 20, barWidth, barHeight);
        
        ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillRect(node.x - barWidth/2, node.y - 20, barWidth * healthPercent, barHeight);
        ctx.restore();
    }
    
    ctx.restore();
}

// Функции отрисовки иконок врагов
function drawHunterIcon(ctx, x, y) {
    ctx.save();
    // Основное тело - темно-красный круг с градиентом
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 12);
    gradient.addColorStop(0, '#FF1744');
    gradient.addColorStop(1, '#8B0000');
    
    ctx.fillStyle = gradient;
    ctx.shadowColor = '#FF1744';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, 2 * Math.PI);
    ctx.fill();
    
    // Символ "H" в центре
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowBlur = 0;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', x, y);
    
    // Пульсирующий эффект
    const pulse = Math.sin(performance.now() / 200) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.restore();
}

function drawPatrolIcon(ctx, x, y) {
    ctx.save();
    // Тело - фиолетовый квадрат с закругленными углами
    const gradient = ctx.createLinearGradient(x-10, y-10, x+10, y+10);
    gradient.addColorStop(0, '#9C27B0');
    gradient.addColorStop(1, '#4A148C');
    
    ctx.fillStyle = gradient;
    ctx.shadowColor = '#9C27B0';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    // Рисуем скругленный квадрат
    ctx.moveTo(x-6, y-10);
    ctx.lineTo(x+6, y-10);
    ctx.quadraticCurveTo(x+10, y-10, x+10, y-6);
    ctx.lineTo(x+10, y+6);
    ctx.quadraticCurveTo(x+10, y+10, x+6, y+10);
    ctx.lineTo(x-6, y+10);
    ctx.quadraticCurveTo(x-10, y+10, x-10, y+6);
    ctx.lineTo(x-10, y-6);
    ctx.quadraticCurveTo(x-10, y-10, x-6, y-10);
    ctx.closePath();
    ctx.fill();
    
    // Символ "P" в центре
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowBlur = 0;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', x, y);
    
    // Вращающиеся точки по углам
    const time = performance.now() / 1000;
    const points = [
        {x: x-6, y: y-6}, {x: x+6, y: y-6},
        {x: x-6, y: y+6}, {x: x+6, y: y+6}
    ];
    
    points.forEach((point, i) => {
        const angle = time + i * Math.PI / 2;
        const pulse = Math.sin(angle * 3) * 0.5 + 0.5;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#FFD600';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    ctx.restore();
}

function drawInfectorIcon(ctx, x, y) {
    ctx.save();
    // Центральное ядро - зеленый треугольник
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 12);
    gradient.addColorStop(0, '#00FF41');
    gradient.addColorStop(1, '#00E676');
    
    ctx.fillStyle = gradient;
    ctx.shadowColor = '#00FF41';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x, y-12);
    ctx.lineTo(x-10, y+8);
    ctx.lineTo(x+10, y+8);
    ctx.closePath();
    ctx.fill();
    
    // Символ "I" в центре
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowBlur = 0;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('I', x, y);
    
    // Пульсирующие точки вокруг
    const time = performance.now() / 1000;
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + time;
        const radius = 15;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        const pulse = Math.sin(time * 4 + i) * 0.5 + 0.5;
        
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#00FF41';
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    ctx.restore();
}

function drawBlitzerIcon(ctx, x, y) {
    ctx.save();
    // Основное тело - желтый ромб
    const gradient = ctx.createLinearGradient(x-10, y, x+10, y);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(1, '#FFEB3B');
    
    ctx.fillStyle = gradient;
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(x, y-12);
    ctx.lineTo(x+10, y);
    ctx.lineTo(x, y+12);
    ctx.lineTo(x-10, y);
    ctx.closePath();
    ctx.fill();
    
    // Символ "B" в центре
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowBlur = 0;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', x, y);
    
    // Электрические разряды
    const time = performance.now() / 1000;
    for (let i = 0; i < 4; i++) {
        const angle = time + i * Math.PI / 2;
        const pulse = Math.sin(angle * 6) * 0.5 + 0.5;
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * 8, y + Math.sin(angle) * 8);
        ctx.lineTo(x + Math.cos(angle) * 16, y + Math.sin(angle) * 16);
        ctx.stroke();
    }
    
    ctx.restore();
}

function drawTankIcon(ctx, x, y) {
    ctx.save();
    
    // Основной корпус танка
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 12, y - 8, 24, 16);
    
    // Башня
    ctx.fillStyle = '#654321';
    ctx.fillRect(x - 8, y - 12, 16, 8);
    
    // Гусеницы
    ctx.fillStyle = '#2F2F2F';
    ctx.fillRect(x - 14, y - 6, 28, 4);
    
    // Дуло
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(x + 8, y - 2, 8, 4);
    
    // Броня (блестящие детали)
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 10, y - 6, 20, 12);
    
    ctx.restore();
}

// Новые функции отрисовки врагов
function drawSaboteurIcon(ctx, x, y) {
    ctx.save();
    
    // Основная форма саботажника
    ctx.fillStyle = '#FF6B35';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Инструменты
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 8);
    ctx.lineTo(x + 8, y + 8);
    ctx.moveTo(x + 8, y - 8);
    ctx.lineTo(x - 8, y + 8);
    ctx.stroke();
    
    // Глаза
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 2, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawBomberIcon(ctx, x, y) {
    ctx.save();
    
    // Корпус бомбардировщика
    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.ellipse(x, y, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Бомбы
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x - 6, y + 4, 3, 0, Math.PI * 2);
    ctx.arc(x + 6, y + 4, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Фитили
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 1);
    ctx.lineTo(x - 6, y - 3);
    ctx.moveTo(x + 6, y + 1);
    ctx.lineTo(x + 6, y - 3);
    ctx.stroke();
    
    // Кабина
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath();
    ctx.arc(x, y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawStealthIcon(ctx, x, y) {
    ctx.save();
    
    // Полупрозрачная форма
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Эффект стелса
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Глаза
    ctx.fillStyle = '#00FFFF';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 2, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawHealerIcon(ctx, x, y) {
    ctx.save();
    
    // Основная форма лекаря
    ctx.fillStyle = '#32CD32';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Крест медика
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y + 6);
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
    ctx.stroke();
    
    // Аура исцеления
    ctx.strokeStyle = '#90EE90';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
}

function drawCommanderIcon(ctx, x, y) {
    ctx.save();
    
    // Корона командира
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 4);
    ctx.lineTo(x - 4, y - 4);
    ctx.lineTo(x, y + 2);
    ctx.lineTo(x + 4, y - 4);
    ctx.lineTo(x + 8, y + 4);
    ctx.closePath();
    ctx.fill();
    
    // Основная форма
    ctx.fillStyle = '#4169E1';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Звезды ранга
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x - 4, y - 2, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 2, 1.5, 0, Math.PI * 2);
    ctx.arc(x, y + 4, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Аура командования
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
}

// Новые функции отрисовки для противодействующих врагов
function drawShieldIcon(ctx, x, y) {
    ctx.save();
    
    // Основная форма щитоносца
    ctx.fillStyle = '#4A90E2';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Щит
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 8);
    ctx.lineTo(x + 8, y - 8);
    ctx.lineTo(x + 8, y + 8);
    ctx.lineTo(x - 8, y + 8);
    ctx.closePath();
    ctx.stroke();
    
    // Символ щита
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Аура защиты
    ctx.strokeStyle = '#4A90E2';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
}

function drawJuggernautIcon(ctx, x, y) {
    ctx.save();
    
    // Основная форма джаггернаута
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Броневые пластины
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const px = x + Math.cos(angle) * 8;
        const py = y + Math.sin(angle) * 8;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Символ силы
    ctx.fillStyle = '#FF4500';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('J', x, y);
    
    // Аура брони
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
}

function drawSwarmIcon(ctx, x, y) {
    ctx.save();
    
    // Рой из нескольких маленьких врагов
    const swarmCount = 3;
    for (let i = 0; i < swarmCount; i++) {
        const angle = (i * Math.PI * 2) / swarmCount;
        const px = x + Math.cos(angle) * 8;
        const py = y + Math.sin(angle) * 8;
        
        ctx.fillStyle = '#FF6B35';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Глаза
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(px - 1, py - 1, 1, 0, Math.PI * 2);
        ctx.arc(px + 1, py - 1, 1, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Центральная точка роя
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawEmpIcon(ctx, x, y) {
    ctx.save();
    
    // Основная форма ЭМИ
    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Молнии
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const startX = x + Math.cos(angle) * 5;
        const startY = y + Math.sin(angle) * 5;
        const endX = x + Math.cos(angle) * 15;
        const endY = y + Math.sin(angle) * 15;
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }
    
    // Символ ЭМИ
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', x, y);
    
    // Пульсирующая аура
    const time = performance.now() / 1000;
    const pulse = Math.sin(time * 3) * 0.3 + 0.7;
    ctx.strokeStyle = '#FF4500';
    ctx.lineWidth = 2;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
}

// --- УНИКАЛЬНЫЕ ИКОНКИ ДЛЯ ПРОГРАММ С РАЗЛИЧИЕМ ПО УРОВНЯМ ---
function drawMinerIcon(ctx, x, y, time, level) {
    ctx.save();
    // Кристалл
    ctx.beginPath();
    if (level === 1) {
        ctx.moveTo(x, y-8);
        ctx.lineTo(x+5, y);
        ctx.lineTo(x, y+8);
        ctx.lineTo(x-5, y);
    } else if (level === 2) {
        ctx.moveTo(x, y-10);
        ctx.lineTo(x+7, y);
        ctx.lineTo(x, y+10);
        ctx.lineTo(x-7, y);
    } else {
        ctx.moveTo(x, y-12);
        ctx.lineTo(x+9, y-2);
        ctx.lineTo(x+5, y+12);
        ctx.lineTo(x-5, y+12);
        ctx.lineTo(x-9, y-2);
    }
    ctx.closePath();
    ctx.fillStyle = level === 1 ? '#ffe066' : level === 2 ? '#ffd600' : '#fff2b2';
    ctx.shadowColor = '#ffd600';
    ctx.shadowBlur = 10 + 4*level;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    // Вращающиеся точки и лучи
    let dots = 2 + level*2;
    for (let i=0; i<dots; i++) {
        let angle = time/400 + i*2*Math.PI/dots;
        ctx.beginPath();
        ctx.arc(x+Math.cos(angle)*(12+level*2), y+Math.sin(angle)*(12+level*2), 2+level, 0, 2*Math.PI);
        ctx.fillStyle = '#fffbe7';
        ctx.globalAlpha = 0.7;
        ctx.fill();
        if (level >= 3) {
            // Лучи
            ctx.save();
            ctx.strokeStyle = '#ffd600';
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x+Math.cos(angle)*(18+level*2), y+Math.sin(angle)*(18+level*2));
            ctx.stroke();
            ctx.restore();
        }
    }
    ctx.restore();
}

function drawSentryIcon(ctx, x, y, time, level) {
    ctx.save();
    // Основание
    ctx.beginPath();
    ctx.arc(x, y, 8+level*2, 0, 2*Math.PI);
    ctx.fillStyle = level === 1 ? '#00ff90' : level === 2 ? '#00ffcc' : '#b2ffe7';
    ctx.shadowColor = '#00eaff';
    ctx.shadowBlur = 10+level*4;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    // Стволы
    let barrels = level;
    for (let i=0; i<barrels; i++) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time/300 + i*2*Math.PI/barrels);
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(0, -16-4*level);
        ctx.strokeStyle = '#00eaff';
        ctx.lineWidth = 2+level;
        ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 8+level*2;
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.restore();
    }
    // Кольца
    if (level >= 2) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 15+level*2, 0, 2*Math.PI);
        ctx.strokeStyle = '#00eaff';
        ctx.globalAlpha = 0.25+0.1*level;
        ctx.lineWidth = 2+level;
        ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 8+level*2;
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

function drawAntiExeIcon(ctx, x, y, time, level) {
    ctx.save();
    // Щит
    ctx.beginPath();
    if (level === 1) {
        ctx.moveTo(x, y-10);
        ctx.lineTo(x+8, y);
        ctx.lineTo(x, y+12);
        ctx.lineTo(x-8, y);
    } else if (level === 2) {
        ctx.moveTo(x, y-12);
        ctx.lineTo(x+10, y-2);
        ctx.lineTo(x+6, y+14);
        ctx.lineTo(x-6, y+14);
        ctx.lineTo(x-10, y-2);
    } else {
        ctx.moveTo(x, y-14);
        ctx.lineTo(x+12, y-4);
        ctx.lineTo(x+8, y+16);
        ctx.lineTo(x-8, y+16);
        ctx.lineTo(x-12, y-4);
    }
    ctx.closePath();
    ctx.fillStyle = level === 1 ? '#ff4569' : level === 2 ? '#ff1744' : '#ff8a9a';
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 12+level*4;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    // Разряды и трещины
    let bolts = 1+level*2;
    for (let i=0; i<bolts; i++) {
        let angle = time/200 + i*2*Math.PI/bolts;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -13-level*2);
        ctx.lineTo(2, -18-2*level);
        ctx.lineTo(-2, -18-2*level);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5+0.2*level;
        ctx.fill();
        if (level >= 3) {
            // Трещины
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.lineTo(3, -14);
            ctx.lineTo(-3, -16);
            ctx.strokeStyle = '#fff';
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.restore();
    }
    ctx.restore();
}

function drawOverclockerIcon(ctx, x, y, time, level) {
    ctx.save();
    // Чип
    ctx.beginPath();
    ctx.rect(x-8-level, y-8-level, 16+level*2, 16+level*2);
    ctx.fillStyle = level === 1 ? '#b388ff' : level === 2 ? '#d1aaff' : '#f3e6ff';
    ctx.shadowColor = '#b388ff';
    ctx.shadowBlur = 10+level*4;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    // Молнии
    let bolts = level;
    for (let i=0; i<bolts; i++) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(time/300)+i*2*Math.PI/bolts);
        ctx.beginPath();
        ctx.moveTo(-2, -4);
        ctx.lineTo(2, 0);
        ctx.lineTo(-1, 0);
        ctx.lineTo(3, 6);
        ctx.lineTo(-2, 2);
        ctx.lineTo(1, 2);
        ctx.closePath();
        ctx.fillStyle = '#fffbe7';
        ctx.globalAlpha = 0.7+0.1*level;
        ctx.fill();
        ctx.restore();
    }
    // Ореол
    if (level >= 3) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 15+level*2, 0, 2*Math.PI);
        ctx.strokeStyle = '#b388ff';
        ctx.globalAlpha = 0.25+0.1*level;
        ctx.lineWidth = 2+level;
        ctx.shadowColor = '#b388ff';
        ctx.shadowBlur = 8+level*2;
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

function drawHubIcon(ctx, x, y, time, level) {
    ctx.save();
    // Ядро
    ctx.beginPath();
    ctx.arc(x, y, 13+level, 0, 2*Math.PI);
    ctx.fillStyle = '#ffd600';
    ctx.shadowColor = '#fffbe7';
    ctx.shadowBlur = 18+level*2;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    // Орбиты
    for (let i=0; i<3+level; i++) {
        let angle = time/500 + i*2*Math.PI/(3+level);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.arc(0, 0, 20+level*2, 0, Math.PI/6);
        ctx.strokeStyle = '#ffd600';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

// --- УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ОТРИСОВКИ ПРОГРАММЫ ---
function drawProgramIcon(ctx, node) {
    if (!node.program || !canvas || !ctx) return;
    let time = performance.now();
    let level = node.program.level || 1;
    switch(node.program.type) {
        case 'miner':
            drawMinerIcon(ctx, node.x, node.y, time, level);
            break;
        case 'sentry':
            drawSentryIcon(ctx, node.x, node.y, time, level);
            break;
        case 'anti_exe':
            drawAntiExeIcon(ctx, node.x, node.y, time, level);
            break;
        case 'overclocker':
            drawOverclockerIcon(ctx, node.x, node.y, time, level);
            break;
    }
    // Для HUB рисуем отдельно в drawNode
}

function drawResourcePanel(ctx) {
    if (!gameState || !gameState.nodes || !canvas || !ctx) return;
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
    
    // Информация о волнах
    if (gameState.phase === 'PLAYING') {
        ctx.fillStyle = gameState.isWaveBreak ? '#ffff00' : '#00ff00';
        ctx.fillText('Волна: ' + gameState.currentWave, 32, 106);
        
        if (!gameState.isWaveBreak) {
            ctx.fillStyle = '#ffaa00';
            ctx.fillText(`Врагов: ${gameState.waveEnemiesSpawned}/${gameState.waveEnemiesTotal}`, 32, 128);
        } else {
            ctx.fillStyle = '#00ffff';
            ctx.fillText(`Перерыв: ${Math.ceil(gameState.waveBreakTimer)}с`, 32, 128);
        }
        
        // Комбо
        if (gameState.comboKills > 1) {
            ctx.fillStyle = '#ff6600';
            ctx.fillText(`Комбо: x${gameState.comboKills}`, 32, 150);
        }
        
        // Активные события
        if (gameState.activeEvents.length > 0) {
            ctx.fillStyle = '#ff00ff';
            ctx.fillText(`События: ${gameState.activeEvents.length}`, 32, 172);
        }
    }
    
    if (gameState.hubCaptureActive) {
        ctx.font = 'bold 17px sans-serif';
        ctx.fillStyle = '#ff1744';
        ctx.fillText('HUB CAPTURE: ' + Math.floor(gameState.hubCaptureProgress*100) + '%', 32, 194);
    }
    const x = 32, y = 200, w = 180, h = 38;
    ctx.beginPath();
    // Рисуем скругленный прямоугольник
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x + w - 10, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + 10);
    ctx.lineTo(x + w, y + h - 10);
    ctx.quadraticCurveTo(x + w, y + h, x + w - 10, y + h);
    ctx.lineTo(x + 10, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - 10);
    ctx.lineTo(x, y + 10);
    ctx.quadraticCurveTo(x, y, x + 10, y);
    ctx.closePath();
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
    if (!node || !canvas || !ctx) return;
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
        if (node.program.type === 'anti_exe') {
            const antiExeColors = ['#ff1744', '#ff4569', '#ff8a9a'];
            fill = antiExeColors[Math.min(lvl-1, antiExeColors.length-1)];
            shadow = fill;
            stroke = '#ffe0e0';
            // Пульсирующий красный глоу и кольца
            for (let i = 0; i < lvl; i++) {
                ctx.save();
                ctx.globalAlpha = 0.2 + 0.1*i;
                ctx.beginPath();
                ctx.arc(node.x, node.y, size + 12 + 8*i + 4*Math.sin(time*3 + i), 0, 2 * Math.PI);
                ctx.strokeStyle = antiExeColors[Math.min(i, antiExeColors.length-1)];
                ctx.lineWidth = 6 + 2*i;
                ctx.shadowColor = antiExeColors[Math.min(i, antiExeColors.length-1)];
                ctx.shadowBlur = 18 + 10*i;
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
    


    if (node.type === 'hub') { ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('HUB', node.x, node.y); }
    
    // Индикаторы состояния Sentry
    if (node.owner === 'player' && node.program && node.program.type === 'sentry') {
        ctx.save();
        
        // Индикатор патронов
        if (node.program.ammo !== undefined) {
            const ammoPercent = node.program.ammo / SENTRY_MECHANICS.maxAmmo;
            const barWidth = 24;
            const barHeight = 3;
            
            ctx.fillStyle = '#333';
            ctx.fillRect(node.x - barWidth/2, node.y - 25, barWidth, barHeight);
            
            ctx.fillStyle = ammoPercent > 0.5 ? '#00ff00' : ammoPercent > 0.2 ? '#ffff00' : '#ff0000';
            ctx.fillRect(node.x - barWidth/2, node.y - 25, barWidth * ammoPercent, barHeight);
        }
        
        // Индикатор перегрева
        if (node.program.overheated) {
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 8, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Индикатор ЭМИ
        if (node.program.empDisabled && performance.now() < node.program.empDisabled) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.8;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        ctx.restore();
    }
    
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
    if (!selectedNode || !canvas) return {};
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
        // --- Ограничение: апгрейд только если hubLevel * 2 >= целевого уровня, но максимальный уровень 6 ---
        if (selectedNode.program.level < Math.min(6, gameState.hubLevel * 2)) {
            buttons['upgrade'] = { x, y, w: btnW, h: btnH, type: 'upgrade'};
        }
    } else {
        const buttonData = [];
        if (selectedNode.type === 'cpu_node') {
            buttonData.push({ label: 'Overclocker', cost: 50, type: 'overclocker' });
        } else {
            buttonData.push({ label: 'Miner', cost: 13, type: 'miner' });
            
            // Ограничение на количество ANTI.EXE (максимум 3)
            const antiExeCount = Object.values(gameState.nodes).filter(n => n.owner === 'player' && n.program && n.program.type === 'anti_exe').length;
            if (antiExeCount < 3) {
                buttonData.push({ label: 'ANTI.EXE', cost: 20, type: 'anti_exe' });
            }
            
            buttonData.push({ label: 'Sentry', cost: 27, type: 'sentry' });
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
    if (!selectedNode || !canvas || !ctx) return;
    ctx.save();
    ctx.font = 'bold 15px sans-serif'; ctx.textBaseline = 'middle'; // уменьшил шрифт
    uiButtons = calculateProgramUIButtons(selectedNode); // Recalculate for drawing
    for (const key in uiButtons) {
        const btn = uiButtons[key];
        ctx.beginPath(); 
        // Рисуем скругленный прямоугольник
        ctx.moveTo(btn.x + 10, btn.y);
        ctx.lineTo(btn.x + btn.w - 10, btn.y);
        ctx.quadraticCurveTo(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + 10);
        ctx.lineTo(btn.x + btn.w, btn.y + btn.h - 10);
        ctx.quadraticCurveTo(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w - 10, btn.y + btn.h);
        ctx.lineTo(btn.x + 10, btn.y + btn.h);
        ctx.quadraticCurveTo(btn.x, btn.y + btn.h, btn.x, btn.y + btn.h - 10);
        ctx.lineTo(btn.x, btn.y + 10);
        ctx.quadraticCurveTo(btn.x, btn.y, btn.x + 10, btn.y);
        ctx.closePath();
        ctx.fillStyle = '#232b33ee'; ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
        ctx.lineWidth = 2; ctx.strokeStyle = '#00eaff'; ctx.stroke();
        ctx.fillStyle = '#fff';
        let label = '';
        if (btn.type === 'upgrade') {
            let prog = selectedNode.program;
            let baseCost = prog.type === 'miner' ? 13 : prog.type === 'anti_exe' ? 20 : 27;
            // Прогрессивная стоимость для отображения
            let levelMultiplier = prog.level <= 3 ? prog.level : 
                                prog.level <= 5 ? prog.level * 1.5 : 
                                prog.level * 2;
            let cost = Math.round(baseCost * levelMultiplier);
            let cpuCost = 10 * prog.level;
            label = `Upgrade Lvl ${prog.level+1}\n(${cost}DP, ${cpuCost}CPU)`;
        } else if (btn.type === 'upgrade_hub') {
            // --- Отображение стоимости апгрейда HUB ---
            let cost = 50 * gameState.hubLevel; // Увеличено с 35 до 50
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
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.fillStyle = '#181c22ee'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 48px sans-serif'; ctx.fillStyle = '#ffd600'; ctx.textAlign = 'center';
    ctx.fillText('NETWORK ECHO', canvas.width/2, canvas.height/2 - 80);
    ctx.font = '22px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('AI-Driven Balance Edition', canvas.width/2, canvas.height/2 - 40);
    
    const btn = { x: canvas.width/2-120, y: canvas.height/2+20, w: 240, h: 50 };
    ctx.beginPath(); 
    // Используем стандартный способ рисования скругленного прямоугольника
    ctx.moveTo(btn.x + 15, btn.y);
    ctx.lineTo(btn.x + btn.w - 15, btn.y);
    ctx.quadraticCurveTo(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + 15);
    ctx.lineTo(btn.x + btn.w, btn.y + btn.h - 15);
    ctx.quadraticCurveTo(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w - 15, btn.y + btn.h);
    ctx.lineTo(btn.x + 15, btn.y + btn.h);
    ctx.quadraticCurveTo(btn.x, btn.y + btn.h, btn.x, btn.y + btn.h - 15);
    ctx.lineTo(btn.x, btn.y + 15);
    ctx.quadraticCurveTo(btn.x, btn.y, btn.x + 15, btn.y);
    ctx.closePath();
    ctx.fillStyle = '#ffd600'; ctx.fill();
    ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#232b33'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Start New Game', btn.x + btn.w/2, btn.y + btn.h/2);
    ctx.restore();
}

function drawEndScreen(ctx, isWin, score) {
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.fillStyle = isWin ? 'rgba(0, 255, 144, 0.85)' : 'rgba(255, 23, 68, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 48px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(isWin ? 'YOU WIN!' : 'GAME OVER', canvas.width/2, canvas.height/2 - 60);
    ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('Final DP: ' + Math.floor(score), canvas.width/2, canvas.height/2 - 10);
    
    const btn = { x: canvas.width/2 - 80, y: canvas.height/2 + 30, w: 160, h: 44 };
    ctx.beginPath(); 
    // Рисуем скругленный прямоугольник
    ctx.moveTo(btn.x + 10, btn.y);
    ctx.lineTo(btn.x + btn.w - 10, btn.y);
    ctx.quadraticCurveTo(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + 10);
    ctx.lineTo(btn.x + btn.w, btn.y + btn.h - 10);
    ctx.quadraticCurveTo(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w - 10, btn.y + btn.h);
    ctx.lineTo(btn.x + 10, btn.y + btn.h);
    ctx.quadraticCurveTo(btn.x, btn.y + btn.h, btn.x, btn.y + btn.h - 10);
    ctx.lineTo(btn.x, btn.y + 10);
    ctx.quadraticCurveTo(btn.x, btn.y, btn.x + 10, btn.y);
    ctx.closePath();
    ctx.fillStyle = '#232b33'; ctx.fill();
    ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#ffd600'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Main Menu', btn.x + btn.w/2, btn.y + btn.h/2);
    ctx.restore();
}

function drawHint(ctx, text) {
    if (!text || !canvas || !ctx) return;
    ctx.save();
    ctx.globalAlpha = 0.92; ctx.fillStyle = '#232b33ee';
    ctx.font = 'bold 16px sans-serif';
    const textWidth = ctx.measureText(text).width;
    ctx.fillRect(20, canvas.height-70, textWidth + 30, 44);
    ctx.fillStyle = '#ffd600'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 35, canvas.height - 48);
    ctx.restore();
}

// Функции для работы с интерфейсом
function addGameLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        message: message,
        type: type,
        timestamp: timestamp,
        time: Date.now()
    };
    
    gameLogs.unshift(logEntry);
    
    // Ограничиваем количество логов
    if (gameLogs.length > 50) {
        gameLogs = gameLogs.slice(0, 50);
    }
    
    updateInterface();
}

// Функция создания эффекта достижения
function createAchievementEffect(message) {
    if (!canvas) return;
    visualEffects.achievementEffects.push({
        message: message,
        time: performance.now(),
        x: canvas.width / 2,
        y: canvas.height / 2 - 100
    });
}

// Функция проверки достижений
function checkAchievements() {
    if (!gameStats || !gameStats.achievements || !gameState || !gameState.nodes) return;
    const achievements = gameStats.achievements;
    
    // Мастер майнера
    if (!achievements.masterMiner) {
        const highLevelMiners = Object.values(gameState.nodes).filter(n => 
            n.owner === 'player' && n.program && n.program.type === 'miner' && n.program.level >= 3
        ).length;
        if (highLevelMiners >= 10) {
            achievements.masterMiner = true;
            addGameLog('🏆 ДОСТИЖЕНИЕ: Мастер майнера!', 'success');
            createAchievementEffect('🏆 МАСТЕР МАЙНЕРА!');
        }
    }
    
    // Защитник сети
    if (!achievements.networkDefender) {
        const highLevelSentry = Object.values(gameState.nodes).filter(n => 
            n.owner === 'player' && n.program && n.program.type === 'sentry' && n.program.level >= 2
        ).length;
        if (highLevelSentry >= 5) {
            achievements.networkDefender = true;
            addGameLog('🏆 ДОСТИЖЕНИЕ: Защитник сети!', 'success');
            createAchievementEffect('🏆 ЗАЩИТНИК СЕТИ!');
        }
    }
    
    // Охотник на врагов
    if (!achievements.enemyHunter && gameStats.enemiesKilled >= 50) {
        achievements.enemyHunter = true;
        addGameLog('🏆 ДОСТИЖЕНИЕ: Охотник на врагов!', 'success');
        createAchievementEffect('🏆 ОХОТНИК НА ВРАГОВ!');
    }
    
    // Мастер Hub
    if (!achievements.hubMaster && gameState.hubLevel >= 5) {
        achievements.hubMaster = true;
        addGameLog('🏆 ДОСТИЖЕНИЕ: Мастер Hub!', 'success');
        createAchievementEffect('🏆 МАСТЕР HUB!');
    }
    
    // Мастер ANTI.EXE
    if (!achievements.antiExeMaster) {
        const antiExeCount = Object.values(gameState.nodes).filter(n => 
            n.owner === 'player' && n.program && n.program.type === 'anti_exe'
        ).length;
        if (antiExeCount >= 3) {
            achievements.antiExeMaster = true;
            addGameLog('🏆 ДОСТИЖЕНИЕ: Мастер ANTI.EXE!', 'success');
            createAchievementEffect('🏆 МАСТЕР ANTI.EXE!');
        }
    }
    
    // Долгожитель
    if (!achievements.longSurvivor) {
        const gameTime = (Date.now() - gameStats.startTime) / 1000;
        if (gameTime >= 1200) { // 20 минут
            achievements.longSurvivor = true;
            addGameLog('🏆 ДОСТИЖЕНИЕ: Долгожитель!', 'success');
            createAchievementEffect('🏆 ДОЛГОЖИТЕЛЬ!');
        }
    }
}

function updateInterface() {
    if (!gameStats || !gameState) return;
    // Обновляем статистику
    const gameTime = Math.floor((Date.now() - gameStats.startTime) / 1000);
    const minutes = Math.floor(gameTime / 60);
    const seconds = gameTime % 60;
    
    const statsElements = {
        'game-time': `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
        'hub-level': gameState.hubLevel || 1,
        'trace-level': Math.floor(gameState.traceLevel || 0),
        'enemies-killed': gameStats.enemiesKilled,
        'nodes-captured': gameStats.nodesCaptured
    };
    
    for (const [id, value] of Object.entries(statsElements)) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }
    
    // Обновляем логи
    const logsContent = document.getElementById('logs-content');
    if (logsContent) {
        logsContent.innerHTML = gameLogs.map(log => {
            const color = log.type === 'warning' ? '#ffd600' : 
                         log.type === 'error' ? '#ff1744' : 
                         log.type === 'success' ? '#00ff90' : '#fff';
            return `<div style="color: ${color}; margin-bottom: 2px;">
                <span style="color: #666;">[${log.timestamp}]</span> ${log.message}
            </div>`;
        }).join('');
    }
    
    // Обновляем список врагов
    const enemyList = document.getElementById('enemy-list');
    if (enemyList && gameState.enemies) {
        const enemyCounts = {};
        for (const enemy of gameState.enemies) {
            enemyCounts[enemy.type] = (enemyCounts[enemy.type] || 0) + 1;
        }
        
        enemyList.innerHTML = Object.entries(enemyCounts).map(([type, count]) => {
            const typeNames = {
                'hunter': 'Охотник',
                'patrol': 'Патрульный', 
                'infector': 'Инфектор',
                'blitzer': 'Блитцер',
                'tank': 'Танк'
            };
            return `<div style="margin-bottom: 4px; display: flex; align-items: center;">
                <div class="enemy-icon enemy-${type}"></div>
                <span>${typeNames[type] || type}: ${count}</span>
            </div>`;
        }).join('');
    }
}

// В начало render
function render() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const time = Date.now();
    
    // Обновляем интерфейс
    updateInterface();
    // Проверяем достижения
    checkAchievements();
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
        
        // Определяем цвет выстрела
        let shotColor = shot.color || '#00ff90'; // По умолчанию зеленый для sentry
        
        // Неоновый лазер
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = shotColor;
        ctx.shadowColor = shotColor;
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
            ctx.fillStyle = shotColor;
            ctx.shadowColor = shotColor;
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
    
    // --- Эффекты достижений ---
    for (const effect of visualEffects.achievementEffects) {
        const t = (performance.now() - effect.time) / 3000; // 3 секунды
        if (t > 1) continue;
        
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#ffd600';
        ctx.shadowColor = '#ffd600';
        ctx.shadowBlur = 20;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Анимация появления
        const scale = t < 0.3 ? t / 0.3 : 1;
        ctx.translate(effect.x, effect.y);
        ctx.scale(scale, scale);
        
        ctx.fillText(effect.message, 0, 0);
        
        // Дополнительные эффекты
        if (t < 0.5) {
            ctx.globalAlpha = (0.5 - t) * 2;
            ctx.beginPath();
            ctx.arc(0, 0, 100 + 50 * Math.sin(t * 10), 0, 2 * Math.PI);
            ctx.strokeStyle = '#ffd600';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    // --- Screen shake ---
    let shakeX = 0, shakeY = 0;
    if (screenShake.duration > 0) {
        shakeX = (Math.random() - 0.5) * 2 * screenShake.magnitude;
        shakeY = (Math.random() - 0.5) * 2 * screenShake.magnitude;
        ctx.save();
        ctx.translate(shakeX, shakeY);
        
        // Обновляем duration
        screenShake.duration -= 16; // 60fps
        if (screenShake.duration <= 0) {
            screenShake.duration = 0;
            screenShake.magnitude = 0;
        }
        
        ctx.restore();
    }
    // --- Очистка массивов эффектов ---
    visualEffects.sentryShots = visualEffects.sentryShots.filter(shot => (performance.now() - shot.time) < 400);
    visualEffects.sentryFlashes = visualEffects.sentryFlashes.filter(flash => (performance.now() - flash.time) < 300);
    visualEffects.enemyExplosions = visualEffects.enemyExplosions.filter(boom => (performance.now() - boom.time) < 420);
    visualEffects.achievementEffects = visualEffects.achievementEffects.filter(effect => (performance.now() - effect.time) < 3000);
    
    // Обновление адаптивной сложности
    updateAdaptiveDifficulty(performance.now());
    
    // Отрисовка улучшенных подсказок
    updateHints(performance.now());
    drawEnhancedHint(ctx);
    
    // Отрисовка индикаторов угроз
    drawThreatIndicators(ctx);
    
    // Отрисовка информации о врагах при наведении
    if (hoveredNodeId) {
        const hoveredNode = gameState.nodes[hoveredNodeId];
        if (hoveredNode) {
            for (const enemy of gameState.enemies) {
                if (enemy.currentNodeId === hoveredNodeId) {
                    drawEnemyInfo(ctx, enemy);
                    break;
                }
            }
        }
    }
    
    // --- Отрисовка эффектов волн ---
    for (const effect of visualEffects.waveEffects) {
        const t = (performance.now() - effect.time) / (effect.duration * 1000);
        if (t > 1) continue;
        
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = effect.type === 'wave_start' ? '#00ff00' : '#ff0000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = effect.type === 'wave_start' ? '#00ff00' : '#ff0000';
        ctx.shadowBlur = 15;
        ctx.fillText(`Волна ${effect.wave}`, canvas.width / 2, canvas.height / 2 - 50);
        ctx.restore();
    }
    visualEffects.waveEffects = visualEffects.waveEffects.filter(effect => (performance.now() - effect.time) < effect.duration * 1000);
    
    // --- Отрисовка эффектов событий ---
    for (const effect of visualEffects.eventEffects) {
        const t = (performance.now() - effect.time) / (effect.duration * 1000);
        if (t > 1) continue;
        
        const alpha = 0.3 * (1 - t);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = effect.type === 'enemy_boost' ? '#ff0000' : 
                       effect.type === 'player_boost' ? '#00ff00' : 
                       effect.type === 'miner_tax' ? '#ffff00' : 
                       effect.type === 'sentry_overcharge' ? '#00ffff' : '#ff00ff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
    visualEffects.eventEffects = visualEffects.eventEffects.filter(effect => (performance.now() - effect.time) < effect.duration * 1000);
    
    // --- Отрисовка комбо эффектов ---
    for (const effect of visualEffects.comboEffects) {
        const t = (performance.now() - effect.time) / (effect.duration * 1000);
        if (t > 1) continue;
        
        const alpha = 1 - t;
        const scale = 1 + t * 0.5;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ff6600';
        ctx.font = `bold ${24 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 20;
        ctx.fillText(`КОМБО x${effect.combo}!`, canvas.width / 2, canvas.height / 2 + 50);
        ctx.restore();
    }
    visualEffects.comboEffects = visualEffects.comboEffects.filter(effect => (performance.now() - effect.time) < effect.duration * 1000);
}

// В начало update
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
    if (gameState.nodes) {
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
                    gameStats.nodesCaptured++;
                    addGameLog(`Нода ${node.id} захвачена игроком`, 'success');
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
                
                // Атака Sentry
                if (node.program.type === 'sentry') {
                    // Проверяем, не отключен ли Sentry ЭМИ
                    if (node.program.empDisabled && now < node.program.empDisabled) {
                        continue; // Пропускаем атаку
                    }
                    
                    // Инициализируем свойства Sentry если их нет
                    if (!node.program.ammo) {
                        node.program.ammo = SENTRY_MECHANICS.maxAmmo;
                        node.program.reloadStart = 0;
                        node.program.overheated = false;
                        node.program.overheatStart = 0;
                    }
                    
                    // Проверяем перезарядку
                    if (node.program.ammo <= 0 && !node.program.reloadStart) {
                        node.program.reloadStart = now;
                    }
                    
                    if (node.program.reloadStart && now - node.program.reloadStart > SENTRY_MECHANICS.reloadTime) {
                        node.program.ammo = SENTRY_MECHANICS.maxAmmo;
                        node.program.reloadStart = 0;
                    }
                    
                    // Проверяем перегрев
                    if (node.program.overheated && now - node.program.overheatStart > SENTRY_MECHANICS.overheatCooldown) {
                        node.program.overheated = false;
                        node.program.overheatStart = 0;
                    }
                    
                    // Атакуем только если есть патроны и нет перегрева
                    if (node.program.ammo > 0 && !node.program.overheated && (!node.program.cooldown || now > node.program.cooldown)) {
                        let sentryRange = 200 + 20 * (node.program.level - 1);
                        let nearestEnemy = null, minDist = sentryRange;
                        
                        for (const enemy of gameState.enemies) {
                            // Sentry не может стрелять в стелс-врагов
                            if (enemy.type === 'stealth') continue;
                            
                            const enemyNode = gameState.nodes[enemy.currentNodeId];
                            if (!enemyNode) continue;
                            
                            // Проверяем, не защищен ли враг щитом
                            let isProtectedByShield = false;
                            for (const otherEnemy of gameState.enemies) {
                                if (otherEnemy.type === 'shield' && otherEnemy !== enemy) {
                                    const shieldNode = gameState.nodes[otherEnemy.currentNodeId];
                                    if (shieldNode) {
                                        const shieldDist = getDistance(enemyNode.x, enemyNode.y, shieldNode.x, shieldNode.y);
                                        if (shieldDist < otherEnemy.shieldRadius) {
                                            isProtectedByShield = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            if (!isProtectedByShield) {
                                const dist = getDistance(node.x, node.y, enemyNode.x, enemyNode.y);
                                if (dist < minDist) { minDist = dist; nearestEnemy = enemy; }
                            }
                        }
                        
                        if (nearestEnemy) {
                            let baseDmg = 15 * Math.pow(2, node.program.level - 1);
                            let hubBonus = 1 + (gameState.hubLevel - 1) * 0.05;
                            baseDmg *= hubBonus;
                            
                            // Применяем множители урона от событий
                            if (gameState.sentryOverchargeActive) {
                                baseDmg *= 2;
                            }
                            
                            // Применяем броню врага
                            const armorMultiplier = ARMOR_MECHANICS[nearestEnemy.armorType] || 1.0;
                            baseDmg *= armorMultiplier;
                            
                            // Пробитие брони
                            if (nearestEnemy.piercingDamage > 1.0) {
                                baseDmg *= nearestEnemy.piercingDamage;
                            }
                            
                            const enemyNode = gameState.nodes[nearestEnemy.currentNodeId];
                            nearestEnemy.health -= baseDmg;
                            
                            // Визуальные эффекты
                            visualEffects.sentryShots.push({ 
                                from: {x:node.x, y:node.y}, 
                                to: {x:enemyNode.x, y:enemyNode.y}, 
                                time: now, 
                                color: node.program.ammo <= 2 ? '#ff6600' : '#00ff90' // Оранжевый при малых патронах
                            });
                            visualEffects.sentryFlashes.push({ x:enemyNode.x, y:enemyNode.y, time: now });
                            
                            sound.play('sentry_shoot');
                            
                            // Уменьшаем патроны
                            node.program.ammo--;
                            
                            // Проверяем перегрев
                            if (node.program.ammo <= SENTRY_MECHANICS.maxAmmo - SENTRY_MECHANICS.overheatThreshold) {
                                node.program.overheated = true;
                                node.program.overheatStart = now;
                            }
                            
                            // Задержка между выстрелами
                            node.program.cooldown = now + (1000 / node.program.level);
                        }
                    }
                }
            }
        }
    }

    // --- ANTI.EXE логика ---
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.owner === 'player' && node.program && node.program.type === 'anti_exe') {
            // Ищем врагов на этой ноде
            for (const enemy of gameState.enemies) {
                if (enemy.currentNodeId === id && !enemy.isStunnedUntil) {
                    // Задерживаем врага на 3 шага + 1 за каждый уровень hub
                    let delaySteps = 3 + (gameState.hubLevel - 1);
                    enemy.isStunnedUntil = performance.now() + (delaySteps * 1000);
                    
                    // Наносим периодический урон 25 за каждый ход (увеличено с 10)
                    enemy.health -= 25;
                    
                    // Ослабляем броню врагов (уменьшаем сопротивление)
                    if (enemy.armor === undefined) enemy.armor = 1;
                    enemy.armor = Math.max(0.5, enemy.armor * 0.9);
                    
                    // ANTI.EXE исчезает после использования
                    node.program = null;
                    break;
                }
            }
        }
    }

    // --- Miner с соседними Sentry ---
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.owner === 'player' && node.program && node.program.type === 'miner') {
            // Проверяем соседние ноды на наличие sentry
            let sentryNeighbors = 0;
            for (const neighborId of node.neighbors) {
                const neighbor = gameState.nodes[neighborId];
                if (neighbor && neighbor.owner === 'player' && neighbor.program && neighbor.program.type === 'sentry') {
                    sentryNeighbors++;
                }
            }
            
            // Если есть две соседние sentry, miner получает способность sentry на 30%
            if (sentryNeighbors >= 2) {
                // Ищем ближайшего врага в радиусе
                let sentryRange = 200;
                let nearestEnemy = null, minDist = sentryRange;
                
                for (const enemy of gameState.enemies) {
                    const enemyNode = gameState.nodes[enemy.currentNodeId];
                    if (enemyNode) {
                        const dist = getDistance(node.x, node.y, enemyNode.x, enemyNode.y);
                        if (dist < minDist) {
                            minDist = dist;
                            nearestEnemy = enemy;
                        }
                    }
                }
                
                if (nearestEnemy && (!node.program.lastSentryShot || performance.now() - node.program.lastSentryShot > 2000)) {
                    let baseDmg = 10 * Math.pow(2, node.program.level - 1) * 0.3; // 30% от стандартного урона
                    let hubBonus = 1 + (gameState.hubLevel - 1) * 0.05;
                    baseDmg *= hubBonus;
                    
                    const enemyNode = gameState.nodes[nearestEnemy.currentNodeId];
                    nearestEnemy.health -= baseDmg;
                    
                    // Визуальный эффект для miner-sentry
                    visualEffects.sentryShots.push({ 
                        from: {x:node.x, y:node.y}, 
                        to: {x:enemyNode.x, y:enemyNode.y}, 
                        time: performance.now(),
                        color: '#ffd600' // Желтый цвет для miner-sentry
                    });
                    
                    node.program.lastSentryShot = performance.now();
                }
            }
        }
    }

    // --- Ресурсы (раз в секунду) ---
    gameState.lastMinerTick += dt;
    if (gameState.lastMinerTick > 1) {
        let dpIncome = 0, cpuIncome = 0;
        // Hub пассивно генерирует CPU: 2 + 2 за каждый уровень
        if(gameState.nodes['hub'] && gameState.nodes['hub'].owner === 'player') {
            dpIncome += 2; // Базовый доход от HUB
            cpuIncome += 2 + (gameState.hubLevel - 1) * 2; // Пассивная генерация CPU
        }
        for (const id in gameState.nodes) {
            const node = gameState.nodes[id];
            if (node.owner === 'player' && node.program) {
                const level = node.program.level;
                if (node.program.type === 'miner') {
                    // Бонус от hub level: +5% за каждый уровень
                    let baseIncome = 3 * Math.pow(1.8, level - 1);
                    let hubBonus = 1 + (gameState.hubLevel - 1) * 0.05;
                    
                    // Налог на высокие уровни miner'ов (уровень 4+)
                    let taxMultiplier = 1.0;
                    if (level >= 4) {
                        taxMultiplier = 0.9; // -10% за уровень 4+
                        if (level >= 6) {
                            taxMultiplier = 0.8; // -20% за уровень 6+
                        }
                    }
                    
                    // Применяем эффекты событий
                    if (gameState.minerTaxActive) {
                        taxMultiplier *= 0.5; // Налог на майнеры
                    }
                    if (gameState.playerBoostActive) {
                        taxMultiplier *= 1.5; // Бонус игрока
                    }
                    
                    dpIncome += baseIncome * hubBonus * taxMultiplier;
                }
                if (node.program.type === 'overclocker') cpuIncome += 1 * level;
            }
        }
        gameState.dp += Math.floor(dpIncome);
        gameState.cpu += Math.floor(cpuIncome);
        gameState.lastMinerTick = 0;
    }
    
    // --- Система волн врагов ---
    if (!gameState.isWaveBreak) {
        gameState.waveTimer += dt;
        
        // Спавн врагов для текущей волны
        if (gameState.waveEnemiesSpawned < gameState.waveEnemiesTotal) {
            gameState.lastEnemySpawn += dt;
            const spawnInterval = gameState.hubCaptureActive ? 1 : Math.max(0.8, (5 - (gameState.currentWave * 0.1)));
            
            if (gameState.lastEnemySpawn > spawnInterval) {
                if (spawnEnemyForWave(gameState.currentWave)) {
                    gameState.lastEnemySpawn = 0;
                }
            }
        } else if (gameState.enemies.length === 0) {
            // Волна завершена
            endWave();
        }
    } else {
        // Перерыв между волнами
        gameState.waveBreakTimer -= dt;
        if (gameState.waveBreakTimer <= 0) {
            gameState.isWaveBreak = false;
            startWave(gameState.currentWave + 1);
        }
    }
    
    // --- Система случайных событий ---
    updateRandomEvents(now);
    
    // --- Обновление поведения врагов ---
    updateEnemyBehaviors(dt, now);
    
    // Применение адаптивной сложности к новым врагам
    for (const enemy of gameState.enemies) {
        if (!enemy.adaptiveApplied) {
            applyAdaptiveDifficulty(enemy);
            enemy.adaptiveApplied = true;
        }
    }

    // Логика врагов (движение, атака)
    if (gameState.enemies) {
        for (const enemy of gameState.enemies) {
            if (!enemy) continue;
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
                if (node.program?.type !== 'sentry') {
                    node.captureProgress -= 0.3 * dt;
                    if (node.captureProgress <= 0) {
                        node.owner = 'neutral'; node.program = null; node.captureProgress = 0;
                        if(gameState.selectedNodeId === node.id) gameState.selectedNodeId = null;
                        triggerScreenShake(7, 250); sound.play('node_lost');
                    }
                }
            }
        }
    }
    
    // --- Очистка и таймеры ---
    if (gameState.enemies) {
        const killedEnemies = gameState.enemies.filter(e => e && e.health <= 0);
        if(killedEnemies.length > 0) {
            // Система комбо
            addComboKill();
            
            // Убийство врагов замедляет trace level на 5% и уменьшает текущий trace level на 50
            if (!godMode) {
                gameState.traceLevel = Math.max(0, gameState.traceLevel - 50);
                // Замедляем рост trace level на 5%
                gameState.traceLevel *= 0.95;
            }
            
            // Базовый бонус за убийство
            const baseReward = 8;
            const totalReward = baseReward * killedEnemies.length;
            gameState.dp += totalReward;
            gameStats.enemiesKilled += killedEnemies.length;
            gameStats.totalDamageDealt += totalReward;
            
            // Специальные эффекты для разных типов врагов
            for(const enemy of killedEnemies) {
                if (enemy && gameState.nodes[enemy.currentNodeId]) {
                    const node = gameState.nodes[enemy.currentNodeId];
                    if (node) {
                        visualEffects.enemyExplosions.push({x:node.x, y:node.y, time: now});
                        
                        // Бомбардировщик взрывается при смерти
                        if (enemy.type === 'bomber') {
                            const nearbyNodes = Object.values(gameState.nodes).filter(n => 
                                getDistance(n.x, n.y, node.x, node.y) < 100
                            );
                            for (const nearby of nearbyNodes) {
                                if (nearby.owner === 'player' && nearby.program) {
                                    nearby.program = null;
                                    addGameLog('💥 Бомбардировщик взорвался!', 'warning');
                                }
                            }
                        }
                    }
                }
            }
            
            triggerScreenShake(5, 150); 
            sound.play('enemy_explode');
            
            // Проверяем расширенные достижения
            checkExtendedAchievements();
        }
        gameState.enemies = gameState.enemies.filter(e => e && e.health > 0);
    }
    
    if (gameState.empCooldown > 0) gameState.empCooldown -= dt * 1000;
    if (screenShake.duration > 0) screenShake.duration -= dt * 1000;
    for (const id in gameState.nodes) {
        const node = gameState.nodes[id];
        if (node.isTargeted && now > node.targetedUntil) node.isTargeted = false;
    }
}

// В начало mainLoop
function mainLoop() {
    if (!canvas || !ctx) {
        requestAnimationFrame(mainLoop);
        return;
    }
    if (!gameState) {
        requestAnimationFrame(mainLoop);
        return;
    }
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
    if (!gameState) return;
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
    gameState.hubLevel = 1;
    
    // Инициализация системы адаптивной сложности
    gameState.adaptiveDifficulty = {
        playerPerformance: 0,
        difficultyMultiplier: 1.0,
        lastAdjustment: 0,
        adjustmentInterval: 30000,
        performanceHistory: [],
        maxHistorySize: 10,
        targetPerformance: 70
    };
    
    // Инициализация системы анализа угроз
    gameState.threatAnalysis = {
        lastAnalysis: 0,
        analysisInterval: 5000,
        threatMap: {},
        bypassRoutes: {}
    };
    
    // Инициализация системы подсказок
    HINT_SYSTEM.currentHint = 0;
    HINT_SYSTEM.hintType = 'newPlayer';
    HINT_SYSTEM.lastHintChange = performance.now();
    
    // Инициализация системы волн и событий
    gameState.currentWave = 1;
    gameState.waveEnemiesSpawned = 0;
    gameState.waveEnemiesTotal = 5;
    gameState.waveTimer = 0;
    gameState.waveBreakTimer = 0;
    gameState.isWaveBreak = false;
    gameState.waveBreakDuration = 10;
    gameState.randomEvents = [];
    gameState.activeEvents = [];
    gameState.lastEventCheck = 0;
    gameState.eventCheckInterval = 30;
    gameState.achievementPoints = 0;
    gameState.comboKills = 0;
    gameState.lastKillTime = 0;
    gameState.comboTimeout = 3000;
    
    lastTimestamp = performance.now();
    uiButtons = {};
    visualEffects = { 
        sentryShots: [], 
        sentryFlashes: [], 
        enemyExplosions: [], 
        teleportEffects: [], 
        tankRamEffects: [], 
        comboEffects: [],
        achievementEffects: [],
        hubUpgradeEffects: [],
        taxEffects: [],
        waveEffects: [],
        eventEffects: []
    };
    
    // Сброс статистики и логов
    gameStats = {
        enemiesKilled: 0,
        nodesCaptured: 0,
        startTime: Date.now(),
        wavesCompleted: 0,
        maxCombo: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        achievements: {
            masterMiner: false,
            networkDefender: false,
            enemyHunter: false,
            hubMaster: false,
            antiExeMaster: false,
            longSurvivor: false,
            waveMaster: false,
            comboMaster: false,
            eventSurvivor: false,
            perfectWave: false
        }
    };
    gameLogs = [];
    addGameLog('Новая игра начата', 'success');
    
    // Запускаем первую волну
    startWave(1);
}

// --- SOUND SYSTEM ---
const sound = {
    play: function(name) {
        if (name === 'upgrade') {
            if (!this.upgradeAudio) {
                this.upgradeAudio = new Audio('assets/soundfx/upgrade.wav');
                this.upgradeAudio.volume = 0.7;
            }
            const audio = this.upgradeAudio.cloneNode();
            audio.play();
        } else if (name === 'sentry_shoot') {
            if (!this.laserAudio) {
                this.laserAudio = new Audio('assets/soundfx/laser.wav');
                this.laserAudio.volume = 0.6;
            }
            const audio = this.laserAudio.cloneNode();
            audio.play();
        } else {
            console.log('[SOUND]', name);
        }
    }
};

// --- MUSIC SYSTEM ---
let musicEnabled = false;
let currentMusicIndex = 0;
let bgMusic1, bgMusic2, musicToggle;

function initAudio() {
    bgMusic1 = document.getElementById('bgMusic1');
    bgMusic2 = document.getElementById('bgMusic2');
    musicToggle = document.getElementById('musicToggle');
}

// Функция для получения текущего активного аудио элемента
function getCurrentMusic() {
    if (!bgMusic1 || !bgMusic2) return null;
    return currentMusicIndex === 0 ? bgMusic1 : bgMusic2;
}

// Функция для получения следующего аудио элемента
function getNextMusic() {
    if (!bgMusic1 || !bgMusic2) return null;
    return currentMusicIndex === 0 ? bgMusic2 : bgMusic1;
}

// Функция для плавного переключения между аудио элементами
function switchMusic() {
    const currentMusic = getCurrentMusic();
    const nextMusic = getNextMusic();
    
    if (!currentMusic || !nextMusic) return;
    
    // Проверяем, что аудио загружено и воспроизводится
    if (!currentMusic.duration || currentMusic.paused) return;
    
    // Если текущий трек скоро закончится (осталось меньше 0.5 секунды)
    if (currentMusic.currentTime > currentMusic.duration - 0.5) {
        // Подготавливаем следующий трек
        nextMusic.currentTime = 0;
        
        // Запускаем следующий трек с небольшой задержкой
        setTimeout(() => {
            nextMusic.play().catch(e => console.log('Ошибка переключения музыки'));
            
            // Останавливаем текущий трек
            currentMusic.pause();
            currentMusic.currentTime = 0;
            
            // Переключаем индекс
            currentMusicIndex = currentMusicIndex === 0 ? 1 : 0;
        }, 50);
    }
}

function toggleMusic() {
    if (!bgMusic1 || !bgMusic2 || !musicToggle) return;
    
    if (musicEnabled) {
        bgMusic1.pause();
        bgMusic2.pause();
        musicToggle.textContent = '🎵 ВКЛ';
        musicEnabled = false;
    } else {
        const currentMusic = getCurrentMusic();
        if (currentMusic) {
            currentMusic.play().catch(e => console.log('Автовоспроизведение заблокировано'));
            musicToggle.textContent = '🔇 ВЫКЛ';
            musicEnabled = true;
        }
    }
}

// Инициализация управления музыкой
function initMusicControls() {
    if (musicToggle) {
        musicToggle.addEventListener('click', toggleMusic);
    }
}

// Предзагрузка аудио для лучшего качества
function preloadAudio() {
    if (!bgMusic1 || !bgMusic2) return;
    bgMusic1.load();
    bgMusic2.load();
    
    // Устанавливаем громкость
    bgMusic1.volume = 0.7;
    bgMusic2.volume = 0.7;
}

// В начало DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    if (canvas) {
        resizeCanvas();
        // Навешиваем обработчики событий только после инициализации canvas
        canvas.addEventListener('mousemove', function(e) {
            if (!canvas) return;
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
            if (!canvas || !gameState) return;
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
                            let baseCost = node.program.type === 'miner' ? 13 : node.program.type === 'anti_exe' ? 20 : 27; // Уменьшено в 1.5 раза
                            // Прогрессивная стоимость: множитель увеличивается с уровнем
                            let levelMultiplier = node.program.level <= 3 ? node.program.level : 
                                                node.program.level <= 5 ? node.program.level * 1.5 : 
                                                node.program.level * 2; // Для уровня 6+ двойная стоимость
                            let cost = baseCost * levelMultiplier;
                            let cpuCost = 5 * node.program.level;
                            // За один уровень hub можно апгрейдить два раза, но максимальный уровень 6
                            if (gameState.dp >= cost && gameState.cpu >= cpuCost && node.program.level < Math.min(6, gameState.hubLevel * 2)) {
                                gameState.dp -= cost;
                                gameState.cpu -= cpuCost;
                                node.program.level++;
                                sound.play('upgrade');
                                addGameLog(`Апгрейд ${node.program.type} до уровня ${node.program.level}`, 'success');
                                gameState.selectedNodeId = null;
                                return;
                            }
                        }
                    }
                    if (key === 'upgrade_hub' && gameState.selectedNodeId) {
                        const node = gameState.nodes[gameState.selectedNodeId];
                        if (node && node.type === 'hub') {
                            // --- Стоимость апгрейда HUB: увеличенная ---
                            let cost = 50 * gameState.hubLevel; // Увеличено с 35 до 50
                            if (gameState.cpu >= cost) {
                                gameState.cpu -= cost;
                                gameState.hubLevel++;
                                sound.play('upgrade');
                                addGameLog(`Hub апгрейден до уровня ${gameState.hubLevel}`, 'success');
                                gameState.selectedNodeId = null;
                                return;
                            }
                        }
                    }
                    if ((key === 'miner' || key === 'anti_exe' || key === 'sentry') && gameState.selectedNodeId) {
                        const node = gameState.nodes[gameState.selectedNodeId];
                        if (node && !node.program && node.owner === 'player') {
                            let cost = key === 'miner' ? 13 : key === 'anti_exe' ? 20 : 27; // Уменьшено в 1.5 раза
                            if (gameState.dp >= cost) {
                                gameState.dp -= cost;
                                node.program = { type: key, level: 1 };
                                addGameLog(`Построен ${key} на ноде ${node.id}`, 'success');
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
                            addGameLog('Построен Overclocker', 'success');
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
                            addGameLog(`Начат захват ноды ${id}`, 'info');
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
    }
    initAudio();
    initMusicControls();
    preloadAudio();
    // Запускаем игровой цикл только после инициализации
    mainLoop();
});

// Проверяем состояние музыки каждые 100мс для плавного переключения
setInterval(() => {
    if (musicEnabled) {
        switchMusic();
    }
}, 100);

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

function findPathBFS(nodesObj, startId, endId) {
    if (!nodesObj[startId] || !nodesObj[endId]) return [startId];
    const queue = [[startId]];
    const visited = new Set();
    visited.add(startId);
    
    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];
        
        if (current === endId) return path;
        
        const node = nodesObj[current];
        if (!node) continue;
        
        for (const neighborId of node.neighbors) {
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                const newPath = [...path, neighborId];
                queue.push(newPath);
            }
        }
    }
    
    return [startId];
}

// --- Система волн врагов ---
function startWave(waveNumber) {
    const config = WAVE_CONFIG[waveNumber] || WAVE_CONFIG[10]; // Используем конфиг 10-й волны для более высоких
    gameState.currentWave = waveNumber;
    gameState.waveEnemiesSpawned = 0;
    gameState.waveEnemiesTotal = config.enemies;
    gameState.waveTimer = 0;
    gameState.isWaveBreak = false;
    
    // Применяем множитель сложности
    const difficultyMultiplier = config.difficulty;
    
    addGameLog(`🌊 Волна ${waveNumber} началась! (${config.enemies} врагов)`, 'info');
    visualEffects.waveEffects.push({
        type: 'wave_start',
        wave: waveNumber,
        time: performance.now(),
        duration: 3
    });
    
    // Увеличиваем сложность врагов
    gameState.enemyDifficultyMultiplier = difficultyMultiplier;
}

function endWave() {
    gameState.wavesCompleted++;
    gameState.isWaveBreak = true;
    gameState.waveBreakTimer = gameState.waveBreakDuration;
    
    // Проверяем достижение "Волна без потерь"
    const playerNodesAtStart = Object.values(gameState.nodes).filter(n => n.owner === 'player').length;
    const playerNodesAtEnd = Object.values(gameState.nodes).filter(n => n.owner === 'player').length;
    
    if (playerNodesAtEnd >= playerNodesAtStart) {
        gameStats.achievements.perfectWave = true;
        createAchievementEffect('🎯 Идеальная волна!');
        gameState.achievementPoints += 50;
    }
    
    addGameLog(`✅ Волна ${gameState.currentWave} завершена!`, 'success');
    visualEffects.waveEffects.push({
        type: 'wave_end',
        wave: gameState.currentWave,
        time: performance.now(),
        duration: 5
    });
    
    // Бонус за завершение волны
    gameState.dp += 50 + gameState.currentWave * 10;
    gameState.cpu += 20 + gameState.currentWave * 5;
    
    // Проверяем достижение "Мастер волн"
    if (gameState.wavesCompleted >= 10) {
        gameStats.achievements.waveMaster = true;
        createAchievementEffect('🏆 Мастер волн!');
        gameState.achievementPoints += 100;
    }
}

function spawnEnemyForWave(waveNumber) {
    const config = WAVE_CONFIG[waveNumber] || WAVE_CONFIG[10];
    const availableTypes = config.types;
    const enemyType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    
    // Находим подходящую ноду для спавна
    const spawnableNodes = Object.values(gameState.nodes).filter(n => 
        n.owner !== 'player' && 
        n.type !== 'hub' && 
        !gameState.enemies.some(e => e.currentNodeId === n.id)
    );
    
    if (spawnableNodes.length === 0) return false;
    
    const startNode = spawnableNodes[Math.floor(Math.random() * spawnableNodes.length)];
    
    // Определяем цель на основе приоритетов врага
    let targetNode = null;
    const behavior = ENEMY_BEHAVIORS[enemyType];
    if (behavior && behavior.targetPriority) {
        for (const priority of behavior.targetPriority) {
            if (priority === 'enemy_healing') {
                // Лекарь ищет раненых врагов
                const woundedEnemies = gameState.enemies.filter(e => e.health < e.maxHealth * 0.5);
                if (woundedEnemies.length > 0) {
                    const woundedEnemy = woundedEnemies[0];
                    targetNode = gameState.nodes[woundedEnemy.currentNodeId];
                }
                break;
            } else {
                const targets = Object.values(gameState.nodes).filter(n => 
                    n.owner === 'player' && 
                    (priority === 'miner' ? n.program?.type === 'miner' :
                     priority === 'sentry' ? n.program?.type === 'sentry' :
                     priority === 'overclocker' ? n.program?.type === 'overclocker' :
                     priority === 'hub' ? n.type === 'hub' : true)
                );
                if (targets.length > 0) {
                    targetNode = targets[Math.floor(Math.random() * targets.length)];
                    break;
                }
            }
        }
    }
    
    // Если цель не найдена, выбираем случайную ноду игрока
    if (!targetNode) {
        const playerNodes = Object.values(gameState.nodes).filter(n => n.owner === 'player');
        if (playerNodes.length > 0) {
            targetNode = playerNodes[Math.floor(Math.random() * playerNodes.length)];
        }
    }
    
    let path = [startNode.id];
    if (targetNode) {
        path = findPathBFS(gameState.nodes, startNode.id, targetNode.id);
    }
    
    const enemy = new Enemy('e' + gameState.enemyIdCounter++, startNode.id, path, enemyType);
    
    // Применяем множитель сложности
    if (gameState.enemyDifficultyMultiplier) {
        enemy.health *= gameState.enemyDifficultyMultiplier;
        enemy.speed *= gameState.enemyDifficultyMultiplier;
    }
    
    gameState.enemies.push(enemy);
    gameState.waveEnemiesSpawned++;
    
    // Логируем появление врага
    const enemyName = behavior ? behavior.name : `Враг (${enemyType})`;
    addGameLog(`Появился ${enemyName}`, 'warning');
    
    return true;
}

// --- Система случайных событий ---
function triggerRandomEvent() {
    if (gameState.activeEvents.length >= 2) return; // Максимум 2 активных события
    
    const availableEvents = RANDOM_EVENTS.filter(event => 
        !gameState.activeEvents.some(active => active.id === event.id)
    );
    
    if (availableEvents.length === 0) return;
    
    const event = availableEvents[Math.floor(Math.random() * availableEvents.length)];
    event.effect(gameState);
    
    gameState.activeEvents.push({
        id: event.id,
        name: event.name,
        endTime: performance.now() + event.duration * 1000,
        duration: event.duration
    });
    
    addGameLog(`🎲 Событие: ${event.name}`, 'event');
}

function updateRandomEvents(now) {
    // Проверяем завершение событий
    gameState.activeEvents = gameState.activeEvents.filter(event => {
        if (now > event.endTime) {
            // Событие завершилось
            addGameLog(`⏰ Событие "${event.name}" завершено`, 'info');
            return false;
        }
        return true;
    });
    
    // Проверяем новые события
    if (now - gameState.lastEventCheck > gameState.eventCheckInterval * 1000) {
        if (Math.random() < 0.3) { // 30% шанс события
            triggerRandomEvent();
        }
        gameState.lastEventCheck = now;
    }
}

// --- Система комбо ---
function addComboKill() {
    const now = performance.now();
    
    if (now - gameState.lastKillTime < gameState.comboTimeout) {
        gameState.comboKills++;
        gameState.lastKillTime = now;
        
        // Бонус за комбо
        const comboBonus = gameState.comboKills * 5;
        gameState.dp += comboBonus;
        gameState.achievementPoints += comboBonus;
        
        // Визуальный эффект комбо
        visualEffects.comboEffects.push({
            combo: gameState.comboKills,
            time: now,
            duration: 2
        });
        
        // Проверяем достижение комбо
        if (gameState.comboKills >= 10) {
            gameStats.achievements.comboMaster = true;
            createAchievementEffect('🔥 Комбо мастер!');
            gameState.achievementPoints += 200;
        }
        
        addGameLog(`🔥 Комбо x${gameState.comboKills}! (+${comboBonus} DP)`, 'combo');
    } else {
        gameState.comboKills = 1;
        gameState.lastKillTime = now;
    }
    
    // Обновляем максимальное комбо
    gameStats.maxCombo = Math.max(gameStats.maxCombo, gameState.comboKills);
}

// --- Расширенная система достижений ---
function checkExtendedAchievements() {
    // Проверяем события
    if (gameState.activeEvents.length >= 5) {
        gameStats.achievements.eventSurvivor = true;
        createAchievementEffect('🎲 Выживший событий!');
        gameState.achievementPoints += 150;
    }
    
    // Проверяем время выживания
    const gameTime = (Date.now() - gameStats.startTime) / 1000;
    if (gameTime >= 1200 && !gameStats.achievements.longSurvivor) { // 20 минут
        gameStats.achievements.longSurvivor = true;
        createAchievementEffect('⏰ Долгожитель!');
        gameState.achievementPoints += 300;
    }
    
    // Проверяем урон
    if (gameStats.totalDamageDealt >= 10000 && !gameStats.achievements.enemyHunter) {
        gameStats.achievements.enemyHunter = true;
        createAchievementEffect('💀 Охотник!');
        gameState.achievementPoints += 100;
    }
}

// Функция анализа угроз для AI врагов
function analyzeThreatLevel(enemy, targetNodeId) {
    if (!gameState || !gameState.nodes || !targetNodeId) return 0;
    
    const targetNode = gameState.nodes[targetNodeId];
    if (!targetNode) return 0;
    
    let threatLevel = 0;
    const weights = THREAT_ANALYSIS.weights;
    const radius = THREAT_ANALYSIS.analysisRadius;
    
    // Анализируем все ноды в радиусе
    for (const nodeId in gameState.nodes) {
        const node = gameState.nodes[nodeId];
        if (!node) continue;
        
        const dist = getDistance(targetNode.x, targetNode.y, node.x, node.y);
        if (dist > radius) continue;
        
        // Угроза от Sentry
        if (node.owner === 'player' && node.program && node.program.type === 'sentry') {
            const sentryLevel = node.program.level || 1;
            const sentryThreat = weights.sentry * sentryLevel * (1 - dist / radius);
            threatLevel += sentryThreat;
        }
        
        // Угроза от ANTI.EXE
        if (node.owner === 'player' && node.program && node.program.type === 'anti_exe') {
            const antiExeThreat = weights.anti_exe * (1 - dist / radius);
            threatLevel += antiExeThreat;
        }
        
        // Угроза от уровня Hub
        if (node.id === 'hub' && node.owner === 'player') {
            const hubThreat = weights.hub_level * gameState.hubLevel * (1 - dist / radius);
            threatLevel += hubThreat;
        }
    }
    
    // Поддержка от других врагов
    for (const otherEnemy of gameState.enemies) {
        if (otherEnemy === enemy || otherEnemy.health <= 0) continue;
        
        const enemyNode = gameState.nodes[otherEnemy.currentNodeId];
        if (!enemyNode) continue;
        
        const dist = getDistance(targetNode.x, targetNode.y, enemyNode.x, enemyNode.y);
        if (dist < ENEMY_COORDINATION.coordinationRadius) {
            const supportBonus = weights.nearby_enemies * (1 - dist / ENEMY_COORDINATION.coordinationRadius);
            threatLevel -= supportBonus; // Уменьшаем угрозу благодаря поддержке
        }
    }
    
    // Применяем модификаторы для разных типов врагов
    const behavior = ENEMY_BEHAVIORS[enemy.type];
    const bypassMultiplier = THREAT_ANALYSIS.bypassMultipliers[enemy.type] || THREAT_ANALYSIS.bypassMultipliers.default;
    
    return threatLevel * bypassMultiplier;
}

// Функция поиска альтернативного пути
function findAlternativePath(enemy, currentPath) {
    if (!gameState || !gameState.nodes) return currentPath;
    
    const startNodeId = enemy.currentNodeId;
    const targetNodeId = currentPath[currentPath.length - 1];
    
    // Находим все возможные пути к цели
    const allPaths = [];
    const visited = new Set();
    
    function dfs(currentId, path, maxDepth = 8) {
        if (path.length > maxDepth) return;
        if (currentId === targetNodeId) {
            allPaths.push([...path]);
            return;
        }
        
        const currentNode = gameState.nodes[currentId];
        if (!currentNode) return;
        
        for (const neighborId of currentNode.neighbors) {
            if (visited.has(neighborId)) continue;
            
            visited.add(neighborId);
            path.push(neighborId);
            dfs(neighborId, path, maxDepth);
            path.pop();
            visited.delete(neighborId);
        }
    }
    
    dfs(startNodeId, [startNodeId]);
    
    // Оцениваем каждый путь по уровню угроз
    let bestPath = currentPath;
    let bestThreatLevel = Infinity;
    
    for (const path of allPaths) {
        let totalThreat = 0;
        for (const nodeId of path) {
            totalThreat += analyzeThreatLevel(enemy, nodeId);
        }
        
        if (totalThreat < bestThreatLevel) {
            bestThreatLevel = totalThreat;
            bestPath = path;
        }
    }
    
    return bestPath;
}

// Функция координации между врагами
function coordinateEnemies(enemy, dt, now) {
    if (!gameState || !gameState.enemies) return;
    
    const behavior = ENEMY_BEHAVIORS[enemy.type];
    if (!behavior || !behavior.coordinationType) return;
    
    const coordinationType = ENEMY_COORDINATION.types[behavior.coordinationType];
    if (!coordinationType) return;
    
    const enemyNode = gameState.nodes[enemy.currentNodeId];
    if (!enemyNode) return;
    
    const radius = coordinationType.radius;
    
    switch (coordinationType.effect) {
        case 'boost_allies':
            // Командир усиливает союзников
            for (const otherEnemy of gameState.enemies) {
                if (otherEnemy === enemy || otherEnemy.health <= 0) continue;
                
                const otherNode = gameState.nodes[otherEnemy.currentNodeId];
                if (!otherNode) continue;
                
                const dist = getDistance(enemyNode.x, enemyNode.y, otherNode.x, otherNode.y);
                if (dist < radius) {
                    otherEnemy.damageMultiplier = Math.max(otherEnemy.damageMultiplier || 1, 1.3);
                    otherEnemy.speed = Math.min(otherEnemy.speed * 1.1, 3.0); // Увеличиваем скорость
                }
            }
            break;
            
        case 'heal_allies':
            // Лекарь лечит союзников
            if (enemy.lastHealTime + enemy.healCooldown < now) {
                for (const otherEnemy of gameState.enemies) {
                    if (otherEnemy === enemy || otherEnemy.health <= 0) continue;
                    
                    const otherNode = gameState.nodes[otherEnemy.currentNodeId];
                    if (!otherNode) continue;
                    
                    const dist = getDistance(enemyNode.x, enemyNode.y, otherNode.x, otherNode.y);
                    if (dist < radius && otherEnemy.health < otherEnemy.maxHealth) {
                        otherEnemy.health = Math.min(otherEnemy.maxHealth, otherEnemy.health + 25);
                        enemy.lastHealTime = now;
                        
                        // Визуальный эффект исцеления
                        visualEffects.healEffects = visualEffects.healEffects || [];
                        visualEffects.healEffects.push({
                            x: otherNode.x,
                            y: otherNode.y,
                            time: now,
                            duration: 1000
                        });
                        break;
                    }
                }
            }
            break;
            
        case 'protect_allies':
            // Танк защищает союзников
            for (const otherEnemy of gameState.enemies) {
                if (otherEnemy === enemy || otherEnemy.health <= 0) continue;
                
                const otherNode = gameState.nodes[otherEnemy.currentNodeId];
                if (!otherNode) continue;
                
                const dist = getDistance(enemyNode.x, enemyNode.y, otherNode.x, otherNode.y);
                if (dist < radius) {
                    // Уменьшаем урон, получаемый союзниками
                    otherEnemy.armor = Math.max(otherEnemy.armor || 1, 1.2);
                }
            }
            break;
            
        case 'reveal_threats':
            // Разведчик обнаруживает угрозы
            for (const nodeId in gameState.nodes) {
                const node = gameState.nodes[nodeId];
                if (!node || node.owner !== 'player') continue;
                
                const dist = getDistance(enemyNode.x, enemyNode.y, node.x, node.y);
                if (dist < radius) {
                    // Помечаем ноду как обнаруженную для других врагов
                    node.revealedByScout = true;
                    node.revealTime = now + 5000; // 5 секунд видимости
                }
            }
            break;
            
        case 'group_attack':
            // Рой атакует группой
            let nearbyAllies = 0;
            for (const otherEnemy of gameState.enemies) {
                if (otherEnemy === enemy || otherEnemy.health <= 0) continue;
                
                const otherNode = gameState.nodes[otherEnemy.currentNodeId];
                if (!otherNode) continue;
                
                const dist = getDistance(enemyNode.x, enemyNode.y, otherNode.x, otherNode.y);
                if (dist < radius) {
                    nearbyAllies++;
                }
            }
            
            // Бонус к урону за каждого союзника
            if (nearbyAllies > 0) {
                enemy.damageMultiplier = Math.max(enemy.damageMultiplier || 1, 1 + nearbyAllies * 0.2);
            }
            break;
            
        case 'suicide_attack':
            // Бомбардировщик готовится к самоубийственной атаке
            const targetNode = gameState.nodes[enemy.path[enemy.path.length - 1]];
            if (targetNode && targetNode.owner === 'player') {
                const dist = getDistance(enemyNode.x, enemyNode.y, targetNode.x, targetNode.y);
                if (dist < 100) { // Близко к цели
                    enemy.suicideMode = true;
                    enemy.speed *= 1.5; // Ускоряется для самоубийственной атаки
                }
            }
            break;
    }
}

// --- Функции для новых типов врагов ---
function updateEnemyBehaviors(dt, now) {
    if (!gameState || !gameState.enemies) return;
    
    for (const enemy of gameState.enemies) {
        if (!enemy || enemy.health <= 0) continue;
        
        // Координация с другими врагами
        coordinateEnemies(enemy, dt, now);
        
        // Анализ угроз и поиск альтернативных путей
        if (enemy.path && enemy.path.length > 0) {
            const nextNodeId = enemy.path[enemy.pathStep + 1];
            if (nextNodeId) {
                const threatLevel = analyzeThreatLevel(enemy, nextNodeId);
                
                // Если угроза слишком высока, ищем альтернативный путь
                if (threatLevel > THREAT_ANALYSIS.bypassThreshold) {
                    const alternativePath = findAlternativePath(enemy, enemy.path);
                    if (alternativePath && alternativePath.length > 0) {
                        enemy.path = alternativePath;
                        enemy.pathStep = 0;
                        addGameLog(`🔄 ${enemy.name || 'Враг'} обходит угрозу`, 'info');
                    }
                }
            }
        }
        
        // Обновление специальных способностей (существующая логика)
        if (enemy.type === 'healer' && enemy.lastHealTime + enemy.healCooldown < now) {
            // Лекарь лечит ближайших союзников
            for (const otherEnemy of gameState.enemies) {
                if (otherEnemy !== enemy && otherEnemy.health < otherEnemy.maxHealth) {
                    const dist = getDistance(
                        gameState.nodes[enemy.currentNodeId]?.x || 0,
                        gameState.nodes[enemy.currentNodeId]?.y || 0,
                        gameState.nodes[otherEnemy.currentNodeId]?.x || 0,
                        gameState.nodes[otherEnemy.currentNodeId]?.y || 0
                    );
                    if (dist < enemy.boostRadius) {
                        otherEnemy.health = Math.min(otherEnemy.maxHealth, otherEnemy.health + 20);
                        enemy.lastHealTime = now;
                        break;
                    }
                }
            }
        }
        
        if (enemy.type === 'commander') {
            // Командир усиливает союзников
            for (const otherEnemy of gameState.enemies) {
                if (otherEnemy !== enemy) {
                    const dist = getDistance(
                        gameState.nodes[enemy.currentNodeId]?.x || 0,
                        gameState.nodes[enemy.currentNodeId]?.y || 0,
                        gameState.nodes[otherEnemy.currentNodeId]?.x || 0,
                        gameState.nodes[otherEnemy.currentNodeId]?.y || 0
                    );
                    if (dist < enemy.boostRadius) {
                        otherEnemy.damageMultiplier = Math.max(otherEnemy.damageMultiplier || 1, 1.3);
                    }
                }
            }
        }
        
        // Саботажник отключает программы
        if (enemy.type === 'saboteur') {
            const currentNode = gameState.nodes[enemy.currentNodeId];
            if (currentNode && currentNode.owner === 'player' && currentNode.program) {
                currentNode.program = null;
                addGameLog('🛠️ Саботажник отключил программу!', 'warning');
            }
        }
        
        // ЭМИ отключает Sentry
        if (enemy.type === 'emp') {
            const currentNode = gameState.nodes[enemy.currentNodeId];
            if (currentNode && currentNode.owner === 'player' && currentNode.program && currentNode.program.type === 'sentry') {
                currentNode.program.empDisabled = performance.now() + 10000; // 10 секунд отключения
                addGameLog('⚡ ЭМИ отключил Sentry!', 'warning');
            }
        }
        
        // Рой атакует несколькими единицами
        if (enemy.type === 'swarm' && enemy.swarmCount > 1) {
            // Создаем дополнительные единицы роя
            for (let i = 1; i < enemy.swarmCount; i++) {
                const swarmEnemy = new Enemy('swarm_' + enemy.id + '_' + i, enemy.currentNodeId, enemy.path, 'swarm');
                swarmEnemy.health = 20; // Меньше здоровья у единиц роя
                swarmEnemy.maxHealth = 20;
                gameState.enemies.push(swarmEnemy);
            }
            enemy.swarmCount = 1; // Предотвращаем бесконечное создание
        }
    }
}

// Система перезарядки и перегрева для Sentry
const SENTRY_MECHANICS = {
    maxAmmo: 10,           // Максимум патронов
    reloadTime: 3000,       // Время перезарядки (3 сек)
    overheatThreshold: 8,   // Порог перегрева
    overheatCooldown: 5000, // Время остывания (5 сек)
    burstFire: 3,           // Выстрелов за раз
    burstDelay: 200         // Задержка между выстрелами в очереди
};

// Система брони и пробития
const ARMOR_MECHANICS = {
    lightArmor: 0.8,        // Легкая броня (-20% урон)
    mediumArmor: 0.6,       // Средняя броня (-40% урон)
    heavyArmor: 0.4,        // Тяжелая броня (-60% урон)
    piercingBonus: 1.5      // Бонус пробития для специальных врагов
};

// Система адаптивной сложности
function calculatePlayerPerformance() {
    if (!gameState || !gameStats) return 0;
    
    let performance = 0;
    
    // Факторы производительности
    const factors = {
        nodesCaptured: Math.min(gameStats.nodesCaptured / 10, 1) * 20,      // 20% за захват нод
        enemiesKilled: Math.min(gameStats.enemiesKilled / 50, 1) * 25,      // 25% за убийства
        survivalTime: Math.min(gameState.game_time / 600, 1) * 15,           // 15% за время выживания
        resourceEfficiency: Math.min(gameState.dp / 1000, 1) * 20,           // 20% за эффективность ресурсов
        waveProgress: Math.min(gameState.currentWave / 10, 1) * 20           // 20% за прогресс волн
    };
    
    performance = Object.values(factors).reduce((sum, factor) => sum + factor, 0);
    
    return Math.min(Math.max(performance, 0), 100);
}

function updateAdaptiveDifficulty(now) {
    if (!gameState.adaptiveDifficulty) return;
    
    const adaptive = gameState.adaptiveDifficulty;
    
    // Обновляем производительность игрока
    adaptive.playerPerformance = calculatePlayerPerformance();
    
    // Добавляем в историю
    adaptive.performanceHistory.push(adaptive.playerPerformance);
    if (adaptive.performanceHistory.length > adaptive.maxHistorySize) {
        adaptive.performanceHistory.shift();
    }
    
    // Корректируем сложность каждые 30 секунд
    if (now - adaptive.lastAdjustment > adaptive.adjustmentInterval) {
        const avgPerformance = adaptive.performanceHistory.reduce((sum, perf) => sum + perf, 0) / adaptive.performanceHistory.length;
        
        if (avgPerformance > adaptive.targetPerformance + 10) {
            // Игрок слишком силен - увеличиваем сложность
            adaptive.difficultyMultiplier = Math.min(adaptive.difficultyMultiplier * 1.1, 2.0);
            addGameLog('⚠️ Сложность увеличена', 'warning');
        } else if (avgPerformance < adaptive.targetPerformance - 10) {
            // Игрок слишком слаб - уменьшаем сложность
            adaptive.difficultyMultiplier = Math.max(adaptive.difficultyMultiplier * 0.9, 0.5);
            addGameLog('🎯 Сложность уменьшена', 'info');
        }
        
        adaptive.lastAdjustment = now;
    }
}

// Функция применения адаптивной сложности к врагам
function applyAdaptiveDifficulty(enemy) {
    if (!gameState.adaptiveDifficulty) return enemy;
    
    const multiplier = gameState.adaptiveDifficulty.difficultyMultiplier;
    
    // Увеличиваем характеристики врагов
    enemy.health = Math.round(enemy.health * multiplier);
    enemy.maxHealth = Math.round(enemy.maxHealth * multiplier);
    enemy.speed = Math.min(enemy.speed * multiplier, 4.0); // Ограничиваем максимальную скорость
    
    // Увеличиваем урон
    enemy.damageMultiplier = (enemy.damageMultiplier || 1) * multiplier;
    
    return enemy;
}

// Система улучшенных подсказок
const HINT_SYSTEM = {
    hints: {
        newPlayer: [
            '💡 Нажмите на ноду, чтобы захватить её',
            '💡 Постройте Miner для получения DP',
            '💡 Sentry защищает от врагов',
            '💡 ANTI.EXE временно останавливает врагов',
            '💡 Overclocker увеличивает CPU'
        ],
        strategy: [
            '🎯 Создайте оборонительный периметр',
            '🎯 Используйте ANTI.EXE для контроля',
            '🎯 Развивайте экономику постепенно',
            '🎯 Апгрейдите Hub для бонусов',
            '🎯 Следите за волнами врагов'
        ],
        advanced: [
            '⚡ Враги обходят сильные позиции',
            '⚡ Координируйте защиту',
            '⚡ Используйте EMP Blast в критических ситуациях',
            '⚡ Адаптивная сложность подстраивается под вас',
            '⚡ Случайные события добавляют разнообразие'
        ]
    },
    
    currentHint: 0,
    hintType: 'newPlayer',
    lastHintChange: 0,
    hintInterval: 15000 // 15 секунд между подсказками
};

function updateHints(now) {
    if (now - HINT_SYSTEM.lastHintChange > HINT_SYSTEM.hintInterval) {
        HINT_SYSTEM.currentHint = (HINT_SYSTEM.currentHint + 1) % HINT_SYSTEM.hints[HINT_SYSTEM.hintType].length;
        HINT_SYSTEM.lastHintChange = now;
    }
    
    // Автоматически переключаем тип подсказок в зависимости от прогресса
    if (gameState.currentWave >= 5 && HINT_SYSTEM.hintType === 'newPlayer') {
        HINT_SYSTEM.hintType = 'strategy';
    }
    if (gameState.currentWave >= 10 && HINT_SYSTEM.hintType === 'strategy') {
        HINT_SYSTEM.hintType = 'advanced';
    }
}

function drawEnhancedHint(ctx) {
    if (!canvas || !ctx) return;
    
    const hints = HINT_SYSTEM.hints[HINT_SYSTEM.hintType];
    const currentHint = hints[HINT_SYSTEM.currentHint];
    if (!currentHint) return;
    
    ctx.save();
    ctx.font = 'bold 16px sans-serif';
    
    // Функция для разбивки текста на строки по ширине
    function wrapText(text, maxWidth) {
        const words = text.split(' ');
        let lines = [];
        let line = '';
        for (let n = 0; n < words.length; n++) {
            let testLine = line + (line ? ' ' : '') + words[n];
            let metrics = ctx.measureText(testLine);
            let testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                lines.push(line);
                line = words[n];
            } else {
                line = testLine;
            }
        }
        lines.push(line);
        return lines;
    }
    
    const maxHintWidth = Math.min(canvas.width - 60, 420);
    const lines = wrapText(currentHint, maxHintWidth - 40);
    const hintWidth = Math.max(...lines.map(line => ctx.measureText(line).width)) + 40;
    const lineHeight = 24;
    const hintHeight = lines.length * lineHeight + 20;
    const hintX = 20;
    const hintY = canvas.height - hintHeight - 30;
    
    // Фон подсказки
    ctx.fillStyle = 'rgba(35, 43, 51, 0.95)';
    ctx.strokeStyle = '#ffd600';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(hintX, hintY, hintWidth, hintHeight, 10);
    ctx.fill();
    ctx.stroke();
    
    // Текст подсказки
    ctx.fillStyle = '#ffd600';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], hintX + 20, hintY + 16 + i * lineHeight);
    }
    
    // Индикатор прогресса
    const progress = ((performance.now() - HINT_SYSTEM.lastHintChange) / HINT_SYSTEM.hintInterval) * hintWidth;
    ctx.fillStyle = '#00ff90';
    ctx.fillRect(hintX, hintY + hintHeight - 4, progress, 4);
    
    ctx.restore();
}

// Система визуальных индикаторов
function drawThreatIndicators(ctx) {
    if (!gameState || !gameState.nodes) return;
    
    ctx.save();
    ctx.globalAlpha = 0.6;
    
    for (const nodeId in gameState.nodes) {
        const node = gameState.nodes[nodeId];
        if (!node || node.owner !== 'player') continue;
        
        // Индикатор угрозы для нод с программами
        if (node.program) {
            let threatLevel = 0;
            
            // Анализируем угрозы вокруг ноды
            for (const enemy of gameState.enemies) {
                if (enemy.health <= 0) continue;
                
                const enemyNode = gameState.nodes[enemy.currentNodeId];
                if (!enemyNode) continue;
                
                const dist = getDistance(node.x, node.y, enemyNode.x, enemyNode.y);
                if (dist < 200) {
                    threatLevel += (200 - dist) / 200;
                }
            }
            
            if (threatLevel > 0.3) {
                // Рисуем индикатор угрозы
                const alpha = Math.min(threatLevel, 1);
                ctx.fillStyle = `rgba(255, 23, 68, ${alpha})`;
                ctx.beginPath();
                ctx.arc(node.x, node.y, 25 + threatLevel * 10, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    
    ctx.restore();
}

// Система отображения информации о врагах
function drawEnemyInfo(ctx, enemy) {
    if (!enemy || !canvas || !ctx) return;
    
    const enemyNode = gameState.nodes[enemy.currentNodeId];
    if (!enemyNode) return;
    
    ctx.save();
    
    // Фон информации
    ctx.fillStyle = 'rgba(35, 43, 51, 0.9)';
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 2;
    
    const infoWidth = 200;
    const infoHeight = 80;
    const infoX = enemyNode.x + 30;
    const infoY = enemyNode.y - 50;
    
    ctx.beginPath();
    ctx.roundRect(infoX, infoY, infoWidth, infoHeight, 8);
    ctx.fill();
    ctx.stroke();
    
    // Информация о враге
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    
    const behavior = ENEMY_BEHAVIORS[enemy.type];
    const enemyName = behavior ? behavior.name : `Враг (${enemy.type})`;
    
    ctx.fillText(enemyName, infoX + 10, infoY + 20);
    ctx.fillText(`Здоровье: ${Math.round(enemy.health)}/${enemy.maxHealth}`, infoX + 10, infoY + 40);
    ctx.fillText(`Скорость: ${enemy.speed.toFixed(1)}`, infoX + 10, infoY + 60);
    
    // Полоска здоровья
    const healthPercent = enemy.health / enemy.maxHealth;
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(infoX + 10, infoY + 25, 180 * healthPercent, 8);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(infoX + 10, infoY + 25, 180, 8);
    
    ctx.restore();
}
 