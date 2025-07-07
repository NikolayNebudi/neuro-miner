#!/usr/bin/env python3
"""
Главный скрипт управления RL-системой киберпанк стратегии
"""

import sys
import os
import subprocess
import time

def show_menu():
    """Показывает главное меню"""
    print("🎮 RL-система киберпанк стратегии")
    print("=" * 50)
    print("1. 🚀 Запустить обучение")
    print("2. 📊 Анализ результатов")
    print("3. 🔍 Мониторинг в реальном времени")
    print("4. 🎯 Быстрая статистика")
    print("5. 🎮 Демонстрация модели")
    print("6. 📈 Создать графики")
    print("7. 🔧 Сравнить модели")
    print("8. 📖 Показать README")
    print("9. 🛑 Выход")
    print("-" * 50)

def run_training():
    """Запускает обучение"""
    print("🚀 Запуск обучения...")
    print("Нажмите Ctrl+C для остановки")
    print("-" * 30)
    
    try:
        subprocess.run([sys.executable, "train.py"], check=True)
        print("\n✅ Обучение завершено!")
    except KeyboardInterrupt:
        print("\n🛑 Обучение остановлено пользователем")
    except subprocess.CalledProcessError as e:
        print(f"❌ Ошибка при обучении: {e}")

def run_analysis():
    """Запускает анализ результатов"""
    print("📊 Запуск анализа...")
    try:
        subprocess.run([sys.executable, "analyze_results.py"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Ошибка при анализе: {e}")

def run_monitoring():
    """Запускает мониторинг"""
    print("🔍 Запуск мониторинга...")
    print("Нажмите Ctrl+C для остановки")
    try:
        subprocess.run([sys.executable, "monitor_training.py"], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Мониторинг остановлен")
    except subprocess.CalledProcessError as e:
        print(f"❌ Ошибка при мониторинге: {e}")

def run_stats():
    """Показывает быструю статистику"""
    print("📊 Быстрая статистика:")
    try:
        subprocess.run([sys.executable, "monitor_training.py", "stats"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Ошибка при получении статистики: {e}")

def run_demo():
    """Запускает демонстрацию"""
    print("🎮 Демонстрация модели:")
    try:
        subprocess.run([sys.executable, "demo_model.py"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Ошибка при демонстрации: {e}")

def create_graphs():
    """Создает графики"""
    print("📈 Создание графиков...")
    try:
        subprocess.run([sys.executable, "analyze_results.py"], check=True)
        if os.path.exists("training_analysis.png"):
            print("✅ Графики созданы: training_analysis.png")
        else:
            print("❌ Графики не созданы")
    except subprocess.CalledProcessError as e:
        print(f"❌ Ошибка при создании графиков: {e}")

def compare_models():
    """Сравнивает модели"""
    print("🔧 Сравнение моделей:")
    try:
        subprocess.run([sys.executable, "demo_model.py", "compare"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Ошибка при сравнении: {e}")

def show_readme():
    """Показывает README"""
    if os.path.exists("README.md"):
        with open("README.md", "r", encoding="utf-8") as f:
            content = f.read()
            print("📖 README:")
            print("=" * 50)
            print(content)
    else:
        print("❌ Файл README.md не найден")

def check_dependencies():
    """Проверяет зависимости"""
    print("🔍 Проверка зависимостей...")
    
    required_files = [
        "train.py",
        "network_echo_env.py", 
        "game_engine.js",
        "requirements.txt"
    ]
    
    missing_files = []
    for file in required_files:
        if not os.path.exists(file):
            missing_files.append(file)
    
    if missing_files:
        print(f"❌ Отсутствуют файлы: {', '.join(missing_files)}")
        return False
    else:
        print("✅ Все файлы на месте")
        return True

def main():
    """Главная функция"""
    
    # Проверяем зависимости
    if not check_dependencies():
        print("\n❌ Некоторые файлы отсутствуют. Убедитесь, что вы в правильной папке.")
        return
    
    while True:
        show_menu()
        
        try:
            choice = input("\nВыберите действие (1-9): ").strip()
            
            if choice == "1":
                run_training()
            elif choice == "2":
                run_analysis()
            elif choice == "3":
                run_monitoring()
            elif choice == "4":
                run_stats()
            elif choice == "5":
                run_demo()
            elif choice == "6":
                create_graphs()
            elif choice == "7":
                compare_models()
            elif choice == "8":
                show_readme()
            elif choice == "9":
                print("👋 До свидания!")
                break
            else:
                print("❌ Неверный выбор. Попробуйте снова.")
                
        except KeyboardInterrupt:
            print("\n\n🛑 Выход из программы")
            break
        except Exception as e:
            print(f"❌ Ошибка: {e}")
        
        input("\nНажмите Enter для продолжения...")

if __name__ == "__main__":
    main() 