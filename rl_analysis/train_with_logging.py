#!/usr/bin/env python3
"""
Обучение с детальным логированием для анализа механик игры
"""

import os
import sys
import numpy as np
from datetime import datetime
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv, VecMonitor
from stable_baselines3.common.callbacks import BaseCallback
from enhanced_logging_system import GameLogger, EnhancedNetworkEchoEnv

# ПАРАМЕТРЫ ОБУЧЕНИЯ
EPISODES_PER_STAGE = 500  # Быстрое обучение для тестирования
LEARNING_RATE = 1e-4
N_STEPS = 2048
BATCH_SIZE = 128
N_EPOCHS = 4
ENT_COEF = 0.01

class LoggingCallback(BaseCallback):
    """Callback для логирования процесса обучения"""
    
    def __init__(self, logger, verbose=1):
        super().__init__(verbose)
        self.logger = logger
        self.episode_count = 0
        self.total_reward = 0
        self.episode_rewards = []
        
    def _on_step(self) -> bool:
        # Логируем каждые 100 шагов
        if self.n_calls % 100 == 0:
            if self.verbose > 0:
                print(f"Шаг {self.n_calls}: Обучение продолжается...")
        return True
    
    def _on_rollout_end(self) -> None:
        """Вызывается в конце каждого rollout"""
        if self.verbose > 0:
            print(f"Rollout завершен: {self.n_calls} шагов")

def create_logging_env(config, logger):
    """Создает окружение с логированием"""
    env = EnhancedNetworkEchoEnv(config=config, logger=logger)
    return env

def train_with_logging(stage_name, stage_config, logger, model=None):
    """Обучение с детальным логированием"""
    
    print(f"\n🎯 Этап: {stage_name}")
    print("=" * 50)
    print(f"Конфигурация: {stage_config}")
    
    # Создаем окружение с логированием
    env = create_logging_env(stage_config, logger)
    env = DummyVecEnv([lambda: env])
    env = VecMonitor(env, f"logs/monitor_{logger.session_id}.csv")
    
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
            tensorboard_log=f"./tensorboard_logs/PPO_{logger.session_id}/",
            verbose=1
        )
    else:
        model.set_env(env)
    
    # Callbacks
    callbacks = [
        LoggingCallback(logger, verbose=1)
    ]
    
    # Обучение
    try:
        print(f"Начинаем обучение этапа {stage_name}...")
        print(f"Параметры: episodes={EPISODES_PER_STAGE}, lr={LEARNING_RATE}")
        
        # Обучаем модель
        model.learn(
            total_timesteps=EPISODES_PER_STAGE * 100,  # Быстрое обучение
            callback=callbacks,
            progress_bar=False
        )
        
        # Сохраняем модель
        model_path = f"ppo_logging_{logger.session_id}_stage_{stage_config.get('stage', 0)}.zip"
        model.save(model_path)
        print(f"✅ Модель сохранена: {model_path}")
        
        return model
        
    except Exception as e:
        print(f"❌ Ошибка при обучении этапа {stage_name}: {e}")
        return model
    finally:
        env.close()

def test_trained_model(model_path, logger, num_episodes=10):
    """Тестирует обученную модель"""
    print(f"\n🧪 Тестирование модели: {model_path}")
    print("=" * 40)
    
    # Загружаем модель
    model = PPO.load(model_path)
    
    # Создаем тестовое окружение
    test_config = {'mode': 'full', 'stage': 0}
    env = create_logging_env(test_config, logger)
    
    wins = 0
    total_reward = 0
    
    for episode in range(num_episodes):
        print(f"  Тест эпизод {episode + 1}/{num_episodes}")
        
        obs = env.reset()
        done = False
        step = 0
        episode_reward = 0
        
        while not done and step < 500:  # Ограничиваем шаги
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, done, info = env.step(action)
            episode_reward += reward
            step += 1
            
            if step % 100 == 0:
                print(f"    Шаг {step}: DP={env.state.get('dp', 0)}, CPU={env.state.get('cpu', 0)}")
        
        if episode_reward > 0:
            wins += 1
            print(f"    ✅ Победа! Награда: {episode_reward}")
        else:
            print(f"    ❌ Поражение. Награда: {episode_reward}")
        
        total_reward += episode_reward
    
    win_rate = wins / num_episodes
    avg_reward = total_reward / num_episodes
    
    print(f"\n📊 Результаты тестирования:")
    print(f"  Побед: {wins}/{num_episodes} ({win_rate:.1%})")
    print(f"  Средняя награда: {avg_reward:.2f}")
    
    env.close()
    return win_rate, avg_reward

def main():
    """Основная функция обучения с логированием"""
    
    print("🚀 ЗАПУСК ОБУЧЕНИЯ С ДЕТАЛЬНЫМ ЛОГИРОВАНИЕМ")
    print("=" * 60)
    
    # Создаем уникальную сессию
    session_id = f"training_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    logger = GameLogger(log_dir="logs", session_id=session_id)
    
    print(f"📝 Сессия обучения: {session_id}")
    print(f"📁 Папка логов: {logger.log_dir}")
    
    # Создаем папки
    os.makedirs("logs", exist_ok=True)
    os.makedirs("tensorboard_logs", exist_ok=True)
    
    # Этапы обучения
    stages = [
        {
            "name": "Экономика (с логированием)",
            "stage": 0,
            "mode": "economy_tutorial",
            "episodes": EPISODES_PER_STAGE
        },
        {
            "name": "Оборона (с логированием)",
            "stage": 1,
            "mode": "defense_tutorial",
            "episodes": EPISODES_PER_STAGE
        },
        {
            "name": "Полная игра (с логированием)",
            "stage": 2,
            "mode": "full",
            "episodes": EPISODES_PER_STAGE
        }
    ]
    
    model = None
    stage_results = []
    
    for stage_idx, stage_config in enumerate(stages):
        print(f"\n🎯 Этап {stage_idx + 1}/{len(stages)}: {stage_config['name']}")
        
        # Обучаем этап
        model = train_with_logging(stage_config['name'], stage_config, logger, model)
        
        if model is None:
            print(f"❌ Ошибка на этапе {stage_idx + 1}, прерываем обучение")
            break
        
        # Тестируем модель после каждого этапа
        model_path = f"ppo_logging_{logger.session_id}_stage_{stage_config.get('stage', 0)}.zip"
        if os.path.exists(model_path):
            win_rate, avg_reward = test_trained_model(model_path, logger, num_episodes=5)
            stage_results.append({
                'stage': stage_config['name'],
                'win_rate': win_rate,
                'avg_reward': avg_reward
            })
    
    # Финальная статистика
    print(f"\n📊 ИТОГОВАЯ СТАТИСТИКА ОБУЧЕНИЯ")
    print("=" * 60)
    
    for result in stage_results:
        print(f"  {result['stage']}:")
        print(f"    Процент побед: {result['win_rate']:.1%}")
        print(f"    Средняя награда: {result['avg_reward']:.2f}")
    
    # Сохраняем финальную модель
    if model is not None:
        final_model_path = f"ppo_logging_{logger.session_id}_final.zip"
        model.save(final_model_path)
        print(f"\n✅ Финальная модель сохранена: {final_model_path}")
    
    # Получаем сводку логов
    summary = logger.get_session_summary()
    if summary:
        print(f"\n📈 СВОДКА ЛОГОВ:")
        print(f"  Всего эпизодов: {summary.get('total_episodes', 0)}")
        print(f"  Побед: {summary.get('wins', 0)}")
        print(f"  Процент побед: {summary.get('win_rate', 0):.1%}")
        print(f"  Средняя награда: {summary.get('avg_score', 0):.2f}")
    
    # Информация о созданных логах
    print(f"\n📁 СОЗДАННЫЕ ЛОГИ:")
    print(f"  Эпизоды: {logger.episode_log}")
    print(f"  Действия: {logger.action_log}")
    print(f"  Карты: {logger.map_log}")
    print(f"  Баланс: {logger.balance_log}")
    
    # Проверяем размеры файлов
    for log_file in [logger.episode_log, logger.action_log, logger.map_log, logger.balance_log]:
        if os.path.exists(log_file):
            size = os.path.getsize(log_file)
            print(f"  {os.path.basename(log_file)}: {size} байт")
    
    print(f"\n🎉 ОБУЧЕНИЕ ЗАВЕРШЕНО!")
    print("Теперь у вас есть детальные логи для анализа механик игры и поведения бота.")
    print("Используйте эти данные для балансировки и улучшения игры.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ Ошибка при обучении: {e}")
        import traceback
        traceback.print_exc() 