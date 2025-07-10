#!/usr/bin/env python3
"""
Демонстрация обученной легкой модели
Использует NetworkEchoEnvLight для совместимости
"""

import os
import sys
import json
import numpy as np
from stable_baselines3 import PPO
from network_echo_env_light import NetworkEchoEnvLight
import matplotlib.pyplot as plt
import time

def demo_light_model(model_path, episodes=3, interactive=False):
    """Демонстрирует обученную легкую модель"""
    print(f"🤖 ДЕМОНСТРАЦИЯ ЛЕГКОЙ МОДЕЛИ")
    print("=" * 50)
    print(f"📥 Загрузка модели: {model_path}")
    
    # Создаем окружение
    env = NetworkEchoEnvLight(log_actions=True, log_path="demo_light_actions.jsonl")
    
    # Загружаем модель
    try:
        model = PPO.load(model_path)
        print("✅ Модель загружена успешно")
    except Exception as e:
        print(f"❌ Ошибка загрузки модели: {e}")
        return
    
    # Устанавливаем окружение для модели
    model.set_env(env)
    
    print(f"🎮 Демонстрация {episodes} эпизодов...")
    print()
    
    episode_rewards = []
    episode_lengths = []
    action_counts = {}
    
    for episode in range(episodes):
        print(f"🎯 ЭПИЗОД {episode + 1}/{episodes}")
        print("-" * 30)
        
        obs, info = env.reset()
        done = False
        truncated = False
        total_reward = 0
        step_count = 0
        episode_actions = []
        
        while not (done or truncated):
            # Получаем действие от модели
            action, _states = model.predict(obs, deterministic=True)
            episode_actions.append(action)
            
            # Выполняем действие
            obs, reward, done, truncated, info = env.step(action)
            total_reward += reward
            step_count += 1
            
            # Выводим информацию о шаге
            if step_count % 50 == 0:
                print(f"  Шаг {step_count}: награда = {reward:.3f}, общая = {total_reward:.3f}")
            
            # Интерактивный режим
            if interactive:
                input("Нажмите Enter для следующего шага...")
        
        # Статистика эпизода
        episode_rewards.append(total_reward)
        episode_lengths.append(step_count)
        
        # Подсчет действий
        for action in episode_actions:
            action_name = env._actions[action]
            action_counts[action_name] = action_counts.get(action_name, 0) + 1
        
        print(f"🏁 Эпизод завершен:")
        print(f"  📊 Шагов: {step_count}")
        print(f"  🎯 Общая награда: {total_reward:.3f}")
        print(f"  📈 Средняя награда за шаг: {total_reward/step_count:.3f}")
        print()
    
    # Закрываем окружение
    env.close()
    
    # Выводим общую статистику
    print("📊 ОБЩАЯ СТАТИСТИКА")
    print("=" * 30)
    print(f"🎮 Средняя награда: {np.mean(episode_rewards):.3f}")
    print(f"📈 Средняя длина эпизода: {np.mean(episode_lengths):.1f}")
    print(f"🎯 Минимальная награда: {np.min(episode_rewards):.3f}")
    print(f"🏆 Максимальная награда: {np.max(episode_rewards):.3f}")
    print()
    
    print("🎮 РАСПРЕДЕЛЕНИЕ ДЕЙСТВИЙ:")
    total_actions = sum(action_counts.values())
    for action, count in sorted(action_counts.items(), key=lambda x: x[1], reverse=True):
        percentage = (count / total_actions) * 100
        print(f"  {action}: {count} ({percentage:.1f}%)")
    
    # Создаем визуализацию
    create_demo_visualization(episode_rewards, episode_lengths, action_counts)

def create_demo_visualization(rewards, lengths, actions):
    """Создает визуализацию результатов демонстрации"""
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
    
    # График наград
    ax1.plot(rewards, 'b-o', linewidth=2, markersize=8)
    ax1.set_title('Награды по эпизодам', fontsize=14, fontweight='bold')
    ax1.set_xlabel('Эпизод')
    ax1.set_ylabel('Награда')
    ax1.grid(True, alpha=0.3)
    
    # График длины эпизодов
    ax2.plot(lengths, 'g-o', linewidth=2, markersize=8)
    ax2.set_title('Длина эпизодов', fontsize=14, fontweight='bold')
    ax2.set_xlabel('Эпизод')
    ax2.set_ylabel('Количество шагов')
    ax2.grid(True, alpha=0.3)
    
    # Распределение действий
    action_names = list(actions.keys())
    action_counts = list(actions.values())
    colors = plt.cm.Set3(np.linspace(0, 1, len(action_names)))
    
    ax3.pie(action_counts, labels=action_names, autopct='%1.1f%%', 
             colors=colors, startangle=90)
    ax3.set_title('Распределение действий', fontsize=14, fontweight='bold')
    
    # Столбчатая диаграмма действий
    bars = ax4.bar(action_names, action_counts, color=colors)
    ax4.set_title('Количество действий', fontsize=14, fontweight='bold')
    ax4.set_ylabel('Количество')
    ax4.tick_params(axis='x', rotation=45)
    
    # Добавляем значения на столбцы
    for bar in bars:
        height = bar.get_height()
        ax4.text(bar.get_x() + bar.get_width()/2., height,
                f'{int(height)}', ha='center', va='bottom')
    
    plt.tight_layout()
    plt.savefig('demo_light_results.png', dpi=300, bbox_inches='tight')
    print("📊 Визуализация сохранена: demo_light_results.png")
    plt.show()

def main():
    """Главная функция"""
    print("🤖 ДЕМОНСТРАЦИЯ ЛЕГКОЙ МОДЕЛИ")
    print("=" * 50)
    
    # Находим доступные модели
    model_files = []
    for file in os.listdir('.'):
        if file.endswith('.zip') and 'light' in file:
            model_files.append(file)
    
    if not model_files:
        print("❌ Не найдены легкие модели (.zip файлы с 'light' в названии)")
        return
    
    print("📁 Доступные легкие модели:")
    for i, model in enumerate(model_files, 1):
        print(f"  {i}. {model}")
    
    try:
        choice = int(input("\nВыберите модель (номер): ")) - 1
        if 0 <= choice < len(model_files):
            model_path = model_files[choice]
        else:
            print("❌ Неверный выбор")
            return
    except ValueError:
        print("❌ Неверный ввод")
        return
    
    print("\nРежимы демонстрации:")
    print("1. Автоматическая демонстрация (3 эпизода)")
    print("2. Интерактивная демонстрация (1 эпизод)")
    print("3. Выход")
    
    try:
        mode = int(input("Выберите режим (1-3): "))
        if mode == 1:
            demo_light_model(model_path, episodes=3, interactive=False)
        elif mode == 2:
            demo_light_model(model_path, episodes=1, interactive=True)
        elif mode == 3:
            print("👋 До свидания!")
        else:
            print("❌ Неверный выбор")
    except ValueError:
        print("❌ Неверный ввод")

if __name__ == "__main__":
    main() 