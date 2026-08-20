import { 
  ItemsResponse, 
  EnrichedItem, 
  EnrichRunResponse, 
  BatchEnrichResponse,
  ScoreItemResponse,
  BatchScoreResponse,
  QuotaStatus,
  UploadResponse
} from '@/lib/types';

const API_BASE = '';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export async function fetchItems(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  batch?: string;
}): Promise<ItemsResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  if (params.batch) searchParams.set('batch', params.batch);
  
  return fetchJson<ItemsResponse>(`${API_BASE}/api/items?${searchParams.toString()}`);
}

export async function fetchItemDetail(itemId: string): Promise<EnrichedItem> {
  return fetchJson<EnrichedItem>(`${API_BASE}/api/items/${itemId}`);
}

export async function enrichItem(itemId: string): Promise<EnrichRunResponse> {
  return fetchJson<EnrichRunResponse>(`${API_BASE}/api/enrich/run`, {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId }),
  });
}

export async function enrichBatch(limit: number = 3): Promise<BatchEnrichResponse> {
  return fetchJson<BatchEnrichResponse>(`${API_BASE}/api/enrich/batch`, {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
}

export async function scoreItem(itemId: string, groundTruthId: string): Promise<ScoreItemResponse> {
  return fetchJson<ScoreItemResponse>(`${API_BASE}/api/score/item`, {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId, ground_truth_id: groundTruthId }),
  });
}

export async function scoreBatch(limit: number = 10): Promise<BatchScoreResponse> {
  return fetchJson<BatchScoreResponse>(`${API_BASE}/api/score/batch`, {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
}

export async function fetchQuotaStatus(): Promise<QuotaStatus> {
  // This would ideally be an API endpoint, but we can derive from gemini_usage_log
  // For now, return a mock - in real app, call an endpoint
  return { used: 0, limit: 18, remaining: 18, near_limit: false };
}

export async function uploadItems(file: File, source: 'csv' | 'pdf' = 'csv'): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('source', source);
  
  const response = await fetch(`${API_BASE}/api/items/upload`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export async function addManualItem(data: {
  mfg_part_num: string;
  part_desc?: string;
  e1_brand?: string;
  unilog_brand?: string;
  dib_brand?: string;
  part_manuf?: string;
}): Promise<UploadResponse> {
  const response = await fetch(`${API_BASE}/api/items/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to add item' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}