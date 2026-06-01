# Инструкция по использованию извлеченной структуры таблицы Crew List

## Что было сделано

Из PDF файла `Книга1.pdf` была извлечена полная структура таблицы с точными координатами всех элементов.

## Созданные файлы

### 1. `table_structure_complete.json`
**Назначение**: Полная структура таблицы в формате JSON для программного использования.

**Содержит**:
- Размеры страницы (595.22 x 842.0 points, A4)
- Координаты всех вертикальных линий (14 линий)
- Координаты всех горизонтальных линий (21 пара двойных линий)
- Описание 7 колонок с их размерами
- Заголовочные строки (5 строк)
- Данные экипажа (13 членов экипажа)
- Пустые строки для заполнения (10 строк)

### 2. `TABLE_SPECIFICATION.md`
**Назначение**: Человекочитаемое описание структуры таблицы.

**Содержит**:
- Подробное описание каждой колонки
- Координаты всех линий с комментариями
- Инструкции для ИИ по воссозданию таблицы
- Примеры кода на Python

### 3. `create_pdf_from_structure.py`
**Назначение**: Готовый скрипт для создания PDF на основе структуры.

**Функции**:
- `create_crew_list_pdf()` - создать точную копию оригинальной таблицы
- `create_crew_list_with_custom_data()` - создать таблицу с новыми данными

### 4. `pdf_structure.json`
**Назначение**: Полный дамп всех элементов PDF (658 горизонтальных линий, 658 вертикальных линий, 225 текстовых элементов).

### 5. Сгенерированные PDF файлы
- `crew_list_generated.pdf` - точная копия оригинальной таблицы
- `crew_list_custom.pdf` - пример с пользовательскими данными

## Как использовать для создания PDF

### Вариант 1: Использовать готовый Python скрипт

```python
from create_pdf_from_structure import create_crew_list_with_custom_data

# Подготовить данные экипажа
crew_data = [
    {
        'no': '1',
        'name': 'IVANOV, Ivan',
        'rank': 'Captain',
        'nationality': 'Russia',
        'date_of_birth': '01.01.80',
        'place_of_birth': 'Moscow',
        'passport': 'RU123456'
    },
    # ... добавить остальных членов экипажа
]

# Создать PDF
create_crew_list_with_custom_data(
    'output.pdf',
    'table_structure_complete.json',
    crew_data
)
```

### Вариант 2: Передать структуру ИИ

Отправьте ИИ файл `table_structure_complete.json` или `TABLE_SPECIFICATION.md` с промптом:

```
Создай PDF файл с таблицей Crew List на основе этой структуры.
Используй следующие данные для заполнения:
[ваши данные]
```

### Вариант 3: Использовать другие библиотеки

Структура в JSON формате универсальна и может быть использована с любой библиотекой для создания PDF:
- **Python**: reportlab, PyPDF2, pdfkit
- **JavaScript**: pdfkit, jsPDF, PDFMake
- **Java**: iText, Apache PDFBox
- **C#**: iTextSharp, PdfSharp

## Структура данных для заполнения

Каждый член экипажа должен содержать следующие поля:

```json
{
  "no": "порядковый номер",
  "name": "ФАМИЛИЯ, Имя",
  "rank": "должность",
  "nationality": "гражданство",
  "date_of_birth": "дата рождения (DD.MM.YY)",
  "place_of_birth": "место рождения",
  "passport": "номер паспорта"
}
```

## Информация о судне (заголовок таблицы)

Для изменения информации о судне в заголовке, отредактируйте следующие поля в JSON:

```json
"header_rows": [
  {
    "row": 2,
    "cells": [
      {"text": "1. Name of ship\\nHANNA"},
      {"text": "2. Port of arrival / departure\\nNapoli"},
      {"text": "3. Date of arrival / departure\\n25.05.2026"}
    ]
  },
  {
    "row": 3,
    "cells": [
      {"text": "4. Nationality of Ship\\nCyprus"},
      {"text": "5. Port arrived from / Sailing to\\nAlger / La Spezia"},
      {"text": "6. Nature und No.\\nof identity documents\\nPassport"}
    ]
  }
]
```

## Технические детали

### Система координат
- Начало координат (0, 0) находится в **левом нижнем углу** страницы
- X увеличивается слева направо
- Y увеличивается снизу вверх
- Единица измерения: **points** (1 point = 1/72 дюйма)

### Размеры колонок
1. **No.**: 20.16 points
2. **Family names**: 154.80 points
3. **Rank**: 52.56 points
4. **Nationality**: 48.96 points
5. **Date of birth**: 44.64 points
6. **Place of birth**: 91.44 points
7. **Passport**: 71.28 points

### Особенности таблицы
- Все линии **двойные** (две параллельные линии на расстоянии 0.24-0.72 points)
- Высота строк варьируется от 16.56 до 24.48 points
- Шрифт: Helvetica, размер 8-10 points
- Выравнивание текста: по левому краю с отступом 2 points

## Примеры использования

### Пример 1: Создать пустую таблицу
```python
python create_pdf_from_structure.py
# Создаст crew_list_generated.pdf с оригинальными данными
```

### Пример 2: Заполнить таблицу из Excel
```python
import pandas as pd
from create_pdf_from_structure import create_crew_list_with_custom_data

# Прочитать данные из Excel
df = pd.read_excel('crew_data.xlsx')

# Преобразовать в нужный формат
crew_data = []
for idx, row in df.iterrows():
    crew_data.append({
        'no': str(idx + 1),
        'name': f"{row['Last Name']}, {row['First Name']}",
        'rank': row['Rank'],
        'nationality': row['Nationality'],
        'date_of_birth': row['DOB'].strftime('%d.%m.%y'),
        'place_of_birth': row['Place of Birth'],
        'passport': row['Passport']
    })

# Создать PDF
create_crew_list_with_custom_data('crew_list.pdf', 
                                  'table_structure_complete.json', 
                                  crew_data)
```

### Пример 3: Интеграция с веб-приложением
```python
from flask import Flask, request, send_file
from create_pdf_from_structure import create_crew_list_with_custom_data
import tempfile

app = Flask(__name__)

@app.route('/generate-crew-list', methods=['POST'])
def generate_crew_list():
    crew_data = request.json['crew']
    
    # Создать временный файл
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        create_crew_list_with_custom_data(tmp.name, 
                                          'table_structure_complete.json',
                                          crew_data)
        return send_file(tmp.name, as_attachment=True, 
                        download_name='crew_list.pdf')
```

## Дополнительные возможности

### Добавление логотипа
```python
from reportlab.lib.utils import ImageReader

def add_logo(c, logo_path, x, y, width, height):
    img = ImageReader(logo_path)
    c.drawImage(img, x, y, width, height)
```

### Изменение стиля линий
```python
c.setLineWidth(1.0)  # Толщина линии
c.setStrokeColorRGB(0, 0, 0)  # Цвет линии (черный)
c.setDash([2, 2])  # Пунктирная линия
```

### Добавление водяного знака
```python
c.setFillColorRGB(0.9, 0.9, 0.9)
c.setFont("Helvetica", 60)
c.saveState()
c.translate(300, 400)
c.rotate(45)
c.drawCentredString(0, 0, "DRAFT")
c.restoreState()
```

## Поддержка

Все файлы находятся в папке `C:\CREW\`:
- Исходные данные: `Книга1.pdf`, `Книга1.xlsx`
- Структура: `table_structure_complete.json`, `TABLE_SPECIFICATION.md`
- Скрипты: `create_pdf_from_structure.py`, `extract_pdf_structure.py`, `analyze_table_structure.py`
- Результаты: `crew_list_generated.pdf`, `crew_list_custom.pdf`

Для вопросов и улучшений обращайтесь к документации библиотеки reportlab:
https://www.reportlab.com/docs/reportlab-userguide.pdf
