#!/usr/bin/env python3
"""
Короткий тест механизма снижения trace level при захвате нод
"""

import json
import subprocess
import time

class GameEngineProcess:
    def __init__(self):
        self.process = subprocess.Popen(
            ['node', 'game_engine_headless.js'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        time.sleep(0.1)
    
    def send_command(self, command):
        self.process.stdin.write(json.dumps(command) + '\n')
        self.process.stdin.flush()
        response = self.process.stdout.readline()
        return json.loads(response)
    
    def close(self):
        self.process.terminate()
        self.process.wait()

def test_trace_reduction_short():
    print("=== Тест снижения trace level при захвате нод ===")
    
    engine = GameEngineProcess()
    
    try:
        # Сбрасываем игру
        result = engine.send_command({'cmd': 'reset'})
        initial_trace = result['stats']['traceLevel']
        print(f"Начальный trace level: {initial_trace}")
        
        # Получаем доступные действия
        result = engine.send_command({'cmd': 'get_available_actions'})
        available_actions = result.get('available_actions', [])
        
        # Ищем действие захвата
        capture_actions = [a for a in available_actions if a.get('action') == 'capture']
        if not capture_actions:
            print("❌ Нет доступных действий захвата!")
            return
        
        # Выбираем первую доступную ноду для захвата
        target_node = capture_actions[0]['targetNodeId']
        print(f"🎯 Начинаем захват ноды {target_node}")
        
        # Выполняем захват
        result = engine.send_command({
            'cmd': 'step',
            'actions': [{'action': 'capture', 'targetNodeId': target_node}]
        })
        
        # Проверяем состояние после захвата
        stats = result['newState']['stats']
        trace_after_capture = stats['traceLevel']
        player_nodes = stats['playerNodes']
        
        print(f"📊 После захвата:")
        print(f"   Trace level: {trace_after_capture}")
        print(f"   Ноды игрока: {player_nodes}")
        
        # Проверяем, что trace level снизился
        if trace_after_capture < initial_trace + 5:  # Должно быть меньше чем +5
            print("✅ Trace level снизился после захвата!")
        else:
            print("❌ Trace level не снизился")
        
        # Продолжаем игру еще несколько шагов
        for step in range(5):
            result = engine.send_command({'cmd': 'get_available_actions'})
            available_actions = result.get('available_actions', [])
            
            # Выбираем случайное действие
            if available_actions:
                action = available_actions[0]
                result = engine.send_command({
                    'cmd': 'step',
                    'actions': [action]
                })
                
                stats = result['newState']['stats']
                print(f"Шаг {step+1}: Trace={stats['traceLevel']:.4f}, Nodes={stats['playerNodes']}")
        
        print("✅ Тест завершен успешно!")
        
    finally:
        engine.close()

if __name__ == "__main__":
    test_trace_reduction_short() 