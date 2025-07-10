#!/usr/bin/env python3
"""
Тест улучшенного окружения с новыми наградами
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from network_echo_env_enhanced import NetworkEchoEnvEnhanced

def test_enhanced_env():
    """Тестирует улучшенное окружение"""
    print("🧪 ТЕСТ УЛУЧШЕННОГО ОКРУЖЕНИЯ")
    print("=" * 40)
    
    try:
        # Создаем окружение
        env = NetworkEchoEnvEnhanced(
            config={
                'reduce_randomness': True,
                'enemy_spawn_rate': 0.1,
                'resource_spawn_rate': 0.2
            },
            log_actions=True,
            max_log_entries=100
        )
        
        print("✅ Окружение создано успешно")
        print(f"📊 Максимальная длина эпизода: {env._max_steps}")
        
        # Тестируем reset
        print("🔄 Тестируем reset...")
        obs, info = env.reset()
        print(f"✅ Reset выполнен. Размер наблюдения: {obs.shape}")
        
        # Тестируем несколько шагов
        print("🎮 Тестируем несколько шагов...")
        total_reward = 0
        for i in range(10):
            action = env.action_space.sample()
            obs, reward, done, truncated, info = env.step(action)
            total_reward += reward
            print(f"Шаг {i+1}: действие={action}, награда={reward:.2f}, общая={total_reward:.2f}, done={done}")
            
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
    test_enhanced_env() 