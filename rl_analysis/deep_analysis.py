#!/usr/bin/env python3
"""
Глубокий анализ паттернов в RL-обучении
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from collections import defaultdict

def analyze_patterns(csv_file='analysis_log.csv'):
    """Анализирует паттерны в результатах обучения"""
    
    # Читаем данные
    df = pd.read_csv(csv_file, header=None, names=[
        'episode_id', 'stage', 'result', 'reward', 'steps', 'trace',
        'program_counts', 'avg_levels', 'enemies_killed', 'total_dp', 'total_cpu'
    ])
    
    print("🔍 Глубокий анализ паттернов")
    print("=" * 50)
    
    # Анализ по этапам
    for stage in sorted(df['stage'].unique()):
        stage_data = df[df['stage'] == stage]
        print(f"\n🎯 Этап {stage}:")
        
        # Статистика наград
        rewards = stage_data['reward'].values
        print(f"   Награды: мин={rewards.min():.2f}, макс={rewards.max():.2f}, среднее={rewards.mean():.2f}, стд={rewards.std():.2f}")
        
        # Статистика шагов
        steps = stage_data['steps'].values
        print(f"   Шаги: мин={steps.min()}, макс={steps.max()}, среднее={steps.mean():.1f}, стд={steps.std():.1f}")
        
        # Анализ ресурсов
        dp_values = stage_data['total_dp'].values
        cpu_values = stage_data['total_cpu'].values
        print(f"   DP: среднее={dp_values.mean():.1f}, стд={dp_values.std():.1f}")
        print(f"   CPU: среднее={cpu_values.mean():.1f}, стд={cpu_values.std():.1f}")
        
        # Поиск аномалий
        find_anomalies(stage_data, stage)
    
    # Анализ переходов между результатами
    analyze_transitions(df)
    
    # Анализ корреляций
    analyze_correlations(df)
    
    # Создание детальных графиков
    create_detailed_plots(df)

def find_anomalies(stage_data, stage):
    """Находит аномальные результаты"""
    
    print(f"\n   🔍 Аномалии на этапе {stage}:")
    
    # Аномально высокие награды
    high_rewards = stage_data[stage_data['reward'] > stage_data['reward'].quantile(0.95)]
    if len(high_rewards) > 0:
        print(f"     Высокие награды (>95%): {len(high_rewards)} эпизодов")
        for _, row in high_rewards.iterrows():
            print(f"       Награда: {row['reward']:.2f}, шаги: {row['steps']}, результат: {row['result']}")
    
    # Аномально низкие награды
    low_rewards = stage_data[stage_data['reward'] < stage_data['reward'].quantile(0.05)]
    if len(low_rewards) > 0:
        print(f"     Низкие награды (<5%): {len(low_rewards)} эпизодов")
        for _, row in low_rewards.iterrows():
            print(f"       Награда: {row['reward']:.2f}, шаги: {row['steps']}, результат: {row['result']}")
    
    # Аномально короткие/длинные эпизоды
    short_episodes = stage_data[stage_data['steps'] < stage_data['steps'].quantile(0.05)]
    long_episodes = stage_data[stage_data['steps'] > stage_data['steps'].quantile(0.95)]
    
    if len(short_episodes) > 0:
        print(f"     Короткие эпизоды (<5%): {len(short_episodes)} эпизодов")
    if len(long_episodes) > 0:
        print(f"     Длинные эпизоды (>95%): {len(long_episodes)} эпизодов")

def analyze_transitions(df):
    """Анализирует переходы между результатами"""
    
    print(f"\n🔄 Анализ переходов:")
    
    # Группируем по результатам
    results = df['result'].value_counts()
    print(f"   Распределение результатов:")
    for result, count in results.items():
        percentage = count / len(df) * 100
        print(f"     {result}: {count} ({percentage:.1f}%)")
    
    # Анализ последовательностей
    if len(df) > 10:
        recent_results = df.tail(10)['result'].values
        print(f"   Последние 10 результатов: {list(recent_results)}")
        
        # Поиск паттернов
        win_streaks = 0
        loss_streaks = 0
        current_streak = 1
        
        for i in range(1, len(recent_results)):
            if recent_results[i] == recent_results[i-1]:
                current_streak += 1
            else:
                if recent_results[i-1] == 'win':
                    win_streaks = max(win_streaks, current_streak)
                else:
                    loss_streaks = max(loss_streaks, current_streak)
                current_streak = 1
        
        print(f"   Максимальная серия побед: {win_streaks}")
        print(f"   Максимальная серия поражений: {loss_streaks}")

def analyze_correlations(df):
    """Анализирует корреляции между параметрами"""
    
    print(f"\n📊 Корреляции:")
    
    # Числовые колонки
    numeric_cols = ['reward', 'steps', 'total_dp', 'total_cpu']
    numeric_data = df[numeric_cols].copy()
    
    # Корреляционная матрица
    corr_matrix = numeric_data.corr()
    
    print("   Корреляционная матрица:")
    for i, col1 in enumerate(numeric_cols):
        for j, col2 in enumerate(numeric_cols):
            if i < j:  # Показываем только верхний треугольник
                corr = corr_matrix.loc[col1, col2]
                print(f"     {col1} ↔ {col2}: {corr:.3f}")
    
    # Анализ по этапам
    for stage in sorted(df['stage'].unique()):
        stage_data = df[df['stage'] == stage]
        if len(stage_data) > 5:  # Минимум для корреляции
            stage_corr = stage_data[numeric_cols].corr()
            print(f"\n   Корреляции на этапе {stage}:")
            reward_steps_corr = stage_corr.loc['reward', 'steps']
            print(f"     Награда ↔ Шаги: {reward_steps_corr:.3f}")

def create_detailed_plots(df):
    """Создает детальные графики анализа"""
    
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    fig.suptitle('Детальный анализ паттернов RL-обучения', fontsize=16)
    
    # График 1: Распределение наград по этапам
    for stage in sorted(df['stage'].unique()):
        stage_data = df[df['stage'] == stage]
        axes[0, 0].hist(stage_data['reward'], alpha=0.7, label=f'Этап {stage}', bins=20)
    axes[0, 0].set_title('Распределение наград по этапам')
    axes[0, 0].set_xlabel('Награда')
    axes[0, 0].set_ylabel('Частота')
    axes[0, 0].legend()
    axes[0, 0].grid(True, alpha=0.3)
    
    # График 2: Награда vs Шаги
    for stage in sorted(df['stage'].unique()):
        stage_data = df[df['stage'] == stage]
        axes[0, 1].scatter(stage_data['steps'], stage_data['reward'], alpha=0.6, label=f'Этап {stage}')
    axes[0, 1].set_title('Награда vs Количество шагов')
    axes[0, 1].set_xlabel('Шаги')
    axes[0, 1].set_ylabel('Награда')
    axes[0, 1].legend()
    axes[0, 1].grid(True, alpha=0.3)
    
    # График 3: Награда vs Ресурсы
    axes[0, 2].scatter(df['total_dp'], df['reward'], alpha=0.6, c=df['stage'], cmap='viridis')
    axes[0, 2].set_title('Награда vs Data Points')
    axes[0, 2].set_xlabel('Data Points')
    axes[0, 2].set_ylabel('Награда')
    axes[0, 2].grid(True, alpha=0.3)
    
    # График 4: Скользящее среднее наград
    window = 10
    rewards = df['reward'].values
    moving_avg = []
    for i in range(len(rewards)):
        start = max(0, i - window + 1)
        moving_avg.append(rewards[start:i+1].mean())
    
    axes[1, 0].plot(rewards, alpha=0.6, label='Награда за эпизод')
    axes[1, 0].plot(moving_avg, 'r-', linewidth=2, label=f'Скользящее среднее ({window})')
    axes[1, 0].set_title('Прогресс наград')
    axes[1, 0].set_xlabel('Эпизод')
    axes[1, 0].set_ylabel('Награда')
    axes[1, 0].legend()
    axes[1, 0].grid(True, alpha=0.3)
    
    # График 5: Box plot наград по этапам
    stage_rewards = [df[df['stage'] == stage]['reward'].values for stage in sorted(df['stage'].unique())]
    axes[1, 1].boxplot(stage_rewards, labels=[f'Этап {stage}' for stage in sorted(df['stage'].unique())])
    axes[1, 1].set_title('Распределение наград по этапам')
    axes[1, 1].set_ylabel('Награда')
    axes[1, 1].grid(True, alpha=0.3)
    
    # График 6: Результаты по эпизодам
    results_numeric = (df['result'] == 'win').astype(int)
    axes[1, 2].plot(results_numeric, alpha=0.7, marker='o', markersize=3)
    axes[1, 2].set_title('Результаты по эпизодам (1=Победа, 0=Поражение)')
    axes[1, 2].set_xlabel('Эпизод')
    axes[1, 2].set_ylabel('Результат')
    axes[1, 2].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('deep_analysis.png', dpi=300, bbox_inches='tight')
    print(f"\n📊 Детальные графики сохранены в 'deep_analysis.png'")
    plt.show()

def suggest_improvements(df):
    """Предлагает улучшения на основе анализа"""
    
    print(f"\n💡 Рекомендации по улучшению:")
    
    # Анализ проблем
    total_episodes = len(df)
    wins = len(df[df['result'] == 'win'])
    win_rate = wins / total_episodes * 100
    
    print(f"   Общая статистика:")
    print(f"     Всего эпизодов: {total_episodes}")
    print(f"     Побед: {wins} ({win_rate:.1f}%)")
    
    if win_rate < 10:
        print(f"   ⚠️  Низкий процент побед ({win_rate:.1f}%)")
        print(f"     Рекомендации:")
        print(f"       - Увеличить количество эпизодов обучения")
        print(f"       - Настроить shaping rewards")
        print(f"       - Упростить задачу на начальных этапах")
    
    # Анализ вариативности
    reward_std = df['reward'].std()
    reward_mean = df['reward'].mean()
    cv = reward_std / abs(reward_mean) if reward_mean != 0 else 0
    
    if cv > 0.5:
        print(f"   ⚠️  Высокая вариативность результатов (CV={cv:.2f})")
        print(f"     Рекомендации:")
        print(f"       - Увеличить стабильность окружения")
        print(f"       - Добавить регуляризацию")
        print(f"       - Использовать более консервативную политику")
    
    # Анализ по этапам
    for stage in sorted(df['stage'].unique()):
        stage_data = df[df['stage'] == stage]
        stage_wins = len(stage_data[stage_data['result'] == 'win'])
        stage_win_rate = stage_wins / len(stage_data) * 100
        
        print(f"   Этап {stage}: {stage_win_rate:.1f}% побед")
        if stage_win_rate == 0:
            print(f"     ❌ Нет побед на этапе {stage}")
            print(f"       - Проверить сложность этапа")
            print(f"       - Увеличить время обучения")
        elif stage_win_rate == 100:
            print(f"     ✅ Отличные результаты на этапе {stage}")
            print(f"       - Можно усложнить задачу")

if __name__ == "__main__":
    try:
        df = analyze_patterns()
        suggest_improvements(df)
        
        print(f"\n✅ Глубокий анализ завершен!")
        
    except FileNotFoundError:
        print("❌ Файл analysis_log.csv не найден!")
        print("Запустите сначала train.py для создания данных")
    except Exception as e:
        print(f"❌ Ошибка при анализе: {e}") 