const token = 'YOUR_DISCORD_BOT_TOKEN';
const { Client, Intents, MessageAttachment } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES], partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
const { exec, spawn } = require("child_process");
const fs = require('fs');
const { setRelays, fetch } = require('fetch-relay');
const fsExtra = require('fs-extra')
const path = require('path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const axios = require('axios');
const tempPath = path.resolve(__dirname, "./temp");
const util = require('util');
setRelays([]);

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  fsExtra.emptyDirSync(tempPath);
});

function sendEval(message, result){ // A function that sends the result in different ways depending on the length of the result
try{
if(clean(result).length > 1020){
  message.reply({ files: [new MessageAttachment(Buffer.from(clean(result), 'utf-8'), 'eval.txt')]})
   }else {
     message.reply('```\n'+clean(result)+'```')
   }
    }catch(e){
    message.reply('```'+clean(e)+'```')
  }
 }
function clean(text) { // prevent token leak
   if (typeof(text) !== 'string') {
       text = util.inspect(text, { depth: 0 });
   }
     text = text.split(token).join('TOKEN');
            
   return text;
}

client.on('messageCreate', async (message) => {
    if(message.author.bot) return;
    if(message.channel.id != 'CHANNEL_ID_FOR_NODEJS')return;
    try {
        let filename = `${message.id}`;
        const messageContent = message.content;
        var fileContent = message.attachments.first()?.url;
        if(fileContent) {
            const { data } = await axios.get(fileContent, { responseType: 'arraybuffer' });
            fileContent = data;
        }else { fileContent = ""; }
        try {
            fs.writeFileSync(`${tempPath}/${filename}.js`, `${messageContent} ${fileContent}`); // create a temporary file
        } catch (e) {  }
        exec(`node temp/${filename}.js`, (error, stdout, stderr) => { // run the file
                if (stderr) {
                    sendEval(message, stderr);
                }else if (error) {
                    sendEval(message, error);
                }else {
                    sendEval(message, stdout);
                }
                try {
                   fs.unlinkSync(`${tempPath}/${filename}.js`);
                } catch (e) {  }
            });
    }catch(e) {}
})

client.on('messageCreate', async (message) => {
  if(message.author.bot) return;
  if(message.channel.id != 'CHANNEL_ID_FOR_PYTHON')return;
  try {
      let filename = `${message.id}`;
      const messageContent = message.content;
      var fileContent = message.attachments.first()?.url;
      if(fileContent) {
          const { data } = await axios.get(fileContent, { responseType: 'arraybuffer' });
          fileContent = data;
      }else { fileContent = ""; }
      try {
          fs.writeFileSync(`${tempPath}/${filename}.py`, `${messageContent} ${fileContent}`);
      } catch (e) {  }
      exec(`python3 temp/${filename}.py`, (error, stdout, stderr) => {
              if (stderr) {
                  sendEval(message, stderr);
              }else if (error) {
                  sendEval(message, error);
              }else {
                  sendEval(message, stdout);
              }
              try {
                 fs.unlinkSync(`${tempPath}/${filename}.py`);
              } catch (e) {  }
          });
  }catch(e) {}
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  try {
    await interaction.deferReply();
  if (interaction.commandName === 'run') { // run a command directly on the terminal 
    const content = interaction.options.getString('command');
    if(!content) return;
    var command = content.split(' ')[0];
    var args = content.split(' ').slice(1);
    if(command.startsWith('node') || command.includes('kill')) return interaction.editReply('Access Denied');
    const result = await runCommand(command, args);
    sendShell(interaction, result);
    await sendShell(interaction, await runCommand(command, args))
  }else if(interaction.commandName === 'get'){ // send a get request to a url
    const url = interaction.options.getString('url');
    if(!url) return;
    const { data } = await axios.get(url);
    await sendShell(interaction, data)
  }
}catch(e) {
    console.log(e);
}
});

function runCommand(command, args) {
    const spawned = spawn(command, args);
  const log = [];
    return new Promise((resolve) => {
      if(command == 'node') return resolve('Access Denied');
      spawned.stdout.on('data', (data) => {
        log.push(data.toString());
      });
      spawned.stderr.on('data', (data) => {
        log.push(data.toString());
      });
      spawned.on('error', (err) => {
        log.push(err.toString());
      })
      spawned.on('close', () => {
        resolve(log.join('\n'));
      });
    });
}

async function sendShell(interaction, result){
    try{
    if(clean(result).length > 1020){
     await interaction.editReply({ files: [new MessageAttachment(Buffer.from(clean(result), 'utf-8'), 'shell.txt')]})
       }else {
      await interaction.editReply('```\n'+clean(result)+'```')
       }
        }catch(e){
     await interaction.editReply('```'+clean(e)+'```')
      }
}

process.on('uncaughtException', (err) => {
    console.log(err)
});

process.on('unhandledRejection', err => {
    console.log(err)
});

function deploy(client) {
const { SlashCommandBuilder } = require('@discordjs/builders')
const runCommand = 
    new SlashCommandBuilder()
        .setName('run')
        .setDescription('Run a command')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('The command to run')
                .setRequired(true))
        .toJSON();
const getCommand = 
    new SlashCommandBuilder()
        .setName('get')
        .setDescription('Send a get request')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('The url to send a get request to')
                .setRequired(true))
        .toJSON();


const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationCommands(client.user.id), { body: [runCommand, getCommand] }); //register commands

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
}

client.login(token);
