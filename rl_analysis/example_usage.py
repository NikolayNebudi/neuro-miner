#!/usr/bin/env python3
"""
Пример использования RL-системы киберпанк стратегии
"""

import subprocess
import sys
import os

def run_example():
    """Запускает пример использования системы"""
    
    print("🎮 Пример использования RL-системы киберпанк стратегии")
    print("=" * 60)
    
    # Проверяем наличие файлов
    required_files = [
        "train.py",
        "network_echo_env.py",
        "game_engine.js",
        "analyze_results.py",
        "monitor_training.py"
    ]
    
    print("🔍 Проверка файлов...")
    for file in required_files:
        if os.path.exists(file):
            print(f"   ✅ {file}")
        else:
            print(f"   ❌ {file} - не найден")
            return
    
    print("\n📊 Быстрая статистика текущих результатов:")
    try:
        subprocess.run([sys.executable, "monitor_training.py", "stats"], check=True)
    except subprocess.CalledProcessError:
        print("   (Нет данных для анализа)")
    
    print("\n🎯 Доступные команды:")
    print("   1. python3 run.py                    - Главное меню")
    print("   2. python3 train.py                  - Запуск обучения")
    print("   3. python3 monitor_training.py       - Мониторинг")
    print("   4. python3 analyze_results.py        - Анализ с графиками")
    print("   5. python3 demo_model.py             - Демонстрация модели")
    print("   6. python3 monitor_training.py stats - Быстрая статистика")
    
    print("\n📖 Документация:")
    print("   - README.md содержит подробные инструкции")
    print("   - Все скрипты имеют встроенную справку")
    
    print("\n🚀 Быстрый старт:")
    print("   1. Установите зависимости: pip install -r requirements.txt")
    print("   2. Запустите обучение: python3 train.py")
    print("   3. Мониторьте прогресс: python3 monitor_training.py")
    print("   4. Анализируйте результаты: python3 analyze_results.py")

if __name__ == "__main__":
    run_example() 