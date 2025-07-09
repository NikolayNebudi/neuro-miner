#!/usr/bin/env python3
"""
Анализ результатов быстрого тестирования
"""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from datetime import datetime
import os

def analyze_quick_test_results():
    """Анализ результатов быстрого тестирования"""
    
    print("📊 АНАЛИЗ РЕЗУЛЬТАТОВ БЫСТРОГО ТЕСТИРОВАНИЯ")
    print("=" * 60)
    
    # Читаем данные мониторинга
    monitor_file = "quick_test_log.csv.monitor.csv"
    
    if not os.path.exists(monitor_file):
        print(f"❌ Файл {monitor_file} не найден")
        return
    
    # Парсим данные мониторинга
    data = []
    with open(monitor_file, 'r') as f:
        lines = f.readlines()
        
    for line in lines:
        if line.startswith('#') or not line.strip():
            continue
        parts = line.strip().split(',')
        if len(parts) >= 3:
            try:
                reward = float(parts[0])
                length = int(parts[1])
                time = float(parts[2])
                data.append({
                    'reward': reward,
                    'length': length,
                    'time': time
                })
            except:
                continue
    
    if not data:
        print("❌ Нет данных для анализа")
        return
    
    df = pd.DataFrame(data)
    
    print(f"📈 Общая статистика:")
    print(f"   • Количество эпизодов: {len(df)}")
    print(f"   • Средняя награда: {df['reward'].mean():.2f}")
    print(f"   • Медианная награда: {df['reward'].median():.2f}")
    print(f"   • Стандартное отклонение: {df['reward'].std():.2f}")
    print(f"   • Минимальная награда: {df['reward'].min():.2f}")
    print(f"   • Максимальная награда: {df['reward'].max():.2f}")
    print()
    
    print(f"⏱️  Временные характеристики:")
    print(f"   • Средняя длина эпизода: {df['length'].mean():.1f} шагов")
    print(f"   • Общее время обучения: {df['time'].max():.1f} секунд")
    print(f"   • Скорость: {len(df) / df['time'].max():.2f} эпизодов/сек")
    print()
    
    # Анализ трендов
    print(f"📊 Анализ трендов:")
    
    # Разбиваем на окна для анализа трендов
    window_size = max(1, len(df) // 10)
    if window_size > 1:
        df['window'] = df.index // window_size
        window_stats = df.groupby('window').agg({
            'reward': ['mean', 'std'],
            'length': 'mean'
        }).round(2)
        
        print(f"   • Размер окна анализа: {window_size} эпизодов")
        print(f"   • Статистика по окнам:")
        for i, (_, row) in enumerate(window_stats.iterrows()):
            print(f"     Окно {i}: награда={row[('reward', 'mean')]:.1f}±{row[('reward', 'std')]:.1f}, длина={row[('length', 'mean')]:.0f}")
    
    # Анализ стабильности
    print(f"\n🎯 Анализ стабильности:")
    
    # Коэффициент вариации
    cv = df['reward'].std() / df['reward'].mean()
    print(f"   • Коэффициент вариации: {cv:.3f}")
    
    if cv < 0.1:
        stability = "Очень стабильно"
    elif cv < 0.2:
        stability = "Стабильно"
    elif cv < 0.3:
        stability = "Умеренно стабильно"
    else:
        stability = "Нестабильно"
    
    print(f"   • Оценка стабильности: {stability}")
    
    # Анализ прогресса
    if len(df) > 10:
        first_half = df.iloc[:len(df)//2]['reward'].mean()
        second_half = df.iloc[len(df)//2:]['reward'].mean()
        progress = second_half - first_half
        
        print(f"   • Прогресс обучения: {progress:+.1f}")
        if progress > 0:
            print(f"   • Направление: Улучшение ✅")
        elif progress < 0:
            print(f"   • Направление: Ухудшение ❌")
        else:
            print(f"   • Направление: Без изменений ➖")
    
    # Создаем визуализации
    print(f"\n📈 Создание визуализаций...")
    
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle('Анализ результатов быстрого тестирования', fontsize=16)
    
    # График наград по времени
    axes[0, 0].plot(df['time'], df['reward'], alpha=0.7, linewidth=1)
    axes[0, 0].set_title('Награды по времени')
    axes[0, 0].set_xlabel('Время (секунды)')
    axes[0, 0].set_ylabel('Награда')
    axes[0, 0].grid(True, alpha=0.3)
    
    # Гистограмма наград
    axes[0, 1].hist(df['reward'], bins=20, alpha=0.7, edgecolor='black')
    axes[0, 1].set_title('Распределение наград')
    axes[0, 1].set_xlabel('Награда')
    axes[0, 1].set_ylabel('Частота')
    axes[0, 1].grid(True, alpha=0.3)
    
    # График длины эпизодов
    axes[1, 0].plot(df['time'], df['length'], alpha=0.7, linewidth=1, color='orange')
    axes[1, 0].set_title('Длина эпизодов по времени')
    axes[1, 0].set_xlabel('Время (секунды)')
    axes[1, 0].set_ylabel('Длина эпизода')
    axes[1, 0].grid(True, alpha=0.3)
    
    # Scatter plot награда vs длина
    axes[1, 1].scatter(df['length'], df['reward'], alpha=0.6)
    axes[1, 1].set_title('Награда vs Длина эпизода')
    axes[1, 1].set_xlabel('Длина эпизода')
    axes[1, 1].set_ylabel('Награда')
    axes[1, 1].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('quick_test_analysis.png', dpi=300, bbox_inches='tight')
    print(f"   ✅ График сохранен: quick_test_analysis.png")
    
    # Сохраняем статистику
    stats = {
        'total_episodes': len(df),
        'mean_reward': df['reward'].mean(),
        'median_reward': df['reward'].median(),
        'std_reward': df['reward'].std(),
        'min_reward': df['reward'].min(),
        'max_reward': df['reward'].max(),
        'mean_length': df['length'].mean(),
        'total_time': df['time'].max(),
        'episodes_per_sec': len(df) / df['time'].max(),
        'coefficient_of_variation': cv,
        'stability': stability
    }
    
    # Создаем отчет
    report_file = 'quick_test_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("ОТЧЕТ О БЫСТРОМ ТЕСТИРОВАНИИ\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Дата анализа: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("ОБЩАЯ СТАТИСТИКА:\n")
        f.write(f"  • Количество эпизодов: {stats['total_episodes']}\n")
        f.write(f"  • Средняя награда: {stats['mean_reward']:.2f}\n")
        f.write(f"  • Медианная награда: {stats['median_reward']:.2f}\n")
        f.write(f"  • Стандартное отклонение: {stats['std_reward']:.2f}\n")
        f.write(f"  • Диапазон наград: [{stats['min_reward']:.2f}, {stats['max_reward']:.2f}]\n\n")
        
        f.write("ВРЕМЕННЫЕ ХАРАКТЕРИСТИКИ:\n")
        f.write(f"  • Средняя длина эпизода: {stats['mean_length']:.1f} шагов\n")
        f.write(f"  • Общее время обучения: {stats['total_time']:.1f} секунд\n")
        f.write(f"  • Скорость: {stats['episodes_per_sec']:.2f} эпизодов/сек\n\n")
        
        f.write("АНАЛИЗ СТАБИЛЬНОСТИ:\n")
        f.write(f"  • Коэффициент вариации: {stats['coefficient_of_variation']:.3f}\n")
        f.write(f"  • Оценка стабильности: {stats['stability']}\n\n")
        
        f.write("ВЫВОДЫ:\n")
        if stats['mean_reward'] > 1000:
            f.write("  ✅ Высокая средняя награда\n")
        elif stats['mean_reward'] > 500:
            f.write("  ⚠️  Умеренная средняя награда\n")
        else:
            f.write("  ❌ Низкая средняя награда\n")
            
        if stats['coefficient_of_variation'] < 0.2:
            f.write("  ✅ Стабильное обучение\n")
        else:
            f.write("  ⚠️  Нестабильное обучение\n")
            
        if stats['episodes_per_sec'] > 10:
            f.write("  ✅ Высокая скорость обучения\n")
        else:
            f.write("  ⚠️  Низкая скорость обучения\n")
    
    print(f"   ✅ Отчет сохранен: {report_file}")
    
    print(f"\n🎉 Анализ завершен!")
    print(f"📊 Основные результаты:")
    print(f"   • Средняя награда: {stats['mean_reward']:.1f}")
    print(f"   • Стабильность: {stats['stability']}")
    print(f"   • Скорость: {stats['episodes_per_sec']:.1f} эпизодов/сек")

if __name__ == "__main__":
    analyze_quick_test_results() 