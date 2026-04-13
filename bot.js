const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ]
});

// ===== KONFIGURASI =====
const TOKEN = process.env.TOKEN;
const QUARANTINE_ROLE_NAME = 'NewDiscord';
const MEMBER_ROLE_NAME = 'Player Verify';
const LOG_CHANNEL_NAME = 'bot125-log';
const MIN_AGE_MS = 1 * 60 * 60 * 1000; // 1 jam
// =======================

client.once('ready', () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
});

client.on('guildMemberAdd', async (member) => {
  const accountAge = Date.now() - member.user.createdTimestamp;
  const logChannel = member.guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME);
  const usiaHari = Math.floor(accountAge / (1000 * 60 * 60 * 24));
  const usiaJam = Math.floor(accountAge / 3600000);
  const usiaMenit = Math.floor((accountAge % 3600000) / 60000);

  let newDiscordRole = member.guild.roles.cache.find(r => r.name === QUARANTINE_ROLE_NAME);
  if (!newDiscordRole) {
    newDiscordRole = await member.guild.roles.create({
      name: QUARANTINE_ROLE_NAME,
      permissions: [],
      reason: 'Role otomatis untuk akun baru',
    });
  }

  await member.roles.add(newDiscordRole);

  const waitingRoom = member.guild.channels.cache.find(c => c.name === 'tanya-admin');
  if (waitingRoom) {
    waitingRoom.send(
      `Halo ${member}! Akunmu sedang dalam masa verifikasi.\n` +
      `Kamu bisa bertanya di sini sambil menunggu akses penuh. Admin akan membantu kamu! 😊`
    );
  }

  // ===== AKUN BARU =====
  if (accountAge < MIN_AGE_MS) {
    const sisaWaktuMs = MIN_AGE_MS - accountAge;
    const sisaJam = Math.ceil(sisaWaktuMs / (60 * 60 * 1000));
    const sisaMenit = Math.ceil(sisaWaktuMs / 60000);

    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setAuthor({ name: 'BOT125 Security System', iconURL: client.user.displayAvatarURL() })
        .setTitle('🚨 Akun Baru Terdeteksi')
        .setDescription('──────────────────────')
        .addFields(
          { name: '👤 User', value: `${member.user.tag}`, inline: true },
          { name: '🆔 ID', value: `${member.user.id}`, inline: true },
          { name: '📅 Usia Akun', value: `${usiaJam} jam ${usiaMenit} menit`, inline: true },
          { name: '⏳ Cooldown', value: `~${sisaMenit} menit lagi`, inline: true },
          { name: '🔴 Status', value: '⛔ NewDiscord — Akses Terbatas', inline: true },
          { name: '✅ Setelah Cooldown', value: `Dapat role **${MEMBER_ROLE_NAME}**`, inline: true },
        )
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: 'Bot125 Security', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
      logChannel.send({ embeds: [embed] });
    }

    try {
      await member.send(
        `Halo! Akun Discord kamu terlalu baru untuk masuk server ini.\n` +
        `Kamu perlu menunggu sekitar **${sisaMenit} menit lagi** sebelum bisa akses penuh.\n` +
        `Kamu akan otomatis mendapat akses setelah waktu selesai. Terima kasih!`
      );
    } catch (e) {}

    setTimeout(async () => {
      try {
        await member.roles.remove(newDiscordRole);
        const memberRole = member.guild.roles.cache.find(r => r.name === MEMBER_ROLE_NAME);
        if (memberRole) await member.roles.add(memberRole);
        if (logChannel) {
          logChannel.send(`✅ **${member.user.tag}** sudah dipromosikan otomatis ke **${MEMBER_ROLE_NAME}**!`);
        }
      } catch (e) {}
    }, sisaWaktuMs);

    console.log(`${member.user.tag} — NewDiscord (akun ${usiaJam} jam ${usiaMenit} menit).`);

  // ===== AKUN LAMA TAPI BARU JOIN =====
  } else {
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xfaa61a)
        .setAuthor({ name: 'BOT125 Security System', iconURL: client.user.displayAvatarURL() })
        .setTitle('🔍 Akun Lama Baru Join')
        .setDescription('──────────────────────')
        .addFields(
          { name: '👤 User', value: `${member.user.tag}`, inline: true },
          { name: '🆔 ID', value: `${member.user.id}`, inline: true },
          { name: '📅 Usia Akun', value: `${usiaHari} hari`, inline: true },
          { name: '🟡 Status', value: '⏳ Menunggu verifikasi admin', inline: false },
        )
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: 'BOT125 Security', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_${member.user.id}`)
            .setLabel('✅ Approve')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reject_${member.user.id}`)
            .setLabel('❌ Reject')
            .setStyle(ButtonStyle.Danger),
        );

      logChannel.send({ embeds: [embed], components: [row] });
    }

    try {
      await member.send(
        `Halo! Akunmu sedang dalam proses verifikasi admin.\n` +
        `Mohon tunggu sebentar, admin akan segera memeriksa akunmu. Terima kasih!`
      );
    } catch (e) {}
  }
});

// ===== HANDLE TOMBOL APPROVE / REJECT =====
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, userId] = interaction.customId.split('_');
  const member = await interaction.guild.members.fetch(userId).catch(() => null);

  if (!member) {
    return interaction.reply({ content: '❌ Member tidak ditemukan atau sudah keluar.', ephemeral: true });
  }

  const newDiscordRole = interaction.guild.roles.cache.find(r => r.name === QUARANTINE_ROLE_NAME);
  const memberRole = interaction.guild.roles.cache.find(r => r.name === MEMBER_ROLE_NAME);

  if (action === 'approve') {
    if (newDiscordRole) await member.roles.remove(newDiscordRole);
    if (memberRole) await member.roles.add(memberRole);

    const embed = new EmbedBuilder()
      .setColor(0x3ba55c)
      .setAuthor({ name: 'BOT125 Security System', iconURL: client.user.displayAvatarURL() })
      .setTitle('✅ Member Diapprove')
      .setDescription(`**${member.user.tag}** telah diverifikasi dan mendapat role **${MEMBER_ROLE_NAME}**.`)
      .addFields({ name: '👮 Diapprove oleh', value: `${interaction.user.tag}` })
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ text: 'BOT125 Security', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });

    try {
      await member.send(`Akunmu telah diverifikasi oleh admin! Kamu sekarang bisa akses server penuh. Selamat bermain! 🎮`);
    } catch (e) {}

  } else if (action === 'reject') {
    await member.kick('Ditolak oleh admin saat verifikasi.');

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setAuthor({ name: 'Bot125 Security System', iconURL: client.user.displayAvatarURL() })
      .setTitle('❌ Member Direject')
      .setDescription(`**${member.user.tag}** telah ditolak dan dikeluarkan dari server.`)
      .addFields({ name: '👮 Direject oleh', value: `${interaction.user.tag}` })
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ text: 'Bot125 Security', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
  }
});

client.login(TOKEN);