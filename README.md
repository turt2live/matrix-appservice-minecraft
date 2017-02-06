# matrix-appservice-minecraft

Minecraft bridge for [[Matrix]](https://matrix.org).

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

2. Copy `config.sample.yaml` to `config.yaml` and fill in the appropriate fields
3. Generate the registration file
```
node minecraft-as.js -r -u "http://localhost:9000"
```
*Note:* The default URL to run the appservice at is `http://localhost:9000`. If you have other appservices, or other requirements, pick an appropriate hostname and port.

4. Copy/symlink the registration file to your Synapse directory
```
cd ~/.synapse
ln -s ../matrix-appservice-matrix/matrix-registration.yaml matrix-registration.yaml
```

5. Add the registration file to your `homeserver.yaml`
```
...
app_service_config_files: ["minecraft-registration.yaml"]
...
```

6. Restart synapse (`synctl restart`, for example)

# Running

Using the port specified during install (`9000` by default), use `node minecraft-as.js -p 9000 -c config.yaml` from the repository directory.

The bridge should start working shortly afterwards.

# Usage

## Linking a Minecraft server to a room

To join a server such as `myserver.com`, join the room `#minecraft_myserver.com:domain.com`.

If the server has a custom port (not 25565), join `#minecraft_myserver.com_12345:domain.com` where 12345 is the port number.
 
# General information and stuff

This is based off [matrix-appservice-bridge](https://github.com/matrix-org/matrix-appservice-bridge) and uses [mineflayer](https://github.com/PrismarineJS/mineflayer) to connect a fake player to the Minecraft server. The fake player is not capable of actually playing the game, and ends up sitting at the spawn point (it does revive itself if someone kills it, however).

Eventually a plugin for server owners will be written/supplied to avoid having an idle player sitting on the server. The plugin will be attempted first before defaulting to trying to connect with the player account. The plugin will also therefore support modded servers (such as FTB) - the player doesn't have any mods installed.

[matrix-appservice-twitter](https://github.com/Half-Shot/matrix-appservice-twitter) was used as a reference implementation of a Synapse appservice - thanks Half-Shot!