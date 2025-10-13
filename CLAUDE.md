# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Symancy is an AI-powered psychological self-discovery platform that analyzes coffee cup patterns using Google Gemini API. The app combines ancient coffee ground reading with modern AI to provide personalized psychological insights.

**Key aspects:**
- React + TypeScript frontend with Vite
- Supabase for authentication and database
- Google Gemini API for image analysis and psychological interpretation
- Multi-language support (English, Russian, Chinese)
- User analysis history with focus areas (wellbeing, career, relationships)

## Development Commands

### Start development server
```bash
npm run dev
```
- Runs on http://localhost:3000
- Hot reload enabled via Vite

### Build for production
```bash
npm run build
```
- Outputs to `dist/` directory
- TypeScript compilation and Vite bundling

### Preview production build
```bash
npm run preview
```

## Environment Configuration

Create `.env.local` with:
```
GEMINI_API_KEY=your_api_key_here
```

**Note:** Supabase credentials are currently hardcoded in `lib/supabaseClient.ts` but should be moved to environment variables for production.

## Architecture

### Core Application Flow

1. **App.tsx** - Main orchestrator managing:
   - Image upload workflow
   - Analysis request/response lifecycle
   - View state (uploader vs history)
   - Theme and language preferences
   - User authentication state via AuthContext

2. **Authentication Flow** (AuthContext.tsx)
   - Wraps app with Supabase auth session management
   - Provides: `user`, `session`, `signInWithProvider()`, `signOut()`
   - Supports OAuth providers (Google, Facebook, Yandex, Apple, Telegram)

3. **Analysis Pipeline**
   - User uploads image → converted to base64
   - `geminiService.ts` sends image + focus area + language to Gemini API
   - Response structured as JSON with `intro` and `sections[]`
   - If authenticated, saves to `analysis_history` table via `historyService.ts`

### Key Services

**geminiService.ts**
- Direct client-side calls to Google Gemini API (`gemini-2.5-flash` model)
- Uses structured output with response schema for consistent JSON format
- Three analysis modes based on focus area: wellbeing, career, relationships
- Multi-language system instructions (EN, RU, ZH)

**historyService.ts**
- `saveAnalysis()` - Stores analysis to Supabase (non-blocking, failures logged)
- `getHistory()` - Fetches user's analysis history (RLS enforced)
- Assumes `analysis_history` table exists (see docs/SUPABASE_SCHEMA.md)

**imageGenerator.ts**
- Generates shareable social media images from analysis results

### Database Schema

**analysis_history table** (PostgreSQL via Supabase)
- `id` (uuid, pk)
- `user_id` (uuid, fk to auth.users)
- `created_at` (timestamptz)
- `analysis` (jsonb) - Full AnalysisResponse object
- `focus_area` (text) - 'wellbeing' | 'career' | 'relationships'

**Row Level Security (RLS):**
- SELECT/INSERT policies: `auth.uid() = user_id`
- Users can only access their own analysis history

### Component Architecture

**UI Library:**
- Custom shadcn-ui inspired components in `components/ui/`
- Tailwind CSS with custom "coffee" theme palette
- Light mode ("latte") and dark mode ("espresso")

**Component Structure:**
- `Header.tsx` - Logo, theme toggle, language selector, history button, auth controls
- `ImageUploader.tsx` - Drag-and-drop or file select for coffee cup images
- `ResultDisplay.tsx` - Renders analysis with markdown support (react-markdown)
- `HistoryDisplay.tsx` - Lists past analyses with filtering by focus area
- `auth/AuthModal.tsx` - OAuth provider buttons and profile management

### State Management

**Local state in App.tsx:**
- `imageFile`, `imageUrl` - Upload handling
- `analysis` - Current analysis result
- `focusArea` - Selected analysis focus ('wellbeing' | 'career' | 'relationships')
- `language` - UI and API response language ('en' | 'ru' | 'zh')
- `theme` - UI theme preference
- `currentView` - Toggle between 'uploader' and 'history'

**Context:**
- `AuthContext` - Global auth state, wraps entire app in index.tsx

### Internationalization (i18n)

**lib/i18n.ts** provides:
- `translations` object with EN, RU, ZH strings
- `detectInitialLanguage()` - Reads from localStorage or browser preference
- `t(key, lang)` - Translation helper
- Language stored in localStorage and applied to `<html lang>`

### Path Alias

`@/*` resolves to project root (configured in vite.config.ts and tsconfig.json)

## Important Implementation Details

### API Key Exposure
The Gemini API key is exposed in the client bundle via Vite's `define` config (vite.config.ts:14-15). This is acceptable for development but should use a serverless function proxy for production.

### Analysis Non-Blocking Save
In App.tsx:109-112, `saveAnalysis()` is called without await to prevent blocking the UI if the database write fails. Errors are logged but don't interrupt the user experience.

### Image-to-Base64 Conversion
`fileToBase64()` in App.tsx:69-76 converts uploaded images to base64 data URLs, then extracts MIME type and data for Gemini API consumption.

### Gemini Response Schema
The structured output schema (geminiService.ts:27-54) enforces:
```typescript
{
  intro: string,  // Markdown formatted
  sections: Array<{
    title: string,  // e.g., "Key Symbols and Figures"
    content: string // Markdown formatted
  }>
}
```

### Focus Area Prompting
Different system instructions are injected based on focus area (geminiService.ts:81-92):
- `career` → professional development, ambitions
- `relationships` → love, friendship, personal connections
- `wellbeing` → emotional state, life balance (default)

## n8n Workflow Integration

The project includes n8n automation workflows in `n8n/Pre-MVP workflow n8n.json` for process automation. This is part of the broader MVP strategy for multi-platform support (Telegram Mini Apps, WhatsApp Business API).

## Documentation

Key docs in `docs/`:
- `SUPABASE_SCHEMA.md` - Database schema and RLS policies
- `SERVICES.md` - Detailed service layer documentation
- `COMPONENTS.md` - Component library reference
- `PROVIDER_SETUP.md` - OAuth provider configuration
- `STYLING.md` - Theme and styling guidelines
