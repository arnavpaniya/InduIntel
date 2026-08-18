import { AIProvider, AIInput, ProductExtraction, Evidence } from '@/types';

export class MockProvider implements AIProvider {
  private delay: number;

  constructor(delay = 1000) {
    this.delay = delay;
  }

  getModelName(): string {
    return 'mock-provider';
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async analyzeProduct(input: AIInput): Promise<ProductExtraction> {
    await new Promise((resolve) => setTimeout(resolve, this.delay));

    const category = input.category || this.detectCategory(input.documentChunks);

    return this.generateMockExtraction(category, input.documentChunks);
  }

  private detectCategory(chunks: AIInput['documentChunks']): 'electric_motor' | 'bearing' | 'industrial_pump' {
    const text = chunks.map((c) => c.text.toLowerCase()).join(' ');

    if (text.includes('bearing') || text.includes('inner diameter') || text.includes('outer diameter') || text.includes('dynamic load')) {
      return 'bearing';
    }
    if (text.includes('pump') || text.includes('flow rate') || text.includes('head') || text.includes('inlet') || text.includes('outlet')) {
      return 'industrial_pump';
    }
    return 'electric_motor';
  }

  private generateMockExtraction(
    category: 'electric_motor' | 'bearing' | 'industrial_pump',
    chunks: AIInput['documentChunks']
  ): ProductExtraction {
    const docId = chunks[0]?.documentId || 'doc_001';
    const docName = 'sample-datasheet.pdf';

    const baseEvidence = (page: number, quote: string): Evidence[] => [
      {
        documentId: docId,
        documentName: docName,
        page,
        quote,
      },
    ];

    switch (category) {
      case 'electric_motor':
        return {
          category: 'electric_motor',
          manufacturer: 'ABB',
          model: 'M3BP 160MLA',
          attributes: [
            { key: 'power', value: 15, unit: 'kW', confidence: 0.98, evidence: baseEvidence(1, 'Rated power: 15 kW') },
            { key: 'voltage', value: 400, unit: 'V', confidence: 0.97, evidence: baseEvidence(1, 'Rated voltage: 400 V') },
            { key: 'current', value: 27.5, unit: 'A', confidence: 0.95, evidence: baseEvidence(1, 'Rated current: 27.5 A') },
            { key: 'frequency', value: 50, unit: 'Hz', confidence: 0.99, evidence: baseEvidence(1, 'Frequency: 50 Hz') },
            { key: 'phase', value: 3, unit: null, confidence: 0.99, evidence: baseEvidence(1, 'Three-phase') },
            { key: 'speed', value: 1470, unit: 'RPM', confidence: 0.96, evidence: baseEvidence(1, 'Speed: 1470 RPM') },
            { key: 'efficiency', value: 92.4, unit: '%', confidence: 0.94, evidence: baseEvidence(2, 'Efficiency: 92.4%') },
            { key: 'efficiency_class', value: 'IE3', unit: null, confidence: 0.97, evidence: baseEvidence(2, 'IE3 Premium Efficiency') },
            { key: 'ip_rating', value: 'IP55', unit: null, confidence: 0.95, evidence: baseEvidence(2, 'Protection: IP55') },
            { key: 'frame_size', value: '160M', unit: null, confidence: 0.98, evidence: baseEvidence(1, 'Frame size: 160M') },
            { key: 'mounting', value: 'B3', unit: null, confidence: 0.92, evidence: baseEvidence(2, 'Mounting: B3') },
            { key: 'insulation_class', value: 'F', unit: null, confidence: 0.93, evidence: baseEvidence(2, 'Insulation class F') },
            { key: 'duty', value: 'S1', unit: null, confidence: 0.9, evidence: baseEvidence(2, 'Duty: S1') },
            { key: 'ambient_temperature', value: 40, unit: '°C', confidence: 0.88, evidence: baseEvidence(2, 'Ambient temp: 40°C') },
            { key: 'rated_torque', value: 97.4, unit: 'Nm', confidence: 0.85, evidence: baseEvidence(2, 'Torque: 97.4 Nm') },
            { key: 'manufacturer', value: 'ABB', unit: null, confidence: 0.99, evidence: baseEvidence(1, 'ABB') },
            { key: 'model', value: 'M3BP 160MLA', unit: null, confidence: 0.99, evidence: baseEvidence(1, 'M3BP 160MLA') },
            { key: 'dimensions', value: '610x310x400', unit: 'mm', confidence: 0.7, evidence: baseEvidence(3, 'Dimensions: 610x310x400 mm') },
            { key: 'weight', value: 125, unit: 'kg', confidence: 0.75, evidence: baseEvidence(3, 'Weight: 125 kg') },
          ],
        };

      case 'bearing':
        return {
          category: 'bearing',
          manufacturer: 'SKF',
          model: '6208-2RS1',
          attributes: [
            { key: 'bearing_type', value: 'Deep Groove Ball Bearing', unit: null, confidence: 0.99, evidence: baseEvidence(1, 'Type: Deep groove ball bearing') },
            { key: 'inner_diameter', value: 40, unit: 'mm', confidence: 0.99, evidence: baseEvidence(1, 'd = 40 mm') },
            { key: 'outer_diameter', value: 80, unit: 'mm', confidence: 0.99, evidence: baseEvidence(1, 'D = 80 mm') },
            { key: 'width', value: 18, unit: 'mm', confidence: 0.99, evidence: baseEvidence(1, 'B = 18 mm') },
            { key: 'dynamic_load_rating', value: 30.7, unit: 'kN', confidence: 0.95, evidence: baseEvidence(1, 'C = 30.7 kN') },
            { key: 'static_load_rating', value: 19, unit: 'kN', confidence: 0.95, evidence: baseEvidence(1, 'C0 = 19 kN') },
            { key: 'limiting_speed', value: 11000, unit: 'RPM', confidence: 0.9, evidence: baseEvidence(1, 'Limiting speed: 11000 RPM') },
            { key: 'seal_type', value: '2RS1', unit: null, confidence: 0.98, evidence: baseEvidence(1, 'Seals: 2RS1') },
            { key: 'material', value: 'Chrome Steel', unit: null, confidence: 0.9, evidence: baseEvidence(1, 'Material: Chrome steel') },
            { key: 'manufacturer', value: 'SKF', unit: null, confidence: 0.99, evidence: baseEvidence(1, 'SKF') },
            { key: 'model', value: '6208-2RS1', unit: null, confidence: 0.99, evidence: baseEvidence(1, '6208-2RS1') },
          ],
        };

      case 'industrial_pump':
        return {
          category: 'industrial_pump',
          manufacturer: 'Grundfos',
          model: 'NB 65-200/190',
          attributes: [
            { key: 'pump_type', value: 'End-suction centrifugal', unit: null, confidence: 0.98, evidence: baseEvidence(1, 'Type: End-suction centrifugal pump') },
            { key: 'flow_rate', value: 50, unit: 'm³/h', confidence: 0.96, evidence: baseEvidence(1, 'Q = 50 m³/h') },
            { key: 'head', value: 45, unit: 'm', confidence: 0.96, evidence: baseEvidence(1, 'H = 45 m') },
            { key: 'power', value: 11, unit: 'kW', confidence: 0.95, evidence: baseEvidence(1, 'P = 11 kW') },
            { key: 'voltage', value: 400, unit: 'V', confidence: 0.97, evidence: baseEvidence(1, 'Voltage: 400 V') },
            { key: 'frequency', value: 50, unit: 'Hz', confidence: 0.99, evidence: baseEvidence(1, 'Frequency: 50 Hz') },
            { key: 'speed', value: 2900, unit: 'RPM', confidence: 0.94, evidence: baseEvidence(1, 'Speed: 2900 RPM') },
            { key: 'efficiency', value: 78.5, unit: '%', confidence: 0.9, evidence: baseEvidence(2, 'Efficiency: 78.5%') },
            { key: 'material', value: 'Cast Iron', unit: null, confidence: 0.92, evidence: baseEvidence(1, 'Material: Cast iron') },
            { key: 'manufacturer', value: 'Grundfos', unit: null, confidence: 0.99, evidence: baseEvidence(1, 'Grundfos') },
            { key: 'model', value: 'NB 65-200/190', unit: null, confidence: 0.99, evidence: baseEvidence(1, 'NB 65-200/190') },
            { key: 'inlet_size', value: 80, unit: 'mm', confidence: 0.88, evidence: baseEvidence(1, 'Inlet: DN 80') },
            { key: 'outlet_size', value: 65, unit: 'mm', confidence: 0.88, evidence: baseEvidence(1, 'Outlet: DN 65') },
          ],
        };
    }
  }
}

export function createMockProvider(): MockProvider {
  return new MockProvider();
}