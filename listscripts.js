const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { getActiveBots } = require('../utils/botManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listscripts')
        .setDescription('Affiche les scripts disponibles et les bots actifs'),

    async execute(interaction) {
        const customScripts = db.getScripts();
        const builtIn = ['commu', 'ticket', 'moderation'];
        const customNames = Object.keys(customScripts);
        const activeBots = getActiveBots();

        const embed = new EmbedBuilder()
            .setColor(0x7289da)
            .setTitle('📜 Scripts & Bots Actifs')
            .addFields(
                { name: '🔧 Scripts intégrés', value: builtIn.map(s => `\`${s}\``).join(', ') || 'Aucun', inline: false },
                { name: '📝 Scripts personnalisés', value: customNames.length > 0 ? customNames.map(s => `\`${s}\``).join(', ') : 'Aucun script personnalisé', inline: false },
                {
                    name: `🤖 Bots actifs (${activeBots.length})`,
                    value: activeBots.length > 0
                        ? activeBots.map(b => `• **${b.botTag}** — script: \`${b.scriptName}\``).join('\n')
                        : 'Aucun bot actif',
                    inline: false
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
