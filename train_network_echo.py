import os
import time

# ... (остальной код)

def create_env(config: Dict = None, log_path: str = None) -> NetworkEchoEnv:
    """Создаёт окружение с логированием действий для анализа (одиночный DummyVecEnv)"""
    if log_path is None:
        log_path = os.path.join(os.path.dirname(__file__), "actions_log.jsonl")
    print(f"[DEBUG] Лог будет сохранён в: {log_path}")
    return NetworkEchoEnv(config=config, log_actions=True, log_path=log_path)

# ... (внутри main или train_model)
# Для анализа используем только один env!
log_path = os.path.join(os.path.dirname(__file__), "actions_log.jsonl")
train_env = DummyVecEnv([lambda: create_env(config, log_path=log_path)])
eval_env = DummyVecEnv([lambda: create_env(config, log_path=log_path)])

# ... (после обучения)
print(f"Лог действий агента сохранён в {log_path}") 