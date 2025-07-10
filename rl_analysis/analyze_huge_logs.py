#!/usr/bin/env python3
"""
Анализ огромных логов для понимания их структуры и размера
"""

import json
import os
from collections import defaultdict, Counter
import sys

def analyze_log_structure(log_file):
    """Анализирует структуру лог-файла"""
    print(f"🔍 Анализ файла: {log_file}")
    print("=" * 60)
    
    # Статистика файла
    file_size = os.path.getsize(log_file) / (1024 * 1024 * 1024)  # GB
    print(f"📁 Размер файла: {file_size:.2f} GB")
    
    # Подсчет строк
    with open(log_file, 'r') as f:
        lines = f.readlines()
        total_lines = len(lines)
    
    print(f"📊 Количество строк: {total_lines:,}")
    print(f"📏 Средний размер строки: {file_size * 1024 * 1024 * 1024 / total_lines:.0f} байт")
    
    # Анализ первых и последних записей
    print(f"\n📋 Анализ структуры записей:")
    
    # Первые записи
    print(f"\n🔸 Первые 3 записи:")
    for i in range(min(3, len(lines))):
        try:
            data = json.loads(lines[i])
            episode = data.get('episode', 'N/A')
            step = data.get('step', 'N/A')
            action = data.get('chosen_action', {}).get('action', 'N/A')
            print(f"  {i+1}. Эпизод {episode}, Шаг {step}, Действие: {action}")
        except:
            print(f"  {i+1}. Ошибка парсинга JSON")
    
    # Последние записи
    print(f"\n🔸 Последние 3 записи:")
    for i in range(max(0, len(lines)-3), len(lines)):
        try:
            data = json.loads(lines[i])
            episode = data.get('episode', 'N/A')
            step = data.get('step', 'N/A')
            action = data.get('chosen_action', {}).get('action', 'N/A')
            print(f"  {len(lines)-i}. Эпизод {episode}, Шаг {step}, Действие: {action}")
        except:
            print(f"  {len(lines)-i}. Ошибка парсинга JSON")
    
    # Анализ содержимого
    print(f"\n📊 Анализ содержимого:")
    
    # Подсчет эпизодов
    episodes = set()
    actions = Counter()
    steps_per_episode = defaultdict(int)
    
    print("⏳ Обрабатываем записи...")
    for i, line in enumerate(lines):
        if i % 10000 == 0:
            print(f"  Обработано {i:,} строк...")
        
        try:
            data = json.loads(line)
            episode = data.get('episode', 0)
            step = data.get('step', 0)
            action = data.get('chosen_action', {}).get('action', 'unknown')
            
            episodes.add(episode)
            actions[action] += 1
            steps_per_episode[episode] = max(steps_per_episode[episode], step)
            
        except json.JSONDecodeError:
            continue
        except Exception as e:
            print(f"  Ошибка в строке {i}: {e}")
            continue
    
    print(f"\n📈 Результаты анализа:")
    print(f"  🎮 Количество эпизодов: {len(episodes)}")
    print(f"  📝 Количество действий: {sum(actions.values()):,}")
    print(f"  📊 Средняя длина эпизода: {sum(steps_per_episode.values()) / len(episodes):.0f} шагов")
    
    print(f"\n🎯 Топ-10 действий:")
    for action, count in actions.most_common(10):
        percentage = count / sum(actions.values()) * 100
        print(f"  {action}: {count:,} ({percentage:.1f}%)")
    
    # Анализ размера данных
    print(f"\n💾 Анализ размера данных:")
    
    # Размер одной записи
    if lines:
        sample_size = len(lines[0].encode('utf-8'))
        print(f"  📏 Размер одной записи: ~{sample_size:,} байт")
        print(f"  📊 Размер всех записей: ~{sample_size * len(lines) / (1024*1024*1024):.2f} GB")
    
    # Проблемы с размером
    print(f"\n⚠️ Проблемы с размером:")
    print(f"  🔴 Каждый шаг записывается полностью")
    print(f"  🔴 Полное состояние игры в каждой записи")
    print(f"  🔴 Дублирование данных между записями")
    print(f"  🔴 357,750 записей × ~70KB = ~23GB")
    
    # Рекомендации
    print(f"\n💡 Рекомендации по оптимизации:")
    print(f"  ✅ Ограничить количество записей")
    print(f"  ✅ Сжимать данные состояния")
    print(f"  ✅ Записывать только изменения")
    print(f"  ✅ Использовать бинарный формат")
    print(f"  ✅ Ротация логов")

def main():
    """Основная функция"""
    log_file = "actions_log.jsonl"
    
    if not os.path.exists(log_file):
        print(f"❌ Файл {log_file} не найден")
        return
    
    analyze_log_structure(log_file)

if __name__ == "__main__":
    main() 