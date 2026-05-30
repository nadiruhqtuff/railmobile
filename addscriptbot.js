const { SlashCommandBuilder } = require('discord.js');
const { startBot } = require('../utils/botManager');
const { logAddScriptBot } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addscriptbot')
        .setDescription('Met un bot en ligne avec un script')
        .addStringOption(opt =>
            opt.setName('script')
                .setDescription('Nom du script à utiliser (ex: commu, ticket, moderation)')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('token')
                .setDescription('Token du bot Discord à mettre en ligne')
                .setRequired(true)),

    async execute(interaction, mainClient) {
        await interaction.deferReply({ ephemeral: true });

        const scriptName = interaction.options.getString('script');
        const token = interaction.options.getString('token');

        const result = await startBot({
            token,
            scriptName,
            requestedBy: interaction.user.id,
            guildId: interaction.guildId,
            mainClient
        });

        if (!result.success) {
            return interaction.editReply(`❌ Erreur : ${result.message}`);
        }

        logAddScriptBot(mainClient, interaction.guildId, {
            scriptName,
            botId: result.botId,
            executedBy: `${interaction.user.tag} (${interaction.user.id})`
        });

        await interaction.editReply(
            `✅ Le bot **${result.botTag}** a été mis en ligne avec le script \`${scriptName}\`.\n` +
            `⏰ Il sera hors ligne dans **24 heures**.\n` +
            `📩 Vous recevrez un DM de confirmation et un rappel à l'expiration.`
        );
    }
};
