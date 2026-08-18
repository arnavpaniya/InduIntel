import os
import re
import pandas as pd
import openpyxl

class UOMNormalizer:
    def __init__(self, uom_file_path=None, dec_frac_file_path=None):
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        if uom_file_path is None:
            uom_file_path = os.path.join(data_dir, 'Unilog_Master_UOM_Standards_Abbreviations_and_Terms.xlsx')
        if dec_frac_file_path is None:
            dec_frac_file_path = os.path.join(data_dir, 'Decimal_Fraction.xlsx')
            
        self.uom_map = {}
        if os.path.exists(uom_file_path):
            df_uom = pd.read_excel(uom_file_path, sheet_name='Sheet1')
            for _, row in df_uom.iterrows():
                term = str(row['Term / Variant']).strip().lower() if pd.notna(row['Term / Variant']) else ''
                canon = str(row['Canonical Abbreviation']).strip() if pd.notna(row['Canonical Abbreviation']) else ''
                if term and canon:
                    self.uom_map[term] = canon

        # Default fallback UOM mappings
        defaults = {
            'in': 'in', 'inch': 'in', 'inches': 'in', 'in.': 'in', '"': 'in',
            'ft': 'ft', 'foot': 'ft', 'feet': 'ft', 'ft.': 'ft', "'": 'ft',
            'gpm': 'gpm', 'GPM': 'gpm', 'gallons per minute': 'gpm',
            'gpd': 'gpd', 'GPD': 'gpd', 'gallons per day': 'gpd',
            'v': 'V', 'volt': 'V', 'volts': 'V', 'V': 'V',
            'a': 'A', 'amp': 'A', 'amps': 'A', 'ampere': 'A', 'A': 'A',
            'w': 'W', 'watt': 'W', 'watts': 'W', 'W': 'W',
            'lb': 'lb', 'lbs': 'lb', 'pound': 'lb', 'pounds': 'lb',
            'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
            'deg f': 'deg F', 'degF': 'deg F', '°F': 'deg F', 'f': 'deg F',
            'psi': 'psi', 'PSI': 'psi'
        }
        for k, v in defaults.items():
            if k.lower() not in self.uom_map:
                self.uom_map[k.lower()] = v

        # Decimal to Fraction dictionary
        self.dec_to_frac = {}
        self.frac_to_dec = {}
        
        if os.path.exists(dec_frac_file_path):
            wb = openpyxl.load_workbook(dec_frac_file_path)
            ws = wb.active
            for row in ws.iter_rows(values_only=True):
                # Check stacked column pairs (0,1), (2,3), (4,5), (6,7)
                for col_i in range(0, len(row) - 1, 2):
                    frac = row[col_i]
                    dec = row[col_i + 1]
                    if frac is not None and dec is not None:
                        frac_str = str(frac).strip()
                        try:
                            dec_val = float(dec)
                            self.dec_to_frac[dec_val] = frac_str
                            self.frac_to_dec[frac_str] = dec_val
                        except (ValueError, TypeError):
                            pass

        # Default fallback decimal<->fraction maps
        std_pairs = [
            (0.0625, "1/16"), (0.125, "1/8"), (0.1875, "3/16"), (0.25, "1/4"),
            (0.3125, "5/16"), (0.375, "3/8"), (0.4375, "7/16"), (0.5, "1/2"),
            (0.5625, "9/16"), (0.625, "5/8"), (0.6875, "11/16"), (0.75, "3/4"),
            (0.8125, "13/16"), (0.875, "7/8"), (0.9375, "15/16")
        ]
        for d, f in std_pairs:
            self.dec_to_frac[d] = f
            self.frac_to_dec[f] = d

    def normalize_uom(self, uom_str):
        if not uom_str:
            return ""
        u_clean = str(uom_str).strip().lower()
        return self.uom_map.get(u_clean, uom_str.strip())

    def convert_decimal_to_fraction(self, num_val):
        """Converts float/decimal e.g. 0.5 to '1/2', 1.5 to '1-1/2'"""
        try:
            val = float(num_val)
            int_part = int(val)
            frac_part = round(val - int_part, 4)
            
            if frac_part in self.dec_to_frac:
                frac_str = self.dec_to_frac[frac_part]
                if int_part > 0:
                    return f"{int_part}-{frac_str}"
                return frac_str
            elif val.is_integer():
                return str(int(val))
            return str(num_val)
        except (ValueError, TypeError):
            return str(num_val)

    def normalize_value_and_uom(self, value_str, default_uom=None):
        """
        Takes raw string e.g. '24in', '1/2"', '1.5 gpm'
        Returns formatted (norm_val, norm_uom) with space e.g. ('24', 'in') or ('1/2', 'in')
        """
        if not value_str:
            return "", self.normalize_uom(default_uom) if default_uom else ""

        val_clean = str(value_str).strip()
        
        # Regex to separate number/fraction and unit suffix
        match = re.match(r'^([\d\.\/\-\s]+)\s*([a-zA-Z°"\']*)?$', val_clean)
        if match:
            num_part = match.group(1).strip()
            unit_part = match.group(2).strip() if match.group(2) else (default_uom or '')
            
            # Normalize UOM
            norm_uom = self.normalize_uom(unit_part)
            
            # Check if num_part is decimal that can be fraction
            try:
                if '.' in num_part and not '/' in num_part:
                    num_float = float(num_part)
                    num_part = self.convert_decimal_to_fraction(num_float)
            except ValueError:
                pass
                
            return num_part, norm_uom

        return val_clean, self.normalize_uom(default_uom) if default_uom else ""

if __name__ == '__main__':
    norm = UOMNormalizer()
    print("24in ->", norm.normalize_value_and_uom("24in"))
    print("1.5 gpm ->", norm.normalize_value_and_uom("1.5 gpm"))
    print("0.5 in ->", norm.normalize_value_and_uom("0.5 in"))
    print("120 V ->", norm.normalize_value_and_uom("120V", "Volts"))
