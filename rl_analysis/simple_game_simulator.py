#!/usr/bin/env python3
"""
Упрощенный симулятор игры для тестирования системы логирования
"""

import random
import math
from typing import Dict, List, Any

class SimpleGameSimulator:
    """Упрощенный симулятор игры для тестирования"""
    
    def __init__(self, config=None):
        self.config = config or {}
        self.state = None
        self.step_count = 0
        
    def init_game(self, config=None):
        """Инициализирует игру"""
        if config:
            self.config = config
            
        # Создаем простую сеть узлов
        nodes = {}
        
        # Hub
        nodes['hub'] = {
            'x': 500, 'y': 350, 'id': 'hub', 'type': 'hub', 'owner': 'player',
            'resistance': 50, 'program': None, 'neighbors': []
        }
        
        # Создаем 15-25 узлов
        num_nodes = random.randint(15, 25)
        for i in range(num_nodes):
            node_id = f'node{i}'
            x = random.randint(100, 900)
            y = random.randint(100, 600)
            
            # Тип узла
            node_type = 'data'
            if random.random() < 0.1:  # 10% шанс cpu_node
                node_type = 'cpu_node'
            elif random.random() < 0.1:  # 10% шанс data_cache
                node_type = 'data_cache'
            
            nodes[node_id] = {
                'x': x, 'y': y, 'id': node_id, 'type': node_type, 'owner': 'neutral',
                'resistance': random.randint(10, 50), 'program': None, 'neighbors': []
            }
        
        # Создаем связи (упрощенная версия)
        node_ids = list(nodes.keys())
        for i, node_id in enumerate(node_ids):
            if i < len(node_ids) - 1:
                next_node = node_ids[i + 1]
                nodes[node_id]['neighbors'].append(next_node)
                nodes[next_node]['neighbors'].append(node_id)
        
        # Создаем начальное состояние
        self.state = {
            'nodes': nodes,
            'dp': 100,
            'cpu': 50,
            'traceLevel': 0,
            'playerRootNodeId': 'hub',
            'enemies': [],
            'selectedNodeId': None,
            'hubCaptureActive': False,
            'hubCaptureProgress': 0,
            'empCooldown': 0,
            'techLevel': 1,
            'game_time': 0,
            'lastMinerTick': 0,
            'lastEnemySpawn': 0,
            'enemyIdCounter': 1,
            'win': False,
            'phase': 'PLAYING',
            'hubLevel': 1,
            'logEvents': []
        }
        
        return self.state
    
    def get_possible_actions(self, state):
        """Возвращает возможные действия"""
        actions = [{'action': 'wait'}]
        
        # Действия захвата
        for node_id, node in state['nodes'].items():
            if node['owner'] == 'player':
                for neighbor_id in node['neighbors']:
                    neighbor = state['nodes'].get(neighbor_id)
                    if neighbor and neighbor['owner'] != 'player':
                        actions.append({'action': 'capture', 'nodeId': neighbor_id})
        
        # Действия строительства
        for node_id, node in state['nodes'].items():
            if node['owner'] == 'player' and not node['program']:
                if node['type'] != 'cpu_node':
                    actions.append({'action': 'build', 'nodeId': node_id, 'program': 'miner'})
                    actions.append({'action': 'build', 'nodeId': node_id, 'program': 'sentry'})
                    actions.append({'action': 'build', 'nodeId': node_id, 'program': 'shield'})
                if node['type'] == 'cpu_node':
                    actions.append({'action': 'build', 'nodeId': node_id, 'program': 'overclocker'})
        
        # Действия улучшения
        for node_id, node in state['nodes'].items():
            if node['owner'] == 'player' and node['program']:
                actions.append({'action': 'upgrade', 'nodeId': node_id})
        
        # Действия хаба
        if state['hubLevel'] < 4:
            actions.append({'action': 'upgrade_hub'})
        
        # EMP blast
        if state['cpu'] >= 50:
            actions.append({'action': 'emp_blast'})
        
        return {'actions': actions}
    
    def step(self, state, action):
        """Выполняет действие и возвращает новое состояние"""
        self.state = state.copy()
        self.step_count += 1
        
        # Применяем действие
        action_type = action.get('action', 'wait')
        log_events = []
        reward = 0
        
        if action_type == 'capture':
            node_id = action.get('nodeId')
            if node_id and self.state['dp'] >= 10:
                node = self.state['nodes'].get(node_id)
                if node and node['owner'] != 'player':
                    self.state['dp'] -= 10
                    node['owner'] = 'player'
                    reward += 20
                    log_events.append({'type': 'capture_complete', 'nodeId': node_id})
        
        elif action_type == 'build':
            node_id = action.get('nodeId')
            program_type = action.get('program')
            if node_id and program_type:
                node = self.state['nodes'].get(node_id)
                if node and node['owner'] == 'player' and not node['program']:
                    # Стоимость
                    costs = {'miner': 20, 'sentry': 35, 'shield': 30, 'overclocker': 50}
                    cost = costs.get(program_type, 20)
                    
                    if self.state['dp'] >= cost:
                        self.state['dp'] -= cost
                        node['program'] = {'type': program_type, 'level': 1}
                        reward += 10
                        log_events.append({'type': 'build', 'nodeId': node_id, 'program': program_type})
        
        elif action_type == 'upgrade':
            node_id = action.get('nodeId')
            if node_id:
                node = self.state['nodes'].get(node_id)
                if node and node['program']:
                    node['program']['level'] += 1
                    reward += 5
                    log_events.append({'type': 'upgrade', 'nodeId': node_id})
        
        elif action_type == 'upgrade_hub':
            if self.state['hubLevel'] < 4 and self.state['dp'] >= 100:
                self.state['dp'] -= 100
                self.state['hubLevel'] += 1
                reward += 50
                log_events.append({'type': 'upgrade_hub'})
        
        elif action_type == 'emp_blast':
            if self.state['cpu'] >= 50:
                self.state['cpu'] -= 50
                self.state['empCooldown'] = 30
                reward += 5
                log_events.append({'type': 'emp_blast'})
        
        # Симуляция игрового времени
        self.state['game_time'] += 1
        self.state['lastMinerTick'] += 1
        
        # Доход ресурсов
        if self.state['lastMinerTick'] >= 60:
            dp_income = 2  # от хаба
            cpu_income = 0
            
            for node in self.state['nodes'].values():
                if node['owner'] == 'player' and node['program']:
                    if node['program']['type'] == 'miner':
                        dp_income += 3 * (1.8 ** (node['program']['level'] - 1))
                    elif node['program']['type'] == 'overclocker':
                        cpu_income += 1 * node['program']['level']
            
            self.state['dp'] += dp_income
            self.state['cpu'] += cpu_income
            self.state['lastMinerTick'] = 0
            
            if dp_income > 2 or cpu_income > 0:
                log_events.append({'type': 'resource', 'dpIncome': dp_income, 'cpuIncome': cpu_income})
        
        # Спавн врагов
        self.state['lastEnemySpawn'] += 1
        if self.state['lastEnemySpawn'] >= 120:  # каждые 2 минуты
            if len(self.state['enemies']) < 5:  # максимум 5 врагов
                enemy_id = f'e{self.state["enemyIdCounter"]}'
                self.state['enemyIdCounter'] += 1
                
                # Выбираем случайный нейтральный узел для спавна
                neutral_nodes = [n for n in self.state['nodes'].values() if n['owner'] == 'neutral']
                if neutral_nodes:
                    spawn_node = random.choice(neutral_nodes)
                    enemy = {
                        'id': enemy_id,
                        'currentNodeId': spawn_node['id'],
                        'path': [spawn_node['id']],
                        'pathStep': 0,
                        'health': 50,
                        'type': 'patrol'
                    }
                    self.state['enemies'].append(enemy)
                    log_events.append({'type': 'enemy_spawn', 'enemyId': enemy_id})
            
            self.state['lastEnemySpawn'] = 0
        
        # Движение врагов
        for enemy in self.state['enemies']:
            if random.random() < 0.1:  # 10% шанс движения
                current_node = self.state['nodes'].get(enemy['currentNodeId'])
                if current_node and current_node['neighbors']:
                    next_node_id = random.choice(current_node['neighbors'])
                    enemy['currentNodeId'] = next_node_id
                    
                    # Атака узла игрока
                    next_node = self.state['nodes'].get(next_node_id)
                    if next_node and next_node['owner'] == 'player':
                        if next_node['program'] and next_node['program']['type'] == 'sentry':
                            # Sentry атакует врага
                            enemy['health'] -= 20
                            if enemy['health'] <= 0:
                                self.state['enemies'].remove(enemy)
                                reward += 10
                                log_events.append({'type': 'enemy_killed', 'enemyId': enemy['id']})
                        else:
                            # Враг атакует узел
                            if not next_node['program'] or next_node['program']['type'] != 'sentry':
                                next_node['owner'] = 'neutral'
                                next_node['program'] = None
                                reward -= 15
                                log_events.append({'type': 'node_lost', 'nodeId': next_node_id})
        
        # Условия завершения
        done = False
        
        # Победа: захвачено 60% узлов
        player_nodes = sum(1 for n in self.state['nodes'].values() if n['owner'] == 'player')
        total_nodes = len(self.state['nodes'])
        if player_nodes / total_nodes >= 0.6:
            done = True
            reward += 1000
            self.state['win'] = True
            log_events.append({'type': 'win'})
        
        # Поражение: превышен trace level
        if self.state['traceLevel'] >= 300:
            done = True
            reward -= 1000
            log_events.append({'type': 'lose', 'reason': 'trace'})
        
        # Поражение: потерян hub
        if self.state['nodes']['hub']['owner'] != 'player':
            done = True
            reward -= 1000
            log_events.append({'type': 'lose', 'reason': 'hub_lost'})
        
        # Увеличиваем trace level
        self.state['traceLevel'] += 0.1
        
        # Обновляем logEvents
        self.state['logEvents'] = log_events
        
        return {
            'newState': self.state,
            'reward': reward,
            'done': done,
            'logEvents': log_events
        }

# Экспортируем функции для совместимости
def initGame(config=None):
    """Инициализирует игру"""
    simulator = SimpleGameSimulator()
    return simulator.init_game(config)

def getPossibleActions(state):
    """Возвращает возможные действия"""
    simulator = SimpleGameSimulator()
    return simulator.get_possible_actions(state)

def step(state, action):
    """Выполняет действие"""
    simulator = SimpleGameSimulator()
    return simulator.step(state, action)

if __name__ == "__main__":
    # Тестирование симулятора
    print("🧪 Тестирование простого симулятора игры...")
    
    simulator = SimpleGameSimulator()
    state = simulator.init_game()
    
    print(f"Инициализирована игра с {len(state['nodes'])} узлами")
    print(f"Начальные ресурсы: DP={state['dp']}, CPU={state['cpu']}")
    
    # Тестируем несколько действий
    for i in range(5):
        actions = simulator.get_possible_actions(state)
        print(f"Шаг {i+1}: {len(actions['actions'])} возможных действий")
        
        if actions['actions']:
            action = random.choice(actions['actions'])
            result = simulator.step(state, action)
            state = result['newState']
            
            print(f"  Действие: {action}")
            print(f"  Награда: {result['reward']}")
            print(f"  Ресурсы: DP={state['dp']}, CPU={state['cpu']}")
            print(f"  Trace: {state['traceLevel']:.1f}")
            
            if result['done']:
                print(f"  Игра завершена!")
                break
    
    print("✅ Симулятор работает корректно!") 