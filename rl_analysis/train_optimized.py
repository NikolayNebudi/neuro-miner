#!/usr/bin/env python3
"""
Оптимизированная версия RL-обучения с контролем размера логов
"""

import os
import csv
import uuid
import gymnasium as gym
from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
from stable_baselines3.common.callbacks import BaseCallback, CheckpointCallback
from stable_baselines3.common.vec_env import DummyVecEnv, VecMonitor
from network_echo_env_optimized import NetworkEchoEnvOptimized
import numpy as np
from datetime import datetime

# ОПТИМИЗИРОВАННЫЕ ПАРАМЕТРЫ
EPISODES_PER_STAGE = 50000   # Уменьшено с 500k до 50k
LEARNING_RATE = 1e-4
N_STEPS = 2048               # Уменьшено для стабильности
BATCH_SIZE = 64              # Уменьшено
N_EPOCHS = 4                 # Уменьшено
ENT_COEF = 0.01

# Параметры логирования
MAX_LOG_ENTRIES = 50000      # Ограничиваем количество записей в логах
LOG_PATH = os.path.join(os.path.dirname(__file__), 'optimized_analysis_log.csv')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'ppo_optimized_final.zip')

class OptimizedCallback(BaseCallback):
    """Оптимизированный callback с контролем памяти"""
    
    def __init__(self, verbose=1):
        super().__init__(verbose)
        self.episode_count = 0
        self.total_reward = 0
        self.episode_rewards = []
        
    def _on_step(self) -> bool:
        self.episode_count += 1
        
        # Логируем каждые 1000 шагов для экономии ресурсов
        if self.episode_count % 1000 == 0:
            if self.verbose > 0:
                print(f"Шаг {self.episode_count}: Обучение продолжается...")
        
        return True
    
    def _on_rollout_end(self) -> None:
        """Вызывается в конце каждого rollout"""
        if self.verbose > 0:
            print(f"Rollout завершен: {self.n_calls} шагов")

class MemoryEfficientCallback(BaseCallback):
    """Callback для контроля использования памяти"""
    
    def __init__(self, max_episodes=1000, verbose=1):
        super().__init__(verbose)
        self.max_episodes = max_episodes
        self.episode_count = 0
        
    def _on_step(self) -> bool:
        # Проверяем количество эпизодов
        if hasattr(self.training_env, 'get_attr'):
            try:
                episode_count = 0
                for env in self.training_env.envs:
                    if hasattr(env, 'episode_idx'):
                        episode_count = max(episode_count, env.episode_idx)
                
                if episode_count >= self.max_episodes:
                    if self.verbose > 0:
                        print(f"Достигнут лимит эпизодов ({self.max_episodes}). Останавливаем обучение.")
                    return False
            except:
                pass
        
        return True

def log_episode_optimized(session_id, stage, win, reason, score, steps, trace, final_stats=None):
    """Оптимизированное логирование эпизодов"""
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

def create_optimized_env(stage=0, mode='full'):
    """Создает оптимизированное окружение с контролем логов"""
    config = {
        'mode': mode,
        'stage': stage,
        'reduce_randomness': True,
        'improved_rewards': True,
        'curriculum_learning': True
    }
    env = NetworkEchoEnvOptimized(
        config=config, 
        log_actions=True, 
        log_path="optimized_actions_log.jsonl",
        max_log_entries=MAX_LOG_ENTRIES
    )
    return env

def train_stage_optimized(stage_name, stage_config, model=None):
    """Обучение одного этапа с оптимизированными параметрами"""
    
    print(f"\n🎯 Этап: {stage_name}")
    print("=" * 50)
    
    # Создаем окружение
    env = create_optimized_env(stage_config['stage'], stage_config['mode'])
    env = DummyVecEnv([lambda: env])
    env = VecMonitor(env, LOG_PATH)
    
    # Создаем или загружаем модель с оптимизированными параметрами
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
    
    # Оптимизированные callbacks
    callbacks = [
        OptimizedCallback(verbose=1),
        MemoryEfficientCallback(max_episodes=EPISODES_PER_STAGE, verbose=1),
        CheckpointCallback(
            save_freq=max(5000, EPISODES_PER_STAGE // 20),
            save_path=f"./checkpoints/stage_{stage_config['stage']}/",
            name_prefix="ppo_optimized"
        )
    ]
    
    # Обучение
    try:
        print(f"Начинаем обучение этапа {stage_name}...")
        print(f"Параметры: episodes={EPISODES_PER_STAGE}, lr={LEARNING_RATE}, batch_size={BATCH_SIZE}")
        print(f"Максимум логов: {MAX_LOG_ENTRIES}")
        
        # Обучаем модель
        model.learn(
            total_timesteps=EPISODES_PER_STAGE * 100,  # Уменьшено количество шагов
            callback=callbacks,
            progress_bar=False
        )
        
        # Сохраняем модель
        model_path = f"ppo_optimized_stage_{stage_config['stage']}.zip"
        model.save(model_path)
        print(f"✅ Модель сохранена: {model_path}")
        
        return model
        
    except Exception as e:
        print(f"❌ Ошибка при обучении этапа {stage_name}: {e}")
        return model
    finally:
        env.close()

def main():
    """Основная функция обучения с оптимизацией"""
    
    print("🚀 Запуск оптимизированного RL-обучения")
    print("=" * 60)
    print(f"Оптимизированные параметры:")
    print(f"  - Эпизодов на этап: {EPISODES_PER_STAGE:,}")
    print(f"  - Learning rate: {LEARNING_RATE}")
    print(f"  - Batch size: {BATCH_SIZE}")
    print(f"  - N steps: {N_STEPS}")
    print(f"  - Entropy coefficient: {ENT_COEF}")
    print(f"  - Максимум логов: {MAX_LOG_ENTRIES:,}")
    print("=" * 60)
    
    # Создаем папку для чекпоинтов
    os.makedirs("./checkpoints", exist_ok=True)
    
    # Этапы обучения с оптимизированными параметрами
    stages = [
        {
            "name": "Экономика (упрощенная)",
            "stage": 0,
            "mode": "economy_tutorial",
            "episodes": EPISODES_PER_STAGE
        },
        {
            "name": "Оборона",
            "stage": 1,
            "mode": "defense_tutorial", 
            "episodes": EPISODES_PER_STAGE
        },
        {
            "name": "Полная игра",
            "stage": 2,
            "mode": "full",
            "episodes": EPISODES_PER_STAGE
        }
    ]
    
    model = None
    
    for stage_idx, stage_config in enumerate(stages):
        print(f"\n🎯 Этап {stage_idx + 1}/{len(stages)}: {stage_config['name']}")
        
        # Обучаем этап
        model = train_stage_optimized(stage_config['name'], stage_config, model)
        
        if model is None:
            print(f"❌ Ошибка на этапе {stage_idx + 1}, прерываем обучение")
            break
    
    # Сохраняем финальную модель
    if model is not None:
        model.save(MODEL_PATH)
        print(f"\n✅ Финальная модель сохранена: {MODEL_PATH}")
    
    print(f"\n🎉 Оптимизированное обучение завершено!")
    print(f"📊 Логи сохранены в: {LOG_PATH}")
    print(f"📁 Модель сохранена в: {MODEL_PATH}")

if __name__ == "__main__":
    main() 