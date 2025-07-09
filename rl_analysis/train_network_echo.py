#!/usr/bin/env python3
"""
Скрипт для обучения RL-модели на игре Network Echo
Использует Stable-Baselines3 и взаимодействует с JavaScript-движком
"""

import os
import sys
import time
import json
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, List, Tuple, Any
import logging

# Добавляем путь к модулям
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from stable_baselines3 import PPO, A2C, DQN
    from stable_baselines3.common.callbacks import BaseCallback, CheckpointCallback, EvalCallback
    from stable_baselines3.common.vec_env import DummyVecEnv, VecNormalize
    from stable_baselines3.common.monitor import Monitor
    from stable_baselines3.common.utils import set_random_seed
    from stable_baselines3.common.evaluation import evaluate_policy
except ImportError as e:
    print(f"Ошибка импорта Stable-Baselines3: {e}")
    print("Установите: pip install stable-baselines3")
    sys.exit(1)

from network_echo_env import NetworkEchoEnv

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('training.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class TrainingCallback(BaseCallback):
    """Кастомный callback для отслеживания прогресса обучения"""
    
    def __init__(self, verbose: int = 0):
        super().__init__(verbose)
        self.episode_rewards = []
        self.episode_lengths = []
        self.win_rates = []
        self.episode_count = 0
        self.start_time = time.time()
        
    def _on_step(self) -> bool:
        infos = self.locals.get("infos", [])
        for info in infos:
            if "episode" in info:
                ep_info = info["episode"]
                self.episode_rewards.append(ep_info["r"])
                self.episode_lengths.append(ep_info["l"])
                is_win = ep_info["r"] > 500
                self.win_rates.append(is_win)
                self.episode_count += 1
                if self.episode_count % 100 == 0:
                    avg_reward = np.mean(self.episode_rewards[-100:])
                    avg_length = np.mean(self.episode_lengths[-100:])
                    win_rate = np.mean(self.win_rates[-100:])
                    elapsed_time = time.time() - self.start_time
                    logger.info(f"Эпизод {self.episode_count}: "
                                f"Средняя награда={avg_reward:.2f}, "
                                f"Средняя длина={avg_length:.1f}, "
                                f"Процент побед={win_rate*100:.1f}%, "
                                f"Время={elapsed_time/60:.1f}мин")
        return True

def create_env(config: Dict = None) -> NetworkEchoEnv:
    """Создаёт окружение с заданной конфигурацией"""
    return NetworkEchoEnv(config=config)

def train_model(
    model_type: str = 'PPO',
    total_timesteps: int = 100000,
    learning_rate: float = 3e-4,
    batch_size: int = 64,
    n_steps: int = 2048,
    gamma: float = 0.99,
    gae_lambda: float = 0.95,
    clip_range: float = 0.2,
    ent_coef: float = 0.01,
    vf_coef: float = 0.5,
    max_grad_norm: float = 0.5,
    save_freq: int = 10000,
    eval_freq: int = 5000,
    n_eval_episodes: int = 10,
    config: Dict = None
) -> Tuple[Any, Dict]:
    """
    Обучает RL-модель на игре Network Echo
    
    Args:
        model_type: Тип модели ('PPO', 'A2C', 'DQN')
        total_timesteps: Общее количество шагов для обучения
        learning_rate: Скорость обучения
        batch_size: Размер батча
        n_steps: Количество шагов на обновление
        gamma: Коэффициент дисконтирования
        gae_lambda: Параметр GAE
        clip_range: Параметр clipping для PPO
        ent_coef: Коэффициент энтропии
        vf_coef: Коэффициент value function
        max_grad_norm: Максимальная норма градиента
        save_freq: Частота сохранения модели
        eval_freq: Частота оценки модели
        n_eval_episodes: Количество эпизодов для оценки
        config: Конфигурация игры
    
    Returns:
        Tuple[модель, статистика обучения]
    """
    
    logger.info(f"Начинаем обучение модели {model_type}")
    logger.info(f"Параметры: timesteps={total_timesteps}, lr={learning_rate}, batch_size={batch_size}")
    
    # Создаём окружения
    train_env = Monitor(create_env(config))
    eval_env = Monitor(create_env(config))
    
    # Оборачиваем в VecEnv
    train_env = DummyVecEnv([lambda: train_env])
    eval_env = DummyVecEnv([lambda: eval_env])
    
    # Нормализация наблюдений
    train_env = VecNormalize(train_env, norm_obs=True, norm_reward=True)
    eval_env = VecNormalize(eval_env, norm_obs=True, norm_reward=False)
    eval_env.training = False
    eval_env.norm_reward = False
    
    # Создаём модель
    if model_type == 'PPO':
        model = PPO(
            "MlpPolicy",
            train_env,
            learning_rate=learning_rate,
            n_steps=n_steps,
            batch_size=batch_size,
            gamma=gamma,
            gae_lambda=gae_lambda,
            clip_range=clip_range,
            ent_coef=ent_coef,
            vf_coef=vf_coef,
            max_grad_norm=max_grad_norm,
            verbose=1,
            tensorboard_log="./tensorboard_logs/"
        )
    elif model_type == 'A2C':
        model = A2C(
            "MlpPolicy",
            train_env,
            learning_rate=learning_rate,
            gamma=gamma,
            gae_lambda=gae_lambda,
            ent_coef=ent_coef,
            vf_coef=vf_coef,
            max_grad_norm=max_grad_norm,
            verbose=1,
            tensorboard_log="./tensorboard_logs/"
        )
    elif model_type == 'DQN':
        model = DQN(
            "MlpPolicy",
            train_env,
            learning_rate=learning_rate,
            batch_size=batch_size,
            gamma=gamma,
            verbose=1,
            tensorboard_log="./tensorboard_logs/"
        )
    else:
        raise ValueError(f"Неизвестный тип модели: {model_type}")
    
    # Создаём callbacks
    callbacks = []
    
    # Callback для отслеживания прогресса
    training_callback = TrainingCallback()
    callbacks.append(training_callback)
    
    # Callback для сохранения чекпоинтов
    checkpoint_callback = CheckpointCallback(
        save_freq=save_freq,
        save_path="./models/",
        name_prefix=f"{model_type}_network_echo"
    )
    callbacks.append(checkpoint_callback)
    
    # Callback для оценки модели
    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path="./best_models/",
        log_path="./eval_logs/",
        eval_freq=eval_freq,
        n_eval_episodes=n_eval_episodes,
        deterministic=True,
        render=False
    )
    callbacks.append(eval_callback)
    
    # Обучаем модель
    logger.info("Начинаем обучение...")
    start_time = time.time()
    
    try:
        model.learn(
            total_timesteps=total_timesteps,
            callback=callbacks,
            progress_bar=True
        )
    except KeyboardInterrupt:
        logger.info("Обучение прервано пользователем")
    except Exception as e:
        logger.error(f"Ошибка во время обучения: {e}")
        raise
    finally:
        # Закрываем окружения
        train_env.close()
        eval_env.close()
    
    training_time = time.time() - start_time
    logger.info(f"Обучение завершено за {training_time/60:.1f} минут")
    
    # Собираем статистику
    stats = {
        'model_type': model_type,
        'total_timesteps': total_timesteps,
        'training_time_minutes': training_time / 60,
        'episode_count': training_callback.episode_count,
        'final_avg_reward': np.mean(training_callback.episode_rewards[-100:]) if training_callback.episode_rewards else 0,
        'final_win_rate': np.mean(training_callback.win_rates[-100:]) if training_callback.win_rates else 0,
        'episode_rewards': training_callback.episode_rewards,
        'episode_lengths': training_callback.episode_lengths,
        'win_rates': training_callback.win_rates
    }
    
    return model, stats

def evaluate_model(model, env, n_episodes: int = 100) -> Dict:
    """Оценивает обученную модель"""
    logger.info(f"Оцениваем модель на {n_episodes} эпизодах...")
    
    episode_rewards = []
    episode_lengths = []
    wins = 0
    
    for episode in range(n_episodes):
        obs, info = env.reset()
        done = False
        total_reward = 0
        steps = 0
        
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            total_reward += reward
            steps += 1
        
        episode_rewards.append(total_reward)
        episode_lengths.append(steps)
        
        # Определяем победу по высокой награде
        if total_reward > 500:
            wins += 1
        
        if (episode + 1) % 10 == 0:
            logger.info(f"Эпизод {episode + 1}/{n_episodes}: награда={total_reward:.2f}, шаги={steps}")
    
    stats = {
        'mean_reward': np.mean(episode_rewards),
        'std_reward': np.std(episode_rewards),
        'min_reward': np.min(episode_rewards),
        'max_reward': np.max(episode_rewards),
        'mean_length': np.mean(episode_lengths),
        'win_rate': wins / n_episodes,
        'episode_rewards': episode_rewards,
        'episode_lengths': episode_lengths
    }
    
    logger.info(f"Результаты оценки:")
    logger.info(f"  Средняя награда: {stats['mean_reward']:.2f} ± {stats['std_reward']:.2f}")
    logger.info(f"  Диапазон наград: [{stats['min_reward']:.2f}, {stats['max_reward']:.2f}]")
    logger.info(f"  Средняя длина эпизода: {stats['mean_length']:.1f}")
    logger.info(f"  Процент побед: {stats['win_rate']*100:.1f}%")
    
    return stats

def save_results(model, stats: Dict, filename: str = None):
    """Сохраняет результаты обучения"""
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"training_results_{timestamp}.json"
    
    # Сохраняем модель
    model_path = f"models/final_{filename.replace('.json', '')}.zip"
    model.save(model_path)
    
    # Сохраняем статистику
    results = {
        'model_path': model_path,
        'training_stats': stats,
        'timestamp': datetime.now().isoformat()
    }
    
    with open(f"results/{filename}", 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    logger.info(f"Результаты сохранены в {filename}")
    logger.info(f"Модель сохранена в {model_path}")

def main():
    """Главная функция"""
    # Создаём директории
    os.makedirs("models", exist_ok=True)
    os.makedirs("best_models", exist_ok=True)
    os.makedirs("results", exist_ok=True)
    os.makedirs("eval_logs", exist_ok=True)
    os.makedirs("tensorboard_logs", exist_ok=True)
    
    # Параметры обучения
    config = {
        'mode': 'standard',
        'difficulty': 'normal'
    }
    
    training_params = {
        'model_type': 'PPO',
        'total_timesteps': 400000,  # Увеличиваем до 400k шагов
        'learning_rate': 3e-4,
        'batch_size': 64,
        'n_steps': 2048,
        'gamma': 0.99,
        'gae_lambda': 0.95,
        'clip_range': 0.2,
        'ent_coef': 0.01,
        'vf_coef': 0.5,
        'max_grad_norm': 0.5,
        'save_freq': 20000,  # Увеличиваем частоту сохранения
        'eval_freq': 10000,  # Увеличиваем частоту оценки
        'n_eval_episodes': 10,  # Больше эпизодов для оценки
        'config': config
    }
    
    try:
        # Обучаем модель
        model, stats = train_model(**training_params)
        
        # Оцениваем модель
        eval_env = create_env(config)
        eval_stats = evaluate_model(model, eval_env, n_episodes=50)
        eval_env.close()
        
        # Сохраняем результаты
        save_results(model, {**stats, 'evaluation_stats': eval_stats})
        
        logger.info("Обучение завершено успешно!")
        
    except Exception as e:
        logger.error(f"Ошибка во время обучения: {e}")
        raise

if __name__ == "__main__":
    main() 