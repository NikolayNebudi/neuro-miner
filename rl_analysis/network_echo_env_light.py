#!/usr/bin/env python3
"""
Легкая версия NetworkEchoEnv с оптимизированным логированием
Сохраняет только важную статистику без карты и всех шагов
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
import subprocess
import json
import os
from datetime import datetime

class NetworkEchoEnvLight(gym.Env):
    metadata = {"render_modes": ["human"], "render_fps": 4}

    def __init__(self, config=None, log_actions=False, log_path="light_actions_log.jsonl", max_log_entries=10000):
        super().__init__()
        self.proc = None
        self._actions = self._define_actions()
        self.action_space = spaces.Discrete(len(self._actions))
        self.observation_space = spaces.Box(low=0, high=1, shape=(439,), dtype=np.float32)
        self._state = None
        self._config = config or {}
        
        # Логирование
        self.log_actions = log_actions
        self.log_path = log_path
        self.max_log_entries = max_log_entries
        self.log_entries_count = 0
        self.log_file = None
        
        if self.log_actions:
            self._setup_logging()

    def _setup_logging(self):
        """Настройка логирования"""
        try:
            # Создаем новый файл для каждого запуска
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.log_path = f"light_log_{timestamp}.jsonl"
            self.log_file = open(self.log_path, 'w')
            print(f"📝 Логирование включено: {self.log_path}")
        except Exception as e:
            print(f"❌ Ошибка настройки логирования: {e}")
            self.log_actions = False

    def _define_actions(self):
        """Определяет возможные действия"""
        return [
            "build", "capture", "upgrade_hub", "emp_blast", 
            "network_capture", "wait"
        ]

    def _start_game(self):
        """Запускает игру"""
        import shutil
        try:
            # Путь к game_engine.js
            game_engine_path = os.path.join(os.path.dirname(__file__), "game_engine.js")
            node_path = shutil.which("node") or "node"
            self.proc = subprocess.Popen(
                [node_path, game_engine_path, "subproc"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            # Инициализируем игру
            init_command = json.dumps({"cmd": "reset", "config": self._config})
            self.proc.stdin.write(init_command + "\n")
            self.proc.stdin.flush()
            
            # Ждем ответа
            response = self.proc.stdout.readline()
            if not response:
                # Читаем и выводим ошибку
                err = self.proc.stderr.read()
                print('STDERR:', err)
                raise Exception("Не удалось запустить game_engine.js")
            
            # Парсим начальное состояние
            self._state = json.loads(response)
            return True
        except Exception as e:
            print(f"❌ Ошибка запуска игры: {e}")
            return False

    def _send_action(self, action):
        """Отправляет действие в игру"""
        try:
            if self.proc and self.proc.poll() is None:
                # Отправляем команду step
                step_command = json.dumps({
                    "cmd": "step",
                    "state": self._state,
                    "action": action
                })
                self.proc.stdin.write(step_command + "\n")
                self.proc.stdin.flush()
                return True
            return False
        except Exception as e:
            print(f"❌ Ошибка отправки действия: {e}")
            return False

    def _get_state(self):
        """Получает состояние игры"""
        try:
            if self.proc and self.proc.poll() is None:
                response = self.proc.stdout.readline()
                if response:
                    result = json.loads(response)
                    if 'error' in result:
                        print(f"❌ Ошибка игры: {result['error']}")
                        return None
                    # Возвращаем весь результат, а не только newState
                    return result
            return None
        except Exception as e:
            print(f"❌ Ошибка получения состояния: {e}")
            return None

    def _log_episode_start(self, episode):
        """Логирует начало эпизода"""
        if not self.log_actions or self.log_entries_count >= self.max_log_entries:
            return
            
        log_entry = {
            "type": "episode_start",
            "episode": episode,
            "timestamp": datetime.now().isoformat(),
            "config": self._config
        }
        
        self.log_file.write(json.dumps(log_entry) + "\n")
        self.log_file.flush()
        self.log_entries_count += 1

    def _log_action_light(self, episode, step, action, reward, state_summary):
        """Логирует действие в легком формате"""
        if not self.log_actions or self.log_entries_count >= self.max_log_entries:
            return
            
        log_entry = {
            "type": "action",
            "episode": episode,
            "step": step,
            "chosen_action": {"action": action},
            "reward": reward,
            "state_summary": state_summary,  # Только краткая сводка
            "timestamp": datetime.now().isoformat()
        }
        
        self.log_file.write(json.dumps(log_entry) + "\n")
        self.log_file.flush()
        self.log_entries_count += 1

    def _log_episode_end(self, episode, total_steps, total_reward, final_score, win):
        """Логирует конец эпизода"""
        if not self.log_actions or self.log_entries_count >= self.max_log_entries:
            return
            
        log_entry = {
            "type": "episode_end",
            "episode": episode,
            "total_steps": total_steps,
            "total_reward": total_reward,
            "final_score": final_score,
            "win": win,
            "timestamp": datetime.now().isoformat()
        }
        
        self.log_file.write(json.dumps(log_entry) + "\n")
        self.log_file.flush()
        self.log_entries_count += 1

    def _extract_state_summary(self, state):
        """Извлекает краткую сводку состояния без полной карты"""
        if not state:
            return {}
            
        nodes = state.get("nodes", {})
        node_count = len(nodes)
        owned_nodes = sum(1 for node in nodes.values() if node.get("owner") == "player")
        
        # Получаем доступные действия из game_engine.js
        available_actions = 6  # Всегда доступно 6 действий: build, capture, upgrade_hub, emp_blast, network_capture, wait
        
        summary = {
            "game_over": state.get("win", False) or state.get("traceLevel", 0) >= 300,
            "current_player": 0,  # Всегда игрок
            "scores": {"0": owned_nodes},
            "node_count": node_count,
            "owned_nodes": owned_nodes,
            "total_nodes": node_count,
            "available_actions": available_actions
        }
        
        return summary

    def reset(self, seed=None, options=None):
        """Сброс окружения"""
        super().reset(seed=seed)
        
        # Завершаем предыдущий процесс
        if self.proc:
            self.proc.terminate()
            self.proc.wait()
        
        # Запускаем новую игру
        if not self._start_game():
            raise Exception("Не удалось запустить игру")
        
        # Логируем начало эпизода
        episode = getattr(self, '_episode', 0) + 1
        self._episode = episode
        self._log_episode_start(episode)
        
        # Сбрасываем счетчики
        self._step_count = 0
        self._total_reward = 0
        
        return self._get_observation(), {}

    def step(self, action):
        """Выполняет шаг в игре"""
        if self.proc is None or self.proc.poll() is not None:
            return self._get_observation(), 0, True, False, {}
        
        # Отправляем действие
        action_name = self._actions[action]
        if not self._send_action(action_name):
            return self._get_observation(), 0, True, False, {}
        
        # Получаем результат
        result = self._get_state()
        if not result:
            return self._get_observation(), 0, True, False, {}
        
        # Обновляем состояние
        self._state = result.get('newState', result)
        
        # Получаем награду и статус завершения
        reward = result.get('reward', 0)
        done = result.get('done', False)
        
        self._total_reward += reward
        self._step_count += 1
        
        # Логируем действие с правильной наградой
        state_summary = self._extract_state_summary(self._state)
        self._log_action_light(self._episode, self._step_count, action_name, reward, state_summary)
        
        # Логируем конец эпизода
        if done:
            # Получаем статистику из результата
            stats = result.get('stats', {})
            final_score = stats.get('playerNodes', 0)
            win = result.get('win', False)
            self._log_episode_end(self._episode, self._step_count, self._total_reward, final_score, win)
        
        return self._get_observation(), reward, done, False, {}

    def _get_observation(self):
        """Преобразует состояние в наблюдение"""
        if not self._state:
            return np.zeros(439, dtype=np.float32)
        
        # Упрощенное преобразование состояния
        obs = []
        
        nodes = self._state.get("nodes", {})
        node_count = len(nodes)
        owned_nodes = sum(1 for node in nodes.values() if node.get("owner") == "player")
        
        # Добавляем базовую информацию (нормализованную)
        obs.extend([
            0,  # currentPlayer (всегда 0)
            min(node_count / 50.0, 1.0),  # Нормализуем количество узлов
            min(len(self._state.get("availableActions", [])) / 10.0, 1.0),  # Нормализуем действия
            1.0 if (self._state.get("win", False) or self._state.get("traceLevel", 0) >= 300) else 0.0
        ])
        
        # Добавляем информацию о ресурсах (нормализованную)
        obs.extend([
            min(self._state.get("dp", 0) / 1000.0, 1.0),  # Нормализуем DP
            min(self._state.get("cpu", 0) / 100.0, 1.0),   # Нормализуем CPU
            min(self._state.get("traceLevel", 0) / 300.0, 1.0),  # Нормализуем trace level
            min(len(self._state.get("enemies", [])) / 10.0, 1.0)  # Нормализуем врагов
        ])
        
        # Добавляем информацию о узлах (упрощенную и нормализованную)
        for node_id, node in nodes.items():
            obs.extend([
                1.0 if node.get("owner") == "player" else 0.0,
                min(node.get("level", 0) / 10.0, 1.0),  # Нормализуем уровень
                min(len(node.get("neighbors", [])) / 10.0, 1.0),  # Нормализуем соседей
                1.0 if node.get("program") else 0.0
            ])
        
        # Дополняем до нужного размера
        while len(obs) < 439:
            obs.append(0.0)
        
        return np.array(obs[:439], dtype=np.float32)



    def close(self):
        """Закрывает окружение"""
        if self.log_file:
            self.log_file.close()
        
        if self.proc:
            self.proc.terminate()
            self.proc.wait()

    def render(self):
        """Рендеринг (не реализован)"""
        pass 