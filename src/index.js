require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const {
  FACTIONS,
  UNIT_TYPES,
  BUILDINGS,
  SETTLEMENT_LEVELS
} = require('./game/data');
const {
  getPlayer,
  createPlayer,
  savePlayer,
  endTurn,
  recruitUnit,
  buildBuilding,
  simulateBattle,
  applyCasualties,
  calculateIncome,
  calculateUpkeep
} = require('./game/engine');
const { deletePlayer } = require('./game/database');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Medieval II: Total War', { type: 3 }); // Watching
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const command = interaction.commandName;

  try {
    // ========== /start ==========
    if (command === 'start') {
      const existing = getPlayer(userId);
      if (existing) {
        return interaction.reply({
          content: 'У тебя уже есть кампания! Используй `/status` или `/reset` чтобы начать заново.',
          ephemeral: true
        });
      }

      const factionKey = interaction.options.getString('faction');
      const player = createPlayer(userId, factionKey);
      const faction = FACTIONS[factionKey];

      const embed = new EmbedBuilder()
        .setTitle(`${faction.emoji} Кампания начата: ${faction.name}`)
        .setColor(faction.color)
        .setDescription(
          `Добро пожаловать, правитель!\n\n` +
          `**Религия:** ${faction.religion}\n` +
          `**Стартовые флорины:** ${faction.startingFlorins}\n` +
          `**Сильные стороны:** ${faction.strengths}\n\n` +
          `Ты начинаешь с небольшой армией и деревней.\n` +
          `Используй команды ниже, чтобы развивать империю.`
        )
        .addFields(
          { name: 'Основные команды', value: '`/status` `/recruit` `/build` `/battle` `/endturn` `/army` `/help`' }
        )
        .setFooter({ text: 'Medieval II Discord Bot • Ход 1' });

      return interaction.reply({ embeds: [embed] });
    }

    // ========== /help ==========
    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('📜 Medieval II Bot — Справка')
        .setColor(0x8B4513)
        .setDescription(
          'Бот симулирует упрощённые механики **Medieval II: Total War**.\n\n' +
          '**Кампания пошаговая.** Каждый игрок ведёт свою империю.\n\n' +
          '### Команды:\n' +
          '`/start` — начать кампанию (выбор фракции)\n' +
          '`/status` — обзор империи\n' +
          '`/army` — состав армии\n' +
          '`/recruit` — нанять юнитов\n' +
          '`/build` — построить здание\n' +
          '`/battle` — сразиться с врагом\n' +
          '`/endturn` — завершить ход (доход + рост)\n' +
          '`/reset` — сбросить кампанию\n\n' +
          '### Механики:\n' +
          '• **Флорины** — главная валюта\n' +
          '• **Здания** дают доход и открывают юнитов\n' +
          '• **Армия** максимум ~20 юнитов\n' +
          '• **Битвы** — простая симуляция силы + рандом\n' +
          '• **Ход** — доход, upkeep, рост населения, апгрейд поселения\n' +
          '• Поселение растёт: Village → Town → Large Town → City...'
        )
        .setFooter({ text: 'Удачи, король!' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // All other commands require a player
    let player = getPlayer(userId);
    if (!player && command !== 'help') {
      return interaction.reply({
        content: 'Сначала начни кампанию командой `/start`!',
        ephemeral: true
      });
    }

    // ========== /status ==========
    if (command === 'status') {
      const faction = FACTIONS[player.faction];
      const income = calculateIncome(player);
      const upkeep = calculateUpkeep(player);
      const net = income - upkeep;

      const buildingsList = player.buildings.length
        ? player.buildings.map(b => BUILDINGS[b]?.name || b).join(', ')
        : 'Нет';

      const embed = new EmbedBuilder()
        .setTitle(`${faction.emoji} ${faction.name} — Ход ${player.turn}`)
        .setColor(faction.color)
        .addFields(
          { name: '💰 Флорины', value: `${player.florins}`, inline: true },
          { name: '📈 Доход / Ход', value: `+${income}`, inline: true },
          { name: '📉 Upkeep', value: `-${upkeep}`, inline: true },
          { name: '⚖️ Чистый доход', value: `${net >= 0 ? '+' : ''}${net}`, inline: true },
          { name: '👥 Население', value: `${player.population}`, inline: true },
          { name: '🏰 Поселение', value: SETTLEMENT_LEVELS[player.settlementLevel]?.name || player.settlementLevel, inline: true },
          { name: '🏗️ Здания', value: buildingsList },
          { name: '⚔️ Армия', value: `${player.army.reduce((s, u) => s + (u.count || 1), 0)} юнитов` }
        )
        .setFooter({ text: `Последняя активность: ${new Date(player.lastActive).toLocaleString('ru-RU')}` });

      return interaction.reply({ embeds: [embed] });
    }

    // ========== /army ==========
    if (command === 'army') {
      if (player.army.length === 0) {
        return interaction.reply('Армия пуста. Нанимай юнитов через `/recruit`.');
      }

      const lines = player.army.map(u => {
        const def = UNIT_TYPES[u.unit];
        const exp = u.experience ? ` ★${u.experience}` : '';
        return `**${def?.name || u.unit}** x${u.count || 1}${exp} — ATK ${def?.attack} / DEF ${def?.defense}`;
      });

      const embed = new EmbedBuilder()
        .setTitle('⚔️ Твоя армия')
        .setColor(0x8B0000)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Всего: ${player.army.reduce((s, u) => s + (u.count || 1), 0)} / 20` });

      return interaction.reply({ embeds: [embed] });
    }

    // ========== /recruit ==========
    if (command === 'recruit') {
      const unitKey = interaction.options.getString('unit');
      const amount = interaction.options.getInteger('amount') || 1;

      const result = recruitUnit(player, unitKey, amount);
      return interaction.reply({
        content: result.message,
        ephemeral: !result.success
      });
    }

    // ========== /build ==========
    if (command === 'build') {
      const buildingKey = interaction.options.getString('building');
      const result = buildBuilding(player, buildingKey);
      return interaction.reply({
        content: result.message,
        ephemeral: !result.success
      });
    }

    // ========== /battle ==========
    if (command === 'battle') {
      if (player.army.length === 0) {
        return interaction.reply({ content: 'У тебя нет армии!', ephemeral: true });
      }

      const result = simulateBattle(player.army);

      // Apply casualties
      applyCasualties(player, result.casualtiesPercent);

      // Loot on victory
      let loot = 0;
      if (result.victory) {
        loot = 150 + Math.floor(Math.random() * 350);
        player.florins += loot;
        savePlayer(player);
      }

      const embed = new EmbedBuilder()
        .setTitle(result.victory ? '🏆 Победа!' : '💀 Поражение...')
        .setColor(result.victory ? 0x228B22 : 0x8B0000)
        .addFields(
          { name: 'Твоя сила', value: `${result.playerPower} (бросок ${result.playerRoll})`, inline: true },
          { name: 'Сила врага', value: `${result.enemyPower} (бросок ${result.enemyRoll})`, inline: true },
          { name: 'Потери', value: `~${Math.round(result.casualtiesPercent * 100)}% армии`, inline: true }
        )
        .setDescription(
          result.details.join('\n') +
          (result.victory ? `\n\n💰 Трофеи: **+${loot}** флоринов` : '\n\nАрмия понесла тяжёлые потери.')
        );

      return interaction.reply({ embeds: [embed] });
    }

    // ========== /endturn ==========
    if (command === 'endturn') {
      const { income, upkeep, growth } = endTurn(player);

      const embed = new EmbedBuilder()
        .setTitle(`⏳ Ход ${player.turn - 1} завершён`)
        .setColor(0x4169E1)
        .addFields(
          { name: 'Доход', value: `+${income}`, inline: true },
          { name: 'Upkeep', value: `-${upkeep}`, inline: true },
          { name: 'Чистыми', value: `${income - upkeep >= 0 ? '+' : ''}${income - upkeep}`, inline: true },
          { name: 'Рост населения', value: `+${growth}`, inline: true },
          { name: 'Текущие флорины', value: `${player.florins}`, inline: true },
          { name: 'Население', value: `${player.population}`, inline: true },
          { name: 'Поселение', value: SETTLEMENT_LEVELS[player.settlementLevel]?.name || player.settlementLevel, inline: true }
        )
        .setFooter({ text: `Теперь ход ${player.turn}` });

      return interaction.reply({ embeds: [embed] });
    }

    // ========== /reset ==========
    if (command === 'reset') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_reset')
          .setLabel('Да, сбросить')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_reset')
          .setLabel('Отмена')
          .setStyle(ButtonStyle.Secondary)
      );

      const reply = await interaction.reply({
        content: '⚠️ Ты уверен? Вся кампания будет удалена безвозвратно.',
        components: [row],
        ephemeral: true
      });

      const collector = reply.createMessageComponentCollector({
        time: 15000,
        filter: i => i.user.id === userId
      });

      collector.on('collect', async i => {
        if (i.customId === 'confirm_reset') {
          deletePlayer(userId);
          await i.update({ content: 'Кампания сброшена. Можешь начать заново через `/start`.', components: [] });
        } else {
          await i.update({ content: 'Сброс отменён.', components: [] });
        }
      });

      collector.on('end', async collected => {
        if (collected.size === 0) {
          await interaction.editReply({ content: 'Время вышло.', components: [] }).catch(() => {});
        }
      });
    }

  } catch (err) {
    console.error(err);
    const msg = 'Произошла ошибка. Попробуй ещё раз.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
