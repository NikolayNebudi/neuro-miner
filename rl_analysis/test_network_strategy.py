#!/usr/bin/env python3
"""
Тестирование стратегии равномерного развития сети
"""

import json
import subprocess
import pickle
import os
import random
import numpy as np
from evolution_agent import EvolutionAgent, GameState

def test_network_growth_strategy(games_count: int = 5):
    """Тестирование стратегии равномерного развития сети"""
    print("🌐 Тестирование стратегии равномерного развития сети")
    print(f"🎮 Количество игр: {games_count}")
    print("-" * 50)
    
    # Загрузка лучшего агента
    try:
        with open('best_agent.pkl', 'rb') as f:
            agent = pickle.load(f)
    except FileNotFoundError:
        print("❌ Файл best_agent.pkl не найден. Сначала обучите агента.")
        return
    
    game_results = []
    
    for game_num in range(1, games_count + 1):
        print(f"🎯 Игра {game_num}/{games_count}")
        try:
            reward, win, stats, network_analysis = play_single_game_with_network_analysis(agent)
            
            result = {
                'game': game_num,
                'score': reward,
                'win': win,
                'stats': stats,
                'network_analysis': network_analysis
            }
            game_results.append(result)
            
            status = "ПОБЕДА" if win else "ПОРАЖЕНИЕ"
            print(f"   Результат: {status}")
            print(f"   Счет: {reward:.2f}")
            print(f"   DP: {stats.get('dp', 0)}")
            print(f"   CPU: {stats.get('cpu', 0)}")
            print(f"   Ноды игрока: {stats.get('playerNodes', 0)}")
            print(f"   Trace Level: {stats.get('traceLevel', 0):.1f}")
            print(f"   Связность сети: {network_analysis['connectivity']:.2f}")
            print(f"   Среднее расстояние: {network_analysis['avg_distance']:.2f}")
            print()
            
        except Exception as e:
            print(f"   ❌ Ошибка в игре: {e}")
            print()
    
    if not game_results:
        print("❌ Нет результатов для анализа")
        return
    
    # Статистика
    wins = sum(1 for r in game_results if r['win'])
    avg_score = sum(r['score'] for r in game_results) / len(game_results)
    avg_connectivity = sum(r['network_analysis']['connectivity'] for r in game_results) / len(game_results)
    avg_distance = sum(r['network_analysis']['avg_distance'] for r in game_results) / len(game_results)
    
    print("📊 ИТОГОВАЯ СТАТИСТИКА СЕТИ:")
    print(f"   Побед: {wins}/{len(game_results)} ({wins/len(game_results)*100:.1f}%)")
    print(f"   Средний счет: {avg_score:.2f}")
    print(f"   Средняя связность: {avg_connectivity:.2f}")
    print(f"   Среднее расстояние: {avg_distance:.2f}")
    print()

def play_single_game_with_network_analysis(agent: EvolutionAgent) -> tuple:
    """Сыграть одну игру с анализом развития сети"""
    
    process = subprocess.Popen(
        ['node', 'game_engine_headless.js'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    try:
        reset_cmd = json.dumps({'cmd': 'reset'}) + '\n'
        process.stdin.write(reset_cmd)
        process.stdin.flush()
        
        response = process.stdout.readline()
        game_state = GameState(json.loads(response))
        
        total_reward = 0.0
        steps = 0
        max_steps = 1000
        network_history = []
        
        while not game_state.done and steps < max_steps:
            actions_cmd = json.dumps({'cmd': 'get_actions'}) + '\n'
            process.stdin.write(actions_cmd)
            process.stdin.flush()
            
            response = process.stdout.readline()
            available_actions = json.loads(response)['actions']
            
            if not available_actions:
                break
            
            # Анализируем текущее состояние сети
            network_analysis = analyze_network_state(game_state)
            network_history.append(network_analysis)
            
            if steps % 10 == 0:
                print(f"   Шаг {steps+1}: Ноды={game_state.stats.get('playerNodes', 0)}, "
                      f"Связность={network_analysis['connectivity']:.2f}, "
                      f"Ср.расст={network_analysis['avg_distance']:.2f}")
            
            # Используем улучшенную функцию выбора действий
            actions = select_actions_with_network_focus(agent, game_state, available_actions)
            
            # Отправляем действия в движок
            action_cmd = json.dumps({'cmd': 'step', 'actions': actions}) + '\n'
            process.stdin.write(action_cmd)
            process.stdin.flush()
            
            response = process.stdout.readline()
            result = json.loads(response)
            game_state = GameState(result['newState'])
            total_reward += result.get('reward', 0)
            
            steps += 1
        
        if game_state.win:
            total_reward += 1000
        elif game_state.done and not game_state.win:
            total_reward -= 500
        
        stats = game_state.stats
        total_reward += stats.get('dp', 0) * 0.1
        total_reward += stats.get('playerNodes', 0) * 10
        total_reward -= stats.get('traceLevel', 0) * 0.5
        
        # Финальный анализ сети
        final_network_analysis = analyze_network_state(game_state)
        
        process.terminate()
        return total_reward, game_state.win, stats, final_network_analysis
    except Exception as e:
        process.terminate()
        raise e

def analyze_network_state(game_state: GameState) -> dict:
    """Анализ состояния сети"""
    nodes = game_state.nodes
    player_nodes = [node_id for node_id, node_data in nodes.items() 
                   if node_data.get('owner') == 'player']
    
    if not player_nodes:
        return {'connectivity': 0.0, 'avg_distance': 0.0, 'hub_distance': 0.0}
    
    # Вычисляем связность (сколько нод соединены с hub)
    connected_to_hub = 0
    total_distance = 0
    
    for node_id in player_nodes:
        if node_id == 'hub':
            connected_to_hub += 1
            total_distance += 0
        else:
            distance = calculate_distance_from_hub(node_id, nodes)
            if distance < 999:  # Нода достижима
                connected_to_hub += 1
                total_distance += distance
    
    connectivity = connected_to_hub / len(player_nodes) if player_nodes else 0.0
    avg_distance = total_distance / len(player_nodes) if player_nodes else 0.0
    
    return {
        'connectivity': connectivity,
        'avg_distance': avg_distance,
        'player_nodes': len(player_nodes)
    }

def calculate_distance_from_hub(node_id: str, nodes: dict) -> int:
    """Вычисляет расстояние от hub до ноды"""
    if node_id == 'hub':
        return 0
    
    # Простой BFS для поиска кратчайшего пути
    visited = set()
    queue = [('hub', 0)]
    
    while queue:
        current_node, distance = queue.pop(0)
        
        if current_node == node_id:
            return distance
        
        if current_node in visited:
            continue
            
        visited.add(current_node)
        current_node_data = nodes.get(current_node, {})
        neighbors = current_node_data.get('neighbors', [])
        
        for neighbor in neighbors:
            if neighbor not in visited:
                queue.append((neighbor, distance + 1))
    
    return 999  # Недостижимая нода

def evaluate_node_for_network_growth(node_id: str, node_data: dict, nodes: dict, player_nodes: list) -> float:
    """
    Оценка ноды для равномерного развития сети
    Возвращает оценку от 0 до 100
    """
    score = 0.0
    
    # 1. Расстояние от hub (чем ближе, тем лучше)
    hub_distance = calculate_distance_from_hub(node_id, nodes)
    if hub_distance <= 1:
        score += 30  # Соседние с hub ноды
    elif hub_distance == 2:
        score += 20  # Ноды в 2 шагах
    elif hub_distance == 3:
        score += 10  # Ноды в 3 шагах
    else:
        score += 5   # Дальние ноды
    
    # 2. Количество соседних нод игрока
    neighbors = node_data.get('neighbors', [])
    player_neighbors = sum(1 for n in neighbors 
                          if nodes.get(n, {}).get('owner') == 'player')
    score += player_neighbors * 15  # Каждый сосед +15 очков
    
    # 3. Потенциал расширения (сколько новых нод можно захватить)
    expansion_potential = 0
    for neighbor in neighbors:
        if nodes.get(neighbor, {}).get('owner') == 'neutral':
            expansion_potential += 1
    score += expansion_potential * 10
    
    # 4. Тип ноды
    node_type = node_data.get('type', 'data')
    if node_type == 'cpu_node':
        score += 25  # CPU ноды важны для overclocker
    elif node_type == 'data_cache':
        score += 15  # Data cache ноды полезны
    
    # 5. Штраф за сопротивление
    resistance = node_data.get('resistance', 50)
    score -= resistance * 0.5
    
    return max(0, score)

def select_actions_with_network_focus(agent: EvolutionAgent, game_state: GameState, available_actions: list) -> list:
    """
    Выбор действий с фокусом на равномерное развитие сети
    """
    actions_to_perform = []
    targeted_nodes = set()
    
    # Получаем параметры из генома
    genome = agent.genome
    if len(genome) < 50:
        additional_genes = np.random.uniform(-1.0, 1.0, 50 - len(genome))
        genome = np.concatenate([genome, additional_genes])
    
    # Параметры стратегии
    MAX_ACTIONS_PER_TURN = 3
    current_dp = game_state.stats.get('dp', 0)
    current_cpu = game_state.stats.get('cpu', 0)
    
    nodes = game_state.nodes
    player_node_ids = [node_id for node_id, node_data in nodes.items() 
                      if node_data.get('owner') == 'player']
    
    # 1. ПРИОРИТЕТ: Захват нод для развития сети
    if current_dp >= 10:
        capture_actions = [a for a in available_actions if a['action'] == 'capture']
        
        # Сортируем ноды по оценке для развития сети
        node_scores = []
        for action in capture_actions:
            target_node_id = action['targetNodeId']
            if target_node_id in targeted_nodes:
                continue
                
            target_node = nodes.get(target_node_id)
            if not target_node:
                continue
            
            # Основная оценка для развития сети
            score = evaluate_node_for_network_growth(target_node_id, target_node, nodes, player_node_ids)
            
            # Дополнительные бонусы из генома
            node_type = target_node.get('type', 'data')
            if node_type == 'cpu_node':
                score += genome[1] * 50 + 25
            elif node_type == 'data_cache':
                score += genome[2] * 30 + 15
            
            resistance = target_node.get('resistance', 50)
            resistance_penalty = genome[4] * 1.0 + 0.5
            score -= resistance * resistance_penalty
            
            node_scores.append((score, action))
        
        # Выбираем лучшие ноды
        node_scores.sort(key=lambda x: x[0], reverse=True)
        
        for score, action in node_scores:
            if len(actions_to_perform) >= MAX_ACTIONS_PER_TURN:
                break
                
            if current_dp >= 10:
                actions_to_perform.append(action)
                current_dp -= 10
                targeted_nodes.add(action['targetNodeId'])
                print(f"   🎯 Захватываем {action['targetNodeId']} (оценка сети: {score:.1f})")
    
    # 2. ЭКОНОМИЧЕСКОЕ РАЗВИТИЕ
    if current_dp >= 20 and len(actions_to_perform) < MAX_ACTIONS_PER_TURN:
        buildable_nodes = game_state.get_buildable_nodes()
        
        for node_id in buildable_nodes:
            if len(actions_to_perform) >= MAX_ACTIONS_PER_TURN:
                break
                
            if node_id in targeted_nodes:
                continue
                
            node = nodes.get(node_id)
            if not node:
                continue
            
            node_type = node.get('type', 'data')
            
            # Строим miner для генерации DP
            miner_actions = [a for a in available_actions 
                           if a['action'] == 'build_miner' and a['targetNodeId'] == node_id]
            if miner_actions and current_dp >= 20:
                actions_to_perform.append(miner_actions[0])
                current_dp -= 20
                targeted_nodes.add(node_id)
                print(f"   ⛏️ Строим miner на {node_id}")
                break
    
    # 3. АПГРЕЙД (если есть ресурсы)
    if current_dp >= 30 and len(actions_to_perform) < MAX_ACTIONS_PER_TURN:
        upgrade_actions = [a for a in available_actions if a['action'] == 'upgrade_hub']
        if upgrade_actions:
            actions_to_perform.append(upgrade_actions[0])
            print("   ⬆️ Апгрейд hub")
    
    # 4. ОЖИДАНИЕ (если ничего не выбрали)
    if not actions_to_perform:
        wait_actions = [a for a in available_actions if a['action'] == 'wait']
        if wait_actions:
            actions_to_perform.append(wait_actions[0])
            print("   ⏳ Ожидание")
    
    return actions_to_perform

def main():
    """Основная функция"""
    test_network_growth_strategy(games_count=5)

if __name__ == "__main__":
    main() 