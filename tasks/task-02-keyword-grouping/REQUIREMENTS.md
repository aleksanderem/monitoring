# Task #2: Keyword Grouping and Tagging System

## Objective
Implement a complete keyword grouping and tagging system to organize keywords into custom groups and apply flexible tags for better keyword management and reporting.

## Requirements

### Backend Schema
- `keywordGroups` table with fields:
  - `domainId` (Id<"domains">)
  - `name` (string)
  - `description` (optional string)
  - `color` (string - hex color)
  - `createdAt` (number)
- `keywordGroupMemberships` table for many-to-many relationship:
  - `keywordId` (Id<"keywords">)
  - `groupId` (Id<"keywordGroups">)
  - `addedAt` (number)
- `tags` field added to keywords table (array of strings)

### Backend Queries
1. `getGroupsByDomain` - List all groups with keyword counts
2. `getGroupStats` - Detailed statistics for specific group
3. `getKeywordsByGroup` - Filter keywords by group membership
4. `getGroupsForKeyword` - Get all groups a keyword belongs to
5. `getGroupPerformanceHistory` - Historical avg position for group (30 days)
6. `getAllGroupsPerformance` - Compare all groups' performance over time

### Backend Mutations
1. `createGroup` - Create new group with validation
2. `updateGroup` - Update group properties
3. `deleteGroup` - Delete group and clean up memberships
4. `addKeywordsToGroup` - Bulk add keywords to groups
5. `removeKeywordsFromGroup` - Bulk remove keywords
6. `bulkTagKeywords` - Add tags to multiple keywords
7. `removeTagFromKeywords` - Remove specific tag

### Frontend Components
1. **GroupManagementModal** - Full CRUD interface for groups
   - Create/edit/delete groups
   - Color picker with 8 predefined colors
   - Shows keyword count per group
   - Inline editing mode
   - Delete confirmation

2. **GroupPerformanceChart** - Compare avg position across groups
   - Line chart with group colors
   - X-axis: dates, Y-axis: position (inverted)
   - shadcn/ui ChartContainer
   - Empty state handling

3. **KeywordMonitoringTable Integration**
   - Group filter dropdown
   - "Manage Groups" button
   - Bulk actions: "Add to Group", "Add Tags"
   - Bulk tag modal with comma-separated input

## Success Criteria
- ✅ Can create/edit/delete groups with custom colors
- ✅ Can assign keywords to multiple groups
- ✅ Can filter keywords by group
- ✅ Can add/remove tags in bulk
- ✅ Group performance chart shows comparison
- ✅ All data persists after page refresh
- ✅ Zero console errors
- ✅ Zero TypeScript errors

## Implementation Status
- **Status**: COMPLETED ✅
- **Commits**: b132f13, cb59100, c13d444
- **Files Created**: 4 (queries, mutations, modal, chart)
- **Files Modified**: 2 (schema, table)
- **Lines Added**: 1,170+

## Dependencies
- None (independent task)

## Known Limitations
- Group filtering supports single group only (not multi-select)
- Tag badges on keyword rows not yet implemented (structure ready)
- Inline tag editing not implemented (bulk only)
- Group performance chart uses fixed 30-day range (will integrate with Task #3)
