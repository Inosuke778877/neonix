export default {
  name: 'nowplaying',
  aliases: ['np', 'current'],
  category: 'music',
  description: 'Show currently playing song',
  usage: 'nowplaying',
  execute(message, args, client) {
    if (!message.guild) {
      message.channel.send('``````');
      return;
    }

    const queue = client.queueManager.get(message.guild.id);
    if (!queue || !queue.nowPlaying) {
      message.channel.send('``````');
      return;
    }

    const song = queue.nowPlaying;
    
    let response = '```\n';
    response += `  🎵 Title: ${song.info.title}\n`;
    response += `  👤 Artist: ${song.info.author}\n`;
    response += `  ⏱️ Duration: ${formatDuration(song.info.length)}\n`;
    response += `  🔊 Volume: ${queue.volume}%\n`;
    response += `  📝 Queue: ${queue.songs.length} songs\n`;
    response += '\n╰──────────────────────────────────╯\n```';

    message.channel.send(response);

    if (message.deletable) {
      message.delete().catch(() => {});
    }
  },
};

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
