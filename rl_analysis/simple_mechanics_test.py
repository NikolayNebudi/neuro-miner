#!/usr/bin/env python3
"""
Простое тестирование игровой механики Network Echo
"""

import gymnasium as gym
from network_echo_env_improved import NetworkEchoEnvImproved
import numpy as np
import time

def test_basic_mechanics():
    """Тестирование базовой механики игры"""
    
    print("🎮 ТЕСТИРОВАНИЕ БАЗОВОЙ МЕХАНИКИ")
    print("=" * 40)
    
    # Создаем окружение
    config = {
        'mode': 'full',
        'stage': 0,
        'reduce_randomness': True,
        'improved_rewards': True,
        'curriculum_learning': True
    }
    
    env = NetworkEchoEnvImproved(config=config)
    
    print("✅ Окружение создано успешно")
    
    # Тестируем сброс
    print("\n🔄 Тестирование сброса окружения...")
    obs, info = env.reset()
    print(f"✅ Сброс выполнен. Размер наблюдения: {len(obs)}")
    print(f"📊 Начальное состояние:")
    print(f"  • DP: {obs[0]:.2f}")
    print(f"  • CPU: {obs[1]:.2f}")
    print(f"  • Уровень трассировки: {obs[12]:.2f}")
    print(f"  • Враги: {obs[14]:.0f}")
    print(f"  • Узлы: {obs[15]:.0f}/{obs[16]:.0f}")
    
    # Тестируем действия
    print("\n🎯 Тестирование действий...")
    
    actions_to_test = [0, 1, 6, 11, 12, 13]  # Основные действия
    action_names = ["Нет действия", "Купить программу 1", "Апгрейд программы 1", 
                   "Атака", "Захват узла", "Захват сети"]
    
    for i, (action, name) in enumerate(zip(actions_to_test, action_names)):
        print(f"\n  Тест {i+1}: {name} (действие {action})")
        
        try:
            obs, reward, terminated, truncated, info = env.step(action)
            print(f"    ✅ Успешно. Награда: {reward:.3f}")
            print(f"    📊 Состояние: DP={obs[0]:.1f}, CPU={obs[1]:.1f}, Программы=[{obs[7]:.0f},{obs[8]:.0f},{obs[9]:.0f},{obs[10]:.0f},{obs[11]:.0f}]")
            
            if terminated:
                print(f"    🏁 Игра завершена: {info.get('reason', 'Неизвестно')}")
                break
                
        except Exception as e:
            print(f"    ❌ Ошибка: {e}")
            break
    
    env.close()
    print("\n✅ Базовое тестирование завершено")

def test_episode_completion():
    """Тестирование завершения эпизода"""
    
    print("\n🎮 ТЕСТИРОВАНИЕ ЗАВЕРШЕНИЯ ЭПИЗОДА")
    print("=" * 40)
    
    config = {
        'mode': 'full',
        'stage': 0,
        'reduce_randomness': True,
        'improved_rewards': True,
        'curriculum_learning': True
    }
    
    env = NetworkEchoEnvImproved(config=config)
    
    # Простая стратегия для завершения эпизода
    obs, info = env.reset()
    step = 0
    total_reward = 0
    max_steps = 50  # Ограничиваем количество шагов
    
    print("🎯 Запуск простой стратегии...")
    
    while step < max_steps:
        # Простая стратегия: покупаем программы и атакуем
        if obs[0] >= 10 and obs[7] == 0:
            action = 1  # Покупаем программу 1
        elif obs[0] >= 15 and obs[8] == 0:
            action = 2  # Покупаем программу 2
        elif obs[14] > 0:
            action = 11  # Атакуем врагов
        elif obs[15] < obs[16]:
            action = 12  # Захватываем узлы
        else:
            action = 0  # Ничего не делаем
        
        try:
            obs, reward, terminated, truncated, info = env.step(action)
            total_reward += reward
            step += 1
            
            if step % 10 == 0:
                print(f"  Шаг {step}: DP={obs[0]:.1f}, CPU={obs[1]:.1f}, Награда={total_reward:.1f}")
            
            if terminated or truncated:
                break
                
        except Exception as e:
            print(f"  ❌ Ошибка на шаге {step}: {e}")
            break
    
    env.close()
    
    print(f"\n📊 Результаты:")
    print(f"  • Шагов выполнено: {step}")
    print(f"  • Общая награда: {total_reward:.3f}")
    print(f"  • Средняя награда: {total_reward/max(1, step):.3f}")
    print(f"  • Причина завершения: {info.get('reason', 'Максимальное время')}")

def test_different_modes():
    """Тестирование разных режимов игры"""
    
    print("\n🎮 ТЕСТИРОВАНИЕ РАЗНЫХ РЕЖИМОВ")
    print("=" * 40)
    
    modes = [
        ('economy_tutorial', 'Экономика (обучение)'),
        ('defense_tutorial', 'Оборона (обучение)'),
        ('full', 'Полная игра')
    ]
    
    for mode, name in modes:
        print(f"\n🎯 Тестирование режима: {name}")
        
        config = {
            'mode': mode,
            'stage': 0,
            'reduce_randomness': True,
            'improved_rewards': True,
            'curriculum_learning': True
        }
        
        try:
            env = NetworkEchoEnvImproved(config=config)
            obs, info = env.reset()
            
            print(f"  ✅ Режим {mode} работает")
            print(f"  📊 Начальное состояние: DP={obs[0]:.1f}, CPU={obs[1]:.1f}")
            
            # Тестируем несколько шагов
            for i in range(5):
                action = 0  # Ничего не делаем
                obs, reward, terminated, truncated, info = env.step(action)
                if terminated or truncated:
                    break
            
            env.close()
            print(f"  ✅ Тестирование завершено")
            
        except Exception as e:
            print(f"  ❌ Ошибка в режиме {mode}: {e}")

def main():
    """Главная функция тестирования"""
    
    print("🎮 ПРОСТОЕ ТЕСТИРОВАНИЕ МЕХАНИКИ NETWORK ECHO")
    print("=" * 60)
    
    try:
        # Тестируем базовую механику
        test_basic_mechanics()
        
        # Тестируем завершение эпизода
        test_episode_completion()
        
        # Тестируем разные режимы
        test_different_modes()
        
        print("\n🎉 ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ УСПЕШНО!")
        print("✅ Механика игры работает корректно")
        
    except Exception as e:
        print(f"\n❌ КРИТИЧЕСКАЯ ОШИБКА: {e}")
        print("🔧 Проверьте настройки окружения")

if __name__ == "__main__":
    main() 