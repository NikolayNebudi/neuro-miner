#!/usr/bin/env python3
"""
Мониторинг RL-обучения в реальном времени
"""

import time
import os
import pandas as pd
from datetime import datetime

def monitor_training(csv_file='analysis_log.csv', interval=5):
    """Мониторит процесс обучения в реальном времени"""
    
    print("🔍 Мониторинг RL-обучения")
    print("Нажмите Ctrl+C для остановки")
    print("-" * 50)
    
    last_size = 0
    
    try:
        while True:
            if os.path.exists(csv_file):
                current_size = os.path.getsize(csv_file)
                
                if current_size > last_size:
                    # Читаем новые данные
                    df = pd.read_csv(csv_file, header=None, names=[
                        'episode_id', 'stage', 'result', 'reward', 'steps', 'trace',
                        'program_counts', 'avg_levels', 'enemies_killed', 'total_dp', 'total_cpu'
                    ])
                    
                    # Показываем последние эпизоды
                    recent = df.tail(3)
                    
                    print(f"\n⏰ {datetime.now().strftime('%H:%M:%S')}")
                    print(f"📊 Всего эпизодов: {len(df)}")
                    
                    for _, row in recent.iterrows():
                        result_icon = "✅" if row['result'] == 'win' else "❌"
                        stage_name = {0: "Экономика", 1: "Оборона", 2: "Полная игра"}.get(row['stage'], f"Этап {row['stage']}")
                        
                        print(f"   {result_icon} {stage_name}: награда={row['reward']:.2f}, шаги={row['steps']}")
                    
                    # Статистика по этапам
                    for stage in sorted(df['stage'].unique()):
                        stage_data = df[df['stage'] == stage]
                        wins = len(stage_data[stage_data['result'] == 'win'])
                        total = len(stage_data)
                        
                        if total > 0:
                            win_rate = wins / total * 100
                            avg_reward = stage_data['reward'].mean()
                            print(f"   📈 Этап {stage}: {wins}/{total} побед ({win_rate:.1f}%), средняя награда: {avg_reward:.2f}")
                    
                    last_size = current_size
                else:
                    print(f"⏳ Ожидание новых данных... ({interval}с)")
            else:
                print(f"⏳ Файл {csv_file} не найден, ожидание... ({interval}с)")
            
            time.sleep(interval)
            
    except KeyboardInterrupt:
        print("\n\n🛑 Мониторинг остановлен")
        
        if os.path.exists(csv_file):
            df = pd.read_csv(csv_file, header=None, names=[
                'episode_id', 'stage', 'result', 'reward', 'steps', 'trace',
                'program_counts', 'avg_levels', 'enemies_killed', 'total_dp', 'total_cpu'
            ])
            
            print(f"\n📊 Финальная статистика:")
            print(f"   Всего эпизодов: {len(df)}")
            
            for stage in sorted(df['stage'].unique()):
                stage_data = df[df['stage'] == stage]
                wins = len(stage_data[stage_data['result'] == 'win'])
                total = len(stage_data)
                win_rate = wins / total * 100 if total > 0 else 0
                avg_reward = stage_data['reward'].mean()
                
                print(f"   Этап {stage}: {wins}/{total} побед ({win_rate:.1f}%), средняя награда: {avg_reward:.2f}")

def quick_stats(csv_file='analysis_log.csv'):
    """Быстрая статистика"""
    
    if not os.path.exists(csv_file):
        print(f"❌ Файл {csv_file} не найден")
        return
    
    df = pd.read_csv(csv_file, header=None, names=[
        'episode_id', 'stage', 'result', 'reward', 'steps', 'trace',
        'program_counts', 'avg_levels', 'enemies_killed', 'total_dp', 'total_cpu'
    ])
    
    print("📊 Быстрая статистика:")
    print(f"   Всего эпизодов: {len(df)}")
    
    for stage in sorted(df['stage'].unique()):
        stage_data = df[df['stage'] == stage]
        wins = len(stage_data[stage_data['result'] == 'win'])
        total = len(stage_data)
        win_rate = wins / total * 100 if total > 0 else 0
        avg_reward = stage_data['reward'].mean()
        
        print(f"   Этап {stage}: {wins}/{total} побед ({win_rate:.1f}%), средняя награда: {avg_reward:.2f}")
    
    # Лучший результат
    best = df.loc[df['reward'].idxmax()]
    print(f"   🏆 Лучший результат: награда={best['reward']:.2f}, этап={best['stage']}, результат={best['result']}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'stats':
        quick_stats()
    else:
        monitor_training() 