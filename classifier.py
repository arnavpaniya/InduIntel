import os
import re
import pandas as pd
from rapidfuzz import fuzz

class Classifier:
    def __init__(self, target_categories=None):
        self.data_dir = os.path.join(os.path.dirname(__file__), 'data')
        self.target_categories = [c.lower() for c in target_categories] if target_categories else ['faucets', 'fittings']
        
        # Load Faucets LOV Summary
        faucets_path = os.path.join(self.data_dir, 'FAUCETS_LOV.xlsx')
        faucets_df = pd.read_excel(faucets_path, sheet_name='Summary') if os.path.exists(faucets_path) else pd.DataFrame()
        
        # Load Fittings LOV Summary
        fittings_path = os.path.join(self.data_dir, 'Fittings_LOV.xlsx')
        fittings_df = pd.read_excel(fittings_path, sheet_name='Summary') if os.path.exists(fittings_path) else pd.DataFrame()
        
        # Load Master Unicat LOV
        unicat_path = os.path.join(self.data_dir, 'Unicat_Lov_v1_0_Updated_With_Remarks.xlsx')
        unicat_df = pd.read_excel(unicat_path) if os.path.exists(unicat_path) else pd.DataFrame()
        
        self.classpaths = {}
        
        # Register Faucets classpaths
        for _, row in faucets_df.iterrows():
            cp = str(row['Classpath']).strip()
            unspsc = str(row.get('UNSPSC', '')).strip()
            self.classpaths[cp] = {
                'UNSPSC': unspsc,
                'Category': 'faucets',
                'keywords': ['faucet', 'sink', 'lavatory', 'bath', 'kitchen', 'tub', 'shower', 'bar', 'utility']
            }
            
        # Register Fittings classpaths
        for _, row in fittings_df.iterrows():
            cp = str(row['Classpath']).strip()
            unspsc = str(row.get('UNSPSC', '')).strip()
            self.classpaths[cp] = {
                'UNSPSC': unspsc,
                'Category': 'fittings',
                'keywords': ['fitting', 'elbow', 'tee', 'coupling', 'adapter', 'nipple', 'pipe', 'tube', 'hose', 'bush', 'union', 'cap', 'plug', 'wrot', 'wrot pressure', 'push-to-connect']
            }

        # Register general classpaths from Unicat LOV
        for _, row in unicat_df.iterrows():
            cp = str(row['Classpath']).strip()
            if cp and cp not in self.classpaths:
                leaf = str(row.get('Leaf Node', '')).strip()
                self.classpaths[cp] = {
                    'UNSPSC': '',
                    'Category': 'general',
                    'keywords': [k.lower() for k in leaf.split() if len(k) > 2]
                }

    def classify(self, part_desc, mfr_name=None, brand_name=None):
        if not part_desc:
            return {
                'Classpath': 'unclassified / needs manual mapping',
                'UNSPSC': '',
                'category_group': 'unclassified',
                'is_in_scope': False,
                'classification_confidence': 0.0
            }

        desc_lower = part_desc.lower()
        best_cp = None
        best_score = -1.0
        
        for cp, meta in self.classpaths.items():
            cat = meta['Category']
            cp_lower = cp.lower()
            
            score = fuzz.token_set_ratio(desc_lower, cp_lower)
            
            # Boost score significantly if exact keywords match
            kw_hits = sum(1 for kw in meta['keywords'] if kw in desc_lower)
            if kw_hits > 0:
                score += (kw_hits * 20.0)
                    
            if score > best_score:
                best_score = score
                best_cp = cp
                
        # Confidence score capped at 1.0
        conf = min(1.0, max(0.0, best_score) / 100.0)

        # Check threshold and scope
        if best_cp and best_score >= 50.0:
            meta = self.classpaths[best_cp]
            cat_group = meta['Category']
            is_in_scope = cat_group in self.target_categories
            
            if is_in_scope:
                return {
                    'Classpath': best_cp,
                    'UNSPSC': meta['UNSPSC'],
                    'category_group': cat_group,
                    'is_in_scope': True,
                    'classification_confidence': round(conf, 2)
                }
                
        return {
            'Classpath': 'unclassified / needs manual mapping',
            'UNSPSC': '',
            'category_group': 'unclassified',
            'is_in_scope': False,
            'classification_confidence': round(conf, 2)
        }

if __name__ == '__main__':
    classifier = Classifier(target_categories=['faucets', 'fittings'])
    
    test1 = classifier.classify("Moen 6702-000 Genta Single Handle Bathroom Sink Faucet Chrome")
    print("Faucet test:", test1)
    
    test2 = classifier.classify("Nibco 607 1/2 1/2 in Copper Wrot Pressure 90 Deg Elbow")
    print("Fitting test:", test2)
    
    test3 = classifier.classify("Diablo 1/2 in x 18 in Sanding Belt 6pc")
    print("Sanding belt (out of scope) test:", test3)
