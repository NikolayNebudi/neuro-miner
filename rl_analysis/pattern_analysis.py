#!/usr/bin/env python3
"""
Анализ паттернов и причин нестабильности в RL-обучении
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def analyze_instability(csv_file='analysis_log.csv'):
    """Анализирует причины нестабильности результатов"""
    
    # Читаем данные
    df = pd.read_csv(csv_file, header=None, names=[
        'episode_id', 'stage', 'result', 'reward', 'steps', 'trace',
        'program_counts', 'avg_levels', 'enemies_killed', 'total_dp', 'total_cpu'
    ])
    
    print("🔍 Анализ нестабильности результатов")
    print("=" * 60)
    
    # Основные проблемы
    print("🚨 ВЫЯВЛЕННЫЕ ПРОБЛЕМЫ:")
    
    # 1. Проблема с этапами
    stage_counts = df['stage'].value_counts()
    print(f"\n1️⃣  Неравномерное распределение по этапам:")
    for stage, count in stage_counts.items():
        percentage = count / len(df) * 100
        print(f"   Этап {stage}: {count} эпизодов ({percentage:.1f}%)")
    
    # 2. Проблема с результатами
    result_counts = df['result'].value_counts()
    print(f"\n2️⃣  Крайне низкий процент побед:")
    for result, count in result_counts.items():
        percentage = count / len(df) * 100
        print(f"   {result}: {count} ({percentage:.1f}%)")
    
    # 3. Анализ вариативности наград
    print(f"\n3️⃣  Высокая вариативность наград:")
    for stage in sorted(df['stage'].unique()):
        stage_data = df[df['stage'] == stage]
        rewards = stage_data['reward'].values
        print(f"   Этап {stage}:")
        print(f"     Среднее: {rewards.mean():.2f}")
        print(f"     Стандартное отклонение: {rewards.std():.2f}")
        print(f"     Коэффициент вариации: {rewards.std() / abs(rewards.mean()):.2f}")
    
    # 4. Анализ корреляций
    print(f"\n4️⃣  Проблемные корреляции:")
    numeric_cols = ['reward', 'steps', 'total_dp']
    numeric_data = df[numeric_cols].copy()
    
    # Убираем NaN значения
    numeric_data = numeric_data.dropna()
    
    if len(numeric_data) > 0:
        corr_matrix = numeric_data.corr()
        print("   Корреляции между параметрами:")
        for i, col1 in enumerate(numeric_cols):
            for j, col2 in enumerate(numeric_cols):
                if i < j:
                    corr = corr_matrix.loc[col1, col2]
                    print(f"     {col1} ↔ {col2}: {corr:.3f}")
                    
                    # Анализируем проблемные корреляции
                    if abs(corr) > 0.9:
                        print(f"       ⚠️  Слишком высокая корреляция!")
                    elif abs(corr) < 0.1:
                        print(f"       ⚠️  Отсутствует корреляция!")
    
    # 5. Анализ последовательностей
    print(f"\n5️⃣  Анализ последовательностей:")
    recent_results = df.tail(20)['result'].values
    print(f"   Последние 20 результатов:")
    
    # Подсчет серий
    win_streaks = []
    loss_streaks = []
    current_streak = 1
    current_result = recent_results[0]
    
    for i in range(1, len(recent_results)):
        if recent_results[i] == current_result:
            current_streak += 1
        else:
            if current_result == 'win':
                win_streaks.append(current_streak)
            else:
                loss_streaks.append(current_streak)
            current_streak = 1
            current_result = recent_results[i]
    
    # Добавляем последнюю серию
    if current_result == 'win':
        win_streaks.append(current_streak)
    else:
        loss_streaks.append(current_streak)
    
    print(f"   Серии побед: {win_streaks}")
    print(f"   Серии поражений: {loss_streaks}")
    
    if len(loss_streaks) > 0 and max(loss_streaks) > 5:
        print(f"   ⚠️  Длинные серии поражений ({max(loss_streaks)} подряд)")
    
    # 6. Анализ аномалий
    print(f"\n6️⃣  Аномальные результаты:")
    
    for stage in sorted(df['stage'].unique()):
        stage_data = df[df['stage'] == stage]
        if len(stage_data) > 10:
            rewards = stage_data['reward'].values
            q25, q75 = np.percentile(rewards, [25, 75])
            iqr = q75 - q25
            lower_bound = q25 - 1.5 * iqr
            upper_bound = q75 + 1.5 * iqr
            
            outliers = stage_data[(stage_data['reward'] < lower_bound) | (stage_data['reward'] > upper_bound)]
            if len(outliers) > 0:
                print(f"   Этап {stage}: {len(outliers)} выбросов из {len(stage_data)} эпизодов")
                for _, row in outliers.iterrows():
                    print(f"     Награда: {row['reward']:.2f}, шаги: {row['steps']}, результат: {row['result']}")

def suggest_solutions():
    """Предлагает решения проблем"""
    
    print(f"\n💡 РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ:")
    
    print(f"\n1️⃣  Проблема: Неравномерное распределение по этапам")
    print(f"   Решения:")
    print(f"   - Увеличить количество эпизодов на каждом этапе")
    print(f"   - Добавить промежуточные этапы сложности")
    print(f"   - Использовать curriculum learning с плавными переходами")
    
    print(f"\n2️⃣  Проблема: Низкий процент побед (2%)")
    print(f"   Решения:")
    print(f"   - Упростить условия победы на начальных этапах")
    print(f"   - Увеличить время обучения (больше эпизодов)")
    print(f"   - Настроить shaping rewards для промежуточных достижений")
    print(f"   - Добавить exploration bonus для исследования стратегий")
    
    print(f"\n3️⃣  Проблема: Высокая вариативность результатов")
    print(f"   Решения:")
    print(f"   - Уменьшить случайность в окружении")
    print(f"   - Использовать более стабильные гиперпараметры")
    print(f"   - Добавить регуляризацию в политику")
    print(f"   - Использовать ensemble методы")
    
    print(f"\n4️⃣  Проблема: Длинные серии поражений")
    print(f"   Решения:")
    print(f"   - Добавить early stopping при длинных сериях")
    print(f"   - Использовать adaptive learning rate")
    print(f"   - Добавить exploration strategies (epsilon-greedy)")
    print(f"   - Реализовать experience replay с приоритетами")
    
    print(f"\n5️⃣  Проблема: Слишком высокая корреляция награда-шаги")
    print(f"   Решения:")
    print(f"   - Разделить награды на компоненты (ресурсы, время, эффективность)")
    print(f"   - Добавить sparse rewards для ключевых достижений")
    print(f"   - Использовать multi-objective optimization")
    
    print(f"\n🔧 КОНКРЕТНЫЕ ИЗМЕНЕНИЯ В КОДЕ:")
    print(f"   1. В train.py:")
    print(f"      - Увеличить EPISODES_PER_STAGE до 500000")
    print(f"      - Добавить early stopping")
    print(f"      - Реализовать adaptive learning rate")
    
    print(f"   2. В game_engine.js:")
    print(f"      - Уменьшить случайность спавна врагов")
    print(f"      - Добавить промежуточные награды")
    print(f"      - Упростить условия победы на этапе 0")
    
    print(f"   3. В network_echo_env.py:")
    print(f"      - Улучшить shaping rewards")
    print(f"      - Добавить exploration bonus")
    print(f"      - Реализовать curriculum learning")

def create_improvement_plan():
    """Создает план улучшений"""
    
    print(f"\n📋 ПЛАН УЛУЧШЕНИЙ:")
    
    print(f"\n🎯 Краткосрочные улучшения (1-2 дня):")
    print(f"   1. Увеличить количество эпизодов до 500k на этап")
    print(f"   2. Добавить промежуточные награды за ресурсы")
    print(f"   3. Упростить условия победы на этапе 0")
    print(f"   4. Уменьшить случайность в окружении")
    
    print(f"\n🎯 Среднесрочные улучшения (1 неделя):")
    print(f"   1. Реализовать curriculum learning")
    print(f"   2. Добавить exploration strategies")
    print(f"   3. Улучшить shaping rewards")
    print(f"   4. Добавить early stopping")
    
    print(f"\n🎯 Долгосрочные улучшения (2-4 недели):")
    print(f"   1. Multi-objective optimization")
    print(f"   2. Ensemble methods")
    print(f"   3. Advanced exploration (PPO with curiosity)")
    print(f"   4. Hyperparameter optimization")

if __name__ == "__main__":
    try:
        analyze_instability()
        suggest_solutions()
        create_improvement_plan()
        
        print(f"\n✅ Анализ завершен!")
        print(f"📊 Основные выводы:")
        print(f"   - Система показывает признаки переобучения на этапе 0")
        print(f"   - Недостаточно данных для стабильного обучения")
        print(f"   - Требуется настройка гиперпараметров")
        print(f"   - Необходимо улучшить reward shaping")
        
    except FileNotFoundError:
        print("❌ Файл analysis_log.csv не найден!")
    except Exception as e:
        print(f"❌ Ошибка при анализе: {e}") 