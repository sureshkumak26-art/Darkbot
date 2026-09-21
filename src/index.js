require('dotenv').config();
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle
} = require('discord.js');

const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const CLEANUP_DELAY_MS = Number(process.env.TICKET_CLEANUP_DELAY_MS || 86400000);
const names = {
  info: '📌・degise-information',
  store: '🛒・degise-store',
  support: '🎫・degise-support',
  staff: '🔒・degise-staff'
};

const commands = [
  new SlashCommandBuilder().setName('setup').setDescription('Create Dark Market channels and roles').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('panel').setDescription('Post the ticket and order panel'),
  new SlashCommandBuilder().setName('ticket').setDescription('Open a private support ticket'),
  new SlashCommandBuilder().setName('order').setDescription('Open an order ticket'),
  new SlashCommandBuilder().setName('restock').setDescription('Announce a restock').addStringOption(o => o.setName('product').setDescription('Product name').setRequired(true)),
  new SlashCommandBuilder().setName('payment').setDescription('Show payment instructions'),
  new SlashCommandBuilder().setName('close').setDescription('Close the current ticket'),
  new SlashCommandBuilder().setName('ping').setDescription('Check bot latency')
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
}

async function role(guild, name, color) {
  return guild.roles.cache.find(r => r.name === name) || guild.roles.create({ name, color, reason: 'Dark Market setup' });
}
async function category(guild, name, overwrites = []) {
  return guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name) || guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
}
async function channel(guild, name, parent, overwrites = []) {
  return guild.channels.cache.find(c => c.name === name && c.parentId === parent.id) || guild.channels.create({ name, type: ChannelType.GuildText, parent: parent.id, permissionOverwrites: overwrites });
}

async function setupGuild(guild) {
  const staff = await role(guild, '🛡️・degise-staff', 0x8b5cf6);
  await role(guild, '💳・verified-customer', 0x22c55e);
  await role(guild, '🤝・partner', 0xf59e0b);
  await role(guild, '🤖・dark-market-bot', 0x111827);
  const everyone = guild.roles.everyone.id;
  const staffOnly = [{ id: everyone, deny: [PermissionFlagsBits.ViewChannel] }, { id: staff.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }];

  const info = await category(guild, names.info);
  for (const n of ['👋・welcome', '📜・rules', '📢・announcements', '❓・faq']) await channel(guild, n, info);
  const store = await category(guild, names.store);
  for (const n of ['🛍️・products', '💰・prices', '🧾・order-here', '💳・payment-methods', '📦・restocks']) await channel(guild, n, store);
  const support = await category(guild, names.support);
  for (const n of ['🎫・ticket-panel', '🛒・order-support', '💸・payment-support', '⭐・reviews']) await channel(guild, n, support);
  const secure = await category(guild, names.staff, staffOnly);
  for (const n of ['💬・staff-chat', '🧾・order-logs', '💳・payment-logs', '📦・restock-logs']) await channel(guild, n, secure, staffOnly);
  return { staff, support };
}

function panelEmbed() {
  return new EmbedBuilder().setColor(0x8b5cf6).setTitle('🖤・DEGISE DARK MARKET').setDescription('Premium digital goods marketplace\n\nChoose an option below to contact our team.').addFields(
    { name: '🛒 Order', value: 'Open an order ticket.' },
    { name: '🎫 Support', value: 'Get help from staff.' },
    { name: '💳 Payment', value: 'View payment instructions.' }
  ).setFooter({ text: 'Only authorized and legitimate products are supported.' });
}

async function createTicket(interaction, type) {
  const guild = interaction.guild;
  const staff = guild.roles.cache.find(r => r.name === '🛡️・degise-staff');
  const categoryId = process.env.TICKET_CATEGORY_ID || guild.channels.cache.find(c => c.name === names.support)?.id;
  const existing = guild.channels.cache.find(c => c.name === `${type}-${interaction.user.id}`);
  if (existing) return interaction.reply({ content: `You already have a ticket: ${existing}`, ephemeral: true });
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
  ];
  if (staff) overwrites.push({ id: staff.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  const ticket = await guild.channels.create({ name: `${type}-${interaction.user.id}`, type: ChannelType.GuildText, parent: categoryId || undefined, permissionOverwrites: overwrites });
  const close = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger));
  await ticket.send({ embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle(`🎫 ${type.toUpperCase()} TICKET`).setDescription(`Welcome ${interaction.user}. Please provide the required details. A staff member will assist you.`)], components: [close] });
  return interaction.reply({ content: `✅ Your ticket is ready: ${ticket}`, ephemeral: true });
}

client.once('ready', async () => { console.log(`Logged in as ${client.user.tag}`); await registerCommands(); console.log('Commands registered.'); });

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === 'close_ticket') {
        if (!interaction.channel.name.startsWith('ticket-') && !interaction.channel.name.startsWith('order-')) return interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
        await interaction.reply('🔒 Ticket closed. This channel will be deleted automatically in 24 hours.');
        await interaction.channel.setName(`closed-${interaction.channel.name}`).catch(() => {});
        setTimeout(() => interaction.channel.delete('Automatic old ticket cleanup').catch(() => {}), CLEANUP_DELAY_MS);
      }
      if (interaction.customId === 'open_order') return createTicket(interaction, 'order');
      if (interaction.customId === 'open_support') return createTicket(interaction, 'ticket');
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'ping') return interaction.reply({ content: `🏓 Pong: ${client.ws.ping}ms`, ephemeral: true });
    if (interaction.commandName === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      await setupGuild(interaction.guild);
      return interaction.editReply('✅ Degise-themed categories, channels, and roles created.');
    }
    if (interaction.commandName === 'panel') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_order').setLabel('🛒 Order').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('open_support').setLabel('🎫 Support').setStyle(ButtonStyle.Secondary)
      );
      return interaction.reply({ embeds: [panelEmbed()], components: [row] });
    }
    if (interaction.commandName === 'ticket') return createTicket(interaction, 'ticket');
    if (interaction.commandName === 'order') return createTicket(interaction, 'order');
    if (interaction.commandName === 'payment') return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('💳 Payment Methods').setDescription(process.env.PAYMENT_INSTRUCTIONS || 'Contact staff through a payment ticket for verified payment instructions.\nNever share payment credentials publicly.')], ephemeral: true });
    if (interaction.commandName === 'restock') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Manage Server permission required.', ephemeral: true });
      const product = interaction.options.getString('product');
      const target = interaction.guild.channels.cache.find(c => c.name === '📦・restocks');
      const message = `📦 **RESTOCK ALERT**\n\n🛍️ Product: **${product}**\n✅ Status: Available\n🎫 Open a ticket to order.`;
      if (target) await target.send(message);
      return interaction.reply({ content: '✅ Restock announcement sent.', ephemeral: true });
    }
    if (interaction.commandName === 'close') {
      if (!interaction.channel.name.startsWith('ticket-') && !interaction.channel.name.startsWith('order-')) return interaction.reply({ content: 'Use this command inside a ticket.', ephemeral: true });
      await interaction.reply('🔒 Ticket closed. Automatic deletion scheduled.');
      await interaction.channel.setName(`closed-${interaction.channel.name}`).catch(() => {});
      setTimeout(() => interaction.channel.delete('Automatic old ticket cleanup').catch(() => {}), CLEANUP_DELAY_MS);
    }
  } catch (error) { console.error(error); if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {}); }
});

client.login(process.env.DISCORD_TOKEN);
