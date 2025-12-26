This is a classic case of **"Model Collapse to the Mean."** Your system is currently optimizing for the safest, most statistically probable outputs (common shapes like "mountains" and safe advice like "I believe in you").

To fix this, you need to shift your architecture from **Text-to-Text** to **Data-to-Narrative** and inject variability programmatically.

Here are specific, actionable recommendations to overhaul your pipeline.

### 1. Vision Model: Breaking the "Mountain/Bird" Bias

**The Problem:** Gemini Flash sees "noise" (coffee grounds) and hallucinates the most common training data labels (Mountains, Birds).
**The Fix:** Force the model to analyze **physics and texture** before it is allowed to name an object. Switch the output to JSON so "Arina" doesn't see the vision model's poetic attempts.

**Action: Update Vision Prompt (`analyze.txt`)**

> **ROLE:** Expert Visual Analyst in organic textures and fluid dynamics.
> **TASK:** Analyze the coffee sediment. **OUTPUT ONLY JSON.**
> **CONSTRAINTS:**
> 1. **PAREIDOLIA BAN:** You have a bias toward identifying "Mountains," "Birds," and "Moons." You are **penalized** for using these terms unless the shape is photorealistic.
> 2. **TEXTURE FIRST:** You must describe the density and flow of the sediment before identifying shapes.
> 3. **ABSTRACT GEOMETRY:** If a shape is vague, describe its geometry (e.g., "jagged fracturing lines," "spiraling void") rather than forcing a label.
> 
> 
> **JSON STRUCTURE:**
> ```json
> {
>   "sediment_physics": {
>     "density": "Heavy/Muddy vs. Light/Veiny",
>     "chaos_level": "High/Medium/Low",
>     "flow_direction": "Stagnant/Swirling/Dripping"
>   },
>   "visual_anchors": [
>     {
>       "location": "Bottom-Right (Clock 4-5)",
>       "geometry": "Sharp, converging triangles",
>       "texture": "Grainy and scattered",
>       "association": "A broken arrow or a compass needle" 
>     }
>   ],
>   "atmosphere_keywords": ["Tense", "Release", "Blocked", "Floating"]
> }
> 
> ```
> 
> 

---

### 2. Interpretation Model: Solving Repetition & Length

**The Problem:** The "Repetitive Structure" exists because you provided a full example in the prompt. LLMs treat examples as templates and copy them exactly.
**The Fix:** Delete the example. Replace it with a **Structural Skeleton** and use **Dynamic Lenses**.

**Action A: Delete the Example**
Remove the 2000-character example text entirely.

**Action B: Implement "Dynamic Lenses" (Python Code)**
Do not use one static prompt. In your Python code, create a list of 4 "Interpretation Lenses." Randomly select one for each request and append it to Arina's system prompt. This forces her to write a fresh analysis every time.

* *Lens 1:* "Focus on **Internal Resources**: strengths, energy reserves, and rest."
* *Lens 2:* "Focus on **External Boundaries**: relationships, saying 'no', and protecting space."
* *Lens 3:* "Focus on **Structure & Goals**: career, discipline, and tangible steps."
* *Lens 4:* "Focus on **Shadow**: what is being avoided or suppressed."

**Action C: Structural Skeleton (System Prompt)**

> **INSTRUCTIONS:**
> 1. **The Vibe:** Start by interpreting the `sediment_physics`. (e.g., "The heavy density suggests you are carrying a lot...")
> 2. **The Metaphor:** Select the strongest visual anchor. Connect its `geometry` to a psychological state.
> 3. **The Pivot:** Use the "Lens" provided to offer a specific perspective on this metaphor.
> 4. **The Question:** End with a reflective coaching question. **(BANNED PHRASE: "I believe in you" / "Everything will be fine")**.
> 
> 

---

### 3. Tone: Psychological vs. Mystical (The "MAC" Strategy)

**The Fix:** Since you are in a Russian context ("Arina"), use the framework of **MAK (Метафорические Ассоциативные Карты - Metaphorical Associative Cards)**. This is a popular psychological tool in CIS countries that bridges the gap perfectly.

**Action: Refine Arina's Persona**

> **ROLE:** You are a specialist in **Projective Techniques and MAC (Metaphorical Associative Cards)**.
> **METHOD:** You treat the coffee patterns as a Rorschach test. The cup does not predict the future; it mirrors the user's subconscious.
> **VOCABULARY RULES:**
> * **BANNED (Mystical):** Fate, Destiny (Судьба), Universe, Karma, Omen, Prediction.
> * **REQUIRED (Psychological):** Projection, Narrative, Inner State, Unconscious Pattern, Metaphor.
> * **TENSE RULE:** Use Present Continuous ("You are feeling...") or Present Perfect ("You have been carrying..."). **NEVER use Future Simple** ("You will meet...").
> 
> 

---

### 4. User Engagement: The "Intention Seed"

To make the reading feel personal, you need user context. A reading is generic if it applies to everyone.

**Action:** Before the user uploads the photo, have the bot ask:
*"What is on your mind today?"*
[Buttons: 🌪️ Stress/Anxiety, ❤️ Relationships, 🚀 Career/Growth, 🌌 General Review]

**Pass this to Arina:**

> `USER_CONTEXT: "Relationships". Interpret the 'Blocked Flow' pattern specifically through the lens of emotional connection.`
> *Result:* A "Wall" pattern becomes an "Emotional Barrier" (Love context) instead of a "Career Obstacle" (Work context).

---

### Summary of New Architecture

1. **User Input:** User clicks **[Career]** -> Uploads Photo.
2. **Vision Stage:** Model receives photo + "Pareidolia Ban" prompt -> Outputs **JSON**.
3. **Controller:** Python script selects random **Lens** (e.g., "Shadow Work").
4. **Interpretation Stage:** Arina receives: `User Context (Career)` + `Vision JSON` + `Lens (Shadow Work)`.
5. **Output:** "The heavy sediment at the bottom (Vision) suggests you are clinging to old professional failures (Career/Shadow). How does this weight serve you today? (Question)"