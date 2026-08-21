require('dotenv').config();
const fs = require('fs');
const {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionFlagsBits
} = require('discord.js');
const {
  GAME_NAME, FACTIONS, UNIT_TYPES, BUILDINGS, SETTLEMENT_LEVELS,
  FOCUSES, COMPANIONS, SKILLS
} = require('./game/data');
const {
  getPlayer, createPlayer, savePlayer, endTurn, recruitUnit, buildBuilding,
  resolveBattle, calculateIncome, calculateUpkeep, startFocus, hireCompanion, runCaravan
} = require('./game/engine');
const { deletePlayer } = require('./game/database');
const { generateMapImage, REGIONS, startingRegions } = require('./game/map');

const COLORS = {
  gold: 0xC9A227, success: 0x2ECC71, danger: 0xE74C3C, warn: 0xF39C12,
  info: 0x3498DB, parchment: 0xD4A574, iron: 0x5D6D7E, focus: 0x8E44AD
};

function baseEmbed(title, color = COLORS.gold) {
  return new EmbedBuilder().setTitle(title).setColor(color).setTimestamp();
}
function errorEmbed(d) {
  return baseEmbed('⚠️ Ошибка', COLORS.danger).setDescription(d).setFooter({ text: GAME_NAME });
}
function successEmbed(t, d) {
  return baseEmbed(t, COLORS.success).setDescription(d).setFooter({ text: GAME_NAME });
}
function infoEmbed(t, d) {
  return baseEmbed(t, COLORS.info).setDescription(d).setFooter({ text: GAME_NAME });
}
function factionEmbed(player, title) {
  const f = FACTIONS[player.faction];
  return baseEmbed(title || `${f.emoji} ${f.name}`, f.color).setFooter({
    text: `${f.name} • Ход ${player.turn} • ${GAME_NAME}`
  });
}
async function replyEmbed(interaction, embeds, options = {}) {
  const payload = { embeds: Array.isArray(embeds) ? embeds : [embeds], ...options };
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
  return interaction.reply(payload);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity(GAME_NAME, { type: 3 });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const userId = interaction.user.id;
  const command = interaction.commandName;

  try {
    if (command === 'echo') {
      const target = interaction.options.getUser('user', true);
      const text = interaction.options.getString('message', true);
      if (!interaction.guild) {
        return replyEmbed(interaction, errorEmbed('Только на сервере.'), { ephemeral: true });
      }
      const me = interaction.guild.members.me;
      if (!me?.permissions.has(PermissionFlagsBits.ManageWebhooks)) {
        return replyEmbed(interaction, errorEmbed('Нужно право **Manage Webhooks**.'), { ephemeral: true });
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
        await webhook.send({ content: text, username: displayName.slice(0, 80), avatarURL });
        await replyEmbed(interaction, successEmbed('🎭 Сообщение отправлено', `От лица **${displayName}**.`));
      } catch (err) {
        console.error(err);
        await replyEmbed(interaction, errorEmbed('Не удалось отправить через вебхук.'));
      } finally {
        if (webhook) await webhook.delete('echo cleanup').catch(() => {});
      }
      return;
    }

    if (command === 'start') {
      if (getPlayer(userId)) {
        return replyEmbed(interaction, errorEmbed('Кампания уже есть. `/status` или `/reset`.'), { ephemeral: true });
      }
      const factionKey = interaction.options.getString('faction');
      const player = createPlayer(userId, factionKey);
      const faction = FACTIONS[factionKey];
      const regionNames = Object.keys(player.regions || {}).map(id => REGIONS[id]?.name || id).join(', ');

      const embed = baseEmbed(`${faction.emoji} ${GAME_NAME}`, faction.color)
        .setDescription(
          `Ты — правитель **${faction.name}**.\n` +
          '**Scripta Belli** — писания войны: стратегия, фокусы державы и путь лорда.'
        )
        .addFields(
          { name: '⛪ Религия', value: faction.religion, inline: true },
          { name: '💰 Казна', value: `${faction.startingFlorins}`, inline: true },
          { name: '🗺️ Регион', value: regionNames || '—', inline: true },
          { name: '📜 Сильные стороны', value: faction.strengths },
          {
            name: '🎮 С чего начать',
            value: [
              '`/status` — империя',
              '`/ruler` — навыки и власть',
              '`/focus` — национальный фокус',
              '`/companion` — компаньон',
              '`/caravan` — торговля',
              '`/battle` → `/endturn` — война и сезон'
            ].join('\n')
          }
        )
        .setFooter({ text: `${GAME_NAME} • Ход 1` });
      return replyEmbed(interaction, embed);
    }

    if (command === 'help') {
      const embed = baseEmbed(`📜 ${GAME_NAME} — Справка`, COLORS.parchment)
        .setDescription(
          '**Scripta Belli** («Писания войны»):\n' +
          '• стратегия и карта\n' +
          '• политическая власть, фокусы, организация, стабильность\n' +
          '• навыки правителя, компаньоны, караваны, повышение войск'
        )
        .addFields(
          { name: '🏰 Империя', value: '`/start` `/status` `/map` `/build` `/endturn` `/reset`' },
          { name: '⚔️ Война', value: '`/army` `/recruit` `/battle` — организация, ветераны, регионы' },
          { name: '🧠 Держава', value: '`/focus` — фокусы\n`/ruler` — власть, стабильность, поддержка войны, организация' },
          { name: '🗡️ Путь лорда', value: '`/companion` — герой\n`/caravan` — риск и прибыль\nНавыки растут от действий\nВетераны повышаются после боёв' },
          { name: '🎭 Фан', value: '`/echo @user текст`' }
        )
        .setFooter({ text: GAME_NAME });
      return replyEmbed(interaction, embed, { ephemeral: true });
    }

    const needsPlayer = !['help', 'echo'].includes(command);
    let player = getPlayer(userId);
    if (needsPlayer && !player) {
      return replyEmbed(interaction, errorEmbed('Сначала `/start`.'), { ephemeral: true });
    }

    if (command === 'status') {
      const income = calculateIncome(player);
      const upkeep = calculateUpkeep(player);
      const net = income - upkeep;
      const buildingsList = player.buildings.length
        ? player.buildings.map(b => `• ${BUILDINGS[b]?.name || b}`).join('\n')
        : '_нет_';
      const regionList = Object.keys(player.regions || {}).filter(id => player.regions[id]).map(id => REGIONS[id]?.name || id);
      const armySize = player.army.reduce((s, u) => s + (u.count || 1), 0);
      const focusName = player.activeFocus
        ? `${FOCUSES[player.activeFocus]?.emoji || ''} ${FOCUSES[player.activeFocus]?.name} (${player.focusTurnsLeft} х.)`
        : '_нет_';
      const comps = (player.companions || []).map(id => COMPANIONS[id]?.emoji + ' ' + (COMPANIONS[id]?.name || id)).join('\n') || '_нет_';

      const embed = factionEmbed(player)
        .setDescription(`Ход **${player.turn}** · ${GAME_NAME}`)
        .addFields(
          { name: '💰 Флорины', value: `**${player.florins}**`, inline: true },
          { name: '📈 Доход', value: `+${income}`, inline: true },
          { name: '📉 Содержание', value: `−${upkeep}`, inline: true },
          { name: '⚖️ Чистыми', value: net >= 0 ? `**+${net}**` : `**${net}**`, inline: true },
          { name: '🧠 Полит. власть', value: `**${player.politicalPower ?? 0}**`, inline: true },
          { name: '📊 Стабильность', value: `${player.stability ?? 60}`, inline: true },
          { name: '📣 Поддержка войны', value: `${player.warSupport ?? 50}`, inline: true },
          { name: '⚙️ Организация', value: `${player.organization ?? 100}%`, inline: true },
          { name: '🏰 Поселение', value: SETTLEMENT_LEVELS[player.settlementLevel]?.name || player.settlementLevel, inline: true },
          { name: '🎯 Фокус', value: focusName },
          { name: `🗺️ Регионы (${regionList.length})`, value: regionList.join(', ') || '_нет_' },
          { name: '🗡️ Компаньоны', value: comps, inline: true },
          { name: '🏗️ Здания', value: buildingsList, inline: true },
          { name: '⚔️ Армия', value: `**${armySize}** отрядов`, inline: true }
        );
      return replyEmbed(interaction, embed);
    }

    if (command === 'ruler') {
      const s = player.skills || {};
      const lines = Object.entries(SKILLS).map(([k, v]) => {
        const lvl = s[k] || 1;
        const bar = '▰'.repeat(lvl) + '▱'.repeat(Math.max(0, 10 - lvl));
        return `${v.emoji} **${v.name}** ${lvl}/10\n${bar}\n_${v.description}_`;
      });
      const embed = factionEmbed(player, '👑 Правитель')
        .setDescription(lines.join('\n\n'))
        .addFields(
          { name: '🧠 Полит. власть', value: `**${player.politicalPower ?? 0}**`, inline: true },
          { name: '📊 Стабильность', value: `${player.stability ?? 60}`, inline: true },
          { name: '📣 Поддержка войны', value: `${player.warSupport ?? 50}`, inline: true },
          { name: '⚙️ Организация', value: `${player.organization ?? 100}%`, inline: true }
        );
      return replyEmbed(interaction, embed);
    }

    if (command === 'focus') {
      const key = interaction.options.getString('name');
      const result = startFocus(player, key);
      if (!result.success) return replyEmbed(interaction, errorEmbed(result.message), { ephemeral: true });
      player = getPlayer(userId);
      const f = result.focus;
      const embed = baseEmbed(`${f.emoji} ${f.name}`, COLORS.focus)
        .setDescription(f.description)
        .addFields(
          { name: 'Стоимость', value: `${f.costPP} власти`, inline: true },
          { name: 'Длительность', value: f.duration ? `${f.duration} хода` : 'Мгновенно', inline: true },
          { name: 'Остаток власти', value: `${player.politicalPower}`, inline: true }
        )
        .setFooter({ text: GAME_NAME });
      return replyEmbed(interaction, embed);
    }

    if (command === 'companion') {
      const id = interaction.options.getString('name');
      const result = hireCompanion(player, id);
      if (!result.success) return replyEmbed(interaction, errorEmbed(result.message), { ephemeral: true });
      player = getPlayer(userId);
      const c = result.companion;
      const embed = successEmbed(`${c.emoji} ${c.name}`, c.description)
        .addFields(
          { name: 'Цена', value: `${c.cost}`, inline: true },
          { name: 'Содержание', value: `${c.upkeep}/ход`, inline: true },
          { name: 'В отряде', value: `${(player.companions || []).length}/3`, inline: true }
        )
        .setColor(FACTIONS[player.faction]?.color || COLORS.success);
      return replyEmbed(interaction, embed);
    }

    if (command === 'caravan') {
      const result = runCaravan(player);
      if (!result.success) return replyEmbed(interaction, errorEmbed(result.message), { ephemeral: true });
      player = getPlayer(userId);
      const embed = baseEmbed(
        result.survived ? '🐪 Караван вернулся' : '💀 Караван ограблен',
        result.survived ? COLORS.success : COLORS.danger
      )
        .setDescription(result.message)
        .addFields(
          { name: 'Вложено', value: `${result.invest}`, inline: true },
          { name: result.survived ? 'Прибыль' : 'Убыток', value: result.survived ? `+${result.profit}` : `${result.profit}`, inline: true },
          { name: 'Казна', value: `${player.florins}`, inline: true }
        )
        .setFooter({ text: `Кулдаун 2 хода • ${GAME_NAME}` });
      return replyEmbed(interaction, embed);
    }

    if (command === 'map') {
      await interaction.deferReply();
      try {
        if (!player.regions || !Object.keys(player.regions).length) {
          player.regions = startingRegions(player.faction);
          savePlayer(player);
        }
        const imgPath = await generateMapImage(player);
        const file = new AttachmentBuilder(imgPath, { name: 'world_map.png' });
        const regionList = Object.keys(player.regions).filter(id => player.regions[id]).map(id => REGIONS[id]?.name || id);
        const faction = FACTIONS[player.faction];
        const embed = factionEmbed(player, `🗺️ Карта — ${faction.name}`)
          .setDescription(regionList.length ? `**${regionList.join(' • ')}**` : 'Нет регионов.')
          .addFields(
            { name: 'Регионов', value: `${regionList.length}`, inline: true },
            { name: 'Ход', value: `${player.turn}`, inline: true },
            { name: 'Казна', value: `${player.florins}`, inline: true }
          )
          .setImage('attachment://world_map.png');
        await interaction.editReply({ embeds: [embed], files: [file] });
        setTimeout(() => fs.unlink(imgPath, () => {}), 60000);
      } catch (err) {
        console.error(err);
        await replyEmbed(interaction, errorEmbed('Карта не собралась. Нужны Python3 и Pillow (`pip install pillow`).'));
      }
      return;
    }

    if (command === 'army') {
      if (!player.army.length) {
        return replyEmbed(interaction, infoEmbed('⚔️ Армия пуста', 'Нанимай через `/recruit`.'), { ephemeral: true });
      }
      const total = player.army.reduce((s, u) => s + (u.count || 1), 0);
      const lead = player.skills?.leadership || 1;
      const maxArmy = 16 + lead * 2;
      const lines = player.army.map((u, i) => {
        const def = UNIT_TYPES[u.unit];
        const exp = u.experience ? ` ★${u.experience}` : '';
        const icon = def?.type === 'cavalry' ? '🐴' : def?.type === 'missile' ? '🏹' : '🛡️';
        return (
          `**${i + 1}.** ${icon} **${def?.name || u.unit}** ×${u.count || 1}${exp}\n` +
          '  АТК `' + (def?.attack ?? '?') + '` ЗАЩ `' + (def?.defense ?? '?') + '`' +
          (def?.promotesTo && (u.experience || 0) >= 4 ? ' · _готов к повышению_' : '')
        );
      });
      const embed = factionEmbed(player, '⚔️ Армия')
        .setDescription(lines.join('\n\n'))
        .addFields(
          { name: 'Численность', value: `**${total}** / ${maxArmy}`, inline: true },
          { name: 'Содержание', value: `**${calculateUpkeep(player)}**/ход`, inline: true },
          { name: '⚙️ Организация', value: `**${player.organization ?? 100}%**`, inline: true }
        );
      return replyEmbed(interaction, embed);
    }

    if (command === 'recruit') {
      const unitKey = interaction.options.getString('unit');
      const amount = interaction.options.getInteger('amount') || 1;
      const unitDef = UNIT_TYPES[unitKey];
      const result = recruitUnit(player, unitKey, amount);
      if (!result.success) return replyEmbed(interaction, errorEmbed(result.message), { ephemeral: true });
      player = getPlayer(userId);
      const embed = successEmbed('🎖️ Найм', `**${amount}× ${unitDef?.name || unitKey}** в строю.`)
        .addFields(
          { name: 'Потрачено', value: `${(unitDef?.cost || 0) * amount}`, inline: true },
          { name: 'Казна', value: `${player.florins}`, inline: true }
        );
      return replyEmbed(interaction, embed);
    }

    if (command === 'build') {
      const buildingKey = interaction.options.getString('building');
      const building = BUILDINGS[buildingKey];
      const result = buildBuilding(player, buildingKey);
      if (!result.success) return replyEmbed(interaction, errorEmbed(result.message), { ephemeral: true });
      player = getPlayer(userId);
      const embed = successEmbed('🏗️ Построено', `**${building?.name || buildingKey}**`)
        .addFields(
          { name: 'Цена', value: `${building?.cost ?? '?'}`, inline: true },
          { name: 'Казна', value: `${player.florins}`, inline: true }
        );
      return replyEmbed(interaction, embed);
    }

    if (command === 'battle') {
      if (!player.army.length) {
        return replyEmbed(interaction, errorEmbed('Нет армии. `/recruit`.'), { ephemeral: true });
      }
      const result = resolveBattle(player);
      player = getPlayer(userId);

      const embed = baseEmbed(
        result.victory ? '🏆 Победа!' : '💀 Поражение',
        result.victory ? COLORS.success : COLORS.danger
      )
        .setDescription(result.victory ? 'Враг разбит. Ветераны закаляются.' : 'Отступление. Организация и мораль просели.')
        .addFields(
          { name: '⚔️ Сила', value: `**${result.playerPower}** (бросок ${result.playerRoll})`, inline: true },
          { name: '☠️ Враг', value: `**${result.enemyPower}** (бросок ${result.enemyRoll})`, inline: true },
          { name: '🩸 Потери', value: `~${Math.round(result.casualtiesPercent * 100)}%`, inline: true },
          { name: '⚙️ Организация', value: `−${result.orgLoss} → **${player.organization}%**`, inline: true },
          { name: '📋 Состав', value: result.details.slice(0, 6).join('\n') || '—' }
        );

      if (result.victory) {
        embed.addFields({ name: '💰 Трофеи', value: `+${result.loot}`, inline: true });
        if (result.conquered) {
          const name = REGIONS[result.conquered]?.name || result.conquered;
          embed.addFields({ name: '🗺️ Регион', value: `Захвачен **${name}**`, inline: true });
        }
        if (result.promoted?.length) {
          embed.addFields({ name: '⬆️ Повышение', value: result.promoted.join('\n') });
        }
      }
      embed.setFooter({ text: `${FACTIONS[player.faction]?.name} • Поддержка войны ${player.warSupport} • ${GAME_NAME}` });
      return replyEmbed(interaction, embed);
    }

    if (command === 'endturn') {
      const prev = player.turn;
      const { income, upkeep, growth, ppGain, leveled } = endTurn(player);
      player = getPlayer(userId);
      const net = income - upkeep;
      const embed = factionEmbed(player, `⏳ Ход ${prev} завершён`)
        .setDescription('Сезон пройден. Империя дышит.')
        .addFields(
          { name: '📈 Доход', value: `+${income}`, inline: true },
          { name: '📉 Содержание', value: `−${upkeep}`, inline: true },
          { name: '⚖️ Итого', value: net >= 0 ? `+${net}` : `${net}`, inline: true },
          { name: '🧠 +Власть', value: `+${ppGain} → **${player.politicalPower}**`, inline: true },
          { name: '⚙️ Организация', value: `${player.organization}%`, inline: true },
          { name: '👥 Население', value: `${player.population} (+${growth})`, inline: true },
          {
            name: '🎯 Фокус',
            value: player.activeFocus ? `${FOCUSES[player.activeFocus]?.name} (${player.focusTurnsLeft} х.)` : '—',
            inline: true
          },
          { name: '➡️ Ход', value: `**${player.turn}**`, inline: true }
        );
      if (leveled?.length) {
        embed.addFields({ name: '⬆️ Навык вырос', value: leveled.map(s => SKILLS[s]?.name || s).join(', ') });
      }
      return replyEmbed(interaction, embed);
    }

    if (command === 'reset') {
      const embed = baseEmbed('⚠️ Сброс', COLORS.warn)
        .setDescription('Удалить кампанию целиком?')
        .setFooter({ text: '15 секунд' });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_reset').setLabel('Сбросить').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancel_reset').setLabel('Отмена').setStyle(ButtonStyle.Secondary)
      );
      const reply = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      const collector = reply.createMessageComponentCollector({ time: 15000, filter: i => i.user.id === userId });
      collector.on('collect', async i => {
        if (i.customId === 'confirm_reset') {
          deletePlayer(userId);
          await i.update({ embeds: [successEmbed('🗑️ Сброшено', 'Начни заново: `/start`.')], components: [] });
        } else {
          await i.update({ embeds: [infoEmbed('Отмена', 'Империя цела.')], components: [] });
        }
      });
      collector.on('end', async c => {
        if (!c.size) {
          await interaction.editReply({ embeds: [infoEmbed('⌛ Время вышло', 'Сброс не подтверждён.')], components: [] }).catch(() => {});
        }
      });
    }
  } catch (err) {
    console.error(err);
    const embed = errorEmbed('Внутренняя ошибка. Попробуй ещё раз.');
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
