# R11: CSV/Excel Import & Export — Implementation Plan

## Task 1: Install Dependencies

Install papaparse for CSV parsing and xlsx for Excel reading.

```bash
npm install papaparse xlsx
npm install -D @types/papaparse
```

## Task 2: CSV/Excel Parser Utility

Create `src/utils/csvParser.ts`:
- `parseCSVFile(file: File): Promise<ParseResult>` — uses papaparse
- `parseXLSXFile(file: File): Promise<ParseResult>` — uses xlsx
- `parseFile(file: File): Promise<ParseResult>` — auto-detects format
- `ParseResult = { headers: string[], rows: string[][], error?: string }`

## Task 3: Export Utility

Create `src/utils/exportCsv.ts`:
- `exportToCsv(filename: string, headers: string[], rows: string[][])` — creates blob, triggers download
- `exportToExcel(filename: string, sheets: { name: string, headers: string[], rows: string[][] }[])` — multi-sheet xlsx export
- Reusable across all tables

## Task 4: Column Mapping Wizard Component

Create `src/components/domain/modals/ImportWizardModal.tsx`:
- Generic wizard component accepting target field definitions
- Steps: Upload -> Preview -> Map -> Validate -> Import
- Auto-detection of column mappings from header names
- Preview table showing first 5 rows
- Dropdown per column for field mapping
- Validation summary before import

## Task 5: Keyword Import Integration

Create `src/components/domain/modals/KeywordImportModal.tsx`:
- Uses ImportWizardModal with keyword-specific field definitions
- Calls addKeywords mutation in batches of 100
- Shows progress and results
- Accessible from KeywordMonitoringTable header

## Task 6: Competitor Import Integration

Create `src/components/domain/modals/CompetitorImportModal.tsx`:
- Uses ImportWizardModal with competitor field definitions
- Calls addCompetitor mutation for each competitor
- Accessible from CompetitorManagementSection

## Task 7: Export Buttons on Tables

Add export buttons to:
- KeywordMonitoringTable — export all keywords
- BacklinksTable — enhance existing selected export + add "Export All"
- CompetitorManagementSection — export competitors list
- DiscoveredKeywordsTable — export discovered keywords

## Task 8: Position History Export

Add date-range CSV export for keyword position history. Accessible from the keyword detail modal or monitoring table.

## Task 9: Tests

- Unit tests for CSV parser utility
- Unit tests for export utility
- Component tests for ImportWizardModal
- Integration tests for keyword import flow
