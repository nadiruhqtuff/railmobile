const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { logAddScript } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addscript')
        .setDescription('Ajoute un nouveau script personnalisé')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Nom du script')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('script')
                .setDescription('Code JavaScript du script (doit contenir une fonction handleMessage)')
                .setRequired(true)),

    async execute(interaction, mainClient) {
        if (!interaction.member?.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ Seuls les administrateurs peuvent ajouter des scripts.', ephemeral: true });
        }

        const name = interaction.options.getString('name').toLowerCase();
        const code = interaction.options.getString('script');

        const reserved = ['commu', 'ticket', 'moderation'];
        if (reserved.includes(name)) {
            return interaction.reply({ content: `❌ \`${name}\` est un script réservé et ne peut pas être remplacé.`, ephemeral: true });
        }

        try {
            new Function('message', code);
        } catch (err) {
            return interaction.reply({ content: `❌ Erreur de syntaxe dans le script : ${err.message}`, ephemeral: true });
        }

        db.saveScript(name, code);

        logAddScript(mainClient, interaction.guildId, {
            scriptName: name,
            executedBy: `${interaction.user.tag} (${interaction.user.id})`
        });

        await interaction.reply({ content: `✅ Script \`${name}\` ajouté avec succès ! Utilisez \`/addscriptbot script:${name} token:...\` pour le déployer.`, ephemeral: true });
    }
};
