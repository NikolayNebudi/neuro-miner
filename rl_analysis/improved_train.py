#!/usr/bin/env python3
"""
Улучшенная версия RL-обучения с исправлением проблем нестабильности
"""

import gymnasium as gym
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv, VecMonitor
from stable_baselines3.common.callbacks import BaseCallback, CheckpointCallback
from network_echo_env import NetworkEchoEnv
import numpy as np
import pandas as pd
import uuid
import time
from datetime import datetime

# Улучшенные параметры
EPISODES_PER_STAGE = 500000  # Увеличено с 100k до 500k
LEARNING_RATE = 1e-4  # Уменьшено для стабильности
N_STEPS = 4096  # Увеличено для лучшего обучения
BATCH_SIZE = 128  # Увеличено
N_EPOCHS = 8  # Оптимизировано

class EarlyStoppingCallback(BaseCallback):
    """Callback для early stopping при длинных сериях поражений"""
    
    def __init__(self, patience=50, min_episodes=100, verbose=1):
        super().__init__(verbose)
        self.patience = patience
        self.min_episodes = min_episodes
        self.loss_streak = 0
        self.best_reward = -np.inf
        self.no_improvement_count = 0
        
    def _on_step(self) -> bool:
        # Получаем информацию о последних эпизодах
        if len(self.training_env.buf_rews) > 0:
            recent_rewards = self.training_env.buf_rews[-1]
            if len(recent_rewards) > 0:
                avg_reward = np.mean(recent_rewards)
                
                # Проверяем улучшение
                if avg_reward > self.best_reward:
                    self.best_reward = avg_reward
                    self.no_improvement_count = 0
                else:
                    self.no_improvement_count += 1
                
                # Early stopping
                if self.no_improvement_count >= self.patience:
                    if self.verbose > 0:
                        print(f"Early stopping triggered after {self.patience} episodes without improvement")
                    return False
        
        return True

class AdaptiveLearningRateCallback(BaseCallback):
    """Callback для адаптивного learning rate"""
    
    def __init__(self, initial_lr=1e-4, min_lr=1e-6, factor=0.8, patience=20, verbose=1):
        super().__init__(verbose)
        self.initial_lr = initial_lr
        self.min_lr = min_lr
        self.factor = factor
        self.patience = patience
        self.best_reward = -np.inf
        self.no_improvement_count = 0
        self.current_lr = initial_lr
        
    def _on_step(self) -> bool:
        if len(self.training_env.buf_rews) > 0:
            recent_rewards = self.training_env.buf_rews[-1]
            if len(recent_rewards) > 0:
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
        
        return True

class CurriculumLearningCallback(BaseCallback):
    """Callback для curriculum learning"""
    
    def __init__(self, stage_thresholds=[0.1, 0.3, 0.5], verbose=1):
        super().__init__(verbose)
        self.stage_thresholds = stage_thresholds
        self.current_stage = 0
        self.stage_episodes = 0
        
    def _on_step(self) -> bool:
        self.stage_episodes += 1
        
        # Проверяем прогресс для перехода на следующий этап
        if len(self.training_env.buf_rews) > 0:
            recent_rewards = self.training_env.buf_rews[-1]
            if len(recent_rewards) > 100:  # Минимум эпизодов для оценки
                win_rate = np.mean([1 if r > 0 else 0 for r in recent_rewards[-100:]])
                
                if (self.current_stage < len(self.stage_thresholds) and 
                    win_rate >= self.stage_thresholds[self.current_stage]):
                    self.current_stage += 1
                    if self.verbose > 0:
                        print(f"Progressing to stage {self.current_stage} (win rate: {win_rate:.2f})")
        
        return True

def create_improved_env(stage=0):
    """Создает улучшенное окружение с настройками для стабильности"""
    
    env = NetworkEchoEnv()
    
    # Настройки для уменьшения случайности
    if hasattr(env, 'set_stage'):
        env.set_stage(stage)
    
    # Уменьшаем случайность в окружении
    if hasattr(env, 'reduce_randomness'):
        env.reduce_randomness()
    
    return env

def train_improved_model():
    """Обучение с улучшенными параметрами"""
    
    print("🚀 Запуск улучшенного обучения")
    print("=" * 50)
    
    # Создаем файл для логирования
    log_file = f"improved_training_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    # Callbacks
    callbacks = [
        EarlyStoppingCallback(patience=100, verbose=1),
        AdaptiveLearningRateCallback(initial_lr=LEARNING_RATE, verbose=1),
        CurriculumLearningCallback(verbose=1)
    ]
    
    # Этапы обучения с улучшенными параметрами
    stages = [
        {"name": "Экономика (упрощенная)", "episodes": EPISODES_PER_STAGE, "stage": 0},
        {"name": "Оборона", "episodes": EPISODES_PER_STAGE, "stage": 1},
        {"name": "Полная игра", "episodes": EPISODES_PER_STAGE, "stage": 2}
    ]
    
    for stage_idx, stage_config in enumerate(stages):
        print(f"\n🎯 Этап {stage_idx + 1}: {stage_config['name']}")
        print("-" * 40)
        
        # Создаем окружение для этапа
        env = create_improved_env(stage_config['stage'])
        env = DummyVecEnv([lambda: env])
        env = VecMonitor(env, log_file)
        
        # Создаем модель с улучшенными параметрами
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
            ent_coef=0.01,  # Увеличено для лучшего exploration
            vf_coef=0.5,
            max_grad_norm=0.5,
            use_sde=True,  # State-dependent exploration
            sde_sample_freq=4,
            target_kl=None,
            tensorboard_log="./tensorboard_logs/",
            verbose=1
        )
        
        # Обучение
        try:
            model.learn(
                total_timesteps=stage_config['episodes'] * 1000,  # Примерное количество шагов
                callback=callbacks,
                progress_bar=True
            )
            
            # Сохраняем модель
            model_path = f"ppo_improved_stage_{stage_idx}.zip"
            model.save(model_path)
            print(f"✅ Модель сохранена: {model_path}")
            
        except Exception as e:
            print(f"❌ Ошибка при обучении этапа {stage_idx + 1}: {e}")
            continue
        
        finally:
            env.close()
    
    print(f"\n✅ Улучшенное обучение завершено!")
    print(f"📊 Логи сохранены в: {log_file}")

def analyze_improvements():
    """Анализирует улучшения после обучения"""
    
    print("\n📊 Анализ улучшений:")
    print("=" * 30)
    
    # Сравниваем с предыдущими результатами
    try:
        old_df = pd.read_csv('analysis_log.csv', header=None, names=[
            'episode_id', 'stage', 'result', 'reward', 'steps', 'trace',
            'program_counts', 'avg_levels', 'enemies_killed', 'total_dp', 'total_cpu'
        ])
        
        new_df = pd.read_csv('improved_training_log_*.csv', header=None, names=[
            'episode_id', 'stage', 'result', 'reward', 'steps', 'trace',
            'program_counts', 'avg_levels', 'enemies_killed', 'total_dp', 'total_cpu'
        ])
        
        print("Сравнение результатов:")
        print(f"Старая система: {len(old_df)} эпизодов, {len(old_df[old_df['result'] == 'win'])} побед")
        print(f"Новая система: {len(new_df)} эпизодов, {len(new_df[new_df['result'] == 'win'])} побед")
        
    except FileNotFoundError:
        print("Файлы для сравнения не найдены")

if __name__ == "__main__":
    train_improved_model()
    analyze_improvements() 