#!/usr/bin/env python3
"""
Тест улучшенного окружения
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from network_echo_env_improved import NetworkEchoEnvImproved

def test_improved_env():
    """Тестирует улучшенное окружение"""
    print("🧪 ТЕСТ УЛУЧШЕННОГО ОКРУЖЕНИЯ")
    print("=" * 40)
    
    try:
        # Создаем окружение
        env = NetworkEchoEnvImproved(
            config={
                'reduce_randomness': True,
                'enemy_spawn_rate': 0.1,
                'resource_spawn_rate': 0.2
            },
            log_actions=True,
            max_log_entries=100
        )
        
        print("✅ Окружение создано успешно")
        
        # Тестируем reset
        print("🔄 Тестируем reset...")
        obs, info = env.reset()
        print(f"✅ Reset выполнен. Размер наблюдения: {obs.shape}")
        
        # Тестируем несколько шагов
        print("🎮 Тестируем несколько шагов...")
        for i in range(5):
            action = env.action_space.sample()
            obs, reward, done, truncated, info = env.step(action)
            print(f"Шаг {i+1}: действие={action}, награда={reward:.2f}, done={done}")
            
            if done:
                print("✅ Эпизод завершен")
                break
        
        # Закрываем окружение
        env.close()
        print("✅ Окружение закрыто")
        
        print("\n🎉 Тест прошел успешно!")
        
    except Exception as e:
        print(f"❌ Ошибка в тесте: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_improved_env() 