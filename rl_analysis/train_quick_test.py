#!/usr/bin/env python3
"""
Упрощенная версия обучения для быстрого тестирования
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

# УПРОЩЕННЫЕ ПАРАМЕТРЫ ДЛЯ ТЕСТИРОВАНИЯ
EPISODES_PER_STAGE = 1000  # Уменьшено для быстрого тестирования
LEARNING_RATE = 1e-4
N_STEPS = 1024
BATCH_SIZE = 64
N_EPOCHS = 4
ENT_COEF = 0.01

LOG_PATH = os.path.join(os.path.dirname(__file__), 'quick_test_log.csv')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'ppo_quick_test.zip')

class SimpleCallback(BaseCallback):
    """Простой callback для логирования"""
    
    def __init__(self, verbose=1):
        super().__init__(verbose)
        self.episode_count = 0
        
    def _on_step(self) -> bool:
        self.episode_count += 1
        if self.episode_count % 100 == 0:
            if self.verbose > 0:
                print(f"Шаг {self.episode_count}")
        return True

def log_episode_quick(session_id, stage, win, reason, score, steps, trace, final_stats=None):
    """Упрощенный логгер"""
    file_exists = os.path.isfile(LOG_PATH)
    with open(LOG_PATH, 'a', newline='') as csvfile:
        writer = csv.writer(csvfile)
        if not file_exists:
            writer.writerow([
                'session_id', 'stage', 'win', 'reason_for_end', 'final_score', 'total_steps', 'final_trace_level',
                'program_counts', 'avg_levels', 'enemies_killed', 'total_dp', 'total_cpu', 'timestamp'
            ])
        row = [session_id, stage, win, reason, score, steps, trace]
        if final_stats:
            row.append(str(final_stats.get('program_counts', {})))
            row.append(str(final_stats.get('avg_levels', {})))
            row.append(final_stats.get('enemies_killed', 0))
            row.append(final_stats.get('total_dp', 0))
            row.append(final_stats.get('total_cpu', 0))
        else:
            row += ['', '', '', '', '']
        row.append(datetime.now().isoformat())
        writer.writerow(row)

def create_test_env(stage=0, mode='full'):
    """Создает тестовое окружение"""
    config = {
        'mode': mode,
        'stage': stage,
        'reduce_randomness': True,
        'improved_rewards': True,
        'curriculum_learning': True
    }
    
    env = NetworkEchoEnvImproved(config=config)
    return env

def train_stage_quick(stage_name, stage_config, model=None):
    """Обучение одного этапа с упрощенными параметрами"""
    
    print(f"\n🎯 Этап: {stage_name}")
    print("=" * 50)
    
    # Создаем окружение
    env = create_test_env(stage_config['stage'], stage_config['mode'])
    env = DummyVecEnv([lambda: env])
    env = VecMonitor(env, LOG_PATH)
    
    # Создаем или загружаем модель
    if model is None:
        model = PPO(
            "MlpPolicy",
            env,
            learning_rate=LEARNING_RATE,
            n_steps=N_STEPS,
            batch_size=BATCH_SIZE,
            n_epochs=N_EPOCHS,
            gamma=0.99,
            gae_lambda=0.95,
            clip_range=0.2,
            clip_range_vf=None,
            normalize_advantage=True,
            ent_coef=ENT_COEF,
            vf_coef=0.5,
            max_grad_norm=0.5,
            use_sde=False,
            target_kl=None,
            tensorboard_log="./tensorboard_logs/",
            verbose=1
        )
    else:
        model.set_env(env)
    
    # Простые callbacks
    callbacks = [
        SimpleCallback(verbose=1),
        CheckpointCallback(
            save_freq=max(1000, EPISODES_PER_STAGE // 10),
            save_path=f"./checkpoints/quick_stage_{stage_config['stage']}/",
            name_prefix="ppo_model"
        )
    ]
    
    # Обучение
    try:
        print(f"Начинаем обучение этапа {stage_name}...")
        print(f"Параметры: episodes={EPISODES_PER_STAGE}, lr={LEARNING_RATE}, batch_size={BATCH_SIZE}")
        
        # Обучаем модель
        model.learn(
            total_timesteps=EPISODES_PER_STAGE * 100,  # Уменьшено для быстрого тестирования
            callback=callbacks,
            progress_bar=False
        )
        
        # Сохраняем модель
        model_path = f"ppo_quick_stage_{stage_config['stage']}.zip"
        model.save(model_path)
        print(f"✅ Модель сохранена: {model_path}")
        
        return model
        
    except Exception as e:
        print(f"❌ Ошибка при обучении этапа {stage_name}: {e}")
        return model
    finally:
        env.close()

def main():
    """Основная функция обучения"""
    
    print("🚀 Запуск упрощенного RL-обучения для тестирования")
    print("=" * 60)
    print(f"Тестовые параметры:")
    print(f"  - Эпизодов на этап: {EPISODES_PER_STAGE:,}")
    print(f"  - Learning rate: {LEARNING_RATE}")
    print(f"  - Batch size: {BATCH_SIZE}")
    print(f"  - N steps: {N_STEPS}")
    print(f"  - Entropy coefficient: {ENT_COEF}")
    print("=" * 60)
    
    # Создаем папку для чекпоинтов
    os.makedirs("./checkpoints", exist_ok=True)
    
    # Этапы обучения с упрощенными параметрами
    stages = [
        {
            "name": "Экономика (тест)",
            "stage": 0,
            "mode": "economy_tutorial",
            "episodes": EPISODES_PER_STAGE
        },
        {
            "name": "Оборона (тест)",
            "stage": 1,
            "mode": "defense_tutorial", 
            "episodes": EPISODES_PER_STAGE
        },
        {
            "name": "Полная игра (тест)",
            "stage": 2,
            "mode": "full",
            "episodes": EPISODES_PER_STAGE
        }
    ]
    
    model = None
    
    for stage_idx, stage_config in enumerate(stages):
        print(f"\n🎯 Этап {stage_idx + 1}/{len(stages)}: {stage_config['name']}")
        
        # Обучаем этап
        model = train_stage_quick(stage_config['name'], stage_config, model)
        
        if model is None:
            print(f"❌ Ошибка на этапе {stage_idx + 1}, прерываем обучение")
            break
    
    # Сохраняем финальную модель
    if model is not None:
        model.save(MODEL_PATH)
        print(f"\n✅ Финальная модель сохранена: {MODEL_PATH}")
    
    print(f"\n🎉 Упрощенное обучение завершено!")
    print(f"📊 Результаты сохранены в: {LOG_PATH}")
    print(f"🤖 Модель сохранена в: {MODEL_PATH}")

if __name__ == "__main__":
    main() 