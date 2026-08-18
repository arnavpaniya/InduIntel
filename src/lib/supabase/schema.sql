-- InduIntel Database Schema
-- Run this in Supabase SQL Editor or via supabase db push

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'csv', 'text')),
  size BIGINT NOT NULL,
  page_count INTEGER,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT,
  manufacturer TEXT,
  model TEXT,
  category TEXT NOT NULL CHECK (category IN ('electric_motor', 'bearing', 'industrial_pump', 'unknown')),
  completeness DECIMAL(5,2) DEFAULT 0,
  confidence DECIMAL(5,2) DEFAULT 0,
  attributes JSONB NOT NULL DEFAULT '[]',
  conflicts JSONB NOT NULL DEFAULT '[]',
  missing_attributes TEXT[] DEFAULT '{}',
  commerce JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product-Document junction table
CREATE TABLE IF NOT EXISTS public.product_documents (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (product_id, document_id)
);

-- Evidence table
CREATE TABLE IF NOT EXISTS public.evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL,
  page INTEGER NOT NULL,
  quote TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exports table
CREATE TABLE IF NOT EXISTS public.exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('json', 'csv')),
  file_path TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Demo cache table for Demo Mode
CREATE TABLE IF NOT EXISTS public.demo_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_hash TEXT UNIQUE NOT NULL,
  product_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security Policies

-- Users: users can only see their own profile
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Documents: users can only access their own documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own documents" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.documents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

-- Products: users can only access their own products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own products" ON public.products
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products" ON public.products
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON public.products
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON public.products
  FOR DELETE USING (auth.uid() = user_id);

-- Product-Documents: users can only access their own product-document links
ALTER TABLE public.product_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own product-documents" ON public.product_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own product-documents" ON public.product_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = auth.uid()
    )
  );

-- Evidence: users can only access evidence for their own products
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own evidence" ON public.evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own evidence" ON public.evidence
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = auth.uid()
    )
  );

-- Exports: users can only access their own exports
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own exports" ON public.exports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exports" ON public.exports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Demo cache: public read for demo mode
ALTER TABLE public.demo_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read demo cache" ON public.demo_cache
  FOR SELECT USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_product_documents_product_id ON public.product_documents(product_id);
CREATE INDEX IF NOT EXISTS idx_product_documents_document_id ON public.product_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_evidence_product_id ON public.evidence(product_id);
CREATE INDEX IF NOT EXISTS idx_evidence_document_id ON public.evidence(document_id);
CREATE INDEX IF NOT EXISTS idx_evidence_attribute_key ON public.evidence(attribute_key);
CREATE INDEX IF NOT EXISTS idx_exports_user_id ON public.exports(user_id);
CREATE INDEX IF NOT EXISTS idx_exports_product_id ON public.exports(product_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();