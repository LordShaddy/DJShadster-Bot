const Discord = require("discord.js");
const { prefix } = require("./config.json");
const ytdl = require("ytdl-core");
const token = process.env.token
const client = new Discord.Client();

const queueM = new Map();

client.once("ready", () => {
    console.log("Ready!");
});

client.once("reconnecting", () => {
    console.log("Reconnecting!");
});

client.once("disconnect", () => {
    console.log("Disconnect!");
});

client.on('error', error => {
    console.log(error);
});

client.on('voiceStateUpdate', (oldState, newState) => {
    // if nobody left the channel in question, return.
    if (!oldState.channel)
        return;

    // otherwise, check how many people are in the channel now
    if (!oldState.channel.members.size - 1)
       oldState.channel.leave(); // leave
       queueM.delete(oldState.guild.id);
});

client.on("message", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queueM.get(message.guild.id);

    const args = message.content.split(" ");
    if (!message.content.includes(' ')) return;
    if (!args.length === 2) return;

    if (message.content.startsWith(`${prefix}play`)) {
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}loop`)) {
        loop(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}queue`)) {
        queue(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}leave`)) {
        leave(message, serverQueue);
        return;
    }

    else {
        message.channel.send("You need to enter a valid command!");
    }
});

async function execute(message, serverQueue) {
    const args = message.content.split(" ");

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return message.channel.send(
            "You need to be in a voice channel to play music!"
        );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "I need the permissions to join and speak in your voice channel!"
        );
    }

    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
        vLength: songInfo.videoDetails.lengthSeconds,
        requestedBy: message.author.username
    };

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true,
            loop: false
        };

        queueM.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            queueM.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`${song.title} has been added to the queue!`);
    }
}

function getFormattedTime(song){
    let dur = `${parseInt(song.vLength / 60)}:${(song.vLength - 60 * parseInt(song.vLength / 60)).toString().padStart(2, '0')}`
    return dur;
}

function leave(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    serverQueue.voiceChannel.leave();
}

function queue(message, serverQueue){
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );

    if (!serverQueue)
        return message.channel.send("There is no song in the queue");
    let nowPlaying = serverQueue.songs[0];
    let dur = getFormattedTime(nowPlaying)
    let queueMessage = `Now playing: ${nowPlaying.title} [${dur}]  -  ${nowPlaying.requestedBy}\n----------------------------------------------------------\n`

    for(var i=1; i < serverQueue.songs.length; i++){
        let currSong = serverQueue.songs[i]
        let dur = getFormattedTime(currSong)
        queueMessage += `${i}. ${currSong.title} [${dur}]  -  ${currSong.requestedBy}\n`
    }

    serverQueue.textChannel.send('```' + queueMessage + '\nRequested by: ' + message.author.username + '```')
}

function loop(message,serverQueue){
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );

    if (!serverQueue)
        return message.channel.send("There is no song that I could repeat!");

    serverQueue.loop = !serverQueue.loop

    if (serverQueue.loop === true)
        serverQueue.textChannel.send(`Starting loop: **${serverQueue.songs[0].title}**`);
    if (serverQueue.loop === false)
        serverQueue.textChannel.send(`Ending loop`);
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    if (!serverQueue)
        return message.channel.send("There is no song that I could skip!");
    serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
    const serverQueue = queueM.get(guild.id);
    if (!song) {
        queueM.delete(guild.id);
        return;
    }
    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            if (serverQueue.loop === true)
                serverQueue.songs.push(serverQueue.songs[0]);
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    let dur = getFormattedTime(song)
    serverQueue.textChannel.send(`Start playing: **${song.title}**  [${dur}]`);
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

}

client.login(token);