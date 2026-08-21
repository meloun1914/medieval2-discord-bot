require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Начать кампанию Medieval II — выбрать фракцию')
    .addStringOption(opt =>
      opt.setName('faction')
        .setDescription('Выбери фракцию')
        .setRequired(true)
        .addChoices(
          { name: 'England 🏴󠁧󠁢󠁥󠁮󠁧󠁿', value: 'england' },
          { name: 'France 🇫🇷', value: 'france' },
          { name: 'Holy Roman Empire 🦅', value: 'hre' },
          { name: 'Venice 🦁', value: 'venice' },
          { name: 'Byzantine Empire 🦅', value: 'byzantium' },
          { name: 'Russia 🐻', value: 'russia' },
          { name: 'Moors 🌙', value: 'moors' },
          { name: 'Egypt 🏺', value: 'egypt' }
        )
    ),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Показать статус твоей кампании (флорины, армия, поселение)'),

  new SlashCommandBuilder()
    .setName('recruit')
    .setDescription('Нанять юнитов в армию')
    .addStringOption(opt =>
      opt.setName('unit')
        .setDescription('Тип юнита')
        .setRequired(true)
        .addChoices(
          { name: 'Spear Militia', value: 'spear_militia' },
          { name: 'Peasant Archers', value: 'peasant_archers' },
          { name: 'Spearmen', value: 'spearmen' },
          { name: 'Feudal Knights', value: 'feudal_knights' },
          { name: 'Dismounted Feudal Knights', value: 'dismounted_feudal_knights' },
          { name: 'Longbowmen', value: 'longbowmen' },
          { name: 'Chivalric Knights', value: 'chivalric_knights' },
          { name: 'Boyar Sons', value: 'boyar_sons' },
          { name: 'Mamluks', value: 'mamluks' },
          { name: 'Cataphracts', value: 'cataphracts' }
        )
    )
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Количество (по умолчанию 1)')
        .setMinValue(1)
        .setMaxValue(5)
    ),

  new SlashCommandBuilder()
    .setName('build')
    .setDescription('Построить здание в поселении')
    .addStringOption(opt =>
      opt.setName('building')
        .setDescription('Здание')
        .setRequired(true)
        .addChoices(
          { name: 'Farms', value: 'farms' },
          { name: 'Market', value: 'market' },
          { name: 'Barracks', value: 'barracks' },
          { name: 'Stables', value: 'stables' },
          { name: 'Archery Range', value: 'archery_range' },
          { name: 'Blacksmith', value: 'blacksmith' }
        )
    ),

  new SlashCommandBuilder()
    .setName('battle')
    .setDescription('Сразиться с вражеской армией (симуляция)'),

  new SlashCommandBuilder()
    .setName('endturn')
    .setDescription('Завершить ход: получить доход, рост населения, upkeep'),

  new SlashCommandBuilder()
    .setName('army')
    .setDescription('Подробный состав твоей армии'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Справка по командам и механикам бота'),

  new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Сбросить свою кампанию (осторожно!)')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Deploying slash commands...');

    if (process.env.GUILD_ID) {
      // Instant deploy to one guild (for testing)
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log('Successfully deployed to guild', process.env.GUILD_ID);
    } else {
      // Global commands (can take up to 1 hour)
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log('Successfully deployed global commands.');
    }
  } catch (error) {
    console.error(error);
  }
})();
