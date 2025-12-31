# VisionStageSettings Component Usage

## Overview

The `VisionStageSettings` component provides an admin interface for configuring the Vision Stage AI model used for coffee grounds image analysis.

## Component Location

```
/home/me/code/coffee/src/admin/components/config/VisionStageSettings.tsx
```

## Props Interface

```typescript
interface VisionStageSettingsProps {
  visionModel: string;        // Current vision model value
  onUpdate: (key: string, value: unknown) => Promise<void>;  // Update callback
  loading: boolean;            // Loading state
}
```

## Integration Example

### Basic Usage in SystemConfigPage

```tsx
import { VisionStageSettings } from '@/admin/components/config/VisionStageSettings';

export function SystemConfigPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Extract vision_model from configs
  const visionModel = configs.find(c => c.key === 'vision_model')?.value as string || 'google/gemini-1.5-flash';

  // Update handler
  const handleUpdate = async (key: string, value: unknown) => {
    const { error } = await supabase
      .from('system_config')
      .update({
        value: value,
        updated_at: new Date().toISOString(),
      })
      .eq('key', key);

    if (error) {
      throw error;
    }

    // Refresh configs
    fetchConfigs();
  };

  return (
    <AdminLayout>
      {/* Other components */}

      <VisionStageSettings
        visionModel={visionModel}
        onUpdate={handleUpdate}
        loading={loading}
      />

      {/* Other components */}
    </AdminLayout>
  );
}
```

## Features

### Current Features
- Model selection from 5 common vision models
- Auto-save on model change
- Current model display
- Loading states during save
- Error handling with toast notifications
- Accessibility support (aria-labels, keyboard navigation)

### Future Features (Disabled)
- Temperature slider (0.0 - 2.0)
- Max Tokens input
- Collapsible advanced settings section

## Database Schema

The component expects a `system_config` table with this structure:

```sql
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default vision model
INSERT INTO system_config (key, value, description)
VALUES (
  'vision_model',
  '"google/gemini-1.5-flash"'::jsonb,
  'AI model for coffee grounds image analysis'
);
```

## Supported Models

| Model ID | Provider | Description |
|----------|----------|-------------|
| `google/gemini-1.5-flash` | Google | Fast, efficient (Recommended) |
| `google/gemini-1.5-pro` | Google | More powerful, higher quality |
| `x-ai/grok-vision-beta` | X.AI | Grok's vision capabilities |
| `openai/gpt-4-vision-preview` | OpenAI | GPT-4 with vision |
| `anthropic/claude-3-5-sonnet` | Anthropic | Claude 3.5 vision |

## Styling

The component uses:
- Tailwind CSS classes for styling
- shadcn/ui components (Card, Select, Button, Label, Input)
- Lucide icons (Eye, ChevronDown, ChevronUp)
- Dark mode support via CSS variables

## Error Handling

The component handles errors gracefully:
1. On save failure, displays error toast with description
2. Reverts to previous model value
3. Re-enables the select dropdown

## Accessibility

- Proper ARIA labels for screen readers
- Keyboard navigation support
- Focus states on interactive elements
- Disabled states clearly indicated

## Notes

- The component uses auto-save (no separate save button for model selection)
- Advanced settings are disabled with "Coming Soon" badge
- Temperature and max tokens are placeholder values (not saved)
- All user-facing text is currently hardcoded in English (i18n will be added later)
