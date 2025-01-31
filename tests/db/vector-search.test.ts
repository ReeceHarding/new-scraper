import { supabase } from '../utils/test-utils';

describe('Vector Search', () => {
  beforeEach(async () => {
    // Clean up test data
    await supabase.from('vector_embeddings').delete().neq('id', 0);
  });

  it('should store and retrieve vector embeddings', async () => {
    const embedding = {
      text: 'Test text for vector search',
      embedding: Array(1536).fill(0.1),
      metadata: { source: 'test' },
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('vector_embeddings')
      .insert([embedding])
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.text).toBe(embedding.text);
    expect(data.embedding).toEqual(embedding.embedding);
    expect(data.metadata).toEqual(embedding.metadata);
  });

  it('should perform vector similarity search', async () => {
    const embeddings = [
      {
        text: 'First test text',
        embedding: Array(1536).fill(0.1),
        metadata: { source: 'test1' },
        created_at: new Date().toISOString()
      },
      {
        text: 'Second test text',
        embedding: Array(1536).fill(0.2),
        metadata: { source: 'test2' },
        created_at: new Date().toISOString()
      }
    ];

    await supabase.from('vector_embeddings').insert(embeddings);

    const queryEmbedding = Array(1536).fill(0.15);
    const { data, error } = await supabase.rpc('match_embeddings', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('similarity');
  });

  it('should filter vector search by metadata', async () => {
    const queryEmbedding = Array(1536).fill(0.1);
    const metadata = { source: 'test' };
    
    const { data: results, error } = await supabase.rpc('match_embeddings', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
      filter: metadata,
    });

    expect(error).toBeNull();
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    results.forEach(result => {
      expect(result.metadata.source).toBe(metadata.source);
    });
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('vector_embeddings').delete().neq('id', 0);
  });
}); 