import gymnasium as gym
import numpy as np
import json
import subprocess
import time
from gymnasium import spaces
from typing import Dict, List, Tuple, Any, Optional
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NetworkEchoEnv(gym.Env):
    """
    Окружение для обучения RL-модели на игре Network Echo
    Взаимодействует с JavaScript-движком через subprocess
    """
    
    def __init__(self, config: Dict = None):
        super().__init__()
        
        self.config = config or {}
        self.game_process = None
        self.game_state = None
        self.step_count = 0
        self.max_steps = 5000
        
        # Определяем пространство действий
        self.action_space = spaces.Discrete(100)  # Упрощённое представление
        
        # Определяем пространство наблюдений
        self.observation_space = spaces.Box(
            low=0, high=1000, 
            shape=(50,),  # Упрощённое представление состояния
            dtype=np.float32
        )
        
        # Запускаем JavaScript-процесс
        self._start_game_process()
        
    def _start_game_process(self):
        """Запускает JavaScript-процесс игры"""
        try:
            self.game_process = subprocess.Popen(
                ['node', 'game_engine.js', 'subproc'],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            logger.info("JavaScript-процесс игры запущен")
        except Exception as e:
            logger.error(f"Ошибка запуска JavaScript-процесса: {e}")
            raise
    
    def _send_command(self, command: Dict) -> Dict:
        """Отправляет команду в JavaScript-процесс и получает ответ"""
        try:
            self.game_process.stdin.write(json.dumps(command) + '\n')
            self.game_process.stdin.flush()
            response = self.game_process.stdout.readline().strip()
            return json.loads(response)
        except Exception as e:
            logger.error(f"Ошибка коммуникации с JavaScript-процессом: {e}")
            raise
    
    def _encode_action(self, action_idx: int) -> Dict:
        possible_actions = self._send_command({
            'cmd': 'get_actions',
            'state': self.game_state
        })
        if not possible_actions or 'actions' not in possible_actions:
            return {'action': 'wait'}
        actions = possible_actions['actions']
        if not actions:
            return {'action': 'wait'}
        action_idx = action_idx % len(actions)
        return actions[action_idx]
    
    def _encode_observation(self, game_state: Dict) -> np.ndarray:
        obs = []
        obs.extend([
            game_state.get('dp', 0) / 1000.0,
            game_state.get('cpu', 0) / 1000.0,
            game_state.get('traceLevel', 0) / 200.0,
            game_state.get('hubLevel', 1) / 4.0,
            game_state.get('empCooldown', 0) / 1800.0,
        ])
        nodes = game_state.get('nodes', {})
        player_nodes = 0
        neutral_nodes = 0
        enemy_nodes = 0
        cpu_nodes = 0
        data_cache_nodes = 0
        for node in nodes.values():
            if node.get('owner') == 'player':
                player_nodes += 1
                if node.get('type') == 'cpu_node':
                    cpu_nodes += 1
                elif node.get('type') == 'data_cache':
                    data_cache_nodes += 1
            elif node.get('owner') == 'neutral':
                neutral_nodes += 1
            else:
                enemy_nodes += 1
        total_nodes = len(nodes)
        obs.extend([
            player_nodes / max(total_nodes, 1),
            neutral_nodes / max(total_nodes, 1),
            enemy_nodes / max(total_nodes, 1),
            cpu_nodes / max(total_nodes, 1),
            data_cache_nodes / max(total_nodes, 1),
        ])
        miners = 0
        shields = 0
        sentries = 0
        overclockers = 0
        for node in nodes.values():
            if node.get('owner') == 'player' and node.get('program'):
                prog_type = node['program'].get('type')
                if prog_type == 'miner':
                    miners += 1
                elif prog_type == 'shield':
                    shields += 1
                elif prog_type == 'sentry':
                    sentries += 1
                elif prog_type == 'overclocker':
                    overclockers += 1
        obs.extend([
            miners / 5.0,
            shields / 10.0,
            sentries / 10.0,
            overclockers / 3.0,
        ])
        enemies = game_state.get('enemies', [])
        enemy_count = len(enemies)
        hunter_count = sum(1 for e in enemies if e.get('type') == 'hunter')
        disruptor_count = sum(1 for e in enemies if e.get('type') == 'disruptor')
        obs.extend([
            enemy_count / 20.0,
            hunter_count / 10.0,
            disruptor_count / 10.0,
        ])
        obs.extend([
            game_state.get('hubCaptureActive', False) * 1.0,
            game_state.get('hubCaptureProgress', 0),
        ])
        while len(obs) < 50:
            obs.append(0.0)
        return np.array(obs[:50], dtype=np.float32)
    
    def reset(self, *, seed: Optional[int] = None, options: Optional[dict] = None):
        self.step_count = 0
        if seed is not None:
            self.seed(seed)
        response = self._send_command({
            'cmd': 'reset',
            'config': self.config
        })
        if 'error' in response:
            logger.error(f"Ошибка сброса игры: {response['error']}")
            raise Exception(f"Ошибка сброса игры: {response['error']}")
        self.game_state = response
        obs = self._encode_observation(self.game_state)
        info = {}
        return obs, info
    
    def step(self, action: int):
        self.step_count += 1
        game_action = self._encode_action(action)
        response = self._send_command({
            'cmd': 'step',
            'state': self.game_state,
            'action': game_action
        })
        if 'error' in response:
            logger.error(f"Ошибка выполнения действия: {response['error']}")
            raise Exception(f"Ошибка выполнения действия: {response['error']}")
        self.game_state = response['newState']
        reward = response['reward']
        done = response['done']
        if self.step_count >= self.max_steps:
            done = True
        info = {
            'step_count': self.step_count,
            'stats': response.get('stats', {}),
            'log_events': response.get('logEvents', []),
            'action': game_action
        }
        terminated = done
        truncated = False
        obs = self._encode_observation(self.game_state)
        return obs, reward, terminated, truncated, info
    
    def close(self):
        if self.game_process:
            self.game_process.terminate()
            self.game_process.wait()
            logger.info("JavaScript-процесс игры остановлен")
    
    def render(self):
        pass
    
    def seed(self, seed=None):
        np.random.seed(seed)
        return [seed]

# Регистрируем окружение
gym.register(
    id='NetworkEcho-v0',
    entry_point='network_echo_env:NetworkEchoEnv',
    max_episode_steps=5000
)

if __name__ == "__main__":
    env = NetworkEchoEnv()
    try:
        obs, info = env.reset()
        print(f"Начальное наблюдение: {obs.shape}")
        print(f"Начальное состояние: DP={env.game_state.get('dp')}, CPU={env.game_state.get('cpu')}")
        for step in range(10):
            action = env.action_space.sample()
            obs, reward, terminated, truncated, info = env.step(action)
            print(f"Шаг {step}: действие={info['action']}, награда={reward:.2f}, DP={info['stats'].get('dp')}, CPU={info['stats'].get('cpu')}")
            if terminated or truncated:
                print("Эпизод завершён")
                break
        print("Тест окружения завершён успешно!")
    finally:
        env.close() 