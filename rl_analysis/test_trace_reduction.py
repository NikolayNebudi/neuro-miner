#!/usr/bin/env python3
"""
Тест механизма снижения trace level при захвате нод
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
        time.sleep(0.1)  # Даем время на инициализацию
    
    def send_command(self, command):
        self.process.stdin.write(json.dumps(command) + '\n')
        self.process.stdin.flush()
        response = self.process.stdout.readline()
        return json.loads(response)
    
    def close(self):
        self.process.terminate()
        self.process.wait()

def test_trace_reduction():
    print("=== Тест снижения trace level при захвате нод ===")
    
    engine = GameEngineProcess()
    
    try:
        # Сбрасываем игру
        state = engine.send_command({'cmd': 'reset'})
        initial_trace = state['stats']['traceLevel']
        print(f"Начальный trace level: {initial_trace}")
        
        # Получаем доступные действия
        actions = engine.send_command({'cmd': 'get_actions'})
        print(f"Доступные действия: {len(actions['actions'])}")
        
        # Ищем действия захвата
        capture_actions = [a for a in actions['actions'] if a['action'] == 'capture']
        print(f"Доступные захваты: {len(capture_actions)}")
        
        if not capture_actions:
            print("Нет доступных нод для захвата!")
            return
        
        # Выполняем захват первой доступной ноды
        capture_action = capture_actions[0]
        print(f"Захватываем ноду: {capture_action['targetNodeId']}")
        
        # Выполняем действие
        result = engine.send_command({
            'cmd': 'step',
            'actions': [capture_action]
        })
        
        # Ждем завершения захвата (обычно 1 секунда)
        print("Ожидаем завершения захвата...")
        time.sleep(1.5)
        
        # Получаем новое состояние
        new_state = engine.send_command({'cmd': 'get_state'})
        new_trace = new_state['stats']['traceLevel']
        
        print(f"Trace level после захвата: {new_trace}")
        print(f"Изменение: {new_trace - initial_trace}")
        
        # Проверяем, что trace level снизился на 20%
        expected_trace = max(0, (initial_trace + 5) * 0.8)  # +5 за захват, затем *0.8
        print(f"Ожидаемый trace level: {expected_trace}")
        
        if abs(new_trace - expected_trace) < 1:  # Погрешность в 1 единицу
            print("✅ Тест пройден: trace level снижен правильно!")
        else:
            print("❌ Тест провален: trace level не соответствует ожидаемому")
            
    except Exception as e:
        print(f"Ошибка во время теста: {e}")
    finally:
        engine.close()

if __name__ == "__main__":
    test_trace_reduction() 