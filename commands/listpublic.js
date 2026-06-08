const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listpublic')
        .setDescription('Liste tous les scripts disponibles'),

    async execute(interaction) {
        const db = require('../utils/database');

        const scripts = db.listScripts();

        if (!scripts || scripts.length === 0) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle('📜 Scripts disponibles')
                        .setDescription('❌ Aucun script disponible pour le moment.\n\nDemandez à un administrateur d\'en ajouter avec `/addscript`.')
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }

        const scriptList = scripts
            .map((name, i) => `\`${i + 1}.\` **${name}**`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('📜 Scripts disponibles')
            .setDescription(
                `Voici tous les scripts que vous pouvez utiliser avec le panneau :\n\n${scriptList}\n\n` +
                '> Utilisez `/panel` (Admin) pour démarrer un bot avec l\'un de ces scripts.'
            )
            .setFooter({ text: `${scripts.length} script(s) disponible(s)` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};

