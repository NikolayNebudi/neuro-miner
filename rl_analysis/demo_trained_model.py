#!/usr/bin/env python3
"""
Демонстрация обученной модели Network Echo
"""

import gymnasium as gym
from stable_baselines3 import PPO
from network_echo_env_improved import NetworkEchoEnvImproved
import numpy as np
import time
import os

def demo_trained_model(model_path="ppo_quick_test.zip", episodes=3):
    """Демонстрация обученной модели"""
    
    print("🤖 ДЕМОНСТРАЦИЯ ОБУЧЕННОЙ МОДЕЛИ")
    print("=" * 50)
    
    if not os.path.exists(model_path):
        print(f"❌ Модель {model_path} не найдена!")
        print("Доступные модели:")
        for file in os.listdir("."):
            if file.endswith(".zip"):
                print(f"  • {file}")
        return
    
    # Создаем окружение
    config = {
        'mode': 'full',
        'stage': 0,
        'reduce_randomness': True,
        'improved_rewards': True,
        'curriculum_learning': True
    }
    
    env = NetworkEchoEnvImproved(config=config)
    
    # Загружаем модель
    print(f"📥 Загрузка модели: {model_path}")
    model = PPO.load(model_path)
    model.set_env(env)
    
    print(f"🎯 Демонстрация {episodes} эпизодов...")
    print()
    
    total_rewards = []
    total_steps = []
    wins = 0
    
    for episode in range(episodes):
        print(f"🎮 Эпизод {episode + 1}/{episodes}")
        print("-" * 30)
        
        obs, info = env.reset()
        step = 0
        total_reward = 0
        
        print(f"📊 Начальное состояние:")
        print(f"  • DP: {obs[0]:.2f} | CPU: {obs[1]:.2f}")
        print(f"  • Программы: [{obs[7]:.0f}, {obs[8]:.0f}, {obs[9]:.0f}, {obs[10]:.0f}, {obs[11]:.0f}]")
        print(f"  • Уровни: [{obs[2]:.0f}, {obs[3]:.0f}, {obs[4]:.0f}, {obs[5]:.0f}, {obs[6]:.0f}]")
        print(f"  • Враги: {obs[14]:.0f} | Узлы: {obs[15]:.0f}/{obs[16]:.0f}")
        print()
        
        while True:
            # Получаем действие от модели
            action, _ = model.predict(obs, deterministic=True)
            
            # Выполняем действие
            obs, reward, terminated, truncated, info = env.step(action)
            total_reward += reward
            step += 1
            
            # Показываем прогресс каждые 20 шагов
            if step % 20 == 0:
                print(f"  Шаг {step}: DP={obs[0]:.1f}, CPU={obs[1]:.1f}, Программы=[{obs[7]:.0f},{obs[8]:.0f},{obs[9]:.0f},{obs[10]:.0f},{obs[11]:.0f}], Награда={total_reward:.1f}")
            
            if terminated or truncated:
                break
        
        # Результаты эпизода
        total_rewards.append(total_reward)
        total_steps.append(step)
        
        if info.get('win', False):
            wins += 1
            result = "✅ ПОБЕДА"
        else:
            result = "❌ ПОРАЖЕНИЕ"
        
        print(f"🏁 Эпизод {episode + 1} завершен: {result}")
        print(f"  • Шагов: {step}")
        print(f"  • Общая награда: {total_reward:.3f}")
        print(f"  • Средняя награда: {total_reward/max(1, step):.3f}")
        print(f"  • Причина: {info.get('reason', 'Неизвестно')}")
        print()
    
    env.close()
    
    # Итоговая статистика
    print("📊 ИТОГОВАЯ СТАТИСТИКА")
    print("=" * 30)
    print(f"  • Эпизодов: {episodes}")
    print(f"  • Побед: {wins} ({wins/episodes*100:.1f}%)")
    print(f"  • Средняя награда: {np.mean(total_rewards):.3f}")
    print(f"  • Среднее количество шагов: {np.mean(total_steps):.1f}")
    print(f"  • Лучшая награда: {max(total_rewards):.3f}")
    print(f"  • Худшая награда: {min(total_rewards):.3f}")

def demo_with_manual_control(model_path="ppo_quick_test.zip"):
    """Демонстрация с возможностью ручного управления"""
    
    print("🎮 ДЕМОНСТРАЦИЯ С РУЧНЫМ УПРАВЛЕНИЕМ")
    print("=" * 50)
    
    if not os.path.exists(model_path):
        print(f"❌ Модель {model_path} не найдена!")
        return
    
    # Создаем окружение
    config = {
        'mode': 'full',
        'stage': 0,
        'reduce_randomness': True,
        'improved_rewards': True,
        'curriculum_learning': True
    }
    
    env = NetworkEchoEnvImproved(config=config)
    
    # Загружаем модель
    print(f"📥 Загрузка модели: {model_path}")
    model = PPO.load(model_path)
    model.set_env(env)
    
    print("🎯 Режимы управления:")
    print("  • 'a' - Автоматическое управление моделью")
    print("  • 'm' - Ручное управление")
    print("  • 'q' - Выход")
    print()
    
    obs, info = env.reset()
    step = 0
    total_reward = 0
    
    while True:
        # Показываем текущее состояние
        print(f"\n🔄 Шаг {step + 1}")
        print(f"💰 DP: {obs[0]:.2f} | 🖥️ CPU: {obs[1]:.2f} | 🎯 Трассировка: {obs[12]:.2f}")
        print(f"📦 Программы: [{obs[7]:.0f}, {obs[8]:.0f}, {obs[9]:.0f}, {obs[10]:.0f}, {obs[11]:.0f}]")
        print(f"⭐ Уровни: [{obs[2]:.0f}, {obs[3]:.0f}, {obs[4]:.0f}, {obs[5]:.0f}, {obs[6]:.0f}]")
        print(f"👾 Враги: {obs[14]:.0f} | 🎯 Узлы: {obs[15]:.0f}/{obs[16]:.0f}")
        
        # Запрашиваем режим управления
        mode = input("\n🎮 Выберите режим (a/m/q): ").strip().lower()
        
        if mode == 'q':
            break
        elif mode == 'a':
            # Автоматическое управление
            print("🤖 Автоматическое управление...")
            action, _ = model.predict(obs, deterministic=True)
            print(f"  Действие модели: {action}")
        elif mode == 'm':
            # Ручное управление
            print("🎮 Доступные действия:")
            print("  0: Нет действия | 1-5: Купить программу | 6-10: Апгрейд | 11: Атака | 12: Захват узла | 13: Захват сети")
            try:
                action = int(input("Введите действие (0-13): "))
                if action < 0 or action > 13:
                    print("❌ Неверное действие! Используется действие 0")
                    action = 0
            except ValueError:
                print("❌ Неверный ввод! Используется действие 0")
                action = 0
        else:
            print("❌ Неверный режим! Используется автоматическое управление")
            action, _ = model.predict(obs, deterministic=True)
        
        # Выполняем действие
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        step += 1
        
        print(f"✅ Действие {action} выполнено")
        print(f"🎁 Награда: {reward:.3f}")
        print(f"📈 Общая награда: {total_reward:.3f}")
        
        if terminated:
            print(f"\n🏁 Игра завершена! Причина: {info.get('reason', 'Неизвестно')}")
            if info.get('win', False):
                print("🎉 ПОБЕДА!")
            else:
                print("💀 Поражение")
            break
            
        if truncated:
            print(f"\n⏰ Игра прервана (максимальное время)")
            break
    
    env.close()
    
    print(f"\n📊 Итоговая статистика:")
    print(f"  • Шагов: {step}")
    print(f"  • Общая награда: {total_reward:.3f}")
    print(f"  • Средняя награда за шаг: {total_reward/max(1, step):.3f}")

def main():
    """Главное меню демонстрации"""
    
    print("🤖 ДЕМОНСТРАЦИЯ ОБУЧЕННОЙ МОДЕЛИ")
    print("=" * 50)
    print("1. Автоматическая демонстрация (3 эпизода)")
    print("2. Интерактивная демонстрация")
    print("3. Выход")
    print()
    
    # Проверяем доступные модели
    available_models = [f for f in os.listdir(".") if f.endswith(".zip")]
    if available_models:
        print("📁 Доступные модели:")
        for i, model in enumerate(available_models):
            print(f"  {i+1}. {model}")
        print()
        
        if len(available_models) == 1:
            model_path = available_models[0]
        else:
            try:
                choice = int(input("Выберите модель (номер): ")) - 1
                if 0 <= choice < len(available_models):
                    model_path = available_models[choice]
                else:
                    model_path = available_models[0]
            except:
                model_path = available_models[0]
    else:
        print("❌ Модели не найдены! Сначала обучите модель.")
        return
    
    while True:
        choice = input("Выберите режим (1-3): ").strip()
        
        if choice == '1':
            demo_trained_model(model_path)
            break
        elif choice == '2':
            demo_with_manual_control(model_path)
            break
        elif choice == '3':
            print("👋 До свидания!")
            break
        else:
            print("❌ Неверный выбор! Используйте 1-3")

if __name__ == "__main__":
    main() 