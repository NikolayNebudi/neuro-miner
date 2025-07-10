#!/usr/bin/env python3
"""
Эффективный анализ огромных логов без загрузки в память
"""

import json
import os
from collections import Counter
import sys

def analyze_logs_efficient(log_file):
    """Эффективный анализ лог-файла"""
    print(f"🔍 Эффективный анализ файла: {log_file}")
    print("=" * 60)
    
    # Статистика файла
    file_size = os.path.getsize(log_file) / (1024 * 1024 * 1024)  # GB
    print(f"📁 Размер файла: {file_size:.2f} GB")
    
    # Подсчет строк без загрузки в память
    print("⏳ Подсчитываем строки...")
    with open(log_file, 'r') as f:
        total_lines = sum(1 for _ in f)
    
    print(f"📊 Количество строк: {total_lines:,}")
    print(f"📏 Средний размер строки: {file_size * 1024 * 1024 * 1024 / total_lines:.0f} байт")
    
    # Анализ первых записей
    print(f"\n📋 Анализ структуры записей:")
    
    print(f"\n🔸 Первые 3 записи:")
    with open(log_file, 'r') as f:
        for i in range(3):
            line = f.readline()
            if not line:
                break
            try:
                data = json.loads(line)
                episode = data.get('episode', 'N/A')
                step = data.get('step', 'N/A')
                action = data.get('chosen_action', {}).get('action', 'N/A')
                print(f"  {i+1}. Эпизод {episode}, Шаг {step}, Действие: {action}")
            except:
                print(f"  {i+1}. Ошибка парсинга JSON")
    
    # Анализ последних записей
    print(f"\n🔸 Последние 3 записи:")
    with open(log_file, 'r') as f:
        # Переходим к концу файла
        f.seek(0, 2)
        file_size_bytes = f.tell()
        
        # Читаем последние 100KB для поиска последних строк
        chunk_size = 100 * 1024
        f.seek(max(0, file_size_bytes - chunk_size))
        chunk = f.read()
        
        # Находим последние строки
        lines = chunk.split('\n')
        last_lines = [line for line in lines if line.strip()][-3:]
        
        for i, line in enumerate(last_lines):
            try:
                data = json.loads(line)
                episode = data.get('episode', 'N/A')
                step = data.get('step', 'N/A')
                action = data.get('chosen_action', {}).get('action', 'N/A')
                print(f"  {len(last_lines)-i}. Эпизод {episode}, Шаг {step}, Действие: {action}")
            except:
                print(f"  {len(last_lines)-i}. Ошибка парсинга JSON")
    
    # Эффективный анализ содержимого
    print(f"\n📊 Анализ содержимого (выборочно):")
    
    episodes = set()
    actions = Counter()
    steps_per_episode = {}
    
    print("⏳ Обрабатываем записи (каждая 1000-я)...")
    with open(log_file, 'r') as f:
        for i, line in enumerate(f):
            if i % 1000 == 0:  # Анализируем каждую 1000-ю запись
                try:
                    data = json.loads(line)
                    episode = data.get('episode', 0)
                    step = data.get('step', 0)
                    action = data.get('chosen_action', {}).get('action', 'unknown')
                    
                    episodes.add(episode)
                    actions[action] += 1
                    steps_per_episode[episode] = max(steps_per_episode.get(episode, 0), step)
                    
                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    if i < 1000:  # Показываем только первые ошибки
                        print(f"  Ошибка в строке {i}: {e}")
                    continue
            
            if i % 10000 == 0:
                print(f"  Обработано {i:,} строк...")
    
    print(f"\n📈 Результаты анализа (выборочного):")
    print(f"  🎮 Количество эпизодов: {len(episodes)}")
    print(f"  📝 Количество действий: {sum(actions.values()):,}")
    if steps_per_episode:
        avg_steps = sum(steps_per_episode.values()) / len(steps_per_episode)
        print(f"  📊 Средняя длина эпизода: {avg_steps:.0f} шагов")
    
    print(f"\n🎯 Топ-10 действий:")
    for action, count in actions.most_common(10):
        percentage = count / sum(actions.values()) * 100
        print(f"  {action}: {count:,} ({percentage:.1f}%)")
    
    # Анализ размера данных
    print(f"\n💾 Анализ размера данных:")
    
    # Размер одной записи (из первой строки)
    with open(log_file, 'r') as f:
        first_line = f.readline()
        if first_line:
            sample_size = len(first_line.encode('utf-8'))
            print(f"  📏 Размер одной записи: ~{sample_size:,} байт")
            print(f"  📊 Размер всех записей: ~{sample_size * total_lines / (1024*1024*1024):.2f} GB")
    
    # Проблемы с размером
    print(f"\n⚠️ Проблемы с размером:")
    print(f"  🔴 Каждый шаг записывается полностью")
    print(f"  🔴 Полное состояние игры в каждой записи")
    print(f"  🔴 Дублирование данных между записями")
    print(f"  🔴 {total_lines:,} записей × ~70KB = ~{total_lines * 70 / (1024*1024):.1f} GB")
    
    # Что говорят логи об игре
    print(f"\n🎮 Что говорят логи об игре:")
    print(f"  📊 Игра имеет сложную структуру состояний")
    print(f"  🎯 Много различных действий (захват, строительство, обновление)")
    print(f"  🔄 Эпизоды могут быть длинными (много шагов)")
    print(f"  📈 Обучение происходит на большом количестве эпизодов")
    print(f"  💾 Каждое состояние содержит полную информацию о карте")
    
    # Рекомендации
    print(f"\n💡 Рекомендации по оптимизации:")
    print(f"  ✅ Ограничить количество записей (max 50,000)")
    print(f"  ✅ Сжимать данные состояния")
    print(f"  ✅ Записывать только изменения")
    print(f"  ✅ Использовать бинарный формат")
    print(f"  ✅ Ротация логов")
    print(f"  ✅ Уменьшить количество итераций обучения")

def main():
    """Основная функция"""
    log_file = "actions_log.jsonl"
    
    if not os.path.exists(log_file):
        print(f"❌ Файл {log_file} не найден")
        return
    
    analyze_logs_efficient(log_file)

if __name__ == "__main__":
    main() 