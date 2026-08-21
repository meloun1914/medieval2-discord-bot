# Medieval II: Total War Discord Bot

Бот для Discord, который приносит механики **Medieval II: Total War** прямо на сервер.

Каждый игрок ведёт свою кампанию: выбирает фракцию, развивает поселение, нанимает войска, строит здания, сражается и заканчивает ходы.

## Возможности (MVP)

- Выбор фракции (England, France, HRE, Venice, Byzantium, Russia, Moors, Egypt)
- Экономика: флорины, доход, upkeep армии
- Здания: фермы, рынок, казармы, конюшни, стрельбище, кузница
- Найм юнитов (милиция → рыцари → элита)
- Простая симуляция битв с потерями и трофеями
- Рост населения и апгрейд поселения (Village → City)
- Пошаговая система (`/endturn`)

## Установка

### 1. Создай приложение в Discord Developer Portal

1. Зайди на [Discord Developer Portal](https://discord.com/developers/applications)
2. New Application → дай имя
3. Bot → Add Bot → скопируй **Token**
4. OAuth2 → URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
5. Скопируй ссылку и добавь бота на свой сервер
6. В General Information скопируй **Application ID** (это CLIENT_ID)

### 2. Клонируй репозиторий

```bash
git clone https://github.com/meloun1914/medieval2-discord-bot.git
cd medieval2-discord-bot
npm install
```

### 3. Настрой окружение

```bash
cp .env.example .env
```

Отредактируй `.env`:

```env
DISCORD_TOKEN=твой_токен_бота
CLIENT_ID=твой_application_id

# Опционально — для мгновенного деплоя команд на тестовый сервер
GUILD_ID=id_твоего_сервера
```

### 4. Задеплой slash-команды

```bash
npm run deploy-commands
```

### 5. Запусти бота

```bash
npm start
```

Бот должен появиться онлайн.

## Команды

| Команда | Описание |
|---------|----------|
| `/start` | Начать кампанию (выбор фракции) |
| `/status` | Статус империи |
| `/army` | Состав армии |
| `/recruit` | Нанять юнитов |
| `/build` | Построить здание |
| `/battle` | Сразиться с врагом |
| `/endturn` | Завершить ход |
| `/help` | Справка |
| `/reset` | Сбросить кампанию |

## Структура проекта

```
medieval2-discord-bot/
├── src/
│   ├── index.js              # Главный файл бота
│   ├── deploy-commands.js    # Деплой slash-команд
│   └── game/
│       ├── data.js           # Фракции, юниты, здания
│       ├── database.js       # SQLite хранилище
│       └── engine.js         # Логика кампании и боёв
├── data/                     # База создаётся автоматически
├── package.json
├── .env.example
└── README.md
```

## Технологии

- **discord.js v14** — современный Discord API (slash commands, embeds, buttons)
- **better-sqlite3** — быстрая локальная БД для сохранений игроков
- Node.js 18+

## Что можно допилить дальше

- Агенты (шпионы, ассасины, купцы, священники)
- Дипломатия между игроками
- Общий мир / PvP битвы
- Крестовые походы и джихады
- Более глубокая симуляция боёв (фланги, мораль, генералы)
- Гильдии и поздние юниты (пушки)
- Админ-команды

## Лицензия

MIT

---

Сделано с уважением к классике Total War. Не проеби империю на монголах.
