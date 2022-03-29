const Discord = require("discord.js");
const { prefix } = require("./config.json");
const ytdl = require("ytdl-core");
const token = process.env.token
const client = new Discord.Client();
const queueM = new Map();

const { YTSearcher } = require('ytsearcher');

const searcher = new YTSearcher({
    key: process.env.yttoken,
    revealed: true
});

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
    console.log("client catched error")
    console.log(error);
    //serverQueue.textChannel.send(`Hosting Server Connection Error @Shaddy#8969 please reset me`);
});

process.on('uncaughtException', err => {
    console.error('There was an uncaught process error', err)
    //serverQueue.textChannel.send(`Hosting Server Connection Error @Shaddy#8969 please reset me`);
    //serverQueue.voiceChannel.leave();
    process.exit(1) //mandatory (as per the Node.js docs)
})

client.on('voiceStateUpdate', (oldState, newState) => {
    // if nobody left the channel in question, return.
    if (!oldState.channel)
        return;

    // otherwise, check how many people are in the channel now
    if (oldState.channel.members.size <= 1) {
        oldState.channel.leave(); // leave
        console.log(`${new Date().toLocaleString("de-DE")} Leaving Voice for: "${oldState.guild.name}" `)
        queueM.delete(oldState.guild.id);
    }
});

client.on("message", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

     const serverQueue = queueM.get(message.guild.id);

    const args = message.content.split(" ");
    const input = message.content.substring(message.content.indexOf(' ') + 1);

    if (message.content.toLowerCase().startsWith(`${prefix}play`)) {
        if (args.length < 2) return;
        execute(message, serverQueue);
        return;
    } else if (message.content.toLowerCase().startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.toLowerCase().startsWith(`${prefix}loop`)) {
        loop(message, serverQueue);
        return;
    } else if (message.content.toLowerCase().startsWith(`${prefix}queue`)) {
        queue(message, serverQueue);
        return;
    } else if (message.content.toLowerCase().startsWith(`${prefix}leave`)) {
        leave(message, serverQueue);
        return;
    } else if (message.content.toLowerCase().startsWith(`${prefix}pause`)) {
        pause(message, serverQueue);
        return;
    } else if (message.content.toLowerCase().startsWith(`${prefix}resume`)) {
        resume(message, serverQueue);
        return;
    }
    else {
        message.channel.send("You need to enter a valid command!");
    }
});

async function execute(message, serverQueue) {
    const args = message.content.split(" ");
    const input = message.content.substring(message.content.indexOf(' ') + 1);

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
    let songInfo
    try{
        if(validURL(input)){
            if (ytdl.validateURL(input)){
                songInfo = await ytdl.getInfo(input);
            }else{
                return message.channel.send(`Please send a valid song link`);
            }
        }else{
            let result = await searcher.search(input, { type: "video" })
            songInfo = await ytdl.getInfo(result.first.url)
        }
    }catch (err){
        console.log(err);
        return message.channel.send(`oopsie woopsie! Looks like I couldn't access the video for some reason! (age restriction/having to log in/other BS) `);
    }

    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
        vLength: songInfo.videoDetails.lengthSeconds,
        requestedBy: message.author.username
    };

    if (!serverQueue || serverQueue.songs.length < 1) {
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
            console.log(`${new Date().toLocaleString("de-DE")} Joining Voice for: "${message.guild.name}"`)
        } catch (err) {
            console.log(err);
            return message.channel.send(err);
        }
    } else {
        if (serverQueue.songs.length < 1) {
            serverQueue.songs.push(song);
            play(message.guild, song);
        }
        else {
            serverQueue.songs.push(song);
        }
        return message.channel.send(`**${song.title}** has been added to the queue!`);
    }
}

function validURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
        '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
    return !!pattern.test(str);
}

function getFormattedTime(song){
    let dur = `${parseInt(song.vLength / 60)}:${(song.vLength - 60 * parseInt(song.vLength / 60)).toString().padStart(2, '0')}`
    return dur;
}

function pause(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to pause the music!"
        );
    if (!serverQueue || serverQueue.songs.length < 1)
        return message.channel.send("There is no song in the queue!");
    if(serverQueue.connection.dispatcher.paused)
        return message.channel.send("The song is already paused!");
    serverQueue.connection.dispatcher.pause();
    message.channel.send("The song has been paused!");
}

function resume(message,serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to pause the music!"
        );
    if (!serverQueue || serverQueue.songs.length < 1)
        return message.channel.send("There is no song in the queue!");
    if(!serverQueue.connection.dispatcher.paused)
        return message.channel.send("The song is already playing!");
    serverQueue.connection.dispatcher.resume();
    message.channel.send("The song has been resumed!");
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

    if (!serverQueue || serverQueue.songs.length < 1)
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

    if (!serverQueue || serverQueue.songs.length < 1)
        return message.channel.send("There is no song that I could repeat!");

    serverQueue.loop = !serverQueue.loop

    if (serverQueue.loop === true)
        serverQueue.textChannel.send(`Starting Queue Loop`);
    if (serverQueue.loop === false)
        serverQueue.textChannel.send(`Ending Queue Loop`);
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    if (!serverQueue || serverQueue.songs.length < 1)
        return message.channel.send("There is no song that I could skip!");
    serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
    const serverQueue = queueM.get(guild.id);
    if (!song) {
        return;
    }
    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            if (serverQueue.loop === true) {
                //todo: loops the queue instead of the song - make new function for single loop
                serverQueue.songs.push(serverQueue.songs[0]);
            }
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    let dur = getFormattedTime(song)
    serverQueue.textChannel.send(`Start playing: **${song.title}**  [${dur}]`);
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

client.login(token);
//todo: simple loop of one song, not entire queue
//todo: leave voice if shut down
//todo: !np - anzeige wie weit im song ist
// !person command - random quote of the person ":forsencd: 💬 [PL] ~ ..."