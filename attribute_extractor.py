import os
import re
import pandas as pd
from rapidfuzz import fuzz
from uom_normalizer import UOMNormalizer

class AttributeExtractor:
    def __init__(self):
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        self.uom_normalizer = UOMNormalizer()
        
        # Load Faucets LOV Detail
        faucets_path = os.path.join(data_dir, 'FAUCETS_LOV.xlsx')
        faucets_df = pd.read_excel(faucets_path, sheet_name='Attribute Detail') if os.path.exists(faucets_path) else pd.DataFrame()
        
        # Load Fittings LOV Detail
        fittings_path = os.path.join(data_dir, 'Fittings_LOV.xlsx')
        fittings_df = pd.read_excel(fittings_path, sheet_name='Attribute Detail') if os.path.exists(fittings_path) else pd.DataFrame()
        
        # Load Master Unicat LOV
        unicat_path = os.path.join(data_dir, 'Unicat_Lov_v1_0_Updated_With_Remarks.xlsx')
        unicat_df = pd.read_excel(unicat_path) if os.path.exists(unicat_path) else pd.DataFrame()
        
        self.classpath_attrs = {}
        
        for df in [faucets_df, fittings_df, unicat_df]:
            if df.empty:
                continue
            for _, row in df.iterrows():
                cp = str(row.get('Classpath', '')).strip()
                label = str(row.get('Attribute Label', '')).strip()
                order = row.get('Attribute Order', 99)
                filtering = str(row.get('Filtering Y/N', 'N')).strip().upper()
                
                raw_vals = str(row.get('Allowed Values', row.get('Attribute Values', ''))).strip()
                norm_vals = str(row.get('Normalized Values', raw_vals)).strip()
                uom = str(row.get('UOM', '')).strip() if pd.notna(row.get('UOM')) else ''
                
                if not cp or not label:
                    continue
                    
                if cp not in self.classpath_attrs:
                    self.classpath_attrs[cp] = []
                    
                # Parse allowed values into a set
                allowed_set = set()
                if raw_vals and raw_vals.lower() != 'nan':
                    for v in raw_vals.split(','):
                        v_clean = v.strip()
                        if v_clean:
                            allowed_set.add(v_clean)
                if norm_vals and norm_vals.lower() != 'nan':
                    for v in norm_vals.split(','):
                        v_clean = v.strip()
                        if v_clean:
                            allowed_set.add(v_clean)

                # Avoid duplicate labels for same classpath
                existing_labels = [a['label'] for a in self.classpath_attrs[cp]]
                if label not in existing_labels:
                    self.classpath_attrs[cp].append({
                        'label': label,
                        'order': order,
                        'filtering': filtering == 'Y',
                        'allowed_values': allowed_set,
                        'uom': uom
                    })

        # Sort attributes by order per classpath
        for cp in self.classpath_attrs:
            self.classpath_attrs[cp].sort(key=lambda x: x['order'])

    def extract_attributes(self, classpath, part_desc):
        """
        Extracts valid attributes for the given classpath from part_desc.
        Returns a list of tuples:
        [ (ATTRIBUTE_LABEL, ATTRIBUTE_VALUE, ATTRIBUTE_UOM), ... ]
        Output strictly contains ONLY labels and values defined in LOV for that classpath.
        """
        if not classpath or classpath not in self.classpath_attrs or not part_desc:
            return []

        allowed_attrs = self.classpath_attrs[classpath]
        desc_lower = part_desc.lower()
        extracted = []
        
        for attr in allowed_attrs:
            label = attr['label']
            allowed_vals = attr['allowed_values']
            default_uom = attr['uom']
            
            matched_val = None
            matched_uom = ""
            best_score = -1.0
            
            for val in allowed_vals:
                val_lower = val.lower()
                
                # Check for exact substring match in part_desc
                if val_lower in desc_lower:
                    score = 100.0 + len(val_lower)  # Prefer longer matches
                    if score > best_score:
                        best_score = score
                        matched_val = val
                else:
                    # Token similarity match
                    sim = fuzz.partial_ratio(val_lower, desc_lower)
                    if sim >= 85.0 and sim > best_score:
                        best_score = sim
                        matched_val = val

            if matched_val:
                # Normalize numeric value and UOM
                norm_val, norm_uom = self.uom_normalizer.normalize_value_and_uom(matched_val, default_uom)
                extracted.append({
                    'label': label,
                    'value': norm_val,
                    'uom': norm_uom,
                    'filtering': attr['filtering']
                })

        return extracted

if __name__ == '__main__':
    extractor = AttributeExtractor()
    cp = "Plumbing>Faucets>Bathroom Sink Faucets"
    desc = "Moen 6702-000 Genta Single Handle Bathroom Sink Faucet Chrome 1.2 gpm 4in"
    attrs = extractor.extract_attributes(cp, desc)
    print(f"Extracted attributes for '{desc}':")
    for a in attrs:
        print(" ", a)
