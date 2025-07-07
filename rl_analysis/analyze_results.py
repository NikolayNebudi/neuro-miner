#!/usr/bin/env python3
"""
Анализ результатов RL-обучения для киберпанк стратегии
"""

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from collections import defaultdict

def analyze_training_results(csv_file='analysis_log.csv'):
    """Анализирует результаты обучения из CSV файла"""
    
    # Читаем данные
    df = pd.read_csv(csv_file, header=None, names=[
        'episode_id', 'stage', 'result', 'reward', 'steps', 'trace',
        'program_counts', 'avg_levels', 'enemies_killed', 'total_dp', 'total_cpu'
    ])
    
    print(f"📊 Анализ результатов обучения")
    print(f"Всего эпизодов: {len(df)}")
    print(f"Этапы обучения: {df['stage'].unique()}")
    print()
    
    # Статистика по этапам
    for stage in sorted(df['stage'].unique()):
        stage_data = df[df['stage'] == stage]
        wins = len(stage_data[stage_data['result'] == 'win'])
        losses = len(stage_data[stage_data['result'] == 'loss_or_timeout'])
        
        print(f"🎯 Этап {stage}:")
        print(f"   Эпизодов: {len(stage_data)}")
        print(f"   Побед: {wins} ({wins/len(stage_data)*100:.1f}%)")
        print(f"   Поражений: {losses} ({losses/len(stage_data)*100:.1f}%)")
        print(f"   Средняя награда: {stage_data['reward'].mean():.2f}")
        print(f"   Средние шаги: {stage_data['steps'].mean():.1f}")
        print()
    
    # Анализ прогресса
    print("📈 Прогресс обучения:")
    
    # Скользящее среднее наград
    window_size = 50
    rewards = df['reward'].values
    moving_avg = []
    
    for i in range(len(rewards)):
        start = max(0, i - window_size + 1)
        moving_avg.append(rewards[start:i+1].mean())
    
    # Находим лучшие результаты
    best_rewards = df.nlargest(5, 'reward')[['stage', 'reward', 'steps', 'result']]
    print("\n🏆 Топ-5 лучших результатов:")
    print(best_rewards.to_string(index=False))
    
    # Анализ ресурсов
    print(f"\n💰 Анализ ресурсов:")
    print(f"Средний DP: {df['total_dp'].mean():.1f}")
    print(f"Средний CPU: {df['total_cpu'].mean():.1f}")
    
    # Создаем графики
    create_visualizations(df, moving_avg)
    
    return df

def create_visualizations(df, moving_avg):
    """Создает визуализации результатов"""
    
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle('Анализ RL-обучения киберпанк стратегии', fontsize=16)
    
    # График 1: Награды по эпизодам
    axes[0, 0].plot(df['reward'], alpha=0.6, label='Награда за эпизод')
    axes[0, 0].plot(moving_avg, 'r-', linewidth=2, label=f'Скользящее среднее ({50} эпизодов)')
    axes[0, 0].set_title('Награды по эпизодам')
    axes[0, 0].set_xlabel('Эпизод')
    axes[0, 0].set_ylabel('Награда')
    axes[0, 0].legend()
    axes[0, 0].grid(True, alpha=0.3)
    
    # График 2: Шаги по эпизодам
    axes[0, 1].plot(df['steps'], alpha=0.6, color='green')
    axes[0, 1].set_title('Количество шагов по эпизодам')
    axes[0, 1].set_xlabel('Эпизод')
    axes[0, 1].set_ylabel('Шаги')
    axes[0, 1].grid(True, alpha=0.3)
    
    # График 3: Распределение наград
    axes[1, 0].hist(df['reward'], bins=30, alpha=0.7, color='orange')
    axes[1, 0].set_title('Распределение наград')
    axes[1, 0].set_xlabel('Награда')
    axes[1, 0].set_ylabel('Частота')
    axes[1, 0].grid(True, alpha=0.3)
    
    # График 4: Результаты по этапам
    stage_results = df.groupby(['stage', 'result']).size().unstack(fill_value=0)
    stage_results.plot(kind='bar', ax=axes[1, 1])
    axes[1, 1].set_title('Результаты по этапам обучения')
    axes[1, 1].set_xlabel('Этап')
    axes[1, 1].set_ylabel('Количество эпизодов')
    axes[1, 1].legend()
    axes[1, 1].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('training_analysis.png', dpi=300, bbox_inches='tight')
    print(f"\n📊 Графики сохранены в 'training_analysis.png'")
    plt.show()

def detailed_episode_analysis(df, episode_id=None):
    """Детальный анализ конкретного эпизода"""
    
    if episode_id is None:
        # Показываем последние эпизоды
        print("\n🔍 Последние 5 эпизодов:")
        recent = df.tail(5)[['episode_id', 'stage', 'result', 'reward', 'steps']]
        print(recent.to_string(index=False))
        
        # Показываем лучшие эпизоды
        print("\n🏆 Лучшие эпизоды:")
        best = df.nlargest(3, 'reward')[['episode_id', 'stage', 'result', 'reward', 'steps']]
        print(best.to_string(index=False))
    else:
        episode = df[df['episode_id'] == episode_id]
        if len(episode) > 0:
            print(f"\n🔍 Детали эпизода {episode_id}:")
            print(episode.to_string(index=False))
        else:
            print(f"Эпизод {episode_id} не найден")

if __name__ == "__main__":
    try:
        df = analyze_training_results()
        detailed_episode_analysis(df)
        
        print(f"\n✅ Анализ завершен!")
        print(f"📁 Файлы:")
        print(f"   - analysis_log.csv: {len(df)} записей")
        print(f"   - training_analysis.png: графики")
        
    except FileNotFoundError:
        print("❌ Файл analysis_log.csv не найден!")
        print("Запустите сначала train.py для создания данных")
    except Exception as e:
        print(f"❌ Ошибка при анализе: {e}") 