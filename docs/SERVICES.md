# Services Documentation

This document describes the services responsible for interacting with external APIs and the database.

---

### `services/geminiService.ts`

This file contains the logic for communicating with the Google Gemini API.

#### `analyzeCoffeeCup` Function

- **Purpose**: Sends a coffee cup image and a text prompt to the Gemini API to receive a psychological analysis.
- **Parameters**:
    - `imageData: string`: The image encoded in Base64.
    - `mimeType: string`: The MIME type of the image (e.g., `image/jpeg`).
    - `focusArea: string`: The topic selected by the user for the analysis ('wellbeing', 'career', 'relationships').
    - `language: Lang`: The language code ('en', 'ru', 'zh') for the desired response language.
- **Returns**: A `Promise<AnalysisResponse>` that resolves to a structured object containing the analysis intro and sections.

#### Prompt Engineering & JSON Mode

The prompt sent to the API is constructed dynamically to ensure high-quality, relevant, and structured responses.

1.  **System Instruction**: A high-level instruction is passed in the `config` object. It sets the model's persona to that of a "wise and insightful psychologist" who uses coffee ground reading for self-discovery, not fortune-telling. It also **dynamically sets the required response language** based on the user's selection.

2.  **JSON Response**: The function leverages Gemini's JSON mode.
    -   A `responseSchema` is defined to specify the exact shape of the desired JSON output (an object with `intro` and `sections` fields).
    -   The `responseMimeType` is set to `application/json`.
    -   The prompt explicitly instructs the model to return a JSON object that adheres to the schema.

This robust approach eliminates the need for fragile string parsing on the frontend, making the application more reliable and easier to maintain.

---

### `services/historyService.ts`

This service manages reading and writing analysis history to the Supabase database.

#### `saveAnalysis` Function

- **Purpose**: Saves a completed analysis to the `analysis_history` table for the logged-in user.
- **Parameters**:
    - `userId: string`: The ID of the currently authenticated user.
    - `analysis: AnalysisResponse`: The full structured analysis object from the Gemini API.
    - `focusArea: string`: The focus area selected for the analysis.
- **Behavior**: This is a non-critical, "fire-and-forget" function. It does not block the UI and will silently log a warning to the console on failure, ensuring that a database issue does not prevent the user from seeing their result.

#### `getHistory` Function

- **Purpose**: Fetches the complete analysis history for the currently logged-in user.
- **Parameters**: None.
- **Returns**: A `Promise<HistoryItem[]>` that resolves to an array of past analyses, ordered from newest to oldest.
- **Security**: This function relies on Supabase's Row Level Security (RLS) being enabled on the `analysis_history` table. The RLS policy ensures that the query can only ever return records belonging to the authenticated user who is making the request.

---

### `services/imageGenerator.ts`

This service handles the creation of a shareable image from the analysis results.

#### `generateShareableImage` Function

- **Purpose**: Creates a PNG image containing the key insights from the analysis, suitable for sharing on social media.
- **Parameters**:
    - `section: AnalysisSection`: The first parsed analysis section.
    - `theme: 'light' | 'dark'`: The current UI theme, used to style the image accordingly.
    - `translations`: An object containing localized strings for the image title and footer.
- **Returns**: A `Promise<Blob | null>` that resolves to a PNG image blob.

The process involves:
1.  Generating an SVG string with the analysis text, logo, and themed colors.
2.  Drawing this SVG onto an HTML `<canvas>` element.
3.  Exporting the canvas content as a PNG blob.

---

### `lib/supabaseClient.ts`

This file handles the connection to the Supabase backend.

- **Purpose**: Initializes and exports a singleton Supabase client instance.
- **Functionality**: It uses environment variables for the Supabase URL and anonymous key to configure the client. This client is then imported by other parts of the application, such as the `AuthContext` and services, to handle user authentication and database interactions.
- **Authentication Methods Implemented**:
    - **OAuth Providers**: Google, Apple, Facebook.
    - **Magic Link (OTP)**: Passwordless sign-in via a one-time link sent to the user's email.