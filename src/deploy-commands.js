require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Начать кампанию Scripta Belli и выбрать фракцию')
    .addStringOption(opt =>
      opt.setName('faction').setDescription('Фракция').setRequired(true)
        .addChoices(
          { name: 'Англия 🏴󠁧󠁢󠁥󠁮󠁧󠁿', value: 'england' },
          { name: 'Франция 🇫🇷', value: 'france' },
          { name: 'Священная Римская империя 🦅', value: 'hre' },
          { name: 'Венеция 🦁', value: 'venice' },
          { name: 'Византия 🦅', value: 'byzantium' },
          { name: 'Русь 🐻', value: 'russia' },
          { name: 'Мавры 🌙', value: 'moors' },
          { name: 'Египет 🏺', value: 'egypt' }
        )
    ),
  new SlashCommandBuilder().setName('status').setDescription('Статус империи: казна, власть, стабильность, организация'),
  new SlashCommandBuilder()
    .setName('recruit').setDescription('Нанять юнитов в армию')
    .addStringOption(opt =>
      opt.setName('unit').setDescription('Тип юнита').setRequired(true)
        .addChoices(
          { name: 'Копейная милиция', value: 'spear_militia' },
          { name: 'Крестьянские лучники', value: 'peasant_archers' },
          { name: 'Копейщики', value: 'spearmen' },
          { name: 'Феодальные рыцари', value: 'feudal_knights' },
          { name: 'Спешенные феодальные рыцари', value: 'dismounted_feudal_knights' },
          { name: 'Лучники с длинным луком', value: 'longbowmen' },
          { name: 'Рыцари-chevaliers', value: 'chivalric_knights' },
          { name: 'Сыны боярские', value: 'boyar_sons' },
          { name: 'Мамлюки', value: 'mamluks' },
          { name: 'Катафракты', value: 'cataphracts' }
        )
    )
    .addIntegerOption(opt => opt.setName('amount').setDescription('Количество').setMinValue(1).setMaxValue(5)),
  new SlashCommandBuilder()
    .setName('build').setDescription('Построить здание')
    .addStringOption(opt =>
      opt.setName('building').setDescription('Здание').setRequired(true)
        .addChoices(
          { name: 'Фермы', value: 'farms' },
          { name: 'Рынок', value: 'market' },
          { name: 'Казармы', value: 'barracks' },
          { name: 'Конюшни', value: 'stables' },
          { name: 'Стрельбище', value: 'archery_range' },
          { name: 'Кузница', value: 'blacksmith' }
        )
    ),
  new SlashCommandBuilder().setName('battle').setDescription('Сражение: сила, организация, повышение ветеранов, захват региона'),
  new SlashCommandBuilder().setName('map').setDescription('Карта мира'),
  new SlashCommandBuilder().setName('endturn').setDescription('Завершить ход: доход, полит. власть, организация, фокусы'),
  new SlashCommandBuilder().setName('army').setDescription('Состав армии и организация'),
  new SlashCommandBuilder()
    .setName('focus').setDescription('Национальный фокус за политическую власть')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Фокус').setRequired(true)
        .addChoices(
          { name: 'Промышленный рывок', value: 'industrial_effort' },
          { name: 'Военная реформа', value: 'military_reform' },
          { name: 'Военная пропаганда', value: 'war_propaganda' },
          { name: 'Великая армия', value: 'grand_army' },
          { name: 'Дипломатический корпус', value: 'diplomatic_corps' },
          { name: 'Тотальная мобилизация', value: 'total_mobilization' }
        )
    ),
  new SlashCommandBuilder()
    .setName('companion').setDescription('Нанять компаньона в отряд')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Компаньон').setRequired(true)
        .addChoices(
          { name: 'Сергий Казначей', value: 'sergius' },
          { name: 'Брюнхильд Железная Рука', value: 'brynhild' },
          { name: 'Омар Караванщик', value: 'omar' },
          { name: 'Отец Альрик', value: 'father_alric' },
          { name: 'Ляо Разведчик', value: 'liao' }
        )
    ),
  new SlashCommandBuilder().setName('caravan').setDescription('Отправить торговый караван'),
  new SlashCommandBuilder().setName('ruler').setDescription('Навыки правителя, власть, стабильность, поддержка войны'),
  new SlashCommandBuilder()
    .setName('echo').setDescription('Написать сообщение от лица участника')
    .addUserOption(opt => opt.setName('user').setDescription('От кого').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Текст').setRequired(true).setMaxLength(2000)),
  new SlashCommandBuilder().setName('help').setDescription('Справка по Scripta Belli'),
  new SlashCommandBuilder().setName('reset').setDescription('Сбросить кампанию')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Деплой команд Scripta Belli...');
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log('Задеплоено на сервер', process.env.GUILD_ID);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log('Глобальные команды задеплоены.');
    }
  } catch (error) {
    console.error(error);
  }
})();
