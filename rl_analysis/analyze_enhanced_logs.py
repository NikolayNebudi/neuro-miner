#!/usr/bin/env python3
"""
Анализ логов улучшенного обучения
"""

import json
import os
import numpy as np

def analyze_enhanced_logs():
    """Анализирует логи улучшенного обучения"""
    print("📊 АНАЛИЗ ЛОГОВ УЛУЧШЕННОГО ОБУЧЕНИЯ")
    print("=" * 50)
    
    # Ищем файлы логов
    log_files = [f for f in os.listdir('.') if f.startswith('enhanced_log_') and f.endswith('.jsonl')]
    
    if not log_files:
        print("❌ Не найдены файлы логов улучшенного обучения")
        return
    
    # Анализируем последний файл
    latest_log = max(log_files)
    print(f"📁 Анализируем файл: {latest_log}")
    
    # Читаем и анализируем логи
    episodes = {}
    actions = []
    rewards = []
    
    with open(latest_log, 'r') as f:
        for line in f:
            try:
                data = json.loads(line.strip())
                if data.get('type') == 'action':
                    episode = data['episode']
                    step = data['step']
                    action = data['chosen_action']['action']
                    enhanced_reward = data.get('enhanced_reward', 0)
                    
                    actions.append(action)
                    rewards.append(enhanced_reward)
                    
                    if episode not in episodes:
                        episodes[episode] = {
                            'steps': [],
                            'rewards': [],
                            'actions': []
                        }
                    
                    episodes[episode]['steps'].append(step)
                    episodes[episode]['rewards'].append(enhanced_reward)
                    episodes[episode]['actions'].append(action)
                    
            except json.JSONDecodeError:
                continue
    
    if not episodes:
        print("❌ Не найдены данные эпизодов")
        return
    
    # Статистика
    print(f"📈 Статистика обучения:")
    print(f"  🎮 Количество эпизодов: {len(episodes)}")
    print(f"  ⚡ Количество действий: {len(actions)}")
    print(f"  🎯 Средняя награда: {np.mean(rewards):.3f}")
    print(f"  📊 Средняя длина эпизода: {np.mean([len(ep['steps']) for ep in episodes.values()]):.1f}")
    print(f"  🏆 Максимальная длина эпизода: {max([len(ep['steps']) for ep in episodes.values()])}")
    print(f"  📉 Минимальная длина эпизода: {min([len(ep['steps']) for ep in episodes.values()])}")
    print()
    
    # Анализ действий
    action_counts = {}
    for action in actions:
        action_counts[action] = action_counts.get(action, 0) + 1
    
    print("🎮 Распределение действий:")
    total_actions = len(actions)
    for action, count in sorted(action_counts.items(), key=lambda x: x[1], reverse=True):
        percentage = (count / total_actions) * 100
        print(f"  {action}: {count} ({percentage:.1f}%)")
    
    print()
    
    # Анализ эпизодов
    print("📊 Анализ эпизодов:")
    for episode_num in sorted(episodes.keys()):
        episode = episodes[episode_num]
        total_reward = sum(episode['rewards'])
        avg_reward = np.mean(episode['rewards'])
        length = len(episode['steps'])
        print(f"  Эпизод {episode_num}: {length} шагов, награда={total_reward:.1f}, средняя={avg_reward:.2f}")
    
    print()
    print("✅ Анализ завершен!")

if __name__ == "__main__":
    analyze_enhanced_logs() 