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

/* ───────────────── Embed helpers ───────────────── */

const COLORS = {
  gold: 0xC9A227,
  success: 0x2ECC71,
  danger: 0xE74C3C,
  warn: 0xF39C12,
  info: 0x3498DB,
  dark: 0x2C3E50,
  parchment: 0xD4A574,
  purple: 0x9B59B6
};

function baseEmbed(title, color = COLORS.gold) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp();
}

function errorEmbed(description) {
  return baseEmbed('⚠️ Ошибка', COLORS.danger)
    .setDescription(description)
    .setFooter({ text: 'Medieval II Bot' });
}

function successEmbed(title, description) {
  return baseEmbed(title, COLORS.success)
    .setDescription(description)
    .setFooter({ text: 'Medieval II Bot' });
}

function infoEmbed(title, description) {
  return baseEmbed(title, COLORS.info)
    .setDescription(description)
    .setFooter({ text: 'Medieval II Bot' });
}

function factionEmbed(player, title) {
  const faction = FACTIONS[player.faction];
  return baseEmbed(title || `${faction.emoji} ${faction.name}`, faction.color)
    .setFooter({
      text: `${faction.name} • Ход ${player.turn} • Medieval II Bot`
    });
}

async function replyEmbed(interaction, embeds, options = {}) {
  const payload = { embeds: Array.isArray(embeds) ? embeds : [embeds], ...options };
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

/* ───────────────── Bot ───────────────── */

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
        return replyEmbed(interaction, errorEmbed('Команда `/echo` работает только на сервере.'), {
          ephemeral: true
        });
      }

      const me = interaction.guild.members.me;
      if (!me?.permissions.has(PermissionFlagsBits.ManageWebhooks)) {
        return replyEmbed(
          interaction,
          errorEmbed(
            'Мне нужно право **Manage Webhooks**, чтобы писать от лица участников.\n' +
            'Попроси админа выдать его боту.'
          ),
          { ephemeral: true }
        );
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

        await replyEmbed(
          interaction,
          successEmbed(
            '🎭 Echo отправлен',
            `Сообщение отправлено от лица **${displayName}**.\nВременный webhook удалён.`
          )
        );
      } catch (err) {
        console.error('echo error', err);
        await replyEmbed(
          interaction,
          errorEmbed('Не удалось создать или отправить webhook. Проверь права бота в этом канале.')
        );
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
        return replyEmbed(
          interaction,
          errorEmbed(
            'У тебя уже есть активная кампания.\n' +
            'Посмотри прогресс: `/status`\n' +
            'Начать заново: `/reset`'
          ),
          { ephemeral: true }
        );
      }

      const factionKey = interaction.options.getString('faction');
      const player = createPlayer(userId, factionKey);
      const faction = FACTIONS[factionKey];
      const regionNames = Object.keys(player.regions || {})
        .map(id => REGIONS[id]?.name || id)
        .join(', ');

      const embed = baseEmbed(`${faction.emoji} Кампания начата`, faction.color)
        .setDescription(`Добро пожаловать, правитель **${faction.name}**!`)
        .addFields(
          { name: '⛪ Религия', value: faction.religion, inline: true },
          { name: '💰 Казна', value: `${faction.startingFlorins} флоринов`, inline: true },
          { name: '🗺️ Стартовый регион', value: regionNames || '—', inline: true },
          { name: '⚔️ Сильные стороны', value: faction.strengths },
          {
            name: '📜 С чего начать',
            value:
              '• `/status` — обзор империи\n' +
              '• `/recruit` — нанять войска\n' +
              '• `/build` — построить здание\n' +
              '• `/battle` — сразиться и расширяться\n' +
              '• `/map` — карта мира\n' +
              '• `/endturn` — завершить ход'
          }
        )
        .setFooter({ text: 'Medieval II Discord Bot • Ход 1' })
        .setTimestamp();

      return replyEmbed(interaction, embed);
    }

    // ========== /help ==========
    if (command === 'help') {
      const embed = baseEmbed('📜 Medieval II Bot — Справка', COLORS.parchment)
        .setDescription('Упрощённые механики **Medieval II: Total War** прямо в Discord.')
        .addFields(
          {
            name: '🏰 Кампания',
            value:
              '`/start` — начать кампанию\n' +
              '`/status` — статус империи\n' +
              '`/map` — карта мира (Pillow)\n' +
              '`/army` — состав армии\n' +
              '`/recruit` — нанять юнитов\n' +
              '`/build` — построить здание\n' +
              '`/battle` — бой + захват региона\n' +
              '`/endturn` — завершить ход\n' +
              '`/reset` — сбросить кампанию'
          },
          {
            name: '🎭 Фан',
            value: '`/echo @user текст` — сообщение от лица участника (временный webhook)'
          },
          {
            name: '⚙️ Механики',
            value:
              '• Флорины, здания, upkeep армии\n' +
              '• Регионы на карте (+доход)\n' +
              '• Рост поселения: Village → City\n' +
              '• Битвы с потерями, трофеями и экспансией'
          }
        )
        .setFooter({ text: 'Удачи, король! • Medieval II Bot' })
        .setTimestamp();

      return replyEmbed(interaction, embed, { ephemeral: true });
    }

    const needsPlayer = !['help', 'echo'].includes(command);
    let player = getPlayer(userId);
    if (needsPlayer && !player) {
      return replyEmbed(
        interaction,
        errorEmbed('Сначала начни кампанию командой `/start`.'),
        { ephemeral: true }
      );
    }

    // ========== /status ==========
    if (command === 'status') {
      const faction = FACTIONS[player.faction];
      const income = calculateIncome(player);
      const upkeep = calculateUpkeep(player);
      const net = income - upkeep;

      const buildingsList = player.buildings.length
        ? player.buildings.map(b => `• ${BUILDINGS[b]?.name || b}`).join('\n')
        : '_пока нет_';

      const regionList = Object.keys(player.regions || {})
        .filter(id => player.regions[id])
        .map(id => REGIONS[id]?.name || id);

      const armySize = player.army.reduce((s, u) => s + (u.count || 1), 0);

      const embed = factionEmbed(player)
        .setDescription(`Обзор империи на **ходе ${player.turn}**`)
        .addFields(
          { name: '💰 Флорины', value: `**${player.florins}**`, inline: true },
          { name: '📈 Доход', value: `+${income}`, inline: true },
          { name: '📉 Upkeep', value: `−${upkeep}`, inline: true },
          {
            name: '⚖️ Чистыми',
            value: net >= 0 ? `**+${net}**` : `**${net}**`,
            inline: true
          },
          { name: '👥 Население', value: `${player.population}`, inline: true },
          {
            name: '🏰 Поселение',
            value: SETTLEMENT_LEVELS[player.settlementLevel]?.name || player.settlementLevel,
            inline: true
          },
          {
            name: `🗺️ Регионы (${regionList.length})`,
            value: regionList.length ? regionList.join(', ') : '_нет_'
          },
          { name: '🏗️ Здания', value: buildingsList, inline: true },
          { name: '⚔️ Армия', value: `**${armySize}** / 20 юнитов`, inline: true }
        )
        .setTimestamp();

      return replyEmbed(interaction, embed);
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
          .map(id => REGIONS[id]?.name || id);

        const faction = FACTIONS[player.faction];
        const embed = factionEmbed(player, `🗺️ Карта мира — ${faction.name}`)
          .setDescription(
            regionList.length
              ? `Территории под контролем:\n**${regionList.join(' • ')}**`
              : 'Пока нет захваченных регионов.'
          )
          .addFields(
            { name: '📍 Регионов', value: `${regionList.length}`, inline: true },
            { name: '⏳ Ход', value: `${player.turn}`, inline: true },
            { name: '💰 Казна', value: `${player.florins}`, inline: true }
          )
          .setImage('attachment://world_map.png')
          .setFooter({ text: `Pillow • ${faction.name} • Medieval II Bot` });

        await interaction.editReply({ embeds: [embed], files: [file] });
        setTimeout(() => fs.unlink(imgPath, () => {}), 60_000);
      } catch (err) {
        console.error('map error', err);
        await replyEmbed(
          interaction,
          errorEmbed(
            'Не удалось сгенерировать карту.\n\n' +
            'Нужны **Python 3** и **Pillow**:\n' +
            '```\npip install pillow\n```\n' +
            `Детали: \`${String(err.message).slice(0, 180)}\``
          )
        );
      }
      return;
    }

    // ========== /army ==========
    if (command === 'army') {
      if (player.army.length === 0) {
        return replyEmbed(
          interaction,
          infoEmbed(
            '⚔️ Армия пуста',
            'У тебя пока нет войск.\nНанимай через `/recruit`.'
          ),
          { ephemeral: true }
        );
      }

      const total = player.army.reduce((s, u) => s + (u.count || 1), 0);
      const lines = player.army.map((u, i) => {
        const def = UNIT_TYPES[u.unit];
        const exp = u.experience ? ` ★${u.experience}` : '';
        const typeIcon =
          def?.type === 'cavalry' ? '🐴' :
          def?.type === 'missile' ? '🏹' : '🛡️';
        return (
          `**${i + 1}.** ${typeIcon} **${def?.name || u.unit}** ×${u.count || 1}${exp}\n` +
          `  ATK \\`${def?.attack ?? '?'}\\`  DEF \\`${def?.defense ?? '?'}\\`  Upkeep \\`${(def?.upkeep || 0) * (u.count || 1)}\\``
        );
      });

      const embed = factionEmbed(player, '⚔️ Состав армии')
        .setDescription(lines.join('\n\n'))
        .addFields(
          { name: 'Численность', value: `**${total}** / 20`, inline: true },
          { name: 'Upkeep', value: `**${calculateUpkeep(player)}**/ход`, inline: true }
        )
        .setTimestamp();

      return replyEmbed(interaction, embed);
    }

    // ========== /recruit ==========
    if (command === 'recruit') {
      const unitKey = interaction.options.getString('unit');
      const amount = interaction.options.getInteger('amount') || 1;
      const unitDef = UNIT_TYPES[unitKey];
      const result = recruitUnit(player, unitKey, amount);

      if (!result.success) {
        return replyEmbed(interaction, errorEmbed(result.message), { ephemeral: true });
      }

      // refresh player after recruit
      player = getPlayer(userId);
      const embed = successEmbed(
        '🎖️ Войска наняты',
        `**${amount}× ${unitDef?.name || unitKey}** вступили в армию.`
      )
        .addFields(
          { name: '💰 Потрачено', value: `${(unitDef?.cost || 0) * amount}`, inline: true },
          { name: 'Казна', value: `${player.florins}`, inline: true },
          {
            name: 'Армия',
            value: `${player.army.reduce((s, u) => s + (u.count || 1), 0)} / 20`,
            inline: true
          }
        )
        .setColor(FACTIONS[player.faction]?.color || COLORS.success)
        .setFooter({ text: `${FACTIONS[player.faction]?.name || ''} • Medieval II Bot` })
        .setTimestamp();

      return replyEmbed(interaction, embed);
    }

    // ========== /build ==========
    if (command === 'build') {
      const buildingKey = interaction.options.getString('building');
      const building = BUILDINGS[buildingKey];
      const result = buildBuilding(player, buildingKey);

      if (!result.success) {
        return replyEmbed(interaction, errorEmbed(result.message), { ephemeral: true });
      }

      player = getPlayer(userId);
      const embed = successEmbed(
        '🏗️ Строительство завершено',
        `Построено: **${building?.name || buildingKey}**`
      )
        .addFields(
          { name: '💰 Стоимость', value: `${building?.cost ?? '?'}`, inline: true },
          { name: 'Казна', value: `${player.florins}`, inline: true },
          {
            name: 'Эффект',
            value: building?.incomeBonus
              ? `+${building.incomeBonus} дохода`
              : building?.unlocks
                ? `Открывает: ${building.unlocks.map(u => UNIT_TYPES[u]?.name || u).join(', ')}`
                : building?.description || '—'
          }
        )
        .setColor(FACTIONS[player.faction]?.color || COLORS.success)
        .setFooter({ text: `${FACTIONS[player.faction]?.name || ''} • Medieval II Bot` })
        .setTimestamp();

      return replyEmbed(interaction, embed);
    }

    // ========== /battle ==========
    if (command === 'battle') {
      if (player.army.length === 0) {
        return replyEmbed(
          interaction,
          errorEmbed('У тебя нет армии! Сначала `/recruit`.'),
          { ephemeral: true }
        );
      }

      const result = resolveBattle(player);
      player = getPlayer(userId);

      const embed = baseEmbed(
        result.victory ? '🏆 Победа на поле боя!' : '💀 Поражение...',
        result.victory ? COLORS.success : COLORS.danger
      )
        .setDescription(
          result.victory
            ? 'Вражеская армия разбита. Твои войска стоят крепко.'
            : 'Враг оказался сильнее. Армия понесла тяжёлые потери.'
        )
        .addFields(
          {
            name: '⚔️ Твоя сила',
            value: `**${result.playerPower}**\nбросок \`${result.playerRoll}\``,
            inline: true
          },
          {
            name: '☠️ Сила врага',
            value: `**${result.enemyPower}**\nбросок \`${result.enemyRoll}\``,
            inline: true
          },
          {
            name: '🩸 Потери',
            value: `**~${Math.round(result.casualtiesPercent * 100)}%** армии`,
            inline: true
          },
          {
            name: '📋 Состав в бою',
            value: result.details.slice(0, 8).join('\n') || '—'
          }
        );

      if (result.victory) {
        embed.addFields({
          name: '💰 Трофеи',
          value: `**+${result.loot}** флоринов`,
          inline: true
        });
        if (result.conquered) {
          const name = REGIONS[result.conquered]?.name || result.conquered;
          embed.addFields({
            name: '🗺️ Экспансия',
            value: `Захвачен регион **${name}**!\nСмотри на карте: `/map``,
            inline: true
          });
        } else {
          embed.addFields({
            name: '🗺️ Экспансия',
            value: '_Свободных соседей нет_',
            inline: true
          });
        }
      }

      embed
        .setFooter({
          text: `${FACTIONS[player.faction]?.name || ''} • Казна: ${player.florins} • Medieval II Bot`
        })
        .setTimestamp();

      return replyEmbed(interaction, embed);
    }

    // ========== /endturn ==========
    if (command === 'endturn') {
      const prevTurn = player.turn;
      const { income, upkeep, growth } = endTurn(player);
      player = getPlayer(userId);
      const net = income - upkeep;

      const embed = factionEmbed(player, `⏳ Ход ${prevTurn} завершён`)
        .setDescription('Империя прожила ещё один сезон.')
        .addFields(
          { name: '📈 Доход', value: `+**${income}**`, inline: true },
          { name: '📉 Upkeep', value: `−**${upkeep}**`, inline: true },
          {
            name: '⚖️ Итого',
            value: net >= 0 ? `+**${net}**` : `**${net}**`,
            inline: true
          },
          { name: '👥 Рост населения', value: `+${growth}`, inline: true },
          { name: '💰 Казна', value: `**${player.florins}**`, inline: true },
          { name: '👥 Население', value: `**${player.population}**`, inline: true },
          {
            name: '🏰 Поселение',
            value: SETTLEMENT_LEVELS[player.settlementLevel]?.name || player.settlementLevel,
            inline: true
          },
          {
            name: '🗺️ Регионы',
            value: String(Object.values(player.regions || {}).filter(Boolean).length),
            inline: true
          },
          { name: '➡️ Следующий ход', value: `**${player.turn}**`, inline: true }
        )
        .setTimestamp();

      return replyEmbed(interaction, embed);
    }

    // ========== /reset ==========
    if (command === 'reset') {
      const embed = baseEmbed('⚠️ Сброс кампании', COLORS.warn)
        .setDescription(
          'Ты уверен? **Вся** кампания будет удалена безвозвратно:\n' +
          'флорины, армия, здания, регионы.'
        )
        .setFooter({ text: 'Действие нельзя отменить • 15 секунд' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_reset')
          .setLabel('Да, сбросить')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️'),
        new ButtonBuilder()
          .setCustomId('cancel_reset')
          .setLabel('Отмена')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️')
      );

      const reply = await interaction.reply({
        embeds: [embed],
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
            embeds: [
              successEmbed(
                '🗑️ Кампания сброшена',
                'Прогресс удалён. Начни заново через `/start`.'
              )
            ],
            components: []
          });
        } else {
          await i.update({
            embeds: [
              infoEmbed('↩️ Сброс отменён', 'Твоя империя в безопасности.')
            ],
            components: []
          });
        }
      });

      collector.on('end', async collected => {
        if (collected.size === 0) {
          await interaction
            .editReply({
              embeds: [infoEmbed('⌛ Время вышло', 'Сброс не подтверждён.')],
              components: []
            })
            .catch(() => {});
        }
      });
    }
  } catch (err) {
    console.error(err);
    const embed = errorEmbed('Произошла внутренняя ошибка. Попробуй ещё раз чуть позже.');
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
