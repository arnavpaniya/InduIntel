import os
import re
import pandas as pd

PLACEHOLDERS = {
    '-- Unbranded --', '-- No Unilog Brand --', '-- No DIB Brand --',
    'UNBRANDED', 'NO UNILOG BRAND', 'NO DIB BRAND', '', 'NAN', 'NONE'
}

def clean_placeholder(val):
    if val is None or pd.isna(val):
        return None
    val_str = str(val).strip()
    if val_str in PLACEHOLDERS or val_str.upper() in PLACEHOLDERS:
        return None
    return val_str

def parse_part_manuf(part_manuf_str):
    """
    Parses 'Freud Inc (2435)' -> ('Freud Inc', '2435')
    If no code in parentheses, returns (cleaned_str, None)
    """
    if not part_manuf_str:
        return None, None
    
    match = re.search(r'^(.*?)(?:\s*\(([A-Za-z0-9_-]+)\))?$', str(part_manuf_str).strip())
    if match:
        name = match.group(1).strip() if match.group(1) else None
        code = match.group(2).strip() if match.group(2) else None
        return name, code
    return str(part_manuf_str).strip(), None

def load_and_ingest(file_path):
    """
    Loads raw Excel or CSV input file and cleans placeholders and manufacturer info.
    Returns list of dicts representing standardized ingested records.
    """
    if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)

    ingested_rows = []
    for idx, row in df.iterrows():
        mfg_part_num = str(row.get('Mfg_Part_Num', '')).strip() if pd.notna(row.get('Mfg_Part_Num')) else ''
        part_desc = str(row.get('Part_Desc', '')).strip() if pd.notna(row.get('Part_Desc')) else ''
        
        e1_brand = clean_placeholder(row.get('E1_Brand'))
        unilog_brand = clean_placeholder(row.get('Unilog_Brand'))
        dib_brand = clean_placeholder(row.get('DIB_Brand'))
        
        part_manuf_raw = row.get('Part_Manuf')
        manuf_name_raw, manuf_code_raw = parse_part_manuf(part_manuf_raw)
        
        record = {
            'row_id': idx,
            'Mfg_Part_Num': mfg_part_num,
            'Part_Desc': part_desc,
            'E1_Brand': e1_brand,
            'Unilog_Brand': unilog_brand,
            'DIB_Brand': dib_brand,
            'Part_Manuf_Raw': part_manuf_raw,
            'manuf_name_raw': manuf_name_raw,
            'manuf_code_raw': manuf_code_raw
        }
        ingested_rows.append(record)
        
    return ingested_rows

if __name__ == '__main__':
    # Quick test
    sample_file = os.path.join(os.path.dirname(__file__), 'data', 'Sample-1000_Items.xlsx')
    records = load_and_ingest(sample_file)
    print(f"Ingested {len(records)} records successfully.")
    print("Sample record 0:", records[0])
