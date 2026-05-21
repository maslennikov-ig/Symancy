# Recovery: Symancy bot silent — server hung at application layer

## Context

Пользователь отправил фото кофе боту `@coffeeveda_bot` — ответа не пришло. По правилу «webhook diagnosis FIRST» (память: 28-дневный инцидент с webhook-hijack, май 2026) первым делом проверил `getWebhookInfo`.

## Diagnosis (факты, собраны 2026-05-21 ~08:34 UTC)

### Telegram API → `getWebhookInfo`
```
url:                   https://symancy.ru/webhook/telegram   ✅ правильный (НЕ hijack)
ip_address:            91.132.59.194                          ✅ наш сервер
allowed_updates:       ["message","callback_query"]           ✅ photo попадает в "message"
pending_update_count:  3                                       ⚠️ Telegram копит
last_error_date:       2026-05-21 08:33:58 UTC                ⚠️ только что
last_error_message:    "Connection timed out"                  🔴 наш сервер не отвечает
```

### Сетевая доступность сервера `91.132.59.194`
| Слой | Результат | Вывод |
|---|---|---|
| ICMP ping | OK, 0% loss | сервер физически жив |
| TCP `connect()` :22, :80, :443, :3000 | OPEN (SYN-ACK приходит) | сетевой стек kernel работает |
| SSH banner exchange | **зависает >10s** | sshd не отвечает на L7 |
| `openssl s_client :443` | **handshake не завершается** | nginx не отвечает на L7 |
| `curl http://...` | **timeout** | то же самое для plain HTTP |

**Root cause:** L3/L4 жив, L7 (прикладной уровень) залип во **всех** сервисах одновременно. Это исключает «упал PM2» или «упал nginx» — sshd, nginx и pg-boss зависли вместе. Типичные причины:
- OOM / swap-thrash, новые процессы не успевают обработать accept()
- Диск 100% busy (D-state процессы, очередь I/O)
- CPU 100%, инверсия приоритетов
- conntrack table fill / ядерные счётчики переполнены
- Утечка дескрипторов (`accept()` принял, но `read()` не наступает)

`webhook-health-check` (`"5 * * * *"`, добавлен в `1ca5d82`) сейчас **не поможет** — он реагирует на `misconfigured` (чужой URL), а наш кейс — URL правильный, не отвечает наш бэкенд. Это **дыра в мониторинге**.

## Recovery plan (что делать сейчас)

SSH недоступен → действовать через панель хостера **FastVPS** (домен `a094242.fvds.ru`).

### Шаг 1 — открыть VNC/IPMI консоль и собрать улики ПЕРЕД ребутом
В панели FastVPS → консоль виртуальной машины. Залогиниться `root` (или `deploy` + `sudo -i`). Выполнить и **записать вывод**:

```bash
date; uptime
free -h
df -h
top -bn1 -o %CPU | head -30
top -bn1 -o %MEM | head -30
dmesg -T | tail -80                 # ищем "Out of memory", "Killed process", "I/O error"
journalctl -n 200 --no-pager
journalctl -u nginx -n 50 --no-pager
journalctl -u ssh -n 50 --no-pager
pm2 list                            # под deploy
pm2 logs symancy-backend --lines 100 --nostream
ss -s                               # сводка по сокетам / TIME_WAIT
sudo conntrack -C 2>/dev/null       # если нет — ничего страшного
ls -la /proc/*/exe 2>/dev/null | wc -l   # сколько процессов
```

Цель — найти **какой ресурс кончился**: память, диск, файлдескрипторы, conntrack.

### Шаг 2 — снять блокировку
Зависит от диагноза:
- **OOM / залипший процесс:** `kill -9 <PID>`, потом `pm2 restart symancy-backend`, `systemctl restart nginx`
- **Диск full:** `du -sh /var/log/* /var/www/symancy-backend/releases/* | sort -h` → удалить старые релизы/логи. В CLAUDE.md правило «keeps last 5 releases» — проверить, действительно ли чистится
- **Если ничего не помогает:** `sudo systemctl restart nginx ssh`; крайний случай — `sudo reboot` через консоль

### Шаг 3 — после восстановления SSH
```bash
# с локалки
ssh deploy@91.132.59.194 "pm2 list && curl -s localhost:3000/health"
# принудительно «толкнуть» Telegram чтобы он повторно доставил pending updates
cd /home/me/code/coffee/symancy-backend
TOKEN=$(grep ^TELEGRAM_BOT_TOKEN= .env | cut -d= -f2-)
curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | jq
# pending_update_count должно вернуться к 0 за ~30 секунд после восстановления
```

### Шаг 4 — Закрыть «теневое» расхождение в отчётах
Два Explore-агента дали противоречивые ответы про deploy webhook-health:
- агент A: «commit `1ca5d82` deployed, health-check активен»
- агент B: «`dist/app.js` слепок от 2026-04-04, нет `webhook-health.service.js` в build»

После восстановления — **проверить факт**:
```bash
ssh deploy@91.132.59.194 'ls -la /var/www/symancy-backend/current/dist/services/ 2>/dev/null; \
  grep -l "runWebhookHealthCheck" /var/www/symancy-backend/current/dist/app.js'
```

Если файла `webhook-health.service.js` нет в `dist/` или `grep` пуст — деплой бэкенда после `1ca5d82` **не прошёл**, нужно перезапустить GitHub Actions workflow `deploy-backend.yml`.

## Critical files (для исследования причины)

- `symancy-backend/src/services/webhook-health.service.ts` — что сейчас проверяет health-check. Видит ли он сценарий «URL правильный, но сервер не отвечает»? Сейчас — **нет**, надо расширить.
- `symancy-backend/src/app.ts:262, 279-307` — регистрация cron `"5 * * * *"` для `webhook-health-check`.
- `symancy-backend/ecosystem.config.cjs` (на сервере) — лимит памяти 512MB, max_restarts=5. Проверить, не упёрся ли в лимит.
- `.github/workflows/deploy-backend.yml` — проверить, реально ли деплой бэкенда прошёл для коммита `1ca5d82`.

## Follow-up (после восстановления, отдельные `bd create`)

1. **`bd create -t bug`** — `symancy-backend: server L7 hang 2026-05-21 ~08:34 UTC, root cause TBD`. Прикрепить вывод из Шага 1.
2. **`bd create -t feature`** — расширить `webhook-health.service.ts`: помимо classification URL добавить отслеживание `pending_update_count` и `last_error_date` из `getWebhookInfo`. Если `last_error_date` свежее N минут И `pending_update_count > threshold` — алёрт в `ADMIN_CHAT_ID`. Это поймало бы текущий инцидент.
3. **`bd create -t feature`** — внешний uptime-watch (UptimeRobot / cron на другом хосте) на `https://symancy.ru/health` с алёртом в Telegram при ≥2 timeout подряд. Внутренний health-check не видит «весь сервер залип».
4. **`bd create -t chore`** — разрешить противоречие в deploy state (Шаг 4 выше); зафиксировать в проектной памяти, действительно ли коммит `1ca5d82` дошёл до прода.

## Verification (как проверить, что бот снова отвечает)

1. `pending_update_count == 0` в `getWebhookInfo`
2. `last_error_date` старше 60 секунд И при свежей отправке апдейта Telegram не записывает новую ошибку
3. Отправить **новое** фото кофе боту `@coffeeveda_bot` с тестового аккаунта — должно прийти сообщение с выбором темы (`handlePhotoMessage` в `src/modules/photo-analysis/handler.ts:90` отвечает синхронно)
4. Выбрать тему → должно прийти «Анализирую…», затем результат анализа (worker `src/modules/photo-analysis/worker.ts:78`)

## Что НЕ нужно сейчас делать

- **Не нужно** менять webhook URL, удалять/переустанавливать webhook (`deleteWebhook` + `setWebhook`) — URL правильный, проблема не в нём.
- **Не нужно** редеплоить фронтенд или править код бота прежде чем понять root cause инцидента.
- **Не нужно** в панике трогать SSL/certbot — TLS не отвечает потому что nginx залип, а не из-за сертификата.
