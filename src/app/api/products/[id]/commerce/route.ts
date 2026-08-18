import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { Product, ProductAttribute, CommerceOutput } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const adminSupabase = createSupabaseAdminClient();

    const { data: product, error: productError } = await adminSupabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const commerce = generateCommerceOutput(product as unknown as Product);

    const { error: updateError } = await adminSupabase
      .from('products')
      .update({ commerce, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save commerce output' }, { status: 500 });
    }

    return NextResponse.json(commerce);
  } catch (error) {
    console.error('Generate commerce error:', error);
    return NextResponse.json({ error: 'Failed to generate commerce output' }, { status: 500 });
  }
}

function generateCommerceOutput(product: Product): CommerceOutput {
  const verifiedAttrs = product.attributes.filter(
    a => a.status === 'VERIFIED' && a.value !== null
  );

  const inferredAttrs = product.attributes.filter(
    a => a.status === 'INFERRED' && a.value !== null
  );

  const reliableAttrs = [...verifiedAttrs, ...inferredAttrs];

  const getAttr = (key: string) => reliableAttrs.find(a => a.key === key);
  const formatAttr = (attr: ProductAttribute | undefined) =>
    attr && attr.value !== null ? `${attr.value} ${attr.unit || ''}`.trim() : null;

  const manufacturer = product.manufacturer || 'Unknown Manufacturer';
  const model = product.model || 'Unknown Model';
  const categoryLabels: Record<string, string> = {
    electric_motor: 'Industrial Electric Motor',
    bearing: 'Industrial Bearing',
    industrial_pump: 'Industrial Pump',
  };
  const categoryLabel = categoryLabels[product.category] || 'Industrial Product';

  const power = getAttr('power');
  const voltage = getAttr('voltage');
  const speed = getAttr('speed');
  const efficiency = getAttr('efficiency');
  const efficiencyClass = getAttr('efficiency_class');
  const ipRating = getAttr('ip_rating');
  const frameSize = getAttr('frame_size');
  const mounting = getAttr('mounting');
  const pumpType = getAttr('pump_type');
  const flowRate = getAttr('flow_rate');
  const head = getAttr('head');
  const bearingType = getAttr('bearing_type');
  const innerDiameter = getAttr('inner_diameter');
  const outerDiameter = getAttr('outer_diameter');
  const dynamicLoad = getAttr('dynamic_load_rating');

  let title = `${manufacturer} ${model}`.trim();
  if (power) title += ` ${formatAttr(power)}`;
  if (efficiencyClass) title += ` ${efficiencyClass.value}`;
  title += ` ${categoryLabel}`;

  const shortDescription = `${manufacturer} ${model} ${categoryLabel.toLowerCase()}${power ? `, ${formatAttr(power)}` : ''}${voltage ? `, ${formatAttr(voltage)}` : ''}. ${verifiedAttrs.length} verified specifications.`;

  const longDescription = [
    `The ${manufacturer} ${model} is a ${categoryLabel.toLowerCase()} designed for industrial applications.`,
    power ? `Rated power: ${formatAttr(power)}.` : null,
    voltage ? `Operating voltage: ${formatAttr(voltage)}.` : null,
    speed ? `Rated speed: ${formatAttr(speed)}.` : null,
    efficiency ? `Efficiency: ${formatAttr(efficiency)}.` : null,
    efficiencyClass ? `Efficiency class: ${efficiencyClass.value}.` : null,
    ipRating ? `Protection rating: ${ipRating.value}.` : null,
    frameSize ? `Frame size: ${frameSize.value}.` : null,
    mounting ? `Mounting type: ${mounting.value}.` : null,
    pumpType ? `Pump type: ${pumpType.value}.` : null,
    flowRate ? `Flow rate: ${formatAttr(flowRate)}.` : null,
    head ? `Head: ${formatAttr(head)}.` : null,
    bearingType ? `Bearing type: ${bearingType.value}.` : null,
    innerDiameter ? `Inner diameter: ${formatAttr(innerDiameter)}.` : null,
    outerDiameter ? `Outer diameter: ${formatAttr(outerDiameter)}.` : null,
    dynamicLoad ? `Dynamic load rating: ${formatAttr(dynamicLoad)}.` : null,
    `This product has ${verifiedAttrs.length} verified attributes and ${product.confidence}% application confidence.`,
  ]
    .filter(Boolean)
    .join(' ');

  const keywords = [
    manufacturer.toLowerCase(),
    model.toLowerCase(),
    categoryLabel.toLowerCase(),
    ...reliableAttrs.map(a => a.key.replace(/_/g, ' ')),
    ...reliableAttrs.filter(a => a.value).map(a => `${a.value} ${a.unit || ''}`.trim().toLowerCase()),
  ].filter(Boolean);

  const technicalSpecifications = reliableAttrs
    .filter(a => a.value !== null)
    .map(attr => ({
      key: attr.key,
      label: attr.label,
      value: formatAttr(attr) || '',
    }));

  return {
    title,
    shortDescription,
    longDescription,
    keywords: [...new Set(keywords)].slice(0, 20),
    technicalSpecifications,
  };
}