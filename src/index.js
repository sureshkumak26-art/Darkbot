require('dotenv').config();
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits, ChannelType, EmbedBuilder
} = require('discord.js');

const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = [
  new SlashCommandBuilder().setName('setup').setDescription('Create the Dark Market server structure').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('panel').setDescription('Show the Dark Market customer panel'),
  new SlashCommandBuilder().setName('ticket').setDescription('Open a private support ticket'),
  new SlashCommandBuilder().setName('ping').setDescription('Check bot latency')
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
}

async function getOrCreateRole(guild, name, color) {
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) role = await guild.roles.create({ name, color, reason: 'Dark Market setup' });
  return role;
}

async function getOrCreateCategory(guild, name, permissionOverwrites = []) {
  let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
  if (!category) category = await guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites });
  return category;
}

async function getOrCreateChannel(guild, name, parent, type = ChannelType.GuildText) {
  let channel = guild.channels.cache.find(c => c.name === name && c.parentId === parent.id);
  if (!channel) channel = await guild.channels.create({ name, type, parent: parent.id });
  return channel;
}

async function setupGuild(guild) {
  const staff = await getOrCreateRole(guild, '🛡️ Staff', 0x8b5cf6);
  await getOrCreateRole(guild, '💳 Verified Customer', 0x22c55e);
  await getOrCreateRole(guild, '🤝 Partner', 0xf59e0b);
  await getOrCreateRole(guild, '🤖 Dark Market Bot', 0x111827);

  const info = await getOrCreateCategory(guild, '📌 INFORMATION');
  for (const name of ['welcome', 'rules', 'announcements', 'faq']) await getOrCreateChannel(guild, name, info);

  const store = await getOrCreateCategory(guild, '🛒 STORE');
  for (const name of ['products', 'prices', 'order-here', 'payment-methods']) await getOrCreateChannel(guild, name, store);

  const support = await getOrCreateCategory(guild, '🎫 SUPPORT');
  for (const name of ['create-ticket', 'customer-support', 'reviews']) await getOrCreateChannel(guild, name, support);

  const staffCategory = await getOrCreateCategory(guild, '🔒 STAFF ONLY', [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: staff.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
  ]);
  for (const name of ['staff-chat', 'order-logs', 'payment-logs', 'admin-panel']) await getOrCreateChannel(guild, name, staffCategory);
  return staff;
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  console.log('Slash commands registered.');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'ping') return interaction.reply({ content: `🏓 Pong: ${client.ws.ping}ms`, ephemeral: true });
  if (interaction.commandName === 'setup') {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    await setupGuild(interaction.guild);
    return interaction.editReply('✅ Dark Market categories, channels, and roles have been configured.');
  }
  if (interaction.commandName === 'panel') {
    const embed = new EmbedBuilder().setColor(0x8b5cf6).setTitle('🖤 DARK MARKET').setDescription('Premium digital goods marketplace\n\nUse `/ticket` for support. Only verified orders are fulfilled.').addFields({ name: 'Available commands', value: '`/ticket` • `/ping`' });
    return interaction.reply({ embeds: [embed] });
  }
  if (interaction.commandName === 'ticket') {
    const channel = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}`.toLowerCase().slice(0, 90), type: ChannelType.GuildText, parent: process.env.TICKET_CATEGORY_ID || undefined, permissionOverwrites: [{ id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] });
    await channel.send(`🎫 Welcome ${interaction.user}. Please describe your request. A staff member will assist you.`);
    return interaction.reply({ content: `✅ Your ticket is ready: ${channel}`, ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
