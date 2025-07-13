#!/usr/bin/env python3
"""
Детальный тест механизма снижения trace level при захвате нод
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

def test_trace_reduction_detailed():
    print("=== Детальный тест снижения trace level при захвате нод ===")
    
    engine = GameEngineProcess()
    
    try:
        # Сбрасываем игру
        state = engine.send_command({'cmd': 'reset'})
        initial_trace = state['stats']['traceLevel']
        print(f"Начальный trace level: {initial_trace}")
        
        # Получаем доступные действия
        actions = engine.send_command({'cmd': 'get_actions'})
        capture_actions = [a for a in actions['actions'] if a['action'] == 'capture']
        print(f"Доступные захваты: {len(capture_actions)}")
        
        if not capture_actions:
            print("Нет доступных нод для захвата!")
            return
        
        # Выполняем захват первой доступной ноды
        capture_action = capture_actions[0]
        target_node_id = capture_action['targetNodeId']
        print(f"Захватываем ноду: {target_node_id}")
        
        # Проверяем начальное состояние ноды
        initial_state = engine.send_command({'cmd': 'get_state'})
        target_node = initial_state['nodes'][target_node_id]
        print(f"Начальное состояние ноды {target_node_id}: owner={target_node['owner']}, isCapturing={target_node.get('isCapturing', False)}")
        
        # Выполняем действие захвата
        result = engine.send_command({
            'cmd': 'step',
            'actions': [capture_action]
        })
        print(f"Результат захвата: {result['performedActions']}")
        
        # Проверяем состояние после начала захвата
        state_after_capture = engine.send_command({'cmd': 'get_state'})
        target_node_after = state_after_capture['nodes'][target_node_id]
        print(f"Состояние ноды после начала захвата: owner={target_node_after['owner']}, isCapturing={target_node_after.get('isCapturing', False)}")
        print(f"Trace level после начала захвата: {state_after_capture['stats']['traceLevel']}")
        
        # Ждем завершения захвата с проверками
        print("\nОжидаем завершения захвата...")
        for i in range(10):  # Максимум 10 секунд
            time.sleep(0.5)
            current_state = engine.send_command({'cmd': 'get_state'})
            current_trace = current_state['stats']['traceLevel']
            target_node_current = current_state['nodes'][target_node_id]
            
            print(f"Шаг {i+1}: trace={current_trace:.4f}, owner={target_node_current['owner']}, isCapturing={target_node_current.get('isCapturing', False)}")
            
            # Если нода захвачена, проверяем trace level
            if target_node_current['owner'] == 'player' and not target_node_current.get('isCapturing', False):
                print(f"\n✅ Нода {target_node_id} захвачена!")
                print(f"Финальный trace level: {current_trace}")
                
                # Проверяем, что trace level снизился на 20%
                expected_trace = max(0, (initial_trace + 5) * 0.8)
                print(f"Ожидаемый trace level: {expected_trace}")
                
                if abs(current_trace - expected_trace) < 1:
                    print("✅ Тест пройден: trace level снижен правильно!")
                else:
                    print("❌ Тест провален: trace level не соответствует ожидаемому")
                break
        else:
            print("❌ Захват не завершился за отведенное время")
            
    except Exception as e:
        print(f"Ошибка во время теста: {e}")
        import traceback
        traceback.print_exc()
    finally:
        engine.close()

if __name__ == "__main__":
    test_trace_reduction_detailed() 