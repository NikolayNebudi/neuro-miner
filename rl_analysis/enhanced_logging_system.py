#!/usr/bin/env python3
"""
Улучшенная система логирования для анализа механик игры и баланса
"""

import json
import csv
import os
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
import numpy as np

class GameLogger:
    """Система логирования для детального анализа игры"""
    
    def __init__(self, log_dir="logs", session_id=None):
        self.log_dir = log_dir
        self.session_id = session_id or str(uuid.uuid4())[:8]
        self.episode_id = 0
        
        # Создаем папки для логов
        os.makedirs(log_dir, exist_ok=True)
        os.makedirs(f"{log_dir}/episodes", exist_ok=True)
        os.makedirs(f"{log_dir}/maps", exist_ok=True)
        os.makedirs(f"{log_dir}/actions", exist_ok=True)
        os.makedirs(f"{log_dir}/balance", exist_ok=True)
        
        # Файлы для логов
        self.episode_log = f"{log_dir}/episodes/session_{self.session_id}.csv"
        self.action_log = f"{log_dir}/actions/actions_{self.session_id}.jsonl"
        self.map_log = f"{log_dir}/maps/maps_{self.session_id}.jsonl"
        self.balance_log = f"{log_dir}/balance/balance_{self.session_id}.csv"
        
        # Инициализируем файлы
        self._init_log_files()
        
    def _init_log_files(self):
        """Инициализирует файлы логов с заголовками"""
        
        # Episode log
        if not os.path.exists(self.episode_log):
            with open(self.episode_log, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'episode_id', 'session_id', 'timestamp', 'duration_steps', 'final_score',
                    'win', 'win_reason', 'lose_reason', 'trace_level', 'hub_level',
                    'final_dp', 'final_cpu', 'total_enemies_killed', 'total_enemies_spawned',
                    'nodes_captured', 'nodes_lost', 'programs_built', 'programs_upgraded',
                    'hub_upgrades', 'emp_blasts_used', 'network_capture_attempted',
                    'map_seed', 'difficulty_stage', 'mode'
                ])
        
        # Balance log
        if not os.path.exists(self.balance_log):
            with open(self.balance_log, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'episode_id', 'step', 'timestamp', 'dp', 'cpu', 'trace_level',
                    'enemies_count', 'player_nodes_count', 'neutral_nodes_count',
                    'miners_count', 'sentries_count', 'shields_count', 'overclockers_count',
                    'avg_program_level', 'total_shield_health', 'emp_cooldown',
                    'hub_capture_progress', 'resources_income_rate', 'enemy_spawn_rate'
                ])
    
    def log_map_data(self, episode_id: int, map_data: Dict[str, Any]):
        """Логирует данные карты для каждого эпизода"""
        map_entry = {
            'episode_id': episode_id,
            'session_id': self.session_id,
            'timestamp': datetime.now().isoformat(),
            'map_data': map_data
        }
        
        with open(self.map_log, 'a') as f:
            f.write(json.dumps(map_entry) + '\n')
    
    def log_action(self, episode_id: int, step: int, action: Dict[str, Any], 
                   state_before: Dict[str, Any], state_after: Dict[str, Any], 
                   reward: float, done: bool):
        """Логирует каждое действие бота"""
        action_entry = {
            'episode_id': episode_id,
            'step': step,
            'timestamp': datetime.now().isoformat(),
            'action': action,
            'state_before': self._extract_key_state(state_before),
            'state_after': self._extract_key_state(state_after),
            'reward': reward,
            'done': done,
            'log_events': state_after.get('logEvents', [])
        }
        
        with open(self.action_log, 'a') as f:
            f.write(json.dumps(action_entry) + '\n')
    
    def log_balance_step(self, episode_id: int, step: int, state: Dict[str, Any]):
        """Логирует состояние баланса на каждом шаге"""
        nodes = state.get('nodes', {})
        
        # Подсчет статистики
        player_nodes = sum(1 for n in nodes.values() if n.get('owner') == 'player')
        neutral_nodes = sum(1 for n in nodes.values() if n.get('owner') == 'neutral')
        enemies = state.get('enemies', [])
        
        # Подсчет программ
        miners = sum(1 for n in nodes.values() if isinstance(n.get('program'), dict) and n.get('program', {}).get('type') == 'miner')
        sentries = sum(1 for n in nodes.values() if isinstance(n.get('program'), dict) and n.get('program', {}).get('type') == 'sentry')
        shields = sum(1 for n in nodes.values() if isinstance(n.get('program'), dict) and n.get('program', {}).get('type') == 'shield')
        overclockers = sum(1 for n in nodes.values() if isinstance(n.get('program'), dict) and n.get('program', {}).get('type') == 'overclocker')
        
        # Средний уровень программ
        program_levels = [n.get('program', {}).get('level', 0) for n in nodes.values() if isinstance(n.get('program'), dict)]
        avg_program_level = np.mean(program_levels) if program_levels else 0
        
        # Общее здоровье щитов
        total_shield_health = sum(n.get('shieldHealth', 0) for n in nodes.values())
        
        # Доход ресурсов (примерная оценка)
        dp_income = 2  # от хаба
        cpu_income = 0
        for node in nodes.values():
            if node.get('owner') == 'player' and node.get('program'):
                prog = node['program']
                if prog.get('type') == 'miner':
                    dp_income += 3 * (1.8 ** (prog.get('level', 1) - 1))
                elif prog.get('type') == 'overclocker':
                    cpu_income += 1 * prog.get('level', 1)
        
        balance_data = [
            episode_id, step, datetime.now().isoformat(),
            state.get('dp', 0), state.get('cpu', 0), state.get('traceLevel', 0),
            len(enemies), player_nodes, neutral_nodes,
            miners, sentries, shields, overclockers,
            avg_program_level, total_shield_health, state.get('empCooldown', 0),
            state.get('hubCaptureProgress', 0), dp_income, cpu_income
        ]
        
        with open(self.balance_log, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(balance_data)
    
    def log_episode_end(self, episode_id: int, episode_data: Dict[str, Any]):
        """Логирует завершение эпизода"""
        with open(self.episode_log, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                episode_id, self.session_id, datetime.now().isoformat(),
                episode_data.get('duration_steps', 0),
                episode_data.get('final_score', 0),
                episode_data.get('win', False),
                episode_data.get('win_reason', ''),
                episode_data.get('lose_reason', ''),
                episode_data.get('trace_level', 0),
                episode_data.get('hub_level', 1),
                episode_data.get('final_dp', 0),
                episode_data.get('final_cpu', 0),
                episode_data.get('total_enemies_killed', 0),
                episode_data.get('total_enemies_spawned', 0),
                episode_data.get('nodes_captured', 0),
                episode_data.get('nodes_lost', 0),
                episode_data.get('programs_built', 0),
                episode_data.get('programs_upgraded', 0),
                episode_data.get('hub_upgrades', 0),
                episode_data.get('emp_blasts_used', 0),
                episode_data.get('network_capture_attempted', False),
                episode_data.get('map_seed', ''),
                episode_data.get('difficulty_stage', 0),
                episode_data.get('mode', 'full')
            ])
    
    def _extract_key_state(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Извлекает ключевые данные из состояния для логирования"""
        return {
            'dp': state.get('dp', 0),
            'cpu': state.get('cpu', 0),
            'traceLevel': state.get('traceLevel', 0),
            'hubLevel': state.get('hubLevel', 1),
            'enemies_count': len(state.get('enemies', [])),
            'player_nodes_count': sum(1 for n in state.get('nodes', {}).values() if n.get('owner') == 'player'),
            'neutral_nodes_count': sum(1 for n in state.get('nodes', {}).values() if n.get('owner') == 'neutral'),
            'programs_count': sum(1 for n in state.get('nodes', {}).values() if n.get('program')),
            'hub_capture_progress': state.get('hubCaptureProgress', 0),
            'emp_cooldown': state.get('empCooldown', 0)
        }
    
    def get_session_summary(self) -> Dict[str, Any]:
        """Получает сводку по сессии"""
        episodes = []
        with open(self.episode_log, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['session_id'] == self.session_id:
                    episodes.append(row)
        
        if not episodes:
            return {}
        
        # Статистика
        total_episodes = len(episodes)
        wins = sum(1 for e in episodes if e['win'] == 'True')
        win_rate = wins / total_episodes if total_episodes > 0 else 0
        
        avg_score = np.mean([float(e['final_score']) for e in episodes])
        avg_steps = np.mean([int(e['duration_steps']) for e in episodes])
        avg_trace = np.mean([float(e.get('trace_level', 0)) for e in episodes])
        
        return {
            'session_id': self.session_id,
            'total_episodes': total_episodes,
            'wins': wins,
            'win_rate': win_rate,
            'avg_score': avg_score,
            'avg_steps': avg_steps,
            'avg_trace_level': avg_trace,
            'episodes': episodes
        }

class EnhancedNetworkEchoEnv:
    """Улучшенное окружение с детальным логированием"""
    
    def __init__(self, config=None, logger=None):
        self.config = config or {}
        self.logger = logger or GameLogger()
        self.episode_id = 0
        self.step_count = 0
        self.episode_data = {
            'actions_taken': [],
            'resources_gained': 0,
            'nodes_captured': 0,
            'programs_built': 0,
            'enemies_killed': 0,
            'map_data': None
        }
        
        # Импортируем упрощенный симулятор
        from simple_game_simulator import initGame, step, getPossibleActions
        
        self.game_engine = {
            'initGame': initGame,
            'step': step,
            'getPossibleActions': getPossibleActions
        }
        
        self.state = None
        self.reset()
    
    def reset(self):
        """Сброс окружения с логированием карты"""
        self.episode_id += 1
        self.step_count = 0
        
        # Инициализируем игру
        result = self.game_engine['initGame'](self.config)
        if result:
            self.state = result
        else:
            # Fallback: создаем простое состояние
            self.state = {
                'nodes': {},
                'dp': 100,
                'cpu': 50,
                'traceLevel': 0,
                'enemies': [],
                'hubLevel': 1
            }
        
        # Логируем данные карты
        map_data = {
            'nodes': self.state.get('nodes', {}),
            'config': self.config,
            'initial_resources': {
                'dp': self.state.get('dp', 0),
                'cpu': self.state.get('cpu', 0)
            }
        }
        self.logger.log_map_data(self.episode_id, map_data)
        
        # Сбрасываем данные эпизода
        self.episode_data = {
            'actions_taken': [],
            'resources_gained': 0,
            'nodes_captured': 0,
            'programs_built': 0,
            'enemies_killed': 0,
            'map_data': map_data
        }
        
        return self._get_observation()
    
    def step(self, action_idx):
        """Выполнение действия с детальным логированием"""
        state_before = self.state.copy()
        
        # Получаем возможные действия
        possible_actions_result = self.game_engine['getPossibleActions'](self.state)
        possible_actions = possible_actions_result.get('actions', [{'action': 'wait'}]) if possible_actions_result else [{'action': 'wait'}]
        
        # Выбираем действие
        if action_idx < len(possible_actions):
            action = possible_actions[action_idx]
        else:
            action = {'action': 'wait'}
        
        # Выполняем действие
        result = self.game_engine['step'](self.state, action)
        if result:
            self.state = result.get('newState', self.state)
            reward = result.get('reward', 0)
            done = result.get('done', False)
        else:
            # Fallback при ошибке
            reward = 0
            done = False
        
        # Логируем действие
        self.logger.log_action(
            self.episode_id, 
            self.step_count, 
            action, 
            state_before, 
            self.state, 
            reward, 
            done
        )
        
        # Логируем баланс
        self.logger.log_balance_step(self.episode_id, self.step_count, self.state)
        
        # Обновляем статистику эпизода
        self._update_episode_stats(action, result or {})
        
        self.step_count += 1
        
        # Проверяем завершение эпизода
        if done:
            self._log_episode_end(result or {})
        
        return self._get_observation(), reward, done, result.get('info', {}) if result else {}
    
    def _get_observation(self):
        """Получает наблюдение из состояния"""
        # Упрощенное наблюдение для тестирования
        obs = []
        
        # Базовые ресурсы
        obs.extend([
            self.state.get('dp', 0) / 1000.0,
            self.state.get('cpu', 0) / 200.0,
            self.state.get('traceLevel', 0) / 300.0,
            len(self.state.get('enemies', [])) / 10.0
        ])
        
        # Состояние узлов (упрощенно)
        nodes = self.state.get('nodes', {})
        for i in range(25):  # Максимум 25 узлов
            node_id = f'node{i}' if i > 0 else 'hub'
            node = nodes.get(node_id, {})
            
            # Безопасное получение данных узла
            owner = node.get('owner', 'neutral')
            program = node.get('program')
            program_level = 0
            if program and isinstance(program, dict):
                program_level = program.get('level', 0)
            
            obs.extend([
                1.0 if owner == 'player' else 0.0,
                1.0 if program else 0.0,
                program_level / 10.0
            ])
        
        # Дополняем до нужной длины
        obs.extend([0.0] * (439 - len(obs)))
        
        return np.array(obs, dtype=np.float32)
    
    def _update_episode_stats(self, action, result):
        """Обновляет статистику эпизода"""
        self.episode_data['actions_taken'].append(action)
        
        # Анализируем события
        for event in result.get('logEvents', []):
            if event.get('type') == 'capture_complete':
                self.episode_data['nodes_captured'] += 1
            elif event.get('type') == 'build':
                self.episode_data['programs_built'] += 1
            elif event.get('type') == 'enemy_killed':
                self.episode_data['enemies_killed'] += 1
    
    def _log_episode_end(self, result):
        """Логирует завершение эпизода"""
        episode_summary = {
            'duration_steps': self.step_count,
            'final_score': result.get('reward', 0),
            'win': result.get('done', False) and result.get('reward', 0) > 0,
            'win_reason': '',
            'lose_reason': '',
            'trace_level': self.state.get('traceLevel', 0),
            'hub_level': self.state.get('hubLevel', 1),
            'final_dp': self.state.get('dp', 0),
            'final_cpu': self.state.get('cpu', 0),
            'total_enemies_killed': self.episode_data['enemies_killed'],
            'total_enemies_spawned': len([e for e in result.get('logEvents', []) if e.get('type') == 'enemy_spawn']),
            'nodes_captured': self.episode_data['nodes_captured'],
            'nodes_lost': len([e for e in result.get('logEvents', []) if e.get('type') == 'node_lost']),
            'programs_built': self.episode_data['programs_built'],
            'programs_upgraded': len([e for e in result.get('logEvents', []) if e.get('type') == 'upgrade']),
            'hub_upgrades': len([e for e in result.get('logEvents', []) if e.get('type') == 'upgrade_hub']),
            'emp_blasts_used': len([e for e in result.get('logEvents', []) if e.get('type') == 'emp_blast']),
            'network_capture_attempted': len([e for e in result.get('logEvents', []) if e.get('type') == 'network_capture_start']) > 0,
            'map_seed': str(hash(str(self.episode_data['map_data']))),
            'difficulty_stage': self.config.get('stage', 0),
            'mode': self.config.get('mode', 'full')
        }
        
        # Определяем причину победы/поражения
        if episode_summary['win']:
            episode_summary['win_reason'] = 'network_capture' if episode_summary['network_capture_attempted'] else 'victory'
        else:
            if episode_summary['trace_level'] >= 300:
                episode_summary['lose_reason'] = 'trace_limit'
            elif self.state.get('nodes', {}).get('hub', {}).get('owner') != 'player':
                episode_summary['lose_reason'] = 'hub_lost'
            else:
                episode_summary['lose_reason'] = 'unknown'
        
        self.logger.log_episode_end(self.episode_id, episode_summary)
    
    def close(self):
        """Закрытие окружения"""
        if self.logger:
            self.logger.get_session_summary()

# Тестирование системы логирования
if __name__ == "__main__":
    print("🧪 Тестирование системы логирования...")
    
    # Создаем логгер
    logger = GameLogger()
    
    # Создаем окружение
    env = EnhancedNetworkEchoEnv(config={'mode': 'full', 'stage': 0}, logger=logger)
    
    # Тестируем несколько эпизодов
    for episode in range(3):
        print(f"\n🎮 Эпизод {episode + 1}")
        
        obs = env.reset()
        done = False
        step = 0
        
        while not done and step < 100:  # Ограничиваем шаги для теста
            # Случайное действие
            action = np.random.randint(0, 100)
            obs, reward, done, info = env.step(action)
            step += 1
            
            if step % 20 == 0:
                print(f"  Шаг {step}: DP={env.state.get('dp', 0)}, CPU={env.state.get('cpu', 0)}, Trace={env.state.get('traceLevel', 0)}")
        
        print(f"  Эпизод завершен: {step} шагов, награда: {reward}")
    
    env.close()
    
    # Получаем сводку
    summary = logger.get_session_summary()
    print(f"\n📊 Сводка сессии:")
    print(f"  Эпизодов: {summary.get('total_episodes', 0)}")
    print(f"  Побед: {summary.get('wins', 0)}")
    print(f"  Процент побед: {summary.get('win_rate', 0):.2%}")
    print(f"  Средняя награда: {summary.get('avg_score', 0):.2f}")
    
    print(f"\n✅ Логи сохранены в папке 'logs'")
    print(f"  - Эпизоды: {logger.episode_log}")
    print(f"  - Действия: {logger.action_log}")
    print(f"  - Карты: {logger.map_log}")
    print(f"  - Баланс: {logger.balance_log}") 