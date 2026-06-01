"""
Пример создания PDF таблицы Crew List на основе извлеченной структуры
Использует библиотеку reportlab для генерации PDF
"""

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
import json

def load_table_structure(json_path):
    """Загрузить структуру таблицы из JSON"""
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def draw_double_line_horizontal(c, x0, x1, y1, y2):
    """Нарисовать двойную горизонтальную линию"""
    c.line(x0, y1, x1, y1)
    c.line(x0, y2, x1, y2)

def draw_vertical_lines(c, structure):
    """Нарисовать все вертикальные линии таблицы"""
    table_bbox = structure['table']['bbox']
    y_start = table_bbox['y0']
    y_end = table_bbox['y1']

    for line in structure['vertical_lines']:
        x = line['x']
        c.line(x, y_start, x, y_end)

def draw_horizontal_lines(c, structure):
    """Нарисовать все горизонтальные линии таблицы"""
    table_bbox = structure['table']['bbox']
    x_start = 79.44  # Левая граница
    x_end = 562.56   # Правая граница

    # Верхняя граница таблицы
    c.line(x_start, table_bbox['y0'], x_end, table_bbox['y0'])

    # Все горизонтальные линии
    for line in structure['horizontal_lines']:
        draw_double_line_horizontal(c, x_start, x_end, line['y'], line['y_double'])

    # Нижняя граница таблицы
    c.line(x_start, table_bbox['y1'], x_end, table_bbox['y1'])

def draw_text_in_cell(c, text, x, y, width, height, font_size=9):
    """Нарисовать текст в ячейке с учетом переносов строк"""
    c.setFont("Helvetica", font_size)

    lines = text.split('\\n')
    line_height = font_size + 2

    # Начинаем с верхней части ячейки
    current_y = y - line_height

    for line in lines:
        if current_y > (y - height + 2):  # Проверка, что не выходим за границы
            c.drawString(x + 2, current_y, line)
            current_y -= line_height

def draw_header_rows(c, structure):
    """Нарисовать заголовочные строки"""
    for header_row in structure['header_rows']:
        for cell in header_row['cells']:
            x = cell['x0']
            y = cell['y1']  # Верхняя граница ячейки
            width = cell['x1'] - cell['x0']
            height = cell['y1'] - cell['y0']
            text = cell['text']

            draw_text_in_cell(c, text, x, y, width, height)

def draw_data_rows(c, structure):
    """Нарисовать строки с данными экипажа"""
    columns = structure['columns']

    for data_row in structure['data_rows']:
        y_top = data_row['y1']
        y_bottom = data_row['y0']
        height = y_top - y_bottom
        data = data_row['data']

        # Колонка 0: No.
        draw_text_in_cell(c, data['no'],
                         columns[0]['x0'], y_top,
                         columns[0]['width'], height)

        # Колонка 1: Name
        draw_text_in_cell(c, data['name'],
                         columns[1]['x0'], y_top,
                         columns[1]['width'], height)

        # Колонка 2: Rank
        draw_text_in_cell(c, data['rank'],
                         columns[2]['x0'], y_top,
                         columns[2]['width'], height)

        # Колонка 3: Nationality
        draw_text_in_cell(c, data['nationality'],
                         columns[3]['x0'], y_top,
                         columns[3]['width'], height)

        # Колонка 4: Date of birth
        draw_text_in_cell(c, data['date_of_birth'],
                         columns[4]['x0'], y_top,
                         columns[4]['width'], height)

        # Колонка 5: Place of birth
        draw_text_in_cell(c, data['place_of_birth'],
                         columns[5]['x0'], y_top,
                         columns[5]['width'], height)

        # Колонка 6: Passport
        draw_text_in_cell(c, data['passport'],
                         columns[6]['x0'], y_top,
                         columns[6]['width'], height)

def create_crew_list_pdf(output_path, structure_path):
    """
    Создать PDF файл Crew List

    Args:
        output_path: Путь для сохранения PDF
        structure_path: Путь к JSON файлу со структурой таблицы
    """
    # Загрузить структуру
    structure = load_table_structure(structure_path)

    # Создать canvas
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    print(f"Creating PDF: {output_path}")
    print(f"Page size: {width} x {height} points")

    # Установить толщину линий
    c.setLineWidth(0.5)

    # Нарисовать структуру таблицы
    print("Drawing vertical lines...")
    draw_vertical_lines(c, structure)

    print("Drawing horizontal lines...")
    draw_horizontal_lines(c, structure)

    print("Filling headers...")
    draw_header_rows(c, structure)

    print("Filling crew data...")
    draw_data_rows(c, structure)

    # Сохранить PDF
    c.save()
    print(f"PDF created successfully: {output_path}")

def create_crew_list_with_custom_data(output_path, structure_path, crew_data):
    """
    Создать PDF файл Crew List с пользовательскими данными

    Args:
        output_path: Путь для сохранения PDF
        structure_path: Путь к JSON файлу со структурой таблицы
        crew_data: Список словарей с данными экипажа
                   Формат: [{'no': '1', 'name': 'Name', 'rank': 'Rank', ...}, ...]
    """
    structure = load_table_structure(structure_path)

    # Заменить данные в структуре
    for i, crew_member in enumerate(crew_data):
        if i < len(structure['data_rows']):
            structure['data_rows'][i]['data'] = crew_member

    # Создать PDF
    create_crew_list_pdf(output_path, structure_path)

# Пример использования
if __name__ == '__main__':
    # Путь к файлу структуры
    structure_file = r'C:\CREW\table_structure_complete.json'

    # Создать точную копию оригинальной таблицы
    output_file = r'C:\CREW\crew_list_generated.pdf'
    create_crew_list_pdf(output_file, structure_file)

    # Или создать таблицу с новыми данными
    custom_crew = [
        {
            'no': '1',
            'name': 'IVANOV, Ivan',
            'rank': 'Captain',
            'nationality': 'Russia',
            'date_of_birth': '01.01.80',
            'place_of_birth': 'Moscow',
            'passport': 'RU123456'
        },
        {
            'no': '2',
            'name': 'PETROV, Petr',
            'rank': 'Engineer',
            'nationality': 'Russia',
            'date_of_birth': '15.05.85',
            'place_of_birth': 'St. Petersburg',
            'passport': 'RU789012'
        }
    ]

    output_custom = r'C:\CREW\crew_list_custom.pdf'
    create_crew_list_with_custom_data(output_custom, structure_file, custom_crew)
