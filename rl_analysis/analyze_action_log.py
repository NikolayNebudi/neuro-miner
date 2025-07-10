#!/usr/bin/env python3
"""
Анализатор логов действий агента для Network Echo
- Строит статистику по действиям, наградам, длинам эпизодов
- Находит неиспользуемые механики, тупики, паттерны поражений
- Формирует рекомендации по балансу и механикам
"""

import json
import os
from collections import Counter, defaultdict
import numpy as np
import matplotlib.pyplot as plt
import glob

LOG_PATH = "actions_log.jsonl"
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

# --- Чтение training_results_*.json ---
def read_training_results(path):
    with open(path, "r") as f:
        data = json.load(f)
    stats = data.get("training_stats", {})
    eval_stats = stats.get("evaluation_stats", {})
    return {
        'episode_rewards': stats.get('episode_rewards', []),
        'episode_lengths': stats.get('episode_lengths', []),
        'win_rates': stats.get('win_rates', []),
        'eval_episode_rewards': eval_stats.get('episode_rewards', []),
        'eval_episode_lengths': eval_stats.get('episode_lengths', []),
        'eval_win_rate': eval_stats.get('win_rate', 0.0),
        'final_avg_reward': stats.get('final_avg_reward', 0.0),
        'final_win_rate': stats.get('final_win_rate', 0.0),
        'min_reward': eval_stats.get('min_reward', None),
        'max_reward': eval_stats.get('max_reward', None),
        'mean_reward': eval_stats.get('mean_reward', None),
        'std_reward': eval_stats.get('std_reward', None),
    }

# --- Рекомендации для training_results ---
def make_training_recommendations(stats):
    recs = []
    if stats['final_win_rate'] == 0.0:
        recs.append("❗ Агент не выиграл ни одной партии. Проверьте баланс и условия победы.")
    if stats['final_avg_reward'] < 0:
        recs.append("Средняя награда отрицательная — игра слишком сложная или награды слишком малы.")
    if stats['min_reward'] is not None and stats['min_reward'] < -500:
        recs.append("Минимальная награда очень низкая — возможно, слишком жёсткие штрафы за поражение.")
    if stats['max_reward'] is not None and stats['max_reward'] < 200:
        recs.append("Максимальная награда за эпизод низкая — возможно, победа недостижима или малоощутима.")
    if stats['mean_reward'] is not None and stats['mean_reward'] > 0 and stats['final_win_rate'] == 0.0:
        recs.append("Агент иногда получает положительные награды, но не может победить — возможно, условия победы слишком жёсткие.")
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

# --- Новый анализатор для расширенного лога ---
def analyze_extended_log(steps):
    episodes = []
    current_ep = None
    for entry in steps:
        if entry.get('event') == 'episode_start':
            current_ep = {
                'map_info': entry.get('map_info', {}),
                'start_state': entry.get('game_state', {}),
                'steps': [],
                'action_trace': [],
                'end_info': None
            }
        elif entry.get('event') == 'episode_end' and current_ep:
            current_ep['end_info'] = entry
            episodes.append(current_ep)
            current_ep = None
        elif current_ep is not None:
            current_ep['steps'].append(entry)
            if 'chosen_action' in entry:
                current_ep['action_trace'].append(entry['chosen_action'])
    return episodes

# --- Новый summary по эпизодам ---
def print_episode_summary(episodes):
    print(f"\n--- Эпизоды (расширенный лог) ---")
    for i, ep in enumerate(episodes):
        length = len(ep['steps'])
        total_reward = sum(s.get('reward', 0) for s in ep['steps'])
        end = ep['end_info'] or {}
        reason = end.get('info', {}).get('log_events', [])
        reason_str = ''
        for ev in reason:
            if ev.get('type') in ('win','lose'):
                reason_str = f"{ev.get('type')} ({ev.get('reason','?')})"
        if not reason_str:
            reason_str = 'неизвестно'
        map_nodes = ep['map_info'].get('nodes', {})
        node_types = Counter(n.get('type','?') for n in map_nodes.values())
        print(f"Эпизод {i+1}: длина={length}, награда={total_reward:.1f}, завершение={reason_str}, нод={len(map_nodes)}, типы={dict(node_types)}")
        # Пример action trace
        trace = ep['action_trace']
        if trace:
            trace_str = ', '.join(a['action'] for a in trace[:10])
            print(f"  Действия: {trace_str}{' ...' if len(trace)>10 else ''}")
        if end and 'final_action_trace' in end:
            print(f"  Всего действий: {len(end['final_action_trace'])}")

# --- Новый анализатор тупиков и паттернов ---
def analyze_action_traces(episodes):
    fail_patterns = Counter()
    win_patterns = Counter()
    for ep in episodes:
        end = ep['end_info'] or {}
        trace = tuple(a['action'] for a in ep['action_trace'])
        if not trace:
            continue
        reason = ''
        for ev in end.get('info',{}).get('log_events', []):
            if ev.get('type') == 'lose':
                reason = ev.get('reason','?')
            if ev.get('type') == 'win':
                reason = 'win'
        if reason == 'win':
            win_patterns[trace[-5:]] += 1
        elif reason:
            fail_patterns[(reason, trace[-5:])] += 1
    print("\n--- Частые паттерны поражений (последние 5 действий) ---")
    for (reason, pat), cnt in fail_patterns.most_common(5):
        print(f"{reason}: {pat} — {cnt} раз")
    print("\n--- Частые паттерны побед (последние 5 действий) ---")
    for pat, cnt in win_patterns.most_common(3):
        print(f"{pat} — {cnt} раз")

# --- Основной скрипт ---
def main():
    if os.path.exists(LOG_PATH):
        print(f"Чтение лога {LOG_PATH}...")
        steps = read_log(LOG_PATH)
        # Проверяем, есть ли расширенные эпизоды
        if any('event' in s for s in steps):
            episodes = analyze_extended_log(steps)
            print_episode_summary(episodes)
            analyze_action_traces(episodes)
            # Можно добавить ещё анализ карт, повторяющихся тупиков и т.д.
            print(f"\nВсего эпизодов: {len(episodes)}")
            # Сохраняем summary
            with open(SUMMARY_PATH, "w") as f:
                for i, ep in enumerate(episodes):
                    length = len(ep['steps'])
                    total_reward = sum(s.get('reward', 0) for s in ep['steps'])
                    end = ep['end_info'] or {}
                    reason = end.get('info', {}).get('log_events', [])
                    reason_str = ''
                    for ev in reason:
                        if ev.get('type') in ('win','lose'):
                            reason_str = f"{ev.get('type')} ({ev.get('reason','?')})"
                    if not reason_str:
                        reason_str = 'неизвестно'
                    map_nodes = ep['map_info'].get('nodes', {})
                    node_types = Counter(n.get('type','?') for n in map_nodes.values())
                    f.write(f"Эпизод {i+1}: длина={length}, награда={total_reward:.1f}, завершение={reason_str}, нод={len(map_nodes)}, типы={dict(node_types)}\n")
                    trace = ep['action_trace']
                    if trace:
                        trace_str = ', '.join(a['action'] for a in trace[:10])
                        f.write(f"  Действия: {trace_str}{' ...' if len(trace)>10 else ''}\n")
                    if end and 'final_action_trace' in end:
                        f.write(f"  Всего действий: {len(end['final_action_trace'])}\n")
                f.write(f"\nВсего эпизодов: {len(episodes)}\n")
            return
        # Старый анализ для обратной совместимости
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
        return
    # Если actions_log.jsonl не найден, ищем training_results_*.json
    json_files = sorted(glob.glob("results/training_results_*.json"), reverse=True)
    if not json_files:
        print("Не найдено ни actions_log.jsonl, ни training_results_*.json. Сначала запустите обучение.")
        return
    path = json_files[0]
    print(f"Чтение результатов обучения: {path}")
    stats = read_training_results(path)
    print(f"\n--- Эпизоды ---")
    print(f"Средняя награда: {np.mean(stats['episode_rewards']):.2f}")
    print(f"Средняя длина: {np.mean(stats['episode_lengths']):.1f}")
    print(f"Win rate: {np.mean(stats['win_rates']):.2f}")
    print(f"Min reward: {stats['min_reward']}, Max reward: {stats['max_reward']}")
    print(f"\n--- Рекомендации ---")
    recs = make_training_recommendations(stats)
    for r in recs:
        print("-", r)
    # Сохраняем summary
    with open(SUMMARY_PATH, "w") as f:
        f.write("# Итоговый анализ RL-обучения\n\n")
        f.write(f"Файл: {path}\n")
        f.write(f"Средняя награда: {np.mean(stats['episode_rewards']):.2f}\n")
        f.write(f"Средняя длина: {np.mean(stats['episode_lengths']):.1f}\n")
        f.write(f"Win rate: {np.mean(stats['win_rates']):.2f}\n")
        f.write(f"Min reward: {stats['min_reward']}, Max reward: {stats['max_reward']}\n")
        f.write(f"\n## Рекомендации:\n")
        for r in recs:
            f.write(f"- {r}\n")
    print(f"\nГотово! Отчёт сохранён в {SUMMARY_PATH}")

if __name__ == "__main__":
    main() 