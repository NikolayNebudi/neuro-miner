#!/usr/bin/env python3
"""
Улучшенная версия NetworkEchoEnv с исправлением проблем нестабильности
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
import subprocess
import json
import os
from datetime import datetime

class NetworkEchoEnvImproved(gym.Env):
    metadata = {"render_modes": ["human"], "render_fps": 4}

    def __init__(self, config=None):
        super().__init__()
        self.proc = None
        self._actions = self._define_actions()
        self.action_space = spaces.Discrete(len(self._actions))
        self.observation_space = spaces.Box(low=0, high=1, shape=(439,), dtype=np.float32)
        self._state = None
        self._config = config or {}
        
        # Улучшенные параметры
        self.stage = self._config.get('stage', 0)
        self.mode = self._config.get('mode', 'full')
        self.reduce_randomness = self._config.get('reduce_randomness', False)
        self.improved_rewards = self._config.get('improved_rewards', False)
        self.curriculum_learning = self._config.get('curriculum_learning', False)
        
        # Статистика для улучшенных наград
        self.episode_stats = {
            'resources_gained': 0,
            'nodes_captured': 0,
            'programs_built': 0,
            'enemies_killed': 0,
            'efficiency_score': 0,
            'exploration_bonus': 0
        }
        
        # Параметры для уменьшения случайности
        self.enemy_spawn_rate = 0.1 if self.reduce_randomness else 0.15
        self.resource_spawn_rate = 0.2 if self.reduce_randomness else 0.3
        
        # Параметры curriculum learning
        self.stage_difficulty = {
            0: {'enemy_spawn_rate': 0.05, 'win_threshold': 0.3, 'max_enemies': 3},
            1: {'enemy_spawn_rate': 0.1, 'win_threshold': 0.5, 'max_enemies': 5},
            2: {'enemy_spawn_rate': 0.15, 'win_threshold': 0.8, 'max_enemies': 10}
        }

    def _define_actions(self):
        """Определяет действия с улучшенной структурой"""
        actions = [{"action": "wait"}]
        
        # Действия захвата и строительства для каждой ноды
        for i in range(1, 25):
            actions.append({"action": "capture", "nodeId": f"n{i}"})
            actions.append({"action": "build", "nodeId": f"n{i}", "program": "miner"})
            actions.append({"action": "build", "nodeId": f"n{i}", "program": "sentry"})
            actions.append({"action": "build", "nodeId": f"n{i}", "program": "shield"})
            actions.append({"action": "build", "nodeId": f"n{i}", "program": "overclocker"})
        
        # Действия для HUB
        actions.append({"action": "upgrade_hub"})
        actions.append({"action": "network_capture"})
        actions.append({"action": "emp_blast"})
        
        return actions

    def _state_to_observation(self, state):
        """Улучшенное преобразование состояния в наблюдение"""
        # Базовые глобальные фичи
        arr = [
            state.get('dp', 0) / 1000.0,
            state.get('cpu', 0) / 200.0,
            state.get('traceLevel', 0) / 200.0,
            min(len(state.get('enemies', [])) / 10.0, 1.0),
            state.get('tick', 0) / 10000.0,
            state.get('hubCaptureProgress', 0) / 100.0,
            min(state.get('empCooldown', 0) / 30.0, 1.0),  # Ограничиваем до 1.0
        ]
        
        # Улучшенные фичи для каждой ноды
        for i in range(1, 25):
            node = state['nodes'].get(f'n{i}', {})
            
            # Владелец ноды
            arr.append(1 if node.get('owner') == 'player' else 0)
            arr.append(1 if node.get('owner') == 'enemy' else 0)
            arr.append(1 if node.get('owner') == 'neutral' else 0)
            
            # Программа на ноде
            program = node.get('program', {})
            arr.append(1 if program.get('type') == 'miner' else 0)
            arr.append(1 if program.get('type') == 'sentry' else 0)
            arr.append(1 if program.get('type') == 'shield' else 0)
            arr.append(1 if program.get('type') == 'overclocker' else 0)
            arr.append(program.get('level', 0) / 10.0)  # Уровень программы
            
            # Щит
            arr.append(node.get('shieldHealth', 0) / float(node.get('maxShieldHealth', 100) or 100))
            
            # Соседи (улучшенная информация)
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
        
        # Дополняем до нужной длины
        arr += [0] * (439 - len(arr))
        return np.array(arr, dtype=np.float32)

    def _calculate_improved_reward(self, old_state, new_state, action):
        """Вычисляет улучшенную награду с промежуточными наградами"""
        base_reward = 0
        
        if not self.improved_rewards:
            return new_state.get('reward', 0)
        
        # Награда за ресурсы
        dp_gained = new_state.get('dp', 0) - old_state.get('dp', 0)
        cpu_gained = new_state.get('cpu', 0) - old_state.get('cpu', 0)
        base_reward += dp_gained * 0.01  # Награда за DP
        base_reward += cpu_gained * 0.02  # Награда за CPU
        
        # Награда за захват нод
        old_player_nodes = sum(1 for n in old_state.get('nodes', {}).values() if n.get('owner') == 'player')
        new_player_nodes = sum(1 for n in new_state.get('nodes', {}).values() if n.get('owner') == 'player')
        nodes_captured = new_player_nodes - old_player_nodes
        base_reward += nodes_captured * 0.5  # Награда за захват
        
        # Награда за строительство программ
        old_programs = sum(1 for n in old_state.get('nodes', {}).values() if n.get('program'))
        new_programs = sum(1 for n in new_state.get('nodes', {}).values() if n.get('program'))
        programs_built = new_programs - old_programs
        base_reward += programs_built * 0.3  # Награда за программы
        
        # Награда за убийство врагов
        enemies_killed = len([e for e in new_state.get('logEvents', []) if e.get('type') == 'enemy_destroyed'])
        base_reward += enemies_killed * 1.0  # Награда за врагов
        
        # Штраф за потерю нод
        old_enemy_nodes = sum(1 for n in old_state.get('nodes', {}).values() if n.get('owner') == 'enemy')
        new_enemy_nodes = sum(1 for n in new_state.get('nodes', {}).values() if n.get('owner') == 'enemy')
        nodes_lost = old_enemy_nodes - new_enemy_nodes
        base_reward -= nodes_lost * 0.3  # Штраф за потерю
        
        # Награда за эффективность (меньше шагов = лучше)
        base_reward -= 0.01  # Небольшой штраф за каждый шаг
        
        # Награда за исследование (разнообразие действий)
        if hasattr(self, '_action_history'):
            self._action_history.append(str(action))  # Преобразуем в строку
            if len(self._action_history) > 10:
                unique_actions = len(set(self._action_history[-10:]))
                base_reward += unique_actions * 0.05  # Награда за разнообразие
        else:
            self._action_history = [str(action)]  # Преобразуем в строку
        
        return base_reward

    def _apply_curriculum_learning(self):
        """Применяет curriculum learning на основе текущего этапа"""
        if not self.curriculum_learning:
            return
        
        difficulty = self.stage_difficulty.get(self.stage, self.stage_difficulty[0])
        
        # Настраиваем параметры окружения
        config_update = {
            'enemy_spawn_rate': difficulty['enemy_spawn_rate'],
            'max_enemies': difficulty['max_enemies'],
            'win_threshold': difficulty['win_threshold']
        }
        
        # Отправляем обновление в игровой движок
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.stdin.write(json.dumps({
                    "cmd": "update_config", 
                    "config": config_update
                }) + '\n')
                self.proc.stdin.flush()
            except:
                pass

    def reset(self, seed=None, options=None):
        """Сброс окружения с улучшенными настройками"""
        self.close()
        
        # Создаем процесс с улучшенными параметрами
        self.proc = subprocess.Popen([
            'node', os.path.join(os.path.dirname(__file__), 'game_engine.js'), 'subproc'
        ], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1)
        
        # Конфигурация с улучшенными параметрами
        reset_config = {
            'mode': self.mode,
            'stage': self.stage,
            'reduce_randomness': self.reduce_randomness,
            'enemy_spawn_rate': self.enemy_spawn_rate,
            'resource_spawn_rate': self.resource_spawn_rate
        }
        
        # Применяем curriculum learning
        if self.curriculum_learning:
            difficulty = self.stage_difficulty.get(self.stage, self.stage_difficulty[0])
            reset_config.update(difficulty)
        
        reset_msg = {"cmd": "reset", "config": reset_config}
        self.proc.stdin.write(json.dumps(reset_msg) + '\n')
        self.proc.stdin.flush()
        
        line = self.proc.stdout.readline()
        state = json.loads(line)
        self._state = state
        
        # Сбрасываем статистику эпизода
        self.episode_stats = {
            'resources_gained': 0,
            'nodes_captured': 0,
            'programs_built': 0,
            'enemies_killed': 0,
            'efficiency_score': 0,
            'exploration_bonus': 0
        }
        
        # Сбрасываем историю действий
        self._action_history = []
        
        obs = self._state_to_observation(state)
        return obs, {}

    def step(self, action_idx):
        """Выполнение действия с улучшенными наградами"""
        action = self._actions[action_idx]
        old_state = self._state.copy()
        
        # Отправляем действие
        self.proc.stdin.write(json.dumps({
            "cmd": "step", 
            "action": action, 
            "state": self._state
        }) + '\n')
        self.proc.stdin.flush()
        
        line = self.proc.stdout.readline()
        result = json.loads(line)
        
        self._state = result['newState']
        done = result['done']
        
        # Вычисляем улучшенную награду
        if self.improved_rewards:
            reward = self._calculate_improved_reward(old_state, self._state, action)
        else:
            reward = result.get('reward', 0)
        
        obs = self._state_to_observation(self._state)
        info = {}
        
        # Детальная статистика в конце эпизода
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
                'total_cpu': total_cpu,
                'episode_stats': self.episode_stats,
                'stage': self.stage,
                'mode': self.mode
            }
            info['final_stats'] = stats
        
        return obs, reward, done, False, info

    def set_stage(self, stage):
        """Устанавливает этап для curriculum learning"""
        self.stage = stage
        self._apply_curriculum_learning()

    def reduce_randomness(self):
        """Уменьшает случайность в окружении"""
        self.reduce_randomness = True
        self.enemy_spawn_rate = 0.05
        self.resource_spawn_rate = 0.2

    def close(self):
        """Закрывает процесс"""
        if self.proc:
            self.proc.terminate()
            self.proc = None 