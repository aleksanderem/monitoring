# Task #7: Forecasting & Predictive Analytics - Testing Protocol

## Test Environment Setup

### Prerequisites
1. Convex development server running (`npx convex dev`)
2. Next.js development server running (`npm run dev`)
3. At least one domain with 30+ days of keyword position history
4. Browser console open for error checking

## Backend Testing

### Test 1: Schema Deployment ✅ COMPLETED

**Objective:** Verify forecasts and anomalies tables were created

**Steps:**
1. Run: `npx convex dev --once`
2. Open Convex dashboard
3. Navigate to Data tab
4. Verify tables exist:
   - forecasts (with by_entity index)
   - anomalies (with 4 indexes)

**Expected Result:**
- Both tables visible in dashboard
- Indexes properly configured
- No schema errors

**Status:** PASSING ✅
- Schema deployed successfully at 19:34:58
- Both tables created with all indexes

### Test 2: Linear Regression Calculation

**Objective:** Test statistical regression algorithm

**Steps:**
1. Open Convex dashboard
2. Navigate to Functions tab
3. Find `forecasts_actions:calculateLinearRegression`
4. Test with sample data:
```json
{
  "dataPoints": [
    {"date": "2026-01-01", "value": 10},
    {"date": "2026-01-02", "value": 12},
    {"date": "2026-01-03", "value": 14},
    {"date": "2026-01-04", "value": 16},
    {"date": "2026-01-05", "value": 18}
  ]
}
```

**Expected Result:**
```json
{
  "slope": 2.0,
  "intercept": 10.0,
  "r2": 1.0,
  "rmse": 0.0,
  "standardError": 0.0,
  "firstDate": "2026-01-01"
}
```

**Validation:**
- R² should be close to 1.0 (perfect fit for linear data)
- Slope should be ~2.0 (value increases by 2 each day)
- RMSE should be near 0 (perfect predictions)

### Test 3: Generate Keyword Forecast

**Objective:** Create a forecast for a keyword with sufficient history

**Steps:**
1. Find a keyword ID with 30+ days of position data
2. Run action: `forecasts_actions:generateKeywordForecast`
```json
{
  "keywordId": "<KEYWORD_ID>",
  "metric": "position",
  "daysToForecast": 30
}
```

**Expected Result:**
```json
{
  "success": true,
  "predictions": 30,
  "accuracy": {
    "r2": <number between 0-1>,
    "rmse": <number>,
    "confidenceLevel": "high" | "medium" | "low"
  }
}
```

**Validation:**
- Success should be true
- predictions should equal 30
- R² between 0 and 1
- RMSE should be reasonable (< 20 for positions)
- Confidence level assigned based on RMSE thresholds

### Test 4: Anomaly Detection (Z-Score)

**Objective:** Detect statistical outliers in position data

**Steps:**
1. Find a keyword with recent position changes
2. Run action: `forecasts_actions:detectAnomaliesForEntity`
```json
{
  "entityType": "keyword",
  "entityId": "<KEYWORD_ID>",
  "metric": "position"
}
```

**Expected Result:**
```json
{
  "anomaliesDetected": <number>
}
```

**Validation:**
- If keyword has stable positions: anomaliesDetected = 0
- If keyword has recent spikes/drops: anomaliesDetected > 0
- Check anomalies table in dashboard for created records

### Test 5: Daily Anomaly Detection Cron

**Objective:** Verify scheduler runs successfully

**Steps:**
1. Run manually: `npx convex run scheduler:detectAnomaliesDaily`
2. Check console output

**Expected Result:**
```
Running daily anomaly detection for X domains
Anomaly detection complete: Y keywords processed, Z anomalies detected, 0 errors
```

**Validation:**
- processed > 0 if there are active keywords
- errors should be 0
- anomaliesDetected may be 0 or higher

### Test 6: Forecast Query

**Objective:** Retrieve forecast from database

**Steps:**
1. After generating a forecast (Test 3)
2. Run query: `forecasts_queries:getForecast`
```json
{
  "entityType": "keyword",
  "entityId": "<KEYWORD_ID>",
  "metric": "position"
}
```

**Expected Result:**
```json
{
  "_id": "...",
  "entityType": "keyword",
  "entityId": "<KEYWORD_ID>",
  "metric": "position",
  "generatedAt": <timestamp>,
  "predictions": [
    {
      "date": "2026-02-01",
      "value": <number 1-100>,
      "confidenceLower": <number>,
      "confidenceUpper": <number>
    },
    // ... 30 predictions
  ],
  "accuracy": {
    "r2": <number>,
    "rmse": <number>,
    "confidenceLevel": "high|medium|low"
  }
}
```

## Frontend Testing

### Test 7: Insights Dashboard Page

**Objective:** Verify Insights page renders and displays anomalies

**Steps:**
1. Navigate to `/domains/<DOMAIN_ID>/insights`
2. Check page loads without errors
3. Verify summary cards display
4. Test severity filter dropdown
5. Test status filter dropdown
6. Check anomaly cards render

**Expected Behavior:**
- Page loads with title "Insights & Anomalies"
- 4 summary cards show counts (Total, High, Medium, Low)
- Filters work correctly
- Anomaly cards show:
  - Severity badge
  - Type badge (spike/drop/pattern_change)
  - Description
  - Metrics (actual, expected, z-score)
  - "Mark as Resolved" button (if unresolved)

**Screenshots to Capture:**
- Full page view
- Anomaly card detail
- Empty state (if no anomalies)

### Test 8: PredictionBadge Component

**Objective:** Verify prediction badges display in keyword table

**Note:** Integration with KeywordMonitoringTable is pending. To test:

1. Import PredictionBadge in a test page
2. Pass keywordId and currentPosition props
3. Verify badge displays:
   - "Trending Up" (green) if improving >5 positions
   - "Trending Down" (red) if worsening >5 positions
   - "Stable" (gray) if ±5 positions
4. Hover over badge to see tooltip:
   - Current position
   - Predicted position (30d)
   - Position change
   - Confidence level and R²

**Expected Behavior:**
- Badge only shows if forecast exists
- Correct variant based on trend
- Tooltip displays all metrics
- No errors in console

### Test 9: ForecastSummaryCard Component

**Objective:** Verify forecast summary card on overview page

**Note:** Integration with domain overview is pending. To test:

1. Add ForecastSummaryCard to domain overview page
2. Pass domainId prop
3. Verify card displays:
   - Title "30-Day Forecast"
   - Confidence badge
   - Trend icon (up/down/stable)
   - Projected ETV change value
   - Analysis description

**Expected Behavior:**
- Card loads with trend calculation
- Trend icon and color match projected change
- Confidence level displayed correctly
- Clicking card navigates to Insights page
- Shows "Not enough data" if <10 days history

### Test 10: ForecastOverlay Component

**Objective:** Verify forecast overlay renders on charts

**Note:** Integration with charts is optional. To test:

1. Choose a chart component (e.g., PositionHistoryChart)
2. Generate forecast for displayed data
3. Merge historical and forecast data using helper function
4. Add ForecastOverlay component to chart
5. Verify:
   - Dashed forecast line appears
   - Confidence interval shaded area (if enabled)
   - Forecast starts where historical data ends
   - Legend includes forecast series

**Expected Behavior:**
- Forecast line is dashed and blue
- Confidence area is light blue with low opacity
- Lines connect smoothly at historical/forecast boundary
- No rendering errors

## Integration Testing

### Test 11: End-to-End Workflow

**Objective:** Test complete forecasting workflow

**Steps:**
1. Generate forecast for a keyword:
   ```bash
   npx convex run forecasts_actions:generateKeywordForecast \
     --keywordId <ID> --metric position --daysToForecast 30
   ```

2. Navigate to domain overview page
   - Verify ForecastSummaryCard shows projected change

3. Navigate to Insights page
   - Verify anomalies are listed (if any detected)

4. Open KeywordMonitoringTable
   - Verify PredictionBadge shows for forecasted keywords

5. Trigger anomaly detection:
   ```bash
   npx convex run scheduler:detectAnomaliesDaily
   ```

6. Refresh Insights page
   - Verify new anomalies appear

7. Click "Mark as Resolved" on an anomaly
   - Verify it disappears from unresolved list
   - Verify it appears in resolved list (when filtered)

**Expected Behavior:**
- Complete workflow executes without errors
- Data flows correctly between backend and frontend
- UI updates reflect database changes
- All components interact correctly

## Performance Testing

### Test 12: Large Dataset Performance

**Objective:** Verify performance with realistic data volumes

**Test Scenarios:**
1. Domain with 1000+ keywords
   - Run detectDomainAnomalies
   - Measure execution time (should complete in <30s)

2. Keyword with 365 days of history
   - Generate forecast
   - Verify calculation completes quickly (<2s)

3. Insights page with 100+ anomalies
   - Test page load time
   - Test filter responsiveness
   - Check for UI lag

**Expected Performance:**
- Backend actions complete in reasonable time
- UI remains responsive
- No memory leaks
- Efficient database queries

## Error Handling Testing

### Test 13: Edge Cases

**Test Cases:**

1. **Insufficient Data:**
   - Try generating forecast with <10 data points
   - Expected: Error message "Need at least 10 historical data points"

2. **No Historical Data:**
   - Try forecast for newly added keyword
   - Expected: Graceful failure with helpful message

3. **All Null Positions:**
   - Keyword with all null position values
   - Expected: "No valid data points" message

4. **Invalid Entity ID:**
   - Pass non-existent keyword ID
   - Expected: Returns null or error

5. **Network Errors:**
   - Simulate network failure during forecast generation
   - Expected: Proper error handling and user feedback

## Console Error Check

### Test 14: Zero Console Errors

**Objective:** Ensure no JavaScript errors in browser console

**Steps:**
1. Open browser DevTools Console
2. Navigate through all new pages/components:
   - /domains/[id]/insights
   - Components with PredictionBadge
   - Components with ForecastSummaryCard
3. Interact with all features:
   - Filters
   - Resolve buttons
   - Tooltips
   - Links

**Expected Result:**
- Zero console errors
- Zero console warnings (except expected Convex messages)
- No React warnings

**Status Check:**
```
✅ No errors
✅ No warnings
✅ All components render correctly
```

## TypeScript Compilation

### Test 15: Zero TypeScript Errors

**Objective:** Ensure code compiles without TypeScript errors

**Steps:**
1. Run: `npx tsc --noEmit`
2. Check output for forecasting-related files

**Expected Result:**
- Zero TypeScript errors in:
  - convex/forecasts_queries.ts
  - convex/forecasts_mutations.ts
  - convex/forecasts_actions.ts
  - src/app/(dashboard)/domains/[domainId]/insights/page.tsx
  - src/components/domain/badges/PredictionBadge.tsx
  - src/components/domain/cards/ForecastSummaryCard.tsx
  - src/components/domain/overlays/ForecastOverlay.tsx

**Status:** PASSING ✅
- All forecasting files have 0 TypeScript errors
- Verified during deployment

## Production Build Test

### Test 16: Production Build

**Objective:** Ensure code builds for production

**Steps:**
1. Run: `npm run build`
2. Check build output
3. Verify no errors in forecasting pages/components

**Expected Result:**
- Build completes successfully
- All routes compile correctly
- /domains/[domainId]/insights route included in build

## Test Summary Checklist

- [ ] Backend: Schema deployed
- [ ] Backend: Linear regression calculation works
- [ ] Backend: Keyword forecast generation works
- [ ] Backend: Anomaly detection works
- [ ] Backend: Cron job executes successfully
- [ ] Backend: Queries return correct data
- [ ] Frontend: Insights page renders
- [ ] Frontend: Filters work correctly
- [ ] Frontend: Anomaly cards display properly
- [ ] Frontend: Resolve functionality works
- [ ] Frontend: PredictionBadge displays and updates
- [ ] Frontend: ForecastSummaryCard calculates trends
- [ ] Frontend: ForecastOverlay renders on charts
- [ ] Integration: End-to-end workflow completes
- [ ] Performance: Large datasets handled efficiently
- [ ] Errors: Edge cases handled gracefully
- [ ] Quality: Zero console errors
- [ ] Quality: Zero TypeScript errors
- [ ] Quality: Production build succeeds

## Notes

- Some frontend components require integration into existing pages (KeywordMonitoringTable, domain overview)
- ForecastOverlay integration is optional enhancement
- Daily cron will run automatically at 3 AM UTC
- Manual testing can be done anytime using Convex dashboard
