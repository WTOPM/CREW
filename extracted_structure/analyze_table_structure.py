import json
import pdfplumber

def create_table_template(pdf_path):
    """Create a detailed template for recreating the table"""

    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]

        result = {
            'page_size': {
                'width': float(page.width),
                'height': float(page.height),
                'unit': 'points'
            },
            'table_structure': {},
            'grid_lines': {
                'horizontal': [],
                'vertical': []
            },
            'cells': [],
            'content': []
        }

        # Find tables
        tables = page.find_tables()

        if tables:
            table = tables[0]
            bbox = table.bbox

            result['table_structure'] = {
                'bbox': {
                    'x0': float(bbox[0]),
                    'y0': float(bbox[1]),
                    'x1': float(bbox[2]),
                    'y1': float(bbox[3]),
                    'width': float(bbox[2] - bbox[0]),
                    'height': float(bbox[3] - bbox[1])
                },
                'rows': len(table.rows),
                'columns': len(table.rows[0].cells) if table.rows else 0
            }

            # Get unique horizontal and vertical lines within table
            h_lines = set()
            v_lines = set()

            for edge in page.edges:
                x0, y0, x1, y1 = edge['x0'], edge['y0'], edge['x1'], edge['y1']

                # Check if line is within table bounds
                if (bbox[0] <= x0 <= bbox[2] and bbox[1] <= y0 <= bbox[3]):
                    if edge['orientation'] == 'h':
                        h_lines.add(round(y0, 2))
                    elif edge['orientation'] == 'v':
                        v_lines.add(round(x0, 2))

            result['grid_lines']['horizontal'] = sorted(list(h_lines))
            result['grid_lines']['vertical'] = sorted(list(v_lines))

            # Extract cell structure
            for row_idx, row in enumerate(table.rows):
                for col_idx, cell in enumerate(row.cells):
                    if cell:
                        cell_info = {
                            'row': row_idx,
                            'col': col_idx,
                            'x0': float(cell[0]) if cell[0] else None,
                            'y0': float(cell[1]) if cell[1] else None,
                            'x1': float(cell[2]) if cell[2] else None,
                            'y1': float(cell[3]) if cell[3] else None
                        }

                        if all([cell[0], cell[1], cell[2], cell[3]]):
                            cell_info['width'] = float(cell[2] - cell[0])
                            cell_info['height'] = float(cell[3] - cell[1])

                        result['cells'].append(cell_info)

            # Extract table data with positions
            table_data = table.extract()
            for row_idx, row in enumerate(table_data):
                for col_idx, cell_text in enumerate(row):
                    if cell_text:
                        result['content'].append({
                            'row': row_idx,
                            'col': col_idx,
                            'text': cell_text
                        })

        return result

if __name__ == '__main__':
    pdf_path = r'C:\CREW\Книга1.pdf'

    print("Analyzing table structure...")
    template = create_table_template(pdf_path)

    # Save template
    output_path = r'C:\CREW\table_template.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(template, f, indent=2, ensure_ascii=False)

    print(f"\nTable template saved to: {output_path}")
    print(f"\nTable Summary:")
    print(f"Page size: {template['page_size']['width']} x {template['page_size']['height']} points")

    if template['table_structure']:
        ts = template['table_structure']
        print(f"\nTable bounds:")
        print(f"  Position: ({ts['bbox']['x0']:.2f}, {ts['bbox']['y0']:.2f})")
        print(f"  Size: {ts['bbox']['width']:.2f} x {ts['bbox']['height']:.2f}")
        print(f"  Rows: {ts['rows']}")
        print(f"  Columns: {ts['columns']}")

    print(f"\nGrid lines:")
    print(f"  Horizontal: {len(template['grid_lines']['horizontal'])} lines")
    print(f"  Vertical: {len(template['grid_lines']['vertical'])} lines")
    print(f"\nCells: {len(template['cells'])}")
    print(f"Content entries: {len(template['content'])}")

    # Show first few content entries
    print(f"\nSample content:")
    for item in template['content'][:10]:
        print(f"  Row {item['row']}, Col {item['col']}: {item['text']}")
