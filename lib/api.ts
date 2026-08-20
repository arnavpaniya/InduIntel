import { 
  ItemsResponse, 
  EnrichedItem, 
  EnrichRunResponse, 
  BatchEnrichResponse,
  ScoreItemResponse,
  BatchScoreResponse,
  QuotaStatus 
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
}): Promise<ItemsResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  
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