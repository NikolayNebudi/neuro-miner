import gymnasium as gym
from gymnasium import spaces
import numpy as np
import subprocess
import json
import os

class NetworkEchoEnv(gym.Env):
    metadata = {"render_modes": ["human"], "render_fps": 4}

    def __init__(self, config=None):
        super().__init__()
        self.proc = None
        self._actions = self._define_actions()
        self.action_space = spaces.Discrete(len(self._actions))
        self.observation_space = spaces.Box(low=0, high=1, shape=(319,), dtype=np.float32)
        self._state = None
        self._config = config or {}

    def _define_actions(self):
        # Пример: 0 — wait, 1-49 — захват/постройка на нодах n1-n24, hub и т.д.
        actions = [{"action": "wait"}]
        for i in range(1, 25):
            actions.append({"action": "capture", "nodeId": f"n{i}"})
            actions.append({"action": "build", "nodeId": f"n{i}", "program": "miner"})
            actions.append({"action": "build", "nodeId": f"n{i}", "program": "sentry"})
        actions.append({"action": "emp"})
        return actions

    def _state_to_observation(self, state):
        # Нормализация глобальных фичей
        arr = [
            state.get('dp', 0) / 1000.0,
            state.get('cpu', 0) / 200.0,
            state.get('traceLevel', 0) / 200.0,
            min(len(state.get('enemies', [])) / 10.0, 1.0),
            state.get('tick', 0) / 10000.0,
            state.get('hubCaptureProgress', 0) / 100.0,
            state.get('empCooldown', 0) / 30.0,
        ]
        # Для каждой ноды: owner, program, shield, а также owner/program соседей (до 3)
        for i in range(1, 25):
            node = state['nodes'].get(f'n{i}', {})
            arr.append(1 if node.get('owner') == 'player' else 0)
            arr.append(1 if node.get('owner') == 'enemy' else 0)
            arr.append(1 if node.get('program') else 0)
            # shieldHealth нормализуем
            arr.append(node.get('shieldHealth', 0) / float(node.get('maxShieldHealth', 100) or 100))
            # Соседи
            neighbors = node.get('neighbors', []) if node else []
            for ni in range(3):
                if ni < len(neighbors):
                    n_id = neighbors[ni]
                    n = state['nodes'].get(n_id, {})
                    arr.append(1 if n.get('owner') == 'player' else 0)
                    arr.append(1 if n.get('owner') == 'enemy' else 0)
                    arr.append(1 if n.get('program') else 0)
                else:
                    arr += [0, 0, 0]
        arr += [0] * (319 - len(arr))
        return np.array(arr, dtype=np.float32)

    def reset(self, seed=None, options=None):
        self.close()
        self.proc = subprocess.Popen([
            'node', os.path.join(os.path.dirname(__file__), 'game_engine.js'), 'subproc'
        ], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1)
        reset_msg = {"cmd": "reset"}
        if self._config:
            reset_msg["config"] = self._config
        self.proc.stdin.write(json.dumps(reset_msg) + '\n')
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        state = json.loads(line)
        self._state = state
        obs = self._state_to_observation(state)
        return obs, {}

    def step(self, action_idx):
        action = self._actions[action_idx]
        self.proc.stdin.write(json.dumps({"cmd": "step", "action": action, "state": self._state}) + '\n')
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        result = json.loads(line)
        self._state = result['newState']
        reward = result['reward']
        done = result['done']
        obs = self._state_to_observation(self._state)
        info = {}
        # Detailed end-of-game logging
        if done:
            nodes = self._state['nodes']
            program_counts = {}
            program_levels = {}
            for node in nodes.values():
                prog = node.get('program')
                if prog:
                    t = prog['type']
                    program_counts[t] = program_counts.get(t, 0) + 1
                    program_levels[t] = program_levels.get(t, 0) + prog.get('level', 1)
            avg_levels = {t: (program_levels[t] / program_counts[t]) for t in program_counts}
            enemies_killed = sum(1 for e in self._state.get('logEvents', []) if e.get('type') == 'enemy_destroyed')
            total_dp = self._state.get('dp', 0)
            total_cpu = self._state.get('cpu', 0)
            stats = {
                'program_counts': program_counts,
                'avg_levels': avg_levels,
                'enemies_killed': enemies_killed,
                'total_dp': total_dp,
                'total_cpu': total_cpu
            }
            info['final_stats'] = stats
        return obs, reward, done, False, info

    def close(self):
        if self.proc:
            self.proc.terminate()
            self.proc = None 