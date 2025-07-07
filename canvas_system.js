// --- CANVAS NETWORK SYSTEM ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// --- Node Class ---
class Node {
    constructor(x, y, id, type = 'data') {
        this.x = x;
        this.y = y;
        this.id = id;
        this.type = type;
        this.neighbors = [];
        this.randomPhase = Math.random() * Math.PI * 2;
    }
    addNeighbor(nodeId) {
        if (!this.neighbors.includes(nodeId)) this.neighbors.push(nodeId);
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

// --- Визуализация и анимация на canvas ---
let game_state = { nodes: {} };
function drawConnection(ctx, n1, n2, time) {
    // Неоновая голубая пульсация с "бегущей волной"
    const pulse = 0.5 + 0.5 * Math.sin(time / 250 + (n1.x + n2.x + n1.y + n2.y) / 200);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.strokeStyle = `rgba(0,234,255,${0.45 + 0.3 * pulse})`;
    ctx.shadowColor = '#00eaff';
    ctx.shadowBlur = 6 + 6 * pulse;
    ctx.lineWidth = 3.5 + 1.2 * pulse;
    ctx.stroke();
    // Внутренняя "нить"
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    ctx.stroke();
    ctx.restore();
}

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
    // Свечение
    ctx.shadowColor = node.type === 'hub' ? '#ffb347' : '#66f6ff';
    ctx.shadowBlur = node.type === 'hub' ? 24 : 18;
    ctx.fillStyle = node.type === 'hub' ? '#ff9100' : '#00eaff';
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = node.type === 'hub' ? '#ff9100' : '#fff';
    ctx.stroke();
    // Текст для HUB
    if (node.type === 'hub') {
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HUB', node.x, node.y);
    }
    ctx.restore();
}

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
        drawNode(ctx, game_state.nodes[id]);
    }
}

function mainLoop() {
    render();
    requestAnimationFrame(mainLoop);
}

game_state.nodes = generateCanvasNetwork();
runForceSimulation(game_state.nodes, 250);
fixEdgeIntersectionsAndReconnect(game_state.nodes);
mainLoop(); 