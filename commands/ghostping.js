const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ghostping')
        .setDescription('Configure le ghostping sur un salon')
        .addChannelOption(option =>
            option.setName('salon')
                .setDescription('Le salon où faire les ghostpings')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const db = require('../utils/database');
        const channel = interaction.options.getChannel('salon');

        if (!channel.isTextBased()) {
            return interaction.reply({
                content: '❌ Le salon doit être un salon textuel.',
                ephemeral: true
            });
        }

        // Sauvegarder le salon de ghostping
        db.setGhostpingChannel(interaction.guildId, channel.id);

        await interaction.reply({
            content: `✅ Ghostping configuré sur ${channel}. À chaque fois qu'un membre rejoint, il sera pingé et le message sera supprimé.`,
            ephemeral: true
        });
    },
};

