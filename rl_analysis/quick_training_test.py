#!/usr/bin/env python3
"""
Быстрый тест обучения на 8000 шагов для отладки
"""

import os
import csv
import uuid
import gymnasium as gym
from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
from stable_baselines3.common.callbacks import BaseCallback, CheckpointCallback
from stable_baselines3.common.vec_env import DummyVecEnv, VecMonitor
from network_echo_env_improved import NetworkEchoEnvImproved
import numpy as np
from datetime import datetime

# БЫСТРЫЕ ПАРАМЕТРЫ ДЛЯ ТЕСТИРОВАНИЯ
QUICK_TOTAL_TIMESTEPS = 8000  # Всего 8000 шагов для быстрого теста
QUICK_LEARNING_RATE = 1e-4
QUICK_N_STEPS = 1024          # Уменьшено для быстрого обучения
QUICK_BATCH_SIZE = 64          # Уменьшено
QUICK_N_EPOCHS = 4             # Уменьшено
QUICK_ENT_COEF = 0.01

LOG_PATH = os.path.join(os.path.dirname(__file__), 'quick_test_log.csv')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'ppo_quick_test.zip')

class QuickTrainingCallback(BaseCallback):
    """Callback для быстрого тестирования с подробным логированием"""
    
    def __init__(self, verbose=1):
        super().__init__(verbose)
        self.step_count = 0
        self.episode_count = 0
        self.reward_history = []
        
    def _on_step(self) -> bool:
        self.step_count += 1
        
        # Логируем каждые 1000 шагов
        if self.step_count % 1000 == 0:
            print(f"📊 Шаг {self.step_count}/{QUICK_TOTAL_TIMESTEPS}")
            
            # Получаем информацию о наградах
            try:
                recent_rewards = []
                for env in self.training_env.envs:
                    if hasattr(env, 'episode_rewards'):
                        recent_rewards.extend(env.episode_rewards[-10:])
                
                if recent_rewards:
                    avg_reward = np.mean(recent_rewards)
                    max_reward = np.max(recent_rewards)
                    min_reward = np.min(recent_rewards)
                    print(f"   Средняя награда: {avg_reward:.3f}")
                    print(f"   Максимальная награда: {max_reward:.3f}")
                    print(f"   Минимальная награда: {min_reward:.3f}")
                    
                    self.reward_history.append({
                        'step': self.step_count,
                        'avg_reward': avg_reward,
                        'max_reward': max_reward,
                        'min_reward': min_reward
                    })
            except Exception as e:
                print(f"   Ошибка при получении наград: {e}")
        
        return True

def create_quick_env():
    """Создает окружение для быстрого тестирования"""
    config = {
        'mode': 'economy_tutorial',  # Начинаем с простого режима
        'stage': 0,
        'reduce_randomness': True,
        'improved_rewards': True,
        'curriculum_learning': False  # Отключаем для быстрого теста
    }
    env = NetworkEchoEnvImproved(config=config, log_actions=True, log_path="quick_test_actions.jsonl")
    return env

def log_quick_test(session_id, step, avg_reward, max_reward, min_reward):
    """Логирование результатов быстрого теста"""
    file_exists = os.path.isfile(LOG_PATH)
    with open(LOG_PATH, 'a', newline='') as csvfile:
        writer = csv.writer(csvfile)
        if not file_exists:
            writer.writerow(['session_id', 'step', 'avg_reward', 'max_reward', 'min_reward', 'timestamp'])
        row = [session_id, step, avg_reward, max_reward, min_reward, datetime.now().isoformat()]
        writer.writerow(row)

def main():
    """Основная функция быстрого тестирования"""
    
    print("🚀 Запуск быстрого теста обучения")
    print("=" * 50)
    print(f"Параметры быстрого теста:")
    print(f"  - Всего шагов: {QUICK_TOTAL_TIMESTEPS:,}")
    print(f"  - Learning rate: {QUICK_LEARNING_RATE}")
    print(f"  - Batch size: {QUICK_BATCH_SIZE}")
    print(f"  - N steps: {QUICK_N_STEPS}")
    print(f"  - N epochs: {QUICK_N_EPOCHS}")
    print("=" * 50)
    
    # Создаем уникальный ID сессии
    session_id = str(uuid.uuid4())[:8]
    print(f"🆔 ID сессии: {session_id}")
    
    try:
        # Создаем окружение
        print("🔧 Создание окружения...")
        env = create_quick_env()
        env = DummyVecEnv([lambda: env])
        env = VecMonitor(env, LOG_PATH)
        
        # Проверяем окружение (пропускаем для VecEnv)
        print("✅ Окружение создано успешно")
        
        # Создаем модель с быстрыми параметрами
        print("🤖 Создание модели PPO...")
        model = PPO(
            "MlpPolicy",
            env,
            learning_rate=QUICK_LEARNING_RATE,
            n_steps=QUICK_N_STEPS,
            batch_size=QUICK_BATCH_SIZE,
            n_epochs=QUICK_N_EPOCHS,
            gamma=0.99,
            gae_lambda=0.95,
            clip_range=0.2,
            clip_range_vf=None,
            normalize_advantage=True,
            ent_coef=QUICK_ENT_COEF,
            vf_coef=0.5,
            max_grad_norm=0.5,
            use_sde=False,
            target_kl=None,
            tensorboard_log="./tensorboard_logs/",
            verbose=1
        )
        
        # Callbacks
        callbacks = [
            QuickTrainingCallback(verbose=1),
            CheckpointCallback(
                save_freq=2000,  # Сохраняем каждые 2000 шагов
                save_path="./checkpoints/quick_test/",
                name_prefix="ppo_quick"
            )
        ]
        
        # Обучение
        print(f"🎯 Начинаем обучение на {QUICK_TOTAL_TIMESTEPS} шагов...")
        print("⏱️  Это займет примерно 1-2 минуты...")
        
        model.learn(
            total_timesteps=QUICK_TOTAL_TIMESTEPS,
            callback=callbacks,
            progress_bar=True
        )
        
        # Сохраняем модель
        model.save(MODEL_PATH)
        print(f"✅ Модель сохранена: {MODEL_PATH}")
        
        # Тестируем обученную модель
        print("🧪 Тестирование обученной модели...")
        test_env = DummyVecEnv([create_quick_env])
        obs = test_env.reset()
        total_reward = 0
        steps = 0
        max_steps = 1000
        for step in range(max_steps):
            action, _states = model.predict(obs, deterministic=True)
            obs, reward, done, info = test_env.step(action)
            # obs, reward, done, info - это батчи (массивы)
            total_reward += reward[0]
            steps += 1
            if done[0]:
                break
        print(f"📊 Результаты тестирования:")
        print(f"   Шагов: {steps}")
        print(f"   Общая награда: {total_reward:.3f}")
        print(f"   Средняя награда за шаг: {total_reward/steps:.3f}")
        # Сохраняем финальные результаты
        log_quick_test(session_id, QUICK_TOTAL_TIMESTEPS, total_reward/steps, total_reward, total_reward)
        print(f"\n🎉 Быстрый тест завершен!")
        print(f"📊 Результаты сохранены в: {LOG_PATH}")
        print(f"🤖 Модель сохранена в: {MODEL_PATH}")
        
    except Exception as e:
        print(f"❌ Ошибка при быстром тестировании: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'env' in locals():
            env.close()

if __name__ == "__main__":
    main() 