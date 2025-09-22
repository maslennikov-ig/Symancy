# Coffee Cup Psychologist

## About the Project

"Coffee Cup Psychologist" is a web application that combines the ancient art of coffee ground reading with the modern capabilities of artificial intelligence. Users can upload a photo of their coffee cup, and the app, using the Google Gemini API, will provide a deep psychological analysis of the symbols found within.

The goal of the application is not to predict the future, but to offer users a unique tool for self-reflection and self-discovery in an engaging and creative way.

## Key Features

- **AI-Powered Analysis**: Utilizes the multimodal capabilities of the `gemini-2.5-flash` model to interpret images.
- **User Authentication**: Secure sign-in using Google or a passwordless magic link, powered by Supabase. Users can view their profile and log out.
- **Image Upload**: A user-friendly interface for uploading photos via drag-and-drop or file selection.
- **Focused Analysis**: Users can choose a specific area of life to focus on (General Well-being, Career, Relationships) to receive more relevant insights.
- **Multi-language Support**: The interface is available in English, Russian, and Chinese, with automatic language detection. AI responses are provided in the selected language.
- **Shareable Results**: Generate and share a visually appealing image of the key analysis insights on social media.
- **Responsive Design**: A fully responsive interface that looks great on any device, featuring a clean hamburger menu on mobile for theme and language controls.
- **Thematic UI**: Built with a custom `shadcn-ui` component library, featuring a "coffee" palette with a toggleable light ("latte") and dark ("espresso") theme.
- **Smooth Animations**: The interface is enhanced with subtle animations for a more pleasant user experience.
- **Artistic Design**: Features a unique logo and thematic background patterns.

## Tech Stack

- **Frontend**: React, TypeScript
- **API**: Google Gemini API (`@google/genai`)
- **Authentication**: Supabase
- **Styling**: Tailwind CSS
- **UI Components**: Custom `shadcn-ui` inspired component library
- **Icons**: Custom SVG components
- **Fonts**: Google Fonts (Playfair Display for headings, Inter for body text)
- **Markdown Rendering**: `react-markdown`