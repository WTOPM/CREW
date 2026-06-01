import pdfplumber
import json

def extract_table_structure(pdf_path):
    """Extract detailed table structure with coordinates of all lines"""

    with pdfplumber.open(pdf_path) as pdf:
        result = {
            'pages': [],
            'metadata': {
                'total_pages': len(pdf.pages),
                'file': pdf_path
            }
        }

        for page_num, page in enumerate(pdf.pages, 1):
            page_info = {
                'page_number': page_num,
                'width': float(page.width),
                'height': float(page.height),
                'horizontal_lines': [],
                'vertical_lines': [],
                'rectangles': [],
                'text_elements': [],
                'tables': []
            }

            # Extract all lines (edges)
            edges = page.edges
            for edge in edges:
                line_info = {
                    'x0': float(edge['x0']),
                    'y0': float(edge['y0']),
                    'x1': float(edge['x1']),
                    'y1': float(edge['y1']),
                    'width': float(edge.get('width', 0)),
                    'height': float(edge.get('height', 0)),
                    'orientation': edge.get('orientation', 'unknown')
                }

                if edge['orientation'] == 'h':
                    page_info['horizontal_lines'].append(line_info)
                elif edge['orientation'] == 'v':
                    page_info['vertical_lines'].append(line_info)

            # Extract rectangles
            rects = page.rects
            for rect in rects:
                rect_info = {
                    'x0': float(rect['x0']),
                    'y0': float(rect['y0']),
                    'x1': float(rect['x1']),
                    'y1': float(rect['y1']),
                    'width': float(rect['width']),
                    'height': float(rect['height'])
                }
                page_info['rectangles'].append(rect_info)

            # Extract text with positions
            words = page.extract_words()
            for word in words:
                text_info = {
                    'text': word['text'],
                    'x0': float(word['x0']),
                    'y0': float(word['top']),
                    'x1': float(word['x1']),
                    'y1': float(word['bottom']),
                    'fontname': word.get('fontname', ''),
                    'size': float(word.get('size', 0))
                }
                page_info['text_elements'].append(text_info)

            # Extract table structure
            tables = page.find_tables()
            for table_idx, table in enumerate(tables):
                table_info = {
                    'table_index': table_idx,
                    'bbox': {
                        'x0': float(table.bbox[0]),
                        'y0': float(table.bbox[1]),
                        'x1': float(table.bbox[2]),
                        'y1': float(table.bbox[3])
                    },
                    'rows': [],
                    'cells': []
                }

                # Extract table data
                table_data = table.extract()
                if table_data:
                    table_info['data'] = table_data

                # Get cell coordinates
                for row_idx, row in enumerate(table.rows):
                    row_info = {
                        'row_index': row_idx,
                        'cells': []
                    }
                    for cell_idx, cell in enumerate(row.cells):
                        if cell:
                            cell_info = {
                                'cell_index': cell_idx,
                                'x0': float(cell[0]) if cell[0] else None,
                                'y0': float(cell[1]) if cell[1] else None,
                                'x1': float(cell[2]) if cell[2] else None,
                                'y1': float(cell[3]) if cell[3] else None
                            }
                            row_info['cells'].append(cell_info)
                    table_info['rows'].append(row_info)

                page_info['tables'].append(table_info)

            result['pages'].append(page_info)

        return result

if __name__ == '__main__':
    pdf_path = r'C:\CREW\Книга1.pdf'

    print("Extracting PDF structure...")
    structure = extract_table_structure(pdf_path)

    # Save to JSON
    output_path = r'C:\CREW\pdf_structure.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(structure, f, indent=2, ensure_ascii=False)

    print(f"\nStructure saved to: {output_path}")
    print(f"\nSummary:")
    print(f"Total pages: {structure['metadata']['total_pages']}")

    for page in structure['pages']:
        print(f"\nPage {page['page_number']}:")
        print(f"  Size: {page['width']} x {page['height']}")
        print(f"  Horizontal lines: {len(page['horizontal_lines'])}")
        print(f"  Vertical lines: {len(page['vertical_lines'])}")
        print(f"  Rectangles: {len(page['rectangles'])}")
        print(f"  Text elements: {len(page['text_elements'])}")
        print(f"  Tables found: {len(page['tables'])}")
