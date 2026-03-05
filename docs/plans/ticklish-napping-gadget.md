# Plan: Enhance Business Plan with Images & Visual Assets for PDF

## Context

Business plan for AFSA (Kazakhstan regulator) has 9 new Mermaid diagrams in the main body + 6 in Appendix A. However, the **main body still has ZERO images** — all 6 whisk-images are confined to Appendix A. Additionally, there are product screenshots and test photos that aren't used at all. For a professional PDF presentation, images in the main body create a dramatic improvement in visual impact and credibility.

## Target Files

- `docs/business-plan/business-plan-en.md` (English, primary)
- `docs/business-plan/business plan.md` (Russian, mirror)

## Image Format Convention

All existing images in Appendix A use this HTML pattern:
```html
<div style="text-align:center;margin:2em 0">
<img src="../../whisk-images/FILENAME.png" alt="ALT" style="max-width:100%;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15)">
<p style="font-size:0.9em;color:#666;margin-top:0.5em"><em>Caption text</em></p>
</div>
```

## Part A: Embed Existing Images into Main Body (6 insertions)

### A1. Hero Image → Executive Summary (Section 1)
- **Insert after:** Title block (line ~8, before `**Project Name:**`)
- **Image:** `../../whisk-images/01-hero-coffee-ai.png`
- **Caption:** "Symancy AI — Multimodal AI Platform for Visual Pattern Analysis"
- **Why:** Sets visual tone immediately, the stunning AI coffee cup image is the perfect hook

### A2. Tech Stack → Section 4.1 (Current Architecture)
- **Insert after:** Architectural Components table (EN line ~149, after Payments row)
- **Image:** `../../whisk-images/05-tech-stack.png`
- **Caption:** "Omnichannel Platform Architecture"
- **Why:** Visualizes the tech stack described in the table above

### A3. Persona Images → Section 4.1 (AI Personas table)
- **Insert after:** AI Personas table (EN line ~156, after Kassandra row)
- **Images:** Side-by-side layout:
  - `../../whisk-images/03-persona-arina.png` (Arina — warm, supportive)
  - `../../whisk-images/04-persona-kassandra.png` (Kassandra — analytical, profound)
- **Layout:** Two circular images in a flexbox row (same pattern as Appendix A line 1000-1015)
- **Caption:** "AI Personas: Arina (Digital Wellness) and Kassandra (Creative Narrative AI)"

### A4. Anti-Hallucination → Section 4.2 (Hallucination Protection)
- **Insert after:** "multi-layered protection system:" text (EN line ~160, before numbered list)
- **Image:** `../../whisk-images/06-anti-hallucination.png`
- **Caption:** "AI Output Filtering and Verification Mechanism"
- **Why:** Visually represents the protection concept before the technical details

### A5. CV Zones → Section 4.3 (Visual Proof Module)
- **Insert after:** "Visual Proof Module Components" list (EN line ~175, after Visual Proof UI bullet)
- **Image:** `../../whisk-images/02-cv-zones.png`
- **Style:** `max-width:300px` (same as Appendix A usage)
- **Caption:** "Computer Vision Zone Detection: RIM / CENTER / BOTTOM"
- **Why:** Illustrates the zone-based analysis approach

### A6. Product Screenshots → Section 4.1 (after tech stack image)
- **Pre-step:** Copy screenshots to `whisk-images/` for consistent paths:
  - `.playwright-mcp/chat-final-desktop.png` → `whisk-images/07-product-desktop.png`
  - `.playwright-mcp/chat-final-mobile-dark.png` → `whisk-images/08-product-mobile-dark.png`
- **Insert after:** Tech stack image (A2)
- **Layout:** Two images side by side (desktop wider, mobile narrower)
- **Caption:** "Symancy AI Product: Desktop (Light Theme) and Mobile (Dark Theme)"
- **Why:** Proves the product is REAL and working, not just a concept

## Part B: Generate New Images with Whisk (4 images)

### B1. Symancy AI Logo → Title Page / Cover
- **Destination:** Very top of document, before title text
- **Save as:** `whisk-images/00-symancy-logo.png`
- **Whisk prompt:** "Minimalist professional logo for 'Symancy AI' fintech startup. Coffee cup silhouette combined with a neural network node pattern. Clean geometric design, navy blue and gold accent colors on white background. Corporate style suitable for financial regulator documents. Vector-quality, centered composition."

### B2. Geographic Market Map → Section 5.6 (Regional Markets)
- **Insert after:** Regional Markets table (EN line ~264)
- **Save as:** `whisk-images/09-market-map.png`
- **Whisk prompt:** "Clean minimalist world map infographic showing four highlighted regions: Russia (green), Kazakhstan (blue), India (orange), UAE (purple). Each region has a small icon and label. White background, flat design style, professional business plan aesthetic. No text other than country labels."

### B3. "How It Works" Flow → Section 7.3 (Customer Journey)
- **Insert after:** Customer Journey numbered list (EN line ~437, before section 7.4)
- **Save as:** `whisk-images/10-how-it-works.png`
- **Whisk prompt:** "Clean infographic showing 4 steps of an AI coffee reading app workflow: (1) User takes a photo of coffee grounds in a cup, (2) AI analyzes visual patterns with highlighted zones, (3) AI persona generates personalized insight, (4) User shares result card on social media. Horizontal flow from left to right, minimal flat design, soft colors, numbered steps with icons. White background, professional style."

### B4. B2B Use Case Illustration → Section 6.2 (B2B: Licensing and API)
- **Insert after:** "Use Case Scenario" paragraph (EN line ~251)
- **Save as:** `whisk-images/11-b2b-use-case.png`
- **Whisk prompt:** "Modern coffee shop scene with a QR code printed on a coffee cup. A customer scans the QR code with their smartphone, and the phone screen shows a Telegram chatbot interface. Warm ambient lighting, lifestyle photography style, clean and professional. Photorealistic, soft depth of field."

## Part C: Structural Enhancements

### C1. Table of Contents
- **Insert after:** Title block / date (EN line ~7, after `---` divider)
- **Content:** Linked list of all 13 sections + Appendix A
- **Format:** Markdown with section numbers and names

### C2. Cover Page Enhancement
- **Replace:** Current bare title with a styled cover section including:
  - Symancy AI logo (B1)
  - Hero image (A1)
  - Title, jurisdiction, date
  - "CONFIDENTIAL" marking (standard for AFSA submissions)

## Implementation Order

1. **Copy screenshots** to `whisk-images/` (A6 pre-step)
2. **Generate 4 new images** with whisk (B1-B4)
3. **Cover page + ToC** (C1-C2) — top of document
4. **Section 1** — Hero image (A1)
5. **Section 4** — Tech stack, personas, screenshots, anti-hallucination, CV zones (A2-A6)
6. **Section 5.6** — Market map (B2)
7. **Section 6.2** — B2B use case (B4)
8. **Section 7.3** — How it works (B3)
9. **Replicate all changes to Russian version**

## Files Modified

| File | Changes |
|------|---------|
| `docs/business-plan/business-plan-en.md` | +10 images, +ToC, cover enhancement |
| `docs/business-plan/business plan.md` | Same changes mirrored |
| `whisk-images/07-product-desktop.png` | Copied from `.playwright-mcp/` |
| `whisk-images/08-product-mobile-dark.png` | Copied from `.playwright-mcp/` |
| `whisk-images/00-symancy-logo.png` | NEW (generated) |
| `whisk-images/09-market-map.png` | NEW (generated) |
| `whisk-images/10-how-it-works.png` | NEW (generated) |
| `whisk-images/11-b2b-use-case.png` | NEW (generated) |

## Verification

1. Open both `.md` files in VS Code with Markdown preview — verify all images render
2. Check that existing Appendix A images are not affected
3. Verify all image paths are correct (relative from `docs/business-plan/`)
4. Test PDF conversion to ensure images embed properly
5. Confirm both EN and RU versions have identical visual structure
