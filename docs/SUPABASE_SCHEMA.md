# Supabase Schema Plan

This document outlines the required database schema for the "Coffee Cup Psychologist" application. It will be updated as new features requiring database storage are added. The final version will be used to generate a single SQL script for easy setup.

---

## Table: `analysis_history`

This table stores the analysis results for each user.

### Columns

| Column Name  | Data Type      | Constraints                               | Description                                             |
|--------------|----------------|-------------------------------------------|---------------------------------------------------------|
| `id`         | `uuid`         | `PRIMARY KEY`, `default: gen_random_uuid()` | The unique identifier for each history record.          |
| `user_id`    | `uuid`         | `NOT NULL`, `FOREIGN KEY (auth.users.id)`   | The ID of the user who performed the analysis.          |
| `created_at` | `timestamptz`  | `NOT NULL`, `default: now()`                | The timestamp when the analysis was created.            |
| `analysis`   | `jsonb`        | `NOT NULL`                                  | The full JSON object of the analysis result.            |
| `focus_area` | `text`         | `NOT NULL`                                  | The focus area selected for the analysis (e.g., 'wellbeing'). |

### Row Level Security (RLS)

RLS must be enabled on this table to ensure users can only access their own data.

- **`SELECT` Policy**: Users can only select their own records.
  - **Expression**: `auth.uid() = user_id`

- **`INSERT` Policy**: Users can only insert records for themselves.
  - **Expression**: `auth.uid() = user_id`

- **`UPDATE` / `DELETE` Policies**: (Optional, not currently used by the app) Could be restricted in the same way if functionality is added later.
  - **Expression**: `auth.uid() = user_id`

---
