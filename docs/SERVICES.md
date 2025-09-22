# Services Documentation

This document describes the services responsible for interacting with external APIs.

---

### `services/geminiService.ts`

This file contains the logic for communicating with the Google Gemini API.

#### `analyzeCoffeeCup` Function

- **Purpose**: Sends a coffee cup image and a text prompt to the Gemini API to receive a psychological analysis.
- **Parameters**:
    - `imageData: string`: The image encoded in Base64.
    - `mimeType: string`: The MIME type of the image (e.g., `image/jpeg`).
    - `focusArea: string`: The topic selected by the user for the analysis ('General Well-being', 'Career', 'Relationships').
- **Returns**: A `Promise<string>` that resolves to a string containing the analysis, formatted in Markdown.

#### Prompt Engineering

The prompt sent to the API is constructed dynamically to ensure high-quality, relevant responses.

1.  **System Instruction**: A high-level instruction is passed in the `config` object. It sets the model's persona to that of a "wise and insightful psychologist" who uses coffee ground reading for self-discovery, not fortune-telling. This is a more effective way to establish the desired tone and role for the AI.

2.  **User Prompt**: The user-facing prompt contains two main parts:
    - **Focus Instruction**: Depending on the `focusArea` parameter, a specific instruction is added to guide the analysis toward career, relationships, or general well-being.
    - **Structure Instruction**: This part defines the required structure and tone of the response. The model is asked to describe symbols, provide a psychological interpretation, and formulate gentle recommendations. It is also explicitly asked to format the response using Markdown for better readability.

This structured approach allows for more consistent, relevant, and well-formatted responses from the model.

---

### `services/imageGenerator.ts`

This service handles the creation of a shareable image from the analysis results.

#### `generateShareableImage` Function

- **Purpose**: Creates a PNG image containing the key insights from the analysis, suitable for sharing on social media.
- **Parameters**:
    - `sections: AnalysisSection[]`: An array of the parsed analysis sections. It specifically looks for the "Key Symbols" section.
    - `theme: 'light' | 'dark'`: The current UI theme, used to style the image accordingly.
- **Returns**: A `Promise<Blob | null>` that resolves to a PNG image blob.

The process involves:
1. Generating an SVG string with the analysis text, logo, and themed colors.
2. Drawing this SVG onto an HTML `<canvas>` element.
3. Exporting the canvas content as a PNG blob.
