#!/usr/bin/env python3
"""
Демонстрация работы обученной RL-модели
"""

import gymnasium as gym
from stable_baselines3 import PPO
from network_echo_env import NetworkEchoEnv
import time

def demo_model(model_path='ppo_networkecho.zip', episodes=3):
    """Демонстрирует работу обученной модели"""
    
    print("🎮 Демонстрация обученной модели")
    print("=" * 50)
    
    # Создаем окружение
    env = NetworkEchoEnv()
    
    try:
        # Загружаем модель
        model = PPO.load(model_path)
        print(f"✅ Модель загружена из {model_path}")
        
        for episode in range(episodes):
            print(f"\n🎯 Эпизод {episode + 1}/{episodes}")
            print("-" * 30)
            
            obs, info = env.reset()
            total_reward = 0
            step = 0
            
            while True:
                # Получаем действие от модели
                action, _states = model.predict(obs, deterministic=True)
                
                # Выполняем действие
                obs, reward, terminated, truncated, info = env.step(action)
                total_reward += reward
                step += 1
                
                # Показываем состояние
                if step % 100 == 0 or terminated or truncated:
                    print(f"   Шаг {step}: награда={reward:.2f}, общая={total_reward:.2f}")
                    
                    # Показываем статистику
                    if 'stats' in info:
                        stats = info['stats']
                        if stats:
                            print(f"     Ресурсы: DP={stats.get('total_dp', 0)}, CPU={stats.get('total_cpu', 0)}")
                            print(f"     Программы: {stats.get('program_counts', {})}")
                            print(f"     Убито врагов: {stats.get('enemies_killed', 0)}")
                
                if terminated or truncated:
                    result = "Победа! 🏆" if terminated and reward > 0 else "Поражение ❌"
                    print(f"   {result} (шагов: {step}, общая награда: {total_reward:.2f})")
                    break
                    
                # Небольшая задержка для читаемости
                time.sleep(0.01)
        
        print(f"\n✅ Демонстрация завершена!")
        
    except FileNotFoundError:
        print(f"❌ Модель {model_path} не найдена!")
        print("Сначала запустите train.py для обучения модели")
    except Exception as e:
        print(f"❌ Ошибка при демонстрации: {e}")
    finally:
        env.close()

def compare_models():
    """Сравнивает разные модели"""
    
    models = [
        ('ppo_economy_trained.zip', 'Экономика'),
        ('ppo_defense_trained.zip', 'Оборона'),
        ('ppo_networkecho.zip', 'Полная игра')
    ]
    
    print("🔍 Сравнение моделей")
    print("=" * 50)
    
    for model_path, model_name in models:
        try:
            model = PPO.load(model_path)
            print(f"✅ {model_name}: {model_path}")
        except FileNotFoundError:
            print(f"❌ {model_name}: {model_path} - не найден")
        except Exception as e:
            print(f"❌ {model_name}: ошибка загрузки - {e}")

def interactive_demo():
    """Интерактивная демонстрация с выбором модели"""
    
    print("🎮 Интерактивная демонстрация")
    print("=" * 50)
    
    models = [
        ('ppo_economy_trained.zip', 'Экономика'),
        ('ppo_defense_trained.zip', 'Оборона'),
        ('ppo_networkecho.zip', 'Полная игра')
    ]
    
    print("Доступные модели:")
    for i, (path, name) in enumerate(models):
        print(f"  {i+1}. {name} ({path})")
    
    try:
        choice = int(input("\nВыберите модель (1-3): ")) - 1
        if 0 <= choice < len(models):
            model_path, model_name = models[choice]
            episodes = int(input("Количество эпизодов (1-10): "))
            episodes = max(1, min(10, episodes))
            
            print(f"\n🎯 Запуск демонстрации: {model_name}")
            demo_model(model_path, episodes)
        else:
            print("❌ Неверный выбор")
    except ValueError:
        print("❌ Введите число")
    except KeyboardInterrupt:
        print("\n🛑 Демонстрация отменена")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == 'compare':
            compare_models()
        elif sys.argv[1] == 'interactive':
            interactive_demo()
        else:
            demo_model(sys.argv[1])
    else:
        demo_model() 