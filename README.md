# matrix-appservice-minecraft

[![Greenkeeper badge](https://badges.greenkeeper.io/turt2live/matrix-appservice-minecraft.svg)](https://greenkeeper.io/) [![TravisCI badge](https://travis-ci.org/turt2live/matrix-appservice-minecraft.svg?branch=master)](https://travis-ci.org/turt2live/matrix-appservice-minecraft)
[![Targeted for next release](https://badge.waffle.io/turt2live/matrix-appservice-minecraft.png?label=sorted&title=Targeted+for+next+release)](https://waffle.io/turt2live/waffle-matrix?utm_source=badge) [![WIP](https://badge.waffle.io/turt2live/matrix-appservice-minecraft.png?label=wip&title=WIP)](https://waffle.io/turt2live/waffle-matrix?utm_source=badge)

Minecraft bridge for [[Matrix]](https://matrix.org).

Matrix room: [#minecraft-bridge:matrix.org](https://matrix.to/#/#minecraft-bridge:matrix.org)

# Requirements

* [NodeJS](https://nodejs.org/en/) (`v6.9.2` or higher recommended)
* A [Minecraft](https://minecraft.net/en-us/) account (game purchase required)
* A [Synapse](https://github.com/matrix-org/synapse) server

# Features

* Current
  * Nothing exciting
* Planned
  * Minecraft-to-Matrix messaging in a room
  * Matrix-to-Minecraft messaging
  * Dedicated plugin for handling server-side chat (to avoid an idle player in-game)

# Installation

**Before you begin:** A Synapse server is required. The instructions here assume that Synapse server is a default setup.

1. Clone this repository and install the dependencies
   ```
   git clone https://github.com/turt2live/matrix-appservice-minecraft
   cd matrix-appservice-minecraft 
   npm install
   ```

2. Copy `config/sample.yaml` to `config/config.yaml` and fill in the appropriate fields
3. Generate the registration file
   ```
   node app.js -r -u "http://localhost:9000" -c config/config.yaml
   ```
   *Note:* The default URL to run the appservice at is `http://localhost:9000`. If you have other appservices, or other requirements, pick an appropriate hostname and port.

4. Copy/symlink the registration file to your Synapse directory
   ```
   cd ~/.synapse
   ln -s ../matrix-appservice-minecraft/appservice-registration-minecraft.yaml appservice-registration-minecraft.yaml
   ```

5. Add the registration file to your `homeserver.yaml`
   ```
   ...
   app_service_config_files: ["appservice-registration-minecraft.yaml"]
   ...
   ```

6. Restart synapse (`synctl restart`, for example)

# Running

Using the port specified during install (`9000` by default), use `node app.js -p 9000 -c config/config.yaml` from the repository directory.

The bridge should start working shortly afterwards.

# Usage

## Linking a Minecraft server to a room

#### When your homeserver doesn't have the bridge running

Open a 1:1 conversation with `@_minecraft:t2bot.io` and send the message `!bridge <room id> <server name[:port]>`.

For example, `!bridge !kBDEQKODhuvfjxDMAl:t2l.io my-minecraft-server.com:12345`.

The room must be public (so the bridge can join and start bridging users)

#### When your homeserver has the bridge running

To join a server such as `myserver.com`, join the room `#_minecraft_myserver.com:domain.com`.

If the server has a custom port (not 25565), join `#_minecraft_myserver.com_12345:domain.com` where 12345 is the port number.
 
# General information and stuff

This is based off [matrix-appservice-bridge](https://github.com/matrix-org/matrix-appservice-bridge) and uses [mineflayer](https://github.com/PrismarineJS/mineflayer) to connect a fake player to the Minecraft server. The fake player is not capable of actually playing the game, and ends up sitting at the spawn point (it does revive itself if someone kills it, however).

Eventually a plugin for server owners will be written/supplied to avoid having an idle player sitting on the server. The plugin will be attempted first before defaulting to trying to connect with the player account. The plugin will also therefore support modded servers (such as FTB) - the player doesn't have any mods installed.

[matrix-appservice-twitter](https://github.com/Half-Shot/matrix-appservice-twitter) was used as a reference implementation of a Synapse appservice - thanks Half-Shot!
