#!/usr/bin/env python3
"""
Анализ статистики обучения и результатов
"""

import json
import os
import pandas as pd
import numpy as np
from collections import defaultdict, Counter
import matplotlib.pyplot as plt
from datetime import datetime

def analyze_training_data():
    """Анализирует данные обучения"""
    print("📊 АНАЛИЗ СТАТИСТИКИ ОБУЧЕНИЯ")
    print("=" * 60)
    
    # Анализ логов
    log_file = "actions_log.jsonl"
    if os.path.exists(log_file):
        analyze_action_logs(log_file)
    
    # Анализ результатов обучения
    results_files = [
        "improved_analysis_log.csv",
        "quick_test_log.csv", 
        "optimized_analysis_log.csv"
    ]
    
    for file in results_files:
        if os.path.exists(file):
            analyze_results_file(file)
    
    # Анализ чекпоинтов
    analyze_checkpoints()
    
    # Анализ TensorBoard логов
    analyze_tensorboard_logs()

def analyze_action_logs(log_file):
    """Анализирует логи действий"""
    print(f"\n🎮 АНАЛИЗ ЛОГОВ ДЕЙСТВИЙ: {log_file}")
    print("-" * 40)
    
    file_size = os.path.getsize(log_file) / (1024 * 1024 * 1024)  # GB
    print(f"📁 Размер файла: {file_size:.2f} GB")
    
    # Быстрая статистика
    episodes = set()
    actions = Counter()
    steps_per_episode = defaultdict(int)
    rewards = []
    
    print("⏳ Анализируем логи...")
    with open(log_file, 'r') as f:
        for i, line in enumerate(f):
            if i % 10000 == 0:
                print(f"  Обработано {i:,} строк...")
            
            try:
                data = json.loads(line)
                episode = data.get('episode', 0)
                step = data.get('step', 0)
                action = data.get('chosen_action', {}).get('action', 'unknown')
                reward = data.get('reward', 0)
                
                episodes.add(episode)
                actions[action] += 1
                steps_per_episode[episode] = max(steps_per_episode[episode], step)
                rewards.append(reward)
                
            except:
                continue
    
    print(f"\n📈 СТАТИСТИКА ОБУЧЕНИЯ:")
    print(f"  🎮 Количество эпизодов: {len(episodes)}")
    print(f"  📝 Общее количество действий: {sum(actions.values()):,}")
    print(f"  📊 Средняя длина эпизода: {np.mean(list(steps_per_episode.values())):.0f} шагов")
    print(f"  🎯 Средняя награда: {np.mean(rewards):.3f}")
    print(f"  📈 Максимальная награда: {np.max(rewards):.3f}")
    print(f"  📉 Минимальная награда: {np.min(rewards):.3f}")
    
    print(f"\n🎯 РАСПРЕДЕЛЕНИЕ ДЕЙСТВИЙ:")
    for action, count in actions.most_common(10):
        percentage = count / sum(actions.values()) * 100
        print(f"  {action}: {count:,} ({percentage:.1f}%)")
    
    # Анализ прогресса
    print(f"\n📈 АНАЛИЗ ПРОГРЕССА:")
    episode_rewards = defaultdict(list)
    with open(log_file, 'r') as f:
        for line in f:
            try:
                data = json.loads(line)
                episode = data.get('episode', 0)
                reward = data.get('reward', 0)
                episode_rewards[episode].append(reward)
            except:
                continue
    
    if episode_rewards:
        avg_rewards_per_episode = {ep: np.mean(rewards) for ep, rewards in episode_rewards.items()}
        episodes_sorted = sorted(avg_rewards_per_episode.keys())
        rewards_sorted = [avg_rewards_per_episode[ep] for ep in episodes_sorted]
        
        print(f"  📊 Средняя награда по эпизодам:")
        print(f"    Первые 10 эпизодов: {np.mean(rewards_sorted[:10]):.3f}")
        print(f"    Последние 10 эпизодов: {np.mean(rewards_sorted[-10:]):.3f}")
        print(f"    Прогресс: {np.mean(rewards_sorted[-10:]) - np.mean(rewards_sorted[:10]):.3f}")

def analyze_results_file(file_path):
    """Анализирует файл результатов"""
    print(f"\n📋 АНАЛИЗ РЕЗУЛЬТАТОВ: {file_path}")
    print("-" * 40)
    
    try:
        df = pd.read_csv(file_path)
        print(f"📊 Количество записей: {len(df)}")
        
        if 'win' in df.columns:
            win_rate = df['win'].mean() * 100
            print(f"🎯 Процент побед: {win_rate:.1f}%")
        
        if 'final_score' in df.columns:
            print(f"📈 Статистика очков:")
            print(f"  Среднее: {df['final_score'].mean():.1f}")
            print(f"  Максимум: {df['final_score'].max():.1f}")
            print(f"  Минимум: {df['final_score'].min():.1f}")
        
        if 'total_steps' in df.columns:
            print(f"⏱️ Статистика шагов:")
            print(f"  Среднее: {df['total_steps'].mean():.0f}")
            print(f"  Максимум: {df['total_steps'].max():.0f}")
            print(f"  Минимум: {df['total_steps'].min():.0f}")
        
        print(f"📅 Период обучения: {df.iloc[0]['timestamp']} - {df.iloc[-1]['timestamp']}")
        
    except Exception as e:
        print(f"❌ Ошибка при анализе {file_path}: {e}")

def analyze_checkpoints():
    """Анализирует чекпоинты моделей"""
    print(f"\n💾 АНАЛИЗ ЧЕКПОИНТОВ")
    print("-" * 40)
    
    checkpoint_dirs = [
        "checkpoints",
        "models", 
        "best_models"
    ]
    
    for dir_name in checkpoint_dirs:
        if os.path.exists(dir_name):
            print(f"\n📁 Папка: {dir_name}")
            files = os.listdir(dir_name)
            model_files = [f for f in files if f.endswith('.zip')]
            
            if model_files:
                print(f"  📦 Найдено моделей: {len(model_files)}")
                for model in model_files:
                    file_path = os.path.join(dir_name, model)
                    size = os.path.getsize(file_path) / (1024 * 1024)  # MB
                    print(f"    {model}: {size:.1f} MB")
            else:
                print(f"  📭 Модели не найдены")

def analyze_tensorboard_logs():
    """Анализирует логи TensorBoard"""
    print(f"\n📊 АНАЛИЗ TENSORBOARD ЛОГОВ")
    print("-" * 40)
    
    tensorboard_dir = "tensorboard_logs"
    if os.path.exists(tensorboard_dir):
        runs = os.listdir(tensorboard_dir)
        print(f"📁 Найдено запусков: {len(runs)}")
        
        for run in runs:
            run_path = os.path.join(tensorboard_dir, run)
            if os.path.isdir(run_path):
                files = os.listdir(run_path)
                event_files = [f for f in files if f.startswith('events')]
                if event_files:
                    print(f"  🎯 {run}: {len(event_files)} файлов событий")
    else:
        print("📭 Папка TensorBoard не найдена")

def generate_training_report():
    """Генерирует отчет об обучении"""
    print(f"\n📋 ОТЧЕТ ОБ ОБУЧЕНИИ")
    print("=" * 60)
    
    # Общая статистика
    print(f"📊 ОБЩАЯ СТАТИСТИКА:")
    print(f"  🎮 Система: RL-обучение для игры Network Echo")
    print(f"  🏗️ Архитектура: PPO с улучшенными наградами")
    print(f"  📅 Дата анализа: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Проблемы и решения
    print(f"\n⚠️ ВЫЯВЛЕННЫЕ ПРОБЛЕМЫ:")
    print(f"  🔴 Размер логов: 34.49 GB (497,539 записей)")
    print(f"  🔴 Нехватка памяти при анализе")
    print(f"  🔴 Слишком много итераций обучения")
    print(f"  🔴 Неэффективное логирование")
    
    print(f"\n✅ РЕШЕНИЯ:")
    print(f"  🟢 Создана оптимизированная версия окружения")
    print(f"  🟢 Ограничение количества записей (50,000)")
    print(f"  🟢 Уменьшено количество итераций")
    print(f"  🟢 Улучшена система логирования")
    
    # Рекомендации
    print(f"\n💡 РЕКОМЕНДАЦИИ:")
    print(f"  📈 Использовать оптимизированную версию для обучения")
    print(f"  🔧 Настроить параметры под ваши ресурсы")
    print(f"  📊 Регулярно анализировать прогресс")
    print(f"  💾 Очищать старые логи")

def main():
    """Основная функция"""
    analyze_training_data()
    generate_training_report()

if __name__ == "__main__":
    main() 