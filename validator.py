import os

class PipelineValidator:
    def __init__(self):
        pass

    def validate_row(self, processed_record):
        """
        Validates a processed row record against business rules and computes quality metrics.
        Returns:
          {
             'attributes_matched_pct': float (0.0 to 100.0),
             'invoice_desc_pass': bool,
             'mobile_desc_pass': bool,
             'brand_mfr_mismatch': bool,
             'overall_confidence_score': float (0.0 to 1.0),
             'needs_human_review': bool,
             'validation_notes': list of str
          }
        """
        notes = []
        
        # 1. Attributes matched %
        extracted_attrs = processed_record.get('attributes') or []
        possible_attrs_count = processed_record.get('total_possible_attrs_count', len(extracted_attrs))
        
        if possible_attrs_count > 0:
            attr_pct = round((len(extracted_attrs) / max(1, possible_attrs_count)) * 100.0, 1)
        else:
            attr_pct = 100.0 if len(extracted_attrs) > 0 else 0.0

        # 2. Character limit checks
        inv_desc = processed_record.get('INVOICE_DESC') or ''
        mob_desc = processed_record.get('MOBILE_DESC') or ''
        
        inv_pass = len(inv_desc) <= 40
        mob_pass = len(mob_desc) <= 80
        
        if not inv_pass:
            notes.append(f"INVOICE_DESC exceeds 40 chars ({len(inv_desc)})")
        if not mob_pass:
            notes.append(f"MOBILE_DESC exceeds 80 chars ({len(mob_desc)})")

        # 3. Brand/Manufacturer mismatch check
        mfr_name = processed_record.get('MANUFACTURER_NAME')
        brand_name = processed_record.get('BRAND_NAME')
        
        brand_mfr_mismatch = False
        if mfr_name and brand_name:
            if mfr_name.lower() not in brand_name.lower() and brand_name.lower() not in mfr_name.lower():
                brand_mfr_mismatch = True
                notes.append("Brand and Manufacturer names do not reference each other")

        # 4. Overall Confidence Score calculation
        mfr_conf = processed_record.get('mfr_confidence', 0.0)
        cls_conf = processed_record.get('class_confidence', 0.0)
        attr_conf = attr_pct / 100.0
        
        overall_conf = round(0.35 * mfr_conf + 0.45 * cls_conf + 0.20 * attr_conf, 2)

        # 5. Human review decision
        is_unclassified = processed_record.get('Classpath') == 'unclassified / needs manual mapping'
        needs_review = (
            overall_conf < 0.80 or
            is_unclassified or
            not inv_pass or
            not mob_pass or
            brand_mfr_mismatch or
            not mfr_name or
            not brand_name
        )

        return {
            'attributes_matched_pct': attr_pct,
            'invoice_desc_pass': inv_pass,
            'mobile_desc_pass': mob_pass,
            'brand_mfr_mismatch': brand_mfr_mismatch,
            'overall_confidence_score': overall_conf,
            'needs_human_review': needs_review,
            'validation_notes': notes
        }

if __name__ == '__main__':
    validator = PipelineValidator()
    rec = {
        'MANUFACTURER_NAME': 'Moen Incorporated',
        'BRAND_NAME': 'MOEN®',
        'Classpath': 'Plumbing>Faucets>Bathroom Sink Faucets',
        'INVOICE_DESC': 'MOEN 6702-000 BATHROOM SINK FAUCETS',
        'MOBILE_DESC': 'MOEN® 6702-000 Bathroom Sink Faucets, Lever, 4 in, 1.2 gpm, Chrome',
        'attributes': [{'label': 'Finish', 'value': 'Chrome'}],
        'total_possible_attrs_count': 1,
        'mfr_confidence': 1.0,
        'class_confidence': 0.96
    }
    v_res = validator.validate_row(rec)
    print("Validator Test Output:", v_res)
