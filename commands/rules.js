const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Envoie le règlement avec un bouton d\'acceptation')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Le message à afficher dans l\'embed')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('roles')
                .setDescription('IDs ou mentions de rôles à attribuer (séparés par des virgules)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const message = interaction.options.getString('message');
        const rolesInput = interaction.options.getString('roles');

        // Extract role IDs from mentions (<@&ID>) or raw IDs
        const roleIds = rolesInput
            .split(',')
            .map(r => r.trim().replace(/^<@&(\d+)>$/, '$1'))
            .filter(r => /^\d+$/.test(r));

        if (roleIds.length === 0) {
            return interaction.reply({
                content: '❌ Aucun rôle valide trouvé. Fournis des IDs ou des mentions de rôles séparés par des virgules.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(message);

        const button = new ButtonBuilder()
            .setCustomId(`accept_rules:${roleIds.join(',')}`)
            .setLabel('✅ Accepter le règlement')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({ content: '✅ Règlement envoyé.', ephemeral: true });
        await interaction.channel.send({ embeds: [embed], components: [row] });
    }
};
