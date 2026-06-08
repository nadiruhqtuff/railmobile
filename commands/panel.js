const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Ouvre le panneau de gestion des bots (Admin uniquement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🤖 Panneau de gestion des bots')
            .setDescription(
                'Bienvenue dans le panneau de gestion.\n\n' +
                'Cliquez sur **"Add your bot"** pour mettre un bot en ligne avec un script existant.\n\n' +
                '> Utilisez `/listpublic` pour voir les scripts disponibles.'
            )
            .setFooter({ text: 'Le bot restera en ligne pendant 24 heures.' })
            .setTimestamp();

        const button = new ButtonBuilder()
            .setCustomId('panel:add_bot')
            .setLabel('Add your bot')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🚀');

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};
