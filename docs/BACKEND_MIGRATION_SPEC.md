# Backend Migration Specification: Symancy Core (v1.2)

**Status:** Approved for implementation
**Goal:** Create a personalized, conversational AI experience backed by secure Edge Functions.

---

## 1. User Flow & Onboarding (New)

### Phase 1: Conversation (The "Handshake")
Before any image upload, the frontend initiates a chat-like interface.
*Data collected here is passed to the analysis endpoint.*

1.  **Greeting:** "Привет! Я Арина. Я помогу тебе заглянуть вглубь себя через кофейные узоры."
2.  **Name:** "Как я могу к тебе обращаться?" -> *Store as `user_name`*.
3.  **Context (Soft):** "Мне важно настроиться на твою волну. Сколько тебе лет и кто ты (он/она)?" -> *Store as `user_age`, `user_gender`*.
4.  **Intent (The "Request"):** "С каким вопросом или чувством ты пришел ко мне сегодня?" -> *Store as `user_intent`*.

### Phase 2: Upload & Analysis
Only after Phase 1 is complete does the upload button appear.

---

## 2. API Endpoint: Analysis

- **URL:** `POST /functions/v1/analyze-coffee`
- **Auth:** Bearer Token
- **Body:**
```json
{
  "image": "base64...",
  "userData": {
    "name": "Елена",
    "age": "28", // optional
    "gender": "female", // optional
    "intent": "Хочу понять, стоит ли менять работу" // CRITICAL
  },
  "mode": "psychologist" // "psychologist" (Arina) | "esoteric" (Cassandra)
}
```

---

## 3. Prompt Engineering (Revised)

### 3.1. Vision Prompt (The "Creative Observer")
*Goal: Remove rigid checklists. Allow for free association.*

> "You are a visionary art critic and pattern observer. Look at this image of coffee grounds.
> Do NOT look for specific mundane objects like 'dogs' or 'cars' unless they are undeniable.
> Instead, describe the **abstract forms, flows of energy, textures, and visual metaphors**.
> - What implies movement?
> - Where is the density (darkness) vs emptiness (light)?
> - What emotions does the composition evoke (chaos, serenity, explosion, path)?
> - Describe shapes associatively: 'forms resembling a dancing figure', 'lines converging like a crossroads'.
> BE CREATIVE. Focus on the *feeling* of the image."

### 3.2. Personality Prompts (The Interpreter)

The backend selects the prompt based on `mode`.

#### Mode A: Arina (Psychologist)
> "You are Arina, a psychological counselor using projective techniques (like Rorschach).
> **Client:** {{NAME}}, {{AGE}} y.o., {{GENDER}}.
> **Client's Request:** "{{INTENT}}".
>
> **Task:** Interpret the visual patterns described below to help the client with their request.
> Use the visual metaphors to discuss their psychological state.
> - Connect the 'darkness/light' to their anxiety/hope regarding '{{INTENT}}'.
> - Use the shapes to suggest subconscious blocks or resources.
> - **Tone:** Warm, empathetic, grounded, supportive. NO magic/fortune telling. Focus on *self-reflection*."

#### Mode B: Cassandra (Esoteric/Premium)
> "You are Cassandra, a mystic and interpreter of fate.
> **Seeker:** {{NAME}}, {{AGE}} y.o.
> **Seeker's Query:** "{{INTENT}}".
>
> **Task:** Reveal the hidden omens in the coffee grounds regarding their query.
> - Treat the patterns as signs from the universe.
> - Speak of energies, pathways, and destiny.
> - **Tone:** Mysterious, deep, poetic, slightly authoritative but benevolent. Use symbols and archetypes."

---

## 4. Logic Flow Updates

1.  **Frontend:** Needs a new "Chat/Onboarding" state machine.
2.  **Database:** `analysis_history` table should have a new column `user_context` (JSONB) to store the Name/Intent used for that specific reading.
3.  **Backend:**
    -   Receive `userData`.
    -   Inject `userData` into the System Prompt dynamically.
    -   Select Prompt (Arina vs Cassandra) based on `mode` (which is linked to Product Type in `purchases`).

---

## 5. Migration Plan (Revised)

1.  **Phase 0.1 (Backend):** Implement `analyze-coffee` with prompt switching logic and new inputs.
2.  **Phase 0.2 (DB):** Add `user_context` column to history.
3.  **Phase 0.3 (Frontend):** Build the "Chat Onboarding" UI to replace the static Uploader.

