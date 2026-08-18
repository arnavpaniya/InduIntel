import os
import sys
import json
import argparse
import pandas as pd
from ingest import load_and_ingest
from manufacturer_resolver import ManufacturerResolver
from classifier import Classifier
from attribute_extractor import AttributeExtractor
from uom_normalizer import UOMNormalizer
from description_builder import DescriptionBuilder
from validator import PipelineValidator
from data_loader import UNILOG_252_HEADERS, setup_data_files

def run_pipeline(input_file, target_categories=['faucets', 'fittings'], output_csv='output.csv', debug_json='trace_debug.json'):
    print(f"Initializing pipeline for input: {input_file}")
    print(f"Target categories: {target_categories}")

    # Ensure reference data files exist
    setup_data_files()

    # 1. Ingest raw records
    raw_records = load_and_ingest(input_file)
    print(f"Ingested {len(raw_records)} raw product records.")

    # 2. Instantiate pipeline modules
    mfr_resolver = ManufacturerResolver()
    classifier = Classifier(target_categories=target_categories)
    extractor = AttributeExtractor()
    desc_builder = DescriptionBuilder()
    validator = PipelineValidator()

    output_rows = []
    trace_logs = []
    
    in_scope_count = 0
    unclassified_count = 0

    for idx, rec in enumerate(raw_records):
        row_trace = {
            'row_id': idx,
            'input_mfg_part': rec['Mfg_Part_Num'],
            'input_part_desc': rec['Part_Desc'],
            'input_manuf_raw': rec['Part_Manuf_Raw']
        }

        # Stage 2: Manufacturer & Brand Resolution
        mfr_res = mfr_resolver.resolve(rec['manuf_name_raw'], rec['manuf_code_raw'], rec['E1_Brand'])
        row_trace['stage_2_mfr_resolution'] = mfr_res

        # Stage 3: Classpath Classification
        cls_res = classifier.classify(rec['Part_Desc'], mfr_res['MANUFACTURER_NAME'], mfr_res['BRAND_NAME'])
        row_trace['stage_3_classification'] = cls_res

        # Stage 4 & 5: Attribute Extraction & UOM Normalization
        attrs = extractor.extract_attributes(cls_res['Classpath'], rec['Part_Desc'])
        row_trace['stage_4_5_extracted_attributes'] = attrs

        # Stage 6: Description Building
        proc_rec = {
            'MANUFACTURER_NAME': mfr_res['MANUFACTURER_NAME'],
            'BRAND_NAME': mfr_res['BRAND_NAME'],
            'MANUFACTURER_PART_NUMBER': rec['Mfg_Part_Num'],
            'Classpath': cls_res['Classpath'],
            'attributes': attrs
        }
        desc_res = desc_builder.build_descriptions(proc_rec)
        proc_rec.update(desc_res)
        row_trace['stage_6_descriptions'] = desc_res

        # Stage 7: Validation & Confidence Scoring
        proc_rec.update({
            'mfr_confidence': mfr_res['confidence_score'],
            'class_confidence': cls_res['classification_confidence']
        })
        val_res = validator.validate_row(proc_rec)
        row_trace['stage_7_validation'] = val_res

        trace_logs.append(row_trace)

        if cls_res['is_in_scope']:
            in_scope_count += 1
        else:
            unclassified_count += 1

        # Assemble 252-column row array matching UNILOG_252_HEADERS exactly
        row_252 = [""] * 252

        # Populate core fields
        row_252[UNILOG_252_HEADERS.index("Mfg_Part_Num")] = rec['Mfg_Part_Num']
        row_252[UNILOG_252_HEADERS.index("Part_Desc")] = rec['Part_Desc']
        row_252[UNILOG_252_HEADERS.index("Part_Manuf")] = rec['Part_Manuf_Raw'] or ""
        row_252[UNILOG_252_HEADERS.index("MANUFACTURER_NAME")] = mfr_res['MANUFACTURER_NAME'] or ""
        row_252[UNILOG_252_HEADERS.index("BRAND_NAME")] = mfr_res['BRAND_NAME'] or ""
        row_252[UNILOG_252_HEADERS.index("MANUFACTURER_PART_NUMBER")] = rec['Mfg_Part_Num']
        row_252[UNILOG_252_HEADERS.index("Classpath")] = cls_res['Classpath']
        row_252[UNILOG_252_HEADERS.index("UNSPSC")] = cls_res['UNSPSC'] or ""

        row_252[UNILOG_252_HEADERS.index("INVOICE_DESC")] = desc_res['INVOICE_DESC']
        row_252[UNILOG_252_HEADERS.index("MOBILE_DESC")] = desc_res['MOBILE_DESC']
        row_252[UNILOG_252_HEADERS.index("SHORT_DESC")] = desc_res['SHORT_DESC']
        row_252[UNILOG_252_HEADERS.index("LONG_DESC1")] = desc_res['LONG_DESC1']

        # Populate extracted attributes (up to 50 attribute triplets)
        for attr_i, a_item in enumerate(attrs[:50], start=1):
            lbl_col = f"ATTRIBUTE_LABEL {attr_i}"
            val_col = f"ATTRIBUTE_VALUE {attr_i}"
            uom_col = f"ATTRIBUTE_UOM {attr_i}"

            if lbl_col in UNILOG_252_HEADERS:
                row_252[UNILOG_252_HEADERS.index(lbl_col)] = a_item['label']
                row_252[UNILOG_252_HEADERS.index(val_col)] = a_item['value']
                row_252[UNILOG_252_HEADERS.index(uom_col)] = a_item['uom']

        output_rows.append(row_252)

    # Save 252-column CSV output
    out_df = pd.DataFrame(output_rows, columns=UNILOG_252_HEADERS)
    out_df.to_csv(output_csv, index=False)
    print(f"Successfully generated 252-column CSV: {output_csv} ({len(output_rows)} rows)")

    # Save debug trace JSON
    with open(debug_json, 'w') as f:
        json.dump(trace_logs, f, indent=2)
    print(f"Successfully generated debug trace log: {debug_json}")

    # Summary Report
    total_processed = len(raw_records)
    print("\n----------------------------------------------------------")
    print("                PIPELINE EXECUTION SUMMARY                ")
    print("----------------------------------------------------------")
    print(f" Total Processed Items                  : {total_processed}")
    print(f" In-Scope Matched Items (Faucets/Fittings): {in_scope_count} ({round(in_scope_count/total_processed*100, 1)}%)")
    print(f" Unclassified / Needs Mapping Items      : {unclassified_count} ({round(unclassified_count/total_processed*100, 1)}%)")
    print("----------------------------------------------------------\n")

def main():
    parser = argparse.ArgumentParser(description="AI Product Intelligence Pipeline (Unilog Delivery Format)")
    parser.add_argument("--input", default="data/Sample-1000_Items.xlsx", help="Path to input raw Excel/CSV file")
    parser.add_argument("--categories", default="faucets,fittings", help="Comma-separated list of target categories to process")
    parser.add_argument("--out", default="output.csv", help="Path to output 252-column CSV file")
    parser.add_argument("--debug", default="trace_debug.json", help="Path to output debug trace JSON file")
    args = parser.parse_args()

    cats = [c.strip() for c in args.categories.split(',') if c.strip()]
    run_pipeline(args.input, target_categories=cats, output_csv=args.out, debug_json=args.debug)

if __name__ == '__main__':
    main()
