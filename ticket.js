const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType } = require('discord.js');

const PREFIX = '?';
const openTickets = new Map();

function setup(client) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'open_ticket') {
            const guild = interaction.guild;
            const user = interaction.user;
            const ticketKey = `${guild.id}-${user.id}`;

            if (openTickets.has(ticketKey)) {
                return interaction.reply({ content: '❌ Vous avez déjà un ticket ouvert !', ephemeral: true });
            }

            try {
                const category = guild.channels.cache.find(c => c.name === 'Tickets' && c.type === ChannelType.GuildCategory);
                const channel = await guild.channels.create({
                    name: `ticket-${user.username}`,
                    type: ChannelType.GuildText,
                    parent: category?.id,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    ]
                });
                openTickets.set(ticketKey, channel.id);

                const embed = new EmbedBuilder()
                    .setColor(0x00b0f4)
                    .setTitle('🎫 Ticket Ouvert')
                    .setDescription(`Bonjour ${user}, un membre du staff va vous répondre rapidement !`)
                    .setTimestamp();

                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer le ticket').setStyle(ButtonStyle.Danger)
                );

                await channel.send({ content: `${user}`, embeds: [embed], components: [closeRow] });
                await interaction.reply({ content: `✅ Ticket créé : ${channel}`, ephemeral: true });
            } catch (err) {
                interaction.reply({ content: '❌ Erreur lors de la création du ticket.', ephemeral: true });
            }
        }

        if (interaction.customId === 'close_ticket') {
            const channel = interaction.channel;
            if (!channel.name.startsWith('ticket-')) return;
            const userId = [...openTickets.entries()].find(([, id]) => id === channel.id)?.[0]?.split('-')[1];
            if (userId) {
                const keys = [...openTickets.keys()].filter(k => k.endsWith(`-${userId}`));
                keys.forEach(k => openTickets.delete(k));
            }
            await interaction.reply('🔒 Ticket en cours de fermeture...');
            setTimeout(() => channel.delete().catch(() => {}), 3000);
        }
    });
}

function handleMessage(message) {
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'ticket') {
        if (!message.member?.permissions.has('ManageChannels')) {
            return message.reply('❌ Permission refusée. (ManageChannels requis)');
        }
        const embed = new EmbedBuilder()
            .setColor(0x00b0f4)
            .setTitle('🎫 Support - Ouvrir un Ticket')
            .setDescription('Cliquez sur le bouton ci-dessous pour ouvrir un ticket.\nUn membre du staff vous répondra dès que possible !')
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_ticket').setLabel('📩 Ouvrir un ticket').setStyle(ButtonStyle.Primary)
        );
        message.channel.send({ embeds: [embed], components: [row] });
        message.delete().catch(() => {});
    }

    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setColor(0x00b0f4)
            .setTitle('📖 Commandes - Script Ticket')
            .addFields(
                { name: '?ticket', value: 'Envoie le panel de tickets (nécessite ManageChannels)', inline: false }
            )
            .setTimestamp();
        message.channel.send({ embeds: [embed] });
    }
}

module.exports = { setup, handleMessage };
