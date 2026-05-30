const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Envoie un embed de règlement avec un bouton d\'acceptation')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Le message à afficher dans l\'embed')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('role1')
                .setDescription('Rôle à attribuer lors de l\'acceptation (obligatoire)')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('role2')
                .setDescription('Rôle supplémentaire à attribuer (optionnel)')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option.setName('role3')
                .setDescription('Rôle supplémentaire à attribuer (optionnel)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const message = interaction.options.getString('message');
        const role1 = interaction.options.getRole('role1');
        const role2 = interaction.options.getRole('role2');
        const role3 = interaction.options.getRole('role3');

        const roles = [role1, role2, role3].filter(Boolean);
        const roleIds = roles.map(r => r.id).join(',');
        const roleMentions = roles.map(r => r.toString()).join(', ');

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('📜 Règlement')
            .setDescription(message)
            .addFields({ name: '🎭 Rôles attribués', value: roleMentions })
            .setFooter({ text: 'Cliquez sur le bouton ci-dessous pour accepter le règlement.' })
            .setTimestamp();

        const button = new ButtonBuilder()
            .setCustomId(`rules_accept_${roleIds}`)
            .setLabel('✅ Accepter le règlement')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({ content: '✅ Embed de règlement envoyé.', ephemeral: true });
        await interaction.channel.send({ embeds: [embed], components: [row] });
    }
};
