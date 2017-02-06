var mineflayer = require('mineflayer');

var bot = mineflayer.createBot({
   host: "localhost",
    port: 65238,
    username: 'REDACTED',
    password: 'REDACTED'
});

bot.on('chat', function(username, message, translate, jsonMessage, matches){
   if(username == bot.username)return;
    bot.chat(message);
});

bot.on('message', function(jsonMessage){
    if(jsonMessage.username == bot.username)return;
    if(jsonMessage.translate != "chat.type.emote")return; // not an emote
    console.log(jsonMessage.toString());
});

bot.on('playerJoined', function(player){
    if(player.username == bot.username) return; // self
   bot.chat("Hello, " + player.username);
});

bot.on('playerLeft', function(player){
   if(player.username == bot.username)return; // self
    bot.chat(":( " + player.username + " left");
});

bot.on('whisper', function(username, message, translate, jsonMessage, matches){
   if(username == bot.username) return;
    bot.whisper(username, message);
});

bot.on('end', function(){
   console.log("Ended");
});

bot.on('kicked', function(reason, loggedIn){
   console.log("I've been kicked: " + reason);
});