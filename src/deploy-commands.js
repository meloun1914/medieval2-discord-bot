require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Iron Crown — начать кампанию, выбрать фракцию')
    .addStringOption(opt =>
      opt.setName('faction')
        .setDescription('Фракция')
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
    .setDescription('Статус империи: казна, PP, stability, org, навыки'),

  new SlashCommandBuilder()
    .setName('recruit')
    .setDescription('Нанять юнитов')
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
        .setDescription('Количество')
        .setMinValue(1)
        .setMaxValue(5)
    ),

  new SlashCommandBuilder()
    .setName('build')
    .setDescription('Построить здание')
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
    .setDescription('Бой: сила, org, промоут ветеранов, захват региона'),

  new SlashCommandBuilder()
    .setName('map')
    .setDescription('Карта мира (Pillow)'),

  new SlashCommandBuilder()
    .setName('endturn')
    .setDescription('Завершить ход: доход, PP, org, фокусы'),

  new SlashCommandBuilder()
    .setName('army')
    .setDescription('Состав армии и организация'),

  new SlashCommandBuilder()
    .setName('focus')
    .setDescription('HOI4: национальный фокус за Political Power')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Фокус')
        .setRequired(true)
        .addChoices(
          { name: 'Industrial Effort', value: 'industrial_effort' },
          { name: 'Military Reform', value: 'military_reform' },
          { name: 'War Propaganda', value: 'war_propaganda' },
          { name: 'Grand Army', value: 'grand_army' },
          { name: 'Diplomatic Corps', value: 'diplomatic_corps' },
          { name: 'Total Mobilization', value: 'total_mobilization' }
        )
    ),

  new SlashCommandBuilder()
    .setName('companion')
    .setDescription('Mount & Blade: нанять компаньона')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Компаньон')
        .setRequired(true)
        .addChoices(
          { name: 'Sergius the Steward', value: 'sergius' },
          { name: 'Brynhild Iron-Arm', value: 'brynhild' },
          { name: 'Omar the Caravaner', value: 'omar' },
          { name: 'Father Alric', value: 'father_alric' },
          { name: 'Liao the Scout', value: 'liao' }
        )
    ),

  new SlashCommandBuilder()
    .setName('caravan')
    .setDescription('Mount & Blade: отправить торговый караван'),

  new SlashCommandBuilder()
    .setName('ruler')
    .setDescription('Навыки правителя, PP, stability, war support'),

  new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Сообщение от лица участника (webhook)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('От кого').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('message').setDescription('Текст').setRequired(true).setMaxLength(2000)
    ),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Справка по Iron Crown'),

  new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Сбросить кампанию')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Deploying Iron Crown slash commands...');
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log('Deployed to guild', process.env.GUILD_ID);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log('Deployed global commands.');
    }
  } catch (error) {
    console.error(error);
  }
})();
