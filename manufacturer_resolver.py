import os
import pandas as pd
from rapidfuzz import fuzz

class ManufacturerResolver:
    def __init__(self, mfr_brand_file_path=None):
        if mfr_brand_file_path is None:
            mfr_brand_file_path = os.path.join(os.path.dirname(__file__), 'data', 'UniCat_Manufacturer_and_Brand_List.xlsx')
        
        self.mfr_brand_df = pd.read_excel(mfr_brand_file_path)
        # Normalize column names just in case
        self.mfr_brand_df.columns = [c.strip() for c in self.mfr_brand_df.columns]
        
    def resolve(self, raw_manuf_name, raw_manuf_code=None, input_brand=None, min_threshold=70.0):
        """
        Fuzzy matches raw_manuf_name against UniCat_Manufacturer_and_Brand_List.
        Returns:
          {
             'MANUFACTURER_NAME': canonical_mfr_name or None,
             'BRAND_NAME': canonical_brand_name or None,
             'confidence_score': float,
             'needs_review': bool,
             'match_method': str
          }
        """
        if not raw_manuf_name and not input_brand:
            return {
                'MANUFACTURER_NAME': None,
                'BRAND_NAME': None,
                'confidence_score': 0.0,
                'needs_review': True,
                'match_method': 'none'
            }

        best_match = None
        best_score = -1.0

        for idx, row in self.mfr_brand_df.iterrows():
            mfr_name = str(row['MANUFACTURER_NAME']).strip() if pd.notna(row['MANUFACTURER_NAME']) else ''
            mfr_code = str(row['MANUFACTURER_CODE']).strip() if pd.notna(row['MANUFACTURER_CODE']) else ''
            brand_name = str(row['BRAND_NAME']).strip() if pd.notna(row['BRAND_NAME']) else ''
            brand_code = str(row['BRAND_CODE']).strip() if pd.notna(row['BRAND_CODE']) else ''

            # Exact code match bonus
            code_boost = 0.0
            if raw_manuf_code and (raw_manuf_code.upper() == mfr_code.upper() or raw_manuf_code.upper() == brand_code.upper()):
                code_boost = 25.0

            # Score against manufacturer name
            score_mfr = fuzz.token_sort_ratio(raw_manuf_name or '', mfr_name) if raw_manuf_name else 0.0
            
            # Score against brand name if provided or input_brand provided
            score_brand = fuzz.token_sort_ratio(input_brand or raw_manuf_name or '', brand_name) if (input_brand or raw_manuf_name) else 0.0

            total_score = max(score_mfr, score_brand) + code_boost

            if total_score > best_score:
                best_score = total_score
                # Canonical brand: if missing, fallback to manufacturer name
                canonical_brand = brand_name if brand_name else mfr_name
                best_match = {
                    'MANUFACTURER_NAME': mfr_name,
                    'BRAND_NAME': canonical_brand,
                    'raw_score': max(score_mfr, score_brand),
                    'code_boost': code_boost
                }

        # Normalize score to max 100
        final_confidence = min(1.0, best_score / 100.0)

        if best_match and best_score >= min_threshold:
            return {
                'MANUFACTURER_NAME': best_match['MANUFACTURER_NAME'],
                'BRAND_NAME': best_match['BRAND_NAME'],
                'confidence_score': round(final_confidence, 2),
                'needs_review': final_confidence < 0.85,
                'match_method': 'fuzzy_match'
            }
        else:
            return {
                'MANUFACTURER_NAME': None,
                'BRAND_NAME': None,
                'confidence_score': round(final_confidence, 2),
                'needs_review': True,
                'match_method': 'below_threshold'
            }

if __name__ == '__main__':
    resolver = ManufacturerResolver()
    res1 = resolver.resolve("Freud Inc", "2435")
    print("Freud Inc test:", res1)

    res2 = resolver.resolve("Moen Incorporated", "MOEN")
    print("Moen test:", res2)

    res3 = resolver.resolve("Unknown Supplier XYZ", "9999")
    print("Unknown test:", res3)
