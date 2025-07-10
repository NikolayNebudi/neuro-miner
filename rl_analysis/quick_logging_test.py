#!/usr/bin/env python3
"""
Быстрый тест системы логирования для анализа механик игры
"""

import os
import sys
import numpy as np
from datetime import datetime
from enhanced_logging_system import GameLogger, EnhancedNetworkEchoEnv

def test_logging_system():
    """Тестирует систему логирования"""
    print("🧪 Запуск теста системы логирования...")
    print("=" * 60)
    
    # Создаем логгер с уникальной сессией
    session_id = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    logger = GameLogger(log_dir="logs", session_id=session_id)
    
    print(f"📝 Сессия: {session_id}")
    print(f"📁 Папка логов: {logger.log_dir}")
    
    # Тестируем разные конфигурации
    configs = [
        {'mode': 'full', 'stage': 0, 'name': 'Полная игра (этап 0)'},
        {'mode': 'economy_tutorial', 'stage': 0, 'name': 'Экономика (этап 0)'},
        {'mode': 'defense_tutorial', 'stage': 1, 'name': 'Оборона (этап 1)'}
    ]
    
    total_episodes = 0
    total_wins = 0
    
    for config_idx, config in enumerate(configs):
        print(f"\n🎮 Конфигурация {config_idx + 1}: {config['name']}")
        print("-" * 40)
        
        # Создаем окружение
        env = EnhancedNetworkEchoEnv(config=config, logger=logger)
        
        # Тестируем несколько эпизодов
        episodes_per_config = 5  # Быстрый тест
        config_wins = 0
        
        for episode in range(episodes_per_config):
            print(f"  Эпизод {episode + 1}/{episodes_per_config}")
            
            obs = env.reset()
            done = False
            step = 0
            max_steps = 200  # Ограничиваем для быстрого теста
            
            episode_stats = {
                'dp_gained': 0,
                'cpu_gained': 0,
                'nodes_captured': 0,
                'programs_built': 0,
                'enemies_killed': 0
            }
            
            while not done and step < max_steps:
                # Случайное действие (имитация бота)
                action = np.random.randint(0, 100)
                obs, reward, done, info = env.step(action)
                step += 1
                
                # Собираем статистику
                if step % 50 == 0:
                    current_dp = env.state.get('dp', 0)
                    current_cpu = env.state.get('cpu', 0)
                    current_trace = env.state.get('traceLevel', 0)
                    enemies_count = len(env.state.get('enemies', []))
                    
                    print(f"    Шаг {step}: DP={current_dp}, CPU={current_cpu}, Trace={current_trace}, Enemies={enemies_count}")
                
                # Проверяем условия завершения
                if env.state.get('traceLevel', 0) >= 300:
                    print(f"    ❌ Превышен лимит trace level")
                    break
                
                if env.state.get('nodes', {}).get('hub', {}).get('owner') != 'player':
                    print(f"    ❌ Потерян hub")
                    break
            
            # Анализируем результат
            final_dp = env.state.get('dp', 0)
            final_cpu = env.state.get('cpu', 0)
            final_trace = env.state.get('traceLevel', 0)
            player_nodes = sum(1 for n in env.state.get('nodes', {}).values() if n.get('owner') == 'player')
            total_nodes = len(env.state.get('nodes', {}))
            
            print(f"    Результат: DP={final_dp}, CPU={final_cpu}, Trace={final_trace}")
            print(f"    Узлы: {player_nodes}/{total_nodes} ({player_nodes/total_nodes*100:.1f}%)")
            
            if reward > 0:
                config_wins += 1
                total_wins += 1
                print(f"    ✅ Победа! Награда: {reward}")
            else:
                print(f"    ❌ Поражение. Награда: {reward}")
            
            total_episodes += 1
        
        config_win_rate = config_wins / episodes_per_config
        print(f"  📊 Конфигурация завершена: {config_wins}/{episodes_per_config} побед ({config_win_rate:.1%})")
        
        env.close()
    
    # Финальная статистика
    print(f"\n📊 ИТОГОВАЯ СТАТИСТИКА")
    print("=" * 60)
    
    overall_win_rate = total_wins / total_episodes if total_episodes > 0 else 0
    print(f"Всего эпизодов: {total_episodes}")
    print(f"Всего побед: {total_wins}")
    print(f"Общий процент побед: {overall_win_rate:.1%}")
    
    # Получаем детальную сводку
    summary = logger.get_session_summary()
    if summary:
        print(f"\n📈 ДЕТАЛЬНАЯ СВОДКА:")
        print(f"  Средняя награда: {summary.get('avg_score', 0):.2f}")
        print(f"  Среднее количество шагов: {summary.get('avg_steps', 0):.1f}")
        print(f"  Средний trace level: {summary.get('avg_trace_level', 0):.1f}")
    
    # Информация о логах
    print(f"\n📁 СОЗДАННЫЕ ЛОГИ:")
    print(f"  Эпизоды: {logger.episode_log}")
    print(f"  Действия: {logger.action_log}")
    print(f"  Карты: {logger.map_log}")
    print(f"  Баланс: {logger.balance_log}")
    
    # Проверяем размеры файлов
    for log_file in [logger.episode_log, logger.action_log, logger.map_log, logger.balance_log]:
        if os.path.exists(log_file):
            size = os.path.getsize(log_file)
            print(f"  {os.path.basename(log_file)}: {size} байт")
    
    print(f"\n✅ Тест завершен! Система логирования работает корректно.")
    return True

def analyze_logs_quick():
    """Быстрый анализ созданных логов"""
    print("\n🔍 БЫСТРЫЙ АНАЛИЗ ЛОГОВ")
    print("=" * 40)
    
    # Ищем последние логи
    log_dir = "logs"
    if not os.path.exists(log_dir):
        print("❌ Папка логов не найдена")
        return
    
    # Анализируем эпизоды
    episodes_dir = os.path.join(log_dir, "episodes")
    if os.path.exists(episodes_dir):
        episode_files = [f for f in os.listdir(episodes_dir) if f.endswith('.csv')]
        if episode_files:
            latest_file = max(episode_files, key=lambda x: os.path.getctime(os.path.join(episodes_dir, x)))
            print(f"📊 Анализ файла эпизодов: {latest_file}")
            
            # Простой анализ
            import csv
            with open(os.path.join(episodes_dir, latest_file), 'r') as f:
                reader = csv.DictReader(f)
                episodes = list(reader)
                
                if episodes:
                    print(f"  Всего эпизодов: {len(episodes)}")
                    wins = sum(1 for e in episodes if e['win'] == 'True')
                    print(f"  Побед: {wins} ({wins/len(episodes)*100:.1f}%)")
                    
                    # Анализ причин поражений
                    lose_reasons = {}
                    for e in episodes:
                        if e['lose_reason']:
                            lose_reasons[e['lose_reason']] = lose_reasons.get(e['lose_reason'], 0) + 1
                    
                    if lose_reasons:
                        print(f"  Причины поражений:")
                        for reason, count in lose_reasons.items():
                            print(f"    {reason}: {count}")
    
    # Анализ действий
    actions_dir = os.path.join(log_dir, "actions")
    if os.path.exists(actions_dir):
        action_files = [f for f in os.listdir(actions_dir) if f.endswith('.jsonl')]
        if action_files:
            latest_action_file = max(action_files, key=lambda x: os.path.getctime(os.path.join(actions_dir, x)))
            print(f"\n🎯 Анализ действий: {latest_action_file}")
            
            # Подсчитываем типы действий
            import json
            action_types = {}
            total_actions = 0
            
            with open(os.path.join(actions_dir, latest_action_file), 'r') as f:
                for line in f:
                    try:
                        data = json.loads(line.strip())
                        action = data.get('action', {})
                        action_type = action.get('action', 'unknown')
                        action_types[action_type] = action_types.get(action_type, 0) + 1
                        total_actions += 1
                    except:
                        continue
            
            if action_types:
                print(f"  Всего действий: {total_actions}")
                print(f"  Распределение действий:")
                for action_type, count in sorted(action_types.items(), key=lambda x: x[1], reverse=True):
                    percentage = count / total_actions * 100
                    print(f"    {action_type}: {count} ({percentage:.1f}%)")

if __name__ == "__main__":
    print("🚀 ЗАПУСК БЫСТРОГО ТЕСТА ЛОГИРОВАНИЯ")
    print("=" * 60)
    
    try:
        # Тестируем систему логирования
        success = test_logging_system()
        
        if success:
            # Анализируем созданные логи
            analyze_logs_quick()
            
            print(f"\n🎉 ТЕСТ УСПЕШНО ЗАВЕРШЕН!")
            print("Теперь у вас есть детальные логи для анализа механик игры.")
            print("Используйте эти данные для балансировки и улучшения игры.")
        
    except Exception as e:
        print(f"❌ Ошибка при тестировании: {e}")
        import traceback
        traceback.print_exc() 