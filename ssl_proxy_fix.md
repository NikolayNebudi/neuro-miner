# 🔧 Решение проблемы SSL Proxy: 127.0.0.1:12334

## ❌ Описание проблемы
```
Failed to establish a socket connection to proxies: PROXY 127.0.0.1:12334
```

## 🔍 Возможные причины

1. **Конфигурация прокси в VS Code/Cursor**
2. **Временная проблема с сетью**
3. **Конфликт с расширениями**
4. **Проблема с Python-пакетами**

## 🛠️ Решения

### 1. Проверьте настройки прокси в Cursor
Откройте настройки Cursor (`Ctrl+,`) и найдите настройки прокси:
- Убедитесь, что `http.proxy` не установлен
- Проверьте `http.proxySupport` - должно быть `off` или `system`

### 2. Временное отключение прокси
```bash
# Отключите прокси для текущей сессии
export http_proxy=""
export https_proxy=""
export HTTP_PROXY=""
export HTTPS_PROXY=""
```

### 3. Очистите кеш Python
```bash
# Очистите pip кеш
pip cache purge

# Переустановите проблемные пакеты
pip install --force-reinstall --no-cache-dir requests urllib3
```

### 4. Проверьте сетевое соединение
```bash
# Проверьте доступность интернета
ping -c 4 google.com

# Проверьте DNS
nslookup google.com
```

### 5. Перезапустите Cursor
Иногда простой перезапуск редактора решает проблему:
1. Закройте Cursor полностью
2. Подождите несколько секунд
3. Откройте заново

### 6. Проверьте расширения
Отключите все расширения Cursor и проверьте, исчезла ли проблема:
- Перейдите в Extensions (`Ctrl+Shift+X`)
- Отключите все расширения
- Перезапустите Cursor

### 7. Альтернативный способ запуска Python
```bash
# Запустите Python с отключенными прокси
python3 -c "
import os
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
print('Прокси отключены')
"
```

### 8. Проверьте файерволл
```bash
# Проверьте, не блокирует ли файерволл соединение
sudo ufw status
```

## 🔄 Быстрое решение
Выполните эти команды в терминале:

```bash
# 1. Очистите переменные окружения
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY

# 2. Перезапустите Python без прокси
python3 -c "import sys; print('Python работает без прокси')"

# 3. Если проблема в pip, используйте:
pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org <package_name>
```

## 🆘 Если ничего не помогает

1. **Перезагрузите систему** - иногда это решает сетевые проблемы
2. **Используйте другую сеть** - попробуйте подключиться к другому интернету
3. **Обновите Cursor** - возможно, это известная ошибка
4. **Обратитесь в поддержку** - если проблема критическая

## 📝 Дополнительная диагностика
```bash
# Проверьте сетевые соединения
netstat -tuln 2>/dev/null || ss -tuln

# Проверьте процессы Python
ps aux | grep python

# Проверьте логи системы
journalctl -n 50 | grep -i proxy
```

---
**Примечание**: Ошибка `PROXY 127.0.0.1:12334` часто является временной и может исчезнуть после перезапуска редактора или очистки кеша.