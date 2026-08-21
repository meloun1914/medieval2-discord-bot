# Medieval II: Total War Discord Bot

Бот для Discord с механиками **Medieval II: Total War**, картой мира (Pillow) и фан-командой `/echo`.

## Возможности

- Выбор фракции (England, France, HRE, Venice, Byzantium, Russia, Moors, Egypt)
- Экономика: флорины, доход, upkeep, бонус от регионов
- Здания и найм юнитов
- Битвы с потерями, трофеями и **захватом соседних регионов**
- **Карта мира** `/map` — PNG через **Pillow** (Python)
- Пошаговая система (`/endturn`)
- **`/echo`** — сообщение от лица другого участника через временный webhook

## Установка

### 1. Discord Developer Portal

1. [Discord Developer Portal](https://discord.com/developers/applications) → New Application
2. Bot → Add Bot → скопируй **Token**
3. OAuth2 → URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`, **`Manage Webhooks`**
4. Добавь бота на сервер
5. Application ID → `CLIENT_ID`
6. (Опционально) Bot → Privileged Gateway Intents → **Server Members Intent** (для никнеймов в `/echo`)

### 2. Клон и зависимости

```bash
git clone https://github.com/meloun1914/medieval2-discord-bot.git
cd medieval2-discord-bot
npm install

# Python 3 + Pillow (для карты)
pip install -r requirements.txt
# или: pip install Pillow
```

### 3. `.env`

```bash
cp .env.example .env
```

```env
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...          # опционально, мгновенный деплой команд
PYTHON_PATH=python3   # опционально, если python не в PATH
```

### 4. Деплой команд и запуск

```bash
npm run deploy-commands
npm start
```

## Команды

| Команда | Описание |
|---------|----------|
| `/start` | Начать кампанию |
| `/status` | Статус империи + регионы |
| `/map` | Карта мира (Pillow PNG) |
| `/army` | Состав армии |
| `/recruit` | Нанять юнитов |
| `/build` | Построить здание |
| `/battle` | Бой + шанс захватить регион |
| `/endturn` | Завершить ход |
| `/echo` | Сообщение от лица @user |
| `/help` | Справка |
| `/reset` | Сбросить кампанию |

## Как работает карта

1. При `/start` фракция получает стартовый регион (London, Paris, Novgorod…).
2. Победа в `/battle` с шансом захватывает **соседний** свободный регион.
3. `/map` вызывает `scripts/generate_map.py` (Pillow), рисует регионы цветами фракций и шлёт PNG в Discord.
4. Каждый регион даёт +80 флоринов к доходу за ход.

## Как работает `/echo`

1. Бот создаёт **временный webhook** в канале с ником и аватаркой выбранного участника.
2. Отправляет сообщение от его лица.
3. Сразу **удаляет** webhook.

Нужно право бота **Manage Webhooks**.

## Структура

```
medieval2-discord-bot/
├── scripts/
│   └── generate_map.py       # Pillow генератор карты
├── src/
│   ├── index.js
│   ├── deploy-commands.js
│   └── game/
│       ├── data.js
│       ├── database.js
│       ├── engine.js
│       └── map.js            # регионы + вызов Python
├── requirements.txt
├── package.json
└── README.md
```

## Технологии

- discord.js v14 (slash commands, embeds, webhooks, attachments)
- better-sqlite3
- Python 3 + **Pillow**

## Лицензия

MIT
