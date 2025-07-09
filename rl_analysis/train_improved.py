#!/usr/bin/env python3
"""
Улучшенная версия RL-обучения с исправлением всех выявленных проблем
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

# УЛУЧШЕННЫЕ ПАРАМЕТРЫ
EPISODES_PER_STAGE = 500000  # Увеличено с 100k до 500k
LEARNING_RATE = 1e-4         # Уменьшено с 3e-4 для стабильности
N_STEPS = 4096              # Увеличено для лучшего обучения
BATCH_SIZE = 128            # Увеличено
N_EPOCHS = 8                # Оптимизировано
ENT_COEF = 0.01             # Увеличено для лучшего exploration

LOG_PATH = os.path.join(os.path.dirname(__file__), 'improved_analysis_log.csv')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'ppo_improved_final.zip')

class EarlyStoppingCallback(BaseCallback):
    """Callback для early stopping при длинных сериях поражений"""
    
    def __init__(self, patience=100, min_episodes=200, verbose=1):
        super().__init__(verbose)
        self.patience = patience
        self.min_episodes = min_episodes
        self.loss_streak = 0
        self.best_reward = -np.inf
        self.no_improvement_count = 0
        self.episode_count = 0
        
    def _on_step(self) -> bool:
        self.episode_count += 1
        
        # Получаем информацию о последних эпизодах
        if hasattr(self.training_env, 'get_attr'):
            try:
                recent_rewards = []
                for env in self.training_env.envs:
                    if hasattr(env, 'episode_rewards'):
                        recent_rewards.extend(env.episode_rewards[-10:])
                
                if recent_rewards:
                    avg_reward = np.mean(recent_rewards)
                    
                    # Проверяем улучшение
                    if avg_reward > self.best_reward:
                        self.best_reward = avg_reward
                        self.no_improvement_count = 0
                    else:
                        self.no_improvement_count += 1
                    
                    # Early stopping только после минимального количества эпизодов
                    if (self.episode_count >= self.min_episodes and 
                        self.no_improvement_count >= self.patience):
                        if self.verbose > 0:
                            print(f"Early stopping triggered after {self.patience} episodes without improvement")
                        return False
            except:
                pass
        
        return True

class AdaptiveLearningRateCallback(BaseCallback):
    """Callback для адаптивного learning rate"""
    
    def __init__(self, initial_lr=1e-4, min_lr=1e-6, factor=0.8, patience=50, verbose=1):
        super().__init__(verbose)
        self.initial_lr = initial_lr
        self.min_lr = min_lr
        self.factor = factor
        self.patience = patience
        self.best_reward = -np.inf
        self.no_improvement_count = 0
        self.current_lr = initial_lr
        
    def _on_step(self) -> bool:
        try:
            # Получаем среднюю награду за последние эпизоды
            recent_rewards = []
            for env in self.training_env.envs:
                if hasattr(env, 'episode_rewards'):
                    recent_rewards.extend(env.episode_rewards[-20:])
            
            if recent_rewards:
                avg_reward = np.mean(recent_rewards)
                
                if avg_reward > self.best_reward:
                    self.best_reward = avg_reward
                    self.no_improvement_count = 0
                else:
                    self.no_improvement_count += 1
                
                # Адаптивное изменение learning rate
                if self.no_improvement_count >= self.patience:
                    self.current_lr = max(self.current_lr * self.factor, self.min_lr)
                    self.model.learning_rate = self.current_lr
                    self.no_improvement_count = 0
                    
                    if self.verbose > 0:
                        print(f"Learning rate reduced to {self.current_lr:.2e}")
        except:
            pass
        
        return True

class RewardShapingCallback(BaseCallback):
    """Callback для улучшенного reward shaping"""
    
    def __init__(self, verbose=1):
        super().__init__(verbose)
        self.resource_bonus = 0.1
        self.efficiency_bonus = 0.2
        self.exploration_bonus = 0.05
        
    def _on_step(self) -> bool:
        # Этот callback будет интегрирован в окружение
        return True

class CurriculumLearningCallback(BaseCallback):
    """Callback для curriculum learning"""
    
    def __init__(self, stage_thresholds=[0.15, 0.25, 0.35], verbose=1):
        super().__init__(verbose)
        self.stage_thresholds = stage_thresholds
        self.current_stage = 0
        self.stage_episodes = 0
        
    def _on_step(self) -> bool:
        self.stage_episodes += 1
        
        # Проверяем прогресс для перехода на следующий этап
        try:
            recent_rewards = []
            for env in self.training_env.envs:
                if hasattr(env, 'episode_rewards'):
                    recent_rewards.extend(env.episode_rewards[-100:])
            
            if len(recent_rewards) > 100:  # Минимум эпизодов для оценки
                win_rate = np.mean([1 if r > 0 else 0 for r in recent_rewards[-100:]])
                
                if (self.current_stage < len(self.stage_thresholds) and 
                    win_rate >= self.stage_thresholds[self.current_stage]):
                    self.current_stage += 1
                    if self.verbose > 0:
                        print(f"Progressing to stage {self.current_stage} (win rate: {win_rate:.2f})")
        except:
            pass
        
        return True

# Улучшенный CSV логгер
def log_episode_improved(session_id, stage, win, reason, score, steps, trace, final_stats=None):
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

def create_improved_env(stage=0, mode='full'):
    """Создает улучшенное окружение с настройками для стабильности"""
    
    config = {
        'mode': mode,
        'stage': stage,
        'reduce_randomness': True,  # Уменьшаем случайность
        'improved_rewards': True,   # Включаем улучшенные награды
        'curriculum_learning': True # Включаем curriculum learning
    }
    
    env = NetworkEchoEnvImproved(config=config)
    return env

def train_stage(stage_name, stage_config, model=None):
    """Обучение одного этапа с улучшенными параметрами"""
    
    print(f"\n🎯 Этап: {stage_name}")
    print("=" * 50)
    
    # Создаем окружение
    env = create_improved_env(stage_config['stage'], stage_config['mode'])
    env = DummyVecEnv([lambda: env])
    env = VecMonitor(env, LOG_PATH)
    
    # Создаем или загружаем модель с улучшенными параметрами
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
            ent_coef=ENT_COEF,  # Увеличено для лучшего exploration
            vf_coef=0.5,
            max_grad_norm=0.5,
            use_sde=False,  # Отключаем для дискретных действий
            target_kl=None,
            tensorboard_log="./tensorboard_logs/",
            verbose=1
        )
    else:
        model.set_env(env)
    
    # Callbacks
    callbacks = [
        EarlyStoppingCallback(patience=100, verbose=1),
        AdaptiveLearningRateCallback(initial_lr=LEARNING_RATE, verbose=1),
        CurriculumLearningCallback(verbose=1),
        CheckpointCallback(
            save_freq=max(10000, EPISODES_PER_STAGE // 10),
            save_path=f"./checkpoints/stage_{stage_config['stage']}/",
            name_prefix="ppo_model"
        )
    ]
    
    # Обучение
    try:
        print(f"Начинаем обучение этапа {stage_name}...")
        print(f"Параметры: episodes={EPISODES_PER_STAGE}, lr={LEARNING_RATE}, batch_size={BATCH_SIZE}")
        
        # Обучаем модель
        model.learn(
            total_timesteps=EPISODES_PER_STAGE * 1000,  # Примерное количество шагов
            callback=callbacks,
            progress_bar=False  # Отключаем progress bar для избежания ошибок
        )
        
        # Сохраняем модель
        model_path = f"ppo_improved_stage_{stage_config['stage']}.zip"
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
    
    print("🚀 Запуск улучшенного RL-обучения")
    print("=" * 60)
    print(f"Улучшенные параметры:")
    print(f"  - Эпизодов на этап: {EPISODES_PER_STAGE:,}")
    print(f"  - Learning rate: {LEARNING_RATE}")
    print(f"  - Batch size: {BATCH_SIZE}")
    print(f"  - N steps: {N_STEPS}")
    print(f"  - Entropy coefficient: {ENT_COEF}")
    print("=" * 60)
    
    # Создаем папку для чекпоинтов
    os.makedirs("./checkpoints", exist_ok=True)
    
    # Этапы обучения с улучшенными параметрами
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
        model = train_stage(stage_config['name'], stage_config, model)
        
        if model is None:
            print(f"❌ Ошибка на этапе {stage_idx + 1}, прерываем обучение")
            break
    
    # Сохраняем финальную модель
    if model is not None:
        model.save(MODEL_PATH)
        print(f"\n✅ Финальная модель сохранена: {MODEL_PATH}")
    
    print(f"\n🎉 Улучшенное обучение завершено!")
    print(f"📊 Результаты сохранены в: {LOG_PATH}")
    print(f"🤖 Модель сохранена в: {MODEL_PATH}")

if __name__ == "__main__":
    main() 