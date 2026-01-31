# Task #7: Forecasting & Predictive Analytics

## Overview

Complete statistical forecasting and anomaly detection system for the monitoring application.

## Requirements

### Backend

#### Schema (convex/schema.ts)

**forecasts table:**
- entityType: "keyword" | "domain"
- entityId: string (ID reference)
- metric: string (e.g., "position", "traffic", "backlinks")
- generatedAt: number (timestamp)
- predictions: array of {date, value, confidenceLower, confidenceUpper}
- accuracy: {r2, rmse, confidenceLevel}
- Index: by_entity (entityType, entityId, metric)

**anomalies table:**
- entityType: "keyword" | "domain"
- entityId: string (ID reference)
- metric: string
- detectedAt: number
- date: string (YYYY-MM-DD)
- type: "spike" | "drop" | "pattern_change"
- severity: "high" | "medium" | "low"
- value: number (actual value)
- expectedValue: number (expected from mean)
- zScore: number (statistical z-score)
- description: string (human-readable explanation)
- resolved: boolean (user acknowledgment)
- Indexes: by_entity, by_date, by_severity, by_resolved

#### Queries (convex/forecasts_queries.ts)

1. **getForecast** - Get latest forecast for entity + metric
2. **getAnomalies** - Get anomalies for domain with filtering
3. **getAnomalySummary** - Count anomalies by severity for dashboard
4. **getKeywordAnomalies** - Get all anomalies for specific keyword

#### Mutations (convex/forecasts_mutations.ts)

1. **generateForecast** - Store/update forecast (replaces existing)
2. **resolveAnomaly** - Mark anomaly as acknowledged
3. **createAnomaly** - Insert/update anomaly detection

#### Actions (convex/forecasts_actions.ts)

1. **calculateLinearRegression** - Core statistical algorithm
   - Input: Array of {date, value} data points
   - Algorithm: Least squares regression
   - Returns: {slope, intercept, r2, rmse, standardError, firstDate}

2. **generateKeywordForecast** - Generate forecast for keyword position
   - Uses last 90 days of position history
   - Requires minimum 10 valid data points
   - Generates 30-day forecast with 95% confidence intervals
   - Bounds predictions to realistic range (1-100)
   - Stores result in database

3. **detectAnomaliesForEntity** - Z-score anomaly detection
   - Analyzes last 30 days of historical data
   - Z-score = (value - mean) / stdDev
   - Flags anomalies when |z| > 2.5
   - Severity levels: high (|z| > 3.5), medium (3.0-3.5), low (2.5-3.0)

4. **generateDomainForecasts** - Batch process all keywords in domain
5. **detectDomainAnomalies** - Batch anomaly detection for domain

#### Scheduler (convex/scheduler.ts & convex/crons.ts)

- **detectAnomaliesDaily** - Daily cron at 3 AM UTC
- Processes all domains
- Runs z-score analysis for all active keywords
- Creates anomaly records for statistical outliers

### Frontend

#### Components Created

1. **/domains/[id]/insights/page.tsx** - Insights Dashboard
   - Anomaly summary cards (total, high, medium, low)
   - Filters by severity and status
   - Anomaly list with cards
   - Resolve functionality

2. **PredictionBadge.tsx** - Table badges showing trends
   - Displays in KeywordMonitoringTable (to be integrated)
   - Shows trending direction (up/down/stable)
   - Tooltip with predicted position and confidence
   - Color-coded by trend

3. **ForecastSummaryCard.tsx** - Overview dashboard card
   - Displays projected ETV change (30 days)
   - Color-coded trend indicator
   - Confidence level badge
   - Links to Insights page

4. **ForecastOverlay.tsx** - Chart overlay component
   - Renders forecast as dashed line
   - Shows confidence interval as shaded area
   - Helper function to merge historical + forecast data
   - Can be integrated into existing charts

## Statistical Formulas

### Linear Regression

```
slope (m) = Σ[(x - x̄)(y - ȳ)] / Σ[(x - x̄)²]
intercept (b) = ȳ - m * x̄
prediction = m * x + b
```

### Model Accuracy

```
R² (coefficient of determination) = 1 - (SSres / SStot)
where:
  SSres = Σ(actual - predicted)²
  SStot = Σ(actual - mean)²

RMSE (Root Mean Squared Error) = √(Σ(actual - predicted)² / n)
Standard Error = RMSE / √n
```

### Confidence Intervals

```
95% Confidence Interval = prediction ± (1.96 * Standard Error)
```

### Z-Score Anomaly Detection

```
Z-score = (value - mean) / stdDev

Flag if |z| > 2.5 (99% confidence)
Severity:
  - High: |z| > 3.5
  - Medium: 3.0 < |z| ≤ 3.5
  - Low: 2.5 < |z| ≤ 3.0
```

## Data Requirements

- **Minimum Data Points:** 10 historical points for reliable forecasting
- **Training Window:** Last 90 days for forecast generation
- **Anomaly Baseline:** Last 30 days for mean/stdDev calculation
- **Forecast Horizon:** 30 days ahead

## Confidence Levels

**Forecast Quality (based on RMSE):**
- High: RMSE < 5
- Medium: 5 ≤ RMSE < 15
- Low: RMSE ≥ 15

**Anomaly Detection Threshold:**
- Z-score threshold: |z| > 2.5 (99% confidence level)

## Integration Points

1. **KeywordMonitoringTable** - Add PredictionBadge column (to be implemented)
2. **Domain Overview Page** - Add ForecastSummaryCard (to be implemented)
3. **Charts** - Integrate ForecastOverlay component (optional)
4. **Navigation** - Add Insights tab to domain detail page (to be implemented)

## Files Created

**Backend (6 files):**
- convex/schema.ts (modified)
- convex/forecasts_queries.ts (~130 lines)
- convex/forecasts_mutations.ts (~130 lines)
- convex/forecasts_actions.ts (~370 lines)
- convex/scheduler.ts (modified)
- convex/crons.ts (modified)

**Frontend (4 files):**
- src/app/(dashboard)/domains/[domainId]/insights/page.tsx (~280 lines)
- src/components/domain/badges/PredictionBadge.tsx (~100 lines)
- src/components/domain/cards/ForecastSummaryCard.tsx (~140 lines)
- src/components/domain/overlays/ForecastOverlay.tsx (~130 lines)

**Total:** ~1,280 lines of implementation code

## Testing Requirements

See TESTING.md for comprehensive testing protocol.
