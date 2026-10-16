-- db/migration-001.sql
-- Run once in the Supabase SQL editor (after schema.sql).
-- Adds the dataset name and the original BEIR id, so eval can map results back.

alter table documents
  add column if not exists dataset text,
  add column if not exists external_id text;

create unique index if not exists documents_dataset_ext_uq
  on documents (dataset, external_id);

-- one chunk per (document, position), so re-running ingest never duplicates rows
create unique index if not exists chunks_doc_idx_uq
  on chunks (document_id, chunk_index);
