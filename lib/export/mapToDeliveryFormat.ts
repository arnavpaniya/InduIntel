import { EnrichedItem } from '@/lib/types';

export const DELIVERY_HEADERS = [
  'MFR URL',
  'Ref URL 1',
  'Ref URL 2',
  'Ref URL 3',
  'Ref URL 4',
  'Ref URL 5',
  'PART_NUMBER',
  'Dept',
  'Class',
  'Fine',
  'SKU - MY_PART_NUMBER',
  'Mfg_Part_Num',
  'Part_Desc',
  'E1_Brand',
  'Unilog_Brand',
  'DIB_Brand',
  'Part_Manuf',
  'MANUFACTURER_NAME',
  'BRAND_NAME',
  'TRADE_NAME',
  'MANUFACTURER_PART_NUMBER',
  'ALTERNATE_PART_NUMBER',
  'Classpath',
  'MOBILE_DESC',
  'INVOICE_DESC',
  'SHORT_DESC',
  'LONG_DESC1',
  'RETAIL_DESC',
  'MARKETING_DESCRIPTION',
  'ITEM_FEATURES_1',
  'ITEM_FEATURES_2',
  'ITEM_FEATURES_3',
  'ITEM_FEATURES_4',
  'ITEM_FEATURES_5',
  'ITEM_FEATURES_6',
  'ITEM_FEATURES_7',
  'ITEM_FEATURES_8',
  'ITEM_FEATURES_9',
  'ITEM_FEATURES_10',
  'ITEM_FEATURES_11',
  'ITEM_FEATURES_12',
  'ITEM_FEATURES_13',
  'ITEM_FEATURES_14',
  'ITEM_FEATURES_15',
  'ITEM_FEATURES_16',
  'ITEM_FEATURES_17',
  'ITEM_FEATURES_18',
  'ITEM_FEATURES_19',
  'ITEM_FEATURES_20',
  'With',
  'Standard/Approvals',
  'Prop 65',
  'Application',
  'Includes',
  'Product Name',
  'ATTRIBUTE_LABEL 1',
  'ATTRIBUTE_VALUE 1',
  'ATTRIBUTE_UOM 1',
  'ATTRIBUTE_LABEL 2',
  'ATTRIBUTE_VALUE 2',
  'ATTRIBUTE_UOM 2',
  'ATTRIBUTE_LABEL 3',
  'ATTRIBUTE_VALUE 3',
  'ATTRIBUTE_UOM 3',
  'ATTRIBUTE_LABEL 4',
  'ATTRIBUTE_VALUE 4',
  'ATTRIBUTE_UOM 4',
  'ATTRIBUTE_LABEL 5',
  'ATTRIBUTE_VALUE 5',
  'ATTRIBUTE_UOM 5',
  'ATTRIBUTE_LABEL 6',
  'ATTRIBUTE_VALUE 6',
  'ATTRIBUTE_UOM 6',
  'ATTRIBUTE_LABEL 7',
  'ATTRIBUTE_VALUE 7',
  'ATTRIBUTE_UOM 7',
  'ATTRIBUTE_LABEL 8',
  'ATTRIBUTE_VALUE 8',
  'ATTRIBUTE_UOM 8',
  'ATTRIBUTE_LABEL 9',
  'ATTRIBUTE_VALUE 9',
  'ATTRIBUTE_UOM 9',
  'ATTRIBUTE_LABEL 10',
  'ATTRIBUTE_VALUE 10',
  'ATTRIBUTE_UOM 10',
  'ATTRIBUTE_LABEL 11',
  'ATTRIBUTE_VALUE 11',
  'ATTRIBUTE_UOM 11',
  'ATTRIBUTE_LABEL 12',
  'ATTRIBUTE_VALUE 12',
  'ATTRIBUTE_UOM 12',
  'ATTRIBUTE_LABEL 13',
  'ATTRIBUTE_VALUE 13',
  'ATTRIBUTE_UOM 13',
  'ATTRIBUTE_LABEL 14',
  'ATTRIBUTE_VALUE 14',
  'ATTRIBUTE_UOM 14',
  'ATTRIBUTE_LABEL 15',
  'ATTRIBUTE_VALUE 15',
  'ATTRIBUTE_UOM 15',
  'ATTRIBUTE_LABEL 16',
  'ATTRIBUTE_VALUE 16',
  'ATTRIBUTE_UOM 16',
  'ATTRIBUTE_LABEL 17',
  'ATTRIBUTE_VALUE 17',
  'ATTRIBUTE_UOM 17',
  'ATTRIBUTE_LABEL 18',
  'ATTRIBUTE_VALUE 18',
  'ATTRIBUTE_UOM 18',
  'ATTRIBUTE_LABEL 19',
  'ATTRIBUTE_VALUE 19',
  'ATTRIBUTE_UOM 19',
  'ATTRIBUTE_LABEL 20',
  'ATTRIBUTE_VALUE 20',
  'ATTRIBUTE_UOM 20',
  'ATTRIBUTE_LABEL 21',
  'ATTRIBUTE_VALUE 21',
  'ATTRIBUTE_UOM 21',
  'ATTRIBUTE_LABEL 22',
  'ATTRIBUTE_VALUE 22',
  'ATTRIBUTE_UOM 22',
  'ATTRIBUTE_LABEL 23',
  'ATTRIBUTE_VALUE 23',
  'ATTRIBUTE_UOM 23',
  'ATTRIBUTE_LABEL 24',
  'ATTRIBUTE_VALUE 24',
  'ATTRIBUTE_UOM 24',
  'ATTRIBUTE_LABEL 25',
  'ATTRIBUTE_VALUE 25',
  'ATTRIBUTE_UOM 25',
  'ATTRIBUTE_LABEL 26',
  'ATTRIBUTE_VALUE 26',
  'ATTRIBUTE_UOM 26',
  'ATTRIBUTE_LABEL 27',
  'ATTRIBUTE_VALUE 27',
  'ATTRIBUTE_UOM 27',
  'ATTRIBUTE_LABEL 28',
  'ATTRIBUTE_VALUE 28',
  'ATTRIBUTE_UOM 28',
  'ATTRIBUTE_LABEL 29',
  'ATTRIBUTE_VALUE 29',
  'ATTRIBUTE_UOM 29',
  'ATTRIBUTE_LABEL 30',
  'ATTRIBUTE_VALUE 30',
  'ATTRIBUTE_UOM 30',
  'ATTRIBUTE_LABEL 31',
  'ATTRIBUTE_VALUE 31',
  'ATTRIBUTE_UOM 31',
  'ATTRIBUTE_LABEL 32',
  'ATTRIBUTE_VALUE 32',
  'ATTRIBUTE_UOM 32',
  'ATTRIBUTE_LABEL 33',
  'ATTRIBUTE_VALUE 33',
  'ATTRIBUTE_UOM 33',
  'ATTRIBUTE_LABEL 34',
  'ATTRIBUTE_VALUE 34',
  'ATTRIBUTE_UOM 34',
  'ATTRIBUTE_LABEL 35',
  'ATTRIBUTE_VALUE 35',
  'ATTRIBUTE_UOM 35',
  'ATTRIBUTE_LABEL 36',
  'ATTRIBUTE_VALUE 36',
  'ATTRIBUTE_UOM 36',
  'ATTRIBUTE_LABEL 37',
  'ATTRIBUTE_VALUE 37',
  'ATTRIBUTE_UOM 37',
  'ATTRIBUTE_LABEL 38',
  'ATTRIBUTE_VALUE 38',
  'ATTRIBUTE_UOM 38',
  'ATTRIBUTE_LABEL 39',
  'ATTRIBUTE_VALUE 39',
  'ATTRIBUTE_UOM 39',
  'ATTRIBUTE_LABEL 40',
  'ATTRIBUTE_VALUE 40',
  'ATTRIBUTE_UOM 40',
  'ATTRIBUTE_LABEL 41',
  'ATTRIBUTE_VALUE 41',
  'ATTRIBUTE_UOM 41',
  'ATTRIBUTE_LABEL 42',
  'ATTRIBUTE_VALUE 42',
  'ATTRIBUTE_UOM 42',
  'ATTRIBUTE_LABEL 43',
  'ATTRIBUTE_VALUE 43',
  'ATTRIBUTE_UOM 43',
  'ATTRIBUTE_LABEL 44',
  'ATTRIBUTE_VALUE 44',
  'ATTRIBUTE_UOM 44',
  'ATTRIBUTE_LABEL 45',
  'ATTRIBUTE_VALUE 45',
  'ATTRIBUTE_UOM 45',
  'ATTRIBUTE_LABEL 46',
  'ATTRIBUTE_VALUE 46',
  'ATTRIBUTE_UOM 46',
  'ATTRIBUTE_LABEL 47',
  'ATTRIBUTE_VALUE 47',
  'ATTRIBUTE_UOM 47',
  'ATTRIBUTE_LABEL 48',
  'ATTRIBUTE_VALUE 48',
  'ATTRIBUTE_UOM 48',
  'ATTRIBUTE_LABEL 49',
  'ATTRIBUTE_VALUE 49',
  'ATTRIBUTE_UOM 49',
  'ATTRIBUTE_LABEL 50',
  'ATTRIBUTE_VALUE 50',
  'ATTRIBUTE_UOM 50',
  'UPC',
  'EAN',
  'GTIN',
  'UNSPSC',
  'Warranty',
  'List Price',
  'Selling Qty',
  'Selling UOM',
  'Standard Packaging Information',
  'LENGTH',
  'LENGTH_UOM',
  'HEIGHT',
  'HEIGHT_UOM',
  'WIDTH',
  'WIDTH_UOM',
  'WEIGHT',
  'WEIGHT_UOM',
  'VOLUME',
  'VOLUME_UOM',
  'Product Image',
  'Alternate Image 1',
  'Alternate Image 2',
  'Alternate Image 3',
  'Alternate Image 4',
  'SDS',
  'SDS_1',
  'Warranty Information',
  'Catalog',
  'Specification Sheet',
  'Instruction/Installation Manual',
  'Service Manual',
  'Owners/User Manual',
  'Line Drawing',
  'MTR',
  'RoHS',
  'Full Engineering Drawing',
  'Energy Star Guide',
  'Technical Bulletin',
  'Submittal',
  'Compatibility Chart',
  'Size Chart',
  'Product Label/Insert',
  'Video Link',
  'Video Link 1',
  'Country Of Origin',
  'Discontinued',
  'Actual Image (Yes/No)',
] as const;

export type DeliveryHeader = typeof DELIVERY_HEADERS[number];

export const HEADER_MAP: Record<DeliveryHeader, string | null> = {
  'MFR URL': null,
  'Ref URL 1': null,
  'Ref URL 2': null,
  'Ref URL 3': null,
  'Ref URL 4': null,
  'Ref URL 5': null,
  'PART_NUMBER': 'mfg_part_num',
  'Dept': 'dept',
  'Class': 'class',
  'Fine': 'fine',
  'SKU - MY_PART_NUMBER': 'mfg_part_num',
  'Mfg_Part_Num': 'mfg_part_num',
  'Part_Desc': 'part_desc',
  'E1_Brand': 'e1_brand',
  'Unilog_Brand': 'unilog_brand',
  'DIB_Brand': 'dib_brand',
  'Part_Manuf': 'part_manuf',
  'MANUFACTURER_NAME': 'manufacturer_name',
  'BRAND_NAME': 'brand_name',
  'TRADE_NAME': null,
  'MANUFACTURER_PART_NUMBER': 'mfg_part_num',
  'ALTERNATE_PART_NUMBER': null,
  'Classpath': 'classpath',
  'MOBILE_DESC': 'mobile_desc',
  'INVOICE_DESC': 'invoice_desc',
  'SHORT_DESC': 'short_desc',
  'LONG_DESC1': 'long_desc1',
  'RETAIL_DESC': 'retail_desc',
  'MARKETING_DESCRIPTION': 'marketing_description',
  'ITEM_FEATURES_1': 'item_features_1',
  'ITEM_FEATURES_2': 'item_features_2',
  'ITEM_FEATURES_3': 'item_features_3',
  'ITEM_FEATURES_4': 'item_features_4',
  'ITEM_FEATURES_5': 'item_features_5',
  'ITEM_FEATURES_6': 'item_features_6',
  'ITEM_FEATURES_7': 'item_features_7',
  'ITEM_FEATURES_8': 'item_features_8',
  'ITEM_FEATURES_9': 'item_features_9',
  'ITEM_FEATURES_10': 'item_features_10',
  'ITEM_FEATURES_11': 'item_features_11',
  'ITEM_FEATURES_12': 'item_features_12',
  'ITEM_FEATURES_13': 'item_features_13',
  'ITEM_FEATURES_14': 'item_features_14',
  'ITEM_FEATURES_15': 'item_features_15',
  'ITEM_FEATURES_16': 'item_features_16',
  'ITEM_FEATURES_17': 'item_features_17',
  'ITEM_FEATURES_18': 'item_features_18',
  'ITEM_FEATURES_19': 'item_features_19',
  'ITEM_FEATURES_20': 'item_features_20',
  'With': null,
  'Standard/Approvals': null,
  'Prop 65': null,
  'Application': null,
  'Includes': null,
  'Product Name': null,
  'ATTRIBUTE_LABEL 1': 'attribute_label_1',
  'ATTRIBUTE_VALUE 1': 'attribute_value_1',
  'ATTRIBUTE_UOM 1': 'attribute_uom_1',
  'ATTRIBUTE_LABEL 2': 'attribute_label_2',
  'ATTRIBUTE_VALUE 2': 'attribute_value_2',
  'ATTRIBUTE_UOM 2': 'attribute_uom_2',
  'ATTRIBUTE_LABEL 3': 'attribute_label_3',
  'ATTRIBUTE_VALUE 3': 'attribute_value_3',
  'ATTRIBUTE_UOM 3': 'attribute_uom_3',
  'ATTRIBUTE_LABEL 4': 'attribute_label_4',
  'ATTRIBUTE_VALUE 4': 'attribute_value_4',
  'ATTRIBUTE_UOM 4': 'attribute_uom_4',
  'ATTRIBUTE_LABEL 5': 'attribute_label_5',
  'ATTRIBUTE_VALUE 5': 'attribute_value_5',
  'ATTRIBUTE_UOM 5': 'attribute_uom_5',
  'ATTRIBUTE_LABEL 6': 'attribute_label_6',
  'ATTRIBUTE_VALUE 6': 'attribute_value_6',
  'ATTRIBUTE_UOM 6': 'attribute_uom_6',
  'ATTRIBUTE_LABEL 7': 'attribute_label_7',
  'ATTRIBUTE_VALUE 7': 'attribute_value_7',
  'ATTRIBUTE_UOM 7': 'attribute_uom_7',
  'ATTRIBUTE_LABEL 8': 'attribute_label_8',
  'ATTRIBUTE_VALUE 8': 'attribute_value_8',
  'ATTRIBUTE_UOM 8': 'attribute_uom_8',
  'ATTRIBUTE_LABEL 9': 'attribute_label_9',
  'ATTRIBUTE_VALUE 9': 'attribute_value_9',
  'ATTRIBUTE_UOM 9': 'attribute_uom_9',
  'ATTRIBUTE_LABEL 10': 'attribute_label_10',
  'ATTRIBUTE_VALUE 10': 'attribute_value_10',
  'ATTRIBUTE_UOM 10': 'attribute_uom_10',
  'ATTRIBUTE_LABEL 11': 'attribute_label_11',
  'ATTRIBUTE_VALUE 11': 'attribute_value_11',
  'ATTRIBUTE_UOM 11': 'attribute_uom_11',
  'ATTRIBUTE_LABEL 12': 'attribute_label_12',
  'ATTRIBUTE_VALUE 12': 'attribute_value_12',
  'ATTRIBUTE_UOM 12': 'attribute_uom_12',
  'ATTRIBUTE_LABEL 13': 'attribute_label_13',
  'ATTRIBUTE_VALUE 13': 'attribute_value_13',
  'ATTRIBUTE_UOM 13': 'attribute_uom_13',
  'ATTRIBUTE_LABEL 14': 'attribute_label_14',
  'ATTRIBUTE_VALUE 14': 'attribute_value_14',
  'ATTRIBUTE_UOM 14': 'attribute_uom_14',
  'ATTRIBUTE_LABEL 15': 'attribute_label_15',
  'ATTRIBUTE_VALUE 15': 'attribute_value_15',
  'ATTRIBUTE_UOM 15': 'attribute_uom_15',
  'ATTRIBUTE_LABEL 16': 'attribute_label_16',
  'ATTRIBUTE_VALUE 16': 'attribute_value_16',
  'ATTRIBUTE_UOM 16': 'attribute_uom_16',
  'ATTRIBUTE_LABEL 17': 'attribute_label_17',
  'ATTRIBUTE_VALUE 17': 'attribute_value_17',
  'ATTRIBUTE_UOM 17': 'attribute_uom_17',
  'ATTRIBUTE_LABEL 18': 'attribute_label_18',
  'ATTRIBUTE_VALUE 18': 'attribute_value_18',
  'ATTRIBUTE_UOM 18': 'attribute_uom_18',
  'ATTRIBUTE_LABEL 19': 'attribute_label_19',
  'ATTRIBUTE_VALUE 19': 'attribute_value_19',
  'ATTRIBUTE_UOM 19': 'attribute_uom_19',
  'ATTRIBUTE_LABEL 20': 'attribute_label_20',
  'ATTRIBUTE_VALUE 20': 'attribute_value_20',
  'ATTRIBUTE_UOM 20': 'attribute_uom_20',
  'ATTRIBUTE_LABEL 21': 'attribute_label_21',
  'ATTRIBUTE_VALUE 21': 'attribute_value_21',
  'ATTRIBUTE_UOM 21': 'attribute_uom_21',
  'ATTRIBUTE_LABEL 22': 'attribute_label_22',
  'ATTRIBUTE_VALUE 22': 'attribute_value_22',
  'ATTRIBUTE_UOM 22': 'attribute_uom_22',
  'ATTRIBUTE_LABEL 23': 'attribute_label_23',
  'ATTRIBUTE_VALUE 23': 'attribute_value_23',
  'ATTRIBUTE_UOM 23': 'attribute_uom_23',
  'ATTRIBUTE_LABEL 24': 'attribute_label_24',
  'ATTRIBUTE_VALUE 24': 'attribute_value_24',
  'ATTRIBUTE_UOM 24': 'attribute_uom_24',
  'ATTRIBUTE_LABEL 25': 'attribute_label_25',
  'ATTRIBUTE_VALUE 25': 'attribute_value_25',
  'ATTRIBUTE_UOM 25': 'attribute_uom_25',
  'ATTRIBUTE_LABEL 26': 'attribute_label_26',
  'ATTRIBUTE_VALUE 26': 'attribute_value_26',
  'ATTRIBUTE_UOM 26': 'attribute_uom_26',
  'ATTRIBUTE_LABEL 27': 'attribute_label_27',
  'ATTRIBUTE_VALUE 27': 'attribute_value_27',
  'ATTRIBUTE_UOM 27': 'attribute_uom_27',
  'ATTRIBUTE_LABEL 28': 'attribute_label_28',
  'ATTRIBUTE_VALUE 28': 'attribute_value_28',
  'ATTRIBUTE_UOM 28': 'attribute_uom_28',
  'ATTRIBUTE_LABEL 29': 'attribute_label_29',
  'ATTRIBUTE_VALUE 29': 'attribute_value_29',
  'ATTRIBUTE_UOM 29': 'attribute_uom_29',
  'ATTRIBUTE_LABEL 30': 'attribute_label_30',
  'ATTRIBUTE_VALUE 30': 'attribute_value_30',
  'ATTRIBUTE_UOM 30': 'attribute_uom_30',
  'ATTRIBUTE_LABEL 31': 'attribute_label_31',
  'ATTRIBUTE_VALUE 31': 'attribute_value_31',
  'ATTRIBUTE_UOM 31': 'attribute_uom_31',
  'ATTRIBUTE_LABEL 32': 'attribute_label_32',
  'ATTRIBUTE_VALUE 32': 'attribute_value_32',
  'ATTRIBUTE_UOM 32': 'attribute_uom_32',
  'ATTRIBUTE_LABEL 33': 'attribute_label_33',
  'ATTRIBUTE_VALUE 33': 'attribute_value_33',
  'ATTRIBUTE_UOM 33': 'attribute_uom_33',
  'ATTRIBUTE_LABEL 34': 'attribute_label_34',
  'ATTRIBUTE_VALUE 34': 'attribute_value_34',
  'ATTRIBUTE_UOM 34': 'attribute_uom_34',
  'ATTRIBUTE_LABEL 35': 'attribute_label_35',
  'ATTRIBUTE_VALUE 35': 'attribute_value_35',
  'ATTRIBUTE_UOM 35': 'attribute_uom_35',
  'ATTRIBUTE_LABEL 36': 'attribute_label_36',
  'ATTRIBUTE_VALUE 36': 'attribute_value_36',
  'ATTRIBUTE_UOM 36': 'attribute_uom_36',
  'ATTRIBUTE_LABEL 37': 'attribute_label_37',
  'ATTRIBUTE_VALUE 37': 'attribute_value_37',
  'ATTRIBUTE_UOM 37': 'attribute_uom_37',
  'ATTRIBUTE_LABEL 38': 'attribute_label_38',
  'ATTRIBUTE_VALUE 38': 'attribute_value_38',
  'ATTRIBUTE_UOM 38': 'attribute_uom_38',
  'ATTRIBUTE_LABEL 39': 'attribute_label_39',
  'ATTRIBUTE_VALUE 39': 'attribute_value_39',
  'ATTRIBUTE_UOM 39': 'attribute_uom_39',
  'ATTRIBUTE_LABEL 40': 'attribute_label_40',
  'ATTRIBUTE_VALUE 40': 'attribute_value_40',
  'ATTRIBUTE_UOM 40': 'attribute_uom_40',
  'ATTRIBUTE_LABEL 41': 'attribute_label_41',
  'ATTRIBUTE_VALUE 41': 'attribute_value_41',
  'ATTRIBUTE_UOM 41': 'attribute_uom_41',
  'ATTRIBUTE_LABEL 42': 'attribute_label_42',
  'ATTRIBUTE_VALUE 42': 'attribute_value_42',
  'ATTRIBUTE_UOM 42': 'attribute_uom_42',
  'ATTRIBUTE_LABEL 43': 'attribute_label_43',
  'ATTRIBUTE_VALUE 43': 'attribute_value_43',
  'ATTRIBUTE_UOM 43': 'attribute_uom_43',
  'ATTRIBUTE_LABEL 44': 'attribute_label_44',
  'ATTRIBUTE_VALUE 44': 'attribute_value_44',
  'ATTRIBUTE_UOM 44': 'attribute_uom_44',
  'ATTRIBUTE_LABEL 45': 'attribute_label_45',
  'ATTRIBUTE_VALUE 45': 'attribute_value_45',
  'ATTRIBUTE_UOM 45': 'attribute_uom_45',
  'ATTRIBUTE_LABEL 46': 'attribute_label_46',
  'ATTRIBUTE_VALUE 46': 'attribute_value_46',
  'ATTRIBUTE_UOM 46': 'attribute_uom_46',
  'ATTRIBUTE_LABEL 47': 'attribute_label_47',
  'ATTRIBUTE_VALUE 47': 'attribute_value_47',
  'ATTRIBUTE_UOM 47': 'attribute_uom_47',
  'ATTRIBUTE_LABEL 48': 'attribute_label_48',
  'ATTRIBUTE_VALUE 48': 'attribute_value_48',
  'ATTRIBUTE_UOM 48': 'attribute_uom_48',
  'ATTRIBUTE_LABEL 49': 'attribute_label_49',
  'ATTRIBUTE_VALUE 49': 'attribute_value_49',
  'ATTRIBUTE_UOM 49': 'attribute_uom_49',
  'ATTRIBUTE_LABEL 50': 'attribute_label_50',
  'ATTRIBUTE_VALUE 50': 'attribute_value_50',
  'ATTRIBUTE_UOM 50': 'attribute_uom_50',
  'UPC': 'upc',
  'EAN': 'ean',
  'GTIN': 'gtin',
  'UNSPSC': 'unspsc',
  'Warranty': 'warranty',
  'List Price': 'list_price',
  'Selling Qty': null,
  'Selling UOM': null,
  'Standard Packaging Information': null,
  'LENGTH': 'length',
  'LENGTH_UOM': 'length_uom',
  'HEIGHT': 'height',
  'HEIGHT_UOM': 'height_uom',
  'WIDTH': 'width',
  'WIDTH_UOM': 'width_uom',
  'WEIGHT': 'weight',
  'WEIGHT_UOM': 'weight_uom',
  'VOLUME': null,
  'VOLUME_UOM': null,
  'Product Image': null,
  'Alternate Image 1': null,
  'Alternate Image 2': null,
  'Alternate Image 3': null,
  'Alternate Image 4': null,
  'SDS': null,
  'SDS_1': null,
  'Warranty Information': null,
  'Catalog': null,
  'Specification Sheet': null,
  'Instruction/Installation Manual': null,
  'Service Manual': null,
  'Owners/User Manual': null,
  'Line Drawing': null,
  'MTR': null,
  'RoHS': null,
  'Full Engineering Drawing': null,
  'Energy Star Guide': null,
  'Technical Bulletin': null,
  'Submittal': null,
  'Compatibility Chart': null,
  'Size Chart': null,
  'Product Label/Insert': null,
  'Video Link': null,
  'Video Link 1': null,
  'Country Of Origin': 'country_of_origin',
  'Discontinued': null,
  'Actual Image (Yes/No)': 'actual_image_flag',
} as const;

function getDesc(item: EnrichedItem, field: string): string {
  const desc = item.item_descriptions?.find(d => d.field_name === field);
  return desc?.value ?? '';
}

function getAttr(item: EnrichedItem, idx: number, field: 'label' | 'value' | 'uom'): string {
  const attr = item.item_attributes?.find(a => a.seq === idx + 1);
  if (!attr) return '';
  const val = attr[field];
  return val ?? '';
}

function getSpec(item: EnrichedItem, field: string): string {
  const spec = item.item_specs?.[0];
  if (!spec) return '';
  const val = (spec as unknown as Record<string, unknown>)[field];
  return val !== null && val !== undefined ? String(val) : '';
}

export function mapToDeliveryFormat(item: EnrichedItem): Record<DeliveryHeader, string> {
  const result: Partial<Record<DeliveryHeader, string>> = {};

  for (const header of DELIVERY_HEADERS) {
    const internalField = HEADER_MAP[header];
    
    if (!internalField) {
      result[header] = '';
      continue;
    }

    let value = '';

    switch (internalField) {
      case 'mfg_part_num':
      case 'PART_NUMBER':
      case 'SKU - MY_PART_NUMBER':
      case 'MANUFACTURER_PART_NUMBER':
        value = item.mfg_part_num ?? '';
        break;
      case 'part_desc':
        value = item.part_desc ?? '';
        break;
      case 'e1_brand':
        value = item.e1_brand ?? '';
        break;
      case 'unilog_brand':
        value = item.unilog_brand ?? '';
        break;
      case 'dib_brand':
        value = item.dib_brand ?? '';
        break;
      case 'part_manuf':
        value = item.part_manuf ?? '';
        break;
      case 'dept':
        value = item.dept ?? '';
        break;
      case 'class':
        value = item.class ?? '';
        break;
      case 'fine':
        value = item.fine ?? '';
        break;
      case 'manufacturer_name':
        value = item.manufacturer_name ?? '';
        break;
      case 'brand_name':
        value = item.brand_name ?? '';
        break;
      case 'classpath':
        value = item.classpath ?? '';
        break;
      case 'mobile_desc':
        value = getDesc(item, 'mobile_desc');
        break;
      case 'invoice_desc':
        value = getDesc(item, 'invoice_desc');
        break;
      case 'short_desc':
        value = getDesc(item, 'short_desc');
        break;
      case 'long_desc1':
        value = getDesc(item, 'long_desc1');
        break;
      case 'marketing_description':
        value = getDesc(item, 'marketing_description');
        break;
      case 'retail_desc':
        value = getDesc(item, 'retail_desc');
        break;
      case 'upc':
        value = getSpec(item, 'upc');
        break;
      case 'ean':
        value = getSpec(item, 'ean');
        break;
      case 'gtin':
        value = getSpec(item, 'gtin');
        break;
      case 'unspsc':
        value = getSpec(item, 'unspsc');
        break;
      case 'warranty':
        value = getSpec(item, 'warranty');
        break;
      case 'list_price':
        value = getSpec(item, 'list_price');
        break;
      case 'length':
        value = getSpec(item, 'length');
        break;
      case 'length_uom':
        value = getSpec(item, 'length_uom');
        break;
      case 'height':
        value = getSpec(item, 'height');
        break;
      case 'height_uom':
        value = getSpec(item, 'height_uom');
        break;
      case 'width':
        value = getSpec(item, 'width');
        break;
      case 'width_uom':
        value = getSpec(item, 'width_uom');
        break;
      case 'weight':
        value = getSpec(item, 'weight');
        break;
      case 'weight_uom':
        value = getSpec(item, 'weight_uom');
        break;
      case 'country_of_origin':
        value = getSpec(item, 'country_of_origin');
        break;
      case 'actual_image_flag':
        const assets = item.item_assets || [];
        value = assets.some((a: any) => a.asset_type === 'product_image' && a.url) ? 'Yes' : 'No';
        break;
      default:
        if (internalField.startsWith('item_features_')) {
          const idx = parseInt(internalField.replace('item_features_', ''), 10) - 1;
          if (idx >= 0 && idx < 20) {
            const desc = item.item_descriptions?.find(d => d.field_name === 'item_features');
            if (desc) {
              const features = desc.value.split(';').map(f => f.trim()).filter(f => f);
              value = features[idx] ?? '';
            }
          }
        } else if (internalField.startsWith('attribute_label_')) {
          const idx = parseInt(internalField.replace('attribute_label_', ''), 10) - 1;
          value = getAttr(item, idx, 'label');
        } else if (internalField.startsWith('attribute_value_')) {
          const idx = parseInt(internalField.replace('attribute_value_', ''), 10) - 1;
          value = getAttr(item, idx, 'value');
        } else if (internalField.startsWith('attribute_uom_')) {
          const idx = parseInt(internalField.replace('attribute_uom_', ''), 10) - 1;
          value = getAttr(item, idx, 'uom');
        }
    }

    result[header] = value;
  }

  return result as Record<DeliveryHeader, string>;
}

export function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function generateCsv(items: EnrichedItem[]): string {
  const headerRow = DELIVERY_HEADERS.map(h => escapeCsv(h)).join(',');
  const dataRows = items.map(item => {
    const mapped = mapToDeliveryFormat(item);
    return DELIVERY_HEADERS.map(h => escapeCsv(mapped[h])).join(',');
  });
  return [headerRow, ...dataRows].join('\n');
}