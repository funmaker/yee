# Yee

TypeScript server for controlling Yeelight devices

```
Usage:
	yee <command> [options...]

Commands:
		start                           	Starts yee server.
		status                          	Displays yee server status.
		scan                            	Scans local network for bulbs.
		connect <bulb>                  	Connect to a light bulb.
		disconnect <bulb>               	Disconnect from a light bulb.
		refresh <bulb>                  	Refreshes light bulb state.
		on <bulb>                       	Turn on a light bulb.
		off <bulb>                      	Turn off a light bulb.
		preset <bulb> <preset>          	Launch specific preset.
		list-presets                    	List all avaliable presets.
		setName <bulb> <name>           	Set light bulb name.
		brightness <bulb> <level>       	Set light bulb brightness. <level> must be within 1 to 100 range
		white <bulb> <temperature>      	Set light bulb color temperature. <temperature> must be within 1700K to 6500K range
		color <bulb> <color>            	Set light bulb color.
		command <bulb> <method> <params>	Sends an arbitrary command. <params> must be an JSON-encoded string

<bulb> can be bulb name, id or location (eg: "yeelight://192.168.12.34:55443") or "*". "*" targets all known light bulbs.
<color> can be any CSS color string (eg: "blue", "#FF00FF", "hsv(0.5, 0.5, 1)", etc.). Lightness/value part of HSV/HSL is ignored.
<level> and <temperature> can be "increase", "decrease" and "circle" for relative adjustment. <color> can be "circle".

General options:
	--help         	           	Displays this message.
	--config <path>	--no-config	Config location. Defaults to '{projectRoot}/config.json', '~/.yee.json' or '/etc/yee.json'
	--verbose      	           	Enables debug output.
	--color        	--no-color 	Controls color output.
	--host         	-h         	Host address to use. Can include port. Default '127.0.0.1'.
	--port         	-p         	Port to use. Default '3900'.

Client options:
	--presets <path>	--no-presets	Presets directory location. Default '{projectRoot}/presets'
	                	--no-sync   	Do not wait for bulb response.

Server options:
	--state <path>        	--no-state        	Specifies persistent state file location. Default '{projectRoot}/state.json'
	--reconnect <maxTries>	--no-reconnect    	Maximum number of reconnect attempts before giving up. '0' means no limit. Default '10'
	--auto-connect        	--no-auto-connect 	Connect to bulbs automatically when detected. Default 'true'
	--start-connect       	--no-start-connect	Connect to all known bulbs automatically on start. Default 'true'
```

### Run development

```bash
npm run start
```
