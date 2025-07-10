#!/usr/bin/env python3
"""
Эволюционный агент для обучения игре Network Echo
Использует генетические алгоритмы для оптимизации стратегии
"""

import json
import subprocess
import numpy as np
import random
from typing import Dict, List, Tuple, Any
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
        """Получить ноды, которые можно захватить"""
        capturable = []
        for node_id in self.get_neutral_nodes():
            node = self.nodes[node_id]
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
    """Эволюционный агент для игры"""
    
    def __init__(self, genome_size: int = 50):
        self.genome_size = genome_size
        self.genome = self._create_random_genome()
        self.fitness = 0.0
        self.games_played = 0
        self.total_score = 0.0
    
    def _create_random_genome(self) -> np.ndarray:
        """Создать случайный геном"""
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
    
    def get_action_weights(self, game_state: GameState) -> Dict[str, float]:
        """Получить веса для различных действий на основе генома и состояния игры"""
        weights = {}
        
        # Базовые веса из генома
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
            'wait': self.genome[9]
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
        
        # Адаптивные модификаторы
        modifiers = {
            'build_miner': self._calculate_build_weight('miner', dp, cpu, trace_level, buildable_nodes),
            'build_sentry': self._calculate_build_weight('sentry', dp, cpu, trace_level, buildable_nodes, enemies_count),
            'build_shield': self._calculate_build_weight('shield', dp, cpu, trace_level, buildable_nodes, enemies_count),
            'build_overclocker': self._calculate_build_weight('overclocker', dp, cpu, trace_level, buildable_nodes),
            'upgrade': self._calculate_upgrade_weight(dp, cpu, player_nodes),
            'capture': self._calculate_capture_weight(dp, capturable_nodes, player_nodes),
            'upgrade_hub': self._calculate_hub_upgrade_weight(cpu, trace_level),
            'emp_blast': self._calculate_emp_weight(cpu, enemies_count),
            'network_capture': self._calculate_network_capture_weight(dp, trace_level),
            'wait': self._calculate_wait_weight(trace_level, enemies_count)
        }
        
        # Комбинируем базовые веса с модификаторами
        for action in base_weights:
            weights[action] = base_weights[action] * modifiers[action]
        
        return weights
    
    def _calculate_build_weight(self, program_type: str, dp: int, cpu: int, 
                               trace_level: float, buildable_nodes: int, 
                               enemies_count: int = 0) -> float:
        """Рассчитать вес для строительства программы"""
        costs = {'miner': 20, 'sentry': 40, 'shield': 30, 'overclocker': 50}
        cost = costs[program_type]
        
        if dp < cost or buildable_nodes == 0:
            return 0.1
        
        # Базовый вес
        weight = 1.0
        
        # Модификаторы на основе ресурсов
        if dp > cost * 3:
            weight *= 1.5  # Много ресурсов - строим активнее
        
        # Модификаторы на основе типа программы
        if program_type == 'sentry' and enemies_count > 2:
            weight *= 2.0  # Много врагов - строим защиту
        elif program_type == 'shield' and enemies_count > 1:
            weight *= 1.8  # Враги есть - строим щиты
        elif program_type == 'miner' and dp < 100:
            weight *= 1.3  # Мало ресурсов - строим майнеры
        elif program_type == 'overclocker' and cpu < 50:
            weight *= 1.4  # Мало CPU - строим оверклокеры
        
        # Модификаторы на основе trace level
        if trace_level > 100:
            weight *= 0.7  # Высокий trace - строим меньше
        
        return weight
    
    def _calculate_upgrade_weight(self, dp: int, cpu: int, player_nodes: int) -> float:
        """Рассчитать вес для апгрейда"""
        if player_nodes == 0:
            return 0.1
        
        weight = 1.0
        
        if dp > 50 and cpu > 20:
            weight *= 1.5  # Много ресурсов - апгрейдим
        elif dp < 30 or cpu < 10:
            weight *= 0.5  # Мало ресурсов - не апгрейдим
        
        return weight
    
    def _calculate_capture_weight(self, dp: int, capturable_nodes: int, player_nodes: int) -> float:
        """Рассчитать вес для захвата"""
        if capturable_nodes == 0 or dp < 10:
            return 0.1
        
        weight = 1.0
        
        if player_nodes < 5:
            weight *= 2.0  # Мало нод - захватываем активно
        elif dp > 50:
            weight *= 1.3  # Много ресурсов - захватываем
        
        return weight
    
    def _calculate_hub_upgrade_weight(self, cpu: int, trace_level: float) -> float:
        """Рассчитать вес для апгрейда HUB"""
        if cpu < 30:
            return 0.1
        
        weight = 1.0
        
        if cpu > 100:
            weight *= 1.5  # Много CPU - апгрейдим HUB
        if trace_level > 150:
            weight *= 1.3  # Высокий trace - нужен апгрейд HUB
        
        return weight
    
    def _calculate_emp_weight(self, cpu: int, enemies_count: int) -> float:
        """Рассчитать вес для EMP blast"""
        if cpu < 50 or enemies_count == 0:
            return 0.1
        
        weight = 1.0
        
        if enemies_count > 3:
            weight *= 2.0  # Много врагов - используем EMP
        elif enemies_count > 1:
            weight *= 1.5  # Есть враги - используем EMP
        
        return weight
    
    def _calculate_network_capture_weight(self, dp: int, trace_level: float) -> float:
        """Рассчитать вес для network capture"""
        if dp < 20:
            return 0.1
        
        weight = 1.0
        
        if trace_level < 50:
            weight *= 1.3  # Низкий trace - можно использовать
        elif trace_level > 150:
            weight *= 0.3  # Высокий trace - не используем
        
        return weight
    
    def _calculate_wait_weight(self, trace_level: float, enemies_count: int) -> float:
        """Рассчитать вес для ожидания"""
        weight = 1.0
        
        if enemies_count > 2:
            weight *= 0.5  # Много врагов - не ждем
        if trace_level > 150:
            weight *= 0.7  # Высокий trace - не ждем
        
        return weight

class EvolutionTrainer:
    """Тренер для эволюционного обучения"""
    
    def __init__(self, population_size: int = 50, genome_size: int = 50):
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
    
    def _evaluate_agent(self, agent: EvolutionAgent, games_count: int) -> float:
        """Оценить агента, сыграв несколько игр"""
        total_score = 0.0
        
        for game in range(games_count):
            try:
                score = self._play_single_game(agent)
                total_score += score
            except Exception as e:
                print(f"    Ошибка в игре {game+1}: {e}")
                total_score += 0.0
        
        return total_score / games_count
    
    def _play_single_game(self, agent: EvolutionAgent) -> float:
        """Сыграть одну игру с агентом"""
        # Запуск headless движка
        process = subprocess.Popen(
            ['node', 'game_engine_headless.js'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        try:
            # Сброс игры
            reset_cmd = json.dumps({'cmd': 'reset'}) + '\n'
            process.stdin.write(reset_cmd)
            process.stdin.flush()
            
            response = process.stdout.readline()
            game_state = GameState(json.loads(response))
            
            total_reward = 0.0
            steps = 0
            max_steps = 1000  # Ограничение на количество шагов
            
            while not game_state.done and steps < max_steps:
                # Получить возможные действия
                actions_cmd = json.dumps({'cmd': 'get_actions'}) + '\n'
                process.stdin.write(actions_cmd)
                process.stdin.flush()
                
                actions_response = process.stdout.readline()
                actions_data = json.loads(actions_response)
                available_actions = actions_data.get('actions', [])
                
                if not available_actions:
                    break
                
                # Выбрать действие на основе генома агента
                action = self._select_action(agent, game_state, available_actions)
                
                # Выполнить действие
                step_cmd = json.dumps({'cmd': 'step', 'action': action}) + '\n'
                process.stdin.write(step_cmd)
                process.stdin.flush()
                
                step_response = process.stdout.readline()
                step_data = json.loads(step_response)
                
                # Обновить состояние игры
                game_state = GameState(step_data['newState'])
                total_reward += step_data.get('reward', 0)
                
                steps += 1
            
            # Дополнительные бонусы за победу
            if game_state.win:
                total_reward += 1000
            elif game_state.done and not game_state.win:
                total_reward -= 500
            
            # Бонусы за статистику
            stats = game_state.stats
            total_reward += stats.get('dp', 0) * 0.1  # Бонус за DP
            total_reward += stats.get('playerNodes', 0) * 10  # Бонус за захваченные ноды
            total_reward -= stats.get('traceLevel', 0) * 0.5  # Штраф за trace level
            
            process.terminate()
            return total_reward
            
        except Exception as e:
            process.terminate()
            print(f"    Ошибка в игре: {e}")
            return 0.0
    
    def _select_action(self, agent: EvolutionAgent, game_state: GameState, 
                       available_actions: List[str]) -> Dict[str, Any]:
        """Выбрать действие на основе генома агента"""
        weights = agent.get_action_weights(game_state)
        
        # Фильтруем доступные действия
        available_weights = {action: weights.get(action, 0.1) 
                           for action in available_actions}
        
        # Нормализуем веса - исправленная версия
        total_weight = sum(available_weights.values())
        if total_weight > 0:
            available_weights = {k: v/total_weight for k, v in available_weights.items()}
        else:
            # Если все веса нулевые или отрицательные, используем равномерное распределение
            available_weights = {action: 1.0/len(available_actions) 
                               for action in available_actions}
        
        # Проверяем, что все веса положительные
        for action in available_weights:
            if available_weights[action] <= 0:
                available_weights[action] = 0.01  # Минимальное положительное значение
        
        # Пересчитываем нормализацию после исправления отрицательных значений
        total_weight = sum(available_weights.values())
        if total_weight > 0:
            available_weights = {k: v/total_weight for k, v in available_weights.items()}
        else:
            available_weights = {action: 1.0/len(available_actions) 
                               for action in available_actions}
        
        # Выбираем действие на основе весов
        actions = list(available_weights.keys())
        weights_list = list(available_weights.values())
        
        # Дополнительная проверка для numpy
        weights_list = np.array(weights_list)
        weights_list = np.maximum(weights_list, 1e-10)  # Минимальное положительное значение
        weights_list = weights_list / np.sum(weights_list)  # Нормализация
        
        chosen_action = np.random.choice(actions, p=weights_list)
        
        # Формируем действие
        if chosen_action in ['build_miner', 'build_sentry', 'build_shield', 'build_overclocker']:
            buildable_nodes = game_state.get_buildable_nodes()
            if buildable_nodes:
                target_node = random.choice(buildable_nodes)
                return {'action': chosen_action, 'targetNodeId': target_node}
        
        elif chosen_action == 'upgrade':
            upgradable_nodes = game_state.get_upgradable_nodes()
            if upgradable_nodes:
                target_node = random.choice(upgradable_nodes)
                return {'action': 'upgrade', 'targetNodeId': target_node}
        
        elif chosen_action == 'capture':
            capturable_nodes = game_state.get_capturable_nodes()
            if capturable_nodes:
                target_node = random.choice(capturable_nodes)
                return {'action': 'capture', 'targetNodeId': target_node}
        
        return {'action': chosen_action}
    
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
    print("🚀 Запуск эволюционного обучения для Network Echo!")
    
    # Создание тренера
    trainer = EvolutionTrainer(population_size=10, genome_size=20)
    
    # Попытка загрузить предыдущего лучшего агента
    trainer.load_best_agent()
    
    # Обучение
    generations = 3
    stats_history = []
    
    for gen in range(generations):
        stats = trainer.train_generation(games_per_agent=1)
        stats_history.append(stats)
        
        # Сохраняем лучшего агента каждые 10 поколений
        if (gen + 1) % 10 == 0:
            trainer.save_best_agent()
        
        print(f"📈 Прогресс: {gen+1}/{generations} поколений")
        print("-" * 50)
    
    # Финальное сохранение
    trainer.save_best_agent()
    print("🎉 Обучение завершено!")
    
    # Вывод финальной статистики
    print(f"🏆 Лучший фитнес: {trainer.best_fitness:.2f}")
    
    return trainer

if __name__ == "__main__":
    main() 