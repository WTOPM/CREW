"""
Улучшенный скрипт создания PDF таблицы Crew List
Правильно обрабатывает двойные линии и структуру таблицы
"""

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
import json

def load_table_structure(json_path):
    """Загрузить структуру таблицы из JSON"""
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def draw_table_borders(c, structure):
    """Нарисовать внешние границы таблицы"""
    bbox = structure['table']['bbox']

    # Толщина линии
    c.setLineWidth(0.5)

    # Верхняя граница
    c.line(bbox['x0'], bbox['y1'], bbox['x1'], bbox['y1'])

    # Нижняя граница
    c.line(bbox['x0'], bbox['y0'], bbox['x1'], bbox['y0'])

    # Левая граница
    c.line(bbox['x0'], bbox['y0'], bbox['x0'], bbox['y1'])

    # Правая граница
    c.line(bbox['x1'], bbox['y0'], bbox['x1'], bbox['y1'])

def draw_column_lines(c, structure):
    """Нарисовать вертикальные линии колонок"""
    bbox = structure['table']['bbox']
    columns = structure['columns']

    c.setLineWidth(0.5)

    # Рисуем линии между колонками
    for i in range(len(columns) - 1):
        x = columns[i]['x1']
        c.line(x, bbox['y0'], x, bbox['y1'])

def draw_row_lines(c, structure):
    """Нарисовать горизонтальные линии строк"""
    bbox = structure['table']['bbox']

    c.setLineWidth(0.5)

    # Собираем уникальные Y координаты из строк данных
    y_coords = set()

    # Добавляем координаты из data_rows
    for row in structure.get('data_rows', []):
        y_coords.add(row['y0'])
        y_coords.add(row['y1'])

    # Добавляем координаты из header_rows
    for header_row in structure.get('header_rows', []):
        for cell in header_row.get('cells', []):
            y_coords.add(cell['y0'])
            y_coords.add(cell['y1'])

    # Рисуем горизонтальные линии
    for y in sorted(y_coords):
        if bbox['y0'] < y < bbox['y1']:  # Не рисуем границы (они уже нарисованы)
            c.line(bbox['x0'], y, bbox['x1'], y)

def draw_text_in_cell(c, text, x, y, width, height, font_size=8):
    """Нарисовать текст в ячейке"""
    if not text:
        return

    c.setFont("Helvetica", font_size)

    lines = text.split('\\n')
    line_height = font_size + 2

    # Начинаем с верхней части ячейки с небольшим отступом
    current_y = y - line_height - 1

    for line in lines:
        if current_y > (y - height + 2):
            c.drawString(x + 3, current_y, line)
            current_y -= line_height

def draw_header_content(c, structure):
    """Нарисовать содержимое заголовков"""
    for header_row in structure['header_rows']:
        for cell in header_row['cells']:
            x = cell['x0']
            y = cell['y1']
            width = cell['x1'] - cell['x0']
            height = cell['y1'] - cell['y0']
            text = cell['text']

            # Используем меньший шрифт для заголовков
            draw_text_in_cell(c, text, x, y, width, height, font_size=7)

def draw_data_content(c, structure):
    """Нарисовать содержимое данных"""
    columns = structure['columns']

    for data_row in structure['data_rows']:
        y_top = data_row['y1']
        y_bottom = data_row['y0']
        height = y_top - y_bottom
        data = data_row['data']

        # Рисуем каждую колонку
        fields = ['no', 'name', 'rank', 'nationality', 'date_of_birth', 'place_of_birth', 'passport']

        for i, field in enumerate(fields):
            if i < len(columns) and field in data:
                draw_text_in_cell(
                    c,
                    data[field],
                    columns[i]['x0'],
                    y_top,
                    columns[i]['width'],
                    height,
                    font_size=8
                )

def create_crew_list_pdf(output_path, structure_path, crew_data=None):
    """
    Создать PDF файл Crew List

    Args:
        output_path: Путь для сохранения PDF
        structure_path: Путь к JSON файлу со структурой таблицы
        crew_data: Опциональные данные экипажа для заполнения
    """
    # Загрузить структуру
    structure = load_table_structure(structure_path)

    # Если переданы новые данные, заменить их
    if crew_data:
        for i, crew_member in enumerate(crew_data):
            if i < len(structure['data_rows']):
                structure['data_rows'][i]['data'] = crew_member

    # Создать canvas
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    print(f"Creating PDF: {output_path}")
    print(f"Page size: {width:.2f} x {height:.2f} points")

    # 1. Нарисовать внешние границы таблицы
    print("Drawing table borders...")
    draw_table_borders(c, structure)

    # 2. Нарисовать вертикальные линии колонок
    print("Drawing column lines...")
    draw_column_lines(c, structure)

    # 3. Нарисовать горизонтальные линии строк
    print("Drawing row lines...")
    draw_row_lines(c, structure)

    # 4. Заполнить заголовки
    print("Filling headers...")
    draw_header_content(c, structure)

    # 5. Заполнить данные
    print("Filling data...")
    draw_data_content(c, structure)

    # Сохранить PDF
    c.save()
    print(f"PDF created successfully: {output_path}")

# Пример использования
if __name__ == '__main__':
    structure_file = r'C:\CREW\extracted_structure\table_structure_complete.json'

    # Создать точную копию оригинальной таблицы
    output_file = r'C:\CREW\crew_list_v2.pdf'
    create_crew_list_pdf(output_file, structure_file)

    print("\nDone! Check the generated PDF file.")
