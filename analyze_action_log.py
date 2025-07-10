#!/usr/bin/env python3
"""
Анализатор логов действий агента для Network Echo
- Строит статистику по действиям, наградам, длинам эпизодов
- Находит неиспользуемые механики, тупики, паттерны поражений
- Формирует рекомендации по балансу и механикам
"""

import json
import os
import sys
from collections import Counter, defaultdict
import numpy as np
import matplotlib.pyplot as plt

DEFAULT_LOG_PATH = "actions_log.jsonl"
SUMMARY_PATH = "action_log_summary.txt"

# --- Чтение лога ---
def read_log(log_path):
    steps = []
    with open(log_path, "r") as f:
        for line in f:
            steps.append(json.loads(line))
    return steps

# --- Анализ ---
def analyze_log(steps):
    action_counter = Counter()
    action_type_counter = Counter()
    reward_list = []
    episode_rewards = []
    episode_lengths = []
    episode = []
    win_count = 0
    lose_count = 0
    mechanics_usage = Counter()
    fail_reasons = Counter()
    unused_mechanics = set()
    all_mechanics = set(['miner','shield','sentry','overclocker','upgrade','upgrade_hub','network_capture','emp_blast','capture'])
    
    for step in steps:
        act = step['chosen_action']
        act_type = act['action']
        action_counter[str(act)] += 1
        action_type_counter[act_type] += 1
        reward_list.append(step['reward'])
        episode.append(step)
        # Механики
        if act_type == 'build':
            mechanics_usage[act.get('program','?')] += 1
        elif act_type in all_mechanics:
            mechanics_usage[act_type] += 1
        # Победа/поражение
        for event in step.get('log_events', []):
            if event.get('type') == 'win':
                win_count += 1
            if event.get('type') == 'lose':
                lose_count += 1
                fail_reasons[event.get('reason','unknown')] += 1
        # Конец эпизода
        if step['terminated'] or step['truncated']:
            ep_reward = sum(s['reward'] for s in episode)
            episode_rewards.append(ep_reward)
            episode_lengths.append(len(episode))
            episode = []
    # Неиспользуемые механики
    unused_mechanics = all_mechanics - set(mechanics_usage.keys())
    return {
        'action_counter': action_counter,
        'action_type_counter': action_type_counter,
        'reward_list': reward_list,
        'episode_rewards': episode_rewards,
        'episode_lengths': episode_lengths,
        'win_count': win_count,
        'lose_count': lose_count,
        'mechanics_usage': mechanics_usage,
        'unused_mechanics': unused_mechanics,
        'fail_reasons': fail_reasons
    }

# --- Рекомендации ---
def make_recommendations(stats):
    recs = []
    if stats['win_count'] == 0:
        recs.append("❗ Ни одна партия не завершилась победой. Проверьте условия победы и баланс.")
    if stats['lose_count'] > 0:
        most_common_fail = stats['fail_reasons'].most_common(1)
        if most_common_fail:
            recs.append(f"Чаще всего поражение из-за: {most_common_fail[0][0]} ({most_common_fail[0][1]} раз)")
    if stats['unused_mechanics']:
        recs.append(f"Не используются механики: {', '.join(stats['unused_mechanics'])}")
    if stats['mechanics_usage'].get('overclocker',0) < 3:
        recs.append("Механика overclocker почти не используется — возможно, она слишком дорогая или бесполезная.")
    if np.mean(stats['episode_rewards']) < 0:
        recs.append("Средняя награда отрицательная — игра слишком сложная или награды слишком малы.")
    if np.mean(stats['episode_lengths']) < 0.5 * 5000:
        recs.append("Эпизоды слишком короткие — возможно, игрок быстро проигрывает.")
    if stats['mechanics_usage'].get('emp_blast',0) == 0:
        recs.append("EMP blast не используется — проверьте его стоимость и полезность.")
    if not recs:
        recs.append("Баланс выглядит приемлемо, но проверьте вручную паттерны поведения агента.")
    return recs

# --- Визуализация ---
def plot_stats(stats):
    plt.figure(figsize=(10,4))
    plt.subplot(1,2,1)
    plt.hist(stats['episode_rewards'], bins=20, color='skyblue')
    plt.title('Распределение наград за эпизод')
    plt.xlabel('Награда')
    plt.ylabel('Частота')
    plt.subplot(1,2,2)
    plt.hist(stats['episode_lengths'], bins=20, color='salmon')
    plt.title('Длины эпизодов')
    plt.xlabel('Шаги')
    plt.tight_layout()
    plt.savefig('action_log_stats.png')
    plt.close()

# --- Основной скрипт ---
def main():
    log_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_LOG_PATH
    if not os.path.exists(log_path):
        print(f"Файл {log_path} не найден. Сначала запустите обучение/демонстрацию с log_actions=True.")
        return
    print(f"Чтение лога {log_path}...")
    steps = read_log(log_path)
    print(f"Всего шагов: {len(steps)}")
    stats = analyze_log(steps)
    print("\n--- Статистика действий ---")
    for act, cnt in stats['action_type_counter'].most_common():
        print(f"{act:16}: {cnt}")
    print("\n--- Использование механик ---")
    for mech, cnt in stats['mechanics_usage'].most_common():
        print(f"{mech:16}: {cnt}")
    print("\n--- Причины поражений ---")
    for reason, cnt in stats['fail_reasons'].most_common():
        print(f"{reason:16}: {cnt}")
    print("\n--- Эпизоды ---")
    print(f"Средняя награда: {np.mean(stats['episode_rewards']):.2f}")
    print(f"Средняя длина: {np.mean(stats['episode_lengths']):.1f}")
    print(f"Побед: {stats['win_count']}, Поражений: {stats['lose_count']}")
    print(f"Неиспользуемые механики: {', '.join(stats['unused_mechanics']) if stats['unused_mechanics'] else 'нет'}")
    print("\n--- Рекомендации ---")
    recs = make_recommendations(stats)
    for r in recs:
        print("-", r)
    # Сохраняем summary
    with open(SUMMARY_PATH, "w") as f:
        f.write("# Итоговый анализ действий агента\n\n")
        f.write(f"Всего шагов: {len(steps)}\n")
        f.write(f"Средняя награда: {np.mean(stats['episode_rewards']):.2f}\n")
        f.write(f"Средняя длина: {np.mean(stats['episode_lengths']):.1f}\n")
        f.write(f"Побед: {stats['win_count']}, Поражений: {stats['lose_count']}\n")
        f.write(f"Неиспользуемые механики: {', '.join(stats['unused_mechanics']) if stats['unused_mechanics'] else 'нет'}\n")
        f.write("\n## Рекомендации:\n")
        for r in recs:
            f.write(f"- {r}\n")
    # Визуализация
    plot_stats(stats)
    print(f"\nГотово! Отчёт сохранён в {SUMMARY_PATH}, графики — в action_log_stats.png")

if __name__ == "__main__":
    main() 