#!/usr/bin/env python3
"""
Улучшенный скрипт обучения с оптимизированными наградами
Исправляет проблемы с вечным ожиданием и улучшает функцию наград
"""

import os
import sys
import json
import numpy as np
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv
from stable_baselines3.common.callbacks import CheckpointCallback, EvalCallback
from stable_baselines3.common.monitor import Monitor
from network_echo_env_improved import NetworkEchoEnvImproved
import matplotlib.pyplot as plt
from datetime import datetime
import time

def create_env(log_actions=True):
    """Создает окружение с улучшенными наградами"""
    def make_env():
        env = NetworkEchoEnvImproved(
            config={
                'reduce_randomness': True,  # Уменьшаем случайность
                'enemy_spawn_rate': 0.1,   # Уменьшаем спавн врагов
                'resource_spawn_rate': 0.2  # Увеличиваем ресурсы
            },
            log_actions=log_actions,
            log_path="improved_training_log.jsonl",
            max_log_entries=5000
        )
        return Monitor(env)
    
    return DummyVecEnv([make_env])

def train_improved_model(total_timesteps=1000000, save_interval=50000):
    print("[DEBUG] Вход в train_improved_model")
    print(f"[DEBUG] total_timesteps={total_timesteps}, save_interval={save_interval}")
    print("🚀 ЗАПУСК УЛУЧШЕННОГО ОБУЧЕНИЯ")
    print("=" * 50)
    
    # Создаем окружение
    print("[DEBUG] Создание окружения...")
    env = create_env(log_actions=True)
    print("[DEBUG] Окружение создано")
    print(f"[DEBUG] env.action_space: {env.action_space}")
    print(f"[DEBUG] env.observation_space: {env.observation_space}")
    
    # Создаем модель
    print("[DEBUG] Создание модели...")
    try:
        model = PPO(
            "MlpPolicy",
            env,
            learning_rate=3e-4,
            n_steps=2048,
            batch_size=64,
            n_epochs=4,
            gamma=0.99,
            gae_lambda=0.95,
            clip_range=0.2,
            clip_range_vf=None,
            normalize_advantage=True,
            ent_coef=0.01,
            vf_coef=0.5,
            max_grad_norm=0.5,
            target_kl=None,
            tensorboard_log="./tensorboard_logs_improved/",
            verbose=0
        )
        print("[DEBUG] Модель создана")
    except Exception as e:
        print(f"[DEBUG] Ошибка при создании модели: {e}")
        import traceback
        traceback.print_exc()
        raise
    
    # Создаем колбэки
    print("[DEBUG] Создание колбэков...")
    try:
        checkpoint_callback = CheckpointCallback(
            save_freq=save_interval,
            save_path="./checkpoints_improved/",
            name_prefix="PPO_improved"
        )
        print("[DEBUG] Колбэки созданы")
    except Exception as e:
        print(f"[DEBUG] Ошибка при создании колбэка: {e}")
        import traceback
        traceback.print_exc()
        raise
    
    # Создаем папки для сохранения
    os.makedirs("./checkpoints_improved/", exist_ok=True)
    os.makedirs("./tensorboard_logs_improved/", exist_ok=True)
    
    print(f"📊 Параметры обучения:")
    print(f"  🎯 Общее количество шагов: {total_timesteps:,}")
    print(f"  💾 Интервал сохранения: {save_interval:,}")
    print(f"  📈 Learning rate: 3e-4")
    print(f"  🎮 Batch size: 64")
    print(f"  🔄 N epochs: 4")
    print()
    
    # Запускаем обучение
    start_time = time.time()
    print("[DEBUG] Запуск model.learn...")
    try:
        model.learn(
            total_timesteps=total_timesteps,
            callback=checkpoint_callback,
            progress_bar=False
        )
        print("[DEBUG] Обучение завершено без исключений")
        
        # Сохраняем финальную модель
        final_model_path = f"improved_final_model_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        model.save(final_model_path)
        print(f"✅ Финальная модель сохранена: {final_model_path}")
        
    except KeyboardInterrupt:
        print("\n⚠️ Обучение прервано пользователем")
        # Сохраняем модель при прерывании
        interrupted_model_path = f"improved_interrupted_model_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        model.save(interrupted_model_path)
        print(f"💾 Модель сохранена при прерывании: {interrupted_model_path}")
    
    except Exception as e:
        print(f"❌ Ошибка во время обучения: {e}")
        import traceback
        traceback.print_exc()
        # Сохраняем модель при ошибке
        error_model_path = f"improved_error_model_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        model.save(error_model_path)
        print(f"💾 Модель сохранена при ошибке: {error_model_path}")
    
    finally:
        env.close()
        training_time = time.time() - start_time
        print(f"⏱️ Время обучения: {training_time:.1f} секунд")
    print("[DEBUG] Выход из train_improved_model")
    return model

def analyze_improved_training():
    """Анализирует результаты улучшенного обучения"""
    print("📊 АНАЛИЗ УЛУЧШЕННОГО ОБУЧЕНИЯ")
    print("=" * 40)
    
    # Ищем файлы логов
    log_files = [f for f in os.listdir('.') if f.startswith('improved_log_') and f.endswith('.jsonl')]
    
    if not log_files:
        print("❌ Не найдены файлы логов улучшенного обучения")
        return
    
    # Анализируем последний файл
    latest_log = max(log_files)
    print(f"📁 Анализируем файл: {latest_log}")
    
    # Читаем и анализируем логи
    episodes = []
    actions = []
    rewards = []
    
    with open(latest_log, 'r') as f:
        for line in f:
            try:
                data = json.loads(line.strip())
                if data.get('type') == 'action':
                    actions.append(data['chosen_action']['action'])
                    rewards.append(data.get('improved_reward', 0))
                elif data.get('type') == 'episode_end':
                    episodes.append({
                        'episode': data['episode'],
                        'total_steps': data['total_steps'],
                        'total_reward': data['total_reward'],
                        'final_score': data['final_score'],
                        'win': data['win']
                    })
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
    print(f"  📊 Средняя длина эпизода: {np.mean([ep['total_steps'] for ep in episodes]):.1f}")
    print(f"  🏆 Побед: {sum(1 for ep in episodes if ep['win'])}")
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
    
    # Создаем визуализацию
    create_improved_visualization(episodes, actions, rewards)

def create_improved_visualization(episodes, actions, rewards):
    """Создает визуализацию результатов улучшенного обучения"""
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
    
    # График наград по эпизодам
    episode_rewards = [ep['total_reward'] for ep in episodes]
    episode_numbers = [ep['episode'] for ep in episodes]
    
    ax1.plot(episode_numbers, episode_rewards, 'b-o', linewidth=2, markersize=6)
    ax1.set_title('Награды по эпизодам (улучшенные)', fontsize=14, fontweight='bold')
    ax1.set_xlabel('Эпизод')
    ax1.set_ylabel('Общая награда')
    ax1.grid(True, alpha=0.3)
    
    # График длины эпизодов
    episode_lengths = [ep['total_steps'] for ep in episodes]
    ax2.plot(episode_numbers, episode_lengths, 'g-o', linewidth=2, markersize=6)
    ax2.set_title('Длина эпизодов', fontsize=14, fontweight='bold')
    ax2.set_xlabel('Эпизод')
    ax2.set_ylabel('Количество шагов')
    ax2.grid(True, alpha=0.3)
    
    # Распределение действий
    action_counts = {}
    for action in actions:
        action_counts[action] = action_counts.get(action, 0) + 1
    
    action_names = list(action_counts.keys())
    action_values = list(action_counts.values())
    colors = plt.cm.Set3(np.linspace(0, 1, len(action_names)))
    
    ax3.pie(action_values, labels=action_names, autopct='%1.1f%%', 
             colors=colors, startangle=90)
    ax3.set_title('Распределение действий', fontsize=14, fontweight='bold')
    
    # Гистограмма наград
    ax4.hist(rewards, bins=50, alpha=0.7, color='orange', edgecolor='black')
    ax4.set_title('Распределение наград', fontsize=14, fontweight='bold')
    ax4.set_xlabel('Награда')
    ax4.set_ylabel('Частота')
    ax4.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('improved_training_analysis.png', dpi=300, bbox_inches='tight')
    print("📊 Визуализация сохранена: improved_training_analysis.png")
    plt.show()

def main():
    """Главная функция"""
    print("🤖 УЛУЧШЕННАЯ СИСТЕМА ОБУЧЕНИЯ")
    print("=" * 50)
    print("1. Запустить обучение")
    print("2. Анализировать результаты")
    print("3. Выход")
    
    try:
        choice_input = input("\nВыберите действие (1-3): ").strip()
        if not choice_input:
            print("❌ Неверный ввод")
            return
        choice = int(choice_input)
        
        if choice == 1:
            # Параметры обучения
            total_steps_input = input("Введите количество шагов (по умолчанию 1,000,000): ").strip()
            total_steps = int(total_steps_input) if total_steps_input else 1000000
            
            save_interval_input = input("Введите интервал сохранения (по умолчанию 50,000): ").strip()
            save_interval = int(save_interval_input) if save_interval_input else 50000
            
            print(f"\n🚀 Запуск обучения на {total_steps:,} шагов...")
            model = train_improved_model(total_steps, save_interval)
            
        elif choice == 2:
            analyze_improved_training()
            
        elif choice == 3:
            print("👋 До свидания!")
            
        else:
            print("❌ Неверный выбор")
            
    except ValueError:
        print("❌ Неверный ввод")
    except KeyboardInterrupt:
        print("\n👋 Программа прервана пользователем")

if __name__ == "__main__":
    main() 