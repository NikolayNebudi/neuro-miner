#!/usr/bin/env python3
"""
Визуализация данных обучения
"""

import json
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from collections import defaultdict
import matplotlib.dates as mdates
from datetime import datetime

# Настройка стиля
plt.style.use('default')
sns.set_palette("husl")

def create_training_visualizations():
    """Создает визуализации данных обучения"""
    print("📊 СОЗДАНИЕ ВИЗУАЛИЗАЦИЙ ОБУЧЕНИЯ")
    print("=" * 50)
    
    # Анализ логов действий
    log_file = "actions_log.jsonl"
    if os.path.exists(log_file):
        visualize_action_logs(log_file)
    
    # Анализ результатов
    results_files = [
        "improved_analysis_log.csv",
        "quick_test_log.csv", 
        "optimized_analysis_log.csv"
    ]
    
    for file in results_files:
        if os.path.exists(file):
            visualize_results(file)

def visualize_action_logs(log_file):
    """Визуализирует логи действий"""
    print(f"\n🎮 ВИЗУАЛИЗАЦИЯ ЛОГОВ: {log_file}")
    
    # Собираем данные
    episodes = []
    rewards = []
    actions = []
    steps = []
    
    print("⏳ Собираем данные...")
    with open(log_file, 'r') as f:
        for i, line in enumerate(f):
            if i % 1000 == 0:  # Анализируем каждую 1000-ю запись
                try:
                    data = json.loads(line)
                    episode = data.get('episode', 0)
                    step = data.get('step', 0)
                    action = data.get('chosen_action', {}).get('action', 'unknown')
                    reward = data.get('reward', 0)
                    
                    episodes.append(episode)
                    rewards.append(reward)
                    actions.append(action)
                    steps.append(step)
                    
                except:
                    continue
    
    # Создаем графики
    fig, axes = plt.subplots(2, 2, figsize=(15, 12))
    fig.suptitle('Анализ обучения RL-агента', fontsize=16, fontweight='bold')
    
    # 1. Распределение наград
    axes[0, 0].hist(rewards, bins=50, alpha=0.7, color='skyblue', edgecolor='black')
    axes[0, 0].set_title('Распределение наград')
    axes[0, 0].set_xlabel('Награда')
    axes[0, 0].set_ylabel('Частота')
    axes[0, 0].axvline(np.mean(rewards), color='red', linestyle='--', label=f'Среднее: {np.mean(rewards):.3f}')
    axes[0, 0].legend()
    
    # 2. Прогресс по эпизодам
    episode_rewards = defaultdict(list)
    for ep, rew in zip(episodes, rewards):
        episode_rewards[ep].append(rew)
    
    avg_rewards = {ep: np.mean(rewards) for ep, rewards in episode_rewards.items()}
    ep_sorted = sorted(avg_rewards.keys())
    rew_sorted = [avg_rewards[ep] for ep in ep_sorted]
    
    axes[0, 1].plot(ep_sorted, rew_sorted, 'b-', alpha=0.7, linewidth=2)
    axes[0, 1].set_title('Средняя награда по эпизодам')
    axes[0, 1].set_xlabel('Эпизод')
    axes[0, 1].set_ylabel('Средняя награда')
    axes[0, 1].grid(True, alpha=0.3)
    
    # 3. Распределение действий
    action_counts = pd.Series(actions).value_counts()
    axes[1, 0].pie(action_counts.values, labels=action_counts.index, autopct='%1.1f%%')
    axes[1, 0].set_title('Распределение действий')
    
    # 4. Длина эпизодов
    episode_lengths = defaultdict(int)
    for ep, step in zip(episodes, steps):
        episode_lengths[ep] = max(episode_lengths[ep], step)
    
    ep_lengths = list(episode_lengths.values())
    axes[1, 1].hist(ep_lengths, bins=30, alpha=0.7, color='lightgreen', edgecolor='black')
    axes[1, 1].set_title('Распределение длины эпизодов')
    axes[1, 1].set_xlabel('Количество шагов')
    axes[1, 1].set_ylabel('Количество эпизодов')
    axes[1, 1].axvline(np.mean(ep_lengths), color='red', linestyle='--', label=f'Среднее: {np.mean(ep_lengths):.0f}')
    axes[1, 1].legend()
    
    plt.tight_layout()
    plt.savefig('training_analysis.png', dpi=300, bbox_inches='tight')
    print("✅ Сохранен график: training_analysis.png")
    plt.close()

def visualize_results(file_path):
    """Визуализирует результаты обучения"""
    print(f"\n📋 ВИЗУАЛИЗАЦИЯ РЕЗУЛЬТАТОВ: {file_path}")
    
    try:
        df = pd.read_csv(file_path)
        
        # Создаем графики
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle(f'Анализ результатов: {os.path.basename(file_path)}', fontsize=16, fontweight='bold')
        
        # 1. Временная шкала
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            axes[0, 0].plot(df['timestamp'], range(len(df)), 'b-', alpha=0.7)
            axes[0, 0].set_title('Временная шкала обучения')
            axes[0, 0].set_xlabel('Время')
            axes[0, 0].set_ylabel('Номер записи')
            axes[0, 0].tick_params(axis='x', rotation=45)
        
        # 2. Статистика очков
        if 'final_score' in df.columns:
            axes[0, 1].hist(df['final_score'], bins=20, alpha=0.7, color='orange', edgecolor='black')
            axes[0, 1].set_title('Распределение финальных очков')
            axes[0, 1].set_xlabel('Очки')
            axes[0, 1].set_ylabel('Частота')
            axes[0, 1].axvline(df['final_score'].mean(), color='red', linestyle='--', 
                               label=f'Среднее: {df["final_score"].mean():.1f}')
            axes[0, 1].legend()
        
        # 3. Статистика шагов
        if 'total_steps' in df.columns:
            axes[1, 0].hist(df['total_steps'], bins=20, alpha=0.7, color='purple', edgecolor='black')
            axes[1, 0].set_title('Распределение количества шагов')
            axes[1, 0].set_xlabel('Количество шагов')
            axes[1, 0].set_ylabel('Частота')
            axes[1, 0].axvline(df['total_steps'].mean(), color='red', linestyle='--',
                               label=f'Среднее: {df["total_steps"].mean():.0f}')
            axes[1, 0].legend()
        
        # 4. Процент побед
        if 'win' in df.columns:
            win_rate = df['win'].mean() * 100
            axes[1, 1].pie([win_rate, 100-win_rate], labels=['Победы', 'Поражения'], 
                           autopct='%1.1f%%', colors=['lightgreen', 'lightcoral'])
            axes[1, 1].set_title('Процент побед')
        
        plt.tight_layout()
        output_file = f"results_{os.path.basename(file_path).replace('.csv', '')}.png"
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        print(f"✅ Сохранен график: {output_file}")
        plt.close()
        
    except Exception as e:
        print(f"❌ Ошибка при визуализации {file_path}: {e}")

def create_summary_report():
    """Создает сводный отчет"""
    print(f"\n📊 СОЗДАНИЕ СВОДНОГО ОТЧЕТА")
    
    # Собираем статистику
    stats = {
        'total_episodes': 0,
        'total_actions': 0,
        'avg_reward': 0,
        'max_reward': 0,
        'min_reward': 0,
        'file_size_gb': 0,
        'training_time': 'Unknown'
    }
    
    # Анализ логов
    log_file = "actions_log.jsonl"
    if os.path.exists(log_file):
        file_size = os.path.getsize(log_file) / (1024 * 1024 * 1024)
        stats['file_size_gb'] = file_size
        
        episodes = set()
        actions = []
        rewards = []
        
        with open(log_file, 'r') as f:
            for i, line in enumerate(f):
                if i % 1000 == 0:
                    try:
                        data = json.loads(line)
                        episode = data.get('episode', 0)
                        action = data.get('chosen_action', {}).get('action', 'unknown')
                        reward = data.get('reward', 0)
                        
                        episodes.add(episode)
                        actions.append(action)
                        rewards.append(reward)
                    except:
                        continue
        
        stats['total_episodes'] = len(episodes)
        stats['total_actions'] = len(actions)
        if rewards:
            stats['avg_reward'] = np.mean(rewards)
            stats['max_reward'] = np.max(rewards)
            stats['min_reward'] = np.min(rewards)
    
    # Создаем сводный график
    fig, axes = plt.subplots(1, 3, figsize=(18, 6))
    fig.suptitle('Сводный отчет обучения RL-агента', fontsize=16, fontweight='bold')
    
    # 1. Общая статистика
    stats_text = f"""
    📊 ОБЩАЯ СТАТИСТИКА
    
    🎮 Эпизодов: {stats['total_episodes']:,}
    📝 Действий: {stats['total_actions']:,}
    💾 Размер логов: {stats['file_size_gb']:.1f} GB
    
    🎯 Награды:
    • Средняя: {stats['avg_reward']:.3f}
    • Максимум: {stats['max_reward']:.3f}
    • Минимум: {stats['min_reward']:.3f}
    """
    
    axes[0].text(0.1, 0.5, stats_text, transform=axes[0].transAxes, 
                 fontsize=12, verticalalignment='center', fontfamily='monospace')
    axes[0].set_title('Статистика обучения')
    axes[0].axis('off')
    
    # 2. Проблемы и решения
    problems_text = f"""
    ⚠️ ВЫЯВЛЕННЫЕ ПРОБЛЕМЫ
    
    🔴 Размер логов: {stats['file_size_gb']:.1f} GB
    🔴 Нехватка памяти
    🔴 Слишком много итераций
    🔴 Неэффективное логирование
    
    ✅ РЕШЕНИЯ
    
    🟢 Оптимизированная версия
    🟢 Ограничение записей
    🟢 Улучшенное логирование
    """
    
    axes[1].text(0.1, 0.5, problems_text, transform=axes[1].transAxes,
                 fontsize=12, verticalalignment='center', fontfamily='monospace')
    axes[1].set_title('Проблемы и решения')
    axes[1].axis('off')
    
    # 3. Рекомендации
    recommendations_text = f"""
    💡 РЕКОМЕНДАЦИИ
    
    📈 Использовать оптимизированную версию
    🔧 Настроить параметры под ресурсы
    📊 Регулярно анализировать прогресс
    💾 Очищать старые логи
    🎯 Ограничить количество итераций
    """
    
    axes[2].text(0.1, 0.5, recommendations_text, transform=axes[2].transAxes,
                 fontsize=12, verticalalignment='center', fontfamily='monospace')
    axes[2].set_title('Рекомендации')
    axes[2].axis('off')
    
    plt.tight_layout()
    plt.savefig('training_summary.png', dpi=300, bbox_inches='tight')
    print("✅ Сохранен сводный отчет: training_summary.png")
    plt.close()

def main():
    """Основная функция"""
    create_training_visualizations()
    create_summary_report()
    print(f"\n🎉 Визуализация завершена!")
    print(f"📁 Проверьте созданные файлы:")
    print(f"  • training_analysis.png")
    print(f"  • training_summary.png")
    print(f"  • results_*.png")

if __name__ == "__main__":
    main() 