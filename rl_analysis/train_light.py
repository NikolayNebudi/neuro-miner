#!/usr/bin/env python3
"""
Оптимизированное обучение с легким логированием
"""

import os
import csv
import uuid
import gymnasium as gym
from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
from stable_baselines3.common.callbacks import BaseCallback, CheckpointCallback
from stable_baselines3.common.vec_env import DummyVecEnv, VecMonitor
from network_echo_env_light import NetworkEchoEnvLight
import numpy as np
from datetime import datetime
import json

# ОПТИМИЗИРОВАННЫЕ ПАРАМЕТРЫ
EPISODES_PER_STAGE = 10000    # Уменьшено для быстрого тестирования
LEARNING_RATE = 1e-4
N_STEPS = 1024                 # Уменьшено для стабильности
BATCH_SIZE = 32                # Уменьшено
N_EPOCHS = 4                   # Уменьшено
ENT_COEF = 0.01

# Параметры легкого логирования
LIGHT_LOGGING = True
MAX_LOG_ENTRIES = 5000         # Ограничение записей

class LightTrainingCallback(BaseCallback):
    """Калбэк для легкого логирования обучения"""
    
    def __init__(self, log_file="light_training_log.csv"):
        super().__init__()
        self.log_file = log_file
        self.episode_rewards = []
        self.episode_lengths = []
        self.wins = []
        self.final_scores = []
        
        # Создаем файл логов
        with open(self.log_file, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'timestamp', 'episode', 'total_steps', 'mean_reward', 
                'mean_length', 'win_rate', 'mean_score', 'std_reward'
            ])
    
    def _on_step(self) -> bool:
        """Вызывается на каждом шаге"""
        return True
    
    def _on_rollout_end(self) -> None:
        """Вызывается в конце rollout"""
        # Получаем статистику из среды
        if hasattr(self.training_env, 'envs'):
            env = self.training_env.envs[0]
            if hasattr(env, 'unwrapped') and hasattr(env.unwrapped, '_episode'):
                episode = env.unwrapped._episode
                total_steps = self.num_timesteps
                
                # Собираем статистику из логов
                self._collect_episode_stats()
                
                if len(self.episode_rewards) > 0:
                    mean_reward = np.mean(self.episode_rewards[-10:])  # Последние 10 эпизодов
                    mean_length = np.mean(self.episode_lengths[-10:])
                    win_rate = np.mean(self.wins[-10:]) * 100
                    mean_score = np.mean(self.final_scores[-10:])
                    std_reward = np.std(self.episode_rewards[-10:])
                    
                    # Записываем в лог
                    with open(self.log_file, 'a', newline='') as f:
                        writer = csv.writer(f)
                        writer.writerow([
                            datetime.now().isoformat(),
                            episode,
                            total_steps,
                            f"{mean_reward:.3f}",
                            f"{mean_length:.1f}",
                            f"{win_rate:.1f}",
                            f"{mean_score:.1f}",
                            f"{std_reward:.3f}"
                        ])
                    
                    print(f"📊 Эпизод {episode}: награда={mean_reward:.3f}, длина={mean_length:.1f}, победы={win_rate:.1f}%")
    
    def _collect_episode_stats(self):
        """Собирает статистику эпизодов из логов"""
        # Ищем последние записи о завершении эпизодов
        log_files = [f for f in os.listdir('.') if f.startswith('light_log_') and f.endswith('.jsonl')]
        if not log_files:
            return
        
        latest_log = max(log_files, key=os.path.getctime)
        
        try:
            with open(latest_log, 'r') as f:
                lines = f.readlines()
                for line in lines[-100:]:  # Проверяем последние 100 строк
                    try:
                        data = json.loads(line)
                        if data.get('type') == 'episode_end':
                            episode = data.get('episode', 0)
                            total_steps = data.get('total_steps', 0)
                            total_reward = data.get('total_reward', 0)
                            final_score = data.get('final_score', 0)
                            win = data.get('win', False)
                            
                            # Добавляем только если это новый эпизод
                            if episode not in [ep for ep, _ in self.episode_rewards]:
                                self.episode_rewards.append((episode, total_reward))
                                self.episode_lengths.append((episode, total_steps))
                                self.wins.append((episode, win))
                                self.final_scores.append((episode, final_score))
                    except:
                        continue
        except Exception as e:
            print(f"⚠️ Ошибка чтения логов: {e}")

def create_env():
    """Создает окружение с легким логированием"""
    env = NetworkEchoEnvLight(
        log_actions=LIGHT_LOGGING,
        max_log_entries=MAX_LOG_ENTRIES
    )
    return env

def main():
    """Основная функция обучения"""
    print("🚀 ЗАПУСК ОПТИМИЗИРОВАННОГО ОБУЧЕНИЯ")
    print("=" * 50)
    print(f"📊 Параметры:")
    print(f"  • Эпизодов на стадию: {EPISODES_PER_STAGE:,}")
    print(f"  • Максимум записей в логе: {MAX_LOG_ENTRIES:,}")
    print(f"  • Размер батча: {BATCH_SIZE}")
    print(f"  • Шагов на rollout: {N_STEPS}")
    print(f"  • Эпох: {N_EPOCHS}")
    print()
    
    # Создаем окружение
    env = create_env()
    
    # Проверяем окружение
    try:
        check_env(env)
        print("✅ Окружение прошло проверку")
    except Exception as e:
        print(f"❌ Ошибка проверки окружения: {e}")
        return
    
    # Создаем векторное окружение
    vec_env = DummyVecEnv([lambda: env])
    vec_env = VecMonitor(vec_env)
    
    # Создаем модель
    model = PPO(
        "MlpPolicy",
        vec_env,
        learning_rate=LEARNING_RATE,
        n_steps=N_STEPS,
        batch_size=BATCH_SIZE,
        n_epochs=N_EPOCHS,
        ent_coef=ENT_COEF,
        verbose=1,
        tensorboard_log="./tensorboard_logs_light"
    )
    
    # Создаем калбэки
    callbacks = [
        LightTrainingCallback(log_file="light_training_log.csv"),
        CheckpointCallback(
            save_freq=5000,
            save_path="./checkpoints_light",
            name_prefix="PPO_light"
        )
    ]
    
    # Запускаем обучение
    print("🎯 Начинаем обучение...")
    try:
        model.learn(
            total_timesteps=EPISODES_PER_STAGE * 1000,  # Примерное количество шагов
            callback=callbacks,
            progress_bar=True
        )
        print("✅ Обучение завершено успешно!")
        
        # Сохраняем финальную модель
        model.save("light_final_model")
        print("💾 Модель сохранена: light_final_model")
        
    except KeyboardInterrupt:
        print("\n⚠️ Обучение прервано пользователем")
        model.save("light_interrupted_model")
        print("💾 Модель сохранена: light_interrupted_model")
        
    except Exception as e:
        print(f"❌ Ошибка обучения: {e}")
        model.save("light_error_model")
        print("💾 Модель сохранена: light_error_model")
    
    # Закрываем окружение
    env.close()
    print("🎉 Обучение завершено!")

if __name__ == "__main__":
    main() 