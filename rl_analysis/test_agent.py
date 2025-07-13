#!/usr/bin/env python3
"""
Тестирование обученного эволюционного агента
"""

import json
import subprocess
import pickle
import os
import random
import numpy as np
from evolution_agent import EvolutionAgent, GameState

def test_agent(games_count: int = 10):
    """Тестирование обученного агента"""
    print("🤖 Тестирование агента из best_agent.pkl")
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
            reward, win, stats = play_single_game(agent)
            
            result = {
                'game': game_num,
                'score': reward,
                'win': win,
                'stats': stats
            }
            game_results.append(result)
            
            status = "ПОБЕДА" if win else "ПОРАЖЕНИЕ"
            print(f"   Результат: {status}")
            print(f"   Счет: {reward:.2f}")
            print(f"   DP: {stats.get('dp', 0)}")
            print(f"   CPU: {stats.get('cpu', 0)}")
            print(f"   Ноды игрока: {stats.get('playerNodes', 0)}")
            print(f"   Trace Level: {stats.get('traceLevel', 0):.1f}")
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
    best_score = max(r['score'] for r in game_results)
    worst_score = min(r['score'] for r in game_results)
    
    print("📊 ИТОГОВАЯ СТАТИСТИКА:")
    print(f"   Побед: {wins}/{len(game_results)} ({wins/len(game_results)*100:.1f}%)")
    print(f"   Средний счет: {avg_score:.2f}")
    print(f"   Лучший счет: {best_score:.2f}")
    print(f"   Худший счет: {worst_score:.2f}")
    print()
    
    print("📈 ДЕТАЛЬНАЯ СТАТИСТИКА:")
    for result in game_results:
        status = "ПОБЕДА" if result['win'] else "ПОРАЖЕНИЕ"
        print(f"   Игра {result['game']}: {result['score']:.2f} ({status})")

def play_single_game(agent: EvolutionAgent) -> tuple:
    """Сыграть одну игру с агентом с поддержкой мультидействий и строгой проверкой рассинхрона"""
    
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
        
        while not game_state.done and steps < max_steps:
            actions_cmd = json.dumps({'cmd': 'get_actions'}) + '\n'
            process.stdin.write(actions_cmd)
            process.stdin.flush()
            
            try:
                import select
                if select.select([process.stderr], [], [], 0.1)[0]:
                    stderr_line = process.stderr.readline()
                    if stderr_line:
                        print(f"DEBUG JS: {stderr_line.strip()}")
            except:
                pass
            
            response = process.stdout.readline()
            available_actions = json.loads(response)['actions']
            print(f"Шаг {steps+1}: Доступные действия: {available_actions}")
            
            if not available_actions:
                print("Нет доступных действий, агент ждёт.")
                break
            
            # Используем новую функцию выбора действий
            actions = select_actions(agent, game_state, available_actions)
            print(f"Шаг {steps+1}: Агент выбрал пул действий: {actions}")
            
            # СТРОГАЯ ПРОВЕРКА: все действия должны быть в available_actions
            for action in actions:
                if action not in available_actions:
                    print(f"❌ ОШИБКА: Агент выбрал действие, которого нет в списке доступных!")
                    print(f"Выбрано: {action}")
                    print(f"Доступные: {available_actions}")
                    raise RuntimeError("Рассинхрон: выбранное действие отсутствует в available_actions")
            
            # Отправляем действия в движок
            action_cmd = json.dumps({'cmd': 'step', 'actions': actions}) + '\n'
            process.stdin.write(action_cmd)
            process.stdin.flush()
            try:
                import select
                if select.select([process.stderr], [], [], 0.1)[0]:
                    stderr_line = process.stderr.readline()
                    if stderr_line:
                        print(f"DEBUG JS: {stderr_line.strip()}")
            except:
                pass
            response = process.stdout.readline()
            result = json.loads(response)
            executed = result.get('executed_actions') or result.get('performedActions')
            # СТРОГАЯ ПРОВЕРКА: все ли действия реально выполнены
            for i, act in enumerate(actions):
                if not executed or i >= len(executed) or not executed[i]['success']:
                    print(f"❌ ОШИБКА: Действие не выполнено движком! {executed}")
                    raise RuntimeError("Рассинхрон: не все действия выполнены движком")
                if executed[i]['action'] != act:
                    print(f"❌ ОШИБКА: Рассинхрон между выбранным и выполненным действием! {executed}")
                    raise RuntimeError("Рассинхрон: действия не совпадают")
            game_state = GameState(result['newState'])
            total_reward += result.get('reward', 0)
            stats = game_state.stats
            print(f"Шаг {steps+1}: DP={stats.get('dp', 0)}, CPU={stats.get('cpu', 0)}, PlayerNodes={stats.get('playerNodes', 0)}, Trace={stats.get('traceLevel', 0):.1f}")
            
            if steps % 50 == 0 or steps < 10:
                print(f"=== ДЕТАЛЬНАЯ КАРТА (шаг {steps+1}) ===")
                print(f"Ноды: {game_state.nodes}")
                print(f"Статистика: {game_state.stats}")
                print(f"Враги: {game_state.enemies}")
                print(f"Владельцы нод:")
                if game_state.nodes:
                    for node_id, node_data in game_state.nodes.items():
                        owner = node_data.get('owner', 'none')
                        print(f"  {node_id}: {owner}")
                else:
                    print("  Ноды не найдены в состоянии")
                print("=" * 50)
            
            steps += 1
        
        if game_state.win:
            total_reward += 1000
        elif game_state.done and not game_state.win:
            total_reward -= 500
        stats = game_state.stats
        total_reward += stats.get('dp', 0) * 0.1
        total_reward += stats.get('playerNodes', 0) * 10
        total_reward -= stats.get('traceLevel', 0) * 0.5
        process.terminate()
        return total_reward, game_state.win, stats
    except Exception as e:
        process.terminate()
        raise e

def select_actions(agent: EvolutionAgent, game_state: GameState, available_actions: list) -> list:
    """
    Единая функция "мозга" агента, использующая геном для принятия решений
    Возвращает список действий для выполнения за один ход
    """
    
    # === МАППИНГ ГЕНОМА ===
    # Убеждаемся, что геном достаточно длинный
    genome = agent.genome
    if len(genome) < 50:  # Минимальная длина генома
        # Расширяем numpy array до нужной длины
        additional_genes = np.random.uniform(-1.0, 1.0, 50 - len(genome))
        genome = np.concatenate([genome, additional_genes])
    
    # --- Пороговые значения (0-200) ---
    CRITICAL_TRACE_THRESHOLD = abs(genome[0]) * 200  # Критический уровень trace
    HIGH_TRACE_THRESHOLD = abs(genome[1]) * 150      # Высокий уровень trace
    LOW_DP_THRESHOLD = abs(genome[2]) * 50           # Порог нехватки DP
    SAVE_CPU_FOR_EMP_THRESHOLD = abs(genome[3]) * 100 # Порог сохранения CPU для EMP
    
    # --- Веса для оценки действий (-1.0 до 1.0) ---
    CAPTURE_NEIGHBOR_WEIGHT = genome[4]              # Вес соседних нод при захвате
    CAPTURE_RESISTANCE_PENALTY = genome[5]           # Штраф за сопротивление
    CAPTURE_CPU_NODE_BONUS = genome[6]               # Бонус за CPU ноды
    CAPTURE_DATA_CACHE_BONUS = genome[7]             # Бонус за кэш ноды
    BUILD_MINER_WEIGHT = genome[8]                   # Вес строительства майнера
    BUILD_SENTRY_WEIGHT = genome[9]                  # Вес строительства sentry
    BUILD_OVERCLOCKER_WEIGHT = genome[10]            # Вес строительства overclocker
    UPGRADE_WEIGHT = genome[11]                      # Вес апгрейда
    NETWORK_CAPTURE_WEIGHT = genome[12]              # Вес network_capture
    EMP_BLAST_WEIGHT = genome[13]                    # Вес EMP blast
    WAIT_WEIGHT = genome[14]                         # Вес ожидания
    
    # --- Стратегические параметры ---
    MAX_ACTIONS_PER_TURN = int(abs(genome[15]) * 5) + 1  # Максимум действий за ход
    DEFENSE_PRIORITY = genome[16]                   # Приоритет защиты
    ECONOMY_PRIORITY = genome[17]                   # Приоритет экономики
    AGGRESSION_PRIORITY = genome[18]                # Приоритет агрессии
    
    # === АНАЛИЗ СОСТОЯНИЯ ИГРЫ ===
    stats = game_state.stats
    dp = stats.get('dp', 0)
    cpu = stats.get('cpu', 0)
    trace_level = stats.get('traceLevel', 0)
    player_nodes = stats.get('playerNodes', 0)
    total_nodes = stats.get('totalNodes', 1)
    capture_percentage = (player_nodes / total_nodes) * 100
    
    nodes = game_state.nodes
    enemies = game_state.enemies
    
    # Анализ нод
    player_node_ids = [node_id for node_id, node_data in nodes.items() 
                      if node_data.get('owner') == 'player']
    neutral_nodes = [node_id for node_id, node_data in nodes.items() 
                    if node_data.get('owner') == 'neutral']
    
    # Ноды под угрозой
    nodes_under_threat = []
    if enemies:
        for enemy in enemies:
            enemy_node = enemy.get('currentNodeId')
            if enemy_node:
                enemy_node_data = nodes.get(enemy_node)
                if enemy_node_data:
                    neighbors = enemy_node_data.get('neighbors', [])
                    for neighbor in neighbors:
                        neighbor_data = nodes.get(neighbor)
                        if neighbor_data and neighbor_data.get('owner') == 'player':
                            nodes_under_threat.append(neighbor)
    
    print(f"🔍 АНАЛИЗ СИТУАЦИИ:")
    print(f"   DP: {dp}, CPU: {cpu}, Trace: {trace_level:.1f}")
    print(f"   Ноды игрока: {len(player_node_ids)}, Захват: {capture_percentage:.1f}%")
    print(f"   Под угрозой: {len(set(nodes_under_threat))}, Врагов: {len(enemies)}")
    
    # === ИНИЦИАЛИЗАЦИЯ МУЛЬТИ-ДЕЙСТВИЙ ===
    actions_to_perform = []
    targeted_nodes = set()
    current_dp = dp
    current_cpu = cpu
    

    
    # === АЛГОРИТМ ВЫБОРА ДЕЙСТВИЙ ===
    
    # 1. КРИТИЧЕСКИЕ СИТУАЦИИ (выполняются в первую очередь)
    if trace_level > CRITICAL_TRACE_THRESHOLD:
        print(f"   🚨 КРИТИЧЕСКИ ВЫСОКИЙ TRACE ({trace_level:.1f} > {CRITICAL_TRACE_THRESHOLD:.1f})")
        network_actions = [a for a in available_actions if a['action'] == 'network_capture']
        if network_actions:
            actions_to_perform.append(random.choice(network_actions))
            print("   ✅ Выбираем network_capture для снижения trace")
            return actions_to_perform
    
    # 2. ПОБЕДНЫЕ ДЕЙСТВИЯ (capture_web) - ЭВОЛЮЦИОННАЯ ЛОГИКА
    capture_web_actions = [a for a in available_actions if a['action'] == 'capture_web']
    if capture_web_actions:
        # Используем геном для расчета приоритета capture_web
        capture_web_priority = genome[5] * 5.0 + 3.0  # Высокий базовый приоритет
        print(f"   🏆 ПРИОРИТЕТ: Capture web - финальная победа! (приоритет: {capture_web_priority:.2f})")
        return [capture_web_actions[0]]
    
    # 3. ЗАХВАТ HUB (если доступен)
    hub_capture_actions = [a for a in available_actions 
                          if a['action'] == 'capture' and a.get('targetNodeId') == 'hub']
    if hub_capture_actions and current_dp >= 10:
        print("   🏆 ПРИОРИТЕТ: Захват HUB!")
        actions_to_perform.append(hub_capture_actions[0])
        current_dp -= 10
        targeted_nodes.add('hub')
    
    # 4. ЗАЩИТА НОД ПОД УГРОЗОЙ
    if nodes_under_threat and DEFENSE_PRIORITY > 0:
        print(f"   🛡️ Защита нод под угрозой (приоритет: {DEFENSE_PRIORITY:.2f})")
        for threatened_node in set(nodes_under_threat):
            if threatened_node in targeted_nodes:
                continue
                
            # Строим sentry
            sentry_actions = [a for a in available_actions 
                            if a['action'] == 'build_sentry' and a['targetNodeId'] == threatened_node]
            if sentry_actions and current_dp >= 40:
                actions_to_perform.append(random.choice(sentry_actions))
                current_dp -= 40
                targeted_nodes.add(threatened_node)
                print(f"   🛡️ Строим sentry на {threatened_node}")
                break
            
            # Строим shield
            shield_actions = [a for a in available_actions 
                            if a['action'] == 'build_shield' and a['targetNodeId'] == threatened_node]
            if shield_actions and current_dp >= 30:
                actions_to_perform.append(random.choice(shield_actions))
                current_dp -= 30
                targeted_nodes.add(threatened_node)
                print(f"   🛡️ Строим shield на {threatened_node}")
                break
    
    # 5. СТРАТЕГИЧЕСКИЕ ДЕЙСТВИЯ (при высоком trace)
    if trace_level > HIGH_TRACE_THRESHOLD:
        print(f"   ⚠️ ВЫСОКИЙ TRACE ({trace_level:.1f} > {HIGH_TRACE_THRESHOLD:.1f})")
        network_actions = [a for a in available_actions if a['action'] == 'network_capture']
        if network_actions and NETWORK_CAPTURE_WEIGHT > 0:
            actions_to_perform.append(random.choice(network_actions))
            print("   ✅ Добавляем network_capture")
    
    # 6. ЗАХВАТ ВЫГОДНЫХ НОД (УЛУЧШЕННАЯ ЭВОЛЮЦИОННАЯ ЛОГИКА)
    if capture_percentage < 60:
        # Используем геном для расчета приоритета захвата
        capture_priority = genome[0] * 3.0 + 2.0  # Увеличенный базовый приоритет
        print(f"   🎯 Захват нод (приоритет: {capture_priority:.2f})")
        
        # Приоритет захвата на основе процента захвата
        if capture_percentage < 30:
            capture_priority *= 4.0  # Критически важно захватывать
        elif capture_percentage < 50:
            capture_priority *= 2.5  # Очень важно захватывать
        elif capture_percentage < 60:
            capture_priority *= 1.5  # Важно достичь 60%
        
        capture_actions = [a for a in available_actions if a['action'] == 'capture']
        
        for action in capture_actions:
            if len(actions_to_perform) >= MAX_ACTIONS_PER_TURN:
                break
                
            target_node_id = action['targetNodeId']
            if target_node_id in targeted_nodes:
                continue
                
            target_node = nodes.get(target_node_id)
            if not target_node:
                continue
            
            # Оценка ноды для равномерного развития сети
            score = evaluate_node_for_network_growth(target_node_id, target_node, nodes, player_node_ids)
            
            # Дополнительные бонусы на основе генома
            node_type = target_node.get('type', 'data')
            resistance = target_node.get('resistance', 50)
            
            # Бонусы за тип ноды (используем геном)
            if node_type == 'cpu_node':
                score += genome[1] * 50 + 25  # Уменьшенный бонус для CPU нод
            elif node_type == 'data_cache':
                score += genome[2] * 30 + 15   # Уменьшенный бонус для data_cache
            
            # Штраф за сопротивление (используем геном)
            resistance_penalty = genome[4] * 1.0 + 0.5
            score -= resistance * resistance_penalty

            # Финальная оценка с приоритетом захвата
            final_score = score * capture_priority

            if final_score > 0 and current_dp >= 10:
                actions_to_perform.append(action)
                current_dp -= 10
                targeted_nodes.add(target_node_id)
                print(f"   🎯 Захватываем {target_node_id} (оценка: {final_score:.1f})")
    
    # 7. ЭКОНОМИЧЕСКОЕ РАЗВИТИЕ
    if current_dp < LOW_DP_THRESHOLD and ECONOMY_PRIORITY > 0:
        print(f"   💰 Развитие экономики (приоритет: {ECONOMY_PRIORITY:.2f})")
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
            if miner_actions and current_dp >= 20 and BUILD_MINER_WEIGHT > 0:
                actions_to_perform.append(random.choice(miner_actions))
                current_dp -= 20
                targeted_nodes.add(node_id)
                print(f"   ⛏️ Строим miner на {node_id}")
                break
            
            # Строим overclocker на CPU-нодах
            overclocker_actions = [a for a in available_actions 
                                 if a['action'] == 'build_overclocker' and a['targetNodeId'] == node_id]
            if overclocker_actions and current_dp >= 25 and node_type == 'cpu_node' and BUILD_OVERCLOCKER_WEIGHT > 0:
                actions_to_perform.append(random.choice(overclocker_actions))
                current_dp -= 25
                targeted_nodes.add(node_id)
                print(f"   ⚡ Строим overclocker на {node_id}")
                break
    
    # 8. АПГРЕЙД ПРОГРАММ
    if current_dp >= 30 and UPGRADE_WEIGHT > 0:
        print(f"   ⬆️ Апгрейд программ (приоритет: {UPGRADE_WEIGHT:.2f})")
        
        # Апгрейд hub
        hub_upgrade_actions = [a for a in available_actions if a['action'] == 'upgrade_hub']
        if hub_upgrade_actions:
            actions_to_perform.append(hub_upgrade_actions[0])
            print("   ⬆️ Апгрейд hub")
        
        # Апгрейд других программ
        upgrade_actions = [a for a in available_actions if a['action'] == 'upgrade']
        for action in upgrade_actions:
            if len(actions_to_perform) >= MAX_ACTIONS_PER_TURN:
                break
                
            target_node_id = action.get('targetNodeId')
            if target_node_id in targeted_nodes:
                continue
                
            actions_to_perform.append(action)
            targeted_nodes.add(target_node_id)
            print(f"   ⬆️ Апгрейд {target_node_id}")
    
    # 9. СТРАТЕГИЧЕСКИЕ ДЕЙСТВИЯ
    if current_cpu >= SAVE_CPU_FOR_EMP_THRESHOLD and enemies and EMP_BLAST_WEIGHT > 0:
        print(f"   💥 EMP blast против врагов (приоритет: {EMP_BLAST_WEIGHT:.2f})")
        emp_actions = [a for a in available_actions if a['action'] == 'emp_blast']
        if emp_actions:
            actions_to_perform.append(random.choice(emp_actions))
            print("   💥 Добавляем EMP blast")
    
    # 10. ОЖИДАНИЕ (если ничего не выбрали)
    if not actions_to_perform:
        wait_actions = [a for a in available_actions if a['action'] == 'wait']
        if wait_actions:
            actions_to_perform.append(wait_actions[0])
            print("   ⏳ Ожидание")
        else:
            # Фолбэк - случайное действие
            actions_to_perform.append(random.choice(available_actions))
            print("   🎲 Случайное действие")
    
    print(f"   📊 Выбрано действий: {len(actions_to_perform)}")
    return actions_to_perform

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

def analyze_agent_strategy(agent_file: str = 'best_agent.pkl'):
    """Анализировать стратегию агента"""
    
    if not os.path.exists(agent_file):
        print(f"❌ Файл агента {agent_file} не найден!")
        return
    
    # Загружаем агента
    with open(agent_file, 'rb') as f:
        agent = pickle.load(f)
    
    print(f"🔍 Анализ стратегии агента из {agent_file}")
    print("-" * 50)
    
    # Анализируем геном
    genome = agent.genome
    print(f"🧬 Размер генома: {len(genome)}")
    print(f"📈 Фитнес агента: {agent.fitness:.2f}")
    
    # Показываем ключевые параметры
    print("\n📊 Ключевые параметры стратегии:")
    print(f"   Критический trace: {abs(genome[0]) * 200:.1f}")
    print(f"   Высокий trace: {abs(genome[1]) * 150:.1f}")
    print(f"   Порог DP: {abs(genome[2]) * 50:.1f}")
    print(f"   Порог CPU: {abs(genome[3]) * 100:.1f}")
    print(f"   Макс действий за ход: {int(abs(genome[15]) * 5) + 1}")
    
    print(f"\n🎯 Приоритеты:")
    print(f"   Защита: {genome[16]:.3f}")
    print(f"   Экономика: {genome[17]:.3f}")
    print(f"   Агрессия: {genome[18]:.3f}")
    
    print(f"\n⚖️ Веса действий:")
    action_names = ['Miner', 'Sentry', 'Overclocker', 'Upgrade', 'Network', 'EMP', 'Wait']
    action_weights = [genome[8], genome[9], genome[10], genome[11], genome[12], genome[13], genome[14]]
    
    for name, weight in zip(action_names, action_weights):
        preference = "ПОЗИТИВНОЕ" if weight > 0 else "НЕГАТИВНОЕ"
        print(f"   {name}: {preference} ({weight:.3f})")

def main():
    """Основная функция"""
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == 'test':
            games_count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
            test_agent(games_count=games_count)
        
        elif command == 'analyze':
            analyze_agent_strategy()
        
        else:
            print("❌ Неизвестная команда!")
            print("Использование:")
            print("  python test_agent.py test [количество_игр]")
            print("  python test_agent.py analyze")
    
    else:
        # По умолчанию запускаем тест
        test_agent()

if __name__ == "__main__":
    main() 