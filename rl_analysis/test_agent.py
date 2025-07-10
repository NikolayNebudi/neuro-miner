#!/usr/bin/env python3
"""
Тестирование обученного эволюционного агента
"""

import json
import subprocess
import pickle
import os
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
    """Сыграть одну игру с агентом"""
    
    # Запуск headless движка
    process = subprocess.Popen(
        ['node', 'game_engine_headless.js'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    try:
        # Сброс игры
        reset_cmd = json.dumps({'cmd': 'reset'}) + '\n'
        process.stdin.write(reset_cmd)
        process.stdin.flush()
        
        response = process.stdout.readline()
        game_state = GameState(json.loads(response))
        
        total_reward = 0.0
        steps = 0
        max_steps = 1000
        
        while not game_state.done and steps < max_steps:
            # Получить возможные действия
            actions_cmd = json.dumps({'cmd': 'get_actions'}) + '\n'
            process.stdin.write(actions_cmd)
            process.stdin.flush()
            
            # Читаем stderr для отладочных сообщений
            try:
                import select
                if select.select([process.stderr], [], [], 0.1)[0]:
                    stderr_line = process.stderr.readline()
                    if stderr_line:
                        print(f"DEBUG JS: {stderr_line.strip()}")
            except:
                pass  # Игнорируем ошибки чтения stderr
            
            response = process.stdout.readline()
            available_actions = json.loads(response)['actions']
            
            # ЛОГИРОВАНИЕ доступных действий
            print(f"Шаг {steps+1}: Доступные действия: {available_actions}")
            
            if not available_actions:
                print("Нет доступных действий, агент ждёт.")
                break
            
            # Выбрать действие на основе генома агента
            action = select_action(agent, game_state, available_actions)
            print(f"Шаг {steps+1}: Агент выбрал действие: {action}")
            
            # Выполнить действие
            action_cmd = json.dumps({'cmd': 'step', 'action': action}) + '\n'
            process.stdin.write(action_cmd)
            process.stdin.flush()
            
            # Читаем stderr для отладочных сообщений
            try:
                import select
                if select.select([process.stderr], [], [], 0.1)[0]:
                    stderr_line = process.stderr.readline()
                    if stderr_line:
                        print(f"DEBUG JS: {stderr_line.strip()}")
            except:
                pass  # Игнорируем ошибки чтения stderr
            
            response = process.stdout.readline()
            result = json.loads(response)
            
            # Обновить состояние игры
            game_state = GameState(result['newState'])
            total_reward += result.get('reward', 0)
            
            # ЛОГИРОВАНИЕ краткой статистики
            stats = game_state.stats
            print(f"Шаг {steps+1}: DP={stats.get('dp', 0)}, CPU={stats.get('cpu', 0)}, PlayerNodes={stats.get('playerNodes', 0)}, Trace={stats.get('traceLevel', 0):.1f}")
            
            # ПОДРОБНОЕ ЛОГИРОВАНИЕ карты и нод
            if steps % 50 == 0 or steps < 10:  # Логируем каждые 50 шагов и первые 10
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
        
        # Дополнительные бонусы
        if game_state.win:
            total_reward += 1000
        elif game_state.done and not game_state.win:
            total_reward -= 500
        
        # Бонусы за статистику
        stats = game_state.stats
        total_reward += stats.get('dp', 0) * 0.1
        total_reward += stats.get('playerNodes', 0) * 10
        total_reward -= stats.get('traceLevel', 0) * 0.5
        
        process.terminate()
        return total_reward, game_state.win, stats
        
    except Exception as e:
        process.terminate()
        raise e

def select_action(agent: EvolutionAgent, game_state: GameState, available_actions: list) -> dict:
    """Выбрать действие на основе стратегии и генома агента"""
    import random
    import numpy as np

    # 1. Сначала ищем все нейтральные соседние ноды, которые можно захватить и которые не isCapturing
    capturable = []
    for node_id in game_state.get_capturable_nodes():
        node = game_state.nodes[node_id]
        if not node.get('isCapturing', False):
            capturable.append(node_id)
    if 'capture' in available_actions and capturable:
        return {'action': 'capture', 'targetNodeId': capturable[0]}

    # 2. Строим на полностью захваченных нодах без программ
    buildable = game_state.get_buildable_nodes()
    if buildable:
        for build_action in ['build_miner', 'build_sentry', 'build_shield', 'build_overclocker']:
            if build_action in available_actions:
                return {'action': build_action, 'targetNodeId': buildable[0]}

    # 3. Апгрейдим программы на своих нодах
    upgradable = game_state.get_upgradable_nodes()
    if 'upgrade' in available_actions and upgradable:
        return {'action': 'upgrade', 'targetNodeId': upgradable[0]}

    # 4. Остальные действия — по весам генома
    weights = agent.get_action_weights(game_state)
    filtered = [(a, weights.get(a, 0)) for a in available_actions]
    filtered = [f for f in filtered if f[1] > 0]
    if filtered:
        actions, ws = zip(*filtered)
        chosen = np.random.choice(actions, p=np.array(ws)/np.sum(ws))
        if chosen in ['network_capture', 'upgrade_hub', 'emp_blast']:
            return {'action': chosen}
        else:
            # Для действий, требующих targetNodeId, выбираем случайную подходящую ноду
            if chosen.startswith('build') and buildable:
                return {'action': chosen, 'targetNodeId': buildable[0]}
            if chosen == 'upgrade' and upgradable:
                return {'action': chosen, 'targetNodeId': upgradable[0]}
            if chosen == 'capture' and capturable:
                return {'action': chosen, 'targetNodeId': capturable[0]}
    # 5. Если ничего не подошло — wait
    return {'action': 'wait'}

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
    action_names = [
        'build_miner', 'build_sentry', 'build_shield', 'build_overclocker',
        'upgrade', 'capture', 'upgrade_hub', 'emp_blast', 'network_capture', 'wait'
    ]
    
    print("📊 Базовые предпочтения действий:")
    for i, action in enumerate(action_names):
        if i < len(genome):
            weight = genome[i]
            preference = "ПОЗИТИВНОЕ" if weight > 0 else "НЕГАТИВНОЕ"
            strength = abs(weight)
            print(f"   {action}: {preference} (сила: {strength:.3f})")
    
    print(f"\n🧬 Размер генома: {len(genome)}")
    print(f"📈 Фитнес агента: {agent.fitness:.2f}")

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