# Schema: Landing Page Current State Documentation

**Deliverable**: `deliverables/landing-page/current-state.md`
**User Story**: P1 - Landing Page Current State Documentation
**Purpose**: Define the required structure and content for the current state documentation

## Required Sections

### 1. Executive Summary (REQUIRED)
- **Purpose**: 5-minute overview for stakeholders
- **Content**:
  - Project background (1-2 paragraphs)
  - MVP scope and launch date
  - Key metrics (if available): users, analyses performed, conversion rates
  - Document purpose and intended audience

### 2. Feature Inventory (REQUIRED)
- **Purpose**: Comprehensive list of all landing page capabilities
- **Content**: For each feature, document:
  - Feature name
  - Current description (what it does)
  - User-facing components
  - Backend dependencies
  - Known limitations

**Example**:
```markdown
#### Image Upload
**Description**: Users can upload coffee cup images via file picker or drag-and-drop interface.
**Components**: ImageUploader.tsx, file validation logic
**Dependencies**: Browser File API, local state management
**Limitations**: No preview before confirmation, 10MB size limit, no camera access on mobile
```

### 3. Technical Architecture (REQUIRED)
- **Purpose**: Document technology stack and architecture decisions
- **Content**:
  - Frontend stack: React version, build tool (Vite), styling approach (Tailwind)
  - State management: Context API, local state patterns
  - Authentication: Supabase Auth implementation
  - API integrations: Gemini API, Supabase client
  - Deployment: Platform, CI/CD, environment variables
  - Performance: Bundle size, load time, key metrics

### 4. User Flows (REQUIRED)
- **Purpose**: Map complete user journeys from entry to completion
- **Content**: For each major flow:
  - Flow name and goal
  - Step-by-step walkthrough
  - Screenshots or mockups (if available)
  - Current pain points
  - Drop-off points (if data available)

**Required Flows**:
- First-time visitor journey (upload → analysis → results)
- Authenticated user journey (login → history → re-analysis)
- Error recovery flows (failed upload, API error, timeout)

### 5. Internationalization (REQUIRED)
- **Purpose**: Document language support and localization approach
- **Content**:
  - Supported languages (Russian, English)
  - Translation coverage (UI, error messages, analysis results)
  - Language detection logic
  - Missing translations or untranslated content

### 6. Performance Characteristics (REQUIRED)
- **Purpose**: Baseline current performance for future comparison
- **Content**:
  - Page load time (initial visit, subsequent visits)
  - Bundle size (main, vendor, CSS)
  - Time to first contentful paint (FCP)
  - Time to interactive (TTI)
  - API response times (Gemini, Supabase)
  - Analysis completion time (end-to-end)

### 7. Known Issues and Limitations (REQUIRED)
- **Purpose**: Honest assessment of current problems
- **Content**: For each issue:
  - Issue description
  - User impact (severity: critical/high/medium/low)
  - Frequency (always/often/sometimes/rare)
  - Workaround (if any)
  - Technical root cause (if known)

**Categories**:
- User experience issues
- Technical debt
- Performance bottlenecks
- Security concerns
- Accessibility gaps
- Mobile responsiveness issues

### 8. Data Flow (REQUIRED)
- **Purpose**: Document how data moves through the system
- **Content**:
  - User uploads image → Frontend validation → Base64 encoding
  - Frontend → n8n webhook (data payload structure)
  - n8n → Gemini API (request format)
  - Gemini → n8n → Frontend (response format)
  - (If authenticated) n8n → Supabase (history storage)
- Include Mermaid sequence diagrams

### 9. Code Organization (REQUIRED)
- **Purpose**: Document codebase structure for developers
- **Content**:
  - Directory structure with descriptions
  - Component hierarchy
  - Service layer organization
  - Utility functions and helpers
  - Configuration files

### 10. Dependencies and Versions (REQUIRED)
- **Purpose**: Document all external dependencies
- **Content**:
  - Runtime dependencies (from package.json)
  - Development dependencies
  - Version constraints and reasons
  - Known dependency security issues (if any)

## Optional Sections

### Analytics and Metrics (if available)
- User behavior data
- Conversion funnels
- A/B test results
- Performance monitoring data

### User Feedback (if available)
- Common support requests
- User testimonials
- Feature requests
- Bug reports from users

### Accessibility Audit
- WCAG compliance level
- Keyboard navigation support
- Screen reader compatibility
- Color contrast analysis

## Validation Checklist

Before considering current state documentation complete:

- [ ] All required sections present and populated
- [ ] Technical accuracy verified by development team
- [ ] No placeholder content remaining
- [ ] All screenshots current and relevant
- [ ] Mermaid diagrams render correctly
- [ ] Feature inventory matches actual codebase
- [ ] Performance metrics are measured (not estimated)
- [ ] Known issues list reviewed with team
- [ ] Document length appropriate (target: 15-25 pages)
- [ ] Stakeholders can understand current state within 30 minutes (SC-001)

## Success Criteria Mapping

This document satisfies the following success criteria from spec.md:

- **SC-001**: Stakeholders understand complete current state within 30 minutes
- **FR-001**: Document all current MVP features
- **FR-002**: Document current user flows (happy paths and errors)
- **FR-003**: Document technical stack
- **FR-004**: Identify current limitations and pain points

## References

- Feature specification: `../spec.md`
- Data model: `../data-model.md`
- Existing codebase: `/home/me/code/coffee/`
