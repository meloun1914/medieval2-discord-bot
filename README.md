# Scripta Belli

**Scripta Belli** («Писания войны») — Discord-игра: средневековая стратегия + механики **Hearts of Iron 4** + **Mount & Blade**.

## Столпы дизайна

| Источник | Что взяли | Как стыкуется |
|----------|-----------|----------------|
| Total War | Регионы, армия, здания, карта | База кампании |
| HOI4 | Political Power, фокусы, Stability, War Support, Organization | Управляешь государством между боями |
| Mount & Blade | Навыки правителя, компаньоны, караваны, промоут ветеранов | Ты — лорд, не только «кнопка конца хода» |

Механики усиливают друг друга:
- **Leadership** → больше лимит армии → сильнее бои → больше регионов → больше денег.
- **Фокус Military Reform** → сила армии и org → выгоднее battle.
- **Omar** → безопаснее caravan → флорины на PP-фокусы и войска.
- **Organization** падает после боя и растёт на endturn — нельзя спамить war без передышки.

## Команды

| Команда | Суть |
|---------|------|
| `/start` | Новая кампания |
| `/status` | Империя + PP / stab / WS / org |
| `/ruler` | Навыки правителя |
| `/focus` | Национальный фокус (PP) |
| `/companion` | Нанять компаньона (макс. 3) |
| `/caravan` | Торговый риск/профит |
| `/recruit` `/build` `/army` | Войска и экономика |
| `/battle` | Бой, org, промоут, регион |
| `/map` | Карта (Pillow) |
| `/endturn` | Сезон: доход, PP, org, фокус |
| `/echo` | Фан-webhook |
| `/reset` | Сброс |

## Быстрый старт

```bash
git clone https://github.com/meloun1914/medieval2-discord-bot.git
cd medieval2-discord-bot
npm install
pip install -r requirements.txt   # для /map
cp .env.example .env              # TOKEN + CLIENT_ID
npm run deploy-commands
npm start
```

Права бота: Send Messages, Embed Links, Use Slash Commands, **Manage Webhooks**.

## Фокусы

- Industrial Effort — доход зданий
- Military Reform — сила армии + org
- War Propaganda — War Support / Stability
- Grand Army — дешевле upkeep
- Diplomatic Corps — больше PP/ход
- Total Mobilization — мощный боевой бафф ценой stability

## Компаньоны

- Sergius — экономика
- Brynhild — сила армии
- Omar — караваны
- Father Alric — stability
- Liao — восстановление org после боя

## Лицензия

MIT
