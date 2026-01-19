# MCP Configuration для coffee

## Текущая конфигурация

**File**: `/.mcp.json` (root directory)

Унифицированная конфигурация с 7 MCP серверами и креденшалами.

### ✅ Безопасность

- **`.mcp.json` в `.gitignore`** - файл не попадает в git
- **Креденшалы внутри файла** - простота использования  
- **Нет внешних зависимостей** - не нужны .env, direnv, скрипты

### Included Servers (7 серверов)
- **context7**
- **github**
- **playwright**
- **sequential-thinking**
- **serena**
- **shadcn**
- **supabase**

## Auto-Optimization

Claude Code автоматически оптимизирует загрузку:
- Активация при >10K tokens
- 85% сокращение контекста
- On-demand загрузка серверов

## Использование

Просто запустите Claude Code в проекте:
```bash
cd /home/me/code/coffee
claude
```

Все креденшалы уже в конфигурации, дополнительная настройка не требуется.

## References

- [MCP Tool Search](https://www.anthropic.com/engineering/advanced-tool-use)
- [Claude Code MCP Docs](https://code.claude.com/docs/en/mcp)
