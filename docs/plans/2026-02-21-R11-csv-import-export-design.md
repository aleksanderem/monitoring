# R11: CSV/Excel Import & Export — Design Document

## Overview

Add CSV and Excel import/export capabilities to the monitoring app. Users can import keywords, competitors, and domains from CSV files, and export table data from any major data view.

## Import Flows

### 1. Keywords CSV Import

Upload a CSV file containing keyword phrases and optional metadata (position, volume, difficulty, CPC, tags). A column mapping wizard allows users to map CSV columns to keyword fields.

Supported fields for mapping:
- phrase (required) — the keyword text
- searchVolume — monthly search volume
- difficulty — keyword difficulty (0-100)
- currentPosition — current SERP position
- tags — comma-separated tags
- keywordType — "core", "longtail", or "branded"

Flow: Upload file -> Preview first 5 rows -> Map columns via dropdowns -> Validate -> Show summary (X to import, Y duplicates skipped, Z invalid) -> Confirm -> Batch insert via addKeywords mutation.

### 2. Competitor List Import

Upload a CSV with competitor domains. Minimal mapping: just needs a "domain" column.

Supported fields:
- competitorDomain (required) — the competitor domain name
- name — friendly display name

Flow: Upload -> Preview -> Map columns -> Validate domains -> Import via addCompetitor mutation in loop.

### 3. Bulk Domain Import

Not implementing in this phase — domain creation requires project context, settings (search engine, location, language), and is typically done one at a time. The complexity of settings mapping outweighs the benefit.

## Export Flows

### 1. Keywords Table -> CSV

Export all keywords for a domain with columns: Keyword, Position, Previous Position, Change, Search Volume, Difficulty, CPC, URL, Status, Tags, Last Updated.

Triggered from a button in the KeywordMonitoringTable header.

### 2. Backlinks Table -> CSV

Already partially implemented (selected rows only). Extend to support "Export All" in addition to selected.

### 3. Competitors Table -> CSV

Export competitor list with columns: Competitor Domain, Name, Status, Last Checked.

### 4. Position History -> CSV

Export keyword position history with date range filter. Columns: Keyword, Date, Position, URL, Search Volume, Difficulty, CPC.

### 5. Discovered Keywords -> CSV

Export discovered keywords with all available metrics.

## Column Mapping Wizard UX

1. User clicks "Import CSV" button
2. File picker opens (accepts .csv, .xlsx)
3. File is parsed client-side (no server upload needed)
4. Preview shows first 5 rows in a table
5. Above each column, a dropdown allows mapping to a target field
6. Auto-detection: wizard tries to match column headers to field names
7. User confirms mapping
8. Validation runs, showing errors inline
9. Import summary dialog shows results
10. User clicks "Import" to execute

## File Format Support

- CSV: parsed with papaparse (handles quoting, escaping, different delimiters)
- XLSX: parsed with xlsx (SheetJS) — lightweight, read-only sufficient

## Size Limits

- Max file size: 5MB
- Max rows per import: 10,000 keywords, 100 competitors
- Batch size for mutations: 100 items per batch call

## Error Handling

- Invalid rows are skipped with error messages shown in summary
- Duplicate keywords are silently skipped (counted in summary)
- Network errors during batch import show partial progress
- User can cancel mid-import (remaining batches are not sent)

## Validation Rules

Keywords:
- phrase must be 2-80 chars
- No URLs or domain-looking strings
- No pure numeric strings
- Max 30% special characters

Competitors:
- Must look like a valid domain (contains a dot, no spaces)
- Stripped of protocol prefix

## No Schema Changes Required

All import operations use existing mutations (addKeywords, addCompetitor). No new Convex tables or fields needed.
