const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removescript')
        .setDescription('Supprime un script personnalisé')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Nom du script à supprimer')
                .setRequired(true)),

    async execute(interaction) {
        if (!interaction.member?.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ Seuls les administrateurs peuvent supprimer des scripts.', ephemeral: true });
        }

        const name = interaction.options.getString('name').toLowerCase();
        const reserved = ['commu', 'ticket', 'moderation'];
        if (reserved.includes(name)) {
            return interaction.reply({ content: `❌ \`${name}\` est un script réservé et ne peut pas être supprimé.`, ephemeral: true });
        }

        const script = db.getScript(name);
        if (!script) {
            return interaction.reply({ content: `❌ Script \`${name}\` introuvable.`, ephemeral: true });
        }

        db.deleteScript(name);
        await interaction.reply({ content: `✅ Script \`${name}\` supprimé avec succès.`, ephemeral: true });
    }
};
