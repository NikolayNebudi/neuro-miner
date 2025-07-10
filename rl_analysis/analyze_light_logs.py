#!/usr/bin/env python3
"""
Анализ легких логов обучения
"""

import json
import os
import pandas as pd
import numpy as np
from collections import defaultdict, Counter
from datetime import datetime

def analyze_light_logs():
    """Анализирует легкие логи обучения"""
    print("📊 АНАЛИЗ ЛЕГКИХ ЛОГОВ ОБУЧЕНИЯ")
    print("=" * 50)
    
    # Ищем файлы легких логов
    log_files = [f for f in os.listdir('.') if f.startswith('light_log_') and f.endswith('.jsonl')]
    
    if not log_files:
        print("📭 Файлы легких логов не найдены")
        return
    
    print(f"📁 Найдено файлов логов: {len(log_files)}")
    
    for log_file in log_files:
        analyze_single_light_log(log_file)

def analyze_single_light_log(log_file):
    """Анализирует один файл легких логов"""
    print(f"\n📋 АНАЛИЗ ФАЙЛА: {log_file}")
    print("-" * 40)
    
    file_size = os.path.getsize(log_file) / (1024 * 1024)  # MB
    print(f"📁 Размер файла: {file_size:.2f} MB")
    
    # Анализируем содержимое
    episode_starts = []
    episode_ends = []
    actions = []
    
    with open(log_file, 'r') as f:
        for line in f:
            try:
                data = json.loads(line)
                entry_type = data.get('type')
                
                if entry_type == 'episode_start':
                    episode_starts.append(data)
                elif entry_type == 'episode_end':
                    episode_ends.append(data)
                elif entry_type == 'action':
                    actions.append(data)
                    
            except Exception as e:
                continue
    
    print(f"📊 СТАТИСТИКА ЗАПИСЕЙ:")
    print(f"  🎮 Начало эпизодов: {len(episode_starts)}")
    print(f"  🏁 Завершение эпизодов: {len(episode_ends)}")
    print(f"  ⚡ Действия: {len(actions)}")
    
    if episode_ends:
        analyze_episode_results(episode_ends)
    
    if actions:
        analyze_actions(actions)

def analyze_episode_results(episode_ends):
    """Анализирует результаты эпизодов"""
    print(f"\n🎯 АНАЛИЗ РЕЗУЛЬТАТОВ ЭПИЗОДОВ:")
    
    total_steps = [ep['total_steps'] for ep in episode_ends]
    total_rewards = [ep['total_reward'] for ep in episode_ends]
    final_scores = [ep['final_score'] for ep in episode_ends]
    wins = [ep['win'] for ep in episode_ends]
    
    print(f"  📈 Средняя длина эпизода: {np.mean(total_steps):.1f} шагов")
    print(f"  🎯 Средняя награда: {np.mean(total_rewards):.3f}")
    print(f"  📊 Средний финальный счет: {np.mean(final_scores):.1f}")
    print(f"  🏆 Процент побед: {np.mean(wins) * 100:.1f}%")
    
    print(f"  📉 Минимальная награда: {np.min(total_rewards):.3f}")
    print(f"  📈 Максимальная награда: {np.max(total_rewards):.3f}")
    print(f"  🎮 Минимальная длина: {np.min(total_steps)} шагов")
    print(f"  🎮 Максимальная длина: {np.max(total_steps)} шагов")
    
    # Анализ прогресса
    if len(episode_ends) > 10:
        first_10_rewards = [ep['total_reward'] for ep in episode_ends[:10]]
        last_10_rewards = [ep['total_reward'] for ep in episode_ends[-10:]]
        
        progress = np.mean(last_10_rewards) - np.mean(first_10_rewards)
        print(f"  📈 Прогресс обучения: {progress:.3f}")
        
        if progress > 0:
            print(f"  ✅ Агент улучшается!")
        elif progress < 0:
            print(f"  ❌ Агент ухудшается")
        else:
            print(f"  ⚖️ Агент стабилен")

def analyze_actions(actions):
    """Анализирует действия агента"""
    print(f"\n🎮 АНАЛИЗ ДЕЙСТВИЙ:")
    
    action_counts = Counter()
    rewards_by_action = defaultdict(list)
    
    for action_data in actions:
        action = action_data.get('chosen_action', {}).get('action', 'unknown')
        reward = action_data.get('reward', 0)
        
        action_counts[action] += 1
        rewards_by_action[action].append(reward)
    
    print(f"  📊 Распределение действий:")
    total_actions = sum(action_counts.values())
    
    for action, count in action_counts.most_common():
        percentage = count / total_actions * 100
        avg_reward = np.mean(rewards_by_action[action]) if rewards_by_action[action] else 0
        print(f"    {action}: {count:,} ({percentage:.1f}%) - средняя награда: {avg_reward:.3f}")
    
    # Анализ состояния
    if actions:
        analyze_state_summaries(actions)

def analyze_state_summaries(actions):
    """Анализирует сводки состояний"""
    print(f"\n📊 АНАЛИЗ СОСТОЯНИЙ:")
    
    game_over_count = 0
    owned_nodes = []
    available_actions = []
    
    for action_data in actions:
        state_summary = action_data.get('state_summary', {})
        
        if state_summary.get('game_over', False):
            game_over_count += 1
        
        owned_nodes.append(state_summary.get('owned_nodes', 0))
        available_actions.append(state_summary.get('available_actions', 0))
    
    if owned_nodes:
        print(f"  🏠 Среднее количество владеемых узлов: {np.mean(owned_nodes):.1f}")
        print(f"  🎯 Максимум владеемых узлов: {np.max(owned_nodes)}")
    
    if available_actions:
        print(f"  ⚡ Среднее количество доступных действий: {np.mean(available_actions):.1f}")
        print(f"  ⚡ Максимум доступных действий: {np.max(available_actions)}")
    
    print(f"  🏁 Игр завершено: {game_over_count}")

def compare_with_heavy_logs():
    """Сравнивает легкие логи с тяжелыми"""
    print(f"\n⚖️ СРАВНЕНИЕ С ТЯЖЕЛЫМИ ЛОГАМИ:")
    
    light_logs = [f for f in os.listdir('.') if f.startswith('light_log_') and f.endswith('.jsonl')]
    heavy_logs = [f for f in os.listdir('.') if f.startswith('actions_log') and f.endswith('.jsonl')]
    
    if light_logs and heavy_logs:
        light_size = sum(os.path.getsize(f) for f in light_logs) / (1024 * 1024)  # MB
        heavy_size = sum(os.path.getsize(f) for f in heavy_logs) / (1024 * 1024 * 1024)  # GB
        
        print(f"  📁 Размер легких логов: {light_size:.2f} MB")
        print(f"  📁 Размер тяжелых логов: {heavy_size:.2f} GB")
        print(f"  📊 Экономия места: {heavy_size * 1024 / light_size:.1f}x")
        print(f"  ✅ Легкие логи в {heavy_size * 1024 / light_size:.0f} раз меньше!")

def create_light_summary():
    """Создает сводку легких логов"""
    print(f"\n📋 СОЗДАНИЕ СВОДКИ ЛЕГКИХ ЛОГОВ")
    
    summary = {
        'timestamp': datetime.now().isoformat(),
        'light_logs_found': len([f for f in os.listdir('.') if f.startswith('light_log_')]),
        'total_size_mb': sum(os.path.getsize(f) for f in os.listdir('.') if f.startswith('light_log_')),
        'efficiency': 'Высокая'
    }
    
    # Сохраняем сводку
    with open('light_logs_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"✅ Сводка сохранена: light_logs_summary.json")
    print(f"📊 Сводка: {summary}")

def main():
    """Основная функция"""
    analyze_light_logs()
    compare_with_heavy_logs()
    create_light_summary()
    
    print(f"\n🎉 Анализ легких логов завершен!")
    print(f"💡 Преимущества легкого логирования:")
    print(f"  ✅ Значительно меньший размер файлов")
    print(f"  ✅ Быстрая обработка данных")
    print(f"  ✅ Сохранение важной статистики")
    print(f"  ✅ Отсутствие дублирования информации")

if __name__ == "__main__":
    main() 