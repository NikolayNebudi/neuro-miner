#!/usr/bin/env node

// Импортируем функции из движка
const fs = require('fs');
const gameEngineCode = fs.readFileSync('game_engine_headless.js', 'utf8');

// Создаем контекст для выполнения кода
const vm = require('vm');
const context = {
    console: console,
    require: require,
    process: process,
    Buffer: Buffer,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    global: global
};

vm.createContext(context);
vm.runInContext(gameEngineCode, context);

// Тестируем захват
console.log("=== Тест прогресса захвата ===");

// Сбрасываем игру
const resetResult = context.handleCommand({cmd: 'reset'});
console.log(`Начальный trace level: ${resetResult.stats.traceLevel}`);

// Получаем доступные действия
const actionsResult = context.handleCommand({cmd: 'get_actions'});
const captureActions = actionsResult.actions.filter(a => a.action === 'capture');
console.log(`Доступные захваты: ${captureActions.length}`);

if (captureActions.length === 0) {
    console.log("Нет доступных нод для захвата!");
    process.exit(1);
}

const targetNodeId = captureActions[0].targetNodeId;
console.log(`Захватываем ноду: ${targetNodeId}`);

// Начинаем захват
const captureResult = context.handleCommand({
    cmd: 'step',
    actions: [captureActions[0]]
});
console.log(`Результат захвата: ${JSON.stringify(captureResult.performedActions)}`);

// Проверяем состояние после начала захвата
let state = context.handleCommand({cmd: 'get_state'});
let targetNode = state.nodes[targetNodeId];
console.log(`Состояние ноды после начала захвата: owner=${targetNode.owner}, isCapturing=${targetNode.isCapturing}`);

// Симулируем обновление игры для завершения захвата
console.log("\nСимулируем обновление игры...");
for (let i = 0; i < 10; i++) {
    // Вызываем updateGame напрямую
    context.updateGame(1000); // 1 секунда
    
    state = context.handleCommand({cmd: 'get_state'});
    targetNode = state.nodes[targetNodeId];
    const traceLevel = state.stats.traceLevel;
    
    console.log(`Шаг ${i+1}: trace=${traceLevel.toFixed(4)}, owner=${targetNode.owner}, isCapturing=${targetNode.isCapturing}, progress=${targetNode.captureProgress?.toFixed(3) || 'N/A'}`);
    
    if (targetNode.owner === 'player' && !targetNode.isCapturing) {
        console.log(`\n✅ Нода ${targetNodeId} захвачена!`);
        console.log(`Финальный trace level: ${traceLevel}`);
        
        // Проверяем, что trace level снизился на 20%
        const expectedTrace = Math.max(0, (0 + 5) * 0.8); // начальный 0 + 5 за захват, затем *0.8
        console.log(`Ожидаемый trace level: ${expectedTrace}`);
        
        if (Math.abs(traceLevel - expectedTrace) < 1) {
            console.log("✅ Тест пройден: trace level снижен правильно!");
        } else {
            console.log("❌ Тест провален: trace level не соответствует ожидаемому");
        }
        break;
    }
} 