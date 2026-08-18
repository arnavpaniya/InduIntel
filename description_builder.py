import os
import re

class DescriptionBuilder:
    def __init__(self):
        pass

    def build_descriptions(self, record):
        """
        Builds deterministic description fields per UNILOG_INTERNAL_CONTENT_GUIDELINES.docx:
        - INVOICE_DESC (<=40 chars, ALL CAPS)
        - MOBILE_DESC (60-80 chars)
        - SHORT_DESC (Product Title)
        - LONG_DESC1 (Full Specifications)
        """
        brand = record.get('BRAND_NAME') or record.get('MANUFACTURER_NAME') or ''
        mfr_part = record.get('MANUFACTURER_PART_NUMBER') or record.get('Mfg_Part_Num') or ''
        classpath = record.get('Classpath') or ''
        attributes = record.get('attributes') or []

        # Extract Item Type from Classpath (leaf node)
        item_type = classpath.split('>')[-1] if '>' in classpath else classpath
        if item_type == 'unclassified / needs manual mapping':
            item_type = 'Product'

        # Key specs string from extracted attributes
        attr_specs = []
        for a in attributes:
            val_str = f"{a['value']} {a['uom']}".strip() if a['uom'] else f"{a['value']}".strip()
            if val_str:
                attr_specs.append(val_str)
                
        attr_summary = ", ".join(attr_specs)

        # 1. SHORT_DESC (Product Title)
        # Formula: Brand + MPN + Item Type + Key Attributes
        if attr_summary:
            short_desc = f"{brand} {mfr_part} {item_type}, {attr_summary}".strip()
        else:
            short_desc = f"{brand} {mfr_part} {item_type}".strip()
            
        # Clean extra commas/spaces
        short_desc = re.sub(r'\s+', ' ', short_desc).strip()

        # 2. LONG_DESC1
        long_desc1 = short_desc

        # 3. MOBILE_DESC (Target 60-80 chars)
        mobile_desc = f"{brand} {mfr_part} {item_type}"
        if attr_specs:
            for spec in attr_specs:
                candidate = f"{mobile_desc}, {spec}"
                if len(candidate) <= 80:
                    mobile_desc = candidate
                else:
                    break
                    
        # Truncate strictly at 80 chars if needed
        if len(mobile_desc) > 80:
            mobile_desc = mobile_desc[:77] + "..."

        # 4. INVOICE_DESC (<=40 chars, ALL CAPS)
        invoice_raw = f"{brand} {mfr_part} {item_type}".upper()
        # Clean special symbols for invoice
        invoice_raw = re.sub(r'[®™]', '', invoice_raw)
        invoice_raw = re.sub(r'\s+', ' ', invoice_raw).strip()
        
        if len(invoice_raw) > 40:
            invoice_desc = invoice_raw[:40].strip()
        else:
            invoice_desc = invoice_raw

        return {
            'INVOICE_DESC': invoice_desc,
            'MOBILE_DESC': mobile_desc,
            'SHORT_DESC': short_desc,
            'LONG_DESC1': long_desc1
        }

if __name__ == '__main__':
    builder = DescriptionBuilder()
    record = {
        'MANUFACTURER_NAME': 'Moen Incorporated',
        'BRAND_NAME': 'MOEN®',
        'MANUFACTURER_PART_NUMBER': '6702-000',
        'Classpath': 'Plumbing>Faucets>Bathroom Sink Faucets',
        'attributes': [
            {'label': 'Faucet Handle Type', 'value': 'Lever', 'uom': ''},
            {'label': 'Faucet Hole Center', 'value': '4', 'uom': 'in'},
            {'label': 'Flow Rate', 'value': '1.2', 'uom': 'gpm'},
            {'label': 'Finish/Color', 'value': 'Chrome', 'uom': ''}
        ]
    }
    res = builder.build_descriptions(record)
    print("Description Builder Test:")
    for k, v in res.items():
        print(f"  {k} ({len(v)} chars): {v}")
