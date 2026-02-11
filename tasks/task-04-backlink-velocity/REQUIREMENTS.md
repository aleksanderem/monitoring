# Task #4: Backlink Velocity Tracking

## Objective
Track and visualize the rate of backlink acquisition and loss over time to identify growth patterns, detect anomalies, and provide early warning for link loss.

## Requirements

### Backend Schema
- `backlinkVelocityHistory` table with fields:
  - `domainId` (Id<"domains">)
  - `date` (string, YYYY-MM-DD format)
  - `newBacklinks` (number)
  - `lostBacklinks` (number)
  - `netChange` (number, calculated: new - lost)
  - `totalBacklinks` (number, snapshot of total on this date)
  - `createdAt` (number, timestamp)
- Indexed by `domainId` and `date` for efficient queries

### Backend Queries
1. `getVelocityHistory(domainId, days=30)` - Fetch daily velocity data
2. `getVelocityStats(domainId, days=30)` - Calculate aggregated statistics:
   - Average new backlinks per day
   - Average lost backlinks per day
   - Average net change per day
   - Total new, lost, net for period
3. `detectVelocityAnomalies(domainId, days=30)` - Statistical anomaly detection:
   - Use z-scores to identify spikes/drops
   - Threshold: >2 standard deviations
   - Return list of anomaly dates with severity

### Backend Mutations
1. `saveDailyVelocity` (internal) - Store velocity calculation results

### Cron Job
- Function: `calculateDailyBacklinkVelocity`
- Schedule: Daily at 2 AM UTC (after backlink refresh)
- Process:
  1. Get all domains with backlink data
  2. For each domain:
     - Count new backlinks (`firstSeen` = today OR `isNew` = true)
     - Count lost backlinks (`isLost` = true)
     - Calculate net change
     - Get total backlinks count
     - Store in `backlinkVelocityHistory` table
  3. Log results (domains processed, errors)

### Frontend Components

**1. BacklinkVelocityChart**
- Composed chart using Recharts
- Visual elements:
  - **Green bars**: New backlinks gained (left)
  - **Red bars**: Backlinks lost (right)
  - **Blue line**: Net change (overlay)
- Axes:
  - X-axis: Dates (last 30 days default)
  - Y-axis: Count (0 to max)
- Features:
  - Interactive tooltip showing all 3 metrics
  - Legend clearly labeled
  - Summary statistics in header
  - Empty state with helpful message
  - Loading skeleton
- Uses shadcn/ui ChartContainer

**2. VelocityMetricsCards**
- 4 metric cards in responsive grid:
  1. **Avg New/Day**: Green badge with up arrow, shows average
  2. **Avg Lost/Day**: Red badge with down arrow, shows average
  3. **Net Growth**: Color-coded by trend (green positive, red negative)
  4. **7-Day Velocity**: Recent trend using 7-day data
- Features:
  - Color-coded icons (TrendUp01, TrendDown01)
  - Formatted numbers (1 decimal place)
  - Loading skeletons
  - Consistent styling with project

**3. AnomalyAlert (Optional)**
- Shows alerts for detected anomalies
- Alert properties:
  - Date of anomaly
  - Type: Spike/Drop
  - Severity: High/Medium/Low
  - Count: "+50 backlinks" or "-30 backlinks"
  - Icon: Warning
- Features:
  - Can be dismissed
  - Links to detailed view
  - Dismissed state persists

### Integration
- Add to Backlinks tab in domain detail page
- Position: Below BacklinksHistoryChart
- Section header: "Backlink Velocity"
- Layout: Metrics cards first, chart below

## Success Criteria
- ✅ Daily velocity calculation works (cron job)
- ✅ Velocity data stored correctly in database
- ✅ Chart shows new/lost/net change clearly
- ✅ Metrics cards display correct averages
- ✅ Anomaly detection identifies real spikes (>2 std dev)
- ✅ All data persists correctly
- ✅ Zero console errors
- ✅ Integrates smoothly into Backlinks tab

## Implementation Status
- **Status**: COMPLETED ✅
- **Commits**: c13d444, 8893ff4
- **Files Created**: 3 (queries, chart, metrics cards)
- **Files Modified**: 4 (schema, scheduler, crons, domain page)
- **Lines Added**: 450+

## Dependencies
- Existing backlinks infrastructure (uses `isNew`, `isLost` flags)
- Backlinks must have `firstSeen` and `lastSeen` dates

## Known Limitations
- Anomaly detection UI (alerts) not fully implemented
- Velocity sparkline in domain list not implemented
- Historical backfill not automated (only tracks forward from deployment)
- Cron job assumes backlink refresh runs before 2 AM

## Data Flow

```
1. Backlink Refresh (existing, runs nightly)
   ↓
2. Updates backlinks table with isNew/isLost flags
   ↓
3. calculateDailyBacklinkVelocity (cron, 2 AM)
   ↓
4. Counts new/lost backlinks for each domain
   ↓
5. Stores in backlinkVelocityHistory table
   ↓
6. Frontend queries velocity data
   ↓
7. Charts and metrics display to user
```

## Statistical Methods

**Averages:**
```
avgNewPerDay = sum(newBacklinks) / daysTracked
avgLostPerDay = sum(lostBacklinks) / daysTracked
avgNetChange = sum(netChange) / daysTracked
```

**Anomaly Detection (Z-Score):**
```
mean = average(netChange values)
stdDev = standardDeviation(netChange values)
zScore = (value - mean) / stdDev

If |zScore| > 2.5: Anomaly (High severity)
If |zScore| > 2.0: Anomaly (Medium severity)
If |zScore| > 1.5: Anomaly (Low severity)
```

## Future Enhancements
1. Historical backfill for existing domains
2. Anomaly alert UI with dismiss functionality
3. Velocity sparkline in domain list table
4. Email notifications for velocity anomalies
5. Velocity forecasting (predict future trends)
6. Velocity comparison across multiple domains
7. Export velocity data to CSV
