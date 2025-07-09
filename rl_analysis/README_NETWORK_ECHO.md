# RL-обучение для игры Network Echo

Этот проект реализует обучение с подкреплением (Reinforcement Learning) для игры Network Echo, используя JavaScript-движок игры и Python-окружение для RL.

## 🎮 Описание игры

Network Echo - это киберпанк-стратегия, где игрок:
- Захватывает узлы сети
- Строит программы (майнеры, щиты, дозоры, разгонщики)
- Апгрейдит хаб до уровня 4
- Выполняет финальный захват сети
- Борется с врагами (патрульные, охотники, нарушители)

## 🏗️ Архитектура

```
JavaScript Game Engine (game_engine.js)
    ↓ subprocess communication
Python RL Environment (network_echo_env.py)
    ↓ gym interface
Stable-Baselines3 Models (PPO, A2C, DQN)
```

## 📋 Требования

### Системные требования
- Python 3.8+
- Node.js 14+
- Git

### Python зависимости
```bash
pip install stable-baselines3 gym numpy pandas matplotlib seaborn
```

## 🚀 Быстрый старт

### 1. Тестирование окружения
```bash
python test_env.py
```

### 2. Обучение модели
```bash
python train_network_echo.py
```

### 3. Демонстрация обученной модели
```bash
python demo_trained_model.py
```

## 📁 Структура проекта

```
rl_analysis/
├── game_engine.js          # JavaScript-движок игры
├── network_echo_env.py     # Python-окружение для RL
├── train_network_echo.py   # Скрипт обучения
├── test_env.py            # Тестирование окружения
├── demo_trained_model.py  # Демонстрация модели
├── README_NETWORK_ECHO.md # Этот файл
├── models/                # Сохранённые модели
├── best_models/          # Лучшие модели
├── results/              # Результаты обучения
├── eval_logs/            # Логи оценки
└── tensorboard_logs/     # Логи TensorBoard
```

## 🎯 Пространство действий

Модель может выполнять следующие действия:
- `wait` - ожидание
- `capture` - захват узла
- `build` - строительство программы
- `upgrade` - апгрейд программы
- `upgrade_hub` - апгрейд хаба
- `network_capture` - финальный захват сети
- `emp_blast` - EMP-взрыв

## 👁️ Пространство наблюдений

50-мерный вектор, включающий:
- Ресурсы (DP, CPU, trace level, hub level, EMP cooldown)
- Статистика узлов (игрок/нейтральные/враги, CPU-узлы, кэши)
- Программы (майнеры, щиты, дозоры, разгонщики)
- Враги (количество, типы)
- Захват сети (активность, прогресс)

## 🎓 Алгоритмы обучения

Поддерживаются следующие алгоритмы:
- **PPO** (Proximal Policy Optimization) - рекомендуемый
- **A2C** (Advantage Actor-Critic)
- **DQN** (Deep Q-Network)

## ⚙️ Параметры обучения

### Базовые параметры
```python
training_params = {
    'model_type': 'PPO',
    'total_timesteps': 50000,
    'learning_rate': 3e-4,
    'batch_size': 64,
    'n_steps': 2048,
    'gamma': 0.99,
    'gae_lambda': 0.95,
    'clip_range': 0.2,
    'ent_coef': 0.01,
    'vf_coef': 0.5,
    'max_grad_norm': 0.5
}
```

### Настройка для длительного обучения
```python
# Для серьёзного обучения увеличьте:
'total_timesteps': 500000,  # 500k шагов
'batch_size': 128,          # Больший батч
'n_steps': 4096,           # Больше шагов на обновление
```

## 📊 Мониторинг обучения

### Логи
- `training.log` - основной лог обучения
- `eval_logs/` - результаты оценки
- `tensorboard_logs/` - метрики для TensorBoard

### Метрики
- Средняя награда за эпизод
- Процент побед
- Длина эпизодов
- Время обучения

### TensorBoard
```bash
tensorboard --logdir tensorboard_logs/
```

## 🏆 Оценка модели

Модель оценивается по:
- Средней награде за 100 эпизодов
- Проценту побед
- Стабильности результатов (CV)
- Времени до победы

## 🔧 Настройка игры

### Конфигурация
```python
config = {
    'mode': 'standard',      # Режим игры
    'difficulty': 'normal'   # Сложность
}
```

### Режимы игры
- `standard` - стандартная игра
- `hard` - повышенная сложность
- `easy` - пониженная сложность

## 🐛 Отладка

### Проблемы с JavaScript-процессом
```bash
# Проверка Node.js
node --version

# Тест движка
node game_engine.js subproc
```

### Проблемы с окружением
```bash
# Тест окружения
python test_env.py

# Проверка зависимостей
pip list | grep -E "(stable-baselines3|gym|numpy)"
```

## 📈 Улучшение результатов

### 1. Увеличение данных
- Больше эпизодов обучения
- Разнообразные начальные состояния

### 2. Настройка наград
- Shaping rewards для промежуточных целей
- Пенальти за неэффективные действия

### 3. Архитектура сети
- Более глубокие сети
- Специализированные слои

### 4. Гиперпараметры
- Эксперименты с learning rate
- Настройка коэффициентов

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Добавьте тесты
5. Создайте pull request

## 📄 Лицензия

MIT License

## 🙏 Благодарности

- Stable-Baselines3 команде
- OpenAI Gym
- Сообществу RL

---

**Удачного обучения! 🚀** 