const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

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
const MIN_AGE_MS = 2 * 60 * 60 * 1000;        // 2 jam (akun dianggap "baru")
const OLD_ACCOUNT_WAIT_MS = 1 * 60 * 60 * 1000; // 1 jam tunggu untuk akun lama
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

  // ===== AKUN BARU (< 2 jam) =====
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

  // ===== AKUN LAMA TAPI BARU JOIN — AUTO PROMOTE setelah 1 jam =====
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
          { name: '🟡 Status', value: '⏳ Akan otomatis dipromosikan dalam 1 jam', inline: false },
        )
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: 'BOT125 Security', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      logChannel.send({ embeds: [embed] });
    }

    try {
      await member.send(
        `Halo! Akunmu sedang dalam masa verifikasi.\n` +
        `Kamu akan otomatis mendapat akses penuh dalam **1 jam**. Terima kasih sudah bersabar!`
      );
    } catch (e) {}

    setTimeout(async () => {
      try {
        const memberRole = member.guild.roles.cache.find(r => r.name === MEMBER_ROLE_NAME);
        await member.roles.remove(newDiscordRole);
        if (memberRole) await member.roles.add(memberRole);
        if (logChannel) {
          logChannel.send(`✅ **${member.user.tag}** sudah dipromosikan otomatis ke **${MEMBER_ROLE_NAME}**!`);
        }
        try {
          await member.send(`Verifikasi selesai! Kamu sekarang bisa akses server penuh. Selamat bermain! 🎮`);
        } catch (e) {}
      } catch (e) {}
    }, OLD_ACCOUNT_WAIT_MS);
  }
});

client.login(TOKEN);
