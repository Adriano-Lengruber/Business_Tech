export interface TextChunk {
  index: number;
  content: string;
}

export function chunkText(
  rawText: string,
  maxChars = 700,
  overlapChars = 100,
): TextChunk[] {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + maxChars);
    if (end < normalized.length) {
      const lastBreak = Math.max(
        normalized.lastIndexOf('\n', end),
        normalized.lastIndexOf('. ', end),
      );
      if (lastBreak > start + Math.floor(maxChars * 0.4)) {
        end = lastBreak + 1;
      }
    }

    const piece = normalized.slice(start, end).trim();
    if (piece) {
      chunks.push({ index, content: piece });
      index += 1;
    }

    if (end >= normalized.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}

export const EMBEDDING_DIMENSIONS = 1024;

/**
 * Gera embedding determinístico normalizado (L2=1) de 1024 dimensões como fallback offline
 * quando o servidor Ollama local não está disponível para embeddings neurais.
 */
export function generateDeterministicFallbackEmbedding(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIMENSIONS);
  const tokens = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);

  for (const token of tokens) {
    let h1 = 2166136261;
    let h2 = 16777619;
    for (let i = 0; i < token.length; i++) {
      const c = token.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619);
      h2 = Math.imul(h2 + c * (i + 1), 2654435761);
    }
    const idx1 = Math.abs(h1) % EMBEDDING_DIMENSIONS;
    const idx2 = Math.abs(h2) % EMBEDDING_DIMENSIONS;
    vec[idx1] = (vec[idx1] ?? 0) + 1;
    vec[idx2] = (vec[idx2] ?? 0) + 0.5;
  }

  let normSq = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    const val = vec[i] ?? 0;
    normSq += val * val;
  }
  const norm = Math.sqrt(normSq) || 1;
  return Array.from(vec, (v) => Number((v / norm).toFixed(6)));
}

export async function generateEmbeddingLocalFirst(params: {
  text: string;
  ollamaBaseUrl: string;
  embeddingModel: string;
}): Promise<{ embedding: number[]; provider: 'ollama' | 'deterministic-fallback' }> {
  const ollamaRoot = params.ollamaBaseUrl.replace(/\/v1\/?$/, '');
  try {
    const res = await fetch(`${ollamaRoot}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: params.embeddingModel,
        prompt: params.text,
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const data = (await res.json()) as { embedding?: number[] };
      if (
        Array.isArray(data.embedding) &&
        data.embedding.length === EMBEDDING_DIMENSIONS
      ) {
        return { embedding: data.embedding, provider: 'ollama' };
      }
    }
  } catch {
    // Fallback determinístico offline
  }

  return {
    embedding: generateDeterministicFallbackEmbedding(params.text),
    provider: 'deterministic-fallback',
  };
}

export interface RankedChunkHit {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  rankScore?: number;
}

export function reciprocalRankFusion(
  lexicalHits: readonly RankedChunkHit[],
  vectorHits: readonly RankedChunkHit[],
  k = 60,
): RankedChunkHit[] {
  const scores = new Map<string, { item: RankedChunkHit; score: number }>();

  const accumulate = (hits: readonly RankedChunkHit[]) => {
    hits.forEach((hit, idx) => {
      const rrf = 1 / (k + idx + 1);
      const prev = scores.get(hit.id);
      if (prev) {
        prev.score += rrf;
      } else {
        scores.set(hit.id, { item: hit, score: rrf });
      }
    });
  };

  accumulate(lexicalHits);
  accumulate(vectorHits);

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map((entry) => ({
      ...entry.item,
      rankScore: Math.round(entry.score * 10000) / 10000,
    }));
}
