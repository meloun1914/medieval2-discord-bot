require('dotenv').config();
const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  PermissionFlagsBits
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
  resolveBattle,
  calculateIncome,
  calculateUpkeep
} = require('./game/engine');
const { deletePlayer } = require('./game/database');
const { generateMapImage, REGIONS, startingRegions } = require('./game/map');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Medieval II: Total War', { type: 3 });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const command = interaction.commandName;

  try {
    // ========== /echo ==========
    if (command === 'echo') {
      const target = interaction.options.getUser('user', true);
      const text = interaction.options.getString('message', true);

      if (!interaction.guild) {
        return interaction.reply({ content: 'Только на сервере.', ephemeral: true });
      }

      const me = interaction.guild.members.me;
      if (!me?.permissions.has(PermissionFlagsBits.ManageWebhooks)) {
        return interaction.reply({
          content: 'Мне нужно право **Manage Webhooks**, чтобы работать /echo.',
          ephemeral: true
        });
      }

      let displayName = target.username;
      let avatarURL = target.displayAvatarURL({ extension: 'png', size: 128 });

      try {
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (member) {
          displayName = member.displayName || target.username;
          avatarURL = member.displayAvatarURL({ extension: 'png', size: 128 });
        }
      } catch (_) {}

      await interaction.deferReply({ ephemeral: true });

      let webhook = null;
      try {
        webhook = await interaction.channel.createWebhook({
          name: displayName.slice(0, 80),
          avatar: avatarURL,
          reason: `echo by ${interaction.user.tag}`
        });

        await webhook.send({
          content: text,
          username: displayName.slice(0, 80),
          avatarURL
        });

        await interaction.editReply({ content: '✅ Сообщение отправлено.' });
      } catch (err) {
        console.error('echo error', err);
        await interaction.editReply({
          content: 'Не удалось создать/отправить через вебхук. Проверь права бота.'
        });
      } finally {
        if (webhook) {
          await webhook.delete('echo cleanup').catch(() => {});
        }
      }
      return;
    }

    // ========== /start ==========
    if (command === 'start') {
      const existing = getPlayer(userId);
      if (existing) {
        return interaction.reply({
          content: 'У тебя уже есть кампания! Используй /status или /reset чтобы начать заново.',
          ephemeral: true
        });
      }

      const factionKey = interaction.options.getString('faction');
      const player = createPlayer(userId, factionKey);
      const faction = FACTIONS[factionKey];
      const regionNames = Object.keys(player.regions || {})
        .map(id => REGIONS[id]?.name || id)
        .join(', ');

      const embed = new EmbedBuilder()
        .setTitle(`${faction.emoji} Кампания начата: ${faction.name}`)
        .setColor(faction.color)
        .setDescription(
          [
            'Добро пожаловать, правитель!',
            '',
            `**Религия:** ${faction.religion}`,
            `**Стартовые флорины:** ${faction.startingFlorins}`,
            `**Сильные стороны:** ${faction.strengths}`,
            `**Стартовый регион:** ${regionNames || '—'}`,
            '',
            'Побеждай в боях, чтобы захватывать соседние регионы.',
            'Карта мира: `/map`'
          ].join('\n')
        )
        .addFields({
          name: 'Основные команды',
          value: '`/status` `/map` `/recruit` `/build` `/battle` `/endturn` `/army` `/echo` `/help`'
        })
        .setFooter({ text: 'Medieval II Discord Bot • Ход 1' });

      return interaction.reply({ embeds: [embed] });
    }

    // ========== /help ==========
    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('📜 Medieval II Bot — Справка')
        .setColor(0x8B4513)
        .setDescription(
          [
            'Бот симулирует упрощённые механики **Medieval II: Total War**.',
            '',
            '### Кампания',
            '`/start` — начать (выбор фракции)',
            '`/status` — обзор империи',
            '`/map` — карта мира (Pillow)',
            '`/army` — состав армии',
            '`/recruit` — нанять юнитов',
            '`/build` — построить здание',
            '`/battle` — бой + шанс захватить регион',
            '`/endturn` — завершить ход',
            '`/reset` — сбросить кампанию',
            '',
            '### Фан',
            '`/echo @user текст` — сообщение от лица участника (временный webhook)',
            '',
            '### Механики',
            '• Флорины, здания, upkeep',
            '• Регионы на карте (доход + визуализация)',
            '• Поселение: Village → City',
            '• Битвы с потерями и экспансией'
          ].join('\n')
        )
        .setFooter({ text: 'Удачи, король!' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const needsPlayer = !['help', 'echo'].includes(command);
    let player = getPlayer(userId);
    if (needsPlayer && !player) {
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

      const regionList = Object.keys(player.regions || {})
        .filter(id => player.regions[id])
        .map(id => REGIONS[id]?.name || id);

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
          { name: '🗺️ Регионы', value: regionList.length ? regionList.join(', ') : 'Нет' },
          { name: '🏗️ Здания', value: buildingsList },
          { name: '⚔️ Армия', value: `${player.army.reduce((s, u) => s + (u.count || 1), 0)} юнитов` }
        )
        .setFooter({ text: `Последняя активность: ${new Date(player.lastActive).toLocaleString('ru-RU')}` });

      return interaction.reply({ embeds: [embed] });
    }

    // ========== /map ==========
    if (command === 'map') {
      await interaction.deferReply();

      try {
        if (!player.regions || Object.keys(player.regions).length === 0) {
          player.regions = startingRegions(player.faction);
          savePlayer(player);
        }

        const imgPath = await generateMapImage(player);
        const file = new AttachmentBuilder(imgPath, { name: 'world_map.png' });

        const regionList = Object.keys(player.regions)
          .filter(id => player.regions[id])
          .map(id => REGIONS[id]?.name || id)
          .join(', ');

        const embed = new EmbedBuilder()
          .setTitle(`🗺️ Карта мира — ${FACTIONS[player.faction]?.name}`)
          .setColor(FACTIONS[player.faction]?.color || 0x8B4513)
          .setDescription('**Контроль:** ' + (regionList || '—') + '\n**Ход:** ' + player.turn)
          .setImage('attachment://world_map.png')
          .setFooter({ text: 'Сгенерировано через Pillow' });

        await interaction.editReply({ embeds: [embed], files: [file] });

        setTimeout(() => fs.unlink(imgPath, () => {}), 60_000);
      } catch (err) {
        console.error('map error', err);
        await interaction.editReply({
          content:
            'Не удалось сгенерировать карту. Убедись, что установлен **Python 3** и **Pillow**:\n```\npip install pillow\n```\nОшибка: `' +
            String(err.message).slice(0, 200) +
            '`'
        });
      }
      return;
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

      const result = resolveBattle(player);

      let extra = '';
      if (result.victory && result.conquered) {
        const name = REGIONS[result.conquered]?.name || result.conquered;
        extra = '\n\n🗺️ Захвачен регион: **' + name + '**! Смотри `/map`';
      } else if (result.victory) {
        extra = '\n\n(Соседних свободных регионов нет — карта уже твоя или упёрся в край)';
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
          (result.victory
            ? '\n\n💰 Трофеи: **+' + result.loot + '** флоринов'
            : '\n\nАрмия понесла тяжёлые потери.') +
          extra
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
          {
            name: 'Поселение',
            value: SETTLEMENT_LEVELS[player.settlementLevel]?.name || player.settlementLevel,
            inline: true
          },
          {
            name: 'Регионы',
            value: String(Object.values(player.regions || {}).filter(Boolean).length),
            inline: true
          }
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
          await i.update({
            content: 'Кампания сброшена. Можешь начать заново через `/start`.',
            components: []
          });
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
