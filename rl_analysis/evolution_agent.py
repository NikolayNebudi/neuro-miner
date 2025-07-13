#!/usr/bin/env python3
"""
Эволюционный агент для обучения игре Network Echo
Использует генетические алгоритмы для оптимизации стратегии
"""

import json
import subprocess
import numpy as np
import random
from typing import Dict, List, Tuple, Any, Optional
import time
import pickle
import os

class GameState:
    """Класс для работы с состоянием игры"""
    def __init__(self, state_data: Dict):
        self.nodes = state_data.get('nodes', {})
        self.stats = state_data.get('stats', {})
        self.enemies = state_data.get('enemies', [])
        self.win = state_data.get('win', False)
        self.done = state_data.get('done', False)
    
    def get_player_nodes(self) -> List[str]:
        """Получить список нод игрока"""
        return [node_id for node_id, node in self.nodes.items() 
                if node.get('owner') == 'player']
    
    def get_neutral_nodes(self) -> List[str]:
        """Получить список нейтральных нод"""
        return [node_id for node_id, node in self.nodes.items() 
                if node.get('owner') == 'neutral']
    
    def get_capturable_nodes(self) -> List[str]:
        """Получить список нод, которые можно захватить"""
        capturable = []
        for node_id, node in self.nodes.items():
            if node.get('owner') == 'neutral':
                # Проверяем, есть ли сосед-союзник
                has_player_neighbor = any(
                    self.nodes.get(neighbor_id, {}).get('owner') == 'player'
                    for neighbor_id in node.get('neighbors', [])
                )
                if has_player_neighbor:
                    capturable.append(node_id)
        return capturable
    
    def get_buildable_nodes(self) -> List[str]:
        """Получить ноды, где можно строить программы"""
        return [node_id for node_id, node in self.nodes.items() 
                if (node.get('owner') == 'player' and 
                    not node.get('program'))]
    
    def get_upgradable_nodes(self) -> List[str]:
        """Получить ноды, которые можно апгрейдить"""
        return [node_id for node_id, node in self.nodes.items() 
                if (node.get('owner') == 'player' and 
                    node.get('program'))]

class EvolutionAgent:
    """Эволюционный агент для игры с продвинутой стратегической логикой"""
    
    def __init__(self, genome_size: int = 60):  # Увеличиваем размер генома для новых параметров
        self.genome_size = genome_size
        self.genome = self._create_random_genome()
        self.fitness = 0.0
        self.games_played = 0
        self.total_score = 0.0
    
    def _create_random_genome(self) -> np.ndarray:
        """Создать случайный геном с новыми стратегическими параметрами"""
        return np.random.uniform(-1, 1, self.genome_size)
    
    def mutate(self, mutation_rate: float = 0.1, mutation_strength: float = 0.2):
        """Мутация генома"""
        for i in range(len(self.genome)):
            if random.random() < mutation_rate:
                self.genome[i] += np.random.normal(0, mutation_strength)
                self.genome[i] = np.clip(self.genome[i], -1, 1)
    
    def crossover(self, other: 'EvolutionAgent') -> 'EvolutionAgent':
        """Скрещивание с другим агентом"""
        child = EvolutionAgent(self.genome_size)
        for i in range(len(self.genome)):
            if random.random() < 0.5:
                child.genome[i] = self.genome[i]
            else:
                child.genome[i] = other.genome[i]
        return child
    
    def determine_strategy_mode(self, game_state: GameState) -> str:
        """Определить текущий режим стратегии на основе traceLevel и генома"""
        trace_level = game_state.stats.get('traceLevel', 0)
        
        # Параметры генома для определения порогов стратегий
        defensive_threshold = 80 + (self.genome[50] * 20)  # 60-100
        cautious_threshold = 40 + (self.genome[51] * 20)   # 20-60
        
        if trace_level >= defensive_threshold:
            return 'DEFENSIVE'
        elif trace_level >= cautious_threshold:
            return 'CAUTIOUS'
        else:
            return 'SAFE'
    
    def get_action_weights(self, game_state: GameState, capture_web_active: bool = False) -> Dict[str, float]:
        """Получить веса для различных действий на основе генома и состояния игры"""
        weights = {}
        
        # Базовые веса из генома (первые 20 параметров)
        base_weights = {
            'build_miner': self.genome[0],
            'build_sentry': self.genome[1], 
            'build_shield': self.genome[2],
            'build_overclocker': self.genome[3],
            'upgrade': self.genome[4],
            'capture': self.genome[5],
            'upgrade_hub': self.genome[6],
            'emp_blast': self.genome[7],
            'network_capture': self.genome[8],
            'wait': self.genome[9],
            'capture_web': self.genome[10]
        }
        
        # Новые стратегические параметры (21-40)
        strategic_params = {
            'miner_ratio_target': 0.2 + (self.genome[20] * 0.3),  # 0.1-0.5
            'defense_priority': 1.0 + (self.genome[21] * 2.0),     # 0.0-3.0
            'economy_priority': 1.0 + (self.genome[22] * 2.0),     # 0.0-3.0
            'capture_priority': 1.0 + (self.genome[23] * 2.0),     # 0.0-3.0
            'win_priority': 1.0 + (self.genome[24] * 3.0),         # 0.0-4.0
        }
        
        # Параметры режимов стратегии (41-50)
        mode_params = {
            'defensive_network_capture_boost': 2.0 + (self.genome[40] * 3.0),  # 1.0-5.0
            'defensive_defense_boost': 2.0 + (self.genome[41] * 3.0),          # 1.0-5.0
            'cautious_capture_limit': 0.5 + (self.genome[42] * 0.5),           # 0.0-1.0
            'safe_expansion_boost': 1.5 + (self.genome[43] * 2.0),             # 0.5-3.5
        }
        
        # Модификаторы на основе состояния игры
        stats = game_state.stats
        dp = stats.get('dp', 0)
        cpu = stats.get('cpu', 0)
        trace_level = stats.get('traceLevel', 0)
        enemies_count = stats.get('enemies', 0)
        player_nodes = len(game_state.get_player_nodes())
        capturable_nodes = len(game_state.get_capturable_nodes())
        buildable_nodes = len(game_state.get_buildable_nodes())
        
        # Определяем режим стратегии
        strategy_mode = self.determine_strategy_mode(game_state)
        
        # Гарантируем, что game_state и strategic_params не None
        safe_game_state = game_state if game_state is not None else GameState({})
        safe_strategic_params = strategic_params if strategic_params is not None else {}
        safe_mode_params = mode_params if mode_params is not None else {}
        modifiers = {
            'build_miner': self._calculate_build_weight('miner', dp, cpu, trace_level, buildable_nodes, 0, safe_game_state, safe_strategic_params),
            'build_sentry': self._calculate_build_weight('sentry', dp, cpu, trace_level, buildable_nodes, enemies_count, safe_game_state, safe_strategic_params),
            'build_shield': self._calculate_build_weight('shield', dp, cpu, trace_level, buildable_nodes, enemies_count, safe_game_state, safe_strategic_params),
            'build_overclocker': self._calculate_build_weight('overclocker', dp, cpu, trace_level, buildable_nodes, 0, safe_game_state, safe_strategic_params),
            'upgrade': self._calculate_upgrade_weight(dp, cpu, player_nodes, safe_strategic_params),
            'capture': self._calculate_capture_weight(dp, capturable_nodes, player_nodes, safe_game_state, safe_strategic_params, strategy_mode, safe_mode_params),
            'upgrade_hub': self._calculate_hub_upgrade_weight(cpu, trace_level, safe_game_state, safe_strategic_params),
            'emp_blast': self._calculate_emp_weight(cpu, enemies_count, safe_strategic_params, strategy_mode, safe_mode_params),
            'network_capture': self._calculate_network_capture_weight(dp, trace_level, safe_strategic_params, strategy_mode, safe_mode_params),
            'wait': self._calculate_wait_weight(trace_level, enemies_count, strategy_mode),
            'capture_web': self._calculate_capture_web_weight(safe_game_state, safe_strategic_params)
        }
        
        # Комбинируем базовые веса с модификаторами
        for action in base_weights:
            weights[action] = base_weights[action] * modifiers[action]
        
        # Специальная обработка для capture_web
        if capture_web_active:
            weights['capture_web'] = weights.get('capture_web', 0) * 10.0  # Критический приоритет
            weights['network_capture'] = 0.01  # Игнорируем trace во время capture_web
            weights['emp_blast'] = 0.01
        
        return weights
    
    def select_actions(self, game_state: GameState, available_actions: List[Dict[str, Any]], capture_web_active: bool = False) -> List[Dict[str, Any]]:
        """
        ФАЗИРОВАННЫЙ GAME PLAN: Выбор действий на основе текущей фазы игры.
        Преодолевает патологическую осторожность через принудительные переходы стратегий.
        """
        # === ОПРЕДЕЛЕНИЕ ФАЗЫ ИГРЫ ===
        player_nodes_count = len(game_state.get_player_nodes())
        total_nodes_count = len(game_state.nodes)
        miner_count = len([n for n in game_state.nodes.values() 
                          if n.get('owner') == 'player' and n.get('program') == 'miner'])
        
        # Новые гены для фазированной логики
        EARLY_GAME_MINER_TARGET = max(2, int(3 + (self.genome[52] * 3)))  # 2-6 майнеров
        LATE_GAME_CAPTURE_PERCENTAGE = 55.0 + (self.genome[53] * 5.0)  # 50-60%
        MID_GAME_TRACE_CEILING = 70.0 + (self.genome[54] * 30.0)  # 70-100%
        
        # Определение текущей фазы
        capture_percentage = (player_nodes_count / total_nodes_count) * 100 if total_nodes_count > 0 else 0
        game_phase = 'EARLY_GAME'
        
        if capture_percentage >= LATE_GAME_CAPTURE_PERCENTAGE:
            game_phase = 'LATE_GAME'
        elif miner_count >= EARLY_GAME_MINER_TARGET:
            game_phase = 'MID_GAME'
        
        print(f"🎯 ФАЗА: {game_phase} | Майнеры: {miner_count}/{EARLY_GAME_MINER_TARGET} | Захват: {capture_percentage:.1f}%/{LATE_GAME_CAPTURE_PERCENTAGE:.1f}%")
        
        # === ПРИНУДИТЕЛЬНАЯ ЛОГИКА ПО ФАЗАМ ===
        actions_to_perform = []
        current_dp = game_state.stats.get('dp', 0)
        current_cpu = game_state.stats.get('cpu', 0)
        trace_level = game_state.stats.get('traceLevel', 0)
        
        # LATE_GAME: Критический приоритет capture_web
        if game_phase == 'LATE_GAME':
            capture_web_actions = [a for a in available_actions if a['action'] == 'capture_web']
            if capture_web_actions:
                print(f"🚨 LATE_GAME: ПРИНУДИТЕЛЬНЫЙ CAPTURE_WEB!")
                return capture_web_actions[:1]
            
            # LATE_GAME: Агрессивный захват для достижения 60%
            capture_actions = [a for a in available_actions if a['action'] == 'capture']
            if capture_actions and current_dp >= 5:
                best_capture = self._score_capture_actions(capture_actions, game_state)
                if best_capture:
                    print(f"🚨 LATE_GAME: ПРИНУДИТЕЛЬНЫЙ ЗАХВАТ {best_capture.get('targetNodeId')}")
                    return [best_capture]
        
        # EARLY_GAME: Приоритет экономики и майнеров
        elif game_phase == 'EARLY_GAME':
            # Принудительное строительство майнеров
            if miner_count < EARLY_GAME_MINER_TARGET:
                miner_actions = [a for a in available_actions if a['action'] == 'build_miner' and current_dp >= 20]
                if miner_actions:
                    best_miner = self._score_build_actions(miner_actions, game_state, 'miner')
                    if best_miner:
                        print(f"🚨 EARLY_GAME: ПРИНУДИТЕЛЬНОЕ СТРОИТЕЛЬСТВО МАЙНЕРА")
                        return [best_miner]
            
            # EARLY_GAME: Только ценные захваты (cpu_node, data_cache)
            capture_actions = [a for a in available_actions if a['action'] == 'capture' and current_dp >= 5]
            if capture_actions:
                valuable_captures = [a for a in capture_actions 
                                   if self._is_valuable_node(a.get('targetNodeId'), game_state)]
                if valuable_captures:
                    best_capture = self._score_capture_actions(valuable_captures, game_state)
                    if best_capture:
                        print(f"🚨 EARLY_GAME: ЗАХВАТ ЦЕННОЙ НОДЫ {best_capture.get('targetNodeId')}")
                        return [best_capture]
        
        # MID_GAME: Агрессивное расширение
        elif game_phase == 'MID_GAME':
            # MID_GAME: Принудительный захват (если trace не критический)
            if trace_level < MID_GAME_TRACE_CEILING:
                capture_actions = [a for a in available_actions if a['action'] == 'capture' and current_dp >= 5]
                if capture_actions:
                    best_capture = self._score_capture_actions(capture_actions, game_state)
                    if best_capture:
                        print(f"🚨 MID_GAME: АГРЕССИВНЫЙ ЗАХВАТ {best_capture.get('targetNodeId')}")
                        return [best_capture]
            
            # MID_GAME: Управление trace
            elif trace_level >= MID_GAME_TRACE_CEILING:
                network_capture_actions = [a for a in available_actions if a['action'] == 'network_capture' and current_dp >= 5]
                if network_capture_actions:
                    print(f"🚨 MID_GAME: СНИЖЕНИЕ TRACE")
                    return [network_capture_actions[0]]
        
        # === FALLBACK: ЭВОЛЮЦИОННАЯ ЛОГИКА ===
        # Если принудительная логика не сработала, используем эволюционную
        weights = self.get_action_weights(game_state, capture_web_active)
        
        # Категории действий по приоритету
        categories = [
            ('Win', ['capture_web']),
            ('Strategic', ['network_capture', 'emp_blast']),
            ('Defense', ['build_sentry', 'build_shield']),
            ('Economy', ['build_miner', 'build_overclocker']),
            ('Capture', ['capture']),
            ('Upgrade', ['upgrade', 'upgrade_hub'])
        ]
        
        targeted_nodes = set()
        for cat_name, action_types in categories:
            for action_type in action_types:
                filtered = [a for a in available_actions if a['action'] == action_type and a.get('targetNodeId') not in targeted_nodes]
                if filtered:
                    # Сортируем по весу
                    filtered.sort(key=lambda a: -weights.get(action_type, 0))
                    for act in filtered:
                        cost_dp = act.get('cost', {}).get('dp', 0)
                        cost_cpu = act.get('cost', {}).get('cpu', 0)
                        if current_dp >= cost_dp and current_cpu >= cost_cpu:
                            actions_to_perform.append(act)
                            if 'targetNodeId' in act:
                                targeted_nodes.add(act['targetNodeId'])
                            current_dp -= cost_dp
                            current_cpu -= cost_cpu
                            break
        
        # Если ничего не выбрано, ждем
        if not actions_to_perform:
            wait_action = next((a for a in available_actions if a['action'] == 'wait'), None)
            if wait_action:
                actions_to_perform.append(wait_action)
        
        return actions_to_perform
    
    def _score_capture_actions(self, capture_actions: List[Dict], game_state: GameState) -> Optional[Dict]:
        """Оценить захватываемые ноды и выбрать лучшую для равномерного развития сети"""
        if not capture_actions:
            return None
        
        best_action = None
        best_score = -1
        
        for action in capture_actions:
            target_node_id = action.get('targetNodeId')
            if not target_node_id:
                continue
            
            node = game_state.nodes.get(target_node_id, {})
            score = 0
            
            # Базовый вес из генома
            score += self.genome[5] * 10  # capture_priority
            
            # === НОВАЯ ЛОГИКА: Оценка для равномерного развития сети ===
            
            # 1. Расстояние от hub (чем ближе, тем лучше для равномерного развития)
            distance_from_hub = self._calculate_distance_from_hub(target_node_id, game_state.nodes)
            if distance_from_hub <= 1:
                score += 60  # Соседние с hub ноды - максимальный приоритет
            elif distance_from_hub == 2:
                score += 35  # Ноды в 2 шагах
            elif distance_from_hub == 3:
                score += 20  # Ноды в 3 шагах
            else:
                score += 5   # Дальние ноды - низкий приоритет
            
            # 2. Бонус за связность (захват нод, которые соединяют сеть)
            neighbors = node.get('neighbors', [])
            player_neighbors = sum(1 for n in neighbors 
                               if game_state.nodes.get(n, {}).get('owner') == 'player')
            score += player_neighbors * 30  # Увеличенный бонус за соседние ноды игрока
            
            # 3. Потенциал расширения (сколько новых нод можно захватить)
            neutral_neighbors = sum(1 for n in neighbors 
                                 if game_state.nodes.get(n, {}).get('owner') == 'neutral')
            score += neutral_neighbors * 15
            
            # 4. Бонус за заполнение "дыр" в сети
            if player_neighbors >= 2:
                score += 40  # Большой бонус за ноды, которые заполняют пробелы
            
            # 5. Штраф за создание "островков"
            if player_neighbors == 0:
                score -= 80  # Большой штраф за ноды без соседей-игроков
            
            # 6. Тип ноды (вторичный приоритет)
            node_type = node.get('type', 'unknown')
            if node_type == 'cpu_node':
                score += 25  # CPU ноды важны для overclocker
            elif node_type == 'data_cache':
                score += 15  # Data cache ноды полезны
            elif node_type == 'hub':
                score += 100  # Критично
            elif node_type == 'router':
                score += 10  # Полезно
            
            # 7. Сопротивление ноды
            resistance = node.get('resistance', 50)
            score -= resistance * 0.2  # Небольшой штраф за сопротивление
            
            if score > best_score:
                best_score = score
                best_action = action
        
        return best_action
    
    def _score_build_actions(self, build_actions: List[Dict], game_state: GameState, program_type: str) -> Optional[Dict]:
        """Оценить места для строительства и выбрать лучшее"""
        if not build_actions:
            return None
        
        best_action = None
        best_score = -1
        
        for action in build_actions:
            target_node_id = action.get('targetNodeId')
            if not target_node_id:
                continue
            
            node = game_state.nodes.get(target_node_id, {})
            score = 0
            
            # Базовый вес из генома
            if program_type == 'miner':
                score += self.genome[0] * 10  # build_miner_priority
            elif program_type == 'sentry':
                score += self.genome[1] * 10  # build_sentry_priority
            
            # Количество соседей-врагов (для sentry)
            if program_type == 'sentry':
                neighbors = node.get('neighbors', [])
                enemy_neighbors = sum(1 for n in neighbors 
                                   if game_state.nodes.get(n, {}).get('owner') == 'enemy')
                score += enemy_neighbors * 20
            
            # Центральность ноды (больше соседей = лучше)
            neighbors = node.get('neighbors', [])
            score += len(neighbors) * 5
            
            # Защищенность (есть ли соседи-союзники)
            ally_neighbors = sum(1 for n in neighbors 
                               if game_state.nodes.get(n, {}).get('owner') == 'player')
            score += ally_neighbors * 10
            
            if score > best_score:
                best_score = score
                best_action = action
        
        return best_action
    
    def _is_valuable_node(self, node_id: Optional[str], game_state: GameState) -> bool:
        """Проверить, является ли нода ценной для ранней игры"""
        if not node_id:
            return False
        
        node = game_state.nodes.get(node_id, {})
        node_type = node.get('type', 'unknown')
        
        # Ценные ноды для ранней игры
        valuable_types = ['cpu_node', 'data_cache', 'hub']
        return node_type in valuable_types
    
    def _find_path_to_node(self, target_node: str, start_node: str, game_state: GameState) -> List[str]:
        """Найти путь от start_node до target_node (упрощенный BFS)"""
        if start_node == target_node:
            return []
        
        visited = set()
        queue = [(start_node, [start_node])]
        
        while queue:
            current, path = queue.pop(0)
            if current in visited:
                continue
            
            visited.add(current)
            current_node = game_state.nodes.get(current, {})
            neighbors = current_node.get('neighbors', [])
            
            for neighbor in neighbors:
                if neighbor == target_node:
                    return path + [neighbor]
                if neighbor not in visited:
                    queue.append((neighbor, path + [neighbor]))
        
        return []  # Путь не найден
    
    def _calculate_distance_from_hub(self, node_id: str, nodes: dict) -> int:
        """Вычисляет расстояние от hub до ноды"""
        if node_id == 'hub':
            return 0
        
        # Простой BFS для поиска кратчайшего пути
        visited = set()
        queue = [('hub', 0)]
        
        while queue:
            current_node, distance = queue.pop(0)
            
            if current_node == node_id:
                return distance
            
            if current_node in visited:
                continue
                
            visited.add(current_node)
            current_node_data = nodes.get(current_node, {})
            neighbors = current_node_data.get('neighbors', [])
            
            for neighbor in neighbors:
                if neighbor not in visited:
                    queue.append((neighbor, distance + 1))
        
        return 999  # Недостижимая нода
    
    def _calculate_build_weight(self, program_type: str, dp: int, cpu: int, 
                               trace_level: float, buildable_nodes: int, 
                               enemies_count: int = 0, game_state: Optional[GameState] = None, 
                               strategic_params: Optional[Dict] = None) -> float:
        """Рассчитать вес для строительства программы с учетом стратегических параметров"""
        costs = {'miner': 20, 'sentry': 40, 'shield': 30, 'overclocker': 50}
        cost = costs[program_type]
        
        if dp < cost or buildable_nodes == 0:
            return 0.1
        
        # Базовый вес
        weight = 1.0
        
        # Модификаторы на основе ресурсов
        if dp > cost * 4:
            weight *= 1.8  # Много ресурсов - строим активнее
        elif dp > cost * 2:
            weight *= 1.4  # Достаточно ресурсов - строим
        elif dp < cost * 1.5:
            weight *= 0.6  # Мало ресурсов - строим осторожно
        
        # Стратегические модификаторы
        if strategic_params:
            if program_type == 'miner':
                # Проверяем целевое соотношение майнеров
                if game_state:
                    num_miners = len([n for n in game_state.get_player_nodes() 
                                    if game_state.nodes[n].get('program') == 'miner'])
                    player_nodes = len(game_state.get_player_nodes())
                    if player_nodes > 0:
                        current_ratio = num_miners / player_nodes
                        target_ratio = strategic_params.get('miner_ratio_target', 0.2)
                        if current_ratio < target_ratio:
                            weight *= strategic_params.get('economy_priority', 1.0) * 2.0
                        else:
                            weight *= 0.5  # Уже достаточно майнеров
            
            elif program_type in ['sentry', 'shield']:
                weight *= strategic_params.get('defense_priority', 1.0)
        
        # Модификаторы на основе типа программы и стратегической ситуации
        if program_type == 'sentry':
            if game_state:
                total_nodes = game_state.stats.get('totalNodes', 1)
                player_nodes = len(game_state.get_player_nodes())
                capture_percentage = (player_nodes / total_nodes) * 100
                
                # Sentry'и теперь источник DP - всегда приоритетны
                weight *= 2.5  # Базовый высокий приоритет для sentry'ев
                
                if capture_percentage >= 50:
                    weight *= 4.0  # Критический приоритет защите при приближении к 60%
                elif enemies_count > 4:
                    weight *= 3.5  # Много врагов - активно строим защиту
                elif enemies_count > 2:
                    weight *= 3.0  # Есть враги - строим защиту
                elif enemies_count == 0:
                    weight *= 1.5  # Даже без врагов строим sentry'и для DP
        
        # Специальная логика для overclocker'ов с учетом новых механик
        elif program_type == 'overclocker':
            # Проверяем, есть ли CPU ноды для строительства
            cpu_nodes_available = 0
            for node_id, node in game_state.nodes.items():
                if node.get('owner') == 'player' and node.get('type') == 'cpu_node' and not node.get('program'):
                    cpu_nodes_available += 1
            
            if cpu_nodes_available == 0:
                return 0.1  # Нет доступных CPU нод
            
            # Критически важны для новых механик - замедляют рост trace
            weight *= 3.0  # Увеличиваем базовый вес
            
            # Модификаторы по trace level (новый порог 400)
            if trace_level > 250:
                weight *= 4.0  # Критически высокий trace - срочно нужны overclocker'ы
            elif trace_level > 150:
                weight *= 3.0  # Очень высокий trace - нужны overclocker'ы
            elif trace_level > 100:
                weight *= 2.0  # Высокий trace - полезны overclocker'ы
            elif trace_level > 50:
                weight *= 1.5  # Средний trace - строим overclocker'ы
            elif trace_level < 20:
                weight *= 0.3  # Низкий trace - overclocker'ы не нужны
            
            # Бонус за стратегическое планирование
            if trace_level > 100:  # Если trace растет, overclocker'ы критически важны
                weight *= 2.0
        
        return weight
    
    def _calculate_upgrade_weight(self, dp: int, cpu: int, player_nodes: int, strategic_params: Optional[Dict] = None) -> float:
        """Рассчитать вес для апгрейда с учетом стратегических параметров"""
        if dp < 10 or player_nodes == 0:
            return 0.1
        
        weight = 1.0
        
        # Базовые модификаторы
        if dp > 50:
            weight *= 1.5  # Много ресурсов - апгрейдим активнее
        elif dp < 20:
            weight *= 0.7  # Мало ресурсов - апгрейдим осторожно
        
        # Стратегические модификаторы
        if strategic_params:
            weight *= strategic_params.get('economy_priority', 1.0)
        
        return weight
    
    def _calculate_capture_weight(self, dp: int, capturable_nodes: int, player_nodes: int, 
                                game_state: GameState, strategic_params: Optional[Dict] = None,
                                strategy_mode: str = 'SAFE', mode_params: Optional[Dict] = None) -> float:
        """Рассчитать вес для захвата с учетом режима стратегии"""
        if capturable_nodes == 0 or dp < 5:
            return 0.1
        
        weight = 1.0
        
        # Базовые модификаторы
        if dp > 30:
            weight *= 1.8  # Много ресурсов - захватываем активнее
        elif dp < 15:
            weight *= 0.6  # Мало ресурсов - захватываем осторожно
        
        # Стратегические модификаторы
        if strategic_params:
            weight *= strategic_params.get('capture_priority', 1.0)
        
        # Модификаторы режима стратегии
        if strategy_mode == 'DEFENSIVE':
            # В защитном режиме НЕ захватываем (увеличивает trace)
            weight *= 0.1
        elif strategy_mode == 'CAUTIOUS':
            # В осторожном режиме ограничиваем захваты
            if mode_params:
                capture_limit = mode_params.get('cautious_capture_limit', 0.5)
                weight *= capture_limit
        elif strategy_mode == 'SAFE':
            # В безопасном режиме активно захватываем
            if mode_params:
                expansion_boost = mode_params.get('safe_expansion_boost', 1.5)
                weight *= expansion_boost
        
        # Бонус за приближение к победе
        if game_state:
            total_nodes = game_state.stats.get('totalNodes', 1)
            player_nodes = len(game_state.get_player_nodes())
            capture_percentage = (player_nodes / total_nodes) * 100
            
            if capture_percentage >= 55:
                weight *= 2.0  # Приближаемся к 60% - активно захватываем
        
        return weight
    
    def _count_cpu_nodes_available(self, game_state: GameState) -> int:
        """Подсчитать количество доступных CPU нод"""
        return len([node_id for node_id, node in game_state.nodes.items() 
                   if node.get('owner') == 'player' and 
                   node.get('program') in ['miner', 'overclocker']])
    
    def _count_cpu_nodes_owned(self, game_state: GameState) -> int:
        """Подсчитать количество CPU нод игрока"""
        return len([node_id for node_id, node in game_state.nodes.items() 
                   if node.get('owner') == 'player' and 
                   node.get('program') in ['miner', 'overclocker']])
    
    def _calculate_hub_upgrade_weight(self, cpu: int, trace_level: float, 
                                    game_state: Optional[GameState] = None, strategic_params: Optional[Dict] = None) -> float:
        """Рассчитать вес для апгрейда hub с учетом стратегических параметров"""
        if cpu < 10:
            return 0.1
        
        weight = 1.0
        
        # Проверяем доступность апгрейда
        if game_state:
            hub_node = None
            for node_id, node in game_state.nodes.items():
                if node.get('owner') == 'player' and node.get('program') == 'hub':
                    hub_node = node
                    break
            
            if not hub_node:
                return 0.1  # Нет hub для апгрейда
        
        # Базовые модификаторы
        if cpu > 20:
            weight *= 1.5  # Много CPU - апгрейдим активнее
        elif cpu < 15:
            weight *= 0.7  # Мало CPU - апгрейдим осторожно
        
        # Стратегические модификаторы
        if strategic_params:
            weight *= strategic_params.get('economy_priority', 1.0)
        
        return weight
    
    def _calculate_emp_weight(self, cpu: int, enemies_count: int, 
                            strategic_params: Optional[Dict] = None, strategy_mode: str = 'SAFE',
                            mode_params: Optional[Dict] = None) -> float:
        """Рассчитать вес для EMP с учетом режима стратегии"""
        if cpu < 5 or enemies_count == 0:
            return 0.1
        
        weight = 1.0
        
        # Базовые модификаторы
        if cpu > 15:
            weight *= 1.8  # Много CPU - используем EMP активнее
        elif cpu < 10:
            weight *= 0.6  # Мало CPU - используем EMP осторожно
        
        # Модификаторы по количеству врагов
        if enemies_count > 6:
            weight *= 2.5  # Много врагов - активно используем EMP
        elif enemies_count > 3:
            weight *= 1.8  # Есть враги - используем EMP
        elif enemies_count == 0:
            weight *= 0.3  # Нет врагов - не используем EMP
        
        # Модификаторы режима стратегии
        if strategy_mode == 'DEFENSIVE':
            # В защитном режиме активно используем EMP для снижения trace
            if mode_params:
                emp_boost = mode_params.get('defensive_network_capture_boost', 2.0)
                weight *= emp_boost
        
        return weight
    
    def _calculate_network_capture_weight(self, dp: int, trace_level: float,
                                        strategic_params: Optional[Dict] = None, strategy_mode: str = 'SAFE',
                                        mode_params: Optional[Dict] = None) -> float:
        """Рассчитать вес для network_capture с учетом новых механик"""
        if dp < 15:
            return 0.1  # Снижаем минимальный порог DP (sentry'и дают DP)
        
        weight = 3.0  # Увеличиваем базовый вес (network capture = единственный способ победы)
        
        # Базовые модификаторы
        if dp > 30:
            weight *= 3.0  # Много DP - активно используем network_capture
        elif dp < 20:
            weight *= 1.5  # Мало DP - используем network_capture осторожно
        
        # Модификаторы по trace_level (новый порог 400)
        if trace_level > 300:
            weight *= 6.0  # Критически высокий trace - очень активно снижаем
        elif trace_level > 200:
            weight *= 4.0  # Очень высокий trace - активно снижаем
        elif trace_level > 100:
            weight *= 2.5  # Высокий trace - снижаем
        elif trace_level > 50:
            weight *= 2.0  # Средний trace - снижаем
        elif trace_level < 20:
            weight *= 0.5  # Низкий trace - умеренно снижаем
        
        # Бонус за возможность победы через network capture
        if trace_level < 100:  # При низком trace network capture может привести к победе
            weight *= 4.0
        
        # Модификаторы режима стратегии
        if strategy_mode == 'DEFENSIVE':
            # В защитном режиме активно используем network_capture
            if mode_params:
                network_boost = mode_params.get('defensive_network_capture_boost', 3.0)
                weight *= network_boost
        elif strategy_mode == 'CAUTIOUS':
            # В осторожном режиме умеренно используем network_capture
            weight *= 2.0
        elif strategy_mode == 'SAFE':
            # В безопасном режиме редко используем network_capture
            weight *= 1.2
        
        return weight
    
    def _calculate_wait_weight(self, trace_level: float, enemies_count: int, strategy_mode: str = 'SAFE') -> float:
        """Рассчитать вес для ожидания с учетом режима стратегии"""
        weight = 0.1  # Базовый низкий вес для wait
        
        # Модификаторы по trace_level
        if trace_level > 90:
            weight *= 2.0  # Очень высокий trace - больше ждем
        elif trace_level > 70:
            weight *= 1.5  # Высокий trace - ждем
        elif trace_level < 30:
            weight *= 0.3  # Низкий trace - не ждем
        
        # Модификаторы по количеству врагов
        if enemies_count > 8:
            weight *= 1.8  # Много врагов - ждем
        elif enemies_count > 4:
            weight *= 1.3  # Есть враги - немного ждем
        elif enemies_count == 0:
            weight *= 0.5  # Нет врагов - не ждем
        
        # Модификаторы режима стратегии
        if strategy_mode == 'DEFENSIVE':
            weight *= 1.5  # В защитном режиме больше ждем
        elif strategy_mode == 'CAUTIOUS':
            weight *= 1.2  # В осторожном режиме немного ждем
        elif strategy_mode == 'SAFE':
            weight *= 0.8  # В безопасном режиме меньше ждем
        
        return weight
    
    def _calculate_capture_web_weight(self, game_state: GameState, strategic_params: Optional[Dict] = None) -> float:
        """Рассчитать вес для capture_web с учетом стратегических параметров"""
        if not game_state:
            return 0.1
        
        # Проверяем, доступен ли capture_web
        total_nodes = game_state.stats.get('totalNodes', 1)
        player_nodes = len(game_state.get_player_nodes())
        capture_percentage = (player_nodes / total_nodes) * 100
        
        if capture_percentage < 60:
            return 0.1  # Еще не достигли 60%
        
        weight = 1.0
        
        # Стратегические модификаторы
        if strategic_params:
            weight *= strategic_params.get('win_priority', 1.0) * 5.0  # Критический приоритет победе
        
        return weight

class GameEngineProcess:
    """Обёртка для взаимодействия с Node.js-движком через subprocess"""
    def __init__(self, engine_path='game_engine_headless.js'):
        self.process = subprocess.Popen(
            ['node', 'game_engine_headless.js'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=1,
            universal_newlines=True
        )

    def reset(self):
        try:
            self._send({'cmd': 'reset'})
            response = self._read()
            if not response:
                stderr_output = self.process.stderr.read()
                print(f"❌ Пустой ответ от движка! [stderr Node.js]: {stderr_output}")
            return GameState(json.loads(response))
        except Exception as e:
            stderr_output = self.process.stderr.read()
            print(f"❌ Ошибка при сбросе игры: {e}\n[stderr Node.js]: {stderr_output}")
            raise

    def get_actions(self):
        self._send({'cmd': 'get_actions'})
        response = self._read()
        return json.loads(response)['actions']

    def step(self, actions):
        # actions может быть dict (одно действие) или list (мультидействия)
        if isinstance(actions, dict):
            payload = {'cmd': 'step', 'action': actions}
        else:
            payload = {'cmd': 'step', 'actions': actions}
        self._send(payload)
        response = self._read()
        return json.loads(response)

    def close(self):
        self.process.terminate()

    def _send(self, obj):
        self.process.stdin.write(json.dumps(obj) + '\n')
        self.process.stdin.flush()

    def _read(self):
        response = self.process.stdout.readline()
        if not response:
            raise Exception("Пустой ответ от движка игры")
        return response.strip()

class EvolutionTrainer:
    """Тренер для эволюционного обучения"""
    
    def __init__(self, game_engine, population_size: int = 50, genome_size: int = 60):
        self.game_engine = game_engine
        self.population_size = population_size
        self.genome_size = genome_size
        self.population = [EvolutionAgent(genome_size) for _ in range(population_size)]
        self.generation = 0
        self.best_fitness = -1e9
        self.best_agent = None
        
        # Параметры эволюции
        self.mutation_rate = 0.1
        self.mutation_strength = 0.2
        self.elite_size = 5
        self.crossover_rate = 0.8
        
    def train_generation(self, games_per_agent: int = 3) -> Dict[str, float]:
        """Обучить одно поколение"""
        print(f"🎮 Обучение поколения {self.generation + 1}")
        
        # Оценить всех агентов
        for i, agent in enumerate(self.population):
            print(f"  Тестирование агента {i+1}/{len(self.population)}")
            agent.fitness = self._evaluate_agent(agent, games_per_agent)
        
        # Сортировка по фитнесу
        self.population.sort(key=lambda x: x.fitness, reverse=True)
        
        # Обновление лучшего агента
        if self.population[0].fitness > self.best_fitness:
            self.best_fitness = self.population[0].fitness
            self.best_agent = self.population[0]
            print(f"🏆 Новый лучший агент! Фитнес: {self.best_fitness:.2f}")
            self.save_best_agent()
        
        # Статистика поколения
        avg_fitness = np.mean([agent.fitness for agent in self.population])
        max_fitness = self.population[0].fitness
        min_fitness = self.population[-1].fitness
        
        print(f"📊 Поколение {self.generation + 1} завершено:")
        print(f"   Средний фитнес: {avg_fitness:.2f}")
        print(f"   Максимальный фитнес: {max_fitness:.2f}")
        print(f"   Минимальный фитнес: {min_fitness:.2f}")
        
        # Создание нового поколения
        self._create_next_generation()
        self.generation += 1
        
        return {
            'generation': self.generation,
            'avg_fitness': avg_fitness,
            'max_fitness': max_fitness,
            'min_fitness': min_fitness,
            'best_fitness': self.best_fitness
        }
    
    def _evaluate_agent(self, agent: EvolutionAgent, max_steps: int = 1000) -> float:
        """Оценить агента в игре"""
        game_state = self.game_engine.reset()
        total_reward = 0
        steps = 0
        
        # Счетчики для отслеживания поведения
        network_capture_count = 0
        capture_count = 0
        build_count = 0
        hub_capture_attempts = 0
        consecutive_network_captures = 0
        capture_web_attempts = 0
        
        # --- Флаги для capture_web ---
        capture_web_active = False
        capture_web_survive_steps = 0
        
        # Сброс счетчика неудачных захватов
        self._failed_captures = 0
        self._last_capture_target = None
        self._capture_attempts = 0
        
        while steps < max_steps and not game_state.done:
            available_actions = self.game_engine.get_actions()  # теперь список dict
            # --- capture_web: если активирован, только защита и ожидание ---
            if capture_web_active:
                capture_web_survive_steps += 1
                # Только строим sentry/overclocker/shield или ждем
                defense_actions = [a for a in available_actions if a['action'] in ['build_sentry','build_overclocker','build_shield','wait']]
                if defense_actions:
                    action = np.random.choice(defense_actions)
                else:
                    action = {'action': 'wait'}
                print(f"🛡️ Фаза выживания capture_web: {capture_web_survive_steps}/20, действие: {action}")
                if capture_web_survive_steps >= 20:
                    print("✅ Агент выжил 20 секунд после capture_web!")
                # Выполняем действие
                result = self.game_engine.step(action)
                executed = result.get('executed_actions') or result.get('performedActions')
                if not executed or not executed[0]['success']:
                    print(f"❌ ОШИБКА: Действие не выполнено движком! {executed}")
                    total_reward -= 100
                    break
                game_state = GameState(result['newState'])
                total_reward += result['reward']
                steps += 1
                # Если игра закончилась — выходим
                if game_state.done:
                    break
                continue
            # --- обычная логика ---
            actions_to_perform = agent.select_actions(game_state, available_actions, capture_web_active)
            for action in actions_to_perform:
                # Логируем выбранное действие с деталями
                if action.get('action') == 'capture':
                    target_node = action.get('targetNodeId')
                    print(f"🎯 Шаг {steps}: Агент выбрал захват ноды {target_node}")
                    capture_count += 1
                    if target_node == 'hub':
                        hub_capture_attempts += 1
                        total_reward += 50
                elif action.get('action', '').startswith('build'):
                    target_node = action.get('targetNodeId')
                    print(f"🏗️ Шаг {steps}: Агент выбрал строительство на ноде {target_node}")
                    build_count += 1
                    total_reward += 10
                elif action.get('action') == 'upgrade':
                    target_node = action.get('targetNodeId')
                    print(f"⬆️ Шаг {steps}: Агент выбрал апгрейд ноды {target_node}")
                else:
                    print(f"⚡ Шаг {steps}: Агент выбрал действие: {action}")
                    if action.get('action') == 'network_capture':
                        network_capture_count += 1
                        consecutive_network_captures += 1
                        if consecutive_network_captures > 3:
                            total_reward -= 5 * consecutive_network_captures
                    elif action.get('action') == 'capture_web':
                        capture_web_attempts += 1
                        total_reward += 200
                        print(f"�� КРИТИЧЕСКОЕ ДЕЙСТВИЕ: Capture web активирован!")
                        capture_web_active = True
                        capture_web_survive_steps = 0
                    else:
                        consecutive_network_captures = 0
            
            # Отслеживаем неудачные захваты
            if action.get('action') == 'capture':
                target_node = action.get('targetNodeId')
                dp = game_state.stats.get('dp', 0)
                if dp < 10:
                    self._failed_captures += 1
                    if self._last_capture_target == target_node:
                        self._capture_attempts += 1
                    else:
                        self._last_capture_target = target_node
                        self._capture_attempts = 1
                else:
                    self._failed_captures = 0
                    self._capture_attempts = 0
            
            # Выполняем действие (только первое из списка)
            if actions_to_perform:
                action = actions_to_perform[0]
            else:
                action = {'action': 'wait'}
            result = self.game_engine.step(action)
            # --- СТРОГАЯ СИНХРОНИЗАЦИЯ ---
            executed = result.get('executed_actions') or result.get('performedActions')
            if not executed or not executed[0]['success']:
                print(f"❌ ОШИБКА: Действие не выполнено движком! {executed}")
                total_reward -= 100  # Штраф за рассинхрон
                break
            if executed[0]['action'] != action:
                print(f"❌ ОШИБКА: Рассинхрон между выбранным и выполненным действием! {executed}")
                total_reward -= 200
                break
            game_state = GameState(result['newState'])
            total_reward += result['reward']
            steps += 1
        
        # Дополнительные бонусы/штрафы за поведение
        if capture_count > 0:
            total_reward += capture_count * 10  # Увеличенный бонус за захваты
        if build_count > 0:
            total_reward += build_count * 3  # Бонус за строительство
        if hub_capture_attempts > 0:
            total_reward += hub_capture_attempts * 20  # Бонус за попытки захвата HUB
        if capture_web_attempts > 0:
            total_reward += capture_web_attempts * 500  # Огромный бонус за capture_web
        
        # НОВОЕ: Бонус за быстрый захват нод
        if capture_count >= 5:
            total_reward += 100  # Бонус за много захватов
        if capture_count >= 10:
            total_reward += 200  # Бонус за очень много захватов
        
        # Штраф за слишком много network_capture
        if network_capture_count > steps * 0.3:  # Если больше 30% действий - network_capture
            total_reward -= 200
        elif network_capture_count > steps * 0.2:  # Если больше 20% действий - network_capture
            total_reward -= 100
        
        # Штраф за мало захватов
        if capture_count < 2:
            total_reward -= 50
        
        # Штраф за мало строительства
        if build_count < 1:
            total_reward -= 30
        
        # Финальный бонус/штраф с учетом новых механик
        if game_state.win:
            total_reward += 3000  # Огромный бонус за победу
            # Дополнительный бонус за победу через network capture
            if network_capture_count > 0:
                total_reward += 1000  # Большой бонус за использование network capture
            # Бонус за быструю победу
            if steps < 200:
                total_reward += 500  # Бонус за быструю победу
        elif game_state.done and not game_state.win:
            total_reward -= 1500  # Увеличенный штраф за поражение
        
        # Бонусы за новые механики
        stats = game_state.stats
        trace_level = stats.get('traceLevel', 0)
        player_nodes = stats.get('playerNodes', 0)
        total_nodes = stats.get('totalNodes', 0)
        capture_percentage = (player_nodes / total_nodes * 100) if total_nodes > 0 else 0
        
        # Бонус за эффективное использование overclocker'ов
        overclocker_count = 0
        total_overclocker_levels = 0
        for node_id, node in game_state.nodes.items():
            program = node.get('program')
            if node.get('owner') == 'player' and program and program.get('type') == 'overclocker':
                overclocker_count += 1
                total_overclocker_levels += program.get('level', 1)
        
        if overclocker_count > 0:
            total_reward += overclocker_count * 20  # Бонус за каждый overclocker
            total_reward += total_overclocker_levels * 10  # Бонус за уровни overclocker'ов
        
        # Бонус за sentry'и как источник DP
        sentry_count = 0
        for node_id, node in game_state.nodes.items():
            program = node.get('program')
            if node.get('owner') == 'player' and program and program.get('type') == 'sentry':
                sentry_count += 1
        
        if sentry_count > 0:
            total_reward += sentry_count * 30  # Большой бонус за sentry'и как источник DP
            # Дополнительный бонус за эффективное использование sentry'ев
            if sentry_count >= 3:
                total_reward += 50  # Бонус за хорошую защитную сеть
        
        # Бонус за подготовку к network capture победе
        if capture_percentage >= 60 and trace_level < 150:
            total_reward += 300  # Бонус за хорошую позицию для победы
        if capture_percentage >= 70 and trace_level < 100:
            total_reward += 500  # Большой бонус за отличную позицию
        
        # === НОВЫЕ БОНУСЫ ЗА РАВНОМЕРНОЕ РАЗВИТИЕ СЕТИ ===
        
        # 1. Бонус за связность сети (все ноды соединены с hub)
        player_node_ids = game_state.get_player_nodes()
        connected_to_hub = 0
        total_distance = 0
        
        for node_id in player_node_ids:
            if node_id == 'hub':
                connected_to_hub += 1
                total_distance += 0
            else:
                distance = self._calculate_distance_from_hub(node_id, game_state.nodes)
                if distance < 999:  # Нода достижима
                    connected_to_hub += 1
                    total_distance += distance
        
        connectivity = connected_to_hub / len(player_node_ids) if player_node_ids else 0.0
        avg_distance = total_distance / len(player_node_ids) if player_node_ids else 0.0
        
        # Бонус за высокую связность
        if connectivity >= 0.9:
            total_reward += 200  # Отличная связность
        elif connectivity >= 0.7:
            total_reward += 100  # Хорошая связность
        elif connectivity < 0.5:
            total_reward -= 150  # Штраф за плохую связность
        
        # Бонус за близость нод к hub (равномерное развитие)
        if avg_distance <= 2.0:
            total_reward += 150  # Ноды близко к центру
        elif avg_distance <= 3.0:
            total_reward += 75   # Ноды на среднем расстоянии
        elif avg_distance > 4.0:
            total_reward -= 100  # Штраф за слишком далекие ноды
        
        # 2. Бонус за равномерное распределение нод
        if len(player_node_ids) > 1:
            # Вычисляем стандартное отклонение расстояний
            distances = []
            for node_id in player_node_ids:
                if node_id != 'hub':
                    distance = self._calculate_distance_from_hub(node_id, game_state.nodes)
                    if distance < 999:
                        distances.append(distance)
            
            if distances:
                distance_std = np.std(distances)
                if distance_std <= 1.0:
                    total_reward += 100  # Очень равномерное распределение
                elif distance_std <= 1.5:
                    total_reward += 50   # Хорошее распределение
                elif distance_std > 2.5:
                    total_reward -= 75   # Штраф за неравномерность
        
        # 3. Бонус за стратегическое расширение (захват соседних нод)
        expansion_score = 0
        for node_id in player_node_ids:
            if node_id != 'hub':
                node = game_state.nodes.get(node_id, {})
                neighbors = node.get('neighbors', [])
                player_neighbors = sum(1 for n in neighbors 
                                    if game_state.nodes.get(n, {}).get('owner') == 'player')
                neutral_neighbors = sum(1 for n in neighbors 
                                     if game_state.nodes.get(n, {}).get('owner') == 'neutral')
                expansion_score += player_neighbors * 10 + neutral_neighbors * 5
        
        total_reward += expansion_score
        
        # 4. Штраф за "островки" отключенных нод
        isolated_nodes = 0
        for node_id in player_node_ids:
            if node_id != 'hub':
                distance = self._calculate_distance_from_hub(node_id, game_state.nodes)
                if distance >= 999:  # Недостижимая нода
                    isolated_nodes += 1
        
        if isolated_nodes > 0:
            total_reward -= isolated_nodes * 50  # Штраф за каждую изолированную ноду
        
        return total_reward

    def _calculate_distance_from_hub(self, node_id: str, nodes: dict) -> int:
        """Вычисляет расстояние от hub до ноды"""
        if node_id == 'hub':
            return 0
        
        # Простой BFS для поиска кратчайшего пути
        visited = set()
        queue = [('hub', 0)]
        
        while queue:
            current_node, distance = queue.pop(0)
            
            if current_node == node_id:
                return distance
            
            if current_node in visited:
                continue
                
            visited.add(current_node)
            current_node_data = nodes.get(current_node, {})
            neighbors = current_node_data.get('neighbors', [])
            
            for neighbor in neighbors:
                if neighbor not in visited:
                    queue.append((neighbor, distance + 1))
        
        return 999  # Недостижимая нода

    def _play_single_game(self, agent: EvolutionAgent, max_steps: int = 1000):
        """Запустить одну игру для ручного теста"""
        game_state = self.game_engine.reset()
        steps = 0
        while steps < max_steps and not game_state.done:
            available_actions = self.game_engine.get_actions()  # теперь список dict
            actions_to_perform = agent.select_actions(game_state, available_actions)
            if actions_to_perform:
                action = actions_to_perform[0]
            else:
                action = {'action': 'wait'}
            print(f"Шаг {steps}: Агент выбрал действие: {action}")
            result = self.game_engine.step(action)
            executed = result.get('executed_actions') or result.get('performedActions')
            if not executed or not executed[0]['success']:
                print(f"❌ ОШИБКА: Действие не выполнено движком! {executed}")
                break
            if executed[0]['action'] != action:
                print(f"❌ ОШИБКА: Рассинхрон между выбранным и выполненным действием! {executed}")
                break
            game_state = GameState(result['newState'])
            steps += 1
    
    def _create_next_generation(self):
        """Создать следующее поколение"""
        new_population = []
        
        # Элитизм: сохраняем лучших агентов
        for i in range(self.elite_size):
            new_population.append(self.population[i])
        
        # Скрещивание и мутация
        while len(new_population) < self.population_size:
            if random.random() < self.crossover_rate:
                # Скрещивание
                parent1 = self._select_parent()
                parent2 = self._select_parent()
                child = parent1.crossover(parent2)
            else:
                # Клонирование
                parent = self._select_parent()
                child = EvolutionAgent(self.genome_size)
                child.genome = parent.genome.copy()
            
            # Мутация
            child.mutate(self.mutation_rate, self.mutation_strength)
            new_population.append(child)
        
        self.population = new_population
    
    def _select_parent(self) -> EvolutionAgent:
        """Выбрать родителя для скрещивания (турнирный отбор)"""
        tournament_size = 3
        tournament = random.sample(self.population, tournament_size)
        return max(tournament, key=lambda x: x.fitness)
    
    def save_best_agent(self, filename: str = 'best_agent.pkl'):
        """Сохранить лучшего агента"""
        if self.best_agent:
            with open(filename, 'wb') as f:
                pickle.dump(self.best_agent, f)
            print(f"💾 Лучший агент сохранен в {filename}")
    
    def load_best_agent(self, filename: str = 'best_agent.pkl'):
        """Загрузить лучшего агента"""
        if os.path.exists(filename):
            with open(filename, 'rb') as f:
                self.best_agent = pickle.load(f)
            print(f"📂 Лучший агент загружен из {filename}")

def main():
    """Основная функция для обучения"""
    print("🚀 Запуск ОЧЕНЬ ДОЛГОГО эволюционного обучения для Network Echo!")
    print("🎯 Цель: Научить агента стабильно побеждать с новыми механиками!")
    
    # Создаём обёртку для движка
    game_engine = GameEngineProcess('rl_analysis/game_engine_headless.js')
    
    # Создание тренера с увеличенной популяцией
    trainer = EvolutionTrainer(game_engine, population_size=30, genome_size=60)
    
    # Попытка загрузить предыдущего лучшего агента
    trainer.load_best_agent()
    
    # Очень долгое обучение
    generations = 500  # Увеличиваем количество поколений в 10 раз
    stats_history = []
    best_fitness_ever = -float('inf')
    generations_without_improvement = 0
    
    print(f"🎮 Параметры обучения:")
    print(f"   📊 Популяция: {trainer.population_size} агентов")
    print(f"   🧬 Размер генома: {trainer.genome_size} параметров")
    print(f"   🔄 Поколений: {generations}")
    print(f"   🎯 Игр на агента: 5")
    print("-" * 50)
    
    for gen in range(generations):
        print(f"🔄 Поколение {gen+1}/{generations}")
        
        # Адаптивное количество игр на агента
        games_per_agent = 5 if gen < 20 else 3  # Можно увеличить до 5 для всех, если нужно
        
        stats = trainer.train_generation(games_per_agent=games_per_agent)
        stats_history.append(stats)
        
        # Отслеживаем прогресс
        current_best = stats['best_fitness']
        if current_best > best_fitness_ever:
            best_fitness_ever = current_best
            generations_without_improvement = 0
            print(f"🏆 НОВЫЙ РЕКОРД! Фитнес: {current_best:.2f}")
        else:
            generations_without_improvement += 1
        
        # Сохраняем каждые 10 поколений
        if (gen + 1) % 10 == 0:
            trainer.save_best_agent()
            print(f"💾 Сохранен лучший агент (фитнес: {current_best:.2f})")
        
        # Проверяем условие победы
        if current_best > 1000:  # Если агент научился побеждать
            print(f"🎉 АГЕНТ НАУЧИЛСЯ ПОБЕЖДАТЬ! Фитнес: {current_best:.2f}")
            trainer.save_best_agent('winning_agent.pkl')
            break
        
        # Адаптивная мутация
        if generations_without_improvement > 20:
            trainer.mutation_rate = min(0.3, trainer.mutation_rate * 1.1)
            trainer.mutation_strength = min(0.5, trainer.mutation_strength * 1.05)
            print(f"🔄 Увеличена мутация: rate={trainer.mutation_rate:.2f}, strength={trainer.mutation_strength:.2f}")
            generations_without_improvement = 0
        
        print(f"📊 Статистика поколения:")
        print(f"   🏆 Лучший фитнес: {current_best:.2f}")
        print(f"   📈 Средний фитнес: {stats['avg_fitness']:.2f}")
        print(f"   📉 Худший фитнес: {stats['min_fitness']:.2f}")
        print(f"   🎯 Лучший фитнес за все время: {best_fitness_ever:.2f}")
        print("-" * 50)
    
    trainer.save_best_agent()
    print("🎉 Очень долгое обучение завершено!")
    print(f"🏆 Лучший фитнес за все время: {best_fitness_ever:.2f}")
    game_engine.close()
    return trainer

if __name__ == "__main__":
    main() 