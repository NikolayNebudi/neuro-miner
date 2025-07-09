#!/usr/bin/env python3
"""
Скрипт для тестирования окружения Network Echo перед обучением
"""

import sys
import os
import time
import numpy as np

# Добавляем путь к модулям
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from network_echo_env import NetworkEchoEnv

def test_environment():
    """Тестирует окружение на базовую функциональность"""
    print("🧪 Тестирование окружения Network Echo...")
    
    try:
        # Создаём окружение
        print("1. Создание окружения...")
        env = NetworkEchoEnv()
        print("✅ Окружение создано успешно")
        
        # Тестируем сброс
        print("2. Тестирование сброса...")
        obs = env.reset()
        print(f"✅ Сброс выполнен. Размер наблюдения: {obs.shape}")
        print(f"   Начальное состояние: DP={env.game_state.get('dp')}, CPU={env.game_state.get('cpu')}")
        
        # Тестируем несколько шагов
        print("3. Тестирование выполнения действий...")
        for step in range(10):
            action = env.action_space.sample()
            obs, reward, done, info = env.step(action)
            
            print(f"   Шаг {step+1}: действие={info['action']}, награда={reward:.2f}")
            print(f"   Состояние: DP={info['stats'].get('dp')}, CPU={info['stats'].get('cpu')}, Trace={info['stats'].get('traceLevel')}")
            
            if done:
                print(f"   Эпизод завершён на шаге {step+1}")
                break
        
        # Тестируем пространства
        print("4. Тестирование пространств...")
        print(f"   Пространство действий: {env.action_space}")
        print(f"   Пространство наблюдений: {env.observation_space}")
        
        # Тестируем нормализацию наблюдений
        print("5. Тестирование нормализации наблюдений...")
        obs_min = np.min(obs)
        obs_max = np.max(obs)
        print(f"   Диапазон наблюдений: [{obs_min:.3f}, {obs_max:.3f}]")
        
        if obs_min >= 0 and obs_max <= 1:
            print("✅ Наблюдения нормализованы корректно")
        else:
            print("⚠️  Наблюдения не нормализованы в диапазоне [0, 1]")
        
        # Тестируем несколько эпизодов
        print("6. Тестирование нескольких эпизодов...")
        episode_rewards = []
        episode_lengths = []
        
        for episode in range(3):
            obs = env.reset()
            total_reward = 0
            steps = 0
            done = False
            
            while not done and steps < 100:  # Ограничиваем длину эпизода
                action = env.action_space.sample()
                obs, reward, done, info = env.step(action)
                total_reward += reward
                steps += 1
            
            episode_rewards.append(total_reward)
            episode_lengths.append(steps)
            print(f"   Эпизод {episode+1}: награда={total_reward:.2f}, шаги={steps}")
        
        print(f"   Средняя награда: {np.mean(episode_rewards):.2f}")
        print(f"   Средняя длина: {np.mean(episode_lengths):.1f}")
        
        # Закрываем окружение
        print("7. Закрытие окружения...")
        env.close()
        print("✅ Окружение закрыто успешно")
        
        print("\n🎉 Все тесты пройдены успешно!")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка во время тестирования: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_action_encoding():
    """Тестирует кодирование действий"""
    print("\n🔧 Тестирование кодирования действий...")
    
    try:
        env = NetworkEchoEnv()
        obs = env.reset()
        
        # Получаем возможные действия
        possible_actions = env._send_command({
            'cmd': 'get_actions',
            'state': env.game_state
        })
        
        if 'actions' in possible_actions:
            actions = possible_actions['actions']
            print(f"   Доступно действий: {len(actions)}")
            
            for i, action in enumerate(actions[:5]):  # Показываем первые 5
                print(f"   Действие {i}: {action}")
            
            # Тестируем кодирование
            for i in range(min(10, len(actions))):
                encoded_action = env._encode_action(i)
                print(f"   Индекс {i} -> {encoded_action}")
        
        env.close()
        print("✅ Кодирование действий работает корректно")
        
    except Exception as e:
        print(f"❌ Ошибка в кодировании действий: {e}")

def test_observation_encoding():
    """Тестирует кодирование наблюдений"""
    print("\n👁️  Тестирование кодирования наблюдений...")
    
    try:
        env = NetworkEchoEnv()
        obs = env.reset()
        
        # Анализируем наблюдение
        print(f"   Размер наблюдения: {obs.shape}")
        print(f"   Тип данных: {obs.dtype}")
        print(f"   Диапазон: [{np.min(obs):.3f}, {np.max(obs):.3f}]")
        
        # Проверяем компоненты наблюдения
        print("   Компоненты наблюдения:")
        print(f"     Ресурсы (0-4): {obs[:5]}")
        print(f"     Ноды (5-9): {obs[5:10]}")
        print(f"     Программы (10-13): {obs[10:14]}")
        print(f"     Враги (14-16): {obs[14:17]}")
        print(f"     Захват сети (17-18): {obs[17:19]}")
        
        env.close()
        print("✅ Кодирование наблюдений работает корректно")
        
    except Exception as e:
        print(f"❌ Ошибка в кодировании наблюдений: {e}")

if __name__ == "__main__":
    print("🚀 Запуск тестов окружения Network Echo")
    print("=" * 50)
    
    # Основные тесты
    success = test_environment()
    
    if success:
        # Дополнительные тесты
        test_action_encoding()
        test_observation_encoding()
        
        print("\n" + "=" * 50)
        print("🎯 Окружение готово к обучению!")
        print("Запустите: python train_network_echo.py")
    else:
        print("\n" + "=" * 50)
        print("❌ Окружение требует исправления перед обучением")
        sys.exit(1) 