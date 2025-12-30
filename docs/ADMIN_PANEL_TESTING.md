# Admin Panel Testing Guide

**Version**: 0.5.8
**Last Updated**: 2024-12-29
**Spec**: 007-admin-panel

---

## Prerequisites

### 1. Environment Setup

```bash
# Install dependencies
pnpm install

# Create .env file (if not exists)
cp .env.example .env

# Required environment variables
VITE_SUPABASE_URL=https://johspxgvkbrysxhilmbg.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 2. Admin Credentials

| Field | Value |
|-------|-------|
| Email | `maslennikov.ig@gmail.com` |
| Password | Use Supabase Auth password |

**To create admin account** (if not exists):
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Enter email: `maslennikov.ig@gmail.com`
4. Set password
5. Confirm email if required

### 3. Start Development Server

```bash
pnpm dev
# Server starts at http://localhost:3000
```

---

## Test Scenarios

### 1. Authentication

#### 1.1 Login Page
- [ ] Navigate to `http://localhost:3000/admin`
- [ ] Verify login form displays
- [ ] Verify i18n: check Russian/English/Chinese labels
- [ ] Enter valid admin credentials
- [ ] Click "Sign In"
- [ ] Verify redirect to Dashboard

#### 1.2 Access Denied
- [ ] Log out from admin panel
- [ ] Login with non-admin email
- [ ] Verify 403 Forbidden page displays
- [ ] Verify "Return to Home" link works

#### 1.3 Session Persistence
- [ ] Login to admin panel
- [ ] Close browser tab
- [ ] Reopen `http://localhost:3000/admin`
- [ ] Verify auto-login (session restored)

---

### 2. Dashboard Page

**URL**: `/admin/dashboard`

#### 2.1 Statistics Cards
- [ ] Verify 4 stat cards display:
  - Total Users
  - Total Analyses
  - Active Today
  - Total Revenue (RUB)
- [ ] Verify loading skeletons show during fetch
- [ ] Verify numbers format correctly (Russian locale)

#### 2.2 Error Handling
- [ ] Disconnect network
- [ ] Refresh page
- [ ] Verify error message displays
- [ ] Verify "Retry" button appears
- [ ] Reconnect network
- [ ] Click "Retry"
- [ ] Verify data loads

#### 2.3 Quick Links
- [ ] Click "System Config" → navigates to `/admin/system-config`
- [ ] Click "Users" → navigates to `/admin/users`
- [ ] Click "Messages" → navigates to `/admin/messages`
- [ ] Click "Costs" → navigates to `/admin/costs`

---

### 3. Users Page

**URL**: `/admin/users`

#### 3.1 User List
- [ ] Verify table displays with columns:
  - Telegram ID
  - Display Name
  - Credits (Basic/Pro/Cassandra badges)
  - Last Active
- [ ] Verify pagination works (if >25 users)
- [ ] Verify "Page X of Y" displays correctly

#### 3.2 Search
- [ ] Type in search box
- [ ] Verify 300ms debounce (doesn't search immediately)
- [ ] Verify results filter by Telegram ID or name
- [ ] Clear search → all users return

#### 3.3 Sorting
- [ ] Click "Last Active" sort option
- [ ] Verify users sorted by last active date
- [ ] Click "Created At" sort option
- [ ] Verify users sorted by creation date

#### 3.4 CSV Export
- [ ] Click "Export CSV" button
- [ ] Verify CSV file downloads
- [ ] Open CSV in Excel/Google Sheets
- [ ] Verify data is correct and UTF-8 encoded

#### 3.5 User Detail Navigation
- [ ] Click on a user row
- [ ] Verify navigation to `/admin/users/:id`

---

### 4. User Detail Page

**URL**: `/admin/users/:id`

#### 4.1 User Information
- [ ] Verify user info displays:
  - Telegram ID
  - Display Name
  - Language Code
  - Created At
  - Last Active
  - Primary Interface
  - Onboarding Status
  - Ban Status

#### 4.2 Credits Display
- [ ] Verify current credits show (Basic/Pro/Cassandra)
- [ ] Verify credit badges are color-coded

#### 4.3 Credit Adjustment (Optimistic Updates)
- [ ] Enter adjustment values (e.g., Basic: +10)
- [ ] Enter reason
- [ ] Click "Save Changes"
- [ ] Verify UI updates IMMEDIATELY (optimistic)
- [ ] Verify success toast appears
- [ ] Refresh page → credits persist

#### 4.4 Credit Adjustment Validation
- [ ] Try adjustment > 1000 for Basic
- [ ] Verify error message appears
- [ ] Try adjustment > 100 for Pro
- [ ] Verify error message appears
- [ ] Try adjustment > 50 for Cassandra
- [ ] Verify error message appears

#### 4.5 Credit Adjustment Error Rollback
- [ ] Enter valid adjustment
- [ ] Disconnect network
- [ ] Click "Save Changes"
- [ ] Verify optimistic update shows
- [ ] Verify error toast appears
- [ ] Verify credits ROLLBACK to previous values

#### 4.6 Recent Messages & Analyses
- [ ] Verify recent messages table displays
- [ ] Verify recent analyses table displays
- [ ] Verify "View All" links work

---

### 5. Messages Page

**URL**: `/admin/messages`

#### 5.1 Messages List
- [ ] Verify table displays with columns:
  - Timestamp
  - Role (User/Assistant badges)
  - Content (truncated)
  - Type

#### 5.2 Filters
- [ ] Filter by Conversation ID
- [ ] Filter by Role (user/assistant)
- [ ] Filter by Content Type
- [ ] Verify filters work together

#### 5.3 Expandable Rows
- [ ] Click on a message row
- [ ] Verify full content expands below
- [ ] Click again → collapses
- [ ] Keyboard: Tab to row, press Enter → expands

#### 5.4 Pagination
- [ ] Navigate to next page
- [ ] Verify page indicator updates
- [ ] Navigate to previous page

---

### 6. System Config Page

**URL**: `/admin/system-config`

#### 6.1 Config List
- [ ] Verify table displays with columns:
  - Key
  - Value (truncated JSON)
  - Description
  - Updated At

#### 6.2 Edit Config
- [ ] Click on a config row
- [ ] Verify edit dialog opens
- [ ] Modify JSON value
- [ ] Click "Save Changes"
- [ ] Verify success toast
- [ ] Verify table updates

#### 6.3 JSON Validation
- [ ] Open edit dialog
- [ ] Enter invalid JSON: `{invalid}`
- [ ] Verify "Invalid JSON" error displays
- [ ] Verify Save button disabled

#### 6.4 Keyboard Accessibility
- [ ] Tab to config row
- [ ] Press Enter → opens dialog
- [ ] Tab through dialog fields
- [ ] Press Escape → closes dialog

---

### 7. Costs Page

**URL**: `/admin/costs`

#### 7.1 Date Range Filter
- [ ] Select "Last 7 days"
- [ ] Verify data updates
- [ ] Select "Last 30 days"
- [ ] Verify data updates

#### 7.2 Summary Cards
- [ ] Verify displays:
  - Total Requests
  - Total Tokens
  - Estimated Cost (USD)

#### 7.3 Charts
- [ ] Verify "Requests by Model" chart renders
- [ ] Verify "Tokens Over Time" chart renders
- [ ] Hover over chart points → tooltips appear

#### 7.4 Per User Breakdown Table
- [ ] Verify table displays user stats
- [ ] Verify sorting works

#### 7.5 CSV Export
- [ ] Click "Export CSV"
- [ ] Verify file downloads
- [ ] Verify data accuracy

---

### 8. User States Page

**URL**: `/admin/user-states`

#### 8.1 States List
- [ ] Verify table displays with columns:
  - Telegram User ID
  - Onboarding Step
  - Updated At
  - Status (Stuck/Active badge)
  - Actions

#### 8.2 Stuck User Detection
- [ ] Verify users inactive >24h marked as "Stuck"
- [ ] Verify red badge displays

#### 8.3 Reset State Action
- [ ] Click "Reset State" button
- [ ] Verify confirmation dialog appears
- [ ] Confirm reset
- [ ] Verify success toast
- [ ] Verify state resets to `fresh`

---

### 9. Mobile Responsiveness

#### 9.1 Mobile View (< 768px)
- [ ] Resize browser to 375px width
- [ ] Verify sidebar is hidden
- [ ] Verify hamburger menu button appears (top-left)
- [ ] Click hamburger → sidebar slides in
- [ ] Verify backdrop overlay appears
- [ ] Click outside sidebar → closes
- [ ] Click nav item → navigates AND closes sidebar

#### 9.2 Tablet View (768px - 1024px)
- [ ] Resize browser to 768px
- [ ] Verify sidebar is visible
- [ ] Verify content has proper padding

#### 9.3 Touch Targets
- [ ] On mobile, verify all buttons are at least 44x44px
- [ ] Verify nav items are easy to tap

---

### 10. Internationalization (i18n)

#### 10.1 Language Persistence
- [ ] Login to admin
- [ ] Note current language
- [ ] Close tab, reopen
- [ ] Verify language persisted

#### 10.2 Russian Translations
- [ ] Change language to Russian (if toggle available)
- [ ] OR: Set `localStorage.setItem('admin-language', 'ru')`
- [ ] Refresh page
- [ ] Verify all labels are in Russian

#### 10.3 Chinese Translations
- [ ] Set `localStorage.setItem('admin-language', 'zh')`
- [ ] Refresh page
- [ ] Verify all labels are in Chinese

#### 10.4 Missing Translations
- [ ] Check browser console
- [ ] Verify no "Missing translation" warnings

---

### 11. Accessibility

#### 11.1 Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Verify focus indicators visible
- [ ] Verify Tab order is logical

#### 11.2 Screen Reader (VoiceOver/NVDA)
- [ ] Navigate to Users page
- [ ] Verify table rows announce properly
- [ ] Verify buttons have labels

#### 11.3 Color Contrast
- [ ] Check with accessibility extension
- [ ] Verify WCAG AA compliance

---

### 12. Dark Mode

- [ ] Toggle dark mode (if available in header)
- [ ] Verify all pages render correctly
- [ ] Verify no white flashes on navigation
- [ ] Verify charts are readable

---

## Known Issues / Limitations

1. **Tremor Charts**: Some chart tooltips may not match shadcn theme exactly
2. **Large Datasets**: No infinite scroll; pagination only
3. **Real-time Updates**: Data doesn't auto-refresh; manual refresh required

---

## Test Commands

```bash
# Type-check
pnpm type-check

# Build (production)
pnpm build

# Preview production build
pnpm preview
```

---

## Reporting Issues

If you find bugs:
1. Note the page URL and action taken
2. Check browser console for errors
3. Take a screenshot
4. Report to development team

---

## Checklist Summary

| Feature | Status |
|---------|--------|
| Authentication | ⬜ |
| Dashboard | ⬜ |
| Users List | ⬜ |
| User Detail | ⬜ |
| Credit Adjustment | ⬜ |
| Messages | ⬜ |
| System Config | ⬜ |
| Costs | ⬜ |
| User States | ⬜ |
| Mobile Responsive | ⬜ |
| i18n | ⬜ |
| Accessibility | ⬜ |
| Dark Mode | ⬜ |

**Legend**: ⬜ Not tested | ✅ Passed | ❌ Failed
